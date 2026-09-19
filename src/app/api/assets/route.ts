import { NextResponse } from "next/server";
import { discoverPreStocks } from "@/lib/prestocks/instruments";

/**
 * GET /api/assets
 * Discover available PreStocks tokens.
 */
export async function GET() {
  const fetchedAt = new Date().toISOString();

  try {
    const preStocks = await discoverPreStocks();

    return NextResponse.json({
      ok: true,
      fetchedAt,
      preStocks,
      count: preStocks.length,
    });
  } catch (err) {
    console.error("Failed to fetch assets:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
