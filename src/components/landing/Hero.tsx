import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PRESETS, PRICE_TYPES, type PriceType } from "./pricing-model";
import { setScenePlan } from "./scene/store";
import { useOnScreen } from "./ui/primitives";

interface HeroProps {
  onNavigateTab: (tab: string) => void;
}

const HOLD_MS = 3400;
const DEFAULT_PHRASE = "your business model.";

const CUES: Record<PriceType, string> = {
  flat: "constant radius, one committed fee",
  seat: "discrete groups, one per seat block",
  usage: "opens continuously with consumption",
  hybrid: "steady base, flares past the allowance",
  tiered: "a visible step at every tier boundary",
  volume: "whole sections shift bracket together",
  package: "fused blocks, sold whole",
};

const FACTS = [
  ["7", "pricing models"],
  ["3 + sandbox", "gateways"],
  ["AES-256-GCM", "keys at rest"],
  ["24h", "dedup window"],
];

export default function Hero({ onNavigateTab }: HeroProps) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<PriceType | null>(null);
  const [pinned, setPinned] = useState(false);
  const [ref, visible] = useOnScreen<HTMLElement>();

  // Walks the models while the hero is on screen, until the visitor picks one.
  useEffect(() => {
    if (pinned || reduced || !visible) return;
    const timer = setInterval(() => {
      setActive((current) => {
        const index = current ? PRICE_TYPES.findIndex((type) => type.id === current) : 2;
        return PRICE_TYPES[(index + 1) % PRICE_TYPES.length].id;
      });
    }, HOLD_MS);
    return () => clearInterval(timer);
  }, [pinned, reduced, visible]);

  useEffect(() => {
    if (active) setScenePlan(PRESETS[active]);
  }, [active]);

  const select = (id: PriceType) => {
    setPinned(true);
    setActive(id);
  };

  const phrase = active ? `${PRICE_TYPES.find((type) => type.id === active)?.phrase}.` : DEFAULT_PHRASE;
  const shown = active ?? "hybrid";

  return (
    <section ref={ref} id="hero" data-scene="hero" className="relative z-10 min-h-svh flex flex-col">
      <div className="lp-wrap flex-1 flex flex-col justify-center pt-28 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
          className="max-w-[52rem]"
        >
          <p className="lp-label">Billing orchestration // bring your own keys</p>

          <h1 className="lp-display mt-6">
            <span className="sr-only">Billing infrastructure that bends to your business model.</span>
            <span aria-hidden="true">
              Billing infrastructure
              <br />
              that bends to
              <br />
              <span className="relative block h-[1.08em] overflow-visible whitespace-nowrap">
                <AnimatePresence initial={false}>
                  <motion.span
                    key={phrase}
                    className="absolute left-0 top-0"
                    initial={{ opacity: 0, filter: "blur(14px)", y: "0.18em" }}
                    animate={{ opacity: 1, filter: "blur(0px)", y: 0, transitionEnd: { filter: "none" } }}
                    exit={{ opacity: 0, filter: "blur(14px)", y: "-0.18em" }}
                    transition={{ duration: 0.38, ease: "easeOut" }}
                  >
                    {phrase}
                  </motion.span>
                </AnimatePresence>
              </span>
            </span>
          </h1>

          <p className="lp-lede mt-7 max-w-[34rem]">
            Bring your Stripe, Paystack, or Flutterwave keys. AoraHQ handles pricing, metering, entitlements, and revenue
            analytics in one engine, and never touches the money.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-8">
            <button onClick={() => onNavigateTab("dashboard")} className="lp-btn group">
              Connect your gateway
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => document.getElementById("pipeline")?.scrollIntoView({ behavior: "smooth" })}
              className="lp-btn lp-btn-ghost"
            >
              See how it works
            </button>
          </div>
        </motion.div>
      </div>

      <div className="border-t lp-divider bg-[var(--lp-scrim)] backdrop-blur-xl">
        <div className="lp-wrap py-3.5 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-8">
          <div className="flex items-center gap-2 overflow-x-auto -mx-6 px-6 lg:mx-0 lg:px-0 [scrollbar-width:none]" role="group" aria-label="Bend the helix to a pricing model">
            {PRICE_TYPES.map((type) => (
              <button key={type.id} className="lp-chip" aria-pressed={active === type.id} onClick={() => select(type.id)}>
                {type.label}
              </button>
            ))}
          </div>
          <p className="lp-data lp-secondary lg:ml-auto lg:text-right">
            <span className="lp-muted">fig.01 </span>
            {CUES[shown]}
          </p>
        </div>
        <div className="border-t lp-divider">
          <div className="lp-wrap py-2.5 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1">
            {FACTS.map(([value, label]) => (
              <p key={label} className="lp-data">
                <span className="lp-text">{value}</span> <span className="lp-muted">{label}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
