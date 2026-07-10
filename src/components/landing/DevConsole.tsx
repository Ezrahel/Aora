import { useState } from "react";
import { motion } from "motion/react";
import { Terminal, Copy, Check } from "lucide-react";

type CodeTab = "track" | "can" | "calculate";

const codeSnippets: Record<CodeTab, { code: string; response: string; responseColor: string }> = {
  track: { code: `// Ingest usage events in real-time\nawait billing.track(\n  "cust_89b2",\n  "lead_generated",\n  1\n);`, response: `{\n  "status": "success",\n  "event_id": "ev_80b1e2",\n  "credits_remaining": 8200\n}`, responseColor: "lp-secondary" },
  can: { code: `// Check entitlements before gating a feature\nconst authorized = await billing.can(\n  "cust_89b2",\n  "pro_features"\n);`, response: `{\n  "allowed": true,\n  "reason": "Plan Growth valid",\n  "limits": {\n    "leads_limit": 50000,\n    "leads_current": 18500\n  }\n}`, responseColor: "text-emerald-400" },
  calculate: { code: `// Preview an invoice before charging\nconst invoice = await billing.calculate(\n  "cust_89b2"\n);`, response: `{\n  "customer_id": "cust_89b2",\n  "base_fee": 15000,\n  "usage_overage": 4200,\n  "total": 17700,\n  "currency": "NGN"\n}`, responseColor: "lp-accent" },
};

export default function DevConsole() {
  const [activeTab, setActiveTab] = useState<CodeTab>("track");
  const [copied, setCopied] = useState(false);
  const { code, response, responseColor } = codeSnippets[activeTab];
  const handleCopy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <section id="developers" className="py-16 relative overflow-hidden lp-bg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <motion.div className="lg:col-span-5 space-y-6" initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">Built Dev-First</span>
            <h2 className="text-3xl sm:text-4xl font-black lp-text tracking-tight">Billing infrastructure developers actually enjoy using</h2>
            <p className="text-sm lp-secondary font-medium leading-relaxed">Integrate in minutes. Dispatch lightweight telemetry events when actions occur — we handle the pricing, pro-rata calculations, and ledger updates.</p>
            <div className="flex items-center gap-2 text-xs lp-secondary"><Terminal className="h-4 w-4 lp-muted" />No complex billing logic. Just track, can, and calculate.</div>
          </motion.div>
          <motion.div className="lg:col-span-7" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.15 }}>
            <div className="lp-glass border lp-border-glass rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-5 py-3 border-b lp-divider lp-surface">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5"><span className="h-3 w-3 rounded-full bg-red-500/60" /><span className="h-3 w-3 rounded-full lp-muted" style={{ backgroundColor: "var(--lp-muted)" }} /><span className="h-3 w-3 rounded-full bg-emerald-500/60" /></div>
                  <span className="text-[10px] font-mono lp-secondary">aora-billing-console</span>
                </div>
                <button onClick={handleCopy} className="lp-secondary hover:lp-text transition-colors cursor-pointer">{copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}</button>
              </div>
              <div className="flex border-b lp-divider">
                {(["track", "can", "calculate"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2.5 text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer ${activeTab === tab ? "lp-text border-b-2 border-[var(--lp-text)] lp-surface" : "lp-secondary hover:lp-text"}`}>billing.{tab}()</button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x lp-divider">
                <div className="md:col-span-7 p-5"><pre className="font-mono text-xs leading-relaxed text-[#9CDCF0]"><code>{code}</code></pre></div>
                <div className="md:col-span-5 p-5 lp-surface">
                  <div className="text-[9px] font-bold lp-secondary uppercase tracking-widest mb-3">Response</div>
                  <pre className={`font-mono text-[10px] leading-relaxed ${responseColor}`}><code>{response}</code></pre>
                  <div className="mt-4 pt-3 border-t lp-divider flex items-center justify-between text-[9px]"><span className="lp-secondary uppercase tracking-wider">Latency</span><span className="text-emerald-400 font-bold">12ms — SLA guaranteed</span></div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}