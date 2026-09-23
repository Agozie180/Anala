/**
 * One-shot devnet setup for Anala Lending.
 *
 * Assumes the program is already deployed to devnet at its fixed program id
 * (the program id is the program keypair's pubkey, so it is identical on
 * localnet and devnet). Run `npm run deploy:contract` first if it isn't.
 *
 * This script is idempotent:
 *   - mints are created once and cached in scripts/.devnet-mints.json (reused on re-run)
 *   - pools are initialized only if they don't already exist
 *   - borrow vaults are topped up to the target liquidity
 *   - demo collateral is minted to the operator wallet so it can deposit
 *
 * It then prints the NEXT_PUBLIC_* env block to paste into Vercel and .env.local.
 *
 * Usage:
 *   npm run setup:devnet
 *   SOLANA_RPC_URL=https://your-rpc npm run setup:devnet
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const NETWORK = process.env.SOLANA_NETWORK || 'devnet';
// Fixed program id (== program keypair pubkey; same on every cluster).
const PROGRAM_ID = new PublicKey(process.env.LENDING_PROGRAM_ID || '7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG');

const USDC_DECIMALS = 6;
const PRESTOCK_DECIMALS = 9;
const LIQUIDITY_USDC = 1_000_000; // USDC seeded into each borrow vault
const DEMO_COLLATERAL = 1_000; // PreStocks tokens minted to the operator wallet per market

const MINTS_CACHE = path.join(__dirname, '.devnet-mints.json');

const POOLS = [
  { name: 'ANTHROPIC' as const, ltvBps: 5170, interestBps: 500 },
  { name: 'OPENAI' as const, ltvBps: 4750, interestBps: 500 },
  { name: 'SPACEX' as const, ltvBps: 4580, interestBps: 500 },
];
type PoolName = (typeof POOLS)[number]['name'];

function disc(name: string): Buffer {
  return crypto.createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
}
function u16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}
function base(amount: number, decimals: number): bigint {
  return BigInt(amount) * 10n ** BigInt(decimals);
}
function loadWallet(): Keypair {
  const p = process.env.SOLANA_WALLET || path.join(os.homedir(), '.config', 'solana', 'id.json');
  if (!fs.existsSync(p)) throw new Error(`Wallet keypair not found at ${p}. Set SOLANA_WALLET or run: solana-keygen new`);
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(p, 'utf-8'))));
}

interface MintCache {
  USDC: string;
  ANTHROPIC: string;
  OPENAI: string;
  SPACEX: string;
}

async function ensureMints(connection: Connection, wallet: Keypair): Promise<MintCache> {
  if (fs.existsSync(MINTS_CACHE)) {
    const cached: MintCache = JSON.parse(fs.readFileSync(MINTS_CACHE, 'utf-8'));
    console.log('Reusing cached mints from', MINTS_CACHE);
    return cached;
  }
  console.log('Creating fresh mints on', NETWORK, '...');
  const usdc = await createMint(connection, wallet, wallet.publicKey, null, USDC_DECIMALS);
  console.log('  USDC     ', usdc.toBase58(), `(${USDC_DECIMALS} decimals)`);
  const mints: Partial<MintCache> = { USDC: usdc.toBase58() };
  for (const { name } of POOLS) {
    const m = await createMint(connection, wallet, wallet.publicKey, null, PRESTOCK_DECIMALS);
    mints[name] = m.toBase58();
    console.log(`  ${name.padEnd(9)}`, m.toBase58(), `(${PRESTOCK_DECIMALS} decimals)`);
  }
  const full = mints as MintCache;
  fs.writeFileSync(MINTS_CACHE, JSON.stringify(full, null, 2));
  console.log('Cached mints ->', MINTS_CACHE);
  return full;
}

function derivePdas(collateralMint: PublicKey) {
  const [pool] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool'), collateralMint.toBuffer()], PROGRAM_ID);
  const [collateralVault] = PublicKey.findProgramAddressSync([Buffer.from('collateral_vault'), pool.toBuffer()], PROGRAM_ID);
  const [borrowVault] = PublicKey.findProgramAddressSync([Buffer.from('borrow_vault'), pool.toBuffer()], PROGRAM_ID);
  return { pool, collateralVault, borrowVault };
}

async function initPoolIfNeeded(
  connection: Connection,
  wallet: Keypair,
  usdcMint: PublicKey,
  collateralMint: PublicKey,
  ltvBps: number,
  interestBps: number,
): Promise<{ pool: PublicKey; borrowVault: PublicKey; created: boolean }> {
  const { pool, collateralVault, borrowVault } = derivePdas(collateralMint);
  if (await connection.getAccountInfo(pool)) {
    console.log('  pool already initialized:', pool.toBase58());
    return { pool, borrowVault, created: false };
  }
  const data = Buffer.concat([disc('initialize_pool'), u16(ltvBps), u16(interestBps)]);
  const keys = [
    { pubkey: pool, isSigner: false, isWritable: true },
    { pubkey: collateralMint, isSigner: false, isWritable: false },
    { pubkey: usdcMint, isSigner: false, isWritable: false },
    { pubkey: collateralVault, isSigner: false, isWritable: true },
    { pubkey: borrowVault, isSigner: false, isWritable: true },
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: wallet.publicKey, blockhash, lastValidBlockHeight }).add(ix);
  const sig = await connection.sendTransaction(tx, [wallet], { preflightCommitment: 'confirmed' });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  console.log('  ✓ pool initialized:', pool.toBase58(), 'tx', sig);
  return { pool, borrowVault, created: true };
}

async function main() {
  console.log('=============================================');
  console.log(' Anala Lending — devnet setup');
  console.log('=============================================');
  console.log('RPC    :', RPC);
  console.log('Program:', PROGRAM_ID.toBase58());

  const connection = new Connection(RPC, 'confirmed');
  const wallet = loadWallet();
  console.log('Operator wallet:', wallet.publicKey.toBase58());

  // Confirm the program is actually deployed before we spend time creating mints.
  const programInfo = await connection.getAccountInfo(PROGRAM_ID);
  if (!programInfo || !programInfo.executable) {
    throw new Error(
      `Program ${PROGRAM_ID.toBase58()} is not deployed/executable on ${NETWORK}.\n` +
        `Deploy it first:  npm run deploy:contract`,
    );
  }
  console.log('Program is deployed ✓');

  // Ensure the operator has some SOL for rent + fees.
  const bal = await connection.getBalance(wallet.publicKey);
  console.log('Operator SOL:', (bal / LAMPORTS_PER_SOL).toFixed(3));
  if (bal < 0.5 * LAMPORTS_PER_SOL) {
    console.log('Balance low, requesting a devnet airdrop (may be rate-limited)...');
    try {
      const sig = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, 'confirmed');
      console.log('  ✓ airdropped 2 SOL');
    } catch (e) {
      console.warn('  ! airdrop failed:', (e as Error).message);
      console.warn('  Fund the wallet manually: solana airdrop 2', wallet.publicKey.toBase58(), '--url', RPC);
    }
  }

  const mints = await ensureMints(connection, wallet);
  const usdcMint = new PublicKey(mints.USDC);

  console.log('\nInitializing pools + seeding liquidity...');
  const liquidity = base(LIQUIDITY_USDC, USDC_DECIMALS);
  for (const { name, ltvBps, interestBps } of POOLS) {
    console.log(`\n[${name}] LTV ${ltvBps / 100}%  interest ${interestBps / 100}%`);
    const collateralMint = new PublicKey(mints[name]);
    const { borrowVault } = await initPoolIfNeeded(connection, wallet, usdcMint, collateralMint, ltvBps, interestBps);

    // Top up borrow vault to target liquidity.
    let vaultBal = 0n;
    try {
      vaultBal = (await getAccount(connection, borrowVault)).amount;
    } catch {
      /* created above; may not be indexed yet */
    }
    if (vaultBal < liquidity) {
      await mintTo(connection, wallet, usdcMint, borrowVault, wallet, liquidity - vaultBal);
      console.log(`  ✓ borrow vault funded to ${LIQUIDITY_USDC.toLocaleString()} USDC`);
    } else {
      console.log('  borrow vault already funded');
    }

    // Mint demo collateral to the operator wallet so it can deposit in the UI.
    const ata = await getOrCreateAssociatedTokenAccount(connection, wallet, collateralMint, wallet.publicKey);
    await mintTo(connection, wallet, collateralMint, ata.address, wallet, base(DEMO_COLLATERAL, PRESTOCK_DECIMALS));
    console.log(`  ✓ minted ${DEMO_COLLATERAL} ${name} to operator (${ata.address.toBase58()})`);
  }

  const envBlock = [
    `NEXT_PUBLIC_SOLANA_NETWORK=${NETWORK}`,
    `NEXT_PUBLIC_SOLANA_RPC_URL=${RPC}`,
    `NEXT_PUBLIC_LENDING_PROGRAM_ID=${PROGRAM_ID.toBase58()}`,
    `NEXT_PUBLIC_USDC_MINT=${mints.USDC}`,
    `NEXT_PUBLIC_ANTHROPIC_MINT=${mints.ANTHROPIC}`,
    `NEXT_PUBLIC_OPENAI_MINT=${mints.OPENAI}`,
    `NEXT_PUBLIC_SPACEX_MINT=${mints.SPACEX}`,
    '',
  ].join('\n');

  fs.writeFileSync(path.join(process.cwd(), '.env.devnet'), envBlock);

  console.log('\n=============================================');
  console.log(' ✅ Devnet setup complete');
  console.log('=============================================');
  console.log('\nPaste these into Vercel (Project Settings -> Environment Variables)');
  console.log('and into your local .env.local:\n');
  console.log(envBlock);
  console.log('Also written to .env.devnet');
  console.log('\nDemo tip: import the operator wallet into Phantom (devnet) — it holds the');
  console.log('PreStocks tokens minted above, so you can deposit -> borrow -> repay -> withdraw.');
}

main().catch((e) => {
  console.error('\n✗ SETUP FAILED:', e.message);
  if (e.logs) console.error('Logs:\n  ' + e.logs.join('\n  '));
  process.exit(1);
});
