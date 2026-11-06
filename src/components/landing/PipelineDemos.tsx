// Small self-running product vignettes for the pipeline. All figures are sample
// data, and every loop stops while its panel is off screen.
import { useEffect, useState } from "react";
import { Check, Minus, Zap } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PRESETS, computeInvoice } from "./pricing-model";
import { WindowBar, useOnScreen } from "./ui/primitives";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function useTicker(active: boolean, ms: number, tick: () => void) {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!active || reduced) return;
    const timer = setInterval(tick, ms);
    return () => clearInterval(timer);
    // `tick` only touches state setters, so it never goes stale.
  }, [active, ms, reduced]);
}

interface LogLine {
  id: number;
  customer: string;
  meter: string;
  units: number;
  duplicate: boolean;
}

const METERS = ["api_calls", "compute_units", "storage_gb", "lead_generated"];

let nextLine = 0;
function makeLine(previous?: LogLine): LogLine {
  nextLine += 1;
  // Roughly one in five events is a retry, which the dedup layer drops.
  if (previous && !previous.duplicate && nextLine % 5 === 0) return { ...previous, id: nextLine, duplicate: true };
  return {
    id: nextLine,
    customer: `cust_${(nextLine * 37) % 97}`,
    meter: METERS[nextLine % METERS.length],
    units: ((nextLine * 613) % 4800) + 100,
    duplicate: false,
  };
}

