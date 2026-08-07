import { useEffect, useRef, useState } from "react";
import { WS_URL } from "@/lib/api";

/**
 * Live prices from Orbit's own WebSocket rather than Binance directly.
 *
 * The server holds one upstream connection and fans it out, so the browser
 * never talks to Binance — which keeps Orbit inside Binance's rate limits and
 * means visitors in regions Binance blocks still see live prices.
 *
 * Returns the same shape the old Binance hook did:
 *   { data: { SYMBOL: { price, changePct, quoteVolume, direction } }, status }
 */
export function useOrbitPrices() {
  const [data, setData] = useState({});
  const [status, setStatus] = useState("connecting");
  const previous = useRef({});

  useEffect(() => {
    let socket;
    let reconnectTimer;
    let attempt = 0;
    let cancelled = false;

    const apply = (symbol, tick) => {
      const last = previous.current[symbol];
      const direction =
        last == null || tick.price === last ? null : tick.price > last ? "up" : "down";
      previous.current[symbol] = tick.price;
      setData((current) => ({ ...current, [symbol]: { ...tick, direction } }));
    };

    const connect = () => {
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        attempt = 0;
        setStatus("live");
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === "snapshot") {
          // The server sends its whole cache on connect, so the first paint
          // shows real prices instead of a skeleton.
          Object.entries(message.markets).forEach(([symbol, tick]) => apply(symbol, tick));
          return;
        }
        if (message.type === "tick") {
          const { symbol, price, changePct, quoteVolume, high, low, at } = message;
          apply(symbol, { price, changePct, quoteVolume, high, low, at });
        }
      };

      socket.onerror = () => setStatus("offline");

      socket.onclose = () => {
        if (cancelled) return;
        setStatus("offline");
        attempt += 1;
        reconnectTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempt));
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  return { data, status };
}
