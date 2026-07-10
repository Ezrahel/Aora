import { motion } from "motion/react";
import { useRef, useState, useEffect } from "react";

const painPoints = [
  {
    pain: "Multi-gateway",
    oldWay: "Couple your codebase to Stripe's SDK. Switching to Paystack means rewiring your entire billing pipeline.",
    solution: "Abstracted adapter layer — swap gateways with a config change. Same billing logic, different payment rail.",
  },
  {
    pain: "Pricing flexibility",
    oldWay: "Hardcode `if (plan === 'pro')` everywhere. Each pricing experiment is a deployment.",
    solution: "Declarative pricing engine — flat, hybrid, tiered, volume, package, per-seat. Change pricing in the UI, not in the code.",
  },
  {
    pain: "Key security",
    oldWay: "Store API keys in .env or worse, in the database in plaintext. Rotating keys means downtime.",
    solution: "AES-256-GCM encryption at rest. Decrypted in-memory per request. Never logged. Never exposed.",
  },
  {
    pain: "Revenue visibility",
    oldWay: "Piece together Stripe data, usage metrics from your DB, and manual spreadsheet reconciliation.",
    solution: "Real-time dual-data sync — usage events from your product + payment events from your gateway, reconciled automatically.",
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.2 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export default function Problem() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: "-100px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="problem" className="py-16 relative lp-bg" style={{ backgroundImage: "linear-gradient(to bottom, transparent, var(--lp-grad-stop), transparent)" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-8">
          <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">
            The Problem With Billing Today
          </span>
          <h2 className="text-3xl sm:text-4xl font-black lp-text tracking-tight">
            Billing is the last infrastructure tax on SaaS
          </h2>
          <p className="text-sm lp-secondary font-medium max-w-xl mx-auto">
            Every team hits the same walls. Here's how we tear them down.
          </p>
        </div>

        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="space-y-6 max-w-5xl mx-auto"
        >
          {painPoints.map((item, i) => (
            <motion.div key={item.pain} variants={cardVariants} className="group relative">
              <div className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-sm" style={{ backgroundImage: "linear-gradient(to right, var(--lp-glow), var(--lp-grad-stop), var(--lp-glow))" }} />
              <div className="relative lp-glass rounded-2xl p-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                  <div className="md:col-span-1">
                    <span className="text-[10px] font-mono font-bold lp-secondary/50">0{i + 1}</span>
                  </div>
                  <div className="md:col-span-3">
                    <h3 className="text-lg font-bold lp-text">{item.pain}</h3>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="h-px flex-1 lp-divider" />
                      <span className="text-[9px] font-bold text-red-400/70 uppercase tracking-wider">Pain</span>
                    </div>
                    <p className="text-sm text-red-400/60 font-medium mt-3 leading-relaxed">{item.oldWay}</p>
                  </div>
                  <div className="md:col-span-1 flex justify-center">
                    <div className="h-px w-full md:h-full md:w-px lp-divider" />
                  </div>
                  <div className="md:col-span-7">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="h-5 w-5 rounded-full lp-surface border lp-border-glass flex items-center justify-center">
                        <span className="h-2 w-2 rounded-full lp-accent" />
                      </span>
                      <span className="text-[9px] font-bold lp-accent uppercase tracking-wider">AoraHQ</span>
                    </div>
                    <p className="text-sm lp-secondary font-medium leading-relaxed">{item.solution}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}