/**
 * Keeper — push the live PreStocks mark price (and a refreshed AI LTV) on-chain
 * for every pool, so borrow capacity tracks the real token price.
 *
 * These synthetic pre-IPO tokens have no Pyth/Switchboard feed; the operator
 * wallet (the pool authority) signs `update_price` and `update_ltv`.
 *
 * Usage:
 *   SOLANA_WALLET=~/.config/solana/id.json npm run push:prices
 *
 * Reads mint addresses from scripts/.devnet-mints.json (written by setup:devnet),
 * falling back to NEXT_PUBLIC_*_MINT env vars.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { liveTokenPriceUsd, priceToBaseUnits } from './prices';
import { resolvePreStockInstrument } from '../src/lib/prestocks/instruments';
import { calculateLTV } from '../src/lib/defi/ltv';

const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(
  process.env.LENDING_PROGRAM_ID || '7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG',
);
const USDC_DECIMALS = 6;
const MINTS_CACHE = path.join(__dirname, '.devnet-mints.json');
const POOLS = ['ANTHROPIC', 'OPENAI', 'SPACEX'] as const;

function disc(name: string): Buffer {
  return crypto.createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
}
function u16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}
function u64(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

function loadWallet(): Keypair {
  const p = process.env.SOLANA_WALLET || path.join(os.homedir(), '.config', 'solana', 'id.json');
  if (!fs.existsSync(p)) throw new Error(`Wallet keypair not found at ${p}. Set SOLANA_WALLET.`);
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(p, 'utf-8'))));
}

function loadMints(): Record<string, string> {
  if (fs.existsSync(MINTS_CACHE)) return JSON.parse(fs.readFileSync(MINTS_CACHE, 'utf-8'));
  return {
    ANTHROPIC: process.env.NEXT_PUBLIC_ANTHROPIC_MINT || '',
    OPENAI: process.env.NEXT_PUBLIC_OPENAI_MINT || '',
    SPACEX: process.env.NEXT_PUBLIC_SPACEX_MINT || '',
  };
}

function poolPda(collateralMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('lending_pool'), collateralMint.toBuffer()],
    PROGRAM_ID,
  )[0];
}

async function send(connection: Connection, wallet: Keypair, ix: TransactionInstruction): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: wallet.publicKey, blockhash, lastValidBlockHeight }).add(ix);
  const sig = await connection.sendTransaction(tx, [wallet], { preflightCommitment: 'confirmed' });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  return sig;
}

/** Best-effort refreshed LTV (bps), clamped to the on-chain [3000, 7500] bounds. */
async function ltvBpsFor(symbol: string): Promise<number | null> {
  const withTimeout = <T>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error(`timeout after ${ms}ms`)), ms))]);
  try {
    const resolved = await withTimeout(resolvePreStockInstrument(symbol), 8_000);
    if (!resolved.resolved || !resolved.instrument) return null;
    const ltv = await withTimeout(calculateLTV(resolved.instrument), 12_000);
    const bps = Math.round(ltv.adjustedLtv * 10000);
    return Math.min(7500, Math.max(3000, bps));
  } catch (e) {
    console.warn(`  ! LTV refresh for ${symbol} failed (${(e as Error).message}); leaving LTV unchanged`);
    return null;
  }
}

function priceIx(pool: PublicKey, authority: PublicKey, priceBase: bigint): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([disc('update_price'), u64(priceBase)]),
  });
}
function ltvIx(pool: PublicKey, authority: PublicKey, bps: number): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([disc('update_ltv'), u16(bps)]),
  });
}

async function main() {
  console.log('=============================================');
  console.log(' Anala Lending — keeper price push');
  console.log('=============================================');
  console.log('RPC    :', RPC);
  console.log('Program:', PROGRAM_ID.toBase58());

  const connection = new Connection(RPC, 'confirmed');
  const wallet = loadWallet();
  const mints = loadMints();
  console.log('Keeper wallet (must be pool authority):', wallet.publicKey.toBase58());

  for (const name of POOLS) {
    const mintStr = mints[name];
    if (!mintStr) {
      console.warn(`[${name}] no mint configured, skipping`);
      continue;
    }
    const collateralMint = new PublicKey(mintStr);
    const pool = poolPda(collateralMint);
    const info = await connection.getAccountInfo(pool);
    if (!info) {
      console.warn(`[${name}] pool ${pool.toBase58()} not initialized, skipping`);
      continue;
    }

    // 1) Push live price (the safety-critical value). Never write a fabricated
    //    fallback: if the live mark is unavailable, leave the last-known-good
    //    on-chain price untouched rather than overwrite it with a made-up number.
    const priceUsd = await liveTokenPriceUsd(name);
    if (priceUsd == null) {
      console.warn(`[${name}] live price unavailable; leaving on-chain price unchanged (no fabricated mark written)`);
    } else {
      const priceBase = priceToBaseUnits(priceUsd, USDC_DECIMALS);
      const psig = await send(connection, wallet, priceIx(pool, wallet.publicKey, priceBase));
      console.log(`[${name}] price -> $${priceUsd.toFixed(2)} (${priceBase} base) tx ${psig}`);
    }

    // 2) Refresh AI LTV on-chain (best-effort; skipped if research is unavailable).
    const bps = await ltvBpsFor(name);
    if (bps != null) {
      const lsig = await send(connection, wallet, ltvIx(pool, wallet.publicKey, bps));
      console.log(`[${name}] LTV   -> ${(bps / 100).toFixed(2)}% tx ${lsig}`);
    }
  }

  console.log('\n✓ price push complete');
}

main().catch((e) => {
  console.error('\n✗ push-prices failed:', e.message);
  if (e.logs) console.error('Logs:\n  ' + e.logs.join('\n  '));
  process.exit(1);
});
