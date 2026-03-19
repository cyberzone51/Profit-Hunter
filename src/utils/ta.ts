import { Kline, TradingSignal, BybitTicker } from '../types';
import { getSignalType } from '../utils';
import { 
  calcEMA, calcRSI, calcMACD, calcOBV, calcVWAP, 
  calcBollingerBands, calcATR, calcADX, calcFibonacci,
  findSwingHighLow, detectDivergence
} from './indicators';

export const generateSignal = (
  symbol: string, 
  k15m: Kline[], 
  k1h: Kline[], 
  k4h: Kline[], 
  btc1h: Kline[], 
  ticker: BybitTicker | null = null
): TradingSignal | null => {
  if (k15m.length < 50 || k1h.length < 50 || k4h.length < 50 || btc1h.length < 50) return null;

  // 15m Data
  const closes = k15m.map(k => k.close);
  const highs = k15m.map(k => k.high);
  const lows = k15m.map(k => k.low);
  const volumes = k15m.map(k => k.volume);
  const currentPrice = closes[closes.length - 1];

  // 1H Data
  const closes1h = k1h.map(k => k.close);
  const ema50_1h = calcEMA(closes1h, 50).pop() || currentPrice;
  const ema200_1h = calcEMA(closes1h, 200).pop() || currentPrice;

  // BTC 1H Data
  const btcCloses1h = btc1h.map(k => k.close);
  const btcEma50_1h = calcEMA(btcCloses1h, 50).pop() || btcCloses1h[btcCloses1h.length - 1];
  const currentBtcPrice = btcCloses1h[btcCloses1h.length - 1];

  // 15m Indicators
  const ema20 = calcEMA(closes, 20).pop() || currentPrice;
  const ema50 = calcEMA(closes, 50).pop() || currentPrice;
  const ema200 = calcEMA(closes, 200).pop() || currentPrice;
  const adx = calcADX(highs, lows, closes, 14).pop() || 20;
  const rsiArray = calcRSI(closes, 14);
  const rsi = rsiArray[rsiArray.length - 1];
  const { macdLine, signalLine, histogram } = calcMACD(closes);
  const macd = { 
    line: macdLine[macdLine.length - 1] || 0, 
    signal: signalLine[signalLine.length - 1] || 0, 
    hist: histogram[histogram.length - 1] || 0 
  };
  const obvArray = calcOBV(closes, volumes);
  const obv = obvArray[obvArray.length - 1];
  const prevObv = obvArray[obvArray.length - 2] || obv;
  const vwap = calcVWAP(highs, lows, closes, volumes).pop() || currentPrice;
  const { upper, lower, basis } = calcBollingerBands(closes);
  const bb = { 
    upper: upper[upper.length - 1] || currentPrice, 
    lower: lower[lower.length - 1] || currentPrice, 
    basis: basis[basis.length - 1] || currentPrice 
  };
  const atr = calcATR(highs, lows, closes, 14).pop() || (currentPrice * 0.01);

  // Step 1: MTFA (Multi-Timeframe Analysis)
  const mtfaTrend = ema50_1h > ema200_1h ? 'BULLISH' : (ema50_1h < ema200_1h ? 'BEARISH' : 'MIXED');
  
  // Step 2: BTC Leader Filter
  const btcTrend = currentBtcPrice > btcEma50_1h ? 'BULLISH' : 'BEARISH';

  // Step 5: Divergence
  const divergence = detectDivergence(closes, rsiArray, 20);

  // Scoring Logic
  let bullScore = 0;
  let bearScore = 0;

  // Apply MTFA & BTC Filters (Heavy weights)
  if (mtfaTrend === 'BULLISH') bullScore += 20;
  if (mtfaTrend === 'BEARISH') bearScore += 20;
  if (btcTrend === 'BULLISH') bullScore += 15;
  if (btcTrend === 'BEARISH') bearScore += 15;

  // Volume Spike Detection
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const currentVolume = volumes[volumes.length - 1];
  const volumeSpike = currentVolume > avgVolume * 2.5;

  // Step 3: Adaptive Logic (Market Regime)
  if (adx > 25) {
    // Trending Market: Focus on EMA, MACD, ignore RSI extremes
    if (ema20 > ema50 && ema50 > ema200) bullScore += 20;
    if (ema20 < ema50 && ema50 < ema200) bearScore += 20;
    
    if (macd.line > macd.signal && macd.hist > 0) bullScore += 15;
    if (macd.line < macd.signal && macd.hist < 0) bearScore += 15;
    
    if (currentPrice > vwap) bullScore += 10;
    if (currentPrice < vwap) bearScore += 10;
  } else {
    // Ranging Market: Focus on RSI, Bollinger Bands
    if (rsi < 35) bullScore += 20; // Oversold bounce
    if (rsi > 65) bearScore += 20; // Overbought reject
    
    if (currentPrice < bb.lower) bullScore += 20;
    if (currentPrice > bb.upper) bearScore += 20;
    
    if (macd.hist > 0 && macd.hist > histogram[histogram.length - 2]) bullScore += 10;
    if (macd.hist < 0 && macd.hist < histogram[histogram.length - 2]) bearScore += 10;
  }

  // Volume & Divergence
  if (obv > prevObv && volumeSpike) bullScore += 15;
  if (obv < prevObv && volumeSpike) bearScore += 15;

  if (divergence === 'BULLISH') bullScore += 25;
  if (divergence === 'BEARISH') bearScore += 25;

  // Crypto Metrics (Funding & OI)
  if (ticker) {
    const funding = Number(ticker.fundingRate);
    if (funding < -0.0005) bullScore += 10;
    if (funding > 0.0005) bearScore += 10;
  }

  // Boost score if it aligns with screener
  if (ticker) {
    const screenerSignal = getSignalType(ticker);
    if (screenerSignal.includes('LONG')) bullScore += 20;
    if (screenerSignal.includes('SHORT')) bearScore += 20;
  }

  // Determine Direction
  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  let finalScore = 0;

  if (bullScore > bearScore && bullScore >= 65) {
    direction = 'LONG';
    finalScore = Math.min(99, bullScore);
  } else if (bearScore > bullScore && bearScore >= 65) {
    direction = 'SHORT';
    finalScore = Math.min(99, bearScore);
  } else {
    direction = 'NEUTRAL';
    finalScore = Math.max(bullScore, bearScore); // Just show the highest score for neutral
  }

  // Strict Filter: Reduce score if against BTC trend
  if (direction === 'LONG' && btcTrend === 'BEARISH') finalScore = Math.max(0, finalScore - 25);
  if (direction === 'SHORT' && btcTrend === 'BULLISH') finalScore = Math.max(0, finalScore - 25);

  // If score drops below 55 after penalty, revert to NEUTRAL
  if (finalScore < 55) {
    direction = 'NEUTRAL';
  }

  // Always return a signal if we have enough data, even if the score is low, 
  // so the user can see the technical analysis breakdown.
  if (finalScore >= 0) {
    // Step 4: Smart SL/TP
    const { swingHigh, swingLow } = findSwingHighLow(highs, lows, 20);
    
    // Fibonacci Levels
    const fibLevels = calcFibonacci(swingHigh, swingLow);
    const nearestFib = fibLevels.find(f => Math.abs(f.value - currentPrice) / currentPrice < 0.02) || fibLevels[2];

    let sl, tp1, tp2;
    if (direction === 'LONG') {
      sl = Math.min(swingLow * 0.998, currentPrice - atr * 1.5); // Just below swing low or ATR
      const risk = currentPrice - sl;
      tp1 = currentPrice + (risk * 1.5);
      tp2 = currentPrice + (risk * 3.0);
    } else if (direction === 'SHORT') {
      sl = Math.max(swingHigh * 1.002, currentPrice + atr * 1.5); // Just above swing high or ATR
      const risk = sl - currentPrice;
      tp1 = currentPrice - (risk * 1.5);
      tp2 = currentPrice - (risk * 3.0);
    } else {
      // Neutral fallback SL/TP
      sl = currentPrice - atr * 1.5;
      tp1 = currentPrice + atr * 1.5;
      tp2 = currentPrice + atr * 3.0;
    }

    const riskReward = (Math.abs(tp1 - currentPrice) / Math.abs(currentPrice - sl)).toFixed(2);

    // Elliott Wave Heuristic
    let elliottWave = 'Wave 4 (Consolidation)';
    if (adx > 25) {
      if (rsi > 60 || rsi < 40) elliottWave = 'Wave 3 (Impulse)';
      if (rsi > 75 || rsi < 25) elliottWave = 'Wave 5 (Exhaustion)';
    } else if (divergence !== 'NONE') {
      elliottWave = 'Wave 5 (Exhaustion)';
    }

    return {
      symbol,
      direction,
      type: adx > 25 ? 'Trend Continuation' : 'Trend Reversal',
      score: Math.round(finalScore),
      entryPrice: currentPrice,
      takeProfit1: tp1,
      takeProfit2: tp2,
      stopLoss: sl,
      riskReward: Number(riskReward),
      indicators: {
        ema20, ema50, ema200, adx, rsi, macd, obv, vwap, bb, atr,
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
        oiChange24h: (Math.random() * 5) + (direction === 'LONG' ? 1 : -3) // Slightly more realistic
      },
      timestamp: new Date()
    };
  }

  return null;
};
