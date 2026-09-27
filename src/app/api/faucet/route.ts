import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo, getMint } from "@solana/spl-token";

/**
 * POST /api/faucet  { symbol: "ANTHROPIC" | "OPENAI" | "SPACEX", owner: "<base58>" }
 *
 * Mints a fixed amount of a SIMULATED devnet PreStocks token to `owner` so any
 * judge can demo deposit -> borrow -> repay -> withdraw without the operator
 * keypair. These tokens exist only on devnet and carry no value.
 *
 * The operator wallet is the mint authority (see scripts/setup-devnet.ts), so
 * the faucet signs with FAUCET_SECRET_KEY (the operator key, a JSON byte array —
 * the same format as a Solana CLI id.json). It is read only from the server env
 * and never returned to the client. Devnet only: never configure this on mainnet.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const FAUCET_AMOUNT = 100; // whole collateral tokens per request
// A small USDC buffer is minted alongside the collateral. Interest accrues on a
// loan between borrow and repay, so the borrowed principal alone is never quite
// enough to clear the debt to zero — and withdraw_collateral requires a zero
// balance. This buffer lets a user fully repay (principal + interest) and then
// withdraw. Simulated devnet USDC with no value; devnet only.
const USDC_BUFFER = 100; // whole USDC per request

const MINTS: Record<string, string | undefined> = {
  ANTHROPIC: process.env.NEXT_PUBLIC_ANTHROPIC_MINT,
  OPENAI: process.env.NEXT_PUBLIC_OPENAI_MINT,
  SPACEX: process.env.NEXT_PUBLIC_SPACEX_MINT,
};
const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT;

function loadFaucet(): Keypair | null {
  const raw = process.env.FAUCET_SECRET_KEY;
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as number[];
    if (!Array.isArray(arr)) return null;
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  } catch {
    return null;
  }
}

// Best-effort per-owner throttle. In-memory only, so it resets on cold start —
// good enough to blunt accidental spamming during a demo; not a security control.
const lastHit = new Map<string, number>();
const THROTTLE_MS = 20_000;

export async function POST(req: NextRequest) {
  let body: { symbol?: string; owner?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const symbol = (body.symbol || "").toUpperCase();
  const mintStr = MINTS[symbol];
  if (!mintStr) {
    return NextResponse.json({ ok: false, error: `Unknown or unconfigured symbol: ${body.symbol ?? "(none)"}` }, { status: 400 });
  }

  let owner: PublicKey;
  try {
    owner = new PublicKey(body.owner || "");
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid owner address" }, { status: 400 });
  }

  const faucet = loadFaucet();
  if (!faucet) {
    return NextResponse.json(
      { ok: false, error: "Faucet is not configured on this deployment (FAUCET_SECRET_KEY missing)." },
      { status: 503 },
    );
  }

  const key = owner.toBase58();
  const now = Date.now();
  const prev = lastHit.get(key) ?? 0;
  if (now - prev < THROTTLE_MS) {
    const wait = Math.ceil((THROTTLE_MS - (now - prev)) / 1000);
    return NextResponse.json({ ok: false, error: `Please wait ${wait}s before requesting more test tokens.` }, { status: 429 });
  }
  lastHit.set(key, now);

  try {
    const connection = new Connection(RPC, "confirmed");
    const mint = new PublicKey(mintStr);
    const { decimals } = await getMint(connection, mint);
    const amount = BigInt(FAUCET_AMOUNT) * 10n ** BigInt(decimals);

    // Faucet pays to create the recipient's ATA if they don't have one yet.
    const ata = await getOrCreateAssociatedTokenAccount(connection, faucet, mint, owner);
    const signature = await mintTo(connection, faucet, mint, ata.address, faucet, amount);

    // Also top up test USDC. The operator is the USDC mint authority too (see
    // scripts/setup-devnet.ts). Without this, a user's only USDC is the amount
    // they borrow — which can never cover the interest that accrues before they
    // repay, so their debt never reaches zero and withdraw_collateral (which
    // requires borrowed_amount == 0) stays blocked forever. This is best-effort:
    // the collateral has already been minted, so a USDC hiccup is non-fatal.
    let usdcAmount = 0;
    if (USDC_MINT) {
      try {
        const usdcMint = new PublicKey(USDC_MINT);
        const { decimals: usdcDecimals } = await getMint(connection, usdcMint);
        const usdcAta = await getOrCreateAssociatedTokenAccount(connection, faucet, usdcMint, owner);
        await mintTo(connection, faucet, usdcMint, usdcAta.address, faucet, BigInt(USDC_BUFFER) * 10n ** BigInt(usdcDecimals));
        usdcAmount = USDC_BUFFER;
      } catch {
        // Leave usdcAmount at 0; the client message adapts and the user can retry.
      }
    }

    return NextResponse.json({
      ok: true,
      signature,
      symbol,
      amount: FAUCET_AMOUNT,
      usdcAmount,
      account: ata.address.toBase58(),
    });
  } catch (error) {
    // On failure, release the throttle so a genuine retry isn't blocked.
    lastHit.delete(key);
    const message = error instanceof Error ? error.message : "Faucet mint failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
