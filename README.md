# Anala

**AI-native trading intelligence for PreStocks tokenized pre-IPO stocks on Solana.**

> Research → Understand → Analyze → Reason → Debate → Risk-check → Recommend

Built for [STOCKLANA Hackathon](https://stocklana.com) — PreStocks bounty submission.

---

## What is Anala?

Anala brings institutional-grade AI analysis to PreStocks tokenized pre-IPO stocks. It's not a chatbot that prints BUY. It's a multi-agent research system that gathers evidence, debates perspectives, and provides transparent recommendations.

**Key features:**
- **PreStocks Discovery:** Automatic detection of all available tokenized stocks
- **Deep Research:** SEC filings, news aggregation, catalyst detection
- **Council of Seven:** Specialized AI agents debate each opportunity
- **Evidence-Based:** Every claim sourced and scored for reliability
- **Transparent:** Complete audit trail from data → analysis → decision
- **Risk-Aware:** Position sizing, confidence calibration, kill-switch protection

---

## Quick Start

```bash
npm install

# Discover all PreStocks tokens
npm run discover

# Research a specific token
npm run research -- ANTHROPIC

# Full analysis pipeline
npm run run -- OPENAI

# Start web dashboard
npm run dev
```

---

## PreStocks Integration

Anala uses the official PreStocks API to discover and analyze tokenized pre-IPO stocks:

```bash
npm run discover
```

**Example output:**
```
Found 8 PreStocks tokens:

┌─────────┬──────────────┬──────────────┬─────────────┬────────────┬──────────┬─────────────┬───────────┐
│ (index) │ Symbol       │ Company      │ Token Price │ Mark Price │ Premium  │ Valuation   │ Available │
├─────────┼──────────────┼──────────────┼─────────────┼────────────┼──────────┼─────────────┼───────────┤
│ 0       │ 'ANTHROPIC'  │ 'Anthropic'  │ '$1014.55'  │ '$1021.07' │ '-0.6%'  │ '$1662.18B' │ '✓'       │
│ 1       │ 'OPENAI'     │ 'OpenAI'     │ '$1123.84'  │ '$986.43'  │ '13.9%'  │ '$1392.36B' │ '✓'       │
│ 2       │ 'SPACEX'     │ 'SpaceX'     │ '$123.31'   │ '$154.15'  │ '-20.0%' │ '$1616.74B' │ '✓'       │
│ 3       │ 'NEURALINK'  │ 'Neuralink'  │ '$426.82'   │ '$329.35'  │ '29.6%'  │ '$81.31B'   │ '✓'       │
...
└─────────┴──────────────┴──────────────┴─────────────┴────────────┴──────────┴─────────────┴───────────┘
```

---

## Research Pipeline

```bash
npm run research -- ANTHROPIC
```

**What gets analyzed:**
1. **PreStocks Data:** Token price, valuation, premium
2. **SEC Filings:** Company information, recent filings
3. **News:** Headlines from multiple sources
4. **Catalyst Detection:** Known, possible, or no catalyst
5. **Evidence Scoring:** Relevance and reliability metrics

**Example output:**
```
=== PRESTOCK INFO ===
Company: Anthropic
Token Price: $1014.55
Premium: -0.6%
Implied Valuation: $1662.18B

=== RESEARCH ===
Catalyst: possible
Research Items: 16 total
Fresh substantive items: 4

Items include:
- PreStocks token pricing (100% relevance)
- SEC filings (if available)
- Recent news headlines (scored for relevance)
- Catalyst analysis
```

---

## Multi-Agent Analysis

Anala employs a Council of Seven specialized AI agents:

1. **Technical Analyst** — Price action and patterns
2. **Market Structure** — Support, resistance, key levels
3. **Microstructure** — Order flow and market internals
4. **Macro/Research** — Fundamentals and catalysts
5. **Causal/Catalyst** — Event-driven opportunities
6. **Risk Manager** — Position sizing and exposure
7. **Adversarial** — Actively seeks reasons NOT to trade

**Voting system:**
- Each elder votes: LONG, SHORT, or NO_TRADE
- Provides confidence score (0-100%)
- Explains their reasoning
- Default quorum: 4/7 votes required

**Example council output:**
```
=== COUNCIL OF SEVEN ===
Technical: 🟢 LONG (75%)
  "Price showing strength with increasing volume"

Market Structure: 🟢 LONG (68%)
  "Clean breakout above resistance"

Macro/Research: 🟢 LONG (80%)
  "Strong fundamentals, positive catalyst detected"

Adversarial: 🔴 SHORT (70%)
  "Premium too high, valuation concerns"

Council: 5/7 LONG, quorum passed
```

---

## Architecture

### Core Modules

```
src/lib/
├── prestocks/          # PreStocks API integration
├── solana/             # Solana RPC and wallet
├── research/           # SEC + news + catalyst detection
├── intelligence/       # Market analysis modules
├── confidence/         # Evidence-based scoring
├── council/            # Seven specialized agents
├── risk/               # Position sizing and limits
├── memory/             # Audit log and learning
└── orchestrator/       # Main decision pipeline
```

### Decision Pipeline

```
Discover PreStocks token
        ↓
Fetch token pricing
        ↓
Research (SEC + news + PreStocks)
        ↓
Market intelligence
        ↓
Thesis formation
        ↓
Confidence calibration
        ↓
Council of Seven debate
        ↓
Gates: data → research → catalyst → confidence → council → risk
        ↓
RECOMMEND or NO TRADE
```

### Honest Constraints

Anala operates in **research mode**:
- ✅ Real PreStocks data from official API
- ✅ Real SEC filings and news
- ✅ Multi-agent analysis and recommendations
- ✅ Evidence-based confidence scoring
- ⏸️ No live execution (derivatives infrastructure TBD)
- ⏸️ Simulated accounts for sizing calculations
- ⏸️ No historical price data (PreStocks API constraint)

**No fake data. Ever.** If something isn't available, we say so.

---

## Configuration

Copy `.env.example` to `.env`:

```bash
# Mode
ANALA_MODE=research          # research | paused

# Solana (optional for research mode)
SOLANA_RPC_URL=              # Custom RPC if needed
SOLANA_CLUSTER=mainnet-beta  # mainnet-beta | devnet
SOLANA_WALLET_ADDRESS=       # Your wallet (optional)

# PreStocks
PRESTOCKS_API_URL=https://prestocks.com/api/prestocks

# LLM (optional - uses deterministic elders if not set)
LLM_PROVIDER=openai          # openai | anthropic
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# News (optional)
FINNHUB_API_KEY=
NEWSAPI_KEY=

# Security
ANALA_ADMIN_TOKEN=           # Random string for admin endpoints
```

**Research mode works without any keys.** LLM keys only needed for live elder debates.

---

## API Endpoints

```bash
# Discover all PreStocks tokens
GET /api/instruments

# Research a token
GET /api/research?symbol=ANTHROPIC

# Full analysis
POST /api/run
Body: { "symbol": "OPENAI" }

# Asset overview
GET /api/assets
```

---

## Project Structure

```
anala/
├── src/
│   ├── app/              # Next.js web dashboard
│   ├── cli/              # Command-line tools
│   └── lib/              # Core intelligence
├── docs/
│   └── ARCHITECTURE.md   # System design
├── data/                 # SQLite database (auto-created)
├── .env.example          # Configuration template
├── HACKATHON.md          # STOCKLANA submission details
└── README.md
```

---

## Why PreStocks?

PreStocks democratizes access to pre-IPO investment opportunities by tokenizing them on Solana. Traditionally, investing in companies like Anthropic, OpenAI, or SpaceX before they go public is reserved for institutional investors and accredited individuals.

**Anala enhances the PreStocks ecosystem by:**
1. **Lowering barriers:** Makes sophisticated analysis accessible to everyone
2. **Increasing confidence:** Provides institutional-grade research
3. **Enhancing transparency:** Shows reasoning behind every recommendation
4. **Driving adoption:** Makes PreStocks tokens easier to evaluate
5. **Scalable:** Can analyze any PreStocks token automatically

---

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build

# Start production server
npm start
```

---

## Technology Stack

- **Runtime:** Node.js 22+
- **Language:** TypeScript
- **Framework:** Next.js 15
- **Database:** SQLite (better-sqlite3)
- **Blockchain:** Solana web3.js
- **LLM:** OpenAI / Anthropic (optional)
- **Testing:** Vitest

---

## Migration from AetherAI

Anala preserves the proven decision architecture from AetherAI (Bitget Hackathon S2) while creating a PreStocks-native experience:

**Preserved:**
- Council of Seven system
- Evidence-based confidence scoring
- Gate-based decision pipeline
- Risk management framework
- Memory and learning systems

**Adapted:**
- Bitget API → PreStocks API
- Futures contracts → Tokenized stocks
- Exchange execution → Research recommendations
- Market data → Available PreStocks data

See `STATUS.md` for detailed migration progress.

---

## STOCKLANA Hackathon

**Bounty:** Best Use of PreStocks ($10,000)  
**Deadline:** September 24, 2026  
**Submission:** Anala — AI-native intelligence for PreStocks

See `HACKATHON.md` for complete submission details.

---

## Honest Limitations

- Research mode only (no live trading)
- No historical price data from PreStocks API
- No order book or volume data available
- Derivatives infrastructure under investigation
- Simulated accounts until wallet integration complete

**We document limitations clearly rather than fabricating capabilities.**

---

## License

MIT — Built for STOCKLANA hackathon. Trading is risky. Research mode first.

---

## Contributing

This is a hackathon submission. Post-hackathon:
1. Complete Solana wallet integration
2. Research PreStocks derivative infrastructure
3. Add historical data aggregation
4. Enable live execution (when available)
5. Mobile interface
6. Community features

---

## Support

For questions about:
- **PreStocks:** https://prestocks.com
- **STOCKLANA:** https://stocklana.com
- **Anala:** See HACKATHON.md or open an issue

---

**Built with** ❤️ **for the PreStocks ecosystem**
