/**
 * DEVNET audit — root-cause why borrow/repay/withdraw fail on the live /lend demo.
 *
 * Phase 1 (read-only): mint decimals, pool existence/owner/ltv/totals, vault
 *   balances, operator ATA balances, operator position — for all 3 tokens.
 * Phase 2 (live flow on ANTHROPIC): deposit -> borrow -> repay -> withdraw with
 *   the operator wallet, raw instructions (account order per lib.rs), printing
 *   full program logs on any revert so we see exactly which ix reverts and why.
 *
 * Reproduces the exact addresses the deployed UI uses (devnet mints + program).
 * Run: npx tsx scripts/devnet-audit.ts
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
  getMint,
  getAccount,
  mintTo,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as crypto from 'crypto';

const RPC = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG');
const WALLET_PATH = 'C:\\Users\\USER\\.devnet-operator.json';

const mints = JSON.parse(fs.readFileSync('scripts/.devnet-mints.json', 'utf-8')) as Record<string, string>;
const USDC_MINT = new PublicKey(mints.USDC);
const TOKENS: Record<string, PublicKey> = {
  ANTHROPIC: new PublicKey(mints.ANTHROPIC),
  OPENAI: new PublicKey(mints.OPENAI),
  SPACEX: new PublicKey(mints.SPACEX),
};

function disc(name: string): Buffer {
  return crypto.createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
}
function u64(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}
function pdas(mint: PublicKey, user: PublicKey) {
  const [pool] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool'), mint.toBuffer()], PROGRAM_ID);
  const [collateralVault] = PublicKey.findProgramAddressSync([Buffer.from('collateral_vault'), pool.toBuffer()], PROGRAM_ID);
  const [borrowVault] = PublicKey.findProgramAddressSync([Buffer.from('borrow_vault'), pool.toBuffer()], PROGRAM_ID);
  const [position] = PublicKey.findProgramAddressSync([Buffer.from('user_position'), pool.toBuffer(), user.toBuffer()], PROGRAM_ID);
  return { pool, collateralVault, borrowVault, position };
}

async function readPool(conn: Connection, pool: PublicKey) {
  const info = await conn.getAccountInfo(pool);
  if (!info) return null;
  const d = info.data;
  return {
    ownedByProgram: info.owner.equals(PROGRAM_ID),
    bytes: d.length,
    totalCollateral: d.readBigUInt64LE(168),
    totalBorrowed: d.readBigUInt64LE(176),
    ltvBps: d.readUInt16LE(184),
    interestBps: d.readUInt16LE(186),
  };
}
async function readPosition(conn: Connection, position: PublicKey) {
  const info = await conn.getAccountInfo(position);
  if (!info) return null;
  const d = info.data;
  return { collateral: d.readBigUInt64LE(72), borrowed: d.readBigUInt64LE(80) };
}
async function bal(conn: Connection, ata: PublicKey): Promise<bigint | null> {
  try { return (await getAccount(conn, ata)).amount; } catch { return null; }
}

async function send(conn: Connection, wallet: Keypair, ix: TransactionInstruction, label: string): Promise<boolean> {
  try {
    const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [wallet], { commitment: 'confirmed' });
    console.log(`  \u2713 ${label} ok: ${sig}`);
    return true;
  } catch (e: any) {
    console.log(`  \u2717 ${label} FAILED: ${e.message}`);
    const logs = e?.logs || e?.transactionLogs;
    if (logs) console.log('    logs:\n      ' + logs.join('\n      '));
    return false;
  }
}

async function main() {
  console.log('=== RPC:', RPC, '===');
  console.log('=== discriminators (must match lending.ts) ===');
  for (const n of ['deposit_collateral', 'borrow', 'repay', 'withdraw_collateral']) {
    console.log(`  ${n.padEnd(20)} [${Array.from(disc(n)).join(',')}]`);
  }

  const conn = new Connection(RPC, 'confirmed');
  const wallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'))));
  console.log('\n=== operator wallet ===\n  ', wallet.publicKey.toBase58());
  console.log('   SOL:', (await conn.getBalance(wallet.publicKey)) / 1e9);

  const usdcDec = (await getMint(conn, USDC_MINT)).decimals;
  console.log('\n=== USDC ===\n   mint:', USDC_MINT.toBase58(), ' decimals:', usdcDec);
  const usdcAta = await getOrCreateAssociatedTokenAccount(conn, wallet, USDC_MINT, wallet.publicKey);
  console.log('   operator USDC ATA:', usdcAta.address.toBase58(), ' bal:', usdcAta.amount.toString());

  // ---- Phase 1: read-only probe of all three markets ----
  for (const [name, mint] of Object.entries(TOKENS)) {
    console.log(`\n===== ${name} =====`);
    const m = await getMint(conn, mint).catch((e) => { console.log('  mint MISSING:', e.message); return null; });
    if (!m) continue;
    console.log(`  mint ${mint.toBase58()}  decimals=${m.decimals}  authIsOperator=${m.mintAuthority?.equals(wallet.publicKey)}`);
    const { pool, collateralVault, borrowVault, position } = pdas(mint, wallet.publicKey);
    const p = await readPool(conn, pool);
    console.log('  pool:', pool.toBase58(), p ? `owned=${p.ownedByProgram} ltv=${p.ltvBps}bps interest=${p.interestBps}bps totalCol=${p.totalCollateral} totalBorrow=${p.totalBorrowed}` : '(NOT INITIALIZED)');
    console.log('  collateral_vault bal:', (await bal(conn, collateralVault))?.toString() ?? '(missing)');
    console.log('  borrow_vault USDC bal:', (await bal(conn, borrowVault))?.toString() ?? '(missing)');
    const cAta = await getOrCreateAssociatedTokenAccount(conn, wallet, mint, wallet.publicKey);
    console.log('  operator collateral ATA bal:', cAta.amount.toString());
    const pos = await readPosition(conn, position);
    console.log('  operator position:', pos ? `collateral=${pos.collateral} borrowed=${pos.borrowed}` : '(none)');
  }

  // ---- Phase 2: live deposit -> borrow -> repay -> withdraw on ANTHROPIC ----
  const name = 'ANTHROPIC';
  const mint = TOKENS[name];
  const dec = (await getMint(conn, mint)).decimals;
  const { pool, collateralVault, borrowVault, position } = pdas(mint, wallet.publicKey);
  console.log(`\n\n========== LIVE FLOW: ${name} ==========`);
  const poolState = await readPool(conn, pool);
  if (!poolState) { console.log('pool not initialized — abort flow'); return; }

  const cAta = await getOrCreateAssociatedTokenAccount(conn, wallet, mint, wallet.publicKey);
  let cBal = cAta.amount;
  const DEPOSIT = 1n * 10n ** BigInt(dec); // 1 token
  if (cBal < DEPOSIT) {
    console.log(`  operator has ${cBal} collateral base units (<${DEPOSIT}); minting 100 ${name} to self`);
    await mintTo(conn, wallet, mint, cAta.address, wallet, 100n * 10n ** BigInt(dec));
  }

  // 1. DEPOSIT
  console.log(`\n[1] deposit_collateral(${DEPOSIT})  (${DEPOSIT} base units = 1 ${name})`);
  await send(conn, wallet, new TransactionInstruction({
    programId: PROGRAM_ID,
    data: Buffer.concat([disc('deposit_collateral'), u64(DEPOSIT)]),
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: collateralVault, isSigner: false, isWritable: true },
      { pubkey: cAta.address, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
  }), 'deposit');
  let pos = await readPosition(conn, position);
  console.log('    position:', pos ? `collateral=${pos.collateral} borrowed=${pos.borrowed}` : '(none)');

  // 2. BORROW — compute the exact on-chain max and borrow half of it
  const collateralRaw = pos?.collateral ?? 0n;
  const maxBorrowRaw = (collateralRaw * 1000n * BigInt(poolState.ltvBps)) / 10000n;
  const vaultBal = (await bal(conn, borrowVault)) ?? 0n;
  let borrowRaw = maxBorrowRaw / 2n;
  if (borrowRaw < 1n) borrowRaw = 1n;
  if (borrowRaw > vaultBal) borrowRaw = vaultBal;
  console.log(`\n[2] borrow(${borrowRaw})  (on-chain max_borrow=${maxBorrowRaw} raw, vault=${vaultBal} raw, ltv=${poolState.ltvBps}bps)`);
  const usdcAta2 = await getOrCreateAssociatedTokenAccount(conn, wallet, USDC_MINT, wallet.publicKey);
  const okBorrow = await send(conn, wallet, new TransactionInstruction({
    programId: PROGRAM_ID,
    data: Buffer.concat([disc('borrow'), u64(borrowRaw)]),
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: borrowVault, isSigner: false, isWritable: true },
      { pubkey: usdcAta2.address, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
  }), 'borrow');
  pos = await readPosition(conn, position);
  console.log('    position:', pos ? `collateral=${pos.collateral} borrowed=${pos.borrowed}` : '(none)');
  console.log('    operator USDC bal:', (await bal(conn, usdcAta2.address))?.toString());

  // 3. REPAY (full)
  const repayRaw = pos?.borrowed ?? 0n;
  console.log(`\n[3] repay(${repayRaw})`);
  if (okBorrow && repayRaw > 0n) {
    await send(conn, wallet, new TransactionInstruction({
      programId: PROGRAM_ID,
      data: Buffer.concat([disc('repay'), u64(repayRaw)]),
      keys: [
        { pubkey: pool, isSigner: false, isWritable: true },
        { pubkey: position, isSigner: false, isWritable: true },
        { pubkey: borrowVault, isSigner: false, isWritable: true },
        { pubkey: usdcAta2.address, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
    }), 'repay');
  } else {
    console.log('  (skipped — borrow did not land)');
  }
  pos = await readPosition(conn, position);
  console.log('    position:', pos ? `collateral=${pos.collateral} borrowed=${pos.borrowed}` : '(none)');

  // 4. WITHDRAW (requires borrowed == 0)
  const withdrawRaw = pos?.collateral ?? 0n;
  console.log(`\n[4] withdraw_collateral(${withdrawRaw})  (position.borrowed=${pos?.borrowed})`);
  if ((pos?.borrowed ?? 1n) === 0n && withdrawRaw > 0n) {
    await send(conn, wallet, new TransactionInstruction({
      programId: PROGRAM_ID,
      data: Buffer.concat([disc('withdraw_collateral'), u64(withdrawRaw)]),
      keys: [
        { pubkey: pool, isSigner: false, isWritable: true },
        { pubkey: position, isSigner: false, isWritable: true },
        { pubkey: collateralVault, isSigner: false, isWritable: true },
        { pubkey: cAta.address, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
    }), 'withdraw');
  } else {
    console.log('  (skipped — outstanding debt or no collateral)');
  }
  pos = await readPosition(conn, position);
  console.log('    final position:', pos ? `collateral=${pos.collateral} borrowed=${pos.borrowed}` : '(none)');
  console.log('\n========== FLOW DONE ==========');
}

main().catch((e) => { console.error('\nAUDIT ERROR:', e.message); if (e.logs) console.error(e.logs.join('\n')); process.exit(1); });
