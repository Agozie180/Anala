import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Load environment variables from .env and .env.local files.
 * Local .env files take precedence over shell variables.
 */
export function loadDotEnv(): void {
  for (const name of [".env", ".env.local"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), name), "utf8");
      for (const line of text.split(/\r?\n/)) {
        if (!line || line.startsWith("#")) continue;
        const i = line.indexOf("=");
        if (i < 1) continue;
        const k = line.slice(0, i).trim();
        let v = line.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (v !== "") process.env[k] = v;
      }
    } catch {
      /* optional */
    }
  }
}

/**
 * Environment variables for Anala.
 */
export const env = {
  // Runtime mode
  mode: process.env.ANALA_MODE || "research",
  dataDir: process.env.ANALA_DATA_DIR || "data",
  adminToken: process.env.ANALA_ADMIN_TOKEN || "",

  // Solana
  solanaRpcUrl: process.env.SOLANA_RPC_URL || "",
  solanaCluster: process.env.SOLANA_CLUSTER || "mainnet-beta",
  solanaWalletAddress: process.env.SOLANA_WALLET_ADDRESS || "",

  // PreStocks
  prestocksApiUrl: process.env.PRESTOCKS_API_URL || "https://prestocks.com/api/prestocks",

  // LLM
  llmProvider: process.env.LLM_PROVIDER || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  llmModel: process.env.LLM_MODEL || "",

  // News (optional)
  finnhubApiKey: process.env.FINNHUB_API_KEY || "",
  newsapiKey: process.env.NEWSAPI_KEY || "",

  // Risk
  maxLeverage: Number(process.env.ANALA_MAX_LEVERAGE) || 5,
  councilQuorum: Number(process.env.ANALA_COUNCIL_QUORUM) || 4,
} as const;
