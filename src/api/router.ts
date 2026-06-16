// ============================================================
// Aora Billing OS — Master API Router
// Mounts all resource route modules onto a single Express Router.
// Mount this at /api in server.ts.
// ============================================================

import { Router } from "express";
import { rateLimit } from "./middleware.ts";

import { router as healthRouter }        from "./routes/health.ts";
import { router as workspacesRouter }    from "./routes/workspaces.ts";
import { router as plansRouter }         from "./routes/plans.ts";
import { router as productsRouter }      from "./routes/products.ts";
import { router as customersRouter }     from "./routes/customers.ts";
import { router as subscriptionsRouter } from "./routes/subscriptions.ts";
import { router as metersRouter }        from "./routes/meters.ts";
import { router as usageRouter }         from "./routes/usage.ts";
import { router as entitlementsRouter }  from "./routes/entitlements.ts";
import { router as invoicesRouter }      from "./routes/invoices.ts";
import { router as pricingRouter }       from "./routes/pricing.ts";
import { router as analyticsRouter }     from "./routes/analytics.ts";
import { router as webhooksRouter }      from "./routes/webhooks.ts";
import { router as chatRouter }          from "./routes/chat.ts";

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

export default apiRouter;
