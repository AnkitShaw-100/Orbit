import { useEffect, useState } from "react";
import CandleChart from "./CandleChart";
import { orbit } from "@/lib/api";
import { formatPrice } from "@/lib/format";

const RANGES = [
  { label: "1H", interval: "1m", limit: 60 },
  { label: "3H", interval: "5m", limit: 36 },
  { label: "1D", interval: "1h", limit: 24 },
  { label: "1W", interval: "4h", limit: 42 },
  { label: "1M", interval: "1d", limit: 30 },
];

export default function SeamlessAccess({ ticker }) {
  const price = ticker?.price;
  const change = ticker?.changePct;
  const [range, setRange] = useState("3H");
  const [candles, setCandles] = useState([]);

  // Real Binance candles through the Orbit API — the landing page shows the
  // actual product, not a mock of it.
  useEffect(() => {
    let cancelled = false;
    const option = RANGES.find((item) => item.label === range) ?? RANGES[1];

    orbit
      .klines("BTCUSDT", option.interval, option.limit)
      .then((result) => {
        if (!cancelled) setCandles(result.candles);
      })
      .catch(() => {
        if (!cancelled) setCandles([]);
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  // Phones keep only the two stats you'd actually glance at. High, Low and
  // Volume wrap onto extra rows there and add height without adding meaning.
  const stats = [
    { label: "Last price", value: price ? formatPrice(price) : "—", always: true },
    { label: "Change", value: change != null ? `${change.toFixed(2)}%` : "—", always: true },
    { label: "High", value: price ? formatPrice(price * 1.031) : "—" },
    { label: "Low", value: price ? formatPrice(price * 0.973) : "—" },
    { label: "Volume", value: "6 475 384.12 USD" },
  ];

  return (
    <section className="section">
      <div className="shell grid overflow-hidden rounded-[26px] lg:grid-cols-[minmax(0,40%)_1fr]">
        {/* The panel beside this one is dense with figures, and a column of
            grey sentences cannot hold its own against that. So this half
            speaks the same language: ruled rows at the same rhythm as the
            mock's own stat header, and a numeric foot that rhymes with it
            outright — faint label over a tabular value, the same anatomy. */}
        <div className="brand-wash relative flex flex-col border-b border-line px-6 py-10 sm:px-12 sm:py-14 lg:border-r lg:border-b-0 lg:py-16">
          <h2 className="h2-section relative max-w-[15ch] text-foreground">
            The whole desk, in a browser tab
          </h2>
          <p className="relative mt-5 max-w-[36ch] text-[15px] leading-relaxed text-muted-foreground">
            Nothing to install, nothing to fund. Sign in and the market is
            already moving.
          </p>

          {/* Names the three panes in the mock, in the order they appear there,
              so the column reads as a legend for the screenshot rather than a
              second block of prose. */}
          <dl className="relative mt-9 border-t border-line">
            {[
              ["Chart", "Binance candles, live, with your entry drawn across them."],
              ["Order ticket", "Fills at the price the exchange is quoting."],
              ["Open positions", "Live profit and loss, and a one-click exit."],
            ].map(([term, detail]) => (
              <div key={term} className="border-b border-line py-4">
                <dt className="text-sm font-semibold text-foreground">{term}</dt>
                <dd className="mt-1 max-w-[34ch] text-[13px] leading-relaxed text-muted-foreground">
                  {detail}
                </dd>
              </div>
            ))}
          </dl>

          {/* The whole pitch, stated as three figures. Every one is literally
              true, and together they answer the only question a newcomer
              actually has about a trading product — what it will cost them. */}
          <div className="relative mt-auto grid grid-cols-3 gap-6 pt-10">
            {[
              ["Starting balance", "$100,000.00"],
              ["Commission", "$0.00"],
              ["Minimum deposit", "$0.00"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[10px] text-faint">{label}</p>
                <p className="tabular mt-1 font-display text-base font-bold tracking-[-0.02em] text-foreground">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex bg-void p-3 sm:p-7">
          {/* Fills the column so the card's height matches the gradient panel
              instead of leaving mist showing beneath it. */}
          <div className="flex w-full flex-col rounded-2xl border border-line bg-panel p-3.5 sm:p-5">
            <header className="flex flex-wrap items-center gap-x-5 gap-y-2.5 sm:gap-x-8 sm:gap-y-3">
              <span className="rounded-full border border-line bg-panel-2 px-3 py-1.5 text-xs font-semibold text-foreground">
                BTC/USDT
              </span>
              {stats.map(({ label, value, always }) => (
                <div key={label} className={always ? "" : "hidden sm:block"}>
                  <p className="text-[10px] text-faint">{label}</p>
                  <p className="tabular text-xs font-medium text-foreground">{value}</p>
                </div>
              ))}
            </header>

            <div className="mt-6 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold tracking-tight text-foreground">Performance</h3>
              <div className="flex gap-1">
                {RANGES.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setRange(option.label)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      range === option.label ? "bg-brand text-ink" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* The chart absorbs the leftover height rather than the card
                ending short of the panel. */}
            <div className="mt-4 min-h-48 flex-1 rounded-xl border border-line p-2">
              <CandleChart data={candles} theme="dark" livePrice={price} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-panel-2 p-4">
                <div className="flex gap-2">
                  <span className="rounded-lg bg-gain px-3 py-1.5 text-xs font-semibold text-on-gain">
                    Buy BTC
                  </span>
                  <span className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    Sell BTC
                  </span>
                </div>

                <dl className="mt-3.5 space-y-2">
                  {[
                    ["Price", price ? `${formatPrice(price)} USD` : "—"],
                    ["Total", "50 000.00 USD"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-faint">{label}</dt>
                      <dd className="tabular text-xs font-medium text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="rounded-xl border border-line bg-panel-2 p-4">
                <p className="text-xs font-semibold text-foreground">Open positions</p>
                <ul className="mt-3 space-y-2">
                  {[
                    ["BTC", "0.7821", "+4.10%"],
                    ["ETH", "12.400", "−1.22%"],
                    ["SOL", "180.00", "+0.86%"],
                  ].map(([symbol, qty, pnl]) => (
                    <li key={symbol} className="flex items-center justify-between gap-3">
                      <span className="w-10 shrink-0 text-xs font-medium text-foreground">{symbol}</span>
                      <span className="tabular flex-1 text-right text-xs text-muted-foreground">{qty}</span>
                      <span
                        className={`tabular w-16 shrink-0 text-right text-xs font-medium ${
                          pnl.startsWith("+") ? "text-gain" : "text-loss"
                        }`}
                      >
                        {pnl}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
