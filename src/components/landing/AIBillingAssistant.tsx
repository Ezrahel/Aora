import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Panel, SectionHead, useOnScreen } from "./ui/primitives";

const EXCHANGES = [
  {
    ask: "Create a usage-based plan for my enterprise tier",
    reply: ["Created Enterprise Plus as a hybrid plan:", "$749/mo base, 500k API calls included, $0.05 per additional call.", "It's active in your catalog."],
  },
  {
    ask: "Show me customers with past due invoices",
    reply: ["3 past due invoices:", "Acme Corp, INV-2026-012, $449, 12 days overdue", "Linear Tech, INV-2026-008, $1,199, 8 days overdue", "Stellar Inc, INV-2026-015, $149, 3 days overdue"],
  },
  {
    ask: "Why did churn increase last month?",
    reply: ["Churn rose after failed renewals on the Starter plan.", "Most lapsed accounts had a past due invoice before cancelling.", "Want me to compare dunning outcomes by gateway?"],
  },
];

export default function AIBillingAssistant() {
  const reduced = useReducedMotion();
  const [ref, visible] = useOnScreen<HTMLDivElement>();
  const [active, setActive] = useState(0);
  const [typed, setTyped] = useState(0);
  const exchange = EXCHANGES[active];
  const done = typed >= exchange.ask.length;

  useEffect(() => {
    if (reduced) {
      setTyped(exchange.ask.length);
      return;
    }
    if (!visible || done) return;
    const timer = setTimeout(() => setTyped((n) => n + 1), 26);
    return () => clearTimeout(timer);
  }, [visible, typed, done, reduced, exchange.ask.length]);

  const choose = (index: number) => {
    setActive(index);
    setTyped(0);
  };

  return (
    <section data-scene="assistant" className="lp-section lp-rule">
      <div className="lp-wrap">
        <SectionHead
          index="06"
          label="AI billing assistant"
          align="center"
          title="Ask your ledger anything."
          body="Powered by Gemini. Query revenue, inspect customers, and create plans in plain language. Replies below are sample output."
        />

        <div ref={ref} className="mt-10 max-w-3xl mx-auto">
          <Panel className="lp-panel-solid">
            <div className="flex items-center gap-3 h-14 px-4 border-b lp-divider">
              <Sparkles className="h-4 w-4 lp-secondary shrink-0" />
              <p className="text-[15px] lp-text truncate" aria-live="polite">
                {exchange.ask.slice(0, typed)}
                {!done && <span className="inline-block w-px h-4 align-[-2px] bg-[var(--lp-text)] ml-0.5" />}
              </p>
            </div>
            <div className="p-5 min-h-[10rem]">
              <AnimatePresence mode="wait">
                {done && (
                  <motion.div key={active} className="space-y-1.5" initial="hidden" animate="shown" exit={{ opacity: 0 }} variants={{ shown: { transition: { staggerChildren: 0.14 } } }}>
                    {exchange.reply.map((line, i) => (
                      <motion.p
                        key={line}
                        variants={{ hidden: { opacity: 0, y: 6 }, shown: { opacity: 1, y: 0 } }}
                        className={i === 0 ? "text-[15px] lp-text" : "lp-data !text-[13px] lp-secondary"}
                      >
                        {line}
                      </motion.p>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Panel>
          <div className="mt-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Example questions">
            {EXCHANGES.map((item, i) => (
              <button key={item.ask} className="lp-chip !h-auto py-2 whitespace-normal text-left" aria-pressed={active === i} onClick={() => choose(i)}>
                {item.ask}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
