#!/usr/bin/env tsx
/**
 * Monitor Anala state (positions, kill switch).
 */

import { loadKill, loadPositions } from "../lib/memory/store";

async function main() {
  console.log("=== ANALA MONITOR ===\n");

  const kill = loadKill();
  const positions = loadPositions();

  console.log("Kill Switch:");
  console.log(`  Tripped: ${kill.tripped ? "YES" : "NO"}`);
  if (kill.tripped) {
    console.log(`  Reasons: ${kill.reasons.join(", ")}`);
  }
  console.log(`  Failed orders: ${kill.failedOrders}`);
  console.log();

  console.log(`Open Positions: ${positions.length}`);
  positions.forEach((p) => {
    console.log(`  ${p.symbol} ${p.direction} @ ${p.entry}`);
    console.log(`    Stop: ${p.stop}, Target: ${p.takeProfit}`);
    console.log(`    Mode: ${p.mode}, Status: ${p.status}`);
    console.log(`    Opened: ${p.openedAt}`);
  });

  if (positions.length === 0) {
    console.log("  (none)");
  }
}

main().catch((err) => {
  console.error("Monitor failed:", err);
  process.exit(1);
});
