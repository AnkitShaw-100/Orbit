import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { LogOut, Menu, Moon, Search, Sun, Wallet, X } from "lucide-react";
import Sidebar from "./Sidebar";
import { useAuth } from "@/context/authContext";
import { useMe, usePortfolio } from "@/hooks/useOrbit";
import { useTheme } from "@/hooks/useTheme";
import { formatUsd } from "@/lib/format";

const TITLES = {
  "/dashboard": "Dashboard",
  "/markets": "Markets",
  "/trade": "Trade",
  "/transactions": "Transactions",
  "/profile": "Profile",
  "/settings": "Settings",
};

/**
 * Chrome for every signed-in screen: permanent sidebar on desktop, a drawer on
 * mobile, and a top bar carrying what the account is worth — the number a paper
 * trader checks most often, so it stays visible on every page.
 *
 * Portfolio value rather than the wallet balance, because a short sale credits
 * its proceeds to cash: sell $100k of a coin you don't hold and the balance
 * reads $200k, while the position it opened is worth -$100k and the account is
 * worth exactly what it was. Showing raw cash here made an ordinary short look
 * like the platform had minted money, and contradicted the dashboard on the
 * next screen down. Cash is still reported on Dashboard and Trade, where the
 * position it is offset by is visible beside it.
 */
export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const me = useMe();
  const portfolio = usePortfolio();
  const { resolved, toggle } = useTheme();

  const title = TITLES[pathname] ?? "Orbit";
  const initial = (me.data?.user?.name ?? "?").slice(0, 1).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-void">
      {/* Pinned to the viewport with its own scroll, so a long page never
          drags the navigation out of reach. */}
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <Sidebar />
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="relative" onClick={() => setDrawerOpen(false)}>
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-line bg-panel/85 px-4 py-3.5 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen((value) => !value)}
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            className="text-muted-foreground lg:hidden"
          >
            {drawerOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          <h1 className="font-display text-base font-bold tracking-tight text-foreground">{title}</h1>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link
              to="/markets"
              aria-label="Search markets"
              className="hidden size-9 place-items-center rounded-full border border-line text-muted-foreground transition-colors hover:text-foreground sm:grid"
            >
              <Search className="size-4" aria-hidden="true" />
            </Link>

            <span className="hidden items-center gap-2 rounded-full border border-line px-3.5 py-2 sm:flex">
              <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="tabular text-sm font-medium text-foreground">
                {portfolio.data ? formatUsd(Number(portfolio.data.totalValue)) : "—"}
              </span>
              <span className="text-[11px] text-faint">portfolio</span>
            </span>

            <button
              type="button"
              onClick={toggle}
              aria-label={resolved === "dark" ? "Switch to the light theme" : "Switch to the dark theme"}
              className="grid size-9 place-items-center rounded-full border border-line text-muted-foreground transition-colors hover:text-foreground"
            >
              {resolved === "dark" ? (
                <Sun className="size-4" aria-hidden="true" />
              ) : (
                <Moon className="size-4" aria-hidden="true" />
              )}
            </button>

            <Link
              to="/profile"
              aria-label="Your profile"
              style={{ "--tint": "var(--color-brand)" }}
              className="tint-chip grid size-9 place-items-center rounded-full text-xs font-bold"
            >
              {initial}
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="grid size-9 place-items-center rounded-full border border-line text-muted-foreground transition-colors hover:border-loss/50 hover:text-loss"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
