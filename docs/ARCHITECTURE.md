# Anala Architecture

## Principle

LLM reasons. Evidence scores. Policy gates. PreStocks informs. Memory records.

If a capability doesn't exist on PreStocks or Solana, the system says so. It never invents data or pretends functionality exists.

## Runtime modes

| Mode | Meaning |
| --- | --- |
| `research` | Default. Analysis and recommendations only. No live execution. |
| `paused` | Observe only. No analysis runs. |

The UI shows the current mode clearly. Research mode provides genuine analysis without pretending to execute trades.

## Pipeline

```
Discover PreStocks instrument
        ↓
Fetch token pricing (PreStocks API)
        ↓
Research (SEC + news + PreStocks metadata)
        ↓
Market intelligence (adapted for available data)
        ↓
Thesis draft
        ↓
Confidence → calibration trace
        ↓
Council of Seven Elders (structured JSON votes)
        ↓
Gates: data → research → catalyst → confidence
      → session → council → risk → execution
        ↓
RECOMMEND or NO TRADE
        ↓
Memory stores analysis
```

## Modules

| Path | Responsibility | LLM? |
| --- | --- | --- |
| `src/lib/policy.ts` | Session thresholds, quorum, leverage cap | No |
| `src/lib/prestocks/*` | PreStocks API client, instruments, market data | No |
| `src/lib/solana/*` | Solana RPC, wallet (simulated until integration) | No |
| `src/lib/research/*` | SEC, news, PreStocks metadata, catalysts | Optional |
| `src/lib/intelligence/*` | Analysis modules (where data available) | No |
| `src/lib/confidence/*` | Evidence-weighted scoring | No |
| `src/lib/council/*` | Seven distinct elders | Yes, with deterministic fallback |
| `src/lib/risk/*` | Size, leverage, EV | No |
| `src/lib/memory/*` | Audit log, similar setups, reviews | Optional |
| `src/lib/orchestrator/*` | Run pipeline | Coordinates |

## Data sources

| Source | What | Auth |
| --- | --- | --- |
| PreStocks API | Token prices, valuations, supply, metadata | Public |
| SEC company tickers + submissions | Company, filings 10-K/10-Q/8-K | Public, User-Agent required |
| Google News RSS | Headlines with publisher + time | Public |
| Finnhub / NewsAPI | Optional if keys set | Optional |
| OpenAI / Anthropic | Elder debate, NL grounded in run state | `LLM_PROVIDER` + key |

Missing critical data → **NO TRADE**, never fabricated.

## Elders

1. Technical (adapted for available data)
2. Market Structure
3. Microstructure
4. Macro / Research
5. Causal / Catalyst
6. Risk
7. Adversarial (must try to disprove)

Votes: `LONG` | `SHORT` | `NO_TRADE`. Default quorum 4/7.

## Confidence

Not an LLM number. Evidence-weighted with visible penalties:

```
raw = weighted evidence (available data points)
calibrated = raw + completeness + conflict + session + sample-size penalties
```

Every adjustment is stored and shown.

## Research mode

Anala operates in research mode: it analyzes PreStocks tokens and provides recommendations, but does not execute trades. This reflects the current state of PreStocks derivative infrastructure on Solana.

When genuine execution capabilities become available, the execution layer can be enabled.

## Execution contract (future)

Before any order:

1. Verify derivatives infrastructure exists
2. Instrument is valid PreStocks token
3. Account/wallet valid
4. Size, spread, freshness checks
5. Submit only if all gates pass
6. Persist real transaction signature **or** label **SIMULATED**

## Persistence

`data/aether.db` (Node `node:sqlite`, WAL mode) and `data/paper-log.jsonl`.

Each run stored in `runs.payload` and normalized into:
- `runs`
- `research_items`
- `elder_votes`
- `gates`

Operational state:
- `positions` (future)
- `settled` (future)
- `reviews`
- `events`
- `killswitch`

## PreStocks limitations

**What PreStocks provides:**
- Current token prices
- Mark prices
- Implied valuations
- Supply
- Token metadata

**What PreStocks doesn't provide:**
- Historical price data
- Order book
- Volume data
- Funding rates
- Derivatives contracts

Anala works with what's available and is honest about limitations.

## Honest constraints

- No historical candles → No traditional technical analysis
- No order book → No microstructure analysis
- No derivatives → Research mode only until infrastructure exists
- No fabricated data → Every value has a real source

## Migration from AetherAI

Preserved:
- Decision architecture
- Research pipeline structure
- Confidence calculation framework
- Council system
- Risk management logic
- Memory and review patterns

Replaced:
- Bitget API → PreStocks API
- Futures contracts → Tokenized pre-IPO stocks
- Exchange data → Available PreStocks data
- Execution → Research recommendations

Adapted:
- Intelligence modules work with available data
- Gates reflect actual capabilities
- Confidence uses available evidence
