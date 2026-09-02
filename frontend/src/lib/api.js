import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  /**
   * `retryAfter` is seconds, and only ever set on a 429. The server computes it
   * from the tokens actually missing rather than a fixed window, so it is worth
   * showing verbatim: the order limiter usually refuses for two seconds, not
   * for the minute a generic message would imply.
   */
  constructor(status, message, details, retryAfter = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

/** `Retry-After` in whole seconds, or null when absent or malformed. */
function retryAfterOf(response) {
  const header = response.headers.get("retry-after");
  if (!header) return null;

  // The header may also carry an HTTP date. Orbit only ever sends seconds, but
  // a proxy in front of it might not, so parse defensively rather than showing
  // a NaN countdown.
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));

  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

/**
 * Every call to the Orbit API goes through here.
 *
 * The access token is read from Supabase at call time rather than held in a
 * variable, so a token refreshed in the background is picked up immediately
 * instead of sending a stale one and getting a spurious 401.
 */
export async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "content-type": "application/json" };

  if (auth) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ApiError(401, "Sign in to continue");
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.message ?? "Something went wrong. Try again.",
      payload?.error?.details,
      response.status === 429 ? retryAfterOf(response) : null,
    );
  }

  return payload;
}

/** Endpoint wrappers, so pages never build URLs themselves. */
export const orbit = {
  me: () => api("/api/me"),
  wallet: () => api("/api/wallet"),
  portfolio: () => api("/api/portfolio"),
  markets: () => api("/api/markets", { auth: false }),
  klines: (symbol, interval = "1h", limit = 120) =>
    api(`/api/markets/${symbol}/klines?interval=${interval}&limit=${limit}`, { auth: false }),
  orders: (limit = 50) => api(`/api/orders?limit=${limit}`),
  transactions: (limit = 50) => api(`/api/transactions?limit=${limit}`),
  /**
   * `idempotencyKey` makes the request safe to send twice. React Query retries
   * on network failure and a user can double-click faster than a round trip,
   * either of which would otherwise fill the same order twice; with a key the
   * server returns the original fill instead of placing a second one.
   */
  placeOrder: ({ symbol, side, quantity, idempotencyKey }) =>
    api("/api/orders", {
      method: "POST",
      body: { symbol, side, quantity, idempotencyKey },
    }),
};

export const WS_URL = BASE.replace(/^http/, "ws") + "/ws";
