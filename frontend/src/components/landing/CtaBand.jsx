import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

export default function CtaBand() {
  return (
    <section className="section">
      <div className="brand-wash shell relative overflow-hidden rounded-2xl border border-line px-8 py-16 text-center sm:px-12 sm:py-20">
        <div className="relative">
          <h2 className="h2-section mx-auto max-w-[20ch] text-foreground">
            Your first $100,000 is waiting
          </h2>
          <p className="mx-auto mt-5 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">
            It costs nothing and risks nothing. The only thing you can lose is a
            misconception about how easy this is.
          </p>

          <Link
            to="/signup"
            className="group mt-9 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-void focus-visible:outline-none"
          >
            Start paper trading
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
