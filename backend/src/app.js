const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const env = require("./config/env");
const routes = require("./routes");
const market = require("./services/marketData.service");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Behind Railway's proxy, so client IPs arrive in X-Forwarded-For. Rate
// limiting (added once the endpoints settle) depends on this being right.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    /**
     * Vercel gives every branch and pull request its own preview URL, so a
     * single allowed origin would block everything except production. Allowed:
     * the configured client, any preview on the same Vercel project, and
     * requests with no Origin at all (curl, health checks, server-to-server).
     */
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const allowed =
        origin === env.clientUrl ||
        env.extraOrigins.includes(origin) ||
        (env.vercelProject && new RegExp(`^https://${env.vercelProject}-[a-z0-9-]+\\.vercel\\.app$`).test(origin));

      // Refuse by withholding the CORS headers rather than throwing. Throwing
      // surfaces as a 500, which reads as "the API is broken" when the real
      // answer is "this origin isn't on the list" — and the browser blocks it
      // either way.
      if (!allowed) console.warn(`[cors] refused origin ${origin}`);
      return callback(null, allowed);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());
app.use(morgan(env.isProduction ? "combined" : "dev"));

/**
 * Anyone who opens the base URL in a browser gets something that explains what
 * this is and what it serves. A bare 404 here reads as a broken deployment
 * even when everything is fine.
 */
app.get("/", (_req, res) => {
  const snapshot = market.snapshot();

  res.json({
    service: "Orbit API",
    description: "Real-time crypto paper trading. Market data from Binance.",
    status: "running",
    marketFeed: market.isConnected ? "connected" : "reconnecting",
    marketsListed: Object.keys(snapshot).length,
    uptimeSeconds: Math.round(process.uptime()),
    endpoints: {
      health: "GET /health",
      markets: "GET /api/markets",
      candles: "GET /api/markets/:symbol/klines",
      livePrices: "WS /ws",
      profile: "GET /api/me (requires a Supabase access token)",
      portfolio: "GET /api/portfolio (requires a Supabase access token)",
      placeOrder: "POST /api/orders (requires a Supabase access token)",
    },
  });
});

// Render pings this; it reports the market feed too, since the API is only
// half useful when prices aren't flowing.
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    marketFeed: market.isConnected ? "connected" : "reconnecting",
    uptime: Math.round(process.uptime()),
  });
});

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
