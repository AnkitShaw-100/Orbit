const WebSocket = require("ws");

/**
 * Bybit, the fallback when Binance refuses.
 *
 * Chosen over the other public exchanges because its spot symbols are named
 * exactly as Binance names them — BTCUSDT, not BTC-USDT — so a failover does
 * not renumber Orbit's markets, invalidate open positions, or change a single
 * thing the browser sees. The field names differ and the shapes are mapped
 * here; everything above this file is provider-agnostic.
 *
 * Two differences worth knowing: percentages arrive as fractions (-0.0105 for
 * -1.05%), and candles arrive newest-first.
 */
const REST_HOSTS = ["https://api.bybit.com", "https://api.bytick.com"];

const WS_HOSTS = ["wss://stream.bybit.com/v5/public/spot"];

// Bybit answers 200 with a non-zero retCode for application errors, so an HTTP
// check alone would let a failure through as a valid empty response.
async function get(path) {
  const failures = [];

  for (const host of REST_HOSTS) {
    let body;
    try {
      const response = await fetch(`${host}${path}`);
      if (!response.ok) {
        failures.push(`${host} responded ${response.status}`);
        continue;
      }
      body = await response.json();
    } catch (error) {
      failures.push(`${host} unreachable (${error.message})`);
      continue;
    }

    if (body.retCode !== 0) {
      failures.push(`${host} returned retCode ${body.retCode} (${body.retMsg})`);
      continue;
    }

    return body.result;
  }

  throw new Error(failures.join("; "));
}

async function tickers() {
  const result = await get("/v5/market/tickers?category=spot");

  return result.list.map((row) => ({
    symbol: row.symbol,
    price: Number(row.lastPrice),
    // A fraction on the wire, a percentage everywhere in Orbit.
    changePct: Number(row.price24hPcnt) * 100,
    // Turnover is volume in the quote currency, which is what Binance calls
    // quoteVolume and what the market list ranks by.
    quoteVolume: Number(row.turnover24h),
    high: Number(row.highPrice24h),
    low: Number(row.lowPrice24h),
  }));
}

// Orbit speaks Binance's interval names; Bybit counts minutes, with letters
// for the long ones.
const INTERVALS = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
  "1w": "W",
};

async function klines(symbol, interval, limit) {
  const mapped = INTERVALS[interval];
  if (!mapped) throw new Error(`Bybit has no ${interval} candles`);

  const result = await get(
    `/v5/market/kline?category=spot&symbol=${symbol}&interval=${mapped}&limit=${limit}`,
  );

  return result.list
    .map((row) => ({
      time: Math.floor(Number(row[0]) / 1000),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }))
    // Newest first on the wire; the chart wants oldest first.
    .reverse();
}

/**
 * Bybit subscribes over the socket rather than in the URL, and closes a
 * connection it has not heard from — hence the heartbeat, which is cleared on
 * close so a reconnect does not leave a timer behind writing to a dead socket.
 */
function openSocket(symbols, attempt = 0) {
  const host = WS_HOSTS[attempt % WS_HOSTS.length];
  const socket = new WebSocket(host);
  let heartbeat = null;

  const stop = () => {
    clearInterval(heartbeat);
    heartbeat = null;
  };

  socket.on("open", () => {
    // Subscriptions go in batches: Bybit caps how many topics one request may
    // carry, and Orbit lists more markets than that cap allows.
    for (let index = 0; index < symbols.length; index += 10) {
      const args = symbols.slice(index, index + 10).map((symbol) => `tickers.${symbol}`);
      socket.send(JSON.stringify({ op: "subscribe", args }));
    }

    heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ op: "ping" }));
    }, 20000);
    heartbeat.unref?.();
  });

  socket.on("close", stop);

  return { host, socket, stop };
}

function parse(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }

  // Subscription acknowledgements and pongs come down the same socket.
  if (!message?.topic?.startsWith("tickers.")) return null;

  const data = message.data;
  const price = Number(data?.lastPrice);
  if (!data?.symbol || !Number.isFinite(price)) return null;

  return {
    symbol: data.symbol,
    price,
    changePct: Number(data.price24hPcnt) * 100,
    quoteVolume: Number(data.turnover24h),
    high: Number(data.highPrice24h),
    low: Number(data.lowPrice24h),
  };
}

module.exports = { name: "Bybit", tickers, klines, openSocket, parse };
