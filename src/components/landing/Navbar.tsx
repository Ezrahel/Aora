import { useState, useEffect } from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useLandingTheme } from "./LandingTheme";

interface NavbarProps {
  onNavigateTab: (tab: string) => void;
  scrollToId: (id: string) => void;
}

export default function Navbar({ onNavigateTab, scrollToId }: NavbarProps) {
  const { theme, toggle } = useLandingTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { id: "features", label: "Product" },
    { id: "problem", label: "Solutions" },
    { id: "showcase", label: "Pricing" },
    { id: "developers", label: "Developers" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[var(--lp-bg)]/80 backdrop-blur-2xl border-b border-[var(--lp-border)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <button onClick={() => onNavigateTab("dashboard")} className="flex items-center cursor-pointer">
          <div className="rounded-lg p-1.5" style={{ backgroundColor: "#F5F5F7" }}>
            <img src="/aorahq-logo.png" alt="AoraHQ" className="h-8 w-auto" />
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollToId(link.id)}
              className="text-xs font-medium text-[var(--lp-muted)] hover:text-[var(--lp-text)] transition-colors cursor-pointer"
            >
              {link.label}
            </button>
          ))}
          <button
            onClick={() => onNavigateTab("docs")}
            className="text-xs font-medium text-[var(--lp-muted)] hover:text-[var(--lp-text)] transition-colors cursor-pointer"
          >
            Docs
          </button>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={toggle}
            className="p-2 rounded-xl text-[var(--lp-muted)] hover:text-[var(--lp-text)] hover:bg-[var(--lp-surface)] transition-all cursor-pointer"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <a
            href="/sign-in"
            className="px-5 py-2.5 bg-[var(--lp-btn-bg)] hover:opacity-90 text-[var(--lp-btn-text)] font-bold text-xs rounded-xl transition-all cursor-pointer inline-block"
          >
            Get Started
          </a>
        </div>

        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={toggle}
            className="p-2 rounded-xl text-[var(--lp-muted)] hover:text-[var(--lp-text)] transition-colors cursor-pointer"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-[var(--lp-muted)] hover:text-[var(--lp-text)] cursor-pointer"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-[var(--lp-bg)]/95 backdrop-blur-2xl border-b border-[var(--lp-border)] px-6 py-4 space-y-3 animate-fade-in">
          {links.map((link) => (
            <button
              key={link.id}
              onClick={() => { scrollToId(link.id); setMobileOpen(false); }}
              className="block text-sm font-medium text-[var(--lp-muted)] hover:text-[var(--lp-text)] w-full text-left py-2 cursor-pointer"
            >
              {link.label}
            </button>
          ))}
          <button
            onClick={() => { onNavigateTab("docs"); setMobileOpen(false); }}
            className="block text-sm font-medium text-[var(--lp-muted)] hover:text-[var(--lp-text)] w-full text-left py-2 cursor-pointer"
          >
            Docs
          </button>
          <a
            href="/sign-in"
            onClick={() => setMobileOpen(false)}
            className="block w-full text-center px-5 py-2.5 bg-[var(--lp-btn-bg)] text-[var(--lp-btn-text)] font-bold text-xs rounded-xl cursor-pointer"
          >
            Get Started
          </a>
        </div>
      )}
    </header>
  );
}
