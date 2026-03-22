import { Kline, TradingSignal, BybitTicker } from '../types';
import { getSignalType } from '../utils';
import { rlOptimizer } from './rl';
import { createBacktestStats, EMPTY_BACKTEST_STATS, resolveTradeOutcome } from './backtest';
import {
  calcEMA,
  calcRSI,
  calcMACD,
  calcOBV,
  calcVWAP,
  calcBollingerBands,
  calcATR,
  calcADX,
  calcFibonacci,
  findSwingHighLow,
  detectDivergence
} from './indicators';

type SignalDirection = 'LONG' | 'SHORT' | 'NEUTRAL';

type SignalAnalysis = {
  direction: SignalDirection;
  finalScore: number;
  currentPrice: number;
  takeProfit1: number;
  takeProfit2: number;
  stopLoss: number;
  riskReward: number;
  indicators: TradingSignal['indicators'];
};

const buildSignalAnalysis = (
  symbol: string,
  k15m: Kline[],
  k1h: Kline[],
  k4h: Kline[],
  btc1h: Kline[],
  ticker: BybitTicker | null = null
): SignalAnalysis | null => {
  if (k15m.length < 50 || k1h.length < 50 || k4h.length < 50 || btc1h.length < 50) return null;

  const closes = k15m.map((kline) => kline.close);
  const highs = k15m.map((kline) => kline.high);
  const lows = k15m.map((kline) => kline.low);
  const volumes = k15m.map((kline) => kline.volume);
  const currentPrice = closes[closes.length - 1];

  const closes1h = k1h.map((kline) => kline.close);
  const ema50_1h = calcEMA(closes1h, 50).pop() || currentPrice;
  const ema200_1h = calcEMA(closes1h, 200).pop() || currentPrice;

  const btcCloses1h = btc1h.map((kline) => kline.close);
  const currentBtcPrice = btcCloses1h[btcCloses1h.length - 1];
  const btcEma50_1h = calcEMA(btcCloses1h, 50).pop() || currentBtcPrice;

  const ema20 = calcEMA(closes, 20).pop() || currentPrice;
  const ema50 = calcEMA(closes, 50).pop() || currentPrice;
  const ema200 = calcEMA(closes, 200).pop() || currentPrice;
  const adx = calcADX(highs, lows, closes, 14).pop() || 20;
  const rsiArray = calcRSI(closes, 14);
  const rsi = rsiArray[rsiArray.length - 1] || 50;
  const { macdLine, signalLine, histogram } = calcMACD(closes);
  const macd = {
    line: macdLine[macdLine.length - 1] || 0,
    signal: signalLine[signalLine.length - 1] || 0,
    hist: histogram[histogram.length - 1] || 0
  };
  const previousHistogram = histogram[histogram.length - 2] || 0;
  const obvArray = calcOBV(closes, volumes);
  const obv = obvArray[obvArray.length - 1] || 0;
  const prevObv = obvArray[obvArray.length - 2] || obv;
  const vwap = calcVWAP(highs, lows, closes, volumes).pop() || currentPrice;
  const { upper, lower, basis } = calcBollingerBands(closes);
  const bb = {
    upper: upper[upper.length - 1] || currentPrice,
    lower: lower[lower.length - 1] || currentPrice,
    basis: basis[basis.length - 1] || currentPrice
  };
  const atr = calcATR(highs, lows, closes, 14).pop() || (currentPrice * 0.01);

  const mtfaTrend = ema50_1h > ema200_1h ? 'BULLISH' : (ema50_1h < ema200_1h ? 'BEARISH' : 'MIXED');
  const btcTrend = currentBtcPrice > btcEma50_1h ? 'BULLISH' : 'BEARISH';
  const divergence = detectDivergence(closes, rsiArray, 20);

  let bullScore = 0;
  let bearScore = 0;

  const wMTFA = rlOptimizer.getWeight(symbol, 'mtfa');
  const wBTC = rlOptimizer.getWeight(symbol, 'btc');
  const wEMA = rlOptimizer.getWeight(symbol, 'ema');
  const wMACD = rlOptimizer.getWeight(symbol, 'macd');
  const wRSI = rlOptimizer.getWeight(symbol, 'rsi');
  const wBB = rlOptimizer.getWeight(symbol, 'bb');
  const wVWAP = rlOptimizer.getWeight(symbol, 'vwap');
  const wDiv = rlOptimizer.getWeight(symbol, 'divergence');

  if (mtfaTrend === 'BULLISH') bullScore += 20 * wMTFA;
  if (mtfaTrend === 'BEARISH') bearScore += 20 * wMTFA;
  if (btcTrend === 'BULLISH') bullScore += 15 * wBTC;
  if (btcTrend === 'BEARISH') bearScore += 15 * wBTC;

  const avgVolume = volumes.slice(-20).reduce((sum, volume) => sum + volume, 0) / 20;
  const currentVolume = volumes[volumes.length - 1] || 0;
  const volumeSpike = currentVolume > avgVolume * 2.5;

  if (adx > 25) {
    if (ema20 > ema50 && ema50 > ema200) bullScore += 20 * wEMA;
    if (ema20 < ema50 && ema50 < ema200) bearScore += 20 * wEMA;

    if (macd.line > macd.signal && macd.hist > 0) bullScore += 15 * wMACD;
    if (macd.line < macd.signal && macd.hist < 0) bearScore += 15 * wMACD;

    if (currentPrice > vwap) bullScore += 10 * wVWAP;
    if (currentPrice < vwap) bearScore += 10 * wVWAP;
  } else {
    if (rsi < 35) bullScore += 20 * wRSI;
    if (rsi > 65) bearScore += 20 * wRSI;

    if (currentPrice < bb.lower) bullScore += 20 * wBB;
    if (currentPrice > bb.upper) bearScore += 20 * wBB;

    if (macd.hist > 0 && macd.hist > previousHistogram) bullScore += 10 * wMACD;
    if (macd.hist < 0 && macd.hist < previousHistogram) bearScore += 10 * wMACD;
  }

  if (obv > prevObv && volumeSpike) bullScore += 15;
  if (obv < prevObv && volumeSpike) bearScore += 15;

  if (divergence === 'BULLISH') bullScore += 25 * wDiv;
  if (divergence === 'BEARISH') bearScore += 25 * wDiv;

  if (ticker) {
    const funding = Number(ticker.fundingRate);
    if (funding < -0.0005) bullScore += 10;
    if (funding > 0.0005) bearScore += 10;

    const screenerSignal = getSignalType(ticker);
    if (screenerSignal.includes('LONG')) bullScore += 20;
    if (screenerSignal.includes('SHORT')) bearScore += 20;
  }

  let direction: SignalDirection = 'NEUTRAL';
  let finalScore = 0;

  if (bullScore > bearScore && bullScore >= 65) {
    direction = 'LONG';
    finalScore = Math.min(99, bullScore);
  } else if (bearScore > bullScore && bearScore >= 65) {
    direction = 'SHORT';
    finalScore = Math.min(99, bearScore);
  } else {
    direction = 'NEUTRAL';
    finalScore = Math.max(bullScore, bearScore);
  }

  if (direction === 'LONG' && btcTrend === 'BEARISH') finalScore = Math.max(0, finalScore - 25);
  if (direction === 'SHORT' && btcTrend === 'BULLISH') finalScore = Math.max(0, finalScore - 25);
  if (finalScore < 55) direction = 'NEUTRAL';

  const { swingHigh, swingLow } = findSwingHighLow(highs, lows, 20);
  const fibLevels = calcFibonacci(swingHigh, swingLow);
  const nearestFib = fibLevels.find((fib) => Math.abs(fib.value - currentPrice) / currentPrice < 0.02) || fibLevels[2];

  let stopLoss = currentPrice - atr * 1.5;
  let takeProfit1 = currentPrice + atr * 1.5;
  let takeProfit2 = currentPrice + atr * 3.0;

  if (direction === 'LONG') {
    stopLoss = Math.min(swingLow * 0.998, currentPrice - atr * 1.5);
    const risk = currentPrice - stopLoss;
    takeProfit1 = currentPrice + (risk * 1.5);
    takeProfit2 = currentPrice + (risk * 3.0);
  } else if (direction === 'SHORT') {
    stopLoss = Math.max(swingHigh * 1.002, currentPrice + atr * 1.5);
    const risk = stopLoss - currentPrice;
    takeProfit1 = currentPrice - (risk * 1.5);
    takeProfit2 = currentPrice - (risk * 3.0);
  }

  const risk = Math.abs(currentPrice - stopLoss);
  const reward = Math.abs(takeProfit1 - currentPrice);
  const riskReward = risk > 0 ? Number((reward / risk).toFixed(2)) : 0;

  let elliottWave = 'Wave 4 (Consolidation)';
  if (adx > 25) {
    if (rsi > 60 || rsi < 40) elliottWave = 'Wave 3 (Impulse)';
    if (rsi > 75 || rsi < 25) elliottWave = 'Wave 5 (Exhaustion)';
  } else if (divergence !== 'NONE') {
    elliottWave = 'Wave 5 (Exhaustion)';
  }

  return {
    direction,
    finalScore,
    currentPrice,
    takeProfit1,
    takeProfit2,
    stopLoss,
    riskReward,
    indicators: {
      ema20,
      ema50,
      ema200,
      adx,
      rsi,
      macd,
      obv,
      vwap,
      bb,
      atr,
      fibonacci: { nearestLevel: nearestFib.level, value: nearestFib.value },
      elliottWave,
      trend: ema20 > ema50 ? 'BULLISH' : 'BEARISH',
      mtfaTrend,
      btcTrend,
      volumeSpike,
      liquidityLevels: {
        resistance: [swingHigh, swingHigh * 1.02],
        support: [swingLow, swingLow * 0.98]
      },
      oiChange24h: 0
    }
  };
};

