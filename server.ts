import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("[SERVER] Starting initialization...");

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log(`[SERVER] NODE_ENV: ${process.env.NODE_ENV}`);

  // 1. GLOBAL LOGGING & CORS (Must be first)
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
  app.get("/api/env", (req, res) => {
    res.json({
      NODE_ENV: process.env.NODE_ENV,
      cwd: process.cwd(),
      distExists: fs.existsSync(path.join(process.cwd(), 'dist'))
    });
  });

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

  app.get("/api/tickers", async (req, res) => {
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
    console.log("[SERVER] Starting Vite in development mode...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("[SERVER] Vite middleware attached");

      // In development, serve index.html for all non-API routes
      app.get('*', async (req, res, next) => {
        if (req.url.startsWith('/api')) return next();
        
        const url = req.originalUrl;
        try {
          let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
          console.error("[SERVER] Vite HTML transform error:", e);
          next(e);
        }
      });
    } catch (e) {
      console.error("[SERVER] Failed to start Vite:", e);
    }
  } else {
    console.log("[SERVER] Starting in production mode...");
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.error("[SERVER] Production build (dist/) not found! Falling back to root index.html");
      app.use(express.static(process.cwd()));
      app.get('*', (req, res) => {
        res.sendFile(path.join(process.cwd(), 'index.html'));
      });
    }
  }

  // Only handle 404s if they haven't been handled by Vite or the static handlers
  app.use((req, res, next) => {
    console.log(`[DEBUG] Unhandled request: ${req.method} ${req.url}`);
    if (req.url.startsWith('/api')) {
      return res.status(404).json({ 
        error: "API route not found",
        path: req.url,
        method: req.method
      });
    }
    // For non-API routes in dev mode, if Vite didn't handle it, we might need a fallback
    if (process.env.NODE_ENV !== "production" && req.method === 'GET' && !req.url.includes('.')) {
      console.log(`[DEBUG] Potential SPA route missed by Vite: ${req.url}`);
    }
    next();
  });

  // Final catch-all for anything that reached here
  app.use((req, res) => {
    res.status(404).send(`[Profit Hunter Server] 404 - Not Found: ${req.url}`);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("[SERVER] Fatal error during startup:", err);
  process.exit(1);
});
