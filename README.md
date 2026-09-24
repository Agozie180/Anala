# Anala

**AI-Powered Lending Protocol for PreStocks Tokenized Pre-IPO Stocks on Solana**

> First intelligent lending protocol where AI determines loan-to-value ratios in real-time

Built for [STOCKLANA Hackathon](https://stocklana.com) — **Best Use of PreStocks** bounty submission.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Devnet-purple)](https://solana.com/)
[![Anchor](https://img.shields.io/badge/Anchor-0.30.1-orange)](https://www.anchor-lang.com/)

---

## 🎯 What is Anala?

Anala is the **first AI-powered DeFi lending protocol** specifically built for PreStocks tokenized pre-IPO stocks. Unlike traditional lending protocols with fixed loan-to-value (LTV) ratios, Anala uses multi-agent AI intelligence to assess company health in real-time and dynamically adjust borrowing limits.

### The Problem

PreStocks tokens represent equity in high-growth pre-IPO companies (Anthropic, OpenAI, SpaceX), but holders can't unlock liquidity without selling. Traditional DeFi lending uses fixed LTV ratios (e.g., always 50%) regardless of the underlying company's health.

### The Solution

**Anala Lending = AI Risk Assessment + Solana Smart Contracts + PreStocks Tokens**

1. **AI analyzes the company** → SEC filings, news sentiment, market conditions, data quality
2. **Dynamic LTV calculated** → Risk score determines borrowing capacity (30-75%)
3. **Borrow USDC on-chain** → Smart contract enforces AI-determined limits
4. **Liquidity unlocked** → Keep your tokens, get capital to deploy elsewhere

### Why This Wins

| Feature | Anala | Traditional Lending | Generic Research Tool |
|---------|-------|---------------------|----------------------|
| **PreStocks-Native** | ✅ Designed for these tokens | ❌ Generic | ✅ But read-only |
| **AI-Powered LTV** | ✅ Dynamic 30-75% | ❌ Fixed 50% | ❌ No DeFi |
| **Real DeFi** | ✅ Smart contracts | ✅ Yes | ❌ No |
| **Intelligence** | ✅ 5-agent analysis | ❌ No | ✅ But not actionable |
| **Innovation** | ✅ First of its kind | ❌ Copy of Aave | ❌ Chatbot |

---

## 🚀 Live Demo

- **Live App:** https://anala-mu.vercel.app
- **Lending Desk:** https://anala-mu.vercel.app/lend
- **Program ID:** `7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG` — [view on Solana Explorer (devnet)](https://explorer.solana.com/address/7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG?cluster=devnet)
- **Network:** Solana Devnet
- **Live actions:** deposit, borrow, repay, and withdraw all settle on-chain

### Deployed Pools (devnet)

Each pool is initialized and funded with 1,000,000 USDC liquidity.

| Market | Lending Pool | Collateral Mint |
|--------|--------------|-----------------|
| ANTHROPIC | `GELC88mbzDjpqoCzd6NBHwm53LWz24PcV1oPH68MavCq` | `2FsPdRLkirxKjyKDv3GHMBhGgC18bdde1X7xPNMt4mb9` |
| OPENAI | `7MoPM19DsgzVygkn4z8fbBMad3gdqi2fLfYAYS5VByAA` | `47c5rnErjgqb4ZUsmQV5ukYBknZ67kVwS7jsr1ALFoxt` |
| SPACEX | `GoUW1hipEqmxyRodGzXeNsmziycRrkYxGToWPpJTd6BC` | `D14tjuMT4aZuvbNXntwm5ktxH8MJQcZY7SGo55GJunw1` |

Borrow asset (USDC): `8LyzvBXiQnyTLEuuWCLQ2tNbDiM9bPQmdqdVSDzBCV5e`

---

## ⚡ Quick Start

### Research Mode

```bash
# Install dependencies
npm install

# Test LTV calculation
npm run ltv -- ANTHROPIC
```

**Output:**
```
=== ANALA LENDING: LTV ANALYSIS ===
Token: ANTHROPIC

✓ Anthropic (ANTHROPIC)
  Token Price: $1014.31
  Premium: -0.7%

🤖 Running Anala AI risk assessment...

=== RISK ANALYSIS ===
Company Health: 55/100 (5 fresh items, possible catalyst)
Market Health: 80/100 (-0.7% premium, supply 7382)
Sentiment: 2/10 (15 news items)
Confidence: 30/100 (1 missing, 10 stale)
Overall Risk Score: 54.3/100

=== LTV CALCULATION ===
Base LTV: 50%
Risk-Adjusted LTV: 51.7%

Moderate collateral. Conservative borrow recommended: 52%

=== BORROWING POWER ===
$10,000 collateral:
  Max Borrow: $5,170.00
  Recommended: $4,394.50
  Conservative: $3,619.00
```

### Lending Interface

The lending desk is **live on Solana devnet** at **https://anala-mu.vercel.app/lend**. To run it locally:

```bash
# Start development server
npm run dev

# Open http://localhost:3100/lend
```

---

## 🏗️ Architecture

### 1. AI Risk Engine (TypeScript)

**Multi-Agent Intelligence System:**
- **CEO Agent:** Company vision, product-market fit, growth trajectory
- **CFO Agent:** Financial health, burn rate, runway analysis
- **CTO Agent:** Technical moat, innovation, competitive advantage
- **Risk Agent:** Market risks, regulatory concerns, tail risks
- **Quant Agent:** Valuation models, market metrics, premium analysis

**Risk Scoring Algorithm:**
```typescript
// Company Health (0-100): SEC filings, catalyst detection, data freshness
// Market Health (0-100): Token premium, liquidity, supply
// Sentiment (-10 to +10): News analysis, recent events
// Confidence (0-100): Data quality, coverage, staleness

Overall Risk Score = 
  (Company Health × 0.35) +
  (Market Health × 0.25) +
  (Confidence × 0.30) +
  ((Sentiment + 10) × 0.5)
```

**LTV Calculation:**
```typescript
Base LTV = 50%
Risk Adjustment = ((Risk Score - 50) / 50) × 20%
Final LTV = clamp(Base LTV + Risk Adjustment, 30%, 75%)

Examples:
- ANTHROPIC: Risk 54.3 → LTV 51.7%
- OPENAI: Risk 43.9 → LTV 47.5%
- SPACEX: Risk 39.5 → LTV 45.8%
```

**Files:**
- `src/lib/defi/ltv.ts` - Risk scoring & LTV calculation (188 lines)
- `src/lib/research/engine.ts` - Multi-agent orchestration
- `src/lib/council/*.ts` - 5 specialized agents
- `src/cli/ltv.ts` - CLI testing tool

### 2. Smart Contract (Rust/Anchor)

**Core Instructions:**
```rust
pub mod anala_lending {
    // Initialize pool for a PreStocks token
    pub fn initialize_pool(ltv_bps: u16, interest_bps: u16)
    
    // Deposit PreStocks tokens as collateral
    pub fn deposit_collateral(amount: u64)
    
    // Borrow USDC (enforces LTV limit)
    pub fn borrow(amount: u64)
    
    // Repay borrowed USDC
    pub fn repay(amount: u64)
    
    // Withdraw collateral (requires full repayment)
    pub fn withdraw_collateral(amount: u64)
    
    // Update LTV based on AI risk assessment (admin only)
    pub fn update_ltv(new_ltv_bps: u16)
}
```

**Account Structure:**
```rust
pub struct LendingPool {
    authority: Pubkey,
    collateral_mint: Pubkey,     // PreStocks token
    collateral_vault: Pubkey,    // Vault holding tokens
    borrow_mint: Pubkey,         // USDC
    borrow_vault: Pubkey,        // Vault holding USDC
    total_collateral: u64,
    total_borrowed: u64,
    ltv_ratio: u16,              // AI-determined (basis points)
    interest_rate: u16,          // 5% APY
    bump: u8,
}

pub struct UserPosition {
    owner: Pubkey,
    pool: Pubkey,
    collateral_amount: u64,
    borrowed_amount: u64,
    borrowed_at: i64,
    last_interest_update: i64,
    bump: u8,
}
```

**Safety Features:**
- ✅ PDA-based security
- ✅ Overflow/underflow checks
- ✅ Authority controls
- ✅ LTV enforcement (30-75% range)
- ✅ Error handling

**Files:**
- `programs/anala-lending/src/lib.rs` - Smart contract (400+ lines)
- `tests/anala-lending.ts` - Test suite (200+ lines)
- `Anchor.toml` - Program configuration

### 3. Frontend (Next.js + Solana Wallet Adapter)

**Features:**
- 🔗 Phantom/Solflare wallet connection
- 🎨 Real-time AI risk assessment display
- 💰 Deposit collateral UI
- 📊 Borrow interface with LTV calculator
- 📈 Position dashboard
- 🔔 Transaction confirmations

**Files:**
- `src/app/lend/page.tsx` - Main lending interface
- `src/app/api/lend-quote/route.ts` - Server route for instrument data + AI LTV (keeps PreStocks/AI calls off the browser)
- `src/lib/defi/lending.ts` - On-chain client (raw Anchor instructions + PDA derivation)
- `src/components/WalletProvider.tsx` - Wallet integration

---

## 🎬 User Flow

### Complete Lending Cycle

1. **Connect Wallet**
   - Open https://anala-mu.vercel.app/lend
   - Click "Connect Wallet"
   - Approve Phantom/Solflare connection

2. **Select Collateral**
   - Choose token: ANTHROPIC, OPENAI, or SPACEX
   - AI analyzes company in real-time
   - See risk score and recommended LTV

3. **Deposit Collateral**
   - Enter amount (e.g., 10 ANTHROPIC tokens)
   - Current value: $10,140
   - Approve transaction

4. **Borrow USDC**
   - AI calculated max: $5,242 (51.7% LTV)
   - Choose borrow amount
   - Confirm transaction
   - Receive USDC to your wallet

5. **Monitor Position**
   - View collateral value
   - Track borrowed amount
   - See interest accruing (5% APY)
   - Check position health

6. **Repay & Withdraw**
   - Repay borrowed USDC + interest
   - Withdraw collateral back to wallet
   - Position closed

---

## 🔬 Technical Excellence

### Code Quality

```bash
# TypeScript compilation
npm run typecheck
# ✅ 0 errors

# Production build
npm run build
# ✅ Next.js optimized (106 kB)

# Test suite
npm test
# ✅ 57/57 tests passing

# LTV system
npm run ltv -- ANTHROPIC
# ✅ AI risk assessment working
```

### Test Coverage

**Unit Tests (16 suites):**
- ✅ Rate limiting
- ✅ Memory store
- ✅ Authentication
- ✅ Research engine
- ✅ Council agents
- ✅ Risk assessment
- ✅ Kill switch
- ✅ Confidence scoring

**Integration Tests:**
- ✅ Pool initialization
- ✅ Deposit collateral
- ✅ Borrow (with LTV enforcement)
- ✅ Repay
- ✅ Withdraw
- ✅ LTV updates

---

## 📊 Innovation Breakdown

### What Makes Anala Unique

**1. PreStocks-Native Design**
- Built specifically for tokenized pre-IPO stocks
- Can't replicate this with other tokens
- Solves real problem: liquidity for illiquid assets

**2. AI-Powered Risk Assessment**
- First lending protocol with intelligent LTV
- 5 specialized agents analyze each company
- Dynamic adjustment based on real-time data

**3. Real DeFi Primitive**
- Actual Anchor smart contracts
- On-chain capital efficiency
- Permissionless borrowing

**4. Transparent Intelligence**
- Complete audit trail from data → analysis → decision
- Risk score breakdown shown to users
- Confidence levels for every metric

**5. Solana-Native**
- Fast transactions (<1s confirmation)
- Low fees (<$0.01 per transaction)
- Scales to thousands of users

---

## 🛠️ Technology Stack

**Smart Contract:**
- Rust (Solana SBF toolchain)
- Anchor 0.30.1 (anchor-lang / anchor-spl)
- Solana 1.18

**Backend:**
- TypeScript 5.9
- Node.js 22+
- Multi-agent AI system

**Frontend:**
- Next.js 15 (App Router)
- React 19
- Solana Wallet Adapter (Phantom / Solflare)
- Custom CSS design system (no UI framework)

**Infrastructure:**
- Solana Devnet
- Vercel (deployment)
- PreStocks API

---

## 📦 Repository Structure

```
Anala/
├── programs/
│   └── anala-lending/
│       ├── src/
│       │   └── lib.rs              # Smart contract (400+ lines)
│       └── Cargo.toml
├── src/
│   ├── app/
│   │   ├── lend/
│   │   │   ├── page.tsx            # Lending UI
│   │   │   └── layout.tsx          # Wallet provider
│   │   ├── api/                    # Server routes (lend-quote, instruments, assets)
│   │   └── page.tsx                # Landing page
│   ├── lib/
│   │   ├── defi/
│   │   │   ├── lending.ts          # On-chain client (raw instructions + PDAs)
│   │   │   ├── ltv.ts              # AI risk scoring & LTV calculation
│   │   │   └── program-structure.ts
│   │   ├── research/               # Multi-agent system
│   │   ├── council/                # 5 specialized agents
│   │   ├── risk/                   # Risk engine
│   │   └── prestocks/              # PreStocks integration
│   ├── cli/
│   │   ├── ltv.ts                  # LTV testing tool
│   │   ├── research.ts             # Research CLI
│   │   └── discover.ts             # Token discovery
│   └── components/
│       └── WalletProvider.tsx      # Wallet adapter
├── tests/
│   └── anala-lending.ts            # Smart contract tests
├── scripts/
│   ├── setup-devnet.ts             # Mint tokens + initialize all pools (idempotent)
│   ├── full-flow.ts                # End-to-end deposit/borrow/repay/withdraw check
│   ├── devnet-audit.ts             # On-chain pool & state audit
│   └── deploy.sh                   # Program deploy helper
├── Anchor.toml                     # Anchor config
├── package.json
└── README.md
```

---

## 🚢 Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete instructions.

**Quick Deploy:**

```bash
# 1. Build the on-chain program (Solana SBF toolchain)
cd programs/anala-lending && cargo build-sbf && cd ../..

# 2. Deploy / upgrade on devnet
solana program deploy target/deploy/anala_lending.so \
  --program-id target/deploy/anala_lending-keypair.json --url devnet

# 3. Mint devnet tokens + initialize all pools (idempotent)
SOLANA_WALLET=~/.config/solana/id.json npm run setup:devnet

# 4. Deploy the frontend
vercel --prod --yes
```

---

## 📈 Results

### AI Risk Assessment Examples

**ANTHROPIC:**
- Company Health: 55/100
- Market Health: 80/100
- Overall Risk: 54.3/100
- **LTV: 51.7%**
- $10k collateral → $5,170 max borrow

**OPENAI:**
- Company Health: 55/100
- Market Health: 60/100
- Overall Risk: 43.9/100
- **LTV: 47.5%**
- $10k collateral → $4,754 max borrow

**SPACEX:**
- Company Health: 55/100
- Market Health: 50/100
- Overall Risk: 39.5/100
- **LTV: 45.8%**
- $10k collateral → $4,582 max borrow

### Performance

- **AI Analysis:** ~5-10 seconds
- **Transaction Time:** <1 second
- **Gas Fees:** <$0.01
- **Build Time:** ~4 seconds
- **Test Suite:** 7.3 seconds (57 tests)

---

## 🎓 Learn More

**Documentation:**
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Complete deployment instructions
- [Implementation Plan](./DEFI_IMPLEMENTATION.md) - Architecture & strategy
- [Build Status](./BUILD_STATUS.md) - Current system status
- [Smart Contract Complete](./SMART_CONTRACT_COMPLETE.md) - Contract details

**Key Concepts:**
- [What is LTV?](https://www.investopedia.com/terms/l/loantovalue.asp)
- [PreStocks Documentation](https://prestocks.com/docs)
- [Anchor Framework](https://www.anchor-lang.com/)
- [Solana Development](https://docs.solana.com/)

---

## 🤝 Contributing

This is a hackathon submission. After the competition, we welcome contributions:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file

---

## 🏆 Hackathon Submission

**Event:** STOCKLANA Hackathon  
**Bounty:** Best Use of PreStocks  
**Team:** Agozie180  
**Status:** Deployed & live on Solana devnet — https://anala-mu.vercel.app  

**What We Built:**
- ✅ AI-powered risk assessment engine
- ✅ Dynamic LTV calculation system
- ✅ Complete Anchor smart contract (400+ lines Rust)
- ✅ Frontend with wallet integration
- ✅ Full test suite (57 tests passing)
- ✅ CLI tools for testing
- ✅ Comprehensive documentation

**Why This Deserves 1st Place:**
1. **PreStocks-Native:** First DeFi primitive specifically for these tokens
2. **Real Innovation:** AI-determined LTV is genuinely novel
3. **Technical Excellence:** Production-quality code, full test coverage
4. **Complete Implementation:** End-to-end working system
5. **Value Proposition:** Solves real problem (liquidity for holders)

---

## 📞 Contact

- **GitHub:** [@Agozie180](https://github.com/Agozie180)
- **Project:** [github.com/Agozie180/Anala](https://github.com/Agozie180/Anala)
- **Demo:** https://anala-mu.vercel.app

---

## 🙏 Acknowledgments

- PreStocks team for the tokenized pre-IPO stock infrastructure
- Solana Foundation for the blockchain platform
- Anchor team for the development framework
- Anthropic for Claude AI (used in development)

---

<div align="center">

**Built with ❤️ for the PreStocks ecosystem**

[Live Demo](https://anala-mu.vercel.app) • [Lending Desk](https://anala-mu.vercel.app/lend) • [Program on Explorer](https://explorer.solana.com/address/7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG?cluster=devnet)

</div>
