// ============================================================
// Aora Billing OS — Plans Routes
// CRUD for pricing plans + automatic entitlement generation
// ============================================================

import { Router } from "express";
import { db, saveDatabase, writeAuditLog, resolveWorkspace, nanoid } from "../db.ts";
import { parsePagination, paginateArray, badRequest, notFound, conflict, genId, toNum } from "../middleware.ts";
import type { Plan, Entitlement } from "../types.ts";

const router = Router();

// GET /plans — return all plans; exclude archived when ?archived=false
router.get("/plans", (req, res) => {
  const showArchived = req.query.archived !== "false";
  const plans = showArchived
    ? db.plans
    : db.plans.filter((p) => !p.isArchived);
  return res.json(plans);
});

// GET /plans/:id — single plan or 404
router.get("/plans/:id", (req, res) => {
  const plan = db.plans.find((p) => p.id === req.params.id);
  if (!plan) return notFound(res, "Plan");
  return res.json(plan);
});

// POST /plans — create a new plan + entitlements for every feature
router.post("/plans", (req, res) => {
  const ws = resolveWorkspace(req);

  const {
    name,
    price,
    currency,
    billingPeriod,
    includedSeats,
    includedUsage,
    apiAccess,
    overageUnitPrice,
    description,
    pricingType,
  } = req.body as {
    name?: string;
    price?: number;
    currency?: string;
    billingPeriod?: "monthly" | "yearly";
    includedSeats?: number;
    includedUsage?: number;
    apiAccess?: boolean;
    overageUnitPrice?: number;
    description?: string;
    pricingType?: "flat" | "per_seat" | "usage" | "hybrid";
  };

  if (!name || !name.trim()) {
    return badRequest(res, "name is required.");
  }

  const generatedId = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");

  if (db.plans.find((p) => p.id === generatedId)) {
    return conflict(res, `A plan with id '${generatedId}' already exists. Choose a different name.`);
  }

  const validPeriods = ["monthly", "yearly"] as const;
  if (billingPeriod && !validPeriods.includes(billingPeriod)) {
    return badRequest(res, `billingPeriod must be one of: ${validPeriods.join(", ")}`);
  }

  const validPricingTypes = ["flat", "per_seat", "usage", "hybrid"] as const;
  if (pricingType && !validPricingTypes.includes(pricingType)) {
    return badRequest(res, `pricingType must be one of: ${validPricingTypes.join(", ")}`);
  }

  const newPlan: Plan = {
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
    ...(pricingType ? { pricingType } : {}),
    createdAt: new Date().toISOString(),
  };

  db.plans.push(newPlan);

  // Auto-create entitlements for every known feature
  for (const feat of db.features) {
    const ent: Entitlement = {
      id: `ent_${generatedId}_${feat.slug}`,
      planId: generatedId,
      featureId: feat.id,
      value: feat.slug === "api_access" ? !!apiAccess : false,
      isEnabled: true,
      createdAt: new Date().toISOString(),
    };
    db.entitlements.push(ent);
  }

  saveDatabase();
  writeAuditLog(ws.id, "Admin", "CREATE", "PLAN", newPlan.id, null, newPlan);
  return res.status(201).json(newPlan);
});

// PUT /plans/:id — partial update
router.put("/plans/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const plan = db.plans.find((p) => p.id === req.params.id);
  if (!plan) return notFound(res, "Plan");

  const {
    name,
    price,
    currency,
    description,
    billingPeriod,
    includedSeats,
    includedUsage,
    apiAccess,
    overageUnitPrice,
    pricingType,
  } = req.body as Partial<Pick<
    Plan,
    | "name" | "price" | "currency" | "description" | "billingPeriod"
    | "includedSeats" | "includedUsage" | "apiAccess" | "overageUnitPrice" | "pricingType"
  >>;

  const validPeriods = ["monthly", "yearly"] as const;
  if (billingPeriod !== undefined && !validPeriods.includes(billingPeriod)) {
    return badRequest(res, `billingPeriod must be one of: ${validPeriods.join(", ")}`);
  }

  const validPricingTypes = ["flat", "per_seat", "usage", "hybrid"] as const;
  if (pricingType !== undefined && !validPricingTypes.includes(pricingType)) {
    return badRequest(res, `pricingType must be one of: ${validPricingTypes.join(", ")}`);
  }

  const before = { ...plan };

  if (name !== undefined) plan.name = name.trim();
  if (price !== undefined) plan.price = toNum(price, plan.price);
  if (currency !== undefined) plan.currency = currency;
  if (description !== undefined) plan.description = description;
  if (billingPeriod !== undefined) plan.billingPeriod = billingPeriod;
  if (includedSeats !== undefined) plan.includedSeats = toNum(includedSeats, plan.includedSeats);
  if (includedUsage !== undefined) plan.includedUsage = toNum(includedUsage, plan.includedUsage);
  if (apiAccess !== undefined) plan.apiAccess = !!apiAccess;
  if (overageUnitPrice !== undefined) plan.overageUnitPrice = toNum(overageUnitPrice, plan.overageUnitPrice);
  if (pricingType !== undefined) plan.pricingType = pricingType;

  saveDatabase();
  writeAuditLog(ws.id, "Admin", "UPDATE", "PLAN", plan.id, before, plan);
  return res.json(plan);
});

// DELETE /plans/:id — soft-archive
router.delete("/plans/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const plan = db.plans.find((p) => p.id === req.params.id);
  if (!plan) return notFound(res, "Plan");

  const before = { ...plan };
  plan.isArchived = true;

  saveDatabase();
  writeAuditLog(ws.id, "Admin", "DELETE", "PLAN", plan.id, before, plan);
  return res.json({ archived: true, id: plan.id });
});

export default router;
