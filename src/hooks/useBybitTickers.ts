import { useState, useEffect, useCallback } from 'react';
import { BybitTicker } from '../types';

export const useBybitTickers = () => {
  const [tickers, setTickers] = useState<BybitTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchTickers = useCallback(async () => {
    try {
      let envApiUrl = import.meta.env.VITE_API_URL;
      
      // Fallback for Vercel if environment variable is missing
      if (!envApiUrl && window.location.hostname.includes('vercel.app')) {
        envApiUrl = 'https://ais-pre-4utfza4jbx2dlatcr62r64-157497256116.europe-west2.run.app';
      }
      
      const baseUrl = envApiUrl ? envApiUrl.replace(/\/$/, '') : '';
      const targetUrl = `${baseUrl}/api/tickers`;
      
      console.log(`[Tickers] Fetching from: ${targetUrl || 'relative /api/tickers'}`);
      
      const res = await fetch(targetUrl).catch(err => {
        console.error(`[Tickers] Fetch failed for ${targetUrl}:`, err);
        throw new Error(`Network error: ${err.message}. Check CORS or URL.`);
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.details || `HTTP error! status: ${res.status}`);
      }
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
