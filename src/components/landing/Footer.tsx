interface FooterProps {
  onNavigateTab: (tab: string) => void;
  scrollToId: (id: string) => void;
}

const linkClass = "lp-body hover:text-[var(--lp-text)] transition-colors cursor-pointer";

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="lp-label">{title}</p>
      <ul className="mt-4 space-y-2">{children}</ul>
    </div>
  );
}

export default function Footer({ onNavigateTab, scrollToId }: FooterProps) {
  return (
    <footer data-scene="footer" className="relative z-10 lp-rule bg-[var(--lp-scrim)] backdrop-blur-md overflow-hidden">
      <div className="lp-wrap pt-14 grid grid-cols-2 md:grid-cols-6 gap-8">
        <div className="col-span-2">
          <p className="lp-body max-w-xs">Declarative billing orchestration for modern SaaS, AI, and API platforms.</p>
        </div>
        <Column title="Product">
          <li><button onClick={() => scrollToId("pipeline")} className={linkClass}>Pipeline</button></li>
          <li><button onClick={() => scrollToId("showcase")} className={linkClass}>Pricing models</button></li>
          <li><button onClick={() => scrollToId("features")} className={linkClass}>Features</button></li>
        </Column>
        <Column title="Developers">
          <li><button onClick={() => onNavigateTab("docs")} className={linkClass}>Documentation</button></li>
          <li><button onClick={() => scrollToId("developers")} className={linkClass}>API</button></li>
        </Column>
        <Column title="Company">
          <li><span className="lp-body lp-muted">Blog (coming soon)</span></li>
          <li><span className="lp-body lp-muted">Changelog</span></li>
        </Column>
        <Column title="Legal">
          <li><span className="lp-body lp-muted">Privacy Policy</span></li>
          <li><span className="lp-body lp-muted">Terms of Service</span></li>
        </Column>
      </div>
      <div className="lp-wrap mt-12 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 lp-data lp-muted">
        <p>© 2026 Aora Technologies Ltd.</p>
        <p>Built with TypeScript, CockroachDB, and stubbornness.</p>
        <a href="https://x.com/aorahq" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--lp-text)] transition-colors">
          Twitter
        </a>
      </div>
      <div className="lp-wrap pb-6" aria-hidden="true">
        <div className="lp-wordmark" />
      </div>
    </footer>
  );
}
