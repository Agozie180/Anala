#!/bin/bash
# Anala Lending - Complete Deployment Script

set -e

echo "========================================="
echo "Anala Lending - Deployment Script"
echo "========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not installed"
    echo "Install: sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\""
    exit 1
fi

if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor CLI not installed"
    echo "Install: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force"
    echo "Then: avm install latest && avm use latest"
    exit 1
fi

echo "✅ Prerequisites installed"
echo ""

# Set Solana to devnet
echo "Configuring Solana CLI for devnet..."
solana config set --url devnet
echo "✅ Connected to devnet"
echo ""

# Check wallet balance
BALANCE=$(solana balance | awk '{print $1}')
echo "Wallet balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo "⚠️  Low balance. Requesting airdrop..."
    solana airdrop 2
    sleep 5
    echo "✅ Airdrop complete"
fi
echo ""

# Build the program
echo "Building Anchor program..."
anchor build
echo "✅ Build complete"
echo ""

# Get program ID
PROGRAM_ID=$(solana-keygen pubkey target/deploy/anala_lending-keypair.json)
echo "Program ID: $PROGRAM_ID"
echo ""

# Update program ID in lib.rs
echo "Updating program ID in source code..."
sed -i "s/declare_id!(\".*\")/declare_id!(\"$PROGRAM_ID\")/" programs/anala-lending/src/lib.rs
echo "✅ Program ID updated"
echo ""

# Rebuild with correct program ID
echo "Rebuilding with correct program ID..."
anchor build
echo "✅ Rebuild complete"
echo ""

# Deploy to devnet
echo "Deploying to devnet..."
anchor deploy --provider.cluster devnet
echo "✅ Deployment complete"
echo ""

# Update Anchor.toml
echo "Updating Anchor.toml..."
sed -i "s/anala_lending = \".*\"/anala_lending = \"$PROGRAM_ID\"/" Anchor.toml
echo "✅ Anchor.toml updated"
echo ""

# Update .env.local
echo "Updating .env.local..."
if [ -f .env.local ]; then
    sed -i "s/NEXT_PUBLIC_LENDING_PROGRAM_ID=.*/NEXT_PUBLIC_LENDING_PROGRAM_ID=$PROGRAM_ID/" .env.local
else
    cp .env.local.example .env.local
    sed -i "s/NEXT_PUBLIC_LENDING_PROGRAM_ID=.*/NEXT_PUBLIC_LENDING_PROGRAM_ID=$PROGRAM_ID/" .env.local
fi
echo "✅ .env.local updated"
echo ""

# Run tests
echo "Running tests..."
anchor test --skip-local-validator
echo "✅ Tests passed"
echo ""

echo "========================================="
echo "🎉 Deployment Complete!"
echo "========================================="
echo ""
echo "Program ID: $PROGRAM_ID"
echo "Network: Devnet"
echo ""
echo "Next steps:"
echo "1. Update src/lib/defi/client.ts with the new PROGRAM_ID"
echo "2. Run: npm run build"
echo "3. Deploy frontend: vercel --prod"
echo "4. Initialize pools for PreStocks tokens"
echo ""
echo "To initialize a pool:"
echo "  anchor run initialize-pool -- <COLLATERAL_MINT> <LTV_BPS> <INTEREST_BPS>"
echo ""
echo "Example:"
echo "  anchor run initialize-pool -- <ANTHROPIC_MINT> 5170 500"
echo "  (51.7% LTV, 5% APY)"
echo ""
