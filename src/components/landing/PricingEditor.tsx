import { Suspense, lazy, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { PRESETS, PRICE_TYPES, computeInvoice, configFromPrompt, parseConfig, type PriceConfig, type PriceType } from "./pricing-model";
import { setScenePlan } from "./scene/store";
import { Panel, Reveal, SectionHead, WindowBar, useApproached, useOnScreen } from "./ui/primitives";

const CodeEditor = lazy(() => import("./ui/CodeEditor"));

const EXAMPLES = ["$49/mo plus $0.02 per call over 10k", "$12 per seat", "packs of 2,000 for $40", "graduated tiers"];

const pretty = (plan: PriceConfig) => JSON.stringify(plan, null, 2);
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function PricingEditor() {
  const [source, setSource] = useState(() => pretty(PRESETS.hybrid));
  const [plan, setPlan] = useState<PriceConfig>(PRESETS.hybrid);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [promptNote, setPromptNote] = useState("");
  const [usage, setUsage] = useState(35000);
  const [seats, setSeats] = useState(15);
  const [ref, visible] = useOnScreen<HTMLElement>();
  const [editorSlot, approached] = useApproached<HTMLDivElement>();
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The hero also drives the helix, so reclaim it whenever this section is in view.
  useEffect(() => {
    if (visible) setScenePlan(plan);
  }, [visible, plan]);

  const onEdit = (next: string) => {
    setSource(next);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const result = parseConfig(next);
      if (result.ok) {
        setPlan(result.plan);
        setError(null);
      } else {
        setError(result.error);
      }
    }, 140);
  };

  const apply = (next: PriceConfig) => {
    clearTimeout(debounce.current);
    setPlan(next);
    setSource(pretty(next));
    setError(null);
  };

  const describe = (text: string) => {
    const next = configFromPrompt(text);
    if (next) {
      apply(next);
      setPromptNote("");
    } else {
      setPromptNote(`Couldn't read that as a price. Try "${EXAMPLES[0]}".`);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (prompt.trim()) describe(prompt);
  };

  const invoice = useMemo(() => computeInvoice(plan, { usage, seats }), [plan, usage, seats]);
  const usesSeats = plan.type === "seat" || (plan.type === "hybrid" && !!plan.seatPrice);
  const usesUsage = plan.type !== "flat" && plan.type !== "seat";

  return (
    <section ref={ref} id="showcase" data-scene="editor" className="lp-section lp-rule">
      <div className="lp-wrap">
        <SectionHead
          index="03"
          label="Pricing as config"
          title="Edit the price. Watch the business bend."
          body="This is a real price object. Change a number and the invoice and the helix both follow. Ship the same change from the dashboard without a deploy."
        />

        <Reveal className="mt-10">
          <form onSubmit={onSubmit} className="flex items-center border lp-border-glass bg-[var(--lp-card)] backdrop-blur-md h-14 pl-4 pr-2 gap-3 focus-within:border-[var(--lp-tick)] transition-colors">
            <label htmlFor="price-prompt" className="sr-only">
              Describe how you charge
            </label>
            <input
              id="price-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe how you charge..."
              autoComplete="off"
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] lp-text placeholder:text-[var(--lp-muted)]"
            />
            <button type="submit" aria-label="Generate price" className="lp-btn !h-10 !w-10 !p-0 shrink-0">
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] -mx-6 px-6 lg:mx-0 lg:px-0">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                className="lp-chip"
                onClick={() => {
                  setPrompt(example);
                  describe(example);
                }}
              >
                {example}
              </button>
            ))}
          </div>
          <p role="status" className="lp-data lp-secondary mt-2 min-h-[1.5em]">
            {promptNote}
          </p>
        </Reveal>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <Reveal className="lg:col-span-7">
            <Panel className="lp-panel-solid h-[30rem] flex flex-col">
              <WindowBar
                title="price.json"
                right={
                  <div className="flex gap-1 min-w-0 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Load a preset">
                    {PRICE_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => apply(PRESETS[type.id as PriceType])}
                        aria-pressed={plan.type === type.id}
                        className={`lp-data px-2 h-7 cursor-pointer transition-colors ${plan.type === type.id ? "lp-text" : "lp-muted hover:text-[var(--lp-text)]"}`}
                      >
                        {type.id}
                      </button>
                    ))}
                  </div>
                }
              />
              <div ref={editorSlot} className="flex-1 min-h-0">
                {approached ? (
                  <Suspense fallback={<pre className="p-4 lp-data !text-[13px] lp-secondary overflow-hidden">{source}</pre>}>
                    <CodeEditor value={source} onChange={onEdit} language="json" label="Price configuration" />
                  </Suspense>
                ) : (
                  <pre className="p-4 lp-data !text-[13px] lp-secondary overflow-hidden">{source}</pre>
                )}
              </div>
              <p role="status" className={`px-4 py-2 border-t lp-divider lp-data truncate ${error ? "lp-text" : "lp-muted"}`} title={error ?? undefined}>
                {error ? `error: ${error}` : `valid: ${plan.type} price`}
              </p>
            </Panel>
          </Reveal>

          <Reveal delay={0.12} className="lg:col-span-5 lg:flex lg:flex-col lg:justify-end">
            <Panel className="lp-panel-solid">
              <WindowBar title="billing.calculate()" right={<span className="lp-data lp-muted">preview</span>} />
              <div className="p-5 space-y-4">
                {usesUsage && (
                  <label className="block">
                    <span className="flex justify-between lp-data">
                      <span className="lp-secondary">Usage</span>
                      <span className="lp-text">{usage.toLocaleString("en-US")} units</span>
                    </span>
                    <input type="range" min={0} max={250000} step={500} value={usage} onChange={(event) => setUsage(Number(event.target.value))} className="lp-range mt-2" />
                  </label>
                )}
                {usesSeats && (
                  <label className="block">
                    <span className="flex justify-between lp-data">
                      <span className="lp-secondary">Seats</span>
                      <span className="lp-text">{seats}</span>
                    </span>
                    <input type="range" min={1} max={60} value={seats} onChange={(event) => setSeats(Number(event.target.value))} className="lp-range mt-2" />
                  </label>
                )}
                <dl className="lp-data !text-[13px]">
                  {invoice.lines.map((line) => (
                    <div key={line.label} className="flex justify-between gap-4 py-1.5 border-b lp-divider">
                      <dt className="lp-secondary min-w-0 truncate">
                        {line.label} <span className="lp-muted">{line.detail}</span>
                      </dt>
                      <dd className="lp-text shrink-0">{usd(line.amount)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex items-end justify-between">
                  <span className="lp-label">Due / {plan.billingPeriod ?? "period"}</span>
                  <span className="text-4xl tracking-[-0.04em] font-medium lp-text tabular-nums">{usd(invoice.total)}</span>
                </div>
              </div>
            </Panel>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
