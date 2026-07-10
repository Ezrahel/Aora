import { useState } from "react";
import { motion } from "motion/react";
import { ShieldCheck, Check, X } from "lucide-react";

interface Feature { name: string; starter: boolean; growth: boolean; enterprise: boolean; }

const defaultFeatures: Feature[] = [
  { name: "API Access", starter: true, growth: true, enterprise: true },
  { name: "Usage Metering", starter: true, growth: true, enterprise: true },
  { name: "Basic Analytics", starter: true, growth: true, enterprise: true },
  { name: "Custom Pricing", starter: false, growth: true, enterprise: true },
  { name: "Revenue Simulation", starter: false, growth: true, enterprise: true },
  { name: "AI Assistant", starter: false, growth: false, enterprise: true },
  { name: "Dunning Management", starter: false, growth: false, enterprise: true },
  { name: "SLA Guarantee", starter: false, growth: false, enterprise: true },
];

export default function Entitlements() {
  const [features, setFeatures] = useState<Feature[]>(defaultFeatures);
  const toggle = (idx: number, tier: "starter" | "growth" | "enterprise") => setFeatures((prev) => prev.map((f, i) => i === idx ? { ...f, [tier]: !f[tier] } : f));

  return (
    <section className="py-16 relative lp-bg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-6">
          <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">Entitlements Engine</span>
          <h2 className="text-3xl sm:text-4xl font-black lp-text tracking-tight">Feature access, declaratively controlled</h2>
          <p className="text-sm lp-secondary font-medium">Map features to plans. Check access in real-time. Gate features behind plan tiers without redeploying.</p>
        </div>
        <motion.div className="max-w-4xl mx-auto" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <div className="lp-glass border lp-border-glass rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b lp-divider lp-surface">
                  <th className="py-4 px-6 text-[10px] font-bold lp-secondary uppercase tracking-widest">Feature</th>
                  {["Starter", "Growth", "Enterprise"].map((tier) => (
                    <th key={tier} className="py-4 px-4 text-center text-[10px] font-bold lp-secondary uppercase tracking-widest">{tier}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y lp-divider">
                {features.map((f, idx) => (
                  <tr key={f.name} className="hover:lp-surface transition-colors">
                    <td className="py-3.5 px-6 text-xs lp-text font-medium">{f.name}</td>
                    {(["starter", "growth", "enterprise"] as const).map((tier) => (
                      <td key={tier} className="py-3.5 px-4 text-center">
                        <button onClick={() => toggle(idx, tier)} className={`inline-flex items-center justify-center h-7 w-7 rounded-lg border transition-all cursor-pointer ${f[tier] ? "lp-card border-[var(--lp-text)]/30 lp-text" : "lp-surface border lp-border-glass lp-muted hover:lp-text"}`}>
                          {f[tier] ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 text-[10px] lp-secondary">
              <ShieldCheck className="h-3.5 w-3.5 lp-muted" />
              Click any cell to toggle feature access — changes are instant and require no deployment
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}