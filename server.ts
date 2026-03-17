import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";

console.log("[SERVER] Starting initialization...");

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. GLOBAL LOGGING & CORS (Must be first)
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Incoming: ${req.method} ${req.url} from ${req.get('origin') || 'no-origin'}`);
    
    // Manual CORS headers to be 100% sure
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      console.log(`[${new Date().toISOString()}] Handled OPTIONS preflight`);
      return res.status(200).end();
    }
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
            data.result.list.forEach((item: any) => {
              newCache[item.symbol] = item.launchTime;
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
  app.get("/api/version", (req, res) => {
    res.json({ version: process.env.APP_VERSION || '1.0.0-' + Date.now() });
  });

  app.get("/api/ping", (req, res) => {
    console.log("[API] Ping received");
    res.send("pong");
  });

  app.get("/api/health", (req, res) => {
    console.log("[API] Health check");
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.get("/api/market-data", async (req, res) => {
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

  app.get("/api/klines", async (req, res) => {
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

  app.get("/api/advanced-klines", async (req, res) => {
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((req, res) => {
    console.log(`[404] ${req.method} ${req.url}`);
    res.status(404).send(`Page not found: ${req.url}`);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
