import { useState } from "react";
import {
  Search,
  ChevronDown,
  Bell,
  HelpCircle,
  Activity,
  Menu,
  Settings,
  User,
  Shield,
  Sun,
  Moon,
} from "lucide-react";
import { useDashboardTheme } from "./DashboardTheme";

interface TopNavProps {
  currentWorkspace: string;
  setWorkspace: (ws: string) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  onToggleMobileMenu?: () => void;
  onNavigateDocs?: () => void;
  onOpenProfileSettings?: () => void;
  onOpenAccountDetails?: () => void;
  onOpenSecurityAccess?: () => void;
}

export default function TopNav({
  currentWorkspace,
  setWorkspace,
  globalSearch,
  setGlobalSearch,
  onToggleMobileMenu,
  onNavigateDocs,
  onOpenProfileSettings,
  onOpenAccountDetails,
  onOpenSecurityAccess,
}: TopNavProps) {
  const { theme, toggle } = useDashboardTheme();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const handleOpenProfileSettings = () => {
    setIsProfileMenuOpen(false);
    onOpenProfileSettings?.();
  };

  const handleOpenAccountDetails = () => {
    setIsProfileMenuOpen(false);
    onOpenAccountDetails?.();
  };

  const handleOpenSecurityAccess = () => {
    setIsProfileMenuOpen(false);
    onOpenSecurityAccess?.();
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b dp-border dp-bg px-4 md:px-8 gap-3">
      {/* Left: Hamburger menu + Workspace switch */}
      <div className="flex items-center gap-2 md:gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 -ml-1 rounded-md dp-secondary hover:dp-hover hover:dp-text cursor-pointer"
            id="mobile-menu-toggle-btn"
            title="Toggle Sidebar Navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="hidden sm:flex h-7 w-7 items-center justify-center rounded-lg bg-[#111111] text-xs font-semibold text-white tracking-tight shrink-0">
          B
        </div>
        <div className="relative flex items-center gap-1.5 cursor-pointer group shrink-0">
          <span className="text-xs md:text-sm font-medium dp-text tracking-tight truncate max-w-[110px] sm:max-w-[200px]">
            {currentWorkspace}
          </span>
          <ChevronDown className="h-3.5 w-3.5 dp-secondary transition-transform group-hover:translate-y-0.5" />
          <select
            value={currentWorkspace}
            onChange={(e) => setWorkspace(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            id="workspace-select"
          >
            <option value="Aora Technologies Ltd">Aora Technologies Ltd</option>
            <option value="Acme Corporation Workspace">
              Acme Corporation Workspace
            </option>
            <option value="Demo Environment">Sandbox Environment</option>
          </select>
        </div>
        <div className="hidden lg:flex items-center gap-1.5 rounded-full dp-surface-alt px-2.5 py-1 text-[11px] font-medium dp-secondary shrink-0">
          <Activity className="h-3 w-3 text-[#34C759] animate-pulse" />
          Live Telemetry: Operational
        </div>
      </div>

      {/* Center: Global search (responsive flex-1 on tablet, hides on mobile-extra-small) */}
      <div className="flex flex-1 max-w-xs md:max-w-md items-center gap-2 rounded-lg dp-surface-alt px-2 md:px-3.5 py-1.5 border border-transparent focus-within:dp-border transition-all">
        <Search className="h-4 w-4 dp-muted shrink-0" />
        <input
          id="global-search-input"
          type="text"
          placeholder="Search..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="w-full bg-transparent text-xs dp-text placeholder:dp-muted outline-none min-w-0"
        />
        {globalSearch && (
          <button
            onClick={() => setGlobalSearch("")}
            className="text-[10px] dp-muted hover:dp-text"
            id="clear-search-button"
          >
            Clear
          </button>
        )}
      </div>

      {/* Right: Quick access icons */}
      <div className="flex items-center gap-2 md:gap-5 shrink-0">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="p-1.5 rounded-md dp-secondary hover:dp-hover hover:dp-text transition-colors cursor-pointer"
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        <button
          onClick={onNavigateDocs}
          className="flex items-center gap-1 text-xs dp-secondary hover:dp-text transition-colors cursor-pointer"
          id="docs-link"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Docs</span>
        </button>

        {/* Dummy notification bell */}
        <button
          className="relative dp-secondary hover:dp-text transition-colors p-1"
          id="notif-bell-button"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#FF453A]" />
        </button>

        {/* User profile */}
        <div className="relative pl-2 border-l dp-border">
          <button
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:dp-surface-alt"
            id="profile-menu-trigger"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111111] text-xs font-semibold text-white shrink-0">
              AO
            </div>
            <div className="hidden xl:block text-left">
              <p className="text-xs font-medium dp-text leading-none">
                Ademola Olushola
              </p>
              <p className="mt-0.5 text-[10px] dp-secondary leading-none">
                Admin
              </p>
            </div>
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border dp-border dp-card p-2 shadow-xl">
              <div className="rounded-xl dp-surface p-3">
                <p className="text-xs font-semibold dp-text">Ademola Olushola</p>
                <p className="mt-0.5 text-[10px] dp-secondary">ademola@aorahq.com</p>
              </div>

              <div className="mt-2 space-y-1">
                <button
                  onClick={handleOpenProfileSettings}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium dp-text hover:dp-surface-alt"
                >
                  <Settings className="h-4 w-4 dp-secondary" />
                  Company Profile & Settings
                </button>
                <button
                  onClick={handleOpenAccountDetails}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium dp-text hover:dp-surface-alt"
                >
                  <User className="h-4 w-4 dp-secondary" />
                  Account Details
                </button>
                <button
                  onClick={handleOpenSecurityAccess}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium dp-text hover:dp-surface-alt"
                >
                  <Shield className="h-4 w-4 dp-secondary" />
                  Security & Access
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
