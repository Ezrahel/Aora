import { motion } from "motion/react";
import { SectionHead } from "./ui/primitives";

const ROWS = [
  {
    file: "gateways",
    removed: "Couple your codebase to one gateway's SDK. Switching means rewiring the whole billing pipeline.",
    added: "An adapter layer. Swap Stripe for Paystack with a config change: same billing logic, different rail.",
  },
  {
    file: "pricing",
    removed: "Hardcode if (plan === 'pro') everywhere. Each pricing experiment is a deployment.",
    added: "A declarative engine for flat, seat, usage, hybrid, tiered, volume, and package. Change it in the UI, not the code.",
  },
  {
    file: "secrets",
    removed: "Keep API keys in .env, or worse, in plaintext columns. Rotating them means downtime.",
    added: "AES-256-GCM at rest. Decrypted in memory per request. Never logged, never exposed.",
  },
  {
    file: "revenue",
    removed: "Piece together gateway exports, usage tables, and a reconciliation spreadsheet.",
    added: "Usage events and payment events reconciled automatically, in real time.",
  },
];

export default function Problem() {
  return (
    <section id="problem" data-scene="problem" className="lp-section lp-rule">
      <div className="lp-wrap">
        <SectionHead
          index="01"
          label="The problem"
          title="Billing is the last infrastructure tax on SaaS."
          body="Every team hits the same four walls. Here is the diff."
        />

        <div className="mt-12 border lp-border-glass bg-[var(--lp-scrim)] backdrop-blur-md">
          <div className="px-4 h-10 flex items-center border-b lp-divider lp-data lp-secondary">billing.diff</div>
          {ROWS.map((row, i) => (
            <div key={row.file} className={`grid grid-cols-1 lg:grid-cols-[9rem_1fr] ${i > 0 ? "border-t lp-divider" : ""}`}>
              <div className="px-4 pt-4 lg:py-5 lp-data lp-muted">@@ {row.file}</div>
              <div className="pb-4 lg:py-3 lp-data !text-[13px]">
                <motion.p
                  className="flex gap-3 px-4 py-1.5 lp-muted"
                  initial={{ opacity: 1 }}
                  whileInView={{ opacity: 0.72 }}
                  viewport={{ once: true, margin: "-120px" }}
                  transition={{ duration: 0.5, delay: 0.1 + i * 0.12 }}
                >
                  <span aria-hidden="true">-</span>
                  <span className="relative">
                    <span className="sr-only">Before: </span>
                    {row.removed}
                  </span>
                </motion.p>
                <motion.p
                  className="flex gap-3 px-4 py-1.5 bg-[var(--lp-surface)] lp-text"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-120px" }}
                  transition={{ duration: 0.5, delay: 0.25 + i * 0.12 }}
                >
                  <span aria-hidden="true">+</span>
                  <span>
                    <span className="sr-only">With AoraHQ: </span>
                    {row.added}
                  </span>
                </motion.p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
