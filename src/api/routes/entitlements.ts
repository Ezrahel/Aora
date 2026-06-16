// ============================================================
// Aora Billing OS — Entitlements & Feature Access Control Routes
// GET /entitlements, PUT /entitlements/:featureId
// GET /can-access
// ============================================================

import { Router } from "express";
import { db, saveDatabase, writeAuditLog, resolveWorkspace, nanoid } from "../db.ts";
import { parsePagination, paginateArray, badRequest, notFound, genId, toNum } from "../middleware.ts";
import type { MeterDefinition, UsageEvent, Quota, CreditLedgerEntry, Entitlement, ClientEntitlement, Invoice } from "../types.ts";

export const router = Router();

// ── Helpers ────────────────────────────────────────────────────

// Build the ClientEntitlement view for a single feature from current db state.
function toClientEntitlement(featureId: string): ClientEntitlement | null {
  const feat = db.features.find((f) => f.id === featureId);
  if (!feat) return null;

  const mappings = db.entitlements.filter((ent) => ent.featureId === feat.id);

  const growthMapping = mappings.find((m) => m.planId === "growth" && m.value === true);
  const freeMapping = mappings.find((m) => m.planId === "free" && m.value === true);

  let requiredPlanId = "scale";
  if (freeMapping) {
    requiredPlanId = "free";
  } else if (growthMapping) {
    requiredPlanId = "growth";
  }

  return {
    featureId: feat.slug,
    featureName: feat.name,
    description: feat.description,
    requiredPlanId,
    isEnabled: mappings.some((m) => m.isEnabled),
  };
}

// ── Entitlements ───────────────────────────────────────────────

// GET /entitlements
// Transforms db.features + db.entitlements into the ClientEntitlement[] view.
router.get("/entitlements", (req, res) => {
  const _ws = resolveWorkspace(req);

  const clientEntitlements: ClientEntitlement[] = db.features.map((feat) => {
    const mappings = db.entitlements.filter((ent) => ent.featureId === feat.id);

    const growthMapping = mappings.find((m) => m.planId === "growth" && m.value === true);
    const freeMapping = mappings.find((m) => m.planId === "free" && m.value === true);

    let requiredPlanId = "scale";
    if (freeMapping) {
      requiredPlanId = "free";
    } else if (growthMapping) {
      requiredPlanId = "growth";
    }

    return {
      featureId: feat.slug,
      featureName: feat.name,
      description: feat.description,
      requiredPlanId,
      isEnabled: mappings.some((m) => m.isEnabled),
    };
  });

  return res.json(clientEntitlements);
});

// PUT /entitlements/:featureId
// featureId path param matches feature.slug.
router.put("/entitlements/:featureId", (req, res) => {
  const ws = resolveWorkspace(req);
  const { featureId } = req.params;
  const { requiredPlanId, isEnabled } = req.body as {
    requiredPlanId?: string;
    isEnabled?: boolean;
  };

  const targetFeature = db.features.find((f) => f.slug === featureId);
  if (!targetFeature) return notFound(res, "Feature");

  const beforeState = db.entitlements
    .filter((e) => e.featureId === targetFeature.id)
    .map((e) => ({ ...e }));

  if (requiredPlanId !== undefined) {
    // Propagate value to each plan tier's entitlement for this feature.
    // "free"   → all tiers = true
    // "growth" → growth + scale = true, free = false
    // "scale"  → only scale = true, others = false
    db.entitlements.forEach((ent) => {
      if (ent.featureId === targetFeature.id) {
        if (requiredPlanId === "free") {
          ent.value = true;
        } else if (requiredPlanId === "growth") {
          ent.value = ent.planId === "growth" || ent.planId === "scale";
        } else {
          ent.value = ent.planId === "scale";
        }
      }
    });
  }

  if (isEnabled !== undefined) {
    db.entitlements.forEach((ent) => {
      if (ent.featureId === targetFeature.id) {
        ent.isEnabled = isEnabled;
      }
    });
  }

  const afterState = db.entitlements
    .filter((e) => e.featureId === targetFeature.id)
    .map((e) => ({ ...e }));

  saveDatabase();
  writeAuditLog(
    ws.id,
    "Admin",
    "UPDATE",
    "ENTITLEMENT",
    targetFeature.id,
    beforeState,
    afterState,
  );

  // Return updated ClientEntitlement
  const mappings = db.entitlements.filter((ent) => ent.featureId === targetFeature.id);
  const growthMapping = mappings.find((m) => m.planId === "growth" && m.value === true);
  const freeMapping = mappings.find((m) => m.planId === "free" && m.value === true);

  let resolvedPlanId = "scale";
  if (freeMapping) resolvedPlanId = "free";
  else if (growthMapping) resolvedPlanId = "growth";

  const updated: ClientEntitlement = {
    featureId: targetFeature.slug,
    featureName: targetFeature.name,
    description: targetFeature.description,
    requiredPlanId: resolvedPlanId,
    isEnabled: mappings.some((m) => m.isEnabled),
  };

  return res.json(updated);
});

// ── Can Access ─────────────────────────────────────────────────

// GET /can-access
// Evaluates whether a customer can access a specific feature.
router.get("/can-access", (req, res) => {
  const { customerId, featureSlug } = req.query as {
    customerId?: string;
    featureSlug?: string;
  };

  if (!customerId || !featureSlug) {
    return badRequest(res, "customerId and featureSlug are required.");
  }

  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) return notFound(res, "Customer");

  const feature = db.features.find((f) => f.slug === featureSlug);
  if (!feature) {
    return res.status(404).json({
      error: `Feature slug '${featureSlug}' has not been declared inside workspace telemetry.`,
      code: "NOT_FOUND",
    });
  }

  // Resolve active plan: prefer subscription planId, fall back to customer.planId
  const sub = db.subscriptions.find((s) => s.customerId === customerId);
  const plan = db.plans.find((p) => p.id === (sub?.planId || customer.planId));

  // Find the entitlement gate for this plan + feature combination
  const entitlement = db.entitlements.find(
    (e) => e.planId === plan?.id && e.featureId === feature.id,
  );

  // isEnabled=false means the global lock is bypassed → access is always granted
  const isEnforced = entitlement?.isEnabled ?? true;
  const stateVal = entitlement ? !!entitlement.value : false;
  const isAllowed = isEnforced
    ? stateVal &&
      customer.status !== "paused" &&
      customer.status !== "canceled"
    : true;

  let reason: string;
  if (!isEnforced) {
    reason = `Global lock feature bypass enabled. Access of feature slug '${featureSlug}' is active.`;
  } else if (isAllowed) {
    reason = `Customer '${customer.name}' has valid subscription to '${plan?.name}' plan which unlocks entitlement gate '${feature.name}'.`;
  } else {
    reason = `Access denied. Feature '${feature.name}' requires plan upgrade (Customer is on '${plan?.name}' plan).`;
  }

  const ws = resolveWorkspace(req);
  writeAuditLog(
    ws.id,
    "Authorization Core Engine",
    "ACCESS_VERIFY",
    "ENTITLEMENT",
    entitlement?.id || "unknown",
    { customerId, featureSlug, status: customer.status, planId: plan?.id },
    { allowed: isAllowed, reason, enforcementActive: isEnforced },
  );

  return res.json({
    allowed: isAllowed,
    reason,
    planId: plan?.id,
    status: sub?.status,
    diagnostic: {
      customerName: customer.name,
      planId: plan?.id,
      subscriptionStatus: sub?.status || customer.status,
      enforced: isEnforced,
      value: entitlement?.value,
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
