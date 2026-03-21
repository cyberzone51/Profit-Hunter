import { rlOptimizer } from './utils/rl';

export const formatPrice = (price: string | number): string => {
  const p = Number(price);
  if (isNaN(p)) return '0.00';
  
  if (p < 0.0001) return p.toFixed(8);
  if (p < 0.01) return p.toFixed(6);
  if (p < 1) return p.toFixed(5);
  if (p < 100) return p.toFixed(4);
  return p.toFixed(2);
};

export const formatVolume = (vol: string | number): string => {
  const v = Number(vol);
  if (isNaN(v)) return '0';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toFixed(2);
};

export const formatPercent = (pct: string | number, isDecimal = true): string => {
  let p = Number(pct);
  if (isNaN(p)) return '0.00%';
  if (isDecimal) p = p * 100;
  return (p > 0 ? '+' : '') + p.toFixed(2) + '%';
};

export const calc1hChange = (lastPrice: string, prevPrice1h: string): number => {
  const last = Number(lastPrice);
  const prev = Number(prevPrice1h);
  if (!prev || isNaN(prev) || isNaN(last)) return 0;
  return ((last - prev) / prev) * 100;
};

export const getSignalType = (ticker: any) => {
  const change1h = calc1hChange(ticker.lastPrice, ticker.prevPrice1h);
  const change24h = Number(ticker.price24hPcnt) * 100;
  const high24h = Number(ticker.highPrice24h);
  const low24h = Number(ticker.lowPrice24h);
  const rangePcnt = ((high24h - low24h) / low24h) * 100;
  const funding = Number(ticker.fundingRate) * 100;

  // Reversal (Razvorot) Signals
  if (change24h < -5 && change1h > 1.0) return 'LONG_REV';
  if (change24h > 5 && change1h < -1.0) return 'SHORT_REV';

  // Trend Signals
  if (change24h > 3 && change1h > 1.5) return 'LONG_TREND';
  if (change24h < -3 && change1h < -1.5) return 'SHORT_TREND';

  // Consolidation
  if (rangePcnt > 0 && rangePcnt < 3.5) return 'CONS';

  // Overheated
  if (funding > 0.1) return 'OVERHEATED_LONG';
  if (funding < -0.1) return 'OVERHEATED_SHORT';
  
  return 'NONE';
};

export const getTradeSetup = (ticker: any) => {
  const price = Number(ticker.lastPrice);
  const high = Number(ticker.highPrice24h);
  const low = Number(ticker.lowPrice24h);
  const range = high - low;
  
  if (range === 0 || price === 0) return null;

  const distToHigh = (high - price) / price;
  const distToLow = (price - low) / price;
  const volPct = range / low;
  
  if (volPct < 0.02) return null; // Need at least 2% daily volatility

  let type: 'LONG' | 'SHORT' | null = null;
  let entry = 0;
  let sl = 0;
  let tp = 0;
  let setupName = '';

  // Breakout Long
  if (distToHigh < 0.02 && Number(ticker.price24hPcnt) > 0.03) {
    type = 'LONG';
    setupName = 'Breakout';
    entry = high;
    sl = high - (range * 0.15);
    tp = entry + ((entry - sl) * 2);
  }
  // Breakdown Short
  else if (distToLow < 0.02 && Number(ticker.price24hPcnt) < -0.03) {
    type = 'SHORT';
    setupName = 'Breakdown';
    entry = low;
    sl = low + (range * 0.15);
    tp = entry - ((sl - entry) * 2);
  }
  // Reversal Long
  else if (distToLow < 0.04 && Number(ticker.price24hPcnt) < -0.04) {
    type = 'LONG';
    setupName = 'Reversal';
    entry = price;
    sl = low * 0.99;
    tp = entry + ((entry - sl) * 2);
  }
  // Reversal Short
  else if (distToHigh < 0.04 && Number(ticker.price24hPcnt) > 0.04) {
    type = 'SHORT';
    setupName = 'Reversal';
    entry = price;
    sl = high * 1.01;
    tp = entry - ((sl - entry) * 2);
  }

  if (!type) return null;

  const stats = rlOptimizer.getStats(ticker.symbol);

  return { type, setupName, entry, sl, tp, winRate: stats.winRate, wins: stats.wins, losses: stats.losses };
};
