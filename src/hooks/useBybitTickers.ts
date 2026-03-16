import { useState, useEffect, useCallback } from 'react';
import { BybitTicker } from '../types';

export const useBybitTickers = () => {
  const [tickers, setTickers] = useState<BybitTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchTickers = useCallback(async () => {
    try {
      const baseUrl = window.location.origin;
      const res = await fetch(`${baseUrl}/api/tickers`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      
      if (data.retCode === 0 && data.result && data.result.list) {
        // Filter for USDT perpetuals only
        const usdtPairs = data.result.list.filter((t: BybitTicker) => 
          t.symbol.endsWith('USDT')
        );
        setTickers(usdtPairs);
        setLastUpdated(new Date());
        setError(null);
      } else {
        setError(data.retMsg || 'Failed to fetch data from Bybit');
      }
    } catch (err) {
      console.error('Failed to fetch tickers:', err);
      setError('Connection error. Please check your internet or refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const poll = async () => {
      await fetchTickers();
      timeoutId = setTimeout(poll, 1000);
    };
    poll();
    return () => clearTimeout(timeoutId);
  }, [fetchTickers]);

  return { tickers, loading, error, lastUpdated };
};
