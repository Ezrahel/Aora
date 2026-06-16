import { useState } from "react";
import {
  Sparkles,
  CreditCard,
  CheckCircle,
  HelpCircle,
  Activity,
  Layers,
  FileText,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Check,
  Coins
} from "lucide-react";
import { Customer, Plan } from "../types";

interface CustomerPortalViewProps {
  customers: Customer[];
  plans: Plan[];
}

export default function CustomerPortalView({
  customers,
  plans
}: CustomerPortalViewProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || "");
  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];

  const activePlanObj = plans.find(p => p.id === activeCustomer?.planId);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Top Selector Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#E5E5E7] pb-6 gap-4 text-left">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#111111]">Customer Portal Preview</h2>
          <p className="text-xs text-[#6E6E73] mt-1.5 font-medium">
            Inspect exactly what your subscribers see. Preview credit states, bill breakdowns, usage lines, and self-serve upgrade flows before dispatching.
          </p>
        </div>

        {/* Customer Toggler */}
        <div className="flex items-center gap-2 text-xs font-semibold self-start md:self-auto bg-neutral-50 px-3 py-1.5 rounded-full border border-neutral-200">
          <span className="text-stone-500">Preview as:</span>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="bg-transparent border-0 outline-none text-black font-semibold cursor-pointer"
          >
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {activeCustomer ? (
        <div className="max-w-4xl mx-auto space-y-6 text-left">
          
          {/* Active Subscriber Customer View simulated iframe */}
          <div className="bg-white border border-[#E5E5E7] rounded-3xl shadow-xl overflow-hidden">
            
            {/* Simulated Frame Top Menu bar */}
            <div className="bg-[#FAFAFA] border-b border-[#E5E5E7] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-6 w-6 rounded-lg ${activeCustomer.logoColor || "bg-neutral-800 text-white"} flex items-center justify-center text-[10px] font-extrabold`}>
                  {activeCustomer.name.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-[#111111]">{activeCustomer.name} Portal</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">Client View</span>
              </div>
              <div className="text-[10px] text-stone-500 font-mono font-semibold">
                Domain: <span className="text-[#111111]">{activeCustomer.domain}</span>
              </div>
            </div>

            {/* Simulated Interior Main content */}
            <div className="p-8 space-y-8">
              
              {/* Upper split dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                
                {/* Current plan (7 columns) */}
                <div className="md:col-span-8 space-y-6">
                  
                  {/* Active plan billing parameters */}
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">Your Plan Subscription</span>
                    
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="text-xl font-bold text-[#111111] tracking-tight">
                          {activePlanObj ? activePlanObj.name : "Free Starter"}
                        </h3>
                        <p className="text-xs text-[#6E6E73]">
                          {activePlanObj?.description || "Basic workspace level access."}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xl font-black text-[#111111]">
                          {activePlanObj ? formatCurrency(activePlanObj.price, activePlanObj.currency) : "₦0"}
                        </p>
                        <p className="text-[10px] text-[#6E6E73] font-medium mt-0.5">Renewing monthly</p>
                      </div>
                    </div>
                  </div>

                  {/* Limit Usage tracker progress gauge */}
                  <div className="bg-neutral-50/50 p-5 rounded-2xl border border-neutral-200/60 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#111111]">Usage Tracker Inbound API Requests</span>
                      <span className="font-mono font-bold text-[#6E6E73]">
                        {activeCustomer.usageUnits.toLocaleString()} / {(activePlanObj?.includedUsage || 10000).toLocaleString()} Units
                      </span>
                    </div>

                    <div className="h-2 w-full bg-neutral-200/60 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, (activeCustomer.usageUnits / (activePlanObj?.includedUsage || 10000)) * 100)}%` }}
                        className="h-full bg-black rounded-full"
                      />
                    </div>

                    <p className="text-[10px] text-[#86868B] leading-none pt-1">
                      Reset cycle date scheduled for <strong className="text-black">July 1, 2026</strong>. Overages incur ₦1.5 per request.
                    </p>
                  </div>

                </div>

                {/* Card side details (5 columns) */}
                <div className="md:col-span-4 bg-neutral-50/50 rounded-2xl border border-neutral-150 p-5 space-y-4">
                  <div className="space-y-1.5 border-b pb-3 border-neutral-200">
                    <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wide">Subscription State</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-[#111111] uppercase tracking-wide">{activeCustomer.status}</span>
                    </div>
                  </div>

                  {/* Gateway payment card source */}
                  <div className="space-y-2 border-b pb-3 border-neutral-200">
                    <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wide block">Payment Source</span>
                    {activeCustomer.paymentMethod ? (
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#111111]">
                        <CreditCard className="h-4 w-4 text-[#6E6E73]" />
                        <span>{activeCustomer.paymentMethod.brand} •••• {activeCustomer.paymentMethod.last4}</span>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-red-600 block">No Card Linked</span>
                    )}
                  </div>

                  {/* Credits balance */}
                  <div className="space-y-1 font-medium">
                    <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wide block">Prepaid Credits Remaining</span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 p-1.5 rounded-lg">
                      <Coins className="h-4 w-4" />
                      <span>₦12,500 Auto Credits Available</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Invoices panel */}
              <div className="space-y-4 pt-4 border-t border-neutral-100">
                <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">Settlement & Invoices history</span>

                <div className="space-y-2.5">
                  {activeCustomer.invoices.map((inv) => (
                    <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4.5 rounded-xl border border-neutral-200 hover:bg-[#FAFAFA] transition-all gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-[#FAFAFA] border border-neutral-200 text-[#111111] flex items-center justify-center font-mono text-xs font-bold">
                          INV
                        </div>
                        <div className="text-left font-medium">
                          <p className="font-bold text-[#111111]">Invoice {inv.id}</p>
                          <p className="text-[10px] text-[#6E6E73] mt-0.5">Issued on {inv.date || "June 1, 2026"}</p>
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-4 self-end sm:self-auto">
                        <span className="font-black text-[#111111]">
                          {formatCurrency(inv.amount, inv.currency)}
                        </span>
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                          inv.status === "paid" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                        }`}>
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))}

                  {activeCustomer.invoices.length === 0 && (
                    <p className="text-[#6E6E73] text-xs text-center py-6">No previous invoices found.</p>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      ) : (
        <p className="text-stone-500 text-sm">No customers loaded to simulate portal view.</p>
      )}

    </div>
  );
}
