import { NextRequest, NextResponse } from "next/server";
import { resolvePreStockInstrument } from "@/lib/prestocks/instruments";
import { calculateLTV, type LTVCalculation } from "@/lib/defi/ltv";

/**
 * GET /api/lend-quote?symbol=ANTHROPIC
 *
 * Returns { instrument, ltv } for the /lend page. This MUST be computed
 * server-side: `resolvePreStockInstrument` fetches https://prestocks.com/api/prestocks
 * (which sends no CORS headers, so a browser fetch is blocked) and `calculateLTV`
 * runs the research engine (SEC + news, server-only). Calling them directly from
 * the client component left `instrument`/`ltvCalc` null on the deployed site, which
 * forced maxBorrow to 0 and permanently disabled the Borrow button.
 */
export const dynamic = "force-dynamic";

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("ltv timeout")), ms)),
  ]);
}

// Conservative default so the borrow limit is never dead even if research stalls/fails.
function fallbackLtv(): LTVCalculation {
  const adjustedLtv = 0.5;
  return {
    baseLtv: 0.5,
    adjustedLtv,
    maxBorrowRatio: adjustedLtv,
    riskScore: {
      companyHealth: 50,
      marketHealth: 50,
      sentimentScore: 0,
      confidenceLevel: 50,
      overall: 50,
      rationale: "Fallback score — live research was unavailable.",
    },
    recommendation: `Conservative default while research is unavailable: ${(adjustedLtv * 100).toFixed(0)}%`,
    warnings: ["Live research unavailable — using conservative default LTV."],
  };
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ ok: false, error: "Missing symbol parameter" }, { status: 400 });
  }

  try {
    const resolved = await resolvePreStockInstrument(symbol);
    if (!resolved.resolved || !resolved.instrument) {
      return NextResponse.json({ ok: false, error: resolved.reason }, { status: 404 });
    }
    const instrument = resolved.instrument;

    let ltv: LTVCalculation;
    try {
      ltv = await withTimeout(calculateLTV(instrument), 12_000);
    } catch {
      ltv = fallbackLtv();
    }

    return NextResponse.json({ ok: true, instrument, ltv });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
