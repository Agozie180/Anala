/**
 * Anala orchestrator - adapted from AetherAI for PreStocks.
 * Core decision pipeline: research → intelligence → council → risk → recommendation.
 */

import { policy } from "../policy";
import type { Mode, RunRequest, Vote } from "../types";
import { nowIso, uid } from "../util";
import { resolvePreStockInstrument } from "../prestocks/instruments";
import { fetchPreStockTicker } from "../prestocks/market";
import { fetchAccount } from "../solana/account";
import { runResearch } from "../research/prestocks-engine";
import { currentSession } from "../session";
import { computeConfidence } from "../confidence/engine";
import { conveneElders } from "../council/elders";
import { councilGate } from "../council/gate";
import { planRisk } from "../risk/engine";
import { evaluateKillSwitch } from "../risk/killswitch";
import {
  appendPaperLog,
  appendEvent,
  bumpFailedOrders,
  getOpenBySymbol,
  tripKill,
  loadKill,
  loadPositions,
  realizedLossUsd,
  saveRun,
  upsertPosition,
} from "../memory/store";
import { similarSetups } from "../memory/similar";
import { foldGates, gate } from "./gates";
import type { AnalaResult, AnalaEarlyExit, AnalaFullResult } from "./types";

export async function runAnala(req: RunRequest = {}): Promise<AnalaResult> {
  const started = Date.now();
  const mode: Mode = "research"; // Anala operates in research mode
  const session = currentSession();
  const runId = uid("run");

  const killState = loadKill();
  const account = await fetchAccount();
  const requested = (req.symbol || "ANTHROPIC").toUpperCase();
  const resolved = await resolvePreStockInstrument(requested);

  if (!resolved.resolved || !resolved.instrument) {
    const payload: AnalaEarlyExit = {
      id: runId,
      at: nowIso(),
      mode,
      session,
      resolved,
      decision: "NO_TRADE",
      reason: resolved.reason,
      gates: [gate("instrument", false, resolved.reason)],
    };
    saveRun({
      id: runId,
      createdAt: nowIso(),
      symbol: requested,
      mode,
      decision: "NO_TRADE",
      calibrated: 0,
      payload: JSON.stringify(payload),
    });
    return payload;
  }

  const inst = resolved.instrument;
  const ticker = await fetchPreStockTicker(inst.symbol);

  // PreStocks doesn't provide historical candles, so we skip technical analysis
  // that requires historical data. Focus on fundamental research.
  const research = await runResearch({
    symbol: inst.symbol,
    companyName: inst.companyName,
    tokenPrice: ticker.tokenPrice,
    markPrice: ticker.markPrice,
    premium: ticker.premium,
    impliedValuation: ticker.impliedValuation,
  });

  const history = similarSetups({
    regime: "trending", // Placeholder - no historical data
    session: session.session,
    direction: "LONG", // Placeholder
  });

  const historyData = {
    settled: history.settled,
    wins: history.wins,
    losses: history.settled - history.wins,
  };

  // Simplified confidence without technical indicators (PreStocks has no historical data)
  const confidence = computeConfidence({
    mtf: {
      frames: [],
      agreement: 0,
      consensus: "NO_TRADE",
      confluence: 0,
      conflict: false
    },
    regime: {
      regime: "trending",
      volatility: "normal",
      atrPct: 0,
      chop: 0.5,
      rationale: "No historical data for regime analysis"
    },
    structure: {
      last: ticker.tokenPrice,
      swingHigh: ticker.markPrice * 1.1,
      swingLow: ticker.markPrice * 0.9,
      support: ticker.markPrice * 0.95,
      resistance: ticker.markPrice * 1.05,
      trend: "sideways",
      breakout: "none",
      rangePct: 0.1
    },
    technicals: {
      rsi: 50,
      emaStack: "mixed",
      macdHist: 0,
      volumeRatio: 1,
    } as any,
    micro: {
      spread: 0,
      spreadBps: 0,
      mid: ticker.tokenPrice,
      bidDepth: 0,
      askDepth: 0,
      pressure: "neutral",
      imbalance: 0.5,
      tradeImbalance: 0,
      aggressiveBuyShare: 0.5,
      cvd: 0,
      cvdNote: "PreStocks: no order book data available",
      largeTrades: [],
      whaleNote: "No whale feed for tokenized stocks",
      liquidityNote: "Liquidity data not available from PreStocks API",
      capability: {
        orderBook: "AVAILABLE",
        publicFills: "AVAILABLE",
        cvd: "WINDOW_ONLY",
        whaleFeed: "UNAVAILABLE",
        liquidationTape: "UNAVAILABLE",
        openInterest: "AVAILABLE",
        funding: "AVAILABLE"
      }
    },
    fundingRate: 0,
    catalyst: research.catalyst,
    correlation: {
      vsBtc: null,
      sample: 0,
      independent: true,
      note: "No correlation data for pre-IPO stocks"
    },
    psychology: {
      state: "neutral",
      score: 50,
      rationale: "Insufficient market data for psychology analysis"
    },
    session: session.session,
    quality: research.quality,
    sampleTrades: history.settled,
    historicalWinRate: history.settled >= 30 ? history.wins / history.settled : undefined,
  });

  const thesis = {
    direction: "NO_TRADE" as Vote,
    text: research.why.headline,
    invalidation: "Research-only mode - no trade thesis.",
  };

  const elders = await conveneElders({
    symbol: inst.symbol,
    mtf: {
      frames: [],
      agreement: 0,
      consensus: "NO_TRADE",
      confluence: 0,
      conflict: false
    },
    regime: {
      regime: "trending",
      volatility: "normal",
      atrPct: 0,
      chop: 0.5,
      rationale: "No historical data"
    },
    structure: {
      last: ticker.tokenPrice,
      swingHigh: ticker.markPrice * 1.1,
      swingLow: ticker.markPrice * 0.9,
      support: ticker.markPrice * 0.95,
      resistance: ticker.markPrice * 1.05,
      trend: "sideways",
      breakout: "none",
      rangePct: 0.1
    },
    technicals: {
      rsi: 50,
      emaStack: "mixed",
      macdHist: 0,
      volumeRatio: 1,
    },
    micro: {
      pressure: "neutral",
      spreadBps: 0,
      cvd: 0,
      imbalance: 0.5,
      blurb: "PreStocks data - no order book available",
    },
    catalyst: research.catalyst,
    why: research.why,
    confidence,
    session,
    thesis,
  } as any);

  const council = councilGate(elders);

  const risk = planRisk({
    instrument: {
      symbol: inst.symbol,
      category: "PRESTOCK",
      baseCoin: inst.symbol,
      quoteCoin: "USD",
      symbolType: "stock",
      isRwa: true,
      isReality: false,
      status: "active",
      type: "spot",
      minLeverage: 1,
      maxLeverage: 1,
      minOrderQty: inst.minOrderQty,
      minOrderAmount: 10,
      pricePrecision: inst.pricePrecision,
      quantityPrecision: inst.quantityPrecision,
      quantityMultiplier: 1,
      makerFeeRate: 0.001,
      takerFeeRate: 0.001,
      fundInterval: 0,
      buyLimitPriceRatio: 1.1,
      sellLimitPriceRatio: 0.9,
    },
    last: ticker.tokenPrice,
    vote: council.passed ? council.consensus : "NO_TRADE",
    equityUsd: account.equityUsd,
    technicals: {
      rsi: 50,
      emaStack: "mixed",
      macdHist: 0,
      volumeRatio: 1,
    } as any,
    structure: {
      last: ticker.tokenPrice,
      swingHigh: ticker.markPrice * 1.1,
      swingLow: ticker.markPrice * 0.9,
      support: ticker.markPrice * 0.95,
      resistance: ticker.markPrice * 1.05,
      trend: "sideways",
      breakout: "none",
      rangePct: 0.1
    },
    micro: {
      spread: 0,
      spreadBps: 0,
      mid: ticker.tokenPrice,
      bidDepth: 0,
      askDepth: 0,
      pressure: "neutral",
      imbalance: 0.5,
      tradeImbalance: 0,
      aggressiveBuyShare: 0.5,
      cvd: 0,
      cvdNote: "N/A",
      largeTrades: [],
      whaleNote: "N/A",
      liquidityNote: "N/A",
      capability: {
        orderBook: "AVAILABLE",
        publicFills: "AVAILABLE",
        cvd: "WINDOW_ONLY",
        whaleFeed: "UNAVAILABLE",
        liquidationTape: "UNAVAILABLE",
        openInterest: "AVAILABLE",
        funding: "AVAILABLE"
      }
    },
    regime: {
      regime: "trending",
      volatility: "normal",
      atrPct: 0,
      chop: 0.5,
      rationale: "No historical data"
    },
    calibrated: confidence.calibrated,
    fundingRate: 0,
    feeRate: 0.001,
    availableUsdt: account.availableUsdt,
  });

  const kill = evaluateKillSwitch({
    apiFailures: research.quality.failures.length,
    staleMarketMs: 0,
    spreadBps: 0,
    maxSpreadBps: policy.maxSpreadBps,
    maxStaleMs: policy.maxStaleMarketMs,
    atrShock: false,
    realizedLossUsd: realizedLossUsd(),
    lossLimitUsd: policy.killSwitchLossUsd,
    failedOrders: killState.failedOrders,
  });

  if (kill.tripped) tripKill(kill.reasons);

  const sessionPass = confidence.calibrated >= session.threshold;
  const researchOk = research.quality.freshSubstantive > 0;

  const gates = [
    gate("mode", mode === "research", `mode=${mode} (research only)`),
    gate("account", account.source === "solana" || account.source === "simulated", account.error || `source=${account.source}`),
    gate("research", researchOk, researchOk ? `${research.quality.freshSubstantive} fresh items` : "insufficient research"),
    gate("instrument", resolved.tradable, resolved.reason),
    gate("catalyst", true, `${research.catalyst.classification}: ${research.catalyst.rationale}`, false),
    gate("confidence", sessionPass, `calibrated ${(confidence.calibrated * 100).toFixed(1)}% vs ${(session.threshold * 100).toFixed(0)}%`),
    gate("council", council.passed, council.summary),
    gate("kill_switch", !kill.tripped && !killState.tripped, kill.reasons.join("; ") || killState.reasons.join("; ") || "clear"),
    gate("risk", risk.allowed, risk.reason),
    gate("execution", false, "Research mode - execution not available", true),
  ];

  const folded = foldGates(gates);
  const decision = folded.passed && council.consensus !== "NO_TRADE"
    ? `RECOMMEND ${council.consensus}`
    : "NO TRADE";
  const noTradeReason = folded.failed?.reason ?? (decision === "NO TRADE" ? council.summary : undefined);

  const payload: AnalaFullResult = {
    id: runId,
    at: nowIso(),
    durationMs: Date.now() - started,
    mode,
    session,
    resolved: {
      requested,
      resolved: true,
      instrument: inst,
      tradable: resolved.tradable,
      reason: resolved.reason,
    },
    market: {
      ticker,
      prestock: inst,
    },
    research,
    thesis,
    confidence,
    elders,
    council,
    risk,
    kill,
    gates,
    decision,
    noTradeReason,
    execution: null,
    account,
    openCount: 0,
    history: historyData,
    policy: {
      maxLeverage: policy.maxLeverage,
      quorum: policy.councilQuorum,
      sessionThresholds: policy.sessionConfidence,
    },
  };

  saveRun({
    id: runId,
    createdAt: payload.at,
    symbol: inst.symbol,
    mode,
    decision,
    calibrated: confidence.calibrated,
    payload: JSON.stringify(payload),
  });

  appendPaperLog({
    ts: payload.at,
    symbol: inst.symbol,
    decision,
    calibrated: confidence.calibrated,
    council: council.summary,
    orderId: null,
    submitted: false,
  });

  return payload;
}
