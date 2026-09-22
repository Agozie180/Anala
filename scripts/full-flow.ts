/**
 * Anala Lending Protocol — full end-to-end flow against the local validator.
 * deposit collateral -> borrow USDC -> repay USDC, with on-chain state printed at each step.
 * Account orders match programs/anala-lending/src/lib.rs exactly.
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
  mintTo,
  getMint,
  getAccount,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as crypto from 'crypto';

const RPC = 'http://127.0.0.1:8899';
const PROGRAM_ID = new PublicKey('7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG');
const USDC_MINT = new PublicKey('7HDB5XDF1dvokyzbenQkgDpM68HWN3ACYUow3psprXiV');
const ANTHROPIC_MINT = new PublicKey('39fD6juh9ARCHR7TseVDk4QFm9oKWq7jcnpb5uwGLsc4');

// Load wallet (this is the mint authority AND pool authority)
const WALLET_PATH = 'C:\\Users\\USER\\.config\\solana\\id.json';

function disc(name: string): Buffer {
  return crypto.createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
}

function u64(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

async function logPosition(conn: Connection, pos: PublicKey, pool: PublicKey, label: string) {
  console.log(`\n  --- state after ${label} ---`);
  const posInfo = await conn.getAccountInfo(pos);
  if (!posInfo) {
    console.log('  user_position: (not created yet)');
  } else {
    const d = posInfo.data;
    const collateral = d.readBigUInt64LE(72); // 8 disc + 32 owner + 32 pool
    const borrowed = d.readBigUInt64LE(80);
    console.log(`  user_position: collateral=${collateral}  borrowed=${borrowed}`);
  }
  const poolInfo = await conn.getAccountInfo(pool);
  if (poolInfo) {
    const d = poolInfo.data;
    const totalCollateral = d.readBigUInt64LE(168); // 8 + 32*5
    const totalBorrowed = d.readBigUInt64LE(176);
    console.log(`  pool: total_collateral=${totalCollateral}  total_borrowed=${totalBorrowed}`);
  }
}

async function main() {
  const conn = new Connection(RPC, 'confirmed');
  const wallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'))));

  console.log('=============================================');
  console.log(' Anala Lending — full flow (deposit/borrow/repay)');
  console.log('=============================================');
  console.log('Wallet :', wallet.publicKey.toBase58());
  console.log('Program:', PROGRAM_ID.toBase58());

  const antDec = (await getMint(conn, ANTHROPIC_MINT)).decimals;
  const usdcDec = (await getMint(conn, USDC_MINT)).decimals;
  console.log(`Decimals: ANTHROPIC=${antDec}  USDC=${usdcDec}`);

  // PDAs
  const [lendingPool] = PublicKey.findProgramAddressSync(
    [Buffer.from('lending_pool'), ANTHROPIC_MINT.toBuffer()], PROGRAM_ID);
  const [collateralVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('collateral_vault'), lendingPool.toBuffer()], PROGRAM_ID);
  const [borrowVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('borrow_vault'), lendingPool.toBuffer()], PROGRAM_ID);
  const [userPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_position'), lendingPool.toBuffer(), wallet.publicKey.toBuffer()], PROGRAM_ID);

  console.log('Pool   :', lendingPool.toBase58());
  console.log('C-Vault:', collateralVault.toBase58());
  console.log('B-Vault:', borrowVault.toBase58());
  console.log('UserPos:', userPosition.toBase58());

  // Token accounts
  const userAnt = await getOrCreateAssociatedTokenAccount(conn, wallet, ANTHROPIC_MINT, wallet.publicKey);
  const userUsdc = await getOrCreateAssociatedTokenAccount(conn, wallet, USDC_MINT, wallet.publicKey);

  // Amounts (base units)
  const DEPOSIT = BigInt(10) * BigInt(10) ** BigInt(antDec);       // 10 ANTHROPIC
  const LIQUIDITY = BigInt(1_000_000) * BigInt(10) ** BigInt(usdcDec); // 1,000,000 USDC into vault
  const BORROW = BigInt(1_000) * BigInt(10) ** BigInt(usdcDec);    // borrow 1,000 USDC

  // --- Prep: mint ANTHROPIC to user, seed borrow_vault with USDC liquidity ---
  console.log('\n[prep] Minting 100 ANTHROPIC to user + seeding borrow vault with USDC...');
  await mintTo(conn, wallet, ANTHROPIC_MINT, userAnt.address, wallet, BigInt(100) * BigInt(10) ** BigInt(antDec));
  await mintTo(conn, wallet, USDC_MINT, borrowVault, wallet, LIQUIDITY);
  console.log('  user ANTHROPIC:', (await getAccount(conn, userAnt.address)).amount.toString());
  console.log('  borrow_vault USDC:', (await getAccount(conn, borrowVault)).amount.toString());

  await logPosition(conn, userPosition, lendingPool, 'prep');

  // --- 1. DEPOSIT COLLATERAL ---
  console.log(`\n[1] deposit_collateral(${DEPOSIT})`);
  {
    const data = Buffer.concat([disc('deposit_collateral'), u64(DEPOSIT)]);
    const keys = [
      { pubkey: lendingPool, isSigner: false, isWritable: true },
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
  }
  console.log('  collateral_vault balance:', (await getAccount(conn, collateralVault)).amount.toString());
  await logPosition(conn, userPosition, lendingPool, 'deposit');

  // --- 2. BORROW ---
  console.log(`\n[2] borrow(${BORROW})`);
  {
    const data = Buffer.concat([disc('borrow'), u64(BORROW)]);
    const keys = [
      { pubkey: lendingPool, isSigner: false, isWritable: true },
      { pubkey: userPosition, isSigner: false, isWritable: true },
      { pubkey: borrowVault, isSigner: false, isWritable: true },
      { pubkey: userUsdc.address, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
    const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [wallet], { commitment: 'confirmed' });
    console.log('  ✓ borrow tx:', sig);
  }
  console.log('  user USDC after borrow:', (await getAccount(conn, userUsdc.address)).amount.toString());
  await logPosition(conn, userPosition, lendingPool, 'borrow');

  // --- 3. REPAY (full) ---
  console.log(`\n[3] repay(${BORROW})`);
  {
    const data = Buffer.concat([disc('repay'), u64(BORROW)]);
    const keys = [
      { pubkey: lendingPool, isSigner: false, isWritable: true },
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
  console.log('  user USDC after repay:', (await getAccount(conn, userUsdc.address)).amount.toString());
  await logPosition(conn, userPosition, lendingPool, 'repay');

  console.log('\n=============================================');
  console.log(' ✅ FULL FLOW COMPLETE: deposit -> borrow -> repay');
  console.log('=============================================');
}

main().catch((e) => {
  console.error('\n✗ FLOW FAILED:', e.message);
  if (e.logs) console.error('Logs:\n  ' + e.logs.join('\n  '));
  process.exit(1);
});
