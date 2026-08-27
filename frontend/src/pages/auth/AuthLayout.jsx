import { Link } from "react-router";

/**
 * Auth sits on the marketing side of the wall, so it keeps the landing page's
 * black shell and single pastel panel rather than the terminal greys.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen bg-void lg:grid-cols-[1fr_minmax(0,42%)]">
      <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
        <Link to="/" className="mb-12 flex w-fit items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full border border-foreground/25">
            <span className="size-1.5 rounded-full bg-foreground" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-foreground">Orbit</span>
        </Link>

        <div className="w-full max-w-sm">
          <h1 className="font-display text-[clamp(1.9rem,3.5vw,2.6rem)] font-bold leading-[1.05] tracking-[-0.035em] text-foreground">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>

          <div className="mt-9">{children}</div>

          <p className="mt-8 text-sm text-muted-foreground">{footer}</p>
        </div>
      </div>

      <div className="brand-wash relative hidden flex-col justify-end border-l border-line p-12 lg:flex">
        <p className="relative max-w-[22ch] font-display text-3xl font-bold leading-[1.05] tracking-[-0.035em] text-foreground">
          Every account starts at exactly $100,000.
        </p>
        <p className="relative mt-4 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
          Same starting line, real market prices. What happens next is the part
          worth learning.
        </p>
      </div>
    </div>
  );
}

export function Field({ label, type = "text", name, placeholder, autoComplete, hint }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-xl border border-foreground/15 bg-foreground/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-faint focus:border-foreground/45 focus:outline-none"
      />
      {hint && <span className="mt-1.5 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}
