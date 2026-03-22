import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Activity, TrendingUp, TrendingDown, Target, Shield, AlertTriangle, Zap, BarChart2, Waves, ActivitySquare, ArrowUpRight, ArrowDownRight, Layers, BrainCircuit, Anchor, Scale, Globe2, Crosshair } from 'lucide-react';
import { BybitTicker } from '../types';
import { useProAnalysis } from '../hooks/useProAnalysis';
import { formatPrice as utilsFormatPrice } from '../utils';

interface ProAnalysisModalProps {
  ticker: BybitTicker;
  onClose: () => void;
}

export const ProAnalysisModal: React.FC<ProAnalysisModalProps> = ({ ticker, onClose }) => {
  const { t } = useTranslation();
  const { result, loading, error } = useProAnalysis(ticker);

  const formatPrice = (price: number) => {
    return utilsFormatPrice(price);
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
          {loading ? (
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
                      <p className="text-amber-400/80 text-xs">Breakout + volume spike + OI up + Binance confirms + Bybit leads</p>
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
                      ) : result.smartMoney.entryReady ? (
                        <span className="text-emerald-400">{t('Entry-ready after pullback confirmation')}</span>
                      ) : result.smartMoney.setupReady ? (
                        <span className="text-amber-400">{t('Setup confirmed, wait for 0.3%-0.8% pullback')}</span>
                      ) : result.smartMoney.blockedReasons[0] ? (
                        <span className="text-slate-300">{result.smartMoney.blockedReasons[0]}</span>
                      ) : result.score >= 8 ? t('Strong Smart Money Watchlist') : t('Candidate (Wait for better setup)')}
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
                      <div className="text-[9px] text-slate-500">
                        {result.sampleSize > 0 ? `${result.wins}W / ${result.losses}L` : t('No confirmed samples yet')}
                      </div>
                    </div>
                    <div className="w-px h-6 sm:h-8 bg-white/10"></div>
                    <div className="text-center">
                      <div className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">{t('Score')}</div>
                      <div className={`text-lg sm:text-xl font-black ${result.score >= 8 ? 'text-emerald-400' : 'text-white'}`}>{result.score.toFixed(1)} / 10</div>
                    </div>
                    <div className="w-px h-6 sm:h-8 bg-white/10"></div>
                    <div className="text-center">
                      <div className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">{t('5m Move')}</div>
                      <div className={`text-lg sm:text-xl font-black ${result.metrics.priceChange5m > 0 ? 'text-emerald-400' : result.metrics.priceChange5m < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {result.metrics.priceChange5m > 0 ? '+' : ''}{result.metrics.priceChange5m.toFixed(2)}%
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
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Cross Spread</span>
                      <span className={`font-mono font-bold ${result.metrics.crossSpread <= 0.3 ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {result.metrics.crossSpread.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Binance 5m</span>
                      <span className={`font-mono font-bold ${result.metrics.binancePriceChange5m > 0 ? 'text-emerald-400' : result.metrics.binancePriceChange5m < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                        {result.metrics.binancePriceChange5m > 0 ? '+' : ''}{result.metrics.binancePriceChange5m.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Confirmation</span>
                      <span className={`font-mono font-bold ${result.metrics.binanceConfirms && result.metrics.bybitLeads ? 'text-amber-400' : 'text-slate-500'}`}>
                        {result.metrics.binanceConfirms && result.metrics.bybitLeads ? 'CONFIRMED' : 'WAIT'}
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
                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{result.scoreDetails.whales}/1 pt</span>
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
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Large Trades</span>
                      <span className={`font-mono font-bold ${result.metrics.whalesActive ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {result.metrics.largeTradeCount} / {result.metrics.largeTradeThreshold}
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

              {/* Smart Money Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                
                {/* 1. Open Interest */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> 1. {t('Open Interest')}
                    </h4>
                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{result.scoreDetails.oi}/2 pts</span>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Growth (5m)</span>
                      <span className={`font-mono font-bold ${result.metrics.oiGrowth >= 5 ? 'text-emerald-400' : result.metrics.oiGrowth < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
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
                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{result.scoreDetails.funding}/1 pt</span>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Rate</span>
                      <span className={`font-mono font-bold ${result.smartMoney.direction === 'SHORT' ? (result.metrics.fundingPositive ? 'text-emerald-400' : 'text-rose-400') : (result.metrics.fundingNormal ? 'text-emerald-400' : 'text-rose-400')}`}>
                        {(result.metrics.fundingRate * 100).toFixed(4)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {result.smartMoney.direction === 'SHORT'
                        ? (result.metrics.fundingPositive ? t('Crowd is leaning long') : t('Need positive funding for a short'))
                        : (result.metrics.fundingNormal ? t('Neutral/Healthy') : t('Funding too crowded'))}
                    </div>
                  </div>
                </div>

                {/* 3. Order Flow & Delta */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <ActivitySquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" /> 3. {t('Order Flow')}
                    </h4>
                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{result.scoreDetails.delta}/2 pts</span>
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
                      <span className={`font-mono font-bold ${result.metrics.tradesPerMin >= 300 ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {result.metrics.tradesPerMin}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Momentum */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" /> 4. {t('Momentum')}
                    </h4>
                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{result.scoreDetails.momentum}/2 pts</span>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Price Change (5m)</span>
                      <span className={`font-mono font-bold ${result.metrics.priceChange5m >= 1.5 ? 'text-emerald-400' : result.metrics.priceChange5m <= -1.5 ? 'text-rose-400' : 'text-slate-300'}`}>
                        {result.metrics.priceChange5m > 0 ? '+' : ''}{result.metrics.priceChange5m.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {Math.abs(result.metrics.priceChange5m) > 5
                        ? t('Too extended, skip the move')
                        : Math.abs(result.metrics.priceChange5m) >= 1.5
                          ? t('Impulse is strong enough')
                          : t('Need stronger 5m momentum')}
                    </div>
                  </div>
                </div>

                {/* 5. Volume & Entry */}
                <div className="bg-[#1a202c] p-3 sm:p-4 rounded-xl border border-white/5 md:col-span-2 lg:col-span-2">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Waves className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" /> 5. {t('Volume & Entry')}
                    </h4>
                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{result.scoreDetails.volume}/2 pts</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Turnover 24h</span>
                      <span className={`font-mono font-bold ${result.metrics.turnover >= 100000000 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${formatNumber(result.metrics.turnover)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Volume Spike</span>
                      <span className={`font-mono font-bold ${result.metrics.volumeSpike ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {result.metrics.volumeRatio.toFixed(2)}x
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Pullback</span>
                      <span className={`font-mono font-bold ${result.metrics.pullbackReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {result.metrics.pullbackPct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-sm">
                      <span className="text-slate-400">Entry / SL / TP</span>
                      <span className="font-mono font-bold text-slate-300 text-[10px]">
                        {formatPrice(result.metrics.entryPrice)} / {formatPrice(result.metrics.stopLoss)} / {formatPrice(result.metrics.takeProfit)}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              <div className="bg-[#1a202c] p-4 rounded-xl border border-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-blue-400" /> {t('Smart Money Checklist')}
                  </h4>
                  <div className="text-[10px] sm:text-xs text-slate-500">
                    {result.smartMoney.direction === 'NONE' ? t('No directional bias yet') : `${result.smartMoney.direction} bias`}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 text-[11px] sm:text-sm">
                  {[
                    { label: 'Pre-filter', ok: result.smartMoney.preFilterPassed },
                    { label: 'Volume spike >= 2x', ok: result.metrics.volumeSpike },
                    { label: 'Momentum >= 1.5%', ok: Math.abs(result.metrics.priceChange5m) >= 1.5 },
                    { label: 'OI change >= 5%', ok: result.metrics.oiGrowth >= 5 },
                    { label: 'Delta aligned', ok: result.smartMoney.direction === 'LONG' ? result.metrics.deltaPositive : result.smartMoney.direction === 'SHORT' ? result.metrics.deltaNegative : false },
                    { label: 'Funding in range', ok: result.smartMoney.direction === 'SHORT' ? result.metrics.fundingPositive : result.metrics.fundingNormal },
                    { label: 'Whales active', ok: result.metrics.whalesActive },
                    { label: 'Pullback ready', ok: result.metrics.pullbackReady },
                    { label: 'Binance confirms', ok: result.metrics.binanceConfirms },
                    { label: 'Bybit leads', ok: result.metrics.bybitLeads }
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between bg-[#0b0e14] rounded-lg px-3 py-2 border border-white/5">
                      <span className="text-slate-300">{item.label}</span>
                      <span className={`font-bold ${item.ok ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {item.ok ? 'YES' : 'NO'}
                      </span>
                    </div>
                  ))}
                </div>
                {result.smartMoney.blockedReasons.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                    {result.smartMoney.blockedReasons.slice(0, 3).map((reason) => (
                      <div key={reason} className="text-[11px] sm:text-sm text-slate-400 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-400 shrink-0" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
