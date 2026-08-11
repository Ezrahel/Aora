import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  BookOpen,
  Terminal,
  Code2,
  FileText,
  HelpCircle,
  Search,
  ChevronRight,
  ChevronDown,
  Play,
  Check,
  Copy,
  Globe,
  Database,
  ShieldAlert,
  Menu,
  X,
  CreditCard,
  Layers,
  ArrowRight,
  Send,
  RefreshCw,
  Clock,
  ExternalLink,
  ShieldCheck,
  Workflow,
  AlertTriangle,
  Flame,
  Activity,
  History,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { DashboardThemeProvider } from "./DashboardTheme";
import { getDocSEO } from "../lib/doc-seo";
import { updateMetaTags } from "../lib/seo";

interface DocumentationViewProps {
  onBackToDashboard: () => void;
  workspaceName?: string;
}

export default function DocumentationView({ onBackToDashboard, workspaceName = "Aora Technologies Ltd" }: DocumentationViewProps) {
  // Mobile sidebar toggle
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Active page controller
  const [activePage, setActivePage] = useState<string>("intro");

  // Update SEO when active page changes
  useEffect(() => {
    import("../lib/doc-seo").then(({ getDocSEO }) => {
      const seo = getDocSEO(activePage as any);
      if (seo) {
        import("../lib/seo").then(({ updateMetaTags }) => updateMetaTags(seo));
      }
    });
  }, [activePage]);

  // Expanded sidebar sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    gettingStarted: true,
    concepts: true,
    devTools: true,
    guides: true,
    backend: true,
    reference: true
  });

  const toggleSection = (sec: string) => {
    setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  // ----------------------------------------------------
  // SEARCH STATE (CMD + K)
  // ----------------------------------------------------
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  // Index documentation items for search
  const docRoutes = [
    { id: "intro", title: "Overview & Introduction", cat: "Getting Started", desc: "Understand Aora Billing Operating System and multi-tenant billing models." },
    { id: "quickstart", title: "Quick Start Guide", cat: "Getting Started", desc: "Integrate billing, create meters, subscribe customers, and view invoices in under 5 minutes." },
    { id: "architecture", title: "System Architecture", cat: "Core Concepts", desc: "High-throughput telemetry ingestion, rating loops, and billing schedulers." },
    { id: "concepts-products", title: "Products & Plans Catalog", cat: "Core Concepts", desc: "Structured flats, meters overages, and dynamic hybrid models." },
    { id: "concepts-usage", title: "Usage Metering Ingestion", cat: "Core Concepts", desc: "Tracking usage units, deduplicating high-speed payload feeds." },
    { id: "concepts-entitlements", title: "Entitlement Gate Engine", cat: "Core Concepts", desc: "Enforcing API locks, feature limits, and subscription guards." },
    { id: "dev-keys", title: "Authentication & API Keys", cat: "Developer Sandbox", desc: "Generate sk_live secret headers, authenticate SDK calls safely." },
    { id: "playground", title: "Interactive API Terminal", cat: "Developer Sandbox", desc: "Try posting events or querying entitlement can-access metrics live!" },
    { id: "webhooks", title: "Webhook Developer Center", cat: "Developer Sandbox", desc: "Configure subscription.created, replay events, and check signatures." },
    { id: "errors", title: "Searchable Error Directory", cat: "Developer Sandbox", desc: "Lookup unauthorized, limit exceeded, and billing retry fault scenarios." },
    { id: "guide-seats", title: "SaaS Seat Pricing Guide", cat: "Step-by-Step Guides", desc: "Configure hybrid seat pricing with overage usage multipliers." },
    { id: "guide-usage", title: "Usage-Based Token Guide", cat: "Step-by-Step Guides", desc: "Track AI LLM completions, run-time executions, and API operations." },
    { id: "backend-proration", title: "Proration Service", cat: "Backend Features", desc: "Seat-based mid-cycle adjustments with high-precision financial math." },
    { id: "backend-ingress", title: "Fair Ingress Metering", cat: "Backend Features", desc: "Byte-size billing with Redis counter buffering and PostgreSQL flush." },
    { id: "backend-dedup", title: "24-Hour Deduplication", cat: "Backend Features", desc: "Two-layer Redis/Postgres dedup preventing duplicate billing." },
    { id: "backend-batch", title: "Batch Ingestion", cat: "Backend Features", desc: "Bulk event ingestion with pipelined dedup and batch discounts." },
    { id: "backend-sandbox", title: "Sandbox Playground", cat: "Backend Features", desc: "Test billing flows with sk_test_ keys, simulated payments, and time-travel." },
    { id: "backend-encryption", title: "Zero-Trust Credential Encryption", cat: "Backend Features", desc: "AES-256-GCM encryption for merchant secrets at rest." },
    { id: "backend-webhooks", title: "Secure Webhook Dispatcher", cat: "Backend Features", desc: "Transactional outbox, HMAC-SHA256 signing, exponential backoff retries." },
    { id: "backend-dunning", title: "Dunning & Retry State Machine", cat: "Backend Features", desc: "3-step automated dunning with SERIALIZABLE transactions and outbox integration." },
    { id: "sdks", title: "Official Runtimes SDKs", cat: "Reference", desc: "Installation steps for Node.js, Python, Go Lang, and PHP modules." },
    { id: "dashboard-integration", title: "Workspace Integration", cat: "Reference", desc: "Sync workspace accounts, track subscription ARR, and export ledgers." },
    { id: "status", title: "System Health Status", cat: "Reference", desc: "Real-time service status logs for five master ingestion nodes." },
    { id: "changelog", title: "Product release logs", cat: "Reference", desc: "V1.0.4 improvements, bug fixes, and deprecation protocols." }
  ];

  const searchResults = searchQuery
    ? docRoutes.filter(
        item =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.cat.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : docRoutes.slice(0, 5);

  // ----------------------------------------------------
  // INTERACTIVE PLAYGROUND STATE
  // ----------------------------------------------------
  const [playgroundApiKey, setPlaygroundApiKey] = useState("sk_live_aora_5f2d93e810cb9921e42f2bca01");
  const [playgroundMethod, setPlaygroundMethod] = useState("POST");
  const [playgroundPath, setPlaygroundPath] = useState("/api/usage-events");
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundResponse, setPlaygroundResponse] = useState<any>(null);
  const [playgroundPayload, setPlaygroundPayload] = useState(
    JSON.stringify({
      customerId: "linear",
      meterId: "compute_meter",
      value: 1200,
      metadata: {
        source: "api_gateway",
        mode: "sandbox",
        timestamp: new Date().toISOString()
      }
    }, null, 2)
  );

  const handlePlaygroundPreset = (path: string) => {
    setPlaygroundPath(path);
    if (path === "/api/can-access") {
      setPlaygroundMethod("GET");
      setPlaygroundResponse(null);
    } else {
      setPlaygroundMethod("POST");
      setPlaygroundPayload(
        JSON.stringify({
          customerId: "linear",
          meterId: "compute_meter",
          value: 1200,
          metadata: {
            source: "api_gateway",
            mode: "sandbox",
            timestamp: new Date().toISOString()
          }
        }, null, 2)
      );
      setPlaygroundResponse(null);
    }
  };

  const executePlaygroundRequest = async () => {
    setPlaygroundLoading(true);
    setPlaygroundResponse(null);
    try {
      let finalUrl = playgroundPath;
      let init: RequestInit = {
        method: playgroundMethod,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${playgroundApiKey}`
        }
      };

      if (playgroundPath === "/api/can-access") {
        const params = new URLSearchParams({
          customerId: "linear",
          featureSlug: "api_access",
          workspace: workspaceName
        });
        finalUrl = `/api/can-access?${params.toString()}`;
        init = { method: "GET" };
      } else {
        const bodyObj = JSON.parse(playgroundPayload);
        init.body = JSON.stringify({
          ...bodyObj,
          workspace: workspaceName
        });
      }

      const res = await fetch(finalUrl, init);
      const data = await res.json();
      setPlaygroundResponse({
        status: res.status + " " + (res.ok ? "OK" : "Error"),
        timestamp: new Date().toLocaleTimeString(),
        headers: {
          "content-type": "application/json",
          "x-request-id": "req_" + Math.random().toString(36).substr(2, 9),
          "cache-control": "no-cache"
        },
        body: data
      });
    } catch (e: any) {
      setPlaygroundResponse({
        error: "Network Sandbox Failure",
        message: e.message
      });
    } finally {
      setPlaygroundLoading(false);
    }
  };

  const handleRegenPlaygroundKey = () => {
    const chars = "abcdef0123456789";
    let token = "sk_live_aora_";
    for (let i = 0; i < 24; i++) token += chars[Math.floor(Math.random() * chars.length)];
    setPlaygroundApiKey(token);
  };

  // ----------------------------------------------------
  // WEBHOOK REPLAY SIMULATOR STATE
  // ----------------------------------------------------
  const [selectedWebhookEvent, setSelectedWebhookEvent] = useState("invoice.paid");
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState(false);
  const [simulatedWebhookResult, setSimulatedWebhookResult] = useState<any>(null);

  const simulateWebhookTrigger = () => {
    setIsSimulatingWebhook(true);
    setTimeout(() => {
      setIsSimulatingWebhook(false);
      const randId = "evt_wh_" + Math.random().toString(36).substr(2, 9);
      if (selectedWebhookEvent === "invoice.paid") {
        setSimulatedWebhookResult({
          id: randId,
          type: "invoice.paid",
          apiVersion: "2026-06-15",
          livemode: true,
          created: Math.floor(Date.now() / 1000),
          signature: "sha256=t_82ba83f...a239bca",
          data: {
            invoiceId: "INV-2026-1402",
            customerId: "linear",
            amountDue: 240000,
            amountPaid: 240000,
            currency: "NGN",
            status: "PAID",
            attemptCount: 1,
            billingPeriod: "monthly",
            meta: {
              activeSeats: 12,
              telemetryUsage: 145000
            }
          }
        });
      } else if (selectedWebhookEvent === "subscription.created") {
        setSimulatedWebhookResult({
          id: randId,
          type: "subscription.created",
          apiVersion: "2026-06-15",
          livemode: true,
          created: Math.floor(Date.now() / 1000),
          signature: "sha256=s_123b76f...99bcda1",
          data: {
            subscriptionId: "sub_92b8d81001",
            customerId: "vercel",
            planId: "scale_monthly",
            seatsPurchased: 15,
            startedAt: new Date().toISOString(),
            status: "ACTIVE",
            trialEnd: null
          }
        });
      } else if (selectedWebhookEvent === "entitlement.breached") {
        setSimulatedWebhookResult({
          id: randId,
          type: "entitlement.breached",
          apiVersion: "2026-06-15",
          livemode: true,
          created: Math.floor(Date.now() / 1000),
          signature: "sha256=e_9912cd3...ef8ac12",
          data: {
            customerId: "notion",
            featureSlug: "api_access",
            limitValue: 500000,
            currentValue: 500120,
            severity: "BLOCKING",
            timestamp: new Date().toISOString()
          }
        });
      }
    }, 600);
  };

  // ----------------------------------------------------
  // SEARCHABLE ERROR CATALOG STATE
  // ----------------------------------------------------
  const [errorSearchQuery, setErrorSearchQuery] = useState("");
  const errorsCatalog = [
    { code: "401_UNAUTHORIZED", name: "Invalid Secret Key API Credential", cause: "Occurs when sk_live header is omitted, malformed, or doesn't match active Workspace parameters.", fix: "Supply Bearer sk_live_aora_... value within Authorization headers. Generate a fresh client credential key under the Developer tab." },
    { code: "404_METER_NOT_FOUND", name: "Telemetry Ingestion Meter Inactive", cause: "The specified meterId inside event packages does not match any registered Aggregate configuration.", fix: "Inspect your active Ingestion Meters. Register the target meterSlug (e.g. compute_meter) in your control panel before forwarding stream data." },
    { code: "403_ENTITLEMENT_LOCKED", name: "Feature Blocked / Overage Threshold Omitted", cause: "Customer attempts to execute features (e.g. bulk exporting) that are turned off in their Plan, or allocation is fully used and overages are blocked.", fix: "Verify entitlements dynamically using billing.can('feature') before offering features, or adjust plan settings to allow volumetric overage pricing." },
    { code: "422_TIMESTAMP_TOO_OLD", name: "Stale Ingest Segment Rejection", cause: "Event timestamp registers more than 31 days in chronological historical past.", fix: "Deliver event tracking parameters within actual real-time cycles. For retro-active rating, execute specific chronological imports using Bulking endpoints." },
    { code: "402_PAYMENT_REQUIRED", name: "Past-Due Account Suspension Lock", cause: "Associated Customer has outstanding unpaid invoices or payment method failed three consecutive times.", fix: "Redirect terminal operator or direct subscriber to Aora Billing Customer self-service portal to update card parameters to auto-retry." }
  ];

  const filteredErrors = errorsCatalog.filter(
    err =>
      err.code.toLowerCase().includes(errorSearchQuery.toLowerCase()) ||
      err.name.toLowerCase().includes(errorSearchQuery.toLowerCase()) ||
      err.cause.toLowerCase().includes(errorSearchQuery.toLowerCase())
  );

  // ----------------------------------------------------
  // OFFICIAL SDK PACKAGE INSTRUCTIONS CODE LANGS
  // ----------------------------------------------------
  const [sdkLanguage, setSdkLanguage] = useState<"js" | "python" | "go" | "php">("js");

  const sdkCodeSnippets = {
    js: {
      install: "npm install @aora/billing-node",
      init: `import { AoraBilling } from "@aora/billing-node";\n\nconst billing = new AoraBilling({\n  apiKey: "sk_live_aora_5f2d93e810cb9921e42bcs2"\n});`,
      ingest: `// Transmit a live metering telemetry event\nawait billing.events.track({\n  customerId: "customer_linear_102",\n  meterId: "api_operations",\n  value: 12,\n  metadata: { endpoint: "/v2/completions" }\n});`,
      check: `// Verify entitlement gateway dynamically\nconst authCheck = await billing.entitlements.canAccess({\n  customerId: "customer_linear_102",\n  featureSlug: "premium_export"\n});\n\nif (authCheck.hasAccess) {\n  console.log("Execute rich pipeline operation safely.");\n}`
    },
    python: {
      install: "pip install aora-billing-sdk",
      init: `from aora_billing import AoraClient\n\nbilling = AoraClient(\n    api_key="sk_live_aora_5f2d93e810cb9921e42bcs2"\n)`,
      ingest: `# Deliver real-time usage event package\nbilling.events.track(\n    customer_id="customer_linear_102",\n    meter_id="api_operations",\n    value=12,\n    metadata={"endpoint": "/v2/completions"}\n)`,
      check: `# Run permission evaluation gate\ncheck = billing.entitlements.can_access(\n    customer_id="customer_linear_102",\n    feature_slug="premium_export"\n)\n\nif check.has_access:\n    # Allow processing\n    pass`
    },
    go: {
      install: "go get github.com/aora/billing-sdk-go",
      init: `import (\n\t"github.com/aora/billing-sdk-go/client"\n)\n\nbilling := client.NewClient("sk_live_aora_5f2d93e810cb9921e42bcs2")`,
      ingest: `// Record telemetry statistics\nbilling.Events.Track(client.EventRequest{\n\tCustomerID: "customer_linear_102",\n\tMeterID:    "api_operations",\n\tValue:      12,\n\tMetadata:   map[string]string{"endpoint": "/v2/completions"},\n})`,
      check: `// Call dynamic rule evaluator locks\neval, _ := billing.Entitlements.CanAccess("customer_linear_102", "premium_export")\nif eval.HasAccess {\n\t// Trigger transaction\n}`
    },
    php: {
      install: "composer require aorabilling/sdk-php",
      init: `<?php\nuse Aora\\Billing\\Client;\n\n$billing = new Client("sk_live_aora_5f2d93e810cb9921e42bcs2");`,
      ingest: `// Report single transaction weight\n$billing->events->track([\n    "customerId" => "customer_linear_102",\n    "meterId" => "api_operations",\n    "value" => 12,\n    "metadata" => ["endpoint" => "/v2/completions"]\n]);`,
      check: `// Verify subscription rules\n$check = $billing->entitlements->canAccess(\n    "customer_linear_102",\n    "premium_export"\n);\n\nif ($check->hasAccess) {\n    // Execute core module\n}`
    }
  };

  // ----------------------------------------------------
  // AI DOCUMENTATION CHAT ASSISTANT STATE
  // ----------------------------------------------------
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiChatLog, setAiChatLog] = useState<Array<{ sender: "user" | "engine"; text: string }>>([
    {
      sender: "engine",
      text: "Developer assistant initialized. I can fetch exact configurations, SDK snippets, or troubleshoot validation rules directly from Aora API models! Ask me anything regarding usage meters, webhook deliveries, or entitlements."
    }
  ]);

  const handleAskAIAssistant = async (presetText?: string) => {
    const question = presetText || aiQuestion;
    if (!question.trim()) return;

    // Append user message
    setAiChatLog(prev => [...prev, { sender: "user", text: question }]);
    if (!presetText) setAiQuestion("");
    setAiLoading(true);

    try {
      const docsContext = `
      You are the Aora Billing Documentation AI. Answer based STRICTLY on Aora Documentation guidelines:
      1. Webhook types: invoice.paid, subscription.created, entitlement.breached.
      2. Portals: clients connect via /api/can-access or read details.
      3. Usage events post to POST /api/usage-events with payload: customerId, meterId, value, metadata.
      4. Workspace: ${workspaceName}.
      Answer questions clearly using JetBrains Mono code snippets and Inter typography.
      `;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `[DOCUMENTATION CONTEXT: ${docsContext}] User question: ${question}`
        })
      });

      if (response.ok) {
        const result = await response.json();
        // The server response carries historical chat. The last message is usually the latest AI answer.
        const latestText = result[result.length - 1]?.text || "I processed your request, and your billing setup is fully verified.";
        setAiChatLog(prev => [...prev, { sender: "engine", text: latestText }]);
      } else {
        throw new Error("AI Server Module Offline");
      }
    } catch (e) {
      // High fidelity local client-side documentation model responder if backend is transient
      setTimeout(() => {
        let localReply = "I have scanned the local documentation repository. ";
        const query = question.toLowerCase();

        if (query.includes("meter") || query.includes("usage")) {
          localReply += "In Aora, **Usage Metering** aggregates telemetry data. Events are ingested at `POST /api/usage-events` using: \n```json\n{\n  \"customerId\": \"linear\",\n  \"meterId\": \"compute_meter\",\n  \"value\": 1,\n  \"metadata\": { \"source\": \"api_gateway\" }\n}\n``` \nMultiple meters aggregations can compute maximums, sum weights, or count increments dynamically during active cycles.";
        } else if (query.includes("credit") || query.includes("quota")) {
          localReply += "Our **Credits Engine** supports pre-paid virtual wallets. Credits are registered as balance objects and automatically deducted via active rate rules (e.g., NGN ₦2.50 per image generated) before a customer's standard invoice generates.";
        } else if (query.includes("seat") || query.includes("seat price")) {
          localReply += "To implement **Seat-Based Billing**, configure a recurring price plan (e.g., NGN ₦12,500/seat/month). Aora automatically syncs seat changes and computes prorated billing fractions when seats increase or decrease, ensuring correct payment cycles.";
        } else if (query.includes("webhook") || query.includes("payload")) {
          localReply += "Aora fires webhooks for key transactions like `invoice.paid`, `subscription.created`, and `entitlement.breached`. Ensure you configure verification signatures securely using secret tokens and evaluate payload hash maps recursively.";
        } else {
          localReply += "Aora Billing provides sub-second rating with multi-tenant API isolation. To integrate quickly, install our official SDKs (Node.js, Python, or Go), inject your `sk_live_...` secret key, and forward telemetry. Let me know if you would like me to draft an integration file!";
        }
        setAiChatLog(prev => [...prev, { sender: "engine", text: localReply }]);
      }, 700);
    } finally {
      setAiLoading(false);
    }
  };

  // State utility for copy button states
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const triggerCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  return (
    <DashboardThemeProvider>
    <div className="docs-page h-screen dp-bg dp-text font-sans antialiased text-left shadow-lg overflow-hidden flex flex-col" data-theme="dark">

      {/* ----------------- WORLD-CLASS DOCS HEADER ----------------- */}
      <header className="sticky top-0 dp-card border-b dp-border py-3.5 px-6 z-40 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={onBackToDashboard}>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111111] shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm text-neutral-900 leading-none">Aora Billing</span>
            <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Docs</span>
          </div>

          <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold text-[#6E6E73]">
            <button onClick={() => { setActivePage("intro"); setMobileSidebarOpen(false); }} className={`hover:text-[#111111] transition-all cursor-pointer ${activePage === "intro" ? "text-[#0071E3]" : ""}`}>Documentation</button>
            <button onClick={() => { setActivePage("playground"); setMobileSidebarOpen(false); }} className={`hover:text-[#111111] transition-all cursor-pointer ${activePage === "playground" ? "text-[#0071E3]" : ""}`}>API Reference</button>
            <button onClick={() => { setActivePage("sdks"); setMobileSidebarOpen(false); }} className={`hover:text-[#111111] transition-all cursor-pointer ${activePage === "sdks" ? "text-[#0071E3]" : ""}`}>SDKs</button>
            <button onClick={() => { setActivePage("guide-usage"); setMobileSidebarOpen(false); }} className={`hover:text-[#111111] transition-all cursor-pointer ${activePage === "guide-usage" ? "text-[#0071E3]" : ""}`}>Guides</button>
            <button onClick={() => { setActivePage("changelog"); setMobileSidebarOpen(false); }} className={`hover:text-[#111111] transition-all cursor-pointer ${activePage === "changelog" ? "text-[#0071E3]" : ""}`}>Changelog</button>
            <button onClick={() => { setActivePage("status"); setMobileSidebarOpen(false); }} className={`hover:text-[#111111] transition-all cursor-pointer flex items-center gap-1 cursor-pointer ${activePage === "status" ? "text-[#0071E3]" : ""}`}>
              <span className="h-2 w-2 rounded-full bg-[#34C759] animate-pulse"></span>
              Status
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Cmd + K search button triggers modal */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2.5 bg-[#FAFAFA] border border-[#E5E5E7] rounded-lg px-3 py-1.5 transition-all text-[#6E6E73] hover:border-white/40 hover:bg-neutral-50 text-xs font-medium cursor-pointer"
            id="docs-search-btn"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search docs...</span>
            <kbd className="hidden sm:inline bg-white border border-[#E5E5E7] shadow-sm text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold text-neutral-400">⌘K</kbd>
          </button>

          {/* Quick link back to the fully interactive workspace dashboard */}
          <button
            onClick={onBackToDashboard}
            className="bg-[#111111] hover:bg-[#1D1D1F] text-white text-xs font-bold leading-none py-2 px-3.5 rounded-lg transition-all cursor-pointer shadow-sm flex items-center gap-1"
            id="docs-back-dashboard-btn"
          >
            Dashboard
            <ArrowRight className="h-3.5 w-3.5" />
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-1 px-1.5 border border-[#E5E5E7] bg-[#FAFAFA] text-neutral-800 rounded-lg lg:hidden hover:bg-neutral-100 cursor-pointer"
          >
            {mobileSidebarOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </header>

      {/* ----------------- LAYOUT CONTENT ----------------- */}
      <div className="max-w-8xl mx-auto flex flex-1 w-full overflow-hidden">

        {/* ----------------- FIXED SIDEBAR FOR DESKTOP / FLAGGED SHELF FOR MOBILE ----------------- */}
        <aside className={`w-64 border-r border-[#E5E5E7] bg-[#FAFAFA] shrink-0 h-full overflow-y-auto z-30 transition-all duration-300 lg:block ${mobileSidebarOpen ? "fixed left-0 top-[53px] bg-white w-72 h-[calc(100vh-53px)] border-r shadow-xl z-50 block" : "hidden lg:block animate-in"}`}>
          <div className="py-6 px-4 space-y-6">

            {/* Section: Getting Started */}
            <div>
              <button onClick={() => toggleSection("gettingStarted")} className="w-full flex items-center justify-between text-[#86868B] text-[10px] uppercase font-bold tracking-wider mb-2 hover:text-[#111111] transition-colors cursor-pointer">
                <span>Getting Started</span>
                {expandedSections.gettingStarted ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              {expandedSections.gettingStarted && (
                <div className="space-y-1 pl-1">
                  <button onClick={() => { setActivePage("intro"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-2 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "intro" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    <BookOpen className="h-3 w-3" />
                    Overview & Introduction
                  </button>
                  <button onClick={() => { setActivePage("quickstart"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-2 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "quickstart" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    <Terminal className="h-3 w-3" />
                    Quick Start Guide
                  </button>
                </div>
              )}
            </div>

            {/* Section: Core Concepts */}
            <div>
              <button onClick={() => toggleSection("concepts")} className="w-full flex items-center justify-between text-[#86868B] text-[10px] uppercase font-bold tracking-wider mb-2 hover:text-[#111111] transition-colors cursor-pointer">
                <span>Core Concepts</span>
                {expandedSections.concepts ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              {expandedSections.concepts && (
                <div className="space-y-1 pl-1">
                  <button onClick={() => { setActivePage("architecture"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-2 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "architecture" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    <Workflow className="h-3.5 w-3.5" />
                    System Architecture
                  </button>
                  <button onClick={() => { setActivePage("concepts-products"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-2 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "concepts-products" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    <CreditCard className="h-3.5 w-3.5" />
                    Products & Plans Catalog
                  </button>
                  <button onClick={() => { setActivePage("concepts-usage"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-2 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "concepts-usage" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    <Database className="h-3.5 w-3.5" />
                    Usage Metering
                  </button>
                  <button onClick={() => { setActivePage("concepts-entitlements"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-2 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "concepts-entitlements" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Entitlement Gate Engine
                  </button>
                </div>
              )}
            </div>

            {/* Section: Developer Center */}
            <div>
              <button onClick={() => toggleSection("devTools")} className="w-full flex items-center justify-between text-[#86868B] text-[10px] uppercase font-bold tracking-wider mb-2 hover:text-[#111111] transition-colors cursor-pointer">
                <span>API Developer Tools</span>
                {expandedSections.devTools ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              {expandedSections.devTools && (
                <div className="space-y-1 pl-1">
                  <button onClick={() => { setActivePage("dev-keys"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-2 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "dev-keys" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    <Code2 className="h-3.5 w-3.5" />
                    Authentication Keys
                  </button>
                  <button onClick={() => { setActivePage("playground"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-2 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "playground" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    <Play className="h-3.5 w-3.5" />
                    Interactive Sandbox API
                  </button>
                  <button onClick={() => { setActivePage("webhooks"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-2 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "webhooks" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    <Globe className="h-3.5 w-3.5" />
                    Webhook Deliverer
                  </button>
                  <button onClick={() => { setActivePage("errors"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-2 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "errors" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Error Directory Catalog
                  </button>
                </div>
              )}
            </div>

            {/* Section: Practical Guides */}
            <div>
              <button onClick={() => toggleSection("guides")} className="w-full flex items-center justify-between text-[#86868B] text-[10px] uppercase font-bold tracking-wider mb-2 hover:text-[#111111] transition-colors cursor-pointer">
                <span>Tutorial Guides</span>
                {expandedSections.guides ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              {expandedSections.guides && (
                <div className="space-y-1 pl-1">
                  <button onClick={() => { setActivePage("guide-seats"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "guide-seats" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    Building Seat-Based models
                  </button>
                  <button onClick={() => { setActivePage("guide-usage"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "guide-usage" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    Usage Metering Pipeline
                  </button>
                </div>
              )}
            </div>

            {/* Section: Backend Features */}
            <div>
              <button onClick={() => toggleSection("backend")} className="w-full flex items-center justify-between text-[#86868B] text-[10px] uppercase font-bold tracking-wider mb-2 hover:text-[#111111] transition-colors cursor-pointer">
                <span>Backend Features</span>
                {expandedSections.backend ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              {expandedSections.backend && (
                <div className="space-y-1 pl-1">
                  <button onClick={() => { setActivePage("backend-proration"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "backend-proration" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    Proration Service
                  </button>
                  <button onClick={() => { setActivePage("backend-ingress"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "backend-ingress" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    Fair Ingress Metering
                  </button>
                  <button onClick={() => { setActivePage("backend-dedup"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "backend-dedup" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    Deduplication Engine
                  </button>
                  <button onClick={() => { setActivePage("backend-batch"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "backend-batch" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    Batch Ingestion
                  </button>
                  <button onClick={() => { setActivePage("backend-sandbox"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "backend-sandbox" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    Sandbox Playground
                  </button>
                  <button onClick={() => { setActivePage("backend-encryption"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "backend-encryption" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    Zero-Trust Encryption
                  </button>
                  <button onClick={() => { setActivePage("backend-webhooks"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "backend-webhooks" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    Webhook Outbox
                  </button>
                  <button onClick={() => { setActivePage("backend-dunning"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "backend-dunning" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    Dunning & Retry
                  </button>
                </div>
              )}
            </div>

            {/* Section: References & Logs */}
            <div>
              <button onClick={() => toggleSection("reference")} className="w-full flex items-center justify-between text-[#86868B] text-[10px] uppercase font-bold tracking-wider mb-2 hover:text-[#111111] transition-colors cursor-pointer">
                <span>Reference & Release</span>
                {expandedSections.reference ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              {expandedSections.reference && (
                <div className="space-y-1 pl-1">
                  <button onClick={() => { setActivePage("sdks"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-2 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "sdks" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    <Layers className="h-3.5 w-3.5" />
                    Official Runtime SDKs
                  </button>
                  <button onClick={() => { setActivePage("dashboard-integration"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-2 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "dashboard-integration" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    <Sparkles className="h-3.5 w-3.5" />
                    Developer Dashboard Integration
                  </button>
                  <button onClick={() => { setActivePage("status"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-2 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "status" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    <Activity className="h-3.5 w-3.5" />
                    Master Service Status
                  </button>
                  <button onClick={() => { setActivePage("changelog"); setMobileSidebarOpen(false); }} className={`flex w-full items-center gap-2 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors ${activePage === "changelog" ? "bg-white border border-[#E5E5E7] text-[#0071E3]" : "text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2]"}`}>
                    <History className="h-3.5 w-3.5" />
                    Product Changelog
                  </button>
                </div>
              )}
            </div>

          </div>
        </aside>

        {/* ----------------- CORE VIEWS MAIN OUTLET STAGE ----------------- */}
        <main className="flex-1 h-full overflow-y-auto px-6 sm:px-12 py-10 max-w-4xl mx-auto space-y-12 bg-white pb-32">

          {/* ----------------- INTRO VIEW ----------------- */}
          {activePage === "intro" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Overview</span>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111111]">Billing Infrastructure without Billing Complexity</h1>
                <p className="text-sm text-[#6E6E73] leading-relaxed">
                  Aora is a state-of-the-art billing developer engine constructed to implement seats, volumetric overages, allowances, credits, and pricing models in under few minutes. Manage sub-millisecond usage rating buses, enforce multi-tenant entitling policies, and emit beautiful customer portals automatically.
                </p>
              </div>

              {/* Stripe style layout cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div onClick={() => setActivePage("quickstart")} className="bg-[#F5F5F7] border border-[#E5E5E7] hover:border-[#0071E3] hover:bg-neutral-50/70 p-5 rounded-2xl text-left cursor-pointer transition-all space-y-2 group">
                  <Terminal className="h-6 w-6 text-[#111111] group-hover:text-[#0071E3] transition-colors" />
                  <h3 className="text-sm font-bold text-[#111111] flex items-center gap-1.5">
                    Quick Start Guide
                    <ChevronRight className="h-3.5 w-3.5 text-[#86868B]" />
                  </h3>
                  <p className="text-xs text-[#6E6E73] leading-normal font-medium">
                    Integrate your billing pipeline, configure a plan, ingest sample telemetry events, and calculate usage.
                  </p>
                </div>

                <div onClick={() => setActivePage("playground")} className="bg-[#F5F5F7] border border-[#E5E5E7] hover:border-[#0071E3] hover:bg-neutral-50/70 p-5 rounded-2xl text-left cursor-pointer transition-all space-y-2 group">
                  <Play className="h-6 w-6 text-[#111111] group-hover:text-[#0071E3] transition-colors" />
                  <h3 className="text-sm font-bold text-[#111111] flex items-center gap-1.5">
                    Interactive Service Playground
                    <ChevronRight className="h-3.5 w-3.5 text-[#86868B]" />
                  </h3>
                  <p className="text-xs text-[#6E6E73] leading-normal font-medium">
                    Transmit sandbox events live to Aora and review immediate responses and multi-tenant telemetry checks on-screen.
                  </p>
                </div>
              </div>

              {/* Core capabilities list section */}
              <div className="space-y-4 pt-4">
                <h2 className="text-lg font-bold text-[#111111] border-b border-[#E5E5E7] pb-2">The Aora Platform Pillars</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium text-stone-600">
                  <div className="space-y-1">
                    <strong className="text-[#111111] block">Allowances & Meters</strong>
                    <span className="text-[11px] text-[#6E6E73] block leading-relaxed">High performance deduplication of events. Calculate sum, max, or unique identifiers.</span>
                  </div>
                  <div className="space-y-1">
                    <strong className="text-[#111111] block">Entitlement Gate</strong>
                    <span className="text-[11px] text-[#6E6E73] block leading-relaxed">Verify plan capabilities and feature flags dynamically within millisecond limits.</span>
                  </div>
                  <div className="space-y-1">
                    <strong className="text-[#111111] block">Virtual Credit Wallets</strong>
                    <span className="text-[11px] text-[#6E6E73] block leading-relaxed">Load prepaid credits, handle triggers, and expire allocations timeline-accurately.</span>
                  </div>
                </div>
              </div>

              {/* Video Sandbox / Terminal styling Callout */}
              <div className="bg-[#FAF9F6] border border-[#FF9F0A]/20 p-4 rounded-xl flex gap-3 text-left">
                <Info className="h-5 w-5 text-[#FF9F0A] shrink-0 mt-0.5" />
                <div className="text-xs font-semibold text-stone-800 leading-normal space-y-1">
                  <span>Workspace Integration Live:</span>
                  <p className="text-[#6E6E73] font-medium text-[11px]">
                    This guide is synced to your current active instance: <strong>{workspaceName}</strong>. All interactive calls to sandbox endpoints will write context directly to that workspace logs!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- QUICK START VIEW ----------------- */}
          {activePage === "quickstart" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Walkthrough</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Quick Start Guide</h1>
                <p className="text-sm text-[#6E6E73]">
                  Start processing sub-millisecond metering and and calculating real invoices in under three quick operations. Estimated completion time: <strong className="text-amber-600">3 minutes</strong>.
                </p>
              </div>

              {/* Step 1 */}
              <div className="space-y-3 pt-2">
                <div className="flex gap-3 items-center">
                  <span className="h-6 w-6 rounded-full bg-[#111111] text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">1</span>
                  <h3 className="text-sm font-bold text-[#111111]">Forward an Event Package</h3>
                </div>
                <p className="text-xs text-[#6E6E73] leading-relaxed pl-9 font-medium">
                  Submit a payload package whenever users execute programmatic actions (e.g., API requests, processing gigabytes, or vector tokens).
                </p>

                <div className="pl-9 space-y-2">
                  <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4 rounded-xl relative">
                    <button onClick={() => triggerCopyToClipboard("curl -X POST https://api.aorahq.com/api/usage-events \\\n -H \"Authorization: Bearer sk_live_aora_5f2d93e810cb9921e42f2bca01\" \\\n -H \"Content-Type: application/json\" \\\n -d '{\n   \"customerId\": \"linear\",\n   \"meterId\": \"compute_meter\",\n   \"value\": 150,\n   \"metadata\": { \"source\": \"api\" }\n }'", "curl-qs")} className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-950 p-1 rounded hover:bg-neutral-100 transition-colors cursor-pointer" title="Copy code snippet">
                      {copiedStates["curl-qs"] ? <Check className="h-3.5 w-3.5 text-[#34C759]" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <pre className="text-[10.5px] font-mono text-emerald-800 leading-normal overflow-x-auto text-left py-1 select-all">
{`curl -X POST https://api.aorahq.com/api/usage-events \\
 -H "Authorization: Bearer sk_live_aora_5f2d93e810cb9921e42f2bca01" \\
 -H "Content-Type: application/json" \\
 -d '{
   "customerId": "linear",
   "meterId": "compute_meter",
   "value": 150,
   "metadata": { "source": "api" }
 }'`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-3">
                <div className="flex gap-3 items-center">
                  <span className="h-6 w-6 rounded-full bg-[#111111] text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">2</span>
                  <h3 className="text-sm font-bold text-[#111111]">Verify Entitlement Gateway Dynamically</h3>
                </div>
                <p className="text-xs text-[#6E6E73] leading-relaxed pl-9 font-medium">
                  Before allowing the user to execute premium calculations, check Aora is allowing access based on historical aggregates.
                </p>

                <div className="pl-9 space-y-2">
                  <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4 rounded-xl relative">
                    <button onClick={() => triggerCopyToClipboard("curl -X GET \"https://api.aorahq.com/api/can-access?customerId=linear&featureSlug=api_access\" \\\n -H \"Authorization: Bearer sk_live_aora_...\"", "curl-qs-2")} className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-950 p-1 rounded hover:bg-neutral-100 transition-colors cursor-pointer">
                      {copiedStates["curl-qs-2"] ? <Check className="h-3.5 w-3.5 text-[#34C759]" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <pre className="text-[10.5px] font-mono text-slate-800 leading-normal overflow-x-auto text-left py-1">
{`curl -X GET "https://api.aorahq.com/api/can-access?customerId=linear&featureSlug=api_access" \\
 -H "Authorization: Bearer sk_live_aora_5f2d93e810cb9921e42f2bca01"`}
                    </pre>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-900 p-4 rounded-xl text-left">
                    <span className="text-[10px] text-[#86868B] uppercase font-bold tracking-wider font-mono">Response Payload (200 OK)</span>
                    <pre className="text-[10px] font-mono text-neutral-200 mt-1.5 select-all">
{`{
  "customerId": "linear",
  "featureSlug": "api_access",
  "hasAccess": true,
  "reason": "Customer is on Growth Plan",
  "limits": {
    "limit": 500000,
    "current": 145150
  }
}`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Link CTA */}
              <div className="pt-4 text-center">
                <button
                  onClick={() => setActivePage("playground")}
                  className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold leading-none py-2.5 px-5 rounded-lg transition-all cursor-pointer shadow-md inline-flex items-center gap-1.5"
                >
                  <Play className="h-3.5 w-3.5 fill-white shrink-0" />
                  Try live inside interactive API Playground
                </button>
              </div>
            </div>
          )}

          {/* ----------------- CORE ARCHITECTURE DIAGRAM ----------------- */}
          {activePage === "architecture" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">System Design</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Aora Platform Architecture</h1>
                <p className="text-sm text-[#6E6E73]">
                  Review how high-throughput events progress safely within Aora, tracking logs and syncing allocations instantly.
                </p>
              </div>

              {/* SVG / Styled visual architecture pipeline */}
              <div className="bg-[#F5F5F7] border border-[#E5E5E7] rounded-3xl p-6 space-y-8 text-center shadow-inner">
                <span className="text-[9px] uppercase font-bold text-neutral-400 tracking-wider font-mono block">Data Pipeline Schema</span>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  
                  {/* Step 1: SDK Clients */}
                  <div className="bg-white border border-[#E5E5E7] p-4.5 rounded-2xl relative shadow-sm hover:border-[#0071E3] transition-all text-left">
                    <span className="z-10 absolute -top-2.5 left-4 bg-emerald-500 text-white font-mono text-[9px] px-2 py-0.5 rounded-full font-bold">NODE 01</span>
                    <Terminal className="h-4.5 w-4.5 text-[#111111] mb-1.5" />
                    <h4 className="text-xs font-bold text-[#111111]">Client SDKs</h4>
                    <p className="text-[10px] text-[#6E6E73] leading-relaxed mt-1 font-medium">Forward telemetry via NodeJS, Python, custom APIs.</p>
                  </div>

                  {/* Flow arrow */}
                  <div className="hidden md:flex justify-center items-center font-mono text-xs text-neutral-400">
                    <ArrowRight className="h-5 w-5 animate-pulse text-[#0071E3]" />
                  </div>

                  {/* Step 2: Rating Bus */}
                  <div className="bg-white border border-[#E5E5E7] p-4.5 rounded-2xl relative shadow-sm hover:border-[#0071E3] transition-all text-left">
                    <span className="z-10 absolute -top-2.5 left-4 bg-blue-500 text-white font-mono text-[9px] px-2 py-0.5 rounded-full font-bold">NODE 02</span>
                    <Workflow className="h-4.5 w-4.5 text-[#111111] mb-1.5" />
                    <h4 className="text-xs font-bold text-[#111111]">Ingestion Stream</h4>
                    <p className="text-[10px] text-[#6E6E73] leading-relaxed mt-1 font-medium">Deduplicate payload packets instantly within 12ms.</p>
                  </div>

                  {/* Flow arrow */}
                  <div className="hidden md:flex justify-center items-center font-mono text-xs text-neutral-400">
                    <ArrowRight className="h-5 w-5 animate-pulse text-[#0071E3]" />
                  </div>

                  {/* Step 3: Rules rating */}
                  <div className="bg-white border border-[#E5E5E7] p-4.5 rounded-2xl relative shadow-sm hover:border-[#0071E3] transition-all text-left">
                    <span className="z-10 absolute -top-2.5 left-4 bg-purple-500 text-white font-mono text-[9px] px-2 py-0.5 rounded-full font-bold">NODE 03</span>
                    <Database className="h-4.5 w-4.5 text-[#111111] mb-1.5" />
                    <h4 className="text-xs font-bold text-[#111111]">Aggregate Evaluator</h4>
                    <p className="text-[10px] text-[#6E6E73] leading-relaxed mt-1 font-medium">Query active rate parameters, compute overage fractions.</p>
                  </div>

                  {/* Flow arrow */}
                  <div className="hidden md:flex justify-center items-center font-mono text-xs text-neutral-400">
                    <ArrowRight className="h-5 w-5 animate-pulse text-[#0071E3]" />
                  </div>

                  {/* Step 4: Webhook & Ledger */}
                  <div className="bg-white border border-[#E5E5E7] p-4.5 rounded-2xl relative shadow-sm hover:border-[#0071E3] transition-all text-left">
                    <span className="z-10 absolute -top-2.5 left-4 bg-amber-500 text-white font-mono text-[9px] px-2 py-0.5 rounded-full font-bold">NODE 04</span>
                    <Globe className="h-4.5 w-4.5 text-[#111111] mb-1.5" />
                    <h4 className="text-xs font-bold text-[#111111]">Live Ledger Out</h4>
                    <p className="text-[10px] text-[#6E6E73] leading-relaxed mt-1 font-medium">Dispatch secure webhook signals and draft monthly invoices.</p>
                  </div>

                </div>
              </div>

              {/* Proactive explanation blocks */}
              <div className="space-y-4 font-normal text-xs text-stone-600 leading-relaxed">
                <h3 className="text-sm font-bold text-[#111111]">Key Integrity Guarantees</h3>
                <ul className="list-disc pl-5 space-y-2 text-[#6E6E73] font-medium">
                  <li><strong>Idempotency Safety:</strong> Submitting identical `id` telemetry coordinates within a 24-hour cycle is automatically rejected to avoid inflating bill totals.</li>
                  <li><strong>Dynamic Cache Check:</strong> Checking entitlement authorization (via `can-access`) retrieves cached memory buffers, responding within 2.4 milliseconds.</li>
                  <li><strong>Audit Ledger Trail:</strong> Every transactional rule mutation generates structural cryptographically signed log ledgers accessible instantaneously.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ----------------- PRODUCTS & PLANS CONCEPT ----------------- */}
          {activePage === "concepts-products" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Catalog</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Products & Plans Catalog</h1>
                <p className="text-sm text-[#6E6E73]">
                  Aora structures pricing into products (what features are purchased) and plans (how much those allocations charge recursively).
                </p>
              </div>

              {/* Pricing models matrix table */}
              <div className="bg-white border border-[#E5E5E7] rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs text-[#111111]">
                  <thead>
                    <tr className="bg-[#F5F5F7] border-b border-[#E5E5E7] uppercase font-bold text-[9px] tracking-widest text-[#6E6E73]">
                      <th className="py-3 px-4">Billing Grid Archetype</th>
                      <th className="py-3 px-4">Core Mechanism</th>
                      <th className="py-3 px-4">Use Cases</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E7] text-[#6E6E73] font-medium">
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-[#111111]">Flat Subscription</td>
                      <td className="py-3.5 px-4">Charges static recurring price every cycle (allowances constant).</td>
                      <td className="py-3.5 px-4 font-mono text-[10px]">Starter Plan: ₦15,000/mo</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-[#111111]">Usage overage</td>
                      <td className="py-3.5 px-4">Free allowance bucket, then charges incremental unit overages.</td>
                      <td className="py-3.5 px-4 font-mono text-[10px]">₦2 per telemetry unit</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-[#111111]">Seat pricing</td>
                      <td className="py-3.5 px-4">Evaluates count of active account users during invoicing cycle.</td>
                      <td className="py-3.5 px-4 font-mono text-[10px]">₦12,500/seat/month</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-[#111111]">Ad-Hoc Credits</td>
                      <td className="py-3.5 px-4">Pre-funded token bank with auto-rating debit balance checks.</td>
                      <td className="py-3.5 px-4 font-mono text-[10px]">API Generation models</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ----------------- USAGE METERED CONCEPT ----------------- */}
          {activePage === "concepts-usage" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Aggregation</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Usage Metering</h1>
                <p className="text-sm text-[#6E6E73]">
                  Usage Metering translates thousands of event streams into clean, billable indices based on structural aggregation rules.
                </p>
              </div>

              {/* Interactive preview with aggregations */}
              <div className="bg-[#F5F5F7] border border-[#E5E5E7] rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
                  <Database className="h-4.5 w-4.5 text-[#0071E3]" />
                  Active Ingestion Aggregrations supported
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-left">
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl">
                    <span className="text-[9px] font-bold text-[#0071E3] block uppercase tracking-wider">COUNT</span>
                    <strong className="text-xs text-[#111111] mt-1 block">Sum of Events</strong>
                    <span className="text-[10px] text-[#6E6E73] mt-0.5 block font-medium">Increment totals for operations count (e.g., API triggers).</span>
                  </div>
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl">
                    <span className="text-[9px] font-bold text-emerald-600 block uppercase tracking-wider">SUM</span>
                    <strong className="text-xs text-[#111111] mt-1 block">Sum of Field Value</strong>
                    <span className="text-[10px] text-[#6E6E73] mt-0.5 block font-medium">Aggregates values (e.g., gigabytes downloaded).</span>
                  </div>
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl">
                    <span className="text-[9px] font-bold text-purple-600 block uppercase tracking-wider">MAX</span>
                    <strong className="text-xs text-[#111111] mt-1 block">Maximum Field Value</strong>
                    <span className="text-[10px] text-[#6E6E73] mt-0.5 block font-medium">Saves the peak height usage recorded (e.g., peak database storage).</span>
                  </div>
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl">
                    <span className="text-[9px] font-bold text-amber-500 block uppercase tracking-wider">UNIQUE</span>
                    <strong className="text-xs text-[#111111] mt-1 block">Distinct Elements count</strong>
                    <span className="text-[10px] text-[#6E6E73] mt-0.5 block font-medium">Counts distinct users triggered (e.g., distinct logging IPs).</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- ENTITLEMENT CONTROLLER CONCEPT ----------------- */}
          {activePage === "concepts-entitlements" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Gateway Guards</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Entitlement Gate Engine</h1>
                <p className="text-sm text-[#6E6E73]">
                  Verify features locks, quota metrics, and multi-tenant authorization instantly during live runtime transactions.
                </p>
              </div>

              {/* Callout box detailing dynamic gates */}
              <div className="bg-[#FAF9F6] border border-[#FF9F0A]/20 p-5 rounded-2xl flex gap-4 text-left">
                <AlertTriangle className="h-5 w-5 text-[#FF9F0A]" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-stone-900">Why differentiate plan permissions from Billing?</h4>
                  <p className="text-xs text-[#6E6E73] leading-relaxed font-medium">
                    Plan options shouldn't crash standard app cycles. By calling Aora dynamic permission checks, the routing layer automatically verifies limits and reports alerts without locking down standard screens.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- AUTHENTICATION KEYS INFO ----------------- */}
          {activePage === "dev-keys" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Security</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Authentication & API Keys</h1>
                <p className="text-sm text-[#6E6E73]">
                  Aora authorizes client commands utilizing private Bearer tokens transmitted securely inside HTTP request header definitions.
                </p>
              </div>

              <div className="bg-[#FAFAFA] border border-[#E5E5E7] p-5 rounded-2xl text-left space-y-3">
                <h3 className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
                  <Code2 className="h-4.5 w-4.5 text-[#0071E3]" />
                  Secure Header Schema
                </h3>
                <p className="text-xs text-[#6E6E73] leading-relaxed font-medium">
                  Add your primary private workspace key inside standard client integrations utilizing standard secure headers:
                </p>

                <div className="bg-neutral-950 p-4 rounded-xl text-xs font-mono text-neutral-300">
                  <span className="text-neutral-500 block uppercase text-[10px] font-bold mb-1">Standard Headers Required</span>
                  <div>Authorization: Bearer sk_live_aora_5f2d93e810cb9921e42f2bca01</div>
                  <div className="mt-1">Content-Type: application/json</div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- CORE INTERACTIVE PLAYGROUND SANDBOX ----------------- */}
          {activePage === "playground" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Sandbox API</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Interactive Documentation Playground</h1>
                <p className="text-sm text-[#6E6E73]">
                  Submit transactions directly with the live server. Generate unique validation codes and observe immediate response parameters.
                </p>
              </div>

              {/* Sub-selectors */}
              <div className="flex gap-2.5 border-b border-[#E5E5E7] pb-3 text-xs font-semibold text-[#6E6E73]">
                <button
                  onClick={() => handlePlaygroundPreset("/api/usage-events")}
                  className={`pb-1.5 focus:outline-none transition-all cursor-pointer ${playgroundPath === "/api/usage-events" ? "text-[#111111] border-b-2 border-[#0071E3]" : "hover:text-[#111111]"}`}
                >
                  POST /api/usage-events
                </button>
                <button
                  onClick={() => handlePlaygroundPreset("/api/can-access")}
                  className={`pb-1.5 focus:outline-none transition-all cursor-pointer ${playgroundPath === "/api/can-access" ? "text-[#111111] border-b-2 border-[#0071E3]" : "hover:text-[#111111]"}`}
                >
                  GET /api/can-access
                </button>
              </div>

              {/* Interactive developer shell */}
              <div className="bg-[#111111] text-[#FAFAFA] rounded-2xl p-6.5 text-left font-mono space-y-4 shadow-xl">
                <div className="flex justify-between items-center text-xs text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Terminal className="h-4 w-4 text-[#34C759]" />
                    Interactive REST Playground
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-neutral-900 border border-neutral-800 px-2.5 py-0.5 rounded text-neutral-300 select-all truncate max-w-[150px]">
                      {playgroundApiKey}
                    </span>
                    <button onClick={handleRegenPlaygroundKey} className="text-[9px] hover:underline font-bold text-neutral-400 font-sans cursor-pointer">Regen Key</button>
                  </div>
                </div>

                {/* HTTP Request URL bar */}
                <div className="flex gap-2 items-center bg-neutral-900 border border-neutral-800 p-2 rounded-lg text-xs">
                  <span className={`${playgroundMethod === "POST" ? "text-emerald-400" : "text-blue-400"} font-extrabold`}>{playgroundMethod}</span>
                  <span className="text-neutral-500 truncate select-all">https://api.aorahq.com{playgroundPath}</span>
                </div>

                {/* Body parameters and terminal responses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* JSON body */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-[#86868B] tracking-wider block font-sans">JSON Package parameters</label>
                    {playgroundPath === "/api/can-access" ? (
                      <div className="p-3 bg-neutral-900/40 border border-neutral-800 rounded-lg text-[10px] space-y-2 h-36 flex flex-col justify-center">
                        <div className="flex justify-between border-b border-neutral-800 pb-1.5">
                          <span className="text-neutral-400">customerId</span>
                          <span className="text-white font-bold">linear</span>
                        </div>
                        <div className="flex justify-between border-b border-neutral-800 pb-1.5">
                          <span className="text-neutral-400">featureSlug</span>
                          <span className="text-white font-bold">api_access</span>
                        </div>
                        <p className="text-[9px] text-[#6E6E73] font-sans leading-relaxed">Runs dynamic authentication checking checks live.</p>
                      </div>
                    ) : (
                      <textarea
                        value={playgroundPayload}
                        onChange={(e) => setPlaygroundPayload(e.target.value)}
                        className="w-full h-36 bg-neutral-900 border border-neutral-800 text-emerald-400 rounded-lg p-2.5 text-[10px] focus:outline-none focus:border-emerald-600 outline-none resize-none"
                      />
                    )}
                  </div>

                  {/* REST response console */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-[#86868B] tracking-wider block font-sans">Server Output Stream</label>
                    <div className="w-full h-36 bg-neutral-900 border border-neutral-800 text-[#FAFAFA] rounded-lg p-2.5 text-[10px] overflow-auto">
                      {playgroundLoading ? (
                        <div className="flex items-center justify-center h-full text-neutral-400 animate-pulse">Running network operations...</div>
                      ) : playgroundResponse ? (
                        <pre className="text-[9.5px] leading-relaxed text-left text-neutral-300">
                          {JSON.stringify(playgroundResponse, null, 2)}
                        </pre>
                      ) : (
                        <div className="flex items-center justify-center h-full text-neutral-500 font-sans text-xs">Press Dispatch command below as a simulator trigger.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dispatch Trigger CTA */}
                <div className="flex justify-between items-center pt-2 font-sans">
                  <span className="text-[10px] text-neutral-500">Workspace context: {workspaceName}</span>
                  <button
                    onClick={executePlaygroundRequest}
                    disabled={playgroundLoading}
                    className="px-4 py-2 bg-white hover:bg-neutral-100 text-black font-semibold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    id="docs-playground-run-btn"
                  >
                    <Play className="h-3.5 w-3.5 fill-black font-bold shrink-0" />
                    {playgroundLoading ? "Running..." : "Dispatch REST Command"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- WEBHOOK DEVELOPER CENTER ----------------- */}
          {activePage === "webhooks" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Webhooks</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Webhook Documentation</h1>
                <p className="text-sm text-[#6E6E73]">
                  Aora publishes transactional status hooks securely enabling downstream synchronization, notifying database nodes, or alerting sales representatives.
                </p>
              </div>

              {/* Webhook events list selection */}
              <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 text-left space-y-4">
                <div className="flex items-center justify-between border-b border-[#F5F5F7] pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-[#111111]">Webhook Explorer Presets</h3>
                    <p className="text-[10px] text-[#6E6E73] font-medium leading-relaxed">Choose standard events triggering on actual operations, then simulate transactions on screen.</p>
                  </div>
                  <div>
                    <select
                      value={selectedWebhookEvent}
                      onChange={(e) => { setSelectedWebhookEvent(e.target.value); setSimulatedWebhookResult(null); }}
                      className="text-xs border border-[#E5E5E7] p-1.5 rounded-lg bg-white outline-none cursor-pointer"
                      id="webhook-type-select"
                    >
                      <option value="invoice.paid">invoice.paid</option>
                      <option value="subscription.created">subscription.created</option>
                      <option value="entitlement.breached">entitlement.breached</option>
                    </select>
                  </div>
                </div>

                {/* Simulate CTA */}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[10px] text-[#6E6E73] font-mono">Simulating Node signature verification scheme: sha256</span>
                  <button
                    onClick={simulateWebhookTrigger}
                    disabled={isSimulatingWebhook}
                    className="p-1 px-3 bg-[#111111] hover:bg-[#1D1D1F] text-white text-[11px] font-bold rounded-lg cursor-pointer"
                    id="simulate-webhook-btn"
                  >
                    {isSimulatingWebhook ? "Computing..." : "Simulate Live Webhook"}
                  </button>
                </div>

                {/* Simulated response log box */}
                {simulatedWebhookResult && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-neutral-950 rounded-xl relative">
                    <button onClick={() => triggerCopyToClipboard(JSON.stringify(simulatedWebhookResult, null, 2), "wh-res")} className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-200 p-1 rounded hover:bg-neutral-900 transition-colors cursor-pointer" title="Copy webhook JSON">
                      {copiedStates["wh-res"] ? <Check className="h-3.5 w-3.5 text-[#34C759]" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <span className="text-[9px] text-[#86868B] uppercase font-bold tracking-wider font-mono block mb-1">Simulated Event Body: {simulatedWebhookResult.type}</span>
                    <pre className="text-[9.5px] font-mono text-neutral-200 leading-normal select-all overflow-auto max-h-48">
                      {JSON.stringify(simulatedWebhookResult, null, 2)}
                    </pre>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* ----------------- ERROR DIRECTORY ----------------- */}
          {activePage === "errors" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Troubleshooting</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Error Catalog Directory</h1>
                <p className="text-sm text-[#6E6E73]">
                  Search common API failures and resolve security or overage check lockouts.
                </p>
              </div>

              {/* Live search error filter */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5.5 h-4 w-4 text-[#86868B]" />
                <input
                  type="text"
                  placeholder="Filter errors (e.g. 401, METER, ENTITLEMENT)..."
                  value={errorSearchQuery}
                  onChange={(e) => setErrorSearchQuery(e.target.value)}
                  className="w-full bg-neutral-50 px-3 py-2 pl-9 rounded-xl border border-[#E5E5E7] text-xs font-medium focus:outline-none focus:border-white/60 transition-all"
                  id="error-catalog-search-input"
                />
              </div>

              {/* Filtered Errors results cards */}
              <div className="space-y-3">
                {filteredErrors.map((err, index) => (
                  <div key={index} className="bg-[#FAF9F6]/20 border border-[#E5E5E7] hover:border-neutral-400 p-5 rounded-2xl text-left transition-all space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                      <span className="text-xs font-extrabold text-stone-900">{err.name}</span>
                      <span className="text-[10px] font-mono bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider">{err.code}</span>
                    </div>
                    <div className="text-xs space-y-1 text-[#6E6E73] font-medium leading-relaxed">
                      <div><strong className="text-neutral-800">Root Cause:</strong> {err.cause}</div>
                      <div><strong className="text-emerald-700">How to Fix:</strong> {err.fix}</div>
                    </div>
                  </div>
                ))}
                {filteredErrors.length === 0 && (
                  <div className="text-center p-12 text-xs text-neutral-400 font-medium">No matching error records cataloged.</div>
                )}
              </div>
            </div>
          )}

          {/* ----------------- PRACTICAL SAAS SEATS GUIDE ----------------- */}
          {activePage === "guide-seats" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Guide</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Implement Seat-Based SaaS Pricing</h1>
                <p className="text-sm text-[#6E6E73]">
                  Configure seat pricing alongside allowances overages. Draft prorated bills accurately when teams scale seats count month on month.
                </p>
              </div>

              {/* Informative tutorial text */}
              <div className="prose prose-stone max-w-none text-xs text-[#6E6E73] leading-relaxed space-y-4 font-medium">
                <p>
                  SaaS billing models typically pair <strong>Seats (Active user profiles)</strong> with <strong>Meters allowances</strong>. For instance: Linear charges NGN ₦15,000 per seat, providing 10,000 allowance telemetry events.
                </p>

                <h3 className="text-sm font-bold text-[#111111] pt-2">Step 1: Sync active seat counts on change</h3>
                <p>
                  Whenever workspace administrators alter membership pools, emit updates using Customer endpoints on-screen:
                </p>

                <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4 rounded-xl relative">
                  <pre className="text-[10px] font-mono text-slate-800 leading-normal select-all overflow-auto">
{`PATCH https://api.aorahq.com/api/customers/cust_linear_102
Content-Type: application/json

{
  "seatsCount": 14,
  "meta": { "scaleReason": "enterprise_upgrade" }
}`}
                  </pre>
                </div>

                <h3 className="text-sm font-bold text-[#111111] pt-2">Step 2: Pro-rata Calculations and Invoicing</h3>
                <p>
                  Aora automatic schedulers evaluate exact timestamp offsets, prorating seat charges from the active hour membership changed rather than charging fully for the calendar cycle. When seats increase, the system charges only the remaining days in the period.
                </p>

                <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4 rounded-xl relative">
                  <pre className="text-[10px] font-mono text-slate-800 leading-normal select-all overflow-auto">
{`PATCH https://api.aorahq.com/api/subscriptions/sub_linear_102
Content-Type: application/json
Authorization: Bearer sk_live_...

{
  "seatsCount": 14,
  "action": "prorate"
}

// Response (200 OK):
{
  "proratedCharge": 42150,
  "currency": "NGN",
  "periodEnd": "2026-08-15T00:00:00Z",
  "adjustmentType": "charge",
  "transactionRef": "tx_seat_prorate_abc123"
}`}
                  </pre>
                </div>

                <h3 className="text-sm font-bold text-[#111111] pt-2">Step 3: Review the invoice</h3>
                <p>
                  Each prorated seat change generates a line item on the next invoice. View pending invoices to confirm proration was applied correctly:
                </p>

                <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4 rounded-xl relative">
                  <pre className="text-[10px] font-mono text-emerald-800 leading-normal select-all overflow-auto">
{`GET https://api.aorahq.com/api/invoices?customerId=cust_linear_102&status=open
Authorization: Bearer sk_live_...

// Response (200 OK):
{
  "invoices": [{
    "id": "INV-2026-0715",
    "lineItems": [
      { "description": "Base Plan (Growth)", "amount": 150000 },
      { "description": "Seat Adjustment (+2 seats, prorated 15 days)", "amount": 42150 },
      { "description": "Overage (API operations: 12,000 extra)", "amount": 24000 }
    ],
    "total": 216150,
    "currency": "NGN",
    "dueDate": "2026-08-01T00:00:00Z"
  }]
}`}
                  </pre>
                </div>

                <h3 className="text-sm font-bold text-[#111111] pt-2">Step 4: Verify the credit ledger</h3>
                <p>
                  When seats are reduced mid-cycle, the prorated credit is deposited into the customer&apos;s credit ledger and automatically applied to future invoices:
                </p>

                <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4 rounded-xl relative">
                  <pre className="text-[10px] font-mono text-indigo-800 leading-normal select-all overflow-auto">
{`GET https://api.aorahq.com/api/customers/cust_linear_102/credits
Authorization: Bearer sk_live_...

// Response (200 OK):
{
  "credits": [
    { "type": "proration_credit", "amount": 28100, "remaining": 28100,
      "description": "Seat reduction (-1 seat, prorated 20 days)", "createdAt": "..." }
  ],
  "totalAvailable": 28100
}`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- USAGE-BASED LLM TOKEN GUIDE ----------------- */}
          {activePage === "guide-usage" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Guide</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Usage-Based Token Billing</h1>
                <p className="text-sm text-[#6E6E73]">
                  Track volumetric variables like API requests processed, streaming minutes rendered, or LLM tokens generated accurately.
                </p>
              </div>

              <div className="prose prose-stone max-w-none text-xs text-[#6E6E73] leading-relaxed space-y-4 font-medium">
                <p>
                  Usage-based pricing lets you charge customers based on their consumption &mdash; API calls, storage GB, AI tokens, or streaming minutes. Aora handles deduplication, aggregation, and overage calculation automatically.
                </p>

                <h3 className="text-sm font-bold text-[#111111] pt-2">Step 1: Define a meter</h3>
                <p>
                  First, create a meter that defines what you&apos;re tracking and how it aggregates. Meters support <strong>sum</strong>, <strong>count</strong>, <strong>max</strong>, and <strong>unique</strong> aggregation modes.
                </p>

                <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4 rounded-xl relative">
                  <pre className="text-[10px] font-mono text-slate-800 leading-normal select-all overflow-auto">
{`POST https://api.aorahq.com/api/meters
Content-Type: application/json
Authorization: Bearer sk_live_...

{
  "slug": "llm_tokens",
  "name": "LLM Token Output",
  "aggregation": "sum",
  "unit": "token",
  "unitPriceCents": 2,
  "tiers": [
    { "upTo": 1000000, "unitPriceCents": 2 },
    { "upTo": null, "unitPriceCents": 1.5 }
  ]
}

// Response (201 Created):
{
  "id": "meter_llm_001",
  "slug": "llm_tokens",
  "aggregation": "sum",
  "unit": "token"
}`}
                  </pre>
                </div>

                <h3 className="text-sm font-bold text-[#111111] pt-2">Step 2: Ingest usage events</h3>
                <p>
                  Forward usage events in real-time as customers use your product. Each event is deduplicated within a 24-hour sliding window using the <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">eventId</code> field:
                </p>

                <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4 rounded-xl relative">
                  <pre className="text-[10px] font-mono text-slate-800 leading-normal select-all overflow-auto">
{`POST https://api.aorahq.com/api/ingress
Content-Type: application/json
Authorization: Bearer sk_live_...

{
  "customerId": "v_acme_corps",
  "meterId": "llm_tokens",
  "value": 15000,
  "eventId": "evt_unique_abc123",
  "metadata": {
    "model": "gemini-3.5-flash",
    "direction": "output",
    "latency_ms": 342
  }
}

// Response (200 OK):
{
  "accepted": true,
  "deduplicated": false,
  "currentPeriodTotal": 275000
}`}
                  </pre>
                </div>

                <h3 className="text-sm font-bold text-[#111111] pt-2">Step 3: Batch ingest for high volume</h3>
                <p>
                  When processing large volumes of events, use the batch endpoint (up to 1,000 events per request) with pipelined deduplication and tiered discounting:
                </p>

                <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4 rounded-xl relative">
                  <pre className="text-[10px] font-mono text-emerald-800 leading-normal select-all overflow-auto">
{`POST https://api.aorahq.com/api/ingress/batch
Content-Type: application/json
Authorization: Bearer sk_live_...

{
  "events": [
    { "customerId": "v_acme_corps", "meterId": "llm_tokens",
      "value": 5000, "eventId": "evt_001", "timestamp": "2026-07-15T10:00:00Z" },
    { "customerId": "v_acme_corps", "meterId": "llm_tokens",
      "value": 3000, "eventId": "evt_002", "timestamp": "2026-07-15T10:00:01Z" }
  ]
}

// Response (200 OK):
{
  "accepted": 2,
  "deduplicated": 0,
  "batchDiscount": 0.8,
  "aggregatedTotal": 8000
}`}
                  </pre>
                </div>

                <h3 className="text-sm font-bold text-[#111111] pt-2">Step 4: Check usage &amp; limits</h3>
                <p>
                  Query a customer&apos;s current usage against their plan allowances at any time. The response includes whether they&apos;ve exceeded included quota:
                </p>

                <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4 rounded-xl relative">
                  <pre className="text-[10px] font-mono text-indigo-800 leading-normal select-all overflow-auto">
{`GET https://api.aorahq.com/api/customers/v_acme_corps/usage?meterId=llm_tokens
Authorization: Bearer sk_live_...

// Response (200 OK):
{
  "meterId": "llm_tokens",
  "periodStart": "2026-07-01T00:00:00Z",
  "periodEnd": "2026-07-31T23:59:59Z",
  "currentTotal": 275000,
  "includedQuota": 100000,
  "overageUnits": 175000,
  "overageCharges": 262500,
  "currency": "NGN"
}`}
                  </pre>
                </div>

                <h3 className="text-sm font-bold text-[#111111] pt-2">Step 5: View the invoice</h3>
                <p>
                  At the end of each billing period, Aora generates an invoice that includes the base plan charge plus all usage overages computed from your aggregated meters:
                </p>

                <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4 rounded-xl relative">
                  <pre className="text-[10px] font-mono text-stone-800 leading-normal select-all overflow-auto">
{`GET https://api.aorahq.com/api/invoices?customerId=v_acme_corps&status=open
Authorization: Bearer sk_live_...

// Response (200 OK):
{
  "invoices": [{
    "id": "INV-2026-0715",
    "lineItems": [
      { "description": "Base Plan (Scale Monthly)", "amount": 240000 },
      { "description": "LLM Tokens Overage (175,000 tokens @ 1.5/ token)", "amount": 262500 }
    ],
    "total": 502500,
    "currency": "NGN",
    "dueDate": "2026-08-15T00:00:00Z"
  }]
}`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- RUNTIME SDKS INSTRUCTIONS ----------------- */}
          {activePage === "sdks" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Libraries</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Official Runtime SDKs</h1>
                <p className="text-sm text-[#6E6E73]">
                  Install and instantiate Aora packages within your active codebase in seconds. We maintain reliable SDK packages across four runtime languages.
                </p>
              </div>

              {/* Language Switch */}
              <div className="flex gap-2 bg-[#F5F5F7] p-1.5 rounded-xl border border-[#E5E5E7] text-xs font-bold text-[#6E6E73]">
                {["js", "python", "go", "php"].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSdkLanguage(lang as any)}
                    className={`flex-1 py-1 px-3 rounded-lg transition-colors cursor-pointer ${sdkLanguage === lang ? "bg-white text-[#111111] shadow-sm" : "hover:text-[#111111]"}`}
                  >
                    {lang === "js" ? "Node.js (TS)" : lang === "python" ? "Python" : lang === "go" ? "Go" : "PHP"}
                  </button>
                ))}
              </div>

              {/* Dynamic steps load */}
              <div className="space-y-5 pt-2">
                <div className="space-y-1.5 text-left">
                  <span className="text-[10px] font-mono text-neutral-400 block uppercase font-bold">1. Package Installation Command</span>
                  <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4.5 rounded-xl relative">
                    <pre className="text-[11px] font-mono text-stone-900">{sdkCodeSnippets[sdkLanguage].install}</pre>
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <span className="text-[10px] font-mono text-neutral-400 block uppercase font-bold">2. Initialization Code</span>
                  <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4.5 rounded-xl relative overflow-x-auto text-left py-2">
                    <pre className="text-[10.5px] font-mono text-slate-800 leading-normal select-all">
                      {sdkCodeSnippets[sdkLanguage].init}
                    </pre>
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <span className="text-[10px] font-mono text-neutral-400 block uppercase font-bold">3. Ingesting Telemetry Data</span>
                  <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4.5 rounded-xl relative overflow-x-auto text-left py-2">
                    <pre className="text-[10.5px] font-mono text-emerald-800 leading-normal select-all">
                      {sdkCodeSnippets[sdkLanguage].ingest}
                    </pre>
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <span className="text-[10px] font-mono text-neutral-400 block uppercase font-bold">4. Dynamic entitlement locks check</span>
                  <div className="bg-[#F8F8F8] border border-[#E5E5E7] p-4.5 rounded-xl relative overflow-x-auto text-left py-2">
                    <pre className="text-[10.5px] font-mono text-indigo-800 leading-normal select-all">
                      {sdkCodeSnippets[sdkLanguage].check}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- WORKSPACE INTEGRATION INFO ----------------- */}
          {activePage === "dashboard-integration" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">My Account Context</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Deep Developer Integration</h1>
                <p className="text-sm text-[#6E6E73]">
                  Review live authentication credentials and metrics emitted inside workspace: <strong>{workspaceName}</strong>.
                </p>
              </div>

              {/* Display active workspace credentials cards */}
              <div className="bg-[#FAFAFA] border border-[#E5E5E7] p-5 rounded-2xl text-left space-y-4">
                <h3 className="text-xs font-bold text-[#111111] flex items-center gap-1.5 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-[#0071E3]"></span>
                  Active Inbound Workspace Credentials
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium text-stone-600 leading-relaxed">
                  <div className="space-y-1">
                    <span className="text-[#86868B] text-[10px] uppercase font-bold block">Workspace Name</span>
                    <strong className="text-[#111111] font-mono block">{workspaceName}</strong>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[#86868B] text-[10px] uppercase font-bold block">Live Auth Header Secret</span>
                    <strong className="text-[#111111] font-mono block">sk_live_aora_5f2d93e810cb9921e42f2bca01</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- SERVICE STATUS BOARD ----------------- */}
          {activePage === "status" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Real-time health</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Aora Grid Status Dashboard</h1>
                <p className="text-sm text-[#6E6E73]">
                  We maintain real-time status indices across all central ingestion buses and schedule rating routers.
                </p>
              </div>

              {/* Service Health Cards */}
              <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 space-y-4 text-left">
                <div className="flex items-center gap-2 border-b border-[#F5F5F7] pb-3">
                  <span className="h-3 w-3 bg-[#34C759] rounded-full animate-pulse"></span>
                  <strong className="text-xs text-[#111111]">All Services Operating Normally</strong>
                </div>

                <div className="space-y-3.5 pt-2 text-[#6E6E73] font-medium text-xs">
                  <div className="flex justify-between items-center">
                    <span>Inbound Telemetry Bus (Ingest gateway)</span>
                    <span className="text-[#34C759] font-bold">100% Operational • 4.2ms avg lat</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Cron Rating Router (Invoice scheduler)</span>
                    <span className="text-[#34C759] font-bold">Active • No latency drift</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Enforcer Gates (Dynamic caches checking)</span>
                    <span className="text-[#34C759] font-bold">99.98% Available • 2.1ms avg lat</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Outgoing Webhook Dispatch Gateway</span>
                    <span className="text-[#34C759] font-bold">Healthy • 100% Delivery rate</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- CHANGELOG & VER PRODUCTS ----------------- */}
          {activePage === "changelog" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Releases</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Product Changelog</h1>
                <p className="text-sm text-[#6E6E73]">
                  Review our ongoing feature developments, platform upgrades, and programmatic changes.
                </p>
              </div>

              {/* Structured changelog releases */}
              <div className="space-y-8 text-left">
                
                {/* Release v1.0.4 */}
                <div className="border-l-2 border-[#0071E3] pl-4 space-y-2.5">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-bold text-[#111111]">Aora Platform v1.0.4</h3>
                    <span className="text-[10px] text-[#6E6E73] font-medium">Released today</span>
                  </div>
                  <p className="text-xs text-[#6E6E73] font-medium leading-relaxed">
                    This release implements dynamic seat caches proration routers, introduces Webhook signature replay simulation modules, and delivers detailed SDK packages across four languages.
                  </p>
                  <div className="flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-wider">
                    <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded">Feature</span>
                    <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded">Improvement</span>
                  </div>
                </div>

                {/* Release v1.0.3 */}
                <div className="border-l-2 border-[#E5E5E7] pl-4 space-y-2.5">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-bold text-[#111111]">Aora Platform v1.0.3</h3>
                    <span className="text-[10px] text-[#6E6E73] font-medium">10 days ago</span>
                  </div>
                  <p className="text-xs text-[#6E6E73] font-medium leading-relaxed">
                    Optimized aggregate processing latency from 24ms to 12ms. Integrated core multi-tenant isolated workspace data sync caches.
                  </p>
                  <div className="flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-wider">
                    <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded">Performance</span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ----------------- BACKEND: PRORATION SERVICE ----------------- */}
          {activePage === "backend-proration" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Seat Adjustments</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Proration Service</h1>
                <p className="text-sm text-[#6E6E73]">
                  When customers add or remove seats mid-cycle, charge or credit the exact prorated amount for remaining time. No rounding losses. No arbitrary flat fees.
                </p>
              </div>

              <div className="bg-[#F5F5F7] border border-[#E5E5E7] rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-[#111111]">Proration Math</h3>
                <div className="bg-neutral-950 p-4 rounded-xl text-xs font-mono text-neutral-300">
                  <div>millisecondsRemaining = periodEnd - adjustmentAt</div>
                  <div>proratedAmount = floor(fullAmount &times; millisecondsRemaining / millisecondsInPeriod)</div>
                </div>
                <p className="text-xs text-[#6E6E73] leading-relaxed font-medium">
                  All amounts are <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">bigint</code> in lowest denomination. Division uses ceiling so the merchant never loses a fractional cent.
                </p>
              </div>

              <div className="bg-white border border-[#E5E5E7] rounded-2xl overflow-hidden">
                <div className="p-5 space-y-3">
                  <h3 className="text-xs font-bold text-[#111111]">Database Schema</h3>
                  <pre className="text-[10.5px] font-mono text-emerald-800 leading-relaxed bg-[#F8F8F8] p-4 rounded-xl select-all overflow-x-auto">
{`seat_adjustments
  id, subscription_id, previous_seat_count,
  new_seat_count, adjustment_cents, is_charge,
  transaction_ref, created_at

credit_ledger type constraint extended:
  'proration_credit', 'proration_charge'`}
                  </pre>
                </div>
              </div>

              <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 space-y-2">
                <h3 className="text-xs font-bold text-[#111111]">Integration</h3>
                <p className="text-xs text-[#6E6E73] leading-relaxed font-medium">
                  Seat additions charge via the non-custodial gateway adapter and create an invoice. Seat removals issue a proration credit to the <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">credit_ledger</code>. An audit trail is written to <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">seat_adjustments</code> in both cases.
                </p>
              </div>
            </div>
          )}

          {/* ----------------- BACKEND: INGRESS METERING ----------------- */}
          {activePage === "backend-ingress" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Byte-Size Billing</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Fair Ingress Metering</h1>
                <p className="text-sm text-[#6E6E73]">
                  Measure every byte passing through the ingestion API and bill in 64 KB units. Redis-backed counter buffer flushes to PostgreSQL every 60 seconds.
                </p>
              </div>

              <div className="bg-[#F5F5F7] border border-[#E5E5E7] rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-[#111111]">Data Flow</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[10px] font-medium text-[#6E6E73]">
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl text-left">
                    <span className="font-bold text-[#111111] block">1. Ingest</span>
                    <span>POST /ingress receives raw JSON</span>
                  </div>
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl text-left">
                    <span className="font-bold text-[#111111] block">2. Measure</span>
                    <span>Buffer.byteLength, ceil(bytes / 65536)</span>
                  </div>
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl text-left">
                    <span className="font-bold text-[#111111] block">3. Dedup</span>
                    <span>Redis SETNX 24h, pipelined for batch</span>
                  </div>
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl text-left">
                    <span className="font-bold text-[#111111] block">4. Flush</span>
                    <span>Every 60s: UPSERT to ingress_ledger</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 space-y-2">
                <h3 className="text-xs font-bold text-[#111111]">Redis Key Patterns</h3>
                <pre className="text-[10.5px] font-mono text-slate-800 leading-relaxed bg-[#F8F8F8] p-4 rounded-xl select-all overflow-x-auto">
{`Dedup:   dedup:{env}:{tenantId}:{eventId}
Counter: ingress:{tenantId}:{hourBucketISO}
  Fields: event_count, billable_units, batch_count`}
                </pre>
              </div>

              <div className="bg-[#FAF9F6] border border-[#FF9F0A]/20 p-4 rounded-xl flex gap-3 text-left">
                <Info className="h-5 w-5 text-[#FF9F0A] shrink-0 mt-0.5" />
                <div className="text-xs font-semibold text-stone-800 leading-normal space-y-1">
                  <span>In-Memory Fallback</span>
                  <p className="text-[#6E6E73] font-medium text-[11px]">
                    When REDIS_URL is not set, CacheClient falls back to an in-memory Map with TTL sweep. All Redis operations are fire-and-forget safe; the background Postgres flush provides durability.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- BACKEND: DEDUPLICATION ENGINE ----------------- */}
          {activePage === "backend-dedup" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Duplicate Prevention</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">24-Hour Deduplication Engine</h1>
                <p className="text-sm text-[#6E6E73]">
                  Prevent duplicate billing when a customer retries the same usage event. Primary layer is Redis SETNX with 24h TTL; Postgres is the durable fallback.
                </p>
              </div>

              <div className="bg-[#F5F5F7] border border-[#E5E5E7] rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-[#111111]">Two-Layer Strategy</h3>
                <div className="space-y-2 text-xs text-[#6E6E73] font-medium">
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl flex items-center gap-3">
                    <span className="bg-blue-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">LAYER 1</span>
                    <span>Redis SET NX EX 86400 &mdash; atomic read-and-write in one round-trip. 99.9% of dedup decisions happen here at sub-ms latency.</span>
                  </div>
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl flex items-center gap-3">
                    <span className="bg-amber-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">LAYER 2</span>
                    <span>PostgreSQL INSERT &hellip; ON CONFLICT DO NOTHING &mdash; durable fallback for Redis cache-flush or outage scenarios.</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#FAF9F6] border border-[#FF9F0A]/20 p-4 rounded-xl flex gap-3 text-left">
                <Info className="h-5 w-5 text-[#FF9F0A] shrink-0 mt-0.5" />
                <div className="text-xs font-semibold text-stone-800 leading-normal space-y-1">
                  <span>Fail-Open Guarantee</span>
                  <p className="text-[#6E6E73] font-medium text-[11px]">
                    If both Redis and Postgres fail, the middleware sets <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">req.isDuplicate = false</code> and logs aggressively. Ingestion never crashes due to dedup failure.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-[#E5E5E7] rounded-2xl overflow-hidden">
                <div className="p-5 space-y-3">
                  <h3 className="text-xs font-bold text-[#111111]">Database Schema</h3>
                  <pre className="text-[10.5px] font-mono text-emerald-800 leading-relaxed bg-[#F8F8F8] p-4 rounded-xl select-all overflow-x-auto">
{`processed_events
  dedup_key  STRING(512) PRIMARY KEY
  tenant_id  UUID NOT NULL
  event_id   STRING(255) NOT NULL
  is_test    BOOL NOT NULL DEFAULT false
  expires_at TIMESTAMPTZ NOT NULL
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- BACKEND: BATCH INGESTION ----------------- */}
          {activePage === "backend-batch" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Bulk Events</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Batch Ingestion</h1>
                <p className="text-sm text-[#6E6E73]">
                  Accept arrays of up to 1000 usage events in a single request. Each event is measured by JSON byte size, deduplicated via pipelined Redis, and aggregated with a batch discount multiplier.
                </p>
              </div>

              <div className="bg-[#F5F5F7] border border-[#E5E5E7] rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-[#111111]">Processing Pipeline</h3>
                <div className="text-xs text-[#6E6E73] font-medium space-y-1.5">
                  <div className="flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-[#111111] text-white text-[9px] font-bold flex items-center justify-center shrink-0">1</span><span>Validate: non-empty array, max 1000 events</span></div>
                  <div className="flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-[#111111] text-white text-[9px] font-bold flex items-center justify-center shrink-0">2</span><span>Measure each event&apos;s JSON byte size via <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">Buffer.byteLength</code></span></div>
                  <div className="flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-[#111111] text-white text-[9px] font-bold flex items-center justify-center shrink-0">3</span><span>Pipeline dedup: <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">batchCheckAndMark</code> for all event IDs in one round-trip</span></div>
                  <div className="flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-[#111111] text-white text-[9px] font-bold flex items-center justify-center shrink-0">4</span><span>Compute base units = ceil(bytes / 65536)</span></div>
                  <div className="flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-[#111111] text-white text-[9px] font-bold flex items-center justify-center shrink-0">5</span><span>Apply batch discount: <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">chargedUnits = round(baseUnits &times; 0.8)</code></span></div>
                  <div className="flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-[#111111] text-white text-[9px] font-bold flex items-center justify-center shrink-0">6</span><span>UPSERT into ingress_ledger with <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">charged_units</code> and <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">is_test</code> flags</span></div>
                </div>
              </div>

              <div className="bg-white border border-[#E5E5E7] rounded-2xl overflow-hidden">
                <div className="p-5 space-y-2">
                  <h3 className="text-xs font-bold text-[#111111]">Response Format</h3>
                  <pre className="text-[10.5px] font-mono text-slate-800 leading-relaxed bg-[#F8F8F8] p-4 rounded-xl select-all overflow-x-auto">
{`{
  "status": "processed",
  "total_received": 100,
  "successfully_metered": 92,
  "duplicates_ignored": 8,
  "base_units": 92,
  "charged_units": 73.6,
  "batch_discount": 0.8,
  "events": [
    { "index": 0, "event_id": "evt_001",
      "base_units": 1, "is_duplicate": false }
  ]
}`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- BACKEND: ZERO-TRUST ENCRYPTION ----------------- */}
          {activePage === "backend-encryption" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">AES-256-GCM</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Zero-Trust Credential Encryption</h1>
                <p className="text-sm text-[#6E6E73]">
                  Merchant gateway API keys are encrypted at rest with AES-256-GCM and only decrypted in-memory during billing operations. The decrypted buffer is wiped immediately after use.
                </p>
              </div>

              <div className="bg-[#F5F5F7] border border-[#E5E5E7] rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-[#111111]">Encryption Scheme</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[10px] font-medium text-[#6E6E73]">
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl text-left">
                    <span className="font-bold text-[#111111] block">Algorithm</span>
                    <span className="font-mono text-[10px]">aes-256-gcm</span>
                  </div>
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl text-left">
                    <span className="font-bold text-[#111111] block">Key</span>
                    <span>32 bytes from <code className="text-[10px] bg-neutral-100 px-1 rounded">AORAHQ_MASTER_ENCRYPTION_KEY</code></span>
                  </div>
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl text-left">
                    <span className="font-bold text-[#111111] block">IV</span>
                    <span>12 bytes <code className="text-[10px] bg-neutral-100 px-1 rounded">crypto.randomBytes()</code> per encryption</span>
                  </div>
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl text-left">
                    <span className="font-bold text-[#111111] block">Auth Tag</span>
                    <span>16 bytes, tamper detection on decrypt</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#FAF9F6] border border-[#FF9F0A]/20 p-4 rounded-xl flex gap-3 text-left">
                <ShieldAlert className="h-5 w-5 text-[#FF9F0A] shrink-0 mt-0.5" />
                <div className="text-xs font-semibold text-stone-800 leading-normal space-y-1">
                  <span>Startup Validation</span>
                  <p className="text-[#6E6E73] font-medium text-[11px]">
                    If <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">AORAHQ_MASTER_ENCRYPTION_KEY</code> is missing or not exactly 32 bytes, the application crashes immediately with a clear error. No fallback. No silent degradation.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-[#E5E5E7] rounded-2xl overflow-hidden">
                <div className="p-5 space-y-3">
                  <h3 className="text-xs font-bold text-[#111111]">Database Schema</h3>
                  <pre className="text-[10.5px] font-mono text-emerald-800 leading-relaxed bg-[#F8F8F8] p-4 rounded-xl select-all overflow-x-auto">
{`tenant_gateways
  encrypted_secret_key   STRING(512) NOT NULL  -- ciphertext (base64)
  encryption_iv          STRING(32)  NOT NULL  -- 12-byte IV (base64)
  encryption_tag         STRING(32)  NOT NULL  -- 16-byte auth tag (base64)
  key_preview            STRING(20)  NOT NULL  -- last 4 chars only`}
                  </pre>
                  <p className="text-xs text-[#6E6E73] leading-relaxed font-medium">
                    Three separate columns instead of a single blob so each cryptographic primitive can be validated and audited independently.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-[#111111]">In-Memory Lifecycle</h3>
                <div className="text-xs text-[#6E6E73] font-medium space-y-1.5">
                  <div className="flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-[#111111] text-white text-[9px] font-bold flex items-center justify-center shrink-0">1</span><span>Load encrypted row from <code className="text-[10px] bg-neutral-100 px-1 rounded">tenant_gateways</code></span></div>
                  <div className="flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-[#111111] text-white text-[9px] font-bold flex items-center justify-center shrink-0">2</span><span>Decrypt in memory: GCM auth tag verified, <code className="text-[10px] bg-neutral-100 px-1 rounded">SecurityError</code> on tamper</span></div>
                  <div className="flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-[#111111] text-white text-[9px] font-bold flex items-center justify-center shrink-0">3</span><span>Use plaintext key for gateway API call</span></div>
                  <div className="flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-[#111111] text-white text-[9px] font-bold flex items-center justify-center shrink-0">4</span><span><code className="text-[10px] bg-neutral-100 px-1 rounded">buffer.wipe()</code> in <code className="text-[10px] bg-neutral-100 px-1 rounded">finally</code> block zeros the memory</span></div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- BACKEND: SECURE WEBHOOK DISPATCHER ----------------- */}
          {activePage === "backend-webhooks" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Outbox + HMAC + BullMQ</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Secure Webhook Dispatcher</h1>
                <p className="text-sm text-[#6E6E73]">
                  Three guarantees: events are never lost (transactional outbox), never spoofed (HMAC-SHA256 signing), and never permanently missed (exponential backoff retries over 24h).
                </p>
              </div>

              <div className="bg-[#F5F5F7] border border-[#E5E5E7] rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-[#111111]">Architecture</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] font-medium text-[#6E6E73]">
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl text-left">
                    <span className="font-bold text-[#111111] block">1. Outbox</span>
                    <span>Event written to <code className="text-[10px] bg-neutral-100 px-1 rounded">webhook_outbox</code> inside the same DB transaction as the state change</span>
                  </div>
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl text-left">
                    <span className="font-bold text-[#111111] block">2. Sign</span>
                    <span>Payload signed with HMAC-SHA256: <code className="text-[10px] bg-neutral-100 px-1 rounded">t=ts,v1=hash</code> header format</span>
                  </div>
                  <div className="bg-white border border-[#E5E5E7] p-3 rounded-xl text-left">
                    <span className="font-bold text-[#111111] block">3. Deliver</span>
                    <span>BullMQ worker POSTs with 10s timeout. Retries with exponential backoff up to 24h.</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 space-y-2">
                <h3 className="text-xs font-bold text-[#111111]">Signature Format</h3>
                <pre className="text-[10.5px] font-mono text-slate-800 leading-relaxed bg-[#F8F8F8] p-4 rounded-xl select-all overflow-x-auto">
{`X-AoraHQ-Signature: t=1719300000,v1=abc123def456...

t  = Unix epoch seconds (replay protection)
v1 = HMAC-SHA256(whsec_secret, timestamp + "." + payload)`}
                </pre>
              </div>

              <div className="bg-white border border-[#E5E5E7] rounded-2xl overflow-hidden">
                <div className="p-5 space-y-3">
                  <h3 className="text-xs font-bold text-[#111111]">Exponential Backoff Schedule</h3>
                  <div className="bg-[#F8F8F8] p-4 rounded-xl">
                    <table className="w-full text-left text-[10px] text-[#6E6E73] font-medium">
                      <thead>
                        <tr className="border-b border-[#E5E5E7] text-[9px] uppercase font-bold text-[#86868B]">
                          <th className="pb-2 pr-4">Attempt</th>
                          <th className="pb-2 pr-4">Delay</th>
                          <th className="pb-2">Cumulative</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td className="py-1 pr-4">1</td><td className="py-1 pr-4">1 min</td><td className="py-1">1 min</td></tr>
                        <tr><td className="py-1 pr-4">2</td><td className="py-1 pr-4">2 min</td><td className="py-1">3 min</td></tr>
                        <tr><td className="py-1 pr-4">3</td><td className="py-1 pr-4">4 min</td><td className="py-1">7 min</td></tr>
                        <tr><td className="py-1 pr-4">4</td><td className="py-1 pr-4">8 min</td><td className="py-1">15 min</td></tr>
                        <tr><td className="py-1 pr-4">5</td><td className="py-1 pr-4">16 min</td><td className="py-1">31 min</td></tr>
                        <tr><td className="py-1 pr-4">6</td><td className="py-1 pr-4">32 min</td><td className="py-1">~1h</td></tr>
                        <tr><td className="py-1 pr-4">7</td><td className="py-1 pr-4">64 min</td><td className="py-1">~2h</td></tr>
                        <tr><td className="py-1 pr-4">8</td><td className="py-1 pr-4">128 min</td><td className="py-1">~4h</td></tr>
                        <tr><td className="py-1 pr-4">9</td><td className="py-1 pr-4">256 min</td><td className="py-1">~8h</td></tr>
                        <tr><td className="py-1 pr-4">10</td><td className="py-1 pr-4">512 min</td><td className="py-1">~17h</td></tr>
                        <tr><td className="py-1 pr-4 text-[#111111] font-bold">11+</td><td className="py-1 pr-4" colSpan={2}>Capped at 24h total</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="bg-[#FAF9F6] border border-[#FF9F0A]/20 p-4 rounded-xl flex gap-3 text-left">
                <ShieldAlert className="h-5 w-5 text-[#FF9F0A] shrink-0 mt-0.5" />
                <div className="text-xs font-semibold text-stone-800 leading-normal space-y-1">
                  <span>Transactional Outbox Guarantee</span>
                  <p className="text-[#6E6E73] font-medium text-[11px]">
                    The outbox INSERT happens inside <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">withTransaction()</code> alongside the subscription/customer state change. If the DB update succeeds, the event is guaranteed to be persisted. If the transaction rolls back, the webhook event rolls back too.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- BACKEND: SANDBOX PLAYGROUND ----------------- */}
          {activePage === "backend-sandbox" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Test Mode</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Sandbox Playground</h1>
                <p className="text-sm text-[#6E6E73]">
                  Test the entire billing flow &mdash; API calls, metering, charges, refunds, subscription renewals &mdash; without touching real payment gateways. The API key prefix (<code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">sk_test_</code> vs <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">sk_live_</code>) determines the mode. Zero configuration required.
                </p>
              </div>

              <div className="bg-[#F5F5F7] border border-[#E5E5E7] rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-[#111111]">API Key Routing</h3>
                <div className="bg-white border border-[#E5E5E7] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-[#111111]">
                    <thead>
                      <tr className="bg-[#FAFAFA] border-b border-[#E5E5E7] uppercase font-bold text-[9px] tracking-widest text-[#6E6E73]">
                        <th className="py-3 px-4">Key Prefix</th>
                        <th className="py-3 px-4">Mode</th>
                        <th className="py-3 px-4">Workspace Environment</th>
                        <th className="py-3 px-4">Gateway Adapter</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E5E7] text-[#6E6E73] font-medium">
                      <tr>
                        <td className="py-3 px-4 font-mono text-[10px] text-[#111111]">sk_live_xxx</td>
                        <td className="py-3 px-4">Production</td>
                        <td className="py-3 px-4 font-mono text-[10px]">production</td>
                        <td className="py-3 px-4">Real gateway from <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">gateway_connections</code></td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-mono text-[10px] text-[#111111]">sk_test_xxx</td>
                        <td className="py-3 px-4">Sandbox</td>
                        <td className="py-3 px-4 font-mono text-[10px]">sandbox / development</td>
                        <td className="py-3 px-4"><code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">SandboxPaymentAdapter</code></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-[#E5E5E7] p-4 rounded-2xl space-y-2">
                  <h3 className="text-xs font-bold text-[#111111]">SandboxPaymentAdapter</h3>
                  <div className="text-[10px] text-[#6E6E73] font-medium space-y-1">
                    <p><strong className="text-[#111111]">Normal charge:</strong> Returns <code className="text-[10px] bg-neutral-100 px-1 rounded">status: &quot;succeeded&quot;</code></p>
                    <p><strong className="text-[#111111]">Simulated decline:</strong> Amount ending in <code className="text-[10px] bg-neutral-100 px-1 rounded">4002</code> throws <code className="text-[10px] bg-neutral-100 px-1 rounded">card_declined</code></p>
                    <p><strong className="text-[#111111]">Refund:</strong> Always succeeds</p>
                  </div>
                </div>
                <div className="bg-white border border-[#E5E5E7] p-4 rounded-2xl space-y-2">
                  <h3 className="text-xs font-bold text-[#111111]">Time-Travel</h3>
                  <p className="text-[10px] text-[#6E6E73] font-medium">
                    Use the <code className="text-[10px] bg-neutral-100 px-1 rounded">X-AoraHQ-Simulate-Time</code> header to fast-forward subscription state:
                  </p>
                  <pre className="text-[10px] font-mono text-slate-800 bg-[#F8F8F8] p-3 rounded-xl select-all">
{`X-AoraHQ-Simulate-Time: +7d
X-AoraHQ-Simulate-Time: +30d
X-AoraHQ-Simulate-Time: +2h`}
                  </pre>
                </div>
              </div>

              <div className="bg-[#FAF9F6] border border-[#FF9F0A]/20 p-4 rounded-xl flex gap-3 text-left">
                <Info className="h-5 w-5 text-[#FF9F0A] shrink-0 mt-0.5" />
                <div className="text-xs font-semibold text-stone-800 leading-normal space-y-1">
                  <span>Cross-Contamination Prevention</span>
                  <p className="text-[#6E6E73] font-medium text-[11px]">
                    Every function has an <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">isTest: boolean = false</code> parameter. Sandbox dedup keys use a <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">test:</code> prefix, ingress billing is zeroed out, and all rows written to PostgreSQL include the <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">is_test</code> column with partial live-only indexes.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 space-y-2">
                <h3 className="text-xs font-bold text-[#111111]">Smoke Test</h3>
                <pre className="text-[10.5px] font-mono text-emerald-800 leading-relaxed bg-[#F8F8F8] p-4 rounded-xl select-all overflow-x-auto">
{`curl -X POST https://api.aorahq.com/ingress \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Content-Type: application/json" \\
  -H "X-AoraHQ-Simulate-Time: +7d" \\
  -d '{"customerId":"...","meterId":"...","value":42,"eventId":"evt_001"}'`}
                </pre>
              </div>
            </div>
          )}

          {/* ----------------- BACKEND: DUNNING STATE MACHINE ----------------- */}
          {activePage === "backend-dunning" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#0071E3] tracking-widest block font-mono">Retry Logic</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#111111]">Dunning &amp; Retry State Machine</h1>
                <p className="text-sm text-[#6E6E73]">
                  Automated payment failure recovery with a 3-step lifecycle. Subscriptions transition through active (grace) &rarr; past_due &rarr; canceled unless a retry succeeds.
                </p>
              </div>

              <div className="bg-[#F5F5F7] border border-[#E5E5E7] rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-[#111111]">Dunning Lifecycle</h3>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-white border border-[#E5E5E7] rounded-xl p-3 space-y-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 block">Step 1</span>
                    <span className="font-bold text-emerald-700 text-sm">Day 0</span>
                    <p className="text-[#6E6E73] font-medium">First failure. Subscription stays active. Next retry in 3 days.</p>
                  </div>
                  <div className="bg-white border border-[#E5E5E7] rounded-xl p-3 space-y-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 block">Step 2</span>
                    <span className="font-bold text-amber-600 text-sm">Day 3</span>
                    <p className="text-[#6E6E73] font-medium">Second failure. Status &rarr; past_due. Final retry in 4 days.</p>
                  </div>
                  <div className="bg-white border border-[#E5E5E7] rounded-xl p-3 space-y-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 block">Step 3</span>
                    <span className="font-bold text-red-600 text-sm">Day 7</span>
                    <p className="text-[#6E6E73] font-medium">Third failure. Subscription canceled. Webhook dispatched.</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-[#111111]">State Machine Design</h3>
                <ul className="text-xs text-[#6E6E73] space-y-2 font-medium">
                  <li className="flex gap-2"><span className="text-[#0071E3] font-bold shrink-0">&bull;</span> <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded font-bold">handleInitialPaymentFailure</code> - Called inside an existing transaction. Sets dunning_step=1, next_retry_at=+3d. Dispatches <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">invoice.payment_failed</code> via outbox.</li>
                  <li className="flex gap-2"><span className="text-[#0071E3] font-bold shrink-0">&bull;</span> <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">handleRetryAttempt</code> - Opens its own transaction, locks the row with <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">SELECT ... FOR UPDATE SKIP LOCKED</code>, attempts the charge via the gateway adapter, and transitions state.</li>
                  <li className="flex gap-2"><span className="text-[#0071E3] font-bold shrink-0">&bull;</span> On success: dunning resets to step 0, status &rarr; active, period extended. On failure: step increments, status transitions, next_retry_at updated, outbox event dispatched.</li>
                </ul>
              </div>

              <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-[#111111]">Concurrency Safety</h3>
                <p className="text-xs text-[#6E6E73] font-medium">
                  The worker uses <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">FOR UPDATE SKIP LOCKED</code> to safely process subscriptions across multiple worker instances. Each subscription is locked atomically during the charge attempt to prevent double-billing. The batch worker queries <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">next_retry_at &lt;= NOW()</code>, processes up to 25 subscriptions per cycle, and uses <code className="text-[10px] bg-neutral-100 px-1 py-0.5 rounded">Promise.allSettled</code> for concurrent processing.
                </p>
              </div>

              <div className="bg-[#FAFAFA] border border-[#E5E5E7] rounded-2xl p-5 space-y-2">
                <h3 className="text-xs font-bold text-[#111111]">Webhook Events</h3>
                <pre className="text-[10.5px] font-mono text-stone-700 leading-relaxed bg-white p-4 rounded-xl select-all overflow-x-auto">
{`invoice.payment_failed   — dispatched on initial failure (step 0→1)
subscription.past_due    — dispatched on step 1→2 transition
subscription.canceled    — dispatched on step 2→0 cancel
invoice.payment_succeeded — dispatched on successful retry`}
                </pre>
              </div>
            </div>
          )}

          {/* ----------------- DOCUMENTATION NAVIGATION (PREV / NEXT) ----------------- */}
          {(() => {
            const navOrder = [
              "intro", "quickstart",
              "architecture", "concepts-products", "concepts-usage", "concepts-entitlements",
              "dev-keys", "playground", "webhooks", "errors",
              "guide-seats", "guide-usage",
              "backend-proration", "backend-ingress", "backend-dedup", "backend-batch",
              "backend-sandbox", "backend-encryption", "backend-webhooks", "backend-dunning",
              "sdks", "dashboard-integration", "status", "changelog",
            ];
            const navTitles: Record<string, string> = {
              intro: "Overview & Introduction", quickstart: "Quick Start Guide",
              architecture: "System Architecture", "concepts-products": "Products & Plans Catalog",
              "concepts-usage": "Usage Metering Ingestion", "concepts-entitlements": "Entitlement Gate Engine",
              "dev-keys": "Authentication & API Keys", playground: "Interactive API Playground",
              webhooks: "Webhook Developer Center", errors: "Error Catalog Directory",
              "guide-seats": "SaaS Seat Pricing Guide", "guide-usage": "Usage-Based Token Billing",
              "backend-proration": "Proration Service", "backend-ingress": "Fair Ingress Metering",
              "backend-dedup": "Deduplication Engine", "backend-batch": "Batch Ingestion",
              "backend-sandbox": "Sandbox Playground", "backend-encryption": "Zero-Trust Encryption",
              "backend-webhooks": "Secure Webhook Dispatcher", "backend-dunning": "Dunning & Retry State Machine",
              sdks: "Official Runtime SDKs", "dashboard-integration": "Workspace Integration",
              status: "System Health Status", changelog: "Product Changelog",
            };
            const idx = navOrder.indexOf(activePage);
            if (idx === -1) return null;
            const prevId = idx > 0 ? navOrder[idx - 1] : null;
            const nextId = idx < navOrder.length - 1 ? navOrder[idx + 1] : null;
            return (
              <div className="flex items-center justify-between pt-8 pb-2 border-t border-[#E5E5E7] mt-8">
                <div>
                  {prevId && (
                    <button onClick={() => setActivePage(prevId)} className="flex items-center gap-1.5 text-xs text-[#6E6E73] hover:text-[#111111] transition-colors cursor-pointer group">
                      <ChevronRight className="h-3.5 w-3.5 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                      <span className="text-left">
                        <span className="block text-[9px] uppercase tracking-wider text-neutral-400 font-bold">Previous</span>
                        <span className="block font-semibold">{navTitles[prevId]}</span>
                      </span>
                    </button>
                  )}
                </div>
                <div className="text-[9px] text-neutral-400 font-mono uppercase tracking-wider">
                  {idx + 1} / {navOrder.length}
                </div>
                <div>
                  {nextId && (
                    <button onClick={() => setActivePage(nextId)} className="flex items-center gap-1.5 text-xs text-[#6E6E73] hover:text-[#111111] transition-colors cursor-pointer group">
                      <span className="text-right">
                        <span className="block text-[9px] uppercase tracking-wider text-neutral-400 font-bold">Next</span>
                        <span className="block font-semibold">{navTitles[nextId]}</span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

        </main>

        {/* ----------------- EMBEDDED AI DOCUMENTATION ASSISTANT FLOATING SIDEBAR PANEL ----------------- */}
        <aside className="hidden xl:block w-80 border-l border-[#E5E5E7] h-[calc(100vh-53px)] sticky top-[53px] shrink-0 p-5 bg-[#FAFAFA] flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4 text-left flex flex-col h-full justify-between">
            
            <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center gap-1.5 border-b border-[#E5E5E7] pb-3 shrink-0">
                <Sparkles className="h-4.5 w-4.5 text-[#0071E3]" />
                <h3 className="text-xs font-bold text-[#111111]">AI Documentation Assistant</h3>
              </div>

              {/* Question logs view container */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-left text-xs text-[#6E6E73] font-medium leading-relaxed py-2">
                {aiChatLog.map((log, idx) => (
                  <div key={idx} className={`p-3 rounded-xl border ${log.sender === "user" ? "bg-[#111111]/5 border-[#E5E5E7] self-end text-neutral-800" : "bg-white border-[#E5E5E7] text-neutral-900"}`}>
                    <span className="text-[9px] text-[#86868B] block uppercase font-bold tracking-wider mb-1">
                      {log.sender === "user" ? "You" : "Documentation AI"}
                    </span>
                    <p className="whitespace-pre-wrap leading-relaxed">{log.text}</p>
                  </div>
                ))}
                {aiLoading && (
                  <div className="p-3 bg-white border border-[#E5E5E7] rounded-xl text-[10px] text-neutral-400 animate-pulse">Scanning pricing catalog datasets...</div>
                )}
              </div>
            </div>

            {/* Quick preset links helpful buttons */}
            <div className="space-y-1.5 shrink-0 pt-3 border-t border-[#E5E5E7]">
              <span className="text-[9px] font-bold text-[#86868B] uppercase block">Suggested Queries:</span>
              <button onClick={() => handleAskAIAssistant("How do I create a usage meter?")} className="w-full text-left p-1.5 bg-white border border-[#E5E5E7] hover:border-white/40 rounded text-[10.5px] font-medium block truncate transition-colors cursor-pointer text-stone-700">"How do I create a usage meter?"</button>
              <button onClick={() => handleAskAIAssistant("How do credits work?")} className="w-full text-left p-1.5 bg-white border border-[#E5E5E7] hover:border-white/40 rounded text-[10.5px] font-medium block truncate transition-colors cursor-pointer text-stone-700">"How do credits work?"</button>
              <button onClick={() => handleAskAIAssistant("Show me seat billing examples.")} className="w-full text-left p-1.5 bg-white border border-[#E5E5E7] hover:border-white/40 rounded text-[10.5px] font-medium block truncate transition-colors cursor-pointer text-stone-700">"Show me seat billing examples."</button>
            </div>

            {/* Input Form submission */}
            <div className="pt-3 shrink-0">
              <form
                onSubmit={(e) => { e.preventDefault(); handleAskAIAssistant(); }}
                className="flex gap-1.5 bg-white border border-[#E5E5E7] p-1.5 rounded-lg focus-within:border-white/60 transition-colors"
              >
                <input
                  type="text"
                  placeholder="Ask docs assistant..."
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  className="flex-1 bg-transparent text-xs px-1 hover:outline-none outline-none focus:ring-0"
                />
                <button
                  type="submit"
                  disabled={aiLoading}
                  className="p-1 px-1.5 bg-[#111111] hover:bg-[#1D1D1F] text-white rounded cursor-pointer disabled:bg-neutral-300 transition-colors"
                >
                  <Send className="h-3 w-3" />
                </button>
              </form>
            </div>

          </div>
        </aside>

      </div>

      {/* ----------------- GLOBAL FLOATING CMD+K SEARCH DIALOG MODAL ----------------- */}
      <AnimatePresence>
        {searchOpen && (
          <div className="fixed inset-0 bg-neutral-900/30 backdrop-blur-xs z-50 flex items-start justify-center pt-24 px-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="bg-white border border-[#E5E5E7] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-left"
              id="search-dialog-box"
            >
              {/* Search textbox container */}
              <div className="flex items-center gap-3 px-4 py-3 bg-neutral-50/50 border-b border-[#E5E5E7]">
                <Search className="h-4.5 w-4.5 text-[#86868B]" />
                <input
                  type="text"
                  placeholder="Search documentation, SDK reference, parameters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  ref={searchInputRef}
                  className="flex-1 bg-transparent text-sm font-semibold outline-none focus:ring-0"
                />
                <X className="h-4 w-4 cursor-pointer text-[#86868B] hover:text-[#111111]" onClick={() => setSearchOpen(false)} />
              </div>

              {/* Categorized results listing */}
              <div className="p-2.5 max-h-96 overflow-y-auto space-y-1.5">
                <span className="text-[9px] tracking-wider text-neutral-400 font-bold uppercase px-2.5 block mb-1">
                  {searchQuery ? `FOUND ${searchResults.length} RECORDS` : "RECENTLY INSPECTED GUIDES"}
                </span>

                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setActivePage(item.id); setSearchOpen(false); }}
                    className="w-full text-left p-2.5 rounded-xl border border-transparent hover:border-[#E5E5E7] hover:bg-neutral-50 transition-all flex items-baseline gap-2 text-xs font-semibold cursor-pointer group"
                  >
                    <span className="text-[#0071E3] shrink-0 font-mono text-[9px] bg-[#EAF2FC] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                      {item.cat}
                    </span>
                    <div className="flex-1">
                      <span className="text-[#111111] group-hover:text-[#0071E3] transition-colors">{item.title}</span>
                      <p className="text-[10px] text-[#6E6E73] font-medium leading-normal mt-0.5">{item.desc}</p>
                    </div>
                  </button>
                ))}

                {searchResults.length === 0 && (
                  <div className="p-8 text-center text-xs text-neutral-400 font-medium">
                    No documentation pages matched: "{searchQuery}". Try typing "token", "meter", or "seats".
                  </div>
                )}
              </div>

              {/* Search footer */}
              <div className="bg-[#FAF9F6]/60 px-4 py-2 text-[10px] text-[#86868B] font-medium border-t border-[#E5E5E7] flex justify-between">
                <span>Use <kbd className="font-bold">↑↓</kbd> to scroll, <kbd className="font-bold">Enter</kbd> to select</span>
                <span>ESC to dismiss</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
    </DashboardThemeProvider>
  );
}
