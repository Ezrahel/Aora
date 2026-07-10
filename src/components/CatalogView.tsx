import { useState } from "react";
import {
  Layers,
  Sparkles,
  ShieldCheck,
  Zap,
  CheckCircle,
  HelpCircle,
  Check,
  Plus,
  Compass,
  ArrowRight,
  Package,
  Globe,
  Sliders
} from "lucide-react";
import { Plan, Customer } from "../types";

interface CatalogViewProps {
  existingPlans: Plan[];
  customers: Customer[];
  onPlanCreated: () => void;
}

export default function CatalogView({
  existingPlans,
  customers,
  onPlanCreated
}: CatalogViewProps) {
  // Wizard States
  const [step, setStep] = useState(1);
  const [productType, setProductType] = useState<string>("software");
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [productCategory, setProductCategory] = useState("Infrastructure");
  
  // Plans wizard draft
  const [planDrafts, setPlanDrafts] = useState([
    { name: "Starter", price: 0, includedUsage: 10000, seats: 2, apiAccess: false },
    { name: "Growth", price: 15000, includedUsage: 50000, seats: 10, apiAccess: true },
    { name: "Business", price: 49000, includedUsage: 250000, seats: 25, apiAccess: true }
  ]);

  // Progressive Disclosure controls
  const [showAdvancedPlanIdx, setShowAdvancedPlanIdx] = useState<number | null>(null);
  const [selectedProductView, setSelectedProductView] = useState("diagram"); // diagram | wizard
  
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);

  const productTypes = [
    { id: "software", label: "Software & SaaS", icon: Compass, desc: "Web applications, CRM portals, or collaboration platforms." },
    { id: "api", label: "Developer APIs", icon: Globe, desc: "Microservices, credit ingestion pipelines, and SDK gates." },
    { id: "ai", label: "AI & Token Inferences", icon: Sparkles, desc: "Gemini token usage, model prompts, and agentic compute." },
    { id: "leads", label: "Lead & Marketing Platforms", icon: Zap, desc: "Data enrichment, sales discovery, or email pipelines." },
    { id: "marketplace", label: "Marketplace Commissions", icon: Package, desc: "Brokerage commission layers and transaction fees." },
    { id: "hybrid", label: "Custom Suite (Hybrid)", icon: Sliders, desc: "Bespoke blend of flat pricing, credits and overage pools." },
  ];

  const handleUpdatePlanDraft = (idx: number, field: string, value: any) => {
    const updated = [...planDrafts];
    updated[idx] = { ...updated[idx], [field]: value };
    setPlanDrafts(updated);
  };

  const handleDeployProductCatalog = async () => {
    setIsDeploying(true);
    setDeploySuccess(false);

    try {
      // Create each draft as a live Plan
      for (const draft of planDrafts) {
        await fetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `${productName.toLowerCase().replace(/\s+/g, "-")}-${draft.name.toLowerCase()}`,
            name: `${productName} ${draft.name}`,
            price: Number(draft.price),
            currency: "NGN",
            billingPeriod: "monthly",
            includedSeats: Number(draft.seats),
            includedUsage: Number(draft.includedUsage),
            apiAccess: draft.apiAccess,
            overageUnitPrice: 1.5,
            description: `Auto-compiled plan for ${productName} under the ${draft.name} tier.`
          })
        });
      }

      setDeploySuccess(true);
      onPlanCreated(); // callback to update parents
      setTimeout(() => {
        setStep(1);
        setProductName("");
        setProductDesc("");
        setDeploySuccess(false);
        setSelectedProductView("diagram");
      }, 3500);

    } catch (e) {
      console.error(e);
      alert("Error compiling configuration wizard templates");
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b dp-border pb-6 gap-4 text-left">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight dp-text">Product Catalog</h2>
          <p className="text-xs dp-secondary mt-1.5 font-medium">
            Manage your commercial offerings. Establish plans, bundle customer feature access models, and map client boundaries inside unified business layers.
          </p>
        </div>
        <div className="flex dp-surface-alt rounded-lg p-0.5 border dp-border text-xs font-semibold self-start md:self-auto">
          <button
            onClick={() => setSelectedProductView("diagram")}
            className={`px-3.5 py-1.5 rounded-md cursor-pointer transition-all ${
              selectedProductView === "diagram" ? "dp-card dp-text shadow-sm font-bold" : "dp-secondary hover:text-black"
            }`}
          >
            Catalog Blueprint
          </button>
          <button
            onClick={() => setSelectedProductView("wizard")}
            className={`px-3.5 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1 ${
              selectedProductView === "wizard" ? "dp-card dp-text shadow-sm font-bold" : "dp-secondary hover:text-black"
            }`}
          >
            <Plus className="h-3 w-3" /> Guided Wizard
          </button>
        </div>
      </div>

      {selectedProductView === "diagram" ? (
        <div className="space-y-6 text-left">
          
          {/* Main Visual Hierarchy of Billing elements */}
          <div className="dp-card border dp-border rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-bold dp-secondary uppercase tracking-wider mb-5">
              Live Product Flow Archetype
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch relative">
              
              {/* Box 1: Product Definition */}
              <div className="lg:col-span-3 bg-neutral-50/50 border border-dashed dp-border p-4.5 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="h-8 w-8 rounded-lg bg-[#111111] text-white flex items-center justify-center font-bold text-xs mb-3">
                    P
                  </div>
                  <h4 className="text-xs font-bold dp-text uppercase tracking-wide">
                    1. Product Definition
                  </h4>
                  <p className="text-[10.5px] dp-secondary mt-1 pr-1 leading-normal">
                    You declare what you are commercializing — whether SaaS SaaS modules, API environments, or computational token nodes.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-200/60 text-[11px] font-semibold dp-text">
                  Commercializing: <span className="text-[#0071E3] font-bold">Aora Core Engine</span>
                </div>
              </div>

              {/* Connector */}
              <div className="hidden lg:flex lg:col-span-1 items-center justify-center dp-muted">
                <ArrowRight className="h-5 w-5" />
              </div>

              {/* Box 2: Subscription Plans */}
              <div className="lg:col-span-4 bg-neutral-50/50 border border-dashed dp-border p-4.5 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="h-8 w-8 rounded-lg bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center font-bold text-xs mb-3">
                    L
                  </div>
                  <h4 className="text-xs font-bold dp-text uppercase tracking-wide">
                    2. Plan Options & Pricing
                  </h4>
                  <p className="text-[10.5px] dp-secondary mt-1 leading-normal">
                    Establish commercial levels. Define base fees, inclusive quotas, and clear pay-per-use overage triggers clearly.
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-1 pt-3.5 text-center text-[10px] font-bold">
                  {existingPlans.slice(0, 3).map((p) => (
                    <div key={p.id} className="dp-card border dp-border p-1.5 rounded-lg">
                      <p className="truncate dp-text">{p.name}</p>
                      <p className="dp-secondary mt-0.5 text-[9px]">₦{p.price.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connector */}
              <div className="hidden lg:flex lg:col-span-1 items-center justify-center dp-muted">
                <ArrowRight className="h-5 w-5" />
              </div>

              {/* Box 3: Features & Permissions */}
              <div className="lg:col-span-3 bg-neutral-50/50 border border-dashed dp-border p-4.5 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 text-[#34C759] flex items-center justify-center font-bold text-xs mb-3">
                    F
                  </div>
                  <h4 className="text-xs font-bold dp-text uppercase tracking-wide">
                    3. Features & Access
                  </h4>
                  <p className="text-[10.5px] dp-secondary mt-1 leading-normal">
                    Map feature credentials to subscriber levels. Restrict API access, enable advanced dashboard reports, and auto-issue tokens.
                  </p>
                </div>
                <div className="space-y-1 mt-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-800">
                    <CheckCircle className="h-3 w-3 text-[#34C759]" /> API Gate Access
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-800">
                    <CheckCircle className="h-3 w-3 text-[#34C759]" /> Premium Reports
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* List of active catalog items */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold dp-secondary uppercase tracking-wider">
              Installed Catalog Tiers ({existingPlans.length})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {existingPlans.map((p) => {
                const subCount = customers.filter(c => c.planId === p.id).length;
                return (
                  <div key={p.id} className="dp-card border dp-border rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between hover:border-black transition-all">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold dp-text">{p.name}</span>
                        <span className="text-[9px] font-bold dp-surface-alt dp-secondary px-2 py-0.5 rounded-full">
                          {p.currency || "NGN"}
                        </span>
                      </div>
                      <p className="text-[11px] dp-secondary leading-relaxed line-clamp-2">
                        {p.description}
                      </p>
                    </div>

                    <div className="border-t border-[#F5F5F7] pt-3 flex items-center justify-between">
                      <div className="text-left">
                        <p className="text-[9px] dp-muted uppercase font-bold tracking-wider">Base Cost</p>
                        <p className="text-sm font-extrabold dp-text mt-0.5">
                          ₦{p.price.toLocaleString()}<span className="text-[10px] font-semibold dp-muted">/mo</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] dp-muted uppercase font-bold tracking-wider">Active Cohort</p>
                        <p className="text-xs font-semibold text-stone-700 mt-1">
                          {subCount} Subscribers
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      ) : (
        /* GUIDED CREATION WIZARD */
        <div className="dp-card border dp-border rounded-3xl p-6 max-w-4xl mx-auto shadow-md">
          
          {/* STEPPER PROGRESS */}
          <div className="flex items-center justify-between max-w-lg mx-auto mb-8 border-b border-[#F5F5F7] pb-4">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center gap-2">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === num
                    ? "bg-[#111111] text-white"
                    : step > num
                    ? "bg-[#34C759] text-white"
                    : "dp-surface-alt dp-secondary border"
                }`}>
                  {step > num ? <Check className="h-3 w-3" /> : num}
                </div>
                <span className={`text-xs font-semibold ${step === num ? "dp-text" : "dp-muted"}`}>
                  {num === 1 ? "Product Category" : num === 2 ? "Product Details" : "Compile Pricing tiers"}
                </span>
                {num < 3 && <span className="text-[#E5E5E7] mx-2">|</span>}
              </div>
            ))}
          </div>

          {/* STEP 1: What are you selling? */}
          {step === 1 && (
            <div className="space-y-6 text-center animate-in fade-in duration-200">
              <div className="space-y-1">
                <h3 className="text-lg font-bold dp-text tracking-tight">What are you commercializing?</h3>
                <p className="text-xs dp-secondary">Choose the category that best outlines your products behavior.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 max-w-3xl mx-auto text-left py-4">
                {productTypes.map((t) => {
                  const Icon = t.icon;
                  const isSelected = productType === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setProductType(t.id)}
                      className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all outline-none ${
                        isSelected
                          ? "dp-card border-[#111111] shadow-md ring-1 ring-black/10"
                          : "dp-surface dp-border hover:dp-card"
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                        isSelected ? "bg-[#111111] text-white" : "dp-surface-alt dp-muted"
                      }`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="mt-6">
                        <h4 className="text-xs font-bold dp-text">{t.label}</h4>
                        <p className="text-[10.5px] dp-secondary mt-1 leading-normal">
                          {t.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="rounded-lg bg-[#111111] hover:bg-[#1D1D1F] px-4 py-2 text-xs font-bold text-white cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Name Product */}
          {step === 2 && (
            <div className="space-y-6 max-w-xl mx-auto text-left animate-in border-neutral-100 duration-200">
              <div className="space-y-1 text-center">
                <h3 className="text-lg font-bold dp-text">Product Information</h3>
                <p className="text-xs dp-secondary">Name what your billing suite will bundle.</p>
              </div>

              <div className="space-y-4 pt-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold dp-secondary uppercase tracking-wider block">Product Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Aora Core Hub, Sync Node SDK, Chat Bot Engine"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full text-xs border dp-border rounded-lg p-2.5 dp-surface"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold dp-secondary uppercase tracking-wider block">Commercial Description</label>
                  <textarea
                    placeholder="e.g. Scalable developer APIs with standard overage calculations built dynamically."
                    value={productDesc}
                    onChange={(e) => setProductDesc(e.target.value)}
                    className="w-full text-xs border dp-border rounded-lg p-2.5 dp-surface h-20 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold dp-secondary uppercase tracking-wider block">Industry Category</label>
                  <select
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    className="w-full text-xs border dp-border rounded-lg p-2.5 dp-surface"
                  >
                    <option value="Infrastructure">Infrastructure & Cloud</option>
                    <option value="AI Engine">Artificial Intelligence</option>
                    <option value="SaaS Platform">B2B SaaS Business</option>
                    <option value="Marketing Tool">Lead Generation</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-lg dp-card border dp-border hover:dp-surface px-4 py-2 text-xs font-semibold text-stone-700"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!productName.trim()}
                  className="rounded-lg bg-[#111111] hover:bg-[#1D1D1F] px-4 py-2 text-xs font-bold text-white cursor-pointer shadow-sm disabled:opacity-50"
                >
                  Next: Setup Tiers
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Setup tiers (Starter, Growth, Business) */}
          {step === 3 && (
            <div className="space-y-6 text-left animate-in duration-200">
              <div className="space-y-1 text-center">
                <h3 className="text-lg font-bold dp-text">Draft Commercial Tiers</h3>
                <p className="text-xs dp-secondary">
                  We propose three standard presets. Refine quotas and prices below.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
                {planDrafts.map((d, idx) => (
                  <div key={idx} className="dp-surface border dp-border rounded-2xl p-4.5 space-y-4 hover:border-black transition-all">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-xs font-bold dp-text">{d.name} Plan</span>
                      <button
                        onClick={() => setShowAdvancedPlanIdx(showAdvancedPlanIdx === idx ? null : idx)}
                        className="text-[9px] font-bold text-stone-600 hover:text-black uppercase underline"
                      >
                        {showAdvancedPlanIdx === idx ? "Hide Rules" : "Advanced Rules"}
                      </button>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-500 uppercase">Monthly Base Price (₦)</label>
                        <input
                          type="number"
                          value={d.price}
                          onChange={(e) => handleUpdatePlanDraft(idx, "price", Number(e.target.value))}
                          className="w-full p-2 dp-card border dp-border rounded-lg font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-500 uppercase">Included Usage Units</label>
                        <input
                          type="number"
                          value={d.includedUsage}
                          onChange={(e) => handleUpdatePlanDraft(idx, "includedUsage", Number(e.target.value))}
                          className="w-full p-2 dp-card border dp-border rounded-lg font-bold"
                        />
                      </div>
                    </div>

                    {/* Advanced Rules: progressive disclosure */}
                    {showAdvancedPlanIdx === idx && (
                      <div className="pt-3 border-t border-dashed dp-border space-y-3.5 text-xs animate-in slide-in-from-top-1 duration-150">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-gray-500 uppercase block">Included Seats</label>
                          <input
                            type="number"
                            value={d.seats}
                            onChange={(e) => handleUpdatePlanDraft(idx, "seats", Number(e.target.value))}
                            className="w-full p-1.5 dp-card border dp-border rounded-md"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] font-semibold text-gray-500">Enable Technical APIs</span>
                          <input
                            type="checkbox"
                            checked={d.apiAccess}
                            onChange={(e) => handleUpdatePlanDraft(idx, "apiAccess", e.target.checked)}
                            className="h-3.5 w-3.5 rounded dp-border accent-[#111111]"
                          />
                        </div>
                      </div>
                    )}

                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-[#F5F5F7] flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="rounded-lg dp-card border dp-border hover:dp-surface px-4 py-2 text-xs font-semibold text-stone-700"
                >
                  Back
                </button>

                <button
                  onClick={handleDeployProductCatalog}
                  disabled={isDeploying || deploySuccess}
                  className="rounded-lg bg-[#111111] hover:bg-[#1D1D1F] px-5 py-2.5 text-xs font-bold text-white cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  {isDeploying ? "Deploying Engine..." : deploySuccess ? "Catalog Compiled!" : "Compile & Deploy Product Catalog"}
                </button>
              </div>

              {deploySuccess && (
                <div className="p-3 bg-neutral-50 text-neutral-800 border border-neutral-200 rounded-xl text-center text-xs font-semibold animate-pulse max-w-lg mx-auto">
                  🎉 Product successfully introduced to operational databases. Legers and rules are synched.
                </div>
              )}

            </div>
          )}

        </div>
      )}

    </div>
  );
}
