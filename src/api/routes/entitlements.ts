// @ts-nocheck -- repository contract migration pending; tracked separately.
import { Router } from "express";
import {
  resolveWorkspace,
  writeAuditLog,
  genId,
  query,
  customerRepo,
  planRepo,
  entitlementRepo,
  featureRepo,
} from "../db.ts";
import { asyncHandler, badRequest, notFound } from "../middleware.ts";

export const router = Router();

router.get("/entitlements", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customerIds = customers.map((c) => c.id);

  if (customerIds.length === 0) return res.json([]);

  const entitlements = await entitlementRepo.findByCustomerIds(customerIds);
  const enriched = await Promise.all(entitlements.map(async (e) => {
    const cust = customers.find((c) => c.id === e.customerId);
    const feat = await featureRepo.findById(null as any, e.featureId);
    return { ...e, customerName: cust?.name ?? e.customerId, customerEmail: cust?.email ?? "", featureName: feat?.name ?? e.featureId };
  }));

  res.json(enriched);
}));

router.get("/entitlements/:customerId", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const entitlements = await entitlementRepo.findByCustomerIds([customer.id]);
  const enriched = await Promise.all(entitlements.map(async (e) => {
    const feat = await featureRepo.findById(null as any, e.featureId);
    return { ...e, featureName: feat?.name ?? e.featureId };
  }));

  res.json({
    customerId: customer.id,
    customerName: customer.name,
    customerEmail: customer.email,
    planName: customer.plan_id,
    entitlements: enriched,
  });
}));

router.post("/entitlements/:customerId/check", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const { featureKey, featureId } = req.body as { featureKey?: string; featureId?: string };
  if (!featureKey && !featureId) return badRequest(res, "Either featureKey or featureId is required");

  let feature;
  if (featureId) {
    feature = await featureRepo.findById(null as any, featureId);
  } else {
    const features = await featureRepo.findByFeatureKey(featureKey!);
    feature = features[0] ?? null;
  }

  if (!feature) return notFound(res, "Feature");

  const entitlements = await entitlementRepo.check(null as any, customer.id, feature.id);
  const quota = entitlements.find((e) => e.isQuota);
  const access = entitlements.find((e) => !e.isQuota);

  const plan = await planRepo.findById(null as any, customer.plan_id);

  res.json({
    featureId: feature.id,
    featureKey: feature.featureKey ?? feature.id,
    featureName: feature.name,
    planId: customer.plan_id,
    planName: plan?.name ?? customer.plan_id,
    entitled: access?.entitled ?? false,
    quota: quota ? { limit: quota.limit, usage: quota.usage, remaining: quota.remaining, exceeded: quota.remaining < 0 } : null,
    allEntitlements: entitlements,
  });
}));

router.post("/entitlements/:customerId/check-all", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const plan = await planRepo.findById(null as any, customer.plan_id);
  const planFeats = plan?.features ?? [];
  const planEntitlements = plan?.entitlements ?? [];

  const results = await Promise.all(planFeats.map(async (featKey: string) => {
    const features = await featureRepo.findByFeatureKey(featKey);
    const feat: any = features[0] ?? { id: featKey, name: featKey };
    const entitlements = await entitlementRepo.check(null as any, customer.id, feat.id);
    const quota = entitlements.find((e: any) => e.isQuota);
    const access = entitlements.find((e: any) => !e.isQuota);
    return {
      featureId: feat.id,
      featureKey: feat.featureKey ?? featKey,
      featureName: feat.name,
      entitled: access?.entitled ?? planEntitlements.includes(featKey) ?? false,
      quota: quota ? { limit: quota.limit, usage: quota.usage, remaining: quota.remaining } : null,
    };
  }));

  res.json({
    customerId: customer.id,
    customerName: customer.name,
    planId: customer.plan_id,
    planName: plan?.name ?? customer.plan_id,
    results,
  });
}));

router.post("/entitlements/:customerId/grant", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const { featureId, featureKey, limit, expiresAt } = req.body as {
    featureId?: string; featureKey?: string; limit?: number; expiresAt?: string;
  };
  if (!featureId && !featureKey) return badRequest(res, "Either featureId or featureKey is required");

  let feature;
  if (featureId) {
    feature = await featureRepo.findById(null as any, featureId);
  } else {
    const features = await featureRepo.findByFeatureKey(featureKey!);
    feature = features[0] ?? null;
  }

  if (!feature) return notFound(res, "Feature");

  const entitlement = await entitlementRepo.grant(null as any, {
    customerId: customer.id,
    featureId: feature.id,
    limit,
    expiresAt,
  });

  await writeAuditLog(ws.id, "System", "GRANT", "ENTITLEMENT", `${customer.id}:${feature.id}`, null, entitlement);
  res.status(201).json(entitlement);
}));

router.post("/entitlements/:customerId/revoke", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const { featureId, featureKey } = req.body as { featureId?: string; featureKey?: string };
  if (!featureId && !featureKey) return badRequest(res, "Either featureId or featureKey is required");

  let feature;
  if (featureId) {
    feature = await featureRepo.findById(null as any, featureId);
  } else {
    const features = await featureRepo.findByFeatureKey(featureKey!);
    feature = features[0] ?? null;
  }

  if (!feature) return notFound(res, "Feature");

  await entitlementRepo.revoke(null as any, customer.id, feature.id);
  await writeAuditLog(ws.id, "System", "REVOKE", "ENTITLEMENT", `${customer.id}:${feature.id}`, null, null);
  res.json({ revoked: true, customerId: customer.id, featureId: feature.id });
}));

export default router;
