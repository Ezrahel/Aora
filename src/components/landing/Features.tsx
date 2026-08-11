import { useState, useRef, useEffect } from "react";
import { motion, type Variants } from "motion/react";
import { ShieldCheck, Database, Activity, Layers, TrendingUp, Sparkles } from "lucide-react";

const features = [
  { icon: ShieldCheck, title: "BYOK — Bring Your Own Keys", desc: "Pick your payment gateway, paste your keys, and go. AES-256-GCM encrypts them before they touch disk. Decrypted in-memory per request, then forgotten." },
  { icon: Database, title: "Pricing Engine", desc: "Flat, per-seat, usage-based, hybrid, tiered, volume, package — our engine handles them all. Change pricing in the dashboard without a deployment." },
  { icon: Activity, title: "Usage Metering", desc: "Ingestion endpoint for usage events. Bulk import via CSV. Quota tracking. Credit ledger with grant/deduct. Aggregate usage per customer per billing period." },
  { icon: Layers, title: "Entitlements", desc: "Map features to plans. Check access in real-time. Gate features behind plan tiers. Change entitlement rules without redeploying." },
  { icon: TrendingUp, title: "Invoicing & Revenue Analytics", desc: "Full lifecycle — draft → open → paid/past_due. Line items per subscription. MRR, ARR, churn, trial conversion, plan performance." },
  { icon: Sparkles, title: "AI Billing Assistant", desc: "Powered by Gemini. Ask natural language questions about revenue, create plans, inspect customers, or run pricing simulations. Real results." },
];

const containerVariants: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };
const cardVariants: Variants = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } } };

export default function Features() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } }, { rootMargin: "-80px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" ref={ref} className="py-16 relative lp-bg" style={{ backgroundImage: "linear-gradient(to bottom, var(--lp-bg), var(--lp-grad-stop), var(--lp-bg))" }}>
      <div className="max-w-7xl mx-auto px-6">
<div className="max-w-3xl mx-auto text-center space-y-4 mb-8">
        <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">Core Capabilities</span>
        <h2 className="text-3xl sm:text-4xl font-black lp-text tracking-tight">One unified platform. Complete control.</h2>
        <p className="text-base font-medium lp-secondary">A comprehensive billing operating system designed as the single source of truth for your monetization.</p>
      </div>
        <motion.div ref={ref} variants={containerVariants} initial="hidden" animate={inView ? "visible" : "hidden"} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div key={f.title} variants={cardVariants} className="group relative">
                <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative lp-glass rounded-2xl p-7 h-full hover:opacity-90 transition-colors">
                  <div className="h-10 w-10 rounded-xl lp-surface border lp-border-glass flex items-center justify-center mb-5">
                    <Icon className="h-5 w-5 lp-accent" />
                  </div>
                  <h3 className="text-sm font-bold lp-text mb-2">{f.title}</h3>
                  <p className="text-sm lp-secondary font-medium leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}