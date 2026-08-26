import { useCallback, useEffect, useState } from "react";

/**
 * Light, dark, or whatever the machine is set to.
 *
 * The class is applied by an inline script in index.html before first paint —
 * doing it here would flash the wrong theme on every load. This hook only owns
 * the preference and keeps the class in step with it afterwards.
 */

export const STORAGE_KEY = "orbit-theme";

export const THEMES = ["light", "dark", "system"];

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function read() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(stored) ? stored : "system";
  } catch {
    // Private browsing and blocked site data both throw on read.
    return "system";
  }
}

export function applyTheme(theme) {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const [theme, setStored] = useState(read);

  useEffect(() => {
    applyTheme(theme);

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The theme still applies for this session; it just won't be remembered.
    }
  }, [theme]);

  // On "system", follow the machine if it changes while the tab is open —
  // someone on a sunset schedule shouldn't have to reload at dusk.
  useEffect(() => {
    if (theme !== "system") return undefined;

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme("system");
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [theme]);

  const resolved = theme === "system" ? (prefersDark() ? "dark" : "light") : theme;

  /** What the top bar's single button does: flip to the opposite of what you see. */
  const toggle = useCallback(() => {
    setStored(resolved === "dark" ? "light" : "dark");
  }, [resolved]);

  return { theme, resolved, setTheme: setStored, toggle };
}
