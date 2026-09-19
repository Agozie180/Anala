import { NextResponse } from "next/server";
import { discoverPreStocks } from "@/lib/prestocks/instruments";

/**
 * GET /api/instruments
 * List all available PreStocks instruments.
 */
export async function GET() {
  try {
    const instruments = await discoverPreStocks();

    const summary = {
      total: instruments.length,
      available: instruments.filter((i) => i.isAvailable).length,
      totalMarketCap: instruments.reduce((sum, i) => sum + i.impliedValuation, 0),
      avgPremium:
        instruments.reduce((sum, i) => sum + i.premium, 0) / instruments.length,
    };

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      summary,
      instruments: instruments.map((inst) => ({
        symbol: inst.symbol,
        company: inst.companyName,
        tokenPrice: inst.tokenPrice,
        markPrice: inst.markPrice,
        premium: inst.premium,
        valuation: inst.impliedValuation,
        supply: inst.supply,
        available: inst.isAvailable,
        contractAddress: inst.contractAddress,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
