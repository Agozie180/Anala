import { NextRequest, NextResponse } from "next/server";
import { resolvePreStockInstrument } from "@/lib/prestocks/instruments";
import { fetchPreStockTicker } from "@/lib/prestocks/market";
import { runResearch } from "@/lib/research/prestocks-engine";

/**
 * GET /api/research?symbol=ANTHROPIC
 * Research a PreStocks token.
 */
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json(
      { ok: false, error: "Missing symbol parameter" },
      { status: 400 }
    );
  }

  try {
    const resolved = await resolvePreStockInstrument(symbol);

    if (!resolved.resolved || !resolved.instrument) {
      return NextResponse.json({
        ok: false,
        error: resolved.reason,
      });
    }

    const inst = resolved.instrument;
    const ticker = await fetchPreStockTicker(symbol);

    const research = await runResearch({
      symbol: inst.symbol,
      companyName: inst.companyName,
      tokenPrice: ticker.tokenPrice,
      markPrice: ticker.markPrice,
      premium: ticker.premium,
      impliedValuation: ticker.impliedValuation,
    });

    return NextResponse.json({
      ok: true,
      symbol: inst.symbol,
      company: inst.companyName,
      ticker,
      research: {
        catalyst: research.catalyst,
        why: research.why,
        items: research.items.slice(0, 20), // Limit for API response
        quality: research.quality,
        fetchedAt: research.fetchedAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
