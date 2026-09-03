import { useEffect } from "react";
import { useLocation } from "react-router";

/**
 * Makes `/#how-it-works` actually go to that section.
 *
 * React Router changes the URL and stops there — it does not scroll to a
 * fragment the way a plain anchor does, so every in-page link in the navbar and
 * the footer was silently doing nothing. Nothing about them looked broken,
 * which is why it survived: the URL updated, the page just never moved.
 *
 * The target may not be mounted at the instant the URL changes — following a
 * link from /markets renders the whole landing page first — so this waits a
 * frame and then retries briefly rather than giving up on the first miss.
 *
 * Vertical offset is not applied here; `scroll-margin-top` on the sections
 * handles it (see index.css), so the sticky navbar is accounted for whether the
 * scroll comes from this code or from the browser restoring a fragment on load.
 */
export default function ScrollToHash() {
  const { hash, key } = useLocation();

  useEffect(() => {
    if (!hash) return;

    // A hash is author-controlled here, but it lands in a selector, so anything
    // that is not a plain fragment is ignored rather than parsed.
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;

    let frame = 0;
    let attempts = 0;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const tryScroll = () => {
      const target = document.getElementById(id);

      if (target) {
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        return;
      }

      // ~20 frames is long enough for a route swap to paint, short enough that
      // a genuinely missing id costs nothing noticeable.
      if (attempts++ < 20) frame = requestAnimationFrame(tryScroll);
    };

    frame = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(frame);
    // `key` changes on every navigation, so clicking the same link twice
    // scrolls again instead of being swallowed as an unchanged hash.
  }, [hash, key]);

  return null;
}
