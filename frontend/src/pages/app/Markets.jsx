import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Search } from "lucide-react";
import CoinIcon from "@/components/landing/CoinIcon";
import Sparkline from "@/components/landing/Sparkline";
import { formatPercent, formatPrice, formatVolume } from "@/lib/format";
import { coinMeta } from "@/lib/markets";
import { useMarkets } from "@/hooks/useOrbit";
import { useOrbitPrices } from "@/hooks/useOrbitPrices";

const SORTS = [
  { value: "volume", label: "Volume" },
  { value: "gainers", label: "Gainers" },
  { value: "losers", label: "Losers" },
];

const PER_PAGE = 12;

export default function Markets() {
  const { data: tickers, status } = useOrbitPrices();
  const markets = useMarkets();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("volume");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const listed = (markets.data?.markets ?? []).map((row) => coinMeta(row.symbol));
    const filtered = listed.filter(
      (coin) => coin.ticker.toLowerCase().includes(term) || coin.name.toLowerCase().includes(term),
    );

    return [...filtered].sort((a, b) => {
      const left = tickers[a.symbol];
      const right = tickers[b.symbol];
      if (sort === "gainers") return (right?.changePct ?? 0) - (left?.changePct ?? 0);
      if (sort === "losers") return (left?.changePct ?? 0) - (right?.changePct ?? 0);
      return (right?.quoteVolume ?? 0) - (left?.quoteVolume ?? 0);
    });
  }, [query, sort, tickers, markets.data]);

  // Sorting by a live price would reshuffle rows mid-read, so the order is
  // frozen per page and only recomputed when you change page, sort or search.
  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Search markets</span>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/35"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Search a coin"
            className="w-full rounded-full border border-line bg-panel py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/35 focus:border-foreground/30 focus:outline-none"
          />
        </label>

        <div className="flex gap-2">
          {SORTS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => { setSort(option.value); setPage(1); }}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                sort === option.value
                  ? "border-brand bg-brand text-ink"
                  : "border-line text-foreground/60 hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-foreground/40 sm:flex">
          <span className={`size-1.5 rounded-full ${status === "live" ? "animate-pulse bg-gain" : "bg-foreground/30"}`} />
          {status === "live" ? "Live prices" : "Reconnecting"}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr_auto] gap-4 border-b border-line px-5 py-3 text-xs text-foreground/40 lg:grid">
          <span>Market</span>
          <span className="text-right">Last price</span>
          <span className="text-right">24h change</span>
          <span className="text-center">Trend</span>
          <span className="text-right">24h volume</span>
          <span className="w-16" />
        </div>

        <ul>
          {visible.map((coin, index) => {
            const data = tickers[coin.symbol];
            const isUp = (data?.changePct ?? 0) >= 0;

            return (
              <li
                key={coin.symbol}
                className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-5 py-4 last:border-b-0 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr_auto]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/10 text-foreground">
                    <CoinIcon symbol={coin.symbol} />
                  </span>
                  <div className="min-w-0 leading-tight">
                    <p className="text-sm text-foreground">
                      {coin.ticker}
                      <span className="text-foreground/35">/USDT</span>
                    </p>
                    <p className="truncate text-xs text-foreground/40">{coin.name}</p>
                  </div>
                </div>

                <div className="text-right leading-tight lg:hidden">
                  <p className="tabular text-sm text-foreground">{formatPrice(data?.price)}</p>
                  <p className={`tabular text-xs ${isUp ? "text-gain" : "text-loss"}`}>
                    {formatPercent(data?.changePct)}
                  </p>
                </div>

                <span className="tabular hidden text-right text-sm text-foreground lg:block">
                  {formatPrice(data?.price)}
                </span>
                <span className={`tabular hidden text-right text-sm lg:block ${isUp ? "text-gain" : "text-loss"}`}>
                  {formatPercent(data?.changePct)}
                </span>
                <span className={`hidden justify-center lg:flex ${isUp ? "text-gain" : "text-loss"}`}>
                  <Sparkline seed={index + 2} width={80} height={26} />
                </span>
                <span className="tabular hidden text-right text-sm text-foreground/70 lg:block">
                  {formatVolume(data?.quoteVolume)}
                </span>

                <Link
                  to={`/trade?symbol=${coin.symbol}`}
                  className="hidden rounded-full border border-line px-4 py-1.5 text-xs text-foreground/70 transition-colors hover:border-foreground hover:text-foreground lg:block"
                >
                  Trade
                </Link>
              </li>
            );
          })}
        </ul>

        {rows.length === 0 && (
          <p className="px-5 py-14 text-center text-sm text-foreground/45">
            No market matches “{query}”. Orbit lists {markets.data?.markets.length ?? 0} pairs.
          </p>
        )}

        {pageCount > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
            <p className="tabular text-xs text-foreground/40">
              {(current - 1) * PER_PAGE + 1}–{Math.min(current * PER_PAGE, rows.length)} of{" "}
              {rows.length}
            </p>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(current - 1)}
                disabled={current === 1}
                className="rounded-full border border-line px-3.5 py-1.5 text-xs text-foreground/70 transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line"
              >
                Previous
              </button>

              {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                <button
                  key={number}
                  type="button"
                  onClick={() => setPage(number)}
                  aria-current={number === current ? "page" : undefined}
                  className={`tabular size-8 rounded-full text-xs transition-colors ${
                    number === current
                      ? "bg-brand font-semibold text-ink"
                      : "text-foreground/55 hover:text-foreground"
                  }`}
                >
                  {number}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setPage(current + 1)}
                disabled={current === pageCount}
                className="rounded-full border border-line px-3.5 py-1.5 text-xs text-foreground/70 transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
