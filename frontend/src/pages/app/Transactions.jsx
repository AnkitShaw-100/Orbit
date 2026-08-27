import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowDownLeft, ArrowUpRight, Receipt, Scale } from "lucide-react";
import CoinCell, { SideBadge } from "@/components/app/CoinCell";
import Pagination from "@/components/app/Pagination";
import { Panel, StatCard } from "@/components/app/Panel";
import { PAGE_SIZE, pageOf } from "@/lib/paging";
import { ChipGroup, SearchField, Toolbar } from "@/components/app/Toolbar";
import { Failed, Loading } from "@/components/app/QueryState";
import { useTransactions } from "@/hooks/useOrbit";
import { formatPrice, formatUsd, signedUsd } from "@/lib/format";
import { baseAsset, coinMeta } from "@/lib/markets";

const FILTERS = [
  { value: "All", label: "All" },
  { value: "Buys", label: "Buys" },
  { value: "Sells", label: "Sells" },
];

const QUANTITY = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });

const ROW_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Written once so the header and the rows cannot drift apart. */
const GRID = "lg:grid-cols-[1.7fr_1fr_1fr_1fr_9rem]";

export default function Transactions() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const transactions = useTransactions(100);

  // Memoised because both derivations below depend on it: without this the
  // `?? []` would hand them a brand-new array on every render.
  const all = useMemo(() => transactions.data?.transactions ?? [], [transactions.data]);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();

    return all.filter((row) => {
      const side = row.order?.side;
      const matchesSide =
        filter === "All" || (filter === "Buys" ? side === "BUY" : side === "SELL");
      return matchesSide && baseAsset(row.symbol).toLowerCase().includes(term);
    });
  }, [all, query, filter]);

  /**
   * The account's whole record, not the filtered view — the tiles are the
   * standing answer to "how has this gone", and switching to Buys shouldn't
   * make the realised figure appear to change.
   */
  const totals = useMemo(() => {
    const closed = all.filter((row) => row.realizedPnl != null);
    return {
      buys: all.filter((row) => row.order?.side === "BUY").length,
      sells: all.filter((row) => row.order?.side === "SELL").length,
      realised: closed.reduce((sum, row) => sum + Number(row.realizedPnl), 0),
      wins: closed.filter((row) => Number(row.realizedPnl) > 0).length,
      closed: closed.length,
    };
  }, [all]);

  const { count: pageCount, current } = pageOf(page, rows.length);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const empty = all.length === 0;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* No accent tints: four coloured tiles on every page turned the colour
          into decoration. Left plain, the only colour in the row is the one
          that means something — a realised figure up or down. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Transactions"
          value={all.length || "—"}
          hint="Every fill on your account"
          icon={Receipt}
        />
        <StatCard
          label="Buys"
          value={totals.buys || "—"}
          hint="Opened or added to a position"
          icon={ArrowDownLeft}
        />
        <StatCard
          label="Sells"
          value={totals.sells || "—"}
          hint="Closed out or went short"
          icon={ArrowUpRight}
        />
        <StatCard
          label="Realised P&L"
          value={totals.closed ? signedUsd(totals.realised) : "—"}
          tone={totals.closed ? (totals.realised >= 0 ? "gain" : "loss") : "neutral"}
          hint={
            totals.closed
              ? `${totals.wins} of ${totals.closed} sells in profit`
              : "Booked on sells only"
          }
          icon={Scale}
        />
      </div>

      <Toolbar>
        <SearchField
          label="Search transactions"
          placeholder="Filter by coin"
          className="sm:max-w-xs"
          value={query}
          onChange={(next) => {
            setQuery(next);
            setPage(1);
          }}
        />

        <ChipGroup
          label="Filter by side"
          options={FILTERS}
          value={filter}
          onChange={(next) => {
            setFilter(next);
            setPage(1);
          }}
        />

        {/* The filtered subtotal, which is the one figure that *should* move
            with the filter — hence stated here rather than in a tile. */}
        {rows.length > 0 && (
          <p className="tabular ml-auto text-xs text-muted-foreground">
            {rows.length} shown
            <span className="mx-2 text-faint">·</span>
            <span
              className={
                rows.reduce((sum, row) => sum + Number(row.realizedPnl ?? 0), 0) >= 0
                  ? "text-gain"
                  : "text-loss"
              }
            >
              {signedUsd(rows.reduce((sum, row) => sum + Number(row.realizedPnl ?? 0), 0))}
            </span>
          </p>
        )}
      </Toolbar>

      <Panel title="History" bodyClassName="p-0">
        {transactions.isPending && <Loading label="Loading your history" />}
        {transactions.isError && (
          <Failed error={transactions.error} onRetry={transactions.refetch} />
        )}

        {transactions.isSuccess && rows.length > 0 && (
          <>
            <div
              className={`hidden gap-4 border-b border-line px-5 py-3 text-xs text-faint sm:px-6 lg:grid ${GRID}`}
            >
              <span>Market</span>
              <span className="text-right">Quantity</span>
              <span className="text-right">Price</span>
              <span className="text-right">Total</span>
              <span className="text-right">Date · Realised</span>
            </div>

            <ul>
              {visible.map((row) => {
                const order = row.order;
                const realised = row.realizedPnl == null ? null : Number(row.realizedPnl);

                return (
                  <li
                    key={row.id}
                    className={`grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-5 py-3.5 transition-colors last:border-b-0 hover:bg-foreground/2 sm:px-6 ${GRID}`}
                  >
                    <CoinCell
                      symbol={row.symbol}
                      badge={order?.side && <SideBadge side={order.side} />}
                      sub={
                        <>
                          {/* On narrow screens the quantity and price columns
                              are gone, so the row states them here instead —
                              and gives the line back to the coin's name once
                              those columns reappear. */}
                          <span className="tabular lg:hidden">
                            {QUANTITY.format(Number(order?.quantity ?? 0))} @{" "}
                            {formatPrice(Number(order?.executionPrice ?? 0))}
                          </span>
                          <span className="hidden lg:inline">{coinMeta(row.symbol).name}</span>
                        </>
                      }
                    />

                    <span className="tabular hidden text-right text-sm text-muted-foreground lg:block">
                      {QUANTITY.format(Number(order?.quantity ?? 0))}
                    </span>
                    <span className="tabular hidden text-right text-sm text-muted-foreground lg:block">
                      {formatPrice(Number(order?.executionPrice ?? 0))}
                    </span>
                    <span className="tabular hidden text-right text-sm text-foreground lg:block">
                      {formatUsd(Number(order?.total ?? 0))}
                    </span>

                    <div className="text-right leading-tight">
                      <p className="tabular text-sm text-foreground lg:hidden">
                        {formatUsd(Number(order?.total ?? 0))}
                      </p>
                      <p className="tabular text-xs text-faint">
                        {ROW_DATE.format(new Date(row.createdAt))}
                      </p>
                      <p className="tabular text-xs">
                        {realised == null ? (
                          <span className="text-faint">—</span>
                        ) : (
                          <span className={realised >= 0 ? "text-gain" : "text-loss"}>
                            {signedUsd(realised)}
                          </span>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Pagination
              page={current}
              pageCount={pageCount}
              total={rows.length}
              onChange={setPage}
            />
          </>
        )}

        {transactions.isSuccess && rows.length === 0 && (
          <div className="px-5 py-16 text-center">
            <p className="text-sm text-foreground">
              {empty ? "No transactions yet" : "No transactions match that filter"}
            </p>
            <p className="mx-auto mt-1.5 max-w-[46ch] text-xs leading-relaxed text-muted-foreground">
              {empty
                ? "Every fill you make is recorded here, with realised P&L on sells."
                : "Clear the search or switch back to All to see everything."}
            </p>

            {empty ? (
              <Link
                to="/trade"
                className="mt-5 inline-block rounded-full bg-brand px-5 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
              >
                Go to trade
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("All");
                  setPage(1);
                }}
                className="mt-5 rounded-full border border-line px-5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </Panel>

      <p className="text-[11px] leading-relaxed text-faint">
        Realised P&L is recorded on sells only. Buys change your average price rather than booking
        a profit.
      </p>
    </div>
  );
}
