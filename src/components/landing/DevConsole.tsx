import { Suspense, lazy, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Panel, Reveal, SectionHead, useApproached } from "./ui/primitives";

const CodeEditor = lazy(() => import("./ui/CodeEditor"));

type Method = "track" | "can" | "calculate";

const SNIPPETS: Record<Method, { code: string; response: string }> = {
  track: {
    code: `// Ingest usage events in real time\nawait billing.track(\n  "cust_89b2",\n  "lead_generated",\n  1\n);`,
    response: `{\n  "status": "success",\n  "event_id": "ev_80b1e2",\n  "credits_remaining": 8200\n}`,
  },
  can: {
    code: `// Check entitlements before gating a feature\nconst authorized = await billing.can(\n  "cust_89b2",\n  "pro_features"\n);`,
    response: `{\n  "allowed": true,\n  "reason": "Plan Growth valid",\n  "limits": {\n    "leads_limit": 50000,\n    "leads_current": 18500\n  }\n}`,
  },
  calculate: {
    code: `// Preview an invoice before charging\nconst invoice = await billing.calculate(\n  "cust_89b2"\n);`,
    response: `{\n  "customer_id": "cust_89b2",\n  "base_fee": 14900,\n  "usage_overage": 4200,\n  "total": 19100,\n  "currency": "USD"\n}`,
  },
};

const METHODS = Object.keys(SNIPPETS) as Method[];

export default function DevConsole() {
  const [method, setMethod] = useState<Method>("track");
  const [copied, setCopied] = useState(false);
  const { code, response } = SNIPPETS[method];
  const [slot, approached] = useApproached<HTMLDivElement>();
  const codeFallback = <pre className="p-4 lp-data !text-[13px] lp-secondary">{code}</pre>;
  const responseFallback = <pre className="p-4 lp-data !text-[13px] lp-secondary">{response}</pre>;

  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section id="developers" data-scene="developers" className="lp-section lp-rule">
      <div className="lp-wrap grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-5">
          <SectionHead
            index="07"
            label="Built dev-first"
            title="Three calls. That's the integration."
            body="Dispatch lightweight events when things happen in your product. Pricing, pro-rata maths, and ledger updates happen on our side."
          />
        </div>
        <Reveal className="lg:col-span-7">
          <Panel className="lp-panel-solid">
            <div className="flex items-center justify-between border-b lp-divider pr-2">
              <div role="tablist" aria-label="SDK methods" className="flex overflow-x-auto [scrollbar-width:none]">
                {METHODS.map((name) => (
                  <button
                    key={name}
                    role="tab"
                    aria-selected={method === name}
                    onClick={() => setMethod(name)}
                    className={`lp-data px-4 h-11 cursor-pointer border-b transition-colors ${method === name ? "lp-text border-[var(--lp-text)]" : "lp-muted border-transparent hover:text-[var(--lp-text)]"}`}
                  >
                    billing.{name}()
                  </button>
                ))}
              </div>
              <button onClick={copy} aria-label="Copy code" className="h-9 w-9 grid place-items-center lp-secondary hover:text-[var(--lp-text)] cursor-pointer shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div ref={slot} className="grid grid-cols-1 md:grid-cols-12 min-h-[17rem]">
              <div className="md:col-span-7 px-2">
                {approached ? (
                  <Suspense fallback={codeFallback}>
                    <CodeEditor value={code} language="javascript" readOnly label="SDK example" />
                  </Suspense>
                ) : (
                  codeFallback
                )}
              </div>
              <div className="md:col-span-5 border-t md:border-t-0 md:border-l lp-divider lp-surface px-2">
                <p className="lp-label px-2 pt-4">Response</p>
                {approached ? (
                  <Suspense fallback={responseFallback}>
                    <CodeEditor value={response} language="json" readOnly label="SDK response" />
                  </Suspense>
                ) : (
                  responseFallback
                )}
              </div>
            </div>
          </Panel>
        </Reveal>
      </div>
    </section>
  );
}
