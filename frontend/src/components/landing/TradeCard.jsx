import { ArrowDown } from "lucide-react";
import { formatPrice, formatUsd } from "@/lib/format";

const STARTING_CASH = 100000;
const DEMO_SPEND = 2500;

/**
 * A non-interactive preview of Orbit's buy ticket, priced off the live feed so
 * the quantity it shows is what this trade would actually fill at right now.
 *
 * Built from the same panel, well and hairline the signed-in ticket uses — the
 * point of showing it here is that this is the real thing, so it should not be
 * a prettier drawing of the real thing.
 */
export default function TradeCard({ ticker }) {
  const price = ticker?.price;
  const quantity = price ? DEMO_SPEND / price : null;

  return (
    <div className="w-64 rounded-2xl border border-line bg-panel-2 p-5">
      <header className="flex items-center justify-between">
        <span className="font-display text-sm font-bold tracking-tight text-foreground">Buy</span>
        <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
          Market
        </span>
      </header>

      <div className="mt-4 rounded-xl border border-line bg-void p-3.5">
        <span className="text-[11px] text-muted-foreground">Spend</span>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="tabular font-display text-lg font-bold text-foreground">
            {formatUsd(DEMO_SPEND)}
          </span>
          <span className="text-[11px] font-medium text-faint">Cash</span>
        </div>
        <span className="tabular mt-1 block text-[10px] text-faint">
          Balance {formatUsd(STARTING_CASH)}
        </span>
      </div>

      <div className="relative flex justify-center">
        <span className="absolute -top-2.5 grid size-6 place-items-center rounded-full bg-brand text-ink ring-4 ring-panel-2">
          <ArrowDown className="size-3" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-2 rounded-xl border border-line bg-void p-3.5">
        <span className="text-[11px] text-muted-foreground">Receive</span>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="tabular font-display text-lg font-bold text-foreground">
            {quantity ? quantity.toFixed(5) : "—"}
          </span>
          <span className="text-[11px] font-medium text-faint">BTC</span>
        </div>
        <span className="tabular mt-1 block text-[10px] text-faint">
          1 BTC = ${formatPrice(price)}
        </span>
      </div>

      <div className="mt-4 w-full rounded-full bg-gain py-2.5 text-center text-xs font-semibold text-on-gain">
        Place order
      </div>
    </div>
  );
}
