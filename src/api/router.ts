// ============================================================
// Aora Billing OS — Master API Router
// Mounts all resource route modules onto a single Express Router.
// Mount this at /api in server.ts.
// ============================================================

import { Router } from "express";
import { rateLimit } from "./middleware.ts";
import { sandboxIsolationMiddleware } from "./middleware/sandbox.ts";
import { requireSession } from "./auth/session-guard.ts";

import healthRouter        from "./routes/health.ts";
import workspacesRouter    from "./routes/workspaces.ts";
import plansRouter         from "./routes/plans.ts";
import productsRouter      from "./routes/products.ts";
import customersRouter     from "./routes/customers.ts";
import subscriptionsRouter from "./routes/subscriptions.ts";
import metersRouter        from "./routes/meters.ts";
import usageRouter         from "./routes/usage.ts";
import entitlementsRouter  from "./routes/entitlements.ts";
import invoicesRouter      from "./routes/invoices.ts";
import pricingRouter       from "./routes/pricing.ts";
import analyticsRouter     from "./routes/analytics.ts";
import webhooksRouter      from "./routes/webhooks.ts";
import chatRouter          from "./routes/chat.ts";
import gatewaysRouter      from "./routes/gateways.ts";
import waitlistRouter      from "./routes/waitlist.ts";
import checkoutRouter      from "./routes/checkout.ts";
import ingressRouter       from "./routes/ingress.ts";

const apiRouter = Router();
export const machineRouter = Router();

// Apply rate limiting to all API routes
apiRouter.use(rateLimit);

// Machine API: only the explicitly external ingestion surface is reachable
// with a workspace key. It is mounted before the dashboard router in app.ts.
machineRouter.use(rateLimit);
machineRouter.use((req, res, next) => {
  if (req.path !== "/ingress" && !req.path.startsWith("/ingress/")) return next();
  return sandboxIsolationMiddleware(req, res, next);
});
machineRouter.use(ingressRouter);

// Public operational endpoints.  Everything else below requires an active
// dashboard session.  Gateway webhooks are mounted separately in app.ts so
// their provider signatures can be verified without a browser session.
apiRouter.use(healthRouter);          // GET /health
apiRouter.use(waitlistRouter);        // POST /waitlist

// Dashboard API: session authentication also attaches the active organization
// that resolveWorkspace uses to enforce tenant isolation.
apiRouter.use(requireSession());

// ── Resource Routes ────────────────────────────────────────────
apiRouter.use(workspacesRouter);      // /workspaces, /workspace-info, /members, /audit-logs
apiRouter.use(plansRouter);           // /plans
apiRouter.use(productsRouter);        // /products, /features
apiRouter.use("/customers", customersRouter);       // /customers, /customers/:id
apiRouter.use("/subscriptions", subscriptionsRouter); // /subscriptions, /subscriptions/:id
apiRouter.use(metersRouter);          // /meters
apiRouter.use(usageRouter);           // /usage-events, /quotas, /credits, /can-consume, /events/replay
apiRouter.use(entitlementsRouter);    // /entitlements, /can-access
apiRouter.use("/invoices", invoicesRouter);        // /invoices, /invoices/:id
apiRouter.use(pricingRouter);         // /prices, /rate-cards, /discounts, /coupons, /contracts, /pricing-calculate
apiRouter.use(analyticsRouter);       // /revenue-metrics, /analytics/*
apiRouter.use(webhooksRouter);        // /webhooks (outbound endpoint management)
apiRouter.use(chatRouter);            // /chat, /chat-history
apiRouter.use(gatewaysRouter);        // /gateways/*
apiRouter.use("/checkout", checkoutRouter);        // /checkout/*

export default apiRouter;
