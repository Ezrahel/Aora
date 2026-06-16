import { useState, useEffect } from "react";
import Sidebar, { SidebarTab } from "./components/Sidebar";
import TopNav from "./components/TopNav";
import LandingPageView from "./components/LandingPageView";
import DashboardView from "./components/DashboardView";
import CatalogView from "./components/CatalogView";
import SubscriptionsView from "./components/SubscriptionsView";
import CustomerPortalView from "./components/CustomerPortalView";
import PricingBuilderView from "./components/PricingBuilderView";
import UsageMeteringView from "./components/UsageMeteringView";
import EntitlementsView from "./components/EntitlementsView";
import CustomerWorkspaceView from "./components/CustomerWorkspaceView";
import RevenueOpsView from "./components/RevenueOpsView";
import AnalyticsView from "./components/AnalyticsView";
import DeveloperExperienceView from "./components/DeveloperExperienceView";
import InvoicesView from "./components/InvoicesView";
import IntegrationsView from "./components/IntegrationsView";
import SettingsView from "./components/SettingsView";
import DocumentationView from "./components/DocumentationView";
import AIAssistantWidget from "./components/AIAssistantWidget";
import {
  Plan,
  Customer,
  MeterDefinition,
  UsageEvent,
  Entitlement,
  DashboardStats,
  Invoice,
} from "./types";

