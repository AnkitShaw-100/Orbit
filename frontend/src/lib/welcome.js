/**
 * A one-shot "this account was just created" flag.
 *
 * It was carried in router navigation state at first, which loses it: after
 * signup the session has not always reached AuthProvider by the time
 * RequireAuth reads it, so /dashboard bounces to /login and back, and a
 * redirect does not carry the state with it. The greeting then never appeared,
 * intermittently, which is the worst way for it to fail.
 *
 * sessionStorage survives those redirects, is scoped to the tab, and dies with
 * it — nothing to clean up, and a second tab is not greeted for an account it
 * did not just create.
 */
const KEY = "orbit:welcome";

/**
 * Read once per page load and cleared on that read.
 *
 * The result is cached at module scope because React invokes a `useState`
 * initializer twice under StrictMode: without the cache the first call would
 * consume the flag and the second would return false, so the card would never
 * appear in development — exactly where it is tested.
 */
let consumed = null;

/** Storage throws outright in some private-browsing modes; never fatal here. */
export function markWelcome() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // The greeting is a nicety. Losing it is not worth failing a signup over.
  }
}

export function takeWelcome() {
  if (consumed !== null) return consumed;

  try {
    consumed = sessionStorage.getItem(KEY) === "1";
    if (consumed) sessionStorage.removeItem(KEY);
  } catch {
    consumed = false;
  }

  return consumed;
}
