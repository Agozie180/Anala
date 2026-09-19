# AetherAI → Anala Migration Map

**Created:** 2026-09-19  
**Source:** AetherAI (Bitget AI Hackathon S2)  
**Target:** Anala (STOCKLANA PreStocks bounty)

## Migration Strategy

This document tracks the systematic transformation of AetherAI (Bitget trading agent) into Anala (Solana + PreStocks trading agent).

## Research Findings

### PreStocks API
- **Base URL:** prestocks.com/api/prestocks
- **Available tokens:** ANTHROPIC, OPENAI, SPACEX, and others
- **Token fields:** name, symbol, description, image, contract_address, markPrice, markValuation, tokenPrice, impliedValuation, supply
- **Contract addresses:** Start with "Pre" prefix
- **No authentication visible** in public endpoints

### STOCKLANA Hackathon
- **Event:** September 11-18, 2026 (COMPLETED - already passed)
- **Prize pool:** $100K+ total
- **PreStocks bounty:** $10,000 (largest individual bounty)
- **Focus:** Build innovative applications using PreStocks tokenized pre-IPO stocks on Solana
- **Warning:** Projects must use PreStocks tokens specifically; other pre-IPO tokens are ineligible

### Hackathon Status
⚠️ **CRITICAL:** The STOCKLANA hackathon ended on September 18, 2026. Today is September 19, 2026.
This migration is being documented but the hackathon deadline has passed.

## Component Classification

### ✅ KEEP (Reusable Architecture)

| Component | Path | Reason |
|-----------|------|--------|
| Agent orchestration | `src/lib/orchestrator/` | Core decision flow is exchange-agnostic |
| Research engine | `src/lib/research/engine.ts` | Structure works for any asset research |
| Confidence calculation | `src/lib/confidence/` | Mathematical framework is reusable |
| Council of Elders | `src/lib/council/` | Decision architecture is exchange-agnostic |
| Risk management | `src/lib/risk/` | Size/leverage/EV logic applies universally |
| Intelligence modules | `src/lib/intelligence/` | MTF, regime, structure analysis reusable |
| Memory system | `src/lib/memory/` | Storage and review patterns work anywhere |
| Session gating | `src/lib/session.ts` | Time-based logic is universal |
| Policy engine | `src/lib/policy.ts` | Configuration pattern is reusable |
| Frontend UI | `src/app/` | Dashboard structure adaptable |
| Database layer | `src/lib/memory/store.ts` | SQLite persistence works anywhere |
| Monitoring | `src/lib/monitor/` | Position tracking is universal |
| CLI tools | `src/cli/` | Command patterns are reusable |

### 🔄 REPLACE (Bitget-Specific Implementation)

| Component | Current | Replacement Needed |
|-----------|---------|-------------------|
| Market data | `src/lib/bitget/market.ts` | Solana market data for PreStocks |
| Exchange client | `src/lib/bitget/client.ts` | Solana RPC + PreStocks API client |
| Instrument discovery | `src/lib/bitget/instruments.ts` | PreStocks product discovery |
| Account management | `src/lib/bitget/account.ts` | Solana wallet integration |
| Order execution | `src/lib/execution/` | Solana transaction execution |
| Authentication | `src/lib/auth.ts` | Solana wallet auth if needed |
| Research sources | SEC/news integration | PreStocks metadata + company research |
| Symbol types | Stock perps on Bitget | Tokenized pre-IPO stocks |

### ❌ REMOVE (Bitget-Only)

- Bitget API URLs and endpoints
- Bitget authentication (API keys, HMAC signing)
- Bitget-specific environment variables
- Bitget Demo/paper trading mode references
- UTA v3 client code
- Bitget branding in UI
- Bitget-specific documentation
- HACKATHON_MAPPING.md (Bitget hackathon specific)
- References to Bitget stock perpetuals
- Bitget futures terminology

### 🆕 CREATE (New for Anala)

| Component | Description | Priority |
|-----------|-------------|----------|
| Solana integration | RPC client, transaction building | HIGH |
| PreStocks API client | Product discovery, pricing, metadata | HIGH |
| Token data layer | Fetch/cache PreStocks token information | HIGH |
| Wallet integration | Phantom/Solflare support if needed | MEDIUM |
| Derivatives research | Investigate Solana perp protocols | HIGH |
| Market data adapter | Price feeds for PreStocks tokens | HIGH |
| Anala branding | UI rebrand, logo, identity | MEDIUM |
| Documentation | New README, architecture docs | HIGH |

## Bitget Dependencies Audit

**Total Bitget references found:** 87 occurrences

### Files requiring modification:
- All files in `src/lib/bitget/`
- `src/lib/orchestrator/run.ts`
- `src/lib/execution/`
- `src/lib/research/engine.ts`
- `src/app/` (UI references)
- `README.md`
- `HACKATHON_MAPPING.md` (remove or replace)
- `docs/ARCHITECTURE.md`
- `.env.example`
- `package.json`

