import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-mist p-4">
      <div className="w-full max-w-md rounded-[28px] bg-ink px-8 py-14 text-center">
        <span className="grid size-10 place-items-center rounded-full border border-white/20 mx-auto">
          <span className="size-1.5 rounded-full bg-white/60" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-white">
          Nothing at this address
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          This page doesn't exist yet. Head back and pick a route from the nav.
        </p>
        <Link
          to="/"
          className="mt-8 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-ink transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
