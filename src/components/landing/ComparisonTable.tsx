import { motion } from "motion/react";
import { X } from "lucide-react";

const competitors = [
  { name: "Stripe Billing", tagline: "Locked into Stripe. No Paystack. No Flutterwave.", answer: "Gateway-agnostic. Your gateway, your choice.", accent: "border-red-500/20 bg-red-500/[0.02]" },
  { name: "Chargebee", tagline: "Rigid pricing models. Migration headache. Expensive at scale.", answer: "Developer-first. Declarative pricing engine. No vendor lock-in.", accent: "border-orange-500/20 bg-orange-500/[0.02]" },
  { name: "Metronome / Lago", tagline: "Strong metering but weak invoicing. Young infrastructure.", answer: "Full orchestration. Pricing + metering + invoicing + revenue analytics in one stack.", accent: "border-purple-500/20 bg-purple-500/[0.02]" },
];

export default function ComparisonTable() {
  return (
    <section className="py-16 relative lp-bg">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center space-y-4 mb-6">
          <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">Competitive Landscape</span>
          <h2 className="text-3xl sm:text-4xl font-black lp-text tracking-tight">What they say vs. what you get</h2>
        </div>
        <div className="space-y-4">
          {competitors.map((c, i) => (
            <motion.div key={c.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }} className={`lp-glass backdrop-blur-2xl border ${c.accent} rounded-2xl p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center`}>
              <div className="md:col-span-3"><div className="text-sm font-bold lp-text">{c.name}</div><div className="text-[11px] lp-muted mt-0.5">Competitor</div></div>
              <div className="md:col-span-4 flex items-start gap-3">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-red-500/10 border border-red-500/20 shrink-0 mt-0.5"><X className="h-3 w-3 text-red-400" /></div>
                <div><div className="text-[10px] font-bold text-red-400/70 uppercase tracking-wider">What they say</div><p className="text-sm lp-muted font-medium mt-1 leading-relaxed">&ldquo;{c.tagline}&rdquo;</p></div>
              </div>
              <div className="hidden md:flex md:col-span-1 justify-center"><div className="h-px w-full lp-divider" /></div>
              <div className="md:col-span-4 flex items-start gap-3">
                <div className="flex items-center justify-center h-6 w-6 rounded-full lp-surface border lp-border-glass shrink-0 mt-0.5"><span className="h-2 w-2 rounded-full lp-accent" /></div>
                <div><div className="text-[10px] font-bold lp-accent uppercase tracking-wider">Our answer</div><p className="text-sm lp-text font-semibold mt-1 leading-relaxed">{c.answer}</p></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}