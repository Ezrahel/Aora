import { useState, useEffect, useRef } from "react";
import { ArrowRight, CheckCircle2, Activity, Sparkles, Shield } from "lucide-react";
import { motion } from "motion/react";
import { type Variants } from "framer-motion";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface HeroProps {
  onNavigateTab: (tab: string) => void;
}

const chartData = [
  { month: "Jan", mrr: 1540000, usage: 102000 },
  { month: "Feb", mrr: 1820000, usage: 154000 },
  { month: "Mar", mrr: 2100000, usage: 198000 },
  { month: "Apr", mrr: 2450000, usage: 220000 },
  { month: "May", mrr: 2900000, usage: 310000 },
  { month: "Jun", mrr: 3600000, usage: 420000 },
];

function useCountUp(end: number, duration: number, started: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!started) return;
    let startTime: number | null = null;
    const animate = (now: number) => {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration, started]);
  return count;
}

function StatCard({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const count = useCountUp(value, 2000, started);

  return (
    <div ref={ref} className="p-4 rounded-2xl border lp-border-glass lp-surface">
      <div className="text-[9px] font-bold lp-secondary uppercase tracking-widest">{label}</div>
      <div className="text-xl font-bold font-mono lp-text mt-1">
        {count.toLocaleString()}{suffix}
      </div>
    </div>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut" as const,
    },
  },
} satisfies Variants;

export default function Hero({ onNavigateTab }: HeroProps) {
  return (
    <section id="hero" className="relative min-h-screen pt-32 pb-20 overflow-hidden lp-bg">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] sm:w-[600px] lg:w-[800px] h-[300px] sm:h-[450px] lg:h-[600px] rounded-full blur-[80px] sm:blur-[100px] lg:blur-[120px] pointer-events-none" style={{ backgroundColor: "var(--lp-glow)" }} />
      <div className="absolute bottom-0 right-0 w-[300px] sm:w-[450px] lg:w-[600px] h-[200px] sm:h-[300px] lg:h-[400px] rounded-full blur-[60px] sm:blur-[80px] lg:blur-[100px] pointer-events-none" style={{ backgroundColor: "var(--lp-glow)" }} />

      <motion.div
        className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="lg:col-span-5 space-y-8" variants={itemVariants}>
        

          <h1 className="text-4xl sm:text-5xl lg:text-[56px] lg:leading-[1.08] font-black tracking-tight lp-text">
            Billing infrastructure that
            <span className="block mt-2 lp-accent">
              bends to your business model.
            </span>
          </h1>

          <p className="text-base sm:text-lg lp-secondary font-medium leading-relaxed max-w-lg">
            A developer-first billing orchestration engine. Bring your Stripe, Paystack, or Flutterwave keys. 
            We handle pricing, metering, entitlements, and revenue analytics in one unified platform.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => onNavigateTab("waitlist")}
              className="px-7 py-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 group"
              style={{ backgroundColor: "var(--lp-btn-bg)", color: "var(--lp-btn-text)" }}
            >
              Connect Your Gateway
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="px-7 py-3.5 lp-surface border lp-border-glass lp-secondary font-semibold text-sm rounded-xl transition-all cursor-pointer hover:opacity-80"
            >
              See How It Works
            </button>
          </div>

          <div className="flex flex-wrap gap-6 pt-4">
            {[
              { icon: Shield, text: "AES-256-GCM encrypted" },
              { icon: CheckCircle2, text: "Multi-gateway support" },
              { icon: Sparkles, text: "AI-powered billing" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-xs lp-secondary">
                <Icon className="h-3.5 w-3.5 lp-muted" />
                {text}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div className="lg:col-span-7" variants={itemVariants}>
          <div className="relative">
            <div className="lp-glass border lp-border-glass rounded-3xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b lp-divider pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                    <span className="h-2.5 w-2.5 rounded-full lp-muted" style={{ backgroundColor: "var(--lp-muted)" }} />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                  </div>
                  <span className="text-[10px] font-mono lp-secondary">AoraHQ Ledger — Live</span>
                </div>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                  System Online
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard label="Monthly Recurring Revenue" value={3600000} suffix="" />
                <StatCard label="Active Subscriptions" value={1248} suffix="" />
                <StatCard label="Events Ingested (30d)" value={2410250} suffix="" />
              </div>

              <div className="h-24 sm:h-28 md:h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="heroMrr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--lp-accent)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--lp-accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--lp-chart-grid)" />
                    <XAxis dataKey="month" stroke="var(--lp-chart-axis)" fontSize={9} tickLine={false} />
                    <YAxis stroke="var(--lp-chart-axis)" fontSize={9} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--lp-tooltip-bg)",
                        border: "1px solid var(--lp-tooltip-border)",
                        borderRadius: "8px",
                        fontSize: "10px",
                      }}
                    />
                    <Area type="monotone" dataKey="mrr" stroke="var(--lp-accent)" strokeWidth={2} fillOpacity={1} fill="url(#heroMrr)" name="MRR (NGN)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between text-[10px] lp-secondary pt-2 border-t lp-divider">
                <span className="flex items-center gap-1.5">
                  <Activity className="h-3 w-3 lp-muted" />
                  Real-time data from connected gateways
                </span>
                <span className="font-mono lp-muted">&lt; 50ms latency</span>
              </div>
            </div>

            <div className="absolute -inset-4 -z-10 blur-[60px] rounded-3xl pointer-events-none" style={{ backgroundColor: "var(--lp-glow)" }} />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}