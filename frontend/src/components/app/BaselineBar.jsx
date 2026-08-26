import { formatUsd } from "@/lib/format";

/**
 * Orbit's one fixed reference point: every account starts at exactly $100,000,
 * so "am I above or below the line?" is answerable at a glance in a way it
 * never is on a real brokerage account. The marker sits at the start value and
 * the bar fills from it — right in teal when ahead, left in red when behind.
 */
export default function BaselineBar({ value, baseline, ceiling = baseline * 1.6 }) {
  const clamp = (input) => Math.max(0, Math.min(100, input));
  const basePct = clamp((baseline / ceiling) * 100);
  const valuePct = clamp((value / ceiling) * 100);
  const ahead = value >= baseline;

  const left = ahead ? basePct : valuePct;
  const width = Math.abs(valuePct - basePct);
  const delta = value - baseline;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-xs text-foreground/45">Against your $100,000 start</p>
        <p className={`tabular text-sm font-medium ${ahead ? "text-gain" : "text-loss"}`}>
          {ahead ? "+" : "−"}
          {formatUsd(Math.abs(delta)).slice(1)}
        </p>
      </div>

      <div className="relative mt-3 h-2 rounded-full bg-foreground/5">
        <span
          className={`absolute inset-y-0 rounded-full ${ahead ? "bg-gain" : "bg-loss"}`}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        <span
          className="absolute -top-1 h-4 w-px bg-foreground/60"
          style={{ left: `${basePct}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-foreground/30">
        <span>$0</span>
        <span className="tabular">start {formatUsd(baseline)}</span>
        <span className="tabular">{formatUsd(ceiling)}</span>
      </div>
    </div>
  );
}