export default function App() {
  // High-Level View Coordinators
  const [activeTab, setActiveTab] = useState<SidebarTab>("dashboard");
  const [workspace, setWorkspace] = useState("Aora Technologies Ltd");
  const [globalSearch, setGlobalSearch] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Server-Synced Active States (Database)
  const [plans, setPlans] = useState<Plan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meters, setMeters] = useState<MeterDefinition[]>([]);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);

  // Sync state loop from Live Express server on mount
  const fetchDatabaseState = async () => {
    setIsSyncing(true);
    try {
      const qs = `?workspace=${encodeURIComponent(workspace)}`;
      const [
        plansRes,
        customersRes,
        metersRes,
        eventsRes,
        entitlementsRes,
        invoicesRes,
        statsRes,
      ] = await Promise.all([
        fetch(`/api/plans${qs}`),
        fetch(`/api/customers${qs}`),
        fetch(`/api/meters${qs}`),
        fetch(`/api/usage-events${qs}`),
        fetch(`/api/entitlements${qs}`),
        fetch(`/api/invoices${qs}`),
        fetch(`/api/revenue-metrics${qs}`),
      ]);

      const [
        plansData,
        customersData,
        metersData,
        eventsData,
        entitlementsData,
        invoicesData,
        statsData,
      ] = await Promise.all([
        plansRes.json(),
        customersRes.json(),
        metersRes.json(),
        eventsRes.json(),
        entitlementsRes.json(),
        invoicesRes.json(),
        statsRes.json(),
      ]);

      setPlans(plansData);
      setCustomers(customersData);
      setMeters(metersData);
      setEvents(eventsData);
      setEntitlements(entitlementsData);
      setInvoices(invoicesData);
      setStats(statsData);
    } catch (err) {
      console.error(
        "Warning: Could not contact deep backend server modules. Switched to high fidelity default fallback states.",
        err,
      );
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchDatabaseState();
  }, [workspace]);

  // Handle updates triggered by embedded assistant
  const handleAIActionExecuted = (actionType: string) => {
    console.log(
      "AI Assistant triggered action sequence to state manager:",
      actionType,
    );
    fetchDatabaseState(); // full reload to capture automatic backend ledger update!

    // Auto shift view tabs to give excellent interactive feedback!
    if (actionType === "CREATE_PLAN") {
      setActiveTab("pricing");
    } else if (actionType === "ADD_NOTE") {
      setActiveTab("customers");
    }
  };

  // Render current active layout
  const renderActiveView = () => {
    switch (activeTab) {
      case "landing":
        return (
          <LandingPageView
            onNavigateTab={(tab) => setActiveTab(tab as SidebarTab)}
          />
        );
      case "dashboard":
        return (
          <DashboardView
            stats={stats}
            onNavigateTab={(tab) => setActiveTab(tab as SidebarTab)}
          />
        );
      case "catalog":
        return (
          <CatalogView
            existingPlans={plans}
            customers={customers}
            onPlanCreated={fetchDatabaseState}
          />
        );
      case "subscriptions":
        return (
          <SubscriptionsView
            customers={customers}
            plans={plans}
            onPlanAdjusted={fetchDatabaseState}
          />
        );
      case "portal":
        return <CustomerPortalView customers={customers} plans={plans} />;
      case "pricing":
        return (
          <PricingBuilderView
            onPlanCreated={fetchDatabaseState}
            existingPlans={plans}
            meters={meters}
            customers={customers}
          />
        );
      case "usage":
        return (
          <UsageMeteringView
            meters={meters}
            events={events}
            customers={customers}
            onEventSubmitted={fetchDatabaseState}
            onMeterCreated={fetchDatabaseState}
          />
        );
      case "entitlements":
        return (
          <EntitlementsView
            entitlements={entitlements}
            plans={plans}
            customers={customers}
            onEntitlementUpdated={fetchDatabaseState}
          />
        );
      case "customers":
        return (
          <CustomerWorkspaceView
            customers={customers}
            plans={plans}
            onNoteAdded={fetchDatabaseState}
            onPlanAdjusted={fetchDatabaseState}
          />
        );
      case "invoices":
        return (
          <InvoicesView
            invoices={invoices}
            customers={customers}
            onInvoiceCreated={fetchDatabaseState}
          />
        );
      case "revenue":
        return (
          <RevenueOpsView
            stats={stats}
            customers={customers}
            onInvoiceRecovered={fetchDatabaseState}
          />
        );
      case "analytics":
        return <AnalyticsView />;
      case "developers":
        return <DeveloperExperienceView workspace={workspace} />;
      case "integrations":
        return <IntegrationsView />;
      case "settings":
        return (
          <SettingsView
            workspace={workspace}
            onWorkspaceConfigUpdated={fetchDatabaseState}
          />
        );
      case "docs":
        return (
          <DocumentationView
            onBackToDashboard={() => setActiveTab("dashboard")}
            workspaceName={workspace}
          />
        );
      default:
        return (
          <DashboardView
            stats={stats}
            onNavigateTab={(tab) => setActiveTab(tab as SidebarTab)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#111111] font-sans antialiased selection:bg-neutral-100 selection:text-black">
      {/* Left Sidebar navigation panel */}
      {activeTab !== "landing" && activeTab !== "docs" && (
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onRefreshData={fetchDatabaseState}
          isSyncing={isSyncing}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Backdrop Overlay */}
      {activeTab !== "landing" && activeTab !== "docs" && isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/15 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Main Content Pane */}
      <div
        className={`${activeTab === "landing" || activeTab === "docs" ? "" : "pl-0 md:pl-64"} min-h-screen flex flex-col bg-white transition-all duration-300`}
      >
        {/* Top bar Switchers */}
        {activeTab !== "landing" && activeTab !== "docs" && (
          <TopNav
            currentWorkspace={workspace}
            setWorkspace={setWorkspace}
            globalSearch={globalSearch}
            setGlobalSearch={setGlobalSearch}
            onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            onNavigateDocs={() => setActiveTab("docs")}
          />
        )}

        {/* Breathing page boundaries content stage */}
        <main
          className={`flex-1 w-full pb-24 ${activeTab === "landing" || activeTab === "docs" ? "max-w-none" : "px-4 py-6 md:px-8 md:py-8 max-w-7xl mx-auto"}`}
        >
          {renderActiveView()}
        </main>
      </div>

      {/* Floating AI Billing Assistant Widget */}
      {activeTab !== "landing" && activeTab !== "docs" && (
        <AIAssistantWidget onActionExecuted={handleAIActionExecuted} />
      )}
    </div>
  );
}
