import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { API_URL } from '../config';
import { BybitTicker, Exchange } from '../types';

type PricePoint = {
  ts: number;
  price: number;
};

type PriceHistory = Record<string, PricePoint[]>;
type TickerMap = Map<string, BybitTicker>;
type SupportedWsExchange =
  | 'Binance'
  | 'Bybit'
  | 'OKX'
  | 'Bitget'
  | 'Kraken'
  | 'Deribit'
  | 'KuCoin'
  | 'MEXC'
  | 'Gate.io';
type WsSeed = {
  symbol: string;
  exchangeSymbol: string;
};
type WsSeedMap = Record<SupportedWsExchange, WsSeed[]>;

const ALL_EXCHANGES: Exchange[] = [
  'Binance',
  'Kraken',
  'OKX',
  'Bybit',
  'Bitget',
  'Deribit',
  'KuCoin',
  'MEXC',
  'Gate.io'
];

const WS_EXCHANGES: SupportedWsExchange[] = ['Binance', 'Bybit', 'OKX', 'Bitget', 'Kraken', 'Deribit', 'KuCoin', 'MEXC', 'Gate.io'];
const EMPTY_WS_SEEDS: WsSeedMap = {
  Binance: [],
  Bybit: [],
  OKX: [],
  Bitget: [],
  Kraken: [],
  Deribit: [],
  KuCoin: [],
  MEXC: [],
  'Gate.io': []
};

const HISTORY_STORAGE_KEY = 'profit_hunter_price_history_v2';
const HISTORY_RETENTION_MS = 2 * 60 * 60 * 1000;
const SNAPSHOT_INTERVAL_MS = 60 * 1000;
const REST_POLL_MS = 15000;
const UI_FLUSH_MS = 150;
const HISTORY_PERSIST_MS = 30000;

const BINANCE_WS_CHUNK_SIZE = 80;
const BYBIT_WS_CHUNK_SIZE = 160;
const OKX_WS_CHUNK_SIZE = 120;
const BITGET_WS_CHUNK_SIZE = 40;
const KRAKEN_WS_CHUNK_SIZE = 50;
const DERIBIT_WS_CHUNK_SIZE = 80;
const KUCOIN_WS_CHUNK_SIZE = 80;
const MEXC_WS_CHUNK_SIZE = 60;
const GATE_WS_CHUNK_SIZE = 80;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toStringNumber = (value: unknown, fallback = 0) => String(toNumber(value, fallback));
const toOptionalString = (value: unknown) => (value == null ? undefined : String(value));

const getMarketKey = (exchange: Exchange, symbol: string) => `${exchange}:${symbol}`;

const estimatePrev24h = (lastPrice: number, price24hPcnt: number) => {
  const denominator = 1 + price24hPcnt;
  return denominator > 0 ? lastPrice / denominator : lastPrice;
};

const estimatePrev1h = (lastPrice: number, price24hPcnt: number) => {
  const estimated1hChange = price24hPcnt / 24;
  const denominator = 1 + estimated1hChange;
  return denominator > 0 ? lastPrice / denominator : lastPrice;
};

const loadHistory = (): PriceHistory => {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const persistHistory = (history: PriceHistory) => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage quota or private-mode errors. The app can still run in-memory.
  }
};

const chunk = <T,>(items: T[], size: number) => {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
};

const normalizeSymbol = (symbol: string) => String(symbol || '').replace(/[-_]/g, '').toUpperCase();
const normalizeKrakenSymbol = (symbol: string) => String(symbol || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
const normalizeDeribitSymbol = (symbol: string) =>
  String(symbol || '').replace(/[-_]/g, '').toUpperCase().replace('PERPETUAL', 'USDT');
const normalizeKuCoinSymbol = (symbol: string) => String(symbol || '').toUpperCase().replace('USDTM', 'USDT');
const normalizeMexcSymbol = (symbol: string) => String(symbol || '').replace('_', '').toUpperCase();
const normalizeGateSymbol = (symbol: string) => String(symbol || '').replace('_', '').toUpperCase();

const uniqueSeeds = (items: WsSeed[]) => {
  const deduped = new Map<string, WsSeed>();

  items.forEach((item) => {
    deduped.set(`${item.symbol}:${item.exchangeSymbol}`, item);
  });

  return Array.from(deduped.values()).sort((left, right) =>
    `${left.symbol}:${left.exchangeSymbol}`.localeCompare(`${right.symbol}:${right.exchangeSymbol}`)
  );
};

const compareWsSeeds = (left: WsSeed[], right: WsSeed[]) =>
  left.length === right.length &&
  left.every((value, index) =>
    value.symbol === right[index]?.symbol &&
    value.exchangeSymbol === right[index]?.exchangeSymbol
  );

const resolvePrevPrice1h = (
  history: PriceHistory,
  exchange: Exchange,
  symbol: string,
  lastPrice: number,
  price24hPcnt: number,
  now: number
) => {
  const marketKey = getMarketKey(exchange, symbol);
  const points = history[marketKey] || [];
  const targetTs = now - (60 * 60 * 1000);

  let closest: PricePoint | null = null;
  let smallestDiff = Number.POSITIVE_INFINITY;

  points.forEach((point) => {
    const diff = Math.abs(point.ts - targetTs);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closest = point;
    }
  });

  if (closest && smallestDiff <= 10 * 60 * 1000) {
    return closest.price;
  }

  return estimatePrev1h(lastPrice, price24hPcnt);
};

