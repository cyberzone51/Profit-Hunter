import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Activity, TrendingUp, TrendingDown, Target, Shield, AlertTriangle, Zap, BarChart2, Waves, ActivitySquare, ArrowUpRight, ArrowDownRight, Layers, Lock, Wallet, CheckCircle2, BrainCircuit, Anchor, Scale, Globe2, Crosshair } from 'lucide-react';
import { BybitTicker } from '../types';
import { useProAnalysis } from '../hooks/useProAnalysis';
import { formatPrice as utilsFormatPrice } from '../utils';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount, useDisconnect } from 'wagmi';

interface ProAnalysisModalProps {
  ticker: BybitTicker;
  onClose: () => void;
}

export const ProAnalysisModal: React.FC<ProAnalysisModalProps> = ({ ticker, onClose }) => {
  const { t } = useTranslation();
  const { result, loading, error } = useProAnalysis(ticker);
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

  const formatNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0" />
      
      <div className="relative bg-[#11151e] border-x sm:border border-white/10 rounded-none sm:rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 bg-[#1a202c] shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {t('Pro Analysis')} <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">AI</span>
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
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">{t('Analysis Failed')}</h3>
              <p className="text-slate-400 text-sm">{error}</p>
            </div>
          ) : result ? (
            <div className="space-y-5 sm:space-y-6">
              
              {/* Elite Trade Banner */}
              {result.signal === 'ELITE TRADE' && (
                <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/50 rounded-xl p-4 flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                      <Zap className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-amber-400 font-black text-lg tracking-wider">ELITE TRADE DETECTED</h3>
                      <p className="text-amber-400/80 text-xs">Arbitrage + OI Growth + Volume Spike + Leader Exchange Confluence</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Verdict Card */}
              <div className={`p-4 sm:p-6 rounded-xl border ${
                result.signal === 'ELITE TRADE' ? 'bg-amber-500/10 border-amber-500/30' :
                result.signal.includes('LONG') ? 'bg-emerald-500/10 border-emerald-500/20' : 
                result.signal.includes('SHORT') ? 'bg-rose-500/10 border-rose-500/20' : 
                'bg-slate-500/10 border-slate-500/20'
              }`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {result.signal === 'ELITE TRADE' ? <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" /> :
                       result.signal.includes('LONG') ? <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" /> : 
                       result.signal.includes('SHORT') ? <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400" /> : 
                       <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />}
                      <h3 className={`text-xl sm:text-2xl font-black ${
                        result.signal === 'ELITE TRADE' ? 'text-amber-400' :
                        result.signal.includes('LONG') ? 'text-emerald-400' : 
                        result.signal.includes('SHORT') ? 'text-rose-400' : 
                        'text-slate-400'
                      }`}>
                        {result.signal === 'NEUTRAL' ? t('NO ACTIVE SIGNAL') : t(result.signal)}
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium">
                      {!result.candidate ? (
                        <span className="text-rose-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> {t('Rejected')}: {result.rejectReason}</span>
                      ) : result.aiProbability < 50 ? (
                        <span className="text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> {t('Low AI Probability')}</span>
                      ) : result.score >= 7 ? t('High Probability Trade') : t('Candidate (Wait for better setup)')}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 sm:gap-4 bg-[#0b0e14] p-2.5 sm:p-3 rounded-lg border border-white/5 w-full sm:w-auto justify-around sm:justify-start">
                    <div className="text-center">
                      <div className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1 flex items-center justify-center gap-1"><BrainCircuit className="w-3 h-3"/> AI Prob</div>
                      <div className={`text-lg sm:text-xl font-black ${result.aiProbability >= 80 ? 'text-emerald-400' : result.aiProbability >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {result.aiProbability}%
                      </div>
                    </div>
                    <div className="w-px h-6 sm:h-8 bg-white/10"></div>
                    <div className="text-center">
                      <div className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1 flex items-center justify-center gap-1"><Zap className="w-3 h-3"/> Win Rate</div>
                      <div className={`text-lg sm:text-xl font-black ${result.winRate >= 0.6 ? 'text-emerald-400' : result.winRate >= 0.4 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {result.winRate > 0 ? (result.winRate * 100).toFixed(1) + '%' : '-'}
                      </div>
                    </div>
                    <div className="w-px h-6 sm:h-8 bg-white/10"></div>
                    <div className="text-center">
                      <div className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">{t('Score')}</div>
                      <div className={`text-lg sm:text-xl font-black ${result.score >= 7 ? 'text-emerald-400' : 'text-white'}`}>{result.score.toFixed(1)} / 11</div>
                    </div>
                    <div className="w-px h-6 sm:h-8 bg-white/10"></div>
                    <div className="text-center">
                      <div className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">{t('Delta')}</div>
                      <div className={`text-lg sm:text-xl font-black ${result.metrics.delta > 0 ? 'text-emerald-400' : result.metrics.delta < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {result.metrics.delta > 0 ? '+' : ''}{formatNumber(result.metrics.delta)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                
                {/* Cross-Exchange / Arbitrage */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Globe2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" /> {t('Cross-Exchange')}
                    </h4>
                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{result.scoreDetails.arbitrage}/2 pts</span>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Arbitrage Spread</span>
                      <span className={`font-mono font-bold ${result.metrics.crossSpread >= 0.5 ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {result.metrics.crossSpread.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Leader Signal</span>
                      <span className={`font-mono font-bold ${result.metrics.leaderSignal ? 'text-amber-400' : 'text-slate-500'}`}>
                        {result.metrics.leaderSignal ? 'DIVERGENCE' : 'SYNCED'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Whale Tracker */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Anchor className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" /> {t('Whale Tracker')}
                    </h4>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Whale Buys</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ${formatNumber(result.metrics.whaleBuyVol)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Whale Sells</span>
                      <span className="font-mono font-bold text-rose-400">
                        ${formatNumber(result.metrics.whaleSellVol)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Orderbook Imbalance */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Scale className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" /> {t('Orderbook')}
                    </h4>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Imbalance</span>
                      <span className={`font-mono font-bold ${result.metrics.orderbookImbalance > 0.2 ? 'text-emerald-400' : result.metrics.orderbookImbalance < -0.2 ? 'text-rose-400' : 'text-slate-300'}`}>
                        {(result.metrics.orderbookImbalance * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 flex overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: `${(result.metrics.orderbookImbalance + 1) / 2 * 100}%` }}></div>
                      <div className="bg-rose-500 h-full flex-1"></div>
                    </div>
                  </div>
                </div>

                {/* Support & Resistance */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Crosshair className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" /> {t('Levels & ATR')}
                    </h4>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Res / Sup</span>
                      <span className="font-mono font-bold text-slate-300 text-[10px]">
                        {formatPrice(result.metrics.resistance)} / {formatPrice(result.metrics.support)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">ATR (Volatility)</span>
                      <span className="font-mono font-bold text-amber-400">
                        {formatPrice(result.metrics.atr)}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Top 5 Institutional Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                
                {/* 1. Open Interest */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> 1. {t('Open Interest')}
                    </h4>
                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{result.scoreDetails.oi}/3 pts</span>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Growth (5m)</span>
                      <span className={`font-mono font-bold ${result.metrics.oiGrowth >= 2 ? 'text-emerald-400' : result.metrics.oiGrowth < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                        {result.metrics.oiGrowth > 0 ? '+' : ''}{result.metrics.oiGrowth.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Value</span>
                      <span className="font-mono font-bold text-slate-300">
                        ${formatNumber(result.metrics.openInterestValue)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Funding Rate */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <BarChart2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" /> 2. {t('Funding Rate')}
                    </h4>
                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{result.scoreDetails.funding}/2 pts</span>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Rate</span>
                      <span className={`font-mono font-bold ${Math.abs(result.metrics.fundingRate) < 0.005 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(result.metrics.fundingRate * 100).toFixed(4)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {Math.abs(result.metrics.fundingRate) > 0.01 ? t('Extreme (Reversal risk)') : t('Neutral/Healthy')}
                    </div>
                  </div>
                </div>

                {/* 3. Order Flow & Delta */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <ActivitySquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" /> 3. {t('Order Flow')}
                    </h4>
                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{result.scoreDetails.delta + result.scoreDetails.orderflow}/4 pts</span>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Delta</span>
                      <span className={`font-mono font-bold ${result.metrics.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {result.metrics.delta > 0 ? '+' : ''}{formatNumber(result.metrics.delta)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Trades / Min</span>
                      <span className={`font-mono font-bold ${result.metrics.tradesPerMin >= 150 ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {result.metrics.tradesPerMin}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Liquidations */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" /> 4. {t('Liquidations')}
                    </h4>
                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{result.scoreDetails.liquidations}/2 pts</span>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Recent Liq Vol</span>
                      <span className={`font-mono font-bold ${result.metrics.liquidations > 10000 ? 'text-amber-400' : 'text-slate-300'}`}>
                        ${formatNumber(result.metrics.liquidations)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {result.metrics.liquidations > 100000 ? t('Massive Liquidations') : result.metrics.liquidations > 0 ? t('Liquidations Detected') : t('No recent liquidations')}
                    </div>
                  </div>
                </div>

                {/* 5. Volume & Liquidity */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5 md:col-span-2 lg:col-span-2">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Waves className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" /> 5. {t('Liquidity')}
                    </h4>
                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">Base</span>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Turnover 24h</span>
                      <span className={`font-mono font-bold ${result.metrics.turnover >= 50000000 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${formatNumber(result.metrics.turnover)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Volume Spike</span>
                      <span className={`font-mono font-bold ${result.metrics.volumeSpike ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {result.metrics.volumeSpike ? t('YES') : t('NO')}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