const getKlinesUpToTime = (klines: Kline[], time: number) =>
  klines.filter((kline) => kline.startTime <= time);

const estimateHistoricalSignalStats = (
  symbol: string,
  k15m: Kline[],
  k1h: Kline[],
  k4h: Kline[],
  btc1h: Kline[]
) => {
  if (k15m.length < 80 || k1h.length < 50 || k4h.length < 50 || btc1h.length < 50) {
    return EMPTY_BACKTEST_STATS;
  }

  let wins = 0;
  let losses = 0;
  let unresolved = 0;

  for (let index = 60; index < k15m.length - 6; index += 1) {
    const historical15m = k15m.slice(0, index + 1);
    const currentTime = historical15m[historical15m.length - 1].startTime;
    const historical1h = getKlinesUpToTime(k1h, currentTime);
    const historical4h = getKlinesUpToTime(k4h, currentTime);
    const historicalBtc1h = getKlinesUpToTime(btc1h, currentTime);

    if (historical1h.length < 50 || historical4h.length < 50 || historicalBtc1h.length < 50) {
      continue;
    }

    const analysis = buildSignalAnalysis(symbol, historical15m, historical1h, historical4h, historicalBtc1h, null);
    if (!analysis || analysis.direction === 'NEUTRAL') continue;

    const outcome = resolveTradeOutcome(
      {
        direction: analysis.direction,
        entryPrice: analysis.currentPrice,
        stopLoss: analysis.stopLoss,
        takeProfit: analysis.takeProfit1,
        entryMode: 'market'
      },
      k15m.slice(index + 1, index + 7)
    );

    if (outcome === 'win') wins += 1;
    else if (outcome === 'loss') losses += 1;
    else if (outcome === 'open') unresolved += 1;
  }

  return createBacktestStats(wins, losses, unresolved);
};

export const generateSignal = (
  symbol: string,
  k15m: Kline[],
  k1h: Kline[],
  k4h: Kline[],
  btc1h: Kline[],
  ticker: BybitTicker | null = null
): TradingSignal | null => {
  const analysis = buildSignalAnalysis(symbol, k15m, k1h, k4h, btc1h, ticker);
  if (!analysis) return null;

  const stats = estimateHistoricalSignalStats(symbol, k15m, k1h, k4h, btc1h);

  return {
    symbol,
    direction: analysis.direction,
    type: analysis.indicators.adx > 25 ? 'Trend Continuation' : 'Trend Reversal',
    score: Math.round(analysis.finalScore),
    entryPrice: analysis.currentPrice,
    takeProfit1: analysis.takeProfit1,
    takeProfit2: analysis.takeProfit2,
    stopLoss: analysis.stopLoss,
    riskReward: analysis.riskReward,
    winRate: stats.winRate,
    wins: stats.wins,
    losses: stats.losses,
    sampleSize: stats.sampleSize,
    unresolved: stats.unresolved,
    indicators: analysis.indicators,
    timestamp: new Date()
  };
};
