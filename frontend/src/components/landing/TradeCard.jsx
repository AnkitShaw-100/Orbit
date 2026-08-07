import { ArrowDown } from "lucide-react";
import { formatPrice, formatUsd } from "@/lib/format";

const STARTING_CASH = 100000;
const DEMO_SPEND = 2500;

/**
 * A non-interactive preview of Orbit's buy panel, priced off the live feed so
 * the quantity it shows is what this trade would actually fill at right now.
 */
export default function TradeCard({ ticker }) {
  const price = ticker?.price;
  const quantity = price ? DEMO_SPEND / price : null;

  return (
    <div className="w-[268px] rounded-[26px] bg-white p-5 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.35)]">
      <header className="flex items-center justify-between">
        <span className="font-display text-sm font-bold tracking-tight text-ink">Buy</span>
        <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink/50">
          Market
        </span>
      </header>

      <div className="mt-4 rounded-2xl bg-mist p-3.5">
        <span className="text-[11px] text-ink/50">Spend</span>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="tabular font-display text-lg font-bold text-ink">
            {formatUsd(DEMO_SPEND)}
          </span>
          <span className="text-[11px] font-medium text-ink/60">Cash</span>
        </div>
        <span className="tabular mt-1 block text-[10px] text-ink/40">
          Balance {formatUsd(STARTING_CASH)}
        </span>
      </div>

      <div className="relative flex justify-center">
        <span className="absolute -top-2.5 grid size-6 place-items-center rounded-full bg-ink text-white ring-4 ring-white">
          <ArrowDown className="size-3" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-2 rounded-2xl bg-mist p-3.5">
        <span className="text-[11px] text-ink/50">Receive</span>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="tabular font-display text-lg font-bold text-ink">
            {quantity ? quantity.toFixed(5) : "—"}
          </span>
          <span className="text-[11px] font-medium text-ink/60">BTC</span>
        </div>
        <span className="tabular mt-1 block text-[10px] text-ink/40">
          1 BTC = ${formatPrice(price)}
        </span>
      </div>

      <div className="mt-4 w-full rounded-full bg-ink py-2.5 text-center text-xs font-semibold text-white">
        Place order
      </div>
    </div>
  );
}
