import { Router } from "express";
import {
  resolveWorkspace,
  writeAuditLog,
  planRepo,
  featureRepo,
  entitlementRepo,
} from "../db.ts";
import { asyncHandler, badRequest, notFound, conflict, toNum } from "../middleware.ts";

export const router = Router();

router.get("/plans", asyncHandler(async (req, res) => {
  const showArchived = req.query.archived !== "false";
  const plans = await planRepo.findAll(showArchived);
  res.json(plans);
}));

router.get("/plans/:id", asyncHandler(async (req, res) => {
  const plan = await planRepo.findById(null as any, req.params.id);
  if (!plan) return notFound(res, "Plan");
  res.json(plan);
}));

router.post("/plans", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const {
    name, price, currency, billingPeriod, includedSeats,
    includedUsage, apiAccess, overageUnitPrice, description, pricingType,
  } = req.body as {
    name?: string; price?: number; currency?: string;
    billingPeriod?: "monthly" | "yearly"; includedSeats?: number;
    includedUsage?: number; apiAccess?: boolean; overageUnitPrice?: number;
    description?: string; pricingType?: "flat" | "per_seat" | "usage" | "hybrid";
  };

  if (!name || !name.trim()) return badRequest(res, "name is required.");

  const generatedId = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
  const existing = await planRepo.findById(null as any, generatedId);
  if (existing) return conflict(res, `A plan with id '${generatedId}' already exists.`);

  const validPeriods = ["monthly", "yearly"] as const;
  if (billingPeriod && !validPeriods.includes(billingPeriod)) {
    return badRequest(res, `billingPeriod must be one of: ${validPeriods.join(", ")}`);
  }

  const validPricingTypes = ["flat", "per_seat", "usage", "hybrid"] as const;
  if (pricingType && !validPricingTypes.includes(pricingType)) {
    return badRequest(res, `pricingType must be one of: ${validPricingTypes.join(", ")}`);
  }

  const newPlan = await planRepo.create(null as any, {
    id: generatedId,
    productId: "prod_compute",
    name: name.trim(),
    price: toNum(price, 0),
    currency: currency ?? "USD",
    billingPeriod: billingPeriod ?? "monthly",
    includedSeats: toNum(includedSeats, 0),
    includedUsage: toNum(includedUsage, 0),
    apiAccess: !!apiAccess,
    overageUnitPrice: toNum(overageUnitPrice, 0),
    description: description ?? "",
    pricingType,
  });

  // Auto-create entitlements for every known feature
  const features = await featureRepo.findByWorkspace(ws.id);
  await entitlementRepo.batchCreateForPlan(null as any, generatedId, features, !!apiAccess);

  await writeAuditLog(ws.id, "Admin", "CREATE", "PLAN", newPlan.id, null, newPlan);
  res.status(201).json(newPlan);
}));

router.put("/plans/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const plan = await planRepo.findById(null as any, req.params.id);
  if (!plan) return notFound(res, "Plan");

  const {
    name, price, currency, description, billingPeriod,
    includedSeats, includedUsage, apiAccess, overageUnitPrice, pricingType,
  } = req.body;

  const validPeriods = ["monthly", "yearly"] as const;
  if (billingPeriod !== undefined && !validPeriods.includes(billingPeriod)) {
    return badRequest(res, `billingPeriod must be one of: ${validPeriods.join(", ")}`);
  }
  const validPricingTypes = ["flat", "per_seat", "usage", "hybrid"] as const;
  if (pricingType !== undefined && !validPricingTypes.includes(pricingType)) {
    return badRequest(res, `pricingType must be one of: ${validPricingTypes.join(", ")}`);
  }

  const before = { ...plan };
  const updated = await planRepo.update(null as any, plan.id, {
    name, price, currency, description, billingPeriod,
    includedSeats, includedUsage, apiAccess, overageUnitPrice, pricingType,
  });
  if (!updated) return notFound(res, "Plan");
  await writeAuditLog(ws.id, "Admin", "UPDATE", "PLAN", plan.id, before, updated);
  res.json(updated);
}));

router.delete("/plans/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const plan = await planRepo.findById(null as any, req.params.id);
  if (!plan) return notFound(res, "Plan");

  const before = { ...plan };
  await planRepo.softDelete(null as any, plan.id);
  await writeAuditLog(ws.id, "Admin", "DELETE", "PLAN", plan.id, before, plan);
  res.json({ archived: true, id: plan.id });
}));

export default router;
