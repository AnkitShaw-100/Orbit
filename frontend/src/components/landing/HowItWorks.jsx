import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1];

// Numbered because it genuinely is a sequence — you can't trade before the
// account exists, and you can't read P&L before a trade fills.
const STEPS = [
  {
    step: "01",
    title: "Open an account",
    body: "Sign up with an email. Your wallet is funded with $100,000 in virtual cash immediately.",
  },
  {
    step: "02",
    title: "Buy and sell at market",
    body: "Orders fill against the live Binance price, checked against your cash and holdings the same way a real venue would.",
  },
  {
    step: "03",
    title: "Watch the damage",
    body: "Every fill updates your average price, realised P&L and portfolio value. The mistakes are free; the lesson isn't.",
  },
];

export default function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="section" id="how-it-works">
      <div className="shell">
        <motion.h2
          initial={reduceMotion ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="h2-section max-w-[18ch] text-foreground"
        >
          Three steps to your first trade
        </motion.h2>

        <ol className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(({ step, title, body }, index) => (
            <motion.li
              key={step}
              initial={reduceMotion ? false : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.55, delay: index * 0.12, ease: EASE }}
            >
              {/* The single rule per step — it wipes in from the left as the
                  step arrives, so the sequence reads in order. */}
              <motion.span
                initial={reduceMotion ? false : { scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.7, delay: index * 0.12, ease: EASE }}
                className="block h-px origin-left bg-brand/50"
              />

              <span className="tabular mt-4 block font-mono text-[11px] font-bold tracking-[0.2em] text-brand">
                {step}
              </span>
              <h3 className="mt-3 font-display text-lg font-bold tracking-tight text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
