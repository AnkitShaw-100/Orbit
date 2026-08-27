import { useState } from "react";
import { Link } from "react-router";
import { Menu, X } from "lucide-react";

const LINKS = [
  { label: "Markets", to: "/markets" },
  { label: "How it works", to: "/#how-it-works" },
  { label: "Dashboard", to: "/dashboard" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="relative flex items-center justify-between px-6 py-5 sm:px-10 2xl:px-16">
      <div className="flex items-center gap-10">
        <Link to="/" className="flex items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <span className="grid size-7 place-items-center rounded-full border border-white/25">
            <span className="size-1.5 rounded-full bg-white" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white">Orbit</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="rounded-sm text-sm text-white/65 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="hidden items-center gap-3 md:flex">
        <Link
          to="/login"
          className="rounded-sm px-2 text-sm text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Log in
        </Link>
        <Link
          to="/signup"
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Sign up
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="rounded-sm text-white md:hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        {open ? <X className="size-6" /> : <Menu className="size-6" />}
      </button>

      {open && (
        <div className="absolute inset-x-4 top-full z-20 rounded-2xl bg-ink p-5 ring-1 ring-white/15 md:hidden">
          <div className="flex flex-col gap-4">
            {LINKS.map((link) => (
              <Link key={link.label} to={link.to} className="text-sm text-white/75">
                {link.label}
              </Link>
            ))}
            <Link to="/login" className="text-sm text-white/75">
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-full bg-white px-5 py-2 text-center text-sm font-semibold text-ink"
            >
              Sign up
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
