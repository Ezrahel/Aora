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
  Key,
  Building2,
  Globe,
  MapPin,
  Mail,
  Phone,
  Clock3,
  Palette,
  BadgeCheck,
} from "lucide-react";
import type { WorkspaceProfile, WorkspaceSettings } from "../api/types";

interface SettingsViewProps {
  workspace: string;
  onWorkspaceConfigUpdated: () => void;
}

export default function SettingsView({ workspace, onWorkspaceConfigUpdated }: SettingsViewProps) {
  const [businessName, setBusinessName] = useState(workspace);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [wsInfo, setWsInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [profileDraft, setProfileDraft] = useState<WorkspaceProfile | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<WorkspaceSettings | null>(null);

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
            setProfileDraft(data.workspace.profile || null);
            setSettingsDraft(data.workspace.settings || null);
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

  const updateProfileField = <K extends keyof WorkspaceProfile>(key: K, value: WorkspaceProfile[K]) => {
    setProfileDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateSettingsField = <K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) => {
    setSettingsDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSaveConfigs = async () => {
    if (!wsInfo?.workspace?.id || !profileDraft || !settingsDraft) return;

    try {
      const response = await fetch(`/api/workspaces/${wsInfo.workspace.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: businessName,
          profile: profileDraft,
          settings: settingsDraft,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update workspace settings.");
      }

      setShowSaveSuccess(true);
      setTimeout(() => {
        setShowSaveSuccess(false);
        onWorkspaceConfigUpdated();
      }, 2000);
      setWsInfo((prev: any) => ({
        ...prev,
        workspace: {
          ...prev.workspace,
          name: businessName,
          profile: profileDraft,
          settings: settingsDraft,
        },
      }));
    } catch (err) {
      console.error(err);
      alert("There was an issue saving your company profile settings.");
    }
  };

  const activePlan = settingsDraft?.enableAutomaticDunning ? "Enterprise Pro" : "Growth Scale";
  const statusBadge = settingsDraft?.enforceEntitlements ? "Compliance On" : "Manual Review";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="border-b border-[#E5E5E7] pb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[#111111]">Company Profile & Settings</h2>
            <p className="text-xs text-[#6E6E73] mt-1.5 font-medium">
              Manage your brand identity, billing details, compliance controls, and team access in one premium workspace hub.
            </p>
          </div>
          <button
            onClick={handleSaveConfigs}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#111111] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1D1D1F]"
          >
            <Save className="h-4 w-4" />
            Save all changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-[#E5E5E7] bg-white p-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#6E6E73]">Current plan</p>
          <p className="mt-1 text-lg font-semibold text-[#111111]">{activePlan}</p>
          <p className="mt-1 text-xs text-[#6E6E73]">Renewal on 24 Aug 2026</p>
        </div>
        <div className="rounded-3xl border border-[#E5E5E7] bg-white p-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#6E6E73]">Billing status</p>
          <p className="mt-1 text-lg font-semibold text-[#111111]">{settingsDraft?.currency} • {settingsDraft?.taxId}</p>
          <p className="mt-1 text-xs text-[#6E6E73]">Auto-pay and dunning are enabled</p>
        </div>
        <div className="rounded-3xl border border-[#E5E5E7] bg-white p-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#6E6E73]">Workspace health</p>
          <p className="mt-1 text-lg font-semibold text-[#111111]">{statusBadge}</p>
          <p className="mt-1 text-xs text-[#6E6E73]">Last synced 2 mins ago</p>
        </div>
      </div>

      {loading || !profileDraft || !settingsDraft ? (
        <div className="p-12 text-center text-xs text-neutral-500 font-medium">
          Retrieving active workspace compliance setup...
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8 space-y-6">
            <div className="overflow-hidden rounded-3xl border border-[#E5E5E7] bg-white shadow-sm">
              <div
                className="h-44 w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${profileDraft.coverUrl})` }}
              >
                <div className="flex h-full items-end bg-gradient-to-t from-black/65 via-black/20 to-transparent p-5">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={profileDraft.logoUrl}
                      alt="Workspace logo"
                      className="h-16 w-16 rounded-2xl border border-white/30 object-cover shadow-lg"
                    />
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.32em] text-white/75">Workspace profile</p>
                      <h3 className="mt-1 text-2xl font-semibold text-white">{businessName}</h3>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div className="flex flex-col gap-4 border-b border-[#F5F5F7] pb-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full rounded-xl border border-[#E5E5E7] bg-white px-3 py-2 text-sm font-semibold text-[#111111] outline-none focus:border-[#111111] md:max-w-md"
                    />
                    <textarea
                      value={profileDraft.tagline}
                      onChange={(e) => updateProfileField("tagline", e.target.value)}
                      rows={2}
                      className="mt-2 w-full rounded-xl border border-[#E5E5E7] bg-white px-3 py-2 text-xs text-[#6E6E73] outline-none focus:border-[#111111] md:max-w-2xl"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                      <Check className="mr-1 h-3 w-3" />
                      Live customer account
                    </span>
                    <button
                      onClick={handleSaveConfigs}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#111111] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1D1D1F]"
                    >
                      <Save className="h-4 w-4" />
                      Save profile
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Website</label>
                    <div className="flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                      <Globe className="h-4 w-4 text-[#86868B]" />
                      <input
                        value={profileDraft.website}
                        onChange={(e) => updateProfileField("website", e.target.value)}
                        className="w-full bg-transparent text-sm text-[#111111] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Industry</label>
                    <div className="flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                      <Building2 className="h-4 w-4 text-[#86868B]" />
                      <input
                        value={profileDraft.industry}
                        onChange={(e) => updateProfileField("industry", e.target.value)}
                        className="w-full bg-transparent text-sm text-[#111111] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Region</label>
                    <div className="flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                      <MapPin className="h-4 w-4 text-[#86868B]" />
                      <input
                        value={profileDraft.region}
                        onChange={(e) => updateProfileField("region", e.target.value)}
                        className="w-full bg-transparent text-sm text-[#111111] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Timezone</label>
                    <div className="flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                      <Clock3 className="h-4 w-4 text-[#86868B]" />
                      <input
                        value={profileDraft.timezone}
                        onChange={(e) => updateProfileField("timezone", e.target.value)}
                        className="w-full bg-transparent text-sm text-[#111111] outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Company description</label>
                  <textarea
                    value={profileDraft.description}
                    onChange={(e) => updateProfileField("description", e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#111111]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-[#E5E5E7] bg-white p-5 shadow-sm">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#6E6E73]">Contact details</h4>
                <div className="mt-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Billing email</label>
                    <div className="flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                      <Mail className="h-4 w-4 text-[#86868B]" />
                      <input
                        value={profileDraft.billingEmail}
                        onChange={(e) => updateProfileField("billingEmail", e.target.value)}
                        className="w-full bg-transparent text-sm text-[#111111] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Support email</label>
                    <div className="flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                      <Mail className="h-4 w-4 text-[#86868B]" />
                      <input
                        value={profileDraft.supportEmail}
                        onChange={(e) => updateProfileField("supportEmail", e.target.value)}
                        className="w-full bg-transparent text-sm text-[#111111] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Phone</label>
                    <div className="flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                      <Phone className="h-4 w-4 text-[#86868B]" />
                      <input
                        value={profileDraft.phone}
                        onChange={(e) => updateProfileField("phone", e.target.value)}
                        className="w-full bg-transparent text-sm text-[#111111] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Address</label>
                    <div className="flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                      <MapPin className="h-4 w-4 text-[#86868B]" />
                      <input
                        value={profileDraft.address}
                        onChange={(e) => updateProfileField("address", e.target.value)}
                        className="w-full bg-transparent text-sm text-[#111111] outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[#E5E5E7] bg-white p-5 shadow-sm">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#6E6E73]">Brand & locale</h4>
                <div className="mt-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Logo URL</label>
                    <div className="flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                      <Palette className="h-4 w-4 text-[#86868B]" />
                      <input
                        value={profileDraft.logoUrl}
                        onChange={(e) => updateProfileField("logoUrl", e.target.value)}
                        className="w-full bg-transparent text-sm text-[#111111] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Cover URL</label>
                    <div className="flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                      <Palette className="h-4 w-4 text-[#86868B]" />
                      <input
                        value={profileDraft.coverUrl}
                        onChange={(e) => updateProfileField("coverUrl", e.target.value)}
                        className="w-full bg-transparent text-sm text-[#111111] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Accent color</label>
                    <div className="flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                      <BadgeCheck className="h-4 w-4 text-[#86868B]" />
                      <input
                        type="color"
                        value={profileDraft.accentColor}
                        onChange={(e) => updateProfileField("accentColor", e.target.value)}
                        className="h-10 w-full cursor-pointer rounded-lg border-0 bg-transparent"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Locale</label>
                    <input
                      value={profileDraft.locale}
                      onChange={(e) => updateProfileField("locale", e.target.value)}
                      className="w-full rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#111111]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 space-y-6">
            <div className="rounded-3xl border border-[#E5E5E7] bg-white p-5 shadow-sm">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6E6E73] flex items-center gap-1.5">
                <Settings className="h-4 w-4 text-[#111111]" />
                Customer portal preview
              </h3>
              <div className="mt-4 rounded-2xl bg-[#FAFAFA] p-4">
                <p className="text-[10px] uppercase tracking-wider text-[#6E6E73]">Brand preview</p>
                <div className="mt-2 flex items-center gap-3">
                  <img src={profileDraft.logoUrl} alt="Preview logo" className="h-12 w-12 rounded-xl object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-[#111111]">{businessName}</p>
                    <p className="text-[10px] text-[#6E6E73]">{profileDraft.tagline}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-[#6E6E73]">
                  <p>{profileDraft.website}</p>
                  <p>{profileDraft.supportEmail}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#E5E5E7] bg-white p-5 shadow-sm">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6E6E73] flex items-center gap-1.5">
                <Settings className="h-4 w-4 text-[#111111]" />
                Billing configuration
              </h3>
              <div className="mt-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Currency</label>
                  <select
                    value={settingsDraft.currency}
                    onChange={(e) => updateSettingsField("currency", e.target.value as WorkspaceSettings["currency"])}
                    className="w-full rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#111111]"
                  >
                    <option value="NGN">Naira (₦ NGN)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Tax / VAT ID</label>
                  <input
                    value={settingsDraft.taxId}
                    onChange={(e) => updateSettingsField("taxId", e.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#111111]"
                  />
                </div>
                <div className="flex items-start gap-2 rounded-2xl bg-[#FAFAFA] p-3">
                  <input
                    type="checkbox"
                    checked={settingsDraft.enableAutomaticDunning}
                    onChange={(e) => updateSettingsField("enableAutomaticDunning", e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[#E5E5E7] accent-[#111111]"
                  />
                  <div>
                    <p className="text-xs font-semibold text-[#111111]">Automatic dunning retries</p>
                    <p className="text-[10px] text-[#6E6E73]">Retry failed payments with smart escalation rules.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-2xl bg-[#FAFAFA] p-3">
                  <input
                    type="checkbox"
                    checked={settingsDraft.enforceEntitlements}
                    onChange={(e) => updateSettingsField("enforceEntitlements", e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[#E5E5E7] accent-[#111111]"
                  />
                  <div>
                    <p className="text-xs font-semibold text-[#111111]">Entitlement enforcement</p>
                    <p className="text-[10px] text-[#6E6E73]">Block access when plans or usage thresholds are exceeded.</p>
                  </div>
                </div>
              </div>
            </div>

            {wsInfo && (
              <div className="rounded-3xl border border-[#E5E5E7] bg-[#FAF9F6] p-5 shadow-inner">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#6E6E73] flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-[#86868B]" />
                  Workspace context
                </h4>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-stone-200/50 pb-2">
                    <span className="text-[#6E6E73]">Workspace ID</span>
                    <span className="font-mono font-semibold text-stone-800">{wsInfo.workspace?.id}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-stone-200/50 pb-2">
                    <span className="text-[#6E6E73]">Environment</span>
                    <span className="font-semibold uppercase tracking-wide text-amber-700">{wsInfo.environmentMode}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#6E6E73]">Compliance</span>
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> SOC2
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-[#E5E5E7] bg-white p-5 shadow-sm">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#111111] flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#111111]" />
                Security & Access
              </h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-[#FAFAFA] p-3">
                  <p className="text-xs font-semibold text-[#111111]">Authentication</p>
                  <p className="mt-1 text-[10px] text-[#6E6E73]">MFA enforced for all admins and API users.</p>
                </div>
                <div className="rounded-2xl bg-[#FAFAFA] p-3">
                  <p className="text-xs font-semibold text-[#111111]">Role-based access</p>
                  <p className="mt-1 text-[10px] text-[#6E6E73]">Finance, Ops, and Support roles are configured with least-privilege access.</p>
                </div>
                <div className="rounded-2xl bg-[#FAFAFA] p-3">
                  <p className="text-xs font-semibold text-[#111111]">Session controls</p>
                  <p className="mt-1 text-[10px] text-[#6E6E73]">Auto logout after 30 minutes, device approvals enabled.</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#E5E5E7] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#111111] flex items-center gap-2">
                  <Key className="h-4 w-4 text-[#0071E3]" />
                  API & keys
                </h3>
                <ExternalLink className="h-4 w-4 text-[#86868B]" />
              </div>
              <div className="mt-3 space-y-2.5">
                {wsInfo?.apiIssued?.map((key: string) => (
                  <div key={key} className="rounded-xl bg-[#FAFAFA] p-2.5 text-[10px] font-mono text-[#111111] break-all">
                    {key}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[#E5E5E7] bg-white p-5 shadow-sm">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#111111] flex items-center gap-2">
                <Users className="h-4 w-4 text-[#0071E3]" />
                Team access
              </h3>
              <div className="mt-3 space-y-2.5">
                {wsInfo?.members?.map((member: any) => (
                  <div key={member.id} className="flex items-center justify-between rounded-2xl border border-[#E5E5E7] bg-[#FAFAFA] p-2.5">
                    <div>
                      <p className="text-xs font-semibold text-[#111111]">{member.email}</p>
                      <p className="text-[9px] text-[#6E6E73] uppercase tracking-wider">{member.role}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      member.role === "owner"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-[#F5F5F7] text-[#111111] border border-[#E5E5E7]"
                    }`}>
                      {member.role === "owner" && <Crown className="mr-0.5 h-2.5 w-2.5" />}
                      {member.role.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showSaveSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-lg">
          <Check className="h-4 w-4" />
          Company profile updated successfully.
        </div>
      )}
    </div>
  );
}
