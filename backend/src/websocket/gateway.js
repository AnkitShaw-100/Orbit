const { WebSocketServer } = require("ws");
const market = require("../services/marketData.service");

/**
 * Fans the single upstream Binance feed out to every connected browser.
 *
 * Clients never connect to Binance themselves: one server connection serves
 * everyone, which keeps Orbit inside Binance's rate limits and means users in
 * regions Binance blocks still see live prices.
 */
function attachGateway(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  const send = (socket, payload) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(payload));
  };

  wss.on("connection", (socket) => {
    // Open with the full cache so a new tab paints real prices immediately
    // rather than waiting for the next tick on each symbol.
    send(socket, { type: "snapshot", markets: market.snapshot() });

    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
  });

  const unsubscribe = market.subscribe((tick) => {
    const message = JSON.stringify({ type: "tick", ...tick });
    for (const socket of wss.clients) {
      if (socket.readyState === socket.OPEN) socket.send(message);
    }
  });

  // Render drops idle connections; the heartbeat keeps them open and reaps
  // sockets whose browser vanished without a close frame.
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30000);

  const close = () => {
    clearInterval(heartbeat);
    unsubscribe();
    wss.close();
  };

  return { wss, close };
}

module.exports = attachGateway;
