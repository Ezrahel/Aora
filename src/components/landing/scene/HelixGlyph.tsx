// Vector form of the helix, used as the WebGL poster/fallback and as a small
// brand mark across the app. Both share the same maths as the 3D scene's spiral.
import { useMemo } from "react";

interface HelixGlyphProps {
  className?: string;
  /** Number of rungs. Small marks read better with fewer. */
  rungs?: number;
  turns?: number;
  spin?: boolean;
}

export function HelixGlyph({ className, rungs = 14, turns = 1.6, spin = false }: HelixGlyphProps) {
  const lines = useMemo(() => {
    return Array.from({ length: rungs }, (_, i) => {
      const u = i / (rungs - 1);
      const angle = u * turns * Math.PI * 2;
      const dx = Math.sin(angle) * 9;
      return { x1: 12 - dx, x2: 12 + dx, y: 2 + u * 20, depth: 0.45 + 0.55 * (Math.cos(angle) * 0.5 + 0.5) };
    });
  }, [rungs, turns]);

  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <g className={spin ? "helix-glyph-spin" : undefined}>
        {lines.map((line) => (
          <line
            key={line.y}
            x1={line.x1}
            x2={line.x2}
            y1={line.y}
            y2={line.y}
            stroke="currentColor"
            strokeWidth={1.3}
            strokeLinecap="round"
            opacity={line.depth}
          />
        ))}
      </g>
    </svg>
  );
}

/** Large static spiral shown before the WebGL chunk arrives, or instead of it. */
export function HelixPoster({ className }: { className?: string }) {
  const slabs = useMemo(() => {
    return Array.from({ length: 120 }, (_, i) => {
      const u = i / 119;
      const angle = i * 0.3;
      const depth = Math.sin(angle);
      const r = 150;
      const x = Math.cos(angle) * r;
      return {
        key: i,
        x1: 300 + x * 0.42,
        x2: 300 + x * 1.3,
        y: -20 + u * 840 + depth * 22,
        opacity: 0.12 + 0.34 * (depth * 0.5 + 0.5),
      };
    });
  }, []);

  return (
    <svg viewBox="0 0 600 800" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      {slabs.map((slab) => (
        <line key={slab.key} x1={slab.x1} x2={slab.x2} y1={slab.y} y2={slab.y + 8} stroke="currentColor" strokeWidth={5} strokeLinecap="round" opacity={slab.opacity} />
      ))}
    </svg>
  );
}
