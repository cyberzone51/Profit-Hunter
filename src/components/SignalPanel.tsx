import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Kline, TradingSignal } from '../types';
import { formatPrice } from '../utils';
import { X, TrendingUp, TrendingDown, Crosshair, ShieldAlert, Target, Activity, BrainCircuit } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface SignalPanelProps {
  symbol: string | null;
  signal: TradingSignal | null;
  klines: Kline[];
  loading: boolean;
  onClose: () => void;
  onAnalyze: () => void;
}

export const SignalPanel: React.FC<SignalPanelProps> = ({ symbol, signal, klines, loading, onClose, onAnalyze }) => {
  const { t } = useTranslation();
  const chartData = useMemo(() => {
    return klines.map(k => ({
      time: new Date(k.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      price: k.close,
    }));
  }, [klines]);

  const isBullish = chartData.length > 0 && chartData[chartData.length - 1].price >= chartData[0].price;
  const strokeColor = isBullish ? '#34d399' : '#fb7185'; // emerald-400 : rose-400

  if (!symbol) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-[#11151e] border-l border-white/10 flex flex-col h-full shadow-2xl z-50 shrink-0 animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          {symbol} {t('Quick View')}
        </h2>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && !signal ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="text-sm text-slate-400">{t('Running Institutional TA Models...')}</p>
          </div>
        ) : signal ? (
          <div className="space-y-6">
            {/* Real-time Chart */}
            <div className="h-48 w-full bg-[#1a202c] rounded-xl border border-white/5 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={strokeColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['dataMin', 'dataMax']} hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#11151e', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    formatter={(value: number) => [formatPrice(value), 'Price']}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Area type="monotone" dataKey="price" stroke={strokeColor} strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Action Button */}
            <div className="pt-2 space-y-4">
              {signal.winRate > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-blue-400">
                      <BrainCircuit className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">AI Signal Accuracy</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-black block ${signal.winRate >= 0.6 ? 'text-emerald-400' : signal.winRate >= 0.4 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {(signal.winRate * 100).toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {signal.wins} Wins / {signal.losses} Losses
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-rose-500/30 rounded-full h-2 overflow-hidden flex">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-1000"
                      style={{ width: `${signal.winRate * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] font-bold">
                    <span className="text-emerald-400">PROFITABLE</span>
                    <span className="text-rose-400">LOSING</span>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-2 leading-tight italic">
                    Self-learning RL agent is optimizing indicator weights for {symbol}...
                  </p>
                </div>
              )}

              <button 
                onClick={onAnalyze}
                className="relative overflow-hidden w-full py-3 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/30 text-amber-400 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 group"
              >
                <Activity className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{t('Pro Analysis')}</span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-glare z-0"></div>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500 mt-10">
            <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-bold text-white mb-2">{t('No Strong Signal')}</h3>
            <p className="text-sm">
              {t('The AI models did not find a high-probability setup for this asset at the moment.')}
            </p>
          </div>
        )}
      </div>

      <div className="p-4 bg-rose-500/10 border-t border-rose-500/20 text-[10px] text-rose-200/70 leading-relaxed">
        <strong>{t('Disclaimer')}</strong>
      </div>
    </div>
  );
};
