import { Link } from "react-router";
import CoinIcon from "./CoinIcon";
import { formatPercent } from "@/lib/format";
import { coinMeta } from "@/lib/markets";

/**
 * Every market Orbit carries, as one wall of chips.
 *
 * The list is not curated — it is the whole set the backend discovered by
 * ranking Binance's USDT pairs on real traded volume, which means the wall
 * grows and reorders on its own as the market does. Each chip carries its live
 * change, so the section is a list and a state of the market at once.
 */
export default function MarketWall({ tickers }) {
  const coins = Object.entries(tickers)
    .sort(([, a], [, b]) => (b.quoteVolume ?? 0) - (a.quoteVolume ?? 0))
    .map(([symbol, tick]) => ({ coin: coinMeta(symbol), tick }));

  return (
    <section className="section">
      <div className="shell">
        <header className="mx-auto max-w-[52ch] text-center">
          <h2 className="h2-section text-foreground">Everything you can trade</h2>
          <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
            {coins.length ? `All ${coins.length} markets` : "Every market"} Orbit lists, ranked by
            real traded volume. The set is discovered from Binance at start-up rather than
            hardcoded, so it reflects what people are actually trading.
          </p>
        </header>

        <ul className="mt-12 flex flex-wrap justify-center gap-2.5">
          {coins.map(({ coin, tick }) => {
            const up = (tick?.changePct ?? 0) >= 0;

            return (
              <li key={coin.symbol}>
                <Link
                  to={`/trade?symbol=${coin.symbol}`}
                  className="flex items-center gap-2.5 rounded-full border border-line bg-panel py-2 pr-4 pl-2 transition-colors hover:border-brand/40 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  <CoinIcon symbol={coin.symbol} className="size-6 shrink-0" />
                  <span className="text-sm text-foreground">{coin.ticker}</span>
                  <span
                    className={`tabular text-xs ${
                      tick?.changePct == null ? "text-faint" : up ? "text-gain" : "text-loss"
                    }`}
                  >
                    {formatPercent(tick?.changePct)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
