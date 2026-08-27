import { Link } from "react-router";

/**
 * Four columns, the way the reference lays a footer out — but only carrying
 * destinations that exist. A column of links to pages nobody has written is
 * worse than a shorter footer.
 */
const COLUMNS = [
  {
    title: "Trade",
    links: [
      { label: "Markets", to: "/markets" },
      { label: "Trade", to: "/trade" },
      { label: "Dashboard", to: "/dashboard" },
      { label: "Transactions", to: "/transactions" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign up", to: "/signup" },
      { label: "Log in", to: "/login" },
      { label: "Profile", to: "/profile" },
      { label: "Settings", to: "/settings" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "How it works", to: "/#how-it-works" },
      { label: "The market now", to: "/#pulse" },
      { label: "Questions", to: "/#faq" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="gutter border-t border-line py-14">
      <div className="shell grid gap-10 md:grid-cols-[minmax(0,22rem)_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full border border-brand/40">
              <span className="size-1.5 rounded-full bg-brand" />
            </span>
            <span className="font-display text-base font-bold tracking-tight text-foreground">
              Orbit
            </span>
          </div>

          <p className="mt-4 max-w-[42ch] text-xs leading-relaxed text-faint">
            Orbit is a paper trading simulator. All balances are virtual and no real funds are ever
            traded. Market data from Binance; sign-in handled by Supabase.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {COLUMNS.map(({ title, links }) => (
            <nav key={title}>
              <h3 className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
                {title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="shell mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <p className="text-[11px] text-faint">
          © {new Date().getFullYear()} Orbit. Virtual money only.
        </p>
        <p className="text-[11px] text-faint">Not investment advice.</p>
      </div>
    </footer>
  );
}
