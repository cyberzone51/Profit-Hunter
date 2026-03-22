import { Kline } from '../types';

export type TradeDirection = 'LONG' | 'SHORT';
export type TradeEntryMode = 'market' | 'limit' | 'stop';

export interface TradeSetup {
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  entryMode?: TradeEntryMode;
}

export interface BacktestStats {
  wins: number;
  losses: number;
  total: number;
  unresolved: number;
  sampleSize: number;
  winRate: number;
}

export const EMPTY_BACKTEST_STATS: BacktestStats = {
  wins: 0,
  losses: 0,
  total: 0,
  unresolved: 0,
  sampleSize: 0,
  winRate: 0
};

const isFinitePositive = (value: number) => Number.isFinite(value) && value > 0;

const didEntryTrigger = (setup: TradeSetup, candle: Kline) => {
  const mode = setup.entryMode || 'market';

  if (mode === 'market') return true;

  if (setup.direction === 'LONG') {
    if (mode === 'limit') return candle.low <= setup.entryPrice;
    return candle.high >= setup.entryPrice;
  }

  if (mode === 'limit') return candle.high >= setup.entryPrice;
  return candle.low <= setup.entryPrice;
};

const resolveExitOnCandle = (setup: TradeSetup, candle: Kline): 'win' | 'loss' | 'open' => {
  if (setup.direction === 'LONG') {
    const hitStop = candle.low <= setup.stopLoss;
    const hitTarget = candle.high >= setup.takeProfit;

    if (hitStop && hitTarget) return 'loss';
    if (hitStop) return 'loss';
    if (hitTarget) return 'win';
    return 'open';
  }

  const hitStop = candle.high >= setup.stopLoss;
  const hitTarget = candle.low <= setup.takeProfit;

  if (hitStop && hitTarget) return 'loss';
  if (hitStop) return 'loss';
  if (hitTarget) return 'win';
  return 'open';
};

export const resolveTradeOutcome = (
  setup: TradeSetup,
  futureCandles: Kline[]
): 'win' | 'loss' | 'open' | 'no-entry' => {
  if (
    !isFinitePositive(setup.entryPrice) ||
    !isFinitePositive(setup.takeProfit) ||
    !isFinitePositive(setup.stopLoss)
  ) {
    return 'no-entry';
  }

  const invalidLong = setup.direction === 'LONG'
    && (setup.stopLoss >= setup.entryPrice || setup.takeProfit <= setup.entryPrice);
  const invalidShort = setup.direction === 'SHORT'
    && (setup.stopLoss <= setup.entryPrice || setup.takeProfit >= setup.entryPrice);

  if (invalidLong || invalidShort) {
    return 'no-entry';
  }

  let entered = (setup.entryMode || 'market') === 'market';

  for (const candle of futureCandles) {
    if (!entered) {
      if (!didEntryTrigger(setup, candle)) continue;
      entered = true;
    }

    const exit = resolveExitOnCandle(setup, candle);
    if (exit !== 'open') return exit;
  }

  return entered ? 'open' : 'no-entry';
};

export const createBacktestStats = (
  wins: number,
  losses: number,
  unresolved = 0
): BacktestStats => {
  const total = wins + losses;

  return {
    wins,
    losses,
    total,
    unresolved,
    sampleSize: total + unresolved,
    winRate: total > 0 ? wins / total : 0
  };
};
