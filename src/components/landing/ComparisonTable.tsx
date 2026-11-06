import { Reveal, SectionHead } from "./ui/primitives";

const ROWS = [
  { name: "Stripe Billing", catch: "Locked into Stripe. No Paystack. No Flutterwave.", answer: "Gateway-agnostic. Your gateway, your choice." },
  { name: "Chargebee", catch: "Rigid pricing models. Migration headache. Expensive at scale.", answer: "Developer-first. Declarative pricing engine. No vendor lock-in." },
  { name: "Metronome / Lago", catch: "Strong metering but weak invoicing. Young infrastructure.", answer: "Full orchestration: pricing, metering, invoicing, and revenue analytics in one stack." },
];

export default function ComparisonTable() {
  return (
    <section data-scene="compare" className="lp-section lp-rule">
      <div className="lp-wrap">
        <SectionHead index="08" label="Competitive landscape" title="What you trade off elsewhere." />
        <Reveal className="mt-10">
          <div className="border lp-border-glass bg-[var(--lp-scrim)] backdrop-blur-md overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead>
                <tr className="border-b lp-divider">
                  <th scope="col" className="lp-label font-normal py-3 px-5 w-[22%]">Platform</th>
                  <th scope="col" className="lp-label font-normal py-3 px-5 w-[39%]">The catch</th>
                  <th scope="col" className="lp-label font-normal py-3 px-5">With AoraHQ</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.name} className="border-b lp-divider last:border-0 align-top">
                    <th scope="row" className="py-5 px-5 lp-h3 !text-base">{row.name}</th>
                    <td className="py-5 px-5 lp-body">{row.catch}</td>
                    <td className="py-5 px-5 text-[15px] leading-relaxed lp-text">{row.answer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
