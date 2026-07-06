import { ArrowRight } from "lucide-react";

interface CTASectionProps { onNavigateTab: (tab: string) => void; }

export default function CTASection({ onNavigateTab }: CTASectionProps) {
  return (
    <section className="py-32 relative overflow-hidden lp-bg">
      <div className="absolute inset-0 bg-gradient-to-b pointer-events-none" style={{ backgroundImage: "linear-gradient(to bottom, var(--lp-glow), var(--lp-bg), var(--lp-bg))" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: "var(--lp-glow)" }} />
      <div className="relative max-w-4xl mx-auto px-6 text-center space-y-8">
        <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">Unlock Scalable Monetization</span>
        <h2 className="text-4xl sm:text-5xl font-black lp-text tracking-tight leading-tight">Your billing infrastructure should be an asset, not a tax.</h2>
        <p className="text-base lp-secondary font-medium max-w-xl mx-auto">Stop maintaining billing code. Start shipping your product. Connect your gateway in minutes.</p>
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <button onClick={() => onNavigateTab("dashboard")} className="px-8 py-4 rounded-xl transition-all cursor-pointer flex items-center gap-2 group text-sm font-bold" style={{ backgroundColor: "var(--lp-btn-bg)", color: "var(--lp-btn-text)" }}>
            Connect Your Gateway <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
          <button onClick={() => onNavigateTab("dashboard")} className="px-8 py-4 lp-surface border lp-border-glass lp-secondary font-semibold text-sm rounded-xl transition-all cursor-pointer hover:opacity-80">
            Talk to Sales
          </button>
        </div>
      </div>
    </section>
  );
}