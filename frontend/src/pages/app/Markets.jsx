import { useMemo, useState } from "react";
import { Link } from "react-router";
import CoinCell from "@/components/app/CoinCell";
import Pagination from "@/components/app/Pagination";
import { Panel } from "@/components/app/Panel";
import { PAGE_SIZE, pageOf } from "@/lib/paging";
import { ChipGroup, LiveDot, SearchField, Toolbar } from "@/components/app/Toolbar";
import Sparkline from "@/components/landing/Sparkline";
import { formatPercent, formatPrice, formatVolume, signedPercent } from "@/lib/format";
import { coinMeta } from "@/lib/markets";
import { useMarkets } from "@/hooks/useOrbit";
import { useOrbitPrices } from "@/hooks/useOrbitPrices";

const SORTS = [
  { value: "volume", label: "Volume" },
  { value: "gainers", label: "Gainers" },
  { value: "losers", label: "Losers" },
];

/** The row grid, written once so the header and the rows cannot drift apart. */
const GRID = "lg:grid-cols-[1.7fr_1fr_1fr_5.5rem_1fr_5rem]";

export default function Markets() {
  const { data: tickers, status } = useOrbitPrices();
  const markets = useMarkets();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("volume");
  const [page, setPage] = useState(1);

  const listed = useMemo(
    () => (markets.data?.markets ?? []).map((row) => coinMeta(row.symbol)),
    [markets.data],
  );

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
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
  }, [query, sort, tickers, listed]);

  /**
   * How the whole board is doing, not just the rows on this page. Read from
   * every listed market rather than the filtered set — a search for "btc"
   * shouldn't make it look as though the market only has one coin in it.
   */
  const board = useMemo(() => {
    // Paired with the coin rather than reduced over the ticks alone: a tick
    // carries a price but not the symbol it belongs to, so the identity has to
    // come from the listing beside it.
    const priced = listed
      .map((coin) => ({ coin, tick: tickers[coin.symbol] }))
      .filter((row) => row.tick);

    const best = (a, b) => ((b.tick.changePct ?? 0) > (a.tick.changePct ?? 0) ? b : a);
    const worst = (a, b) => ((b.tick.changePct ?? 0) < (a.tick.changePct ?? 0) ? b : a);

    return {
      leader: priced.length ? priced.reduce(best) : null,
      laggard: priced.length ? priced.reduce(worst) : null,
    };
  }, [listed, tickers]);

  const { count: pageCount, current } = pageOf(page, rows.length);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Toolbar>
        <SearchField
          label="Search markets"
          placeholder="Search a coin"
          value={query}
          onChange={(next) => {
            setQuery(next);
            setPage(1);
          }}
        />

        <ChipGroup
          label="Sort markets"
          options={SORTS}
          value={sort}
          onChange={(next) => {
            setSort(next);
            setPage(1);
          }}
        />

        <span className="ml-auto hidden sm:flex">
          <LiveDot status={status} labels={["Live prices", "Reconnecting"]} />
        </span>
      </Toolbar>

      <Panel
        title="All markets"
        bodyClassName="p-0"
        action={
          board.leader && (
            <p className="hidden text-xs text-muted-foreground sm:block">
              Leading <span className="text-foreground">{board.leader.coin.ticker}</span>{" "}
              <span className="text-gain">{signedPercent(board.leader.tick.changePct)}</span>
              <span className="mx-2 text-faint">·</span>
              Lagging <span className="text-foreground">{board.laggard.coin.ticker}</span>{" "}
              <span className="text-loss">{signedPercent(board.laggard.tick.changePct)}</span>
            </p>
          )
        }
      >
        <div
          className={`hidden gap-4 border-b border-line px-5 py-3 text-xs text-faint sm:px-6 lg:grid ${GRID}`}
        >
          <span>Market</span>
          <span className="text-right">Last price</span>
          <span className="text-right">24h change</span>
          <span className="text-center">Trend</span>
          <span className="text-right">24h volume</span>
          <span />
        </div>

        <ul>
          {visible.map((coin, index) => {
            const data = tickers[coin.symbol];
            const isUp = (data?.changePct ?? 0) >= 0;

            return (
              <li
                key={coin.symbol}
                className={`group grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-5 py-3.5 transition-colors last:border-b-0 hover:bg-foreground/2 sm:px-6 ${GRID}`}
              >
                <CoinCell symbol={coin.symbol} />

                <div className="text-right leading-tight lg:hidden">
                  <p className="tabular text-sm text-foreground">{formatPrice(data?.price)}</p>
                  <p className={`tabular text-xs ${isUp ? "text-gain" : "text-loss"}`}>
                    {formatPercent(data?.changePct)}
                  </p>
                </div>

                <span className="tabular hidden text-right text-sm text-foreground lg:block">
                  {formatPrice(data?.price)}
                </span>
                <span
                  className={`tabular hidden text-right text-sm lg:block ${isUp ? "text-gain" : "text-loss"}`}
                >
                  {formatPercent(data?.changePct)}
                </span>
                <span className={`hidden justify-center lg:flex ${isUp ? "text-gain" : "text-loss"}`}>
                  <Sparkline seed={index + 2} width={72} height={24} />
                </span>
                <span className="tabular hidden text-right text-sm text-muted-foreground lg:block">
                  {formatVolume(data?.quoteVolume)}
                </span>

                {/* Quiet until the row is under the cursor: a hundred bright
                    buttons down a table is a wall, not an invitation. */}
                <Link
                  to={`/trade?symbol=${coin.symbol}`}
                  className="hidden rounded-full border border-line px-4 py-1.5 text-center text-xs text-muted-foreground transition-colors group-hover:border-brand/50 group-hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none lg:block"
                >
                  Trade
                </Link>
              </li>
            );
          })}
        </ul>

        {rows.length === 0 && (
          <div className="px-5 py-16 text-center">
            <p className="text-sm text-foreground">No market matches “{query}”</p>
            <p className="mx-auto mt-1.5 max-w-[46ch] text-xs leading-relaxed text-muted-foreground">
              Orbit lists the {listed.length} busiest USDT pairs. Try a ticker like BTC, or the
              coin's full name.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setPage(1);
              }}
              className="mt-5 rounded-full border border-line px-5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              Clear search
            </button>
          </div>
        )}

        <Pagination
          page={current}
          pageCount={pageCount}
          total={rows.length}
          onChange={setPage}
        />
      </Panel>
    </div>
  );
}
