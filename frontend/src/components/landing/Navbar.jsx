import { useState } from "react";
import { Link } from "react-router";
import { Menu, X } from "lucide-react";

const LINKS = [
  { label: "Markets", to: "/markets" },
  { label: "How it works", to: "/#how-it-works" },
  { label: "Dashboard", to: "/dashboard" },
];

/**
 * The bar sticks, so it carries a ground of its own and the page's gutter —
 * and its contents sit in the same shell every section uses, so the logo lines
 * up with the headline beneath it rather than with the window edge.
 *
 * Its height is a variable rather than padding, because the hero measures the
 * viewport against it.
 */
export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="gutter sticky top-0 z-30 border-b border-line bg-void/85 backdrop-blur-md">
      <div className="shell flex h-[var(--nav-h)] items-center justify-between">
        <div className="flex items-center gap-10">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-sm focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            <span className="grid size-7 place-items-center rounded-full border border-brand/40">
              <span className="size-1.5 rounded-full bg-brand" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              Orbit
            </span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="rounded-sm px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-void focus-visible:outline-none"
          >
            Sign up
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded-sm text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none md:hidden"
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open && (
        <div className="pop absolute inset-x-4 top-full z-20 rounded-2xl border border-line bg-panel p-5 md:hidden">
          <div className="flex flex-col gap-4">
            {LINKS.map((link) => (
              <Link key={link.label} to={link.to} className="text-sm text-muted-foreground">
                {link.label}
              </Link>
            ))}
            <Link to="/login" className="text-sm text-muted-foreground">
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-full bg-brand px-5 py-2 text-center text-sm font-semibold text-ink"
            >
              Sign up
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
