import { useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Clock3,
  Globe,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
} from "lucide-react";

interface AccountDetailsViewProps {
  onBack: () => void;
}

export default function AccountDetailsView({ onBack }: AccountDetailsViewProps) {
  const [fullName, setFullName] = useState("Ademola Olushola");
  const [email, setEmail] = useState("ademola@aora.co");
  const [phone, setPhone] = useState("+234 800 000 0000");
  const [role, setRole] = useState("Admin");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [locale, setLocale] = useState("en-NG");
  const [bio, setBio] = useState("Managing billing, finance ops, and SaaS growth strategy.");

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-[#E5E5E7] pb-5">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E6E73] hover:text-[#111111]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to profile
          </button>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#111111]">Account Details</h2>
          <p className="mt-1 text-xs text-[#6E6E73]">Edit your personal profile, contact information, and workspace preferences.</p>
        </div>
        <button className="rounded-xl bg-[#111111] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D1D1F]">
          Save changes
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4">
          <div className="rounded-3xl border border-[#E5E5E7] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#111111] text-lg font-semibold text-white">AO</div>
              <div>
                <p className="text-sm font-semibold text-[#111111]">{fullName}</p>
                <p className="text-xs text-[#6E6E73]">{role} • Workspace Owner</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-[#FAFAFA] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#6E6E73]">Workspace access</p>
              <p className="mt-1 text-sm font-semibold text-[#111111]">Aora Technologies Ltd</p>
              <p className="mt-1 text-xs text-[#6E6E73]">Last login • Today, 09:14 GMT</p>
            </div>
          </div>
        </div>

        <div className="xl:col-span-8 space-y-6">
          <div className="rounded-3xl border border-[#E5E5E7] bg-white p-6 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6E6E73]">Personal information</h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Full name</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                  <User className="h-4 w-4 text-[#86868B]" />
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-transparent text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Role</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                  <Briefcase className="h-4 w-4 text-[#86868B]" />
                  <input value={role} onChange={(e) => setRole(e.target.value)} className="w-full bg-transparent text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Email</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                  <Mail className="h-4 w-4 text-[#86868B]" />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Phone</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                  <Phone className="h-4 w-4 text-[#86868B]" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-transparent text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Timezone</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                  <Clock3 className="h-4 w-4 text-[#86868B]" />
                  <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full bg-transparent text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Locale</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5">
                  <Globe className="h-4 w-4 text-[#86868B]" />
                  <input value={locale} onChange={(e) => setLocale(e.target.value)} className="w-full bg-transparent text-sm outline-none" />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Bio / Notes</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5 text-sm outline-none" />
            </div>
          </div>

          <div className="rounded-3xl border border-[#E5E5E7] bg-white p-6 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6E6E73]">Preferences</h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-[#FAFAFA] p-4">
                <p className="text-xs font-semibold text-[#111111]">Notifications</p>
                <p className="mt-1 text-[10px] text-[#6E6E73]">Receive billing alerts and invoice reminders.</p>
                <button className="mt-3 rounded-lg bg-[#111111] px-3 py-1.5 text-[10px] font-semibold text-white">Manage preferences</button>
              </div>
              <div className="rounded-2xl bg-[#FAFAFA] p-4">
                <p className="text-xs font-semibold text-[#111111]">Regional format</p>
                <p className="mt-1 text-[10px] text-[#6E6E73]">Currency and date formatting follow your locale.</p>
                <button className="mt-3 rounded-lg border border-[#E5E5E7] px-3 py-1.5 text-[10px] font-semibold text-[#111111]">Preview format</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
