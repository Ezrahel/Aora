import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, CheckCircle2, Sparkles, ChevronDown, Users, Zap, Shield, Mail, Twitter, Instagram } from "lucide-react";
import { LandingThemeProvider, useLandingTheme } from "./landing/LandingTheme";
import Navbar from "./landing/Navbar";
import Footer from "./landing/Footer";

interface WaitlistViewProps {
  onNavigateTab: (tab: string) => void;
}

const GATEWAYS = ["stripe", "paystack", "flutterwave", "other"];
const MRRS = ["pre-revenue", "<$10k", "$10k-$50k", "$50k-$200k", "$200k+"];

const faqs = [
  { q: "When will I get access?", a: "We onboard in batches. Most teams get access within 48 hours of joining." },
  { q: "What gateways do you support?", a: "Stripe, Paystack, and Flutterwave are live. Monnify and SeerBit are in development." },
  { q: "Do I need to migrate my existing subscriptions?", a: "No. You keep your current billing running while you configure AoraHQ. When you're ready, flip the switch." },
  { q: "What does it cost after the founder's plan?", a: "Pricing starts at ₦0 for the first ₦1M in MRR processed. Transparent, usage-based pricing after that." },
  { q: "Is my data safe?", a: "AES-256-GCM encryption at rest. Your API keys never touch disk in plaintext. SOC 2 audit in progress." },
];

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

