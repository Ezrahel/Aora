import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Gauge, 
  ArrowUpRight, 
  Plus, 
  Check, 
  Play, 
  RefreshCw, 
  Send, 
  Radio, 
  Sparkles, 
  Sliders, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Database, 
  Terminal, 
  Coins, 
  History, 
  User, 
  BookOpen, 
  Layout, 
  Eye, 
  ShieldCheck, 
  Flame, 
  Network,
  Code,
  Zap,
  Clock,
  Layers,
  Undo
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Customer, MeterDefinition, UsageEvent } from "../types";

interface UsageMeteringViewProps {
  meters: MeterDefinition[];
  events: UsageEvent[];
  customers: Customer[];
  onEventSubmitted: () => void;
  onMeterCreated: () => void;
}

export default function UsageMeteringView({
  meters,
  events,
  customers,
  onEventSubmitted,
  onMeterCreated
}: UsageMeteringViewProps) {
  // Navigation tabs
  const [activeSubTab, setActiveSubTab] = useState<"ingest" | "explorer" | "ledger" | "portal" | "blueprints">("ingest");

  // Local synced data for quotas & credit ledger
  const [quotas, setQuotas] = useState<any[]>([]);
  const [creditLedger, setCreditLedger] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Load backend states
  const syncState = async () => {
    setLoadingLedger(true);
    try {
      const [qRes, cRes] = await Promise.all([
        fetch("/api/quotas"),
        fetch("/api/credits/ledger")
      ]);
      if (qRes.ok) {
        const qData = await qRes.json();
        setQuotas(qData);
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setCreditLedger(cData);
      }
    } catch (e) {
      console.error("Failed to load Phase 2 schema elements", e);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    syncState();
  }, [events]);

  // Tab 1: Single and Bulk Ingestion form states
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || "");
  const [selectedMeterId, setSelectedMeterId] = useState(meters[0]?.id || "");
  const [eventValue, setEventValue] = useState(1);
  const [sourceTag, setSourceTag] = useState("api_gateway");
  const [customKey, setCustomKey] = useState("idempotency_" + Math.floor(Math.random() * 10000000));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEventSuccess, setShowEventSuccess] = useState(false);

  const handleInjectEvent = async () => {
    if (!selectedCustomerId) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/usage-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          meterId: selectedMeterId,
          value: Number(eventValue),
          metadata: {
            source: sourceTag,
            originTime: new Date().toISOString(),
            dedupeId: customKey
          }
        })
      });

      if (!response.ok) {
        throw new Error("Failed to inject usage event.");
      }

      setShowEventSuccess(true);
      // cycle dedupe key
      setCustomKey("idempotency_" + Math.floor(Math.random() * 10000000));
      onEventSubmitted();
      setTimeout(() => setShowEventSuccess(false), 2500);

    } catch (err) {
      alert("Failed to stream event: " + err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk payloads presets
  const handleBulkPayloadInject = async (type: "analytics" | "tokens" | "compute") => {
    setIsSubmitting(true);
    let payload: any[] = [];
    const nowStr = new Date().toISOString();

    if (type === "analytics") {
      payload = [
        { customerId: "linear", meterId: "api_meter", value: 1, metadata: { endpoint: "/api/v1/auth", dedupeId: "bulk_" + Math.random() }, timestamp: nowStr },
        { customerId: "linear", meterId: "api_meter", value: 1, metadata: { endpoint: "/api/v1/projects", dedupeId: "bulk_" + Math.random() }, timestamp: nowStr },
        { customerId: "vercel", meterId: "api_meter", value: 1, metadata: { endpoint: "/v2/deployments", dedupeId: "bulk_" + Math.random() }, timestamp: nowStr }
      ];
    } else if (type === "tokens") {
      payload = [
        { customerId: "acme", meterId: "compute_meter", value: 500, metadata: { model: "gemini-1.5-pro", reason: "summary" }, timestamp: nowStr },
        { customerId: "vercel", meterId: "compute_meter", value: 1200, metadata: { model: "gemini-2.0-flash", reason: "deploy_build" }, timestamp: nowStr }
      ];
    } else {
      payload = [
        { customerId: "retool", meterId: "compute_meter", value: 150, metadata: { source: "google_forms" }, timestamp: nowStr },
        { customerId: "linear", meterId: "compute_meter", value: 2500, metadata: { source: "api_import" }, timestamp: nowStr }
      ];
    }

    try {
      const response = await fetch("/api/events/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        alert(`Successfully ingested multi-tenant Bulk event queue package (${payload.length} items logged instantly!).`);
        onEventSubmitted();
      }
    } catch (err) {
      alert("Error queueing bulk stream: " + err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportHistoricStream = async () => {
    setIsSubmitting(true);
    // Backfill seed to mimic database import tool
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const mockHistoric = [
      { customerId: "linear", meterId: "compute_meter", value: 15000, timestamp: pastDate.toISOString(), metadata: { source: "migration_csv" } },
      { customerId: "vercel", meterId: "api_meter", value: 45000, timestamp: pastDate.toISOString(), metadata: { source: "migration_csv" } }
    ];

    try {
      const response = await fetch("/api/events/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockHistoric)
      });
      if (response.ok) {
        alert("SaaS historical backfill completed. Materialized timeline charts updated!");
        onEventSubmitted();
      }
    } catch (err) {
      alert("Backfill error: " + err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tab 1: New meter creation states
  const [newMeterName, setNewMeterName] = useState("");
  const [newMeterDesc, setNewMeterDesc] = useState("");
  const [newMeterAgg, setNewMeterAgg] = useState<"sum" | "count" | "max" | "latest" | "min" | "average">("sum");
  const [newMeterField, setNewMeterField] = useState("usage_amount");
  const [newMeterSlug, setNewMeterSlug] = useState("");
  const [newMeterUnit, setNewMeterUnit] = useState("Units");
  const [isCreatingMeter, setIsCreatingMeter] = useState(false);

  const handleCreateMeter = async () => {
    if (!newMeterName.trim()) return;
    setIsCreatingMeter(true);
    try {
      const response = await fetch("/api/meters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMeterName,
          description: newMeterDesc,
          aggregationType: newMeterAgg,
          targetField: newMeterField,
          slug: newMeterSlug || newMeterName.toLowerCase().replace(/\s+/g, "_"),
          unit: newMeterUnit || "Units",
          status: "active"
        })
      });

      if (!response.ok) {
        throw new Error("Failed to register new meter definition.");
      }

      setNewMeterName("");
      setNewMeterDesc("");
      setNewMeterSlug("");
      setNewMeterUnit("");
      onMeterCreated();

    } catch (err) {
      alert("Error registering meter: " + err);
    } finally {
      setIsCreatingMeter(false);
    }
  };

  // Tab 2: Explorer state controls
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMeter, setFilterMeter] = useState("all");
  const [filterCustomer, setFilterCustomer] = useState("all");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [replayingEventId, setReplayingEventId] = useState<string | null>(null);

  const handleReplayEvent = async (id: string) => {
    setReplayingEventId(id);
    try {
      const res = await fetch("/api/events/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id })
      });
      if (res.ok) {
        alert(`Event tracer #${id} successfully replayed. Double-entry aggregation queues recalculated values.`);
        onEventSubmitted();
      }
    } catch (e) {
      alert("Error replaying event: " + e);
    } finally {
      setReplayingEventId(null);
    }
  };

  // Tab 3: Ledgers state controls
  const [limitCheckCust, setLimitCheckCust] = useState(customers[0]?.id || "");
  const [limitCheckMeter, setLimitCheckMeter] = useState(meters[0]?.id || "");
  const [limitCheckAmount, setLimitCheckAmount] = useState(1);
  const [canConsumeResult, setCanConsumeResult] = useState<any>(null);
  const [isCheckingConsume, setIsCheckingConsume] = useState(false);

  // Forms to construct credit/quota dynamically
  const [creditAmount, setCreditAmount] = useState(5000);
  const [creditDesc, setCreditDesc] = useState("Venture Grant issue #10293");
  const [creditType, setCreditType] = useState<any>("credit_issued");
  const [creditCust, setCreditCust] = useState(customers[0]?.id || "");
  
  const [quotaAmount, setQuotaAmount] = useState(50000);
  const [quotaMeter, setQuotaMeter] = useState(meters[0]?.id || "");
  const [quotaCust, setQuotaCust] = useState(customers[0]?.id || "");
  const [quotaPeriod, setQuotaPeriod] = useState<any>("monthly");

  const handleCheckLimit = async () => {
    setIsCheckingConsume(true);
    setCanConsumeResult(null);
    try {
      const q = `?customerId=${limitCheckCust}&meterId=${limitCheckMeter}&amount=${limitCheckAmount}`;
      const res = await fetch(`/api/can-consume${q}`);
      if (res.ok) {
        const d = await res.json();
        setCanConsumeResult(d);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCheckingConsume(false);
    }
  };

  const handleAssignQuota = async () => {
    try {
      const res = await fetch("/api/quotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: quotaCust,
          meterId: quotaMeter,
          limitValue: quotaAmount,
          period: quotaPeriod
        })
      });
      if (res.ok) {
        alert("Enforceable client quota limit successfully assigned!");
        syncState();
      }
    } catch (err) {
      alert("Quota issue error: " + err);
    }
  };

  const handleIssueCredit = async () => {
    try {
      const res = await fetch("/api/credits/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: creditCust,
          amount: creditType === "credit_issued" ? Number(creditAmount) : -Number(creditAmount),
          type: creditType,
          description: creditDesc
        })
      });
      if (res.ok) {
        alert("Double-entry credit transaction successfully logged to immutable ledger!");
        setCreditDesc("");
        syncState();
      }
    } catch (err) {
      alert("Credit issue error: " + err);
    }
  };

  // Tab 4: Customer Portal state
  const [portalCustomerId, setPortalCustomerId] = useState(customers[0]?.id || "");

  // Compute calculated values for Portal Dashboard View
  const selectedPortalCustomerObj = customers.find(c => c.id === portalCustomerId);
  const portalCustQuotas = quotas.filter(q => q.customerId === portalCustomerId);
  const portalCustCredits = creditLedger
    .filter(c => c.customerId === portalCustomerId)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const portalCustEvents = events.filter(e => e.customerId === portalCustomerId);

  // Blueprint documentation tab state
  const [blueprintInnerTab, setBlueprintInnerTab] = useState<"sql" | "pipeline" | "sdk" | "scale">("sql");

  // Filter events based on explorer parameters
  const filteredTimelineEvents = events.filter(evt => {
    const matchesSearch = searchQuery === "" || 
      evt.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (evt.metadata && JSON.stringify(evt.metadata).toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesMeter = filterMeter === "all" || evt.meterId === filterMeter;
    const matchesCust = filterCustomer === "all" || evt.customerId === filterCustomer;
    return matchesSearch && matchesMeter && matchesCust;
  });

  // Simple static AreaChart feed coordinates for premium aesthetics
  const usageOverTimeData = [
    { hour: "00:00", volume: 1400, compute: 85, replayed: 0 },
    { hour: "04:00", volume: 2800, compute: 140, replayed: 12 },
    { hour: "08:00", volume: 4900, compute: 220, replayed: 35 },
    { hour: "12:00", volume: 8100, compute: 290, replayed: 54 },
    { hour: "16:00", volume: 11200, compute: 410, replayed: 88 },
    { hour: "20:00", volume: 15400, compute: 530, replayed: 104 }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Overview Head banner */}
      <div className="border-b border-[#E5E5E7] pb-4.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#111111] leading-none mb-1">Usage Trackers</h2>
          <p className="text-xs text-[#6E6E73] mt-1 font-medium">
            System source of truth for tracking customer activity, dynamic quota thresholds, prepaid credit ledgers, and limit checkers.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-[#F5F5F7] p-0.5 rounded-full border border-[#E5E5E7] text-xs overflow-x-auto shrink-0">
          <button 
            onClick={() => setActiveSubTab("ingest")} 
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 shrink-0 ${activeSubTab === "ingest" ? "bg-white text-black shadow-sm" : "text-[#6E6E73] hover:text-black"}`}
          >
            <Radio className={`h-3.5 w-3.5 ${activeSubTab === "ingest" ? "text-emerald-500 animate-pulse" : ""}`} />
            Track Activity
          </button>
          <button 
            onClick={() => setActiveSubTab("explorer")} 
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 shrink-0 ${activeSubTab === "explorer" ? "bg-white text-black shadow-sm" : "text-[#6E6E73] hover:text-black"}`}
          >
            <Search className="h-3.5 w-3.5" />
            Activity Explorer
          </button>
          <button 
            onClick={() => setActiveSubTab("ledger")} 
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 shrink-0 ${activeSubTab === "ledger" ? "bg-white text-black shadow-sm" : "text-[#6E6E73] hover:text-black"}`}
          >
            <Coins className="h-3.5 w-3.5" />
            Limit & Balance
          </button>
          <button 
            onClick={() => setActiveSubTab("portal")} 
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 shrink-0 ${activeSubTab === "portal" ? "bg-white text-black shadow-sm" : "text-[#6E6E73] hover:text-black"}`}
          >
            <User className="h-3.5 w-3.5" />
            Client Portal
          </button>
          <button 
            onClick={() => setActiveSubTab("blueprints")} 
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 shrink-0 ${activeSubTab === "blueprints" ? "bg-white text-[#111111] shadow-sm" : "text-[#6E6E73] hover:text-black"}`}
          >
            <BookOpen className="h-3.5 w-3.5 text-stone-700" />
            Integration Guides
          </button>
        </div>
      </div>

      {/* RENDER ACTIVE PANEL ELEMENT */}

      {/* PANEL 1: ADMIN INGEST & METER SCHEMA */}
      {activeSubTab === "ingest" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Active Definitions List (3 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between text-left">
              <h3 className="text-xs font-bold text-[#6E6E73] uppercase tracking-wider">Meter Definitions</h3>
              <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-bold border border-sky-150">
                {meters.length} Loaded
              </span>
            </div>

            <div className="space-y-3">
              {meters.map((meter) => (
                <div
                  key={meter.id}
                  className="bg-white border border-[#E5E5E7] p-4 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.01)] text-left"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Gauge className="h-3.5 w-3.5 text-[#111111]" />
                        <h4 className="text-xs font-bold text-[#111111] leading-none">{meter.name}</h4>
                      </div>
                      <span className="text-[9px] font-mono text-neutral-500 mt-1 block">ID: {meter.id}</span>
                    </div>

                    <span className="text-[9px] font-mono font-bold text-[#0071E3] bg-blue-50 px-1.5 py-0.5 rounded uppercase border border-blue-100">
                      {meter.aggregationType}
                    </span>
                  </div>

                  <p className="text-[10px] text-[#6E6E73] font-medium leading-normal mt-2">
                    {meter.description}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-neutral-100/50 flex justify-between items-center text-[9px] text-[#6E6E73] font-mono">
                    <span>Field: <strong className="text-stone-800">{meter.targetField}</strong></span>
                    <span>Status: <strong className="text-emerald-700">ACTIVE</strong></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Meter Schema Provisioner */}
            <div className="bg-[#FAF9F6] border border-[#E5E5E7] p-4 rounded-xl text-left space-y-3">
              <h4 className="text-xs font-bold text-[#111111] flex items-center gap-1.5 leading-none">
                <Sliders className="h-4 w-4 text-[#8b5cf6]" />
                Provision Custom Meter Schema
              </h4>
              <p className="text-[10px] text-[#6E6E73] font-medium leading-normal">
                Declare a new pricing element dimension. The pipeline builds aggregated tables automatically.
              </p>

              <div className="space-y-2">
                <input
                  id="meter-prov-name"
                  type="text"
                  placeholder="e.g. LLM Engine API Tokens"
                  value={newMeterName}
                  onChange={(e) => setNewMeterName(e.target.value)}
                  className="w-full text-xs font-semibold border border-[#E5E5E7] outline-none rounded-lg p-2 bg-white text-[#111111]"
                />
                
                <input
                  id="meter-prov-desc"
                  type="text"
                  placeholder="e.g. Tracks total input/output raw tokens in production sessions..."
                  value={newMeterDesc}
                  onChange={(e) => setNewMeterDesc(e.target.value)}
                  className="w-full text-xs border border-[#E5E5E7] outline-none rounded-lg p-2 bg-white text-[#111111]"
                />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    id="meter-prov-agg"
                    value={newMeterAgg}
                    onChange={(e) => setNewMeterAgg(e.target.value as any)}
                    className="w-full text-[11px] font-semibold border border-[#E5E5E7] outline-none rounded-lg p-2 bg-white text-[#111111]"
                  >
                    <option value="sum">SUM</option>
                    <option value="count">COUNT (Hits)</option>
                    <option value="max">MAX</option>
                    <option value="latest">LATEST</option>
                    <option value="min">MIN</option>
                    <option value="average">AVERAGE</option>
                  </select>
                  <input
                    id="meter-prov-field"
                    type="text"
                    placeholder="XML Target Field"
                    value={newMeterField}
                    onChange={(e) => setNewMeterField(e.target.value)}
                    className="w-full text-xs border border-[#E5E5E7] outline-none rounded-lg p-2 bg-white text-[#111111]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    id="meter-prov-unit"
                    type="text"
                    placeholder="Unit (e.g. Tokens)"
                    value={newMeterUnit}
                    onChange={(e) => setNewMeterUnit(e.target.value)}
                    className="w-full text-xs border border-[#E5E5E7] outline-none rounded-lg p-2 bg-white text-[#111111]"
                  />
                  <button
                    onClick={handleCreateMeter}
                    disabled={isCreatingMeter || !newMeterName}
                    className="w-full py-2 bg-[#111111] hover:bg-[#1D1D1F] text-white text-xs font-bold rounded-lg cursor-pointer text-center disabled:bg-neutral-200 disabled:text-neutral-400 font-sans"
                    id="btn-deploy-schema"
                  >
                    Deploy Schema
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Flow Velocity and Event Injectors (8 cols) */}
          <div className="lg:col-span-8 space-y-6 text-left">
            
            {/* Live Chart Visualizer */}
            <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl shadow-sm">
              <div className="flex justify-between items-start pb-4 border-b border-neutral-100 mb-4">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block leading-none mb-1">
                    ● PIPELINE INGEST SPEED ACTIVE
                  </span>
                  <h3 className="text-sm font-semibold text-[#111111]">Real-time Event Ingestion Speed (Events / minute 24H clock)</h3>
                </div>
                <div className="text-xs text-[#6E6E73] font-mono bg-neutral-100 rounded px-2 py-0.5">
                  Tenant Isolation Mode: REST API-1
                </div>
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={usageOverTimeData}
                    margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="velocityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34c759" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#34c759" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E7" />
                    <XAxis dataKey="hour" stroke="#86868B" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#86868B" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="volume" stroke="#34c759" strokeWidth={2} fillOpacity={1} fill="url(#velocityGrad)" name="Ingested Events/min" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ingestion Console Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Single Telemetry Stream Entry */}
              <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl space-y-4 shadow-sm">
                <h4 className="text-xs font-bold text-[#111111] flex items-center gap-1.5 uppercase tracking-wide leading-none">
                  <Flame className="h-4 w-4 text-orange-500" />
                  Manual Telemetry Ingest Streamer
                </h4>
                <p className="text-[10px] text-[#6E6E73] leading-normal">
                  Simulate live micro-billing triggers. Ingestion validation ensures deduplication across network retransmits.
                </p>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-[#6E6E73] uppercase tracking-wider block mb-1">Customer</label>
                      <select
                        id="select-single-cust"
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        className="w-full text-xs font-semibold border border-[#E5E5E7] rounded-lg p-2 bg-[#FAFAFA] text-[#111111]"
                      >
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-[#6E6E73] uppercase tracking-wider block mb-1">Usage Meter</label>
                      <select
                        id="select-single-meter"
                        value={selectedMeterId}
                        onChange={(e) => setSelectedMeterId(e.target.value)}
                        className="w-full text-xs font-semibold border border-[#E5E5E7] rounded-lg p-2 bg-[#FAFAFA] text-[#111111]"
                      >
                        {meters.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-[#6E6E73] uppercase tracking-wider block mb-1">Value Amount</label>
                      <input
                        id="input-single-val"
                        type="number"
                        value={eventValue}
                        onChange={(e) => setEventValue(Number(e.target.value))}
                        className="w-full text-xs border border-[#E5E5E7] rounded-lg p-1.5 bg-white text-[#111111]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-[#6E6E73] uppercase tracking-wider block mb-1">Stream Source</label>
                      <input
                        id="input-single-source"
                        type="text"
                        value={sourceTag}
                        onChange={(e) => setSourceTag(e.target.value)}
                        className="w-full text-xs border border-[#E5E5E7] rounded-lg p-1.5 bg-white text-[#111111]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-[#6E6E73] uppercase tracking-wider block mb-1">Deduplication Key (Idempotency)</label>
                    <input
                      id="input-single-key"
                      type="text"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      className="w-full text-xs font-mono border border-[#E5E5E7] rounded-lg p-1.5 bg-[#FAF9F6] text-amber-900"
                    />
                  </div>

                  <button
                    onClick={handleInjectEvent}
                    disabled={isSubmitting}
                    className="w-full py-2 bg-[#111111] hover:bg-[#1D1D1F] text-white text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-sm font-sans"
                    id="btn-transmit-event"
                  >
                    <Send className="h-3 w-3" />
                    {isSubmitting ? "Uploading packets..." : "Stream Live Telemetry"}
                  </button>

                  {showEventSuccess && (
                     <div className="p-2 bg-neutral-50 text-neutral-800 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 border border-neutral-200 animate-pulse">
                       <CheckCircle2 className="h-3.5 w-3.5 text-neutral-800" />
                       Packet synchronized with deep billing state.
                     </div>
                   )}
                </div>
              </div>

              {/* Advanced Bulk and backfill importer */}
              <div className="bg-[#FAF9F6] border border-[#E5E5E7] p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-[#111111] flex items-center gap-1.5 uppercase tracking-wide leading-none">
                    <Layers className="h-4 w-4 text-stone-700" />
                    Bulk Ingress & Import Backfill
                  </h4>
                  <p className="text-[10px] text-[#6E6E73] leading-normal">
                    Ditch tedious single requests. Feed hundreds of operations down the pipe in single HTTP arrays to verify high throughput batch performance.
                  </p>

                  <div className="space-y-2.5 pt-1">
                    <button
                      onClick={() => handleBulkPayloadInject("analytics")}
                      className="w-full p-2.5 bg-white hover:bg-neutral-50 text-slate-800 text-xs rounded-xl flex items-center justify-between border border-[#E5E5E7] cursor-pointer transition-all"
                    >
                      <div className="text-left">
                        <strong className="block text-[11px]">Deploy Bulk API Operations</strong>
                        <span className="text-[9px] text-[#6E6E73]">3 synchronized calls for Linear & Vercel</span>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-stone-400" />
                    </button>

                    <button
                      onClick={() => handleBulkPayloadInject("tokens")}
                      className="w-full p-2.5 bg-white hover:bg-neutral-50 text-slate-800 text-xs rounded-xl flex items-center justify-between border border-[#E5E5E7] cursor-pointer transition-all"
                    >
                      <div className="text-left">
                        <strong className="block text-[11px]">Stream AI Compute Usage Logs</strong>
                        <span className="text-[9px] text-[#6E6E73]">Simulate raw high compute gemini metrics</span>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-stone-400" />
                    </button>
                    
                    <button
                      onClick={() => handleBulkPayloadInject("compute")}
                      className="w-full p-2.5 bg-white hover:bg-neutral-50 text-slate-800 text-xs rounded-xl flex items-center justify-between border border-[#E5E5E7] cursor-pointer transition-all"
                    >
                      <div className="text-left">
                        <strong className="block text-[11px]">Stream Standalone Usage Packets</strong>
                        <span className="text-[9px] text-[#6E6E73]">Generate bulk inbound system telemetry</span>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-stone-400" />
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-200/50 flex items-center justify-between">
                  <span className="text-[9px] text-[#6E6E73] font-medium leading-none">Need historic ledger import?</span>
                  <button
                    onClick={handleImportHistoricStream}
                    className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5"
                    id="btn-import-stream"
                  >
                    Run Backfill Import (.CSV)
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* PANEL 2: INTEGRATED SAAS EVENT EXPLORER */}
      {activeSubTab === "explorer" && (
        <div className="space-y-4 text-left">
          
          {/* Filters shelf */}
          <div className="bg-white border border-[#E5E5E7] rounded-xl p-3.5 flex flex-col md:flex-row gap-4 justify-between items-center text-xs">
            
            {/* Left search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#86868B]" />
              <input
                id="explorer-search"
                type="text"
                placeholder="Search event ID or transaction metadata..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.8 bg-[#FAFAFA] border border-[#E5E5E7] rounded-lg outline-none text-xs focus:border-neutral-500 text-neutral-800"
              />
            </div>

            {/* Middle Filters */}
            <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
              <div>
                <label className="text-[9px] text-[#6E6E73] uppercase tracking-wider font-bold block mb-1">Filter Meter</label>
                <select
                  id="explorer-filter-meter"
                  value={filterMeter}
                  onChange={(e) => setFilterMeter(e.target.value)}
                  className="bg-white border border-[#E5E5E7] text-[11px] p-1.5 rounded-lg font-medium outline-none text-[#111111]"
                >
                  <option value="all">All Active Meters</option>
                  {meters.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] text-[#6E6E73] uppercase tracking-wider font-bold block mb-1">Filter Customer ID</label>
                <select
                  id="explorer-filter-cust"
                  value={filterCustomer}
                  onChange={(e) => setFilterCustomer(e.target.value)}
                  className="bg-white border border-[#E5E5E7] text-[11px] p-1.5 rounded-lg font-medium outline-none text-[#111111]"
                >
                  <option value="all">All SaaS Customers</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Reset */}
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterMeter("all");
                setFilterCustomer("all");
              }}
              className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-stone-700 font-bold rounded-lg shrink-0 cursor-pointer self-stretch md:self-auto flex items-center justify-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Clear Filters
            </button>
          </div>

          {/* Event Ingestion History Table Ledger (Stripe Style) */}
          <div className="bg-white border border-[#E5E5E7] rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 bg-[#FAFAFA] border-b border-neutral-100 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold text-[#111111]">Active Ingest Event Queue Explorer</h3>
                <p className="text-[10px] text-[#6E6E73] mt-0.5">Showing {filteredTimelineEvents.length} events processed to local ledger.</p>
              </div>
              <span className="text-[9px] font-mono text-[#6E6E73] bg-neutral-100 rounded px-2 py-0.5">
                FIFO Sequence Order
              </span>
            </div>

            {filteredTimelineEvents.length === 0 ? (
              <div className="p-16 text-center text-xs text-neutral-400 font-medium whitespace-normal">
                No telemetry packet transactions match the filter coordinates inside this Tenant.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {filteredTimelineEvents.map((evt) => {
                  const custObj = customers.find(c => c.id === evt.customerId);
                  const isExpanded = expandedEventId === evt.id;
                  
                  // Simulate pipeline stages based on timestamp
                  const statusColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                  const statusText = evt.metadata?.imported ? "IMPORTED" : "INGESTED";

                  return (
                    <div key={evt.id} className="hover:bg-neutral-50/50 transition-colors">
                      <div 
                        onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                        className="flex flex-col md:flex-row md:items-center justify-between p-3.5 cursor-pointer text-xs gap-3"
                      >
                        {/* Event Name & Metadata tag */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                          <div className="text-left min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <strong className="text-[#111111] font-bold text-xs">
                                {evt.meterId}
                              </strong>
                              <span className="text-[9px] font-mono bg-neutral-100 text-[#6E6E73] px-1.5 py-0.5 rounded">
                                {evt.id}
                              </span>
                            </div>
                            <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                              Customer: <strong className="text-[#111111]">{custObj ? custObj.name : evt.customerId}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Pipeline Telemetry value & status badges */}
                        <div className="flex items-center gap-4.5 justify-between md:justify-end shrink-0 text-right">
                          <div>
                            <span className="text-xs font-bold text-[#111111] tabular-nums font-mono block">
                              +{evt.value.toLocaleString()} {evt.meterId.includes("compute") ? "credits" : "units"}
                            </span>
                            <span className="text-[9px] text-[#6E6E73] block font-mono mt-0.5">
                              {new Date(evt.timestamp).toLocaleTimeString()}
                            </span>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${statusColor}`}>
                            {statusText}
                          </span>
                        </div>
                      </div>

                      {/* Detail json and replay trigger */}
                      {isExpanded && (
                        <div className="p-4 border-t border-neutral-100 bg-[#FAFAFA] text-[11px] space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            
                            {/* Raw Data */}
                            <div className="md:col-span-8 space-y-1">
                              <span className="text-[9.5px] font-bold text-neutral-400 uppercase tracking-wider block">Raw Event JSON Payload</span>
                              <pre className="p-3 bg-neutral-900 text-emerald-400 font-mono text-[10px] leading-relaxed rounded-xl overflow-x-auto select-all max-h-40">
                                {JSON.stringify(evt, null, 2)}
                              </pre>
                            </div>

                            {/* Processing parameters metadata */}
                            <div className="md:col-span-4 bg-white border border-neutral-150 rounded-xl p-3.5 space-y-2.5">
                              <span className="text-[9.5px] font-bold text-neutral-400 uppercase tracking-wider block">Operational Trace</span>
                              
                              <div className="space-y-1.5 leading-none">
                                <div className="flex justify-between border-b pb-1">
                                  <span className="text-stone-500">Workspace Tenant</span>
                                  <span className="font-bold text-stone-800 font-mono">active_org</span>
                                </div>
                                <div className="flex justify-between border-b pb-1">
                                  <span className="text-stone-500">Idempotency dedupe</span>
                                  <span className="font-semibold text-emerald-600 font-mono">COMPLIANT</span>
                                </div>
                                <div className="flex justify-between border-b pb-1">
                                  <span className="text-stone-500">Schema aggregate</span>
                                  <span className="font-mono text-stone-700">hourly/daily</span>
                                </div>
                              </div>

                              <button
                                onClick={() => handleReplayEvent(evt.id)}
                                disabled={replayingEventId === evt.id}
                                className="w-full py-1 bg-neutral-100 hover:bg-neutral-200 text-stone-700 font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1 text-[10.5px]"
                              >
                                <Undo className="h-3 w-3" />
                                {replayingEventId === evt.id ? "Recalculating..." : "Replay Ingestion Path"}
                              </button>
                            </div>

                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* PANEL 3: IMMUTABLE CREDIT LEDGER, QUOTA DEFINITIONS & GATE CHECKS */}
      {activeSubTab === "ledger" && (
        <div className="space-y-6 text-left">
          
          {/* Top row: Live enforcement gate simulation + assignment blocks */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Interactive limits Gate (canConsume) (5 cols) */}
            <div className="lg:col-span-5 bg-black text-neutral-200 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-xl">
              
              {/* Star details */}
              <div className="absolute top-4 right-4 text-[9px] text-[#86868B] font-mono flex items-center gap-1">
                <Network className="h-3.5 w-3.5 text-neutral-500" />
                Live canConsume() API Gate
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block mb-1">
                    Edge Gatekeeper Agent
                  </span>
                  <h3 className="text-sm font-semibold text-white">Interactive Limits & Quotas Enforcement Checker</h3>
                  <p className="text-[10px] text-neutral-400 mt-1 leading-normal">
                    Firms request access checks prior to executing user code blocks. Run the gate to evaluate real allowance.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-[#86868B] uppercase font-bold block mb-1">SaaS Customer</label>
                      <select
                        id="limit-gate-cust"
                        value={limitCheckCust}
                        onChange={(e) => setLimitCheckCust(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 text-[11px] rounded-lg p-2 text-white font-semibold outline-none focus:border-neutral-600"
                      >
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] text-[#86868B] uppercase font-bold block mb-1">Feature Meter</label>
                      <select
                        id="limit-gate-meter"
                        value={limitCheckMeter}
                        onChange={(e) => setLimitCheckMeter(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 text-[11px] rounded-lg p-2 text-white font-semibold outline-none focus:border-neutral-600"
                      >
                        {meters.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] text-[#86868B] uppercase font-bold block mb-1">Requested consumption amount</label>
                    <div className="flex gap-2">
                      <input
                        id="limit-gate-amt"
                        type="number"
                        value={limitCheckAmount}
                        onChange={(e) => setLimitCheckAmount(Number(e.target.value))}
                        className="w-24 bg-neutral-900 border border-neutral-800 text-xs rounded-lg p-1.5 text-white font-mono"
                      />
                      <button
                        onClick={handleCheckLimit}
                        disabled={isCheckingConsume}
                        className="flex-1 py-1.5 bg-white hover:bg-neutral-100 text-black font-extrabold text-xs rounded-lg cursor-pointer flex items-center justify-center gap-1 font-sans transition-all"
                        id="btn-gate-check"
                      >
                        <Zap className="h-3.5 w-3.5 fill-black shrink-0" />
                        {isCheckingConsume ? "Evaluating..." : "Check canConsume()"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Check result card visual */}
              <div className="mt-5 border-t border-neutral-800/80 pt-4">
                {canConsumeResult ? (
                  <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${canConsumeResult.allowed ? "bg-neutral-900 border-neutral-800 text-neutral-100" : "bg-neutral-950 border-neutral-800 text-neutral-300"}`}>
                    <div className="mt-0.5 shrink-0">
                      {canConsumeResult.allowed ? (
                        <CheckCircle2 className="h-4.5 w-4.5 text-neutral-400" />
                      ) : (
                        <AlertTriangle className="h-4.5 w-4.5 text-neutral-400 animate-bounce" />
                      )}
                    </div>
                    <div className="text-left text-[11px] leading-normal">
                      <strong className="block font-bold">
                        {canConsumeResult.allowed ? "200 ALLOWED" : "403 BLOCKED - QUOTA EXCEEDED"}
                      </strong>
                      <p className="text-[10px] text-neutral-300 mt-0.5">
                        Code: {canConsumeResult.reason}. 
                        Quota: {canConsumeResult.details?.currentUsed?.toLocaleString()} / {canConsumeResult.details?.limitValue?.toLocaleString()} used.
                        Credit ledger offset balance: {canConsumeResult.details?.creditBalance?.toLocaleString()} USD balance.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 border border-dashed border-neutral-800 rounded-xl text-center text-xs text-neutral-500 font-mono py-6 font-semibold">
                    Console ready for gate calculation.
                  </div>
                )}
              </div>

            </div>

            {/* Forms to add Quota / Credit dynamically (7 cols) */}
            <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              
              {/* assign quota form */}
              <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl flex flex-col justify-between">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#111111] flex items-center gap-1.5 uppercase tracking-wide leading-none">
                    <Sliders className="h-4.5 w-4.5 text-[#0071E3]" />
                    Issue Quota Bounds
                  </h4>
                  <p className="text-[10px] text-[#6E6E73] leading-normal">
                    Set a hard cap limit for specific meters inside customer operational accounts. Gating begins as soon as bounds are crossed.
                  </p>

                  <div className="space-y-2 text-xs">
                    <div>
                      <select
                        id="quota-form-cust"
                        value={quotaCust}
                        onChange={(e) => setQuotaCust(e.target.value)}
                        className="w-full text-xs font-semibold border border-[#E5E5E7] rounded-lg p-2 bg-[#FAFAFA]"
                      >
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        id="quota-form-meter"
                        value={quotaMeter}
                        onChange={(e) => setQuotaMeter(e.target.value)}
                        className="w-full text-xs font-semibold border border-[#E5E5E7] rounded-lg p-2 bg-[#FAFAFA]"
                      >
                        {meters.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <input
                          id="quota-form-val"
                          type="number"
                          placeholder="Limit (e.g. 50000)"
                          value={quotaAmount}
                          onChange={(e) => setQuotaAmount(Number(e.target.value))}
                          className="w-full text-xs border border-[#E5E5E7] rounded-lg p-1.5 bg-white"
                        />
                      </div>
                      <div>
                        <select
                          id="quota-form-period"
                          value={quotaPeriod}
                          onChange={(e) => setQuotaPeriod(e.target.value as any)}
                          className="w-full text-xs border border-[#E5E5E7] rounded-lg p-1.5 bg-white"
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                          <option value="unlimited">Unlimited</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100 mt-4 text-xs">
                  <button
                    onClick={handleAssignQuota}
                    className="w-full py-1.5 bg-[#111111] hover:bg-[#1D1D1F] text-white font-bold rounded-lg cursor-pointer text-center text-[11px]"
                    id="btn-assign-quota"
                  >
                    Set Enforceable Quota Limit
                  </button>
                </div>
              </div>

              {/* issue credit ledger entry */}
              <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl flex flex-col justify-between">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#111111] flex items-center gap-1.5 uppercase tracking-wide leading-none">
                    <Coins className="h-4.5 w-4.5 text-stone-700" />
                    IMMUTABLE CREDIT ENTRY
                  </h4>
                  <p className="text-[10px] text-[#6E6E73] leading-normal">
                    Log double-entry ledger entries rather than static values. Supports issues, drawdowns, and promotional credit expirations.
                  </p>

                  <div className="space-y-2 text-xs">
                    <div>
                      <select
                        id="credit-form-cust"
                        value={creditCust}
                        onChange={(e) => setCreditCust(e.target.value)}
                        className="w-full text-xs font-semibold border border-[#E5E5E7] rounded-lg p-2 bg-[#FAFAFA]"
                      >
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <input
                          id="credit-form-val"
                          type="number"
                          placeholder="USD Credit Amount"
                          value={creditAmount}
                          onChange={(e) => setCreditAmount(Number(e.target.value))}
                          className="w-full text-xs border border-[#E5E5E7] rounded-lg p-1.5"
                        />
                      </div>
                      <div>
                        <select
                          id="credit-form-type"
                          value={creditType}
                          onChange={(e) => setCreditType(e.target.value as any)}
                          className="w-full text-xs border border-[#E5E5E7] rounded-lg p-1.5"
                        >
                          <option value="credit_issued">Credit Issued (+)</option>
                          <option value="credit_consumed">Overage Debit (-)</option>
                          <option value="credit_reversed">Reversal Adjustment</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <input
                        id="credit-form-desc"
                        type="text"
                        placeholder="Description (e.g. SOC2 SLA compensation)"
                        value={creditDesc}
                        onChange={(e) => setCreditDesc(e.target.value)}
                        className="w-full text-xs border border-[#E5E5E7] rounded-lg p-1.5 bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100 mt-4 text-xs">
                  <button
                    onClick={handleIssueCredit}
                    disabled={!creditDesc}
                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-lg cursor-pointer text-center text-[11px] disabled:bg-stone-100 disabled:text-stone-400"
                    id="btn-issue-credit"
                  >
                    Commit Ledger Transaction
                  </button>
                </div>
              </div>

            </div>

          </div>

          {/* Bottom lists: Active Quotas limits and transaction ledger double columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            
            {/* Active configured quotas limit list */}
            <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center pb-3 border-b mb-3.5">
                <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wide">Active Assigned Quotas (Limits)</h4>
                <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                  {quotas.length} Assignments
                </span>
              </div>

              {quotas.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-400 italic">
                  No limits configured inside DB registry yet. Define one above.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {quotas.map((q) => {
                    const c = customers.find(cust => cust.id === q.customerId);
                    const usagePercent = Math.min(100, Math.floor((q.usedValue / q.limitValue) * 100));
                    
                    return (
                      <div key={q.id} className="text-xs border border-[#E5E5E7] p-3 rounded-xl bg-[#FAFAFA]/50 space-y-2">
                        <div className="flex justify-between items-start leading-none">
                          <div>
                            <strong className="text-[#111111] font-bold block">{c ? c.name : q.customerId}</strong>
                            <span className="text-[10px] font-mono text-neutral-500 block mt-1">Meter: {q.meterId}</span>
                          </div>
                          
                          <div className="text-right leading-none">
                            <span className="text-stone-850 font-bold block font-mono">
                              {q.usedValue?.toLocaleString()} / {q.limitValue?.toLocaleString()}
                            </span>
                            <span className="text-[9px] text-stone-500 block mt-1 uppercase tracking-wider font-mono">
                              Period: {q.period}
                            </span>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="space-y-1 pt-1">
                          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200/50">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-amber-500" : "bg-neutral-900"}`} 
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[8px] text-stone-500 font-semibold uppercase leading-none">
                            <span>Consumed: {usagePercent}%</span>
                            <span>Remaining: {(q.limitValue - q.usedValue)?.toLocaleString()}</span>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Immutable double entry transaction ledger stream */}
            <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center pb-3 border-b mb-3.5">
                <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wide">Immutable Credits transaction Ledger</h4>
                <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                  Double-Entry
                </span>
              </div>

              {creditLedger.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-400 italic">
                  Immutable credit log is empty inside organizational database.
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {creditLedger.map((entry) => {
                    const c = customers.find(cust => cust.id === entry.customerId);
                    const isCredit = entry.amount >= 0;
                    
                    return (
                      <div key={entry.id} className="flex justify-between items-center p-2.5 rounded-xl border border-neutral-100 bg-[#FAFAFA] text-xs">
                        <div className="text-left leading-none">
                          <strong className="block text-stone-900">{c ? c.name : entry.customerId}</strong>
                          <span className="text-[10px] text-[#6E6E73] block mt-1 font-semibold">{entry.description}</span>
                          <span className="text-[8px] text-stone-400 font-mono block mt-1 uppercase tracking-wider">
                            #{entry.id} • {new Date(entry.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <span className={`font-mono font-extrabold text-[12px] shrink-0 ${isCredit ? "text-emerald-600" : "text-stone-550"}`}>
                          {isCredit ? `+$${entry.amount.toLocaleString()}` : `-$${Math.abs(entry.amount).toLocaleString()}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* PANEL 4: CUSTOMER METERING PORTAL */}
      {activeSubTab === "portal" && (
        <div className="space-y-6 text-left">
          
          {/* Top customer selection dropdown */}
          <div className="bg-white border border-[#E5E5E7] rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center text-xs">
            <div className="flex items-center gap-2.5">
              <div className="h-6.5 w-6.5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <User className="h-3.5 w-3.5" />
              </div>
              <div>
                <h4 className="font-semibold text-neutral-900">Corporate Customer Portal Dashboard view</h4>
                <p className="text-[10px] text-neutral-500">Select simulated tenant member to audit client-facing consumption widgets.</p>
              </div>
            </div>

            <select
              id="portal-select-customer"
              value={portalCustomerId}
              onChange={(e) => setPortalCustomerId(e.target.value)}
              className="bg-neutral-50 border border-[#E5E5E7] rounded-lg p-2 font-bold text-xs outline-none text-[#111111]"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
              ))}
            </select>
          </div>

          {selectedPortalCustomerObj ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Account Summary (4 cols) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl space-y-4 shadow-sm">
                  
                  {/* Account Logo banner */}
                  <div className="flex items-center gap-3">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-sm border shadow-sm ${selectedPortalCustomerObj.logoColor}`}>
                      {selectedPortalCustomerObj.name.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-neutral-950 mb-0.5">{selectedPortalCustomerObj.name}</h3>
                      <span className="text-[10px] text-[#0071E3] font-semibold bg-blue-50 px-2 py-0.5 rounded">
                        Active Sub: {selectedPortalCustomerObj.planId.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <hr className="border-neutral-100" />

                  {/* Visual parameters balances */}
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between leading-none">
                      <span className="text-stone-500 font-medium">Domain identifier</span>
                      <strong className="text-stone-900">{selectedPortalCustomerObj.domain}</strong>
                    </div>

                    <div className="flex justify-between leading-none">
                      <span className="text-stone-500 font-medium">Active Credit Balance</span>
                      <strong className="text-emerald-600 font-mono font-bold text-sm">
                        ${portalCustCredits.toLocaleString()} USD
                      </strong>
                    </div>

                    <div className="flex justify-between leading-none">
                      <span className="text-stone-500 font-medium">Auto-Ingestion Logs count</span>
                      <strong className="text-neutral-800 font-mono">{portalCustEvents.length} transactions</strong>
                    </div>

                    <div className="flex justify-between items-center leading-none">
                      <span className="text-stone-500 font-medium">SOC2 Security audit</span>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-0.5">
                        <ShieldCheck className="h-3 w-3" /> VERIFIED
                      </span>
                    </div>
                  </div>

                </div>

                {/* Micro-billing active ledger list */}
                <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl shadow-sm text-xs">
                  <h4 className="font-bold text-[#111111] uppercase tracking-wider text-[10px] pb-2 border-b mb-3">Client Audit Transactions Feed</h4>
                  
                  {portalCustEvents.length === 0 ? (
                    <p className="text-stone-400 italic text-center py-6 text-[10px]">No events registered to customer account.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-[160px] overflow-y-auto">
                      {portalCustEvents.slice(0, 4).map((evt) => (
                        <div key={evt.id} className="flex justify-between text-[11px] pb-1.5 last:pb-0 border-b last:border-0 border-neutral-100/50">
                          <div className="text-left">
                            <strong className="block text-stone-800">{evt.meterId}</strong>
                            <span className="text-[9px] font-mono text-neutral-400">id: {evt.id}</span>
                          </div>
                          <span className="font-mono font-bold font-stone-900 shrink-0">+{evt.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Quota Meters dashboard (8 cols) */}
              <div className="lg:col-span-8 bg-white border border-[#E5E5E7] p-6 rounded-2xl shadow-sm space-y-6">
                
                <div>
                  <h3 className="font-bold text-[#111111] text-sm">Customer Enforceable Quotas limits</h3>
                  <p className="text-[11px] text-[#6E6E73] mt-0.5">Live developer metrics allocated during subscriber billing cycles.</p>
                </div>

                {portalCustQuotas.length === 0 ? (
                  <div className="p-12 text-center border border-dashed rounded-xl bg-neutral-50/50 text-stone-500 font-mono text-xs font-semibold whitespace-normal">
                    No explicit billing quotas assigned. Unlimited usage fallback initialized.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {portalCustQuotas.map((q) => {
                      const m = meters.find(met => met.id === q.meterId);
                      const usagePercent = Math.min(100, Math.floor((q.usedValue / q.limitValue) * 100));

                      return (
                        <div key={q.id} className="border border-neutral-200 rounded-xl p-4 space-y-4 hover:border-black transition-all bg-[#FAFAFA]/40">
                          
                          {/* Meter context header */}
                          <div className="flex justify-between leading-none items-start">
                            <div>
                              <strong className="text-xs text-stone-900 block font-bold">{m ? m.name : q.meterId}</strong>
                              <span className="text-[9.5px] text-stone-400 font-mono block mt-1">Aggregated as: {m?.aggregationType.toUpperCase() || "SUM"}</span>
                            </div>

                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${usagePercent > 90 ? "bg-red-50 text-red-700" : "bg-neutral-900 text-white"}`}>
                              {usagePercent}% Used
                            </span>
                          </div>

                          {/* Progress */}
                          <div className="space-y-1">
                            <div className="h-2.5 w-full bg-neutral-100 rounded-full overflow-hidden border">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-amber-500" : "bg-neutral-900"}`} 
                                style={{ width: `${usagePercent}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] text-[#6E6E73] font-semibold">
                              <span>Used: {q.usedValue?.toLocaleString()}</span>
                              <span>Allowance Limit: {q.limitValue?.toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="bg-white border rounded-lg p-2 text-[9.5px] leading-tight text-stone-600">
                            {q.usedValue >= q.limitValue ? (
                              <span className="text-rose-700 font-bold flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 inline shrink-0" /> Limit Exceeded. Credit Offset actively applied.
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <Check className="h-3 w-3 inline" /> Safe limit allowance margins preserved.
                              </span>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

            </div>
          ) : (
            <div className="p-16 text-center text-xs text-neutral-400">
              No SaaS Customer Accounts configured inside active tenancy.
            </div>
          )}

        </div>
      )}

      {/* PANEL 5: ARCHITECTURAL BLUEPRINTS */}
      {activeSubTab === "blueprints" && (
        <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 shadow-sm text-left space-y-6">
          
          <div className="border-b pb-4">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
              PRODUCIBILITY & SYSTEM ARCHITECTURE LAYOUTS
            </span>
            <h3 className="text-sm font-semibold text-[#111111]">Distributed Systems Billing Infra Blueprint Specifications</h3>
            <p className="text-[11px] text-[#6E6E73] mt-0.5 leading-normal">
              High fidelity specifications designed to support millions of customers with trillions of raw transactions without database saturation.
            </p>
          </div>

          {/* Inner blueprint navigator */}
          <div className="flex border-b text-xs pb-3 gap-2">
            <button
              onClick={() => setBlueprintInnerTab("sql")}
              className={`pb-1 px-2.5 font-bold transition-all relative ${blueprintInnerTab === "sql" ? "text-black border-b-2 border-black" : "text-[#6E6E73] hover:text-black"}`}
            >
              1. DB Physical Schema
            </button>
            <button
              onClick={() => setBlueprintInnerTab("pipeline")}
              className={`pb-1 px-2.5 font-bold transition-all relative ${blueprintInnerTab === "pipeline" ? "text-black border-b-2 border-black" : "text-[#6E6E73] hover:text-black"}`}
            >
              2. Distributed Ingestion Pipe
            </button>
            <button
              onClick={() => setBlueprintInnerTab("sdk")}
              className={`pb-1 px-2.5 font-bold transition-all relative ${blueprintInnerTab === "sdk" ? "text-black border-b-2 border-black" : "text-[#6E6E73] hover:text-black"}`}
            >
              3. REST SDK interfaces
            </button>
            <button
              onClick={() => setBlueprintInnerTab("scale")}
              className={`pb-1 px-2.5 font-bold transition-all relative ${blueprintInnerTab === "scale" ? "text-black border-b-2 border-black" : "text-[#6E6E73] hover:text-black"}`}
            >
              4. Partitioning & Scale Strategy
            </button>
          </div>

          {blueprintInnerTab === "sql" && (
            <div className="space-y-4 font-mono text-[11px]">
              <div className="bg-[#FAFAFA] border rounded-xl p-4 text-stone-700 space-y-4">
                
                <div>
                  <h4 className="font-sans font-bold text-xs text-[#111111] mb-1">PostgreSQL relational physical schemas & indexes</h4>
                  <p className="font-sans text-[10px] text-[#6E6E73] leading-normal">Immutable and event sourced tables. Standardized double entry ledger rules prevent float computation drift.</p>
                </div>

                <div className="space-y-3">
                  {/* Table 1: Raw Events */}
                  <div className="p-3 bg-neutral-900 text-neutral-300 rounded-lg">
                    <strong className="text-blue-400 block mb-1">-- Raw Telemetry Events Table (Billions of rows partition)</strong>
                    <pre className="text-[9.5px] leading-relaxed text-left text-neutral-300">{`CREATE TABLE usage_events (
  id VARCHAR(50) PRIMARY KEY,
  customer_id VARCHAR(50) NOT NULL REFERENCES customers(id),
  meter_id VARCHAR(50) NOT NULL REFERENCES meters(id),
  timestamp TIMESTAMPTZ NOT NULL,
  value NUMERIC(18, 4) NOT NULL DEFAULT 1.0,
  dedupe_key VARCHAR(100) UNIQUE,
  metadata JSONB
) PARTITION BY RANGE (timestamp);

CREATE INDEX idx_events_tenant_meter ON usage_events (customer_id, meter_id, timestamp DESC);`}
                    </pre>
                  </div>

                  {/* Table 2: Immutable Ledgers */}
                  <div className="p-3 bg-neutral-900 text-neutral-300 rounded-lg">
                    <strong className="text-amber-400 block mb-1">-- Credit Ledger Table (Immutable Double Entry logs)</strong>
                    <pre className="text-[9.5px] leading-relaxed text-left text-neutral-300">{`CREATE TABLE credit_ledger (
  id VARCHAR(50) PRIMARY KEY,
  customer_id VARCHAR(50) NOT NULL REFERENCES customers(id),
  amount NUMERIC(12, 2) NOT NULL, -- Positive for issue, negative for usage
  type VARCHAR(30) NOT NULL CHECK(type IN ('credit_issued', 'credit_consumed', 'credit_expired', 'credit_reversed')),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expire_at TIMESTAMPTZ
);

CREATE INDEX idx_credits_cust ON credit_ledger (customer_id, created_at DESC) WHERE type = 'credit_issued';`}
                    </pre>
                  </div>
                </div>

              </div>
            </div>
          )}

          {blueprintInnerTab === "pipeline" && (
            <div className="space-y-4 text-xs font-sans text-[#111111]">
              <div className="bg-[#FAF9F6] border border-[#E5E5E7] rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-4">
                
                <div className="md:col-span-2 border border-dashed rounded-lg p-3 space-y-1.5 bg-white text-left">
                  <span className="text-[8.5px] font-mono text-stone-400 font-bold tracking-wider block">STAGE 1: ENTRANCE GATES</span>
                  <strong className="font-bold text-xs">NGINX / Redis Gateway</strong>
                  <p className="text-[10px] text-[#6E6E73] leading-tight">Authenticates header keys, parses signature packets, and rate-limits rogue microservices instantly.</p>
                </div>

                <div className="md:col-span-2 border border-dashed rounded-lg p-3 space-y-1.5 bg-white text-left">
                  <span className="text-[8.5px] font-mono text-stone-400 font-bold tracking-wider block">STAGE 2: DUPLICATION FILTER</span>
                  <strong className="font-bold text-xs">Redis Cluster Dedupe Cache</strong>
                  <p className="text-[10px] text-[#6E6E73] leading-tight">Caches deduplication keys with a 7-day TTL check. Ensures at-least-once deliveries don't double charge clients.</p>
                </div>

                <div className="md:col-span-2 border border-dashed rounded-lg p-3 space-y-1.5 bg-white text-left">
                  <span className="text-[8.5px] font-mono text-stone-400 font-bold tracking-wider block">STAGE 3: BUFFERS & INGEST</span>
                  <strong className="font-bold text-xs">Kafka Stream Nodes</strong>
                  <p className="text-[10px] text-[#6E6E73] leading-tight">Buffers input streams at high velocity (up to 1,000,000 requests/sec). Distributes load to background consumer loops.</p>
                </div>

                <div className="md:col-span-3 border border-dashed rounded-lg p-3 space-y-1.5 bg-white text-left">
                  <span className="text-[8.5px] font-mono text-stone-400 font-bold tracking-wider block">STAGE 4: MATERIALIZED AGGREGATIONS</span>
                  <strong className="font-bold text-xs">ClickHouse / TimescaleDB Consumers</strong>
                  <p className="text-[10px] text-[#6E6E73] leading-tight">Background consumer loops aggregate metrics into hourly, daily, and monthly tables. Queries access summarized records, avoiding heavy recalculations of billions of rows.</p>
                </div>

                <div className="md:col-span-3 border border-dashed rounded-lg p-3 space-y-1.5 bg-white text-left">
                  <span className="text-[8.5px] font-mono text-stone-400 font-bold tracking-wider block">STAGE 5: REAL-TIME ENFORCEMENT</span>
                  <strong className="font-bold text-xs">Quota Enforcement Engine</strong>
                  <p className="text-[10px] text-[#6E6E73] leading-tight">Pushes calculated usage limits down to HTTP API gates on developer routers. Block metrics or reject calls the minute quotas are violated.</p>
                </div>

              </div>
            </div>
          )}

          {blueprintInnerTab === "sdk" && (
            <div className="space-y-4 font-mono text-[11px]">
              <div className="bg-neutral-900 border text-white p-4.5 rounded-xl space-y-3">
                <span className="text-[9px] font-bold text-stone-400">Official Node.js / TypeScript SDK integration structure</span>
                
                <pre className="text-[9.5px] leading-relaxed text-[#34C759] select-all">
{`import { BillingClient } from "@aora/billing-node";

// 1. Initialise multi-tenant secure client-side proxy
const billing = new BillingClient({
  secretKey: process.env.AORA_SECRET_KEY, // sk_live_aora_...
  workspaceId: "ws_aora",
  timeoutMs: 1500
});

// 2. Stream custom events down the high throughput gateway
await billing.events.track({
  customerId: "linear",
  eventSource: "api_trigger",
  value: 120,
  metadata: { origin: "salesforce_sync" }
});

// 3. Evaluate allowance Gate before running premium operations
const gate = await billing.quotas.canConsume({
  customerId: "linear",
  meterId: "api_meter",
  amount: 1
});

if (!gate.allowed) {
  throw new Error("Quota threshold crossed: " + gate.reason);
}`}
                </pre>
              </div>
            </div>
          )}

          {blueprintInnerTab === "scale" && (
            <div className="text-xs leading-relaxed space-y-4 text-stone-700">
              <div className="bg-[#FAF9F6] border border-[#E5E5E7] p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-2 text-left">
                  <h4 className="font-sans font-bold text-xs text-[#111111] flex items-center gap-1">
                    <Database className="h-4 w-4 text-stone-700" />
                    Billions scale partition strategies
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-[10.5px] leading-normal font-medium">
                    <li><strong>Time-range partitioning</strong>: Event tables are split by week (e.g. `events_y2026_w24`) allowing instant truncation of deprecated raw data logs without locking primary databases.</li>
                    <li><strong>Space partitioning by Tenant ID</strong>: Isolates workspace queries down dedicated indexes, avoiding slow broad-table searches.</li>
                    <li><strong>Cold storage offloads</strong>: Raw JSON entries older than 45 days are compressed and archived to cloud object buckets (e.g. AWS S3, GCS) for historic compliance replays.</li>
                  </ul>
                </div>

                <div className="space-y-2 text-left">
                  <h4 className="font-sans font-bold text-xs text-[#111111] flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4 text-stone-700" />
                    Security & SOC2 Isolation Guards
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-[10.5px] leading-normal font-medium">
                    <li><strong>Workspace Context Enforcement</strong>: Row Level Security (RLS) is applied at the database level, preventing any organization from querying adjacent workspace metrics.</li>
                    <li><strong>Idempotency hashing</strong>: Cryptographic checksum keys (`SHA-256` of customer_id + timestamp + dedupe_key) run on incoming buffers to prevent duplicate network payloads.</li>
                    <li><strong>Secure signed request headers</strong>: Secret JWT keys authenticate SDK integrations securely server-side.</li>
                  </ul>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
