import { Link } from "react-router";
import { ArrowUpRight, Layers, PieChart, Scale, TrendingUp } from "lucide-react";
import CoinIcon from "@/components/landing/CoinIcon";
import Sparkline from "@/components/landing/Sparkline";
import { Cell, CellRow, Panel, StatCard } from "@/components/app/Panel";
import { Failed, Loading } from "@/components/app/QueryState";
import { useMarkets, useMe, useOrders, usePortfolio } from "@/hooks/useOrbit";
import { useOrbitPrices } from "@/hooks/useOrbitPrices";
import { formatPercent, formatPrice, formatUsd } from "@/lib/format";
import { baseAsset, coinMeta } from "@/lib/markets";

const tickerOf = baseAsset;

const QUANTITY = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });

const ROW_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

// Read once at load rather than per render: a day counter has no business
// changing mid-session, and reading the clock during render isn't pure.
const LOADED_AT = Date.now();

/** A figure with its sign, always as money. */
function signedUsd(value) {
  return `${value >= 0 ? "+" : "−"}${formatUsd(Math.abs(value))}`;
}

/** A percentage with its sign, using the same minus glyph as the money. */
function signedPct(value) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;
}

/**
 * The headline band: what the account is worth, and how that compares to the
 * $100,000 everyone starts with.
 *
 * This is the same shape as the profile's identity band, minus the accent
 * wash — that flood is reserved for the one page about the person rather than
 * the market. Here the surface stays neutral and the numbers carry the colour.
 */
function SummaryBand({ name, days, totalValue, startingCash, cash, unrealised, totalReturn }) {
  const ahead = totalValue >= startingCash;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 p-5 sm:p-6">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.14em] text-brand uppercase">
            Paper trader{days ? ` · Day ${days}` : ""}
          </p>
          <p className="tabular mt-1.5 font-display text-3xl font-bold tracking-[-0.03em] text-foreground">
            {formatUsd(totalValue)}
          </p>
          <p className="text-sm text-muted-foreground">
            {name ? `${name}'s portfolio — cash plus positions` : "Cash plus positions"}
          </p>
        </div>

        {/* The number the removed bar existed to answer: ahead or behind the
            start, in both money and percent, without a chart to read. */}
        <div className="text-right leading-tight">
          <p
            className={`tabular font-display text-2xl font-bold tracking-[-0.03em] ${
              ahead ? "text-gain" : "text-loss"
            }`}
          >
            {signedPct(totalReturn)}
          </p>
          <p className={`tabular text-sm ${ahead ? "text-gain" : "text-loss"}`}>
            {signedUsd(totalValue - startingCash)}
          </p>
          <p className="mt-0.5 text-xs text-faint">
            Against your {formatUsd(startingCash)} start
          </p>
        </div>
      </div>

      <div className="border-t border-line">
        <CellRow>
          <Cell label="Available cash" value={formatUsd(cash)}>
            <p className="text-xs text-faint">Buying power</p>
          </Cell>
          <Cell
            label="Unrealised P&L"
            value={signedUsd(unrealised)}
            tone={unrealised >= 0 ? "text-gain" : "text-loss"}
          >
            <p className="text-xs text-faint">Across open positions</p>
          </Cell>
          <Cell label="Starting balance" value={formatUsd(startingCash)}>
            <p className="text-xs text-faint">The same for every account</p>
          </Cell>
        </CellRow>
      </div>
    </section>
  );
}

/** One open position, laid out like the profile's ledger rows. */
function HoldingRow({ holding }) {
  const meta = coinMeta(holding.symbol);
  const pnl = Number(holding.unrealizedPnl);

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0 sm:px-6 lg:grid-cols-[1.6fr_1fr_9rem]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/10 text-foreground">
          <CoinIcon symbol={meta.symbol} />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-sm text-foreground">
            {meta.ticker}
            <span className="text-faint">/USDT</span>
          </p>
          <p className="truncate text-xs text-faint">{meta.name}</p>
        </div>
      </div>

      <span className="tabular hidden text-sm text-muted-foreground lg:block">
        {QUANTITY.format(Number(holding.quantity))}{" "}
        <span className="text-faint">@ {formatPrice(Number(holding.averagePrice))}</span>
      </span>

      <div className="text-right leading-tight">
        <p className="tabular text-sm text-foreground">{formatUsd(Number(holding.value))}</p>
        <p className={`tabular text-xs ${pnl >= 0 ? "text-gain" : "text-loss"}`}>
          {signedUsd(pnl)} ({formatPercent(Number(holding.unrealizedPnlPct))})
        </p>
      </div>
    </li>
  );
}

/**
 * Column names for the holdings list, matching the ones the profile ledger and
 * the markets list use, so every table on the signed-in side reads alike.
 */
function HoldingsHeader() {
  return (
    <div className="hidden grid-cols-[1.6fr_1fr_9rem] gap-4 border-b border-line px-5 py-3 text-xs text-faint sm:px-6 lg:grid">
      <span>Market</span>
      <span>Position</span>
      <span className="text-right">Value</span>
    </div>
  );
}

