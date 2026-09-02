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

export function usePlaceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    /**
     * A key per attempt, minted here rather than in the pages, so every caller
     * — the ticket, the dashboard's close button, the trade page's — is covered
     * without each having to remember. One mutation attempt is one order however
     * many times the request reaches the server.
     */
    mutationFn: (order) =>
      orbit.placeOrder({ ...order, idempotencyKey: order.idempotencyKey ?? crypto.randomUUID() }),
    onSuccess: () => {
      // A fill moves cash, holdings and history at once — refresh all three
      // rather than trying to patch the caches by hand.
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
