import { useEffect, useState } from "react";
import { Link } from "react-router";
import AuthLink from "@/components/auth/AuthLink";
import { ArrowRight } from "lucide-react";
import CandleChart from "./CandleChart";
import FactStrip from "./FactStrip";
import { orbit } from "@/lib/api";
import { formatPercent, formatPrice, formatVolume } from "@/lib/format";

/**
 * The hero states the trade Orbit offers — a real market, unreal money — and
 * then proves it underneath, with a live BTC chart flanked by the app's own
 * buy ticket and price card.
 *
 * Centred rather than split: the claim is short enough to read in one line of
 * sight, and centring lets the evidence below run the full width instead of
 * being squeezed into a column beside the words.
 */
export default function Hero({ tickers, status }) {
  const [candles, setCandles] = useState([]);
  const ticker = tickers.BTCUSDT;
  const price = ticker?.price;
  const up = (ticker?.changePct ?? 0) >= 0;

  // One quiet request for the backdrop chart. It is illustration rather than a
  // trading surface, so it does not poll — the live price keeps the newest
  // candle honest on its own.
  useEffect(() => {
    let cancelled = false;
    orbit
      .klines("BTCUSDT", "1h", 120)
      .then((result) => !cancelled && setCandles(result.candles))
      .catch(() => !cancelled && setCandles([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    { label: "Last price", value: formatPrice(price) },
    { label: "24h change", value: formatPercent(ticker?.changePct), tone: true },
    { label: "24h volume", value: formatVolume(ticker?.quoteVolume) },
  ];

  return (
    <section className="flex min-h-[calc(100svh-var(--nav-h))] flex-col">
      <div className="gutter flex flex-1 flex-col justify-center py-14 lg:pt-16 lg:pb-20">
        <div className="shell w-full">
          <div className="mx-auto max-w-[46rem] text-center">
            <p className="orbit-rise font-mono text-[11px] tracking-[0.18em] text-brand uppercase">
              Paper trading · Live Binance prices
            </p>

            <h1
              className="orbit-rise mt-6 font-display text-[clamp(2.5rem,5.6vw,4.25rem)] leading-[0.98] font-bold tracking-[-0.04em] text-foreground"
              style={{ animationDelay: "60ms" }}
            >
              Trade the real market
              <br />
              with practice money
            </h1>

            <p
              className="orbit-rise mx-auto mt-6 max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground"
              style={{ animationDelay: "140ms" }}
            >
              Orbit hands you $100,000 in virtual cash and the live crypto market. Learn what
              trading feels like before it can cost you anything.
            </p>

            <div
              className="orbit-rise mt-9 flex flex-wrap items-center justify-center gap-3"
              style={{ animationDelay: "220ms" }}
            >
              <AuthLink
                to="/signup"
                className="group inline-flex items-center justify-center gap-1.5 rounded-full bg-brand px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-void focus-visible:outline-none"
              >
                Start with $100,000
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </AuthLink>

              <Link
                to="/markets"
                className="inline-flex items-center rounded-full border border-line px-7 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                Browse the markets
              </Link>
            </div>
          </div>

          {/* The evidence: a live BTC chart on the same feed the signed-in
              terminal trades against, running the full width of the shell. */}
          <div
            className="orbit-rise mt-14 rounded-2xl border border-line bg-panel"
            style={{ animationDelay: "300ms" }}
          >
            <header className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line px-5 py-4 sm:px-6">
              <span className="rounded-full border border-line bg-panel-2 px-3 py-1.5 text-xs font-semibold text-foreground">
                BTC/USDT
              </span>

              {stats.map(({ label, value, tone }) => (
                <div key={label} className="leading-tight">
                  <p className="font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
                    {label}
                  </p>
                  <p
                    className={`tabular text-sm font-medium ${
                      tone ? (up ? "text-gain" : "text-loss") : "text-foreground"
                    }`}
                  >
                    {value}
                  </p>
                </div>
              ))}

              <span className="ml-auto flex items-center gap-1.5 text-[11px] text-faint">
                <span
                  className={`size-1.5 rounded-full ${
                    status === "live" ? "animate-pulse bg-gain" : "bg-foreground/30"
                  }`}
                />
                {status === "live" ? "Live" : "Reconnecting"}
              </span>
            </header>

            <div className="h-72 p-4 sm:h-96 sm:p-5">
              <CandleChart data={candles} theme="dark" livePrice={price} />
            </div>
          </div>
        </div>
      </div>

      <div className="gutter border-t border-line">
        <div className="shell">
          <FactStrip />
        </div>
      </div>
    </section>
  );
}
