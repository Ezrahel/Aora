import { useState } from "react";
import { Users, FileText, CheckCircle, Clock, AlertTriangle, MessageSquare, Plus, CreditCard, ChevronRight, Scale, Sliders, Check } from "lucide-react";
import { Customer, Plan } from "../types";

interface CustomerWorkspaceViewProps {
  customers: Customer[];
  plans: Plan[];
  onNoteAdded: () => void;
  onPlanAdjusted: () => void;
}

export default function CustomerWorkspaceView({
  customers,
  plans,
  onNoteAdded,
  onPlanAdjusted
}: CustomerWorkspaceViewProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || "");
  const [noteText, setNoteText] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("Ademola Olushola");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Status editing state
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustSuccessMsg, setAdjustSuccessMsg] = useState(false);

  // Active customer object
  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setIsSubmittingNote(true);
    try {
      const response = await fetch(`/api/customers/${activeCustomer.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: noteText,
          author: noteAuthor
        })
      });

      if (!response.ok) {
        throw new Error("Failed to add customer note.");
      }

      setNoteText("");
      onNoteAdded(); // notifies parent

    } catch (err) {
      alert("Error logging note: " + err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleAdjustClient = async () => {
    setIsAdjusting(true);
    try {
      const response = await fetch(`/api/customers/${activeCustomer.id}/adjustPlan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanId || activeCustomer.planId,
          status: selectedStatus || activeCustomer.status
        })
      });

      if (!response.ok) {
        throw new Error("Failed to adjust customer parameters.");
      }

      setAdjustSuccessMsg(true);
      onPlanAdjusted(); // notifies parent
      setTimeout(() => setAdjustSuccessMsg(false), 3000);

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
      
      {/* Visual Header Banner */}
      <div className="border-b border-[#E5E5E7] pb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-[#111111]">Customers Workspace</h2>
        <p className="text-xs text-[#6E6E73] mt-1.5 font-medium">
          Manage deep profile relationships, inspect current invoices, track exact consumption, and append admin logs interactively inside timelines.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left pane: Scrollable Master customer List (4 cols) */}
        <div className="lg:col-span-4 space-y-3.5">
          <h3 className="text-xs font-bold text-[#6E6E73] uppercase tracking-wider px-1">Customer Inventory</h3>
          
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {customers.map((c) => {
              const isActive = selectedCustomerId === c.id;
              const activePlanObj = plans.find(p => p.id === c.planId);
              return (
                <button
                  key={c.id}
                  id={`customer-inventory-item-${c.id}`}
                  onClick={() => {
                    setSelectedCustomerId(c.id);
                    setSelectedPlanId(c.planId);
                    setSelectedStatus(c.status);
                  }}
                  className={`w-full text-left rounded-xl p-3.5 transition-all outline-none border flex items-center justify-between ${
                    isActive
                      ? "bg-white border-[#111111] shadow-md"
                      : "bg-[#FAFAFA] border-[#E5E5E7] hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs border text-center ${c.logoColor || "bg-neutral-100"}`}>
                      {c.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#111111] tracking-tight">{c.name}</h4>
                      <p className="text-[10px] text-[#6E6E73] mt-0.5">{c.domain}</p>
                    </div>
                  </div>
                  
                  <div className="text-right flex flex-col items-end gap-1.5">
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      c.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : c.status === "trial"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-red-50 text-red-700"
                    }`}>
                      {c.status}
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">
                      {activePlanObj ? activePlanObj.name : "Free Starter"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right pane: Beautiful high-fidelity timeline drawer detailed workspace (8 cols) */}
        {activeCustomer && (
          <div className="lg:col-span-8 space-y-6">
            
            {/* Upper: profile detail card summary */}
            <div className="bg-white border border-[#E5E5E7] p-6 rounded-2xl shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#F5F5F7] pb-4.5 gap-4">
                <div className="flex items-center gap-3.5">
                  <div className={`h-11 w-11 rounded-full flex items-center justify-center font-extrabold text-sm border ${activeCustomer.logoColor || "bg-neutral-100"}`}>
                    {activeCustomer.name.substring(0,2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <h3 className="text-base font-bold text-[#111111] tracking-tight">{activeCustomer.name}</h3>
                    <p className="text-xs text-[#6E6E73] mt-0.5">Admin billing mail: {activeCustomer.email}</p>
                  </div>
                </div>

                <div className="flex bg-[#F5F5F7] rounded-full p-0.5 text-[9px] font-bold text-[#6E6E73] border border-[#E5E5E7] self-start md:self-auto">
                  <span className="px-2.5 py-1">ID: {activeCustomer.id}</span>
                  <span className="border-l border-[#E5E5E7] px-2.5 py-1 text-emerald-700 font-semibold bg-white rounded-full shadow-sm">Created: {activeCustomer.createdDate}</span>
                </div>
              </div>

              {/* Grid statistics metrics: payment, active allocations, leads usage percentage */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5 text-left">
                
                {/* Contract Status / Plan */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">Contract plan</span>
                  <p className="text-xs font-semibold text-[#111111]">
                    {plans.find(p=>p.id===activeCustomer.planId)?.name || "Starter Mock Plan"}
                  </p>
                  <p className="text-[10px] text-[#6E6E73] font-mono">
                    Limit: {plans.find(p=>p.id===activeCustomer.planId)?.includedUsage.toLocaleString()} Units
                  </p>
                </div>

                {/* Metered Overage */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">Usage cycle units</span>
                  <p className="text-xs font-semibold text-[#111111] flex items-center gap-1">
                    {activeCustomer.usageUnits.toLocaleString()} Consumption
                  </p>
                  <div className="h-1.5 w-full bg-[#F5F5F7] rounded-full overflow-hidden mt-1 max-w-[120px]">
                    <div
                      style={{ width: `${Math.min(100, (activeCustomer.usageUnits / (plans.find(p=>p.id===activeCustomer.planId)?.includedUsage || 1000)) * 100)}%` }}
                      className={`h-full ${activeCustomer.usageUnits > (plans.find(p=>p.id===activeCustomer.planId)?.includedUsage || 1000) ? "bg-rose-500" : "bg-[#0071E3]"}`}
                    />
                  </div>
                </div>

                {/* Credit card credentials */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block font-medium">Card gateway source</span>
                  {activeCustomer.paymentMethod ? (
                    <div className="flex items-center gap-1.5 text-xs text-[#111111] font-semibold mt-1">
                      <CreditCard className="h-4 w-4 text-[#6E6E73] shrink-0" />
                      <span>{activeCustomer.paymentMethod.brand} •••• {activeCustomer.paymentMethod.last4}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-[#FF453A] font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      No Card configured Ledger fallback
                    </p>
                  )}
                  <p className="text-[10px] text-[#6E6E73]" onClick={() => alert("Simulate update payment logic triggered")}>Click to configure gateway</p>
                </div>

              </div>
            </div>

            {/* Bottom: split view between Timeline and Fast Action config Form */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              
              {/* Left detail: Feed of Notes, Invoices, Contracts (7 cols) */}
              <div className="md:col-span-8 space-y-5">
                
                {/* Timelines segment */}
                <div className="bg-white border border-[#E5E5E7] p-5.5 rounded-2xl text-left space-y-4 shadow-sm">
                  <h4 className="text-xs font-bold text-[#111111] flex items-center gap-1.5 border-b border-[#F5F5F7] pb-2.5">
                    <FileText className="h-4 w-4 text-[#86868B]" />
                    Client Billing Ledger history
                  </h4>

                  {/* Timelines list */}
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    
                    {/* Notes item block */}
                    {activeCustomer.notes.map((note) => (
                      <div key={note.id} className="relative pl-5 border-l-2 border-[#111111]/30 pb-3 last:pb-0">
                        <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-[#111111] ring-4 ring-[#FFFFFF]" />
                        <div className="text-xs">
                          <p className="text-[#111111] font-medium leading-relaxed">{note.text}</p>
                          <div className="flex items-center gap-2 text-[9px] text-[#6E6E73] mt-1">
                            <span className="font-bold text-black">Author: {note.author}</span>
                            <span>•</span>
                            <span>{new Date(note.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Invoices list */}
                    {activeCustomer.invoices.map((inv) => (
                      <div key={inv.id} className="relative pl-5 border-l-2 border-dashed border-neutral-300 pb-3 last:pb-0">
                        <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-blue-600 ring-4 ring-[#FFFFFF]" />
                        <div className="text-xs flex justify-between items-start gap-2">
                          <div>
                            <p className="text-[#111111] font-semibold">Invoice issued: <span className="font-mono text-[10px] bg-[#F5F5F7] px-1 py-0.5 rounded">{inv.id}</span></p>
                            <p className="text-[10px] text-[#6E6E73] mt-0.5">Quantity consumed: {inv.usageUnits.toLocaleString()} units</p>
                            <p className="text-[9px] text-[#86868B]">{inv.date}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-extrabold text-[#111111] block">
                              {formatCurrency(inv.amount, inv.currency)}
                            </span>
                            <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-1 ${
                              inv.status === "paid" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                            }`}>
                              {inv.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {activeCustomer.notes.length === 0 && activeCustomer.invoices.length === 0 && (
                      <p className="text-[#6E6E73] text-xs text-center py-4">No billing events on timeline.</p>
                    )}

                  </div>
                </div>

                {/* Sub: Contracts */}
                <div className="bg-[#FFFFFF] border border-[#E5E5E7] p-5.5 rounded-2xl text-left space-y-3.5 shadow-sm">
                  <h4 className="text-xs font-bold text-[#111111]">Contract & SLA files</h4>
                  <div className="space-y-2">
                    {activeCustomer.contracts.map((ct, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFAFA] border border-[#E5E5E7] text-xs">
                        <span className="font-medium text-[#111111]">{ct.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#86868B] font-mono">{ct.value}</span>
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 rounded font-bold uppercase pr-1.5">
                            Signed
                          </span>
                        </div>
                      </div>
                    ))}
                    {activeCustomer.contracts.length === 0 && (
                      <p className="text-[11px] text-[#6E6E73] font-medium py-1">No bespoke service contract signed. Standard public checkout pricing applies.</p>
                    )}
                  </div>
                </div>

              </div>

              {/* Right detail form: Configure Admin tweaks & add notes (5 cols) */}
              <div className="md:col-span-4 space-y-4">
                
                {/* Fast Note creation */}
                <div className="bg-[#FAFAFA] border border-[#E5E5E7] p-4.5 rounded-xl text-left space-y-3">
                  <h4 className="text-[11px] font-bold text-[#6E6E73] uppercase tracking-wider flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Write Admin Log note
                  </h4>
                  
                  <div className="space-y-2.5">
                    <textarea
                      id="customer-note-textarea"
                      placeholder="Comment on conversation, issues or retry actions..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="w-full text-xs border border-[#E5E5E7] outline-none rounded-lg p-2 bg-white text-[#111111] h-16 resize-none"
                    />
                    <input
                      id="customer-note-author"
                      type="text"
                      placeholder="Author"
                      value={noteAuthor}
                      onChange={(e) => setNoteAuthor(e.target.value)}
                      className="w-full text-xs border border-[#E5E5E7] outline-none rounded-lg p-2 bg-white text-[#111111]"
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={isSubmittingNote || !noteText.trim()}
                      className="w-full py-1.5 rounded-lg bg-[#111111] hover:bg-[#1D1D1F] text-white text-[11px] font-semibold cursor-pointer text-center"
                      id="save-customer-note-btn"
                    >
                      Save to profile timeline
                    </button>
                  </div>
                </div>

                {/* Fast Plan tweak / Status adjusting */}
                <div className="bg-[#FAFAFA] border border-[#E5E5E7] p-4.5 rounded-xl text-left space-y-3">
                  <h4 className="text-[11px] font-bold text-[#6E6E73] uppercase tracking-wider flex items-center gap-1">
                    <Sliders className="h-3.5 w-3.5 text-stone-700" />
                    Adjust subscription
                  </h4>

                  <div className="space-y-3">
                    
                    {/* Plan Tier */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Assign pricing catalog</label>
                      <select
                        id="adjust-customer-plan"
                        value={selectedPlanId}
                        onChange={(e) => setSelectedPlanId(e.target.value)}
                        className="w-full text-xs border border-[#E5E5E7] rounded p-1 p-y bg-white text-[#111111]"
                      >
                        <option value="">No change -- Current ({activeCustomer.planId})</option>
                        {plans.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Status Tweak */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Workspace state</label>
                      <select
                        id="adjust-customer-status"
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="w-full text-xs border border-[#E5E5E7] rounded p-1 p-y bg-white text-[#111111]"
                      >
                        <option value="">No change -- Current ({activeCustomer.status})</option>
                        <option value="active">Active</option>
                        <option value="trial">Trial Onboarding</option>
                        <option value="paused">Paused</option>
                        <option value="canceled">Canceled</option>
                      </select>
                    </div>

                    <button
                      onClick={handleAdjustClient}
                      disabled={isAdjusting}
                      className="w-full py-1.5 rounded-lg bg-[#111111] hover:bg-[#1D1D1F] text-white text-[11px] font-bold cursor-pointer text-center transition-all bg-neutral-900 shadow-sm border border-neutral-800"
                      id="apply-subscription-adjustement-btn"
                    >
                      Adjust parameters
                    </button>

                    {adjustSuccessMsg && (
                      <div className="text-[10px] text-neutral-800 bg-neutral-50 border border-neutral-200 p-2 rounded font-semibold text-center flex items-center justify-center gap-1">
                        <Check className="h-3 w-3 text-neutral-800" />
                        Subscriber updated successfully!
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
