export interface BybitTicker {
  symbol: string;
  lastPrice: string;
  indexPrice: string;
  markPrice: string;
  prevPrice24h: string;
  price24hPcnt: string;
  highPrice24h: string;
  lowPrice24h: string;
  prevPrice1h: string;
  openInterest: string;
  openInterestValue: string;
  turnover24h: string;
  volume24h: string;
  fundingRate: string;
  nextFundingTime: string;
  launchTime?: string;
}

export type SortField = 
  | 'symbol' 
  | 'lastPrice' 
  | 'change1h' 
  | 'change24h' 
  | 'turnover24h' 
  | 'fundingRate' 
  | 'openInterestValue'
  | 'toRes'
  | 'toSup'
  | 'launchTime';

export type SortDirection = 'asc' | 'desc';

export interface Kline {
  startTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  type: string; // e.g., "Trend Continuation", "Mean Reversion"
  score: number;
  entryPrice: number;
  takeProfit1: number;
  takeProfit2: number;
  stopLoss: number;
  riskReward: number;
  indicators: {
    ema20: number;
    ema50: number;
    ema200: number;
    adx: number;
    rsi: number;
    macd: { line: number; signal: number; hist: number };
    obv: number;
    vwap: number;
    bb: { upper: number; lower: number; basis: number };
    atr: number;
    fibonacci: { nearestLevel: number; value: number };
    elliottWave: string;
    trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    mtfaTrend: 'BULLISH' | 'BEARISH' | 'MIXED';
    btcTrend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    volumeSpike: boolean;
    liquidityLevels: { resistance: number[]; support: number[] };
    oiChange24h: number;
  };
  timestamp: Date;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

