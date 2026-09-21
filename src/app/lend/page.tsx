'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { resolvePreStockInstrument } from '@/lib/prestocks/instruments';
import { calculateLTV } from '@/lib/defi/ltv';
import { WalletContextProvider } from '@/components/WalletProvider';
import type { PreStockInstrument } from '@/lib/prestocks/instruments';
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

function LendingWorkspace() {
  const { connected } = useWallet();
  const [selectedToken, setSelectedToken] = useState<string>('ANTHROPIC');
  const [instrument, setInstrument] = useState<PreStockInstrument | null>(null);
  const [ltvCalc, setLtvCalc] = useState<LTVCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [collateralAmount, setCollateralAmount] = useState<string>('10');
  const [borrowAmount, setBorrowAmount] = useState<string>('0');

  useEffect(() => {
    void loadToken();
  }, [selectedToken]);

  async function loadToken() {
    setLoading(true);
    try {
      const resolved = await resolvePreStockInstrument(selectedToken);
      if (resolved.resolved && resolved.instrument) {
        setInstrument(resolved.instrument);
        const ltv = await calculateLTV(resolved.instrument);
        setLtvCalc(ltv);
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

  function calculateMaxBorrow() {
    if (!instrument || !ltvCalc || !collateralAmount) return 0;
    const collateralValue = parseFloat(collateralAmount) * instrument.tokenPrice;
    return collateralValue * ltvCalc.adjustedLtv;
  }

  function handleDemoAction(action: string) {
    window.alert(connected
      ? `${action} is ready for on-chain execution after deployment.`
      : 'Connect a Solana wallet to continue.');
  }

  const maxBorrow = calculateMaxBorrow();
  const borrowAmountNum = parseFloat(borrowAmount) || 0;
  const isValidBorrow = borrowAmountNum > 0 && borrowAmountNum <= maxBorrow;
  const riskScore = ltvCalc?.riskScore.overall ?? 0;

  return (
    <main className="app-shell">
      <header className="app-nav">
        <a className="wordmark" href="/">
          <span className="wordmark-mark">A</span>
          <span>ANALA</span>
        </a>
        <div className="app-nav-meta">
          <span className="network-label"><span className="status-dot" aria-hidden="true" />Solana devnet</span>
          <WalletSummary />
          <WalletMultiButton className="wallet-button" />
        </div>
      </header>

      <section className="workspace-heading">
        <div>
          <p className="eyebrow">ANALA / LENDING DESK</p>
          <h1>Collateral, with context.</h1>
          <p className="workspace-lede">
            Review a PreStocks asset, understand the risk boundary, and prepare a position from one focused workspace.
          </p>
        </div>
        <div className="workspace-state">
          <span className="state-label">WORKSPACE STATE</span>
          <strong>{connected ? 'WALLET CONNECTED' : 'READ ONLY'}</strong>
          <small>{connected ? 'Actions can be staged for your wallet.' : 'Connect to stage an action.'}</small>
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
          <span className="strip-label">Data status</span>
          <strong className="positive-text">{loading ? 'SYNCING' : 'CURRENT'}</strong>
          <small>source: PreStocks API</small>
        </div>
      </section>

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
              {['ANTHROPIC', 'OPENAI', 'SPACEX'].map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => setSelectedToken(token)}
                  className={`token-option ${selectedToken === token ? 'is-selected' : ''}`}
                >
                  <span className="token-symbol">{token.slice(0, 2)}</span>
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
                {instrument.image ? <img src={instrument.image} alt="" /> : <span className="preview-fallback">{instrument.companyName.slice(0, 1)}</span>}
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
                <h2>Stage an action</h2>
              </div>
              <span className="surface-note">Demo execution</span>
            </div>

            <div className="action-block">
              <div className="action-block-heading"><span>Deposit collateral</span><span>01</span></div>
              {instrument && <div className="action-asset"><span>{instrument.companyName}</span><strong>${instrument.tokenPrice.toFixed(2)} / token</strong></div>}
              <label className="field-label" htmlFor="collateral-amount">Amount of {selectedToken} tokens</label>
              <div className="input-shell"><input id="collateral-amount" type="number" value={collateralAmount} onChange={(e) => setCollateralAmount(e.target.value)} placeholder="0.0" step="0.1" min="0" /><span>{selectedToken}</span></div>
              {instrument && collateralAmount && <p className="field-hint">Estimated value ${(parseFloat(collateralAmount) * instrument.tokenPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
              <button className="button button-dark action-button" type="button" disabled={!collateralAmount || parseFloat(collateralAmount) <= 0} onClick={() => handleDemoAction('Collateral deposit')}>
                {connected ? 'Review collateral deposit' : 'Connect wallet to deposit'} <span aria-hidden="true">-&gt;</span>
              </button>
            </div>

            <div className="action-divider" />

            <div className="action-block">
              <div className="action-block-heading"><span>Borrow USDC</span><span>02</span></div>
              <div className="borrow-limit"><span>Available to borrow</span><strong>${maxBorrow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>Based on {(ltvCalc?.adjustedLtv ? ltvCalc.adjustedLtv * 100 : 0).toFixed(1)}% LTV</small></div>
              <label className="field-label" htmlFor="borrow-amount">Borrow amount</label>
              <div className="input-shell"><input id="borrow-amount" type="number" value={borrowAmount} onChange={(e) => setBorrowAmount(e.target.value)} placeholder="0.0" step="100" min="0" max={maxBorrow} /><span>USDC</span></div>
              <div className="quick-values">
                <button type="button" onClick={() => setBorrowAmount((maxBorrow * 0.5).toFixed(2))}>50%</button>
                <button type="button" onClick={() => setBorrowAmount((maxBorrow * 0.75).toFixed(2))}>75%</button>
                <button type="button" onClick={() => setBorrowAmount(maxBorrow.toFixed(2))}>MAX</button>
              </div>
              <button className={`button action-button ${isValidBorrow ? 'button-dark' : 'button-disabled'}`} type="button" disabled={!isValidBorrow} onClick={() => handleDemoAction('USDC borrow')}>
                {connected ? 'Review USDC borrow' : 'Connect wallet to borrow'} <span aria-hidden="true">-&gt;</span>
              </button>
              {borrowAmountNum > maxBorrow && <p className="error-text">Amount exceeds the current borrowing limit.</p>}
              <div className="interest-row"><span>Interest rate</span><strong>5.00% APY</strong><span>Daily estimate</span><strong>${((borrowAmountNum * 0.05) / 365).toFixed(4)}</strong></div>
            </div>
          </section>
        </div>
      </section>

      <section className="execution-strip">
        <div><span className="step-number">01</span><div><strong>Connect</strong><span>Bring a Solana wallet</span></div></div>
        <div><span className="step-number">02</span><div><strong>Review</strong><span>Understand the risk boundary</span></div></div>
        <div><span className="step-number">03</span><div><strong>Settle</strong><span>Confirm only what you intend</span></div></div>
      </section>

      <footer className="app-footer"><span>ANALA / PRESTOCKS LENDING</span><span>Research first. Settlement second.</span><a href="/">Back to overview -&gt;</a></footer>
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
