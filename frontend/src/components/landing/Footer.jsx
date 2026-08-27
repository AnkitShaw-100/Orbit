import { Link } from "react-router";

export default function Footer() {
  return (
    <footer className="gutter border-t border-line py-10">
      <div className="shell flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full border border-line">
              <span className="size-1 rounded-full bg-foreground" />
            </span>
            <span className="font-display text-base font-bold tracking-tight text-foreground">Orbit</span>
          </div>
          <p className="mt-3 max-w-[42ch] text-xs leading-relaxed text-faint">
            Orbit is a paper trading simulator. All balances are virtual and no
            real funds are ever traded. Market data from Binance.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3">
          {[
            { label: "Markets", to: "/markets" },
            { label: "How it works", to: "/#how-it-works" },
            { label: "Log in", to: "/login" },
            { label: "Sign up", to: "/signup" },
          ].map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
