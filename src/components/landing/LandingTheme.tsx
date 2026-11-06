import { createContext, useContext, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { useSiteTheme, type Theme } from "../siteTheme";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "dark", toggle: () => {} });

export function LandingThemeProvider({ children }: { children: ReactNode }) {
  const value = useSiteTheme();
  return (
    <Ctx.Provider value={value}>
      <MotionConfig reducedMotion="user">
        <div className="landing-page" data-theme={value.theme}>
          {children}
        </div>
      </MotionConfig>
    </Ctx.Provider>
  );
}

export function useLandingTheme() {
  return useContext(Ctx);
}
