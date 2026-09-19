#!/usr/bin/env tsx
/**
 * Discover all available PreStocks tokens.
 */

import { fetchPreStocksTokens } from "../lib/prestocks/client";
import { discoverPreStocks } from "../lib/prestocks/instruments";

async function main() {
  console.log("Discovering PreStocks tokens...\n");

  try {
    const instruments = await discoverPreStocks();

    console.log(`Found ${instruments.length} PreStocks tokens:\n`);

    const table = instruments.map((inst) => ({
      Symbol: inst.symbol,
      Company: inst.companyName,
      "Token Price": `$${inst.tokenPrice.toFixed(2)}`,
      "Mark Price": `$${inst.markPrice.toFixed(2)}`,
      Premium: `${inst.premium.toFixed(1)}%`,
      "Valuation": `$${(inst.impliedValuation / 1e9).toFixed(2)}B`,
      Available: inst.isAvailable ? "✓" : "✗",
    }));

    console.table(table);

    console.log(`\nUsage: npm run research -- <SYMBOL>`);
    console.log(`Example: npm run research -- ANTHROPIC\n`);
  } catch (err) {
    console.error("Failed to discover PreStocks:", err);
    process.exit(1);
  }
}

main();
