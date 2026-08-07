import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

export default function CtaBand() {
  return (
    <section className="section">
      <div className="orbit-gradient shell relative overflow-hidden rounded-[28px] px-8 py-16 text-center sm:px-12 sm:py-20">
        <h2 className="h2-section mx-auto max-w-[20ch] text-ink">
          Your first $100,000 is waiting
        </h2>
        <p className="mx-auto mt-5 max-w-[46ch] text-[15px] leading-relaxed text-ink/60">
          It costs nothing and risks nothing. The only thing you can lose is a
          misconception about how easy this is.
        </p>

        <Link
          to="/signup"
          className="group mt-9 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        >
          Start paper trading
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
