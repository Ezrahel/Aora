import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  Target,
  ArrowRight,
  Table,
  Check,
  Layers,
  ChevronRight,
} from "lucide-react";

export default function AnalyticsView() {
  // Cohorts data template
  const cohortsData = [
    {
      month: "Q4 2025 Start",
      activeAccounts: 120,
      m1: "100%",
      m2: "98.2%",
      m3: "97.4%",
      m4: "96.1%",
      category: "Startups",
    },
    {
      month: "Jan 2026 Batch",
      activeAccounts: 145,
      m1: "100%",
      m2: "99.1%",
      m3: "98.3%",
      m4: "97.8%",
      category: "Fintech Enterprises",
    },
    {
      month: "Feb 2026 Batch",
      activeAccounts: 180,
      m1: "100%",
      m2: "98.5%",
      m3: "98.0%",
      m4: "96.5%",
      category: "AI startups",
    },
    {
      month: "Mar 2026 Batch",
      activeAccounts: 210,
      m1: "100%",
      m2: "99.4%",
      m3: "99.0%",
      m4: "98.2%",
      category: "SaaS tools",
    },
  ];

  const [selectedCohort, setSelectedCohort] = useState<string | null>(
    "Jan 2026 Batch",
  );

  const segments = [
    {
      title: "Enterprise Giants",
      size: "48 Accounts",
      criteria: "Contracts > ₦120,000/mo",
      health: "99.4% Health Score",
    },
    {
      title: "Mid-Market Growth Scale",
      size: "182 Accounts",
      criteria: "Tiers: Growth / Scale",
      health: "98.2% Health Score",
    },
    {
      title: "Developer Sandbox Free",
      size: "854 Projects",
      criteria: "Starter Free Pack",
      health: "14.2% Conversion Yield",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Overview Head banner */}
      <div className="border-b dp-border pb-6">
        <h2 className="text-2xl font-semibold tracking-tight dp-text">
          Analytics & Cohort Metrics
        </h2>
        <p className="text-xs dp-secondary mt-1.5 font-medium">
          Drape insights across arbitrary subscription lifecycles. Map retention
          tables, inspect conversion ratios, and execute drill downs instantly.
        </p>
      </div>

      {/* Segments grid list */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold dp-secondary uppercase tracking-wider text-left">
          Customer Segments
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {segments.map((s, idx) => (
            <div
              key={idx}
              className="dp-card border dp-border p-4.5 rounded-xl hover:shadow-md transition-all text-left space-y-2"
            >
              <h4 className="text-xs font-bold dp-text">{s.title}</h4>
              <p className="text-[10px] dp-secondary mt-0.5">
                {s.criteria} • {s.size}
              </p>
              <p className="text-[11px] text-[#34C759] font-semibold">
                {s.health}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Cohort retention table with interactive drill down */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: The Cohorts retention grid table (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold dp-secondary uppercase tracking-wider">
              Cohort Retention Analysis
            </h3>
            <span className="text-[10px] text-gray-500 font-medium">
              Click on any batch segment to drill down
            </span>
          </div>

          <div className="dp-card border dp-border rounded-xl overflow-x-auto shadow-sm">
            <table
              className="w-full text-left border-collapse"
              id="cohorts-table"
            >
              <thead>
                <tr className="dp-surface border-b dp-border text-[10px] dp-secondary font-bold uppercase tracking-wider">
                  <th className="px-4.5 py-3">Cohort Batch</th>
                  <th className="px-4.5 py-3 text-center">Size</th>
                  <th className="px-4.5 py-3 text-center bg-blue-50/10 text-blue-800">
                    Month 1
                  </th>
                  <th className="px-4.5 py-3 text-center bg-blue-50/20 text-blue-800">
                    Month 2
                  </th>
                  <th className="px-4.5 py-3 text-center bg-blue-50/30 text-blue-900">
                    Month 3
                  </th>
                  <th className="px-4.5 py-3 text-center bg-blue-50/40 text-blue-950 font-extrabold">
                    Month 4
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs">
                {cohortsData.map((co) => {
                  const isSelected = selectedCohort === co.month;
                  return (
                    <tr
                      key={co.month}
                      id={`cohort-row-${co.month.replace(/\s+/g, "-")}`}
                      onClick={() => setSelectedCohort(co.month)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-50/40 font-semibold"
                          : "hover:dp-surface"
                      }`}
                    >
                      <td className="px-4.5 py-3 dp-text flex items-center justify-between">
                        <span>{co.month}</span>
                        <ChevronRight
                          className={`h-3.5 w-3.5 dp-muted transition-transform ${isSelected ? "rotate-90 text-[#0071E3]" : ""}`}
                        />
                      </td>
                      <td className="px-4.5 py-3 text-center dp-secondary">
                        {co.activeAccounts} Accounts
                      </td>
                      <td className="px-4.5 py-3 text-center font-medium text-emerald-700 bg-emerald-50/20">
                        {co.m1}
                      </td>
                      <td className="px-4.5 py-3 text-center font-medium text-emerald-700 bg-emerald-50/40">
                        {co.m2}
                      </td>
                      <td className="px-4.5 py-3 text-center font-medium text-emerald-800 bg-emerald-50/60">
                        {co.m3}
                      </td>
                      <td className="px-4.5 py-3 text-center font-extrabold text-white bg-[#0071E3]">
                        {co.m4}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: The Drill Down detail box (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-xs font-bold dp-secondary uppercase tracking-wider">
            Drill-Down Segment Core Details
          </h3>

          {selectedCohort ? (
            <div className="bg-[#FFFFFF] border-2 border-dashed border-[#111111] p-5 rounded-2xl space-y-4 text-left shadow-md">
              <h4 className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <Target className="h-4.5 w-4.5 text-[#0071E3]" />
                Cohort Batch: {selectedCohort}
              </h4>

              <div className="space-y-3.5 text-xs">
                <div className="text-[11px] leading-relaxed dp-secondary font-medium border-b border-[#F5F5F7] pb-3">
                  This segment mainly comprises{" "}
                  <strong className="text-black">
                    {
                      cohortsData.find((c) => c.month === selectedCohort)
                        ?.category
                    }
                  </strong>
                  . High Month-4 retention of{" "}
                  <strong className="text-neutral-900 font-bold">
                    {cohortsData.find((c) => c.month === selectedCohort)?.m4}
                  </strong>{" "}
                  is driven primarily by API integrations and auto-scaling
                  overage meters.
                </div>

                <div className="space-y-2">
                  <h5 className="text-[10px] font-bold dp-secondary uppercase tracking-wider mb-1">
                    Retention Metrics
                  </h5>
                  <div className="flex justify-between md:items-center text-xs border-b border-[#F5F5F7] pb-2 last:border-0 last:pb-0">
                    <span className="dp-secondary">
                      Initial Cohort count:
                    </span>
                    <span className="font-bold dp-text">
                      182 paid accounts
                    </span>
                  </div>
                  <div className="flex justify-between md:items-center text-xs border-b border-[#F5F5F7] pb-2 last:border-0 last:pb-0">
                    <span className="dp-secondary">Average LTV yield:</span>
                    <span className="font-bold dp-text">
                      ₦98,400 per client
                    </span>
                  </div>
                  <div className="flex justify-between md:items-center text-xs border-b border-[#F5F5F7] pb-2 last:border-0 last:pb-0">
                    <span className="dp-secondary">
                      Key Unlocking Feature:
                    </span>
                    <span className="dp-surface-alt px-2 py-0.5 rounded font-mono text-[9px] text-[#0071E3] font-semibold">
                      API Integrations
                    </span>
                  </div>
                </div>

                <div className="space-y-1 dp-surface p-3 rounded-lg text-[9px] dp-secondary leading-relaxed border dp-border">
                  💡 <strong className="dp-text">Retention Tip:</strong>{" "}
                  Upgrading startups in this segment to Scale plan templates
                  universally boosts total MRR expansion parameters by{" "}
                  <strong>12.4%</strong> at cycle rollover.
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 border border-dashed dp-border dp-surface rounded-xl text-center text-xs dp-secondary">
              Select a cohort segment row to evaluate statistical drill downs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
