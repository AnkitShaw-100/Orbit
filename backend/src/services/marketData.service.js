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

/**
 * Binance's front doors, tried in order.
 *
 * A 418 means the IP is banned for rate-limit violations — which on a shared
 * cloud egress address means inheriting a ban another tenant earned, and no
 * amount of politeness from Orbit will lift it. The same market data is served
 * from several independent endpoints, so one refusal is not "no market data".
 *
 * data-api.binance.vision is the read-only market data mirror; the numbered
 * hosts are Binance's own alternates. A host that answers is promoted to the
 * front, so the survivor is tried first next time rather than re-walking the
 * list on every call.
 */
const REST_HOSTS = [
  env.binanceRestUrl,
  "https://data-api.binance.vision",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
].filter((host, index, all) => all.indexOf(host) === index);

const WS_HOSTS = [
  env.binanceWsUrl,
  "wss://data-stream.binance.vision",
  "wss://stream.binance.com:9443",
  "wss://stream.binance.com:443",
].filter((host, index, all) => all.indexOf(host) === index);

/**
 * GET a Binance path, walking the host list until one answers.
 *
 * Errors name the host and status rather than just the status: "responded 418"
 * on its own cannot tell you whether a configuration change took effect.
 */
async function binanceGet(path) {
  const failures = [];

  for (const host of [...REST_HOSTS]) {
    let response;
    try {
      response = await fetch(`${host}${path}`);
    } catch (error) {
      failures.push(`${host} unreachable (${error.message})`);
      continue;
    }

    if (response.ok) {
      if (host !== REST_HOSTS[0]) {
        REST_HOSTS.splice(REST_HOSTS.indexOf(host), 1);
        REST_HOSTS.unshift(host);
        console.log(`[market] using ${host}`);
      }
      return response.json();
    }

    // 418 and 429 are bans, and every further request while banned extends
    // one, so move on to the next host instead of retrying this one.
    failures.push(`${host} responded ${response.status}`);
  }

  throw new Error(failures.join("; "));
}

// Binance lists leveraged tokens (BTCUP, ETHDOWN) alongside spot pairs. They
// behave nothing like the asset they name, so they have no place in a product
// whose whole point is teaching how spot trading works.
const LEVERAGED = /(UP|DOWN|BULL|BEAR)USDT$/;

// Stablecoin-against-stablecoin pairs rank high on volume but sit at 1.00 and
// never move, so they'd fill the top of the market list while teaching nothing.
const STABLE_BASES = new Set([
  "USDC", "USD1", "FDUSD", "TUSD", "BUSD", "DAI", "USDP", "EURI",
  "AEUR", "USDE", "PYUSD", "XUSD", "USTC", "SUSD", "RLUSD", "USDG",
  "USDD", "USDS", "USDF", "BFUSD",
]);

// Every listed market has to render with its real logo. The UI resolves logos
// from a bundled icon set first and this CDN second, so a ticker the CDN
// doesn't carry would fall back to a lettered placeholder — fine as a safety
// net, wrong as something a quarter of the market list relies on.
const ICON_URL = (ticker) => `https://assets.coincap.io/assets/icons/${ticker.toLowerCase()}@2x.png`;

// How far past the limit we're willing to look for markets that have artwork.
// Binance's top-by-volume list carries newly listed tokens and tokenised
// equities that no icon set knows about; skipping them costs a few places.
const ICON_SEARCH_DEPTH = 4;

async function hasIcon(symbol) {
  const ticker = symbol.slice(0, -4);
  try {
    const response = await fetch(ICON_URL(ticker), { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Narrow a volume-ranked list to the first `limit` markets that have a logo.
 *
 * Checked in one parallel batch at boot, and ordering is preserved, so this
 * stays a filter on the ranking rather than a re-ranking. If the CDN is
 * unreachable the check fails open — a placeholder logo is a far smaller
 * problem than booting with no markets at all.
 */
async function keepIllustrated(ranked, limit) {
  const candidates = ranked.slice(0, limit * ICON_SEARCH_DEPTH);

  let flags;
  try {
    flags = await Promise.all(candidates.map((row) => hasIcon(row.symbol)));
  } catch {
    return ranked.slice(0, limit);
  }

  const illustrated = candidates.filter((_, index) => flags[index]);
  if (illustrated.length < limit) {
    console.warn(`[market] only ${illustrated.length} of ${limit} markets have logos`);
    return ranked.slice(0, limit);
  }

  const dropped = candidates.slice(0, limit).filter((_, index) => !flags[index]);
  if (dropped.length > 0) {
    console.log(`[market] skipped ${dropped.map((row) => row.symbol).join(", ")} — no logo`);
  }

  return illustrated.slice(0, limit);
}

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
 * volume, drop leveraged tokens and anything with no logo, keep the top N.
 */
async function discoverAndSeed() {
  const rows = await binanceGet("/api/v3/ticker/24hr");
  const byVolume = rows
    // Plain A-Z0-9 tickers only — Binance carries the odd non-Latin listing
    // that has no logo, no name and nothing sensible to render.
    .filter((row) => /^[A-Z0-9]+USDT$/.test(row.symbol) && !LEVERAGED.test(row.symbol))
    .filter((row) => !STABLE_BASES.has(row.symbol.slice(0, -4)))
    .filter((row) => Number(row.quoteVolume) > 0)
    .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume));

  const ranked = await keepIllustrated(byVolume, env.symbolLimit);

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

  // Rotate hosts with each failed attempt for the same reason the REST client
  // walks a list: a banned IP is banned at the door, not at the endpoint.
  const host = WS_HOSTS[attempts % WS_HOSTS.length];
  socket = new WebSocket(`${host}/stream?streams=${streams}`);

  socket.on("open", () => {
    attempts = 0;
    connected = true;
    console.log(`[market] streaming ${symbols.length} symbols from ${host}`);
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
    console.warn(`[market] disconnected from ${host}, retrying in ${delay}ms`);
    reconnectTimer = setTimeout(connect, delay);
  });
}

let discoveryAttempts = 0;

async function start() {
  try {
    await discoverAndSeed();
  } catch (error) {
    // Without the listing there is nothing to subscribe to, so retry rather
    // than starting up with an empty market list.
    //
    // The backoff grows because the usual reason discovery fails is a
    // rate-limit ban, and a request sent while banned extends the ban — a
    // fixed 10s retry is not patience, it is what keeps the ban alive.
    discoveryAttempts += 1;
    const delay = Math.min(300000, 10000 * 2 ** (discoveryAttempts - 1));
    console.warn(`[market] discovery failed, retrying in ${delay / 1000}s: ${error.message}`);
    setTimeout(start, delay).unref?.();
    return;
  }

  discoveryAttempts = 0;
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

  let rows;
  try {
    rows = await binanceGet(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  } catch (error) {
    console.warn("[market] klines failed:", error.message);
    throw new ApiError(502, "Couldn't load candles from Binance. Try again shortly.");
  }

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
