import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
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
