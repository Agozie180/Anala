# Anala Lending - Deployment Guide

## Prerequisites

### 1. Install Solana CLI

```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version
```

### 2. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable
```

### 3. Install Anchor

```bash
# Install AVM (Anchor Version Manager)
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force

# Install latest Anchor
avm install latest
avm use latest
anchor --version
```

### 4. Create Solana Wallet

```bash
# Generate new keypair
solana-keygen new

# Or recover from seed phrase
solana-keygen recover

# Check wallet address
solana address

# Request devnet airdrop
solana airdrop 2 --url devnet
```

## Deployment Steps

### 1. Build Smart Contract

```bash
cd /path/to/Anala
anchor build
```

This compiles the Rust program and generates:
- `target/deploy/anala_lending.so` - Compiled program
- `target/deploy/anala_lending-keypair.json` - Program keypair
- `target/idl/anala_lending.json` - Interface definition

### 2. Get Program ID

```bash
solana-keygen pubkey target/deploy/anala_lending-keypair.json
```

Copy this program ID.

### 3. Update Program ID in Code

Edit `programs/anala-lending/src/lib.rs`:
```rust
declare_id!("YOUR_PROGRAM_ID_HERE");
```

Edit `Anchor.toml`:
```toml
[programs.devnet]
anala_lending = "YOUR_PROGRAM_ID_HERE"
```

### 4. Rebuild with Correct Program ID

```bash
anchor build
```

### 5. Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

Expected output:
```
Program Id: YOUR_PROGRAM_ID

Deploy success
```

### 6. Update Frontend Configuration

Create `.env.local`:
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_LENDING_PROGRAM_ID=YOUR_PROGRAM_ID_HERE
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

Update `src/lib/defi/client.ts`:
```typescript
const PROGRAM_ID = new PublicKey('YOUR_PROGRAM_ID_HERE');
```

### 7. Run Tests

```bash
anchor test --skip-local-validator
```

### 8. Initialize Lending Pools

For each PreStocks token, initialize a pool:

```bash
# ANTHROPIC (51.7% LTV, 5% APY)
tsx scripts/initialize-pool.ts <ANTHROPIC_MINT_ADDRESS> 5170 500

# OPENAI (47.5% LTV, 5% APY)
tsx scripts/initialize-pool.ts <OPENAI_MINT_ADDRESS> 4750 500

# SPACEX (45.8% LTV, 5% APY)
tsx scripts/initialize-pool.ts <SPACEX_MINT_ADDRESS> 4580 500
```

### 9. Build Frontend

```bash
npm run build
```

### 10. Deploy Frontend to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_LENDING_PROGRAM_ID`
- `NEXT_PUBLIC_SOLANA_NETWORK`
- `NEXT_PUBLIC_SOLANA_RPC_URL`

## Quick Deploy Script

For convenience, use the automated script:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

This script:
1. ✅ Checks prerequisites
2. ✅ Builds program
3. ✅ Deploys to devnet
4. ✅ Updates configuration files
5. ✅ Runs tests

## Verification

### Check Program Deployment

```bash
solana program show <PROGRAM_ID> --url devnet
```

### Check Pool Initialization

```bash
solana account <LENDING_POOL_ADDRESS> --url devnet
```

### Test Frontend Locally

```bash
npm run dev
```

Open http://localhost:3100/lend

## Troubleshooting

### Error: Insufficient SOL

```bash
solana airdrop 2 --url devnet
```

### Error: Program Failed to Deploy

Check program size:
```bash
ls -lh target/deploy/anala_lending.so
```

If > 100KB, enable BPF upgradeable loader:
```bash
solana program deploy target/deploy/anala_lending.so --url devnet --upgrade-authority ~/.config/solana/id.json
```

### Error: Account Not Found

The pool hasn't been initialized. Run:
```bash
tsx scripts/initialize-pool.ts <MINT> <LTV_BPS> <INTEREST_BPS>
```

### Error: Wallet Adapter Connection Failed

Check `.env.local` has correct RPC URL:
```
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

## Post-Deployment

### 1. Record Demo Video

Show:
- Wallet connection
- Token selection (ANTHROPIC/OPENAI/SPACEX)
- AI risk assessment displaying
- Deposit collateral transaction
- Borrow USDC transaction
- Position dashboard
- Repay transaction
- Withdraw collateral

### 2. Update Documentation

Add to README.md:
- Live demo URL
- Program ID on devnet
- Deployed pools (ANTHROPIC, OPENAI, SPACEX)
- Video demo link

### 3. Create Hackathon Submission

Include:
- **Project Name:** Anala - AI-Powered Lending for PreStocks
- **Live Demo:** https://anala.vercel.app/lend
- **GitHub:** https://github.com/Agozie180/Anala
- **Video:** [Link to demo video]
- **Program ID:** [Your deployed program ID]
- **Description:** First intelligent lending protocol where AI determines loan-to-value ratios in real-time

## Production Considerations (Post-Hackathon)

### Security Audit

- [ ] Smart contract audit by professional firm
- [ ] Penetration testing
- [ ] Bug bounty program

### Mainnet Deployment

- [ ] Deploy to mainnet-beta
- [ ] Use actual PreStocks token mints
- [ ] Set up monitoring and alerts
- [ ] Implement circuit breakers

### Advanced Features

- [ ] Automated liquidations
- [ ] Multiple collateral types
- [ ] Variable interest rates
- [ ] Governance token
- [ ] Insurance fund

## Support

For issues during deployment:
- Check Anchor docs: https://www.anchor-lang.com/
- Solana docs: https://docs.solana.com/
- GitHub issues: https://github.com/Agozie180/Anala/issues
