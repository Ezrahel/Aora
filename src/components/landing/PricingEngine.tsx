import { useState } from "react";
import { motion } from "motion/react";
import { Layers, Activity, Zap, Users, Database, ShieldCheck } from "lucide-react";

type PricingModel = "subscription" | "usage" | "hybrid" | "seat" | "credits" | "enterprise";

const models: { id: PricingModel; label: string; rate: string; icon: typeof Layers }[] = [
  { id: "subscription", label: "Subscription", rate: "₦15,000 / mo", icon: Layers },
  { id: "usage", label: "Usage", rate: "₦2 / unit", icon: Activity },
  { id: "hybrid", label: "Hybrid", rate: "₦15k + ₦2/unit", icon: Zap },
  { id: "seat", label: "Seat Based", rate: "₦3,000 / user", icon: Users },
  { id: "credits", label: "Credits", rate: "10k incl.", icon: Database },
  { id: "enterprise", label: "Enterprise", rate: "Custom SLA", icon: ShieldCheck },
];

export default function PricingEngine() {
  const [selected, setSelected] = useState<PricingModel>("hybrid");
  const [seats, setSeats] = useState(15);
  const [usage, setUsage] = useState(35000);

  const calc = () => {
    switch (selected) {
      case "subscription": return { formula: "Flat monthly commitment", base: 15000, overages: 0, total: 15000 };
      case "usage": return { formula: `${usage.toLocaleString()} units @ ₦2/unit`, base: 0, overages: usage * 2, total: usage * 2 };
      case "hybrid": { const over = Math.max(0, usage - 10000); return { formula: `₦15,000 + (${usage.toLocaleString()} - 10k) × ₦2`, base: 15000, overages: over * 2, total: 15000 + over * 2 }; }
      case "seat": return { formula: `${seats} seats @ ₦3,000/seat`, base: 0, overages: seats * 3000, total: seats * 3000 };
      case "credits": { const over = Math.max(0, usage - 10000); return { formula: "10k credits incl. + overage", base: 15000, overages: over * 1.5, total: 15000 + over * 1.5 }; }
      case "enterprise": return { formula: "Bespoke SLA contract", base: 120000, overages: Math.max(0, usage - 100000) * 1.0, total: 120000 + Math.max(0, usage - 100000) * 1.0 };
    }
  };
  const result = calc();

  return (
    <section id="showcase" className="py-32 relative lp-bg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">Monetization Versatility</span>
          <h2 className="text-3xl sm:text-4xl font-black lp-text tracking-tight">One platform. Every pricing model.</h2>
          <p className="text-sm lp-secondary font-medium">Switch pricing strategies instantly using our declarative engine. No code changes.</p>
        </div>
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-10">
            {models.map((m) => {
              const Icon = m.icon;
              const isSel = selected === m.id;
              return (
                <button key={m.id} onClick={() => setSelected(m.id)} className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${isSel ? "lp-card" : "lp-surface border lp-border-glass hover:opacity-80"}`}>
                  <Icon className={`h-4 w-4 ${isSel ? "lp-text" : "lp-muted"}`} />
                  <div className={`text-[11px] font-bold mt-2 ${isSel ? "lp-text" : "lp-secondary"}`}>{m.label}</div>
                  <div className="text-[9px] font-mono lp-muted mt-1">{m.rate}</div>
                </button>
              );
            })}
          </div>
          <motion.div key={selected} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="lp-glass border lp-border-glass rounded-2xl p-8 space-y-6">
            {(selected === "hybrid" || selected === "usage" || selected === "credits" || selected === "enterprise") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs"><span className="lp-secondary">Usage volume</span><span className="font-mono lp-text font-bold">{usage.toLocaleString()} units</span></div>
                <input type="range" min={0} max={100000} step={100} value={usage} onChange={(e) => setUsage(Number(e.target.value))} className="w-full h-1.5 lp-surface rounded-full appearance-none cursor-pointer accent-[var(--lp-btn-bg)]" />
              </div>
            )}
            {(selected === "hybrid" || selected === "seat") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs"><span className="lp-secondary">Seats</span><span className="font-mono lp-text font-bold">{seats} users</span></div>
                <input type="range" min={1} max={50} value={seats} onChange={(e) => setSeats(Number(e.target.value))} className="w-full h-1.5 lp-surface rounded-full appearance-none cursor-pointer accent-[var(--lp-btn-bg)]" />
              </div>
            )}
            <div className="lp-card rounded-xl p-6 flex items-center justify-between">
              <div>
                <div className="text-[9px] lp-muted font-bold uppercase tracking-widest">Live Calculation</div>
                <div className="text-[11px] font-mono lp-accent/70 mt-1">{result.formula}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono lp-text">₦{result.total.toLocaleString()}</div>
                <div className="text-[10px] lp-secondary">/ month</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}