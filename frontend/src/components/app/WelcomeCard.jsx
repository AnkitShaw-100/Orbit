import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { formatUsd } from "@/lib/format";

/**
 * The first thing a new account sees, once.
 *
 * It states the one fact that makes the platform usable — the balance is
 * already there — and then gets out of the way on its own. Three ways out, in
 * the order people reach for them: the close button, Escape, and the timer.
 *
 * Deliberately not a modal. Nothing behind it is unusable while it shows, the
 * scrim doesn't trap focus, and the timer means a visitor who ignores it
 * entirely is not left with something to clean up. A blocking dialog to
 * announce good news would be an odd greeting.
 */
const DISMISS_MS = 5000;

export default function WelcomeCard({ amount, onDismiss }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(onDismiss, DISMISS_MS);

    // Escape closes it early, the way it closes anything else layered over the
    // page — a card that can only be dismissed by waiting is a card that
    // ignores you.
    const onKey = (event) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      {/* Clicking anywhere off the card dismisses it too. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onDismiss}
        className="absolute inset-0 cursor-default bg-void/70 backdrop-blur-[2px]"
      />

      <motion.div
        role="status"
        aria-live="polite"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[26rem] rounded-2xl border border-line bg-panel p-8 text-center shadow-2xl"
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute top-3 right-3 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
          You&rsquo;re in
        </h2>

        <p className="tabular mt-5 font-display text-[clamp(2.4rem,9vw,3.25rem)] leading-none font-bold tracking-[-0.04em] text-brand">
          {formatUsd(amount)}
        </p>

        <p className="mx-auto mt-5 max-w-[30ch] text-sm leading-relaxed text-muted-foreground">
          is already in your account, in virtual cash. None of it is real money
          — the prices are. Trade it like it matters.
        </p>
      </motion.div>
    </div>
  );
}
