/**
 * Anala Risk-Based LTV Calculator
 *
 * Calculates loan-to-value ratios for PreStocks lending based on AI research.
 */

import { runResearch } from "../research/prestocks-engine";
import type { PreStockInstrument } from "../prestocks/instruments";
import { fetchPreStockTicker } from "../prestocks/market";

export interface RiskScore {
  companyHealth: number; // 0-100
  marketHealth: number; // 0-100
  sentimentScore: number; // -10 to +10
  confidenceLevel: number; // 0-100
  overall: number; // 0-100
  rationale: string;
}

export interface LTVCalculation {
  baseLtv: number;
  adjustedLtv: number;
  maxBorrowRatio: number;
  riskScore: RiskScore;
  recommendation: string;
  warnings: string[];
}

/**
 * Calculate risk score from Anala research
 */
export async function calculateRiskScore(
  instrument: PreStockInstrument
): Promise<RiskScore> {
  const ticker = await fetchPreStockTicker(instrument.symbol);

  const research = await runResearch({
    symbol: instrument.symbol,
    companyName: instrument.companyName,
    tokenPrice: ticker.tokenPrice,
    markPrice: ticker.markPrice,
    premium: ticker.premium,
    impliedValuation: ticker.impliedValuation,
  });

  // Company Health: Based on research quality and catalyst presence
  let companyHealth = 50; // Base score

  if (research.quality.freshSubstantive > 5) companyHealth += 15;
  if (research.quality.freshSubstantive > 10) companyHealth += 10;
  if (research.catalyst.classification === "known") companyHealth += 15;
  if (research.catalyst.classification === "possible") companyHealth += 5;
  if (research.quality.missing.length === 0) companyHealth += 10;

  // Market Health: Based on premium and supply
  let marketHealth = 50;
  const premiumAbs = Math.abs(ticker.premium);

  if (premiumAbs < 5) marketHealth += 20; // Healthy pricing
  else if (premiumAbs < 15) marketHealth += 10;
  else marketHealth -= 10; // Mispricing concern

  if (ticker.supply > 5000) marketHealth += 10; // Good liquidity
  else if (ticker.supply < 1000) marketHealth -= 10;

  // Sentiment: Based on news and research items
  let sentimentScore = 0;
  const newsItems = research.items.filter(i => i.kind === "news");

  if (newsItems.length > 5) sentimentScore += 2; // Active coverage
  if (research.catalyst.classification === "known") sentimentScore += 3;
  if (research.quality.failures.length > 2) sentimentScore -= 2;

  // Confidence: Based on data quality
  let confidenceLevel = 50;

  confidenceLevel += (research.quality.freshSubstantive * 3);
  confidenceLevel -= (research.quality.missing.length * 5);
  confidenceLevel -= (research.quality.stale.length * 3);

  // Clamp values
  companyHealth = Math.max(0, Math.min(100, companyHealth));
  marketHealth = Math.max(0, Math.min(100, marketHealth));
  sentimentScore = Math.max(-10, Math.min(10, sentimentScore));
  confidenceLevel = Math.max(0, Math.min(100, confidenceLevel));

  // Overall risk score (weighted average)
  const overall =
    (companyHealth * 0.35) +
    (marketHealth * 0.25) +
    (confidenceLevel * 0.3) +
    ((sentimentScore + 10) * 0.5); // Normalize sentiment to 0-20, weight 0.1

  const rationale = `
Company Health: ${companyHealth}/100 (${research.quality.freshSubstantive} fresh items, ${research.catalyst.classification} catalyst)
Market Health: ${marketHealth}/100 (${ticker.premium.toFixed(1)}% premium, supply ${ticker.supply.toFixed(0)})
Sentiment: ${sentimentScore}/10 (${newsItems.length} news items)
Confidence: ${confidenceLevel}/100 (${research.quality.missing.length} missing, ${research.quality.stale.length} stale)
Overall Risk Score: ${overall.toFixed(1)}/100
  `.trim();

  return {
    companyHealth,
    marketHealth,
    sentimentScore,
    confidenceLevel,
    overall,
    rationale,
  };
}

/**
 * Calculate LTV ratio based on risk score
 */
export async function calculateLTV(
  instrument: PreStockInstrument
): Promise<LTVCalculation> {
  const riskScore = await calculateRiskScore(instrument);

  // Base LTV: Conservative starting point
  const baseLtv = 0.50; // 50%

  // Risk adjustment: Scale from -15% to +20% based on risk score
  // Score 0 → -15% adjustment (35% LTV)
  // Score 50 → 0% adjustment (50% LTV)
  // Score 100 → +20% adjustment (70% LTV)
  const riskAdjustment = ((riskScore.overall - 50) / 50) * 0.20;

  const adjustedLtv = Math.max(0.30, Math.min(0.75, baseLtv + riskAdjustment));

  // Generate warnings
  const warnings: string[] = [];

  if (riskScore.overall < 40) {
    warnings.push("⚠️ Low risk score - reduced borrowing capacity");
  }
  if (riskScore.companyHealth < 50) {
    warnings.push("⚠️ Limited company data - conservative LTV applied");
  }
  if (riskScore.sentimentScore < -3) {
    warnings.push("⚠️ Negative sentiment detected in recent news");
  }
  if (riskScore.confidenceLevel < 50) {
    warnings.push("⚠️ Low confidence due to data quality issues");
  }
  if (Math.abs(riskScore.sentimentScore) < 1 && riskScore.marketHealth > 60) {
    // Good case
    warnings.length === 0 && warnings.push("✅ Healthy collateral with good data quality");
  }

  const recommendation = riskScore.overall >= 60
    ? `Strong collateral. Recommended max borrow: ${(adjustedLtv * 100).toFixed(0)}%`
    : riskScore.overall >= 45
    ? `Moderate collateral. Conservative borrow recommended: ${(adjustedLtv * 100).toFixed(0)}%`
    : `Weak collateral. Minimal borrowing advised: ${(adjustedLtv * 100).toFixed(0)}%`;

  return {
    baseLtv,
    adjustedLtv,
    maxBorrowRatio: adjustedLtv,
    riskScore,
    recommendation,
    warnings,
  };
}

/**
 * Get borrowing power for a collateral amount
 */
export function calculateBorrowingPower(
  collateralValueUsd: number,
  ltv: LTVCalculation
): {
  maxBorrow: number;
  recommended: number;
  conservative: number;
} {
  const maxBorrow = collateralValueUsd * ltv.maxBorrowRatio;
  const recommended = collateralValueUsd * (ltv.maxBorrowRatio * 0.85); // 85% of max
  const conservative = collateralValueUsd * (ltv.maxBorrowRatio * 0.70); // 70% of max

  return {
    maxBorrow,
    recommended,
    conservative,
  };
}
