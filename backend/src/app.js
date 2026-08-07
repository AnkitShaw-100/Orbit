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

      return allowed
        ? callback(null, true)
        : callback(new Error(`Origin ${origin} is not allowed to call the Orbit API`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());
app.use(morgan(env.isProduction ? "combined" : "dev"));

// Railway pings this; it reports the market feed too, since the API is only
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
