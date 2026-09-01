const WebSocket = require("ws");
const env = require("../../config/env");

/**
 * Binance, Orbit's preferred market data source.
 *
 * A 418 means the IP is banned for rate-limit violations — which on a shared
 * cloud egress address means inheriting a ban another tenant earned, and no
 * amount of politeness from Orbit will lift it. The same data is served from
 * several independent front doors, so one refusal is not "no market data":
 * data-api.binance.vision is the read-only market data mirror and the numbered
 * hosts are Binance's own alternates.
 *
 * A host that answers is promoted to the front, so the survivor is tried first
 * next time rather than re-walking the list on every call.
 */
const REST_HOSTS = [
  env.binanceRestUrl,
  "https://api.binance.com",
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
 * GET a path, walking the host list until one answers.
 *
 * Errors name the host and the status rather than just the status: "responded
 * 418" alone cannot tell you whether a configuration change took effect.
 */
async function get(path) {
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
        console.log(`[market] binance via ${host}`);
      }
      return response.json();
    }

    // 418 and 429 are bans, and every further request while banned extends
    // one, so move to the next host rather than retrying this one.
    failures.push(`${host} responded ${response.status}`);
  }

  throw new Error(failures.join("; "));
}

/** Every spot ticker, normalised to Orbit's shape. Filtering happens upstream. */
async function tickers() {
  const rows = await get("/api/v3/ticker/24hr");

  return rows.map((row) => ({
    symbol: row.symbol,
    price: Number(row.lastPrice),
    changePct: Number(row.priceChangePercent),
    quoteVolume: Number(row.quoteVolume),
    high: Number(row.highPrice),
    low: Number(row.lowPrice),
  }));
}

async function klines(symbol, interval, limit) {
  const rows = await get(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);

  return rows.map((row) => ({
    time: Math.floor(row[0] / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}

/**
 * One combined stream for all listed pairs. Subscribing per symbol rather than
 * to !ticker@arr matters: the all-market stream pushes every pair on Binance
 * every second, which is orders of magnitude more bandwidth than a small
 * instance should burn.
 *
 * The host rotates with the attempt count for the same reason the REST client
 * walks a list — a banned IP is banned at the door, not at the endpoint.
 */
function openSocket(symbols, attempt = 0) {
  const host = WS_HOSTS[attempt % WS_HOSTS.length];
  const streams = symbols.map((symbol) => `${symbol.toLowerCase()}@ticker`).join("/");

  return {
    host,
    socket: new WebSocket(`${host}/stream?streams=${streams}`),
    stop() {},
  };
}

function parse(raw) {
  let payload;
  try {
    payload = JSON.parse(raw).data;
  } catch {
    return null;
  }
  if (!payload?.s) return null;

  return {
    symbol: payload.s,
    price: Number(payload.c),
    changePct: Number(payload.P),
    quoteVolume: Number(payload.q),
    high: Number(payload.h),
    low: Number(payload.l),
  };
}

module.exports = { name: "Binance", tickers, klines, openSocket, parse };
