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
  try {
    console.log(`[${new Date().toISOString()}] Fetching tickers from Bybit...`);
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
    
    // Inject launchTime into tickers
    if (data.result && data.result.list) {
      data.result.list = data.result.list.map((ticker: any) => ({
        ...ticker,
        launchTime: instruments[ticker.symbol] || '0'
      }));
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error in /api/market-data:', error);
    res.status(500).json({ error: 'Failed to fetch tickers', details: error instanceof Error ? error.message : String(error) });
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
