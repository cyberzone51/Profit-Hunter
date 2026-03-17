import { useState, useEffect } from 'react';
import { Kline, TradingSignal, BybitTicker } from '../types';
import { generateSignal } from '../utils/ta';

export const useCoinSignal = (symbol: string | null, ticker: BybitTicker | null = null) => {
  const [signal, setSignal] = useState<TradingSignal | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      setSignal(null);
      return;
    }

    const fetchKlinesAndAnalyze = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch advanced klines for MTFA
        let baseUrl = import.meta.env.VITE_API_URL || '';
        if (baseUrl.endsWith('/')) {
          baseUrl = baseUrl.slice(0, -1);
        }
        const targetUrl = `${baseUrl}/api/advanced-klines?symbol=${symbol}`;
        
        console.log(`[Signals] Fetching from: ${targetUrl}`);
        
        const res = await fetch(targetUrl);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.details || `HTTP error! status: ${res.status}`);
        }
        const data = await res.json();

        if (data.k15m && data.k1h && data.k4h && data.btc1h) {
          // Bybit returns newest first. We need chronological order (oldest first) for TA.
          const mapKlines = (rawList: string[][]): Kline[] => rawList.reverse().map((k: string[]) => ({
            startTime: Number(k[0]),
            open: Number(k[1]),
            high: Number(k[2]),
            low: Number(k[3]),
            close: Number(k[4]),
            volume: Number(k[5]),
          }));

          const k15m = mapKlines(data.k15m);
          const k1h = mapKlines(data.k1h);
          const k4h = mapKlines(data.k4h);
          const btc1h = mapKlines(data.btc1h);

          const generatedSignal = generateSignal(symbol, k15m, k1h, k4h, btc1h, ticker);
          setKlines(k15m);
          setSignal(generatedSignal);
        } else {
          throw new Error('Failed to fetch advanced klines from API');
        }
      } catch (err) {
        console.error('Error analyzing coin:', err);
        setError('Signal analysis failed. Please check connection.');
        setSignal(null);
      } finally {
        setLoading(false);
      }
    };

    fetchKlinesAndAnalyze();
    
    // Refresh signal every 15 seconds while panel is open
    const interval = setInterval(fetchKlinesAndAnalyze, 15000);
    return () => clearInterval(interval);
  }, [symbol, ticker]);

  return { signal, klines, loading, error };
};
