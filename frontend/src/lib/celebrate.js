import confetti from "canvas-confetti";

/**
 * The one moment Orbit gets to say welcome.
 *
 * canvas-confetti mounts its own canvas on document.body, so the burst outlives
 * the React tree that fired it — the auth card can unmount and the route change
 * to /dashboard can happen underneath while the confetti keeps falling.
 */
export function celebrate() {
  // Someone who has asked their OS for less motion did not ask for this.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  });
}
