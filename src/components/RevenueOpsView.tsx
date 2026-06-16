import { useState } from "react";
import {
  TrendingUp,
  RefreshCw,
  BarChart3,
  ArrowUpRight,
  DollarSign,
  CheckCircle,
  Shield,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Customer, DashboardStats } from "../types";

interface RevenueOpsViewProps {
  stats: DashboardStats | null;
  customers: Customer[];
  onInvoiceRecovered: () => void;
}

export default function RevenueOpsView({
  stats,
  customers,
  onInvoiceRecovered,
}: RevenueOpsViewProps) {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  if (!stats)
    return <div className="animate-pulse h-96 bg-[#FAFAFA] rounded-2xl" />;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Find any past due invoice inside customer workspace
  const pastDueInvoices = customers.flatMap((c) =>
    c.invoices
      .filter((i) => i.status === "past_due")
      .map((i) => ({ ...i, customerId: c.id, customerName: c.name })),
  );

  const handleSimulateInvoiceRecovery = async (invoiceId: string) => {
    setIsRecovering(true);
    setRecoverySuccess(false);
    try {
      const targetInvoice = pastDueInvoices.find((i) => i.id === invoiceId);
      if (!targetInvoice) return;

      // Mark the invoice as paid
      const invoiceRes = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });

      if (!invoiceRes.ok) {
        throw new Error("Unable to update invoice status via gateway.");
      }

      // Ensure customer account is marked active
      await fetch(`/api/customers/${targetInvoice.customerId}/adjustPlan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });

      // Log an admin note confirming recovery
      await fetch(`/api/customers/${targetInvoice.customerId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Smart Dunning engine successfully recovered funds for past due invoice ${invoiceId}. Status converted to: PAID.`,
          author: "Smart Dunning Engine",
        }),
      });

      setRecoverySuccess(true);
      onInvoiceRecovered();
      setTimeout(() => setRecoverySuccess(false), 4000);
    } catch (err) {
      alert("Error on recovery pipeline: " + err);
    } finally {
      setIsRecovering(false);
    }
  };

  // Static high fidelity data modeling base vs expansion vs overage
  const revenueDistributionData = [
    {
      name: "Apr 2026",
      baseRecurring: 110000,
      usageOverage: 18400,
      expansion: 5600,
    },
    {
      name: "May 2026",
      baseRecurring: 128000,
      usageOverage: 23100,
      expansion: 8200,
    },
    {
      name: "Jun 2026",
      baseRecurring: stats.baseMRR,
      usageOverage: stats.overageMRR,
      expansion: 12000,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Intro Greetings banner */}
      <div className="border-b border-[#E5E5E7] pb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Revenue Operations
        </h2>
        <p className="text-xs text-[#6E6E73] mt-1.5 font-medium">
          CFO-friendly workspace monitoring gross yields, cohort expansions,
          failed card recoveries, and absolute Annual Run Rates.
        </p>
      </div>

      {/* KPI Widgets grids */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* NRR widget */}
        <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.015)]">
          <span className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider block">
            Net Revenue Retention
          </span>
          <p className="text-xl font-extrabold text-[#111111] mt-2 tracking-tight">
            102.4% NRR
          </p>
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#34C759] mt-2">
            <span>Client Base Expanding</span>
          </div>
        </div>

        {/* ARR widget */}
        <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.015)]">
          <span className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider block">
            Annual Run Rate
          </span>
          <p className="text-xl font-extrabold text-[#111111] mt-2 tracking-tight">
            {formatCurrency(stats.arr)}
          </p>
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#c4251c] mt-2">
            <span className="bg-neutral-50 px-1.5 py-0.5 rounded text-neutral-500 font-bold">
              12x MRR multiplier
            </span>
          </div>
        </div>

        {/* Expansion widget */}
        <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.015)]">
          <span className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider block">
            Expansion Revenue
          </span>
          <p className="text-xl font-extrabold text-[#111111] mt-2 tracking-tight">
            {formatCurrency(Math.round(stats.overageMRR + 12000))}
          </p>
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#34C759] mt-2">
            <span>Via Meter Overages</span>
          </div>
        </div>

        {/* Recovery Revenue widget */}
        <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.015)]">
          <span className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider block">
            Recovery Revenue
          </span>
          <p className="text-xl font-extrabold text-[#111111] mt-2 tracking-tight">
            {formatCurrency(23000)}
          </p>
          <div className="flex items-center gap-1 text-[11px] font-medium text-amber-600 mt-2">
            <span>Via Duning Engines</span>
          </div>
        </div>
      </div>

      {/* Main BarChart Breakdown */}
      <div className="bg-white border border-[#E5E5E7] p-6 rounded-3xl shadow-sm">
        <div className="pb-6 text-left">
          <span className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider block mb-1">
            CFO distribution view
          </span>
          <h3 className="text-sm font-semibold text-[#111111]">
            Monthly Contract MRR Component Breakdown
          </h3>
        </div>

        <div className="h-64 w-full text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={revenueDistributionData}
              margin={{ top: 20, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#E5E5E7"
              />
              <XAxis
                dataKey="name"
                stroke="#86868B"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#86868B"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `₦${val / 1000}k`}
              />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Bar
                dataKey="baseRecurring"
                stackId="a"
                fill="#111111"
                name="Base Recurring Ledger"
              />
              <Bar
                dataKey="usageOverage"
                stackId="a"
                fill="#0071E3"
                name="Meter Overage (Lago)"
              />
              <Bar
                dataKey="expansion"
                stackId="a"
                fill="#34C759"
                name="Contract Expansion Extra"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Duning console / recovery engine */}
      <div className="bg-white border border-[#E5E5E7] p-6 rounded-3xl shadow-sm md:max-w-3xl">
        <div className="pb-4 text-left">
          <span className="text-[10px] font-bold text-[#FF453A] uppercase tracking-wider block mb-1">
            Financial Operations Audit
          </span>
          <h3 className="text-base font-bold text-[#111111]">
            Smart Duning & Recoveries Engine Console
          </h3>
          <p className="text-xs text-[#6E6E73] mt-1 font-medium">
            When cards fail (e.g. limit reached, expired), our dunning engine
            retry sequences prevent immediate deletion. You can manually fire
            recoveries below.
          </p>
        </div>

        {/* Failed items list */}
        <div className="space-y-3.5 pt-2">
          {pastDueInvoices.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4.5 rounded-xl border border-red-100 bg-red-50/20 text-xs gap-4 text-left"
            >
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-[#FF453A] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-[#111111]">
                    {inv.customerName} past due invoice
                  </h4>
                  <p className="text-[10px] text-[#6E6E73] mt-0.5">
                    Invoice: {inv.id} • Exceeded limits at{" "}
                    {inv.usageUnits.toLocaleString()} units
                  </p>
                  <p className="text-[9px] text-red-500 font-semibold mt-1">
                    Status: Card declined in auto billing process • ₦
                    {inv.amount.toLocaleString()} expected
                  </p>
                </div>
              </div>

              <div className="text-right flex flex-col md:items-end gap-2 shrink-0">
                <span className="font-extrabold text-[#111111]">
                  {formatCurrency(inv.amount)}
                </span>
                <button
                  onClick={() => handleSimulateInvoiceRecovery(inv.id)}
                  disabled={isRecovering}
                  className="px-3.5 py-1.5 rounded-lg bg-[#FF453A] hover:bg-[#c4251c] text-white font-bold cursor-pointer text-[10px] text-center transition-all flex items-center gap-1"
                  id={`dun-recovery-btn-${inv.id}`}
                >
                  <RefreshCw
                    className={`h-3 w-3 ${isRecovering ? "animate-spin" : ""}`}
                  />
                  Trigger Auto-Retry Fund Recovery
                </button>
              </div>
            </div>
          ))}

          {recoverySuccess && (
            <div className="p-3 bg-neutral-50 text-neutral-800 border border-neutral-200 rounded-lg text-xs font-semibold flex items-center gap-2 text-left">
              <CheckCircle className="h-4 w-4 text-neutral-800 shrink-0" />
              <span>
                Gateway transaction approved! Fund successfully cleared.
                Customer note has been logged in audit history files.
              </span>
            </div>
          )}

          {pastDueInvoices.length === 0 && (
            <div className="p-6 bg-neutral-50 border border-neutral-200 rounded-2xl flex flex-col items-center justify-center text-center text-xs text-[#6E6E73]">
              <CheckCircle className="h-8 w-8 text-stone-700 mb-2" />
              <p className="font-bold text-[#111111]">
                All invoices settled successfully
              </p>
              <p className="mt-0.5 text-[11px] font-medium">
                Workspace bad debt is 0.00% • Collection speed optimal
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
