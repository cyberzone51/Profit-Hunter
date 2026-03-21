import express from "express";
import cors from "cors";

const app = express();

// 1. GLOBAL LOGGING & CORS
app.use(cors({ origin: true, credentials: true }));
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Incoming: ${req.method} ${req.url} from ${req.get('origin') || 'no-origin'}`);
  next();
});

app.use(express.json());

// Cache for instruments info to get launchTime
let instrumentsCache: Record<string, string> = {};
let lastInstrumentsFetch = 0;

const getInstruments = async () => {
  const now = Date.now();
  // Cache for 1 hour
  if (now - lastInstrumentsFetch > 3600000 || Object.keys(instrumentsCache).length === 0) {
    try {
      const response = await fetch('https://api.bybit.com/v5/market/instruments-info?category=linear');
      if (response.ok) {
        const data = await response.json();
        if (data.result && data.result.list) {
          const newCache: Record<string, string> = {};
          data.result.list.forEach((inst: any) => {
            newCache[inst.symbol] = inst.launchTime;
          });
          instrumentsCache = newCache;
          lastInstrumentsFetch = now;
        }
      }
    } catch (error) {
      console.error('Error fetching instruments:', error);
    }
  }
  return instrumentsCache;
};

// 2. API ROUTES
app.get(["/api/env", "/env"], (req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    cwd: process.cwd()
  });
});

app.get(["/api/version", "/version"], (req, res) => {
  res.json({ version: process.env.APP_VERSION || '1.0.0-' + Date.now() });
});

app.get(["/api/ping", "/ping"], (req, res) => {
  console.log("[API] Ping received");
  res.send("pong");
});

app.get(["/api/health", "/health"], (req, res) => {
  console.log("[API] Health check");
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get(["/api/tickers", "/tickers"], async (req, res) => {
  const { exchange = 'Bybit' } = req.query;
  try {
    console.log(`[${new Date().toISOString()}] Fetching tickers from ${exchange}...`);

    if (exchange === 'Binance') {
      const response = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Binance API error: ${response.status}`);
      const data = await response.json();
      const list = data.filter((t: any) => t.symbol.endsWith('USDT')).map((t: any) => ({
        symbol: t.symbol,
        exchangeSymbol: t.symbol,
        lastPrice: t.lastPrice,
        prevPrice24h: t.openPrice,
        price24hPcnt: (Number(t.priceChangePercent) / 100).toString(),
        highPrice24h: t.highPrice,
        lowPrice24h: t.lowPrice,
        turnover24h: t.quoteVolume,
        volume24h: t.volume,
        fundingRate: '0',
        prevPrice1h: t.lastPrice,
        openInterest: '0',
        openInterestValue: '0',
        nextFundingTime: '0',
        exchange: 'Binance'
      }));
      return res.json({ retCode: 0, result: { list } });
    }

    if (exchange === 'OKX') {
      const response = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`OKX API error: ${response.status}`);
      const data = await response.json();
      const list = data.data.filter((t: any) => t.instId.endsWith('USDT-SWAP')).map((t: any) => ({
        symbol: t.instId.replace('-SWAP', '').replace('-', ''),
        exchangeSymbol: t.instId,
        lastPrice: t.last,
        prevPrice24h: t.open24h,
        price24hPcnt: ((Number(t.last) - Number(t.open24h)) / Number(t.open24h)).toString(),
        highPrice24h: t.high24h,
        lowPrice24h: t.low24h,
        turnover24h: t.volVal24h,
        volume24h: t.vol24h,
        fundingRate: '0',
        prevPrice1h: t.last,
        openInterest: '0',
        openInterestValue: '0',
        nextFundingTime: '0',
        exchange: 'OKX'
      }));
      return res.json({ retCode: 0, result: { list } });
    }

    if (exchange === 'Bitget') {
      const response = await fetch('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Bitget API error: ${response.status}`);
      const data = await response.json();
      const list = (data.data || []).filter((t: any) => String(t.symbol || '').endsWith('USDT')).map((t: any) => ({
        symbol: t.symbol,
        exchangeSymbol: t.symbol,
        lastPrice: t.lastPr,
        prevPrice24h: (Number(t.lastPr) / (1 + Number(t.change24h))).toString(),
        price24hPcnt: t.change24h,
        highPrice24h: t.high24h || t.lastPr,
        lowPrice24h: t.low24h || t.lastPr,
        turnover24h: t.usdtVolume || '0',
        volume24h: t.baseVolume || '0',
        fundingRate: '0',
        prevPrice1h: t.lastPr,
        openInterest: '0',
        openInterestValue: '0',
        nextFundingTime: '0',
        ask1Price: t.askPr,
        bid1Price: t.bidPr,
        ask1Size: t.askSz,
        bid1Size: t.bidSz,
        exchange: 'Bitget'
      }));
      return res.json({ retCode: 0, result: { list } });
    }

    if (exchange === 'Kraken') {
      const response = await fetch('https://futures.kraken.com/derivatives/api/v3/tickers', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Kraken API error: ${response.status}`);
      const data = await response.json();
      const list = (data.tickers || [])
        .filter((t: any) => String(t.symbol || '').includes('USDT') && String(t.tag || '').includes('perpetual'))
        .map((t: any) => ({
          symbol: String(t.symbol).replace(/[^A-Z0-9]/g, ''),
          exchangeSymbol: String(t.symbol),
          lastPrice: t.last,
          prevPrice24h: (Number(t.last) / (1 + Number(t.change24h || 0) / 100)).toString(),
          price24hPcnt: (Number(t.change24h || 0) / 100).toString(),
          highPrice24h: t.high24h || t.last,
          lowPrice24h: t.low24h || t.last,
          turnover24h: t.volumeQuote || '0',
          volume24h: t.volume || '0',
          fundingRate: '0',
          prevPrice1h: t.last,
          openInterest: '0',
          openInterestValue: '0',
          nextFundingTime: '0',
          ask1Price: t.ask,
          bid1Price: t.bid,
          exchange: 'Kraken'
        }));
      return res.json({ retCode: 0, result: { list } });
    }

    if (exchange === 'Deribit') {
      const response = await fetch('https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=USDT&kind=future', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Deribit API error: ${response.status}`);
      const data = await response.json();
      const list = (data.result || [])
        .filter((t: any) => String(t.instrument_name || '').includes('PERPETUAL'))
        .map((t: any) => ({
          symbol: String(t.instrument_name).replace(/[-_]/g, '').replace('PERPETUAL', 'USDT'),
          exchangeSymbol: String(t.instrument_name),
          lastPrice: t.last || t.mark_price,
          prevPrice24h: (Number(t.last || t.mark_price) / (1 + Number(t.price_change || 0) / 100)).toString(),
          price24hPcnt: (Number(t.price_change || 0) / 100).toString(),
          highPrice24h: t.high || t.last || t.mark_price,
          lowPrice24h: t.low || t.last || t.mark_price,
          turnover24h: t.volume_usd || '0',
          volume24h: t.volume || '0',
          fundingRate: '0',
          prevPrice1h: t.last || t.mark_price,
          openInterest: t.open_interest || '0',
          openInterestValue: t.open_interest || '0',
          nextFundingTime: '0',
          ask1Price: t.ask_price,
          bid1Price: t.bid_price,
          exchange: 'Deribit'
        }));
      return res.json({ retCode: 0, result: { list } });
    }

    if (exchange === 'KuCoin') {
      const response = await fetch('https://api-futures.kucoin.com/api/v1/allTickers', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`KuCoin API error: ${response.status}`);
      const data = await response.json();
      const list = data.data.filter((t: any) => t.symbol.endsWith('USDTM')).map((t: any) => ({
        symbol: t.symbol.replace('USDTM', 'USDT'),
        exchangeSymbol: t.symbol,
        lastPrice: t.lastPrice,
        prevPrice24h: (Number(t.lastPrice) / (1 + Number(t.changeRate))).toString(),
        price24hPcnt: t.changeRate.toString(),
        highPrice24h: t.highPrice || t.lastPrice,
        lowPrice24h: t.lowPrice || t.lastPrice,
        turnover24h: t.turnover,
        volume24h: t.volume,
        fundingRate: '0',
        prevPrice1h: t.lastPrice,
        openInterest: '0',
        openInterestValue: '0',
        nextFundingTime: '0',
        exchange: 'KuCoin'
      }));
      return res.json({ retCode: 0, result: { list } });
    }

    if (exchange === 'MEXC') {
      const response = await fetch('https://contract.mexc.com/api/v1/contract/ticker', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`MEXC API error: ${response.status}`);
      const data = await response.json();
      const list = data.data.filter((t: any) => t.symbol.endsWith('_USDT')).map((t: any) => ({
        symbol: t.symbol.replace('_', ''),
        exchangeSymbol: t.symbol,
        lastPrice: t.lastPrice.toString(),
        prevPrice24h: (Number(t.lastPrice) / (1 + Number(t.riseFallRate))).toString(),
        price24hPcnt: t.riseFallRate.toString(),
        highPrice24h: t.highPrice24h.toString(),
        lowPrice24h: t.lowPrice24h.toString(),
        turnover24h: t.amount24.toString(),
        volume24h: t.volume24.toString(),
        fundingRate: '0',
        prevPrice1h: t.lastPrice.toString(),
        openInterest: '0',
        openInterestValue: '0',
        nextFundingTime: '0',
        exchange: 'MEXC'
      }));
      return res.json({ retCode: 0, result: { list } });
    }

    if (exchange === 'Gate.io') {
      const response = await fetch('https://api.gateio.ws/api/v4/futures/usdt/tickers', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Gate.io API error: ${response.status}`);
      const data = await response.json();
      const list = data.map((t: any) => ({
        symbol: t.contract.replace('_', ''),
        exchangeSymbol: t.contract,
        lastPrice: t.last,
        prevPrice24h: (Number(t.last) / (1 + Number(t.change_percentage) / 100)).toString(),
        price24hPcnt: (Number(t.change_percentage) / 100).toString(),
        highPrice24h: t.high_24h,
        lowPrice24h: t.low_24h,
        turnover24h: t.quote_volume,
        volume24h: t.volume_24h,
        fundingRate: t.funding_rate || '0',
        prevPrice1h: t.last,
        openInterest: '0',
        openInterestValue: '0',
        nextFundingTime: '0',
        exchange: 'Gate.io'
      }));
      return res.json({ retCode: 0, result: { list } });
    }

    const [tickersResponse, instruments] = await Promise.all([
      fetch('https://api.bybit.com/v5/market/tickers?category=linear', { signal: AbortSignal.timeout(10000) }).catch(e => {
        console.error('Tickers fetch failed:', e);
        throw e;
      }),
      getInstruments()
    ]);

    if (!tickersResponse.ok) {
      const errorText = await tickersResponse.text();
      console.error(`Bybit API error: ${tickersResponse.status} ${errorText}`);
      throw new Error(`HTTP error! status: ${tickersResponse.status}`);
    }
    const data = await tickersResponse.json();
    console.log(`Successfully fetched ${data.result?.list?.length || 0} tickers`);

    if (data.result && data.result.list) {
      data.result.list = data.result.list.map((ticker: any) => ({
        ...ticker,
        exchangeSymbol: ticker.symbol,
        launchTime: instruments[ticker.symbol] || '0',
        exchange: 'Bybit'
      }));
    }

    res.json(data);
  } catch (error) {
    console.error(`Error in /api/tickers for ${exchange}:`, error);
    res.status(500).json({ error: `Failed to fetch tickers from ${exchange}`, details: error instanceof Error ? error.message : String(error) });
  }
});

app.get(["/api/klines", "/klines"], async (req, res) => {
  const { symbol } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }
  try {
    const response = await fetch(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=15&limit=100`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching klines:', error);
    res.status(500).json({ error: 'Failed to fetch klines' });
  }
});

