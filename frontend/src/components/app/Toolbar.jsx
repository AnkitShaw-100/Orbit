import { Search } from "lucide-react";

/**
 * The controls that sit above a table: a search field, a group of filter
 * chips, and a live indicator. Markets and Transactions both open with this
 * row, so it lives here rather than being typed twice with small differences.
 */
export function Toolbar({ children }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

export function SearchField({ value, onChange, label, placeholder, className = "sm:max-w-sm" }) {
  return (
    <label className={`relative min-w-0 flex-1 ${className}`}>
      <span className="sr-only">{label}</span>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint"
        aria-hidden="true"
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-line bg-panel py-2.5 pr-4 pl-10 text-sm text-foreground transition-colors placeholder:text-faint focus:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      />
    </label>
  );
}

/**
 * A row of mutually exclusive filters. A radiogroup rather than buttons: only
 * one can be on, and a screen reader should say which.
 */
export function ChipGroup({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {options.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              active
                ? "border-brand bg-brand text-ink"
                : "border-line text-muted-foreground hover:border-brand/50 hover:text-brand"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Whether the price socket is connected, in the same words on every page. */
export function LiveDot({ status, labels = ["Live", "Reconnecting"] }) {
  const live = status === "live";

  return (
    <span className="flex items-center gap-1.5 text-[11px] text-faint">
      <span
        className={`size-1.5 rounded-full ${live ? "animate-pulse bg-gain" : "bg-foreground/30"}`}
      />
      {live ? labels[0] : labels[1]}
    </span>
  );
}
