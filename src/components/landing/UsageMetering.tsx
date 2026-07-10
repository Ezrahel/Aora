import { useState } from "react";
import { motion } from "motion/react";
import { Zap, RotateCw } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const generateStream = () => {
  const data = [];
  for (let i = 0; i < 20; i++) data.push({ time: `${i * 3}s`, events: Math.floor(Math.random() * 800) + 200 });
  return data;
};

export default function UsageMetering() {
  const [streamData, setStreamData] = useState(generateStream());
  const [logs, setLogs] = useState<string[]>([
    "[21:04:12] EVENT: billing.track(cust_98, 'compute_units', 1200) ingested.",
    "[21:04:09] EVENT: billing.track(cust_12, 'api_calls', 3400) ingested.",
    "[21:03:55] EVENT: billing.track(cust_45, 'storage_gb', 85) ingested.",
  ]);

  const triggerEvent = () => {
    const now = new Date().toLocaleTimeString();
    const units = Math.floor(Math.random() * 5000) + 100;
    setLogs((prev) => [`[${now}] EVENT: billing.track(cust_${Math.floor(Math.random() * 100)}, 'compute_units', ${units}) ingested.`, ...prev.slice(0, 4)]);
    setStreamData(generateStream());
  };

  return (
    <section className="py-16 relative overflow-hidden lp-bg" style={{ backgroundImage: "linear-gradient(to bottom, var(--lp-bg), var(--lp-grad-stop), var(--lp-bg))" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <motion.div className="lg:col-span-5 space-y-6" initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">Usage Metering</span>
            <h2 className="text-3xl sm:text-4xl font-black lp-text tracking-tight">Track everything. Bill accurately.</h2>
            <p className="text-base lp-secondary font-medium leading-relaxed">Ingestion endpoint for usage events. Bulk import via CSV. Quota tracking. Credit ledger with grant/deduct. Aggregate usage per customer per billing period.</p>
            <div className="flex gap-3 pt-2">
              <button onClick={triggerEvent} className="px-4 py-2.5 lp-card rounded-xl transition-all cursor-pointer flex items-center gap-2 text-[11px] font-bold lp-text">
                <Zap className="h-3.5 w-3.5" />Simulate Event
              </button>
              <button onClick={() => setStreamData(generateStream())} className="px-4 py-2.5 lp-surface border lp-border-glass rounded-xl transition-all cursor-pointer flex items-center gap-2 text-[11px] font-semibold lp-secondary">
                <RotateCw className="h-3.5 w-3.5" />Refresh
              </button>
            </div>
          </motion.div>
          <motion.div className="lg:col-span-7 space-y-4" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.15 }}>
            <div className="lp-glass border lp-border-glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs font-bold lp-text">Event Ingestion Stream</div>
                  <div className="text-[10px] lp-secondary font-mono mt-0.5">{streamData.reduce((a, b) => a + b.events, 0).toLocaleString()} events / min</div>
                </div>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase">Real-time</span>
              </div>
              <div className="h-24 sm:h-28 md:h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={streamData}>
                    <defs><linearGradient id="usageGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--lp-accent)" stopOpacity={0.2} /><stop offset="100%" stopColor="var(--lp-accent)" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke="var(--lp-chart-grid)" />
                    <XAxis dataKey="time" stroke="var(--lp-chart-axis)" fontSize={8} tickLine={false} />
                    <YAxis stroke="var(--lp-chart-axis)" fontSize={8} tickLine={false} />
                    <Tooltip contentStyle={{ background: "var(--lp-tooltip-bg)", border: "1px solid var(--lp-tooltip-border)", borderRadius: "8px", fontSize: "10px" }} />
                    <Area type="monotone" dataKey="events" stroke="var(--lp-accent)" strokeWidth={2} fillOpacity={1} fill="url(#usageGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="lp-glass border lp-border-glass rounded-2xl p-5">
              <div className="text-[9px] font-bold lp-secondary uppercase tracking-widest mb-3">Live Ingestion Log</div>
              <div className="space-y-1.5 font-mono text-[10px]">
                {logs.map((log, i) => (
                  <div key={i} className={`flex gap-2 ${i === 0 ? "lp-text" : "lp-muted"}`}>
                    <span className="shrink-0">▸</span><span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}