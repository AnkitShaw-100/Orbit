const TokenBucket = require("../lib/tokenBucket");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");

/**
 * Rate limiting, built on Orbit's own token bucket rather than a package.
 *
 * Four tiers, because the endpoints have very different costs and abuse
 * profiles. Limits are per IP and disabled in development, where a
 * hot-reloading frontend legitimately hammers the API.
 *
 * Messages match the shape of every other error the API returns, so the client
 * renders them through the same path rather than showing a raw string.
 */

/** Sweeps idle keys out of every bucket on one shared timer. */
const registry = new Set();

const SWEEP_MS = 60_000;
const sweeper = setInterval(() => {
  for (const bucket of registry) bucket.sweep();
}, SWEEP_MS);
sweeper.unref?.();

/**
 * `capacity` is the burst a client may spend at once; `perMinute` is the rate
 * it refills at. Stating both is the point of a bucket — a fixed window can
 * only express one number and then suffers at its own boundary.
 */
function limiter({ capacity, perMinute, message }) {
  const bucket = new TokenBucket({ capacity, refillPerSecond: perMinute / 60 });
  registry.add(bucket);

  return function rateLimit(req, res, next) {
    if (!env.isProduction) return next();

    // `trust proxy` is set in app.js, so req.ip is the client rather than
    // Render's load balancer — without it every request shares one bucket.
    const result = bucket.take(req.ip ?? "unknown");

    res.setHeader("RateLimit-Limit", capacity);
    res.setHeader("RateLimit-Remaining", result.remaining);

    if (result.allowed) return next();

    const seconds = Math.ceil(result.retryAfterMs / 1000);
    res.setHeader("Retry-After", seconds);
    next(ApiError.tooManyRequests(message));
  };
}

/** Reads: generous, since the dashboard polls and prices are public. */
const readLimiter = limiter({
  capacity: 240,
  perMinute: 240,
  message: "You're making requests faster than Orbit will answer them. Wait a moment.",
});

/**
 * Orders: the only endpoint that writes money. A human places a handful of
 * trades a minute; anything beyond that is a script, and every one of them
 * costs a database transaction and an account lock.
 *
 * The burst is deliberately below the rate: a person may fire ten orders in
 * quick succession, but nothing legitimate sustains thirty a minute.
 */
const orderLimiter = limiter({
  capacity: 10,
  perMinute: 30,
  message: "Too many orders in a row. Wait a minute before trading again.",
});

/**
 * Klines: each one is a call out to Binance against Orbit's shared IP budget,
 * so a single user cannot be allowed to spend it.
 */
const klineLimiter = limiter({
  capacity: 60,
  perMinute: 60,
  message: "Too many chart requests. Wait a moment before changing timeframe again.",
});

/**
 * Failed authentication, kept apart from the rest.
 *
 * Orbit issues no credentials of its own — Supabase does — so there is no
 * password endpoint here to brute force. What is reachable is token
 * verification, and an attacker with a stream of forged tokens can otherwise
 * make Orbit do unbounded signature checks and JWKS lookups for free.
 *
 * Only failures are counted, so a signed-in user hitting the API normally
 * never touches this. Ten bad tokens buys a five-minute cool-off, and a
 * successful verification clears the record entirely.
 */
const authFailures = new TokenBucket({ capacity: 10, refillPerSecond: 10 / 300 });
registry.add(authFailures);

module.exports = { readLimiter, orderLimiter, klineLimiter, authFailures };
