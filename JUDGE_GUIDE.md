# Judge Guide — Anala

A practical, beginner-friendly guide to evaluating **Anala**, an AI-assisted lending protocol for PreStocks tokenized pre-IPO stocks, **live on Solana devnet**.

- **Live app:** https://anala-mu.vercel.app/lend
- **Program (devnet):** [`7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG`](https://explorer.solana.com/address/7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG?cluster=devnet)
- **Time to test:** ~5 minutes, no operator keys needed (a built-in faucet gives you test tokens)

---

## 1. What is Anala?

PreStocks tokens represent equity in high-growth pre-IPO companies (Anthropic, OpenAI, SpaceX). Holders can't unlock cash from them without selling. Traditional DeFi lending would apply one fixed loan-to-value (LTV) ratio to every asset regardless of the underlying company.

**Anala does two things differently:**

1. **AI-assisted risk engine** — for each token it scores four dimensions (company health, market health, sentiment, confidence) from live research signals (SEC filings, news, PreStocks market data) and turns that into a **dynamic LTV between 30% and 75%**.
2. **On-chain lending** — an Anchor/Rust program on Solana lets you deposit that token as collateral, borrow USDC up to the AI-set limit, repay with interest, and withdraw. Every action is a real on-chain transaction.

So: **smarter borrowing limits + a real DeFi money market, built specifically for PreStocks tokens.**

> **Important — this is a devnet demo.** The ANTHROPIC / OPENAI / SPACEX collateral and the USDC are **simulated SPL test tokens** on Solana devnet with **no real-world value**; they do not represent actual equity. Prices track the live PreStocks mark but are pushed on-chain by the operator (pre-IPO assets have no third-party price oracle). Interest is simple (non-compounding) 5% APR. There is no liquidation engine yet. It is experimental software for evaluation only.

---

## 2. Test the live demo (recommended, ~5 min)

You'll need a Solana wallet browser extension and a couple of minutes. Everything runs on **devnet**, so no real money is involved.

### Step 1 — Install a wallet

Install **[Phantom](https://phantom.app/)** or **[Solflare](https://solflare.com/)** (browser extension). Create a new wallet if you don't have one — a throwaway wallet is fine for this.

### Step 2 — Switch the wallet to Devnet

This is the one setting that matters. In your wallet:

- **Phantom:** Settings (⚙) → **Developer Settings** → **Testnet Mode** ON → select **Solana Devnet**.
- **Solflare:** Network selector (top of the wallet) → choose **Devnet**.

If the wallet is on Mainnet, the demo won't see your test tokens.

### Step 3 — Get some devnet SOL (for transaction fees)

Every transaction needs a tiny amount of SOL for fees (well under $0.01 worth, but you still need some on devnet).

- Copy your wallet address, then use a public faucet: **https://faucet.solana.com** (paste address, select **Devnet**, request ~1 SOL), or
- Solflare's built-in devnet airdrop, if shown.

### Step 4 — Open the app and connect

1. Go to **https://anala-mu.vercel.app/lend**.
2. Confirm the header shows the **Devnet** network label.
3. Click **Connect Wallet** (top-right) and approve the connection.
4. Pick a token in **01 / Collateral** — **ANTHROPIC**, **OPENAI**, or **SPACEX**. The **02 / Risk Readout** panel shows the AI risk score breakdown and the resulting max LTV.

### Step 5 — Get test collateral tokens (built-in faucet)

In the **Deposit collateral** block, click **"Get 100 test <TOKEN> (devnet)"**. This mints **100 simulated tokens** of the selected asset straight to your wallet — no operator keypair required.

- A success banner appears with a **"View transaction ->"** link.
- The faucet is rate-limited to roughly one request per **20 seconds** per wallet; if you get a "please wait" message, just wait and retry.

### Step 6 — Run the full lending cycle

Work down the right-hand **03 / Position** column:

1. **Deposit collateral** — enter an amount (e.g. `10`), click **Deposit collateral**, approve in your wallet. Your on-chain collateral updates.
2. **Borrow USDC** — the panel shows **Available to borrow** (your collateral × price × AI-set LTV). Enter an amount or use the **50% / 75% / MAX** buttons, click **Borrow USDC**, approve. USDC arrives in your wallet.
3. **Repay USDC** — enter an amount (or **MAX**) to repay your outstanding debt, click **Repay USDC**, approve. (A small amount of 5% APR interest accrues over time.)
4. **Withdraw collateral** — once debt is fully repaid, enter an amount (or **MAX**), click **Withdraw collateral**, approve. Your tokens return to your wallet and the position closes.

Each action shows a status banner with a **"View transaction ->"** link. The borrow button stays disabled until you have collateral, and withdraw stays disabled until your debt is repaid — that's the on-chain LTV/solvency logic enforcing itself.

### Step 7 — Verify transactions on Solana Explorer

You don't have to trust the UI — every action settles on-chain:

- Click any **"View transaction ->"** link to open **[Solana Explorer](https://explorer.solana.com/?cluster=devnet)** on that signature. Confirm it shows **Success** and the **Devnet** cluster.
- Inspect the program itself: [the Anala program on Explorer (devnet)](https://explorer.solana.com/address/7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG?cluster=devnet) — you'll see recent transactions from your test run.
- Inspect your own wallet on Explorer (devnet) to see collateral tokens and USDC move in and out.

> Tip: if Explorer or the app feels slow, it's the shared public devnet RPC rate-limiting — wait a few seconds and retry. Nothing is lost; on-chain state is the source of truth and the app re-reads it after each action.

---

## 3. See the AI risk engine on its own (optional, no wallet)

Want to see how the LTV number is produced, without touching the chain? You can run the risk engine from the repo:

```bash
npm install
npm run ltv -- ANTHROPIC     # try OPENAI or SPACEX too
```

This prints the four-dimension risk breakdown, the overall score, the derived LTV, and the resulting borrowing power for a sample $10,000 of collateral — the same calculation the app uses.

---

## 4. Run the whole repo locally (optional)

You do **not** need this to evaluate the demo (the hosted app at the URL above is already live on devnet). This is only if you want to build and run the frontend yourself.

**Prerequisites:** Node.js 22+ and npm.

```bash
# 1. Clone and install
git clone https://github.com/Agozie180/Anala.git
cd Anala
npm install

# 2. Configure environment
cp .env.local.example .env.local
# The template already sets network=devnet, the RPC URL, and the program ID.
# Fill in the four NEXT_PUBLIC_*_MINT values from the README's
# "Deployed Pools (devnet)" table (public addresses, not secrets).

# 3. Run the app
npm run dev
# Open http://localhost:3100/lend
```

Then follow **Section 2** against your local instance — it talks to the same live devnet program. Note: the built-in token faucet runs on the **hosted** deployment (it uses a server-side operator key that isn't part of the public template). Simplest path: mint your test tokens once on the hosted app at the URL above, then use the **same wallet** locally — the tokens live on devnet, so both the hosted and local UIs see the same balances.

**Other useful commands:**

```bash
npm run typecheck    # TypeScript: no errors
npm test             # unit test suite
npm run build        # production build
npm run discover     # list PreStocks tokens with live data
```

> Rebuilding and redeploying the on-chain program (Anchor / Solana toolchain) is documented separately in **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**. It is not needed to evaluate the demo — the program is already deployed and live on devnet.

---

## 5. What to look for as a judge

- **It's real, not a mockup** — deposit, borrow, repay, and withdraw are genuine Solana transactions you can open on Explorer.
- **The AI limit is enforced on-chain** — you cannot borrow more than the risk-adjusted LTV allows, and you cannot withdraw collateral while you owe USDC.
- **PreStocks-specific** — the collateral assets and their pricing come from the PreStocks universe (ANTHROPIC / OPENAI / SPACEX).
- **Honest about scope** — the app itself displays the devnet / simulated-token / no-liquidation disclosure; nothing is dressed up as mainnet or as real equity.

---

## 6. Quick reference

| Item | Value |
|------|-------|
| Live app | https://anala-mu.vercel.app/lend |
| Network | Solana **Devnet** |
| Program ID | `7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG` |
| Explorer (program) | https://explorer.solana.com/address/7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG?cluster=devnet |
| Devnet SOL faucet | https://faucet.solana.com |
| In-app token faucet | "Get 100 test <TOKEN> (devnet)" button on the Deposit panel |
| Wallets | Phantom or Solflare (set to Devnet) |
| Collateral assets | ANTHROPIC, OPENAI, SPACEX (simulated devnet tokens) |
| Borrow asset | USDC (simulated devnet token) |
| Interest | 5% APR, simple (non-compounding) |

Questions or issues while testing? See the repo: https://github.com/Agozie180/Anala
