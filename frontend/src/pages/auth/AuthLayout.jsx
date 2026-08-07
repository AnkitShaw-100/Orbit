import { Link } from "react-router";

/**
 * Auth sits on the marketing side of the wall, so it keeps the landing page's
 * black shell and single pastel panel rather than the terminal greys.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen bg-ink lg:grid-cols-[1fr_minmax(0,42%)]">
      <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
        <Link to="/" className="mb-12 flex w-fit items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full border border-white/25">
            <span className="size-1.5 rounded-full bg-white" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white">Orbit</span>
        </Link>

        <div className="w-full max-w-sm">
          <h1 className="font-display text-[clamp(1.9rem,3.5vw,2.6rem)] font-bold leading-[1.05] tracking-[-0.035em] text-white">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/50">{subtitle}</p>

          <div className="mt-9">{children}</div>

          <p className="mt-8 text-sm text-white/45">{footer}</p>
        </div>
      </div>

      <div className="orbit-gradient relative hidden flex-col justify-end p-12 lg:flex">
        <p className="max-w-[22ch] font-display text-3xl font-bold leading-[1.05] tracking-[-0.035em] text-ink">
          Every account starts at exactly $100,000.
        </p>
        <p className="mt-4 max-w-[38ch] text-sm leading-relaxed text-ink/60">
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
      <span className="text-xs text-white/55">{label}</span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-white/45 focus:outline-none"
      />
      {hint && <span className="mt-1.5 block text-[11px] text-white/35">{hint}</span>}
    </label>
  );
}
