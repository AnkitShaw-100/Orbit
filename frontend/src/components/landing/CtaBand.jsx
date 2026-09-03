import AuthLink from "@/components/auth/AuthLink";

/**
 * How the landing page ends: with the balance itself.
 *
 * This used to be a bordered card with a gradient wash and centred copy —
 * the shape every product page ends with, which is why it read as flat. A
 * border does not create presence; it just draws a rectangle around the
 * absence of one.
 *
 * So the box is gone. What a paper-trading account actually offers is a
 * number, and this states it the way the terminal states a balance: the
 * display face, tabular figures, cents held back a tone. Scale and restraint
 * carry it, and the gold is spent here because this is the last thing on the
 * page and the only headline-sized use of it.
 *
 * Rendered inside the FAQ's section rather than as a section of its own, so
 * no hairline separates the last question from the invitation to stop asking
 * questions. See `.page > section + section` in index.css.
 */
export default function CtaBand() {
  return (
    <div className="shell mt-24 text-center sm:mt-32">
      <p className="font-display text-[clamp(3.2rem,11vw,7rem)] leading-[0.9] font-bold tracking-[-0.045em] text-brand">
        <span className="tabular">$100,000</span>
        {/* The cents are held back the way a terminal holds them back: present,
            because a balance without them is a price, not an amount.
            `opacity-45` rather than `text-brand/45` — --color-brand is declared
            on :root rather than in @theme, so it carries no opacity modifier
            and Tailwind drops that class without a word. */}
        <span className="tabular opacity-45">.00</span>
      </p>

      <p className="mx-auto mt-8 max-w-[44ch] text-[15px] leading-relaxed text-muted-foreground">
        Your starting balance, waiting. It costs nothing and risks nothing — the
        only thing you can lose is a misconception about how easy this is.
      </p>

      <AuthLink
        to="/signup"
        className="mt-10 inline-flex items-center rounded-full bg-brand px-8 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-void focus-visible:outline-none"
      >
        Start paper trading
      </AuthLink>
    </div>
  );
}
