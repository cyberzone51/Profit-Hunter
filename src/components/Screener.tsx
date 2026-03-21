import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTickers } from '../hooks/useTickers';
import { useCoinSignal } from '../hooks/useCoinSignal';
import { SignalPanel } from './SignalPanel';
import { BybitTicker, SortField, SortDirection, Exchange } from '../types';
import { formatPrice, formatVolume, formatPercent, calc1hChange, getSignalType, getTradeSetup } from '../utils';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Activity, Clock, Zap, LayoutGrid, List, TrendingUp, TrendingDown, Target, Shield, Sparkles, X, Globe, CircleDollarSign, Send, Twitter, BrainCircuit, ChevronDown } from 'lucide-react';

const EXCHANGE_TIERS: Record<string, { label: string; exchanges: Exchange[] }> = {
  'Tier 1': {
    label: '🔴 Tier 1',
    exchanges: ['Binance', 'Coinbase', 'Kraken', 'OKX']
  },
  'Tier 2': {
    label: '🟡 Tier 2',
    exchanges: ['Bybit', 'Bitget', 'Deribit']
  },
  'Tier 3': {
    label: '🟢 Tier 3',
    exchanges: ['KuCoin', 'MEXC', 'Gate.io']
  }
};
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';
import { ProAnalysisModal } from './ProAnalysisModal';
import { TermsModal } from './TermsModal';
import { API_URL } from '../config';

const EXCHANGE_DOMAINS: Record<Exchange, string> = {
  'Binance': 'binance.com',
  'Bybit': 'bybit.com',
  'OKX': 'okx.com',
  'KuCoin': 'kucoin.com',
  'MEXC': 'mexc.com',
  'Gate.io': 'gate.io',
  'Bitget': 'bitget.com',
  'Kraken': 'kraken.com',
  'Coinbase': 'coinbase.com',
  'Deribit': 'deribit.com'
};

const ExchangeIcon = ({ exchange, className = "w-4 h-4" }: { exchange: Exchange; className?: string }) => {
  return (
    <img 
      src={`https://www.google.com/s2/favicons?domain=${EXCHANGE_DOMAINS[exchange]}&sz=64`}
      alt={exchange}
      className={`${className} rounded-sm object-contain`}
      referrerPolicy="no-referrer"
    />
  );
};

