import { NavLink } from "react-router";
import {
  LayoutDashboard,
  CandlestickChart,
  Briefcase,
  Receipt,
  Store,
  Settings as SettingsIcon,
  User,
} from "lucide-react";

const LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/markets", label: "Markets", icon: Store },
  { to: "/trade", label: "Trade", icon: CandlestickChart },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/transactions", label: "Transactions", icon: Receipt },
];

const FOOTER_LINKS = [
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function Item({ to, label, icon: Icon, collapsed }) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        // The active item carries the accent on the icon and a rail on the
        // edge, not on the label — a coloured word in a list of plain ones is
        // harder to scan than a marker in a fixed position.
        `relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
          isActive
            ? "bg-brand/10 text-foreground"
            : "text-foreground/55 hover:bg-foreground/[0.04] hover:text-foreground"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand"
            />
          )}
          <Icon
            className={`size-4.5 shrink-0 ${isActive ? "text-brand" : ""}`}
            aria-hidden="true"
          />
          <span className={collapsed ? "sr-only" : ""}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ collapsed = false }) {
  return (
    <aside
      className={`flex h-full flex-col border-r border-line bg-panel ${
        collapsed ? "w-[68px] px-2.5" : "w-60 px-4"
      } py-5`}
    >
      <NavLink to="/" className="mb-8 flex items-center gap-2 px-1.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-brand/40">
          <span className="size-1.5 rounded-full bg-brand" />
        </span>
        <span className={`font-display text-lg font-bold tracking-tight text-foreground ${collapsed ? "sr-only" : ""}`}>
          Orbit
        </span>
      </NavLink>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {LINKS.map((link) => (
          <Item key={link.to} {...link} collapsed={collapsed} />
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-line pt-4">
        {FOOTER_LINKS.map((link) => (
          <Item key={link.to} {...link} collapsed={collapsed} />
        ))}
      </div>
    </aside>
  );
}
