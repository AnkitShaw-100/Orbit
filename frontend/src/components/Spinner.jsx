/**
 * The one spinner, so a wait looks the same wherever it happens.
 *
 * Drawn as an SVG rather than a bordered box. The border version is the usual
 * trick — a ring with one transparent side — but it depends on
 * `border-t-transparent` beating the `border-color` shorthand in the cascade,
 * and when it loses you get a perfectly uniform ring whose rotation is
 * invisible. Two paths cannot lose that argument: a faint full circle for the
 * track, a bright quarter arc on top to show the motion.
 *
 * Both strokes are `currentColor`, so it takes on whatever it sits inside:
 * white on the buy button, red on a destructive one, muted in a panel.
 *
 * Hidden from screen readers by default, since it always accompanies text that
 * already says what is happening ("Placing…", "Signing in…").
 */
export default function Spinner({ className = "size-4", label }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      className={`inline-block shrink-0 animate-spin ${className}`}
    >
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        d="M21.5 12A9.5 9.5 0 0 0 12 2.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
