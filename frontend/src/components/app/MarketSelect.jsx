import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import CoinIcon from "@/components/landing/CoinIcon";
import { coinMeta } from "@/lib/markets";
import { formatPercent, formatPrice } from "@/lib/format";

const PAGE = 10;

/**
 * Market picker for every listed pair.
 *
 * A native select is unusable at this length — you cannot search it, cannot
 * see a price, and cannot tell BNB from BONK while scrolling. This
 * shows the logo, name and live price per row, filters as you type, and loads
 * ten at a time so the list never renders a hundred rows at once.
 */
export default function MarketSelect({ symbols, value, prices, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const containerRef = useRef(null);
  const selected = coinMeta(value);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    return symbols
      .map((symbol) => coinMeta(symbol))
      .filter(
        (coin) =>
          coin.ticker.toLowerCase().includes(term) || coin.name.toLowerCase().includes(term),
      );
  }, [symbols, query]);

  const visible = matches.slice(0, shown);

  const pick = (symbol) => {
    onChange(symbol);
    setOpen(false);
    setQuery("");
    setShown(PAGE);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2.5 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-foreground/30"
      >
        <CoinIcon symbol={selected.symbol} className="size-5" />
        {selected.ticker}
        <span className="font-normal text-faint">/USDT</span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-panel shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8)]">
          <div className="relative border-b border-line">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
              aria-hidden="true"
            />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShown(PAGE);
              }}
              placeholder={`Search ${symbols.length} markets`}
              className="w-full bg-transparent py-3 pl-10 pr-3 text-sm text-foreground placeholder:text-faint focus:outline-none"
            />
          </div>

          <ul role="listbox" className="scroll-thin max-h-80 overflow-y-auto">
            {visible.map((coin) => {
              const tick = prices[coin.symbol];
              const isUp = (tick?.changePct ?? 0) >= 0;

              return (
                <li key={coin.symbol}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={coin.symbol === value}
                    onClick={() => pick(coin.symbol)}
                    className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-foreground/5 ${
                      coin.symbol === value ? "bg-foreground/8" : ""
                    }`}
                  >
                    <CoinIcon symbol={coin.symbol} className="size-7" />

                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block text-sm text-foreground">{coin.ticker}</span>
                      <span className="block truncate text-[11px] text-faint">{coin.name}</span>
                    </span>

                    <span className="text-right leading-tight">
                      <span className="tabular block text-xs text-foreground">
                        {formatPrice(tick?.price)}
                      </span>
                      <span
                        className={`tabular block text-[11px] ${isUp ? "text-gain" : "text-loss"}`}
                      >
                        {formatPercent(tick?.changePct)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}

            {matches.length === 0 && (
              <li className="px-4 py-8 text-center text-xs text-muted-foreground">
                No market matches “{query}”
              </li>
            )}
          </ul>

          {shown < matches.length && (
            <button
              type="button"
              onClick={() => setShown((count) => count + PAGE)}
              className="w-full border-t border-line py-2.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Show {Math.min(PAGE, matches.length - shown)} more of {matches.length}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
