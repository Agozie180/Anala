#!/usr/bin/env tsx
/**
 * Test LTV calculation for PreStocks lending
 */

import { resolvePreStockInstrument } from "../lib/prestocks/instruments";
import { calculateLTV, calculateBorrowingPower } from "../lib/defi/ltv";

async function main() {
  const symbol = process.argv[2]?.toUpperCase() || "ANTHROPIC";

  console.log(`\n=== ANALA LENDING: LTV ANALYSIS ===`);
  console.log(`Token: ${symbol}\n`);

  console.log("🔍 Resolving instrument...");
  const resolved = await resolvePreStockInstrument(symbol);

  if (!resolved.resolved || !resolved.instrument) {
    console.error(`❌ ${resolved.reason}`);
    process.exit(1);
  }

  const inst = resolved.instrument;
  console.log(`✓ ${inst.companyName} (${inst.symbol})`);
  console.log(`  Token Price: $${inst.tokenPrice.toFixed(2)}`);
  console.log(`  Premium: ${inst.premium.toFixed(1)}%\n`);

  console.log("🤖 Running Anala AI risk assessment...");
  const ltv = await calculateLTV(inst);

  console.log("\n=== RISK ANALYSIS ===");
  console.log(ltv.riskScore.rationale);

  console.log("\n=== LTV CALCULATION ===");
  console.log(`Base LTV: ${(ltv.baseLtv * 100).toFixed(0)}%`);
  console.log(`Risk-Adjusted LTV: ${(ltv.adjustedLtv * 100).toFixed(1)}%`);
  console.log(`\n${ltv.recommendation}`);

  if (ltv.warnings.length > 0) {
    console.log("\n⚠️  WARNINGS:");
    ltv.warnings.forEach(w => console.log(`   ${w}`));
  }

  console.log("\n=== BORROWING POWER ===");
  const examples = [1000, 5000, 10000, 50000];

  console.log("\nExample collateral values:");
  examples.forEach(collateral => {
    const power = calculateBorrowingPower(collateral, ltv);
    console.log(`\n$${collateral.toLocaleString()} collateral:`);
    console.log(`  Max Borrow: $${power.maxBorrow.toFixed(2)}`);
    console.log(`  Recommended: $${power.recommended.toFixed(2)}`);
    console.log(`  Conservative: $${power.conservative.toFixed(2)}`);
  });

  console.log("\n✅ Analysis complete\n");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
