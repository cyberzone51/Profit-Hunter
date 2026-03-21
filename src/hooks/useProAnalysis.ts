import { useState, useEffect, useRef } from 'react';
import { BybitTicker, Kline } from '../types';
import { API_URL } from '../config';
import { rlOptimizer } from '../utils/rl';

export interface ProAnalysisResult {
  candidate: boolean;
  rejectReason: string | null;
  score: number;
  aiProbability: number;
  winRate: number;
  signal: 'ELITE TRADE' | 'HIGH PROBABILITY LONG' | 'HIGH PROBABILITY SHORT' | 'REVERSAL LONG' | 'REVERSAL SHORT' | 'NEUTRAL';
  metrics: {
    turnover: number;
    tradesPerMin: number;
    momentum: number;
    openInterestValue: number;
    oiGrowth: number;
    fundingRate: number;
    spread: number;
    volatility: number;
    volumeSpike: boolean;
    buyVolume: number;
    sellVolume: number;
    delta: number;
    liquidations: number;
    arbitrageSignal: boolean;
    crossSpread: number;
    leaderSignal: boolean;
    orderbookImbalance: number;
    whaleBuyVol: number;
    whaleSellVol: number;
    atr: number;
    support: number;
    resistance: number;
  };
  scoreDetails: {
    oi: number;
    funding: number;
    delta: number;
    liquidations: number;
    orderflow: number;
    arbitrage: number;
  };
}

