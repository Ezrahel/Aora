import type { SidebarTab } from "./components/Sidebar";

/** Maps each SidebarTab to its URL path slug. */
const TAB_TO_PATH: Record<SidebarTab, string> = {
  landing: "/",
  dashboard: "/dashboard",
  catalog: "/catalog",
  customers: "/customers",
  subscriptions: "/subscriptions",
  usage: "/usage",
  entitlements: "/entitlements",
  pricing: "/pricing",
  invoices: "/invoices",
  revenue: "/revenue",
  analytics: "/analytics",
  portal: "/portal",
  gateways: "/gateways",
  reconciliation: "/reconciliation",
  integrations: "/integrations",
  developers: "/developers",
  settings: "/settings",
  docs: "/docs",
  "sign-in": "/sign-in",
};

const PATH_TO_TAB = Object.entries(TAB_TO_PATH).reduce<Record<string, SidebarTab>>(
  (acc, [tab, path]) => {
    acc[path] = tab as SidebarTab;
    return acc;
  },
  {},
);

/** Derive the active tab from the current URL path. */
export function routeToTab(pathname: string): SidebarTab {
  return PATH_TO_TAB[pathname] ?? "landing";
}

/** Get the URL path for a given tab. */
export function tabToPath(tab: SidebarTab): string {
  return TAB_TO_PATH[tab];
}

/** Update the URL bar without reloading. */
export function syncUrl(tab: SidebarTab): void {
  const path = tabToPath(tab);
  if (window.location.pathname !== path) {
    window.history.pushState({ tab }, "", path);
  }
}
