import { createContext, useContext, type ReactNode } from "react";
import { useSiteTheme, type Theme } from "./siteTheme";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "dark", toggle: () => {} });

export function DashboardThemeProvider({ children }: { children: ReactNode }) {
  const value = useSiteTheme();
  return (
    <Ctx.Provider value={value}>
      <div className="dashboard-page" data-theme={value.theme}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function useDashboardTheme() {
  return useContext(Ctx);
}
