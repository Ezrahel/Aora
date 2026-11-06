import { useEffect, useState } from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useLandingTheme } from "./LandingTheme";

interface NavbarProps {
  onNavigateTab: (tab: string) => void;
  scrollToId: (id: string) => void;
}

const LINKS = [
  { id: "pipeline", label: "Product" },
  { id: "problem", label: "Solutions" },
  { id: "showcase", label: "Pricing" },
  { id: "developers", label: "Developers" },
];

export default function Navbar({ onNavigateTab, scrollToId }: NavbarProps) {
  const { theme, toggle } = useLandingTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const themeLabel = `Switch to ${theme === "light" ? "dark" : "light"} mode`;
  const themeIcon = theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-300 ${
        scrolled || mobileOpen ? "lp-divider bg-[var(--lp-scrim)] backdrop-blur-xl" : "border-transparent"
      }`}
    >
      <div className="lp-wrap h-16 flex items-center justify-between">
        <button onClick={() => onNavigateTab("dashboard")} className="flex items-center cursor-pointer" aria-label="AoraHQ">
          <img src="/aorahq-logo.png" alt="" className="lp-logo" />
        </button>

        <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
          {LINKS.map((link) => (
            <button key={link.id} onClick={() => scrollToId(link.id)} className="lp-label hover:text-[var(--lp-text)] transition-colors cursor-pointer">
              {link.label}
            </button>
          ))}
          <button onClick={() => onNavigateTab("docs")} className="lp-label hover:text-[var(--lp-text)] transition-colors cursor-pointer">
            Docs
          </button>
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <button onClick={toggle} aria-label={themeLabel} title={themeLabel} className="h-9 w-9 grid place-items-center lp-secondary hover:text-[var(--lp-text)] transition-colors cursor-pointer">
            {themeIcon}
          </button>
          <a href="/sign-in" className="lp-btn !h-9 !px-4 !text-[13px]">
            Get started
          </a>
        </div>

        <div className="md:hidden flex items-center gap-1">
          <button onClick={toggle} aria-label={themeLabel} className="h-10 w-10 grid place-items-center lp-secondary cursor-pointer">
            {themeIcon}
          </button>
          <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu" aria-expanded={mobileOpen} className="h-10 w-10 grid place-items-center lp-secondary cursor-pointer">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden lp-wrap pb-5 space-y-1 animate-fade-in">
          {LINKS.map((link) => (
            <button
              key={link.id}
              onClick={() => {
                scrollToId(link.id);
                setMobileOpen(false);
              }}
              className="block lp-label w-full text-left py-3 cursor-pointer"
            >
              {link.label}
            </button>
          ))}
          <button
            onClick={() => {
              onNavigateTab("docs");
              setMobileOpen(false);
            }}
            className="block lp-label w-full text-left py-3 cursor-pointer"
          >
            Docs
          </button>
          <a href="/sign-in" onClick={() => setMobileOpen(false)} className="lp-btn w-full mt-2">
            Get started
          </a>
        </div>
      )}
    </header>
  );
}
