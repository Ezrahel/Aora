import { useState } from "react";
import {
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  Code2,
  LineChart,
  Layers,
  ChevronRight,
  Database,
  Terminal,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  Lightbulb,
  FileSpreadsheet,
  Cpu
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

interface LandingPageViewProps {
  onNavigateTab: (tab: string) => void;
}

export default function LandingPageView({ onNavigateTab }: LandingPageViewProps) {
  // Interactive Showcase pricing model selector
  const [selectedShowcaseModel, setSelectedShowcaseModel] = useState<
    "subscription" | "usage" | "hybrid" | "seat" | "credits" | "enterprise"
  >("hybrid");

  // Show interactive playground state
  const [playSeats, setPlaySeats] = useState(15);
  const [playUsage, setPlayUsage] = useState(35000);
  const [activePlaygroundTab, setActivePlaygroundTab] = useState<"workspace" | "metering" | "revenue">("workspace");

  // Telemetry interactive simulation logs
  const [simulationLogs, setSimulationLogs] = useState<string[]>([
    "System active & polling event bus...",
    "Node listening on standard port :3000"
  ]);

  const triggerTelemetrySimulator = (type: string) => {
    const timestamp = new Date().toLocaleTimeString();
    if (type === "usage") {
      setPlayUsage((p) => p + 1200);
      setSimulationLogs((prev) => [
        `[${timestamp}] EVENT: billing.track(cust_98, "compute_units", 1200) ingested.`,
        ...prev.slice(0, 4)
      ]);
    } else if (type === "seat") {
      setPlaySeats((prev) => prev + 1);
      setSimulationLogs((prev) => [
        `[${timestamp}] EVENT: billing.track(cust_98, "seat_added", 1) ingested. Entitlement re-validated.`,
        ...prev.slice(0, 4)
      ]);
    } else if (type === "reset") {
      setPlayUsage(5000);
      setPlaySeats(2);
      setSimulationLogs((prev) => [
        `[${timestamp}] CMD: Reset demo parameters.`,
        ...prev.slice(0, 4)
      ]);
    }
  };

  // Developer tab code selector
  const [activeDevCode, setActiveDevCode] = useState<"track" | "can" | "calculate">("track");

  // Mock revenue chart data for showcase
  const revenueChartData = [
    { month: "Jan", mrr: 1540000, usage: 102000 },
    { month: "Feb", mrr: 1820000, usage: 154000 },
    { month: "Mar", mrr: 2100000, usage: 198000 },
    { month: "Apr", mrr: 2450000, usage: 220000 },
    { month: "May", mrr: 2900000, usage: 310000 },
    { month: "Jun", mrr: 3600000, usage: 420000 }
  ];

  // Calculated simulation pricing outcomes matching user copy
  const getCalculatedPrice = () => {
    switch (selectedShowcaseModel) {
      case "subscription":
        return {
          formula: "Flat recurring platform commitment",
          base: 15000,
          overages: 0,
          total: 15000,
          currency: "₦"
        };
      case "usage":
        // ₦2 per unit
        return {
          formula: `${playUsage.toLocaleString()} Units @ ₦2/unit`,
          base: 0,
          overages: playUsage * 2,
          total: playUsage * 2,
          currency: "₦"
        };
      case "hybrid":
        // ₦15,000 flat + ₦2 per unit overage (assume 10k free includes)
        const freeUnits = 10000;
        const overable = Math.max(0, playUsage - freeUnits);
        return {
          formula: `₦15,000 base + (${playUsage.toLocaleString()} units - ${freeUnits.toLocaleString()} free) * ₦2`,
          base: 15000,
          overages: overable * 2,
          total: 15000 + overable * 2,
          currency: "₦"
        };
      case "seat":
        // ₦3000 per User
        return {
          formula: `${playSeats} Seats @ ₦3,000/seat`,
          base: 0,
          overages: playSeats * 3000,
          total: playSeats * 3000,
          currency: "₦"
        };
      case "credits":
        return {
          formula: "10,000 credits included base standard limit",
          base: 15000,
          overages: Math.max(0, playUsage - 10000) * 1.5,
          total: 15000 + Math.max(0, playUsage - 10000) * 1.5,
          currency: "₦"
        };
      case "enterprise":
        return {
          formula: "Bespoke SLA negotiated contract",
          base: 120000,
          overages: Math.max(0, playUsage - 100000) * 1.0,
          total: 120000 + Math.max(0, playUsage - 100000) * 1.0,
          currency: "₦"
        };
      default:
        return { formula: "", base: 0, overages: 0, total: 0, currency: "₦" };
    }
  };

  const calculated = getCalculatedPrice();

  // Helper smooth scroll to element ID
  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="bg-[#FAF9F6] text-[#111111] font-sans antialiased selection:bg-neutral-900 selection:text-white pb-16">
      {/* ----------------- SEAMLESS NAVIGATION BAR ----------------- */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-[#E5E5E7] py-4 px-8 z-40 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollToId("hero")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 shadow-sm">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="font-bold tracking-tight text-sm text-neutral-900 leading-none">
              Aora Billing
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-neutral-600">
            <button onClick={() => scrollToId("features")} className="hover:text-neutral-900 transition-colors cursor-pointer">
              Products
            </button>
            <button onClick={() => scrollToId("problems")} className="hover:text-neutral-900 transition-colors cursor-pointer">
              Solutions
            </button>
            <button onClick={() => scrollToId("developers")} className="hover:text-neutral-900 transition-colors cursor-pointer">
              Developers
            </button>
            <button onClick={() => scrollToId("showcase")} className="hover:text-neutral-900 transition-colors cursor-pointer">
              Pricing
            </button>
            <button onClick={() => onNavigateTab("docs")} className="hover:text-neutral-900 transition-colors cursor-pointer">
              Documentation
            </button>
            <a href="#blog" className="hover:text-neutral-900 transition-colors">
              Blog
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateTab("dashboard")}
            className="px-3.5 py-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-900 cursor-pointer"
          >
            Sign In
          </button>
          <button
            onClick={() => onNavigateTab("dashboard")}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1"
          >
            Start Free
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ----------------- HERO SECTION ----------------- */}
      <section id="hero" className="relative py-20 px-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-6 text-left">


          <h1 className="text-4xl sm:text-5xl lg:text-[54px] lg:leading-[1.1] font-extrabold tracking-tight text-neutral-900">
            Stop Building <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 via-neutral-700 to-[#0071E3]">
              Billing Logic
            </span>
          </h1>

          <p className="text-base sm:text-lg text-neutral-700 font-medium leading-relaxed max-w-xl">
            Build products. Let us handle pricing, subscriptions, usage metering, entitlements, credits, and revenue operations.
          </p>

          <p className="text-xs sm:text-sm text-neutral-500 font-medium max-w-lg">
            The billing infrastructure platform for modern SaaS, AI, API, and usage-based businesses.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3.5">
            <button
              onClick={() => onNavigateTab("dashboard")}
              className="px-6 py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-sm rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              Start Free
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => onNavigateTab("customers")}
              className="px-6 py-3.5 bg-white border border-[#E5E5E7] hover:bg-neutral-50 text-neutral-800 font-semibold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Book Demo
            </button>
          </div>

          <div className="pt-4 border-t border-dashed border-neutral-200">
            <p className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider">
              No payment gateway lock-in
            </p>
            <p className="text-xs text-neutral-600 mt-1 font-semibold">
              Works seamlessly with Paystack, Flutterwave, Stripe, Monnify, and your existing tech stack.
            </p>
          </div>
        </div>

        {/* ----------------- HERO PUBLIC WORKSPACE VISUAL ----------------- */}
        <div className="lg:col-span-6 bg-neutral-900 rounded-3xl p-6 shadow-2xl border border-neutral-800 relative group">


          {/* Simulated Workspace Controls */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500"></span>
              <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
              <span className="text-[10px] text-neutral-400 font-mono ml-2">Aora Ledger Admin Suite</span>
            </div>
            
            {/* Nav within Sandbox Simulator */}
            <div className="flex gap-1 bg-neutral-800 rounded-lg p-0.5" id="hero-playground-tabs">
              <button
                onClick={() => setActivePlaygroundTab("workspace")}
                className={`px-2.5 py-1 text-[9px] font-extrabold uppercase rounded ${
                  activePlaygroundTab === "workspace" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                Products & Plans
              </button>
              <button
                onClick={() => setActivePlaygroundTab("metering")}
                className={`px-2.5 py-1 text-[9px] font-extrabold uppercase rounded ${
                  activePlaygroundTab === "metering" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                Telemetry Meter
              </button>
              <button
                onClick={() => setActivePlaygroundTab("revenue")}
                className={`px-2.5 py-1 text-[9px] font-extrabold uppercase rounded ${
                  activePlaygroundTab === "revenue" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                Subscription Analytics
              </button>
            </div>
          </div>

          {/* Subtab 1: Products & Plans View */}
          {activePlaygroundTab === "workspace" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Interactive Catalog & Pricing Rules</h4>
                  <p className="text-[10px] text-neutral-500 font-medium">Select a pricing model below to simulate real-time API billing calculations:</p>
                </div>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase">Linked</span>
              </div>

              {/* Models Quick selector */}
              <div className="grid grid-cols-3 gap-1.5 bg-neutral-800 p-1 rounded-xl">
                {["subscription", "usage", "hybrid", "seat", "credits", "enterprise"].map((model) => (
                  <button
                    key={model}
                    onClick={() => setSelectedShowcaseModel(model as any)}
                    className={`py-1 text-[10px] font-semibold capitalize rounded ${
                      selectedShowcaseModel === model ? "bg-white text-neutral-900 shadow" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    {model}
                  </button>
                ))}
              </div>

              {/* Slider for sandbox values */}
              <div className="bg-neutral-800 p-3.5 rounded-xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-neutral-200">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Users className="h-3.5 w-3.5 text-[#0071E3]" /> Seats Consumed: <strong className="text-white text-xs">{playSeats}</strong>
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400">₦3,000 / seat overage</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={playSeats}
                  onChange={(e) => setPlaySeats(Number(e.target.value))}
                  className="w-full h-1 bg-neutral-800 accent-[#0071E3]"
                />

                <div className="flex items-center justify-between text-xs text-neutral-200 pt-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Database className="h-3.5 w-3.5 text-[#0071E3]" /> Telemetry Volume Generated: <strong className="text-white text-xs">{playUsage.toLocaleString()}</strong>
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400">₦2 / overage unit</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100000"
                  step="100"
                  value={playUsage}
                  onChange={(e) => setPlayUsage(Number(e.target.value))}
                  className="w-full h-1 bg-neutral-800 accent-[#0071E3]"
                />
              </div>

              {/* Outcome pricing box */}
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest block">Live Calculated Recurred Invoice</span>
                  <div className="text-[10px] text-[#0071E3] font-mono mt-0.5">{calculated.formula}</div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-mono font-bold text-white">
                    {calculated.currency}
                    {calculated.total.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-neutral-500 block">/ month</span>
                </div>
              </div>
            </div>
          )}

          {/* Subtab 2: Usage Telemetry Event Ingest Stream */}
          {activePlaygroundTab === "metering" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Real-Time Event Ingestion Engine</h4>
                  <p className="text-[10px] text-neutral-500 font-medium">Simulate sending telemetry event logs down into the ledger system:</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => triggerTelemetrySimulator("usage")}
                    className="bg-[#0071E3] hover:bg-sky-600 text-white text-[9px] font-bold uppercase px-2 py-1 rounded cursor-pointer"
                  >
                    + Send Telemetry Event
                  </button>
                  <button
                    onClick={() => triggerTelemetrySimulator("seat")}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[9px] font-bold uppercase px-2 py-1 rounded cursor-pointer"
                  >
                    + Add Corporate Member
                  </button>
                  <button
                    onClick={() => triggerTelemetrySimulator("reset")}
                    className="bg-neutral-950 hover:bg-neutral-900 text-neutral-400 text-[9px] font-bold uppercase px-1.5 py-1 rounded border border-neutral-800"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 font-mono text-[10px] text-neutral-300 space-y-1.5 h-36 overflow-y-auto">
                <span className="text-neutral-500 uppercase font-bold text-[8px] tracking-wider block mb-1">Live Ingestion Bus Node Feed:</span>
                {simulationLogs.map((log, index) => (
                  <div key={index} className="flex gap-2 text-neutral-300">
                    <span className="text-[#0071E3] shrink-0">▸</span>
                    <span className={index === 0 ? "text-white font-semibold" : "text-neutral-400"}>{log}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-neutral-800 p-3 rounded-lg border border-neutral-700">
                  <div className="text-[9px] font-extrabold uppercase text-neutral-500">Aggregate Active Seats</div>
                  <div className="text-lg font-bold font-mono text-white mt-1">{playSeats} Members</div>
                </div>
                <div className="bg-neutral-800 p-3 rounded-lg border border-neutral-700">
                  <div className="text-[9px] font-extrabold uppercase text-neutral-500">Aggregate Usage Units</div>
                  <div className="text-lg font-bold font-mono text-white mt-1">{playUsage.toLocaleString()} Units</div>
                </div>
              </div>
            </div>
          )}

          {/* Subtab 3: Production Live Chart Preview */}
          {activePlaygroundTab === "revenue" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Live Operations & Subscription Analytics</h4>
                  <p className="text-[10px] text-neutral-500">Actual billing metrics computed directly from workspace logs:</p>
                </div>
              </div>

              <div className="h-36 w-full text-white">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0071E3" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="month" stroke="#666" fontSize={9} />
                    <YAxis stroke="#666" fontSize={9} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", fontSize: "10px" }} />
                    <Area type="monotone" dataKey="mrr" stroke="#0071E3" strokeWidth={2} fillOpacity={1} fill="url(#mrrGrad)" name="MRR (₦)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-neutral-800 p-2 rounded border border-neutral-700">
                  <span className="text-[8px] font-bold text-neutral-500 block uppercase">Aggregate ARR</span>
                  <span className="text-xs font-mono font-bold text-white mt-0.5">₦43,200,000</span>
                </div>
                <div className="bg-neutral-800 p-2 rounded border border-neutral-700">
                  <span className="text-[8px] font-bold text-neutral-500 block uppercase">Net Growth rate</span>
                  <span className="text-xs font-mono font-bold text-emerald-400 mt-0.5">+24.3% MoM</span>
                </div>
                <div className="bg-neutral-800 p-2 rounded border border-neutral-700">
                  <span className="text-[8px] font-bold text-neutral-500 block uppercase">Active Invoices</span>
                  <span className="text-xs font-mono font-bold text-white mt-0.5">142 Paid</span>
                </div>
              </div>
            </div>
          )}

          {/* Prompt statement of the visual */}
          <div className="mt-4 pt-4 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
            <span className="font-semibold block text-white/95">
              "Everything related to monetization lives here."
            </span>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-[10px] text-neutral-400 font-mono">Live Demo Module Connected</span>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- TRUST STATEMENT ----------------- */}
      <section className="bg-white border-y border-[#E5E5E7] py-8">
        <div className="max-w-7xl mx-auto px-8 text-center">
          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">
            Built for Matchless SaaS, AI & Product Platforms
          </p>
          <div className="mt-5 flex flex-wrap justify-center items-center gap-x-12 gap-y-6 text-sm font-extrabold text-neutral-400">
            <span className="hover:text-neutral-900 transition-colors">SaaS Platforms</span>
            <span className="hover:text-neutral-900 transition-colors">AI Products</span>
            <span className="hover:text-neutral-900 transition-colors">Developer Tools</span>
            <span className="hover:text-neutral-900 transition-colors">Usage-Based Platforms</span>
            <span className="hover:text-neutral-900 transition-colors">Marketplaces</span>
            <span className="hover:text-neutral-900 transition-colors">API Businesses</span>
            <span className="hover:text-neutral-900 transition-colors">Enterprise Software</span>
          </div>
        </div>
      </section>

      {/* ----------------- PROBLEM SECTION ----------------- */}
      <section id="problems" className="py-20 max-w-7xl mx-auto px-8">
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs font-bold text-[#0071E3] uppercase tracking-wider block">
            The In-House Bottleneck
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-neutral-900 tracking-tight">
            Billing Shouldn't Be Application Code
          </h2>
          <p className="text-sm sm:text-base text-neutral-600 font-medium">
            Most teams spend months building infrastructure that isn't their core product. We give you a complete billing operating system out of the box.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            { tag: "Subscription Logic", desc: "Complex plans setup & billing periods" },
            { tag: "Usage Tracking", desc: "Volumetric high scale event logs resolution" },
            { tag: "Seat Management", desc: "Dynamic seats allowances & pro-rata changes" },
            { tag: "Credits Systems", desc: "Prepaid ledgers, adjustments & lifecycle" },
            { tag: "Pricing Rules", desc: "Package blocks, tiered rules & bespoke deals" },
            { tag: "Invoices", desc: "PDF layouts, tax calculators & invoice lines state" },
            { tag: "Revenue Calculations", desc: "MoM analysis, accurate usage metrics & ARR" },
            { tag: "Entitlements", desc: "Gate features based on specific subscription specs" }
          ].map((item, idx) => (
            <div key={idx} className="bg-white border border-[#E5E5E7] p-5 rounded-2xl shadow-sm text-left hover:border-neutral-400 transition-colors">
              <span className="h-7 w-7 rounded-lg bg-neutral-100 text-neutral-900 font-bold flex items-center justify-center text-xs mb-3">
                {idx + 1}
              </span>
              <h4 className="text-xs font-bold text-neutral-900 tracking-tight">{item.tag}</h4>
              <p className="text-[11px] text-neutral-500 font-medium mt-1 leading-tight">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------- FEATURES GRID SECTION ----------------- */}
      <section id="features" className="bg-white py-20 border-t border-[#E5E5E7]">
        <div className="max-w-7xl mx-auto px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <span className="text-xs font-bold text-[#0071E3] uppercase tracking-wider block">
              Core Capabilities
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-neutral-900 tracking-tight">
              One Unified Ledger Engine. Complete Control.
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 font-medium">
              A comprehensive system designed from day one to serve as the single source of truth for your monetization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-[#FAFAFA] border border-[#E5E5E7] p-6 rounded-2xl space-y-3 shadow-sm hover:border-neutral-950 transition-all">
              <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 text-left">Product Catalog</h3>
              <p className="text-xs text-neutral-600 font-medium text-left leading-relaxed">
                Create products, plans, and features without engineering effort. Define what customers can buy, bundle products, and rollout custom tiers smoothly.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#FAFAFA] border border-[#E5E5E7] p-6 rounded-2xl space-y-3 shadow-sm hover:border-neutral-950 transition-all">
              <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 text-left">Entitlements Engine</h3>
              <p className="text-xs text-neutral-600 font-medium text-left leading-relaxed">
                Control feature access without hardcoding permissions. Check access instantly, enable premium features by active subscription plan, and manage limits centrally.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#FAFAFA] border border-[#E5E5E7] p-6 rounded-2xl space-y-3 shadow-sm hover:border-neutral-950 transition-all">
              <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 text-left">Usage Metering</h3>
              <p className="text-xs text-neutral-600 font-medium text-left leading-relaxed">
                Track events across your entire ecosystem. Monitor API Requests, Leads Generated, Emails Sent, Storage Used, AI Tokens, Projects Created. Everything becomes measurable.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-[#FAFAFA] border border-[#E5E5E7] p-6 rounded-2xl space-y-3 shadow-sm hover:border-neutral-950 transition-all">
              <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 text-left">Pricing Engine</h3>
              <p className="text-xs text-neutral-600 font-medium text-left leading-relaxed">
                Build any pricing structure without custom billing code. Flat Pricing, Usage-Based Billing, Seat-Based Pricing, Tiered Pricing, Credits, Hybrid Models, and Custom Enterprise Contracts.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-[#FAFAFA] border border-[#E5E5E7] p-6 rounded-2xl space-y-3 shadow-sm hover:border-neutral-950 transition-all">
              <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center">
                <LineChart className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 text-left">Revenue Simulation</h3>
              <p className="text-xs text-neutral-600 font-medium text-left leading-relaxed">
                Preview your plans pricing before going live. See exactly what customers will pay at every simulated usage level, and understand overall revenue impact before publishing changes.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-[#FAFAFA] border border-[#E5E5E7] p-6 rounded-2xl space-y-3 shadow-sm hover:border-neutral-950 transition-all">
              <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center">
                <Code2 className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 text-left">Developer Experience</h3>
              <p className="text-xs text-neutral-600 font-medium text-left leading-relaxed">
                Simple JSON APIs, powerful lightweight system SDKs, event ingestion pipelines, secure webhook dispatch, and immutable system audit logs. Built for developers first.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- PRODUCT SHOWCASE INTERACTIVE MODELS ----------------- */}
      <section id="showcase" className="py-20 max-w-7xl mx-auto px-8 text-center">
        <span className="text-xs font-bold text-[#0071E3] uppercase tracking-wider">
          Monetization Versatility
        </span>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-neutral-900 tracking-tight mt-2">
          One Platform. Every Pricing Model.
        </h2>
        <p className="text-xs sm:text-sm text-neutral-500 mt-2">
          No custom billing code required. Switch pricing strategies instantly using our unified declarative configurations.
        </p>

        <div className="mt-8 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { id: "subscription", title: "Subscription", rate: "₦15,000 / month", icon: Layers },
            { id: "usage", title: "Usage", rate: "₦2 / Unit", icon: Activity },
            { id: "hybrid", title: "Hybrid Model", rate: "₦15,000 + ₦2 / Unit", icon: Zap },
            { id: "seat", title: "Seat Based", rate: "₦3,000 / User", icon: Users },
            { id: "credits", title: "Credits Bundle", rate: "10,000 Credits Included", icon: Database },
            { id: "enterprise", title: "Enterprise", rate: "Custom SLA Contracts", icon: ShieldCheck }
          ].map((item) => {
            const Icon = item.icon;
            const isSel = selectedShowcaseModel === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedShowcaseModel(item.id as any)}
                className={`p-4 rounded-xl border flex flex-col justify-between text-left transition-all cursor-pointer ${
                  isSel
                    ? "bg-neutral-900 text-white border-neutral-900 shadow-md ring-1 ring-neutral-900"
                    : "bg-white text-neutral-900 border-[#E5E5E7] hover:border-neutral-400"
                }`}
              >
                <div>
                  <Icon className={`h-4.5 w-4.5 ${isSel ? "text-white" : "text-[#86868B]"}`} />
                  <h4 className="text-xs font-bold mt-2">{item.title}</h4>
                </div>
                <div className="mt-4">
                  <span className={`text-[11px] font-mono font-extrabold ${isSel ? "text-emerald-400" : "text-[#0071E3]"}`}>
                    {item.rate}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ----------------- WHY TEAMS SWITCH ----------------- */}
      <section className="bg-white py-20 border-t border-[#E5E5E7]">
        <div className="max-w-7xl mx-auto px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <span className="text-xs font-bold text-[#0071E3] uppercase tracking-wider block">
              The Aora Advantage
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-neutral-900 tracking-tight">
              Why Teams Switch
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 font-medium">
              Why engineering and finance teams discard legacy stripe wrappers in favor of Aora Billing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { title: "Build Faster", desc: "Ship monetization in days instead of months. Get live integration models in hours with elegant REST web nodes." },
              { title: "Reduce Complexity", desc: "Replace fragile, custom billing scripts and tables with one consolidated multi-tenant database ledger system." },
              { title: "Stay Flexible", desc: "Change pricing, billing periods, tiered incentives or contracts dynamically without re-deploying code." },
              { title: "Scale Confidently", desc: "Built for millions of enterprise customers, automatic high fidelity invoices, and billions of telemetry usage events." }
            ].map((item, idx) => (
              <div key={idx} className="p-6 bg-[#FAFAFA] border border-[#E5E5E7] rounded-3xl text-left space-y-2">
                <span className="text-xs font-mono font-bold text-[#0071E3]">0{idx+1}/</span>
                <h3 className="text-xs font-bold text-neutral-900">{item.title}</h3>
                <p className="text-xs text-neutral-500 font-medium leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------- REVENUE DASHBOARD PREVIEW ----------------- */}
      <section className="py-20 bg-neutral-950 border-t border-neutral-900">
        <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-4 space-y-4 text-left">
            <span className="text-[10px] font-bold text-[#0071E3] uppercase tracking-widest block">
              Visual Finance Analytics
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Calculated Financial Operations Workspace
            </h2>
            <p className="text-xs text-neutral-400 font-medium leading-relaxed">
              Stay fully informed. Aora automatically handles the telemetry mapping of events and compiles instant executive subscription intelligence dashboards out of the box.
            </p>
            <div className="pt-2">
              <button
                onClick={() => onNavigateTab("revenue")}
                className="text-xs font-bold text-[#0071E3] border border-[#0071E3]/20 hover:bg-[#0071E3]/5 bg-neutral-900 px-4 py-2 rounded-lg cursor-pointer inline-flex items-center gap-1.5"
              >
                Explore Revenue Terminal
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-neutral-800 pb-4 gap-3">
              <div>
                <h3 className="text-xs font-bold text-white">Consolidated Cash-Flow Intelligence</h3>
                <p className="text-[10px] text-neutral-500 mt-0.5">High volume telemetry data processed under 50ms latency standards</p>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded font-extrabold uppercase font-mono">
                System Online
              </span>
            </div>

            {/* Apple Style Calm Dash Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-2xl text-left">
                <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Calculated MRR</span>
                <div className="text-xl font-bold font-mono text-white mt-1">₦3,600,000</div>
                <span className="text-[10px] text-emerald-400 font-semibold block mt-1">+18.5% scale this week</span>
              </div>
              <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-2xl text-left">
                <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Active ARR</span>
                <div className="text-xl font-bold font-mono text-white mt-1">₦43,200,000</div>
                <span className="text-[10px] text-neutral-400 block mt-1">Annualized projections</span>
              </div>
              <div className="bg-[#0071E3]/10 border border-[#0071E3]/20 p-4 rounded-2xl text-left animate-pulse">
                <span className="text-[9px] text-[#0071E3] font-bold uppercase tracking-widest">Telemetry Event Bus</span>
                <div className="text-xl font-bold font-mono text-white mt-1">2,410,250 events</div>
                <span className="text-[10px] text-neutral-300 block mt-1">Leads, API, and Seats calls</span>
              </div>
            </div>

            {/* Simulated Table */}
            <div className="space-y-2">
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block text-left">Top Active Enterprise Accounts</span>
              <div className="bg-neutral-950 rounded-xl border border-neutral-800 p-3 overflow-x-auto">
                <table className="w-full text-left text-[11px] font-mono text-neutral-300">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-500 text-[10px]">
                      <th className="pb-2">Customer Account</th>
                      <th className="pb-2">Matched Plan</th>
                      <th className="pb-2">Usage Telemetry</th>
                      <th className="pb-2">Current Month Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-neutral-900">
                      <td className="py-2 text-white font-bold">Acme Workspace Corp</td>
                      <td className="py-2 text-[#0071E3]">Growth Enterprise v3</td>
                      <td className="py-2">12,500 Leads</td>
                      <td className="py-2 text-white font-bold">₦45,000</td>
                    </tr>
                    <tr className="border-b border-neutral-900">
                      <td className="py-2 text-white font-bold">Linear Technologies Ltd</td>
                      <td className="py-2 text-violet-400 font-bold">Enterprise Bespoke SLA</td>
                      <td className="py-2">85,200 Leads</td>
                      <td className="py-2 text-white font-bold">₦120,500</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-white font-bold">Stellar Design Inc</td>
                      <td className="py-2 text-[#0071E3]">Basic Starter Plan</td>
                      <td className="py-2">1,200 Leads</td>
                      <td className="py-2 text-white font-bold">₦15,000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- DEVELOPER LIVE TEST TERMINAL ----------------- */}
      <section id="developers" className="py-20 max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-4 text-left">
            <span className="text-xs font-bold text-[#0071E3] uppercase tracking-wider block">
              Built Dev-First
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-neutral-900 tracking-tight">
              Billing Infrastructure Developers Actually Enjoy
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
              Integrate inside minutes. Simply dispatch lightweight telemetry event payloads when actions occur—Aora handles the sliding pricing scales, pro-rata calculations, and ledger updates seamlessly.
            </p>
            <p className="text-[11px] text-neutral-400 font-bold tracking-tight uppercase">
              No complex backend billing logic or loops required.
            </p>
          </div>

          {/* Interactive Developer Tab Console */}
          <div className="lg:col-span-7 bg-[#1E1E1E] border border-neutral-800 rounded-3xl p-6 shadow-2xl relative text-left">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500"></span>
                <span className="h-3 w-3 rounded-full bg-yellow-500"></span>
                <span className="h-3 w-3 rounded-full bg-green-500"></span>
              </div>
              <div className="flex gap-1">
                {["track", "can", "calculate"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveDevCode(tab as any)}
                    className={`px-3 py-1 text-[10px] uppercase font-mono rounded cursor-pointer ${
                      activeDevCode === tab ? "bg-neutral-800 text-white font-extrabold" : "text-neutral-500"
                    }`}
                  >
                    {tab === "track" ? "billing.track()" : tab === "can" ? "billing.can()" : "billing.calculate()"}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Highlight Block & Outcome Simulated Side-By-Side */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-7 bg-neutral-950 p-4 rounded-xl border border-neutral-800 font-mono text-xs text-[#9CDCF0] space-y-2">
                {activeDevCode === "track" && (
                  <>
                    <p className="text-neutral-500">// Ingest consumer event logs</p>
                    <p>
                      <span className="text-[#569CD6]">await</span> billing.<span className="text-[#DCDCAA]">track</span>(
                    </p>
                    <p className="pl-4">"cust_89b2",</p>
                    <p className="pl-4">
                      <span className="text-[#CE9178]">"lead_generated"</span>,
                    </p>
                    <p className="pl-4">
                      <span className="text-[#B5CEA8]">1</span>
                    </p>
                    <p>);</p>
                    <p className="text-neutral-500 text-[10px] mt-4">✓ Track actions automatically behind API nodes without blocking response lifecycle.</p>
                  </>
                )}

                {activeDevCode === "can" && (
                  <>
                    <p className="text-neutral-500">// Check customer's entitlements live</p>
                    <p>
                      <span className="text-[#BB9AF7]">const</span> authorized = <span className="text-[#569CD6]">await</span> billing.<span className="text-[#DCDCAA]">can</span>(
                    </p>
                    <p className="pl-4">"cust_89b2",</p>
                    <p className="pl-4">
                      <span className="text-[#CE9178]">"pro_features"</span>
                    </p>
                    <p>);</p>
                    <p className="text-neutral-500 text-[10px] mt-4">⚡ Checks active plan limits and entitlements dynamically before routing feature execution.</p>
                  </>
                )}

                {activeDevCode === "calculate" && (
                  <>
                    <p className="text-neutral-500">// Pull pre-calculated invoice logs live</p>
                    <p>
                      <span className="text-[#BB9AF7]">const</span> invoice = <span className="text-[#569CD6]">await</span> billing.<span className="text-[#DCDCAA]">calculate</span>(
                    </p>
                    <p className="pl-4">"cust_89b2"</p>
                    <p>);</p>
                    <p className="text-neutral-500 text-[10px] mt-4">⚡ Instantly compiles flat fees, seat metrics and volumetric tier levels with active coupons.</p>
                  </>
                )}
              </div>

              {/* simulated response payload */}
              <div className="md:col-span-5 bg-neutral-900 p-4 rounded-xl border border-neutral-800 font-mono text-[10px] text-neutral-400 space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] text-[#0071E3] font-bold uppercase tracking-wider block mb-1">
                    Simulated Response Payload
                  </span>
                  
                  {activeDevCode === "track" && (
                    <pre className="text-amber-300">
{`{
  "status": "success",
  "event_id": "ev_80b1e2",
  "credits_remaing": 8200
}`}
                    </pre>
                  )}

                  {activeDevCode === "can" && (
                    <pre className="text-emerald-400">
{`{
  "allowed": true,
  "reason": "Plan Growth valid",
  "limits": {
    "leads_limit": 50000,
    "leads_current": 18500
  }
}`}
                    </pre>
                  )}

                  {activeDevCode === "calculate" && (
                    <pre className="text-blue-300">
{`{
  "customer_id": "cust_89b2",
  "base_recurrent": 15000,
  "usage_overage": 4200,
  "discount_applied": 1500,
  "total_liability": 17700,
  "currency": "NGN"
}`}
                    </pre>
                  )}
                </div>

                <div className="pt-2 border-t border-neutral-800">
                  <span className="text-[9px] text-neutral-500 uppercase block">Response Time</span>
                  <span className="text-white font-bold">12ms - SLA guaranteed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- INTUITIVE COMPARISON TABLE ----------------- */}
      <section className="bg-white border-t border-[#E5E5E7] py-20">
        <div className="max-w-4xl mx-auto px-8">
          <div className="text-center space-y-3 mb-12">
            <span className="text-xs font-bold text-[#0071E3] uppercase tracking-wider block">
              Architectural ROI
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
              Feature Delivery Strategy Comparison
            </h2>
          </div>

          <div className="bg-white border border-[#E5E5E7] rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-neutral-50 border-b border-[#E5E5E7] text-neutral-500 uppercase font-bold text-[10px] tracking-widest">
                  <th className="py-4 px-6 text-left">Functional Matrix Dimension</th>
                  <th className="py-4 px-4 text-center bg-sky-50 text-neutral-900 font-extrabold">Aora Platform Billing</th>
                  <th className="py-4 px-4 text-center">Build Custom In-House</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-semibold text-neutral-800">
                <tr>
                  <td className="py-4 px-6 text-left">Entitlements Access Rules</td>
                  <td className="py-4 px-4 text-center bg-sky-50 text-emerald-600 font-extrabold">✓ Instant Declarative Node</td>
                  <td className="py-4 px-4 text-center text-neutral-500">2-3 Months engineering</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 text-left">Volumetric Usage Metering</td>
                  <td className="py-4 px-4 text-center bg-sky-50 text-emerald-600 font-extrabold">✓ High Scale Event Bus Included</td>
                  <td className="py-4 px-4 text-center text-neutral-500">3-4 Months (Kafka cluster set)</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 text-left">Multi-Model Pricing Engine</td>
                  <td className="py-4 px-4 text-center bg-sky-50 text-emerald-600 font-extrabold">✓ Native Support Out-of-box</td>
                  <td className="py-4 px-4 text-center text-neutral-500">2+ Months custom dev cycles</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 text-left">Simulation and Revenue Rules</td>
                  <td className="py-4 px-4 text-center bg-sky-50 text-emerald-600 font-extrabold">✓ Included - Live calculation API</td>
                  <td className="py-4 px-4 text-center text-neutral-500">1-2 Months database staging</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 text-left">Subscription & Pro-rata Loops</td>
                  <td className="py-4 px-4 text-center bg-sky-50 text-emerald-600 font-extrabold">✓ Automap pro-rata ledger rules</td>
                  <td className="py-4 px-4 text-center text-neutral-500">2-3 Months billing debugging</td>
                </tr>
                <tr className="bg-neutral-50/50">
                  <td className="py-4 px-6 text-left font-bold text-neutral-950">Aggregate Core Overhead</td>
                  <td className="py-4 px-4 text-center bg-sky-50/80 text-emerald-600 font-black">✓ Instant deployment in days</td>
                  <td className="py-4 px-4 text-center text-red-600 font-extrabold">12+ Engineering Months</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ----------------- FINAL CALL TO ACTION ----------------- */}
      <section className="bg-neutral-900 py-24 text-white text-center px-8 border-t border-neutral-800">
        <div className="max-w-4xl mx-auto space-y-6">
          <span className="text-[10px] font-bold text-[#0071E3] uppercase tracking-widest block">
            Unlock Scalable Monetization
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight leading-tight">
            Monetize Faster. Scale Smarter.
          </h2>
          <p className="text-sm sm:text-base text-neutral-400 font-medium max-w-xl mx-auto leading-relaxed">
            Everything your product needs to manage subscriptions, pricing, usage, entitlements, and revenue. Without building complex billing infrastructure from scratch.
          </p>

          <div className="pt-4 flex flex-wrap justify-center items-center gap-3">
            <button
              onClick={() => onNavigateTab("dashboard")}
              className="px-6 py-3.5 bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              Start Building
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => onNavigateTab("customers")}
              className="px-6 py-3.5 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Talk to Sales
            </button>
          </div>
        </div>
      </section>

      {/* ----------------- FOOTER SECTION ----------------- */}
      <footer className="bg-neutral-950 border-t border-neutral-900 py-16 text-xs text-neutral-500 px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-6 gap-8">
          {/* Brand Col */}
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white">
                <Sparkles className="h-3.5 w-3.5 text-neutral-900" />
              </div>
              <span className="font-bold text-white text-xs">
                Aora Billing
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 font-medium leading-relaxed max-w-xs">
              Declaring beautiful, modern monetization engines for SaaS and cloud API platforms instantly.
            </p>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase text-white tracking-wider block mb-3">Products</span>
            <ul className="space-y-2">
              <li><button onClick={() => scrollToId("features")} className="hover:text-white transition-colors cursor-pointer text-left">Product Catalog</button></li>
              <li><button onClick={() => scrollToId("features")} className="hover:text-white transition-colors cursor-pointer text-left">Usage Metering</button></li>
              <li><button onClick={() => scrollToId("features")} className="hover:text-white transition-colors cursor-pointer text-left">Entitlements Engine</button></li>
              <li><button onClick={() => scrollToId("showcase")} className="hover:text-white transition-colors cursor-pointer text-left">Pricing Models</button></li>
            </ul>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase text-white tracking-wider block mb-3">Pricing</span>
            <ul className="space-y-2">
              <li><button onClick={() => scrollToId("showcase")} className="hover:text-white transition-colors cursor-pointer text-left font-semibold text-[#0071E3]">Compare Plans</button></li>
              <li><a href="#custom" className="hover:text-white transition-colors">Enterprise SLA</a></li>
              <li><a href="#partner" className="hover:text-white transition-colors">Partner Rules</a></li>
            </ul>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase text-white tracking-wider block mb-3">Developers</span>
            <ul className="space-y-2">
              <li><button onClick={() => onNavigateTab("docs")} className="hover:text-white transition-colors cursor-pointer text-left">Developer Docs & SDKs</button></li>
              <li><button onClick={() => onNavigateTab("docs")} className="hover:text-white transition-colors cursor-pointer text-left">API Reference</button></li>
              <li><button onClick={() => onNavigateTab("docs")} className="hover:text-white transition-colors cursor-pointer text-left">API System Status</button></li>
            </ul>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase text-white tracking-wider block mb-3">Legal & Info</span>
            <ul className="space-y-2">
              <li><a href="#terms" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#security" className="hover:text-white transition-colors">Security Center</a></li>
              <li><a href="#blog" className="hover:text-white transition-colors font-medium">Read Blog</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-neutral-900 mt-12 pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] gap-4">
          <p>© 2026 Aora Technologies Ltd. All rights reserved billing services.</p>
          <div className="flex gap-4">
            <a href="#twitter" className="hover:text-white">Twitter</a>
            <a href="#github" className="hover:text-white">GitHub</a>
            <a href="#slack" className="hover:text-white">Slack Community</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
