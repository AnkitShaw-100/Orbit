/**
 * The one spinner, so a wait looks the same wherever it happens.
 *
 * Drawn in `currentColor` rather than a fixed colour, so it takes on whatever
 * it sits inside: white on the buy button, red on a destructive one, muted in a
 * panel. The gap that makes the rotation visible is a transparent top border
 * rather than a second colour, which keeps it to one ring and no assumptions
 * about the background behind it.
 *
 * Hidden from screen readers by default: it always accompanies text that has
 * already changed to say what is happening ("Placing…", "Signing in…"), and
 * announcing a second time would be noise.
 */
export default function Spinner({ className = "size-3.5", label }) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
