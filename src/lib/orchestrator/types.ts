/**
 * Anala orchestrator return types.
 * Separates early-exit from full analysis to enable proper TypeScript narrowing.
 */

import type {
  Mode,
  SessionId,
  GateResult,
  ConfidenceTrace,
  ElderVote
} from "../types";
import type { InstrumentResolution, PreStockInstrument } from "../prestocks/instruments";
import type { PreStockTicker } from "../prestocks/market";
import type { ResearchBundle } from "../research/prestocks-engine";
import type { CouncilResult } from "../council/gate";
import type { RiskPlan } from "../risk/engine";
import type { WalletAccount } from "../solana/account";

/**
 * Early exit when instrument cannot be resolved
 */
export interface AnalaEarlyExit {
  id: string;
  at: string;
  mode: Mode;
  session: {
    session: SessionId;
    utcHour: number;
    threshold: number;
    label: string;
    weekend: boolean;
  };
  resolved: InstrumentResolution;
  decision: "NO_TRADE";
  reason: string;
  gates: GateResult[];
}

/**
 * Full analysis result
 */
export interface AnalaFullResult {
  id: string;
  at: string;
  durationMs: number;
  mode: Mode;
  session: {
    session: SessionId;
    utcHour: number;
    threshold: number;
    label: string;
    weekend: boolean;
  };
  resolved: {
    requested: string;
    resolved: true;
    instrument: PreStockInstrument;
    tradable: boolean;
    reason: string;
  };
  market: {
    ticker: PreStockTicker;
    prestock: PreStockInstrument;
  };
  research: ResearchBundle;
  thesis: {
    direction: "LONG" | "SHORT" | "NO_TRADE";
    text: string;
    invalidation: string;
  };
  confidence: ConfidenceTrace;
  elders: ElderVote[];
  council: CouncilResult;
  risk: RiskPlan;
  kill: {
    tripped: boolean;
    reasons: string[];
  };
  gates: GateResult[];
  decision: string;
  noTradeReason?: string;
  execution: null;
  account: WalletAccount;
  openCount: number;
  history: {
    settled: number;
    wins: number;
    losses: number;
  };
  policy: {
    maxLeverage: number;
    quorum: number;
    sessionThresholds: Record<SessionId, number>;
  };
}

/**
 * Union of possible results
 */
export type AnalaResult = AnalaEarlyExit | AnalaFullResult;

/**
 * Type guard for full result
 */
export function isFullResult(result: AnalaResult): result is AnalaFullResult {
  return "durationMs" in result && "research" in result;
}

/**
 * Type guard for early exit
 */
export function isEarlyExit(result: AnalaResult): result is AnalaEarlyExit {
  return !("durationMs" in result);
}
