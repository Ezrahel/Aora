import { motion } from "motion/react";
import { Sparkles, Brain, MessageSquare, Zap } from "lucide-react";

const prompts = [
  "Show me customers with past due invoices",
  "Create a new usage-based plan for my enterprise tier",
  "Why did churn increase last month?",
  "Compare MRR growth across my plans",
];

const messages = [
  { role: "user", text: "Create a new usage-based plan for my enterprise tier" },
  { role: "assistant", text: "I've created a hybrid **Enterprise Plus** plan: ₦75,000/mo base, 500k included API calls, ₦0.05 per additional call. Active in your catalog." },
  { role: "user", text: "Show me customers with past due invoices" },
  { role: "assistant", text: "3 customers with past due invoices:\n• **Acme Corp** — INV-2026-012 — ₦45,000 — 12 days overdue\n• **Linear Tech** — INV-2026-008 — ₦120,500 — 8 days overdue\n• **Stellar Inc** — INV-2026-015 — ₦15,000 — 3 days overdue" },
];

export default function AIBillingAssistant() {
  return (
    <section className="py-16 relative overflow-hidden lp-bg" style={{ backgroundImage: "linear-gradient(to bottom, var(--lp-bg), var(--lp-grad-stop), var(--lp-bg))" }}>
      <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: "var(--lp-glow)" }} />
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <motion.div className="lg:col-span-5 space-y-6" initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">AI Billing Assistant</span>
            <h2 className="text-3xl sm:text-4xl font-black lp-text tracking-tight">Your billing team, amplified by AI</h2>
            <p className="text-sm lp-secondary font-medium leading-relaxed">Powered by Gemini. Ask natural language questions about your revenue, create plans, inspect customers, or run pricing simulations. Real results, not chatbot nonsense.</p>
            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-bold lp-muted/50 uppercase tracking-widest block">Try asking</span>
              {prompts.map((p) => (
                <div key={p} className="flex items-center gap-3 p-3 rounded-xl lp-surface border lp-border-glass hover:border-[var(--lp-text)]/20 transition-all cursor-pointer group">
                  <Zap className="h-3.5 w-3.5 lp-muted shrink-0" />
                  <span className="text-xs lp-secondary group-hover:lp-text transition-colors">&ldquo;{p}&rdquo;</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[10px] lp-secondary"><Brain className="h-3.5 w-3.5 lp-muted" />Powered by Google Gemini — all actions are logged and reversible</div>
          </motion.div>
          <motion.div className="lg:col-span-7" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.15 }}>
            <div className="lp-glass border lp-border-glass rounded-3xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b lp-divider">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl lp-surface border lp-border-glass flex items-center justify-center"><Sparkles className="h-4 w-4 lp-accent" /></div>
                  <div>
                    <div className="text-sm font-bold lp-text">Billing AI</div>
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Online — Gemini 2.0</div>
                  </div>
                </div>
                <span className="text-[9px] lp-surface lp-secondary px-2.5 py-1 rounded-full font-mono">v2.1</span>
              </div>
              <div className="px-6 py-5 space-y-4 max-h-[400px] overflow-y-auto">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.role === "assistant" && <div className="h-8 w-8 rounded-lg lp-surface border lp-border-glass flex items-center justify-center shrink-0 mt-0.5"><Brain className="h-4 w-4 lp-accent" /></div>}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${msg.role === "user" ? "lp-card" : "lp-glass border lp-border-glass"}`}>
                      {msg.text.split("\n").map((line, j) => <p key={j} className={j > 0 ? "mt-1" : ""}>{line}</p>)}
                    </div>
                    {msg.role === "user" && <div className="h-8 w-8 rounded-lg lp-surface border lp-border-glass flex items-center justify-center shrink-0 mt-0.5"><MessageSquare className="h-4 w-4 lp-accent" /></div>}
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t lp-divider lp-surface">
                <div className="flex items-center gap-3 lp-glass border lp-border-glass rounded-xl px-4 py-3">
                  <input type="text" placeholder="Ask anything about your billing..." className="flex-1 bg-transparent text-xs lp-text placeholder-lp-secondary outline-none" readOnly />
                  <span className="text-[9px] lp-secondary font-mono">⏎ Enter</span>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[9px] lp-muted/50"><Sparkles className="h-3 w-3 lp-muted" />Can create plans, add notes, query customers, and simulate pricing</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}