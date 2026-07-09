import { ArrowUpRight, TrendingUp, Users, AlertCircle, PlayCircle, Layers, Activity, Star } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { DashboardStats } from "../types";

interface DashboardViewProps {
  stats: DashboardStats | null;
  onNavigateTab: (tab: string) => void;
}

export default function DashboardView({ stats, onNavigateTab }: DashboardViewProps) {
  if (!stats) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-44 bg-[#FAFAFA] rounded-2xl border border-neutral-100" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-[#FAFAFA] rounded-xl border border-neutral-100" />)}
        </div>
        <div className="h-80 bg-[#FAFAFA] rounded-2xl border border-neutral-100" />
      </div>
    );
  }

  // Format currency
  const formatValue = (num: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0
    }).format(num);
  };

  const currentTotalMRR = stats.mrr;
  const growthTrend = stats.growthTrendPercent;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Intro Greetings banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#E5E5E7] pb-6 gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#111111]">Your business is healthy.</h2>
          <p className="text-xs text-[#6E6E73] mt-1.5 font-medium">
            Here's a premium view of subscription velocities and operational overhead across active workspaces.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateTab("pricing")}
            className="rounded-lg bg-[#111111] hover:bg-[#1D1D1F] px-4 py-2 text-xs font-semibold text-white cursor-pointer shadow-sm transition-all"
            id="builder-dashboard-direct-btn"
          >
            Launch Pricing Builder
          </button>
          <button
            onClick={() => onNavigateTab("customers")}
            className="rounded-lg bg-white border border-[#E5E5E7] hover:bg-[#FAFAFA] px-4 py-2 text-xs font-semibold text-[#111111] cursor-pointer transition-all"
            id="view-customers-direct-btn"
          >
            Browse Customers
          </button>
        </div>
      </div>

      {/* Primary KPI Mini widgets grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Value MRR Card */}
        <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6E6E73]">
            <span className="text-xs font-medium">Monthly Recurring Revenue</span>
            <TrendingUp className="h-4 w-4 text-stone-700" />
          </div>
          <p className="text-xl font-bold text-[#111111] mt-2.5 tracking-tight">
            {formatValue(currentTotalMRR)}
          </p>
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#34C759] mt-2">
            <span className="bg-[#34C759]/10 px-1.5 py-0.5 rounded-md">+{growthTrend}%</span>
            <span>vs last month</span>
          </div>
        </div>

        {/* Active Subscriptions */}
        <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6E6E73]">
            <span className="text-xs font-medium">Active Subscriptions</span>
            <Users className="h-4 w-4 text-stone-700" />
          </div>
          <p className="text-xl font-bold text-[#111111] mt-2.5 tracking-tight">
            {stats.activeSubscriptions} Accounts
          </p>
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#6E6E73] mt-2">
            <span>NPS Retention Target:</span>
            <span className="text-[#34C759] font-semibold">98.2%</span>
          </div>
        </div>

        {/* Metrics Churn */}
        <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6E6E73]">
            <span className="text-xs font-medium">Net Revenue Churn Rate</span>
            <Star className="h-4 w-4 text-stone-700" />
          </div>
          <p className="text-xl font-bold text-[#111111] mt-2.5 tracking-tight">
            {stats.churnRate}%
          </p>
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#c4251c] mt-2">
            <span className="bg-rose-50 px-1.5 py-0.5 rounded-md">Under Limit</span>
            <span className="text-neutral-500">Historical lowest peak</span>
          </div>
        </div>

        {/* Failed bills */}
        <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6E6E73]">
            <span className="text-xs font-medium">Failed Payment Recovery</span>
            <AlertCircle className="h-4 w-4 text-stone-700" />
          </div>
          <p className="text-xl font-bold text-[#111111] mt-2.5 tracking-tight">
            {stats.failedPaymentsCount} Invoice Flagged
          </p>
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#FF9F0A] mt-2">
            <span>Collection Status:</span>
            <span className="text-yellow-600 font-semibold">{stats.invoiceCollectionRate}% Rate</span>
          </div>
        </div>
      </div>

      {/* Main interactive Recharts trends graph */}
      <div className="bg-white border border-[#E5E5E7] rounded-3xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.015)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 gap-3">
          <div>
            <span className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider mb-1 block">Revenue telemetry</span>
            <h3 className="text-base font-bold text-[#111111] tracking-tight">Recurring Ledger vs Meter Overage Actions</h3>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#111111]" />
              <span className="text-[#6E6E73] font-medium">Base Contract Fee</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#0071E3]" />
              <span className="text-[#6E6E73] font-medium">Meter Overage (Lago)</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full text-xs">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={stats.historicalChartData}
              margin={{ top: 10, right: 10, left: 15, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#111111" stopOpacity={0.05}/>
                  <stop offset="95%" stopColor="#111111" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorOverage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0071E3" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#0071E3" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E7" />
              <XAxis dataKey="date" stroke="#86868B" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#86868B" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₦${val / 1000}k`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  borderColor: "#E5E5E7",
                  borderRadius: "12px",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
                }}
                formatter={(val, name) => [formatValue(Number(val)), name === "baseMRR" ? "Base Plan" : "Usage overage"]}
              />
              <Area type="monotone" dataKey="baseMRR" stroke="#111111" strokeWidth={2} fillOpacity={1} fill="url(#colorBase)" />
              <Area type="monotone" dataKey="overageMRR" stroke="#0071E3" strokeWidth={2} fillOpacity={1} fill="url(#colorOverage)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Conversion funnels and Plan Performances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left: Conversion Funnelling */}
        <div className="bg-white border border-[#E5E5E7] p-6 rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
          <div className="pb-4">
            <span className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider block mb-1">Signup convert metrics</span>
            <h3 className="text-sm font-semibold text-[#111111]">Trial Conversion Funnel</h3>
          </div>
          
          <div className="space-y-4 pt-1">
            {stats.conversionFunnel.map((f, idx) => {
              const maxVal = stats.conversionFunnel[0].count;
              const pct = (f.count / maxVal) * 100;
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#111111]">{f.stage}</span>
                    <span className="text-[#6E6E73]">{f.count.toLocaleString()} sessions</span>
                  </div>
                  <div className="h-2 w-full bg-[#F5F5F7] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-gradient-to-r from-[#111111] to-[#0071E3] rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Plan performance */}
        <div className="bg-white border border-[#E5E5E7] p-6 rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
          <div className="pb-4">
            <span className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider block mb-1">Catalog telemetry</span>
            <h3 className="text-sm font-semibold text-[#111111]">Plan Popularity metrics</h3>
          </div>

          <div className="space-y-4 pt-1">
            {stats.planPerformance.map((plan, idx) => (
              <div key={idx} className="flex items-center justify-between border-b border-[#F5F5F7] pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FAFAFA] border border-[#E5E5E7] text-xs font-semibold text-[#111111]">
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#111111]">{plan.name}</h4>
                    <p className="text-[10px] text-[#6E6E73]">Base Fee: {formatValue(plan.price)}/mo</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[10px] font-semibold text-[#111111]">
                    {plan.count} Subscribers
                  </span>
                  <p className="text-[10px] text-[#34C759] mt-0.5 font-medium">Yields {formatValue(plan.revenueShare)}/mo</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
