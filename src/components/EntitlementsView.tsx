import { useState } from "react";
import {
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Check,
  X,
  ShieldAlert,
  Key,
  RefreshCw,
  Crown,
  AlertTriangle,
} from "lucide-react";
import { Customer, Entitlement, Plan } from "../types";

interface EntitlementsViewProps {
  entitlements: Entitlement[];
  plans: Plan[];
  customers: Customer[];
  onEntitlementUpdated: () => void;
}

export default function EntitlementsView({
  entitlements,
  plans,
  customers,
  onEntitlementUpdated,
}: EntitlementsViewProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    customers[0]?.id || "",
  );
  const [modifyingId, setModifyingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Evaluate features for the selected customer
  const targetCustomer = customers.find((c) => c.id === selectedCustomerId);
  const tempPlan = plans.find((p) => p.id === targetCustomer?.planId);

  // Calculate index values to check hierarchy level
  const planTierWeight = (planId: string) => {
    if (planId === "free") return 0;
    if (planId === "growth") return 1;
    if (planId === "scale") return 2;
    return 3;
  };

  // Trigger modification to endpoint
  const handleToggleGate = async (
    featureId: string,
    currentEnabled: boolean,
  ) => {
    setModifyingId(featureId);
    try {
      const response = await fetch(`/api/entitlements/${featureId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isEnabled: !currentEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to configure gated entitlement.");
      }

      setSuccessId(featureId);
      onEntitlementUpdated();
      setTimeout(() => setSuccessId(null), 2000);
    } catch (err) {
      alert("Error configuring: " + err);
    } finally {
      setModifyingId(null);
    }
  };

  // Trigger changing plan constraint on endpoint
  const handleUpdateLevel = async (featureId: string, newPlanId: string) => {
    setModifyingId(featureId);
    try {
      const response = await fetch(`/api/entitlements/${featureId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requiredPlanId: newPlanId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to map plan dependency.");
      }

      setSuccessId(featureId);
      onEntitlementUpdated();
      setTimeout(() => setSuccessId(null), 2500);
    } catch (err) {
      alert("Error configuring: " + err);
    } finally {
      setModifyingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Intro Greetings banner */}
      <div className="border-b border-[#E5E5E7] pb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Entitlements Engine
        </h2>
        <p className="text-xs text-[#6E6E73] mt-1.5 font-medium">
          Map logic gates, manage feature accesses, and govern functional flags
          across plans. Protect your premium features without writing custom
          routing rules.
        </p>
      </div>

      {/* Grid: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Interactive Table of feature gates */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#6E6E73] uppercase tracking-wider">
              Feature Gates & Toggles
            </h3>
            <span className="text-[10px] text-gray-500 font-semibold">
              Workspace Level Autopilot
            </span>
          </div>

          <div className="bg-white border border-[#E5E5E7] rounded-2xl overflow-x-auto shadow-sm">
            <table
              className="w-full text-left border-collapse"
              id="entitlements-table"
            >
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E5E5E7] text-[10px] text-[#6E6E73] font-bold uppercase tracking-wider">
                  <th className="px-5 py-3">Feature Definition</th>
                  <th className="px-5 py-3">Required Tier</th>
                  <th className="px-5 py-3 text-center">Global Toggle</th>
                  <th className="px-5 py-3 text-right">Gate Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F7] text-xs">
                {entitlements.map((item) => (
                  <tr
                    key={item.featureId}
                    className="hover:bg-neutral-50/50 transition-colors"
                  >
                    {/* Feature label */}
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-5.5 w-5.5 items-center justify-center rounded-md bg-[#F5F5F7] border border-[#E5E5E7] text-[#111111]">
                          <Crown className="h-3 w-3" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-[#111111]">
                            {item.featureName}
                          </p>
                          <p className="text-[10px] text-[#6E6E73] mt-0.5 max-w-sm">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Target level dropdown mapping */}
                    <td className="px-5 py-4">
                      <select
                        id={`entitlement-level-select-${item.featureId}`}
                        value={item.requiredPlanId}
                        onChange={(e) =>
                          handleUpdateLevel(item.featureId, e.target.value)
                        }
                        className="text-xs bg-[#FAFAFA] border border-[#E5E5E7] text-[#111111] rounded-lg p-1.5 focus:border-neutral-800 outline-none font-medium text-center"
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Global toggle switch */}
                    <td className="px-5 py-4 text-center">
                      <button
                        id={`entitlement-toggle-btn-${item.featureId}`}
                        onClick={() =>
                          handleToggleGate(item.featureId, item.isEnabled)
                        }
                        disabled={modifyingId === item.featureId}
                        className="inline-block hover:scale-105 cursor-pointer transition-transform duration-100 text-neutral-800"
                        title={
                          item.isEnabled
                            ? "Gate is active globally"
                            : "Gate is disabled globally"
                        }
                      >
                        {item.isEnabled ? (
                          <ToggleRight className="h-7 w-7 text-[#0071E3] fill-[#0071E3]/5" />
                        ) : (
                          <ToggleLeft className="h-7 w-7 text-neutral-300" />
                        )}
                      </button>
                    </td>

                    {/* Gate State status */}
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          item.isEnabled
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        <span
                          className={`h-1 w-1 rounded-full ${item.isEnabled ? "bg-emerald-500" : "bg-rose-500"}`}
                        />
                        {item.isEnabled ? "Enforcing" : "Bypassed"}
                      </span>
                      {successId === item.featureId && (
                        <span className="block text-[9px] text-[#34C759] mt-1 font-bold">
                          Deployed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (4 cols): Live Client entitlements validator box (The Real Mock simulator!) */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-xs font-bold text-[#6E6E73] uppercase tracking-wider">
            Gate Testing Simulator
          </h3>

          <div className="bg-[#FFFFFF] border-2 border-[#111111] p-5 rounded-2xl space-y-5 shadow-lg">
            <h4 className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
              <ShieldCheck className="h-4.5 w-4.5 text-[#34C759]" />
              Entitlement Verification Sandbox
            </h4>

            <p className="text-[10px] text-[#6E6E73] font-medium leading-relaxed">
              Select a customer profile from your ledger workspace to evaluate
              feature access gates based on hierarchical levels.
            </p>

            {/* Selector */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-[#6E6E73] uppercase tracking-wider block">
                Customer Target
              </label>
              <select
                id="sandbox-customer-switcher"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full text-xs border border-[#E5E5E7] rounded-lg p-2.5 bg-[#FAFAFA] text-[#111111] font-semibold"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Current computed level card header */}
            <div className="bg-[#FAFAFA] border border-[#E5E5E7] p-3 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[9px] text-[#6E6E73] font-mono leading-none">
                  Customer plan tier
                </p>
                <p className="text-xs font-bold text-[#111111] mt-1 leading-none">
                  {tempPlan?.name || "No Plan Active"}
                </p>
              </div>
              <span className="text-[10px] bg-[#111111] text-white px-2 py-0.5 rounded-md font-semibold font-mono">
                {tempPlan?.currency === "NGN" ? "₦" : "$"}
                {tempPlan?.price.toLocaleString()}/mo
              </span>
            </div>

            {/* List of checked permissions gates */}
            <div className="space-y-3 pt-2">
              <h5 className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider">
                Evaluated Core Accesses
              </h5>

              <div className="space-y-2 text-xs">
                {entitlements.map((ent) => {
                  const customerWeight = planTierWeight(
                    targetCustomer?.planId || "free",
                  );
                  const requiredWeight = planTierWeight(ent.requiredPlanId);

                  // Allowed if customer is equivalent weight or greater, AND gate toggle is enabled
                  const hasHierarchy = customerWeight >= requiredWeight;
                  const isUnlocked = ent.isEnabled ? hasHierarchy : true; // if disabled, gate is bypassed

                  return (
                    <div
                      key={ent.featureId}
                      className={`flex items-center justify-between p-2.5 rounded-lg border ${
                        isUnlocked
                          ? "bg-[#FAFAFA] border-[#E5E5E7] text-[#111111]"
                          : "bg-rose-50/40 border-rose-100 text-stone-600"
                      }`}
                    >
                      <div className="text-left min-w-0 flex-1 pr-1.5">
                        <p className="font-bold text-[11px] truncate">
                          {ent.featureName}
                        </p>
                        <p className="text-[9px] text-[#6E6E73]">
                          Requires:{" "}
                          {plans.find((p) => p.id === ent.requiredPlanId)
                            ?.name || ent.requiredPlanId}
                        </p>
                      </div>

                      {isUnlocked ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-[#34C759]">
                          <Check className="h-3 w-3 bg-[#34C759] text-white rounded-full p-0.5 shrink-0" />
                          Unlocked
                        </span>
                      ) : (
                        <div className="text-right shrink-0">
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-[#FF453A]">
                            <X className="h-3 w-3 bg-[#FF453A] text-white rounded-full p-0.5 mr-0.5" />
                            Locked
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Warning if customer is on free tier */}
            {targetCustomer?.planId === "free" && (
              <div className="p-3 bg-neutral-50 text-neutral-800 rounded-xl text-[10px] leading-relaxed border border-neutral-200 font-medium flex gap-2">
                <AlertTriangle className="h-4.5 w-4.5 text-neutral-600 shrink-0" />
                <span>
                  <strong>{targetCustomer?.name}</strong> is on the Free Tier.
                  API tools will throw <strong>HTTP 403 Forbidden</strong> until
                  they configure high volume billing on subscription panels.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
