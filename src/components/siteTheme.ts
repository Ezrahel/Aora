import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

// Versioned because the old key was written on every visit, so a stored value
// there never meant the visitor had actually chosen a theme.
const STORAGE_KEY = "aora-theme-v2";

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* storage can be blocked; fall through to the default */
  }
  return "dark";
}

/** One theme across the whole site, dark by default. Only an explicit toggle is stored. */
export function useSiteTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* the toggle still works for this page view */
    }
  };

  return { theme, toggle };
}
