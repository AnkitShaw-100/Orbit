import CoinIcon from "@/components/landing/CoinIcon";
import { coinMeta } from "@/lib/markets";

/**
 * How a market identifies itself in every list Orbit renders.
 *
 * The logo, the ticker against its quote currency, and the coin's full name
 * underneath. Every table on the signed-in side leads with this cell, so a row
 * on the dashboard, the markets list and the transaction ledger all start the
 * same way and the eye learns one shape instead of four.
 */
export default function CoinCell({ symbol, size = "md", badge, sub }) {
  const meta = coinMeta(symbol);
  const chip = size === "sm" ? "size-7" : "size-9";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={`grid ${chip} shrink-0 place-items-center rounded-full bg-foreground/10 text-foreground`}
      >
        <CoinIcon symbol={meta.symbol} className={size === "sm" ? "size-4" : undefined} />
      </span>

      <div className="min-w-0 leading-tight">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <span className="truncate">
            {meta.ticker}
            <span className="text-faint">/USDT</span>
          </span>
          {badge}
        </p>
        <p className="truncate text-xs text-faint">{sub ?? meta.name}</p>
      </div>
    </div>
  );
}

/** The short/long marker a position carries next to its ticker. */
export function SideBadge({ side }) {
  const isShort = side === "SHORT" || side === "SELL";

  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${
        isShort ? "bg-loss/20 text-loss" : "bg-gain/20 text-gain"
      }`}
    >
      {side}
    </span>
  );
}
