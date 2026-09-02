import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowUpRight } from "lucide-react";
import CoinIcon from "@/components/landing/CoinIcon";
import CoinCell, { SideBadge } from "@/components/app/CoinCell";
import Sparkline from "@/components/landing/Sparkline";
import { Cell, CellRow, Panel } from "@/components/app/Panel";
import PositionActions from "@/components/app/PositionActions";
import { LiveDot } from "@/components/app/Toolbar";
import { Failed, Loading } from "@/components/app/QueryState";
import { useMarkets, useMe, useOrders, usePlaceOrder, usePortfolio } from "@/hooks/useOrbit";
import { useOrbitPrices } from "@/hooks/useOrbitPrices";
import { formatPercent, formatPrice, formatUsd, signedPercent, signedUsd } from "@/lib/format";
import { coinMeta } from "@/lib/markets";
import { markPortfolio } from "@/lib/positions";

/** Written once so the holdings header and its rows cannot drift apart. */
const HOLDING_GRID = "lg:grid-cols-[1.6fr_1fr_9rem_13rem]";

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

/**
 * The headline band: what the account is worth, and how that compares to the
 * $100,000 everyone starts with.
 *
 * This is the same shape as the profile's identity band, minus the accent
 * wash — that flood is reserved for the one page about the person rather than
 * the market. Here the surface stays neutral and the numbers carry the colour.
 */
function SummaryBand({ name, days, totalValue, startingCash, cash, shortNotional, unrealised, totalReturn }) {
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
            start, in both money and percent, without a chart to read.

            Full width on a phone, where this wraps onto its own line: left to
            itself the block shrinks to its content, and right-aligned text in
            a shrunk box reads as a misalignment rather than as a column. */}
        <div className="w-full text-center leading-tight sm:w-auto sm:text-right">
          <p
            className={`tabular font-display text-2xl font-bold tracking-[-0.03em] ${
              ahead ? "text-gain" : "text-loss"
            }`}
          >
            {signedPercent(totalReturn)}
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
        <CellRow cols={4}>
          {/* Available, shorted, unrealised: the three figures a short splits
              an account into, kept apart so none of them has to stand in for
              another. A short never touches the balance, so this is spendable
              money outright rather than a number margin has to qualify. */}
          <Cell label="Available balance" value={formatUsd(cash)}>
            <p className="text-xs text-faint">Yours to spend — short proceeds excluded</p>
          </Cell>
          <Cell
            label="Short position"
            value={shortNotional > 0 ? formatUsd(shortNotional) : "None"}
            tone={shortNotional > 0 ? "text-loss" : undefined}
          >
            <p className="text-xs text-faint">
              {shortNotional > 0 ? "Owed back at market" : "Nothing shorted"}
            </p>
          </Cell>
          <Cell
            label="Unrealised P&L"
            value={signedUsd(unrealised)}
            tone={unrealised >= 0 ? "text-gain" : "text-loss"}
          >
            <p className="text-xs text-faint">
              {shortNotional > 0 ? "Lands in your balance on close" : "Across open positions"}
            </p>
          </Cell>
          <Cell label="Starting balance" value={formatUsd(startingCash)}>
            <p className="text-xs text-faint">The same for every account</p>
          </Cell>
        </CellRow>
      </div>
    </section>
  );
}

/**
 * One open position, laid out like the profile's ledger rows — and, because a
 * position you are looking at is usually a position you want to do something
 * about, carrying the same Add and Close controls the trade page offers.
 */
