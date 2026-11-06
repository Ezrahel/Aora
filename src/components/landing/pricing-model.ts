// Pure pricing logic behind the landing page's live editor. The config mirrors
// the `Price` shape in src/types.ts so what visitors edit is what the API takes.
import type { Tier } from "../../types";

export type PriceType = "flat" | "seat" | "usage" | "hybrid" | "tiered" | "volume" | "package";

export const PRICE_TYPES: { id: PriceType; label: string; phrase: string }[] = [
  { id: "flat", label: "Flat", phrase: "flat subscriptions" },
  { id: "seat", label: "Per-seat", phrase: "per-seat plans" },
  { id: "usage", label: "Usage", phrase: "pure usage" },
  { id: "hybrid", label: "Hybrid", phrase: "hybrid contracts" },
  { id: "tiered", label: "Tiered", phrase: "graduated tiers" },
  { id: "volume", label: "Volume", phrase: "volume brackets" },
  { id: "package", label: "Package", phrase: "prepaid packages" },
];

export interface PriceConfig {
  name: string;
  type: PriceType;
  billingPeriod: "monthly" | "yearly" | "quarterly";
  currency: string;
  baseFee: number;
  seatPrice?: number;
  includedSeats?: number;
  includedUsage?: number;
  overageUnitPrice?: number;
  tiers?: Tier[];
  packageSize?: number;
  packagePrice?: number;
}

const cadence = { billingPeriod: "monthly", currency: "USD" } as const;

export const PRESETS: Record<PriceType, PriceConfig> = {
  flat: { name: "Studio", type: "flat", ...cadence, baseFee: 149 },
  seat: { name: "Team", type: "seat", ...cadence, baseFee: 0, seatPrice: 29, includedSeats: 3 },
  usage: { name: "Metered API", type: "usage", ...cadence, baseFee: 0, overageUnitPrice: 0.02 },
  hybrid: { name: "Growth", type: "hybrid", ...cadence, baseFee: 149, includedUsage: 10000, overageUnitPrice: 0.02 },
  tiered: {
    name: "Scale",
    type: "tiered",
    ...cadence,
    baseFee: 0,
    tiers: [
      { upTo: 10000, unitPrice: 0.03 },
      { upTo: 50000, unitPrice: 0.02 },
      { upTo: 200000, unitPrice: 0.012 },
      { upTo: "infinity", unitPrice: 0.008 },
    ],
  },
  volume: {
    name: "Bulk",
    type: "volume",
    ...cadence,
    baseFee: 0,
    tiers: [
      { upTo: 25000, unitPrice: 0.025 },
      { upTo: 100000, unitPrice: 0.015 },
      { upTo: "infinity", unitPrice: 0.01 },
    ],
  },
  package: { name: "Credit Packs", type: "package", ...cadence, baseFee: 0, packageSize: 5000, packagePrice: 75 },
};

export interface InvoiceLine {
  label: string;
  detail: string;
  amount: number;
}

export interface InvoicePreview {
  lines: InvoiceLine[];
  total: number;
}

