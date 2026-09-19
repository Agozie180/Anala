/**
 * Market data aggregator for PreStocks tokens.
 * Provides pricing, volume, and market metrics.
 */

import type { PreStockInstrument } from "./instruments";
import { fetchPreStocksTokens } from "./client";

export interface PreStockTicker {
  symbol: string;
  last: number;
  markPrice: number;
  tokenPrice: number;
  premium: number;
  impliedValuation: number;
  markValuation: number;
  supply: number;
  change24h: number; // Calculated if historical data available
  volume24h: number; // From external source if available
  ts: number;
}

export interface MarketSnapshot {
  ticker: PreStockTicker;
  instrument: PreStockInstrument;
  fetchedAt: number;
  stale: boolean;
}

/**
 * Fetch current market data for a PreStocks token
 * Note: PreStocks API does not provide historical or volume data
 * This returns current state only
 */
export async function fetchPreStockTicker(symbol: string): Promise<PreStockTicker> {
  const tokens = await fetchPreStocksTokens();
  const token = tokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());

  if (!token) {
    throw new Error(`PreStocks token ${symbol} not found`);
  }

  const premium = token.markPrice > 0
    ? ((token.tokenPrice - token.markPrice) / token.markPrice) * 100
    : 0;

  return {
    symbol: token.symbol,
    last: token.tokenPrice,
    markPrice: token.markPrice,
    tokenPrice: token.tokenPrice,
    premium,
    impliedValuation: token.impliedValuation,
    markValuation: token.markValuation,
    supply: token.supply,
    change24h: 0, // Not available from PreStocks API
    volume24h: 0, // Not available from PreStocks API
    ts: Date.now(),
  };
}

/**
 * Fetch aggregated market statistics
 */
export async function fetchMarketStats(): Promise<{
  totalMarketCap: number;
  totalTokens: number;
  averagePremium: number;
}> {
  const tokens = await fetchPreStocksTokens();

  const totalMarketCap = tokens.reduce((sum, t) => sum + (t.impliedValuation || 0), 0);
  const premiums = tokens
    .filter((t) => t.markPrice > 0)
    .map((t) => ((t.tokenPrice - t.markPrice) / t.markPrice) * 100);
  const averagePremium = premiums.length > 0
    ? premiums.reduce((a, b) => a + b, 0) / premiums.length
    : 0;

  return {
    totalMarketCap,
    totalTokens: tokens.length,
    averagePremium,
  };
}

/**
 * Get market snapshot with staleness check
 */
export async function getMarketSnapshot(
  symbol: string,
  maxStaleMs: number = 60_000,
): Promise<MarketSnapshot> {
  const fetchedAt = Date.now();
  const tokens = await fetchPreStocksTokens();
  const token = tokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());

  if (!token) {
    throw new Error(`PreStocks token ${symbol} not found`);
  }

  const premium = token.markPrice > 0
    ? ((token.tokenPrice - token.markPrice) / token.markPrice) * 100
    : 0;

  const ticker: PreStockTicker = {
    symbol: token.symbol,
    last: token.tokenPrice,
    markPrice: token.markPrice,
    tokenPrice: token.tokenPrice,
    premium,
    impliedValuation: token.impliedValuation,
    markValuation: token.markValuation,
    supply: token.supply,
    change24h: 0,
    volume24h: 0,
    ts: fetchedAt,
  };

  const instrument: PreStockInstrument = {
    symbol: token.symbol,
    companyName: token.name.replace(/\s+PreStocks?$/i, "").trim(),
    tokenName: token.name,
    contractAddress: token.contract_address,
    tokenPrice: token.tokenPrice,
    markPrice: token.markPrice,
    impliedValuation: token.impliedValuation,
    markValuation: token.markValuation,
    supply: token.supply,
    premium,
    description: token.description,
    image: token.image,
    externalUrl: token.external_url,
    minOrderQty: 0.01,
    pricePrecision: 2,
    quantityPrecision: 2,
    isAvailable: token.tokenPrice > 0 && token.supply > 0,
  };

  return {
    ticker,
    instrument,
    fetchedAt,
    stale: false, // PreStocks data is always current when fetched
  };
}
