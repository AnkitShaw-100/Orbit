import { useEffect, useState } from "react";

/**
 * Seconds left before a rate-limited request is worth sending again.
 *
 * The API answers a 429 with `Retry-After`, computed from the tokens actually
 * missing rather than from a fixed window, so it is a real number and not a
 * guess. Counting it down turns "too many orders" into something the interface
 * can act on: the button disables itself for exactly as long as the server
 * intends to refuse, instead of inviting a click that is certain to fail.
 *
 * Returns 0 for anything that is not a live 429, so callers can treat it as a
 * plain "blocked for this many seconds".
 *
 * @param error an ApiError from lib/api, or null.
 */
export function useRetryAfter(error) {
  const [remaining, setRemaining] = useState(0);

  /**
   * Keyed on the error's identity, so a second refusal restarts the countdown
   * rather than continuing the first one, and an error that clears releases the
   * hold instead of freezing it at whatever it had reached.
   *
   * The clock is read here rather than during render: a render that calls
   * Date.now() produces a different result each time for the same inputs, which
   * is exactly what React needs not to be true.
   */
  useEffect(() => {
    const seconds = error?.status === 429 ? error.retryAfter : null;
    const deadline = seconds ? Date.now() + seconds * 1000 : 0;

    const tick = () =>
      setRemaining(deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0);

    // The first value goes out on a timer rather than inline, since a
    // synchronous setState in an effect body is a cascading render. At zero
    // delay it still lands before the browser paints, so the button is never
    // briefly clickable.
    const first = setTimeout(tick, 0);

    // Ticks faster than once a second so the number never sits on a stale value
    // for most of a second, which is what makes a countdown look stuck. Each
    // tick re-reads the clock, so a backgrounded tab, where timers stop firing
    // on schedule, comes back showing the truth rather than a drifted count.
    const timer = setInterval(() => {
      tick();
      if (Date.now() >= deadline) clearInterval(timer);
    }, 250);

    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [error]);

  return remaining;
}
