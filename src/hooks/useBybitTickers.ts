import { useState, useEffect, useCallback } from 'react';
import { BybitTicker } from '../types';

const now = Date.now();
const MOCK_TICKERS: any[] = [
  { symbol: 'BTCUSDT', lastPrice: '65432.10', prevPrice1h: '65100.00', price24hPcnt: '0.025', turnover24h: '1500000000', fundingRate: '0.0001', openInterestValue: '500000000', launchTime: (now - 100000000000).toString() },
  { symbol: 'ETHUSDT', lastPrice: '3456.78', prevPrice1h: '3420.00', price24hPcnt: '0.031', turnover24h: '800000000', fundingRate: '0.0001', openInterestValue: '300000000', launchTime: (now - 90000000000).toString() },
  { symbol: 'SOLUSDT', lastPrice: '145.67', prevPrice1h: '140.00', price24hPcnt: '0.052', turnover24h: '400000000', fundingRate: '0.0002', openInterestValue: '150000000', launchTime: (now - 80000000000).toString() },
  { symbol: 'BNBUSDT', lastPrice: '580.40', prevPrice1h: '582.00', price24hPcnt: '-0.005', turnover24h: '200000000', fundingRate: '0.00005', openInterestValue: '80000000', launchTime: (now - 70000000000).toString() },
  { symbol: 'XRPUSDT', lastPrice: '0.62', prevPrice1h: '0.61', price24hPcnt: '0.015', turnover24h: '150000000', fundingRate: '0.0001', openInterestValue: '60000000', launchTime: (now - 60000000000).toString() },
  { symbol: 'DOGEUSDT', lastPrice: '0.15', prevPrice1h: '0.145', price24hPcnt: '0.04', turnover24h: '300000000', fundingRate: '0.0003', openInterestValue: '90000000', launchTime: (now - 50000000000).toString() },
  { symbol: 'ADAUSDT', lastPrice: '0.45', prevPrice1h: '0.46', price24hPcnt: '-0.02', turnover24h: '80000000', fundingRate: '-0.0001', openInterestValue: '40000000', launchTime: (now - 40000000000).toString() },
  { symbol: 'AVAXUSDT', lastPrice: '45.20', prevPrice1h: '44.00', price24hPcnt: '0.06', turnover24h: '120000000', fundingRate: '0.0002', openInterestValue: '50000000', launchTime: (now - 30000000000).toString() },
  { symbol: 'LINKUSDT', lastPrice: '18.50', prevPrice1h: '18.20', price24hPcnt: '0.02', turnover24h: '90000000', fundingRate: '0.0001', openInterestValue: '35000000', launchTime: (now - 20000000000).toString() },
  { symbol: 'DOTUSDT', lastPrice: '7.20', prevPrice1h: '7.10', price24hPcnt: '0.01', turnover24h: '60000000', fundingRate: '0.0001', openInterestValue: '25000000', launchTime: (now - 10000000000).toString() },
  { symbol: 'MATICUSDT', lastPrice: '0.95', prevPrice1h: '0.94', price24hPcnt: '0.015', turnover24h: '70000000', fundingRate: '0.0001', openInterestValue: '30000000', launchTime: (now - 5000000000).toString() },
  { symbol: 'UNIUSDT', lastPrice: '11.20', prevPrice1h: '10.80', price24hPcnt: '0.045', turnover24h: '85000000', fundingRate: '0.00015', openInterestValue: '28000000', launchTime: (now - 4000000000).toString() },
  { symbol: 'LTCUSDT', lastPrice: '85.40', prevPrice1h: '86.00', price24hPcnt: '-0.01', turnover24h: '50000000', fundingRate: '0.00005', openInterestValue: '20000000', launchTime: (now - 3000000000).toString() },
  { symbol: 'ATOMUSDT', lastPrice: '10.50', prevPrice1h: '10.40', price24hPcnt: '0.025', turnover24h: '40000000', fundingRate: '0.0001', openInterestValue: '15000000', launchTime: (now - 2000000000).toString() },
  { symbol: 'ETCUSDT', lastPrice: '32.10', prevPrice1h: '31.50', price24hPcnt: '0.03', turnover24h: '65000000', fundingRate: '0.0001', openInterestValue: '22000000', launchTime: (now - 1000000000).toString() },
  { symbol: 'FILUSDT', lastPrice: '6.80', prevPrice1h: '6.90', price24hPcnt: '-0.015', turnover24h: '45000000', fundingRate: '-0.00005', openInterestValue: '18000000', launchTime: (now - 500000000).toString() },
];

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
