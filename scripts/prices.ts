/**
 * Shared price helper for the devnet scripts.
 *
 * The lending program stores a collateral price as "USDC base units (6 dp) per
 * ONE WHOLE collateral token". These synthetic pre-IPO tokens have no third-party
 * oracle, so the operator/keeper pushes the live PreStocks mark on-chain. This
 * module is the single source of that price for both setup-devnet.ts (initial
 * price at pool creation) and push-prices.ts (the keeper).
 */
import { fetchPreStocksTokens } from '../src/lib/prestocks/client';

// Conservative fallbacks so `setup:devnet` never hard-fails if the PreStocks API
// is briefly unreachable. ONLY pool bootstrapping (setup) may use these — the pool
// needs *some* starting price to be created. The keeper must NOT use a fallback:
// it uses liveTokenPriceUsd() and skips when live data is unavailable, so it never
// overwrites a real on-chain mark with a fabricated number.
const FALLBACK_USD: Record<string, number> = {
  ANTHROPIC: 1014,
  OPENAI: 1000,
  SPACEX: 1000,
};

// Cache the full token list for the lifetime of one script run, so pushing prices
// for N pools makes ONE PreStocks request instead of N — the per-pool cascade was
// tripping the API rate limit (429) partway through and causing the keeper to fall
// back mid-run. A failed fetch clears the cache so the next call can retry.
let tokenListPromise: ReturnType<typeof fetchPreStocksTokens> | null = null;
function allTokens() {
  if (!tokenListPromise) {
    tokenListPromise = fetchPreStocksTokens().catch((e) => {
      tokenListPromise = null;
      throw e;
    });
  }
  return tokenListPromise;
}

/** Live token price in USD, or null when the live mark is currently unavailable. */
export async function liveTokenPriceUsd(symbol: string): Promise<number | null> {
  try {
    const tokens = await allTokens();
    const t = tokens.find((x) => x.symbol.toUpperCase() === symbol.toUpperCase());
    if (t && t.tokenPrice > 0) return t.tokenPrice;
    return null;
  } catch (e) {
    console.warn(`  ! live price for ${symbol} unavailable (${(e as Error).message})`);
    return null;
  }
}

/**
 * Live token price in USD, with a conservative fallback. FOR BOOTSTRAPPING ONLY
 * (setup:devnet): the pool must be created with some price. The keeper must use
 * liveTokenPriceUsd() instead and skip when it returns null — never write a
 * fabricated mark on-chain.
 */
export async function tokenPriceUsd(symbol: string): Promise<number> {
  const live = await liveTokenPriceUsd(symbol);
  if (live != null) return live;
  console.warn(`  ! using fallback price for ${symbol} (bootstrap only)`);
  return FALLBACK_USD[symbol] ?? 1000;
}

/** USD price -> USDC base units (default 6 dp) per whole token, as a bigint for u64. */
export function priceToBaseUnits(usd: number, usdcDecimals = 6): bigint {
  return BigInt(Math.round(usd * 10 ** usdcDecimals));
}
