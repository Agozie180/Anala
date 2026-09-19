#!/bin/bash
# Alternative build script using cargo-build-sbf directly

set -e

echo "Building Anala Lending Program (Direct Cargo Build)"
echo "===================================================="

# Check if cargo-build-sbf is available
if ! command -v cargo-build-sbf &> /dev/null; then
    echo "Installing cargo-build-sbf..."
    cargo install cargo-build-sbf
fi

# Build the program
echo "Building program..."
cd programs/anala-lending
cargo-build-sbf

echo ""
echo "Build complete!"
echo "Program binary: target/deploy/anala_lending.so"
echo ""
echo "Next steps:"
echo "1. Deploy: solana program deploy target/deploy/anala_lending.so --url devnet"
echo "2. Get program ID: solana-keygen pubkey target/deploy/anala_lending-keypair.json"
