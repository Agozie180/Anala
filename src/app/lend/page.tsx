'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { WalletContextProvider } from '@/components/WalletProvider';
import {
  networkLabel,
  isConfigured,
  explorerTx,
  explainError,
  fetchMarket,
  fetchPosition,
  fetchUsdcBalance,
  deposit as depositTx,
  borrow as borrowTx,
  repay as repayTx,
  withdraw as withdrawTx,
  type TokenSymbol,
  type MarketState,
  type PositionState,
  type WalletCtx,
} from '@/lib/defi/lending';
import type { PreStockInstrument } from '@/lib/prestocks/instruments';
import { brandStyle } from '@/lib/prestocks/brand';
import type { LTVCalculation } from '@/lib/defi/ltv';

function WalletSummary() {
  const { connected, publicKey } = useWallet();
  const address = publicKey?.toBase58();

  return (
    <div className="wallet-summary">
      <span className={`connection-indicator ${connected ? 'is-connected' : ''}`} aria-hidden="true" />
      <span>{connected && address ? `${address.slice(0, 4)}...${address.slice(-4)}` : 'Wallet not connected'}</span>
    </div>
  );
}

type TxState = { status: 'pending' | 'success' | 'error'; message: string; sig?: string } | null;

/**
 * Floor to `dp` decimals. Quick-fill buttons (MAX / 50% / 75%) must never round a
 * value *up* past the on-chain cap: a borrow one cent over the LTV limit reverts
 * with ExceedsLTV (6002), and toFixed rounds to nearest, so it can overshoot.
 * Flooring guarantees the filled amount is <= the cap it was derived from.
 */
function floorTo(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.floor(Math.max(0, n) * f) / f;
}

