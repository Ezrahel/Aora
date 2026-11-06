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
  RefreshCw,
  FileText,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  Layers,
  Plug,
  Scale,
} from "lucide-react";
import { HelixGlyph } from "./landing/scene/HelixGlyph";

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
  | "gateways"
  | "reconciliation"
  | "integrations"
  | "developers"
  | "settings"
  | "docs"
  | "sign-in";

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
  const groups = [
    {
      label: "Operate",
      items: [
        { id: "dashboard", label: "Overview", icon: LayoutDashboard },
        { id: "catalog", label: "Catalog", icon: FolderOpen },
        { id: "customers", label: "Customers", icon: Users },
        { id: "subscriptions", label: "Subscriptions", icon: Repeat },
      ],
    },
    {
      label: "Monetize",
      items: [
        { id: "pricing", label: "Pricing", icon: CreditCard },
        { id: "usage", label: "Usage", icon: Gauge },
        { id: "entitlements", label: "Entitlements", icon: ShieldCheck },
        { id: "invoices", label: "Invoices", icon: Receipt },
      ],
    },
    {
      label: "Revenue",
      items: [
        { id: "revenue", label: "Revenue Ops", icon: TrendingUp },
        { id: "reconciliation", label: "Reconciliation", icon: Scale },
        { id: "analytics", label: "Analytics", icon: BarChart3 },
      ],
    },
    {
      label: "Platform",
      items: [
        { id: "portal", label: "Customer Portal", icon: Globe },
        { id: "integrations", label: "Integrations", icon: Layers },
        { id: "gateways", label: "Gateways", icon: Plug },
        { id: "developers", label: "Developers", icon: Code2 },
        { id: "settings", label: "Settings & Security", icon: SettingsIcon },
      ],
    },
  ];

  const handleTabClick = (tabId: SidebarTab) => {
    setActiveTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside
      className={`w-64 border-r dp-border dp-bg flex flex-col justify-between h-screen fixed left-0 top-0 z-50 transition-transform duration-300 md:translate-x-0 ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between h-14 px-4 border-b dp-border shrink-0">
          <button onClick={() => handleTabClick("dashboard")} className="flex items-center cursor-pointer" aria-label="AoraHQ overview">
            <img src="/aorahq-logo.png" alt="" className="lp-logo !h-5" />
          </button>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden text-xs font-semibold dp-secondary hover:dp-text p-1 cursor-pointer"
              id="close-mobile-sidebar-btn"
            >
              Back
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-5" aria-label="Workspace">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="uppercase text-[10px] dp-muted mb-1.5">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`sidebar-item-${item.id}`}
                    onClick={() => handleTabClick(item.id as SidebarTab)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex w-full items-center gap-2.5 py-1.5 text-[13px] transition-colors duration-150 cursor-pointer ${
                      isActive ? "dp-nav-active dp-text font-medium" : "dp-secondary hover:dp-text"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? "dp-text" : "dp-muted"}`} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}

          <button
            onClick={() => window.open("/docs", "_blank", "noopener,noreferrer")}
            className="flex w-full items-center gap-2.5 py-1.5 text-[13px] dp-secondary hover:dp-text transition-colors cursor-pointer"
          >
            <FileText className="h-4 w-4 dp-muted" />
            Documentation
          </button>
        </nav>
      </div>

      <div className="px-4 h-14 border-t dp-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <HelixGlyph className={`h-6 w-6 dp-text shrink-0`} rungs={9} spin={isSyncing} />
          <div className="min-w-0">
            <p className="uppercase text-[10px] dp-muted leading-tight">Sync state</p>
            <p className="text-xs dp-text mt-0.5 truncate">{isSyncing ? "Syncing ledger" : "Billing node active"}</p>
          </div>
        </div>
        {onRefreshData && (
          <button
            onClick={onRefreshData}
            disabled={isSyncing}
            className="p-1.5 rounded-md dp-secondary hover:dp-text hover:dp-hover transition-colors cursor-pointer"
            title="Synchronize billing ledger"
            aria-label="Synchronize billing ledger"
            id="force-sync-button"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>
    </aside>
  );
}