export function TrackDemo() {
  const [ref, visible] = useOnScreen<HTMLDivElement>();
  const [lines, setLines] = useState<LogLine[]>(() => {
    const seed: LogLine[] = [];
    for (let i = 0; i < 5; i++) seed.unshift(makeLine(seed[0]));
    return seed;
  });
  const push = () => setLines((current) => [makeLine(current[0]), ...current.slice(0, 4)]);
  useTicker(visible, 1500, push);

  return (
    <div ref={ref}>
      <WindowBar
        title="ingest.log"
        right={
          <button onClick={push} className="lp-chip !h-7 inline-flex items-center gap-1.5">
            <Zap className="h-3 w-3" /> Send event
          </button>
        }
      />
      <ul className="p-4 h-[13.5rem] overflow-hidden lp-data !text-[12.5px] space-y-2">
        <AnimatePresence initial={false}>
          {lines.map((line, i) => (
            <motion.li
              key={line.id}
              layout="position"
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1 - i * 0.16, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex items-baseline justify-between gap-3 ${line.duplicate ? "lp-muted" : "lp-text"}`}
            >
              <span className={`truncate ${line.duplicate ? "line-through" : ""}`}>
                track({line.customer}, "{line.meter}", {line.units})
              </span>
              <span className="lp-muted shrink-0">{line.duplicate ? "deduplicated" : "ingested"}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

export function RateDemo() {
  const plan = PRESETS.hybrid;
  const included = plan.includedUsage ?? 0;
  const ceiling = 40000;
  const [ref, visible] = useOnScreen<HTMLDivElement>();
  const [usage, setUsage] = useState(18400);
  useTicker(visible, 120, () => setUsage((u) => (u >= ceiling ? 4000 : u + 340)));
  const invoice = computeInvoice(plan, { usage, seats: 1 });

  return (
    <div ref={ref}>
      <WindowBar title="rating: Growth, hybrid" right={<span className="lp-data lp-muted">sample</span>} />
      <div className="p-5 space-y-5">
        <div>
          <div className="flex justify-between lp-data">
            <span className="lp-secondary">api_calls</span>
            <span className="lp-text">{usage.toLocaleString("en-US")}</span>
          </div>
          <div className="relative mt-2 h-2 bg-[var(--lp-surface)]">
            <div className="absolute inset-y-0 left-0 bg-[var(--lp-text)]" style={{ width: `${(usage / ceiling) * 100}%` }} />
            <div className="absolute -inset-y-1.5 w-px bg-[var(--lp-tick)]" style={{ left: `${(included / ceiling) * 100}%` }} />
          </div>
          <p className="lp-data lp-muted mt-2" style={{ marginLeft: `${(included / ceiling) * 100}%` }}>
            allowance {included.toLocaleString("en-US")}
          </p>
        </div>
        <dl className="lp-data !text-[13px] border-t lp-divider">
          {invoice.lines.map((line) => (
            <div key={line.label} className="flex justify-between gap-4 py-2 border-b lp-divider">
              <dt className="lp-secondary">
                {line.label} <span className="lp-muted">{line.detail}</span>
              </dt>
              <dd className="lp-text">{usd(line.amount)}</dd>
            </div>
          ))}
          <div className="flex justify-between pt-2">
            <dt className="lp-secondary">Period total</dt>
            <dd className="lp-text font-semibold">{usd(invoice.total)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

const TIERS = ["Starter", "Growth", "Enterprise"] as const;
const FEATURES: { key: string; from: number }[] = [
  { key: "api_access", from: 0 },
  { key: "usage_metering", from: 0 },
  { key: "custom_pricing", from: 1 },
  { key: "revenue_simulation", from: 1 },
  { key: "ai_assistant", from: 2 },
  { key: "dunning", from: 2 },
];

export function GateDemo() {
  const [tier, setTier] = useState(1);
  return (
    <div>
      <WindowBar title='billing.can("cust_89b2", feature)' />
      <div className="p-4">
        <div className="flex gap-2" role="group" aria-label="Plan">
          {TIERS.map((name, i) => (
            <button key={name} className="lp-chip" aria-pressed={tier === i} onClick={() => setTier(i)}>
              {name}
            </button>
          ))}
        </div>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 lp-data !text-[13px]">
          {FEATURES.map((feature) => {
            const allowed = tier >= feature.from;
            return (
              <li key={feature.key} className="flex items-center justify-between py-2 border-b lp-divider">
                <span className={allowed ? "lp-text" : "lp-muted"}>{feature.key}</span>
                <span className={`inline-flex items-center gap-1.5 ${allowed ? "lp-text" : "lp-muted"}`}>
                  {allowed ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  {allowed ? "allowed" : "denied"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const STEPS = [
  { state: "draft", note: "Line items assembled from the period" },
  { state: "open", note: "Sent through the customer's gateway" },
  { state: "past_due", note: "Card declined, dunning starts" },
  { state: "retry d0", note: "First attempt failed" },
  { state: "retry d3", note: "Reminder sent, payment retried" },
  { state: "retry d7", note: "Final scheduled retry" },
  { state: "paid", note: "Settled, webhook dispatched" },
];

export function InvoiceDemo() {
  const [ref, visible] = useOnScreen<HTMLDivElement>();
  const [step, setStep] = useState(0);
  useTicker(visible, 1300, () => setStep((s) => (s + 1) % STEPS.length));

  return (
    <div ref={ref}>
      <WindowBar title="INV-2026-012" right={<span className="lp-data lp-text">{usd(449)}</span>} />
      <div className="p-5">
        <ol className="flex items-center" aria-label="Invoice lifecycle">
          {STEPS.map((item, i) => (
            <li key={item.state} className="flex items-center flex-1 last:flex-none">
              <span
                className={`h-2.5 w-2.5 shrink-0 border transition-colors duration-300 ${i <= step ? "bg-[var(--lp-text)] border-[var(--lp-text)]" : "border-[var(--lp-tick)]"}`}
              />
              {i < STEPS.length - 1 && <span className={`h-px flex-1 transition-colors duration-300 ${i < step ? "bg-[var(--lp-text)]" : "bg-[var(--lp-divider)]"}`} />}
            </li>
          ))}
        </ol>
        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="lp-label">State</p>
            <p className="text-3xl tracking-[-0.03em] lp-text mt-2 font-mono">{STEPS[step].state}</p>
          </div>
          <p className="lp-data lp-secondary text-right max-w-[15rem]">{STEPS[step].note}</p>
        </div>
      </div>
    </div>
  );
}

const LEDGER = [
  { id: "INV-2026-012", usage: 449, gateway: "Stripe" },
  { id: "INV-2026-013", usage: 1199, gateway: "Paystack" },
  { id: "INV-2026-014", usage: 149, gateway: "Flutterwave" },
  { id: "INV-2026-015", usage: 612, gateway: "Stripe" },
];

const SPARK = [15.4, 18.2, 21, 24.5, 29, 36];

export function ReconcileDemo() {
  const [ref, visible] = useOnScreen<HTMLDivElement>();
  const [matched, setMatched] = useState(1);
  useTicker(visible, 1100, () => setMatched((m) => (m >= LEDGER.length + 1 ? 0 : m + 1)));

  const points = SPARK.map((v, i) => `${(i / (SPARK.length - 1)) * 100},${40 - (v / 38) * 38}`).join(" ");

  return (
    <div ref={ref}>
      <WindowBar title="reconciliation" right={<span className="lp-data lp-muted">sample</span>} />
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_11rem]">
        <table className="w-full lp-data !text-[12.5px]">
          <thead>
            <tr className="lp-muted text-left border-b lp-divider">
              <th className="font-normal py-2 pl-4">Invoice</th>
              <th className="font-normal py-2">Usage</th>
              <th className="font-normal py-2">Gateway</th>
              <th className="font-normal py-2 pr-4 text-right">State</th>
            </tr>
          </thead>
          <tbody>
            {LEDGER.map((row, i) => {
              const done = i < matched;
              return (
                <tr key={row.id} className="border-b lp-divider last:border-0">
                  <td className="py-2.5 pl-4 lp-text">{row.id}</td>
                  <td className="py-2.5 lp-secondary">{usd(row.usage)}</td>
                  <td className="py-2.5 lp-secondary">{row.gateway}</td>
                  <td className={`py-2.5 pr-4 text-right transition-colors ${done ? "lp-text" : "lp-muted"}`}>{done ? "matched" : "pending"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="p-4 border-t sm:border-t-0 sm:border-l lp-divider flex flex-col justify-between gap-3">
          <div>
            <p className="lp-label">MRR</p>
            <p className="text-2xl tracking-[-0.03em] lp-text mt-1.5 font-mono">$36,000</p>
          </div>
          <svg viewBox="0 0 100 42" className="w-full h-12" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={points} fill="none" stroke="var(--lp-text)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>
    </div>
  );
}
