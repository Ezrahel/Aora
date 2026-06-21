// @ts-nocheck

import { Router, Request, Response } from "express";
import {
  resolveWorkspace,
  writeAuditLog,
  genId,
  webhookRepo,
} from "../db.ts";
import { asyncHandler, badRequest, notFound } from "../middleware.ts";

export const router = Router();

router.get("/webhooks", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const webhooks = await webhookRepo.findByWorkspace(ws.id);
  res.json(webhooks);
}));

router.get("/webhooks/:id", asyncHandler(async (req, res) => {
  const wh = await webhookRepo.findById(null as any, req.params.id);
  if (!wh) return notFound(res, "Webhook endpoint");
  res.json(wh);
}));

router.post("/webhooks", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { url, events, description, secret, metadata } = req.body as {
    url?: string; events?: string[]; description?: string; secret?: string; metadata?: Record<string, unknown>;
  };
  if (!url) return badRequest(res, "url is required");
  if (!events || !Array.isArray(events) || events.length === 0) {
    return badRequest(res, "events array is required with at least one event");
  }

  const wh = await webhookRepo.create(null as any, {
    id: "wh_" + genId(),
    workspaceId: ws.id,
    url,
    events,
    description: description ?? "",
    secret: secret ?? "whsec_" + genId(),
    metadata,
  });

  await writeAuditLog(ws.id, "System", "CREATE", "WEBHOOK", wh.id, null, wh);
  res.status(201).json(wh);
}));

router.put("/webhooks/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const wh = await webhookRepo.findById(null as any, req.params.id);
  if (!wh || wh.workspace_id !== ws.id) return notFound(res, "Webhook endpoint");

  const before = { ...wh };
  const { url, events, description, secret, metadata, status } = req.body;
  const updated = await webhookRepo.update(null as any, wh.id, {
    url, events, description, secret, metadata, status,
  });
  if (!updated) return notFound(res, "Webhook endpoint");
  await writeAuditLog(ws.id, "System", "UPDATE", "WEBHOOK", wh.id, before, updated);
  res.json(updated);
}));

router.delete("/webhooks/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const wh = await webhookRepo.findById(null as any, req.params.id);
  if (!wh || wh.workspace_id !== ws.id) return notFound(res, "Webhook endpoint");

  const before = { ...wh };
  await webhookRepo.softDelete(null as any, wh.id);
  await writeAuditLog(ws.id, "System", "DELETE", "WEBHOOK", wh.id, before, null);
  res.json({ deleted: true, id: wh.id });
}));

router.post("/webhooks/:id/test", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const wh = await webhookRepo.findById(null as any, req.params.id);
  if (!wh || wh.workspace_id !== ws.id) return notFound(res, "Webhook endpoint");

  const testPayload = {
    type: "webhook.test",
    data: { message: "This is a test webhook from Aora Billing OS" },
    timestamp: new Date().toISOString(),
    workspaceId: ws.id,
  };

  const deliveryId = "whd_" + genId();
  const startTime = Date.now();
  let success = false;
  let statusCode = 0;
  let responseBody = "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(wh.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-ID": wh.id,
        "X-Delivery-ID": deliveryId,
        "X-Signature": "test_signature_not_verified",
        "User-Agent": "Aora-Webhook/1.0",
      },
      body: JSON.stringify(testPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = response.status;
    responseBody = await response.text();
    success = statusCode >= 200 && statusCode < 300;
  } catch (err: any) {
    responseBody = err.message ?? "Connection failed";
    statusCode = 0;
  }

  const duration = Date.now() - startTime;

  await webhookRepo.logDelivery(wh.id, {
    id: deliveryId,
    webhookId: wh.id,
    eventType: "webhook.test",
    payload: testPayload,
    status: success ? "success" : "failed",
    statusCode,
    responseBody,
    duration,
    attempt: 1,
  });

  await writeAuditLog(ws.id, "System", "TEST", "WEBHOOK", wh.id, null, {
    testId: deliveryId, url: wh.url, success, statusCode, duration,
  });

  res.json({ testId: deliveryId, success, statusCode, responseBody, duration });
}));

router.get("/webhooks/:id/deliveries", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const wh = await webhookRepo.findById(null as any, req.params.id);
  if (!wh || wh.workspace_id !== ws.id) return notFound(res, "Webhook endpoint");

  const deliveries = await webhookRepo.getDeliveries(wh.id);
  res.json(deliveries);
}));

export default router;
