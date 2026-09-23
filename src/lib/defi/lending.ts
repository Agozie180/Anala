/**
 * Anala Lending — browser client.
 *
 * Deliberately does NOT use Anchor's `Program`/IDL. The generated IDL in this
 * repo (`types.ts` / `idl.ts`) carries incorrect instruction discriminators,
 * so driving the program through it fails every transaction. Instead we build
 * raw instructions with the verified Anchor discriminators (sha256("global:<ix>")
 * truncated to 8 bytes) and the exact account ordering from
 * `programs/anala-lending/src/lib.rs`. This is the same instruction shape that
 * `scripts/full-flow.ts` used to verify deposit -> borrow -> repay on-chain.
 *
 * All addresses come from NEXT_PUBLIC_* env so the same code runs against the
 * local validator in dev and against devnet on Vercel.
 */
import { Buffer } from 'buffer';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type TransactionSignature,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';

// --- Verified instruction discriminators (sha256("global:<name>")[..8]) ---
const DISCRIMINATOR: Record<string, number[]> = {
  deposit_collateral: [156, 131, 142, 116, 146, 247, 162, 120],
  borrow: [228, 253, 131, 202, 207, 116, 89, 18],
  repay: [234, 103, 67, 82, 208, 234, 219, 166],
  withdraw_collateral: [115, 135, 168, 106, 139, 214, 138, 150],
};

// --- Account-data byte offsets (8-byte anchor discriminator + fields) ---
const POOL_TOTAL_COLLATERAL = 8 + 32 * 5; // 168
const POOL_TOTAL_BORROWED = POOL_TOTAL_COLLATERAL + 8; // 176
const POOL_LTV_RATIO = POOL_TOTAL_BORROWED + 8; // 184
const POOL_INTEREST_RATE = POOL_LTV_RATIO + 2; // 186
const POS_COLLATERAL = 8 + 32 * 2; // 72
const POS_BORROWED = POS_COLLATERAL + 8; // 80

export type TokenSymbol = 'ANTHROPIC' | 'OPENAI' | 'SPACEX';

function readConfig() {
  const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet').toLowerCase();
  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    (network === 'localnet' ? 'http://127.0.0.1:8899' : 'https://api.devnet.solana.com');
  return {
    network,
    rpcUrl,
    programId: process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID || '',
    usdcMint: process.env.NEXT_PUBLIC_USDC_MINT || '',
    mints: {
      ANTHROPIC: process.env.NEXT_PUBLIC_ANTHROPIC_MINT || '',
      OPENAI: process.env.NEXT_PUBLIC_OPENAI_MINT || '',
      SPACEX: process.env.NEXT_PUBLIC_SPACEX_MINT || '',
    } as Record<TokenSymbol, string>,
  };
}

export const LENDING_CONFIG = readConfig();

export function networkLabel(): string {
  const n = LENDING_CONFIG.network;
  if (n === 'localnet' || n === 'localhost') return 'Solana localnet';
  if (n === 'mainnet' || n === 'mainnet-beta') return 'Solana mainnet';
  return 'Solana devnet';
}

/** True only when the on-chain addresses needed to transact are configured. */
export function isConfigured(symbol: TokenSymbol): boolean {
  const c = LENDING_CONFIG;
  return Boolean(c.programId && c.usdcMint && c.mints[symbol]);
}

export function explorerTx(sig: string): string {
  const n = LENDING_CONFIG.network;
  if (n === 'localnet' || n === 'localhost') {
    return `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=${encodeURIComponent(LENDING_CONFIG.rpcUrl)}`;
  }
  const cluster = n === 'mainnet' || n === 'mainnet-beta' ? '' : '?cluster=devnet';
  return `https://explorer.solana.com/tx/${sig}${cluster}`;
}

function programId(): PublicKey {
  if (!LENDING_CONFIG.programId) throw new Error('Lending program id is not configured (NEXT_PUBLIC_LENDING_PROGRAM_ID).');
  return new PublicKey(LENDING_CONFIG.programId);
}

function collateralMintFor(symbol: TokenSymbol): PublicKey {
  const m = LENDING_CONFIG.mints[symbol];
  if (!m) throw new Error(`Token mint for ${symbol} is not configured on ${networkLabel()}.`);
  return new PublicKey(m);
}

function usdcMint(): PublicKey {
  if (!LENDING_CONFIG.usdcMint) throw new Error('USDC mint is not configured (NEXT_PUBLIC_USDC_MINT).');
  return new PublicKey(LENDING_CONFIG.usdcMint);
}

// --- PDA derivation (seeds match lib.rs exactly) ---
function pda(seeds: (Uint8Array | Buffer)[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId())[0];
}
const seed = (s: string) => new TextEncoder().encode(s);

