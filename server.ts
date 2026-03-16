import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

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
              console.log(`Symbol: ${item.symbol}, LaunchTime: ${item.launchTime}`);
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

  // API routes
  app.get("/api/tickers", async (req, res) => {
    try {
      const [tickersResponse, instruments] = await Promise.all([
        fetch('https://api.bybit.com/v5/market/tickers?category=linear'),
        getInstruments()
      ]);
      
      if (!tickersResponse.ok) {
        throw new Error(`HTTP error! status: ${tickersResponse.status}`);
      }
      const data = await tickersResponse.json();
      
      // Inject launchTime into tickers
      if (data.result && data.result.list) {
        data.result.list = data.result.list.map((ticker: any) => ({
          ...ticker,
          launchTime: instruments[ticker.symbol] || '0'
        }));
      }
      
      res.json(data);
    } catch (error) {
      console.error('Error fetching tickers:', error);
      res.status(500).json({ error: 'Failed to fetch tickers' });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