const updateHistory = (history: PriceHistory, tickers: BybitTicker[], now: number) => {
  const nextHistory: PriceHistory = { ...history };

  tickers.forEach((ticker) => {
    const exchange = ticker.exchange || 'Bybit';
    const marketKey = getMarketKey(exchange, ticker.symbol);
    const lastPrice = toNumber(ticker.lastPrice);
    if (lastPrice <= 0) return;

    const existing = (nextHistory[marketKey] || []).filter((point) => now - point.ts <= HISTORY_RETENTION_MS);
    const latest = existing[existing.length - 1];

    if (!latest || now - latest.ts >= SNAPSHOT_INTERVAL_MS) {
      existing.push({ ts: now, price: lastPrice });
    } else {
      existing[existing.length - 1] = { ...latest, price: lastPrice };
    }

    nextHistory[marketKey] = existing;
  });

  return nextHistory;
};

const normalizeTicker = (
  rawTicker: Partial<BybitTicker>,
  exchange: Exchange,
  history: PriceHistory,
  now: number
): BybitTicker => {
  const symbol = normalizeSymbol(String(rawTicker.symbol || ''));
  const lastPrice = toNumber(rawTicker.lastPrice);
  const price24hPcnt = toNumber(rawTicker.price24hPcnt);
  const prevPrice24h = rawTicker.prevPrice24h
    ? toNumber(rawTicker.prevPrice24h)
    : estimatePrev24h(lastPrice, price24hPcnt);
  const prevPrice1h = rawTicker.prevPrice1h
    ? toNumber(rawTicker.prevPrice1h)
    : resolvePrevPrice1h(history, exchange, symbol, lastPrice, price24hPcnt, now);

  return {
    symbol,
    exchange,
    exchangeSymbol: rawTicker.exchangeSymbol || symbol,
    lastPrice: toStringNumber(lastPrice),
    indexPrice: toStringNumber(rawTicker.indexPrice, lastPrice),
    markPrice: toStringNumber(rawTicker.markPrice, lastPrice),
    prevPrice24h: toStringNumber(prevPrice24h, lastPrice),
    price24hPcnt: toStringNumber(price24hPcnt),
    highPrice24h: toStringNumber(rawTicker.highPrice24h, lastPrice),
    lowPrice24h: toStringNumber(rawTicker.lowPrice24h, lastPrice),
    prevPrice1h: toStringNumber(prevPrice1h, lastPrice),
    openInterest: toStringNumber(rawTicker.openInterest),
    openInterestValue: toStringNumber(rawTicker.openInterestValue),
    turnover24h: toStringNumber(rawTicker.turnover24h),
    volume24h: toStringNumber(rawTicker.volume24h),
    fundingRate: toStringNumber(rawTicker.fundingRate),
    nextFundingTime: String(rawTicker.nextFundingTime || '0'),
    launchTime: String(rawTicker.launchTime || '0'),
    ask1Price: toStringNumber(rawTicker.ask1Price, lastPrice),
    bid1Price: toStringNumber(rawTicker.bid1Price, lastPrice),
    ask1Size: toStringNumber(rawTicker.ask1Size),
    bid1Size: toStringNumber(rawTicker.bid1Size)
  };
};

