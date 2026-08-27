import { useMemo } from "react";
import { Flame, TrendingDown, TrendingUp } from "lucide-react";
import CoinIcon from "./CoinIcon";
import { formatPrice, formatVolume } from "@/lib/format";
import { coinMeta } from "@/lib/markets";

const ROWS = 4;

/**
 * Three read-outs of the market as it stands: what is busiest, what is up
 * most, what is down most.
 *
 * Every figure is the live feed, ranked at render. Nothing here is a chosen
 * example — the columns are whatever the market is doing while you read them,
 * which is the only version of this section worth showing on a page whose
 * whole claim is that the prices are real.
 */
function Board({ title, icon: Icon, rows, metric }) {
  return (
    <div className="rounded-2xl border border-line bg-panel">
      <header className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <Icon className="size-4 text-faint" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </header>

      <ul className="px-2 py-2">
        {rows.length === 0 && (
          <li className="px-3 py-8 text-center text-xs text-faint">Waiting for prices</li>
        )}

        {rows.map(({ coin, tick }) => {
          const up = (tick.changePct ?? 0) >= 0;

          return (
            <li key={coin.symbol} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              <CoinIcon symbol={coin.symbol} className="size-7 shrink-0" />

              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-5 text-foreground">{coin.ticker}</span>
                <span className="block truncate text-[11px] leading-4 text-faint">{coin.name}</span>
              </span>

              <span className="shrink-0 text-right">
                <span className="tabular block text-xs leading-5 text-foreground">
                  {formatPrice(tick.price)}
                </span>
                <span
                  className={`tabular block text-[11px] leading-4 ${
                    metric === "volume" ? "text-faint" : up ? "text-gain" : "text-loss"
                  }`}
                >
                  {metric === "volume"
                    ? `${formatVolume(tick.quoteVolume)} vol`
                    : `${up ? "+" : "−"}${Math.abs(tick.changePct ?? 0).toFixed(2)}%`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function MarketPulse({ tickers }) {
  const boards = useMemo(() => {
    const priced = Object.entries(tickers)
      .filter(([, tick]) => tick?.price != null)
      .map(([symbol, tick]) => ({ coin: coinMeta(symbol), tick }));

    const by = (read) => [...priced].sort((a, b) => read(b.tick) - read(a.tick));

    return {
      trending: by((t) => t.quoteVolume ?? 0).slice(0, ROWS),
      gainers: by((t) => t.changePct ?? 0).slice(0, ROWS),
      losers: by((t) => -(t.changePct ?? 0)).slice(0, ROWS),
    };
  }, [tickers]);

  return (
    <section className="section" id="pulse">
      <div className="shell">
        <header className="mx-auto max-w-[52ch] text-center">
          <h2 className="h2-section text-foreground">The market, right now</h2>
          <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
            These are live Binance prices, ranked as you read them. The same feed your account
            trades against — the market is real, only the money isn't.
          </p>
        </header>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <Board title="Most traded" icon={Flame} rows={boards.trending} metric="volume" />
          <Board title="Top gainers" icon={TrendingUp} rows={boards.gainers} />
          <Board title="Top losers" icon={TrendingDown} rows={boards.losers} />
        </div>
      </div>
    </section>
  );
}
