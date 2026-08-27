import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Search } from "lucide-react";
import { Failed, Loading } from "@/components/app/QueryState";
import { useTransactions } from "@/hooks/useOrbit";
import { formatPrice, formatUsd } from "@/lib/format";

const FILTERS = ["All", "Buys", "Sells"];
const tickerOf = (symbol) => symbol.replace("USDT", "");

export default function Transactions() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const transactions = useTransactions(100);

  const rows = useMemo(() => {
    const list = transactions.data?.transactions ?? [];
    const term = query.trim().toLowerCase();

    return list.filter((row) => {
      const side = row.order?.side;
      const matchesSide =
        filter === "All" || (filter === "Buys" ? side === "BUY" : side === "SELL");
      return matchesSide && tickerOf(row.symbol).toLowerCase().includes(term);
    });
  }, [transactions.data, query, filter]);

  const realised = rows.reduce((sum, row) => sum + Number(row.realizedPnl ?? 0), 0);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Search transactions</span>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by coin"
            className="w-full rounded-full border border-line bg-panel py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-faint focus:border-foreground/30 focus:outline-none"
          />
        </label>

        <div className="flex gap-2">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                filter === option
                  ? "border-brand bg-brand text-ink"
                  : "border-line text-muted-foreground hover:text-foreground"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <p className="tabular ml-auto text-xs text-muted-foreground">
          Realised P&L{" "}
          <span className={realised >= 0 ? "text-gain" : "text-loss"}>
            {realised >= 0 ? "+" : "−"}
            {formatUsd(Math.abs(realised)).slice(1)}
          </span>
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="hidden grid-cols-[auto_1fr_1fr_1fr_1fr_1.2fr] gap-4 border-b border-line px-5 py-3 text-xs text-faint lg:grid">
          <span className="w-14">Side</span>
          <span>Asset</span>
          <span className="text-right">Quantity</span>
          <span className="text-right">Price</span>
          <span className="text-right">Total</span>
          <span className="text-right">Date / P&L</span>
        </div>

        {transactions.isPending && <Loading label="Loading your history" />}
        {transactions.isError && (
          <Failed error={transactions.error} onRetry={transactions.refetch} />
        )}

        {transactions.isSuccess && (
          <ul>
            {rows.map((row) => {
              const order = row.order;
              const realizedPnl = row.realizedPnl == null ? null : Number(row.realizedPnl);

              return (
                <li
                  key={row.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-line px-5 py-4 last:border-b-0 lg:grid-cols-[auto_1fr_1fr_1fr_1fr_1.2fr]"
                >
                  <span
                    className={`w-14 shrink-0 rounded-md px-2 py-0.5 text-center text-[11px] font-semibold ${
                      order?.side === "BUY" ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
                    }`}
                  >
                    {order?.side ?? "—"}
                  </span>

                  <div className="min-w-0 leading-tight">
                    <p className="text-sm text-foreground">{tickerOf(row.symbol)}</p>
                    <p className="tabular text-xs text-faint lg:hidden">
                      {Number(order?.quantity ?? 0)} @ {formatPrice(Number(order?.executionPrice ?? 0))}
                    </p>
                  </div>

                  <span className="tabular hidden text-right text-sm text-muted-foreground lg:block">
                    {Number(order?.quantity ?? 0)}
                  </span>
                  <span className="tabular hidden text-right text-sm text-muted-foreground lg:block">
                    {formatPrice(Number(order?.executionPrice ?? 0))}
                  </span>
                  <span className="tabular hidden text-right text-sm text-foreground lg:block">
                    {formatUsd(Number(order?.total ?? 0))}
                  </span>

                  <div className="text-right leading-tight">
                    <p className="tabular text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="tabular text-xs">
                      {realizedPnl == null ? (
                        <span className="text-faint">—</span>
                      ) : (
                        <span className={realizedPnl >= 0 ? "text-gain" : "text-loss"}>
                          {realizedPnl >= 0 ? "+" : "−"}
                          {formatUsd(Math.abs(realizedPnl)).slice(1)}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {transactions.isSuccess && rows.length === 0 && (
          <div className="px-5 py-16 text-center">
            <p className="text-sm text-foreground">
              {transactions.data.transactions.length === 0
                ? "No transactions yet"
                : "No transactions match that filter"}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {transactions.data.transactions.length === 0
                ? "Every fill you make is recorded here, with realised P&L on sells."
                : "Clear the search to see everything."}
            </p>
            {transactions.data.transactions.length === 0 && (
              <Link
                to="/trade"
                className="mt-5 inline-block rounded-full bg-brand px-5 py-2.5 text-xs font-semibold text-ink"
              >
                Go to trade
              </Link>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-faint">
        Realised P&L is recorded on sells only. Buys change your average price
        rather than booking a profit.
      </p>
    </div>
  );
}