export function derivePdas(symbol: TokenSymbol) {
  const collateralMint = collateralMintFor(symbol);
  const pool = pda([seed('lending_pool'), collateralMint.toBytes()]);
  const collateralVault = pda([seed('collateral_vault'), pool.toBytes()]);
  const borrowVault = pda([seed('borrow_vault'), pool.toBytes()]);
  return { collateralMint, pool, collateralVault, borrowVault };
}

function positionPda(pool: PublicKey, user: PublicKey): PublicKey {
  return pda([seed('user_position'), pool.toBytes(), user.toBytes()]);
}

// --- decimals cache ---
const decimalsCache = new Map<string, number>();
async function mintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
  const key = mint.toBase58();
  const cached = decimalsCache.get(key);
  if (cached !== undefined) return cached;
  const info = await getMint(connection, mint);
  decimalsCache.set(key, info.decimals);
  return info.decimals;
}

// --- amount conversion (string math, no float rounding drift) ---
function toBaseUnits(amountUi: number | string, decimals: number): bigint {
  const s = typeof amountUi === 'number' ? amountUi.toString() : amountUi.trim();
  if (!s || Number(s) <= 0) throw new Error('Amount must be greater than zero.');
  const [whole, frac = ''] = s.split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(fracPadded || '0');
}
function fromBaseUnits(base: bigint, decimals: number): number {
  return Number(base) / 10 ** decimals;
}

function u64le(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}
function ixData(name: keyof typeof DISCRIMINATOR, amount: bigint): Buffer {
  return Buffer.concat([Buffer.from(DISCRIMINATOR[name]), u64le(amount)]);
}

const meta = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean) => ({ pubkey, isSigner, isWritable });

// --- read helpers ---
export interface MarketState {
  poolExists: boolean;
  ltvRatioBps: number;
  interestRateBps: number;
  totalCollateral: number;
  totalBorrowed: number;
  collateralDecimals: number;
  usdcDecimals: number;
}

export async function fetchMarket(connection: Connection, symbol: TokenSymbol): Promise<MarketState | null> {
  if (!isConfigured(symbol)) return null;
  const { pool, collateralMint } = derivePdas(symbol);
  const info = await connection.getAccountInfo(pool);
  const [collateralDecimals, usdcDecimals] = await Promise.all([
    mintDecimals(connection, collateralMint).catch(() => 9),
    mintDecimals(connection, usdcMint()).catch(() => 6),
  ]);
  if (!info) {
    return { poolExists: false, ltvRatioBps: 0, interestRateBps: 0, totalCollateral: 0, totalBorrowed: 0, collateralDecimals, usdcDecimals };
  }
  const dv = new DataView(info.data.buffer, info.data.byteOffset, info.data.byteLength);
  return {
    poolExists: true,
    ltvRatioBps: dv.getUint16(POOL_LTV_RATIO, true),
    interestRateBps: dv.getUint16(POOL_INTEREST_RATE, true),
    totalCollateral: fromBaseUnits(dv.getBigUint64(POOL_TOTAL_COLLATERAL, true), collateralDecimals),
    totalBorrowed: fromBaseUnits(dv.getBigUint64(POOL_TOTAL_BORROWED, true), usdcDecimals),
    collateralDecimals,
    usdcDecimals,
  };
}

export interface PositionState {
  exists: boolean;
  collateral: number;
  borrowed: number;
}

export async function fetchPosition(connection: Connection, symbol: TokenSymbol, owner: PublicKey): Promise<PositionState> {
  if (!isConfigured(symbol)) return { exists: false, collateral: 0, borrowed: 0 };
  const { pool, collateralMint } = derivePdas(symbol);
  const position = positionPda(pool, owner);
  const info = await connection.getAccountInfo(position);
  if (!info) return { exists: false, collateral: 0, borrowed: 0 };
  const [collateralDecimals, usdcDecimals] = await Promise.all([
    mintDecimals(connection, collateralMint).catch(() => 9),
    mintDecimals(connection, usdcMint()).catch(() => 6),
  ]);
  const dv = new DataView(info.data.buffer, info.data.byteOffset, info.data.byteLength);
  return {
    exists: true,
    collateral: fromBaseUnits(dv.getBigUint64(POS_COLLATERAL, true), collateralDecimals),
    borrowed: fromBaseUnits(dv.getBigUint64(POS_BORROWED, true), usdcDecimals),
  };
}

// --- transaction context supplied by the wallet adapter ---
export interface WalletCtx {
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<TransactionSignature>;
}

async function sendIxs(ctx: WalletCtx, instructions: TransactionInstruction[]): Promise<string> {
  const { connection, publicKey, sendTransaction } = ctx;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight });
  tx.add(...instructions);
  const signature = await sendTransaction(tx, connection);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  return signature;
}

/** Prepend an ATA-creation instruction when `owner` has no token account for `mint`. */
async function ensureAtaIx(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): Promise<{ ata: PublicKey; ix: TransactionInstruction | null }> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  const info = await connection.getAccountInfo(ata);
  return { ata, ix: info ? null : createAssociatedTokenAccountInstruction(payer, ata, owner, mint) };
}

