import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import FactStrip from "./FactStrip";
import PriceCard from "./PriceCard";
import TradeCard from "./TradeCard";

/**
 * The hero states the trade Orbit offers — a real market, unreal money — and
 * then proves it, by putting the actual buy ticket and the actual live price
 * on the page rather than a picture of them.
 *
 * No illustration and no panel behind the cards: a paper-trading terminal has
 * nothing to show that is more convincing than its own working panels, and a
 * second surface behind them only competed with the ones that matter.
 *
 * Fills the viewport the navbar leaves, so the page opens on one whole idea
 * and the tape below is the reward for the first scroll.
 */
export default function Hero({ tickers, status }) {
  return (
    <section className="flex min-h-[calc(100svh-var(--nav-h))] flex-col">
      <div className="gutter flex flex-1 items-center py-14 lg:py-16">
        <div className="shell grid w-full items-center gap-12 lg:grid-cols-[1fr_minmax(0,25rem)] lg:gap-10">
          <div>
            <p className="orbit-rise font-mono text-[11px] tracking-[0.18em] text-brand uppercase">
              Paper trading · Live Binance prices
            </p>

            <h1
              className="orbit-rise mt-6 max-w-[13ch] font-display text-[clamp(2.75rem,6.4vw,4.75rem)] leading-[0.95] font-bold tracking-[-0.04em] text-foreground"
              style={{ animationDelay: "60ms" }}
            >
              Real prices.
              <br />
              Practice money.
            </h1>

            <p
              className="orbit-rise mt-7 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground"
              style={{ animationDelay: "140ms" }}
            >
              Orbit hands you $100,000 in virtual cash and the live crypto market.
              Learn what trading feels like before it can cost you anything.
            </p>

            <div
              className="orbit-rise mt-9 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "220ms" }}
            >
              <Link
                to="/signup"
                className="group inline-flex items-center justify-center gap-1.5 rounded-full bg-brand px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-void focus-visible:outline-none"
              >
                Start with $100,000
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>

              <Link
                to="/markets"
                className="inline-flex items-center rounded-full border border-line px-7 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                Browse the markets
              </Link>
            </div>
          </div>

          {/* Fixed-size stage so the two cards keep their overlap at every
              width; only the scale changes on small screens. */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative h-105 w-95 scale-[0.72] sm:scale-90 lg:scale-100">
              <div className="orbit-rise absolute top-0 left-0" style={{ animationDelay: "300ms" }}>
                <TradeCard ticker={tickers.BTCUSDT} />
              </div>
              <div
                className="orbit-rise absolute top-38 left-28"
                style={{ animationDelay: "400ms" }}
              >
                <PriceCard
                  symbol="BTCUSDT"
                  name="Bitcoin"
                  ticker={tickers.BTCUSDT}
                  status={status}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The rule runs the full width; the cells inside it keep the page's
          gutter, so the facts line up with the headline above them. */}
      <div className="gutter border-t border-line">
        <div className="shell">
          <FactStrip />
        </div>
      </div>
    </section>
  );
}
