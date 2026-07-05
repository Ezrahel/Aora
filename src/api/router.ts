// ============================================================
// Aora Billing OS — Master API Router
// Mounts all resource route modules onto a single Express Router.
// Mount this at /api in server.ts.
// ============================================================

import { Router } from "express";
import { rateLimit } from "./middleware.ts";

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

const apiRouter = Router();

// Apply rate limiting to all API routes
apiRouter.use(rateLimit);

// ── Resource Routes ────────────────────────────────────────────
apiRouter.use(healthRouter);          // GET /health
apiRouter.use(workspacesRouter);      // /workspaces, /workspace-info, /members, /audit-logs
apiRouter.use(plansRouter);           // /plans
apiRouter.use(productsRouter);        // /products, /features
apiRouter.use(customersRouter);       // /customers
apiRouter.use(subscriptionsRouter);   // /subscriptions
apiRouter.use(metersRouter);          // /meters
apiRouter.use(usageRouter);           // /usage-events, /quotas, /credits, /can-consume, /events/replay
apiRouter.use(entitlementsRouter);    // /entitlements, /can-access
apiRouter.use(invoicesRouter);        // /invoices
apiRouter.use(pricingRouter);         // /prices, /rate-cards, /discounts, /coupons, /contracts, /pricing-calculate
apiRouter.use(analyticsRouter);       // /revenue-metrics, /analytics/*
apiRouter.use(webhooksRouter);        // /webhooks
apiRouter.use(chatRouter);            // /chat, /chat-history
apiRouter.use(gatewaysRouter);        // /gateways/*

export default apiRouter;
