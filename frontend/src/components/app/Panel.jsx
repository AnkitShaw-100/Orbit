export function Panel({ title, action, children, className = "", bodyClassName = "" }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {action}
        </header>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, tone = "neutral" }) {
  const toneClass =
    tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-white";

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <p className="text-xs text-white/45">{label}</p>
      <p className={`tabular mt-2 font-display text-2xl font-bold tracking-tight ${toneClass}`}>
        {value}
      </p>
      {hint && <p className="tabular mt-1 text-xs text-white/40">{hint}</p>}
    </div>
  );
}
