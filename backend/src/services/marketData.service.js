const WebSocket = require("ws");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

/**
 * Owns Orbit's single upstream connection to Binance (TDD section 6).
 *
 * One socket serves every connected user. Prices are held in memory only —
 * the Database Design Document is explicit that market prices are never
 * persisted; portfolio value is derived from this cache at read time.
 *
 * Order fills read from here rather than trusting a price sent by the browser,
 * which is what stops a client from choosing its own execution price.
 */

const prices = new Map(); // symbol -> { price, changePct, quoteVolume, high, low, at }
const listeners = new Set();

let symbols = [];
let socket = null;
let reconnectTimer = null;
let attempts = 0;
let connected = false;

// Binance lists leveraged tokens (BTCUP, ETHDOWN) alongside spot pairs. They
// behave nothing like the asset they name, so they have no place in a product
// whose whole point is teaching how spot trading works.
const LEVERAGED = /(UP|DOWN|BULL|BEAR)USDT$/;

// Stablecoin-against-stablecoin pairs rank high on volume but sit at 1.00 and
// never move, so they'd fill the top of the market list while teaching nothing.
const STABLE_BASES = new Set([
  "USDC", "USD1", "FDUSD", "TUSD", "BUSD", "DAI", "USDP", "EURI",
  "AEUR", "USDE", "PYUSD", "XUSD", "USTC", "SUSD",
]);

function snapshot() {
  return Object.fromEntries(prices);
}

function emit(symbol) {
  const tick = { symbol, ...prices.get(symbol) };
  for (const listener of listeners) {
    try {
      listener(tick);
    } catch (error) {
      console.error("[market] listener failed", error);
    }
  }
}

function record(symbol, data) {
  prices.set(symbol, { ...data, at: Date.now() });
  emit(symbol);
}

/**
 * Pick the markets Orbit lists and seed the cache in one request.
 *
 * The full 24h ticker gives both the ranking and the opening snapshot, so
 * discovery costs nothing extra: sort every USDT spot pair by real traded
 * volume, drop leveraged tokens, keep the top N.
 */
async function discoverAndSeed() {
  const response = await fetch(`${env.binanceRestUrl}/api/v3/ticker/24hr`);
  if (!response.ok) throw new Error(`Binance REST responded ${response.status}`);

  const rows = await response.json();
  const ranked = rows
    // Plain A-Z0-9 tickers only — Binance carries the odd non-Latin listing
    // that has no logo, no name and nothing sensible to render.
    .filter((row) => /^[A-Z0-9]+USDT$/.test(row.symbol) && !LEVERAGED.test(row.symbol))
    .filter((row) => !STABLE_BASES.has(row.symbol.slice(0, -4)))
    .filter((row) => Number(row.quoteVolume) > 0)
    .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
    .slice(0, env.symbolLimit);

  symbols = ranked.map((row) => row.symbol);

  ranked.forEach((row) =>
    record(row.symbol, {
      price: Number(row.lastPrice),
      changePct: Number(row.priceChangePercent),
      quoteVolume: Number(row.quoteVolume),
      high: Number(row.highPrice),
      low: Number(row.lowPrice),
    }),
  );

  console.log(`[market] listing ${symbols.length} markets, led by ${symbols.slice(0, 3).join(", ")}`);
}

function connect() {
  if (symbols.length === 0) {
    console.warn("[market] no symbols discovered, not connecting");
    return;
  }

  // One combined stream for all listed pairs. Subscribing per symbol rather
  // than to !ticker@arr matters: the all-market stream pushes every pair on
  // Binance every second, which is orders of magnitude more bandwidth than a
  // small instance should burn.
  const streams = symbols.map((symbol) => `${symbol.toLowerCase()}@ticker`).join("/");
  socket = new WebSocket(`${env.binanceWsUrl}/stream?streams=${streams}`);

  socket.on("open", () => {
    attempts = 0;
    connected = true;
    console.log(`[market] streaming ${symbols.length} symbols from Binance`);
  });

  socket.on("message", (raw) => {
    let payload;
    try {
      payload = JSON.parse(raw).data;
    } catch {
      return;
    }
    if (!payload?.s) return;

    record(payload.s, {
      price: Number(payload.c),
      changePct: Number(payload.P),
      quoteVolume: Number(payload.q),
      high: Number(payload.h),
      low: Number(payload.l),
    });
  });

  socket.on("error", (error) => console.error("[market] socket error", error.message));

  socket.on("close", () => {
    connected = false;
    // Binance blocks some regions outright, so back off rather than hammering
    // a connection that is never going to open.
    attempts += 1;
    const delay = Math.min(30000, 1000 * 2 ** attempts);
    console.warn(`[market] disconnected, retrying in ${delay}ms`);
    reconnectTimer = setTimeout(connect, delay);
  });
}

async function start() {
  try {
    await discoverAndSeed();
  } catch (error) {
    // Without the listing there is nothing to subscribe to, so retry rather
    // than starting up with an empty market list.
    console.warn("[market] discovery failed, retrying in 10s:", error.message);
    setTimeout(start, 10000).unref?.();
    return;
  }
  connect();
}

function stop() {
  clearTimeout(reconnectTimer);
  if (socket) {
    socket.removeAllListeners("close");
    socket.close();
    socket = null;
  }
}

/** Subscribe to every tick. Returns an unsubscribe function. */
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isSupported(symbol) {
  return symbols.includes(symbol);
}

function getSymbols() {
  return symbols;
}

/**
 * The price an order fills at. Throws rather than guessing — filling a trade
 * against a stale or missing price is worse than refusing it.
 */
function getExecutionPrice(symbol) {
  if (!isSupported(symbol)) throw ApiError.badRequest(`Orbit doesn't list ${symbol}`);

  const tick = prices.get(symbol);
  if (!tick?.price) {
    throw new ApiError(503, "Market data is reconnecting. Try again in a moment.");
  }

  const age = Date.now() - tick.at;
  if (age > 60000) {
    throw new ApiError(503, "The last price is too old to trade against. Try again shortly.");
  }

  return tick.price;
}

async function fetchKlines(symbol, interval = "1h", limit = 120) {
  if (!isSupported(symbol)) throw ApiError.badRequest(`Orbit doesn't list ${symbol}`);

  const url = `${env.binanceRestUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError(502, "Couldn't load candles from Binance. Try again shortly.");
  }

  const rows = await response.json();
  return rows.map((row) => ({
    time: Math.floor(row[0] / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}

module.exports = {
  start,
  stop,
  subscribe,
  snapshot,
  getSymbols,
  isSupported,
  getExecutionPrice,
  fetchKlines,
  get isConnected() {
    return connected;
  },
};