export interface UsageInput {
  usage: number;
  seats: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString("en-US");
const rate = (n: number) => `$${n}`;

function tierLabel(from: number, upTo: Tier["upTo"]) {
  return upTo === "infinity" ? `${fmt(from + 1)}+` : `${fmt(from + 1)}–${fmt(upTo)}`;
}

function graduatedLines(tiers: Tier[], usage: number): InvoiceLine[] {
  const lines: InvoiceLine[] = [];
  let floor = 0;
  for (const tier of tiers) {
    if (usage <= floor) break;
    const ceiling = tier.upTo === "infinity" ? usage : Math.min(tier.upTo, usage);
    const units = ceiling - floor;
    const amount = units * tier.unitPrice + (tier.flatFee ?? 0);
    lines.push({ label: `Tier ${tierLabel(floor, tier.upTo)}`, detail: `${fmt(units)} × ${rate(tier.unitPrice)}`, amount: round2(amount) });
    if (tier.upTo === "infinity") break;
    floor = tier.upTo;
  }
  return lines;
}

function volumeLine(tiers: Tier[], usage: number): InvoiceLine | null {
  let floor = 0;
  for (const tier of tiers) {
    if (tier.upTo === "infinity" || usage <= tier.upTo) {
      const amount = usage * tier.unitPrice + (tier.flatFee ?? 0);
      return { label: `Bracket ${tierLabel(floor, tier.upTo)}`, detail: `${fmt(usage)} × ${rate(tier.unitPrice)}`, amount: round2(amount) };
    }
    floor = tier.upTo;
  }
  return null;
}

export function computeInvoice(plan: PriceConfig, { usage, seats }: UsageInput): InvoicePreview {
  const lines: InvoiceLine[] = [];
  if (plan.baseFee > 0) lines.push({ label: "Base fee", detail: plan.billingPeriod, amount: plan.baseFee });

  if (plan.type === "seat" || (plan.type === "hybrid" && plan.seatPrice)) {
    const billable = Math.max(0, seats - (plan.includedSeats ?? 0));
    lines.push({ label: "Seats", detail: `${fmt(billable)} × ${rate(plan.seatPrice ?? 0)}`, amount: round2(billable * (plan.seatPrice ?? 0)) });
  }
  if (plan.type === "usage" || plan.type === "hybrid") {
    const billable = Math.max(0, usage - (plan.includedUsage ?? 0));
    lines.push({
      label: plan.type === "hybrid" ? "Overage" : "Usage",
      detail: `${fmt(billable)} × ${rate(plan.overageUnitPrice ?? 0)}`,
      amount: round2(billable * (plan.overageUnitPrice ?? 0)),
    });
  }
  if (plan.type === "tiered") lines.push(...graduatedLines(plan.tiers ?? [], usage));
  if (plan.type === "volume") {
    const line = volumeLine(plan.tiers ?? [], usage);
    if (line) lines.push(line);
  }
  if (plan.type === "package") {
    const size = Math.max(1, plan.packageSize ?? 1);
    const packs = Math.ceil(usage / size);
    lines.push({ label: "Packages", detail: `${fmt(packs)} × ${rate(plan.packagePrice ?? 0)}`, amount: round2(packs * (plan.packagePrice ?? 0)) });
  }

  return { lines, total: round2(lines.reduce((sum, line) => sum + line.amount, 0)) };
}

export interface ParseResult {
  ok: boolean;
  plan?: PriceConfig;
  error?: string;
}

/** Validates editor text. Errors are shown in the status bar, so they read as sentences. */
export function parseConfig(source: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Config must be a JSON object." };
  }
  const plan = value as PriceConfig;
  if (!PRICE_TYPES.some((t) => t.id === plan.type)) {
    return { ok: false, error: `"type" must be one of: ${PRICE_TYPES.map((t) => t.id).join(", ")}.` };
  }
  if (typeof plan.baseFee !== "number" || plan.baseFee < 0) {
    return { ok: false, error: `"baseFee" must be a number of 0 or more.` };
  }
  if ((plan.type === "tiered" || plan.type === "volume") && !plan.tiers?.length) {
    return { ok: false, error: `A ${plan.type} price needs at least one entry in "tiers".` };
  }
  if (plan.tiers?.some((t) => typeof t.unitPrice !== "number" || (t.upTo !== "infinity" && typeof t.upTo !== "number"))) {
    return { ok: false, error: `Each tier needs a numeric "unitPrice" and an "upTo" number or "infinity".` };
  }
  return { ok: true, plan };
}

const money = String.raw`\$\s?([\d,]+(?:\.\d+)?)\s*(k)?`;
const num = (raw: string, k?: string) => Number(raw.replace(/,/g, "")) * (k ? 1000 : 1);

/**
 * Turns a one-line description into a config, e.g. "$49/mo plus $0.02 per call
 * over 10k". This is a local keyword reader for the demo, not the AI assistant.
 */
export function configFromPrompt(prompt: string): PriceConfig | null {
  const text = prompt.toLowerCase();
  const amounts = [...text.matchAll(new RegExp(money, "g"))].map((m) => num(m[1], m[2]));
  const included = text.match(/(?:over|after|above|first|includes?|including)\s+([\d,]+(?:\.\d+)?)\s*(k)?/);
  const pack = text.match(/(?:packs?|packages?|bundles?)\s+of\s+([\d,]+(?:\.\d+)?)\s*(k)?/);
  const small = amounts.find((a) => a < 1);
  const large = amounts.find((a) => a >= 1);

  if (/tier|graduated/.test(text)) return { ...PRESETS.tiered };
  if (/volume|bulk|bracket/.test(text)) return { ...PRESETS.volume };
  if (pack || /pack|bundle|credit/.test(text)) {
    return {
      ...PRESETS.package,
      packageSize: pack ? num(pack[1], pack[2]) : PRESETS.package.packageSize,
      packagePrice: large ?? PRESETS.package.packagePrice,
    };
  }
  if (/seat|per user|per member/.test(text)) {
    return { ...PRESETS.seat, seatPrice: large ?? small ?? PRESETS.seat.seatPrice };
  }
  if (large !== undefined && (small !== undefined || included)) {
    return {
      ...PRESETS.hybrid,
      baseFee: large,
      includedUsage: included ? num(included[1], included[2]) : PRESETS.hybrid.includedUsage,
      overageUnitPrice: small ?? PRESETS.hybrid.overageUnitPrice,
    };
  }
  if (small !== undefined || /usage|metered|per (call|request|event|token|gb|unit)/.test(text)) {
    return { ...PRESETS.usage, overageUnitPrice: small ?? PRESETS.usage.overageUnitPrice };
  }
  if (large !== undefined) return { ...PRESETS.flat, baseFee: large };
  return null;
}
