import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import CoinIcon from "@/components/landing/CoinIcon";
import Sparkline from "@/components/landing/Sparkline";
import BaselineBar from "@/components/app/BaselineBar";
import { Panel, StatCard } from "@/components/app/Panel";
import { Failed, Loading } from "@/components/app/QueryState";
import { useMarkets, useOrders, usePortfolio } from "@/hooks/useOrbit";
import { useOrbitPrices } from "@/hooks/useOrbitPrices";
import { formatPercent, formatPrice, formatUsd } from "@/lib/format";
import { baseAsset, coinMeta } from "@/lib/markets";

const tickerOf = baseAsset;

export default function Dashboard() {
  const portfolio = usePortfolio();
  const orders = useOrders(5);
  const markets = useMarkets();
  const { data: prices, status } = useOrbitPrices();

  // The busiest six markets, in the order the API ranked them by volume.
  const watchlist = (markets.data?.markets ?? []).slice(0, 6).map((row) => coinMeta(row.symbol));

  if (portfolio.isPending) return <Loading label="Loading your portfolio" />;
  if (portfolio.isError) {
    return <Failed error={portfolio.error} onRetry={portfolio.refetch} />;
  }

  const p = portfolio.data;
  const totalValue = Number(p.totalValue);
  const unrealised = Number(p.unrealizedPnl);
  const totalReturn = Number(p.totalReturnPct);
  const startingCash = Number(p.startingCash);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Portfolio value" value={formatUsd(totalValue)} hint="Cash plus positions" />
        <StatCard label="Available cash" value={formatUsd(Number(p.cash))} hint="Buying power" />
        <StatCard
          label="Unrealised P&L"
          value={`${unrealised >= 0 ? "+" : "−"}${formatUsd(Math.abs(unrealised)).slice(1)}`}
          hint="Across open positions"
          tone={unrealised >= 0 ? "gain" : "loss"}
        />
        <StatCard
          label="Total return"
          value={`${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`}
          hint={`From ${formatUsd(startingCash)} start`}
          tone={totalReturn >= 0 ? "gain" : "loss"}
        />
      </div>

      <Panel>
        <BaselineBar value={totalValue} baseline={startingCash} />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Panel
          title="Holdings"
          action={
            <Link to="/portfolio" className="text-xs text-foreground/45 transition-colors hover:text-foreground">
              View all
            </Link>
          }
          bodyClassName="p-0"
        >
          {p.holdings.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="text-sm text-foreground">You don't hold anything yet</p>
              <p className="mt-1.5 text-xs text-foreground/45">
                Your first trade is the fastest way to understand the mechanics.
              </p>
              <Link
                to="/trade"
                className="mt-5 inline-block rounded-full bg-brand px-5 py-2.5 text-xs font-semibold text-ink"
              >
                Place an order
              </Link>
            </div>
          ) : (
            <ul>
              {p.holdings.map((holding) => {
                const pnl = Number(holding.unrealizedPnl);
                return (
                  <li
                    key={holding.symbol}
                    className="flex items-center gap-3 border-b border-line px-5 py-4 last:border-b-0"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/10 text-foreground">
                      <CoinIcon symbol={holding.symbol} />
                    </span>

                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="text-sm text-foreground">{tickerOf(holding.symbol)}</p>
                      <p className="tabular text-xs text-foreground/40">
                        {Number(holding.quantity)} @ {formatPrice(Number(holding.averagePrice))}
                      </p>
                    </div>

                    <div className="text-right leading-tight">
                      <p className="tabular text-sm text-foreground">{formatUsd(Number(holding.value))}</p>
                      <p className={`tabular text-xs ${pnl >= 0 ? "text-gain" : "text-loss"}`}>
                        {pnl >= 0 ? "+" : "−"}
                        {formatUsd(Math.abs(pnl)).slice(1)} (
                        {formatPercent(Number(holding.unrealizedPnlPct))})
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Watchlist"
          action={
            <span className="flex items-center gap-1.5 text-[11px] text-foreground/40">
              <span
                className={`size-1.5 rounded-full ${status === "live" ? "animate-pulse bg-gain" : "bg-foreground/30"}`}
              />
              {status === "live" ? "Live" : "Offline"}
            </span>
          }
          bodyClassName="p-0"
        >
          <ul>
            {watchlist.map((coin, index) => {
              const tick = prices[coin.symbol];
              const isUp = (tick?.changePct ?? 0) >= 0;

              return (
                <li key={coin.symbol} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
                  <span className="w-12 shrink-0 text-xs text-foreground">{coin.ticker}</span>
                  <span className={`shrink-0 ${isUp ? "text-gain" : "text-loss"}`}>
                    <Sparkline seed={index + 2} width={54} height={20} />
                  </span>
                  <span className="tabular flex-1 text-right text-xs text-foreground">
                    {formatPrice(tick?.price)}
                  </span>
                  <span className={`tabular w-16 shrink-0 text-right text-xs ${isUp ? "text-gain" : "text-loss"}`}>
                    {formatPercent(tick?.changePct)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Recent trades"
        action={
          <Link
            to="/transactions"
            className="inline-flex items-center gap-1 text-xs text-foreground/45 transition-colors hover:text-foreground"
          >
            All transactions
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        }
        bodyClassName="p-0"
      >
        {orders.isPending ? (
          <Loading label="Loading recent trades" />
        ) : orders.data?.orders.length ? (
          <ul>
            {orders.data.orders.map((order) => (
              <li key={order.id} className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0">
                <span
                  className={`w-12 shrink-0 rounded-md px-2 py-0.5 text-center text-[11px] font-semibold ${
                    order.side === "BUY" ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
                  }`}
                >
                  {order.side}
                </span>
                <span className="w-14 shrink-0 text-sm text-foreground">{tickerOf(order.symbol)}</span>
                <span className="tabular flex-1 text-right text-xs text-foreground/60">
                  {Number(order.quantity)}
                </span>
                <span className="tabular w-28 shrink-0 text-right text-xs text-foreground">
                  {formatUsd(Number(order.total))}
                </span>
                <span className="hidden w-36 shrink-0 text-right text-xs text-foreground/40 sm:block">
                  {new Date(order.createdAt).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-12 text-center text-sm text-foreground/45">
            No trades yet. Your fills will appear here.
          </p>
        )}
      </Panel>
    </div>
  );
}