const buildWsSeeds = (exchangeLists: Partial<Record<Exchange, BybitTicker[]>>) => ({
  Binance: uniqueSeeds((exchangeLists.Binance || []).map((ticker) => ({
    symbol: ticker.symbol,
    exchangeSymbol: ticker.exchangeSymbol || ticker.symbol
  }))),
  Bybit: uniqueSeeds((exchangeLists.Bybit || []).map((ticker) => ({
    symbol: ticker.symbol,
    exchangeSymbol: ticker.exchangeSymbol || ticker.symbol
  }))),
  OKX: uniqueSeeds((exchangeLists.OKX || []).map((ticker) => ({
    symbol: ticker.symbol,
    exchangeSymbol: ticker.exchangeSymbol || ticker.symbol
  }))),
  Bitget: uniqueSeeds((exchangeLists.Bitget || []).map((ticker) => ({
    symbol: ticker.symbol,
    exchangeSymbol: ticker.exchangeSymbol || ticker.symbol
  }))),
  Kraken: uniqueSeeds((exchangeLists.Kraken || []).map((ticker) => ({
    symbol: ticker.symbol,
    exchangeSymbol: ticker.exchangeSymbol || ticker.symbol
  }))),
  Deribit: uniqueSeeds((exchangeLists.Deribit || []).map((ticker) => ({
    symbol: ticker.symbol,
    exchangeSymbol: ticker.exchangeSymbol || ticker.symbol
  }))),
  KuCoin: uniqueSeeds((exchangeLists.KuCoin || []).map((ticker) => ({
    symbol: ticker.symbol,
    exchangeSymbol: ticker.exchangeSymbol || ticker.symbol
  }))),
  MEXC: uniqueSeeds((exchangeLists.MEXC || []).map((ticker) => ({
    symbol: ticker.symbol,
    exchangeSymbol: ticker.exchangeSymbol || ticker.symbol
  }))),
  'Gate.io': uniqueSeeds((exchangeLists['Gate.io'] || []).map((ticker) => ({
    symbol: ticker.symbol,
    exchangeSymbol: ticker.exchangeSymbol || ticker.symbol
  })))
});

const wsSeedsEqual = (left: WsSeedMap, right: WsSeedMap) =>
  WS_EXCHANGES.every((exchange) => compareWsSeeds(left[exchange], right[exchange]));

const getWsPatchSymbol = (exchange: Exchange, rawSymbol: string) => {
  switch (exchange) {
    case 'Kraken':
      return normalizeKrakenSymbol(rawSymbol);
    case 'Deribit':
      return normalizeDeribitSymbol(rawSymbol);
    case 'KuCoin':
      return normalizeKuCoinSymbol(rawSymbol);
    case 'MEXC':
      return normalizeMexcSymbol(rawSymbol);
    case 'Gate.io':
      return normalizeGateSymbol(rawSymbol);
    default:
      return normalizeSymbol(rawSymbol);
  }
};

