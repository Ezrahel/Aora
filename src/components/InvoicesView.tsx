import { useState } from "react";
import {
  Receipt,
  Search,
  Filter,
  ArrowUpRight,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { Invoice, Customer } from "../types";

interface InvoicesViewProps {
  invoices: Invoice[];
  customers: Customer[];
  onInvoiceCreated: () => void;
}

export default function InvoicesView({
  invoices,
  customers,
  onInvoiceCreated,
}: InvoicesViewProps) {
  // Creating invoice form state
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    customers[0]?.id || "",
  );
  const [amount, setAmount] = useState(25000);
  const [currency, setCurrency] = useState("NGN");
  const [usageUnits, setUsageUnits] = useState(5000);
  const [status, setStatus] = useState<"paid" | "open" | "past_due" | "draft">(
    "draft",
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Search filter
  const [query, setQuery] = useState("");

  const handleCreateInvoice = async () => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          amount,
          currency,
          usageUnits,
          status,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to post custom invoice.");
      }

      setIsSuccess(true);
      onInvoiceCreated(); // refresh lists
      setTimeout(() => setIsSuccess(false), 2500);
    } catch (err) {
      alert("Error issuing invoice: " + err);
    } finally {
      setIsCreating(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const filteredInvoices = invoices.filter((inv) => {
    const term = query.toLowerCase();
    return (
      inv.id.toLowerCase().includes(term) ||
      (inv.customerName || "").toLowerCase().includes(term) ||
      (inv.customerEmail || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Intro Greetings banner */}
      <div className="border-b border-[#E5E5E7] pb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Invoices Ledger
        </h2>
        <p className="text-xs text-[#6E6E73] mt-1.5 font-medium">
          Audit operational billing histories. Track invoice settlements, filter
          past collections across workspaces, and issue mock billing contracts.
        </p>
      </div>

      {/* Split layout (2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column (8 cols): Invoices master list with filters */}
        <div className="lg:col-span-8 space-y-4">
          {/* Filter Bar input */}
          <div className="flex bg-[#F5F5F7] p-2 rounded-xl items-center gap-2">
            <Search className="h-4 w-4 text-[#86868B] ml-2" />
            <input
              id="invoice-search-input"
              type="text"
              placeholder="Filter by serial name, billing mail or profile IDs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-[#111111] outline-none placeholder:text-[#86868B] py-1.5"
            />
          </div>

          <div className="bg-white border border-[#E5E5E7] rounded-2xl overflow-hidden shadow-sm">
            <table
              className="w-full text-left border-collapse"
              id="invoices-ledger-table"
            >
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E5E5E7] text-[10px] text-[#6E6E73] font-bold uppercase tracking-wider">
                  <th className="px-5 py-3.5">Invoice Serial</th>
                  <th className="px-5 py-3.5">Customer Profile</th>
                  <th className="px-5 py-3.5 text-center">Consumption</th>
                  <th className="px-5 py-3.5 text-right">Settled Amount</th>
                  <th className="px-5 py-3.5 text-center">Gateway</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F7] text-xs">
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-[#FAFAFA] transition-all"
                  >
                    {/* Invoice ID */}
                    <td className="px-5 py-4 font-mono font-bold text-[#111111]">
                      {inv.id}
                    </td>

                    {/* Customer Info */}
                    <td className="px-5 py-4">
                      <div className="text-left">
                        <p className="font-semibold text-[#111111]">
                          {inv.customerName || "Sandbox User"}
                        </p>
                        <p className="text-[10px] text-[#86868B]">
                          {inv.customerEmail || "noreply@aora.sh"}
                        </p>
                      </div>
                    </td>

                    {/* Consumptions indicators */}
                    <td className="px-5 py-4 text-center font-mono text-stone-500 font-medium">
                      {inv.usageUnits.toLocaleString()} units
                    </td>

                    {/* Cost */}
                    <td className="px-5 py-4 text-right font-extrabold text-[#111111]">
                      {formatCurrency(inv.amount, inv.currency)}
                    </td>

                    {/* Gateway Status */}
                    <td className="px-5 py-4 text-center">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-wider">
                        Local
                      </span>
                    </td>

                    {/* Label states */}
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase rounded-full tracking-wider ${
                          inv.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : inv.status === "past_due"
                              ? "bg-red-50 text-red-700 border border-red-100"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {inv.status === "paid" && (
                          <CheckCircle className="h-2.5 w-2.5" />
                        )}
                        {inv.status === "past_due" && (
                          <AlertCircle className="h-2.5 w-2.5 text-[#FF453A]" />
                        )}
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {filteredInvoices.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-12 text-center text-xs text-[#6E6E73] font-medium"
                    >
                      No invoices found matching query targets.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column (4 cols): Fast manual Invoice creation generator */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-xs font-bold text-[#6E6E73] uppercase tracking-wider text-left">
            Issue Manual Contract Invoice
          </h3>

          <div className="bg-[#FFFFFF] border border-[#E5E5E7] p-5 rounded-2xl space-y-4.5 text-left shadow-sm">
            <h4 className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
              <Receipt className="h-4.5 w-4.5 text-[#0071E3]" />
              Manual Invoice Builder
            </h4>

            {/* Customer Switcher */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-[#6E6E73] uppercase tracking-wider block">
                Customer Destination
              </label>
              <select
                id="invoice-create-customer"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full text-xs border border-[#E5E5E7] rounded-lg p-2 bg-[#FAFAFA] text-[#111111]"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Invoiced Cost input */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-[#6E6E73] uppercase tracking-wider block">
                  Gross Fee
                </label>
                <input
                  id="invoice-create-price"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full text-xs border border-[#E5E5E7] rounded-lg p-2 bg-[#FAFAFA] text-[#111111]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-[#6E6E73] uppercase tracking-wider block">
                  Currency
                </label>
                <select
                  id="invoice-create-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full text-xs border border-[#E5E5E7] rounded-lg p-2 bg-[#FAFAFA] text-[#111111]"
                >
                  <option value="NGN">₦ NGN</option>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                </select>
              </div>
            </div>

            {/* Usage quantity count & Status options */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-[#6E6E73] uppercase tracking-wider block">
                  Usage units
                </label>
                <input
                  id="invoice-create-usage"
                  type="number"
                  value={usageUnits}
                  onChange={(e) => setUsageUnits(Number(e.target.value))}
                  className="w-full text-xs border border-[#E5E5E7] rounded-lg p-1.5 bg-[#FAFAFA] text-[#111111]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-[#6E6E73] uppercase tracking-wider block">
                  Bill Status
                </label>
                <select
                  id="invoice-create-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full text-xs border border-[#E5E5E7] rounded-lg p-1.5 bg-[#FAFAFA] text-[#111111]"
                >
                  <option value="draft">Draft Code</option>
                  <option value="open">Open (Unpaid)</option>
                  <option value="paid">Pre-settled (Paid)</option>
                  <option value="past_due">Past Due (Delinquent)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleCreateInvoice}
              disabled={isCreating}
              className="w-full py-2 bg-[#111111] hover:bg-[#1D1D1F] text-white text-xs font-bold rounded-lg cursor-pointer text-center"
              id="invoice-deploy-btn"
            >
              {isCreating
                ? "Deploying invoice ledger..."
                : "Issue & Deploy Invoice"}
            </button>

            {isSuccess && (
              <div className="p-2.5 bg-neutral-50 text-neutral-800 rounded-lg text-[10px] font-semibold text-center flex items-center justify-center gap-1 border border-neutral-200">
                <CheckCircle className="h-3.5 w-3.5 text-neutral-800 font-bold" />
                Invoice processed. Sync nodes active!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
