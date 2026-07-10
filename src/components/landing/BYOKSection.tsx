import { useState } from "react";
import { motion } from "motion/react";
import { Eye, EyeOff, CheckCircle2, Shield, KeyRound } from "lucide-react";

function StripeLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.25 15.25c-2.21 0-4-1.54-4-3.75h1.75c0 1.1.98 2 2.25 2s2.25-.9 2.25-2c0-1.1-.98-2-2.25-2-2.21 0-4-1.54-4-3.75s1.79-3.75 4-3.75c2.2 0 4 1.54 4 3.75h-1.75c0-1.1-.98-2-2.25-2s-2.25.9-2.25 2c0 1.1.98 2 2.25 2 2.21 0 4 1.54 4 3.75s-1.79 3.75-4 3.75z" fill="currentColor" className="text-[#635BFF] dark:text-[#877BFF]"/>
    </svg>
  );
}

function PaystackLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" className="text-[#0BA4DB] dark:text-[#1BB5EC]"/>
      <path d="M7.5 8h9l-4.5 8h-9l4.5-8z" fill="white"/>
      <path d="M12 8h4.5l-4.5 8H7.5L12 8z" fill="white" opacity="0.6"/>
    </svg>
  );
}

function FlutterwaveLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M3 5h6l-2 14H1l2-14z" fill="currentColor" className="text-[#FAA21B] dark:text-[#FCB93D]"/>
      <path d="M10 5h6l-2 14H8l2-14z" fill="currentColor" className="text-[#EA6E2A] dark:text-[#F0803A]"/>
      <path d="M17 5h6L21 19h-6l2-14z" fill="currentColor" className="text-[#D4212A] dark:text-[#E4313A]"/>
    </svg>
  );
}

const gateways = [
  { name: "Stripe", logo: StripeLogo, color: "lp-surface border lp-border-glass" },
  { name: "Paystack", logo: PaystackLogo, color: "lp-surface border lp-border-glass" },
  { name: "Flutterwave", logo: FlutterwaveLogo, color: "lp-surface border lp-border-glass" },
];

export default function BYOKSection() {
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [keyValue, setKeyValue] = useState("");

  const handleVerify = () => {
    if (!keyValue.trim()) return;
    setVerifying(true);
    setVerified(false);
    setTimeout(() => { setVerifying(false); setVerified(true); }, 1200);
  };

  return (
    <section className="py-16 relative overflow-hidden lp-bg" style={{ backgroundImage: "linear-gradient(to bottom, var(--lp-bg), var(--lp-grad-stop), var(--lp-bg))" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-6">
          <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">Bring Your Own Keys</span>
          <h2 className="text-3xl sm:text-4xl font-black lp-text tracking-tight">Your gateway. Your keys. Our infrastructure.</h2>
          <p className="text-base font-medium lp-secondary">Pick your payment gateway, paste your keys, and go. We never store them in plaintext.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto">
          <motion.div className="lg:col-span-5 space-y-4" initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            {gateways.map((g) => {
              const Logo = g.logo;
              return (
                <div key={g.name} className={`flex items-center gap-4 p-5 rounded-xl ${g.color}`}>
                  <div className="h-10 w-10 rounded-lg lp-surface flex items-center justify-center">
                    <Logo />
                  </div>
                  <div>
                    <div className="text-sm font-bold lp-text">{g.name}</div>
                    <div className="text-xs lp-secondary font-mono mt-0.5">API v{g.name === "Stripe" ? "2023-10" : "2"}</div>
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] lp-muted/50 text-center pt-2">+ Monnify, SeerBit, and more coming soon</p>
          </motion.div>
          <motion.div className="lg:col-span-7" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.15 }}>
            <div className="lp-glass border lp-border-glass rounded-2xl p-8 space-y-6">
              <div className="flex items-center gap-3">
                <KeyRound className="h-5 w-5 lp-accent" />
                <span className="text-sm font-bold lp-text">Connect your gateway</span>
              </div>
              <div className="relative">
                <div className="flex items-center lp-surface border lp-border-glass rounded-xl overflow-hidden focus-within:border-[var(--lp-text)]/30 transition-colors">
                  <input type={showKey ? "text" : "password"} value={keyValue} onChange={(e) => { setKeyValue(e.target.value); setVerified(false); }} placeholder="sk_live_..." className="flex-1 bg-transparent px-4 py-3 text-xs font-mono lp-text placeholder-lp-secondary outline-none" />
                  <button onClick={() => setShowKey(!showKey)} className="px-3 lp-secondary hover:lp-text cursor-pointer">
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button onClick={handleVerify} disabled={verifying || !keyValue.trim()} className="w-full py-3 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs font-bold" style={{ backgroundColor: verifying || !keyValue.trim() ? "var(--lp-surface)" : "var(--lp-btn-bg)", color: verifying || !keyValue.trim() ? "var(--lp-muted)" : "var(--lp-btn-text)" }}>
                {verifying ? (
                  <><span className="h-4 w-4 border-2 border-[var(--lp-btn-text)] border-t-transparent rounded-full animate-spin" />Verifying...</>
                ) : verified ? (
                  <><CheckCircle2 className="h-4 w-4" />Connected & Verified</>
                ) : ("Verify Connection")}
              </button>
              {verified && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-emerald-400">Connection verified</div>
                    <div className="text-xs lp-secondary font-mono mt-0.5">Gateway: Stripe — Account: acct_1A2B3C4D — Payouts: enabled</div>
                  </div>
                </motion.div>
              )}
              <div className="flex items-center gap-2 text-[10px] lp-secondary"><Shield className="h-3 w-3 lp-muted" />AES-256-GCM encrypted at rest. Decrypted in-memory per request. Never logged.</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
