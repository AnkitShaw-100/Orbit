import { useState } from "react";
import { Link } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import CoinIcon from "./CoinIcon";
import Sparkline from "./Sparkline";
import { formatPercent, formatPrice, formatVolume } from "@/lib/format";
import { coinMeta } from "@/lib/markets";

const FILTERS = ["All", "BTC", "ETH", "USD", "EUR"];
const EASE = [0.22, 1, 0.36, 1];

export default function MarketsTable({ tickers }) {
  const [filter, setFilter] = useState("All");
  const reduceMotion = useReducedMotion();

  // The six busiest markets, ranked by the live volume already streaming in —
  // the landing page shows a taste, not the full list.
  const top = Object.entries(tickers)
    .sort(([, a], [, b]) => (b.quoteVolume ?? 0) - (a.quoteVolume ?? 0))
    .slice(0, 6)
    .map(([symbol]) => coinMeta(symbol));

  // Every pair Orbit trades is quoted in USDT, so the other filters have
  // nothing to show rather than inventing rows.
  const rows = filter === "All" || filter === "USD" ? top : [];

  const rowMotion = (index) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.4 },
    transition: { duration: 0.5, delay: index * 0.07, ease: EASE },
  });

  return (
    <section className="section">
      <div className="shell rounded-[26px] bg-white px-5 py-10 sm:px-8 sm:py-12 lg:px-12">
        <motion.header
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="flex flex-wrap items-center justify-between gap-5"
        >
          <h2 className="h2-section text-ink">
            Markets
          </h2>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors sm:px-5 sm:py-2 sm:text-[13px] ${
                  filter === option
                    ? "border-ink bg-ink text-white"
                    : "border-ink/15 text-ink hover:border-ink/40"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </motion.header>

        {/* Stacked cards below lg — a five-column table can't be read on a
            phone, and sideways scrolling hides the columns that matter. */}
        <ul className="mt-8 lg:hidden">
          {rows.map((coin, index) => {
            const data = tickers[coin.symbol];
            const isUp = (data?.changePct ?? 0) >= 0;

            return (
              <motion.li
                key={coin.symbol}
                {...rowMotion(index)}
                className="flex items-center gap-3 border-t border-ink/10 py-4"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-white">
                  <CoinIcon symbol={coin.symbol} />
                </span>

                <div className="min-w-0 flex-1 leading-tight">
                  <p className="text-sm text-ink">
                    {coin.ticker}
                    <span className="text-ink/35">/USDT</span>
                  </p>
                  <p className="text-xs text-ink/45">
                    {formatVolume(data?.quoteVolume)} USDT
                  </p>
                </div>

                <div className={`shrink-0 ${isUp ? "text-gain" : "text-loss"}`}>
                  <Sparkline seed={index + 2} width={56} height={22} />
                </div>

                <div className="shrink-0 text-right leading-tight">
                  <p className="tabular text-sm text-ink">{formatPrice(data?.price)}</p>
                  <p className={`tabular text-xs ${isUp ? "text-gain" : "text-loss"}`}>
                    {formatPercent(data?.changePct)}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ul>

        <div className="mt-10 hidden lg:block">
          <table className="w-full border-collapse text-left">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[18%]" />
              <col className="w-[15%]" />
              <col className="w-[17%]" />
              <col className="w-[20%]" />
            </colgroup>

            <thead>
              <tr className="text-[13px] text-ink/45">
                <th className="pb-4 font-normal">Name</th>
                <th className="pb-4 text-right font-normal">Last Price</th>
                <th className="pb-4 text-right font-normal">24h Change</th>
                <th className="pb-4 text-center font-normal">Trend</th>
                <th className="pb-4 text-right font-normal">24h Volume</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((coin, index) => {
                const data = tickers[coin.symbol];
                const isUp = (data?.changePct ?? 0) >= 0;

                return (
                  <motion.tr key={coin.symbol} {...rowMotion(index)} className="border-t border-ink/10">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-white">
                          <CoinIcon symbol={coin.symbol} />
                        </span>
                        <div className="leading-tight">
                          <p className="text-[15px] text-ink">
                            {coin.ticker}
                            <span className="text-ink/35">/USDT</span>
                          </p>
                          <p className="text-xs text-ink/45">{coin.name}</p>
                        </div>
                      </div>
                    </td>

                    <td className="tabular py-4 text-right text-[15px] leading-tight text-ink">
                      {formatPrice(data?.price)}
                    </td>

                    <td
                      className={`tabular py-4 text-right text-[15px] leading-tight ${
                        isUp ? "text-gain" : "text-loss"
                      }`}
                    >
                      {formatPercent(data?.changePct)}
                    </td>

                    <td className="py-4">
                      <div className={`flex justify-center ${isUp ? "text-gain" : "text-loss"}`}>
                        <Sparkline seed={index + 2} />
                      </div>
                    </td>

                    <td className="py-4 text-right leading-tight">
                      <p className="tabular text-[15px] text-ink">
                        {formatVolume(data?.quoteVolume)} USDT
                      </p>
                      <p className="text-xs text-ink/40">Rolling 24h</p>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <p className="border-t border-ink/10 py-12 text-center text-sm text-ink/45">
            Orbit quotes every pair in USDT. Other quote currencies arrive with
            Phase 2.
          </p>
        )}

        <div className="mt-10 flex justify-center">
          <Link
            to="/markets"
            className="rounded-full border border-ink/20 px-8 py-3 text-sm font-medium text-ink transition-colors hover:border-ink"
          >
            See more
          </Link>
        </div>
      </div>
    </section>
  );
}
