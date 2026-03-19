import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useBybitTickers } from '../hooks/useBybitTickers';
import { useCoinSignal } from '../hooks/useCoinSignal';
import { SignalPanel } from './SignalPanel';
import { BybitTicker, SortField, SortDirection } from '../types';
import { formatPrice, formatVolume, formatPercent, calc1hChange, getSignalType } from '../utils';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Activity, Clock, Zap, LayoutGrid, List, TrendingUp, TrendingDown, Bell, BellOff, Target, Shield, Sparkles, X, Globe, CircleDollarSign } from 'lucide-react';
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';
import { ProAnalysisModal } from './ProAnalysisModal';
import { API_URL } from '../config';

const LazyChart = React.memo(({ symbol, timeframe }: { symbol: string; timeframe: string }) => {
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

  return (
    <div ref={containerRef} className="h-full w-full bg-[#0b0e14] relative overflow-hidden">
      {isVisible ? (
        <AdvancedRealTimeChart
          symbol={`BYBIT:${symbol}.P`}
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
  const { tickers, loading, error, lastUpdated } = useBybitTickers();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('turnover24h');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [timeframe, setTimeframe] = useState<string>('5');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'signals' | 'near_levels' | 'consolidation' | 'new_listings'>('all');
  const [analyzingSymbol, setAnalyzingSymbol] = useState<BybitTicker | null>(null);
  const prevSignalsRef = useRef<Record<string, string>>({});
  
  const selectedTicker = useMemo(() => tickers.find(t => t.symbol === selectedSymbol) || null, [tickers, selectedSymbol]);
  const { signal, klines, loading: signalLoading } = useCoinSignal(selectedSymbol, selectedTicker);

  const tickersRef = useRef<BybitTicker[]>([]);
  
  useEffect(() => {
    tickersRef.current = tickers;
  }, [tickers]);

  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  useEffect(() => {
    if (!tickers.length) return;
    
    let shouldAlert = false;
    const newSignals: Record<string, string> = {};
    
    tickers.forEach(ticker => {
      const signalType = getSignalType(ticker);
      
      newSignals[ticker.symbol] = signalType;
      
      if (
        signalType !== 'NONE' && 
        signalType !== 'CONS' && 
        prevSignalsRef.current[ticker.symbol] && 
        prevSignalsRef.current[ticker.symbol] !== signalType
      ) {
        shouldAlert = true;
      }
    });
    
    if (shouldAlert) {
      playAlertSound();
    }
    
    prevSignalsRef.current = newSignals;
  }, [tickers, soundEnabled]);

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
        <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between px-4 sm:px-6 py-4 bg-[#11151e] border-b border-white/5 shrink-0 gap-4">
          <div className="flex items-center justify-between w-full lg:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-white/10 shadow-2xl shadow-blue-500/30 overflow-hidden bg-[#1a202c] flex items-center justify-center p-2">
                <img 
                  src="https://cdn-icons-png.flaticon.com/512/2489/2489756.png" 
                  alt="Profit Hunter Logo" 
                  className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-[0.05em] leading-none mb-1 font-display uppercase italic shimmer-text relative">
                  Profit Hunter
                </h1>
                <div className="text-[9px] sm:text-[10px] text-blue-400 font-bold uppercase tracking-[0.3em] mb-1.5 opacity-80">
                  Pro Crypto Screener
                </div>
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {lastUpdated.toLocaleTimeString()}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                    {error ? 'Offline' : 'Online'}
                  </span>
                  <span>•</span>
                  <span>{tickers.length} Pairs</span>
                </div>
              </div>
            </div>

            {/* Desktop Search Bar */}
            <div className="hidden lg:block relative ml-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder={t('Search coins...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-[#1a202c] border border-white/10 rounded-md text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all w-64 placeholder:text-slate-600"
              />
            </div>

            {/* Mobile Top Right Controls */}
            <div className="flex lg:hidden items-center gap-2">
              <div className="flex items-center bg-[#1a202c] rounded-lg p-1 border border-white/10">
                <div className="relative flex items-center">
                  <Globe className="w-3.5 h-3.5 text-slate-500 ml-2" />
                  <select
                    value={i18n.language}
                    onChange={(e) => i18n.changeLanguage(e.target.value)}
                    className="bg-transparent text-slate-300 text-[10px] font-medium py-1 pl-1.5 pr-5 appearance-none focus:outline-none cursor-pointer"
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

          <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full lg:w-auto justify-between lg:justify-end">
            {viewMode === 'grid' && (
              <div className="flex items-center bg-[#1a202c] rounded-lg p-1 border border-white/10 text-[10px] sm:text-xs font-medium overflow-x-auto no-scrollbar">
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

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[#1a202c] rounded-lg p-1 border border-white/10">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-1.5 rounded-md transition-colors ${soundEnabled ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                  title={soundEnabled ? "Mute Alerts" : "Enable Sound Alerts"}
                >
                  {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
              </div>

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

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Mobile Search Bar */}
              <div className="lg:hidden relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder={t('Search coins...')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 bg-[#1a202c] border border-white/10 rounded-md text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all w-full sm:w-48 placeholder:text-slate-600"
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
          </div>
        </header>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-[#0b0e14] border-b border-white/5 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[10px] sm:text-xs text-slate-500 font-medium mr-2 shrink-0">{t('Filters')}</span>
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
                      <LazyChart key={`${ticker.symbol}-${timeframe}`} symbol={ticker.symbol} timeframe={timeframe} />
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
                            setAnalyzingSymbol(ticker);
                          }}
                          className="text-[10px] sm:text-xs font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors"
                        >
                          {t('Pro Analysis')}
                        </button>
                      </div>
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
                      <td className={`px-4 sm:px-6 py-3 sm:py-4 text-right font-mono ${
                        Math.abs(funding) > 0.05 ? 'text-amber-400 font-bold' : 'text-slate-400'
                      }`}>
                        {formatPercent(ticker.fundingRate, true)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-right">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnalyzingSymbol(ticker);
                          }}
                          className="text-[10px] sm:text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded transition-colors"
                        >
                          {t('Analyze')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>

      {/* Side Panel for Signals */}
      {selectedSymbol && (
        <SignalPanel 
          symbol={selectedSymbol} 
          signal={signal} 
          klines={klines}
          loading={signalLoading} 
          onClose={() => setSelectedSymbol(null)} 
          onAnalyze={() => setAnalyzingSymbol(selectedTicker)}
        />
      )}

      {/* Pro Analysis Modal */}
      {analyzingSymbol && (
        <ProAnalysisModal 
          ticker={analyzingSymbol} 
          onClose={() => setAnalyzingSymbol(null)} 
        />
      )}
    </div>
  );
};
