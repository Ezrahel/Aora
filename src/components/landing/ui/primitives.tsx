// Shared building blocks for the marketing surfaces.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";

export function SectionHead({
  index,
  label,
  title,
  body,
  align = "left",
}: {
  index: string;
  label: string;
  title: ReactNode;
  body?: ReactNode;
  align?: "left" | "center";
}) {
  const centred = align === "center";
  return (
    <motion.header
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
      className={centred ? "max-w-3xl mx-auto text-center" : "max-w-3xl"}
    >
      <p className="lp-label">
        <span className="lp-muted">{index}</span> <span className="lp-muted">//</span> {label}
      </p>
      <h2 className="lp-h2 mt-4">{title}</h2>
      {body && <p className={`lp-lede mt-4 ${centred ? "mx-auto" : ""}`}>{body}</p>}
    </motion.header>
  );
}

/** Blueprint panel with registration ticks at each corner. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`lp-panel ${className}`}>
      <i className="lp-tick lp-tick-tl" />
      <i className="lp-tick lp-tick-tr" />
      <i className="lp-tick lp-tick-bl" />
      <i className="lp-tick lp-tick-br" />
      {children}
    </div>
  );
}

export function WindowBar({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 h-10 border-b lp-divider">
      <span className="lp-data lp-secondary truncate shrink-0 max-w-[70%]">{title}</span>
      {right}
    </div>
  );
}

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Flips true once the element is within `margin` of the viewport, and stays true. */
export function useApproached<T extends Element>(margin = "900px") {
  const ref = useRef<T>(null);
  const [approached, setApproached] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setApproached(true);
          observer.disconnect();
        }
      },
      { rootMargin: margin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [margin]);
  return [ref, approached] as const;
}

/** True while the element is on screen, so looping demos stop when out of view. */
export function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "60px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, visible] as const;
}
