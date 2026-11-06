import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { Panel } from "./ui/primitives";
import { GateDemo, InvoiceDemo, RateDemo, ReconcileDemo, TrackDemo } from "./PipelineDemos";

const STAGES: { id: string; verb: string; title: string; body: string; demo: ReactNode }[] = [
  {
    id: "track",
    verb: "Track",
    title: "Every event, counted once.",
    body: "Ingest usage from your product, one event at a time or 1,000 per batch. Two-layer deduplication with a 24-hour window means retries never become double charges.",
    demo: <TrackDemo />,
  },
  {
    id: "rate",
    verb: "Rate",
    title: "Usage becomes line items.",
    body: "The pricing engine applies allowances, overage, and tiers per customer per period. Mid-cycle seat changes prorate on their own, charge or credit.",
    demo: <RateDemo />,
  },
  {
    id: "gate",
    verb: "Gate",
    title: "Access follows the plan.",
    body: "Map features to plans and check them in real time. Move a feature between tiers in the dashboard without a redeploy.",
    demo: <GateDemo />,
  },
  {
    id: "invoice",
    verb: "Invoice",
    title: "A lifecycle, not a cron job.",
    body: "Draft, open, then paid or past due. Failed payments enter a dunning state machine that retries on day 0, 3, and 7 before anyone has to chase them.",
    demo: <InvoiceDemo />,
  },
  {
    id: "reconcile",
    verb: "Reconcile",
    title: "Two ledgers, one truth.",
    body: "This is the helix: usage events on one strand, payment events on the other, and every line item a rung between them. MRR, ARR, and churn come from what actually settled.",
    demo: <ReconcileDemo />,
  },
];

function TiltStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [16, 0, -12]);
  const rotateY = useTransform(scrollYProgress, [0, 0.5, 1], [-12, -3, 8]);
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [40, 0, -40]);

  return (
    <div ref={ref} style={{ perspective: 1400 }}>
      <motion.div style={{ rotateX, rotateY, y, transformStyle: "preserve-3d" }}>
        <Panel className="lp-panel-solid shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">{children}</Panel>
      </motion.div>
    </div>
  );
}

export default function Pipeline() {
  const [active, setActive] = useState(0);
  const stages = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(stages.current.indexOf(entry.target as HTMLElement));
        }
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );
    stages.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="pipeline" data-scene="pipelineStart" data-scene-end="pipelineEnd" className="relative z-10 lp-rule">
      <div className="lp-wrap grid grid-cols-1 lg:grid-cols-12 gap-x-10">
        <div className="lg:col-span-5 pt-20 lg:pt-0">
          <div className="lg:sticky lg:top-0 lg:h-svh lg:flex lg:flex-col lg:justify-center">
            <div className="lg:bg-[var(--lp-glass)] lg:backdrop-blur-xl lg:border lg:border-[var(--lp-glass-border)] lg:p-7">
            <p className="lp-label">
              <span className="lp-muted">02 //</span> The pipeline
            </p>
            <h2 className="lp-h2 !text-[clamp(2rem,3.4vw,3rem)] mt-4 max-w-md">From raw event to settled revenue.</h2>
            <ol className="hidden lg:block mt-10 space-y-1" aria-label="Pipeline stages">
              {STAGES.map((stage, i) => (
                <li key={stage.id}>
                  <a
                    href={`#stage-${stage.id}`}
                    aria-current={active === i ? "step" : undefined}
                    className={`flex items-center gap-3 py-1.5 lp-data !text-[13px] transition-colors ${active === i ? "lp-text" : "lp-muted hover:text-[var(--lp-text)]"}`}
                  >
                    <span className={`h-px transition-all duration-500 ${active === i ? "w-10 bg-[var(--lp-text)]" : "w-4 bg-[var(--lp-tick)]"}`} />
                    {String(i + 1).padStart(2, "0")} {stage.verb}
                  </a>
                </li>
              ))}
            </ol>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          {STAGES.map((stage, i) => (
            <article
              key={stage.id}
              id={`stage-${stage.id}`}
              ref={(node) => {
                stages.current[i] = node;
              }}
              className="min-h-0 lg:min-h-[92svh] py-14 lg:py-16 flex flex-col justify-center scroll-mt-10"
            >
              <p className="lp-label">
                {String(i + 1).padStart(2, "0")} {stage.verb}
              </p>
              <h3 className="text-2xl lg:text-[2rem] leading-tight tracking-[-0.03em] font-medium lp-text mt-3">{stage.title}</h3>
              <p className="lp-body mt-3 max-w-xl">{stage.body}</p>
              <div className="mt-7">
                <TiltStage>{stage.demo}</TiltStage>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
