import { NextResponse } from "next/server";
import { discoverPreStocks } from "@/lib/prestocks/instruments";
import { fetchSecAssets } from "@/lib/research/sec";

/**
 * GET /api/assets
 * Discover PreStocks tokens and US stocks from SEC.
 */
export async function GET() {
  const fetchedAt = new Date().toISOString();

  try {
    const [preStocks, sec] = await Promise.allSettled([
      discoverPreStocks(),
      fetchSecAssets(),
    ]);

    const preStocksData = preStocks.status === "fulfilled" ? preStocks.value : [];
    const secData = sec.status === "fulfilled" ? sec.value : [];

    // Map SEC tickers to PreStocks availability
    const preStockSymbols = new Set(preStocksData.map((p) => p.symbol.toUpperCase()));

    return NextResponse.json({
      ok: true,
      fetchedAt,
      preStocks: preStocksData,
      usStocks: secData.map((x) => ({
        ...x,
        tradableOnPreStocks: preStockSymbols.has(x.ticker),
        execution: preStockSymbols.has(x.ticker) ? "research" : "unavailable",
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
