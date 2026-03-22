import { rlOptimizer } from './utils/rl';

const toSafeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getSpreadPercent = (ticker: any) => {
  const lastPrice = toSafeNumber(ticker.lastPrice);
  const ask = toSafeNumber(ticker.ask1Price, lastPrice);
  const bid = toSafeNumber(ticker.bid1Price, lastPrice);
  const reference = lastPrice || ask || bid;

  if (reference <= 0 || ask <= 0 || bid <= 0) return 0;
  return ((ask - bid) / reference) * 100;
};

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
  const change1h = calc1hChange(ticker.lastPrice, ticker.prevPrice1h);
  
  if (range === 0 || price === 0) return null;

  const distToHigh = (high - price) / price;
  const distToLow = (price - low) / price;
  const volPct = range / low;
  const breakoutWindow = Math.min(0.04, Math.max(0.02, volPct * 0.35));
  const reversalWindow = Math.min(0.07, Math.max(0.035, volPct * 0.6));
  
  if (volPct < 0.015) return null; // Need at least 1.5% daily volatility

  let type: 'LONG' | 'SHORT' | null = null;
  let entry = 0;
  let sl = 0;
  let tp = 0;
  let setupName = '';
  let entryMode: 'market' | 'stop' = 'market';

  // Breakout Long
  if (distToHigh <= breakoutWindow && Number(ticker.price24hPcnt) > 0.025 && change1h > 0.8) {
    type = 'LONG';
    setupName = 'Breakout';
    entry = high;
    entryMode = 'stop';
    sl = high - (range * 0.15);
    tp = entry + ((entry - sl) * 2);
  }
  // Breakdown Short
  else if (distToLow <= breakoutWindow && Number(ticker.price24hPcnt) < -0.025 && change1h < -0.8) {
    type = 'SHORT';
    setupName = 'Breakdown';
    entry = low;
    entryMode = 'stop';
    sl = low + (range * 0.15);
    tp = entry - ((sl - entry) * 2);
  }
  // Reversal Long
  else if (distToLow <= reversalWindow && Number(ticker.price24hPcnt) < -0.03) {
    type = 'LONG';
    setupName = 'Reversal';
    entry = price;
    sl = low * 0.99;
    tp = entry + ((entry - sl) * 2);
  }
  // Reversal Short
  else if (distToHigh <= reversalWindow && Number(ticker.price24hPcnt) > 0.03) {
    type = 'SHORT';
    setupName = 'Reversal';
    entry = price;
    sl = high * 1.01;
    tp = entry - ((sl - entry) * 2);
  }
  // Momentum Long continuation
  else if (Number(ticker.price24hPcnt) > 0.025 && change1h > 0.8 && distToHigh <= 0.08) {
    type = 'LONG';
    setupName = 'Momentum';
    entry = price;
    sl = Math.max(price - (range * 0.18), price * 0.99);
    tp = entry + ((entry - sl) * 2);
  }
  // Momentum Short continuation
  else if (Number(ticker.price24hPcnt) < -0.025 && change1h < -0.8 && distToLow <= 0.08) {
    type = 'SHORT';
    setupName = 'Momentum';
    entry = price;
    sl = Math.min(price + (range * 0.18), price * 1.01);
    tp = entry - ((sl - entry) * 2);
  }

  if (!type) return null;

  const marketKey = `${ticker.exchange || 'Bybit'}:${ticker.symbol}`;
  const overallStats = rlOptimizer.getStats(marketKey);
  const setupStats = rlOptimizer.getIndicatorStats(marketKey, `setup:${setupName.toLowerCase()}`);
  const directionStats = rlOptimizer.getIndicatorStats(marketKey, `direction:${type.toLowerCase()}`);
  const entryStats = rlOptimizer.getIndicatorStats(marketKey, `entry:${entryMode}`);
  const adaptiveWeight = (
    rlOptimizer.getWeight(marketKey, `setup:${setupName.toLowerCase()}`)
    + rlOptimizer.getWeight(marketKey, `direction:${type.toLowerCase()}`)
    + rlOptimizer.getWeight(marketKey, `entry:${entryMode}`)
  ) / 3;
  const learningScore = overallStats.wins - overallStats.losses + setupStats.score + directionStats.score + entryStats.score;

  if (overallStats.total >= 8 && overallStats.winRate < 0.35 && adaptiveWeight < 0.9) {
    return null;
  }

  return {
    type,
    setupName,
    entry,
    sl,
    tp,
    entryMode,
    winRate: overallStats.winRate,
    wins: overallStats.wins,
    losses: overallStats.losses,
    sampleSize: overallStats.total,
    learningScore,
    adaptiveWeight
  };
};

export const getStrongSignalCandidate = (ticker: any) => {
  const setup = getTradeSetup(ticker);
  if (!setup) return null;

  const signalType = getSignalType(ticker);
  const directionalSignalType = signalType.includes('LONG') || signalType.includes('SHORT')
    ? signalType
    : setup.type === 'LONG'
      ? 'LONG_SETUP'
      : 'SHORT_SETUP';

  const turnover24h = toSafeNumber(ticker.turnover24h);
  const volume24h = toSafeNumber(ticker.volume24h);
  const openInterestValue = toSafeNumber(ticker.openInterestValue);
  const fundingRate = Math.abs(toSafeNumber(ticker.fundingRate) * 100);
  const spread = getSpreadPercent(ticker);
  const change24h = Math.abs(toSafeNumber(ticker.price24hPcnt) * 100);
  const change1h = Math.abs(calc1hChange(ticker.lastPrice, ticker.prevPrice1h));

  if (turnover24h < 75_000_000) return null;
  if (spread > 0.5) return null;
  if (change24h < 2.5 || change24h > 20) return null;
  if (change1h < 0.75) return null;
  if (fundingRate > 1) return null;
  if (setup.sampleSize >= 6 && setup.winRate < 0.5) return null;
  if (setup.sampleSize >= 6 && setup.learningScore < 0) return null;
  if (setup.sampleSize >= 6 && setup.adaptiveWeight < 0.95) return null;

  let qualityScore = 0;

  qualityScore += 3;
  if (turnover24h >= 250_000_000) qualityScore += 3;
  else if (turnover24h >= 100_000_000) qualityScore += 2;

  if (volume24h > 0) qualityScore += 1;
  if (openInterestValue >= 10_000_000) qualityScore += 2;
  else if (openInterestValue > 0) qualityScore += 1;

  if (spread <= 0.2) qualityScore += 2;
  else if (spread <= 0.5) qualityScore += 1;

  if (change24h >= 4 && change24h <= 12) qualityScore += 2;
  else qualityScore += 1;

  if (setup.sampleSize >= 10 && setup.winRate >= 0.6) qualityScore += 2;
  else if (setup.sampleSize >= 6 && setup.winRate >= 0.5) qualityScore += 1;
  else if (setup.sampleSize === 0) qualityScore += 1;

  if (setup.learningScore > 0) qualityScore += 1;
  if (setup.adaptiveWeight >= 1) qualityScore += 1;

  if (qualityScore < 7) return null;

  return {
    ...setup,
    signalType: directionalSignalType,
    qualityScore,
    turnover24h,
    volume24h,
    openInterestValue,
    spread,
    change24h,
    change1h
  };
};
