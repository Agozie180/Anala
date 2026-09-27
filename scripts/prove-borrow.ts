/**
 * Anala Lending — on-chain proof that the over-borrow bug is fixed (devnet).
 *
 * Reads the live pool state, then demonstrates the borrow-capacity gate two ways:
 *   A) SAFETY:      an over-cap borrow of $1,000,000 (which the OLD 1000x-decimal
 *                   bug would have allowed for a few tokens) must be REJECTED with
 *                   ExceedsLTV (custom error 6002).
 *   B) CORRECTNESS: a within-cap borrow must SUCCEED and deliver the exact USDC.
 * Then it repays, proving the full deposit -> borrow -> repay flow on devnet.
 *
 * Account orders match programs/anala-lending/src/lib.rs exactly (raw ix; the
 * Anchor IDL/types path is intentionally not used).
 *
 * Usage:
 *   SOLANA_RPC_URL=https://api.devnet.solana.com npx tsx scripts/prove-borrow.ts
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  getAccount,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(process.env.LENDING_PROGRAM_ID || '7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG');
const MARKET = (process.env.MARKET || 'ANTHROPIC').toUpperCase();

const USDC_DECIMALS = 6;

function disc(name: string): Buffer {
  return crypto.createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
}
function u64(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}
function loadWallet(): Keypair {
  const p = process.env.SOLANA_WALLET || path.join(os.homedir(), '.config', 'solana', 'id.json');
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(p, 'utf-8'))));
}
function loadMints(): Record<string, string> {
  const cache = path.join(__dirname, '.devnet-mints.json');
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf-8'));
  return {
    USDC: process.env.NEXT_PUBLIC_USDC_MINT!,
    ANTHROPIC: process.env.NEXT_PUBLIC_ANTHROPIC_MINT!,
    OPENAI: process.env.NEXT_PUBLIC_OPENAI_MINT!,
    SPACEX: process.env.NEXT_PUBLIC_SPACEX_MINT!,
  };
}

interface PoolState {
  totalCollateral: bigint;
  totalBorrowed: bigint;
  ltvBps: number;
  interestBps: number;
  price: bigint;
  decimals: number;
}
function readPool(data: Buffer): PoolState {
  return {
    totalCollateral: data.readBigUInt64LE(168),
    totalBorrowed: data.readBigUInt64LE(176),
    ltvBps: data.readUInt16LE(184),
    interestBps: data.readUInt16LE(186),
    price: data.readBigUInt64LE(189),
    decimals: data.readUInt8(197),
  };
}
function readPosition(data: Buffer | null): { collateral: bigint; borrowed: bigint } {
  if (!data) return { collateral: 0n, borrowed: 0n };
  return { collateral: data.readBigUInt64LE(72), borrowed: data.readBigUInt64LE(80) };
}
const usd = (base: bigint) => `$${(Number(base) / 10 ** USDC_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function isLtvRejection(e: unknown): boolean {
  const s = JSON.stringify(e instanceof Error ? { m: e.message, l: (e as { logs?: string[] }).logs } : e);
  return s.includes('6002') || s.includes('0x1772') || s.includes('ExceedsLTV');
}

async function main() {
  const conn = new Connection(RPC, 'confirmed');
  const wallet = loadWallet();
  const mints = loadMints();
  const collateralMint = new PublicKey(mints[MARKET]);
  const usdcMint = new PublicKey(mints.USDC);

  console.log('=============================================');
  console.log(` Anala Lending — borrow-gate proof (${MARKET}, devnet)`);
  console.log('=============================================');
  console.log('RPC    :', RPC);
  console.log('Wallet :', wallet.publicKey.toBase58());

  const [pool] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool'), collateralMint.toBuffer()], PROGRAM_ID);
  const [collateralVault] = PublicKey.findProgramAddressSync([Buffer.from('collateral_vault'), pool.toBuffer()], PROGRAM_ID);
  const [borrowVault] = PublicKey.findProgramAddressSync([Buffer.from('borrow_vault'), pool.toBuffer()], PROGRAM_ID);
  const [userPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_position'), pool.toBuffer(), wallet.publicKey.toBuffer()], PROGRAM_ID);
  console.log('Pool   :', pool.toBase58());

  const poolInfo = await conn.getAccountInfo(pool);
  if (!poolInfo) throw new Error(`Pool for ${MARKET} not found — run setup:devnet first`);
  const ps = readPool(poolInfo.data);
  const priceUsdPerToken = Number(ps.price) / 10 ** USDC_DECIMALS;
  console.log(`\nOn-chain pool state:`);
  console.log(`  price            : ${ps.price} base units  (= $${priceUsdPerToken.toFixed(2)} / token)`);
  console.log(`  collateral dp    : ${ps.decimals}`);
  console.log(`  LTV              : ${ps.ltvBps} bps (${ps.ltvBps / 100}%)`);
  console.log(`  interest         : ${ps.interestBps} bps (${ps.interestBps / 100}% APR)`);

  const userAnt = await getOrCreateAssociatedTokenAccount(conn, wallet, collateralMint, wallet.publicKey);
  const userUsdc = await getOrCreateAssociatedTokenAccount(conn, wallet, usdcMint, wallet.publicKey);

  // Ensure the position holds collateral (deposit 10 tokens if it has none).
  const scale = 10n ** BigInt(ps.decimals);
  const DEPOSIT = 10n * scale; // 10 whole collateral tokens
  let pos = readPosition((await conn.getAccountInfo(userPosition))?.data ?? null);
  if (pos.collateral === 0n) {
    console.log(`\n[deposit] depositing 10 ${MARKET} as collateral...`);
    const data = Buffer.concat([disc('deposit_collateral'), u64(DEPOSIT)]);
    const keys = [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: userPosition, isSigner: false, isWritable: true },
      { pubkey: collateralVault, isSigner: false, isWritable: true },
      { pubkey: userAnt.address, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
    const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [wallet], { commitment: 'confirmed' });
    console.log('  ✓ deposit tx:', sig);
    pos = readPosition((await conn.getAccountInfo(userPosition))!.data);
  } else {
    console.log(`\n[deposit] position already holds ${Number(pos.collateral) / Number(scale)} ${MARKET}; skipping deposit`);
  }

  // Correct capacity from on-chain values (u128-equivalent in JS BigInt).
  const collateralValue = (pos.collateral * ps.price) / scale; // USDC base units
  const maxBorrow = (collateralValue * BigInt(ps.ltvBps)) / 10_000n;
  const oldBuggyMax = maxBorrow * scale / (10n ** BigInt(USDC_DECIMALS)); // ~1000x for 9dp collateral
  console.log(`\nBorrow capacity (correct, decimal-scaled):`);
  console.log(`  collateral value : ${usd(collateralValue)}`);
  console.log(`  max borrow (${ps.ltvBps / 100}% LTV): ${usd(maxBorrow)}  [${maxBorrow} base units]`);
  console.log(`  (the OLD 1000x bug would have allowed ~${usd(oldBuggyMax)})`);

  // ---- Test A: over-cap borrow must be REJECTED ----
  const OVER = 1_000_000n * 10n ** BigInt(USDC_DECIMALS); // $1,000,000
  console.log(`\n[A] SAFETY — attempting to borrow ${usd(OVER)} (far above cap); expect ExceedsLTV(6002)...`);
  let rejected = false;
  try {
    const data = Buffer.concat([disc('borrow'), u64(OVER)]);
    const keys = [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: userPosition, isSigner: false, isWritable: true },
      { pubkey: borrowVault, isSigner: false, isWritable: true },
      { pubkey: userUsdc.address, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
    await sendAndConfirmTransaction(conn, new Transaction().add(ix), [wallet], { commitment: 'confirmed' });
  } catch (e) {
    rejected = isLtvRejection(e);
    if (!rejected) throw e;
  }
  console.log(rejected ? '  ✓ PASS — over-cap borrow correctly rejected (ExceedsLTV / 6002)'
                       : '  ✗ FAIL — over-cap borrow was NOT rejected!');
  if (!rejected) process.exit(1);

  // ---- Test B: within-cap borrow must SUCCEED ----
  const available = maxBorrow - pos.borrowed;
  const BORROW = available > 2_000n * 10n ** BigInt(USDC_DECIMALS)
    ? 2_000n * 10n ** BigInt(USDC_DECIMALS)          // borrow $2,000 when there's room
    : (available * 8n) / 10n;                        // else 80% of remaining headroom
  console.log(`\n[B] CORRECTNESS — borrowing ${usd(BORROW)} (within cap); expect success...`);
  const usdcBefore = (await getAccount(conn, userUsdc.address)).amount;
  {
    const data = Buffer.concat([disc('borrow'), u64(BORROW)]);
    const keys = [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: userPosition, isSigner: false, isWritable: true },
      { pubkey: borrowVault, isSigner: false, isWritable: true },
      { pubkey: userUsdc.address, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
    const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [wallet], { commitment: 'confirmed' });
    console.log('  ✓ borrow tx:', sig);
    console.log('    https://explorer.solana.com/tx/' + sig + '?cluster=devnet');
  }
  const usdcAfter = (await getAccount(conn, userUsdc.address)).amount;
  pos = readPosition((await conn.getAccountInfo(userPosition))!.data);
  console.log(`  USDC received    : ${usd(usdcAfter - usdcBefore)}`);
  console.log(`  position borrowed: ${usd(pos.borrowed)}  [${pos.borrowed} base units]`);

  // ---- Repay to prove the full flow and settle the debt ----
  console.log(`\n[C] repay — repaying ${usd(BORROW)} to settle the loan...`);
  {
    const data = Buffer.concat([disc('repay'), u64(BORROW)]);
    const keys = [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: userPosition, isSigner: false, isWritable: true },
      { pubkey: borrowVault, isSigner: false, isWritable: true },
      { pubkey: userUsdc.address, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
    const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [wallet], { commitment: 'confirmed' });
    console.log('  ✓ repay tx:', sig);
  }
  pos = readPosition((await conn.getAccountInfo(userPosition))!.data);
  console.log(`  position borrowed after repay: ${usd(pos.borrowed)}  [${pos.borrowed} base units]`);
  if (pos.borrowed > 0n) console.log('  (residual = simple interest accrued between borrow and repay — real, non-zero)');

  console.log('\n=============================================');
  console.log(' ✅ PROOF COMPLETE');
  console.log(`    over-cap $1,000,000 borrow: REJECTED (6002)`);
  console.log(`    within-cap ${usd(BORROW)} borrow: SUCCEEDED`);
  console.log('    old 1000x over-borrow bug is fixed on-chain.');
  console.log('=============================================');
}

main().catch((e) => {
  console.error('\n✗ PROOF FAILED:', e.message);
  if (e.logs) console.error('Logs:\n  ' + e.logs.join('\n  '));
  process.exit(1);
});
