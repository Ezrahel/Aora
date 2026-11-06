import { useEffect, useRef, useState } from "react";
import { meterReading, subscribeMeter } from "./metering";

/** A live usage meter on the page itself: scrolling here is a billable event. */
export default function MeterHud() {
  const value = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    return subscribeMeter(() => {
      const { pixels, amount } = meterReading();
      if (value.current) value.current.textContent = `${pixels.toLocaleString("en-US")} px  $${amount.toFixed(2)}`;
      setShown(window.scrollY > 500 && window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 1400);
    });
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`hidden lg:block fixed bottom-5 right-5 z-40 border lp-border-glass bg-[var(--lp-scrim)] backdrop-blur-md px-3 py-2 lp-data transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
    >
      <span className="lp-muted">billing.track("you", "scroll_px") </span>
      <span ref={value} className="lp-text whitespace-pre" />
    </div>
  );
}
