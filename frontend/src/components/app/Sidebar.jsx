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
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
          isActive ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white"
        }`
      }
    >
      <Icon className="size-4.5 shrink-0" aria-hidden="true" />
      <span className={collapsed ? "sr-only" : ""}>{label}</span>
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
        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/25">
          <span className="size-1.5 rounded-full bg-white" />
        </span>
        <span className={`font-display text-lg font-bold tracking-tight text-white ${collapsed ? "sr-only" : ""}`}>
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
