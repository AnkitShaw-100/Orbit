const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const binance = require("./providers/binance");
const bybit = require("./providers/bybit");

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
let detach = null;
let reconnectTimer = null;
let attempts = 0;
let connected = false;

/**
 * Where market data comes from, in order of preference.
 *
 * Binance is the source Orbit is built around, but it bans an IP that trips
 * its rate limits — and on shared cloud egress that ban is usually inherited
 * from a neighbour rather than earned, so it can neither be avoided by good
 * behaviour nor waited out reliably. Bybit is the fallback: same symbol
 * naming, so a failover changes nothing above this file.
 *
 * Both are tried on every discovery, so the service returns to Binance by
 * itself once a ban lifts rather than staying on the fallback forever.
 */
const PROVIDERS = [binance, bybit];

let provider = PROVIDERS[0];

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
async function fetchTickers() {
  const failures = [];

  for (const candidate of PROVIDERS) {
    try {
      const rows = await candidate.tickers();
      if (candidate !== provider) {
        console.log(`[market] switching to ${candidate.name}`);
        provider = candidate;
      }
      return rows;
    } catch (error) {
      failures.push(`${candidate.name}: ${error.message}`);
    }
  }

  throw new Error(failures.join(" | "));
}

async function discoverAndSeed() {
  const rows = await fetchTickers();
  const byVolume = rows
    // Plain A-Z0-9 tickers only — Binance carries the odd non-Latin listing
    // that has no logo, no name and nothing sensible to render.
    .filter((row) => /^[A-Z0-9]+USDT$/.test(row.symbol) && !LEVERAGED.test(row.symbol))
    .filter((row) => !STABLE_BASES.has(row.symbol.slice(0, -4)))
    .filter((row) => row.quoteVolume > 0)
    .sort((a, b) => b.quoteVolume - a.quoteVolume);

  const ranked = await keepIllustrated(byVolume, env.symbolLimit);

  symbols = ranked.map((row) => row.symbol);

  ranked.forEach(({ symbol, ...tick }) => record(symbol, tick));

  console.log(
    `[market] listing ${symbols.length} markets from ${provider.name}, led by ${symbols.slice(0, 3).join(", ")}`,
  );
}

function connect() {
  if (symbols.length === 0) {
    console.warn("[market] no symbols discovered, not connecting");
    return;
  }

  // The provider owns the transport — Binance carries its subscriptions in the
  // URL, Bybit sends them over the socket and needs a heartbeat — so all this
  // level knows is that ticks arrive and have to be recorded.
  const stream = provider.openSocket(symbols, attempts);
  const { host } = stream;
  socket = stream.socket;
  detach = stream.stop;

  socket.on("open", () => {
    attempts = 0;
    connected = true;
    console.log(`[market] streaming ${symbols.length} symbols from ${provider.name} (${host})`);
  });

  socket.on("message", (raw) => {
    const tick = provider.parse(raw);
    if (!tick) return;

    const { symbol, ...values } = tick;
    record(symbol, values);
  });

  socket.on("error", (error) => console.error("[market] socket error", error.message));

  socket.on("close", () => {
    connected = false;
    stream.stop();
    attempts += 1;

    // Every few failures, go back through discovery rather than reconnecting
    // again: a socket that will not open is usually the same ban the REST
    // client would see, and discovery is what can switch providers.
    if (attempts % 4 === 0) {
      console.warn(`[market] ${provider.name} socket keeps failing, re-running discovery`);
      reconnectTimer = setTimeout(start, 5000);
      return;
    }

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
  detach?.();
  detach = null;
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

  // Ordered so the provider currently serving prices is asked first: candles
  // from one exchange under a price feed from another would disagree at the
  // right-hand edge of the chart.
  const ordered = [provider, ...PROVIDERS.filter((candidate) => candidate !== provider)];
  const failures = [];

  for (const candidate of ordered) {
    try {
      return await candidate.klines(symbol, interval, limit);
    } catch (error) {
      failures.push(`${candidate.name}: ${error.message}`);
    }
  }

  console.warn("[market] klines failed —", failures.join(" | "));
  throw new ApiError(502, "Couldn't load candles right now. Try again shortly.");
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
