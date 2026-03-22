import { useState, useEffect, useRef } from 'react';
import { BybitTicker } from '../types';
import { API_URL } from '../config';
import { createBacktestStats, EMPTY_BACKTEST_STATS, resolveTradeOutcome } from '../utils/backtest';

type ProSignal =
  | 'ELITE TRADE'
  | 'SMART MONEY LONG'
  | 'SMART MONEY SHORT'
  | 'WATCHLIST LONG'
  | 'WATCHLIST SHORT'
  | 'NEUTRAL';

type Direction = 'LONG' | 'SHORT' | 'NONE';

type Snapshot = {
  ts: number;
  price: number;
  turnover: number;
  openInterestValue: number;
};

type AnalysisKline = {
  startTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export interface ProAnalysisResult {
  candidate: boolean;
  rejectReason: string | null;
  score: number;
  aiProbability: number;
  winRate: number;
  wins: number;
  losses: number;
  sampleSize: number;
  signal: ProSignal;
  metrics: {
    turnover: number;
    tradesPerMin: number;
    momentum: number;
    priceChange5m: number;
    openInterestValue: number;
    oiGrowth: number;
    fundingRate: number;
    spread: number;
    volatility: number;
    volumeSpike: boolean;
    volumeRatio: number;
    currentVolume5m: number;
    avgVolume5m: number;
    buyVolume: number;
    sellVolume: number;
    delta: number;
    deltaPositive: boolean;
    deltaNegative: boolean;
    fundingNormal: boolean;
    fundingPositive: boolean;
    largeTradeCount: number;
    largeTradeThreshold: number;
    whalesActive: boolean;
    crossSpread: number;
    binanceConfirms: boolean;
    bybitLeads: boolean;
    orderbookImbalance: number;
    whaleBuyVol: number;
    whaleSellVol: number;
    atr: number;
    support: number;
    resistance: number;
    breakout: boolean;
    pullbackPct: number;
    pullbackReady: boolean;
    recentImpulseHigh: number;
    recentImpulseLow: number;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    riskReward: number;
    binancePriceChange5m: number;
  };
  scoreDetails: {
    volume: number;
    momentum: number;
    oi: number;
    funding: number;
    delta: number;
    whales: number;
  };
  smartMoney: {
    direction: Direction;
    preFilterPassed: boolean;
    setupReady: boolean;
    strongEntry: boolean;
    entryReady: boolean;
    blockedReasons: string[];
  };
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const average = (values: number[]) => values.length > 0
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 0;

const normalizeReferencePriceChange = (exchange: string, referenceTicker: any) => {
  if (!referenceTicker) return 0;
  if (exchange === 'Bybit') {
    return toNumber(referenceTicker.price24hPcnt) * 100;
  }
  return toNumber(referenceTicker.priceChangePercent);
};

const estimateProTradeStats = (klines: AnalysisKline[], direction: Direction) => {
  if (direction === 'NONE' || klines.length < 20) return EMPTY_BACKTEST_STATS;

  let wins = 0;
  let losses = 0;
  let unresolved = 0;

  for (let index = 6; index < klines.length - 6; index += 1) {
    const history = klines.slice(0, index + 1);
    const current = history[history.length - 1];
    const previous = history[history.length - 2];
    const breakoutWindow = history.slice(-7, -1);
    if (!current || !previous || breakoutWindow.length === 0) continue;

    const averageVolume = average(history.slice(-7, -1).map((kline) => kline.volume));
    const volumeSpike = averageVolume > 0 && current.volume >= averageVolume * 2;
    const priceChange = previous.close > 0 ? ((current.close - previous.close) / previous.close) * 100 : 0;
    const priorHigh = Math.max(...breakoutWindow.map((kline) => kline.high));
    const priorLow = Math.min(...breakoutWindow.map((kline) => kline.low));

    if (direction === 'LONG') {
      if (!volumeSpike || priceChange < 1.5 || current.high <= priorHigh) continue;

      const recentHigh = Math.max(...history.slice(-3).map((kline) => kline.high));
      const recentLow = Math.min(...history.slice(-5).map((kline) => kline.low));
      const entryPrice = recentHigh * (1 - 0.005);
      const stopLoss = recentLow > 0 && recentLow < entryPrice ? recentLow : entryPrice * 0.99;
      const risk = Math.max(entryPrice - stopLoss, entryPrice * 0.01);
      const takeProfit = entryPrice + (risk * 2);

      const outcome = resolveTradeOutcome(
        { direction: 'LONG', entryPrice, stopLoss, takeProfit, entryMode: 'limit' },
        klines.slice(index + 1, index + 7)
      );

      if (outcome === 'win') wins += 1;
      else if (outcome === 'loss') losses += 1;
      else if (outcome === 'open') unresolved += 1;
      continue;
    }

    if (!volumeSpike || priceChange > -1.5 || current.low >= priorLow) continue;

    const recentLow = Math.min(...history.slice(-3).map((kline) => kline.low));
    const recentHigh = Math.max(...history.slice(-5).map((kline) => kline.high));
    const entryPrice = recentLow * (1 + 0.005);
    const stopLoss = recentHigh > entryPrice ? recentHigh : entryPrice * 1.01;
    const risk = Math.max(stopLoss - entryPrice, entryPrice * 0.01);
    const takeProfit = entryPrice - (risk * 2);

    const outcome = resolveTradeOutcome(
      { direction: 'SHORT', entryPrice, stopLoss, takeProfit, entryMode: 'limit' },
      klines.slice(index + 1, index + 7)
    );

    if (outcome === 'win') wins += 1;
    else if (outcome === 'loss') losses += 1;
    else if (outcome === 'open') unresolved += 1;
  }

  return createBacktestStats(wins, losses, unresolved);
};

export const useProAnalysis = (ticker: BybitTicker | null) => {
  const [result, setResult] = useState<ProAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tickerRef = useRef(ticker);
  const snapshotHistoryRef = useRef<Snapshot[]>([]);

  useEffect(() => {
    tickerRef.current = ticker;
  }, [ticker]);

  useEffect(() => {
    if (!ticker) {
      setResult(null);
      return;
    }

    let isMounted = true;
    let intervalId: number | undefined;
    let klines: AnalysisKline[] = [];
    let referenceExchange = 'Binance';
    let referenceTicker: any = null;
    let referenceKlines: AnalysisKline[] = [];

    snapshotHistoryRef.current = [];
    setLoading(true);
    setError(null);

    const fetchRestData = async () => {
      const currentTicker = tickerRef.current;
      if (!currentTicker) return;

      try {
        let baseUrl = API_URL;
        if (baseUrl.endsWith('/')) {
          baseUrl = baseUrl.slice(0, -1);
        }

        const exchange = encodeURIComponent(currentTicker.exchange || 'Bybit');
        const symbol = encodeURIComponent(currentTicker.symbol);
        const response = await fetch(`${baseUrl}/api/pro-analysis-data?symbol=${symbol}&exchange=${exchange}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        klines = Array.isArray(data.klines) ? data.klines : [];
        referenceExchange = data.referenceExchange || 'Binance';
        referenceTicker = data.referenceTicker || null;
        referenceKlines = Array.isArray(data.referenceKlines) ? data.referenceKlines : [];
      } catch (restError) {
        console.error('Error fetching pro analysis data:', restError);
      }
    };

    const calculateResult = () => {
      const currentTicker = tickerRef.current;
      if (!currentTicker || !isMounted) return;

      const now = Date.now();
      const price = toNumber(currentTicker.lastPrice);
      const turnover24h = toNumber(currentTicker.turnover24h);
      const openInterestValue = toNumber(currentTicker.openInterestValue);
      const fundingRate = toNumber(currentTicker.fundingRate);
      const ask1Price = toNumber(currentTicker.ask1Price, price);
      const bid1Price = toNumber(currentTicker.bid1Price, price);
      const ask1Size = toNumber(currentTicker.ask1Size);
      const bid1Size = toNumber(currentTicker.bid1Size);
      const highPrice24h = toNumber(currentTicker.highPrice24h, price);
      const lowPrice24h = toNumber(currentTicker.lowPrice24h, price);
      const price24hPcnt = toNumber(currentTicker.price24hPcnt) * 100;
      const spread = price > 0 ? ((ask1Price - bid1Price) / price) * 100 : 0;
      const volatility = lowPrice24h > 0 ? (highPrice24h - lowPrice24h) / lowPrice24h : 0;

      snapshotHistoryRef.current.push({
        ts: now,
        price,
        turnover: turnover24h,
        openInterestValue
      });
      snapshotHistoryRef.current = snapshotHistoryRef.current.filter((snapshot) => now - snapshot.ts <= 10 * 60 * 1000);

      const snapshot5mAgo = snapshotHistoryRef.current.find((snapshot) => now - snapshot.ts >= 5 * 60 * 1000) || snapshotHistoryRef.current[0];
      const snapshot1mAgo = snapshotHistoryRef.current.find((snapshot) => now - snapshot.ts >= 60 * 1000) || snapshotHistoryRef.current[0];

      const currentVolume = klines[klines.length - 1]?.volume || Math.max(0, turnover24h - toNumber(snapshot5mAgo?.turnover));
      const historicalVolumes = klines.length > 1
        ? klines.slice(0, -1).map((kline) => kline.volume)
        : snapshotHistoryRef.current.slice(1).map((snapshot, index) =>
            Math.max(0, snapshot.turnover - snapshotHistoryRef.current[index].turnover)
          );
      const avgVolume = average(historicalVolumes);
      const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;
      const volumeSpike = currentVolume > 0 && avgVolume > 0 ? currentVolume >= 2 * avgVolume : false;

      const prevClose = klines[klines.length - 2]?.close || toNumber(snapshot5mAgo?.price, price);
      const currentClose = klines[klines.length - 1]?.close || price;
      const priceChange5m = prevClose > 0 ? ((currentClose - prevClose) / prevClose) * 100 : 0;

      const oiGrowth = snapshot5mAgo && snapshot5mAgo.openInterestValue > 0
        ? ((openInterestValue - snapshot5mAgo.openInterestValue) / snapshot5mAgo.openInterestValue) * 100
        : 0;

      const orderbookImbalance = (bid1Size + ask1Size) > 0
        ? (bid1Size - ask1Size) / (bid1Size + ask1Size)
        : 0;

      const turnoverDelta1m = snapshot1mAgo ? Math.max(0, turnover24h - snapshot1mAgo.turnover) : 0;
      const tradesPerMin = turnoverDelta1m > 0 ? Math.max(1, Math.round(turnoverDelta1m / Math.max(price, 1))) : 0;

      const bullishMicroBias = orderbookImbalance > 0.12 || priceChange5m > 0;
      const bearishMicroBias = orderbookImbalance < -0.12 || priceChange5m < 0;
      const buyVolume = bullishMicroBias ? currentVolume * 0.6 : currentVolume * 0.4;
      const sellVolume = currentVolume - buyVolume;
      const delta = buyVolume - sellVolume;
      const deltaPositive = delta > 0;
      const deltaNegative = delta < 0;

      const largeTradeThreshold = 3;
      const largeTradeCount = turnoverDelta1m > 0 ? Math.floor(turnoverDelta1m / 50000) : 0;
      const whaleBuyVol = deltaPositive ? Math.max(0, delta) : 0;
      const whaleSellVol = deltaNegative ? Math.max(0, Math.abs(delta)) : 0;
      const whalesActive = largeTradeCount >= largeTradeThreshold || (volumeSpike && turnover24h >= 250_000_000);

      const highs = klines.length > 0 ? klines.map((kline) => kline.high) : [highPrice24h, price];
      const lows = klines.length > 0 ? klines.map((kline) => kline.low) : [lowPrice24h, price];
      const resistance = Math.max(...highs);
      const support = Math.min(...lows);

      let trSum = 0;
      for (let index = 1; index < klines.length; index += 1) {
        const current = klines[index];
        const previous = klines[index - 1];
        trSum += Math.max(
          current.high - current.low,
          Math.abs(current.high - previous.close),
          Math.abs(current.low - previous.close)
        );
      }
      const atr = klines.length > 1 ? trSum / (klines.length - 1) : price * 0.01;

      const recentHighs = klines.slice(-3).map((kline) => kline.high);
      const recentLows = klines.slice(-3).map((kline) => kline.low);
      const recentImpulseHigh = recentHighs.length > 0 ? Math.max(...recentHighs) : price;
      const recentImpulseLow = recentLows.length > 0 ? Math.min(...recentLows) : price;
      const longPullbackPct = recentImpulseHigh > 0 ? ((recentImpulseHigh - price) / recentImpulseHigh) * 100 : 0;
      const shortPullbackPct = recentImpulseLow > 0 ? ((price - recentImpulseLow) / recentImpulseLow) * 100 : 0;

      const breakoutWindow = klines.slice(-7, -1);
      const priorBreakoutHigh = breakoutWindow.length > 0 ? Math.max(...breakoutWindow.map((kline) => kline.high)) : recentImpulseHigh;
      const priorBreakoutLow = breakoutWindow.length > 0 ? Math.min(...breakoutWindow.map((kline) => kline.low)) : recentImpulseLow;

      const longBreakout = price > priorBreakoutHigh;
      const shortBreakout = price < priorBreakoutLow;

      const longEntryPrice = recentImpulseHigh * (1 - 0.005);
      const shortEntryPrice = recentImpulseLow * (1 + 0.005);

      const recentLocalLow = klines.slice(-5).reduce((min, kline) => Math.min(min, kline.low), price);
      const recentLocalHigh = klines.slice(-5).reduce((max, kline) => Math.max(max, kline.high), price);
      const longStopLoss = recentLocalLow > 0 && recentLocalLow < longEntryPrice ? recentLocalLow : longEntryPrice * 0.99;
      const shortStopLoss = recentLocalHigh > shortEntryPrice ? recentLocalHigh : shortEntryPrice * 1.01;
      const longRisk = Math.max(longEntryPrice - longStopLoss, longEntryPrice * 0.01);
      const shortRisk = Math.max(shortStopLoss - shortEntryPrice, shortEntryPrice * 0.01);
      const longTakeProfit = longEntryPrice + (longRisk * 2);
      const shortTakeProfit = shortEntryPrice - (shortRisk * 2);

      const longPullbackReady = longPullbackPct >= 0.3 && longPullbackPct <= 0.8;
      const shortPullbackReady = shortPullbackPct >= 0.3 && shortPullbackPct <= 0.8;

      const crossSpread = referenceTicker
        ? (Math.abs(toNumber(referenceTicker.lastPrice, price) - price) / Math.max(price, 1)) * 100
        : 0;

      const referencePriceChange5m = referenceKlines.length >= 2
        ? ((referenceKlines[1].close - referenceKlines[0].close) / Math.max(referenceKlines[0].close, 1)) * 100
        : 0;
      const referencePriceChange24h = normalizeReferencePriceChange(referenceExchange, referenceTicker);
      const binanceConfirmsLong = priceChange5m >= 1.5 && (referencePriceChange5m >= 0.75 || referencePriceChange24h > price24hPcnt - 1);
      const binanceConfirmsShort = priceChange5m <= -1.5 && (referencePriceChange5m <= -0.75 || referencePriceChange24h < price24hPcnt + 1);
      const bybitLeadsLong = priceChange5m > referencePriceChange5m;
      const bybitLeadsShort = priceChange5m < referencePriceChange5m;

      const fundingNormal = fundingRate > -0.01 && fundingRate < 0.01;
      const fundingPositive = fundingRate > 0 && fundingRate < 0.01;
      const lateMove = Math.abs(priceChange5m) > 5;

      const blockedReasons: string[] = [];
      let rejectReason: string | null = null;
      let candidate = true;
      let preFilterPassed = true;

      if (turnover24h < 100_000_000) {
        candidate = false;
        preFilterPassed = false;
        rejectReason = 'Turnover 24h < 100M';
        blockedReasons.push('Pre-filter failed: volume_24h < 100M');
      }
      if (tradesPerMin < 300) {
        candidate = false;
        preFilterPassed = false;
        rejectReason = rejectReason || 'Trades/min < 300';
        blockedReasons.push('Pre-filter failed: trades_per_min < 300');
      }
      if (spread > 0.5) {
        candidate = false;
        preFilterPassed = false;
        rejectReason = rejectReason || 'Spread > 0.5%';
        blockedReasons.push('Pre-filter failed: spread > 0.5%');
      }
      if (lateMove) {
        candidate = false;
        rejectReason = rejectReason || 'Move already > 5%';
        blockedReasons.push('Skip: 5m move already exceeds 5%');
      }

      const volumeScore = volumeSpike ? 2 : 0;
      const oiScore = oiGrowth >= 5 ? 2 : oiGrowth > 0 ? 1 : 0;
      const whaleScore = whalesActive ? 1 : 0;

      const longMomentumScore = priceChange5m >= 1.5 ? 2 : priceChange5m >= 1 ? 1 : 0;
      const shortMomentumScore = priceChange5m <= -1.5 ? 2 : priceChange5m <= -1 ? 1 : 0;
      const longDeltaScore = deltaPositive ? 2 : orderbookImbalance > 0.12 ? 1 : 0;
      const shortDeltaScore = deltaNegative ? 2 : orderbookImbalance < -0.12 ? 1 : 0;
      const longFundingScore = fundingNormal ? 1 : 0;
      const shortFundingScore = fundingPositive ? 1 : 0;

      const longScore = volumeScore + longMomentumScore + oiScore + longDeltaScore + longFundingScore + whaleScore;
      const shortScore = volumeScore + shortMomentumScore + oiScore + shortDeltaScore + shortFundingScore + whaleScore;

      const direction: Direction = longScore > shortScore
        ? 'LONG'
        : shortScore > longScore
          ? 'SHORT'
          : priceChange5m > 0
            ? 'LONG'
            : priceChange5m < 0
              ? 'SHORT'
              : 'NONE';

      const totalScore = direction === 'SHORT' ? shortScore : longScore;
      const momentumScore = direction === 'SHORT' ? shortMomentumScore : longMomentumScore;
      const deltaScore = direction === 'SHORT' ? shortDeltaScore : longDeltaScore;
      const fundingScore = direction === 'SHORT' ? shortFundingScore : longFundingScore;
      const backtestStats = estimateProTradeStats(klines, direction);

      let aiProbability = 38 + (totalScore * 5);
      if (totalScore >= 8) aiProbability += 8;
      if (direction === 'LONG' && (deltaPositive || orderbookImbalance > 0.2)) aiProbability += 5;
      if (direction === 'SHORT' && (deltaNegative || orderbookImbalance < -0.2)) aiProbability += 5;
      if (direction === 'LONG' && binanceConfirmsLong && bybitLeadsLong) aiProbability += 7;
      if (direction === 'SHORT' && binanceConfirmsShort && bybitLeadsShort) aiProbability += 7;
      if (!candidate) aiProbability -= 18;
      if (klines.length === 0) aiProbability -= 8;
      aiProbability = Math.min(98, Math.max(12, aiProbability));

      const longSetupReady = candidate
        && volumeSpike
        && priceChange5m >= 1.5
        && oiGrowth >= 5
        && (deltaPositive || orderbookImbalance > 0.15)
        && fundingNormal
        && whalesActive;

      const shortSetupReady = candidate
        && volumeSpike
        && priceChange5m <= -1.5
        && oiGrowth >= 5
        && (deltaNegative || orderbookImbalance < -0.15)
        && fundingPositive
        && whalesActive;

      const longElite = longSetupReady && longBreakout && binanceConfirmsLong && bybitLeadsLong;
      const shortElite = shortSetupReady && shortBreakout && binanceConfirmsShort && bybitLeadsShort;
      const entryReady = longElite || shortElite
        ? (direction === 'SHORT' ? shortPullbackReady : longPullbackReady)
        : longSetupReady
          ? longPullbackReady
          : shortSetupReady
            ? shortPullbackReady
            : false;

      const setupReady = longSetupReady || shortSetupReady;
      const strongEntry = totalScore >= 8 && candidate;

      if (klines.length === 0) {
        blockedReasons.push('Limited exchange data: using reduced-confidence fallback metrics');
      }
      if (volumeSpike && oiGrowth <= 0) {
        blockedReasons.push('Skip: volume spike without OI growth');
      }
      if (!(deltaPositive || orderbookImbalance > 0.12) && priceChange5m > 0) {
        blockedReasons.push('Skip: no positive flow behind the move');
      }
      if (!(deltaNegative || orderbookImbalance < -0.12) && priceChange5m < 0) {
        blockedReasons.push('Skip: no negative flow behind the move');
      }
      if (!fundingNormal && direction === 'LONG') {
        blockedReasons.push('Skip: funding is too crowded for a long');
      }
      if (!fundingPositive && direction === 'SHORT') {
        blockedReasons.push('Skip: short setup needs positive funding');
      }
      if (!whalesActive) {
        blockedReasons.push('Wait: whale activity is below threshold');
      }
      if (setupReady && !entryReady) {
        blockedReasons.push('Wait: enter only on a 0.3% to 0.8% pullback after impulse');
      }

      let signalType: ProSignal = 'NEUTRAL';
      if (candidate && aiProbability >= 50) {
        if (longElite || shortElite) signalType = 'ELITE TRADE';
        else if (longSetupReady) signalType = 'SMART MONEY LONG';
        else if (shortSetupReady) signalType = 'SMART MONEY SHORT';
        else if (strongEntry && direction === 'LONG') signalType = 'WATCHLIST LONG';
        else if (strongEntry && direction === 'SHORT') signalType = 'WATCHLIST SHORT';
      }

      setResult({
        candidate,
        rejectReason,
        score: totalScore,
        aiProbability,
        winRate: backtestStats.winRate,
        wins: backtestStats.wins,
        losses: backtestStats.losses,
        sampleSize: backtestStats.sampleSize,
        signal: signalType,
        metrics: {
          turnover: turnover24h,
          tradesPerMin,
          momentum: price24hPcnt,
          priceChange5m,
          openInterestValue,
          oiGrowth,
          fundingRate,
          spread,
          volatility,
          volumeSpike,
          volumeRatio,
          currentVolume5m: currentVolume,
          avgVolume5m: avgVolume,
          buyVolume,
          sellVolume,
          delta,
          deltaPositive,
          deltaNegative,
          fundingNormal,
          fundingPositive,
          largeTradeCount,
          largeTradeThreshold,
          whalesActive,
          crossSpread,
          binanceConfirms: direction === 'SHORT' ? binanceConfirmsShort : binanceConfirmsLong,
          bybitLeads: direction === 'SHORT' ? bybitLeadsShort : bybitLeadsLong,
          orderbookImbalance,
          whaleBuyVol,
          whaleSellVol,
          atr,
          support,
          resistance,
          breakout: direction === 'SHORT' ? shortBreakout : longBreakout,
          pullbackPct: direction === 'SHORT' ? shortPullbackPct : longPullbackPct,
          pullbackReady: direction === 'SHORT' ? shortPullbackReady : longPullbackReady,
          recentImpulseHigh,
          recentImpulseLow,
          entryPrice: direction === 'SHORT' ? shortEntryPrice : longEntryPrice,
          stopLoss: direction === 'SHORT' ? shortStopLoss : longStopLoss,
          takeProfit: direction === 'SHORT' ? shortTakeProfit : longTakeProfit,
          riskReward: 2,
          binancePriceChange5m: referencePriceChange5m
        },
        scoreDetails: {
          volume: volumeScore,
          momentum: momentumScore,
          oi: oiScore,
          funding: fundingScore,
          delta: deltaScore,
          whales: whaleScore
        },
        smartMoney: {
          direction,
          preFilterPassed,
          setupReady,
          strongEntry,
          entryReady,
          blockedReasons
        }
      });
    };

    const start = async () => {
      await fetchRestData();
      calculateResult();
      if (isMounted) setLoading(false);

      intervalId = window.setInterval(async () => {
        await fetchRestData();
        calculateResult();
      }, 5000);
    };

    start().catch((startError: any) => {
      if (isMounted) {
        console.error('Pro Analysis Error:', startError);
        setError(startError.message || 'Failed to perform Pro Analysis');
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [ticker?.symbol, ticker?.exchange]);

  return { result, loading, error };
};
