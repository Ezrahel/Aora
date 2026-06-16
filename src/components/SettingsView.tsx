import { useState, useEffect } from "react";
import { 
  Settings, 
  Check, 
  Save, 
  Users, 
  ShieldCheck, 
  Database, 
  ExternalLink,
  Crown,
  Key
} from "lucide-react";

interface SettingsViewProps {
  workspace: string;
  onWorkspaceConfigUpdated: () => void;
}

export default function SettingsView({ workspace, onWorkspaceConfigUpdated }: SettingsViewProps) {
  const [businessName, setBusinessName] = useState(workspace);
  const [currency, setCurrency] = useState("NGN");
  const [taxId, setTaxId] = useState("VAT-NG-2028-100293");
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [wsInfo, setWsInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Load live multi-tenant workspace credentials
  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/workspace-info?workspace=${encodeURIComponent(workspace)}`);
        if (res.ok) {
          const data = await res.json();
          setWsInfo(data);
          
          if (data.workspace) {
            setBusinessName(data.workspace.name);
            setTaxId(data.workspace.id === "ws_acme" ? "VAT-US-9912832" : "VAT-NG-2028-100293");
            setCurrency(data.workspace.id === "ws_acme" ? "USD" : "NGN");
          }
        }
      } catch (e) {
        console.error("Failed to load settings workspace info", e);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [workspace]);

  const handleSaveConfigs = () => {
    setShowSaveSuccess(true);
    setTimeout(() => {
      setShowSaveSuccess(false);
      onWorkspaceConfigUpdated();
    }, 2500);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Intro Head banner */}
      <div className="border-b border-[#E5E5E7] pb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-[#111111]">System Settings</h2>
        <p className="text-xs text-[#6E6E73] mt-1.5 font-medium">
          Manage workspace profile metadata, localized currency parameters, financial tax registrations, and administrative user controls.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-neutral-500 font-medium">
          Retrieving active workspace compliance setup...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (7 cols): Configuration Form */}
          <div className="lg:col-span-7 bg-white border border-[#E5E5E7] rounded-2xl p-6 space-y-5 text-left shadow-sm">
            <h3 className="text-xs font-bold text-[#6E6E73] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#F5F5F7] pb-2 text-left">
              <Settings className="h-4 w-4 text-[#111111]" />
              Workspace Properties
            </h3>

            {/* Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider block">Registrar Business Name</label>
              <input
                id="settings-business-name"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full text-xs border border-[#E5E5E7] focus:border-neutral-800 outline-none rounded-lg p-2.5 bg-transparent text-[#111111] font-semibold"
              />
            </div>

            {/* Currency Defaults & Tax ID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider block">Ledger Currency defaults</label>
                <select
                  id="settings-currency-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full text-xs border border-[#E5E5E7] focus:border-neutral-800 outline-none rounded-lg p-2.5 bg-transparent text-[#111111] font-medium"
                >
                  <option value="NGN">Naira (₦ NGN)</option>
                  <option value="USD">Dollars ($ USD)</option>
                  <option value="EUR">Euros (€ EUR)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider block font-medium">VAT Registration / Tax ID</label>
                <input
                  id="settings-tax-id"
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full text-xs border border-[#E5E5E7] focus:border-neutral-800 outline-none rounded-lg p-2.5 bg-transparent text-[#111111] font-mono"
                />
              </div>
            </div>

            {/* Active compliance checkboxes */}
            <div className="pt-2 space-y-3">
              <div className="flex items-start gap-2.5">
                <input
                  id="settings-checkbox-dunning"
                  type="checkbox"
                  defaultChecked
                  className="h-4.5 w-4.5 rounded border-[#E5E5E7] text-[#111111] accent-[#111111]"
                />
                <div className="text-left">
                  <label className="text-xs font-semibold text-[#111111] block leading-none">Automated Duning Retry sequences</label>
                  <span className="text-[10px] text-[#6E6E73] leading-none font-medium mt-1 inline-block">Execute smart automatic credit card retries on invoice delinquencies.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <input
                  id="settings-checkbox-compliance"
                  type="checkbox"
                  defaultChecked
                  className="h-4.5 w-4.5 rounded border-[#E5E5E7] text-[#111111] accent-[#111111]"
                />
                <div className="text-left">
                  <label className="text-xs font-semibold text-[#111111] block leading-none">Strict Entitlements enforcement</label>
                  <span className="text-[10px] text-[#6E6E73] leading-none font-medium mt-1 inline-block">Gate production REST endpoints automatically when accounts exceed included allocations.</span>
                </div>
              </div>
            </div>

            {/* Trigger save button */}
            <div className="pt-2 border-t border-[#F5F5F7]">
              <button
                onClick={handleSaveConfigs}
                className="py-2 px-5 bg-[#111111] hover:bg-[#1D1D1F] text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                id="settings-save-btn"
              >
                <Save className="h-4 w-4" />
                Commit Configuration
              </button>

              {showSaveSuccess && (
                <div className="mt-3 p-2.5 bg-neutral-50 text-neutral-800 border border-neutral-200 rounded-lg text-xs font-semibold text-center flex items-center justify-center gap-1">
                  <Check className="h-4 w-4 text-neutral-800 p-0.5" />
                  Organizational compliance parameters updated successfully.
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 cols): Workspace Access control members directories */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Active Tenants profile metadata */}
            {wsInfo && (
              <div className="bg-[#FAF9F6] border border-[#E5E5E7] p-5 rounded-2xl text-left space-y-3 shadow-inner">
                <h4 className="text-xs font-bold text-[#6E6E73] uppercase tracking-wider flex items-center gap-1.5 leading-none">
                  <Database className="h-4 w-4 text-[#86868B]" />
                  Ledger Enforcing Context
                </h4>
                
                <div className="space-y-2 text-xs leading-none">
                  <div className="flex justify-between border-b border-stone-200/50 pb-2">
                    <span className="text-[#6E6E73]">Workspace ID</span>
                    <span className="font-mono font-bold text-stone-800">{wsInfo.workspace?.id}</span>
                  </div>
                  <div className="flex justify-between border-b border-stone-200/50 pb-2">
                    <span className="text-[#6E6E73]">Environment Status</span>
                    <span className="font-semibold uppercase text-amber-700 tracking-wide text-[10px]">{wsInfo.environmentMode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6E6E73]">Compliance Level</span>
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> SOC2 Audited
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Members & Admin User Groups Directory */}
            <div className="bg-white border border-[#E5E5E7] p-5 rounded-2xl space-y-4 shadow-sm text-left">
              <h3 className="text-xs font-bold text-[#111111] flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-[#0071E3]" />
                Tenant Members & Permission Roles
              </h3>
              <p className="text-[10px] text-[#6E6E73] font-medium leading-relaxed">
                Configure team membership access permissions. Users are isolated in this environment context.
              </p>

              <div className="space-y-2.5">
                {wsInfo?.members?.map((member: any) => (
                  <div key={member.id} className="flex items-center justify-between p-2.5 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] text-xs">
                    <div className="text-left">
                      <p className="font-semibold text-[#111111]">{member.email}</p>
                      <p className="text-[9px] text-[#6E6E73] font-mono mt-0.5 uppercase tracking-wider">Role: {member.role}</p>
                    </div>

                    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      member.role === "owner" 
                        ? "bg-amber-50 text-amber-700 border border-amber-200" 
                        : "bg-[#F5F5F7] text-[#111111] border border-[#E5E5E7]"
                    }`}>
                      {member.role === "owner" && <Crown className="h-2.5 w-2.5 mr-0.5 shrink-0" />}
                      {member.role.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