function LendingWorkspace() {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();

  const [selectedToken, setSelectedToken] = useState<TokenSymbol>('ANTHROPIC');
  const [instrument, setInstrument] = useState<PreStockInstrument | null>(null);
  const [ltvCalc, setLtvCalc] = useState<LTVCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [collateralAmount, setCollateralAmount] = useState<string>('10');
  const [borrowAmount, setBorrowAmount] = useState<string>('0');
  const [repayAmount, setRepayAmount] = useState<string>('0');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('0');

  const [market, setMarket] = useState<MarketState | null>(null);
  const [position, setPosition] = useState<PositionState | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [tx, setTx] = useState<TxState>(null);
  const [faucetBusy, setFaucetBusy] = useState(false);

  const configured = isConfigured(selectedToken);
  const poolReady = configured && market?.poolExists === true;

  useEffect(() => {
    void loadToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedToken]);

  const refreshChain = useCallback(async () => {
    if (!configured) {
      setMarket(null);
      setPosition(null);
      setUsdcBalance(0);
      return;
    }
    // allSettled, not all: the public devnet RPC rate-limits (429s), and a failed
    // position read must not wipe a good market read (or vice versa) — that would
    // drop collateral/debt to 0 and disable borrow/repay/withdraw.
    const [m, p, b] = await Promise.allSettled([
      fetchMarket(connection, selectedToken),
      publicKey ? fetchPosition(connection, selectedToken, publicKey) : Promise.resolve(null),
      publicKey ? fetchUsdcBalance(connection, publicKey) : Promise.resolve(0),
    ]);
    if (m.status === 'fulfilled') setMarket(m.value);
    else console.error('Failed to read market:', m.reason);
    if (p.status === 'fulfilled') setPosition(p.value);
    else console.error('Failed to read position:', p.reason);
    if (b.status === 'fulfilled') setUsdcBalance(b.value ?? 0);
    else console.error('Failed to read USDC balance:', b.reason);
  }, [connection, selectedToken, publicKey, configured]);

  useEffect(() => {
    void refreshChain();
  }, [refreshChain]);

  async function loadToken() {
    setLoading(true);
    try {
      // Server route: prestocks.com sends no CORS headers and the research engine
      // is server-only, so this cannot run in the browser. See /api/lend-quote.
      const res = await fetch(`/api/lend-quote?symbol=${encodeURIComponent(selectedToken)}`);
      const data = await res.json();
      if (res.ok && data.ok && data.instrument) {
        setInstrument(data.instrument as PreStockInstrument);
        setLtvCalc((data.ltv ?? null) as LTVCalculation | null);
      } else {
        setInstrument(null);
        setLtvCalc(null);
      }
    } catch (error) {
      console.error('Failed to load token:', error);
      setInstrument(null);
      setLtvCalc(null);
    } finally {
      setLoading(false);
    }
  }

  // Mirror the on-chain borrow gate as closely as the client can: capacity is
  // (collateral tokens) x (price) x (LTV) minus debt already drawn. Prefer the
  // values the program actually reads — on-chain price, on-chain LTV, on-chain
  // collateral — and fall back to the research quote / deposit input before a
  // position exists so the figure is never dead.
  function calculateMaxBorrow() {
    const onChainCollateral = position?.collateral ?? 0;
    const onChainDebt = position?.borrowed ?? 0;
    const ltv =
      market?.poolExists && market.ltvRatioBps > 0 ? market.ltvRatioBps / 10000 : ltvCalc?.adjustedLtv ?? 0;
    const price =
      market?.collateralPriceUsd && market.collateralPriceUsd > 0
        ? market.collateralPriceUsd
        : instrument?.tokenPrice ?? 0;
    const tokens = onChainCollateral > 0 ? onChainCollateral : parseFloat(collateralAmount) || 0;
    if (!price || !ltv || !tokens) return 0;
    const available = tokens * price * ltv - onChainDebt;
    return available > 0 ? available : 0;
  }

  async function runAction(kind: string, label: string, fn: (ctx: WalletCtx) => Promise<string>) {
    if (!publicKey || !sendTransaction) {
      setTx({ status: 'error', message: 'Connect a Solana wallet to continue.' });
      return;
    }
    if (!poolReady) {
      setTx({ status: 'error', message: `This market is not live on ${networkLabel()} yet.` });
      return;
    }
    setBusy(kind);
    setTx({ status: 'pending', message: `${label} — approve the transaction in your wallet…` });
    try {
      const ctx: WalletCtx = { connection, publicKey, sendTransaction };
      const sig = await fn(ctx);
      setTx({ status: 'success', message: `${label} confirmed on ${networkLabel()}.`, sig });
      await refreshChain();
    } catch (error) {
      console.error(`${kind} failed:`, error);
      setTx({ status: 'error', message: explainError(error) });
    } finally {
      setBusy(null);
    }
  }

  async function requestFaucet() {
    if (!publicKey) {
      setTx({ status: 'error', message: 'Connect a Solana wallet to receive test tokens.' });
      return;
    }
    setFaucetBusy(true);
    setTx({ status: 'pending', message: `Requesting test ${selectedToken} tokens…` });
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol: selectedToken, owner: publicKey.toBase58() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Faucet request failed.');
      const usdcNote = data.usdcAmount ? ` + ${data.usdcAmount} test USDC (covers loan interest)` : '';
      setTx({ status: 'success', message: `Received ${data.amount} test ${selectedToken}${usdcNote}. Deposit to continue.`, sig: data.signature });
      await refreshChain();
    } catch (error) {
      setTx({ status: 'error', message: error instanceof Error ? error.message : 'Faucet request failed.' });
    } finally {
      setFaucetBusy(false);
    }
  }

  const maxBorrow = calculateMaxBorrow();
  const borrowAmountNum = parseFloat(borrowAmount) || 0;
  const repayAmountNum = parseFloat(repayAmount) || 0;
  const withdrawAmountNum = parseFloat(withdrawAmount) || 0;
  const isValidBorrow = borrowAmountNum > 0 && borrowAmountNum <= maxBorrow;
  const riskScore = ltvCalc?.riskScore.overall ?? 0;

  const collateralOnChain = position?.collateral ?? 0;
  const borrowedOnChain = position?.borrowed ?? 0;
  const hasCollateral = collateralOnChain > 0;
  const hasDebt = borrowedOnChain > 0;

  // Repaying must clear the debt to exactly zero, or withdraw_collateral stays
  // blocked (it requires borrowed_amount == 0). Interest keeps accruing until the
  // repay tx lands, so we aim a little over the debt shown; on-chain the program
  // clamps to min(amount, debt) and pulls only the true debt, refunding nothing —
  // over-sending is safe. Capped at the wallet's USDC so the token transfer can't
  // fail for insufficient funds. The faucet hands out spare USDC for this.
  const repayAllAmount = floorTo(Math.min(usdcBalance, borrowedOnChain * 1.02 + 0.02), 2);

  const canDeposit = connected && poolReady && !busy && parseFloat(collateralAmount) > 0;
  const canBorrow = connected && poolReady && !busy && isValidBorrow && hasCollateral;
  const canRepay = connected && poolReady && !busy && hasDebt && repayAmountNum > 0 && repayAmountNum <= usdcBalance + 1e-6;
  const canWithdraw =
    connected && poolReady && !busy && withdrawAmountNum > 0 && withdrawAmountNum <= collateralOnChain && !hasDebt;

  return (
    <main className="app-shell">
      <header className="app-nav">
        <a className="wordmark" href="/">
          <span className="wordmark-mark">A</span>
          <span>ANALA</span>
        </a>
        <div className="app-nav-meta">
          <span className="network-label"><span className="status-dot" aria-hidden="true" />{networkLabel()}</span>
          <WalletSummary />
          <WalletMultiButton className="wallet-button" />
        </div>
      </header>

      <section className="workspace-heading">
        <div>
          <p className="eyebrow premium-label">ANALA / LENDING DESK</p>
          <h1 className="premium-heading">Collateral, with context.</h1>
          <p className="workspace-lede">
            Review a PreStocks asset, understand the risk boundary, and open a position on-chain from one focused workspace.
          </p>
        </div>
        <div className="workspace-state">
          <span className="state-label">WORKSPACE STATE</span>
          <strong>{connected ? 'WALLET CONNECTED' : 'READ ONLY'}</strong>
          <small>{connected ? 'Actions settle on-chain from your wallet.' : 'Connect to open a position.'}</small>
        </div>
      </section>

      <section className="market-strip" aria-label="Selected market summary">
        <div className="market-strip-item market-selected">
          <span className="strip-label">Selected instrument</span>
          <strong>{instrument?.companyName ?? selectedToken}</strong>
          <small>{instrument?.tokenName ?? 'Loading PreStocks instrument'}</small>
        </div>
        <div className="market-strip-item">
          <span className="strip-label">Token price</span>
          <strong>{instrument ? `$${instrument.tokenPrice.toFixed(2)}` : '--'}</strong>
          <small>live PreStocks mark</small>
        </div>
        <div className="market-strip-item">
          <span className="strip-label">Max LTV</span>
          <strong>{ltvCalc ? `${(ltvCalc.adjustedLtv * 100).toFixed(1)}%` : '--'}</strong>
          <small>risk-adjusted capacity</small>
        </div>
        <div className="market-strip-item">
          <span className="strip-label">Pool liquidity</span>
          <strong className={poolReady ? 'positive-text' : ''}>
            {poolReady ? `$${(market?.totalBorrowed ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} borrowed` : configured ? 'NOT LIVE' : 'UNCONFIGURED'}
          </strong>
          <small>{poolReady ? `on ${networkLabel()}` : `market on ${networkLabel()}`}</small>
        </div>
      </section>

      <div
        role="note"
        style={{
          margin: '0 0 18px',
          padding: '12px 16px',
          border: '1px solid var(--line-strong)',
          background: 'var(--canvas)',
          fontSize: 12,
          lineHeight: 1.55,
          color: 'var(--muted)',
        }}
      >
        <strong style={{ color: 'var(--ink)' }}>Devnet demo — simulated tokens.</strong>{' '}
        The ANTHROPIC, OPENAI and SPACEX collateral and the USDC used here are test SPL tokens minted on
        Solana devnet with no real-world value; they do not represent actual equity in any company. Prices
        track the live PreStocks mark but are pushed on-chain by the operator, since these pre-IPO assets
        have no third-party oracle. Interest accrues as simple (non-compounding) 5% APR. This is
        experimental software for evaluation only — not investment advice, positions can lose value, and
        there is no liquidation engine yet.
      </div>

      {tx && (
        <div className={`tx-banner is-${tx.status}`} role="status">
          <span>{tx.message}</span>
          {tx.sig && (
            <a className="tx-link" href={explorerTx(tx.sig)} target="_blank" rel="noreferrer">
              View transaction -&gt;
            </a>
          )}
        </div>
      )}

      {configured && market && !market.poolExists && (
        <div className="tx-banner is-error" role="status">
          <span>The {selectedToken} pool is not initialized on {networkLabel()} yet. Run the devnet setup script to go live.</span>
        </div>
      )}
      {!configured && (
        <div className="tx-banner is-error" role="status">
          <span>{selectedToken} is not configured for {networkLabel()}. Set the NEXT_PUBLIC_*_MINT env vars.</span>
        </div>
      )}

      <section className="workspace-grid">
        <div className="workspace-column">
          <section className="surface token-surface">
            <div className="surface-heading">
              <div>
                <p className="eyebrow">01 / COLLATERAL</p>
                <h2>Select an instrument</h2>
              </div>
              <span className="surface-note">PreStocks universe</span>
            </div>
            <div className="token-list">
              {(['ANTHROPIC', 'OPENAI', 'SPACEX'] as TokenSymbol[]).map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => setSelectedToken(token)}
                  className={`token-option ${selectedToken === token ? 'is-selected' : ''}`}
                >
                  <span className="token-symbol" style={brandStyle(token)}>{token.slice(0, 2)}</span>
                  <span>
                    <strong>{token}</strong>
                    <small>PreStocks token</small>
                  </span>
                  <span className="option-arrow" aria-hidden="true">-&gt;</span>
                </button>
              ))}
            </div>
            {instrument && (
              <div className="instrument-preview">
                {instrument.image ? <img src={instrument.image} alt="" /> : <span className="preview-fallback" style={brandStyle(selectedToken)}>{instrument.companyName.slice(0, 1)}</span>}
                <div>
                  <strong>{instrument.companyName}</strong>
                  <span>{instrument.description || 'Tokenized exposure to a private company.'}</span>
                </div>
                <span className="premium-value">{instrument.premium >= 0 ? '+' : ''}{instrument.premium.toFixed(1)}% premium</span>
              </div>
            )}
          </section>

          <section className="surface risk-surface">
            <div className="surface-heading">
              <div>
                <p className="eyebrow">02 / RISK READOUT</p>
                <h2>Dynamic lending boundary</h2>
              </div>
              <span className={`risk-status ${riskScore >= 60 ? 'is-healthy' : ''}`}>{riskScore >= 60 ? 'HEALTHY' : 'REVIEW'}</span>
            </div>
            {loading ? (
              <div className="loading-state" aria-label="Loading risk assessment">
                <span />
                <span />
                <span />
              </div>
            ) : ltvCalc ? (
              <>
                <div className="risk-hero">
                  <div>
                    <span className="strip-label">Overall risk score</span>
                    <strong>{riskScore.toFixed(1)}<small>/100</small></strong>
                  </div>
                  <div className="risk-meter"><span style={{ width: `${Math.min(100, Math.max(0, riskScore))}%` }} /></div>
                </div>
                <div className="risk-facts">
                  <div><span>Company health</span><strong>{ltvCalc.riskScore.companyHealth}/100</strong></div>
                  <div><span>Market health</span><strong>{ltvCalc.riskScore.marketHealth}/100</strong></div>
                  <div><span>Sentiment</span><strong>{ltvCalc.riskScore.sentimentScore.toFixed(1)}/10</strong></div>
                  <div><span>Confidence</span><strong>{ltvCalc.riskScore.confidenceLevel}/100</strong></div>
                </div>
                <div className="risk-recommendation">
                  <div><span>Recommended limit</span><strong>{(ltvCalc.adjustedLtv * 100).toFixed(1)}%</strong></div>
                  <p>{ltvCalc.recommendation}</p>
                </div>
                {ltvCalc.warnings.length > 0 && (
                  <div className="risk-warnings">
                    {ltvCalc.warnings.map((warning, i) => <p key={i}>{warning.replace(/^[^ ]+\s*/, '')}</p>)}
                  </div>
                )}
              </>
            ) : (
              <p className="empty-state">Select a live instrument to load its assessment.</p>
            )}
          </section>
        </div>

        <div className="workspace-column">
          <section className="surface action-surface">
            <div className="surface-heading">
              <div>
                <p className="eyebrow">03 / POSITION</p>
                <h2>Open a position</h2>
              </div>
              <span className="surface-note">{poolReady ? 'On-chain execution' : 'Awaiting pool'}</span>
            </div>

            <div className="action-block">
              <div className="borrow-limit">
                <span>Your collateral</span>
                <strong>{collateralOnChain.toLocaleString(undefined, { maximumFractionDigits: 4 })} {selectedToken}</strong>
                <span>Your debt</span>
                <strong>${borrowedOnChain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                <small>{connected ? `Live position on ${networkLabel()}` : 'Connect a wallet to load your position'}</small>
              </div>
            </div>

            <div className="action-divider" />

            <div className="action-block">
              <div className="action-block-heading"><span>Deposit collateral</span><span>01</span></div>
              {instrument && <div className="action-asset"><span>{instrument.companyName}</span><strong>${instrument.tokenPrice.toFixed(2)} / token</strong></div>}
              <label className="field-label" htmlFor="collateral-amount">Amount of {selectedToken} tokens</label>
              <div className="input-shell"><input id="collateral-amount" type="number" value={collateralAmount} onChange={(e) => setCollateralAmount(e.target.value)} placeholder="0.0" step="0.1" min="0" /><span>{selectedToken}</span></div>
              {instrument && collateralAmount && <p className="field-hint">Estimated value ${(parseFloat(collateralAmount) * instrument.tokenPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
              <button
                className="button button-light button-small"
                type="button"
                style={{ width: '100%', marginTop: 10 }}
                disabled={!connected || faucetBusy}
                onClick={() => void requestFaucet()}
              >
                {faucetBusy ? 'Requesting test tokens…' : connected ? `Get 100 test ${selectedToken} (devnet)` : 'Connect wallet for test tokens'}
              </button>
              <button
                className={`button action-button ${canDeposit ? 'button-dark' : 'button-disabled'}`}
                type="button"
                disabled={!canDeposit}
                onClick={() => runAction('deposit', 'Collateral deposit', (ctx) => depositTx(ctx, selectedToken, collateralAmount))}
              >
                {busy === 'deposit' ? 'Depositing…' : connected ? 'Deposit collateral' : 'Connect wallet to deposit'} <span aria-hidden="true">-&gt;</span>
              </button>
            </div>

            <div className="action-divider" />

            <div className="action-block">
              <div className="action-block-heading"><span>Borrow USDC</span><span>02</span></div>
              <div className="borrow-limit"><span>Available to borrow</span><strong>${maxBorrow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>Based on {(ltvCalc?.adjustedLtv ? ltvCalc.adjustedLtv * 100 : 0).toFixed(1)}% LTV</small></div>
              <label className="field-label" htmlFor="borrow-amount">Borrow amount</label>
              <div className="input-shell"><input id="borrow-amount" type="number" value={borrowAmount} onChange={(e) => setBorrowAmount(e.target.value)} placeholder="0.0" step="100" min="0" max={maxBorrow} /><span>USDC</span></div>
              <div className="quick-values">
                <button type="button" onClick={() => setBorrowAmount(floorTo(maxBorrow * 0.5, 2).toFixed(2))}>50%</button>
                <button type="button" onClick={() => setBorrowAmount(floorTo(maxBorrow * 0.75, 2).toFixed(2))}>75%</button>
                <button type="button" onClick={() => setBorrowAmount(floorTo(maxBorrow, 2).toFixed(2))}>MAX</button>
              </div>
              <button
                className={`button action-button ${canBorrow ? 'button-dark' : 'button-disabled'}`}
                type="button"
                disabled={!canBorrow}
                onClick={() => runAction('borrow', 'USDC borrow', (ctx) => borrowTx(ctx, selectedToken, borrowAmount))}
              >
                {busy === 'borrow' ? 'Borrowing…' : connected ? 'Borrow USDC' : 'Connect wallet to borrow'} <span aria-hidden="true">-&gt;</span>
              </button>
              {connected && poolReady && !hasCollateral && <p className="field-hint">Deposit collateral to unlock borrowing.</p>}
              {borrowAmountNum > maxBorrow && <p className="error-text">Amount exceeds the current borrowing limit.</p>}
              <div className="interest-row"><span>Interest rate</span><strong>{market ? (market.interestRateBps / 100).toFixed(2) : '5.00'}% APR</strong><span>Daily estimate</span><strong>${((borrowAmountNum * (market ? market.interestRateBps / 10000 : 0.05)) / 365).toFixed(4)}</strong></div>
            </div>

            <div className="action-divider" />

            <div className="action-block">
              <div className="action-block-heading"><span>Repay USDC</span><span>03</span></div>
              <div className="borrow-limit"><span>Outstanding debt</span><strong>${borrowedOnChain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>Repay to release your collateral</small></div>
              <label className="field-label" htmlFor="repay-amount">Repay amount</label>
              <div className="input-shell"><input id="repay-amount" type="number" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} placeholder="0.0" step="100" min="0" max={usdcBalance} /><span>USDC</span></div>
              <div className="quick-values">
                <button type="button" onClick={() => setRepayAmount(floorTo(borrowedOnChain * 0.5, 2).toFixed(2))}>50%</button>
                <button type="button" onClick={() => setRepayAmount(repayAllAmount.toFixed(2))}>MAX</button>
              </div>
              {connected && (
                <p className="field-hint">
                  Wallet USDC ${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. MAX clears the debt in full — including accrued interest — so you can withdraw your collateral.
                </p>
              )}
              <button
                className={`button action-button ${canRepay ? 'button-dark' : 'button-disabled'}`}
                type="button"
                disabled={!canRepay}
                onClick={() => runAction('repay', 'USDC repay', (ctx) => repayTx(ctx, selectedToken, repayAmount))}
              >
                {busy === 'repay' ? 'Repaying…' : connected ? 'Repay USDC' : 'Connect wallet to repay'} <span aria-hidden="true">-&gt;</span>
              </button>
              {connected && hasDebt && repayAmountNum > usdcBalance + 1e-6 && (
                <p className="error-text">Amount exceeds your wallet USDC (${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Use the faucet to top up test USDC.</p>
              )}
            </div>

            <div className="action-divider" />

            <div className="action-block">
              <div className="action-block-heading"><span>Withdraw collateral</span><span>04</span></div>
              <div className="borrow-limit"><span>Deposited collateral</span><strong>{collateralOnChain.toLocaleString(undefined, { maximumFractionDigits: 4 })} {selectedToken}</strong><small>{hasDebt ? 'Repay your debt before withdrawing' : 'Available to withdraw'}</small></div>
              <label className="field-label" htmlFor="withdraw-amount">Withdraw amount</label>
              <div className="input-shell"><input id="withdraw-amount" type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="0.0" step="0.1" min="0" max={collateralOnChain} /><span>{selectedToken}</span></div>
              <div className="quick-values">
                <button type="button" onClick={() => setWithdrawAmount(floorTo(collateralOnChain * 0.5, 4).toFixed(4))}>50%</button>
                <button type="button" onClick={() => setWithdrawAmount(floorTo(collateralOnChain, 4).toFixed(4))}>MAX</button>
              </div>
              <button
                className={`button action-button ${canWithdraw ? 'button-dark' : 'button-disabled'}`}
                type="button"
                disabled={!canWithdraw}
                onClick={() => runAction('withdraw', 'Collateral withdrawal', (ctx) => withdrawTx(ctx, selectedToken, withdrawAmount))}
              >
                {busy === 'withdraw' ? 'Withdrawing…' : connected ? 'Withdraw collateral' : 'Connect wallet to withdraw'} <span aria-hidden="true">-&gt;</span>
              </button>
              {hasDebt && <p className="error-text">Repay your outstanding debt before withdrawing collateral.</p>}
              {withdrawAmountNum > collateralOnChain && <p className="error-text">Amount exceeds your deposited collateral.</p>}
            </div>
          </section>
        </div>
      </section>

      <section className="execution-strip">
        <div><span className="step-number">01</span><div><strong>Connect</strong><span>Bring a Solana wallet</span></div></div>
        <div><span className="step-number">02</span><div><strong>Deposit</strong><span>Post PreStocks collateral</span></div></div>
        <div><span className="step-number">03</span><div><strong>Borrow</strong><span>Draw USDC against it</span></div></div>
      </section>

      <footer className="app-footer"><span className="premium-label">ANALA / PRESTOCKS LENDING</span><span>Research first. Settlement second.</span><a href="/">Back to overview -&gt;</a></footer>
    </main>
  );
}

export default function LendingPage() {
  return (
    <WalletContextProvider>
      <LendingWorkspace />
    </WalletContextProvider>
  );
}