export const useProAnalysis = (ticker: BybitTicker | null) => {
  const [result, setResult] = useState<ProAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const tradesCountRef = useRef(0);
  const buyVolRef = useRef(0);
  const sellVolRef = useRef(0);
  const liqVolRef = useRef(0);
  const whaleBuyRef = useRef(0);
  const whaleSellRef = useRef(0);
  const bidVolRef = useRef(0);
  const askVolRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const tickerRef = useRef(ticker);

  useEffect(() => {
    tickerRef.current = ticker;
  }, [ticker]);

  useEffect(() => {
    if (!tickerRef.current) {
      setResult(null);
      return;
    }

    const currentSymbol = tickerRef.current.symbol;

    let isMounted = true;
    setLoading(true);
    setError(null);
    tradesCountRef.current = 0;
    buyVolRef.current = 0;
    sellVolRef.current = 0;
    liqVolRef.current = 0;
    whaleBuyRef.current = 0;
    whaleSellRef.current = 0;
    bidVolRef.current = 0;
    askVolRef.current = 0;

    // 1. WebSocket for trades, liquidations, and orderbook
    const wsUrl = 'wss://stream.bybit.com/v5/public/linear';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        op: 'subscribe',
        args: [
          `publicTrade.${currentSymbol}`, 
          `liquidation.${currentSymbol}`,
          `orderbook.50.${currentSymbol}`
        ]
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.topic === `publicTrade.${currentSymbol}` && data.data) {
        tradesCountRef.current += data.data.length;
        data.data.forEach((t: any) => {
          const vol = Number(t.v) * Number(t.p);
          if (t.S === 'Buy') {
            buyVolRef.current += vol;
            if (vol > 50000) whaleBuyRef.current += vol;
          }
          if (t.S === 'Sell') {
            sellVolRef.current += vol;
            if (vol > 50000) whaleSellRef.current += vol;
          }
        });
      }
      if (data.topic === `liquidation.${currentSymbol}` && data.data) {
        const liqData = Array.isArray(data.data) ? data.data : [data.data];
        liqData.forEach((l: any) => {
          liqVolRef.current += Number(l.v) * Number(l.p);
        });
      }
      if (data.topic === `orderbook.50.${currentSymbol}` && data.data) {
        let bVol = 0;
        let aVol = 0;
        if (data.data.b) data.data.b.forEach((b: any) => bVol += Number(b[1]));
        if (data.data.a) data.data.a.forEach((a: any) => aVol += Number(a[1]));
        if (bVol > 0) bidVolRef.current = bVol;
        if (aVol > 0) askVolRef.current = aVol;
      }
    };

    // 2. Fetch REST Data (Klines, OI, Binance for Arbitrage)
    let klines: any[] = [];
    let oiGrowth = 0;
    let binanceData: any = null;
    let restDataInterval: number | null = null;

    const fetchRestData = async () => {
      try {
        let baseUrl = API_URL;
        if (baseUrl.endsWith('/')) {
          baseUrl = baseUrl.slice(0, -1);
        }
        const targetUrl = `${baseUrl}/api/pro-analysis-data?symbol=${currentSymbol}`;
        
        const res = await fetch(targetUrl);
        if (res.ok) {
          const data = await res.json();
          
          if (data.klines?.result?.list) {
            klines = data.klines.result.list.reverse().map((k: any) => ({
              volume: Number(k[5]),
              close: Number(k[4]),
              open: Number(k[1]),
              high: Number(k[2]),
              low: Number(k[3])
            }));
          }

          if (data.oiData?.result?.list?.length >= 2) {
            const currentOI = Number(data.oiData.result.list[0].openInterest);
            const prevOI = Number(data.oiData.result.list[1].openInterest);
            oiGrowth = prevOI > 0 ? ((currentOI - prevOI) / prevOI) * 100 : 0;
          }

          if (data.binanceData) {
            binanceData = data.binanceData;
          }
        }
      } catch (error) {
        console.error("Error fetching REST data:", error);
      }
    };

    const startAnalysis = async () => {
      try {
        await fetchRestData();
        
        // Fetch REST data every 5 seconds
        restDataInterval = window.setInterval(fetchRestData, 5000);

        const startTime = Date.now();

        const calculateResult = () => {
          if (!isMounted) return;
          
          const currentTicker = tickerRef.current;
          if (!currentTicker) return;

          const elapsedSeconds = Math.max(1, (Date.now() - startTime) / 1000);

          // Base metrics
          const turnover24h = Number(currentTicker.turnover24h);
          const price24hPcnt = Number(currentTicker.price24hPcnt) * 100;
          const openInterestValue = Number(currentTicker.openInterestValue);
          const fundingRate = Number(currentTicker.fundingRate);
          const ask1Price = Number(currentTicker.ask1Price || currentTicker.lastPrice);
          const bid1Price = Number(currentTicker.bid1Price || currentTicker.lastPrice);
          const price = Number(currentTicker.lastPrice);
          const spread = price > 0 ? ((ask1Price - bid1Price) / price) * 100 : 0; // in %
          const highPrice24h = Number(currentTicker.highPrice24h);
          const lowPrice24h = Number(currentTicker.lowPrice24h);
          const volatility = lowPrice24h > 0 ? (highPrice24h - lowPrice24h) / lowPrice24h : 0;

          // WS Metrics (scaled to per minute where applicable)
          const tradesPerMin = Math.round((tradesCountRef.current / elapsedSeconds) * 60);
          const buyVolume = buyVolRef.current;
          const sellVolume = sellVolRef.current;
          const delta = buyVolume - sellVolume;
          let liquidations = liqVolRef.current;
          const whaleBuyVol = whaleBuyRef.current;
          const whaleSellVol = whaleSellRef.current;
          const bidVol = bidVolRef.current;
          const askVol = askVolRef.current;
          const orderbookImbalance = (bidVol + askVol) > 0 ? (bidVol - askVol) / (bidVol + askVol) : 0;

          // Kline Metrics (Volume Spike, ATR, S/R)
          const currentVolume = klines[klines.length - 1]?.volume || 0;
          const avgVolume = klines.slice(0, -1).reduce((sum: number, k: any) => sum + k.volume, 0) / 20;
          const volumeSpike = currentVolume >= 2 * avgVolume;
          
          const highs = klines.map((k: any) => k.high);
          const lows = klines.map((k: any) => k.low);
          const resistance = Math.max(...highs);
          const support = Math.min(...lows);
          
          let trSum = 0;
          for(let i=1; i<klines.length; i++) {
             const h = klines[i].high;
             const l = klines[i].low;
             const pc = klines[i-1].close;
             trSum += Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc));
          }
          const atr = trSum / (klines.length - 1 || 1);

          // Infer liquidations from wicks if no live data
          if (liquidations === 0 && klines.length > 0) {
            const lastKline = klines[klines.length - 1];
            const wickSize = Math.max(lastKline.high - Math.max(lastKline.open, lastKline.close), Math.min(lastKline.open, lastKline.close) - lastKline.low);
            const bodySize = Math.abs(lastKline.open - lastKline.close);
            if (wickSize > bodySize * 2 && wickSize > price * 0.005) {
              liquidations = turnover24h * 0.001;
            }
          }

          // Cross-Exchange (Arbitrage & Divergence)
          let arbitrageSignal = false;
          let leaderSignal = false;
          let crossSpread = 0;
          if (binanceData) {
             const binancePrice = Number(binanceData.lastPrice);
             crossSpread = Math.abs(binancePrice - price) / price * 100;
             if (crossSpread >= 0.5) arbitrageSignal = true;
             
             const binanceChange = Number(binanceData.priceChangePercent);
             if (binanceChange > price24hPcnt + 1.5) leaderSignal = true; // Binance pumping, Bybit lagging
             if (binanceChange < price24hPcnt - 1.5) leaderSignal = true; // Binance dumping, Bybit lagging
          }

          // --- REJECT FILTERS ---
          let rejectReason = null;
          let candidate = true;
          if (turnover24h < 50_000_000) { candidate = false; rejectReason = 'Turnover < 50M'; }
          else if (tradesPerMin < 150) { candidate = false; rejectReason = 'Trades/min < 150'; }
          else if (spread > 0.5) { candidate = false; rejectReason = 'Spread > 0.5%'; }

          // --- SCORE MODEL ---
          let oiScore = 0;
          if (oiGrowth >= 5) oiScore = 3;
          else if (oiGrowth >= 2) oiScore = 2;
          else if (oiGrowth > 0) oiScore = 1;

          let fundingScore = 0;
          const absFunding = Math.abs(fundingRate);
          if (absFunding < 0.005) fundingScore = 2;
          else if (absFunding < 0.01) fundingScore = 1;

          let deltaScore = 0;
          const totalVol = buyVolume + sellVolume;
          if (totalVol > 0) {
            if (Math.abs(delta) > totalVol * 0.2) deltaScore = 2;
            else if (Math.abs(delta) > totalVol * 0.05) deltaScore = 1;
          }

          let liqScore = 0;
          if (liquidations > 100000) liqScore = 2;
          else if (liquidations > 10000) liqScore = 1;

          let orderflowScore = 0;
          if (tradesPerMin >= 1000) orderflowScore = 2;
          else if (tradesPerMin >= 500) orderflowScore = 1;
          if (Math.abs(orderbookImbalance) > 0.3) orderflowScore += 1;

          let arbScore = arbitrageSignal ? 2 : 0;

          const totalScore = oiScore + fundingScore + deltaScore + liqScore + orderflowScore + arbScore;

          // AI Probability
          let aiProbability = 50 + (totalScore * 3);
          if (arbitrageSignal && oiGrowth > 0 && volumeSpike && leaderSignal) aiProbability += 15;
          if (whaleBuyVol > whaleSellVol * 2) aiProbability += 5;
          if (!candidate) aiProbability -= 20;
          aiProbability = Math.min(98, Math.max(12, aiProbability));

          // --- SIGNALS ---
          let signalType: 'ELITE TRADE' | 'HIGH PROBABILITY LONG' | 'HIGH PROBABILITY SHORT' | 'REVERSAL LONG' | 'REVERSAL SHORT' | 'NEUTRAL' = 'NEUTRAL';
          
          if (candidate && aiProbability >= 50) {
            // Level 10 (Elite)
            if (arbitrageSignal && oiGrowth > 0 && volumeSpike && leaderSignal) {
              signalType = 'ELITE TRADE';
            }
            // Level 4 (Reversals)
            else if (absFunding > 0.01 && liqScore >= 1) {
              signalType = fundingRate > 0 ? 'REVERSAL SHORT' : 'REVERSAL LONG';
            } 
            // Level 3 (Institutional Signal)
            else if (volumeSpike && oiGrowth > 0 && delta > 0 && absFunding < 0.01) {
              signalType = 'HIGH PROBABILITY LONG';
            } 
            else if (volumeSpike && oiGrowth > 0 && delta < 0 && absFunding < 0.01) {
              signalType = 'HIGH PROBABILITY SHORT';
            } 
            // Score-based
            else if (totalScore >= 7) {
              signalType = delta > 0 ? 'HIGH PROBABILITY LONG' : 'HIGH PROBABILITY SHORT';
            }
          }

          setResult({
            candidate,
            rejectReason,
            score: totalScore,
            aiProbability,
            winRate: rlOptimizer.getWinRate(currentSymbol),
            signal: signalType,
            metrics: {
              turnover: turnover24h,
              tradesPerMin,
              momentum: price24hPcnt,
              openInterestValue,
              oiGrowth,
              fundingRate,
              spread,
              volatility,
              volumeSpike,
              buyVolume,
              sellVolume,
              delta,
              liquidations,
              arbitrageSignal,
              crossSpread,
              leaderSignal,
              orderbookImbalance,
              whaleBuyVol,
              whaleSellVol,
              atr,
              support,
              resistance
            },
            scoreDetails: {
              oi: oiScore,
              funding: fundingScore,
              delta: deltaScore,
              liquidations: liqScore,
              orderflow: orderflowScore,
              arbitrage: arbScore
            }
          });
        };

        // Wait 2 seconds to collect initial WS data before showing
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!isMounted) return;
        
        calculateResult();
        setLoading(false);

        // Update result every second
        const interval = setInterval(calculateResult, 1000);
        
        // Return cleanup for interval
        return () => {
          clearInterval(interval);
          if (restDataInterval) clearInterval(restDataInterval);
        };

      } catch (err: any) {
        if (isMounted) {
          console.error('Pro Analysis Error:', err);
          setError(err.message || 'Failed to perform Pro Analysis');
          setLoading(false);
        }
      }
    };

    let cleanupInterval: (() => void) | undefined;
    startAnalysis().then(cleanup => {
      cleanupInterval = cleanup;
    });

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (cleanupInterval) {
        cleanupInterval();
      }
    };
  }, [ticker?.symbol]);

  return { result, loading, error };
};
