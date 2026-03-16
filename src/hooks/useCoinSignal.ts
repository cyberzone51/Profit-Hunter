import { useState, useEffect } from 'react';
import { Kline, TradingSignal, BybitTicker } from '../types';
import { generateSignal } from '../utils/ta';

const generateMockKlines = (currentPrice: number = 100) => {
  const klines: Kline[] = [];
  let price = currentPrice;
  const now = Date.now();
  for (let i = 100; i >= 0; i--) {
    const open = price;
    const close = price * (1 + (Math.random() * 0.02 - 0.01));
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.random() * 1000000;
    klines.push({
      startTime: now - i * 15 * 60 * 1000,
      open,
      high,
      low,
      close,
      volume
    });
    price = close;
  }
  return klines;
};

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
        const res = await fetch(`/api/advanced-klines?symbol=${symbol}`);
        if (!res.ok) throw new Error('Failed to fetch from local API');
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
        console.warn('Network error analyzing coin, using mock data:', err);
        // Fallback to mock data
        const mockK15m = generateMockKlines(ticker ? Number(ticker.lastPrice) : 100);
        const mockK1h = generateMockKlines(ticker ? Number(ticker.lastPrice) : 100);
        const mockK4h = generateMockKlines(ticker ? Number(ticker.lastPrice) : 100);
        const mockBtc1h = generateMockKlines(65000);
        const generatedSignal = generateSignal(symbol, mockK15m, mockK1h, mockK4h, mockBtc1h, ticker);
        setKlines(mockK15m);
        setSignal(generatedSignal);
        setError(null); // Clear error since we have fallback data
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