app.get(["/api/advanced-klines", "/advanced-klines"], async (req, res) => {
  const { symbol } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }
  try {
    const fetchKlines = async (sym: string, interval: string) => {
      const response = await fetch(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${sym}&interval=${interval}&limit=100`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.result.list;
    };

    const [k15m, k1h, k4h, btc1h] = await Promise.all([
      fetchKlines(symbol as string, '15'),
      fetchKlines(symbol as string, '60'),
      fetchKlines(symbol as string, '240'),
      fetchKlines('BTCUSDT', '60')
    ]);

    res.json({ k15m, k1h, k4h, btc1h });
  } catch (error) {
    console.error('Error fetching advanced klines:', error);
    res.status(500).json({ error: 'Failed to fetch advanced klines' });
  }
});

app.get(["/api/pro-analysis-data", "/pro-analysis-data"], async (req, res) => {
  const { symbol, exchange = 'Bybit' } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }
  try {
    const marketExchange = String(exchange);
    const marketSymbol = String(symbol);
    const referenceExchange = marketExchange === 'Binance' ? 'Bybit' : 'Binance';

    const normalizeKlines = (rows: any[], mapper: (row: any) => any) =>
      rows.map(mapper).filter((row: any) => Number.isFinite(row.close) && Number.isFinite(row.volume));

    const fetchKlines = async (targetExchange: string, targetSymbol: string, limit: number) => {
      if (targetExchange === 'Bybit') {
        const response = await fetch(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${targetSymbol}&interval=5&limit=${limit}`);
        if (!response.ok) throw new Error(`Bybit kline error: ${response.status}`);
        const data = await response.json();
        return normalizeKlines((data.result?.list || []).reverse(), (k: any) => ({
          startTime: Number(k[0]),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[5])
        }));
      }
      if (targetExchange === 'Binance') {
        const response = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${targetSymbol}&interval=5m&limit=${limit}`);
        if (!response.ok) throw new Error(`Binance kline error: ${response.status}`);
        const data = await response.json();
        return normalizeKlines(data || [], (k: any) => ({
          startTime: Number(k[0]),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[7] || k[5])
        }));
      }
      if (targetExchange === 'OKX') {
        const instId = `${targetSymbol.replace('USDT', '-USDT')}-SWAP`;
        const response = await fetch(`https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=5m&limit=${limit}`);
        if (!response.ok) throw new Error(`OKX kline error: ${response.status}`);
        const data = await response.json();
        return normalizeKlines((data.data || []).reverse(), (k: any) => ({
          startTime: Number(k[0]),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[6] || k[5])
        }));
      }
      if (targetExchange === 'Bitget') {
        const response = await fetch(`https://api.bitget.com/api/v2/mix/market/candles?symbol=${targetSymbol}&productType=USDT-FUTURES&granularity=5m&limit=${limit}`);
        if (!response.ok) throw new Error(`Bitget kline error: ${response.status}`);
        const data = await response.json();
        return normalizeKlines((data.data || []).reverse(), (k: any) => ({
          startTime: Number(k[0]),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[6] || k[5])
        }));
      }
      if (targetExchange === 'KuCoin') {
        const kucoinSymbol = targetSymbol.replace('USDT', 'USDTM');
        const now = Date.now();
        const from = now - (limit * 5 * 60 * 1000);
        const response = await fetch(`https://api-futures.kucoin.com/api/v1/kline/query?symbol=${kucoinSymbol}&granularity=5&from=${Math.floor(from / 1000)}&to=${Math.floor(now / 1000)}`);
        if (!response.ok) throw new Error(`KuCoin kline error: ${response.status}`);
        const data = await response.json();
        return normalizeKlines(data.data || [], (k: any) => ({
          startTime: Number(k[0]) * 1000,
          open: Number(k[1]),
          high: Number(k[3]),
          low: Number(k[4]),
          close: Number(k[2]),
          volume: Number(k[5])
        })).slice(-limit);
      }
      if (targetExchange === 'MEXC') {
        const mexcSymbol = targetSymbol.replace('USDT', '_USDT');
        const response = await fetch(`https://contract.mexc.com/api/v1/contract/kline/${mexcSymbol}?interval=Min5&limit=${limit}`);
        if (!response.ok) throw new Error(`MEXC kline error: ${response.status}`);
        const data = await response.json();
        return normalizeKlines((data.data || []).map((_: any, index: number) => ({
          ts: data.data.time[index],
          open: data.data.open[index],
          high: data.data.high[index],
          low: data.data.low[index],
          close: data.data.close[index],
          vol: data.data.vol[index]
        })), (k: any) => ({
          startTime: Number(k.ts),
          open: Number(k.open),
          high: Number(k.high),
          low: Number(k.low),
          close: Number(k.close),
          volume: Number(k.vol)
        })).slice(-limit);
      }
      if (targetExchange === 'Gate.io') {
        const gateSymbol = targetSymbol.replace('USDT', '_USDT');
        const response = await fetch(`https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=${gateSymbol}&interval=5m&limit=${limit}`);
        if (!response.ok) throw new Error(`Gate kline error: ${response.status}`);
        const data = await response.json();
        return normalizeKlines((data || []).reverse(), (k: any) => ({
          startTime: Number(k.t) * 1000,
          open: Number(k.o),
          high: Number(k.h),
          low: Number(k.l),
          close: Number(k.c),
          volume: Number(k.sum || k.v)
        }));
      }
      return [];
    };

    const fetchReferenceTicker = async (targetExchange: string, targetSymbol: string) => {
      if (targetExchange === 'Bybit') {
        const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${targetSymbol}`);
        if (!response.ok) throw new Error(`Bybit reference ticker error: ${response.status}`);
        const data = await response.json();
        return data.result?.list?.[0] || null;
      }
      const response = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${targetSymbol}`);
      if (!response.ok) throw new Error(`Binance reference ticker error: ${response.status}`);
      return await response.json();
    };

    const [marketKlinesRes, referenceTickerRes, referenceKlinesRes] = await Promise.allSettled([
      fetchKlines(marketExchange, marketSymbol, 21),
      fetchReferenceTicker(referenceExchange, marketSymbol),
      fetchKlines(referenceExchange, marketSymbol, 2)
    ]);

    const klines = marketKlinesRes.status === 'fulfilled' ? marketKlinesRes.value : [];
    const referenceTicker = referenceTickerRes.status === 'fulfilled' ? referenceTickerRes.value : null;
    const referenceKlines = referenceKlinesRes.status === 'fulfilled' ? referenceKlinesRes.value : [];

    res.json({
      exchange: marketExchange,
      referenceExchange,
      klines,
      referenceTicker,
      referenceKlines
    });
  } catch (error) {
    console.error('Error fetching pro analysis data:', error);
    res.status(500).json({ error: 'Failed to fetch pro analysis data' });
  }
});

// Catch-all 404 handler for API routes
app.use((req, res) => {
  console.log(`[API 404] Unhandled request: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: "API route not found",
    path: req.url,
    method: req.method,
    originalUrl: req.originalUrl
  });
});

export default app;
