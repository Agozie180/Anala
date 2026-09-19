'use client';

import { useState, useEffect } from 'react';
import { resolvePreStockInstrument } from '@/lib/prestocks/instruments';
import { calculateLTV } from '@/lib/defi/ltv';
import type { PreStockInstrument } from '@/lib/prestocks/instruments';
import type { LTVCalculation } from '@/lib/defi/ltv';

export default function LendingPage() {
  const [selectedToken, setSelectedToken] = useState<string>('ANTHROPIC');
  const [instrument, setInstrument] = useState<PreStockInstrument | null>(null);
  const [ltvCalc, setLtvCalc] = useState<LTVCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [collateralAmount, setCollateralAmount] = useState<string>('10');
  const [borrowAmount, setBorrowAmount] = useState<string>('0');

  useEffect(() => {
    loadToken();
  }, [selectedToken]);

  async function loadToken() {
    setLoading(true);
    try {
      const resolved = await resolvePreStockInstrument(selectedToken);
      if (resolved.resolved && resolved.instrument) {
        setInstrument(resolved.instrument);
        const ltv = await calculateLTV(resolved.instrument);
        setLtvCalc(ltv);
      }
    } catch (error) {
      console.error('Failed to load token:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateMaxBorrow() {
    if (!instrument || !ltvCalc || !collateralAmount) return 0;
    const collateralValue = parseFloat(collateralAmount) * instrument.tokenPrice;
    return collateralValue * ltvCalc.adjustedLtv;
  }

  const maxBorrow = calculateMaxBorrow();
  const borrowAmountNum = parseFloat(borrowAmount) || 0;
  const isValidBorrow = borrowAmountNum > 0 && borrowAmountNum <= maxBorrow;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold mb-2">Anala Lending</h1>
            <p className="text-gray-400">AI-powered lending for PreStocks tokens</p>
          </div>
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-xl px-6 py-3">
            <div className="text-sm text-yellow-400 font-semibold">Demo Mode</div>
            <div className="text-xs text-gray-400">Connect wallet after deployment</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Token Selection & Risk Analysis */}
          <div className="space-y-6">
            {/* Token Selection */}
            <div className="bg-gray-900 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4">Select Collateral</h2>
              <div className="grid grid-cols-3 gap-3">
                {['ANTHROPIC', 'OPENAI', 'SPACEX'].map((token) => (
                  <button
                    key={token}
                    onClick={() => setSelectedToken(token)}
                    className={`p-4 rounded-xl font-semibold transition-all ${
                      selectedToken === token
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-750'
                    }`}
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Analysis */}
            {loading ? (
              <div className="bg-gray-900 rounded-2xl p-6">
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-800 rounded w-1/2 mb-4"></div>
                  <div className="h-4 bg-gray-800 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-800 rounded w-2/3"></div>
                </div>
              </div>
            ) : instrument && ltvCalc ? (
              <div className="bg-gray-900 rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-4">🤖 AI Risk Assessment</h2>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">Overall Risk Score</span>
                    <span className="text-2xl font-bold">{ltvCalc.riskScore.overall.toFixed(1)}/100</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        ltvCalc.riskScore.overall >= 60
                          ? 'bg-green-500'
                          : ltvCalc.riskScore.overall >= 45
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${ltvCalc.riskScore.overall}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Company Health</span>
                    <span>{ltvCalc.riskScore.companyHealth}/100</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Market Health</span>
                    <span>{ltvCalc.riskScore.marketHealth}/100</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Sentiment</span>
                    <span>{ltvCalc.riskScore.sentimentScore.toFixed(1)}/10</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Confidence</span>
                    <span>{ltvCalc.riskScore.confidenceLevel}/100</span>
                  </div>
                </div>

                <div className="bg-purple-900/30 rounded-xl p-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">Max LTV Ratio</span>
                    <span className="text-2xl font-bold text-purple-400">
                      {(ltvCalc.adjustedLtv * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{ltvCalc.recommendation}</p>
                </div>

                {ltvCalc.warnings.length > 0 && (
                  <div className="space-y-2">
                    {ltvCalc.warnings.map((warning, i) => (
                      <div key={i} className="text-sm text-yellow-400 flex items-start gap-2">
                        <span>⚠️</span>
                        <span>{warning.replace(/^⚠️\s*/, '')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Right Column: Lending Interface */}
          <div className="space-y-6">
            {/* Deposit Collateral */}
            <div className="bg-gray-900 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4">Deposit Collateral</h2>

              {instrument && (
                <div className="mb-4 p-4 bg-gray-800 rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">{instrument.companyName}</span>
                    <span className="text-lg font-semibold">
                      ${instrument.tokenPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Premium: {instrument.premium.toFixed(1)}%
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Amount of {selectedToken} tokens
                  </label>
                  <input
                    type="number"
                    value={collateralAmount}
                    onChange={(e) => setCollateralAmount(e.target.value)}
                    className="w-full bg-gray-800 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
                    placeholder="0.0"
                    step="0.1"
                    min="0"
                  />
                  {instrument && collateralAmount && (
                    <div className="text-sm text-gray-400 mt-2">
                      ≈ ${(parseFloat(collateralAmount) * instrument.tokenPrice).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  )}
                </div>

                <button
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!collateralAmount || parseFloat(collateralAmount) <= 0}
                  onClick={() => alert('Connect wallet after deployment to deposit collateral')}
                >
                  Deposit Collateral (Demo)
                </button>
              </div>
            </div>

            {/* Borrow USDC */}
            <div className="bg-gray-900 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4">Borrow USDC</h2>

              <div className="mb-4 p-4 bg-purple-900/20 rounded-xl border border-purple-500/30">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Max Borrow</span>
                  <span className="text-2xl font-bold text-purple-400">
                    ${maxBorrow.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Based on {ltvCalc ? (ltvCalc.adjustedLtv * 100).toFixed(1) : '0'}% LTV
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Borrow Amount (USDC)
                  </label>
                  <input
                    type="number"
                    value={borrowAmount}
                    onChange={(e) => setBorrowAmount(e.target.value)}
                    className="w-full bg-gray-800 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
                    placeholder="0.0"
                    step="100"
                    min="0"
                    max={maxBorrow}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setBorrowAmount((maxBorrow * 0.5).toFixed(2))}
                    className="flex-1 bg-gray-800 hover:bg-gray-750 text-white py-2 rounded-lg text-sm transition-colors"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => setBorrowAmount((maxBorrow * 0.75).toFixed(2))}
                    className="flex-1 bg-gray-800 hover:bg-gray-750 text-white py-2 rounded-lg text-sm transition-colors"
                  >
                    75%
                  </button>
                  <button
                    onClick={() => setBorrowAmount(maxBorrow.toFixed(2))}
                    className="flex-1 bg-gray-800 hover:bg-gray-750 text-white py-2 rounded-lg text-sm transition-colors"
                  >
                    Max
                  </button>
                </div>

                <button
                  className={`w-full font-semibold py-4 rounded-xl transition-colors ${
                    isValidBorrow
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={!isValidBorrow}
                  onClick={() => alert('Connect wallet after deployment to borrow USDC')}
                >
                  Borrow USDC (Demo)
                </button>

                {borrowAmountNum > maxBorrow && (
                  <div className="text-sm text-red-400 text-center">
                    Amount exceeds max borrow limit
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-800">
                <div className="text-sm text-gray-400 space-y-2">
                  <div className="flex justify-between">
                    <span>Interest Rate</span>
                    <span>5% APY</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Daily Interest</span>
                    <span>${((borrowAmountNum * 0.05) / 365).toFixed(4)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-12 bg-purple-900/20 border border-purple-500/30 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-3">🤖 How Anala Lending Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="font-semibold mb-2">1. AI Risk Assessment</div>
              <div className="text-gray-400">
                Anala analyzes company health, market conditions, sentiment, and data quality
              </div>
            </div>
            <div>
              <div className="font-semibold mb-2">2. Dynamic LTV</div>
              <div className="text-gray-400">
                Your borrowing limit adjusts based on real-time risk analysis (30-75%)
              </div>
            </div>
            <div>
              <div className="font-semibold mb-2">3. Borrow & Repay</div>
              <div className="text-gray-400">
                Deposit PreStocks tokens, borrow USDC, repay anytime to withdraw collateral
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
