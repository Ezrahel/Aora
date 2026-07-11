import { useState, useEffect } from "react";
import { 
  Code2, 
  Key, 
  Terminal, 
  Check, 
  Play, 
  Clipboard, 
  ShieldCheck, 
  Globe, 
  Activity, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  Sliders,
  Sparkles
} from "lucide-react";

interface DeveloperExperienceViewProps {
  workspace: string;
}

export default function DeveloperExperienceView({ workspace }: DeveloperExperienceViewProps) {
  const [apiKey, setApiKey] = useState("sk_live_aora_5f2d93e810cb9921e42f2bca01");
  const [copiedKey, setCopiedKey] = useState(false);
  const [wsInfo, setWsInfo] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Playground state
  const [playgroundMethod, setPlaygroundMethod] = useState("POST");
  const [playgroundEndpoint, setPlaygroundEndpoint] = useState("/api/usage-events");
  const [playgroundBody, setPlaygroundBody] = useState(
    JSON.stringify({
      customerId: "linear",
      meterId: "compute_meter",
      value: 1500,
      metadata: {
        source: "api_gateway",
        environment: "production"
      }
    }, null, 2)
  );

  const [playgroundResponse, setPlaygroundResponse] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);

  // Sync workspace-specific information and compliance audit log trail
  const loadWorkspaceDetails = async () => {
    setLoadingLogs(true);
    try {
      const q = `?workspace=${encodeURIComponent(workspace)}`;
      const [infoRes, logsRes] = await Promise.all([
        fetch(`/api/workspace-info${q}`),
        fetch(`/api/audit-logs${q}`)
      ]);

      if (infoRes.ok && logsRes.ok) {
        const info = await infoRes.json();
        const logs = await logsRes.json();
        setWsInfo(info);
        setAuditLogs(logs);
        
        // Dynamically pull active key issued to this multi-tenant workspace
        if (info.workspace?.apiKeys?.[0]) {
          setApiKey(info.workspace.apiKeys[0]);
        }
      }
    } catch (err) {
      console.error("Failed to synchronise developer dashboard parameters with deep background:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadWorkspaceDetails();
  }, [workspace]);

  // Handle switching endpoint profiles in playground
  const handleEndpointPreset = (endpoint: string) => {
    setPlaygroundEndpoint(endpoint);
    if (endpoint === "/api/can-access") {
      setPlaygroundMethod("GET");
      setPlaygroundBody("");
    } else {
      setPlaygroundMethod("POST");
      setPlaygroundBody(
        JSON.stringify({
          customerId: "linear",
          meterId: "compute_meter",
          value: 1500,
          metadata: {
            source: "api_gateway",
            environment: "production"
          }
        }, null, 2)
      );
    }
  };

  const handleGenerateKey = () => {
    const chars = "abcdef0123456789";
    let token = workspace.includes("acme") ? "sk_test_acme_" : "sk_live_aora_";
    for (let i = 0; i < 26; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
    setApiKey(token);
    alert(`New secret API key successfully issued for workspace: '${workspace}'! Store securely.`);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Run actual HTTP requests to backend REST API routes!
  const handleRunRequest = async () => {
    setIsSending(true);
    setPlaygroundResponse(null);

    try {
      const q = `?workspace=${encodeURIComponent(workspace)}`;
      // If it's the can-access endpoint, dynamically build query query string
      let targetUrl = playgroundEndpoint;
      let fetchOptions: RequestInit = {
        method: playgroundMethod,
        headers: { "Content-Type": "application/json" }
      };

      if (playgroundEndpoint === "/api/can-access") {
        // Parse basic params easily
        const customerId = "linear";
        const featureSlug = "api_access";
        targetUrl = `/api/can-access?customerId=${customerId}&featureSlug=${featureSlug}&workspace=${encodeURIComponent(workspace)}`;
        fetchOptions = { method: "GET" };
      } else {
        // POST to register event or add custom notes
        const parsedBody = JSON.parse(playgroundBody);
        fetchOptions.body = JSON.stringify(parsedBody);
        // Add query param workspace as context so backend maps customer tenancy
        targetUrl = `${playgroundEndpoint}${q}`;
      }

      const res = await fetch(targetUrl, fetchOptions);
      const data = await res.json();
      
      setPlaygroundResponse({
        http_status: res.status + " " + (res.ok ? "OK" : "Error"),
        headers: {
          "content-type": "application/json",
          "x-workspace-id": wsInfo?.tenantId || "ws_active"
        },
        payload: data
      });

      // reload logs to capture telemetry checks!
      loadWorkspaceDetails();

    } catch (err: any) {
      setPlaygroundResponse({
        error: "REST Execution Fault",
        message: err.message
      });
    } finally {
      setIsSending(false);
    }
  };

  const sdkLanguages = [
    { name: "Node.js SDK", install: "npm install @aora/billing-node", version: "v1.4.2" },
    { name: "Go Lang SDK", install: "go get github.com/aora/billing-go", version: "v1.1.0" },
    { name: "Python package", install: "pip install aora-billing", version: "v2.0.1" }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Intro Head banner */}
      <div className="border-b dp-border pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight dp-text leading-none">Developer Toolkit</h2>
          <p className="text-xs dp-secondary mt-1.5 font-medium">
            Stripe-level developer integrations. Manage live secret credentials, test automated API payloads inside our sandbox terminal, and view code SDK structures.
          </p>
        </div>
        
        {/* Environment live pills */}
        {wsInfo && (
          <div className="flex items-center gap-1.5 self-start md:self-auto bg-neutral-50 px-3 py-1.5 rounded-full border dp-border text-[11px] font-semibold text-stone-700">
            <Globe className="h-3.5 w-3.5 text-stone-500" />
            Active Org: <strong className="text-black">{wsInfo.organization?.name || "Aora Ltd"}</strong>
            <span className="text-stone-300">|</span>
            Env: <span className={`uppercase font-bold tracking-wider ${wsInfo.environmentMode === "production" ? "text-emerald-600" : "text-amber-600"}`}>{wsInfo.environmentMode}</span>
          </div>
        )}
      </div>

      {/* Grid: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column (5 cols): API Keys & SDK Packages */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Main API credentials card */}
          <div className="dp-card border dp-border p-5 rounded-2xl space-y-4 shadow-sm text-left">
            <h3 className="text-xs font-bold dp-text flex items-center gap-2">
              <Key className="h-4.5 w-4.5 text-[#0071E3] rotate-45" />
              API Authentication Keys
            </h3>
            <p className="text-[10px] dp-secondary font-medium leading-relaxed">
              Authenticate API transactions programmatically by transmitting this secret header key inside client SDK calls. Keep this confidential.
            </p>

            <div className="flex gap-2 items-center rounded-lg border dp-border dp-surface p-1.5">
              <span className="font-mono text-[11px] dp-text truncate select-all flex-1 px-1.5">{apiKey}</span>
              <button
                onClick={handleCopyKey}
                className="p-1 px-2.5 rounded text-[10px] font-bold bg-[#111111] text-white hover:bg-[#1D1D1F] transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                id="copy-key-btn"
              >
                {copiedKey ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-[10px] dp-secondary font-mono">Tenant Context: {wsInfo?.tenantId || "Production Mode"}</span>
              <button
                onClick={handleGenerateKey}
                className="text-[11px] text-[#0071E3] hover:underline font-bold"
                id="generate-new-key-link"
              >
                Issue new API key
              </button>
            </div>
          </div>

          {/* Core Developers SDK packages */}
          <div className="dp-card border dp-border p-5 rounded-2xl space-y-4 shadow-sm text-left">
            <h3 className="text-xs font-bold dp-text flex items-center gap-2">
              <Code2 className="h-4.5 w-4.5 text-[#34C759]" />
              Official Runtime SDKs
            </h3>
            
            <div className="space-y-3">
              {sdkLanguages.map((sdk, idx) => (
                <div key={idx} className="space-y-1 dp-surface p-3 rounded-xl border dp-border">
                  <div className="flex justify-between text-[10px] font-bold dp-text">
                    <span>{sdk.name}</span>
                    <span className="dp-secondary font-normal">{sdk.version}</span>
                  </div>
                  <pre className="font-mono text-[10px] text-gray-800 pt-1 overflow-x-auto select-all">
                    {sdk.install}
                  </pre>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right column (7 cols): Sandbox REST API Playground Terminal */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between text-left">
            <h3 className="text-xs font-bold dp-secondary uppercase tracking-wider">Interactive REST API Playground</h3>
            
            {/* Endpoint switch presets */}
            <div className="flex gap-2">
              <button 
                onClick={() => handleEndpointPreset("/api/usage-events")}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-md border transition-all ${playgroundEndpoint === "/api/usage-events" ? "bg-[#111111] text-white border-black" : "dp-card dp-secondary dp-border hover:border-black"}`}
              >
                Post Usage
              </button>
              <button 
                onClick={() => handleEndpointPreset("/api/can-access")}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-md border transition-all ${playgroundEndpoint === "/api/can-access" ? "bg-[#111111] text-white border-black" : "dp-card dp-secondary dp-border hover:border-black"}`}
              >
                Access Check
              </button>
            </div>
          </div>

          <div className="bg-[#111111] text-neutral-200 p-5.5 rounded-2xl space-y-4 shadow-2xl relative overflow-hidden text-left font-mono">
            <div className="absolute top-4 right-4 text-neutral-500 text-[10px] flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-neutral-500" />
              Live Workspace Server Environment
            </div>

            {/* Path Selection row */}
            <div className="flex items-center gap-1.5 p-1.5 bg-neutral-900 rounded-lg text-xs border border-neutral-800">
              <span className="text-emerald-400 font-extrabold px-1.5">{playgroundMethod}</span>
              <span className="text-neutral-500">https://api.aorahq.com</span>
              <span className="dp-muted">{playgroundEndpoint}</span>
            </div>

            {/* Grid for parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Request Body JSON */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold dp-muted uppercase tracking-wider block font-sans">Request URL & Parameters</label>
                
                {playgroundEndpoint === "/api/can-access" ? (
                  <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-lg h-36 flex flex-col justify-center space-y-2 text-[11px]">
                    <div className="flex justify-between border-b border-neutral-800 pb-1.5">
                      <span className="text-neutral-400">customerId</span>
                      <strong className="text-white select-all">linear</strong>
                    </div>
                    <div className="flex justify-between border-b border-neutral-800 pb-1.5">
                      <span className="text-neutral-400">featureSlug</span>
                      <strong className="text-white select-all">api_access</strong>
                    </div>
                    <p className="text-[9px] dp-muted leading-normal font-sans">
                      This calls the server-side Authorization verification routine to check feature locks dynamically.
                    </p>
                  </div>
                ) : (
                  <textarea
                    id="playground-body-textarea"
                    value={playgroundBody}
                    onChange={(e) => setPlaygroundBody(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 text-emerald-400 font-mono text-[10px] p-2.5 outline-none rounded-lg h-36 resize-none focus:border-emerald-600"
                  />
                )}
              </div>

              {/* Terminal response box */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold dp-muted uppercase tracking-wider block font-sans">HTTP Response Payload</label>
                
                <div className="w-full bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono text-[10px] p-2.5 rounded-lg h-36 overflow-auto">
                  {isSending ? (
                    <div className="flex items-center justify-center h-full dp-muted animate-pulse">
                      Exchanging credentials packets...
                    </div>
                  ) : playgroundResponse ? (
                    <pre className="text-[9px] leading-relaxed select-all text-neutral-300 text-left">
                      {JSON.stringify(playgroundResponse, null, 2)}
                    </pre>
                  ) : (
                    <div className="flex items-center justify-center h-full text-neutral-500 font-sans text-xs">
                      Press Execute to transmit multi-tenant REST command.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Run CTA */}
            <div className="flex justify-between items-center pt-2">
              <span className="text-[10px] text-neutral-500 font-sans">Headers: X-Workspace-ID: {wsInfo?.tenantId}</span>
              <button
                onClick={handleRunRequest}
                disabled={isSending}
                className="px-4 py-2 dp-card text-black font-semibold rounded-lg hover:bg-neutral-100 transition-all text-xs cursor-pointer flex items-center gap-1 font-sans"
                id="playground-execute-btn"
              >
                <Play className="h-3.5 w-3.5 fill-black font-semibold shrink-0" />
                {isSending ? "Processing..." : "Execute Request"}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Expanded visual compliance log ledger spanning full-width */}
      <div className="dp-card border dp-border rounded-2xl p-5 text-left shadow-sm mt-8">
        <div className="flex items-center justify-between border-b border-[#F5F5F7] pb-4 mb-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold dp-text flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-stone-700" />
              SaaS Compliance Audit Logs (Workspace Isolated)
            </h3>
            <p className="text-[11px] dp-secondary font-medium">
              Every pricing update, subscription adjustment, note log, and access check is archived securely with historical JSON snapshot rollbacks.
            </p>
          </div>
          
          <div className="text-right">
            <span className="text-[10px] bg-neutral-100 px-2 py-0.5 rounded text-neutral-600 font-bold uppercase font-mono">
              {auditLogs.length} Records
            </span>
          </div>
        </div>

        {loadingLogs ? (
          <div className="p-12 text-center text-xs dp-secondary">
            Retrieving workspace database audit logs...
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="p-12 text-center text-xs text-neutral-400 font-medium">
            No compliance event modifications registered inside Workspace yet. Create a Customer, modify Plans, or submit events to see auto-auditing.
          </div>
        ) : (
          <div className="space-y-2.5">
            {auditLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              
              // Colors based on Action types
              let actionBadge = "bg-neutral-100 text-neutral-700";
              if (log.action === "CREATE") actionBadge = "bg-emerald-50 text-emerald-700 font-bold";
              if (log.action === "ADJUST") actionBadge = "bg-purple-50 text-purple-700 font-bold";
              if (log.action === "UPDATE") actionBadge = "bg-blue-50 text-blue-700 font-bold";
              if (log.action === "ACCESS_VERIFY") actionBadge = "bg-slate-100 text-slate-800 font-mono";

              return (
                <div key={log.id} className="border dp-border rounded-xl overflow-hidden hover:border-[#111111] transition-all bg-neutral-50/20">
                  <div 
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="flex md:items-center justify-between p-3.5 cursor-pointer text-xs select-none gap-3 flex-col md:flex-row dp-surface"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${actionBadge}`}>
                        {log.action}
                      </span>
                      <span className="font-bold dp-text">{log.entityType}</span>
                      <span className="text-[10px] font-mono bg-neutral-100 px-1.5 py-0.5 rounded dp-secondary truncate max-w-[120px]">
                        ID: {log.entityId}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-stone-500 text-[11px] self-end md:self-auto">
                      <span>Actor: <strong className="dp-text">{log.actor}</strong></span>
                      <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 border-t dp-border dp-card text-[11px] grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Before State */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Snapshot BEFORE change</span>
                        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-2.5 max-h-48 overflow-auto font-mono text-[10px]">
                          {log.beforeState ? (
                            <pre className="text-left text-stone-700">{JSON.stringify(log.beforeState, null, 2)}</pre>
                          ) : (
                            <span className="text-neutral-400 italic">No existing state (Record Created)</span>
                          )}
                        </div>
                      </div>

                      {/* After State */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Snapshot AFTER change</span>
                        <div className="bg-neutral-50 border border-emerald-100 rounded-lg p-2.5 max-h-48 overflow-auto font-mono text-[10px]">
                          {log.afterState ? (
                            <pre className="text-left text-stone-700">{JSON.stringify(log.afterState, null, 2)}</pre>
                          ) : (
                            <span className="text-rose-500 italic">Record Deleted</span>
                          )}
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
  );
}
