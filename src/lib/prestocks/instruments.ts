import type { PreStockToken } from "./client";
import { fetchPreStocksTokens, findPreStockBySymbol, extractCompanyName } from "./client";

/**
 * PreStocks instrument discovery and resolution.
 * Adapted from AetherAI's Bitget instruments module.
 */

export interface PreStockInstrument {
  symbol: string;
  companyName: string;
  tokenName: string;
  contractAddress: string;
  tokenPrice: number;
  markPrice: number;
  impliedValuation: number;
  markValuation: number;
  supply: number;
  premium: number;
  description: string;
  image: string;
  externalUrl: string;
  // Trading metadata
  minOrderQty: number;
  pricePrecision: number;
  quantityPrecision: number;
  isAvailable: boolean;
}

export interface InstrumentResolution {
  requested: string;
  resolved: boolean;
  instrument?: PreStockInstrument;
  tradable: boolean;
  reason: string;
  raw?: PreStockToken;
}

/**
 * Discover all available PreStocks instruments
 */
export async function discoverPreStocks(): Promise<PreStockInstrument[]> {
  const tokens = await fetchPreStocksTokens();

  return tokens.map((token) => mapTokenToInstrument(token));
}

/**
 * Resolve a symbol to a PreStocks instrument
 */
export async function resolvePreStockInstrument(
  symbol: string,
): Promise<InstrumentResolution> {
  const normalized = symbol.toUpperCase();

  try {
    const token = await findPreStockBySymbol(normalized);

    if (!token) {
      return {
        requested: symbol,
        resolved: false,
        tradable: false,
        reason: `PreStocks token ${symbol} not found. Available tokens must be discovered via API.`,
      };
    }

    const instrument = mapTokenToInstrument(token);

    return {
      requested: symbol,
      resolved: true,
      instrument,
      tradable: instrument.isAvailable,
      reason: instrument.isAvailable
        ? `PreStocks ${instrument.companyName} resolved`
        : `PreStocks ${instrument.companyName} found but not tradable`,
      raw: token,
    };
  } catch (err) {
    return {
      requested: symbol,
      resolved: false,
      tradable: false,
      reason: `Failed to resolve PreStocks token: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Map PreStocks API token to internal instrument format
 */
function mapTokenToInstrument(token: PreStockToken): PreStockInstrument {
  const companyName = extractCompanyName(token);
  const premium = token.markPrice > 0
    ? ((token.tokenPrice - token.markPrice) / token.markPrice) * 100
    : 0;

  return {
    symbol: token.symbol,
    companyName,
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
    // Trading metadata - using sensible defaults
    // These should be updated based on actual trading infrastructure
    minOrderQty: 0.01,
    pricePrecision: 2,
    quantityPrecision: 2,
    isAvailable: token.tokenPrice > 0 && token.supply > 0,
  };
}

/**
 * Get instrument by contract address
 */
export async function getInstrumentByAddress(
  address: string,
): Promise<PreStockInstrument | null> {
  const tokens = await fetchPreStocksTokens();
  const token = tokens.find((t) => t.contract_address === address);

  if (!token) return null;
  return mapTokenToInstrument(token);
}

/**
 * Check if a symbol represents a valid PreStocks token
 */
export async function isPreStockSymbol(symbol: string): Promise<boolean> {
  const resolution = await resolvePreStockInstrument(symbol);
  return resolution.resolved && resolution.tradable;
}
