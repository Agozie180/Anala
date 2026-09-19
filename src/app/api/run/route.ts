import { NextRequest, NextResponse } from "next/server";
import { runAnala } from "@/lib/orchestrator/anala";

/**
 * POST /api/run
 * Run full Anala analysis on a PreStocks token.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { symbol } = body;

    if (!symbol) {
      return NextResponse.json(
        { ok: false, error: "Missing symbol" },
        { status: 400 }
      );
    }

    const result = await runAnala({ symbol });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
