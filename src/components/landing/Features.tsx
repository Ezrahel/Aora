import { useEffect, useState, type ReactNode } from "react";
import { Copy, GitBranch, History, Layers, Send, Timer } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Panel, Reveal, SectionHead, useOnScreen } from "./ui/primitives";

function useBeat(active: boolean, steps: number, ms = 1100) {
  const reduced = useReducedMotion();
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!active || reduced) return;
    const timer = setInterval(() => setBeat((b) => (b + 1) % steps), ms);
    return () => clearInterval(timer);
  }, [active, steps, ms, reduced]);
  return beat;
}

function DedupViz({ on }: { on: boolean }) {
  const beat = useBeat(on, 3);
  return (
    <div className="flex items-center gap-3 lp-data">
      <div className="space-y-1.5 flex-1 min-w-0">
        {[0, 1, 2].map((i) => {
          const dropped = i > 0 && beat > 0;
          return (
            <motion.div key={i} animate={{ opacity: dropped ? 0.3 : 1, x: dropped ? 10 : 0 }} className={`border lp-border-glass px-2 py-1 truncate ${dropped ? "line-through lp-muted" : "lp-text"}`}>
              ev_80b1e2
            </motion.div>
          );
        })}
      </div>
      <div className="w-px self-stretch bg-[var(--lp-divider)]" />
      <div className="text-right">
        <p className="text-3xl font-sans tracking-[-0.04em] lp-text">1</p>
        <p className="lp-muted">counted</p>
      </div>
    </div>
  );
}

function ProrationViz({ on }: { on: boolean }) {
  const beat = useBeat(on, 4);
  const change = 30 + beat * 15;
  return (
    <div className="lp-data">
      <div className="relative h-9 flex">
        <div className="h-full bg-[var(--lp-surface)] border lp-border-glass" style={{ width: `${change}%`, transition: "width 500ms ease" }} />
        <div className="h-full flex-1 bg-[var(--lp-text)] opacity-90" />
        <div className="absolute -inset-y-1 w-px bg-[var(--lp-text)]" style={{ left: `${change}%`, transition: "left 500ms ease" }} />
      </div>
      <div className="flex justify-between mt-2 lp-muted">
        <span>5 seats</span>
        <span className="lp-text">+3 seats, day {Math.round(change * 0.3)}</span>
      </div>
    </div>
  );
}

function TimeViz({ on }: { on: boolean }) {
  const offsets = ["+2h", "+7d", "+30d"];
  const beat = useBeat(on, offsets.length, 1500);
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="lp-data lp-secondary break-all">
        X-AoraHQ-Simulate-Time: <span className="lp-text">{offsets[beat]}</span>
      </p>
      <motion.svg viewBox="0 0 40 40" className="h-12 w-12 shrink-0" animate={{ rotate: beat * 120 }} transition={{ duration: 0.6 }} aria-hidden="true">
        <circle cx="20" cy="20" r="18" fill="none" stroke="var(--lp-tick)" />
        <path d="M20 20V6" stroke="var(--lp-text)" strokeWidth="1.5" />
        <path d="M20 20l8 5" stroke="var(--lp-text)" strokeWidth="1.5" />
      </motion.svg>
    </div>
  );
}

function WebhookViz({ on }: { on: boolean }) {
  const beat = useBeat(on, 5, 800);
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-1.5 flex-1 last:flex-none">
          <span className={`h-2.5 w-2.5 border transition-colors ${i <= beat ? "bg-[var(--lp-text)] border-[var(--lp-text)]" : "border-[var(--lp-tick)]"}`} />
          {i < 4 && <span className="h-px bg-[var(--lp-divider)]" style={{ flexGrow: 2 ** i }} />}
        </div>
      ))}
    </div>
  );
}

function BatchViz({ on }: { on: boolean }) {
  const beat = useBeat(on, 6, 500);
  return (
    <div className="grid grid-cols-[repeat(24,1fr)] gap-[3px]" aria-hidden="true">
      {Array.from({ length: 72 }, (_, i) => (
        <span key={i} className="aspect-square bg-[var(--lp-text)] transition-opacity duration-300" style={{ opacity: i < (beat + 1) * 12 ? 0.85 : 0.1 }} />
      ))}
    </div>
  );
}

function AuditViz({ on }: { on: boolean }) {
  const rows = ["UPDATE PRICE price_a81", "CREATE PLAN plan_f02", "UPDATE ENTITLEMENT ent_77", "CREATE INVOICE inv_c19"];
  const beat = useBeat(on, rows.length, 1300);
  return (
    <ul className="lp-data space-y-1">
      {[0, 1, 2].map((i) => (
        <li key={i} className={i === 0 ? "lp-text" : "lp-muted"}>
          {rows[(beat + rows.length - i) % rows.length]}
        </li>
      ))}
    </ul>
  );
}

const CARDS: { icon: typeof Copy; title: string; body: string; span: string; viz: (on: boolean) => ReactNode }[] = [
  { icon: Copy, title: "Two-layer deduplication", body: "Redis, then Postgres, with a 24-hour sliding window. Client retries stay free.", span: "lg:col-span-5", viz: (on) => <DedupViz on={on} /> },
  { icon: GitBranch, title: "Exact proration", body: "Bigint ceiling-division seat adjustments, with a mid-cycle charge or credit that adds up to the cent.", span: "lg:col-span-7", viz: (on) => <ProrationViz on={on} /> },
  { icon: Timer, title: "Time-travel sandbox", body: "Isolated sk_test_ keys and simulated payments. Jump ahead to watch a renewal or dunning run.", span: "lg:col-span-7", viz: (on) => <TimeViz on={on} /> },
  { icon: Send, title: "Webhooks that arrive", body: "Transactional outbox, HMAC-SHA256 signing, 48 retries with exponential backoff.", span: "lg:col-span-5", viz: (on) => <WebhookViz on={on} /> },
  { icon: Layers, title: "Batch ingestion", body: "Up to 1,000 events per call, deduplicated on the way in.", span: "lg:col-span-5", viz: (on) => <BatchViz on={on} /> },
  { icon: History, title: "Append-only audit log", body: "Every mutation to every billing entity is recorded, with before and after state.", span: "lg:col-span-7", viz: (on) => <AuditViz on={on} /> },
];

function Card({ card, delay }: { card: (typeof CARDS)[number]; delay: number }) {
  const [ref, visible] = useOnScreen<HTMLDivElement>();
  const Icon = card.icon;
  return (
    <Reveal delay={delay} className={card.span}>
      <div ref={ref} className="h-full">
        <Panel className="lp-panel-solid h-full p-6 flex flex-col gap-6">
          <div className="flex-1 flex flex-col justify-center min-h-[7.5rem]">{card.viz(visible)}</div>
          <div>
            <h3 className="lp-h3 flex items-center gap-2.5">
              <Icon className="h-4 w-4 lp-secondary" />
              {card.title}
            </h3>
            <p className="lp-body mt-1.5">{card.body}</p>
          </div>
        </Panel>
      </div>
    </Reveal>
  );
}

export default function Features() {
  return (
    <section id="features" data-scene="bento" className="lp-section lp-rule">
      <div className="lp-wrap">
        <SectionHead index="05" label="Under the hood" title="The hard parts, already built." body="The unglamorous machinery that decides whether billing can be trusted." />
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {CARDS.map((card, i) => (
            <Card key={card.title} card={card} delay={(i % 2) * 0.08} />
          ))}
        </div>
      </div>
    </section>
  );
}
