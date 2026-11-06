// Turns a price config into helix geometry: the "bends to your business model"
// idea made literal. Each slab is a line item, and the pricing model decides how
// the stack of them grows.
import type { PriceConfig } from "../pricing-model";

export const SLABS = 420;
export const TURN = 0.2;
const HEIGHT = 19;

export interface HelixProfile {
  radius: Float32Array;
  length: Float32Array;
  thick: Float32Array;
  y: Float32Array;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Splits [0,1] into bands whose widths follow the log of each tier ceiling. */
function bandEdges(plan: PriceConfig): number[] {
  const tiers = plan.tiers ?? [];
  const finite = tiers.map((t) => t.upTo).filter((n): n is number => n !== "infinity");
  if (!finite.length) return [1];
  const top = Math.log10(Math.max(...finite) * 2.5);
  const low = Math.log10(Math.min(...finite)) - 0.6;
  const edges = finite.map((n) => clamp((Math.log10(n) - low) / (top - low), 0.08, 0.92));
  return [...edges, 1];
}

const bandOf = (edges: number[], u: number) => {
  const index = edges.findIndex((edge) => u <= edge);
  return index === -1 ? edges.length - 1 : index;
};

export function buildProfile(plan: PriceConfig): HelixProfile {
  const radius = new Float32Array(SLABS);
  const length = new Float32Array(SLABS);
  const thick = new Float32Array(SLABS);
  const gap = new Float32Array(SLABS);

  const edges = bandEdges(plan);
  const bands = edges.length;
  const knee = clamp((plan.includedUsage ?? 10000) / 40000, 0.14, 0.8);
  const flare = clamp(0.8 + (plan.overageUnitPrice ?? 0.02) * 40, 0.8, 3.2);
  const seatGroup = clamp(Math.round(14 - (plan.seatPrice ?? 29) / 8), 5, 12);
  const packGroup = clamp(Math.round(Math.log10(plan.packageSize ?? 5000) * 5), 8, 26);

  for (let i = 0; i < SLABS; i++) {
    const u = i / (SLABS - 1);
    let r = 1.75;
    let len = 1.5;
    let t = 0.024;
    let g = 1;

    switch (plan.type) {
      case "flat":
        break;
      case "seat": {
        // Discrete units: evenly sized groups with air between them.
        g = i % seatGroup === 0 ? 7 : 0.8;
        break;
      }
      case "usage": {
        // No floor: the stack opens continuously as consumption climbs.
        const k = Math.pow(u, 1.5);
        r = 0.7 + k * 2.3 * (flare / 1.6);
        len = 0.5 + k * 2;
        break;
      }
      case "hybrid": {
        // A steady committed base, then a flare once usage passes the allowance.
        const over = u <= knee ? 0 : smooth((u - knee) / (1 - knee));
        r = 1.15 + over * 1.3 * (flare / 1.6);
        len = 1 + over * 1.55;
        break;
      }
      case "tiered": {
        // Graduated: a visible step at every tier boundary.
        const band = bandOf(edges, u);
        r = 1 + (band / Math.max(1, bands - 1)) * 1.85;
        len = 0.85 + (band / Math.max(1, bands - 1)) * 1.1;
        const prev = band === 0 ? 0 : edges[band - 1];
        if (band > 0 && u - prev < 1 / SLABS) g = 8;
        break;
      }
      case "volume": {
        // One bracket governs everything: whole sections change weight together.
        const band = bandOf(edges, u);
        r = 1.5 + Math.sin((band / bands) * Math.PI) * 0.75;
        len = 1.25;
        t = 0.02 + band * 0.022;
        break;
      }
      case "package": {
        // Prepaid bundles: tightly fused blocks, sold whole.
        const inBlock = i % packGroup;
        g = inBlock === 0 ? 13 : 0.32;
        t = 0.04;
        break;
      }
    }

    radius[i] = r;
    length[i] = len;
    thick[i] = t;
    gap[i] = g;
  }

  const y = new Float32Array(SLABS);
  let travelled = 0;
  for (let i = 1; i < SLABS; i++) {
    travelled += gap[i];
    y[i] = travelled;
  }
  for (let i = 0; i < SLABS; i++) y[i] = HEIGHT / 2 - (y[i] / travelled) * HEIGHT;

  return { radius, length, thick, y };
}
