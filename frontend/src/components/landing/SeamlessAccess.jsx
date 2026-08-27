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
        <div className="bg-gradient-to-br from-grad-lilac via-[#C7D2FE] to-[#BFE3E0] px-6 py-10 sm:px-12 sm:py-14 lg:py-20">
          <h2 className="h2-section max-w-[15ch] text-ink">
            The whole desk, in a browser tab
          </h2>
          <p className="mt-5 max-w-[38ch] text-[15px] leading-relaxed text-ink/65 sm:mt-6">
            Chart, order ticket and open positions on one screen. Nothing to
            install, nothing to fund — sign in and the market is already moving.
          </p>
        </div>

        <div className="flex bg-mist p-3 sm:p-7">
          {/* Fills the column so the card's height matches the gradient panel
              instead of leaving mist showing beneath it. */}
          <div className="flex w-full flex-col rounded-2xl bg-white p-3.5 sm:p-5">
            <header className="flex flex-wrap items-center gap-x-5 gap-y-2.5 sm:gap-x-8 sm:gap-y-3">
              <span className="rounded-full bg-mist px-3 py-1.5 text-xs font-semibold text-ink">
                BTC/USDT
              </span>
              {stats.map(({ label, value, always }) => (
                <div key={label} className={always ? "" : "hidden sm:block"}>
                  <p className="text-[10px] text-ink/60">{label}</p>
                  <p className="tabular text-xs font-medium text-ink">{value}</p>
                </div>
              ))}
            </header>

            <div className="mt-6 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold tracking-tight text-ink">Performance</h3>
              <div className="flex gap-1">
                {RANGES.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setRange(option.label)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      range === option.label ? "bg-ink text-white" : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* The chart absorbs the leftover height rather than the card
                ending short of the panel. */}
            <div className="mt-4 min-h-48 flex-1 rounded-xl border border-ink/10 p-2">
              <CandleChart data={candles} livePrice={price} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-mist p-4">
                <div className="flex gap-2">
                  <span className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white">
                    Buy BTC
                  </span>
                  <span className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink">
                    Sell BTC
                  </span>
                </div>

                <dl className="mt-3.5 space-y-2">
                  {[
                    ["Price", price ? `${formatPrice(price)} USD` : "—"],
                    ["Total", "50 000.00 USD"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-ink/55">{label}</dt>
                      <dd className="tabular text-xs font-medium text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="rounded-xl bg-mist p-4">
                <p className="text-xs font-semibold text-ink">Open positions</p>
                <ul className="mt-3 space-y-2">
                  {[
                    ["BTC", "0.7821", "+4.10%"],
                    ["ETH", "12.400", "−1.22%"],
                    ["SOL", "180.00", "+0.86%"],
                  ].map(([symbol, qty, pnl]) => (
                    <li key={symbol} className="flex items-center justify-between gap-3">
                      <span className="w-10 shrink-0 text-xs font-medium text-ink">{symbol}</span>
                      <span className="tabular flex-1 text-right text-xs text-ink/70">{qty}</span>
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
