import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const STORAGE_KEY = "aora-dashboard-theme";

const Ctx = createContext<ThemeCtx>({ theme: "light", toggle: () => {} });

export function LandingThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") return stored;
    }
    return "light";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === "light" ? "dark" : "light")) }}>
      <div className="landing-page" data-theme={theme}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function useLandingTheme() {
  return useContext(Ctx);
}
