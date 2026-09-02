export function Panel({ title, action, children, className = "", bodyClassName = "" }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 sm:px-6">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {action}
        </header>
      )}
      <div className={`p-5 sm:p-6 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/**
 * One figure inside a banded row — the account facts a page states once and
 * does not repeat. Smaller and quieter than a StatCard: a StatCard is a tile
 * that stands alone, a Cell is a column in a band that reads left to right.
 */
export function Cell({ label, value, tone = "text-foreground", children }) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4 sm:px-6">
      <p className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">{label}</p>
      <p className={`tabular font-display text-xl font-bold tracking-[-0.03em] ${tone}`}>{value}</p>
      {children}
    </div>
  );
}

/**
 * The row of cells the summary bands use, so every page's band rhymes.
 *
 * `cols` is spelled out rather than derived from the child count because
 * Tailwind only ships the classes it can see in the source.
 */
const CELL_COLUMNS = {
  3: "sm:grid-cols-3",
  // Four abreast is too tight for a tablet, so these break two-by-two first.
  4: "grid-cols-2 lg:grid-cols-4",
};

export function CellRow({ cols = 3, children }) {
  return (
    <div
      className={`grid divide-line sm:divide-x sm:divide-y-0 ${
        cols === 4 ? "divide-x divide-y" : "divide-y"
      } ${CELL_COLUMNS[cols]}`}
    >
      {children}
    </div>
  );
}

/** The hue a tile is tinted with. Each measure keeps its colour across pages. */
const ACCENTS = {
  iris: "var(--color-iris)",
  mint: "var(--color-mint)",
  ember: "var(--color-ember)",
  sky: "var(--color-sky)",
};

/**
 * One figure, at the top of a page.
 *
 * `tone` colours the number itself and belongs to market data — a P&L figure
 * is teal or red because it is up or down. `accent` tints the whole tile and
 * belongs to the measure — orders are always iris, volume always sky —
 * which is why the two are separate props rather than one.
 */
export function StatCard({ label, value, hint, tone = "neutral", accent, icon: Icon }) {
  const toneClass =
    tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-foreground";

  const tint = ACCENTS[accent];

  return (
    <div
      style={tint ? { "--tint": tint } : undefined}
      className={`rounded-2xl border p-5 ${tint ? "tint" : "border-line bg-panel"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        {Icon && (
          <span
            // Without an accent there is no --tint to mix against, so the chip
            // has to carry its own neutral rather than inheriting a broken
            // colour from an unset variable.
            className={`grid size-10 shrink-0 place-items-center rounded-xl ${
              tint ? "tint-chip" : "bg-foreground/8 text-muted-foreground"
            }`}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
      </div>

      <p className={`tabular mt-3 font-display text-2xl font-bold tracking-[-0.03em] ${toneClass}`}>
        {value}
      </p>
      {hint && <p className="tabular mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}