## Migration Phases

### Phase 1: Foundation ✅
- [x] Clone complete AetherAI codebase
- [x] Create Anala repository
- [x] Research PreStocks API
- [x] Research STOCKLANA requirements
- [x] Create migration map
- [x] Initial git commit

### Phase 2: Solana Integration (NEXT)
- [ ] Create Solana RPC client
- [ ] Add @solana/web3.js dependency
- [ ] Implement basic wallet connection
- [ ] Test Solana mainnet connection

### Phase 3: PreStocks Integration
- [ ] Create PreStocks API client
- [ ] Implement token discovery
- [ ] Fetch and parse token metadata
- [ ] Cache token data layer
- [ ] Map to internal types

### Phase 4: Bitget Removal
- [ ] Remove src/lib/bitget/ entirely
- [ ] Update orchestrator to use new clients
- [ ] Remove Bitget env vars
- [ ] Remove Bitget tests
- [ ] Search and eliminate remaining references

### Phase 5: Market Data
- [ ] Implement PreStocks price feeds
- [ ] Add Solana market data where available
- [ ] Research derivative/perp options
- [ ] Adapt intelligence modules to new data

### Phase 6: Research Adaptation
- [ ] Adapt research engine for PreStocks
- [ ] Keep SEC integration (company research)
- [ ] Keep news integration
- [ ] Add PreStocks-specific metadata

### Phase 7: Execution Layer
- [ ] Determine realistic execution capabilities
- [ ] Implement Solana transaction building if applicable
- [ ] Add safety checks for Solana
- [ ] Document limitations clearly

### Phase 8: UI Rebrand
- [ ] Remove AetherAI/Bitget branding
- [ ] Rename to Anala throughout
- [ ] Update terminology for PreStocks
- [ ] Adapt dashboard for Solana data

### Phase 9: Testing
- [ ] Run full test suite
- [ ] Fix broken tests
- [ ] Add new tests for Solana/PreStocks
- [ ] Integration testing

### Phase 10: Documentation
- [ ] New README
- [ ] Architecture documentation
- [ ] Setup instructions
- [ ] Demo guide
- [ ] Limitations disclosure

### Phase 11: Final Audit
- [ ] Search for remaining Bitget references
- [ ] Verify all integrations work
- [ ] Check data integrity
- [ ] Build production bundle
- [ ] Deployment preparation

## Key Decisions

### Derivatives/Perps Strategy
**Status:** TO BE DETERMINED

Need to research:
- Does a Solana perp protocol support PreStocks as underlying?
- Is there a legitimate DeFi primitive for PreStocks derivatives?
- What is actually available vs theoretical?

**Do NOT fabricate perp functionality if it doesn't exist.**

### Execution Model
**Status:** TO BE DETERMINED

Options:
1. Full execution with Solana transactions (if perps exist)
2. Research/analysis only (if direct trading unavailable)
3. Hybrid (spot only, no leverage)

Must align with actual infrastructure availability.

### Data Sources
**Confirmed:**
- PreStocks API for token data ✅
- SEC EDGAR for company research ✅
- News RSS for headlines ✅

**Unknown:**
- Real-time PreStocks price feeds
- Historical price data for technical analysis
- Order book / volume data
- Funding rates (if perps exist)

## Preserved Engineering Value

AetherAI contains substantial completed work that must be preserved:

1. **Decision Architecture:** The orchestrator's gate-based flow is excellent
2. **Research Structure:** Sourced, timestamped, relevance-scored items
3. **Confidence System:** Mathematical evidence aggregation
4. **Elder Council:** Adversarial debate architecture
5. **Risk Engine:** Position sizing, leverage caps, kill switch
6. **Intelligence Modules:** MTF, regime, structure detection
7. **Memory System:** Trade reviews, similar setups, learning
8. **Frontend:** Dashboard, visualizations, state management

These represent weeks of thoughtful engineering and should be adapted, not rewritten.

## Critical Constraints

1. **No fake integrations** - Only implement what actually exists
2. **No fabricated data** - Every displayed value must have a real source
3. **Honest limitations** - Document what cannot be implemented
4. **PreStocks only** - Per bounty rules, no other pre-IPO tokens
5. **Data integrity** - Never fake prices, trades, or transaction signatures
6. **Hackathon compliance** - Must meet STOCKLANA requirements

## Next Actions

1. ✅ Complete codebase copy
2. ✅ Create migration documentation
3. ⏭️ Install Solana dependencies
4. ⏭️ Create Solana/PreStocks client modules
5. ⏭️ Begin systematic Bitget removal
6. ⏭️ Research derivative availability
7. ⏭️ Adapt intelligence modules
8. ⏭️ Rebrand UI
9. ⏭️ Test end-to-end
10. ⏭️ Document final product

---

**Status:** Foundation phase complete. Ready for Solana integration.
