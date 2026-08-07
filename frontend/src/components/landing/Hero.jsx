import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import FactStrip from "./FactStrip";
import PriceCard from "./PriceCard";
import TradeCard from "./TradeCard";

export default function Hero({ tickers, status }) {
  return (
    <section className="grid lg:grid-cols-[1fr_minmax(0,46%)]">
      <div className="flex flex-col justify-between">
        <div className="px-6 pb-14 pt-8 sm:px-10 lg:pb-16 lg:pt-16 2xl:px-16">
          <h1 className="orbit-rise max-w-[13ch] font-display text-[clamp(2.6rem,6vw,4.5rem)] font-bold leading-[0.98] tracking-[-0.035em] text-white">
            Real prices. Practice money.
          </h1>

          <p
            className="orbit-rise mt-6 max-w-[46ch] text-[15px] leading-relaxed text-white/55"
            style={{ animationDelay: "80ms" }}
          >
            Orbit hands you $100,000 in virtual cash and the live crypto market.
            Learn what trading feels like before it can cost you anything.
          </p>

          <div className="orbit-rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "160ms" }}>
            <Link
              to="/signup"
              className="group inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-ink transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              Get started
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>

            <Link
              to="/markets"
              className="inline-flex items-center rounded-full border border-white/25 px-7 py-3.5 text-sm font-medium text-white/80 transition-colors hover:border-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              See the markets
            </Link>
          </div>
        </div>

        <FactStrip />
      </div>

      <div className="orbit-gradient relative min-h-100 overflow-hidden sm:min-h-120 lg:min-h-140">
        {/* Fixed-size stage so the two cards keep their overlap at every width;
            only the scale changes on small screens. */}
        <div className="absolute inset-0 grid place-items-center">
          <div className="relative h-105 w-95 scale-[0.72] sm:scale-90 lg:scale-100">
            <div className="orbit-rise absolute left-0 top-0" style={{ animationDelay: "240ms" }}>
              <TradeCard ticker={tickers.BTCUSDT} />
            </div>
            <div
              className="orbit-rise absolute left-28 top-38"
              style={{ animationDelay: "340ms" }}
            >
              <PriceCard symbol="BTCUSDT" name="Bitcoin" ticker={tickers.BTCUSDT} status={status} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
