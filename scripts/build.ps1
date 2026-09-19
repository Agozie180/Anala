# Anala Lending - Windows Build Script
# This script builds the Solana program without requiring Anchor CLI

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Anala Lending - Direct Build" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check Rust installation
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
if (!(Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Rust/Cargo not installed" -ForegroundColor Red
    Write-Host "Install from: https://rustup.rs/" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Rust/Cargo installed" -ForegroundColor Green
Write-Host ""

# Check if cargo-build-sbf is installed
Write-Host "Checking cargo-build-sbf..." -ForegroundColor Yellow
if (!(Get-Command cargo-build-sbf -ErrorAction SilentlyContinue)) {
    Write-Host "cargo-build-sbf not found. Installing..." -ForegroundColor Yellow
    cargo install cargo-build-sbf
    Write-Host "✓ cargo-build-sbf installed" -ForegroundColor Green
} else {
    Write-Host "✓ cargo-build-sbf already installed" -ForegroundColor Green
}
Write-Host ""

# Build the program
Write-Host "Building Solana program..." -ForegroundColor Yellow
Push-Location programs\anala-lending

try {
    cargo build-sbf
    Write-Host "✓ Build successful!" -ForegroundColor Green
} catch {
    Write-Host "Build failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if keypair exists
$keypairPath = "target\deploy\anala_lending-keypair.json"
if (Test-Path $keypairPath) {
    Write-Host "Program files created:" -ForegroundColor Yellow
    Write-Host "  Binary: target\deploy\anala_lending.so" -ForegroundColor White
    Write-Host "  Keypair: $keypairPath" -ForegroundColor White
    Write-Host ""

    # Try to get program ID if solana CLI is available
    if (Get-Command solana-keygen -ErrorAction SilentlyContinue) {
        $programId = solana-keygen pubkey $keypairPath
        Write-Host "Program ID: $programId" -ForegroundColor Cyan
        Write-Host ""
    }
}

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Install Solana CLI (if not installed):" -ForegroundColor White
Write-Host "   sh -c `"`$(curl -sSfL https://release.solana.com/stable/install)`"" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Get program ID:" -ForegroundColor White
Write-Host "   solana-keygen pubkey target\deploy\anala_lending-keypair.json" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Deploy to devnet:" -ForegroundColor White
Write-Host "   solana program deploy target\deploy\anala_lending.so --url devnet" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Initialize pools:" -ForegroundColor White
Write-Host "   tsx scripts\initialize-pool.ts <MINT_ADDRESS> <LTV_BPS> <INTEREST_BPS>" -ForegroundColor Gray
Write-Host ""
