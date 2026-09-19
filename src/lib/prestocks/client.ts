/**
 * PreStocks API client for Anala.
 * Fetches tokenized pre-IPO stock data from PreStocks.
 */

export interface PreStockToken {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url: string;
  contract_address: string;
  markPrice: number;
  markValuation: number;
  tokenPrice: number;
  impliedValuation: number;
  supply: number;
}

export interface PreStocksConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

export function preStocksConfigFromEnv(): PreStocksConfig {
  return {
    baseUrl: process.env.PRESTOCKS_API_URL || "https://prestocks.com/api/prestocks",
    timeoutMs: 15_000,
  };
}

export class PreStocksError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "PreStocksError";
  }
}

/**
 * Fetch all available PreStocks tokens
 */
export async function fetchPreStocksTokens(
  cfg: PreStocksConfig = preStocksConfigFromEnv(),
): Promise<PreStockToken[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 15_000);

  try {
    const res = await fetch(cfg.baseUrl!, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: ctrl.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      throw new PreStocksError(
        `PreStocks HTTP ${res.status}`,
        res.status,
        text.slice(0, 2000),
      );
    }

    let tokens: PreStockToken[];
    try {
      tokens = JSON.parse(text) as PreStockToken[];
    } catch {
      throw new PreStocksError(
        "PreStocks returned non-JSON response",
        res.status,
        text.slice(0, 2000),
      );
    }

    // Filter to ensure we have valid tokens with required fields
    return tokens.filter(
      (t) =>
        t.symbol &&
        t.name &&
        t.contract_address &&
        typeof t.tokenPrice === "number" &&
        typeof t.markPrice === "number",
    );
  } finally {
    clearTimeout(t);
  }
}

/**
 * Find a specific PreStocks token by symbol
 */
export async function findPreStockBySymbol(
  symbol: string,
  cfg?: PreStocksConfig,
): Promise<PreStockToken | null> {
  const tokens = await fetchPreStocksTokens(cfg);
  const normalized = symbol.toUpperCase();
  return tokens.find((t) => t.symbol.toUpperCase() === normalized) || null;
}

/**
 * Get token by contract address
 */
export async function findPreStockByAddress(
  address: string,
  cfg?: PreStocksConfig,
): Promise<PreStockToken | null> {
  const tokens = await fetchPreStocksTokens(cfg);
  return tokens.find((t) => t.contract_address === address) || null;
}

/**
 * Calculate premium percentage between token price and mark price
 */
export function calculatePremium(token: PreStockToken): number {
  if (token.markPrice === 0) return 0;
  return ((token.tokenPrice - token.markPrice) / token.markPrice) * 100;
}

/**
 * Extract company name from PreStocks token name
 * PreStocks tokens are named like "Anthropic PreStocks"
 */
export function extractCompanyName(token: PreStockToken): string {
  return token.name.replace(/\s+PreStocks?$/i, "").trim();
}
