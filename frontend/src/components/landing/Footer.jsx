import { Link } from "react-router";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 px-6 py-10 sm:px-10 2xl:px-16">
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full border border-white/25">
              <span className="size-1 rounded-full bg-white" />
            </span>
            <span className="font-display text-base font-bold tracking-tight text-white">Orbit</span>
          </div>
          <p className="mt-3 max-w-[42ch] text-xs leading-relaxed text-white/40">
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
              className="rounded-sm text-xs text-white/50 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
