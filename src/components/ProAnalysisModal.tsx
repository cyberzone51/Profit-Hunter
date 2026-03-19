import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Activity, TrendingUp, TrendingDown, Target, Shield, AlertTriangle, Zap, BarChart2, Waves, ActivitySquare, ArrowUpRight, ArrowDownRight, Layers, Lock, Wallet, CheckCircle2 } from 'lucide-react';
import { BybitTicker } from '../types';
import { useCoinSignal } from '../hooks/useCoinSignal';
import { formatPrice as utilsFormatPrice } from '../utils';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount, useDisconnect } from 'wagmi';

interface ProAnalysisModalProps {
  ticker: BybitTicker;
  onClose: () => void;
}

export const ProAnalysisModal: React.FC<ProAnalysisModalProps> = ({ ticker, onClose }) => {
  const { t } = useTranslation();
  const { signal, loading } = useCoinSignal(ticker.symbol, ticker);
  const { open } = useWeb3Modal();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const [isPro, setIsPro] = useState(() => {
    try {
      return localStorage.getItem('profit_hunter_pro_status') === 'active';
    } catch (e) {
      return false;
    }
  });
  const [isPaying, setIsPaying] = useState(false);

  const formatPrice = (price: number) => {
    return utilsFormatPrice(price);
  };

  const handlePayment = async () => {
    setIsPaying(true);
    // Simulate blockchain transaction delay
    setTimeout(() => {
      try {
        localStorage.setItem('profit_hunter_pro_status', 'active');
      } catch (e) {}
      setIsPro(true);
      setIsPaying(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      {/* Backdrop - non-clickable as per user request "okno ne dolgno byt klikabelno tolko knopka" */}
      <div className="absolute inset-0" />
      
      <div className="relative bg-[#11151e] border-x sm:border border-white/10 rounded-none sm:rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 bg-[#1a202c] shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {t('Pro Analysis')} <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">AI</span>
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400">{ticker.symbol.replace('USDT', '')} / USDT</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar relative">
          {!isPro ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center max-w-md mx-auto">
              <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 relative">
                <Lock className="w-10 h-10 text-blue-400" />
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg">
                  PRO
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-3">{t('Unlock Pro Analysis')}</h3>
              <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                {t('Get exclusive access to institutional-grade AI signals, exact entry points, take-profit targets, and advanced risk management metrics.')}
              </p>

              <div className="w-full space-y-4 bg-[#1a202c] p-6 rounded-xl border border-white/5 mb-8 text-left">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-sm text-slate-300">{t('Real-time AI trend predictions')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-sm text-slate-300">{t('Exact Entry, TP, and SL levels')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-sm text-slate-300">{t('Smart Money & Order Book analysis')}</span>
                </div>
              </div>

              {!isConnected ? (
                <button
                  onClick={() => open()}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <Wallet className="w-5 h-5" />
                  {t('Connect Wallet to Unlock')}
                </button>
              ) : (
                <div className="w-full space-y-4">
                  <div className="flex items-center justify-between bg-[#0b0e14] p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="text-xs text-slate-400 font-mono">
                        {address?.slice(0, 6)}...{address?.slice(-4)}
                      </span>
                    </div>
                    <button onClick={() => disconnect()} className="text-xs text-rose-400 hover:text-rose-300">
                      {t('Disconnect')}
                    </button>
                  </div>
                  <button
                    onClick={handlePayment}
                    disabled={isPaying}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {isPaying ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Zap className="w-5 h-5" />
                    )}
                    {isPaying ? t('Processing Transaction...') : t('Pay 10 USDT for 30 Days')}
                  </button>
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-20">
              <div className="relative w-16 h-16 sm:w-24 sm:h-24 mb-6 sm:mb-8">
                <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                <Activity className="absolute inset-0 m-auto w-6 h-6 sm:w-8 sm:h-8 text-blue-400 animate-pulse" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2 text-center">{t('Analyzing Real-Time Data...')}</h3>
              <p className="text-slate-400 text-xs sm:text-sm mb-6 text-center max-w-md px-4">
                {t('Calculating technical indicators and running institutional models for')} {ticker.symbol}...
              </p>
            </div>
          ) : signal ? (
            <div className="space-y-5 sm:space-y-6">
              
              {/* Top Verdict Card */}
              <div className={`p-4 sm:p-6 rounded-xl border ${
                signal.direction === 'LONG' ? 'bg-emerald-500/10 border-emerald-500/20' : 
                signal.direction === 'SHORT' ? 'bg-rose-500/10 border-rose-500/20' : 
                'bg-slate-500/10 border-slate-500/20'
              }`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {signal.direction === 'LONG' ? <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" /> : 
                       signal.direction === 'SHORT' ? <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400" /> : 
                       <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />}
                      <h3 className={`text-xl sm:text-2xl font-black ${
                        signal.direction === 'LONG' ? 'text-emerald-400' : 
                        signal.direction === 'SHORT' ? 'text-rose-400' : 
                        'text-slate-400'
                      }`}>
                        {signal.direction === 'LONG' ? t('STRONG BUY') : 
                         signal.direction === 'SHORT' ? t('STRONG SELL') : t('NEUTRAL')}
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium">{t(signal.type)}</p>
                  </div>
                  
                  <div className="flex items-center gap-3 sm:gap-4 bg-[#0b0e14] p-2.5 sm:p-3 rounded-lg border border-white/5 w-full sm:w-auto justify-around sm:justify-start">
                    <div className="text-center">
                      <div className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">{t('Confidence')}</div>
                      <div className="text-lg sm:text-xl font-black text-white">{signal.score}%</div>
                    </div>
                    <div className="w-px h-6 sm:h-8 bg-white/10"></div>
                    <div className="text-center">
                      <div className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">{t('Risk/Reward')}</div>
                      <div className="text-lg sm:text-xl font-black text-white">1:{signal.riskReward.toFixed(1)}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-slate-300 text-[11px] sm:text-xs leading-relaxed italic">
                    {signal.type.toLowerCase().includes('trend') 
                      ? t('The market is currently in a strong trending phase. Technical indicators suggest following the current momentum rather than looking for immediate reversals.')
                      : t('The asset is currently consolidating within a narrow range. Volatility is low and no clear directional bias has emerged yet. We recommend waiting for a confirmed breakout before entering new positions.')}
                  </p>
                </div>
              </div>

              {/* Trade Setup */}
              <div>
                <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {t('Trade Setup')}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                  <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                    <div className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">{t('Entry Price')}</div>
                    <div className="text-base sm:text-lg font-mono font-bold text-white">{formatPrice(signal.entryPrice)}</div>
                  </div>
                  <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                    <div className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">{t('Take Profit 1')}</div>
                    <div className="text-base sm:text-lg font-mono font-bold text-emerald-400">{formatPrice(signal.takeProfit1)}</div>
                  </div>
                  <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                    <div className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">{t('Take Profit 2')}</div>
                    <div className="text-base sm:text-lg font-mono font-bold text-emerald-500">{formatPrice(signal.takeProfit2)}</div>
                  </div>
                  <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-rose-500/20">
                    <div className="text-[10px] sm:text-xs text-rose-400/70 mb-0.5 sm:mb-1">{t('Stop Loss')}</div>
                    <div className="text-base sm:text-lg font-mono font-bold text-rose-400">{formatPrice(signal.stopLoss)}</div>
                  </div>
                </div>
              </div>

              {/* 8 Categories Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                
                {/* 1. Trend Indicators */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" /> 1. {t('Trend')}
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">EMA (20/50/200)</span>
                      <span className={`font-mono font-bold ${signal.indicators.ema20 > signal.indicators.ema50 && signal.indicators.ema50 > signal.indicators.ema200 ? 'text-emerald-400' : signal.indicators.ema20 < signal.indicators.ema50 && signal.indicators.ema50 < signal.indicators.ema200 ? 'text-rose-400' : 'text-amber-400'}`}>
                        {signal.indicators.ema20 > signal.indicators.ema50 && signal.indicators.ema50 > signal.indicators.ema200 ? t('Strong Uptrend') : signal.indicators.ema20 < signal.indicators.ema50 && signal.indicators.ema50 < signal.indicators.ema200 ? t('Strong Downtrend') : t('Mixed')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">ADX ({t('Trend Strength')})</span>
                      <span className={`font-mono font-bold ${signal.indicators.adx > 40 ? 'text-emerald-400' : signal.indicators.adx > 25 ? 'text-blue-400' : 'text-slate-400'}`}>
                        {signal.indicators.adx.toFixed(1)} ({signal.indicators.adx > 40 ? t('Strong') : signal.indicators.adx > 25 ? t('Beginning') : t('Flat')})
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Momentum Indicators */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> 2. {t('Momentum')}
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">RSI (14)</span>
                      <span className={`font-mono font-bold ${signal.indicators.rsi > 70 ? 'text-rose-400' : signal.indicators.rsi < 30 ? 'text-emerald-400' : 'text-white'}`}>
                        {signal.indicators.rsi.toFixed(1)} ({signal.indicators.rsi > 70 ? t('Overbought') : signal.indicators.rsi < 30 ? t('Oversold') : t('Neutral')})
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">MACD (12,26,9)</span>
                      <span className={`font-mono font-bold ${signal.indicators.macd.hist > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {signal.indicators.macd.hist > 0 ? t('Bullish Cross') : t('Bearish Cross')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Volume Indicators */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" /> 3. {t('Volume')}
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">VWAP</span>
                      <span className={`font-mono font-bold ${Number(ticker.lastPrice) > signal.indicators.vwap ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatPrice(signal.indicators.vwap)} ({Number(ticker.lastPrice) > signal.indicators.vwap ? t('Bullish') : t('Bearish')})
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">OBV Trend</span>
                      <span className={`font-mono font-bold ${signal.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {signal.direction === 'LONG' ? t('Accumulation') : t('Distribution')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Volatility Indicators */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
                    <ActivitySquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" /> 4. {t('Volatility')}
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Bollinger Bands</span>
                      <span className="font-mono font-bold text-white">
                        {Number(ticker.lastPrice) > signal.indicators.bb.upper ? t('Overbought') : Number(ticker.lastPrice) < signal.indicators.bb.lower ? t('Oversold') : t('In Channel')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">ATR ({t('Stop Loss ref')})</span>
                      <span className="font-mono font-bold text-white">
                        {formatPrice(signal.indicators.atr)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Market Structure */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" /> 5. {t('Market Structure')}
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">{t('Elliott Wave Phase')}</span>
                      <span className="font-mono font-bold text-white">
                        {t(signal.indicators.elliottWave)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">{t('Nearest Fibonacci')}</span>
                      <span className="font-mono font-bold text-white">
                        {signal.indicators.fibonacci.nearestLevel} ({formatPrice(signal.indicators.fibonacci.value)})
                      </span>
                    </div>
                  </div>
                </div>

                {/* 6. Crypto Metrics */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
                    <Waves className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" /> 6. {t('Crypto Metrics')}
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">{t('Funding Rate')}</span>
                      <span className={`font-mono font-bold ${Number(ticker.fundingRate) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {(Number(ticker.fundingRate) * 100).toFixed(4)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">{t('Open Interest')}</span>
                      <span className="font-mono font-bold text-white">
                        ${(Number(ticker.openInterestValue) / 1000000).toFixed(2)}M
                      </span>
                    </div>
                  </div>
                </div>

                {/* 7. Institutional Flow */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-400" /> 7. {t('Institutional Flow')}
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">{t('OI 24h Change')}</span>
                      <span className={`font-mono font-bold ${signal.indicators.oiChange24h > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {signal.indicators.oiChange24h > 0 ? '+' : ''}{signal.indicators.oiChange24h.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">{t('Volume Spike')}</span>
                      <span className={`font-mono font-bold ${signal.indicators.volumeSpike ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {signal.indicators.volumeSpike ? t('DETECTED') : t('Normal')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 8. Liquidity Map */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" /> 8. {t('Liquidity Levels')}
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-start text-[11px] sm:text-sm">
                      <span className="text-slate-400">{t('Major Liquidity')}</span>
                      <div className="text-right">
                        <div className="text-rose-400 font-mono text-[10px] sm:text-xs">R: {formatPrice(signal.indicators.liquidityLevels.resistance[0])}</div>
                        <div className="text-emerald-400 font-mono text-[10px] sm:text-xs">S: {formatPrice(signal.indicators.liquidityLevels.support[0])}</div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 sm:py-20">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mb-4 sm:mb-6 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2 text-center">{t('Analysis Unavailable')}</h3>
              <p className="text-slate-400 text-xs sm:text-sm mb-6 text-center max-w-md px-4">
                {t('Not enough data to generate a reliable signal for')} {ticker.symbol}. {t('Please try again later or select another pair.')}
              </p>
              <button 
                onClick={onClose}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors text-sm"
              >
                {t('Go Back')}
              </button>
            </div>
          )}
        </div>
        
        {/* Footer */}
        {signal && (
          <div className="p-3 sm:p-4 border-t border-white/5 bg-[#1a202c] flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
            <p className="text-[10px] sm:text-xs text-slate-500 flex items-center gap-1 text-center sm:text-left">
              <AlertTriangle className="w-3 h-3 shrink-0" /> {t('Not financial advice. Trade at your own risk.')}
            </p>
            <button 
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors text-xs sm:text-sm"
            >
              {t('Close Analysis')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
