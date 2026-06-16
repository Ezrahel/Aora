import { useState } from "react";
import {
  Users,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Plus,
  RefreshCw,
  TrendingUp,
  XCircle,
  HelpCircle,
  Clock,
  Sliders,
  Check
} from "lucide-react";
import { Customer, Plan } from "../types";

interface SubscriptionsViewProps {
  customers: Customer[];
  plans: Plan[];
  onPlanAdjusted: () => void;
}

export default function SubscriptionsView({
  customers,
  plans,
  onPlanAdjusted
}: SubscriptionsViewProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustSuccessMsg, setAdjustSuccessMsg] = useState(false);

  const activeCustomer = customers.find(c => c.id === selectedCustomerId);

  const handleAdjustClient = async () => {
    if (!selectedCustomerId) return;
    setIsAdjusting(true);
    try {
      const response = await fetch(`/api/customers/${selectedCustomerId}/adjustPlan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanId || activeCustomer?.planId,
          status: selectedStatus || activeCustomer?.status
        })
      });

      if (!response.ok) {
        throw new Error("Failed to adjust customer parameters.");
      }

      setAdjustSuccessMsg(true);
      onPlanAdjusted(); // notifies parent
      setTimeout(() => {
        setAdjustSuccessMsg(false);
        setSelectedCustomerId("");
      }, 2500);

    } catch (err) {
      alert("Error adjusting details: " + err);
    } finally {
      setIsAdjusting(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="border-b border-[#E5E5E7] pb-6 text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-[#111111]">Active Subscriptions</h2>
        <p className="text-xs text-[#6E6E73] mt-1.5 font-medium">
          Track customer cycles, current plan statuses, renewal configurations, and live consumption levels across global contract pools.
        </p>
      </div>

      {/* KPI stats overview panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
        <div className="bg-white border p-5 rounded-2xl">
          <p className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">Active Contracts</p>
          <p className="text-xl font-bold text-[#111111] mt-1 h-fit">
            {customers.filter(c => c.status === "active").length} Accounts
          </p>
          <div className="h-1 w-full bg-neutral-100 rounded-full mt-3">
            <div className="h-full w-4/5 bg-black" />
          </div>
        </div>

        <div className="bg-white border p-5 rounded-2xl">
          <p className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">Trial Onboardings</p>
          <p className="text-xl font-bold text-[#111111] mt-1">
            {customers.filter(c => c.status === "trial").length} Developers
          </p>
          <div className="h-1 w-full bg-neutral-100 rounded-full mt-3">
            <div className="h-full w-1/5 bg-stone-500" />
          </div>
        </div>

        <div className="bg-white border p-5 rounded-2xl">
          <p className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">Average Overage Trigger</p>
          <p className="text-xl font-bold text-[#111111] mt-1">₦2,450 / node</p>
          <div className="h-1 w-full bg-neutral-100 rounded-full mt-3">
            <div className="h-full w-1/3 bg-emerald-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Subscriptions master table with customer indicators (8 columns) */}
        <div className="lg:col-span-8 bg-white border border-[#E5E5E7] rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse" id="subscriptions-master-table">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#E5E5E7] text-[10px] text-[#6E6E73] font-bold uppercase tracking-wider">
                <th className="px-5 py-4">Subscriber Account</th>
                <th className="px-5 py-4">Active Plan Tier</th>
                <th className="px-5 py-4 text-center">Cycle Usage tracker</th>
                <th className="px-5 py-4 text-right">Amt / Cycle</th>
                <th className="px-5 py-4 text-right">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F5F7] text-xs">
              {customers.map((c) => {
                const planObj = plans.find(p => p.id === c.planId);
                const isLimitExceeded = c.usageUnits > (planObj?.includedUsage || 10000);
                return (
                  <tr key={c.id} className="hover:bg-[#FAFAFA] transition-all">
                    
                    {/* Subscriber Profile */}
                    <td className="px-5 py-4">
                      <div className="text-left">
                        <p className="font-semibold text-[#111111]">{c.name}</p>
                        <p className="text-[10px] text-[#86868B] mt-0.5">{c.domain}</p>
                      </div>
                    </td>

                    {/* Active Plan Tier */}
                    <td className="px-5 py-4 text-left">
                      <span className="font-medium text-[#111111]">
                        {planObj?.name || "Free Starter"}
                      </span>
                    </td>

                    {/* Cycle Usage Gauge */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-center max-w-[120px] mx-auto space-y-1 text-[10px]">
                        <span className={`font-mono font-semibold ${isLimitExceeded ? "text-red-600 font-bold" : "text-stone-700"}`}>
                          {c.usageUnits.toLocaleString()} / {(planObj?.includedUsage || 10000).toLocaleString()}
                        </span>
                        <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, (c.usageUnits / (planObj?.includedUsage || 10000)) * 100)}%` }}
                            className={`h-full ${isLimitExceeded ? "bg-red-500" : "bg-black"}`}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Cost */}
                    <td className="px-5 py-4 text-right font-bold text-[#111111]">
                      {planObj ? formatCurrency(planObj.price, planObj.currency) : "₦0"}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase rounded-full tracking-wider ${
                        c.status === "active"
                          ? "bg-neutral-900 text-white"
                          : c.status === "trial"
                          ? "bg-[#FAFAFA] text-[#111111] border border-[#E5E5E7]"
                          : "bg-red-50 text-red-700 border border-red-100"
                      }`}>
                        {c.status}
                      </span>
                    </td>

                    {/* Setup Tweak button */}
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setSelectedPlanId(c.planId);
                          setSelectedStatus(c.status);
                        }}
                        className="text-[10px] bg-white border border-[#E5E5E7] hover:bg-[#FAFAFA] font-bold px-2 py-1 rounded cursor-pointer transition-all"
                      >
                        Adjust
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Change Sub tier Widget Forms (4 columns) */}
        <div className="lg:col-span-4 space-y-4 text-left">
          <h3 className="text-xs font-bold text-[#6E6E73] uppercase tracking-wider px-1">Subscription Adjuster</h3>

          {selectedCustomerId ? (
            <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl shadow-sm space-y-4 text-left">
              <div className="border-b pb-2.5">
                <h4 className="text-xs font-bold text-[#111111]">
                  Adjusting {activeCustomer?.name}
                </h4>
                <p className="text-[10px] text-[#6E6E73]">Update plans in compliance grids.</p>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* Plan Tier selection */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Assign pricing plan</label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full text-xs border border-[#E5E5E7] rounded-lg p-2 bg-[#FAFAFA]"
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Status tweak */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Workspace state</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full text-xs border border-[#E5E5E7] rounded-lg p-2 bg-[#FAFAFA]"
                  >
                    <option value="active">Active Subscriber</option>
                    <option value="trial">Trial Onboarding</option>
                    <option value="paused">Paused Account</option>
                    <option value="canceled">Canceled Subscription</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleAdjustClient}
                    disabled={isAdjusting}
                    className="w-full py-2 rounded-lg bg-[#111111] hover:bg-[#1D1D1F] text-white text-xs font-bold cursor-pointer text-center"
                  >
                    {isAdjusting ? "Synchronizing state..." : "Adjust Parameters"}
                  </button>
                </div>

                {adjustSuccessMsg && (
                  <div className="p-2 bg-neutral-50 border border-neutral-200 text-neutral-800 rounded-lg text-[10px] font-semibold text-center flex items-center justify-center gap-1.5 animate-pulse">
                    <Check className="h-3 w-3 text-neutral-800" />
                    Subscriber tier re-aligned successfully.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-neutral-50/50 border border-dashed border-[#E5E5E7] p-6 rounded-2xl text-center text-xs text-[#6E6E73]">
              <Sliders className="h-6 w-6 mx-auto text-stone-700 mb-2" />
              <p className="font-semibold">No subscriber active</p>
              <p className="text-[10px] text-[#86868B] mt-0.5">Click 'Adjust' on any subscriber to update plan contracts and statuses instantly.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
