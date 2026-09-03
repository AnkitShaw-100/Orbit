import { useState } from "react";
import { Link } from "react-router";
import AuthLink from "@/components/auth/AuthLink";
import { Menu, X } from "lucide-react";
import OrbitMark from "@/components/OrbitMark";
import { useAuth } from "@/context/authContext";

const LINKS = [
  { label: "Markets", to: "/markets" },
  { label: "How it works", to: "/#how-it-works" },
  { label: "Dashboard", to: "/dashboard" },
];

/** Whatever the account is called, reduced to the one letter the chip shows. */
function initialOf(user) {
  const name = user?.user_metadata?.name ?? user?.email ?? "";
  return name.slice(0, 1).toUpperCase() || "?";
}

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
  const { session, user, loading } = useAuth();

  return (
    <nav className="gutter sticky top-0 z-30 border-b border-line bg-void/85 backdrop-blur-md">
      {/* Three tracks rather than two groups, so the links are centred against
          the bar itself and stay centred however wide the logo or the account
          chip beside them get. */}
      <div className="shell flex h-[var(--nav-h)] items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr]">
        <Link
          to="/"
          className="flex items-center gap-2 justify-self-start rounded-sm focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <OrbitMark className="size-7 shrink-0 text-brand" />
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

        {/* Nothing is rendered until the stored session has been read. Showing
            "Sign up" first and swapping it for the account chip a moment later
            tells a signed-in visitor they are signed out, which is the exact
            confusion this is here to remove. */}
        <div className="hidden items-center justify-end gap-3 justify-self-end md:flex">
          {loading ? null : session ? (
            <Link
              to="/profile"
              className="flex items-center gap-2.5 rounded-full border border-line py-1 pr-4 pl-1 transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <span
                style={{ "--tint": "var(--color-brand)" }}
                className="tint-chip grid size-8 place-items-center rounded-full text-xs font-bold"
                aria-hidden="true"
              >
                {initialOf(user)}
              </span>
              <span className="max-w-[12ch] truncate text-sm text-foreground">
                {user?.user_metadata?.name ?? "Your account"}
              </span>
            </Link>
          ) : (
            <>
              <AuthLink
                to="/login"
                className="rounded-sm px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                Log in
              </AuthLink>
              <AuthLink
                to="/signup"
                className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-void focus-visible:outline-none"
              >
                Sign up
              </AuthLink>
            </>
          )}
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
            {loading ? null : session ? (
              <Link
                to="/profile"
                className="flex items-center gap-2.5 border-t border-line pt-4 text-sm text-foreground"
              >
                <span
                  style={{ "--tint": "var(--color-brand)" }}
                  className="tint-chip grid size-8 place-items-center rounded-full text-xs font-bold"
                  aria-hidden="true"
                >
                  {initialOf(user)}
                </span>
                {user?.user_metadata?.name ?? "Your account"}
              </Link>
            ) : (
              <>
                <AuthLink to="/login" className="text-sm text-muted-foreground">
                  Log in
                </AuthLink>
                <AuthLink
                  to="/signup"
                  className="rounded-full bg-brand px-5 py-2 text-center text-sm font-semibold text-ink"
                >
                  Sign up
                </AuthLink>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
