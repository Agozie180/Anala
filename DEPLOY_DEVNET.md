# Go Live on Devnet — Anala Lending

The frontend at `/lend` is fully wired to the on-chain program (deposit, borrow, repay,
withdraw, live position readout). It reads all addresses from `NEXT_PUBLIC_*` env vars, so
the only thing left to make the **Vercel** site transact is to put the program + markets
on **devnet** and set those env vars.

Everything below is a one-time setup. Re-running `setup:devnet` is safe (idempotent).

## Prerequisites

- Solana CLI installed (`solana --version`). Anchor not required.
- A wallet keypair at `~/.config/solana/id.json` (or set `SOLANA_WALLET=/path/to/id.json`).
  This wallet becomes the **pool authority + mint authority + demo wallet**.

## Steps

```bash
# 1. Point the CLI at devnet and make sure the wallet has SOL
solana config set --url devnet
solana address                      # note this — it's your operator/demo wallet
solana airdrop 2                    # repeat if rate-limited, or use https://faucet.solana.com

# 2. Deploy the program (binary + keypair already built in target/deploy/)
#    Deploys to the fixed id 7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG
npm run deploy:contract

# 3. Create mints, initialize the 3 pools, seed USDC liquidity,
#    and mint demo PreStocks tokens to your wallet.
npm run setup:devnet
```

`setup:devnet` prints a `NEXT_PUBLIC_*` block and also writes it to `.env.devnet`, e.g.:

```
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_LENDING_PROGRAM_ID=7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG
NEXT_PUBLIC_USDC_MINT=<new>
NEXT_PUBLIC_ANTHROPIC_MINT=<new>
NEXT_PUBLIC_OPENAI_MINT=<new>
NEXT_PUBLIC_SPACEX_MINT=<new>
```

## Wire up Vercel

1. Vercel → Project → **Settings → Environment Variables**.
2. Add each line above (Production + Preview + Development).
3. **Redeploy** (env vars only take effect on a new build).

> A public RPC (`api.devnet.solana.com`) is fine for a demo but rate-limits under load.
> For the judging window, a free Helius/QuickNode devnet URL in `NEXT_PUBLIC_SOLANA_RPC_URL`
> is more reliable.

## Demo it

1. Import the operator wallet (the `~/.config/solana/id.json` seed) into Phantom, switch
   Phantom to **Devnet**. It already holds 1,000 of each PreStocks token from step 3.
2. Open the deployed `/lend`, connect the wallet.
3. Deposit collateral → Borrow USDC → Repay → Withdraw. Each action shows a live
   Solana Explorer link and refreshes the on-chain position panel.

## Notes

- **Program id is constant** across localnet/devnet (it's the program keypair's pubkey), so
  `NEXT_PUBLIC_LENDING_PROGRAM_ID` never changes.
- To rebuild the program binary first: `npm run build:contract` (needs the Rust toolchain).
- Rerunning `setup:devnet` reuses the cached mints in `scripts/.devnet-mints.json`, skips
  already-initialized pools, and tops up vault liquidity — safe to run repeatedly.
- Local dev against a validator still works unchanged via the existing `.env.local`.
