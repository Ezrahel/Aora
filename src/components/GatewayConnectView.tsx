import { useState } from "react";
import { Plug, CheckCircle2, XCircle, Eye, EyeOff, Copy, ExternalLink, Loader2 } from "lucide-react";

interface GatewayDef {
  id: string;
  name: string;
  description: string;
  docsUrl: string;
  keyExample: string;
}

const GATEWAYS: GatewayDef[] = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Connect your Stripe account. Works with any Stripe plan globally.",
    docsUrl: "https://docs.stripe.com/keys",
    keyExample: "sk_test_...",
  },
  {
    id: "paystack",
    name: "Paystack",
    description: "Accept payments in Nigeria, Ghana, Kenya, and South Africa.",
    docsUrl: "https://paystack.com/docs/api/#authentication",
    keyExample: "sk_test_...",
  },
  {
    id: "flutterwave",
    name: "Flutterwave",
    description: "Pan-African payments covering 30+ African countries.",
    docsUrl: "https://developer.flutterwave.com/docs/api-authentication",
    keyExample: "FLWSECK_TEST-...",
  },
];

interface Props {
  onBack: () => void;
  onConnected: () => void;
}

export default function GatewayConnectView({ onBack, onConnected }: Props) {
  const [selectedGateway, setSelectedGateway] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [mode, setMode] = useState<"test" | "live">("test");
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; detail?: string } | null>(null);
  const [step, setStep] = useState<"select" | "configure">("select");

  const selectedDef = GATEWAYS.find((g) => g.id === selectedGateway);

  const handleConnect = async () => {
    if (!selectedGateway || !apiKey) return;
    setConnecting(true);
    setResult(null);

    try {
      const res = await fetch("/api/gateways/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway: selectedGateway,
          apiKey: apiKey.trim(),
          mode,
          webhookSecret: webhookSecret.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: data.message || `${selectedGateway} connected successfully`, detail: data.gateway_account_name || data.gateway_account_email });
        setTimeout(() => { onConnected(); }, 1500);
      } else {
        setResult({ success: false, message: data.error || data.detail || "Connection failed", detail: data.code });
      }
    } catch (err: any) {
      setResult({ success: false, message: "Network error. Is the server running?", detail: err.message });
    } finally {
      setConnecting(false);
    }
  };

  const handleCopyUrl = () => {
    const url = `${window.location.origin}/api/gateways/webhooks/${selectedGateway}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  if (step === "select") {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg text-sm cursor-pointer">← Back</button>
          <div>
            <h1 className="text-xl font-bold">Connect a Payment Gateway</h1>
            <p className="text-sm text-gray-500 mt-1">Bring your own Stripe, Paystack, or Flutterwave keys — AoraHQ handles the billing logic.</p>
          </div>
        </div>

        <div className="grid gap-4">
          {GATEWAYS.map((gw) => (
            <button
              key={gw.id}
              onClick={() => { setSelectedGateway(gw.id); setStep("configure"); }}
              className="flex items-start gap-4 p-5 rounded-xl border border-gray-200 hover:border-gray-400 hover:shadow-sm transition-all text-left cursor-pointer bg-white"
            >
              <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Plug className="h-5 w-5 text-gray-700" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{gw.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{gw.description}</p>
              </div>
              <span className="text-sm font-medium text-blue-600">Connect →</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => { setStep("select"); setResult(null); setApiKey(""); }} className="p-2 hover:bg-gray-100 rounded-lg text-sm cursor-pointer">← Back</button>
        <div>
          <h1 className="text-xl font-bold">Connect {selectedDef?.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Paste your API key below. It will be encrypted at rest and never shared.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Mode toggle */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
          {(["test", "live"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${mode === m ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              {m === "test" ? "🔬 Test Mode" : "🚀 Live Mode"}
            </button>
          ))}
        </div>

        {/* API key input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Secret API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={selectedDef?.keyExample || "Paste your secret key..."}
              className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Found in your {selectedDef?.name} dashboard under <span className="font-mono">Developers → API Keys</span>
          </p>
        </div>

        {/* Webhook secret (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Webhook Signing Secret <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <input
              type={showSecret ? "text" : "password"}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="whsec_... (recommended for webhook verification)"
              className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Webhook URL display */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Webhook URL</span>
            <span className="text-[10px] text-gray-400">Set this in your gateway dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-white px-2 py-1.5 rounded border border-gray-200 truncate">
              {window.location.origin}/api/gateways/webhooks/{selectedGateway}
            </code>
            <button onClick={handleCopyUrl} className="p-1.5 hover:bg-gray-200 rounded cursor-pointer" title="Copy URL">
              <Copy className="h-4 w-4 text-gray-500" />
            </button>
            <a href={selectedDef?.docsUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-gray-200 rounded" title="View docs">
              <ExternalLink className="h-4 w-4 text-gray-500" />
            </a>
          </div>
        </div>

        {/* Connect button */}
        <button
          onClick={handleConnect}
          disabled={connecting || !apiKey}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${
            connecting || !apiKey ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {connecting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Verifying Connection...</>
          ) : (
            <><Plug className="h-4 w-4" /> Connect {selectedDef?.name}</>
          )}
        </button>

        {/* Result */}
        {result && (
          <div className={`p-4 rounded-lg border flex items-start gap-3 ${
            result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
          }`}>
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`font-medium text-sm ${result.success ? "text-green-800" : "text-red-800"}`}>
                {result.message}
              </p>
              {result.detail && (
                <p className="text-xs mt-0.5 text-gray-500">{result.detail}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
