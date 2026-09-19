#!/usr/bin/env tsx
/**
 * Run full Anala analysis on a PreStocks token.
 */

import { runAnala } from "../lib/orchestrator/anala";

async function main() {
  const symbol = process.argv[2]?.toUpperCase();

  if (!symbol) {
    console.error("Usage: npm run run -- <SYMBOL>");
    console.error("Example: npm run run -- ANTHROPIC");
    process.exit(1);
  }

  console.log(`Running Anala analysis: ${symbol}\n`);

  try {
    const result = await runAnala({ symbol });

    console.log("=== ANALA ANALYSIS ===");
    console.log(`Run ID: ${result.id}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Mode: ${result.mode}`);
    console.log(`Duration: ${result.durationMs}ms`);
    console.log();

    if (!result.resolved?.instrument) {
      console.log(`Decision: ${result.decision}`);
      console.log(`Reason: ${result.reason}`);
      return;
    }

    const inst = result.resolved.instrument;
    console.log("=== TOKEN INFO ===");
    console.log(`Company: ${inst.companyName}`);
    console.log(`Token Price: $${inst.tokenPrice.toFixed(2)}`);
    console.log(`Premium: ${inst.premium.toFixed(1)}%`);
    console.log(`Valuation: $${(inst.impliedValuation / 1e9).toFixed(2)}B`);
    console.log();

    console.log("=== SESSION ===");
    console.log(`Session: ${result.session.label}`);
    console.log(`Threshold: ${(result.session.threshold * 100).toFixed(0)}%`);
    console.log();

    console.log("=== RESEARCH ===");
    console.log(`Catalyst: ${result.research.catalyst.classification}`);
    console.log(`Why: ${result.research.why.headline}`);
    console.log(`Items: ${result.research.items.length}`);
    console.log(`Fresh: ${result.research.quality.freshSubstantive}`);
    console.log();

    console.log("=== CONFIDENCE ===");
    console.log(`Raw: ${(result.confidence.raw * 100).toFixed(1)}%`);
    console.log(`Calibrated: ${(result.confidence.calibrated * 100).toFixed(1)}%`);
    if (result.confidence.adjustments.length) {
      console.log("Adjustments:");
      result.confidence.adjustments.forEach((adj) => {
        console.log(`  ${adj.delta > 0 ? "+" : ""}${(adj.delta * 100).toFixed(1)}% - ${adj.reason}`);
      });
    }
    console.log();

    console.log("=== COUNCIL OF SEVEN ===");
    result.elders.forEach((elder) => {
      const vote = elder.vote === "LONG" ? "🟢 LONG" : elder.vote === "SHORT" ? "🔴 SHORT" : "⚪ NO_TRADE";
      console.log(`${elder.elder}: ${vote} (${(elder.confidence * 100).toFixed(0)}%)`);
      console.log(`  ${elder.recommendation}`);
    });
    console.log();
    console.log(`Council: ${result.council.summary}`);
    console.log(`Passed: ${result.council.passed ? "✓" : "✗"}`);
    console.log();

    console.log("=== RISK ===");
    console.log(`Allowed: ${result.risk.allowed ? "✓" : "✗"}`);
    console.log(`Reason: ${result.risk.reason}`);
    if (result.risk.allowed) {
      console.log(`Size: ${result.risk.qty} tokens @ $${result.risk.entry.toFixed(2)}`);
      console.log(`Stop: $${result.risk.stop.toFixed(2)}`);
      console.log(`Target: $${result.risk.takeProfit.toFixed(2)}`);
      console.log(`EV: ${result.risk.estimatedEv.toFixed(2)}`);
    }
    console.log();

    console.log("=== GATES ===");
    result.gates.forEach((g) => {
      const icon = g.passed ? "✓" : "✗";
      console.log(`${icon} ${g.name}: ${g.reason}`);
    });
    console.log();

    console.log("=== DECISION ===");
    console.log(`${result.decision}`);
    if (result.noTradeReason) {
      console.log(`Reason: ${result.noTradeReason}`);
    }
    console.log();

    console.log("✅ Analysis complete");
    console.log(`Full results saved to data/aether.db (run ID: ${result.id})`);
  } catch (err) {
    console.error("Analysis failed:", err);
    process.exit(1);
  }
}

main();
