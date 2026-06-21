import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Repeat,
  Gauge,
  CreditCard,
  Receipt,
  Globe,
  Code2,
  Settings as SettingsIcon,
  Sparkles,
  RefreshCw,
  FileText,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  Layers,
} from "lucide-react";

export type SidebarTab =
  | "landing"
  | "dashboard"
  | "catalog"
  | "customers"
  | "subscriptions"
  | "usage"
  | "entitlements"
  | "pricing"
  | "invoices"
  | "revenue"
  | "analytics"
  | "portal"
  | "integrations"
  | "developers"
  | "settings"
  | "docs";

interface SidebarProps {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  onRefreshData?: () => void;
  isSyncing?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  onRefreshData,
  isSyncing = false,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  // Business-first navigation requested by user
  const mainItems = [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "catalog", label: "Catalog", icon: FolderOpen },
    { id: "customers", label: "Customers", icon: Users },
    { id: "subscriptions", label: "Subscriptions", icon: Repeat },
    { id: "usage", label: "Usage", icon: Gauge },
    { id: "entitlements", label: "Entitlements", icon: ShieldCheck },
    { id: "pricing", label: "Pricing", icon: CreditCard },
    { id: "invoices", label: "Invoices", icon: Receipt },
    { id: "revenue", label: "Revenue Ops", icon: TrendingUp },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "portal", label: "Customer Portal", icon: Globe },
    { id: "integrations", label: "Integrations", icon: Layers },
    { id: "developers", label: "Developers", icon: Code2 },
    { id: "settings", label: "Settings & Security", icon: SettingsIcon },
  ];

  const handleTabClick = (tabId: SidebarTab) => {
    setActiveTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside
      className={`w-64 border-r border-[#E5E5E7] bg-[#FAFAFA] flex flex-col justify-between h-screen fixed left-0 top-0 z-50 transition-transform duration-300 md:translate-x-0 ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex flex-col flex-1 py-5 px-4 overflow-y-auto">
        {/* Branding Title */}
        <div className="flex items-center justify-between px-2 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111111] shadow-sm">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-sm font-semibold tracking-tight text-[#111111] leading-none">
                Aora Billing
              </h1>
              <p className="text-[10px] text-[#86868B] mt-1 font-medium select-none">
                Operating System
              </p>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden text-xs font-bold text-[#6E6E73] hover:text-[#111111] p-1 cursor-pointer"
              id="close-mobile-sidebar-btn"
            >
              Back
            </button>
          )}
        </div>

        {/* Primary Navigation tab */}
        <div className="space-y-1">
          <p className="px-2 text-[9px] font-bold text-[#86868B] uppercase tracking-wider mb-2">
            Main Navigation
          </p>
          {mainItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-item-${item.id}`}
                onClick={() => handleTabClick(item.id as SidebarTab)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-xs font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-white text-[#111111] shadow-sm border border-[#E5E5E7]"
                    : "text-[#6E6E73] border border-transparent hover:bg-[#F2F2F2] hover:text-[#111111]"
                }`}
              >
                <Icon
                  className={`h-4.5 w-4.5 transition-colors ${isActive ? "text-[#111111]" : "text-[#86868B]"}`}
                />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Platform documentation fallback link */}
        <div className="mt-6 pt-4 border-t border-[#F5F5F7] space-y-1">
          <button
            onClick={() => handleTabClick("docs")}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-150 cursor-pointer ${
              activeTab === "docs"
                ? "bg-white text-[#111111] shadow-sm border border-[#E5E5E7]"
                : "text-[#6E6E73] hover:text-[#111111]"
            }`}
          >
            <FileText className="h-4.5 w-4.5 text-[#86868B]" />
            Platform Documentation
          </button>
        </div>
      </div>

      {/* Sync Ledger State control indicator */}
      <div className="p-4 border-t border-[#E5E5E7] bg-[#FAFAFA] flex items-center justify-between text-left">
        <div className="flex flex-col">
          <p className="text-[9px] text-[#6E6E73] font-bold uppercase tracking-wide">
            Sync State
          </p>
          <p className="text-[11px] font-bold text-[#111111] mt-0.5">
            Billing Node Active
          </p>
        </div>
        {onRefreshData && (
          <button
            onClick={onRefreshData}
            disabled={isSyncing}
            className={`p-1.5 rounded-md text-[#6E6E73] hover:text-[#111111] hover:bg-[#F2F2F2] transition-colors border cursor-pointer ${
              isSyncing ? "animate-spin text-[#0071E3]" : ""
            }`}
            title="Sychronize Billing ledger"
            id="force-sync-button"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </aside>
  );
}
