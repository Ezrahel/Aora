import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { meterReading, subscribeMeter, METER_RATE } from "./ui/metering";
import { SectionHead } from "./ui/primitives";

interface CTASectionProps {
  onNavigateTab: (tab: string) => void;
}

export default function CTASection({ onNavigateTab }: CTASectionProps) {
  const receipt = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const render = () => {
      const { pixels, amount } = meterReading();
      if (receipt.current) receipt.current.textContent = `${pixels.toLocaleString("en-US")} px × $${METER_RATE} = $${amount.toFixed(2)}`;
    };
    render();
    return subscribeMeter(render);
  }, []);

  return (
    <section data-scene="vortex" className="relative z-10 min-h-svh flex items-center lp-rule">
      <div className="lp-wrap py-24 relative">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{ background: "radial-gradient(closest-side, var(--lp-bg) 46%, transparent 92%)" }}
        />
        <SectionHead
          index="10"
          label="Settle up"
          align="center"
          title="Your billing should be an asset, not a tax."
          body="Stop maintaining billing code. Start shipping your product. Connect your gateway in minutes."
        />
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <button onClick={() => onNavigateTab("dashboard")} className="lp-btn group">
            Connect your gateway
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button onClick={() => onNavigateTab("docs")} className="lp-btn lp-btn-ghost">
            Read the docs
          </button>
        </div>
        <p className="lp-data lp-secondary text-center mt-8">
          Your visit: <span ref={receipt} className="lp-text" /> <span className="lp-muted">(waived)</span>
        </p>
      </div>
    </section>
  );
}
