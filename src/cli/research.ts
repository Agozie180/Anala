#!/usr/bin/env tsx
/**
 * Research a PreStocks token.
 */

import { resolvePreStockInstrument } from "../lib/prestocks/instruments";
import { runResearch } from "../lib/research/prestocks-engine";
import { fetchPreStockTicker } from "../lib/prestocks/market";

async function main() {
  const symbol = process.argv[2]?.toUpperCase();

  if (!symbol) {
    console.error("Usage: npm run research -- <SYMBOL>");
    console.error("Example: npm run research -- ANTHROPIC");
    process.exit(1);
  }

  console.log(`Researching PreStocks token: ${symbol}\n`);

  try {
    const resolved = await resolvePreStockInstrument(symbol);

    if (!resolved.resolved || !resolved.instrument) {
      console.error(`❌ ${resolved.reason}`);
      process.exit(1);
    }

    const inst = resolved.instrument;
    const ticker = await fetchPreStockTicker(symbol);

    console.log("=== PRESTOCK INFO ===");
    console.log(`Company: ${inst.companyName}`);
    console.log(`Symbol: ${inst.symbol}`);
    console.log(`Contract: ${inst.contractAddress}`);
    console.log(`Token Price: $${ticker.tokenPrice.toFixed(2)}`);
    console.log(`Mark Price: $${ticker.markPrice.toFixed(2)}`);
    console.log(`Premium: ${ticker.premium.toFixed(1)}%`);
    console.log(`Implied Valuation: $${(ticker.impliedValuation / 1e9).toFixed(2)}B`);
    console.log(`Supply: ${ticker.supply.toLocaleString()}`);
    console.log();

    console.log("=== RESEARCH ===");
    const research = await runResearch({
      symbol: inst.symbol,
      companyName: inst.companyName,
      tokenPrice: ticker.tokenPrice,
      markPrice: ticker.markPrice,
      premium: ticker.premium,
      impliedValuation: ticker.impliedValuation,
    });

    console.log(`Catalyst: ${research.catalyst.classification}`);
    console.log(`Why: ${research.why.headline}`);
    console.log(`\nResearch Items (${research.items.length} total):`);

    research.items.slice(0, 10).forEach((item, i) => {
      console.log(`\n${i + 1}. [${item.kind}] ${item.title}`);
      console.log(`   Source: ${item.source}`);
      console.log(`   Relevance: ${(item.relevance * 100).toFixed(0)}% | Reliability: ${(item.reliability * 100).toFixed(0)}%`);
      if (item.url) console.log(`   URL: ${item.url}`);
    });

    if (research.items.length > 10) {
      console.log(`\n... and ${research.items.length - 10} more items`);
    }

    console.log(`\n=== DATA QUALITY ===`);
    console.log(`Complete: ${research.quality.complete ? "✓" : "✗"}`);
    console.log(`Fresh substantive items: ${research.quality.freshSubstantive}`);
    if (research.quality.missing.length) {
      console.log(`Missing: ${research.quality.missing.join(", ")}`);
    }
    if (research.quality.failures.length) {
      console.log(`Failures: ${research.quality.failures.join(", ")}`);
    }

    console.log();
  } catch (err) {
    console.error("Research failed:", err);
    process.exit(1);
  }
}

main();
