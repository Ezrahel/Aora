import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Panel, Reveal, SectionHead, WindowBar, useOnScreen } from "./ui/primitives";

const PLAIN = "sk_live_51Nx8QrKd2vT0mZpL4yHw";
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const STEPS = [
  ["Paste", "Keys are entered once, over TLS, in your dashboard."],
  ["Seal", "AES-256-GCM encrypts them before they reach the disk."],
  ["Use", "Decrypted in memory for one request, then forgotten."],
  ["Never", "Never logged. Never exposed."],
];

const GATEWAYS = [
  ["Stripe", "live"],
  ["Paystack", "live"],
  ["Flutterwave", "live"],
  ["Sandbox", "sk_test_"],
];

function scramble(text: string, sealed: number) {
  return text
    .split("")
    .map((char, i) => (i < sealed ? GLYPHS[(i * 31 + sealed * 7 + char.charCodeAt(0)) % GLYPHS.length] : char))
    .join("");
}

export default function BYOKSection() {
  const reduced = useReducedMotion();
  const [ref, visible] = useOnScreen<HTMLDivElement>();
  const [sealed, setSealed] = useState(PLAIN.length);

  useEffect(() => {
    if (!visible || reduced) return;
    const timer = setInterval(() => setSealed((n) => (n >= PLAIN.length + 18 ? 0 : n + 1)), 90);
    return () => clearInterval(timer);
  }, [visible, reduced]);

  const shown = Math.min(sealed, PLAIN.length);

  return (
    <section data-scene="vault" className="lp-section lp-rule">
      <div className="lp-wrap grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6 lg:col-start-7 lg:order-2">
          <SectionHead
            index="04"
            label="Bring your own keys"
            title="Your gateway. Your keys. Our infrastructure."
            body="Zero asset custody. Payments flow straight from your customer to your gateway account, and AoraHQ orchestrates the logic around them."
          />
          <ol className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="border-t lp-divider pt-3">
                <p className="lp-label">
                  <span className="lp-muted">{i + 1}.</span> {title}
                </p>
                <p className="lp-body mt-1.5">{body}</p>
              </li>
            ))}
          </ol>
        </div>

        <Reveal className="lg:col-span-5 lg:order-1">
          <div ref={ref}>
            <Panel className="lp-panel-solid">
              <WindowBar title="vault / gateway_credentials" right={<span className="lp-data lp-muted">illustrative</span>} />
              <div className="p-5">
                <p className="lp-label">{shown >= PLAIN.length ? "Ciphertext at rest" : "Sealing"}</p>
                <p className="mt-3 font-mono text-[15px] lp-text break-all tabular-nums min-h-[3.2em]">{scramble(PLAIN, shown)}</p>
                <div className="mt-3 h-px bg-[var(--lp-divider)] relative">
                  <div className="absolute inset-y-0 left-0 bg-[var(--lp-text)]" style={{ width: `${(shown / PLAIN.length) * 100}%` }} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-y-1 lp-data">
                  <dt className="lp-muted">algorithm</dt>
                  <dd className="lp-text text-right">aes-256-gcm</dd>
                  <dt className="lp-muted">plaintext stored</dt>
                  <dd className="lp-text text-right">never</dd>
                </dl>
              </div>
              <ul className="border-t lp-divider grid grid-cols-2">
                {GATEWAYS.map(([name, mode], i) => (
                  <li key={name} className={`px-5 py-3 flex items-baseline justify-between gap-2 lp-data ${i % 2 ? "border-l lp-divider" : ""} ${i > 1 ? "border-t lp-divider" : ""}`}>
                    <span className="lp-text">{name}</span>
                    <span className="lp-muted">{mode}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