function HoldingRow({ holding, armed, pending, onAdd, onArm, onCancel, onConfirm }) {
  const pnl = Number(holding.unrealizedPnl);
  const quantity = Number(holding.quantity);

  return (
    <li
      className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 border-b border-line px-5 py-3 transition-colors last:border-b-0 hover:bg-foreground/2 sm:px-6 ${HOLDING_GRID}`}
    >
      <CoinCell
        symbol={holding.symbol}
        badge={holding.side === "SHORT" && <SideBadge side="SHORT" />}
      />

      <span className="tabular hidden text-sm text-muted-foreground lg:block">
        {QUANTITY.format(quantity)}{" "}
        <span className="text-faint">@ {formatPrice(Number(holding.averagePrice))}</span>
      </span>

      <div className="text-right leading-tight">
        <p className="tabular text-sm text-foreground">{formatUsd(Number(holding.value))}</p>
        <p className={`tabular text-xs ${pnl >= 0 ? "text-gain" : "text-loss"}`}>
          {signedUsd(pnl)} ({formatPercent(Number(holding.unrealizedPnlPct))})
        </p>
      </div>

      <div className="col-span-2 lg:col-span-1">
        <PositionActions
          armed={armed}
          pending={pending}
          onAdd={onAdd}
          onArm={onArm}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
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
    <div
      className={`hidden gap-4 border-b border-line px-5 py-3 text-xs text-faint sm:px-6 lg:grid ${HOLDING_GRID}`}
    >
      <span>Market</span>
      <span>Position</span>
      <span className="text-right">Value</span>
      <span />
    </div>
  );
}

export default function Dashboard() {
  const query = usePortfolio();
  const orders = useOrders(5);
  const markets = useMarkets();
  const me = useMe();
  const placeOrder = usePlaceOrder();
  const navigate = useNavigate();
  const { data: prices, status } = useOrbitPrices();

  // Same live re-mark the trade screen uses, so the holdings column and the
  // summary band move with the feed instead of with the twenty-second poll.
  const portfolio = useMemo(
    () => ({ ...query, data: markPortfolio(query.data, prices) }),
    [query, prices],
  );

  // Which position is one click from being wiped. One at a time, so a mis-aimed
  // confirm cannot land on a row you never armed.
  const [closeArmed, setCloseArmed] = useState(null);

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

  const user = me.data?.user;
  const days = user
    ? Math.max(1, Math.round((LOADED_AT - new Date(user.createdAt)) / 86_400_000))
    : null;

  /**
   * Flatten a position at market. A long is closed by selling, a short by
   * buying it back, so the side depends on which way the position runs.
   */
  const closePosition = (symbol, quantity) => {
    placeOrder.mutate(
      {
        symbol,
        side: quantity < 0 ? "BUY" : "SELL",
        quantity: Number(Math.abs(quantity).toFixed(8)),
      },
      { onSuccess: () => setCloseArmed(null) },
    );
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <SummaryBand
        name={user?.name}
        days={days}
        totalValue={totalValue}
        startingCash={startingCash}
        cash={Number(p.cash)}
        shortNotional={Number(p.shortNotional)}
        unrealised={unrealised}
        totalReturn={totalReturn}
      />

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
                  <HoldingRow
                    key={holding.symbol}
                    holding={holding}
                    armed={closeArmed === holding.symbol}
                    pending={placeOrder.isPending}
                    // Adding needs a size and a price to check, which is the
                    // trade ticket's job — so this hands off rather than
                    // guessing an amount on the user's behalf.
                    onAdd={() => navigate(`/trade?symbol=${holding.symbol}`)}
                    onArm={() => setCloseArmed(holding.symbol)}
                    onCancel={() => setCloseArmed(null)}
                    onConfirm={() => closePosition(holding.symbol, Number(holding.quantity))}
                  />
                ))}
              </ul>

              {placeOrder.isError && (
                <p className="border-t border-line px-5 py-3 text-xs text-loss sm:px-6">
                  {placeOrder.error.message}
                </p>
              )}
            </>
          )}
        </Panel>

        <Panel
          title="Watchlist"
          action={
            <LiveDot status={status} labels={["Live", "Offline"]} />
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
              return (
                <li
                  key={order.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0 sm:px-6 lg:grid-cols-[1.6fr_1fr_1fr_8rem]"
                >
                  <CoinCell symbol={order.symbol} badge={<SideBadge side={order.side} />} />

                  <span className="tabular hidden text-sm text-muted-foreground lg:block">
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
