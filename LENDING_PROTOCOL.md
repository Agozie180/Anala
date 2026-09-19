# Anala Lending Protocol

## Overview

AI-powered lending protocol for PreStocks tokens on Solana.

## Architecture

### Smart Contract (Anchor Program)

**Core Functions:**
- `initialize_pool(token_mint)` - Create lending pool for a PreStocks token
- `deposit_collateral(amount)` - Deposit PreStocks tokens as collateral
- `borrow(amount)` - Borrow USDC against collateral (up to LTV limit)
- `repay(amount)` - Repay borrowed USDC
- `withdraw_collateral(amount)` - Withdraw collateral after repayment
- `update_ltv_ratio(new_ltv)` - Admin function to update LTV based on Anala risk score

### AI Risk Integration

**Anala calculates LTV ratio based on:**
1. **Company Health Score** (0-100)
   - SEC filing quality
   - Financial metrics
   - Revenue growth signals

2. **News Sentiment** (-1 to +1)
   - Recent news analysis
   - Catalyst detection
   - Risk events

3. **Market Health** (0-100)
   - Token premium/discount
   - Volatility
   - Liquidity

4. **Confidence Level** (0-100)
   - Multi-agent consensus
   - Data quality
   - Research completeness

**LTV Formula:**
```
base_ltv = 50%
risk_adjustment = (company_health * 0.3 + market_health * 0.2 + confidence * 0.3 + sentiment * 10) / 100
final_ltv = base_ltv + (risk_adjustment * 20%)

Example:
- Anthropic: Strong company (85), neutral sentiment (0), high confidence (75)
- LTV = 50% + ((85*0.3 + 50*0.2 + 75*0.3 + 0*10)/100 * 20%) = ~62%

- Risky company: Weak (40), negative news (-0.3), low confidence (45)
- LTV = 50% + ((40*0.3 + 50*0.2 + 45*0.3 - 3)/100 * 20%) = ~42%
```

### User Flow

1. **Research Phase**
   ```bash
   npm run research -- ANTHROPIC
   # Returns: Risk Score 85/100, Recommended LTV: 62%
   ```

2. **Deposit Collateral**
   - Connect Phantom/Solflare wallet
   - Deposit ANTHROPIC tokens (e.g., 10 tokens @ $1000 = $10,000)
   - Anala calculates max borrow: $10,000 * 62% = $6,200 USDC

3. **Borrow**
   - Borrow up to $6,200 USDC
   - Interest rate: 5% APY (simple for MVP)
   - No liquidations in MVP (manual monitoring)

4. **Repay & Withdraw**
   - Repay borrowed USDC + interest
   - Withdraw collateral

## Technical Stack

### Smart Contract
- **Framework:** Anchor
- **Language:** Rust
- **Network:** Devnet (for hackathon)

### Frontend Integration
- **Wallet:** @solana/wallet-adapter
- **RPC:** Solana web3.js
- **State:** React hooks

### Backend
- Anala risk engine (existing)
- LTV calculation service
- Position monitoring

## Deployment Plan

### Phase 1: Smart Contract (Day 1-2)
- [ ] Anchor program skeleton
- [ ] Core instructions (deposit, borrow, repay, withdraw)
- [ ] Testing on local validator
- [ ] Deploy to devnet

### Phase 2: Risk Engine Integration (Day 3)
- [ ] LTV calculation endpoint
- [ ] Connect Anala research to risk scoring
- [ ] Real-time company analysis
- [ ] Dynamic LTV updates

### Phase 3: Frontend (Day 4)
- [ ] Wallet connection
- [ ] Deposit/borrow UI
- [ ] Position dashboard
- [ ] Transaction confirmation

### Phase 4: Polish & Demo (Day 5)
- [ ] Bug fixes
- [ ] Demo video recording
- [ ] Documentation
- [ ] Submission

## Why This Wins

1. **Real DeFi Primitive** - Actual smart contracts, real capital efficiency
2. **PreStocks-Native** - Unique to these tokens
3. **AI-Powered** - First lending protocol with dynamic risk assessment
4. **Solana-Native** - Real on-chain transactions
5. **Unique Value** - Solves real problem (liquidity for pre-IPO holdings)
6. **Differentia** - No other submission will have this

## Risks & Mitigations

### Technical Risks
- **Smart contract bugs**: Use Anchor's safety features, keep logic simple
- **Oracle failure**: Manual price updates acceptable for hackathon
- **Liquidation logic**: Skip complex liquidations in MVP

### Execution Risks
- **Time constraint**: Focus on core value loop, cut non-essential features
- **Solana learning curve**: Use Anchor examples, keep it minimal

## Success Metrics

- [ ] Smart contract deployed to devnet
- [ ] At least 1 full deposit→borrow→repay cycle demonstrated
- [ ] LTV dynamically calculated by Anala
- [ ] Public frontend URL
- [ ] Demo video showing full flow
