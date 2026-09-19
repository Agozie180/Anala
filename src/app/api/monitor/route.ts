import { NextResponse } from "next/server";
import { loadKill, loadPositions } from "@/lib/memory/store";

/**
 * GET /api/monitor
 * Monitor system state (kill switch, positions).
 */
export async function GET() {
  try {
    const kill = loadKill();
    const positions = loadPositions();

    return NextResponse.json({
      ok: true,
      kill,
      positions,
      openCount: positions.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
