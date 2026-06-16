// ============================================================
// Aora Billing OS — Webhooks Routes
// CRUD for webhook endpoints + HTTP delivery engine
// ============================================================

import { Router } from "express";
import {
  db,
  saveDatabase,
  writeAuditLog,
  resolveWorkspace,
  nanoid,
  chatMessageLog,
} from "../db.ts";
import {
  parsePagination,
  paginateArray,
  badRequest,
  notFound,
  conflict,
  genId,
  toNum,
  generateWebhookSecret,
  signWebhookPayload,
} from "../middleware.ts";
import type {
  Price,
  RateCard,
  Discount,
  Coupon,
  CustomContract,
  WebhookEndpoint,
  WebhookDelivery,
  WebhookEventType,
} from "../types.ts";

const router = Router();

// ──────────────────────────────────────────────────────────────
// GET /webhooks
// ──────────────────────────────────────────────────────────────

router.get("/webhooks", (req, res) => {
  const ws = resolveWorkspace(req);
  return res.json(db.webhooks.filter((w) => w.workspaceId === ws.id));
});

// ──────────────────────────────────────────────────────────────
// POST /webhooks
// ──────────────────────────────────────────────────────────────

router.post("/webhooks", (req, res) => {
  const ws = resolveWorkspace(req);
  const { url, description, events, isActive } = req.body;

  if (!url) return badRequest(res, "url is required.");
  if (!String(url).startsWith("http")) {
    return badRequest(res, "url must be a valid HTTP/HTTPS URL.");
  }

  const secret = generateWebhookSecret();
  const newWebhook: WebhookEndpoint = {
    id: "wh_" + genId(),
    workspaceId: ws.id,
    url,
    ...(description !== undefined && { description }),
    events: Array.isArray(events) ? events : [],
    secret,
    isActive: isActive !== undefined ? !!isActive : true,
    createdAt: new Date().toISOString(),
  };

  db.webhooks.push(newWebhook);
  saveDatabase();
  // Audit without exposing the secret
  writeAuditLog(ws.id, "Admin", "CREATE", "WEBHOOK", newWebhook.id, null, {
    ...newWebhook,
    secret: "[redacted]",
  });
  // Return full object including secret on creation
  return res.status(201).json(newWebhook);
});

// ──────────────────────────────────────────────────────────────
// POST /webhooks/test  (must be registered before /:id)
// ──────────────────────────────────────────────────────────────

router.post("/webhooks/test", async (req, res) => {
  const ws = resolveWorkspace(req);
  const { webhookId, event } = req.body;
  const eventType: WebhookEventType = event ?? "subscription.created";

  const payload = {
    id: "evt_test_" + genId(),
    type: eventType,
    created: Date.now(),
    livemode: false,
    data: { message: "This is a test webhook event from Aora Billing." },
  };

  let targets: WebhookEndpoint[];
  if (webhookId) {
    const wh = db.webhooks.find(
      (w) => w.id === webhookId && w.workspaceId === ws.id,
    );
    if (!wh) return notFound(res, "Webhook");
    targets = [wh];
  } else {
    targets = db.webhooks.filter((w) => w.workspaceId === ws.id && w.isActive);
  }

  const results: { webhookId: string; status: string; httpStatus?: number }[] =
    [];
  for (const webhook of targets) {
    const result = await deliverWebhook(webhook, eventType, payload);
    results.push({ webhookId: webhook.id, ...result });
  }

  return res.json({
    delivered: results.filter((r) => r.status === "delivered").length,
    results,
  });
});

// ──────────────────────────────────────────────────────────────
// GET /webhooks/:id
// ──────────────────────────────────────────────────────────────

router.get("/webhooks/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const webhook = db.webhooks.find(
    (w) => w.id === req.params.id && w.workspaceId === ws.id,
  );
  if (!webhook) return notFound(res, "Webhook");

  const recentDeliveries = db.webhookDeliveries
    .filter((d) => d.webhookId === webhook.id)
    .slice(0, 20);

  return res.json({ ...webhook, recentDeliveries });
});

// ──────────────────────────────────────────────────────────────
// PUT /webhooks/:id
// ──────────────────────────────────────────────────────────────

router.put("/webhooks/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const webhook = db.webhooks.find(
    (w) => w.id === req.params.id && w.workspaceId === ws.id,
  );
  if (!webhook) return notFound(res, "Webhook");

  const before = { ...webhook };
  const { url, description, events, isActive } = req.body;

  if (url !== undefined) {
    if (!String(url).startsWith("http")) {
      return badRequest(res, "url must be a valid HTTP/HTTPS URL.");
    }
    webhook.url = url;
  }
  if (description !== undefined) webhook.description = description;
  if (events !== undefined) webhook.events = events;
  if (isActive !== undefined) webhook.isActive = !!isActive;

  saveDatabase();
  writeAuditLog(
    ws.id,
    "Admin",
    "UPDATE",
    "WEBHOOK",
    webhook.id,
    before,
    webhook,
  );
  return res.json(webhook);
});

// ──────────────────────────────────────────────────────────────
// DELETE /webhooks/:id
// ──────────────────────────────────────────────────────────────

router.delete("/webhooks/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const idx = db.webhooks.findIndex(
    (w) => w.id === req.params.id && w.workspaceId === ws.id,
  );
  if (idx === -1) return notFound(res, "Webhook");

  const [removed] = db.webhooks.splice(idx, 1);
  saveDatabase();
  writeAuditLog(ws.id, "Admin", "DELETE", "WEBHOOK", removed.id, removed, null);
  return res.json({ deleted: true });
});

// ──────────────────────────────────────────────────────────────
// Webhook delivery engine
// ──────────────────────────────────────────────────────────────

async function deliverWebhook(
  webhook: WebhookEndpoint,
  event: WebhookEventType,
  payload: Record<string, any>,
): Promise<{ status: "delivered" | "failed"; httpStatus?: number }> {
  const body = JSON.stringify(payload);
  const sig = signWebhookPayload(body, webhook.secret);

  const delivery: WebhookDelivery = {
    id: "del_" + genId(),
    webhookId: webhook.id,
    event,
    payload,
    status: "pending",
    attempts: 0,
    lastAttemptAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  db.webhookDeliveries.unshift(delivery);

  // Up to 3 attempts: immediate, +1s, +3s
  const delays = [0, 1000, 3000];
  for (const delay of delays) {
    if (delay > 0) await new Promise<void>((r) => setTimeout(r, delay));
    delivery.attempts += 1;
    delivery.lastAttemptAt = new Date().toISOString();

    try {
      const resp = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Aora-Signature": sig,
          "X-Aora-Event": event,
          "X-Aora-Delivery": delivery.id,
          "User-Agent": "Aora-Webhooks/2.0",
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      delivery.httpStatus = resp.status;
      if (resp.ok || resp.status < 500) {
        delivery.status = "delivered";
        saveDatabase();
        return { status: "delivered", httpStatus: resp.status };
      }
    } catch (_err) {
      // network error or timeout — try next retry
    }
  }

  delivery.status = "failed";
  saveDatabase();
  return { status: "failed" };
}

export { deliverWebhook };
export default router;