export default function Dashboard() {
  const portfolio = usePortfolio();
  const orders = useOrders(5);
  const markets = useMarkets();
  const me = useMe();
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
  const positionsValue = Number(p.positionsValue);
  const shortNotional = Number(p.shortNotional);

  const user = me.data?.user;
  const days = user
    ? Math.max(1, Math.round((LOADED_AT - new Date(user.createdAt)) / 86_400_000))
    : null;

  // The position doing the most work, by percentage rather than size — a small
  // holding up 40% is the more useful thing to surface than a large one up 2%.
  const best = p.holdings.length
    ? p.holdings.reduce((a, b) =>
        Number(b.unrealizedPnlPct) > Number(a.unrealizedPnlPct) ? b : a,
      )
    : null;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <SummaryBand
        name={user?.name}
        days={days}
        totalValue={totalValue}
        startingCash={startingCash}
        cash={Number(p.cash)}
        unrealised={unrealised}
        totalReturn={totalReturn}
      />

      {/* Measures the band above doesn't already state, so the two rows add up
          rather than repeat. Each keeps the hue the profile gave it. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open positions"
          value={p.holdings.length || "—"}
          hint={p.holdings.length === 1 ? "In 1 market" : `In ${p.holdings.length} markets`}
          accent="iris"
          icon={Layers}
        />
        <StatCard
          label="Invested"
          value={formatUsd(positionsValue)}
          hint={`${totalValue ? Math.round((positionsValue / totalValue) * 100) : 0}% of portfolio`}
          accent="sky"
          icon={PieChart}
        />
        <StatCard
          label="Best performer"
          value={best ? formatPercent(Number(best.unrealizedPnlPct)) : "—"}
          tone={best && Number(best.unrealizedPnlPct) >= 0 ? "gain" : best ? "loss" : "neutral"}
          hint={best ? `${tickerOf(best.symbol)} · ${signedUsd(Number(best.unrealizedPnl))}` : "No open positions"}
          accent="mint"
          icon={TrendingUp}
        />
        <StatCard
          label="Short exposure"
          value={shortNotional ? formatUsd(shortNotional) : "None"}
          tone={p.atRisk ? "loss" : "neutral"}
          hint={p.marginRatio ? `Margin ${p.marginRatio}×` : "Nothing shorted"}
          accent="ember"
          icon={Scale}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Panel title="Holdings" bodyClassName="p-0">
          {p.holdings.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="text-sm text-foreground">You don't hold anything yet</p>
              <p className="mx-auto mt-1.5 max-w-[46ch] text-xs leading-relaxed text-muted-foreground">
                Your first trade is the fastest way to understand the mechanics.
              </p>
              <Link
                to="/trade"
                className="mt-5 inline-block rounded-full bg-brand px-5 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
              >
                Place an order
              </Link>
            </div>
          ) : (
            <>
              <HoldingsHeader />
              <ul>
                {p.holdings.map((holding) => (
                  <HoldingRow key={holding.symbol} holding={holding} />
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel
          title="Watchlist"
          action={
            <span className="flex items-center gap-1.5 text-[11px] text-faint">
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
                <li
                  key={coin.symbol}
                  className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0 sm:px-6"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground/10 text-foreground">
                    <CoinIcon symbol={coin.symbol} className="size-4" />
                  </span>
                  <span className="w-12 shrink-0 text-xs text-foreground">{coin.ticker}</span>
                  <span className={`shrink-0 ${isUp ? "text-gain" : "text-loss"}`}>
                    <Sparkline seed={index + 2} width={44} height={20} />
                  </span>
                  <span className="tabular flex-1 text-right text-xs text-foreground">
                    {formatPrice(tick?.price)}
                  </span>
                  <span
                    className={`tabular w-16 shrink-0 text-right text-xs ${isUp ? "text-gain" : "text-loss"}`}
                  >
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
            className="inline-flex items-center gap-1 rounded-full border border-line px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
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
            {orders.data.orders.map((order) => {
              const meta = coinMeta(order.symbol);

              return (
                <li
                  key={order.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0 sm:px-6 lg:grid-cols-[1.6fr_1fr_1fr_8rem]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/10 text-foreground">
                      <CoinIcon symbol={meta.symbol} />
                    </span>
                    <div className="min-w-0 leading-tight">
                      <p className="text-sm text-foreground">
                        {meta.ticker}
                        <span className="text-faint">/USDT</span>
                      </p>
                      <p className="truncate text-xs text-faint">{meta.name}</p>
                    </div>
                  </div>

                  <span className="tabular hidden text-sm text-muted-foreground lg:block">
                    <span
                      className={`mr-2 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        order.side === "BUY" ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
                      }`}
                    >
                      {order.side}
                    </span>
                    {QUANTITY.format(Number(order.quantity))}
                  </span>

                  <span className="tabular hidden text-sm text-muted-foreground lg:block">
                    {ROW_TIME.format(new Date(order.createdAt))}
                  </span>

                  <div className="text-right leading-tight">
                    <p className="tabular text-sm text-foreground">
                      {formatUsd(Number(order.total))}
                    </p>
                    <p className="tabular text-xs text-faint lg:hidden">
                      {order.side} · {ROW_TIME.format(new Date(order.createdAt))}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No trades yet. Your fills will appear here.
          </p>
        )}
      </Panel>
    </div>
  );
}
