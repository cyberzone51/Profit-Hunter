export function calcEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return prices;
  const k = 2 / (period + 1);
  const ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

export function calcRSI(prices: number[], period: number = 14): number[] {
  if (prices.length < period) return prices.map(() => 50);
  const rsi = new Array(prices.length).fill(50);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = 100 - (100 / (1 + avgGain / (avgLoss === 0 ? 1e-10 : avgLoss)));

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = 100 - (100 / (1 + avgGain / (avgLoss === 0 ? 1e-10 : avgLoss)));
  }
  return rsi;
}

export function calcMACD(prices: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(prices, fast);
  const emaSlow = calcEMA(prices, slow);
  const macdLine = emaFast.map((f, i) => f - emaSlow[i]);
  const signalLine = calcEMA(macdLine, signal);
  const histogram = macdLine.map((m, i) => m - signalLine[i]);
  
  return { macdLine, signalLine, histogram };
}

export function calcOBV(closes: number[], volumes: number[]): number[] {
  const obv = [volumes[0]];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv.push(obv[i - 1] + volumes[i]);
    else if (closes[i] < closes[i - 1]) obv.push(obv[i - 1] - volumes[i]);
    else obv.push(obv[i - 1]);
  }
  return obv;
}

export function calcVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number[] {
  const vwap = [];
  let cumulativeTPV = 0;
  let cumulativeVol = 0;
  
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumulativeTPV += tp * volumes[i];
    cumulativeVol += volumes[i];
    vwap.push(cumulativeTPV / cumulativeVol);
  }
  return vwap;
}

export function calcBollingerBands(prices: number[], period = 20, stdDev = 2) {
  const upper = [];
  const lower = [];
  const basis = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upper.push(prices[i]);
      lower.push(prices[i]);
      basis.push(prices[i]);
      continue;
    }
    
    const slice = prices.slice(i - period + 1, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    const sma = sum / period;
    
    const squaredDiffs = slice.map(p => Math.pow(p - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(variance);
    
    basis.push(sma);
    upper.push(sma + stdDev * sd);
    lower.push(sma - stdDev * sd);
  }
  
  return { upper, lower, basis };
}

export function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const tr = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(hl, hc, lc));
  }
  return calcEMA(tr, period); // Using EMA for smoothing ATR
}

export function calcADX(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  // Simplified ADX approximation for performance
  const adx = new Array(closes.length).fill(20);
  if (closes.length < period) return adx;
  
  const atr = calcATR(highs, lows, closes, period);
  
  for (let i = period; i < closes.length; i++) {
    const upMove = highs[i] - highs[i-1];
    const downMove = lows[i-1] - lows[i];
    
    let pDM = 0;
    let nDM = 0;
    
    if (upMove > downMove && upMove > 0) pDM = upMove;
    if (downMove > upMove && downMove > 0) nDM = downMove;
    
    // Very simplified DX calculation
    const currentAtr = atr[i] === 0 ? 1e-10 : atr[i];
    const pDI = (pDM / currentAtr) * 100;
    const nDI = (nDM / currentAtr) * 100;
    
    const dx = Math.abs(pDI - nDI) / (pDI + nDI === 0 ? 1 : (pDI + nDI)) * 100;
    
    // Smooth DX to get ADX (simple average approximation)
    adx[i] = (adx[i-1] * (period - 1) + dx) / period;
  }
  
  return adx;
}

export function calcFibonacci(high: number, low: number) {
  const diff = high - low;
  
  return [
    { level: 0, value: high },
    { level: 0.236, value: high - diff * 0.236 },
    { level: 0.382, value: high - diff * 0.382 },
    { level: 0.5, value: high - diff * 0.5 },
    { level: 0.618, value: high - diff * 0.618 },
    { level: 0.786, value: high - diff * 0.786 },
    { level: 1, value: low }
  ];
}

export function findSwingHighLow(highs: number[], lows: number[], period: number = 20) {
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);
  return {
    swingHigh: Math.max(...recentHighs),
    swingLow: Math.min(...recentLows)
  };
}

export function detectDivergence(prices: number[], rsis: number[], period: number = 20): 'BULLISH' | 'BEARISH' | 'NONE' {
  if (prices.length < period || rsis.length < period) return 'NONE';
  
  const recentPrices = prices.slice(-period);
  const recentRSIs = rsis.slice(-period);
  
  // Find lowest and highest points in the period
  let minPriceIdx = 0;
  let maxPriceIdx = 0;
  
  for (let i = 1; i < period; i++) {
    if (recentPrices[i] < recentPrices[minPriceIdx]) minPriceIdx = i;
    if (recentPrices[i] > recentPrices[maxPriceIdx]) maxPriceIdx = i;
  }
  
  const currentPrice = recentPrices[period - 1];
  const currentRSI = recentRSIs[period - 1];
  
  // Bullish Divergence: Price makes lower low, RSI makes higher low
  if (minPriceIdx < period - 5 && currentPrice < recentPrices[minPriceIdx] && currentRSI > recentRSIs[minPriceIdx]) {
    return 'BULLISH';
  }
  
  // Bearish Divergence: Price makes higher high, RSI makes lower high
  if (maxPriceIdx < period - 5 && currentPrice > recentPrices[maxPriceIdx] && currentRSI < recentRSIs[maxPriceIdx]) {
    return 'BEARISH';
  }
  
  return 'NONE';
}