export const useTickers = (selectedExchange: Exchange = 'Bybit') => {
  const [tickers, setTickers] = useState<BybitTicker[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [wsSeeds, setWsSeeds] = useState<WsSeedMap>(EMPTY_WS_SEEDS);

  const historyRef = useRef<PriceHistory>({});
  const tickersMapRef = useRef<TickerMap>(new Map());
  const flushTimeoutRef = useRef<number | null>(null);
  const lastHistoryPersistRef = useRef(0);
  const mountedRef = useRef(true);
  const messageCounterRef = useRef(0);

  const flushTickers = useCallback((now = Date.now()) => {
    if (!mountedRef.current) return;

    const nextTickers = Array.from(tickersMapRef.current.values());
    historyRef.current = updateHistory(historyRef.current, nextTickers, now);

    if (now - lastHistoryPersistRef.current >= HISTORY_PERSIST_MS) {
      persistHistory(historyRef.current);
      lastHistoryPersistRef.current = now;
    }

    setTickers(nextTickers);
    setPriceHistory(historyRef.current);
    setLastUpdated(new Date(now));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current !== null) return;

    flushTimeoutRef.current = window.setTimeout(() => {
      flushTimeoutRef.current = null;
      flushTickers();
    }, UI_FLUSH_MS);
  }, [flushTickers]);

  const mergeNormalizedTickers = useCallback((
    normalized: BybitTicker[],
    options?: { replaceExchange?: Exchange }
  ) => {
    if (options?.replaceExchange) {
      Array.from(tickersMapRef.current.keys()).forEach((marketKey) => {
        if (marketKey.startsWith(`${options.replaceExchange}:`)) {
          tickersMapRef.current.delete(marketKey);
        }
      });
    }

    normalized.forEach((ticker) => {
      const exchange = ticker.exchange || 'Bybit';
      tickersMapRef.current.set(getMarketKey(exchange, ticker.symbol), ticker);
    });

    scheduleFlush();
  }, [scheduleFlush]);

  const mergeRawTickerPatches = useCallback((
    exchange: Exchange,
    patches: Array<Partial<BybitTicker> & { symbol: string }>
  ) => {
    if (patches.length === 0) return;

    const now = Date.now();

    patches.forEach((patch) => {
      const symbol = getWsPatchSymbol(exchange, patch.symbol);
      if (!symbol.endsWith('USDT')) return;

      const marketKey = getMarketKey(exchange, symbol);
      const existing = tickersMapRef.current.get(marketKey);
      const normalized = normalizeTicker(
        {
          ...(existing || {}),
          ...patch,
          symbol,
          exchangeSymbol: patch.exchangeSymbol || existing?.exchangeSymbol || patch.symbol
        },
        exchange,
        historyRef.current,
        now
      );

      tickersMapRef.current.set(marketKey, normalized);
    });

    scheduleFlush();
  }, [scheduleFlush]);

  const fetchTickers = useCallback(async () => {
    try {
      if (Object.keys(historyRef.current).length === 0) {
        historyRef.current = loadHistory();
        setPriceHistory(historyRef.current);
      }

      let baseUrl = API_URL;
      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
      }

      const responses = await Promise.allSettled(
        ALL_EXCHANGES.map(async (exchange) => {
          const targetUrl = `${baseUrl}/api/tickers?exchange=${encodeURIComponent(exchange)}`;
          const res = await fetch(targetUrl);
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.details || `HTTP error! status: ${res.status}`);
          }

          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            throw new Error('Expected JSON but received HTML.');
          }

          const data = await res.json();
          if (!(data.retCode === 0 && data.result?.list)) {
            throw new Error(data.retMsg || `Failed to fetch data from ${exchange}`);
          }

          return { exchange, list: data.result.list as Partial<BybitTicker>[] };
        })
      );

      const now = Date.now();
      const failures: string[] = [];
      const exchangeLists: Partial<Record<Exchange, BybitTicker[]>> = {};
      let totalMarkets = 0;

      responses.forEach((response, index) => {
        const exchange = ALL_EXCHANGES[index];
        if (response.status === 'fulfilled') {
          const normalized = response.value.list
            .filter((ticker) => normalizeSymbol(String(ticker.symbol || '')).endsWith('USDT'))
            .map((ticker) => normalizeTicker(ticker, response.value.exchange, historyRef.current, now));

          exchangeLists[exchange] = normalized;
          totalMarkets += normalized.length;
        } else {
          console.error(`[Tickers] ${exchange} fetch failed:`, response.reason);
          failures.push(exchange);
        }
      });

      if (totalMarkets === 0) {
        throw new Error(`Failed to fetch tickers from all exchanges${failures.length ? `: ${failures.join(', ')}` : ''}`);
      }

      ALL_EXCHANGES.forEach((exchange) => {
        const normalized = exchangeLists[exchange];
        if (normalized) {
          mergeNormalizedTickers(normalized, { replaceExchange: exchange });
        }
      });

      const nextWsSeeds = buildWsSeeds(exchangeLists);
      setWsSeeds((current) => (wsSeedsEqual(current, nextWsSeeds) ? current : nextWsSeeds));

      setError(
        failures.length > 0
          ? `Partial data unavailable: ${failures.join(', ')}`
          : null
      );
    } catch (err: any) {
      console.error('Failed to fetch tickers:', err);
      setError(err.message || 'Connection error. Please check your internet or refresh.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [mergeNormalizedTickers]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (flushTimeoutRef.current !== null) {
        window.clearTimeout(flushTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      await fetchTickers();
      timeoutId = setTimeout(poll, REST_POLL_MS);
    };

    poll();
    return () => clearTimeout(timeoutId);
  }, [fetchTickers]);

  useEffect(() => {
    type SocketCleanup = () => void;
    const cleanups: SocketCleanup[] = [];
    const nextMessageId = () => {
      messageCounterRef.current += 1;
      return messageCounterRef.current;
    };

    const createManagedSocket = ({
      name,
      url,
      heartbeatMs,
      heartbeatPayload,
      onOpen,
      onMessage
    }: {
      name: string;
      url: string;
      heartbeatMs?: number;
      heartbeatPayload?: string | Record<string, unknown> | (() => string | Record<string, unknown>);
      onOpen?: (socket: WebSocket) => void;
      onMessage: (payload: unknown, socket: WebSocket) => void;
    }) => {
      let socket: WebSocket | null = null;
      let pingInterval: number | null = null;
      let reconnectTimeout: number | null = null;
      let disposed = false;

      const clearTimers = () => {
        if (pingInterval !== null) {
          window.clearInterval(pingInterval);
          pingInterval = null;
        }
        if (reconnectTimeout !== null) {
          window.clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
      };

      const scheduleReconnect = () => {
        if (disposed) return;

        reconnectTimeout = window.setTimeout(() => {
          connect();
        }, 3000);
      };

      const startHeartbeat = () => {
        if (!heartbeatMs || !heartbeatPayload) return;

        pingInterval = window.setInterval(() => {
          if (!socket || socket.readyState !== WebSocket.OPEN) return;

          const payloadValue = typeof heartbeatPayload === 'function'
            ? heartbeatPayload()
            : heartbeatPayload;
          const payload = typeof payloadValue === 'string'
            ? payloadValue
            : JSON.stringify(payloadValue);

          socket.send(payload);
        }, heartbeatMs);
      };

      const connect = () => {
        if (disposed) return;

        try {
          socket = new WebSocket(url);
        } catch (connectionError) {
          console.error(`[Tickers][${name}] WebSocket init failed:`, connectionError);
          scheduleReconnect();
          return;
        }

        socket.onopen = () => {
          onOpen?.(socket as WebSocket);
          startHeartbeat();
        };

        socket.onmessage = (event) => {
          try {
            onMessage(JSON.parse(event.data), socket as WebSocket);
          } catch {
            onMessage(event.data, socket as WebSocket);
          }
        };

        socket.onerror = (wsError) => {
          console.error(`[Tickers][${name}] WebSocket error:`, wsError);
        };

        socket.onclose = () => {
          clearTimers();
          if (!disposed) {
            scheduleReconnect();
          }
        };
      };

      connect();

      return () => {
        disposed = true;
        clearTimers();
        socket?.close();
      };
    };

    chunk(wsSeeds.Binance, BINANCE_WS_CHUNK_SIZE).forEach((seeds, index) => {
      if (seeds.length === 0) return;

      const streamPath = seeds.map((seed) => `${seed.exchangeSymbol.toLowerCase()}@ticker`).join('/');
      const url = `wss://fstream.binance.com/stream?streams=${streamPath}`;

      cleanups.push(createManagedSocket({
        name: `Binance-${index + 1}`,
        url,
        onMessage: (payload) => {
          if (!payload || typeof payload !== 'object') return;

          const data = (payload as { data?: any }).data;
          if (!data?.s) return;

          mergeRawTickerPatches('Binance', [{
            symbol: String(data.s),
            exchangeSymbol: String(data.s),
            lastPrice: toOptionalString(data.c),
            prevPrice24h: toOptionalString(data.o),
            price24hPcnt: String(Number(data.P || 0) / 100),
            highPrice24h: toOptionalString(data.h),
            lowPrice24h: toOptionalString(data.l),
            turnover24h: toOptionalString(data.q),
            volume24h: toOptionalString(data.v),
            ask1Price: toOptionalString(data.a),
            bid1Price: toOptionalString(data.b),
            ask1Size: toOptionalString(data.A),
            bid1Size: toOptionalString(data.B)
          }]);
        }
      }));
    });

    chunk(wsSeeds.Bybit, BYBIT_WS_CHUNK_SIZE).forEach((seeds, index) => {
      if (seeds.length === 0) return;

      cleanups.push(createManagedSocket({
        name: `Bybit-${index + 1}`,
        url: 'wss://stream.bybit.com/v5/public/linear',
        heartbeatMs: 20000,
        heartbeatPayload: { op: 'ping' },
        onOpen: (socket) => {
          socket.send(JSON.stringify({
            op: 'subscribe',
            args: seeds.map((seed) => `tickers.${seed.exchangeSymbol}`)
          }));
        },
        onMessage: (payload) => {
          if (!payload || typeof payload !== 'object') return;

          const message = payload as { topic?: string; data?: Record<string, unknown>; op?: string; ret_msg?: string };
          if (message.op === 'pong' || message.ret_msg === 'pong') return;

          const symbol = String(message.data?.symbol || message.topic?.split('.').pop() || '');
          if (!symbol) return;

          mergeRawTickerPatches('Bybit', [{
            symbol,
            exchangeSymbol: symbol,
            lastPrice: toOptionalString(message.data?.lastPrice),
            indexPrice: toOptionalString(message.data?.indexPrice),
            markPrice: toOptionalString(message.data?.markPrice),
            prevPrice24h: toOptionalString(message.data?.prevPrice24h),
            price24hPcnt: toOptionalString(message.data?.price24hPcnt),
            highPrice24h: toOptionalString(message.data?.highPrice24h),
            lowPrice24h: toOptionalString(message.data?.lowPrice24h),
            openInterest: toOptionalString(message.data?.openInterest),
            openInterestValue: toOptionalString(message.data?.openInterestValue),
            turnover24h: toOptionalString(message.data?.turnover24h),
            volume24h: toOptionalString(message.data?.volume24h),
            fundingRate: toOptionalString(message.data?.fundingRate),
            nextFundingTime: toOptionalString(message.data?.nextFundingTime),
            ask1Price: toOptionalString(message.data?.ask1Price),
            bid1Price: toOptionalString(message.data?.bid1Price),
            ask1Size: toOptionalString(message.data?.ask1Size),
            bid1Size: toOptionalString(message.data?.bid1Size)
          }]);
        }
      }));
    });

    chunk(wsSeeds.OKX, OKX_WS_CHUNK_SIZE).forEach((seeds, index) => {
      if (seeds.length === 0) return;

      cleanups.push(createManagedSocket({
        name: `OKX-${index + 1}`,
        url: 'wss://ws.okx.com:8443/ws/v5/public',
        heartbeatMs: 25000,
        heartbeatPayload: 'ping',
        onOpen: (socket) => {
          socket.send(JSON.stringify({
            op: 'subscribe',
            args: seeds.map((seed) => ({
              channel: 'tickers',
              instId: seed.exchangeSymbol
            }))
          }));
        },
        onMessage: (payload) => {
          if (payload === 'pong') return;
          if (!payload || typeof payload !== 'object') return;

          const message = payload as { data?: Array<Record<string, unknown>> };
          const patches = (message.data || []).map((item) => {
            const open24h = toNumber(item.open24h);
            const last = toNumber(item.last);

            return {
              symbol: String(item.instId || ''),
              exchangeSymbol: String(item.instId || ''),
              lastPrice: toOptionalString(item.last),
              prevPrice24h: toOptionalString(item.open24h),
              price24hPcnt: String(open24h > 0 ? (last - open24h) / open24h : 0),
              highPrice24h: toOptionalString(item.high24h),
              lowPrice24h: toOptionalString(item.low24h),
              turnover24h: toOptionalString(item.volCcy24h),
              volume24h: toOptionalString(item.vol24h),
              ask1Price: toOptionalString(item.askPx),
              bid1Price: toOptionalString(item.bidPx),
              ask1Size: toOptionalString(item.askSz),
              bid1Size: toOptionalString(item.bidSz)
            };
          }).filter((item) => item.symbol);

          mergeRawTickerPatches('OKX', patches);
        }
      }));
    });

    chunk(wsSeeds.Bitget, BITGET_WS_CHUNK_SIZE).forEach((seeds, index) => {
      if (seeds.length === 0) return;

      cleanups.push(createManagedSocket({
        name: `Bitget-${index + 1}`,
        url: 'wss://ws.bitget.com/v2/ws/public',
        heartbeatMs: 25000,
        heartbeatPayload: 'ping',
        onOpen: (socket) => {
          socket.send(JSON.stringify({
            op: 'subscribe',
            args: seeds.map((seed) => ({
              instType: 'USDT-FUTURES',
              channel: 'ticker',
              instId: seed.exchangeSymbol
            }))
          }));
        },
        onMessage: (payload) => {
          if (payload === 'pong') return;
          if (!payload || typeof payload !== 'object') return;

          const message = payload as { data?: Array<Record<string, unknown>> };
          const patches = (message.data || []).map((item) => ({
            symbol: String(item.symbol || item.instId || ''),
            exchangeSymbol: String(item.symbol || item.instId || ''),
            lastPrice: toOptionalString(item.lastPr),
            indexPrice: toOptionalString(item.indexPrice),
            markPrice: toOptionalString(item.markPrice),
            prevPrice24h: toOptionalString(item.open24h),
            price24hPcnt: toOptionalString(item.change24h),
            highPrice24h: toOptionalString(item.high24h),
            lowPrice24h: toOptionalString(item.low24h),
            openInterest: toOptionalString(item.holdingAmount),
            turnover24h: toOptionalString(item.quoteVolume),
            volume24h: toOptionalString(item.baseVolume),
            fundingRate: toOptionalString(item.fundingRate),
            nextFundingTime: toOptionalString(item.nextFundingTime),
            ask1Price: toOptionalString(item.askPr),
            bid1Price: toOptionalString(item.bidPr),
            ask1Size: toOptionalString(item.askSz),
            bid1Size: toOptionalString(item.bidSz)
          })).filter((item) => item.symbol);

          mergeRawTickerPatches('Bitget', patches);
        }
      }));
    });

    chunk(wsSeeds.Kraken, KRAKEN_WS_CHUNK_SIZE).forEach((seeds, index) => {
      if (seeds.length === 0) return;

      cleanups.push(createManagedSocket({
        name: `Kraken-${index + 1}`,
        url: 'wss://futures.kraken.com/ws/v1',
        onOpen: (socket) => {
          socket.send(JSON.stringify({
            event: 'subscribe',
            feed: 'ticker',
            product_ids: seeds.map((seed) => seed.exchangeSymbol)
          }));
        },
        onMessage: (payload) => {
          if (!payload || typeof payload !== 'object') return;

          const message = payload as Record<string, unknown>;
          if (message.feed !== 'ticker' || !message.product_id) return;

          const change = toNumber(message.change);
          const open = toNumber(message.open);

          mergeRawTickerPatches('Kraken', [{
            symbol: String(message.product_id),
            exchangeSymbol: String(message.product_id),
            lastPrice: toOptionalString(message.last),
            indexPrice: toOptionalString(message.index),
            markPrice: toOptionalString(message.markPrice),
            prevPrice24h: open > 0 ? String(open) : undefined,
            price24hPcnt: String(change / 100),
            highPrice24h: toOptionalString(message.high),
            lowPrice24h: toOptionalString(message.low),
            openInterest: toOptionalString(message.openInterest),
            openInterestValue: toOptionalString(message.openInterest),
            turnover24h: toOptionalString(message.volumeQuote || message.volume),
            volume24h: toOptionalString(message.volume),
            fundingRate: toOptionalString(message.funding_rate),
            nextFundingTime: toOptionalString(message.next_funding_rate_time),
            ask1Price: toOptionalString(message.ask),
            bid1Price: toOptionalString(message.bid),
            ask1Size: toOptionalString(message.ask_size),
            bid1Size: toOptionalString(message.bid_size)
          }]);
        }
      }));
    });

    chunk(wsSeeds.Deribit, DERIBIT_WS_CHUNK_SIZE).forEach((seeds, index) => {
      if (seeds.length === 0) return;

      cleanups.push(createManagedSocket({
        name: `Deribit-${index + 1}`,
        url: 'wss://www.deribit.com/ws/api/v2',
        onOpen: (socket) => {
          socket.send(JSON.stringify({
            jsonrpc: '2.0',
            id: nextMessageId(),
            method: 'public/set_heartbeat',
            params: { interval: 30 }
          }));

          socket.send(JSON.stringify({
            jsonrpc: '2.0',
            id: nextMessageId(),
            method: 'public/subscribe',
            params: {
              channels: seeds.map((seed) => `ticker.${seed.exchangeSymbol}.100ms`)
            }
          }));
        },
        onMessage: (payload, socket) => {
          if (!payload || typeof payload !== 'object') return;

          const message = payload as {
            method?: string;
            params?: { data?: Record<string, unknown> };
          };

          if (message.method === 'heartbeat') return;

          if (message.method === 'test_request') {
            socket.send(JSON.stringify({
              jsonrpc: '2.0',
              id: nextMessageId(),
              method: 'public/test',
              params: {}
            }));
            return;
          }

          const data = message.params?.data;
          if (message.method !== 'subscription' || !data?.instrument_name) return;

          const stats = (data.stats as Record<string, unknown> | undefined) || {};
          const lastPrice = toNumber(data.last_price);
          const priceChange = toNumber(stats.price_change);

          mergeRawTickerPatches('Deribit', [{
            symbol: String(data.instrument_name),
            exchangeSymbol: String(data.instrument_name),
            lastPrice: toOptionalString(data.last_price),
            indexPrice: toOptionalString(data.index_price),
            markPrice: toOptionalString(data.mark_price),
            prevPrice24h: lastPrice > 0 ? String(estimatePrev24h(lastPrice, priceChange / 100)) : undefined,
            price24hPcnt: String(priceChange / 100),
            highPrice24h: toOptionalString(stats.high),
            lowPrice24h: toOptionalString(stats.low),
            openInterest: toOptionalString(data.open_interest),
            openInterestValue: toOptionalString(data.open_interest),
            turnover24h: toOptionalString(stats.volume_usd),
            volume24h: toOptionalString(stats.volume),
            fundingRate: toOptionalString(data.current_funding || data.funding_8h),
            ask1Price: toOptionalString(data.best_ask_price),
            bid1Price: toOptionalString(data.best_bid_price),
            ask1Size: toOptionalString(data.best_ask_amount),
            bid1Size: toOptionalString(data.best_bid_amount)
          }]);
        }
      }));
    });

    chunk(wsSeeds.KuCoin, KUCOIN_WS_CHUNK_SIZE).forEach((seeds, index) => {
      if (seeds.length === 0) return;

      cleanups.push(createManagedSocket({
        name: `KuCoin-${index + 1}`,
        url: 'wss://x-push-futures.kucoin.com',
        onOpen: (socket) => {
          seeds.forEach((seed) => {
            socket.send(JSON.stringify({
              id: String(nextMessageId()),
              action: 'SUBSCRIBE',
              channel: 'ticker',
              tradeType: 'FUTURES',
              symbol: seed.exchangeSymbol
            }));
          });
        },
        onMessage: (payload) => {
          if (!payload || typeof payload !== 'object') return;

          const message = payload as { T?: string; d?: Record<string, unknown> };
          if (message.T !== 'ticker.FUTURES' || !message.d?.s) return;

          mergeRawTickerPatches('KuCoin', [{
            symbol: String(message.d.s),
            exchangeSymbol: String(message.d.s),
            lastPrice: toOptionalString(message.d.l),
            ask1Price: toOptionalString(message.d.a),
            bid1Price: toOptionalString(message.d.b),
            ask1Size: toOptionalString(message.d.A),
            bid1Size: toOptionalString(message.d.B)
          }]);
        }
      }));
    });

    chunk(wsSeeds.MEXC, MEXC_WS_CHUNK_SIZE).forEach((seeds, index) => {
      if (seeds.length === 0) return;

      cleanups.push(createManagedSocket({
        name: `MEXC-${index + 1}`,
        url: 'wss://contract.mexc.com/edge',
        heartbeatMs: 15000,
        heartbeatPayload: { method: 'ping' },
        onOpen: (socket) => {
          seeds.forEach((seed) => {
            socket.send(JSON.stringify({
              method: 'sub.ticker',
              param: { symbol: seed.exchangeSymbol }
            }));
          });
        },
        onMessage: (payload) => {
          if (!payload || typeof payload !== 'object') return;

          const message = payload as { channel?: string; data?: Record<string, unknown> };
          if (message.channel !== 'push.ticker' || !message.data?.symbol) return;

          mergeRawTickerPatches('MEXC', [{
            symbol: String(message.data.symbol),
            exchangeSymbol: String(message.data.symbol),
            lastPrice: toOptionalString(message.data.lastPrice),
            indexPrice: toOptionalString(message.data.indexPrice),
            markPrice: toOptionalString(message.data.fairPrice),
            price24hPcnt: toOptionalString(message.data.riseFallRate),
            highPrice24h: toOptionalString(message.data.high24Price),
            lowPrice24h: toOptionalString(message.data.lower24Price),
            openInterest: toOptionalString(message.data.holdVol),
            openInterestValue: toOptionalString(message.data.holdVol),
            turnover24h: toOptionalString(message.data.amount24),
            volume24h: toOptionalString(message.data.volume24),
            fundingRate: toOptionalString(message.data.fundingRate),
            ask1Price: toOptionalString(message.data.ask1),
            bid1Price: toOptionalString(message.data.bid1)
          }]);
        }
      }));
    });

    chunk(wsSeeds['Gate.io'], GATE_WS_CHUNK_SIZE).forEach((seeds, index) => {
      if (seeds.length === 0) return;

      cleanups.push(createManagedSocket({
        name: `Gate-${index + 1}`,
        url: 'wss://fx-ws.gateio.ws/v4/ws/usdt',
        onOpen: (socket) => {
          const payload = seeds.map((seed) => seed.exchangeSymbol);

          socket.send(JSON.stringify({
            time: Math.floor(Date.now() / 1000),
            channel: 'futures.tickers',
            event: 'subscribe',
            payload
          }));

          socket.send(JSON.stringify({
            time: Math.floor(Date.now() / 1000),
            channel: 'futures.book_ticker',
            event: 'subscribe',
            payload
          }));
        },
        onMessage: (payload) => {
          if (!payload || typeof payload !== 'object') return;

          const message = payload as { channel?: string; event?: string; result?: unknown };
          if (message.event !== 'update' || !message.result) return;

          if (message.channel === 'futures.tickers' && Array.isArray(message.result)) {
            const patches = message.result.map((item: any) => ({
              symbol: String(item.contract || ''),
              exchangeSymbol: String(item.contract || ''),
              lastPrice: toOptionalString(item.last),
              indexPrice: toOptionalString(item.index_price),
              markPrice: toOptionalString(item.mark_price),
              price24hPcnt: String(toNumber(item.change_percentage) / 100),
              highPrice24h: toOptionalString(item.high_24h),
              lowPrice24h: toOptionalString(item.low_24h),
              openInterest: toOptionalString(item.total_size),
              openInterestValue: toOptionalString(item.total_size),
              turnover24h: toOptionalString(item.volume_24h_quote || item.volume_24h_usd),
              volume24h: toOptionalString(item.volume_24h_base || item.volume_24h),
              fundingRate: toOptionalString(item.funding_rate)
            })).filter((item) => item.symbol);

            mergeRawTickerPatches('Gate.io', patches);
          }

          if (message.channel === 'futures.book_ticker' && !Array.isArray(message.result)) {
            const result = message.result as Record<string, unknown>;
            mergeRawTickerPatches('Gate.io', [{
              symbol: String(result.s || ''),
              exchangeSymbol: String(result.s || ''),
              ask1Price: toOptionalString(result.a),
              bid1Price: toOptionalString(result.b),
              ask1Size: toOptionalString(result.A),
              bid1Size: toOptionalString(result.B)
            }]);
          }
        }
      }));
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [mergeRawTickerPatches, wsSeeds]);

  const selectedExchangeTickers = useMemo(
    () => tickers.filter((ticker) => (ticker.exchange || 'Bybit') === selectedExchange),
    [tickers, selectedExchange]
  );

  return { tickers, selectedExchangeTickers, priceHistory, loading, error, lastUpdated };
};
