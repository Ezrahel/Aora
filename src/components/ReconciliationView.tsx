import { useState, useEffect } from "react";
import { BarChart3, TrendingDown, TrendingUp, Download, Search, AlertTriangle } from "lucide-react";

interface ReconciliationReport {
  periodStart: string;
  periodEnd: string;
  totals: {
    internalRevenue: number;
    gatewayRevenue: number;
    variance: number;
  };
  customers: Array<{
    customerId: string;
    customerName: string;
    internalUsage: number;
    internalRevenue: number;
    gatewayRevenue: number;
    variance: number;
    variancePercent: number;
  }>;
}

export default function ReconciliationView() {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [searchCustomer, setSearchCustomer] = useState("");
  const [alertThreshold, setAlertThreshold] = useState(5);

  const fetchReconciliation = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (searchCustomer) params.set("customerId", searchCustomer);
      const res = await fetch(`/api/gateways/reconciliation?${params}`);
      if (res.ok) setReport(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReconciliation(); }, []);

  const handleExportCsv = () => {
    if (!report) return;
    const headers = "Customer,Internal Usage,Internal Revenue,Gateway Revenue,Variance,Variance %\n";
    const rows = report.customers.map((c) =>
      `"${c.customerName}",${c.internalUsage},${c.internalRevenue},${c.gatewayRevenue},${c.variance},${c.variancePercent}%`,
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliation-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const presets = [
    { label: "This Month", get: () => { const d = new Date(); return { from: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0], to: d.toISOString().split("T")[0] }; } },
    { label: "Last Month", get: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return { from: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0], to: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0] }; } },
    { label: "Last Quarter", get: () => { const d = new Date(); d.setMonth(d.getMonth() - 3); return { from: d.toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] }; } },
  ];

  const highVarianceCustomers = report?.customers.filter((c) => c.variancePercent > alertThreshold) || [];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Revenue Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-1">Compare internal billing data against payment gateway records.</p>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={!report}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => { const r = p.get(); setFrom(r.from); setTo(r.to); }}
              className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-white transition-all cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
          <span className="text-gray-400">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Customer ID..."
            value={searchCustomer}
            onChange={(e) => setSearchCustomer(e.target.value)}
            className="pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm w-48"
          />
        </div>
        <button
          onClick={fetchReconciliation}
          disabled={loading}
          className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? "Loading..." : "Run Reconciliation"}
        </button>
      </div>

      {!report ? (
        <div className="text-center py-16 text-gray-400 text-sm">Click "Run Reconciliation" to compare billing data.</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl border border-gray-200 bg-white">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Internal Revenue</p>
              <p className="text-2xl font-bold mt-1">₦{report.totals.internalRevenue.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 bg-white">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Gateway Revenue</p>
              <p className="text-2xl font-bold mt-1">₦{report.totals.gatewayRevenue.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 bg-white">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Variance</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold">₦{report.totals.variance.toLocaleString()}</p>
                {report.totals.variance === 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-amber-500" />
                )}
              </div>
            </div>
            <div className={`p-4 rounded-xl border ${highVarianceCustomers.length > 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}>
              <p className="text-xs font-medium uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Alerts (&gt;{alertThreshold}%)
              </p>
              <p className="text-2xl font-bold mt-1">{highVarianceCustomers.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">customers with high variance</p>
            </div>
          </div>

          {/* Variance threshold slider */}
          <div className="flex items-center gap-3 mb-4 text-sm text-gray-500">
            <span>Alert threshold:</span>
            <input
              type="range"
              min="1"
              max="50"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(Number(e.target.value))}
              className="w-32"
            />
            <span className="font-medium">{alertThreshold}%</span>
          </div>

          {/* Customer Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Customer</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Usage (units)</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Internal Rev.</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Gateway Rev.</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Variance</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Var. %</th>
                </tr>
              </thead>
              <tbody>
                {report.customers.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No data for this period.</td></tr>
                ) : (
                  report.customers.map((c) => (
                    <tr key={c.customerId} className={`border-b border-gray-100 hover:bg-gray-50 ${
                      c.variancePercent > alertThreshold ? "bg-amber-50/50" : ""
                    }`}>
                      <td className="px-4 py-3 font-medium">{c.customerName}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{c.internalUsage.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">₦{c.internalRevenue.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">₦{c.gatewayRevenue.toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right font-medium ${
                        c.variance === 0 ? "text-green-600" : "text-amber-600"
                      }`}>
                        ₦{c.variance.toLocaleString()}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${
                        c.variancePercent === 0 ? "text-green-600" : c.variancePercent > alertThreshold ? "text-red-600" : "text-amber-600"
                      }`}>
                        {c.variancePercent}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
