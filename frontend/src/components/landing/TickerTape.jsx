import CoinIcon from "./CoinIcon";
import { formatPrice } from "@/lib/format";
import { coinMeta } from "@/lib/markets";

/**
 * The tape.
 *
 * Every trading floor has one, and this one is not a prop: the prices are the
 * same WebSocket feed the signed-in terminal trades against. That is the whole
 * argument the landing page has to make — the market behind this is real, only
 * the money isn't — and a scrolling row of live numbers makes it better than a
 * sentence claiming it.
 *
 * Hovering pauses the run, because a value you just watched go past is exactly
 * the one you want to read.
 */
function Cell({ symbol, tick }) {
  const meta = coinMeta(symbol);
  const change = tick?.changePct;
  const up = (change ?? 0) >= 0;

  return (
    <div className="flex shrink-0 items-center gap-2.5 border-r border-line px-6 py-3">
      <CoinIcon symbol={symbol} className="size-4 shrink-0" />
      <span className="text-xs font-medium text-foreground">{meta.ticker}</span>
      <span className="tabular text-xs text-muted-foreground">{formatPrice(tick?.price)}</span>
      <span className={`tabular text-xs ${up ? "text-gain" : "text-loss"}`}>
        {change == null ? "—" : `${up ? "+" : "−"}${Math.abs(change).toFixed(2)}%`}
      </span>
    </div>
  );
}

export default function TickerTape({ symbols, tickers }) {
  if (!symbols.length) return null;

  return (
    <div className="tape relative overflow-hidden border-y border-line bg-panel">
      {/* The run is duplicated and the pair shifted by half its width, which is
          what makes the loop seamless. The copy is inert to assistive tech. */}
      <div className="tape-track flex w-max">
        {[0, 1].map((run) => (
          <div key={run} className="flex" aria-hidden={run === 1 ? "true" : undefined}>
            {symbols.map((symbol) => (
              <Cell key={`${run}-${symbol}`} symbol={symbol} tick={tickers[symbol]} />
            ))}
          </div>
        ))}
      </div>

      {/* Fades the tape into the page edges rather than letting rows guillotine
          at the viewport border. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-panel to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-panel to-transparent" />
    </div>
  );
}
