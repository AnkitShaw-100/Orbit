import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, MoreHorizontal } from "lucide-react";
import { formatPercent, formatPrice } from "@/lib/format";

/**
 * The hero's signature element: a real, ticking market price.
 * Flashes on change so the page is visibly alive without any extra motion.
 */
export default function PriceCard({ symbol, name, ticker, status }) {
  const [flash, setFlash] = useState(null);
  const lastPrice = useRef(null);

  useEffect(() => {
    if (ticker?.price == null) return;
    if (lastPrice.current != null && ticker.price !== lastPrice.current) {
      setFlash(ticker.price > lastPrice.current ? "up" : "down");
      const timer = setTimeout(() => setFlash(null), 550);
      lastPrice.current = ticker.price;
      return () => clearTimeout(timer);
    }
    lastPrice.current = ticker.price;
  }, [ticker?.price]);

  const isUp = (ticker?.changePct ?? 0) >= 0;
  const Arrow = isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="w-[248px] rounded-[26px] bg-ink p-5 text-white shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
      <header className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-white/60">{name}</span>
        <MoreHorizontal className="size-4 text-white/40" aria-hidden="true" />
      </header>

      <p
        className={`tabular mt-4 font-display text-[27px] font-bold tracking-tight transition-colors duration-500 ${
          flash === "up" ? "text-gain" : flash === "down" ? "text-loss" : "text-white"
        }`}
      >
        ${formatPrice(ticker?.price)}
      </p>

      <p
        className={`tabular mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          isUp ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
        }`}
      >
        <Arrow className="size-3" aria-hidden="true" />
        {formatPercent(ticker?.changePct)}
      </p>

      <div className="mt-5 flex gap-1.5">
        {["Buy", "Sell", "Chart"].map((label) => (
          <span
            key={label}
            className="flex-1 rounded-full bg-white/10 py-1.5 text-center text-[11px] font-medium text-white/80"
          >
            {label}
          </span>
        ))}
      </div>

      <footer className="mt-4 flex items-center gap-1.5 border-t border-white/10 pt-3">
        <span
          className={`size-1.5 rounded-full ${status === "live" ? "animate-pulse bg-gain" : "bg-white/30"}`}
          aria-hidden="true"
        />
        <span className="text-[11px] text-white/50">
          {status === "live" ? `${symbol} · live` : "Reconnecting"}
        </span>
      </footer>
    </div>
  );
}