function WaitlistForm() {
  const { theme } = useLandingTheme();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "details" | "done">("email");
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [gateway, setGateway] = useState("");
  const [mrr, setMrr] = useState("");
  const [error, setError] = useState("");

  const handleSubmitEmail = async () => {
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setStep("details");
  };

  const handleSubmitAll = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined, company: company || undefined, gateway: gateway || undefined, mrr: mrr || undefined }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text().catch(() => "");
        const snippet = text.slice(0, 200).trim();
        throw new Error(
          `Backend server returned ${res.status} ${res.statusText} (${contentType})` +
          (snippet ? `: ${snippet}` : ""),
        );
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setPosition(data.position);
      setStep("done");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-transparent px-4 py-3 text-sm lp-text placeholder-lp-secondary outline-none border lp-border-glass rounded-xl focus:border-[var(--lp-text)]/30 transition-colors";
  const labelClass = "text-[10px] font-bold lp-secondary uppercase tracking-widest mb-1.5 block";

  return (
    <div className="lp-card border lp-border-glass rounded-3xl p-8 md:p-10 shadow-xl max-w-lg mx-auto">
      {step !== "done" && (
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-2xl lp-surface border lp-border-glass items-center justify-center mb-4">
            <Mail className="h-6 w-6 lp-accent" />
          </div>
          <h3 className="text-xl font-bold lp-text">Get Early Access</h3>
          <p className="text-sm lp-secondary mt-1.5">Join 340+ founders building on AoraHQ.</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === "email" && (
          <motion.div key="email" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputClass} onKeyDown={(e) => e.key === "Enter" && handleSubmitEmail()} />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button onClick={handleSubmitEmail} className="w-full py-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 text-sm font-bold" style={{ backgroundColor: "var(--lp-btn-bg)", color: "var(--lp-btn-text)" }}>
              Get Early Access <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-[10px] lp-muted text-center">No spam. No sales calls. We'll ping you when your spot opens.</p>
          </motion.div>
        )}

        {step === "details" && (
          <motion.div key="details" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <p className="text-xs lp-secondary">Great! Tell us a bit more so we can prioritize your spot.</p>
            <div>
              <label className={labelClass}>Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Company</label>
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Payment gateway</label>
              <select value={gateway} onChange={(e) => setGateway(e.target.value)} className={inputClass}>
                <option value="">Select your gateway</option>
                {GATEWAYS.map((g) => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Monthly revenue</label>
              <select value={mrr} onChange={(e) => setMrr(e.target.value)} className={inputClass}>
                <option value="">Select range</option>
                {MRRS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button onClick={handleSubmitAll} disabled={loading} className="w-full py-3.5 rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-bold" style={{ backgroundColor: "var(--lp-btn-bg)", color: "var(--lp-btn-text)" }}>
              {loading ? <span className="h-4 w-4 border-2 border-[var(--lp-btn-text)] border-t-transparent rounded-full animate-spin" /> : null}
              {loading ? "Submitting..." : "Submit & Join Waitlist"}
            </button>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6 py-4">
            <div className="inline-flex h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold lp-text">You're on the list!</h3>
              <p className="text-sm lp-secondary mt-2">
                You're #{position.toLocaleString()} on the waitlist. We'll email <strong className="lp-text">{email}</strong> when your spot opens.
              </p>
            </div>
            <div className="lp-surface border lp-border-glass rounded-2xl p-5">
              <p className="text-[10px] font-bold lp-secondary uppercase tracking-widest mb-1">Your Founder's Plan</p>
              <p className="text-sm lp-text font-semibold">3 months free on any tier — locked in for life.</p>
            </div>
            <p className="text-[10px] lp-muted">Want to move up? Share this link with your network (coming soon).</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="max-w-2xl mx-auto space-y-2">
      {faqs.map((faq, i) => (
        <div key={i} className="lp-card border lp-border-glass rounded-2xl overflow-hidden">
          <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer transition-colors hover:lp-surface">
            <span className="text-sm font-semibold lp-text">{faq.q}</span>
            <ChevronDown className={`h-4 w-4 lp-muted transition-transform ${open === i ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <p className="px-6 pb-4 text-sm lp-secondary leading-relaxed">{faq.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function CountUp({ end }: { end: number }) {
  const [count, setCount] = useState(0);
  const ref = useState(null);
  return (
    <span className="text-4xl md:text-5xl font-black lp-text font-mono">
      {count.toLocaleString()}+
    </span>
  );
}

export default function WaitlistView({ onNavigateTab }: WaitlistViewProps) {
  return (
    <LandingThemeProvider>
      <div className="min-h-screen lp-bg font-sans antialiased selection:bg-[var(--lp-text)]/10 selection:text-[var(--lp-text)]">
        <Navbar onNavigateTab={onNavigateTab} scrollToId={scrollToId} />

        {/* Hero */}
        <section className="pt-36 pb-20 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: "var(--lp-glow)" }} />
          <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
            

            <h1 className="text-4xl sm:text-5xl lg:text-[56px] lg:leading-[1.08] font-black tracking-tight lp-text">
              Billing infrastructure that bends to your business model is{" "}
              <span className="lp-accent">almost here.</span>
            </h1>

            <p className="text-base sm:text-lg lp-secondary font-medium leading-relaxed max-w-2xl mx-auto">
              We're in private beta with 12 SaaS teams. Join the waitlist and get early access, 
              a dedicated onboarding call, and <strong className="lp-text">3 months free on any plan</strong>.
            </p>

            <WaitlistForm />

            <div className="flex items-center justify-center gap-6 text-[10px] lp-muted">
              <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" />No spam</span>
              <span className="flex items-center gap-1.5"><Users className="h-3 w-3" />No sales calls</span>
              <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" />48hr response</span>
            </div>
          </div>
        </section>

        {/* What you get */}
        <section className="py-20 relative">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center space-y-4 mb-14">
              <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">What you get</span>
              <h2 className="text-3xl sm:text-4xl font-black lp-text tracking-tight">Early access. Concierge onboarding. A deal that lasts.</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {[
                { icon: Zap, title: "Early Access", desc: "Be among the first to integrate AoraHQ. Shape the roadmap with direct feedback to the founding team." },
                { icon: Users, title: "Concierge Onboarding", desc: "A 30-min call with an engineer to map your billing model, connect your gateway, and ingest your first events." },
                { icon: Sparkles, title: "Founder's Plan", desc: "3 months free on any tier, locked in for life. No expiration on your discounted rate. Ever." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="lp-glass border lp-border-glass rounded-2xl p-7 text-center">
                  <div className="inline-flex h-12 w-12 rounded-xl lp-surface border lp-border-glass items-center justify-center mb-5">
                    <Icon className="h-6 w-6 lp-accent" />
                  </div>
                  <h3 className="text-sm font-bold lp-text mb-2">{title}</h3>
                  <p className="text-xs lp-secondary leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center space-y-4 mb-14">
              <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">FAQ</span>
              <h2 className="text-3xl sm:text-4xl font-black lp-text tracking-tight">Questions? We've got answers.</h2>
            </div>
            <FAQ />
          </div>
        </section>

        {/* Trust - Who's behind */}
        <section className="py-20">
          <div className="max-w-3xl mx-auto px-6 text-center space-y-6">
            <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">Who's behind this</span>
            <div className="inline-flex h-20 w-20 rounded-full lp-surface border lp-border-glass items-center justify-center">
              <span className="text-2xl font-bold lp-text">D</span>
            </div>
            <div>
              <h3 className="text-lg font-bold lp-text">Ditech</h3>
              <p className="text-sm lp-secondary mt-2 max-w-lg mx-auto leading-relaxed">
                Building the billing orchestration layer that African SaaS deserves. Previously built payment infrastructure at scale. 
                Stripe, Paystack, Flutterwave — if you've dealt with all three, you know why AoraHQ exists.
              </p>
            </div>
            <div className="flex justify-center gap-4">
              <a href="https://x.com/aorahq" target="_blank" rel="noopener noreferrer" className="lp-muted hover:lp-text transition-colors cursor-pointer"><Twitter className="h-5 w-5" /></a>
              <span className="lp-muted hover:lp-text transition-colors cursor-pointer"><Instagram className="h-5 w-5" /></span>
            </div>
          </div>
        </section>

        <Footer onNavigateTab={onNavigateTab} scrollToId={scrollToId} />
      </div>
    </LandingThemeProvider>
  );
}
