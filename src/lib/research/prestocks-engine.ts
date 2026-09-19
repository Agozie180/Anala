/**
 * Research engine adapted for PreStocks.
 * Maintains SEC + news integration, adds PreStocks metadata.
 */

import { policy } from "../policy";
import type { DataQuality, ResearchItem } from "../types";
import { nowIso, uid } from "../util";
import { classifyCatalyst, type CatalystReport } from "./catalyst";
import { fetchNewsResearch } from "./news";
import { scoreRelevance } from "./relevance";
import { fetchSecResearch } from "./sec";
import { whyIsItMoving, type WhyMoving } from "./whyMoving";

export interface ResearchBundle {
  ticker: string;
  name?: string;
  cik?: number;
  items: ResearchItem[];
  catalyst: CatalystReport;
  why: WhyMoving;
  quality: DataQuality;
  fetchedAt: string;
  notes: string[];
}

export async function runResearch(args: {
  symbol: string;
  companyName: string;
  tokenPrice: number;
  markPrice: number;
  premium: number;
  impliedValuation: number;
}): Promise<ResearchBundle> {
  const fetchedAt = nowIso();
  const ticker = args.symbol.toUpperCase();
  const notes: string[] = [];
  const missing: string[] = [];
  const failures: string[] = [];
  const freshnessSeconds: Record<string, number> = {};
  const t0 = Date.now();

  // Use company name for SEC lookup (e.g., "Anthropic" from "ANTHROPIC" symbol)
  const [sec, news] = await Promise.all([
    fetchSecResearch(args.companyName),
    fetchNewsResearch(`${args.companyName} ${ticker}`, ticker),
  ]);

  freshnessSeconds.sec = (Date.now() - t0) / 1000;
  freshnessSeconds.news = freshnessSeconds.sec;

  if (sec.error) {
    failures.push(`SEC: ${sec.error}`);
    if (!sec.company) missing.push("sec_company");
  }
  if (news.errors.length) failures.push(...news.errors.map((e) => `news: ${e}`));
  if (!news.items.length) missing.push("news_headlines");

  // Add PreStocks pricing item
  const priceItem: ResearchItem = {
    id: uid("px"),
    kind: "price",
    title: `${ticker} PreStocks token: $${args.tokenPrice.toFixed(2)} (premium ${args.premium.toFixed(1)}%)`,
    summary: `PreStocks ${ticker}: token price $${args.tokenPrice}, mark $${args.markPrice}, implied valuation $${(args.impliedValuation / 1e9).toFixed(2)}B. Premium: ${args.premium.toFixed(1)}%.`,
    source: "PreStocks API",
    url: `https://prestocks.com/${ticker.toLowerCase()}`,
    publishedAt: fetchedAt,
    fetchedAt,
    freshnessMinutes: 0,
    relevance: 1,
    reliability: 0.95,
    relationToThesis: "Current PreStocks token pricing and valuation data.",
  };

  let items: ResearchItem[] = [...(sec.items ?? []), ...news.items, priceItem].map((it) =>
    scoreRelevance(it, ticker, sec.company?.name || args.companyName),
  );
  items = items.sort((a, b) => b.relevance * b.reliability - a.relevance * a.reliability);

  const catalyst = classifyCatalyst(items);

  // Simplified "why moving" for PreStocks
  const why: WhyMoving = {
    question: "Why is this asset moving?",
    headline: `${args.companyName} (${ticker}) PreStocks token at $${args.tokenPrice.toFixed(2)}`,
    drivers: [
      {
        claim: `Token trading at ${args.premium > 0 ? "+" : ""}${args.premium.toFixed(1)}% premium to mark price`,
        support: "PreStocks API pricing data",
        confidence: 0.95
      },
      {
        claim: `Implied valuation: $${(args.impliedValuation / 1e9).toFixed(2)}B`,
        support: "PreStocks API",
        confidence: 0.95
      },
    ],
    unanswered: [
      "Volume data not available from PreStocks API",
      "No correlation data for pre-IPO stocks",
      catalyst.classification === "none" ? "No clear catalyst identified" : ""
    ].filter(Boolean),
  };

  notes.push(
    `PreStocks tokenized pre-IPO stock. Company mapped to SEC via name: ${args.companyName}.`,
  );

  if (!sec.company) {
    notes.push(`No SEC CIK found for ${args.companyName} - company may be private/pre-filing.`);
  }

  const isFresh = (i: ResearchItem): boolean =>
    i.kind === "company" || i.kind === "price" || i.freshnessMinutes <= policy.maxStaleResearchMin;

  const quality: DataQuality = {
    complete: missing.length === 0,
    missing,
    stale: items.filter((i) => !isFresh(i) && i.kind !== "company" && i.kind !== "price").map((i) => i.id),
    failures,
    freshnessSeconds,
    freshSubstantive: items.filter((i) => i.kind !== "price" && isFresh(i)).length,
  };

  return {
    ticker,
    name: sec.company?.name || args.companyName,
    cik: sec.company?.cik,
    items,
    catalyst,
    why,
    quality,
    fetchedAt,
    notes,
  };
}
