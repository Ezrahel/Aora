import { ArrowLeft, CheckCircle2, KeyRound, Lock, MonitorSmartphone, ShieldCheck, Smartphone } from "lucide-react";

interface SecurityAccessViewProps {
  onBack: () => void;
}

export default function SecurityAccessView({ onBack }: SecurityAccessViewProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-[#E5E5E7] pb-5">
        <div>
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E6E73] hover:text-[#111111]">
            <ArrowLeft className="h-4 w-4" />
            Back to profile
          </button>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#111111]">Security & Access</h2>
          <p className="mt-1 text-xs text-[#6E6E73]">Keep your workspace secure with password controls, MFA, and role-based access settings.</p>
        </div>
        <button className="rounded-xl bg-[#111111] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D1D1F]">Save settings</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 space-y-6">
          <div className="rounded-3xl border border-[#E5E5E7] bg-white p-6 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6E6E73] flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#111111]" />
              Sign-in security
            </h3>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-[#FAFAFA] p-4">
                <div>
                  <p className="text-sm font-semibold text-[#111111]">Password</p>
                  <p className="text-xs text-[#6E6E73]">Last updated 4 days ago</p>
                </div>
                <button className="rounded-lg border border-[#E5E5E7] px-3 py-1.5 text-[10px] font-semibold text-[#111111]">Change password</button>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#FAFAFA] p-4">
                <div>
                  <p className="text-sm font-semibold text-[#111111]">Two-factor authentication</p>
                  <p className="text-xs text-[#6E6E73]">SMS and authenticator app are enabled</p>
                </div>
                <button className="rounded-lg bg-[#111111] px-3 py-1.5 text-[10px] font-semibold text-white">Manage MFA</button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#E5E5E7] bg-white p-6 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6E6E73] flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#111111]" />
              Session controls
            </h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-[#FAFAFA] p-4">
                <div>
                  <p className="text-sm font-semibold text-[#111111]">Session timeout</p>
                  <p className="text-xs text-[#6E6E73]">Auto logout after 30 minutes of inactivity</p>
                </div>
                <button className="rounded-lg border border-[#E5E5E7] px-3 py-1.5 text-[10px] font-semibold text-[#111111]">Edit</button>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#FAFAFA] p-4">
                <div>
                  <p className="text-sm font-semibold text-[#111111]">Device approvals</p>
                  <p className="text-xs text-[#6E6E73]">Approve new devices before access is granted</p>
                </div>
                <button className="rounded-lg border border-[#E5E5E7] px-3 py-1.5 text-[10px] font-semibold text-[#111111]">Configure</button>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-5 space-y-6">
          <div className="rounded-3xl border border-[#E5E5E7] bg-white p-6 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6E6E73] flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#111111]" />
              API & secret keys
            </h3>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-[#FAFAFA] p-3">
                <p className="text-[10px] uppercase tracking-wider text-[#6E6E73]">Primary key</p>
                <p className="mt-1 break-all text-xs font-mono text-[#111111]">sk_live_aora_5f2d93e810cb9921e42f2bca01</p>
              </div>
              <button className="w-full rounded-xl bg-[#111111] px-3 py-2 text-xs font-semibold text-white">Rotate API key</button>
            </div>
          </div>

          <div className="rounded-3xl border border-[#E5E5E7] bg-white p-6 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6E6E73] flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4 text-[#111111]" />
              Recent activity
            </h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-2xl bg-[#FAFAFA] p-3">
                <Smartphone className="h-4 w-4 text-[#6E6E73]" />
                <div>
                  <p className="text-xs font-semibold text-[#111111]">Login from Chrome on macOS</p>
                  <p className="text-[10px] text-[#6E6E73]">Today • 09:14 GMT</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-[#FAFAFA] p-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-xs font-semibold text-[#111111]">API key regenerated</p>
                  <p className="text-[10px] text-[#6E6E73]">Yesterday • 17:33 GMT</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
