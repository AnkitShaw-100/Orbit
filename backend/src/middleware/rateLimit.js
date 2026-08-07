const rateLimit = require("express-rate-limit");
const env = require("../config/env");

/**
 * Three tiers, because the endpoints have very different costs and abuse
 * profiles. Limits are per IP and disabled in development, where a hot-reloading
 * frontend legitimately hammers the API.
 *
 * Messages match the shape of every other error the API returns, so the client
 * renders them through the same path rather than showing a raw string.
 */
const message = (text) => ({ error: { message: text } });

const shared = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => !env.isProduction,
};

/** Reads: generous, since the dashboard polls and prices are public. */
const readLimiter = rateLimit({
  ...shared,
  windowMs: 60_000,
  limit: 240,
  message: message("You're making requests faster than Orbit will answer them. Wait a moment."),
});

/**
 * Orders: the only endpoint that writes money. A human places a handful of
 * trades a minute; anything beyond that is a script, and every one of them
 * costs a database transaction.
 */
const orderLimiter = rateLimit({
  ...shared,
  windowMs: 60_000,
  limit: 30,
  message: message("Too many orders in a row. Wait a minute before trading again."),
});

/**
 * Klines: each one is a call out to Binance against Orbit's shared IP budget,
 * so a single user cannot be allowed to spend it.
 */
const klineLimiter = rateLimit({
  ...shared,
  windowMs: 60_000,
  limit: 60,
  message: message("Too many chart requests. Wait a moment before changing timeframe again."),
});

module.exports = { readLimiter, orderLimiter, klineLimiter };
