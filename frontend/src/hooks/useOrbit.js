import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orbit } from "@/lib/api";

/**
 * Server state for the signed-in screens. Prices arrive over the WebSocket, so
 * these queries hold slower-moving data — balances, positions and history —
 * and are refetched when an order changes them rather than on a timer.
 */

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: orbit.me, staleTime: 60_000 });
}

/**
 * Which markets Orbit lists, in the backend's volume order. The set changes
 * only when the server restarts and re-ranks, so this is cached hard and the
 * live prices arrive over the socket instead.
 */
export function useMarkets() {
  return useQuery({
    queryKey: ["markets"],
    queryFn: orbit.markets,
    staleTime: 10 * 60_000,
  });
}

export function usePortfolio() {
  return useQuery({
    queryKey: ["portfolio"],
    queryFn: orbit.portfolio,
    // Positions are valued from live prices server-side, so a slow poll keeps
    // the figures honest without hammering the API.
    refetchInterval: 20_000,
  });
}

export function useOrders(limit = 50) {
  return useQuery({ queryKey: ["orders", limit], queryFn: () => orbit.orders(limit) });
}

export function useTransactions(limit = 50) {
  return useQuery({
    queryKey: ["transactions", limit],
    queryFn: () => orbit.transactions(limit),
  });
}

/**
 * Back to $100,000 with nothing held and no history.
 *
 * Every cached query is dropped rather than invalidated: refetching would leave
 * the old positions on screen until each request came back, and a wiped account
 * still showing its holdings is alarming in a way a brief spinner is not.
 */
export function useResetAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: orbit.resetAccount,
    onSuccess: () => queryClient.resetQueries(),
  });
}

/**
 * Deletes the account for good. The caller signs out afterwards — the token in
 * hand stays valid until it expires, and it now points at nothing.
 */
export function useDeleteAccount() {
  return useMutation({ mutationFn: orbit.deleteAccount });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();

  /**
   * One key per *intent*, not per call — which is the whole point of it.
   *
   * Minted outside the mutation and held until an order actually fills, so
   * every submit that has not yet succeeded carries the same key. Two clicks
   * land as two requests with one key: the first fills, the second blocks on
   * the account lock, then finds the committed order and returns it instead of
   * placing a second. Generating the key inside mutationFn instead would give
   * each click its own, which defeats the entire mechanism.
   *
   * Rotated on success, so the next order is a genuinely new intent. A refused
   * order keeps the key, which is correct: it wrote nothing, so retrying it is
   * the same intent, not a new one. A remount mints a fresh key anyway, since
   * the ref is per hook instance.
   */
  const intentKey = useRef(null);
  if (intentKey.current === null) intentKey.current = crypto.randomUUID();

  return useMutation({
    mutationFn: (order) =>
      orbit.placeOrder({ ...order, idempotencyKey: order.idempotencyKey ?? intentKey.current }),
    onSuccess: () => {
      // This intent is spent. Anything placed after it is a new order.
      intentKey.current = crypto.randomUUID();

      // A fill moves cash, holdings and history at once — refresh all three
      // rather than trying to patch the caches by hand.
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
