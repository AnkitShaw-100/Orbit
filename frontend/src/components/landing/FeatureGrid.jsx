import { Link } from "react-router";
import { ArrowRight, Gauge, RefreshCw, Scale, Wallet } from "lucide-react";

/**
 * What Orbit actually does, four claims at a time.
 *
 * Each one is something the app enforces rather than something it advertises:
 * the fills, the balance check, the P&L and the reset are all real behaviour
 * you can go and verify in the product a click away.
 */
const FEATURES = [
  {
    icon: Gauge,
    title: "Fills at the live price",
    body: "Every market order executes against the current Binance price, not a delayed snapshot or a simulated book.",
  },
  {
    icon: Wallet,
    title: "Balances you can't cheat",
    body: "You cannot spend cash or sell coins you don't hold. The same checks a real venue runs, run here.",
  },
  {
    icon: Scale,
    title: "P&L on every tick",
    body: "Realised P&L books on sells, unrealised moves with the market. Both update live, not on a refresh.",
  },
  {
    icon: RefreshCw,
    title: "Reset when it goes badly",
    body: "Back to $100,000 whenever you want. The mistakes are free, which is the entire point of practising.",
  },
];

export default function FeatureGrid() {
  return (
    <section className="section">
      <div className="shell grid gap-12 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="h2-section max-w-[14ch] text-foreground">
            Built to teach, not to flatter
          </h2>
          <p className="mt-5 max-w-[42ch] text-[15px] leading-relaxed text-muted-foreground">
            A simulator that always lets you win teaches nothing. Orbit enforces the same
            constraints a real venue does, so the habits you build here transfer.
          </p>

          <Link
            to="/signup"
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-void focus-visible:outline-none"
          >
            Start trading now
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-line bg-panel p-6 transition-colors hover:border-brand/30"
            >
              <span className="grid size-10 place-items-center rounded-xl border border-line bg-panel-2 text-brand">
                <Icon className="size-5" aria-hidden="true" />
              </span>

              <h3 className="mt-5 font-display text-base font-bold tracking-tight text-foreground">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