const SignalAccuracyBar = ({ stats, winRate, t }: { stats: any, winRate: number, t: any }) => (
  <div className="w-full lg:w-64 bg-[#1a202c]/50 rounded-lg p-2 border border-white/5">
    <div className="flex justify-between items-center mb-1.5">
      <div className="flex items-center gap-1.5">
        <Target className="w-3 h-3 text-blue-400" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Signal Accuracy')}</span>
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={() => {
            if (confirm(t('Reset signal statistics?'))) {
              setStats({ wins: 0, losses: 0 });
            }
          }}
          className="p-1 hover:bg-white/10 rounded transition-colors text-slate-500 hover:text-slate-300"
          title={t('Reset Stats')}
        >
          <X className="w-2.5 h-2.5" />
        </button>
        <span className={`text-[10px] font-black ${winRate >= 70 ? 'text-emerald-400' : winRate >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
          {winRate}%
        </span>
      </div>
    </div>
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
      <div 
        className="h-full bg-emerald-500 transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" 
        style={{ width: `${winRate}%` }} 
      />
      <div 
        className="h-full bg-rose-500/50 transition-all duration-500" 
        style={{ width: `${100 - winRate}%` }} 
      />
    </div>
    <div className="flex justify-between mt-1 text-[8px] font-bold uppercase tracking-tighter">
      <span className="text-emerald-500/70">{stats.wins} {t('Wins')}</span>
      <span className="text-rose-500/70">{stats.losses} {t('Losses')}</span>
    </div>
  </div>
);

const LazyChart = React.memo(({ symbol, timeframe, exchange }: { symbol: string; timeframe: string; exchange: Exchange }) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.01, rootMargin: '200px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const getExchangePrefix = (ex: Exchange) => {
    switch (ex) {
      case 'Binance': return 'BINANCE';
      case 'Bybit': return 'BYBIT';
      case 'OKX': return 'OKX';
      case 'KuCoin': return 'KUCOIN';
      case 'MEXC': return 'MEXC';
      case 'Gate.io': return 'GATEIO';
      case 'Bitget': return 'BITGET';
      case 'Kraken': return 'KRAKEN';
      case 'Coinbase': return 'COINBASE';
      case 'Deribit': return 'DERIBIT';
      default: return 'BYBIT';
    }
  };

  return (
    <div ref={containerRef} className="h-full w-full bg-[#0b0e14] relative overflow-hidden">
      {isVisible ? (
        <AdvancedRealTimeChart
          symbol={`${getExchangePrefix(exchange)}:${symbol}.P`}
          theme="dark"
          autosize
          hide_side_toolbar={true}
          hide_top_toolbar={true}
          interval={timeframe as any}
          timezone="Etc/UTC"
          style="1"
          locale="en"
          enable_publishing={false}
          allow_symbol_change={false}
          save_image={false}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full w-full gap-2 opacity-10">
          <Activity className="w-6 h-6 animate-pulse text-slate-500" />
        </div>
      )}
    </div>
  );
});

export const Screener: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [selectedExchange, setSelectedExchange] = useState<Exchange>('Bybit');
  const { tickers, loading, error, lastUpdated } = useTickers(selectedExchange);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('turnover24h');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [timeframe, setTimeframe] = useState<string>('5');
  const [activeFilter, setActiveFilter] = useState<'all' | 'signals' | 'near_levels' | 'consolidation' | 'new_listings'>('all');
  const [analyzingSymbol, setAnalyzingSymbol] = useState<string | null>(null);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(true); // Default to true to prevent flash, then check in effect
  const [showTerms, setShowTerms] = useState(false);
  const [showExchangeMenu, setShowExchangeMenu] = useState(false);
  const exchangeMenuRef = useRef<HTMLDivElement>(null);

  // Signal Accuracy Tracking
  const [stats, setStats] = useState(() => {
    try {
      const saved = localStorage.getItem('profit_hunter_signal_stats');
      return saved ? JSON.parse(saved) : { wins: 0, losses: 0 };
    } catch (e) {
      return { wins: 0, losses: 0 };
    }
  });

  const trackedSignalsRef = useRef<Record<string, { type: string; tp: number; sl: number; entry: number }>>({});

  useEffect(() => {
    localStorage.setItem('profit_hunter_signal_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    if (tickers.length === 0) return;

    tickers.forEach(ticker => {
      const setup = getTradeSetup(ticker);
      const symbol = ticker.symbol;
      const currentPrice = Number(ticker.lastPrice);
      const existing = trackedSignalsRef.current[symbol];

      // If no signal from getTradeSetup, clear the completed status to allow new signals for this symbol later
      if (!setup) {
        if (existing && existing.status !== 'active') {
          delete trackedSignalsRef.current[symbol];
        }
        return;
      }

      // If we have a setup and aren't tracking anything for this symbol yet
      if (!existing) {
        trackedSignalsRef.current[symbol] = {
          type: setup.type,
          tp: setup.tp,
          sl: setup.sl,
          entry: setup.entry,
          status: 'active'
        };
      } 
      // If we are tracking an active signal, check for TP/SL hits
      else if (existing.status === 'active') {
        if (existing.type === 'LONG') {
          if (currentPrice >= existing.tp) {
            setStats(prev => ({ ...prev, wins: prev.wins + 1 }));
            existing.status = 'won';
          } else if (currentPrice <= existing.sl) {
            setStats(prev => ({ ...prev, losses: prev.losses + 1 }));
            existing.status = 'lost';
          }
        } else if (existing.type === 'SHORT') {
          if (currentPrice <= existing.tp) {
            setStats(prev => ({ ...prev, wins: prev.wins + 1 }));
            existing.status = 'won';
          } else if (currentPrice >= existing.sl) {
            setStats(prev => ({ ...prev, losses: prev.losses + 1 }));
            existing.status = 'lost';
          }
        }
      }
      // If status is 'won' or 'lost', we do nothing. 
      // The signal will stay in this state until getTradeSetup(ticker) returns null,
      // which will then trigger the deletion (reset) in the first 'if (!setup)' block.
    });
  }, [tickers]);

  const winRate = useMemo(() => {
    const total = stats.wins + stats.losses;
    return total === 0 ? 0 : Math.round((stats.wins / total) * 100);
  }, [stats]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exchangeMenuRef.current && !exchangeMenuRef.current.contains(event.target as Node)) {
        setShowExchangeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  useEffect(() => {
    try {
      const accepted = localStorage.getItem('profit_hunter_terms_accepted') === 'true';
      if (!accepted) {
        setHasAcceptedTerms(false);
        setShowTerms(true);
      }
    } catch (e) {
      setHasAcceptedTerms(false);
      setShowTerms(true);
    }
  }, []);

  const handleAcceptTerms = () => {
    try {
      localStorage.setItem('profit_hunter_terms_accepted', 'true');
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
    setHasAcceptedTerms(true);
    setShowTerms(false);
  };
  
  const selectedTicker = useMemo(() => tickers.find(t => t.symbol === selectedSymbol) || null, [tickers, selectedSymbol]);
  const { signal, klines, loading: signalLoading } = useCoinSignal(selectedSymbol, selectedTicker);

  const tickersRef = useRef<BybitTicker[]>([]);
  
  useEffect(() => {
    tickersRef.current = tickers;
  }, [tickers]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1 text-blue-400" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 text-blue-400" />
    );
  };

  const filteredAndSortedTickers = useMemo(() => {
    let result = tickers.filter((t) =>
      t.symbol.toLowerCase().includes(search.toLowerCase())
    );

    if (activeFilter !== 'all') {
      result = result.filter((t) => {
        const signal = getSignalType(t);
        if (activeFilter === 'signals') {
          return ['LONG_REV', 'SHORT_REV', 'LONG_TREND', 'SHORT_TREND'].includes(signal);
        }
        if (activeFilter === 'consolidation') {
          return signal === 'CONS';
        }
        if (activeFilter === 'near_levels') {
          const high24h = Number(t.highPrice24h);
          const low24h = Number(t.lowPrice24h);
          const toRes = ((high24h - Number(t.lastPrice)) / Number(t.lastPrice)) * 100;
          const toSup = ((Number(t.lastPrice) - low24h) / Number(t.lastPrice)) * 100;
          return toRes < 1.5 || toSup < 1.5;
        }
        if (activeFilter === 'new_listings') {
          const launchTime = Number(t.launchTime || 0);
          // If launchTime is in seconds (less than 10^10), convert to ms
          const launchTimeMs = launchTime > 0 && launchTime < 10000000000 ? launchTime * 1000 : launchTime;
          return launchTimeMs > 0 && (Date.now() - launchTimeMs) <= 2592000000;
        }
        return true;
      });
    }

    result.sort((a, b) => {
      let valA: number;
      let valB: number;

      switch (sortField) {
        case 'symbol':
          return sortDirection === 'asc'
            ? a.symbol.localeCompare(b.symbol)
            : b.symbol.localeCompare(a.symbol);
        case 'lastPrice':
          valA = Number(a.lastPrice);
          valB = Number(b.lastPrice);
          break;
        case 'change1h':
          valA = calc1hChange(a.lastPrice, a.prevPrice1h);
          valB = calc1hChange(b.lastPrice, b.prevPrice1h);
          break;
        case 'change24h':
          valA = Number(a.price24hPcnt);
          valB = Number(b.price24hPcnt);
          break;
        case 'turnover24h':
          valA = Number(a.turnover24h);
          valB = Number(b.turnover24h);
          break;
        case 'fundingRate':
          valA = Number(a.fundingRate);
          valB = Number(b.fundingRate);
          break;
        case 'openInterestValue':
          valA = Number(a.openInterestValue || 0);
          valB = Number(b.openInterestValue || 0);
          break;
        case 'toRes':
          valA = ((Number(a.highPrice24h) - Number(a.lastPrice)) / Number(a.lastPrice)) * 100;
          valB = ((Number(b.highPrice24h) - Number(b.lastPrice)) / Number(b.lastPrice)) * 100;
          break;
        case 'toSup':
          valA = ((Number(a.lastPrice) - Number(a.lowPrice24h)) / Number(a.lastPrice)) * 100;
          valB = ((Number(b.lastPrice) - Number(b.lowPrice24h)) / Number(b.lastPrice)) * 100;
          break;
        case 'launchTime':
          valA = Number(a.launchTime || 0);
          valB = Number(b.launchTime || 0);
          break;
        default:
          valA = 0;
          valB = 0;
      }

      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [tickers, search, sortField, sortDirection, activeFilter]);

  const getColorClass = (val: number) => {
    if (val > 0) return 'text-emerald-400';
    if (val < 0) return 'text-rose-400';
    return 'text-slate-400';
  };

  const getQuickSignal = (ticker: BybitTicker) => {
    const signalType = getSignalType(ticker);
    
    switch (signalType) {
      case 'LONG_REV':
        return <span className="text-emerald-400 flex items-center gap-1 font-bold"><TrendingUp className="w-3 h-3"/> {t('LONG Reversal')}</span>;
      case 'SHORT_REV':
        return <span className="text-rose-400 flex items-center gap-1 font-bold"><TrendingDown className="w-3 h-3"/> {t('SHORT Reversal')}</span>;
      case 'LONG_TREND':
        return <span className="text-emerald-400 flex items-center gap-1 font-bold"><ArrowUp className="w-3 h-3"/> {t('LONG Trend')}</span>;
      case 'SHORT_TREND':
        return <span className="text-rose-400 flex items-center gap-1 font-bold"><ArrowDown className="w-3 h-3"/> {t('SHORT Trend')}</span>;
      case 'CONS':
        return <span className="text-blue-400 flex items-center gap-1 font-bold"><Activity className="w-3 h-3"/> {t('Consolidation')}</span>;
      case 'OVERHEATED_LONG':
        return <span className="text-amber-400 text-xs">{t('Overheated Longs')}</span>;
      case 'OVERHEATED_SHORT':
        return <span className="text-amber-400 text-xs">{t('Overheated Shorts')}</span>;
      default:
        return <span className="text-slate-600">-</span>;
    }
  };

  const timeframes = [
    { label: '1m', value: '1' },
    { label: '5m', value: '5' },
    { label: '15m', value: '15' },
    { label: '1h', value: '60' },
    { label: '4h', value: '240' },
    { label: '1D', value: 'D' },
  ];

  const languages = [
    { code: 'en', label: 'EN' },
    { code: 'ru', label: 'RU' },
    { code: 'ko', label: 'KO' },
    { code: 'ja', label: 'JA' },
    { code: 'zh', label: 'ZH' },
    { code: 'vi', label: 'VI' },
    { code: 'id', label: 'ID' },
    { code: 'de', label: 'DE' },
    { code: 'cs', label: 'CS' },
    { code: 'it', label: 'IT' },
    { code: 'fr', label: 'FR' },
    { code: 'es', label: 'ES' },
  ];

  useEffect(() => {
    let baseUrl = API_URL;
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    const pingServer = async () => {
      try {
        await fetch(`${baseUrl}/api/health`).catch(() => {});
      } catch (e) {}
    };
    pingServer();
    
    console.log('App Environment:', {
      VITE_API_URL: API_URL,
      NODE_ENV: import.meta.env.MODE,
      origin: window.location.origin
    });
    
    const checkVersion = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/version`);
        if (res.ok) {
          const data = await res.json();
          // In production, we compare versions
          // For now, we just log it
          console.log(`Client version: ${__APP_VERSION__}, Server version: ${data.version}`);
        }
      } catch (err) {
        console.error('Version check failed:', err);
      }
    };
    
    checkVersion();
    const interval = setInterval(checkVersion, 300000); // Check every 5 mins
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-[100dvh] w-full bg-[#0b0e14] text-slate-200 font-sans overflow-hidden relative">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header */}
        <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between px-3 sm:px-6 py-3 sm:py-4 bg-[#11151e] border-b border-white/5 shrink-0 gap-3 sm:gap-4">
          <div className="flex items-center justify-between w-full lg:w-auto">
            <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto">
              <div className="w-12 h-12 sm:w-24 sm:h-24 shrink-0 rounded-full border border-white/10 shadow-xl shadow-blue-500/20 overflow-hidden bg-[#1a202c] flex items-center justify-center p-1 sm:p-2">
                <img 
                  src="https://cdn-icons-png.flaticon.com/512/2489/2489756.png" 
                  alt="Profit Hunter Logo" 
                  className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between lg:block">
                  <h1 className="text-sm min-[380px]:text-base sm:text-2xl font-bold tracking-[0.2em] sm:tracking-[0.3em] leading-none mb-0.5 sm:mb-1 font-display uppercase italic shimmer-text relative whitespace-nowrap">
                    Profit Hunter
                  </h1>
                  {/* Mobile Top Right Controls */}
                  <div className="flex lg:hidden items-center gap-1.5 shrink-0 ml-2">
                    <div className="flex items-center bg-[#1a202c] rounded-lg p-0.5 border border-white/10">
                      <div className="relative flex items-center">
                        <Globe className="w-3 h-3 text-slate-500 ml-1" />
                        <select
                          value={i18n.language}
                          onChange={(e) => i18n.changeLanguage(e.target.value)}
                          className="bg-transparent text-slate-300 text-[9px] font-medium py-1 pl-0.5 pr-1.5 appearance-none focus:outline-none cursor-pointer"
                        >
                          {languages.map((lang) => (
                            <option key={lang.code} value={lang.code} className="bg-[#1a202c]">
                              {lang.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-[8px] sm:text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-1 sm:mb-1.5 opacity-80">
                  Pro Crypto Screener
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-[8px] sm:text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${error ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                    {error ? 'Offline' : 'Online'}
                  </span>
                  <span>•</span>
                  <span>{tickers.length} Pairs</span>
                </div>
              </div>
            </div>

            {/* Desktop Search Bar & Accuracy */}
            <div className="hidden lg:flex flex-col gap-2 items-end ml-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder={t('Search coins...')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 bg-[#1a202c] border border-white/10 rounded-md text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all w-64 placeholder:text-slate-600"
                />
              </div>
              <SignalAccuracyBar stats={stats} winRate={winRate} t={t} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full lg:w-auto justify-between lg:justify-end">
            {/* Exchange Selector */}
            <div className="relative" ref={exchangeMenuRef}>
              <button
                onClick={() => setShowExchangeMenu(!showExchangeMenu)}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-[#1a202c] border border-white/10 rounded-lg text-[10px] sm:text-xs font-bold text-slate-300 hover:text-white hover:border-white/20 transition-all"
              >
                <ExchangeIcon exchange={selectedExchange} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{selectedExchange}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showExchangeMenu ? 'rotate-180' : ''}`} />
              </button>

              {showExchangeMenu && (
                <div className="absolute top-full left-0 lg:left-auto lg:right-0 mt-2 w-[calc(100vw-32px)] sm:w-72 bg-[#11151e] border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-3 border-b border-white/5 bg-white/5">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Exchange</h3>
                  </div>
                  <div className="max-h-[60dvh] overflow-y-auto custom-scrollbar">
                    {Object.entries(EXCHANGE_TIERS).map(([tier, data]) => (
                      <div key={tier} className="p-2">
                        <div className="px-2 py-1 mb-1">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{data.label}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {data.exchanges.map((ex) => (
                            <button
                              key={ex}
                              onClick={() => {
                                setSelectedExchange(ex);
                                setShowExchangeMenu(false);
                              }}
                              className={`px-3 py-2.5 rounded-lg text-left text-xs font-medium transition-all flex items-center gap-2 ${
                                selectedExchange === ex
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                              }`}
                            >
                              <ExchangeIcon exchange={ex} className="w-3.5 h-3.5" />
                              {ex}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {viewMode === 'grid' && (
              <div className="flex items-center bg-[#1a202c] rounded-lg p-1 border border-white/10 text-[9px] sm:text-xs font-medium overflow-x-auto no-scrollbar">
                {timeframes.map((tf) => (
                  <button
                    key={tf.value}
                    onClick={() => setTimeframe(tf.value)}
                    className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
                      timeframe === tf.value
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto lg:ml-0">
              <div className="flex items-center bg-[#1a202c] rounded-lg p-1 border border-white/10">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                  title="Grid View (Charts)"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                  title="Table View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full lg:w-auto mt-2 lg:mt-0">
              <div className="flex items-center gap-2 w-full lg:w-auto">
                {/* Mobile Search Bar */}
                <div className="lg:hidden relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder={t('Search coins...')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 bg-[#1a202c] border border-white/10 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-600"
                  />
                </div>

                {/* Desktop Language Selector */}
                <div className="hidden lg:flex items-center bg-[#1a202c] rounded-lg p-1 border border-white/10">
                  <div className="relative flex items-center">
                    <Globe className="w-3.5 h-3.5 text-slate-500 ml-2" />
                    <select
                      value={i18n.language}
                      onChange={(e) => i18n.changeLanguage(e.target.value)}
                      className="bg-transparent text-slate-300 text-[10px] sm:text-xs font-medium py-1 pl-1.5 pr-5 appearance-none focus:outline-none cursor-pointer"
                    >
                      {languages.map((lang) => (
                        <option key={lang.code} value={lang.code} className="bg-[#1a202c]">
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Mobile Signal Accuracy Bar */}
              <div className="lg:hidden">
                <SignalAccuracyBar stats={stats} winRate={winRate} t={t} />
              </div>
            </div>

          </div>
        </header>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 px-3 sm:px-6 py-2 bg-[#0b0e14] border-b border-white/5 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[9px] sm:text-xs text-slate-500 font-bold uppercase tracking-tighter mr-1 shrink-0">{t('Filters')}</span>
          <button 
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${activeFilter === 'all' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-[#1a202c] text-slate-400 border border-white/5 hover:bg-white/5'}`}
          >
            {t('All')}
          </button>
          <button 
            onClick={() => setActiveFilter('signals')}
            className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${activeFilter === 'signals' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#1a202c] text-slate-400 border border-white/5 hover:bg-white/5'}`}
          >
            🔥 {t('Signals')}
          </button>
          <button 
            onClick={() => setActiveFilter('near_levels')}
            className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${activeFilter === 'near_levels' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-[#1a202c] text-slate-400 border border-white/5 hover:bg-white/5'}`}
          >
            🎯 {t('Near Levels')} (&lt;1.5%)
          </button>
          <button 
            onClick={() => setActiveFilter('consolidation')}
            className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${activeFilter === 'consolidation' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-[#1a202c] text-slate-400 border border-white/5 hover:bg-white/5'}`}
          >
            📉 {t('Consolidation')}
          </button>
          <button 
            onClick={() => setActiveFilter('new_listings')}
            className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${activeFilter === 'new_listings' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-[#1a202c] text-slate-400 border border-white/5 hover:bg-white/5'}`}
          >
            ✨ {t('New Listings')}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {loading && tickers.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error && tickers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="text-rose-500 mb-4 bg-rose-500/10 p-4 rounded-xl border border-rose-500/20">
                <p className="text-lg font-medium mb-2">{t('Connection error. Please check your internet or refresh.')}</p>
                <p className="text-xs opacity-60 font-mono">
                  Error: {error}<br/>
                  Attempted URL: {API_URL + '/api/tickers'}<br/>
                  Origin: {window.location.origin}
                </p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg shadow-blue-600/20"
              >
                {t('Refresh Application')}
              </button>
            </div>
          ) : filteredAndSortedTickers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Search className="w-12 h-12 mb-4 opacity-20" />
              <p>{
                activeFilter === 'new_listings' ? t('No new listings in the last 30 days') : 
                activeFilter === 'signals' ? t('No active signals right now (market is calm)') : 
                t('No coins found')
              }</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAndSortedTickers.map((ticker) => {
                const change1h = calc1hChange(ticker.lastPrice, ticker.prevPrice1h);
                const change24h = Number(ticker.price24hPcnt) * 100;
                const funding = Number(ticker.fundingRate) * 100;
                const isSelected = selectedSymbol === ticker.symbol;

                return (
                  <div 
                    key={ticker.symbol} 
                    className={`bg-[#11151e] rounded-xl border overflow-hidden flex flex-col transition-all duration-200 ${
                      isSelected ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="h-64 sm:h-80 w-full border-b border-white/5 bg-[#0b0e14]">
                      <LazyChart key={`${ticker.symbol}-${timeframe}-${selectedExchange}`} symbol={ticker.symbol} timeframe={timeframe} exchange={selectedExchange} />
                    </div>
                    <div 
                      className="p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => setSelectedSymbol(ticker.symbol)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base sm:text-lg text-white">{ticker.symbol.replace('USDT', '')}</span>
                          <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded font-medium">USDT</span>
                        </div>
                        <span className="font-mono font-bold text-base sm:text-lg text-white">{formatPrice(ticker.lastPrice)}</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                        <div className="bg-[#1a202c] p-2 sm:p-2.5 rounded-lg border border-white/5">
                          <div className="text-slate-500 mb-0.5 sm:mb-1 font-medium">{t('1h Change')}</div>
                          <div className={`font-mono font-bold text-xs sm:text-sm ${getColorClass(change1h)}`}>{formatPercent(change1h, false)}</div>
                        </div>
                        <div className="bg-[#1a202c] p-2 sm:p-2.5 rounded-lg border border-white/5">
                          <div className="text-slate-500 mb-0.5 sm:mb-1 font-medium">{t('24h Change')}</div>
                          <div className={`font-mono font-bold text-xs sm:text-sm ${getColorClass(change24h)}`}>{formatPercent(ticker.price24hPcnt, true)}</div>
                        </div>
                        <div className="bg-[#1a202c] p-2 sm:p-2.5 rounded-lg border border-white/5">
                          <div className="text-slate-500 mb-0.5 sm:mb-1 font-medium flex items-center gap-1"><Target className="w-3 h-3"/> {t('Res')}</div>
                          <div className="font-mono text-rose-400 font-medium">
                            {formatPercent(((Number(ticker.highPrice24h) - Number(ticker.lastPrice)) / Number(ticker.lastPrice)) * 100, false)}
                          </div>
                        </div>
                        <div className="bg-[#1a202c] p-2 sm:p-2.5 rounded-lg border border-white/5">
                          <div className="text-slate-500 mb-0.5 sm:mb-1 font-medium flex items-center gap-1"><Shield className="w-3 h-3"/> {t('Sup')}</div>
                          <div className="font-mono text-emerald-400 font-medium">
                            {formatPercent(((Number(ticker.lastPrice) - Number(ticker.lowPrice24h)) / Number(ticker.lastPrice)) * 100, false)}
                          </div>
                        </div>
                        <div className="bg-[#1a202c] p-2 sm:p-2.5 rounded-lg border border-white/5">
                          <div className="text-slate-500 mb-0.5 sm:mb-1 font-medium">{t('Vol 24h ($)')}</div>
                          <div className="font-mono text-slate-300 font-medium">${formatVolume(ticker.turnover24h)}</div>
                        </div>
                        <div className="bg-[#1a202c] p-2 sm:p-2.5 rounded-lg border border-white/5">
                          <div className="text-slate-500 mb-0.5 sm:mb-1 font-medium">{t('Vol (Coins)')}</div>
                          <div className="font-mono text-slate-300 font-medium">{formatVolume(ticker.volume24h)}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-1 pt-2 sm:pt-3 border-t border-white/5">
                        <div className="text-[10px] sm:text-xs font-medium">{getQuickSignal(ticker)}</div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnalyzingSymbol(ticker.symbol);
                          }}
                          className="relative overflow-hidden text-[10px] sm:text-xs font-bold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/30 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all group"
                        >
                          <span className="relative z-10">{t('Pro Analysis')}</span>
                          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-amber-300/60 to-transparent animate-glare z-0"></div>
                        </button>
                      </div>

                      {/* Trade Setup Display */}
                      {activeFilter === 'signals' && (() => {
                        const setup = getTradeSetup(ticker);
                        if (!setup) return null;
                        return (
                          <div className="mt-3 p-2.5 bg-[#0b0e14] rounded-lg border border-white/5">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex flex-col">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded w-fit ${setup.type === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                  {setup.type} {setup.setupName}
                                </span>
                                {setup.winRate > 0 && (
                                  <div className="mt-1">
                                    <div className="flex justify-between items-center mb-0.5">
                                      <span className="text-[9px] text-blue-400 font-bold flex items-center gap-1">
                                        <BrainCircuit className="w-2.5 h-2.5" /> WR: {(setup.winRate * 100).toFixed(1)}%
                                      </span>
                                      <span className="text-[8px] text-slate-500">{setup.wins}W / {setup.losses}L</span>
                                    </div>
                                    <div className="w-full bg-rose-500/20 rounded-full h-1 overflow-hidden flex">
                                      <div 
                                        className="h-full bg-emerald-500 transition-all duration-1000"
                                        style={{ width: `${setup.winRate * 100}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">RR 1:2</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <div className="text-[10px] text-slate-500">Entry</div>
                                <div className="text-xs font-mono font-bold text-blue-400">{formatPrice(setup.entry)}</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-slate-500">Stop Loss</div>
                                <div className="text-xs font-mono font-bold text-rose-400">{formatPrice(setup.sl)}</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-slate-500">Take Profit</div>
                                <div className="text-xs font-mono font-bold text-emerald-400">{formatPrice(setup.tp)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto no-scrollbar -mx-4 sm:-mx-6">
              <table className="w-full text-[11px] sm:text-sm text-left whitespace-nowrap min-w-[800px]">
                <thead className="text-[10px] sm:text-xs uppercase bg-[#11151e] text-slate-400 sticky top-0 z-10 shadow-md">
                  <tr>
                    <th 
                      className="px-4 sm:px-6 py-3 sm:py-4 font-medium cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('symbol')}
                    >
                    <div className="flex items-center">Pair <SortIcon field="symbol" /></div>
                  </th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 font-medium">
                    Exchange
                  </th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 font-medium">
                    Quick Alert
                  </th>
                  <th 
                    className="px-4 sm:px-6 py-3 sm:py-4 font-medium cursor-pointer hover:text-white transition-colors text-right"
                    onClick={() => handleSort('lastPrice')}
                  >
                    <div className="flex items-center justify-end">{t('Price')} <SortIcon field="lastPrice" /></div>
                  </th>
                  <th 
                    className="px-4 sm:px-6 py-3 sm:py-4 font-medium cursor-pointer hover:text-white transition-colors text-right"
                    onClick={() => handleSort('change1h')}
                  >
                    <div className="flex items-center justify-end">{t('1h Change')} <SortIcon field="change1h" /></div>
                  </th>
                  <th 
                    className="px-4 sm:px-6 py-3 sm:py-4 font-medium cursor-pointer hover:text-white transition-colors text-right"
                    onClick={() => handleSort('change24h')}
                  >
                    <div className="flex items-center justify-end">{t('24h Change')} <SortIcon field="change24h" /></div>
                  </th>
                  <th 
                    className="px-4 sm:px-6 py-3 sm:py-4 font-medium cursor-pointer hover:text-white transition-colors text-right"
                    onClick={() => handleSort('toRes')}
                  >
                    <div className="flex items-center justify-end gap-1"><Target className="w-3 h-3"/> {t('Res')} <SortIcon field="toRes" /></div>
                  </th>
                  <th 
                    className="px-4 sm:px-6 py-3 sm:py-4 font-medium cursor-pointer hover:text-white transition-colors text-right"
                    onClick={() => handleSort('toSup')}
                  >
                    <div className="flex items-center justify-end gap-1"><Shield className="w-3 h-3"/> {t('Sup')} <SortIcon field="toSup" /></div>
                  </th>
                  <th 
                    className="px-4 sm:px-6 py-3 sm:py-4 font-medium cursor-pointer hover:text-white transition-colors text-right"
                    onClick={() => handleSort('turnover24h')}
                  >
                    <div className="flex items-center justify-end">{t('Vol 24h ($)')} <SortIcon field="turnover24h" /></div>
                  </th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 font-medium text-right">
                    <div className="flex items-center justify-end">{t('Vol (Coins)')}</div>
                  </th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 font-medium text-right">
                    WR %
                  </th>
                  <th 
                    className="px-4 sm:px-6 py-3 sm:py-4 font-medium cursor-pointer hover:text-white transition-colors text-right"
                    onClick={() => handleSort('fundingRate')}
                  >
                    <div className="flex items-center justify-end">{t('Funding')} <SortIcon field="fundingRate" /></div>
                  </th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 font-medium text-right">
                    {t('Action')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAndSortedTickers.map((ticker) => {
                  const change1h = calc1hChange(ticker.lastPrice, ticker.prevPrice1h);
                  const change24h = Number(ticker.price24hPcnt) * 100;
                  const funding = Number(ticker.fundingRate) * 100;
                  const isSelected = selectedSymbol === ticker.symbol;
                  
                  return (
                    <tr 
                      key={ticker.symbol} 
                      onClick={() => setSelectedSymbol(ticker.symbol)}
                      className={`cursor-pointer transition-colors group ${
                        isSelected ? 'bg-blue-500/10 border-l-2 border-blue-500' : 'hover:bg-[#1a202c] border-l-2 border-transparent'
                      }`}
                    >
                      <td className="px-4 sm:px-6 py-3 sm:py-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span>{ticker.symbol.replace('USDT', '')}</span>
                          <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">USDT</span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 font-medium">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {ticker.exchange || selectedExchange}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 font-medium">
                        {getQuickSignal(ticker)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-right font-mono">
                        {formatPrice(ticker.lastPrice)}
                      </td>
                      <td className={`px-4 sm:px-6 py-3 sm:py-4 text-right font-mono ${getColorClass(change1h)}`}>
                        {formatPercent(change1h, false)}
                      </td>
                      <td className={`px-4 sm:px-6 py-3 sm:py-4 text-right font-mono ${getColorClass(change24h)}`}>
                        {formatPercent(ticker.price24hPcnt, true)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-right font-mono text-rose-400">
                        {formatPercent(((Number(ticker.highPrice24h) - Number(ticker.lastPrice)) / Number(ticker.lastPrice)) * 100, false)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-right font-mono text-emerald-400">
                        {formatPercent(((Number(ticker.lastPrice) - Number(ticker.lowPrice24h)) / Number(ticker.lastPrice)) * 100, false)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-right font-mono text-slate-300">
                        ${formatVolume(ticker.turnover24h)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-right font-mono text-slate-400">
                        {formatVolume(ticker.volume24h)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-right font-mono">
                        {(() => {
                          const setup = getTradeSetup(ticker);
                          if (!setup || !setup.winRate || setup.winRate === 0) return <span className="text-slate-600">-</span>;
                          return (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`${setup.winRate >= 0.6 ? 'text-emerald-400' : setup.winRate >= 0.4 ? 'text-amber-400' : 'text-rose-400'} font-bold text-[11px] sm:text-sm`}>
                                {(setup.winRate * 100).toFixed(1)}%
                              </span>
                              <div className="w-12 bg-rose-500/30 rounded-full h-1 overflow-hidden flex">
                                <div 
                                  className="h-full bg-emerald-500"
                                  style={{ width: `${setup.winRate * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-[8px] text-blue-500/50 uppercase tracking-tighter">AI RL</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className={`px-4 sm:px-6 py-3 sm:py-4 text-right font-mono ${
                        Math.abs(funding) > 0.05 ? 'text-amber-400 font-bold' : 'text-slate-400'
                      }`}>
                        {formatPercent(ticker.fundingRate, true)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setAnalyzingSymbol(ticker.symbol);
                            }}
                            className="relative overflow-hidden text-[10px] sm:text-xs font-bold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded transition-all group"
                          >
                            <span className="relative z-10">{t('Pro Analysis')}</span>
                            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-amber-300/60 to-transparent animate-glare z-0"></div>
                          </button>
                          
                          {activeFilter === 'signals' && (() => {
                            const setup = getTradeSetup(ticker);
                            if (!setup) return null;
                            return (
                              <div className="flex items-center gap-2 text-[10px]">
                                <span className={`font-bold px-1.5 py-0.5 rounded ${setup.type === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                  {setup.type}
                                </span>
                                <span className="text-slate-400">EP: <span className="text-blue-400 font-mono">{formatPrice(setup.entry)}</span></span>
                                <span className="text-slate-400">SL: <span className="text-rose-400 font-mono">{formatPrice(setup.sl)}</span></span>
                                <span className="text-slate-400">TP: <span className="text-emerald-400 font-mono">{formatPrice(setup.tp)}</span></span>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between px-4 py-3 bg-[#11151e] border-t border-white/5 shrink-0 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowTerms(true)} 
              className="hover:text-slate-300 transition-colors"
            >
              {t('Terms of Use')}
            </button>
            <span>© {new Date().getFullYear()} Profit Hunter</span>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="https://t.me/your_telegram_channel" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-blue-400 transition-colors"
              title="Telegram"
            >
              <Send className="w-4 h-4" />
            </a>
            <a 
              href="https://twitter.com/your_twitter_handle" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-blue-400 transition-colors"
              title="Twitter / X"
            >
              <Twitter className="w-4 h-4" />
            </a>
          </div>
        </footer>
      </div>

      {/* Side Panel for Signals */}
      {selectedSymbol && (
        <SignalPanel 
          symbol={selectedSymbol} 
          signal={signal} 
          klines={klines}
          loading={signalLoading} 
          onClose={() => setSelectedSymbol(null)} 
          onAnalyze={() => setAnalyzingSymbol(selectedSymbol)}
        />
      )}

      {/* Pro Analysis Modal */}
      {analyzingSymbol && tickers.find(t => t.symbol === analyzingSymbol) && (
        <ProAnalysisModal 
          ticker={tickers.find(t => t.symbol === analyzingSymbol)!} 
          onClose={() => setAnalyzingSymbol(null)} 
        />
      )}

      {/* Terms of Use Modal */}
      <TermsModal 
        isOpen={showTerms} 
        onClose={!hasAcceptedTerms ? handleAcceptTerms : () => setShowTerms(false)} 
        isMandatory={!hasAcceptedTerms}
      />
    </div>
  );
};