// --- instructions (account order mirrors lib.rs contexts exactly) ---

export async function deposit(ctx: WalletCtx, symbol: TokenSymbol, amountUi: number | string): Promise<string> {
  const { pool, collateralVault, collateralMint } = derivePdas(symbol);
  const position = positionPda(pool, ctx.publicKey);
  const userTokenAccount = await getAssociatedTokenAddress(collateralMint, ctx.publicKey);
  const amount = toBaseUnits(amountUi, await mintDecimals(ctx.connection, collateralMint));

  const ix = new TransactionInstruction({
    programId: programId(),
    data: ixData('deposit_collateral', amount),
    keys: [
      meta(pool, false, true),
      meta(position, false, true),
      meta(collateralVault, false, true),
      meta(userTokenAccount, false, true),
      meta(ctx.publicKey, true, true),
      meta(SystemProgram.programId, false, false),
      meta(TOKEN_PROGRAM_ID, false, false),
    ],
  });
  return sendIxs(ctx, [ix]);
}

export async function borrow(ctx: WalletCtx, symbol: TokenSymbol, amountUi: number | string): Promise<string> {
  const { pool, borrowVault } = derivePdas(symbol);
  const position = positionPda(pool, ctx.publicKey);
  const mint = usdcMint();
  const { ata: userBorrowAccount, ix: ataIx } = await ensureAtaIx(ctx.connection, ctx.publicKey, ctx.publicKey, mint);
  const amount = toBaseUnits(amountUi, await mintDecimals(ctx.connection, mint));

  const ix = new TransactionInstruction({
    programId: programId(),
    data: ixData('borrow', amount),
    keys: [
      meta(pool, false, true),
      meta(position, false, true),
      meta(borrowVault, false, true),
      meta(userBorrowAccount, false, true),
      meta(ctx.publicKey, true, false),
      meta(TOKEN_PROGRAM_ID, false, false),
    ],
  });
  return sendIxs(ctx, ataIx ? [ataIx, ix] : [ix]);
}

export async function repay(ctx: WalletCtx, symbol: TokenSymbol, amountUi: number | string): Promise<string> {
  const { pool, borrowVault } = derivePdas(symbol);
  const position = positionPda(pool, ctx.publicKey);
  const mint = usdcMint();
  const userBorrowAccount = await getAssociatedTokenAddress(mint, ctx.publicKey);
  const amount = toBaseUnits(amountUi, await mintDecimals(ctx.connection, mint));

  const ix = new TransactionInstruction({
    programId: programId(),
    data: ixData('repay', amount),
    keys: [
      meta(pool, false, true),
      meta(position, false, true),
      meta(borrowVault, false, true),
      meta(userBorrowAccount, false, true),
      meta(ctx.publicKey, true, true),
      meta(TOKEN_PROGRAM_ID, false, false),
    ],
  });
  return sendIxs(ctx, [ix]);
}

export async function withdraw(ctx: WalletCtx, symbol: TokenSymbol, amountUi: number | string): Promise<string> {
  const { pool, collateralVault, collateralMint } = derivePdas(symbol);
  const position = positionPda(pool, ctx.publicKey);
  const userTokenAccount = await getAssociatedTokenAddress(collateralMint, ctx.publicKey);
  const amount = toBaseUnits(amountUi, await mintDecimals(ctx.connection, collateralMint));

  const ix = new TransactionInstruction({
    programId: programId(),
    data: ixData('withdraw_collateral', amount),
    keys: [
      meta(pool, false, true),
      meta(position, false, true),
      meta(collateralVault, false, true),
      meta(userTokenAccount, false, true),
      meta(ctx.publicKey, true, false),
      meta(TOKEN_PROGRAM_ID, false, false),
    ],
  });
  return sendIxs(ctx, [ix]);
}

/** Map a raw send error to a human-readable message using the program's error codes. */
export function explainError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const table: Record<string, string> = {
    '6000': 'Amount must be greater than zero.',
    '6001': 'No collateral deposited yet.',
    '6002': 'Borrow amount exceeds the LTV limit for this position.',
    '6003': 'Nothing to repay.',
    '6004': 'Repay the outstanding debt before withdrawing collateral.',
    '6005': 'Insufficient collateral for that withdrawal.',
    '6006': 'LTV ratio must be between 30% and 75%.',
    '6007': 'Arithmetic overflow.',
    '6008': 'Arithmetic underflow.',
  };
  const m = msg.match(/custom program error: 0x([0-9a-fA-F]+)/);
  if (m) {
    const code = String(parseInt(m[1], 16));
    if (table[code]) return table[code];
  }
  for (const [code, text] of Object.entries(table)) {
    if (msg.includes(code)) return text;
  }
  if (/insufficient funds|0x1\b/.test(msg)) return 'Insufficient funds for this transaction (token balance or SOL for fees).';
  if (/User rejected|rejected the request/i.test(msg)) return 'Transaction was rejected in the wallet.';
  return msg;
}
