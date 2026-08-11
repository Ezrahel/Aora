import { useState, useMemo } from "react";
import { Eye, Code, Check, Copy, Terminal } from "lucide-react";

interface PricingPlanLivePreviewProps {
  planName: string;
  planDescription: string;
  basePrice: number;
  currency: string;
  billingPeriod: "weekly" | "monthly" | "yearly";
  pricingModel: "flat" | "seat";
  seatPrice: number;
  includedSeats: number;
}

const CURRENCIES: Record<string, { symbol: string; code: string }> = {
  NGN: { symbol: "₦", code: "NGN" },
  USD: { symbol: "$", code: "USD" },
  EUR: { symbol: "€", code: "EUR" },
};

function formatPrice(amount: number, currency: string): string {
  const c = CURRENCIES[currency] || CURRENCIES.USD;
  if (currency === "NGN") return `${c.symbol}${amount.toLocaleString()}`;
  return `${c.symbol}${amount.toLocaleString()}`;
}

function PriceDisplay({
  amount,
  currency,
  period,
}: {
  amount: number;
  currency: string;
  period: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-3xl font-black text-neutral-900 font-mono tracking-tight">
        {formatPrice(amount, currency)}
      </span>
      <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
        / {period}
      </span>
    </span>
  );
}

function SaveBadge({ percent }: { percent: number }) {
  return (
    <div className="absolute top-0 right-0 rounded-bl-xl bg-emerald-500 px-3 py-1.5 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
      Save {percent}%
    </div>
  );
}

function DetailItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-neutral-600">
      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

export default function PricingPlanLivePreview({
  planName,
  planDescription,
  basePrice,
  currency,
  billingPeriod,
  pricingModel,
  seatPrice,
  includedSeats,
}: PricingPlanLivePreviewProps) {
  const [activeTab, setActiveTab] = useState<"code" | "customer">("customer");

  const annualSavingsPercent = useMemo(() => {
    if (billingPeriod === "yearly" && basePrice > 0) {
      const monthlyPrice = basePrice;
      const yearlyPrice = monthlyPrice;
      const monthlyTotal = monthlyPrice * 12;
      if (monthlyTotal > 0) {
        const savings = Math.round(
          ((monthlyTotal - yearlyPrice) / monthlyTotal) * 100,
        );
        return Math.min(savings, 90);
      }
    }
    return 0;
  }, [billingPeriod, basePrice]);

  const periodLabel =
    billingPeriod === "weekly"
      ? "wk"
      : billingPeriod === "monthly"
        ? "mo"
        : "yr";

  const codePayload = useMemo(() => {
    const payload: Record<string, unknown> = {
      name: planName,
      description: planDescription || undefined,
      basePrice,
      currency,
      billingPeriod,
      pricingModel,
    };
    if (pricingModel === "seat") {
      payload.seatPrice = seatPrice;
      payload.includedSeats = includedSeats;
    }
    return JSON.stringify(payload, null, 2);
  }, [
    planName,
    planDescription,
    basePrice,
    currency,
    billingPeriod,
    pricingModel,
    seatPrice,
    includedSeats,
  ]);

  const [copied, setCopied] = useState(false);
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(codePayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex bg-neutral-100 p-1 rounded-xl w-fit border border-neutral-200">
        <button
          onClick={() => setActiveTab("customer")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "customer"
              ? "bg-white text-neutral-900 shadow-sm border border-neutral-200"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          Customer View Preview
        </button>
        <button
          onClick={() => setActiveTab("code")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "code"
              ? "bg-white text-neutral-900 shadow-sm border border-neutral-200"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <Code className="h-3.5 w-3.5" />
          Merchant Code Preview
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "code" ? (
        <div className="dp-card border dp-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between bg-neutral-900 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] font-mono text-neutral-300">
                POST /api/prices
              </span>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-4 text-[11px] font-mono leading-relaxed text-neutral-800 bg-white overflow-x-auto whitespace-pre-wrap">
            {codePayload}
          </pre>
        </div>
      ) : (
        <div className="dp-card border dp-border rounded-2xl p-5 bg-white hover:shadow-md transition-shadow relative overflow-hidden">
          {billingPeriod === "yearly" && annualSavingsPercent > 0 && (
            <SaveBadge percent={annualSavingsPercent} />
          )}

          <div className="space-y-1 text-left">
            <span className="text-[9px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-bold uppercase font-mono tracking-wide">
              {currency} PLAN
            </span>
            <h4 className="text-lg font-extrabold text-neutral-900 leading-tight pt-1">
              {planName || "Untitled Plan"}
            </h4>
            <p className="text-xs text-neutral-500 leading-snug">
              {planDescription || "No description provided"}
            </p>
          </div>

          <div className="my-5 flex items-baseline gap-1 bg-neutral-50 -mx-5 px-5 py-4 border-y border-neutral-100">
            {pricingModel === "seat" && seatPrice > 0 ? (
              <div className="flex flex-col">
                <PriceDisplay
                  amount={seatPrice}
                  currency={currency}
                  period={`seat / ${periodLabel}`}
                />
                <span className="text-[11px] text-neutral-500 mt-1">
                  +{" "}
                  <strong>
                    {formatPrice(
                      Math.max(0, basePrice),
                      currency,
                    )}
                  </strong>{" "}
                  base {periodLabel}ly platform fee
                </span>
              </div>
            ) : (
              <PriceDisplay
                amount={basePrice}
                currency={currency}
                period={periodLabel}
              />
            )}
          </div>

          <div className="space-y-2.5">
            {pricingModel === "seat" ? (
              <>
                <DetailItem
                  label={`Up to ${includedSeats} free seat${includedSeats !== 1 ? "s" : ""} included`}
                />
                <DetailItem
                  label={`${formatPrice(seatPrice, currency)} / additional seat / ${periodLabel}`}
                />
                {basePrice > 0 && (
                  <DetailItem
                    label={`Platform base: ${formatPrice(basePrice, currency)} / ${periodLabel}`}
                  />
                )}
              </>
            ) : (
              <DetailItem label={`Full platform access at ${formatPrice(basePrice, currency)} / ${periodLabel}`}
              />
            )}
            <DetailItem label="Cancel anytime, no lock-in contracts" />
            <DetailItem label="Priority support & SLA guaranteed" />
          </div>

          <button className="mt-6 w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-bold transition-all cursor-pointer">
            Subscribe —{" "}
            {pricingModel === "seat"
              ? `from ${formatPrice(seatPrice + basePrice, currency)}/${periodLabel}`
              : `${formatPrice(basePrice, currency)}/${periodLabel}`}
          </button>
        </div>
      )}
    </div>
  );
}
