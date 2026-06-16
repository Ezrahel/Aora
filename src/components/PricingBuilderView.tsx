import { useState, useEffect } from "react";
import {
  Plus,
  Zap,
  Sparkles,
  Sliders,
  Check,
  HelpCircle,
  Percent,
  Layers,
  Users,
  FileText,
  Calculator,
  History,
  Trash2,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  Briefcase,
  Activity,
  ShieldAlert,
  Clock,
  Coins,
  Eye,
  Globe,
  Undo,
  Lock,
  Unlock,
  Settings,
  Compass,
} from "lucide-react";
import {
  Plan,
  Customer,
  MeterDefinition,
  Price,
  RateCard,
  Discount,
  Coupon,
  CustomContract,
  Tier,
} from "../types";

interface PricingBuilderViewProps {
  onPlanCreated: () => void;
  existingPlans: Plan[];
  meters: MeterDefinition[];
  customers: Customer[];
}

export default function PricingBuilderView({
  onPlanCreated,
  existingPlans,
  meters = [],
  customers = [],
}: PricingBuilderViewProps) {
  // Tabs: catalog | builder | rate-cards | discounts-coupons | contracts | sandbox
  const [activeSubTab, setActiveSubTab] = useState<
    | "catalog"
    | "builder"
    | "rate-cards"
    | "discounts-coupons"
    | "contracts"
    | "sandbox"
  >("catalog");

  // API Synced states
  const [prices, setPrices] = useState<Price[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [contracts, setContracts] = useState<CustomContract[]>([]);

  // Feedback states
  const [loading, setLoading] = useState(false);
  const [isDeployingPrice, setIsDeployingPrice] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState("");
  const [submitErrorMsg, setSubmitErrorMsg] = useState("");

  // ==========================================
  // FETCH DATA
  // ==========================================
  const loadPricingResources = async () => {
    setLoading(true);
    try {
      const [pricesRes, rateCardsRes, discountsRes, couponsRes, contractsRes] =
        await Promise.all([
          fetch("/api/prices"),
          fetch("/api/rate-cards"),
          fetch("/api/discounts"),
          fetch("/api/coupons"),
          fetch("/api/contracts"),
        ]);

      const [
        pricesData,
        rateCardsData,
        discountsData,
        couponsData,
        contractsData,
      ] = await Promise.all([
        pricesRes.json(),
        rateCardsRes.json(),
        discountsRes.json(),
        couponsRes.json(),
        contractsRes.json(),
      ]);

      setPrices(pricesData);
      setRateCards(rateCardsData);
      setDiscounts(discountsData);
      setCoupons(couponsData);
      setContracts(contractsData);
    } catch (err) {
      console.error("Failed to load catalog resources", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPricingResources();
  }, [existingPlans]);

  // ==========================================
  // STATE: BUILDER FORM
  // ==========================================
  const [builderPlanId, setBuilderPlanId] = useState("growth");
  const [builderName, setBuilderName] = useState("Growth Standard Tier v3");
  const [builderType, setBuilderType] = useState<
    "flat" | "usage" | "seat" | "tiered" | "volume" | "package" | "hybrid"
  >("hybrid");
  const [builderBillingPeriod, setBuilderBillingPeriod] = useState<
    "monthly" | "yearly" | "quarterly" | "unlimited"
  >("monthly");
  const [builderCurrency, setBuilderCurrency] = useState("NGN");
  const [builderBaseFee, setBuilderBaseFee] = useState(15000);
  const [builderSeatPrice, setBuilderSeatPrice] = useState(2000);
  const [builderIncludedSeats, setBuilderIncludedSeats] = useState(10);
  const [builderMeterId, setBuilderMeterId] = useState("compute_meter");
  const [builderIncludedUsage, setBuilderIncludedUsage] = useState(50000);
  const [builderOverageUnitPrice, setBuilderOverageUnitPrice] = useState(2.0);

  // Package pricing helper
  const [builderPackageSize, setBuilderPackageSize] = useState(10000);
  const [builderPackagePrice, setBuilderPackagePrice] = useState(5000);

  // Dynamic Tiers
  const [builderTiers, setBuilderTiers] = useState<Tier[]>([
    { upTo: 1000, unitPrice: 0 },
    { upTo: 10000, unitPrice: 2.0 },
    { upTo: "infinity", unitPrice: 1.0 },
  ]);

  const handleAddTier = () => {
    setBuilderTiers([...builderTiers, { upTo: 50000, unitPrice: 1.5 }]);
  };

  const handleRemoveTier = (idx: number) => {
    setBuilderTiers(builderTiers.filter((_, i) => i !== idx));
  };

  const handleTierChange = (idx: number, field: keyof Tier, val: any) => {
    const updated = builderTiers.map((tier, i) => {
      if (i === idx) {
        return { ...tier, [field]: val };
      }
      return tier;
    });
    setBuilderTiers(updated);
  };

  // Dual Creation Custom attributes
  const [builderCreationMode, setBuilderCreationMode] = useState<
    "form" | "canvas"
  >("form");
  const [builderDesc, setBuilderDesc] = useState(
    "Enterprise-ready custom service levels with dynamic overage tiers.",
  );
  const [builderAnnualDiscount, setBuilderAnnualDiscount] = useState(20);
  const [builderMinSpend, setBuilderMinSpend] = useState(0);
  const [builderMaxSpend, setBuilderMaxSpend] = useState(500000);
  const [builderGracePeriod, setBuilderGracePeriod] = useState(7);
  const [builderPrepaidCredits, setBuilderPrepaidCredits] = useState(0);
  const [builderSoftLimitToggle, setBuilderSoftLimitToggle] = useState(true);
  const [builderLimitAmount, setBuilderLimitAmount] = useState(100000);
  const [
    builderRegionalPricingPercentage,
    setBuilderRegionalPricingPercentage,
  ] = useState(0);
  const [builderAddonPrice, setBuilderAddonPrice] = useState(5000);
  const [builderShowAdvanced, setBuilderShowAdvanced] = useState(false);

  // Simulation Sliders
  const [testActiveSeats, setTestActiveSeats] = useState(12);
  const [testMonthlyUsage, setTestMonthlyUsage] = useState(65000);

  // States moved from nested IIFE to top component level
  const [blocksOrder, setBlocksOrder] = useState<string[]>([
    "header",
    "base_fee",
    "seat_licensing",
    "usage_metering",
    "prepaid_credits",
    "advanced_spend_limits",
    "discounts_promotions",
    "addons",
  ]);

  const [disabledBlocks, setDisabledBlocks] = useState<Record<string, boolean>>(
    {
      prepaid_credits: true,
      advanced_spend_limits: true,
      addons: true,
      seat_licensing: true,
      usage_metering: false,
    },
  );

  const [collapsedBlocks, setCollapsedBlocks] = useState<
    Record<string, boolean>
  >({
    advanced_spend_limits: false,
    discounts_promotions: false,
  });

  useEffect(() => {
    setDisabledBlocks((prev) => ({
      ...prev,
      seat_licensing: builderType !== "seat" && builderType !== "hybrid",
      usage_metering: builderType === "flat",
    }));
  }, [builderType]);

  const handleDeployPrice = async () => {
    setSubmitSuccessMsg("");
    setSubmitErrorMsg("");
    setIsDeployingPrice(true);
    try {
      const payload = {
        planId: builderPlanId,
        name: builderName,
        type: builderType,
        billingPeriod: builderBillingPeriod,
        currency: builderCurrency,
        baseFee: Number(builderBaseFee),
        seatPrice:
          builderType === "seat" || builderType === "hybrid"
            ? Number(builderSeatPrice)
            : undefined,
        includedSeats:
          builderType === "seat" || builderType === "hybrid"
            ? Number(builderIncludedSeats)
            : undefined,
        meterId: builderMeterId,
        includedUsage:
          builderType === "hybrid" ? Number(builderIncludedUsage) : undefined,
        overageUnitPrice:
          builderType === "usage" || builderType === "hybrid"
            ? Number(builderOverageUnitPrice)
            : undefined,
        tiers:
          builderType === "tiered" || builderType === "volume"
            ? builderTiers
            : [],
        packageSize:
          builderType === "package" ? Number(builderPackageSize) : undefined,
        packagePrice:
          builderType === "package" ? Number(builderPackagePrice) : undefined,
      };

      const response = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to deploy price code to catalog.");
      }

      setSubmitSuccessMsg(
        "Pristine pricing version successfully compiled & activated in catalog ledger!",
      );
      onPlanCreated(); // notify parent App
      loadPricingResources(); // reload catalog locally
      setActiveSubTab("catalog");
    } catch (err: any) {
      setSubmitErrorMsg(err.message || "Failed to submit price structure");
    } finally {
      setIsDeployingPrice(false);
    }
  };

  // ==========================================
  // STATE: RATE CARD FORM
  // ==========================================
  const [rcName, setRcName] = useState("Compute Batch Standard");
  const [rcDesc, setRcDesc] = useState("Continuous sliding fee system");
  const [rcMeterId, setRcMeterId] = useState("compute_meter");
  const [rcPriceType, setRcPriceType] = useState<"flat" | "tiered" | "volume">(
    "flat",
  );
  const [rcUnitPrice, setRcUnitPrice] = useState(2.0);
  const [rcCurrency, setRcCurrency] = useState("NGN");

  const handleCreateRateCard = async () => {
    setSubmitSuccessMsg("");
    setSubmitErrorMsg("");
    try {
      const payload = {
        name: rcName,
        description: rcDesc,
        meterId: rcMeterId,
        priceType: rcPriceType,
        unitPrice: Number(rcUnitPrice),
        currency: rcCurrency,
        tiers: rcPriceType !== "flat" ? builderTiers : [],
      };

      const response = await fetch("/api/rate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to create unified Rate Card");

      setSubmitSuccessMsg(
        "Rate Card has been committed & linked to events telemetry!",
      );
      loadPricingResources();
    } catch (err: any) {
      setSubmitErrorMsg(err.message);
    }
  };

  // ==========================================
  // STATE: DISCOUNTS & COUPONS FORM
  // ==========================================
  const [discName, setDiscName] = useState("Acme Dev Partner 30");
  const [discType, setDiscType] = useState<"percentage" | "fixed">(
    "percentage",
  );
  const [discValue, setDiscValue] = useState(30);
  const [discAppliesTo, setDiscAppliesTo] = useState<
    "all" | "base_fee" | "overage" | "seat_fee"
  >("all");
  const [discDuration, setDiscDuration] = useState<
    "once" | "forever" | "repeating"
  >("forever");

  const [cpName, setCpName] = useState("Partner Spring Sale");
  const [cpCode, setCpCode] = useState("SPRING30");
  const [cpDiscountId, setCpDiscountId] = useState("");

  const handleCreateDiscount = async () => {
    setSubmitSuccessMsg("");
    setSubmitErrorMsg("");
    try {
      const payload = {
        name: discName,
        type: discType,
        value: Number(discValue),
        appliesTo: discAppliesTo,
        duration: discDuration,
      };

      const response = await fetch("/api/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to record workspace discount");

      setSubmitSuccessMsg("New promotional discount rules stored in ledger!");
      loadPricingResources();
    } catch (err: any) {
      setSubmitErrorMsg(err.message);
    }
  };

  const handleCreateCoupon = async () => {
    setSubmitSuccessMsg("");
    setSubmitErrorMsg("");
    try {
      const payload = {
        name: cpName,
        discountId: cpDiscountId || (discounts[0] ? discounts[0].id : ""),
        code: cpCode,
        maxRedemptions: 100,
      };

      const response = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok)
        throw new Error("Failed to deploy active promo coupon code");

      setSubmitSuccessMsg(
        `Active Coupon code ${cpCode.toUpperCase()} published successfully!`,
      );
      loadPricingResources();
    } catch (err: any) {
      setSubmitErrorMsg(err.message);
    }
  };

  // ==========================================
  // STATE: CONTRACTS FORM (ENTERPRISE OVERRIDES)
  // ==========================================
  const [contractCustId, setContractCustId] = useState("");
  const [contractName, setContractName] = useState(
    "Linear Custom Enterprise Contract",
  );
  const [contractBaseFee, setContractBaseFee] = useState(120000);
  const [contractSeatPrice, setContractSeatPrice] = useState(1100);
  const [contractOveragePrice, setContractOveragePrice] = useState(1.0);
  const [contractMinSpend, setContractMinSpend] = useState(150000);

  const handleCreateContract = async () => {
    setSubmitSuccessMsg("");
    setSubmitErrorMsg("");
    try {
      const targetCustId = contractCustId || customers[0]?.id || "";
      if (!targetCustId) {
        throw new Error(
          "Please select or configure an active customer account first.",
        );
      }

      const payload = {
        customerId: targetCustId,
        name: contractName,
        customBaseFee: Number(contractBaseFee),
        customSeatPrice: Number(contractSeatPrice),
        customOverageUnitPrice: Number(contractOveragePrice),
        minimumSpend: Number(contractMinSpend),
      };

      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok)
        throw new Error(
          "Failed to commit custom enterprise contract overrides.",
        );

      setSubmitSuccessMsg(
        "Enterprise Contract committed! Customer's future invoices will recalculate automatically.",
      );
      loadPricingResources();
      onPlanCreated(); // reload App main components
    } catch (err: any) {
      setSubmitErrorMsg(err.message);
    }
  };

  // ==========================================
  // STATE: SANDBOX SIMULATOR ROOM
  // ==========================================
  const [sbCustomerId, setSbCustomerId] = useState("");
  const [sbPriceId, setSbPriceId] = useState("");
  const [sbPlanId, setSbPlanId] = useState("growth");
  const [sbSeats, setSbSeats] = useState(12);
  const [sbLUsage, setSbLUsage] = useState(65000);
  const [sbCoupon, setSbCoupon] = useState("");
  const [sbUseCredits, setSbUseCredits] = useState(true);

  // Live sandbox simulated output statement
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      const payload = {
        customerId: sbCustomerId || undefined,
        priceId: sbPriceId || undefined,
        planId: sbPlanId,
        seatsCount: Number(sbSeats),
        usageUnits: Number(sbLUsage),
        couponCode: sbCoupon || undefined,
        useCredits: sbUseCredits,
      };

      const response = await fetch("/api/pricing-calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok)
        throw new Error("Error resolving estimate output breakdown");
      const resultObj = await response.json();
      setSimulationResult(resultObj);
    } catch (err) {
      console.error("Simulation run failed", err);
    } finally {
      setLoading(false);
    }
  };

  // Auto trigger simulation when sliders variables change or subtab switches to sandbox
  useEffect(() => {
    if (activeSubTab === "sandbox") {
      handleRunSimulation();
    }
  }, [
    sbCustomerId,
    sbPriceId,
    sbPlanId,
    sbSeats,
    sbLUsage,
    sbCoupon,
    sbUseCredits,
    activeSubTab,
  ]);

  // Synchronize simulation sliders when customer changes
  const handleSandboxCustomerChange = (val: string) => {
    setSbCustomerId(val);
    if (val) {
      const matchCust = customers.find((c) => c.id === val);
      if (matchCust) {
        setSbSeats(matchCust.seatsUsed);
        setSbLUsage(matchCust.usageUnits);
        setSbPlanId(matchCust.planId);
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* HEADER BAR */}
      <div className="border-b border-[#E5E5E7] pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#111111] flex items-center gap-2">
            Pricing & Monetization Engine
            <span className="text-[10px] bg-[#0071E3]/10 text-[#0071E3] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Phase 3 Live
            </span>
          </h2>
          <p className="text-xs text-[#6E6E73] mt-1.5 font-medium">
            Manage multi-tier plans, versioned price structures, custom
            enterprise SLAs, coupons, and simulate cash-flows visually.
          </p>
        </div>
      </div>

      {/* COMPACT BENTO TABS NAVIGATION BAR */}
      <div
        className="flex flex-wrap border-b border-[#E5E5E7] gap-1"
        id="pricing-submenu-tabs"
      >
        <button
          onClick={() => setActiveSubTab("catalog")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "catalog"
              ? "border-[#111111] text-[#111111]"
              : "border-transparent text-[#6E6E73] hover:text-[#111111]"
          }`}
        >
          <History className="h-3.5 w-3.5" />
          Price Catalog
        </button>
        <button
          onClick={() => {
            setActiveSubTab("builder");
            setBuilderName(
              `${builderPlanId.toUpperCase()} Core Billing Pricing v${(prices.filter((p) => p.planId === builderPlanId).length || 0) + 1}`,
            );
          }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "builder"
              ? "border-[#111111] text-[#111111]"
              : "border-transparent text-[#6E6E73] hover:text-[#111111]"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Pricing Builder
        </button>
        <button
          onClick={() => setActiveSubTab("rate-cards")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "rate-cards"
              ? "border-[#111111] text-[#111111]"
              : "border-transparent text-[#6E6E73] hover:text-[#111111]"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Rate Cards
        </button>
        <button
          onClick={() => {
            setActiveSubTab("discounts-coupons");
            if (discounts.length > 0 && !cpDiscountId)
              setCpDiscountId(discounts[0].id);
          }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "discounts-coupons"
              ? "border-[#111111] text-[#111111]"
              : "border-transparent text-[#6E6E73] hover:text-[#111111]"
          }`}
        >
          <Percent className="h-3.5 w-3.5" />
          Promo & Coupons
        </button>
        <button
          onClick={() => setActiveSubTab("contracts")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "contracts"
              ? "border-[#111111] text-[#111111]"
              : "border-transparent text-[#6E6E73] hover:text-[#111111]"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Enterprise Contracts
        </button>
        <button
          onClick={() => setActiveSubTab("sandbox")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "sandbox"
              ? "border-[#111111] text-[#111111]"
              : "border-transparent text-[#6E6E73] hover:text-[#111111]"
          }`}
        >
          <Calculator className="h-3.5 w-3.5" />
          Calculations Sandbox
        </button>
      </div>

      {/* FEEDBACK MASSAGES NOTIFIER */}
      {submitSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2.5">
          <Check className="h-4.5 w-4.5 bg-emerald-500 text-white rounded-full p-0.5 shrink-0" />
          {submitSuccessMsg}
        </div>
      )}
      {submitErrorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2.5">
          <AlertCircle className="h-4.5 w-4.5 bg-red-500 text-white rounded-full p-0.5 shrink-0" />
          Compile Error: {submitErrorMsg}
        </div>
      )}

      {/* TAB-VIEW 1: PRICE CATALOG */}
      {activeSubTab === "catalog" && (
        <div className="space-y-6">
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-stone-700" />
              <div>
                <p className="text-xs font-bold text-neutral-800 uppercase tracking-wide">
                  Immutable Price Audit
                </p>
                <p className="text-[11px] text-neutral-600 font-medium">
                  We enforce Stripe-grade immutable pricing versions. Any
                  adjustments compile a brand new catalog entry, protecting
                  legacy customers from plan contamination automatically.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {prices.map((price) => {
              const matchedPlan = existingPlans.find(
                (p) => p.id === price.planId,
              );
              return (
                <div
                  key={price.id}
                  className={`bg-white border rounded-2xl p-5 flex flex-col justify-between transition-all shadow-sm ${
                    price.isActive
                      ? "border-neutral-900 ring-1 ring-neutral-900"
                      : "border-neutral-200 opacity-70"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                        {price.planId} plan
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] bg-neutral-100 border text-neutral-800 font-bold px-1.5 py-0.5 rounded">
                          v{price.version}
                        </span>
                        {price.isActive ? (
                          <span className="text-[9px] bg-emerald-500 text-white font-bold px-1.5 py-0.5 rounded shadow-sm">
                            Active
                          </span>
                        ) : (
                          <span className="text-[9px] bg-neutral-100 text-neutral-500 font-bold px-1.5 py-0.5 rounded">
                            Legacy
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-neutral-900 mt-2">
                      {price.name}
                    </h3>
                    <p className="text-[10px] text-neutral-500 mt-1">
                      Compiled: {new Date(price.createdAt).toLocaleDateString()}
                    </p>

                    <div className="mt-4 pt-4 border-t border-dashed border-neutral-100 space-y-2 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span className="text-neutral-500">Pricing Model:</span>
                        <span className="text-neutral-900 capitalize font-mono text-[11px]">
                          {price.type}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">
                          Base Recurring Fee:
                        </span>
                        <span className="text-neutral-900 font-bold">
                          {price.currency === "NGN" ? "₦" : "$"}
                          {price.baseFee.toLocaleString()} /{" "}
                          {price.billingPeriod === "unlimited"
                            ? "flat"
                            : price.billingPeriod}
                        </span>
                      </div>

                      {(price.type === "seat" || price.type === "hybrid") && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-neutral-500">
                              Included Seats:
                            </span>
                            <span className="text-neutral-900 font-medium">
                              {price.includedSeats} included
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-500">
                              Seat overage fee:
                            </span>
                            <span className="text-neutral-900 font-bold">
                              {price.currency === "NGN" ? "₦" : "$"}
                              {price.seatPrice}/seat
                            </span>
                          </div>
                        </>
                      )}

                      {(price.type === "usage" || price.type === "hybrid") && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-neutral-500">
                              Included Usage:
                            </span>
                            <span className="text-neutral-900 font-medium">
                              {price.includedUsage?.toLocaleString() || 0} units
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-500">
                              Overage Unit Price:
                            </span>
                            <span className="text-neutral-900 font-bold">
                              {price.currency === "NGN" ? "₦" : "$"}
                              {price.overageUnitPrice}
                            </span>
                          </div>
                        </>
                      )}

                      {(price.type === "tiered" || price.type === "volume") && (
                        <div className="pt-2">
                          <p className="text-[10px] text-neutral-400 uppercase font-bold mb-1">
                            Tier Definitions
                          </p>
                          <div className="bg-neutral-50 rounded-lg p-2 space-y-1.5 max-h-24 overflow-y-auto">
                            {price.tiers?.map((tier, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between text-[11px]"
                              >
                                <span className="text-neutral-600 font-mono">
                                  Up to{" "}
                                  {tier.upTo === "infinity"
                                    ? "∞"
                                    : tier.upTo.toLocaleString()}
                                </span>
                                <span className="text-neutral-900 font-bold">
                                  {price.currency === "NGN" ? "₦" : "$"}
                                  {tier.unitPrice}/unit
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {price.type === "package" && (
                        <div className="flex justify-between">
                          <span className="text-neutral-500">
                            Package pricing:
                          </span>
                          <span className="text-neutral-900 font-bold">
                            {price.currency === "NGN" ? "₦" : "$"}
                            {price.packagePrice?.toLocaleString()} per{" "}
                            {price.packageSize?.toLocaleString()} units
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400 font-mono">
                      ID: {price.id}
                    </span>
                    {price.isActive && (
                      <button
                        onClick={() => {
                          setSbPlanId(price.planId);
                          setSbPriceId(price.id);
                          setActiveSubTab("sandbox");
                        }}
                        className="text-[11px] font-bold text-[#0071E3] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        Simulate
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB-VIEW 1.5: PRICING BUILDER */}
      {activeSubTab === "builder" &&
        (() => {
          const moveBlockUp = (id: string) => {
            const idx = blocksOrder.indexOf(id);
            if (idx > 0) {
              const updated = [...blocksOrder];
              const temp = updated[idx];
              updated[idx] = updated[idx - 1];
              updated[idx - 1] = temp;
              setBlocksOrder(updated);
            }
          };

          const moveBlockDown = (id: string) => {
            const idx = blocksOrder.indexOf(id);
            if (idx < blocksOrder.length - 1) {
              const updated = [...blocksOrder];
              const temp = updated[idx];
              updated[idx] = updated[idx + 1];
              updated[idx + 1] = temp;
              setBlocksOrder(updated);
            }
          };

          const toggleBlockDisabled = (id: string) => {
            const isCurrentlyDisabled = !!disabledBlocks[id];
            setDisabledBlocks((prev) => ({
              ...prev,
              [id]: !isCurrentlyDisabled,
            }));

            // Sync changes with actual state
            if (!isCurrentlyDisabled) {
              // we are disabling it
              if (id === "base_fee") setBuilderBaseFee(0);
              if (id === "prepaid_credits") setBuilderPrepaidCredits(0);
              if (id === "advanced_spend_limits") {
                setBuilderMinSpend(0);
                setBuilderMaxSpend(500000);
              }
              if (id === "addons") setBuilderAddonPrice(0);
              if (id === "seat_licensing" && builderType === "hybrid")
                setBuilderType("usage");
              if (id === "seat_licensing" && builderType === "seat")
                setBuilderType("flat");
              if (id === "usage_metering" && builderType === "hybrid")
                setBuilderType("seat");
              if (id === "usage_metering" && builderType === "usage")
                setBuilderType("flat");
            } else {
              // we are enabling it
              if (id === "base_fee" && builderBaseFee === 0)
                setBuilderBaseFee(29000);
              if (id === "prepaid_credits" && builderPrepaidCredits === 0)
                setBuilderPrepaidCredits(50000);
              if (id === "advanced_spend_limits") {
                setBuilderMinSpend(15000);
                setBuilderMaxSpend(400000);
              }
              if (id === "addons" && builderAddonPrice === 0)
                setBuilderAddonPrice(5000);
              if (id === "seat_licensing") {
                if (builderType === "flat") setBuilderType("seat");
                else if (builderType === "usage") setBuilderType("hybrid");
                if (builderSeatPrice === 0) setBuilderSeatPrice(2500);
              }
              if (id === "usage_metering") {
                if (builderType === "flat") setBuilderType("usage");
                else if (builderType === "seat") setBuilderType("hybrid");
                if (builderOverageUnitPrice === 0)
                  setBuilderOverageUnitPrice(1.5);
              }
            }
          };

          const toggleBlockCollapsed = (id: string) => {
            setCollapsedBlocks((prev) => ({ ...prev, [id]: !prev[id] }));
          };

          const duplicateBlock = (id: string) => {
            if (id === "addons") {
              setBuilderAddonPrice((prev) => prev * 2);
            } else if (id === "base_fee") {
              setBuilderBaseFee((prev) => prev + 15000);
            } else if (id === "prepaid_credits") {
              setBuilderPrepaidCredits((prev) => prev + 25000);
            } else if (id === "seat_licensing") {
              setBuilderSeatPrice((prev) => prev + 1000);
            } else if (id === "usage_metering") {
              setBuilderOverageUnitPrice((prev) => prev + 1.0);
            }
          };

          // Client-side instant recalculations
          const bill = (() => {
            const currencySymbol =
              builderCurrency === "NGN"
                ? "₦"
                : builderCurrency === "USD"
                  ? "$"
                  : "€";

            let baseVal = disabledBlocks["base_fee"]
              ? 0
              : Number(builderBaseFee);

            // Apply Annual Discount on baseline monthly flat fee
            let annualDiscountAmount = 0;
            if (
              builderBillingPeriod === "yearly" &&
              builderAnnualDiscount > 0
            ) {
              annualDiscountAmount = (baseVal * builderAnnualDiscount) / 100;
            }
            let baseAfterDiscount = baseVal - annualDiscountAmount;

            // Seat pricing calculation
            let seatCharges = 0;
            let seatOverageCount = 0;
            const isSeatActive =
              !disabledBlocks["seat_licensing"] &&
              (builderType === "seat" || builderType === "hybrid");
            if (isSeatActive) {
              const seatsCap = Number(builderIncludedSeats);
              const active = Number(testActiveSeats);
              if (active > seatsCap) {
                seatOverageCount = active - seatsCap;
                seatCharges = seatOverageCount * Number(builderSeatPrice);
              }
            }

            // Usage rules
            let usageCharges = 0;
            let usageDetailLines: string[] = [];
            const isUsageActive =
              !disabledBlocks["usage_metering"] &&
              builderType !== "flat" &&
              builderType !== "seat";
            const currentUsage = Number(testMonthlyUsage);

            if (isUsageActive) {
              if (builderType === "usage") {
                usageCharges = currentUsage * Number(builderOverageUnitPrice);
                usageDetailLines.push(
                  `${currentUsage.toLocaleString()} units consumed @ ${currencySymbol}${builderOverageUnitPrice}/unit`,
                );
              } else if (builderType === "hybrid") {
                const allowance = Number(builderIncludedUsage);
                if (currentUsage > allowance) {
                  const overage = currentUsage - allowance;
                  usageCharges = overage * Number(builderOverageUnitPrice);
                  usageDetailLines.push(
                    `${overage.toLocaleString()} units overage @ ${currencySymbol}${builderOverageUnitPrice}/unit`,
                  );
                } else {
                  usageDetailLines.push(
                    `All ${currentUsage.toLocaleString()} units fall under free workspace allowance`,
                  );
                }
              } else if (builderType === "tiered" || builderType === "volume") {
                if (builderTiers.length > 0) {
                  if (builderType === "tiered") {
                    let remaining = currentUsage;
                    let lastLimit = 0;
                    builderTiers.forEach((tier, i) => {
                      if (remaining <= 0) return;
                      const upToVal = tier.upTo;
                      const rate = Number(tier.unitPrice);
                      if (upToVal === "infinity") {
                        const units = remaining;
                        const cost = units * rate;
                        usageCharges += cost;
                        usageDetailLines.push(
                          `Tier ${i + 1} [${lastLimit.toLocaleString()} to ∞]: ${units.toLocaleString()} units @ ${currencySymbol}${rate} = ${currencySymbol}${cost.toLocaleString()}`,
                        );
                        remaining = 0;
                      } else {
                        const cap = Number(upToVal);
                        const size = cap - lastLimit;
                        const units = Math.min(remaining, size);
                        if (units > 0) {
                          const cost = units * rate;
                          usageCharges += cost;
                          usageDetailLines.push(
                            `Tier ${i + 1} [${lastLimit.toLocaleString()} to ${cap.toLocaleString()}]: ${units.toLocaleString()} units @ ${currencySymbol}${rate} = ${currencySymbol}${cost.toLocaleString()}`,
                          );
                          remaining -= units;
                        }
                        lastLimit = cap;
                      }
                    });
                  } else {
                    // Volume Pricing
                    let matched = builderTiers[builderTiers.length - 1];
                    for (let tier of builderTiers) {
                      if (
                        tier.upTo === "infinity" ||
                        currentUsage <= Number(tier.upTo)
                      ) {
                        matched = tier;
                        break;
                      }
                    }
                    const rate = Number(matched.unitPrice);
                    usageCharges = currentUsage * rate;
                    usageDetailLines.push(
                      `Volume matches bracket [Up to ${matched.upTo === "infinity" ? "∞" : matched.upTo.toLocaleString()}]: Entire ${currentUsage.toLocaleString()} units @ ${currencySymbol}${rate}/unit`,
                    );
                  }
                }
              } else if (builderType === "package") {
                const pSize = Number(builderPackageSize) || 1000;
                const pPrice = Number(builderPackagePrice);
                const packs = Math.ceil(currentUsage / pSize);
                usageCharges = packs * pPrice;
                usageDetailLines.push(
                  `${packs} packages utilized (${pSize.toLocaleString()} units ea) @ ${currencySymbol}${pPrice}/pack`,
                );
              }
            }

            // Addon Price
            const addonPrice = disabledBlocks["addons"]
              ? 0
              : Number(builderAddonPrice);

            // Subtotal
            let subtotal =
              baseAfterDiscount + seatCharges + usageCharges + addonPrice;

            // Apply Minimum commitment spend limits
            let minSpendAdjustment = 0;
            const minSpendTarget = disabledBlocks["advanced_spend_limits"]
              ? 0
              : Number(builderMinSpend);
            if (subtotal < minSpendTarget) {
              minSpendAdjustment = minSpendTarget - subtotal;
              subtotal = minSpendTarget;
            }

            // Apply Maximum Limit Cap (Hard/Soft ceiling checks)
            let cappedAdjustment = 0;
            const maxSpendTarget = disabledBlocks["advanced_spend_limits"]
              ? 99999999
              : Number(builderMaxSpend);
            if (subtotal > maxSpendTarget) {
              cappedAdjustment = subtotal - maxSpendTarget;
              subtotal = maxSpendTarget;
            }

            // Localized regional pricing
            let regionalDelta = 0;
            if (builderRegionalPricingPercentage !== 0) {
              regionalDelta =
                (subtotal * builderRegionalPricingPercentage) / 100;
              subtotal += regionalDelta;
            }

            // Prepaid credit offset
            let prepaidOffset = 0;
            const prepaidCredits = disabledBlocks["prepaid_credits"]
              ? 0
              : Number(builderPrepaidCredits);
            if (prepaidCredits > 0) {
              prepaidOffset = Math.min(subtotal, prepaidCredits);
              subtotal -= prepaidOffset;
            }

            return {
              flatBase: baseVal,
              annualDiscount: annualDiscountAmount,
              seatsOverage: seatOverageCount,
              seatsCharge: seatCharges,
              usageCharge: usageCharges,
              usageDetailLines,
              addonCost: addonPrice,
              minSpendAdjustment,
              cappedAdjustment,
              regionalDelta,
              prepaidOffset,
              total: Math.max(0, subtotal),
            };
          })();

          // Real-time Validations engine
          const validations = (() => {
            const list: {
              id: string;
              type: "error" | "warning";
              message: string;
              fix: string;
            }[] = [];

            if (
              builderBaseFee === 0 &&
              builderOverageUnitPrice === 0 &&
              builderType === "hybrid" &&
              !disabledBlocks["base_fee"]
            ) {
              list.push({
                id: "zero-base-zero-overage",
                type: "error",
                message:
                  "Hybrid pricing model outlines metrics overages, but recurring base price and overage unit are set to $0.",
                fix: "Initialize some recurring fee or unit overage rate inside the respective form or block panel.",
              });
            }

            if (
              builderBillingPeriod !== "yearly" &&
              builderAnnualDiscount > 0
            ) {
              list.push({
                id: "mismatched-discount",
                type: "warning",
                message: `Annual discount incentive is configured (${builderAnnualDiscount}%), but Billing Period is '${builderBillingPeriod}'.`,
                fix: "Transition recurring cycle to 'yearly' in Top Header, or reset premium annual discount to 0%.",
              });
            }

            if (
              !disabledBlocks["advanced_spend_limits"] &&
              builderMinSpend > builderMaxSpend
            ) {
              list.push({
                id: "circular-spend-rules",
                type: "error",
                message:
                  "Concurring limit conflict: Committed Spend floor exceeds maximum limit cap.",
                fix: "Reduce Minimum Spend commitment or scale up the Hard/Soft Limit protection Ceiling.",
              });
            }

            if (
              (builderType === "usage" || builderType === "hybrid") &&
              builderOverageUnitPrice <= 0 &&
              !disabledBlocks["usage_metering"]
            ) {
              list.push({
                id: "empty-overage",
                type: "error",
                message: `${builderType.toUpperCase()} metered items specify extra-usage fees, but unit price is $0.`,
                fix: "Input an active unit billing rate (e.g., ₦1.5 per compute request) to activate revenue generation.",
              });
            }

            if (
              (builderType === "tiered" || builderType === "volume") &&
              builderTiers.length === 0 &&
              !disabledBlocks["usage_metering"]
            ) {
              list.push({
                id: "empty-tiers-sequences",
                type: "error",
                message:
                  "Continuous tier strategy selected but pricing sequence is completely vacant.",
                fix: "Add pricing tiers or volume brackets using the 'Add Tier Block' triggers.",
              });
            }

            const hasNegativeTiers = builderTiers.some((t) => t.unitPrice < 0);
            if (hasNegativeTiers) {
              list.push({
                id: "negative-tiers",
                type: "error",
                message:
                  "Escalating brackets contain negative tier unit pricing values.",
                fix: "Correct tier rates to non-negative values to compile safely.",
              });
            }

            const isCreditsHigh =
              !disabledBlocks["prepaid_credits"] &&
              builderPrepaidCredits >= builderBaseFee &&
              builderBaseFee > 0;
            if (isCreditsHigh) {
              list.push({
                id: "over-credited-baseline",
                type: "warning",
                message:
                  "Prepaid signup credit bundle completely outweighs the base subscription fee.",
                fix: "Be aware this completely cancels the first cycle's invoice. Standard behaviour is normal.",
              });
            }

            return list;
          })();

          const formatCurrencyInBuilder = (
            amount: number,
            currency: string,
          ) => {
            return new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: currency || "NGN",
              maximumFractionDigits: 1,
            }).format(amount);
          };

          return (
            <div className="space-y-6">
              {/* Real-time sync Switcher Header */}
              <div className="bg-[#111111] text-white p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md text-left">
                <div>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Shared Pricing State Engine Active
                  </span>
                  <h3 className="text-lg font-bold tracking-tight text-white mt-1">
                    Dual-Mode Structural Price Compiler
                  </h3>
                  <p className="text-xs text-neutral-300 mt-1">
                    Design complex hybrid, tiered, and contract blueprints.
                    Switch seamlessly between form-inputs & raw block layouts
                    with instant synchronization.
                  </p>
                </div>

                {/* View Switcher Toggles */}
                <div className="flex bg-neutral-800 p-1 rounded-xl border border-neutral-700 self-start sm:self-auto shrink-0">
                  <button
                    onClick={() => setBuilderCreationMode("form")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      builderCreationMode === "form"
                        ? "bg-[#0071E3] text-white shadow"
                        : "text-neutral-400 hover:text-white"
                    }`}
                    id="tab-toggle-guided-form"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Form Builder
                  </button>
                  <button
                    onClick={() => setBuilderCreationMode("canvas")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      builderCreationMode === "canvas"
                        ? "bg-[#0071E3] text-white shadow"
                        : "text-neutral-400 hover:text-white"
                    }`}
                    id="tab-toggle-visual-canvas"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Visual Canvas
                  </button>
                </div>
              </div>

              {/* Split Screen Grid Workspace Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column Strategy: Form Interface vs. Visual Canvas Tree */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Sub-view switcher renderer */}
                  {builderCreationMode === "form" ? (
                    /* SUB VIEW: GUIDED FORM BUILDER */
                    <div className="bg-white border border-[#E5E5E7] p-6 rounded-3xl shadow-sm text-left space-y-6 animate-in fade-in duration-200">
                      <div className="border-b pb-4 flex justify-between items-center bg-[#FAFAFA] -mx-6 -mt-6 p-6 rounded-t-3xl">
                        <div>
                          <h4 className="text-sm font-bold text-[#111111]">
                            Guided Form Path
                          </h4>
                          <p className="text-[11px] text-[#6E6E73] mt-0.5">
                            Continuous fields form structured for finance &
                            operations
                          </p>
                        </div>
                        <span className="text-[10px] bg-blue-50 text-[#0071E3] px-2 py-0.5 rounded font-bold uppercase">
                          Form Interface
                        </span>
                      </div>

                      {/* Section 1: Basic specifications */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-neutral-100 pb-1.5">
                          <Briefcase className="h-4.5 w-4.5 text-[#0071E3]" />
                          <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                            Baseline Attributes
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#6E6E73] uppercase block">
                              Associate with Contract Plan
                            </label>
                            <select
                              value={builderPlanId}
                              onChange={(e) => {
                                setBuilderPlanId(e.target.value);
                                const match = existingPlans.find(
                                  (p) => p.id === e.target.value,
                                );
                                setBuilderName(
                                  `${match?.name || e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1)} Scale Pricing`,
                                );
                              }}
                              className="w-full text-xs border border-[#E5E5E7] focus:border-black rounded-lg p-2 bg-transparent text-neutral-900"
                            >
                              {existingPlans.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#6E6E73] uppercase block">
                              Price Formula Label
                            </label>
                            <input
                              type="text"
                              value={builderName}
                              onChange={(e) => setBuilderName(e.target.value)}
                              className="w-full text-xs border border-[#E5E5E7] focus:border-black rounded-lg p-2 bg-transparent text-neutral-900 font-medium"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#6E6E73] uppercase block">
                              Billing Interval
                            </label>
                            <select
                              value={builderBillingPeriod}
                              onChange={(e) =>
                                setBuilderBillingPeriod(e.target.value as any)
                              }
                              className="w-full text-xs border border-[#E5E5E7] focus:border-black rounded-lg p-2 bg-transparent text-neutral-900"
                            >
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option>
                              <option value="yearly">Yearly</option>
                              <option value="unlimited">Lifetime Flat</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#6E6E73] uppercase block">
                              Settle Currency
                            </label>
                            <select
                              value={builderCurrency}
                              onChange={(e) =>
                                setBuilderCurrency(e.target.value)
                              }
                              className="w-full text-xs border border-[#E5E5E7] focus:border-black rounded-lg p-2 bg-transparent text-neutral-900"
                            >
                              <option value="NGN">NGN (₦)</option>
                              <option value="USD">USD ($)</option>
                              <option value="EUR">EUR (€)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#6E6E73] uppercase block">
                              Methodology Class
                            </label>
                            <select
                              value={builderType}
                              onChange={(e) => {
                                const nextType = e.target.value as any;
                                setBuilderType(nextType);

                                // sync automatic togglers
                                setDisabledBlocks((prev) => ({
                                  ...prev,
                                  seat_licensing:
                                    nextType !== "seat" &&
                                    nextType !== "hybrid",
                                  usage_metering: nextType === "flat",
                                }));
                              }}
                              className="w-full text-xs border border-[#E5E5E7] focus:border-black rounded-lg p-2 bg-transparent text-neutral-900 font-bold"
                            >
                              <option value="flat">
                                Flat Model (Single Fee)
                              </option>
                              <option value="usage">
                                Usage Model (Per-Unit Overage)
                              </option>
                              <option value="seat">
                                Seat Model (Pricing per member)
                              </option>
                              <option value="tiered">
                                Tiered Pricing Brackets
                              </option>
                              <option value="volume">
                                Volume Pricing Brackets
                              </option>
                              <option value="package">
                                Package Pricing blocks
                              </option>
                              <option value="hybrid">
                                Hybrid Engine (Base + Seat + Overage)
                              </option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#6E6E73] uppercase block">
                            Internal Memo & Description
                          </label>
                          <textarea
                            rows={2}
                            value={builderDesc}
                            onChange={(e) => setBuilderDesc(e.target.value)}
                            className="w-full text-xs border border-[#E5E5E7] focus:border-black rounded-lg p-2 bg-transparent text-neutral-900 resize-none"
                            placeholder="Internal description of target segment..."
                          />
                        </div>
                      </div>

                      {/* Section 2: Core Fees */}
                      <div className="space-y-4 pt-3 border-t">
                        <div className="flex items-center gap-2 border-b border-neutral-100 pb-1.5">
                          <Coins className="h-4.5 w-4.5 text-[#0071E3]" />
                          <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                            Base recurring Plan price
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#6E6E73] uppercase block">
                              Base recurrent fee
                            </label>
                            <div className="relative flex items-center">
                              <span className="absolute left-3 text-xs text-neutral-400 font-mono">
                                {builderCurrency === "NGN"
                                  ? "₦"
                                  : builderCurrency === "USD"
                                    ? "$"
                                    : "€"}
                              </span>
                              <input
                                type="number"
                                value={builderBaseFee}
                                onChange={(e) =>
                                  setBuilderBaseFee(
                                    Math.max(0, Number(e.target.value)),
                                  )
                                }
                                className="w-full text-xs border border-[#E5E5E7] rounded-lg p-2 pl-7 text-neutral-900"
                              />
                            </div>
                            <span className="text-[9px] text-[#86868B] block">
                              Standard recurrent baseline fee
                            </span>
                          </div>

                          {(builderType === "usage" ||
                            builderType === "hybrid") && (
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-[#6E6E73] uppercase block">
                                Unit Overage Price
                              </label>
                              <div className="relative flex items-center">
                                <span className="absolute left-3 text-xs text-neutral-400 font-mono">
                                  {builderCurrency === "NGN"
                                    ? "₦"
                                    : builderCurrency === "USD"
                                      ? "$"
                                      : "€"}
                                </span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={builderOverageUnitPrice}
                                  onChange={(e) =>
                                    setBuilderOverageUnitPrice(
                                      Math.max(0, Number(e.target.value)),
                                    )
                                  }
                                  className="w-full text-xs border border-[#E5E5E7] rounded-lg p-2 pl-7 text-neutral-900 font-mono"
                                />
                              </div>
                              <span className="text-[9px] text-[#86868B] block">
                                Charged for excess units utilized
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 3: Seats allowances if chosen */}
                      {(builderType === "seat" || builderType === "hybrid") && (
                        <div className="space-y-4 pt-3 border-t p-4 bg-slate-50/60 rounded-2xl border">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-indigo-600" />
                            <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                              Seats Pricing & allowances
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-600 block">
                                Included Baseline seats
                              </label>
                              <input
                                type="number"
                                value={builderIncludedSeats}
                                onChange={(e) =>
                                  setBuilderIncludedSeats(
                                    Math.max(0, Number(e.target.value)),
                                  )
                                }
                                className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-neutral-900"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-600 block">
                                Pricing per excess member
                              </label>
                              <div className="relative flex items-center">
                                <span className="absolute left-3 text-xs text-neutral-400 font-mono">
                                  {builderCurrency === "NGN"
                                    ? "₦"
                                    : builderCurrency === "USD"
                                      ? "$"
                                      : "€"}
                                </span>
                                <input
                                  type="number"
                                  value={builderSeatPrice}
                                  onChange={(e) =>
                                    setBuilderSeatPrice(
                                      Math.max(0, Number(e.target.value)),
                                    )
                                  }
                                  className="w-full text-xs border border-slate-200 rounded-lg p-2 pl-7 bg-white text-neutral-900 font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Section 4: Hybrid configurations and metric hooks */}
                      {builderType === "hybrid" && (
                        <div className="space-y-4 pt-3 border-t p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-orange-600" />
                            <span className="text-[11px] font-bold text-orange-900 uppercase tracking-wider">
                              Dynamic Metric Overage Integration
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-orange-850 block">
                                Usage Allowance floor
                              </label>
                              <input
                                type="number"
                                value={builderIncludedUsage}
                                onChange={(e) =>
                                  setBuilderIncludedUsage(
                                    Math.max(0, Number(e.target.value)),
                                  )
                                }
                                className="w-full text-xs border border-orange-200 rounded-lg p-2 bg-white text-neutral-900"
                              />
                              <span className="text-[9px] text-[#86868B] block">
                                Calcula balance before overage kicks in
                              </span>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-orange-850 block">
                                Linked event Meter
                              </label>
                              <select
                                value={builderMeterId}
                                onChange={(e) =>
                                  setBuilderMeterId(e.target.value)
                                }
                                className="w-full text-xs border border-orange-200 rounded-lg p-2 bg-white text-neutral-900"
                              >
                                {meters.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} ({m.id})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Section 5: Continuous cascading tiers */}
                      {(builderType === "tiered" ||
                        builderType === "volume") && (
                        <div className="p-4 bg-neutral-50 rounded-2xl border space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#6E6E73] uppercase tracking-wider">
                              Bracket Pricing Brackets
                            </span>
                            <button
                              onClick={handleAddTier}
                              type="button"
                              className="bg-[#111111] hover:bg-neutral-800 text-white font-semibold text-[10px] px-2.5 py-1 rounded cursor-pointer"
                            >
                              + Add Bracket
                            </button>
                          </div>

                          <div className="space-y-2">
                            {builderTiers.map((tier, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 bg-white p-2.5 rounded-xl border"
                              >
                                <span className="text-xs font-bold text-neutral-500">
                                  Bracket {idx + 1}:
                                </span>
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium text-neutral-500">
                                      Ceiling
                                    </span>
                                    <input
                                      type="text"
                                      value={tier.upTo}
                                      onChange={(e) =>
                                        handleTierChange(
                                          idx,
                                          "upTo",
                                          e.target.value === "infinity"
                                            ? "infinity"
                                            : Number(e.target.value),
                                        )
                                      }
                                      className="w-full border rounded p-1 text-xs outline-none focus:border-black font-mono"
                                      placeholder="e.g. 1000 or infinity"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium text-neutral-500">
                                      Unit Price
                                    </span>
                                    <div className="relative flex items-center w-full">
                                      <span className="absolute left-2 text-[10px] text-neutral-100/50 font-semibold">
                                        ₦
                                      </span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={tier.unitPrice}
                                        onChange={(e) =>
                                          handleTierChange(
                                            idx,
                                            "unitPrice",
                                            Number(e.target.value),
                                          )
                                        }
                                        className="w-full border rounded p-1 pl-4.5 text-xs outline-none focus:border-black font-mono"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemoveTier(idx)}
                                  type="button"
                                  className="p-1 text-neutral-400 hover:text-red-500 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section 6: Packages block sizing constraints */}
                      {builderType === "package" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-cyan-50/20 rounded-2xl border border-cyan-200/50">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-cyan-900 block">
                              Package Unit size allowance
                            </label>
                            <input
                              type="number"
                              value={builderPackageSize}
                              onChange={(e) =>
                                setBuilderPackageSize(
                                  Math.max(1, Number(e.target.value)),
                                )
                              }
                              className="w-full text-xs border border-cyan-150 rounded-lg p-2 bg-white text-neutral-900"
                              placeholder="e.g. 10000"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-cyan-900 block">
                              Price per Unit Block
                            </label>
                            <div className="relative flex items-center">
                              <span className="absolute left-3 text-xs text-neutral-400 font-mono">
                                {builderCurrency === "NGN"
                                  ? "₦"
                                  : builderCurrency === "USD"
                                    ? "$"
                                    : "€"}
                              </span>
                              <input
                                type="number"
                                value={builderPackagePrice}
                                onChange={(e) =>
                                  setBuilderPackagePrice(
                                    Math.max(0, Number(e.target.value)),
                                  )
                                }
                                className="w-full text-xs border border-cyan-150 rounded-lg p-2 pl-7 bg-white text-neutral-900 font-mono"
                                placeholder="e.g. 15000"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* PROGRESSIVE DISCLOSURE ADVANCED RULES CONTROLS */}
                      <div className="space-y-4 pt-4 border-t">
                        <button
                          type="button"
                          onClick={() =>
                            setBuilderShowAdvanced(!builderShowAdvanced)
                          }
                          className="flex items-center justify-between w-full p-3 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-colors border text-xs font-semibold text-neutral-700 cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Settings className="h-4 w-4 text-stone-500" />
                            Advanced Limit Controls, Credits and Annual
                            Deductions
                          </span>
                          <span className="text-[10px] text-stone-500">
                            {builderShowAdvanced
                              ? "Hide Advanced Options ▲"
                              : "Show Advanced Options ▼"}
                          </span>
                        </button>

                        {builderShowAdvanced && (
                          <div className="space-y-4 p-4 bg-stone-50/50 rounded-2xl border animate-in slide-in-from-top-3 duration-255">
                            {/* Minimum and Max Spend Cappings */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#6E6E73] uppercase block">
                                  Minimum Spend Commitment Floor
                                </label>
                                <div className="relative flex items-center">
                                  <span className="absolute left-3 text-xs text-neutral-400 font-mono">
                                    ₦
                                  </span>
                                  <input
                                    type="number"
                                    value={builderMinSpend}
                                    onChange={(e) =>
                                      setBuilderMinSpend(
                                        Math.max(0, Number(e.target.value)),
                                      )
                                    }
                                    className="w-full text-xs border border-neutral-200 rounded-lg p-2 pl-7 text-neutral-900"
                                  />
                                </div>
                                <span className="text-[9px] text-[#86868B] block">
                                  SLA round-up minimum client invoice
                                </span>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#6E6E73] uppercase block">
                                  Maximum Ceiling cap (Hard Ceiling)
                                </label>
                                <div className="relative flex items-center">
                                  <span className="absolute left-3 text-xs text-neutral-400 font-mono">
                                    ₦
                                  </span>
                                  <input
                                    type="number"
                                    value={builderMaxSpend}
                                    onChange={(e) =>
                                      setBuilderMaxSpend(
                                        Math.max(0, Number(e.target.value)),
                                      )
                                    }
                                    className="w-full text-xs border border-neutral-200 rounded-lg p-2 pl-7 text-neutral-900"
                                  />
                                </div>
                                <span className="text-[9px] text-[#86868B] block">
                                  Cap limits to protect client wallets
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-neutral-200">
                              {/* Grace periods */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#6E6E73] uppercase block">
                                  Payment Grace Period days
                                </label>
                                <input
                                  type="number"
                                  value={builderGracePeriod}
                                  onChange={(e) =>
                                    setBuilderGracePeriod(
                                      Math.max(0, Number(e.target.value)),
                                    )
                                  }
                                  className="w-full text-xs border border-neutral-200 rounded-lg p-2 text-neutral-900"
                                />
                              </div>

                              {/* Annual cycle premium discount */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#6E6E73] uppercase block">
                                  Annual Cycle Premium discount %
                                </label>
                                <div className="relative flex items-center">
                                  <input
                                    type="number"
                                    value={builderAnnualDiscount}
                                    onChange={(e) =>
                                      setBuilderAnnualDiscount(
                                        Math.min(
                                          100,
                                          Math.max(0, Number(e.target.value)),
                                        ),
                                      )
                                    }
                                    className="w-full text-xs border border-neutral-200 rounded-lg p-2 pr-7 text-neutral-900"
                                  />
                                  <span className="absolute right-3 text-xs text-neutral-400 font-mono">
                                    %
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-neutral-200">
                              {/* Prepaid credit bundled upon registration */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#6E6E73] uppercase block">
                                  Prepaid credit signup voucher
                                </label>
                                <div className="relative flex items-center">
                                  <span className="absolute left-3 text-xs text-neutral-400 font-mono">
                                    ₦
                                  </span>
                                  <input
                                    type="number"
                                    value={builderPrepaidCredits}
                                    onChange={(e) =>
                                      setBuilderPrepaidCredits(
                                        Math.max(0, Number(e.target.value)),
                                      )
                                    }
                                    className="w-full text-xs border border-neutral-200 rounded-lg p-2 pl-7 text-neutral-900"
                                  />
                                </div>
                              </div>

                              {/* Regional custom discounting */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#6E6E73] uppercase block">
                                  Regional Pricing Adjustment %
                                </label>
                                <div className="relative flex items-center">
                                  <input
                                    type="number"
                                    value={builderRegionalPricingPercentage}
                                    onChange={(e) =>
                                      setBuilderRegionalPricingPercentage(
                                        Number(e.target.value),
                                      )
                                    }
                                    className="w-full text-xs border border-neutral-200 rounded-lg p-2 pr-7 text-neutral-900"
                                  />
                                  <span className="absolute right-3 text-xs text-neutral-400 font-mono">
                                    %
                                  </span>
                                </div>
                                <span className="text-[9px] text-[#86868B] block">
                                  Localized tax/currency offsets
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleDeployPrice}
                        disabled={isDeployingPrice}
                        className="w-full py-3 bg-[#111111] hover:bg-neutral-900 text-white rounded-xl text-xs font-semibold shadow transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        id="submit-spec-compile-btn"
                      >
                        {isDeployingPrice
                          ? "Deploying to ledger..."
                          : "Deploy Code to Ledger & Update Catalog"}
                      </button>
                    </div>
                  ) : (
                    /* SUB VIEW: VISUAL PRICING CANVAS */
                    <div className="space-y-4 animate-in fade-in duration-200 text-left">
                      <div className="bg-stone-900 text-neutral-200 p-5 rounded-3xl border border-stone-800 flex justify-between items-center shadow-lg">
                        <div>
                          <h4 className="text-xs font-bold text-[#ffffff] uppercase tracking-wider">
                            Visual Workspace Node-Tree
                          </h4>
                          <p className="text-[11px] text-stone-400 mt-1">
                            Reorder active modules, re-link thresholds & specify
                            rates on visual cards
                          </p>
                        </div>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded font-bold border border-emerald-500/20">
                          Canvas Mode Live
                        </span>
                      </div>

                      {/* Canvas Blocks Ordering Container */}
                      <div className="space-y-4 relative pl-4 border-l border-neutral-300">
                        {blocksOrder.map((blockId, index) => {
                          const isNodeDisabled = !!disabledBlocks[blockId];
                          const isNodeCollapsed = !!collapsedBlocks[blockId];

                          // Node titles and info
                          let title = "Pricing Card Component Descriptor";
                          let description = "Description helper text details";
                          let colorBorderClass = "border-neutral-200";
                          let bannerBg = "bg-neutral-50";
                          let iconNode = <Compass className="h-4 w-4" />;

                          if (blockId === "header") {
                            title = "Plan Header node";
                            description =
                              "Identifies primary billing keys, associated plans, labels & interval cycles";
                            colorBorderClass =
                              "border-sky-200 focus-within:ring-1 focus-within:ring-sky-400";
                            bannerBg = "bg-sky-50 text-sky-900";
                            iconNode = (
                              <Compass className="h-4 w-4 text-sky-600" />
                            );
                          } else if (blockId === "base_fee") {
                            title = "recurring Base fee flat rate";
                            description =
                              "Initial flat monthly/yearly rate charged on enrollment";
                            colorBorderClass =
                              "border-amber-200 focus-within:ring-1 focus-within:ring-amber-400";
                            bannerBg = "bg-amber-50 text-amber-900";
                            iconNode = (
                              <Coins className="h-4 w-4 text-amber-600" />
                            );
                          } else if (blockId === "seat_licensing") {
                            title = "Seat Pricing License Module";
                            description =
                              "Tracks seats consumed and computes fees for addition multipliers";
                            colorBorderClass =
                              "border-indigo-200 focus-within:ring-1 focus-within:ring-indigo-400";
                            bannerBg = "bg-indigo-50 text-indigo-900";
                            iconNode = (
                              <Users className="h-4 w-4 text-indigo-600" />
                            );
                          } else if (blockId === "usage_metering") {
                            title = `${builderType.toUpperCase()} usage metric parameters`;
                            description =
                              "Integrate event meter variables to trigger tiers or metered allowances overages";
                            colorBorderClass =
                              "border-orange-200 focus-within:ring-1 focus-within:ring-orange-400";
                            bannerBg = "bg-orange-50 text-orange-900";
                            iconNode = (
                              <Activity className="h-4 w-4 text-orange-600" />
                            );
                          } else if (blockId === "prepaid_credits") {
                            title = "Prepaid Balance Credits voucher";
                            description =
                              "Offset client invoice based on prepaid loaded promo voucher balance";
                            colorBorderClass =
                              "border-cyan-200 focus-within:ring-1 focus-within:ring-cyan-400";
                            bannerBg = "bg-cyan-50 text-cyan-900";
                            iconNode = (
                              <Lock className="h-4 w-4 text-cyan-600" />
                            );
                          } else if (blockId === "advanced_spend_limits") {
                            title = "Floors & Caps Spending guardrails";
                            description =
                              "Applies Minimum commitments floors and maximum hard cap protection limits";
                            colorBorderClass =
                              "border-pink-200 focus-within:ring-1 focus-within:ring-pink-400";
                            bannerBg = "bg-pink-50 text-pink-900";
                            iconNode = (
                              <ShieldAlert className="h-4 w-4 text-pink-600" />
                            );
                          } else if (blockId === "discounts_promotions") {
                            title =
                              "Campaign Premium Discounts & regional Adjustments";
                            description =
                              "Annual discount cycle deductions and localized tax/currency multiplier";
                            colorBorderClass =
                              "border-emerald-200 focus-within:ring-1 focus-within:ring-emerald-400";
                            bannerBg = "bg-emerald-50 text-emerald-900";
                            iconNode = (
                              <Sparkles className="h-4 w-4 text-emerald-600" />
                            );
                          } else if (blockId === "addons") {
                            title = "Workspace Multi-add-on extensions";
                            description =
                              "Manage optional modular baseline services and custom add-on fee pricing";
                            colorBorderClass =
                              "border-violet-200 focus-within:ring-1 focus-within:ring-violet-400";
                            bannerBg = "bg-violet-50 text-violet-900";
                            iconNode = (
                              <Layers className="h-4 w-4 text-violet-600" />
                            );
                          }

                          return (
                            <div
                              key={blockId}
                              style={{ opacity: isNodeDisabled ? 0.6 : 1 }}
                              className={`bg-white border rounded-3xl shadow-sm overflow-hidden transition-all duration-200 ${colorBorderClass}`}
                            >
                              {/* Block Header bar with controls */}
                              <div
                                className={`px-4 py-3 flex items-center justify-between border-b ${bannerBg}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-1 bg-white rounded-lg shadow-sm">
                                    {iconNode}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-[#86868B] uppercase">
                                        Node {index + 1}
                                      </span>
                                      {isNodeDisabled && (
                                        <span className="text-[8px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-bold uppercase">
                                          Suspended/Disabled
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs font-extrabold text-neutral-800 capitalize leading-none pt-0.5">
                                      {title}
                                    </p>
                                  </div>
                                </div>

                                {/* Canvas Control Actions block */}
                                <div className="flex items-center gap-1 pb-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleBlockCollapsed(blockId)
                                    }
                                    className="p-1 text-stone-500 hover:text-black hover:bg-black/5 rounded cursor-pointer"
                                    title="Collapse details"
                                  >
                                    <span className="text-[11px] font-mono font-bold">
                                      {isNodeCollapsed ? "展开" : "折叠"}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => duplicateBlock(blockId)}
                                    className="p-1 text-stone-500 hover:text-black hover:bg-black/5 rounded cursor-pointer"
                                    title="Duplicate block rules value"
                                  >
                                    <span className="text-[11px] font-mono font-bold">
                                      📂 Clone
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleBlockDisabled(blockId)}
                                    className="p-1 text-stone-500 hover:text-black hover:bg-black/5 rounded cursor-pointer"
                                    title={
                                      isNodeDisabled
                                        ? "Activate module"
                                        : "Disable module"
                                    }
                                  >
                                    <span className="text-[11px] font-mono font-bold">
                                      {isNodeDisabled
                                        ? "✔ Activate"
                                        : "❌ Cut out"}
                                    </span>
                                  </button>

                                  {/* Draggable shift buttons */}
                                  <div className="border-l pl-1.5 flex items-center gap-0.5">
                                    <button
                                      onClick={() => moveBlockUp(blockId)}
                                      disabled={index === 0}
                                      type="button"
                                      className="p-1 text-stone-400 hover:text-stone-900 disabled:opacity-20 cursor-pointer text-xs"
                                      title="Shift block sequence up"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      onClick={() => moveBlockDown(blockId)}
                                      disabled={
                                        index === blocksOrder.length - 1
                                      }
                                      type="button"
                                      className="p-1 text-stone-400 hover:text-stone-900 disabled:opacity-20 cursor-pointer text-xs"
                                      title="Shift block sequence down"
                                    >
                                      ▼
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Block edit details (Progressive local edits on Canvas) */}
                              {!isNodeCollapsed && (
                                <div className="p-4 space-y-3 bg-white">
                                  <p className="text-[10px] text-stone-400 select-none pb-1">
                                    {description}
                                  </p>

                                  {isNodeDisabled ? (
                                    <p className="text-stone-400 text-xs text-center py-2 italic bg-neutral-50 rounded-xl">
                                      This node is muted. Click "Activate" in
                                      controls to integrate into the catalog
                                      spec payload.
                                    </p>
                                  ) : (
                                    <>
                                      {blockId === "header" && (
                                        <div className="grid grid-cols-2 gap-3">
                                          <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-stone-400 uppercase">
                                              Interactive Schema Tag
                                            </label>
                                            <input
                                              type="text"
                                              value={builderName}
                                              onChange={(e) =>
                                                setBuilderName(e.target.value)
                                              }
                                              className="w-full text-xs font-semibold p-1.5 border border-stone-200 rounded text-neutral-900"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-stone-400 uppercase">
                                              Billing Period
                                            </label>
                                            <select
                                              value={builderBillingPeriod}
                                              onChange={(e) =>
                                                setBuilderBillingPeriod(
                                                  e.target.value as any,
                                                )
                                              }
                                              className="w-full text-xs p-1.5 border border-stone-200 rounded text-neutral-900 bg-transparent"
                                            >
                                              <option value="monthly">
                                                Monthly Recurring
                                              </option>
                                              <option value="yearly">
                                                Yearly Contract
                                              </option>
                                              <option value="unlimited">
                                                Lifetime Flat
                                              </option>
                                            </select>
                                          </div>
                                        </div>
                                      )}

                                      {blockId === "base_fee" && (
                                        <div className="space-y-1.5">
                                          <label className="text-[9px] font-bold text-stone-400 uppercase">
                                            Inline Card recurrent Value
                                          </label>
                                          <div className="relative flex items-center pr-3">
                                            <span className="absolute left-2.5 text-xs text-stone-500 font-mono font-bold">
                                              ₦
                                            </span>
                                            <input
                                              type="number"
                                              value={builderBaseFee}
                                              onChange={(e) =>
                                                setBuilderBaseFee(
                                                  Math.max(
                                                    0,
                                                    Number(e.target.value),
                                                  ),
                                                )
                                              }
                                              className="w-full text-xs font-bold p-1.5 pl-6 border border-stone-200 rounded text-neutral-900 font-mono"
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {blockId === "seat_licensing" && (
                                        <div className="grid grid-cols-2 gap-3">
                                          <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-stone-400 uppercase">
                                              Core Limit Allowance
                                            </label>
                                            <input
                                              type="number"
                                              value={builderIncludedSeats}
                                              onChange={(e) =>
                                                setBuilderIncludedSeats(
                                                  Math.max(
                                                    0,
                                                    Number(e.target.value),
                                                  ),
                                                )
                                              }
                                              className="w-full text-xs p-1.5 border border-stone-200 rounded text-neutral-900 font-mono"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-stone-400 uppercase">
                                              Per-member Seat Rate
                                            </label>
                                            <div className="relative flex items-center">
                                              <span className="absolute left-2 text-xs text-stone-400 font-mono">
                                                ₦
                                              </span>
                                              <input
                                                type="number"
                                                value={builderSeatPrice}
                                                onChange={(e) =>
                                                  setBuilderSeatPrice(
                                                    Math.max(
                                                      0,
                                                      Number(e.target.value),
                                                    ),
                                                  )
                                                }
                                                className="w-full text-xs p-1.5 pl-5 border border-stone-200 rounded text-neutral-900 font-mono"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {blockId === "usage_metering" && (
                                        <div className="space-y-3">
                                          {builderType === "tiered" ||
                                          builderType === "volume" ? (
                                            <div className="space-y-1.5">
                                              <div className="flex justify-between items-center text-[9px] font-bold text-stone-400 uppercase">
                                                <span>
                                                  Cascade brackets details
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={handleAddTier}
                                                  className="text-[#0071E3] hover:underline"
                                                >
                                                  + Add Bracket
                                                </button>
                                              </div>
                                              <div className="space-y-1">
                                                {builderTiers.map((tier, i) => (
                                                  <div
                                                    key={i}
                                                    className="flex gap-1.5 items-center"
                                                  >
                                                    <span className="text-[10px] font-semibold text-stone-500 w-16">
                                                      Up to {tier.upTo}
                                                    </span>
                                                    <input
                                                      type="number"
                                                      value={tier.unitPrice}
                                                      onChange={(e) =>
                                                        handleTierChange(
                                                          i,
                                                          "unitPrice",
                                                          Number(
                                                            e.target.value,
                                                          ),
                                                        )
                                                      }
                                                      className="w-18 text-xs p-1 border rounded text-neutral-900 font-mono text-right"
                                                    />
                                                    <span className="text-[10px] text-stone-400 font-mono">
                                                      per unit
                                                    </span>
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        handleRemoveTier(i)
                                                      }
                                                      className="text-[10px] text-red-500 font-semibold"
                                                    >
                                                      Remove
                                                    </button>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ) : builderType === "package" ? (
                                            <div className="grid grid-cols-2 gap-3">
                                              <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-stone-400 uppercase">
                                                  Package Volume Size
                                                </label>
                                                <input
                                                  type="number"
                                                  value={builderPackageSize}
                                                  onChange={(e) =>
                                                    setBuilderPackageSize(
                                                      Math.max(
                                                        1,
                                                        Number(e.target.value),
                                                      ),
                                                    )
                                                  }
                                                  className="w-full text-xs p-1.5 border border-stone-200 rounded text-neutral-900 font-mono"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-stone-400 uppercase">
                                                  Price per package block
                                                </label>
                                                <input
                                                  type="number"
                                                  value={builderPackagePrice}
                                                  onChange={(e) =>
                                                    setBuilderPackagePrice(
                                                      Math.max(
                                                        0,
                                                        Number(e.target.value),
                                                      ),
                                                    )
                                                  }
                                                  className="w-full text-xs p-1.5 border border-stone-200 rounded text-neutral-900 font-mono"
                                                />
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="grid grid-cols-2 gap-3">
                                              <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-stone-400 uppercase">
                                                  Overage pricing unit
                                                </label>
                                                <input
                                                  type="number"
                                                  step="0.1"
                                                  value={
                                                    builderOverageUnitPrice
                                                  }
                                                  onChange={(e) =>
                                                    setBuilderOverageUnitPrice(
                                                      Math.max(
                                                        0,
                                                        Number(e.target.value),
                                                      ),
                                                    )
                                                  }
                                                  className="w-full text-xs p-1.5 border border-stone-200 rounded text-neutral-900 font-mono"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-stone-400 uppercase">
                                                  Included Usage Volume
                                                </label>
                                                <input
                                                  type="number"
                                                  value={builderIncludedUsage}
                                                  onChange={(e) =>
                                                    setBuilderIncludedUsage(
                                                      Math.max(
                                                        0,
                                                        Number(e.target.value),
                                                      ),
                                                    )
                                                  }
                                                  className="w-full text-xs p-1.5 border border-stone-200 rounded text-neutral-900 font-mono"
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {blockId === "prepaid_credits" && (
                                        <div className="space-y-1.5">
                                          <label className="text-[9px] font-bold text-stone-400 uppercase">
                                            Credit balance bundle reward
                                          </label>
                                          <div className="relative flex items-center pr-3">
                                            <span className="absolute left-2.5 text-xs text-stone-500 font-mono font-bold">
                                              ₦
                                            </span>
                                            <input
                                              type="number"
                                              value={builderPrepaidCredits}
                                              onChange={(e) =>
                                                setBuilderPrepaidCredits(
                                                  Math.max(
                                                    0,
                                                    Number(e.target.value),
                                                  ),
                                                )
                                              }
                                              className="w-full text-xs font-bold p-1.5 pl-6 border border-stone-200 rounded text-neutral-900 font-mono"
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {blockId === "advanced_spend_limits" && (
                                        <div className="grid grid-cols-2 gap-3">
                                          <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-stone-400 uppercase">
                                              Committed floor
                                            </label>
                                            <input
                                              type="number"
                                              value={builderMinSpend}
                                              onChange={(e) =>
                                                setBuilderMinSpend(
                                                  Math.max(
                                                    0,
                                                    Number(e.target.value),
                                                  ),
                                                )
                                              }
                                              className="w-full text-xs p-1.5 border border-stone-200 rounded text-neutral-900 font-mono"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-stone-400 uppercase">
                                              Hard Limit Ceiling
                                            </label>
                                            <input
                                              type="number"
                                              value={builderMaxSpend}
                                              onChange={(e) =>
                                                setBuilderMaxSpend(
                                                  Math.max(
                                                    0,
                                                    Number(e.target.value),
                                                  ),
                                                )
                                              }
                                              className="w-full text-xs p-1.5 border border-stone-200 rounded text-neutral-900 font-mono"
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {blockId === "discounts_promotions" && (
                                        <div className="grid grid-cols-2 gap-3">
                                          <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-stone-400 uppercase">
                                              Annual Discount Cycle %
                                            </label>
                                            <input
                                              type="number"
                                              value={builderAnnualDiscount}
                                              onChange={(e) =>
                                                setBuilderAnnualDiscount(
                                                  Math.min(
                                                    100,
                                                    Math.max(
                                                      0,
                                                      Number(e.target.value),
                                                    ),
                                                  ),
                                                )
                                              }
                                              className="w-full text-xs p-1.5 border border-stone-200 rounded text-neutral-900 font-mono"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-stone-400 uppercase">
                                              Regional Premium discount %
                                            </label>
                                            <input
                                              type="number"
                                              value={
                                                builderRegionalPricingPercentage
                                              }
                                              onChange={(e) =>
                                                setBuilderRegionalPricingPercentage(
                                                  Number(e.target.value),
                                                )
                                              }
                                              className="w-full text-xs p-1.5 border border-stone-200 rounded text-neutral-900 font-mono"
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {blockId === "addons" && (
                                        <div className="space-y-1.5">
                                          <label className="text-[9px] font-bold text-stone-400 uppercase">
                                            Continuous Addon module value
                                          </label>
                                          <div className="relative flex items-center pr-3">
                                            <span className="absolute left-2.5 text-xs text-stone-500 font-mono font-bold">
                                              ₦
                                            </span>
                                            <input
                                              type="number"
                                              value={builderAddonPrice}
                                              onChange={(e) =>
                                                setBuilderAddonPrice(
                                                  Math.max(
                                                    0,
                                                    Number(e.target.value),
                                                  ),
                                                )
                                              }
                                              className="w-full text-xs font-bold p-1.5 pl-6 border border-stone-200 rounded text-neutral-900 font-mono"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={handleDeployPrice}
                        className="w-full py-3.5 bg-[#111111] hover:bg-neutral-800 text-white rounded-2xl text-xs font-bold shadow-md transition-all cursor-pointer mt-4"
                        id="canvas-spec-compile-deploy-btn"
                      >
                        Deploy Compiled Layout Canvas to Catalog Ledger
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Column Strategy: Interactive Previews (Bill Preview + Customer Preview + Validation Indicators) */}
                <div className="lg:col-span-5 space-y-6 text-left">
                  {/* PREVIEW CONTAINER A: BILL PREVIEW & DYNAMIC CALCULATOR */}
                  <div className="bg-neutral-900 text-neutral-100 p-6 rounded-3xl shadow-xl flex flex-col justify-between border border-neutral-850">
                    <div>
                      <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                        <span className="text-[9px] bg-red-500 text-white px-2 py-0.5 rounded font-bold uppercase tracking-widest leading-relaxed">
                          Bill Preview Engine
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          Live Inputs Calculator
                        </span>
                      </div>

                      {/* Simulation parameters sliders adjusters */}
                      <div className="mt-4 space-y-4">
                        <p className="text-[11px] text-neutral-300 leading-normal">
                          Simulate user metrics variables to confirm
                          calculations against hybrid brackets in real-time.
                        </p>

                        {/* Seat Licensing slider */}
                        {(builderType === "seat" ||
                          builderType === "hybrid" ||
                          !disabledBlocks["seat_licensing"]) && (
                          <div>
                            <div className="flex justify-between text-[11px] mb-1 font-semibold">
                              <span className="text-neutral-400">
                                Team seats occupied
                              </span>
                              <span className="text-white font-mono">
                                {testActiveSeats} active seats
                              </span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="100"
                              value={testActiveSeats}
                              onChange={(e) =>
                                setTestActiveSeats(Number(e.target.value))
                              }
                              className="w-full h-1 bg-neutral-800 rounded-lg accent-white cursor-pointer"
                            />
                          </div>
                        )}

                        {/* Metric overage consumed slider */}
                        {builderType !== "flat" && builderType !== "seat" && (
                          <div>
                            <div className="flex justify-between text-[11px] mb-1 font-semibold">
                              <span className="text-neutral-400">
                                Simulated monthly consumed units
                              </span>
                              <span className="text-white font-mono">
                                {testMonthlyUsage.toLocaleString()} API calls
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="300000"
                              step="1000"
                              value={testMonthlyUsage}
                              onChange={(e) =>
                                setTestMonthlyUsage(Number(e.target.value))
                              }
                              className="w-full h-1 bg-neutral-800 rounded-lg accent-white cursor-pointer"
                            />
                          </div>
                        )}
                      </div>

                      {/* Sequential formula breakdown lines sheet */}
                      <div className="mt-6 pt-4 border-t border-neutral-800 space-y-2.5 text-[11px]">
                        <div className="flex justify-between text-neutral-400">
                          <span>Base recurring fee:</span>
                          <span className="text-white font-semibold">
                            ₦{bill.flatBase.toLocaleString()}
                          </span>
                        </div>

                        {bill.annualDiscount > 0 && (
                          <div className="flex justify-between text-emerald-400 bg-emerald-900/10 p-1.5 rounded">
                            <span>
                              🏷️ Cycle Annual Discount Applied (
                              {builderAnnualDiscount}%):
                            </span>
                            <span>
                              -₦{bill.annualDiscount.toLocaleString()}
                            </span>
                          </div>
                        )}

                        {bill.seatsCharge > 0 && (
                          <div className="flex justify-between text-neutral-400">
                            <span>
                              Seat overage ({bill.seatsOverage} extra @ ₦
                              {builderSeatPrice}/seat):
                            </span>
                            <span className="text-white font-semibold">
                              ₦{bill.seatsCharge.toLocaleString()}
                            </span>
                          </div>
                        )}

                        {bill.usageCharge > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-neutral-400">
                              <span>Usage consumed charges:</span>
                              <span className="text-white font-semibold">
                                ₦{bill.usageCharge.toLocaleString()}
                              </span>
                            </div>
                            <div className="bg-neutral-950 p-2 rounded text-[10px] text-stone-400 space-y-1 border border-neutral-850">
                              {bill.usageDetailLines.map((line, lIdx) => (
                                <p key={lIdx} className="font-mono">
                                  {line}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {bill.addonCost > 0 && (
                          <div className="flex justify-between text-neutral-400">
                            <span>Continuous Addons cost:</span>
                            <span className="text-white font-semibold">
                              +₦{bill.addonCost.toLocaleString()}
                            </span>
                          </div>
                        )}

                        {bill.minSpendAdjustment > 0 && (
                          <div className="flex justify-between text-indigo-300 bg-indigo-950/40 p-2 rounded border border-indigo-900/20">
                            <span>⚙ Committed Spend Floor offset topup:</span>
                            <span>
                              +₦{bill.minSpendAdjustment.toLocaleString()}
                            </span>
                          </div>
                        )}

                        {bill.cappedAdjustment > 0 && (
                          <div className="flex justify-between text-pink-400 bg-pink-950/40 p-2 rounded border border-pink-900/20">
                            <span>
                              🔒 Wallet limits protection Capped reduction:
                            </span>
                            <span>
                              -₦{bill.cappedAdjustment.toLocaleString()}
                            </span>
                          </div>
                        )}

                        {bill.prepaidOffset > 0 && (
                          <div className="flex justify-between text-cyan-400 bg-cyan-950/40 p-2 rounded border border-cyan-900/20">
                            <span>🔋 Balance prepaid credits deducted:</span>
                            <span>-₦{bill.prepaidOffset.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Grand total client invoice display */}
                    <div className="border-t border-neutral-800 pt-5 mt-5 flex justify-between items-baseline font-mono">
                      <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                        Estimated Client invoice:
                      </span>
                      <span className="text-3xl font-extrabold text-blue-400 font-mono tracking-tight animate-pulse">
                        ₦{bill.total.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* PREVIEW CONTAINER B: CONSUMER PRICING CARD PREVIEW */}
                  <div className="bg-white border border-[#E5E5E7] p-6 rounded-3xl shadow-sm text-left space-y-5">
                    <div className="flex justify-between items-center border-b pb-3">
                      <h5 className="text-xs font-bold text-neutral-900 uppercase tracking-tight flex items-center gap-2">
                        <Eye className="h-4 w-4 text-[#0071E3]" />
                        Customer Card View
                      </h5>
                      <span className="text-[10px] text-stone-500 font-bold bg-[#FAFAFA] px-2 py-0.5 rounded border">
                        Preview
                      </span>
                    </div>

                    {/* Pricing Card Simulation */}
                    <div className="rounded-2xl border border-neutral-200 p-5 bg-gradient-to-b from-neutral-50/50 to-white hover:shadow-md transition-shadow relative overflow-hidden">
                      {/* Corner badge overlay */}
                      {builderBillingPeriod === "yearly" && (
                        <div className="absolute top-0 right-0 p-2 bg-emerald-500 text-white text-[8px] font-bold uppercase tracking-wider">
                          Save {builderAnnualDiscount}%
                        </div>
                      )}

                      <div className="space-y-1 text-left">
                        <span className="text-[9px] bg-neutral-100 text-[#111111] px-2 py-0.5 rounded-full font-bold uppercase font-mono tracking-wide">
                          {builderPlanId.toUpperCase()} SPEC
                        </span>
                        <h4 className="text-lg font-extrabold text-[#111111] leading-tight pt-1">
                          {builderName}
                        </h4>
                        <p className="text-[11px] text-[#6E6E73] leading-snug">
                          {builderDesc ||
                            "Professional monetization rule for scale workspaces."}
                        </p>
                      </div>

                      <div className="my-5 flex items-baseline gap-1 bg-[#FAFAFA] -mx-5 p-4 border-y border-neutral-100 text-left">
                        <span className="text-2xl font-black text-neutral-900 font-mono">
                          {builderCurrency === "NGN"
                            ? "₦"
                            : builderCurrency === "USD"
                              ? "$"
                              : "€"}
                          {builderBaseFee.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#6E6E73] font-bold uppercase tracking-wider">
                          / {builderBillingPeriod}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs font-medium text-neutral-700 text-left">
                        {/* included seats check */}
                        {builderType === "seat" ||
                        builderType === "hybrid" ||
                        !disabledBlocks["seat_licensing"] ? (
                          <div className="flex items-center gap-2 text-neutral-600">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>
                              Included baseline of{" "}
                              <strong>{builderIncludedSeats} Seats</strong>
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-neutral-600">
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                            <span>Standard team member limits apply</span>
                          </div>
                        )}

                        {/* meter allowances checks */}
                        {builderType === "hybrid" && (
                          <div className="flex items-center gap-2 text-neutral-600">
                            <div className="h-1.5 w-1.5 rounded-full bg-[#0071E3]" />
                            <span>
                              Includes{" "}
                              <strong>
                                {builderIncludedUsage.toLocaleString()} free
                                compute units
                              </strong>
                            </span>
                          </div>
                        )}

                        {/* overage rates check */}
                        {builderType !== "flat" && builderType !== "seat" && (
                          <div className="flex items-center gap-2 text-neutral-600">
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span>
                              Overage rate:{" "}
                              <strong>
                                ₦{builderOverageUnitPrice}/api call
                              </strong>
                            </span>
                          </div>
                        )}

                        {/* spending ceiling check */}
                        {!disabledBlocks["advanced_spend_limits"] && (
                          <div className="flex items-center gap-2 text-neutral-600">
                            <div className="h-1.5 w-1.5 rounded-full bg-pink-500" />
                            <span>
                              Minimum monthly commitment floor:{" "}
                              <strong>
                                ₦{builderMinSpend.toLocaleString()}
                              </strong>
                            </span>
                          </div>
                        )}

                        {/* credit offset check */}
                        {!disabledBlocks["prepaid_credits"] &&
                          builderPrepaidCredits > 0 && (
                            <div className="flex items-center gap-1.5 bg-cyan-50 text-cyan-800 p-2 rounded-xl border border-cyan-100 font-mono text-[10px] font-bold">
                              🔋 Loaded signup credits balance ₦
                              {builderPrepaidCredits.toLocaleString()}{" "}
                              automatically included
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* PREVIEW CONTAINER C: VALIDATIONS DIAGNOSTICS ENGINE REPORT */}
                  <div className="bg-white border border-[#E5E5E7] p-6 rounded-3xl shadow-sm text-left space-y-4">
                    <h5 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider flex items-center gap-2 border-b pb-3">
                      <ShieldAlert className="h-4.5 w-4.5 text-[#0071E3]" />
                      Real-time Validations diagnostics
                    </h5>

                    <div className="space-y-3">
                      {validations.map((issue) => (
                        <div
                          key={issue.id}
                          className={`p-3.5 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed ${
                            issue.type === "error"
                              ? "bg-red-50 border-red-200 text-red-900"
                              : "bg-amber-50 border-amber-200 text-amber-900"
                          }`}
                        >
                          <ShieldAlert
                            className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${issue.type === "error" ? "text-red-600" : "text-amber-600"}`}
                          />
                          <div className="space-y-1">
                            <p className="font-extrabold text-stone-900">
                              {issue.type === "error"
                                ? "Blocker: "
                                : "Warning: "}{" "}
                              {issue.message}
                            </p>
                            <p className="text-[11px] text-stone-600">
                              {issue.fix}
                            </p>
                          </div>
                        </div>
                      ))}

                      {validations.length === 0 && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2.5 text-xs font-semibold">
                          <Check className="h-4.5 w-4.5 bg-emerald-500 text-white rounded-full p-0.5 shadow shrink-0" />
                          <div>
                            <p className="font-bold text-stone-900">
                              Pricing Spec Pristine
                            </p>
                            <p className="text-[10px] text-stone-600 font-medium leading-none mt-1">
                              Zero structural circular constraints detected.
                              Safe to commit.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* TAB-VIEW 3: RATE CARDS */}
      {activeSubTab === "rate-cards" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 bg-white border border-[#E5E5E7] rounded-3xl p-6 space-y-5 shadow-sm">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b pb-3 flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#0071E3]" />
              New Event Rate Card
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                  Name
                </label>
                <input
                  type="text"
                  value={rcName}
                  onChange={(e) => setRcName(e.target.value)}
                  className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900 focus:border-neutral-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                  Event Meter Link
                </label>
                <select
                  value={rcMeterId}
                  onChange={(e) => setRcMeterId(e.target.value)}
                  className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900 focus:border-neutral-900"
                >
                  {meters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                  <option value="compute_meter">compute_meter</option>
                  <option value="api_meter">api_meter</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                    Price Type
                  </label>
                  <select
                    value={rcPriceType}
                    onChange={(e) => setRcPriceType(e.target.value as any)}
                    className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900"
                  >
                    <option value="flat">Standard Flat</option>
                    <option value="tiered">Tiered Rate</option>
                    <option value="volume">Volume Rate</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                    Currency
                  </label>
                  <select
                    value={rcCurrency}
                    onChange={(e) => setRcCurrency(e.target.value)}
                    className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900"
                  >
                    <option value="NGN">NGN (₦)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              {rcPriceType === "flat" ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                    Unit Value Cost
                  </label>
                  <input
                    type="number"
                    value={rcUnitPrice}
                    onChange={(e) => setRcUnitPrice(Number(e.target.value))}
                    className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900"
                  />
                </div>
              ) : (
                <div className="p-3 bg-neutral-50 rounded-lg text-[11px] text-neutral-500">
                  ⚡ Tiered card rates inherit the escalating tier bracket
                  definitions configured in the Sandbox spec list above
                  automatically.
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={rcDesc}
                  onChange={(e) => setRcDesc(e.target.value)}
                  className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900 h-16 resize-none"
                />
              </div>

              <button
                onClick={handleCreateRateCard}
                className="w-full py-2 bg-[#111111] hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Assemble Rate Card
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 bg-white border border-[#E5E5E7] rounded-3xl p-6 shadow-sm overflow-x-auto">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-4">
              Workspace Rate Cards
            </h3>

            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5E5E7] text-neutral-400 font-semibold">
                  <th className="pb-3 pr-2">Rate Card Spec</th>
                  <th className="pb-3 pr-2">Linked Event Meter</th>
                  <th className="pb-3 pr-2">Strategy Model</th>
                  <th className="pb-3 pr-2">Default Currency</th>
                  <th className="pb-3 pr-2">Standalone rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium">
                {rateCards.map((rc) => (
                  <tr key={rc.id} className="text-neutral-900">
                    <td className="py-3.5 pr-2">
                      <p className="font-bold">{rc.name}</p>
                      <p className="text-[10px] text-neutral-400">
                        {rc.description}
                      </p>
                    </td>
                    <td className="py-3.5 pr-2 font-mono text-[11px] text-[#0071E3]">
                      {rc.meterId}
                    </td>
                    <td className="py-3.5 pr-2 capitalize">
                      {rc.priceType} model
                    </td>
                    <td className="py-3.5 pr-2 font-bold">{rc.currency}</td>
                    <td className="py-3.5 pr-2 font-bold font-mono">
                      {rc.priceType === "flat"
                        ? `${rc.currency === "NGN" ? "₦" : "$"}${rc.unitPrice}`
                        : "Dynamic Tiers"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB-VIEW 4: DISCOUNTS & COUPONS */}
      {activeSubTab === "discounts-coupons" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* DISCOUNT CONFIGURATION SYSTEM */}
          <div className="bg-white border border-[#E5E5E7] rounded-3xl p-6 space-y-6 shadow-sm">
            <div>
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b pb-3 flex items-center gap-2">
                <Percent className="h-4.5 w-4.5 text-[#0071E3]" />
                1. Workspace Discount Generator
              </h3>
              <p className="text-[10px] text-neutral-500 mt-1">
                Configure pricing discount rules for promotions or client
                acquisitions.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={discName}
                  onChange={(e) => setDiscName(e.target.value)}
                  className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                    Discount Class
                  </label>
                  <select
                    value={discType}
                    onChange={(e) => setDiscType(e.target.value as any)}
                    className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900"
                  >
                    <option value="percentage">Percentage Off (%)</option>
                    <option value="fixed">Fixed Off Money</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                    Off Value
                  </label>
                  <input
                    type="number"
                    value={discValue}
                    onChange={(e) => setDiscValue(Number(e.target.value))}
                    className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                    Applies Specifically To
                  </label>
                  <select
                    value={discAppliesTo}
                    onChange={(e) => setDiscAppliesTo(e.target.value as any)}
                    className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900"
                  >
                    <option value="all">Entire Invoice (Sum of all)</option>
                    <option value="base_fee">Base Plan Recur Fee only</option>
                    <option value="overage">Overage Meter lines only</option>
                    <option value="seat_fee">Seat Overage only</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                    Duration Scope
                  </label>
                  <select
                    value={discDuration}
                    onChange={(e) => setDiscDuration(e.target.value as any)}
                    className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900"
                  >
                    <option value="forever">Forever Permanent Code</option>
                    <option value="once">Single First Invoice only</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreateDiscount}
                className="w-full py-2 bg-[#111111] text-white hover:bg-neutral-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Log Workspace Discount
              </button>
            </div>
          </div>

          {/* ACTIVE PUBLIC COUPON CODES IN WORKSPACE */}
          <div className="bg-white border border-[#E5E5E7] rounded-3xl p-6 space-y-6 shadow-sm">
            <div>
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b pb-3 flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-[#FF9F0A]" />
                2. Coupon Code Distributor
              </h3>
              <p className="text-[10px] text-neutral-500 mt-1">
                Deploy coupon matching codes linking discounts for checkout
                application.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                    Description
                  </label>
                  <input
                    type="text"
                    value={cpName}
                    onChange={(e) => setCpName(e.target.value)}
                    className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900"
                    placeholder="e.g. Winter Sale Promo"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                    Redemption Promo Code
                  </label>
                  <input
                    type="text"
                    value={cpCode}
                    onChange={(e) => setCpCode(e.target.value.toUpperCase())}
                    className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900 font-mono font-bold uppercase"
                    placeholder="e.g. WINTER30"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                  Bind to Discount Rule
                </label>
                <select
                  value={cpDiscountId}
                  onChange={(e) => setCpDiscountId(e.target.value)}
                  className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900"
                >
                  {discounts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} (
                      {d.type === "percentage" ? `${d.value}%` : `₦${d.value}`}{" "}
                      off)
                    </option>
                  ))}
                  <option value="">-- Choose active discount schema --</option>
                </select>
              </div>

              <button
                onClick={handleCreateCoupon}
                className="w-full py-2 bg-[#111111] text-white hover:bg-neutral-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Publish Coupon Code
              </button>
            </div>

            {/* List current active coupons */}
            <div className="pt-4 border-t">
              <p className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider mb-2">
                Deployed Coupons
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {coupons.map((coupon) => {
                  const matchDisc = discounts.find(
                    (d) => d.id === coupon.discountId,
                  );
                  return (
                    <div
                      key={coupon.id}
                      className="flex justify-between items-center text-xs bg-neutral-50 p-2.5 rounded-xl border border-neutral-200"
                    >
                      <div>
                        <span className="font-mono font-bold bg-neutral-900 text-white px-2 py-0.5 rounded mr-2">
                          {coupon.code}
                        </span>
                        <span className="font-semibold text-neutral-800">
                          {coupon.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-500 font-medium">
                        {matchDisc
                          ? `${matchDisc.type === "percentage" ? `${matchDisc.value}%` : `₦${matchDisc.value}`} off`
                          : "Unlinked"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB-VIEW 5: ENTERPRISE CONTRACTS */}
      {activeSubTab === "contracts" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 bg-white border border-[#E5E5E7] rounded-3xl p-6 space-y-6 shadow-sm">
            <div>
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b pb-3 flex items-center gap-2">
                <Briefcase className="h-4.5 w-4.5 text-[#0071E3]" />
                Enterprise Agreement Generator
              </h3>
              <p className="text-[10px] text-neutral-500 mt-1">
                Bind specific accounts to custom contracted base fees, seats,
                and overage overrides.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                  Select Client Customer Account
                </label>
                <select
                  value={contractCustId}
                  onChange={(e) => setContractCustId(e.target.value)}
                  className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900"
                >
                  <option value="">-- Select Active Customer Profile --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.domain})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                  Agreement Label Title
                </label>
                <input
                  type="text"
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                    Custom Base Fee Override
                  </label>
                  <input
                    type="number"
                    value={contractBaseFee}
                    onChange={(e) => setContractBaseFee(Number(e.target.value))}
                    className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900 font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                    Hourly/Seat FeeOverride
                  </label>
                  <input
                    type="number"
                    value={contractSeatPrice}
                    onChange={(e) =>
                      setContractSeatPrice(Number(e.target.value))
                    }
                    className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900 font-mono text-neutral-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                    Custom Unit Usage Overage
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={contractOveragePrice}
                    onChange={(e) =>
                      setContractOveragePrice(Number(e.target.value))
                    }
                    className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                    Minimum Spend Commitment
                  </label>
                  <input
                    type="number"
                    value={contractMinSpend}
                    onChange={(e) =>
                      setContractMinSpend(Number(e.target.value))
                    }
                    className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900 font-mono font-bold"
                  />
                </div>
              </div>

              <button
                onClick={handleCreateContract}
                className="w-full py-2.5 bg-[#111111] hover:bg-neutral-800 text-white font-semibold rounded-lg text-xs cursor-pointer"
              >
                Sign Contract & Bind Account
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-[#E5E5E7] rounded-3xl p-6 shadow-sm overflow-x-auto">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-4">
              Signed Enterprise Leases
            </h3>

            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5E5E7] text-neutral-400 font-semibold">
                  <th className="pb-3 pr-2">Linked Customer</th>
                  <th className="pb-3 pr-2">Agreements Details</th>
                  <th className="pb-3 pr-1">Contract Base Fee</th>
                  <th className="pb-3 pr-1">Commitment Floor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium whitespace-nowrap">
                {contracts.map((cnt) => {
                  const custObj = customers.find(
                    (c) => c.id === cnt.customerId,
                  );
                  return (
                    <tr key={cnt.id} className="text-neutral-900">
                      <td className="py-3.5 pr-2">
                        <p className="font-bold">
                          {custObj ? custObj.name : cnt.customerId}
                        </p>
                        <p className="text-[10px] text-neutral-500">
                          {custObj?.domain}
                        </p>
                      </td>
                      <td className="py-3.5 pr-2">
                        <p className="font-semibold text-neutral-700">
                          {cnt.name}
                        </p>
                        <p className="text-[10px] text-neutral-400">
                          Seats: ₦{cnt.customSeatPrice}/ea • Overage: ₦
                          {cnt.customOverageUnitPrice}/unit
                        </p>
                      </td>
                      <td className="py-3.5 pr-1 font-mono font-bold text-[#111111]">
                        ₦{cnt.customBaseFee.toLocaleString()}
                      </td>
                      <td className="py-3.5 pr-1 font-mono text-emerald-600 font-bold">
                        ₦{cnt.minimumSpend?.toLocaleString() || "₦0"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB-VIEW 6: PRICING SANDBOX & CALCULATION ENGINE SIMULATORS */}
      {activeSubTab === "sandbox" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* SANDBOX CONTROLS PARAMETERS PANEL */}
          <div className="lg:col-span-5 bg-white border border-[#E5E5E7] rounded-3xl p-6 space-y-5 shadow-sm">
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b pb-3 flex items-center gap-2">
              <Sliders className="h-4.5 w-4.5 text-[#0071E3]" />
              Simulation Studio Environment
            </h4>

            <div className="space-y-4">
              {/* Optional: Load existing Customer context */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider block">
                  Preload Customer Profile
                </label>
                <select
                  value={sbCustomerId}
                  onChange={(e) => handleSandboxCustomerChange(e.target.value)}
                  className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900"
                >
                  <option value="">-- Simulate custom dummy profile --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Uses {c.seatsUsed} Seats,{" "}
                      {c.usageUnits.toLocaleString()} Units)
                    </option>
                  ))}
                </select>
              </div>

              {/* Assoc plan */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider block">
                  Plan Core Parameter
                </label>
                <select
                  value={sbPlanId}
                  onChange={(e) => {
                    setSbPlanId(e.target.value);
                    setSbPriceId(""); // Reset custom version override to use active version default
                  }}
                  className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900"
                >
                  {existingPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Version Override */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider block">
                  Specific Version Override
                </label>
                <select
                  value={sbPriceId}
                  onChange={(e) => setSbPriceId(e.target.value)}
                  className="w-full text-xs border border-[#E5E5E7] outline-none p-2 bg-transparent rounded-lg text-neutral-900 font-mono text-[11px]"
                >
                  <option value="">Active Default Version</option>
                  {prices
                    .filter((p) => p.planId === sbPlanId)
                    .map((price) => (
                      <option key={price.id} value={price.id}>
                        {price.name} (v{price.version} -{" "}
                        {price.isActive ? "Active" : "Legacy archived"})
                      </option>
                    ))}
                </select>
              </div>

              {/* Sliders */}
              <div className="space-y-4 pt-3 border-t">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-[#6E6E73] text-[10px] font-bold uppercase tracking-wider">
                      Simulated Seats
                    </span>
                    <span className="text-neutral-900">
                      {sbSeats} Team Members
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="150"
                    value={sbSeats}
                    onChange={(e) => setSbSeats(Number(e.target.value))}
                    className="w-full h-1 bg-neutral-200 rounded-lg cursor-pointer accent-[#111111]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-[#6E6E73] text-[10px] font-bold uppercase tracking-wider">
                      Simulated Inbound Metric
                    </span>
                    <span className="text-neutral-900 font-mono">
                      {sbLUsage.toLocaleString()} Units / Tokens
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1000000"
                    step="5000"
                    value={sbLUsage}
                    onChange={(e) => setSbLUsage(Number(e.target.value))}
                    className="w-full h-1 bg-neutral-200 rounded-lg cursor-pointer accent-[#111111]"
                  />
                </div>
              </div>

              {/* Custom Promo coupon checkout */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider block">
                    Checkout Coupon
                  </label>
                  <input
                    type="text"
                    value={sbCoupon}
                    onChange={(e) => setSbCoupon(e.target.value.toUpperCase())}
                    className="w-full text-xs border border-[#E5E5E7] outline-none p-1.5 bg-transparent rounded-lg font-mono font-bold uppercase"
                    placeholder="e.g. SUMMER20"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6 pl-2">
                  <input
                    type="checkbox"
                    id="checkbox-sandbox-credits"
                    checked={sbUseCredits}
                    onChange={(e) => setSbUseCredits(e.target.checked)}
                    className="h-4 w-4 bg-transparent border-neutral-300 rounded focus:ring-0 accent-neutral-900"
                  />
                  <label
                    htmlFor="checkbox-sandbox-credits"
                    className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide"
                  >
                    Offset Credits
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* CALCULATED OUTPUT: STATEMENT LEDGER SHEET */}
          <div className="lg:col-span-7 bg-neutral-900 text-neutral-100 border rounded-3xl p-6 shadow-2xl relative overflow-hidden font-mono text-xs">
            <div className="absolute top-0 right-0 p-3 bg-neutral-800 text-yellow-400 font-bold text-[8px] tracking-widest uppercase">
              Sandbox Console Ledger
            </div>

            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-800 pb-3 flex items-center gap-1.5">
              <Calculator className="h-4 w-4 text-neutral-400 animate-pulse" />
              Calculations Breakdown
            </h4>

            {simulationResult ? (
              <div className="space-y-4 pt-4">
                <div className="space-y-1 text-[11px] text-neutral-400">
                  <p>
                    Resolved Price Spec:{" "}
                    <strong className="text-white font-sans">
                      {simulationResult.price_name} ({simulationResult.price_id}
                      )
                    </strong>
                  </p>
                  <p className="capitalize">
                    Core Schema Class:{" "}
                    <strong className="text-emerald-400 font-mono">
                      {simulationResult.pricing_type} Model
                    </strong>
                  </p>
                  <p>
                    Billing Period:{" "}
                    <strong className="text-white font-mono">
                      {simulationResult.billing_period} Cycle
                    </strong>
                  </p>
                </div>

                <div className="border-t border-neutral-800 pt-4 space-y-2.5">
                  <div className="flex justify-between items-center text-neutral-300">
                    <span>Base Subscription fee:</span>
                    <span className="text-white font-bold">
                      ₦{simulationResult.base_fee?.toLocaleString()}
                    </span>
                  </div>

                  {simulationResult.seat_charge > 0 && (
                    <div className="flex justify-between items-center text-neutral-300">
                      <span>
                        Seat overage (
                        {simulationResult.seats_consumed -
                          simulationResult.included_seats}{" "}
                        extra @ ₦{simulationResult.seat_fee_per_unit}/seat):
                      </span>
                      <span className="text-white font-bold">
                        ₦{simulationResult.seat_charge?.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {simulationResult.pricing_type === "hybrid" &&
                    simulationResult.overage_charge > 0 && (
                      <div className="flex justify-between items-center text-neutral-300">
                        <span>
                          Usage overage (
                          {simulationResult.overage_units?.toLocaleString()}{" "}
                          extra @ ₦{simulationResult.seat_fee_per_unit}/unit):
                        </span>
                        <span className="text-white font-bold">
                          ₦{simulationResult.overage_charge?.toLocaleString()}
                        </span>
                      </div>
                    )}

                  {/* Tier lists visual list */}
                  {simulationResult.tier_breakdown &&
                    simulationResult.tier_breakdown.length > 0 && (
                      <div className="p-3 bg-neutral-950 rounded-xl space-y-1.5 border border-neutral-850">
                        <p className="text-[10px] text-neutral-500 uppercase tracking-wide font-bold">
                          Tier Rate Block Executions:
                        </p>
                        {simulationResult.tier_breakdown.map(
                          (block: any, i: number) => (
                            <div
                              key={i}
                              className="flex justify-between text-[11px] text-neutral-400"
                            >
                              <span>
                                • Range [{block.tierRange}]:{" "}
                                {block.units?.toLocaleString()} units @ ₦
                                {block.rate}
                              </span>
                              <span>₦{block.charge?.toLocaleString()}</span>
                            </div>
                          ),
                        )}
                      </div>
                    )}

                  {simulationResult.discount_applied > 0 && (
                    <div className="flex justify-between items-center text-yellow-400 bg-neutral-950 p-2 rounded">
                      <span>
                        🏷️ Promo discount applied (
                        {simulationResult.discount_name || "Promotion Code"}):
                      </span>
                      <span className="font-bold">
                        -₦{simulationResult.discount_applied?.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {simulationResult.minimum_spend_adjustment > 0 && (
                    <div className="flex justify-between items-center text-indigo-400 bg-neutral-950 p-2 rounded">
                      <span>⛓️ Contract Floor commitment top-up:</span>
                      <span className="font-bold">
                        +₦
                        {simulationResult.minimum_spend_adjustment?.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {simulationResult.credit_applied > 0 && (
                    <div className="flex justify-between items-center text-cyan-400 bg-neutral-950 p-2 rounded font-mono">
                      <span>🔋 Ledger offset credit balance:</span>
                      <span className="font-bold">
                        -₦{simulationResult.credit_applied?.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t-2 border-neutral-700 pt-4 mt-2 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-white uppercase tracking-wider">
                    Estimated Client Invoice:
                  </span>
                  <span className="text-2xl font-extrabold text-[#0071E3] font-mono animate-pulse">
                    ₦{simulationResult.total?.toLocaleString()}
                  </span>
                </div>

                {simulationResult.has_contract_override && (
                  <div className="text-[10px] bg-red-900/20 border border-red-900/60 text-red-400 p-2 rounded-lg text-center leading-relaxed">
                    ⚖️ Enterprise SLA override is globally active. Standard plan
                    parameters are suppressed to parse custom contracts.
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-neutral-500">
                <p>Establishing ledger sandbox connection...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
