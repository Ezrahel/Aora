import { useState, useEffect } from "react";
import {
  Plug,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  Copy,
  ExternalLink,
  Plus,
  Shield,
} from "lucide-react";
import GatewayConnectView from "./GatewayConnectView";

interface GatewayConnection {
  id: string;
  gateway: string;
  mode: string;
  is_verified: boolean;
  gateway_account_name: string | null;
  gateway_account_email: string | null;
  last_verified_at: string | null;
  key_preview: string;
  created_at: string;
}

const GATEWAY_NAMES: Record<string, string> = {
  stripe: "Stripe",
  paystack: "Paystack",
  flutterwave: "Flutterwave",
};

const GATEWAY_COLORS: Record<string, string> = {
  stripe: "bg-indigo-50 border-indigo-200 text-indigo-700",
  paystack: "bg-emerald-50 border-emerald-200 text-emerald-700",
  flutterwave: "bg-amber-50 border-amber-200 text-amber-700",
};

export default function GatewayManagementView() {
  const [connections, setConnections] = useState<GatewayConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gateways");
      setConnections(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConnections(); }, []);

  const handleDisconnect = async (id: string) => {
    try {
      await fetch(`/api/gateways/${id}`, { method: "DELETE" });
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // ignore
    }
    setConfirmDelete(null);
  };

  const handleReverify = async (id: string) => {
    setVerifying(id);
    try {
      await fetch(`/api/gateways/${id}/verify`, { method: "POST" });
      await fetchConnections();
    } catch {
      // ignore
    }
    setVerifying(null);
  };

  const handleCopyWebhookUrl = (gateway: string) => {
    const url = `${window.location.origin}/api/gateways/webhooks/${gateway}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  if (showConnect) {
    return (
      <GatewayConnectView
        onBack={() => setShowConnect(false)}
        onConnected={() => { fetchConnections(); setShowConnect(false); }}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold">Payment Gateways</h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect your Stripe, Paystack, or Flutterwave keys — your billing data never touches our infrastructure.
          </p>
        </div>
        <button
          onClick={() => setShowConnect(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Connect Gateway
        </button>
      </div>

      {/* Connections list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : connections.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <Plug className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No gateways connected yet</p>
          <p className="text-sm text-gray-400 mt-1">Connect your first payment gateway to start syncing billing data.</p>
          <button
            onClick={() => setShowConnect(true)}
            className="mt-4 px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Connect Gateway
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <div key={conn.id} className={`p-5 rounded-xl border ${GATEWAY_COLORS[conn.gateway] || "dp-card border-gray-200"}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg dp-card/80 flex items-center justify-center shrink-0 border">
                    <Plug className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{GATEWAY_NAMES[conn.gateway] || conn.gateway}</h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        conn.mode === "live" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {conn.mode}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 ${
                        conn.is_verified ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                      }`}>
                        <Shield className="h-3 w-3" />
                        {conn.is_verified ? "Verified" : "Unverified"}
                      </span>
                    </div>
                    {conn.gateway_account_name && (
                      <p className="text-sm mt-0.5">{conn.gateway_account_name}</p>
                    )}
                    {conn.gateway_account_email && (
                      <p className="text-xs text-gray-500">{conn.gateway_account_email}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>Key: <code className="font-mono bg-gray-100 px-1 rounded">{conn.key_preview}</code></span>
                      {conn.last_verified_at && (
                        <span>Last verified: {new Date(conn.last_verified_at).toLocaleDateString()}</span>
                      )}
                    </div>

                    {/* Webhook URL */}
                    <div className="mt-3 flex items-center gap-2">
                      <code className="text-[11px] font-mono dp-card/80 px-2 py-1 rounded border truncate max-w-[400px]">
                        {window.location.origin}/api/gateways/webhooks/{conn.gateway}
                      </code>
                      <button onClick={() => handleCopyWebhookUrl(conn.gateway)} className="p-1 hover:bg-gray-200/50 rounded cursor-pointer" title="Copy webhook URL">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a href={`https://${conn.gateway === "stripe" ? "dashboard.stripe.com/webhooks" : conn.gateway === "paystack" ? "dashboard.paystack.com/#/settings/developer" : "dashboard.flutterwave.com/settings/webhooks"}`} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-gray-200/50 rounded" title="Configure in gateway dashboard">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleReverify(conn.id)}
                    disabled={verifying === conn.id}
                    className="p-2 hover:dp-card rounded-lg text-sm cursor-pointer disabled:opacity-50"
                    title="Re-verify connection"
                  >
                    <RefreshCw className={`h-4 w-4 ${verifying === conn.id ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(conn.id)}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-500 cursor-pointer"
                    title="Disconnect"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Delete confirmation */}
              {confirmDelete === conn.id && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                  <p className="text-sm text-red-700">Remove the encrypted API key for {GATEWAY_NAMES[conn.gateway]}? Existing billing data is preserved.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(null)} className="px-3 py-1 text-sm text-gray-600 hover:dp-card rounded cursor-pointer">Cancel</button>
                    <button onClick={() => handleDisconnect(conn.id)} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer">Disconnect</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
