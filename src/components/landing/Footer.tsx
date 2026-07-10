interface FooterProps { onNavigateTab: (tab: string) => void; scrollToId: (id: string) => void; }

export default function Footer({ onNavigateTab, scrollToId }: FooterProps) {
  return (
    <footer className="border-t lp-divider py-10 lp-bg">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-8">
        <div className="col-span-2 space-y-3">
          <div className="flex items-center">
            <img src="/aorahq-logo.png" alt="AoraHQ" className="h-6 w-auto" />
          </div>
          <p className="text-[11px] lp-muted font-medium leading-relaxed max-w-xs">Declarative billing orchestration for modern SaaS, AI, and API platforms.</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase lp-secondary tracking-wider block mb-4">Product</span>
          <ul className="space-y-2.5">
            <li><button onClick={() => scrollToId("features")} className="text-[11px] lp-muted hover:lp-text transition-colors cursor-pointer">Features</button></li>
            <li><button onClick={() => scrollToId("showcase")} className="text-[11px] lp-muted hover:lp-text transition-colors cursor-pointer">Pricing Models</button></li>
            <li><button onClick={() => scrollToId("developers")} className="text-[11px] lp-muted hover:lp-text transition-colors cursor-pointer">API</button></li>
          </ul>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase lp-secondary tracking-wider block mb-4">Developers</span>
          <ul className="space-y-2.5">
            <li><button onClick={() => onNavigateTab("docs")} className="text-[11px] lp-muted hover:lp-text transition-colors cursor-pointer">Documentation</button></li>
            <li><button onClick={() => onNavigateTab("docs")} className="text-[11px] lp-muted hover:lp-text transition-colors cursor-pointer">API Reference</button></li>
          </ul>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase lp-secondary tracking-wider block mb-4">Company</span>
          <ul className="space-y-2.5">
            <li><span className="text-[11px] lp-muted">Blog (coming soon)</span></li>
            <li><span className="text-[11px] lp-muted">Changelog</span></li>
          </ul>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase lp-secondary tracking-wider block mb-4">Legal</span>
          <ul className="space-y-2.5">
            <li><span className="text-[11px] lp-muted">Privacy Policy</span></li>
            <li><span className="text-[11px] lp-muted">Terms of Service</span></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-6 pt-4 border-t lp-divider flex flex-col sm:flex-row sm:items-center sm:justify-between text-[10px] gap-4">
        <p className="lp-muted">© 2026 Aora Technologies Ltd.</p>
        <p className="lp-muted text-center sm:text-right">Built with TypeScript, CockroachDB, and stubbornness.</p>
        <div className="flex gap-4">
          <a href="https://x.com/aorahq" target="_blank" rel="noopener noreferrer" className="lp-muted hover:lp-text transition-colors cursor-pointer">Twitter</a>
          <span className="lp-muted hover:lp-text transition-colors cursor-pointer">Instagram</span>
        </div>
      </div>
    </footer>
  );
}