// The page meters its own visitor: every pixel scrolled is billed as a usage
// event, and the running total is settled (and waived) in the closing section.
const RATE_PER_PX = 0.0001;

let pixels = 0;
let last = 0;
let listening = false;
const subscribers = new Set<() => void>();

function onScroll() {
  const y = window.scrollY;
  pixels += Math.abs(y - last);
  last = y;
  subscribers.forEach((notify) => notify());
}

export function subscribeMeter(notify: () => void) {
  if (!listening) {
    listening = true;
    last = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0) {
      window.removeEventListener("scroll", onScroll);
      listening = false;
    }
  };
}

export const meterReading = () => ({ pixels: Math.round(pixels), amount: pixels * RATE_PER_PX });
export const METER_RATE = RATE_PER_PX;
