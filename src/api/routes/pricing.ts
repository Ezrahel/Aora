// ============================================================
// Aora Billing OS — Pricing Routes
// Prices · Rate Cards · Discounts · Coupons · Contracts · Calculator
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
// PRICES
// ──────────────────────────────────────────────────────────────

router.get("/prices", (req, res) => {
  let prices = [...db.prices];
  if (req.query.planId) {
    prices = prices.filter((p) => p.planId === req.query.planId);
  }
  if (req.query.active !== undefined) {
    const active = req.query.active === "true";
    prices = prices.filter((p) => p.isActive === active);
  }
  return res.json(prices);
});

router.get("/prices/:id", (req, res) => {
  const price = db.prices.find((p) => p.id === req.params.id);
  if (!price) return notFound(res, "Price");
  return res.json(price);
});

router.post("/prices", (req, res) => {
  const ws = resolveWorkspace(req);
  const {
    planId,
    name,
    type,
    billingPeriod,
    currency,
    baseFee,
    seatPrice,
    includedSeats,
    meterId,
    includedUsage,
    overageUnitPrice,
    tiers,
    volumePricing,
    packageSize,
    packagePrice,
  } = req.body;

  if (!planId || !name || !type) {
    return badRequest(res, "planId, name, and type are required.");
  }

  // Version management — deactivate existing active prices for this plan
  const previousPrices = db.prices.filter((p) => p.planId === planId);
  const latestVersion = previousPrices.reduce(
    (max, p) => Math.max(max, p.version),
    0,
  );
  const nextVersion = latestVersion + 1;

  for (const p of previousPrices) {
    if (p.isActive) p.isActive = false;
  }

  const newPrice: Price = {
    id: `pr_${planId}_v${nextVersion}_${Date.now().toString().slice(-4)}`,
    planId,
    name,
    type,
    billingPeriod: billingPeriod ?? "monthly",
    currency: currency ?? "USD",
    baseFee: toNum(baseFee, 0),
    ...(seatPrice !== undefined && { seatPrice: toNum(seatPrice, 0) }),
    ...(includedSeats !== undefined && {
      includedSeats: toNum(includedSeats, 0),
    }),
    ...(meterId !== undefined && { meterId }),
    ...(includedUsage !== undefined && {
      includedUsage: toNum(includedUsage, 0),
    }),
    ...(overageUnitPrice !== undefined && {
      overageUnitPrice: toNum(overageUnitPrice, 0),
    }),
    ...(tiers !== undefined && { tiers }),
    ...(volumePricing !== undefined && { volumePricing: !!volumePricing }),
    ...(packageSize !== undefined && { packageSize: toNum(packageSize, 0) }),
    ...(packagePrice !== undefined && { packagePrice: toNum(packagePrice, 0) }),
    version: nextVersion,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  db.prices.unshift(newPrice);
  saveDatabase();
  writeAuditLog(ws.id, "Admin", "CREATE", "PRICE", newPrice.id, null, newPrice);
  return res.status(201).json(newPrice);
});

router.delete("/prices/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const price = db.prices.find((p) => p.id === req.params.id);
  if (!price) return notFound(res, "Price");

  const before = { ...price };
  price.isArchived = true;
  price.isActive = false;

  saveDatabase();
  writeAuditLog(ws.id, "Admin", "DELETE", "PRICE", price.id, before, price);
  return res.json({ archived: true, id: price.id });
});

// ──────────────────────────────────────────────────────────────
// RATE CARDS
// ──────────────────────────────────────────────────────────────

router.get("/rate-cards", (_req, res) => {
  return res.json(db.rateCards);
});

router.post("/rate-cards", (req, res) => {
  const ws = resolveWorkspace(req);
  const {
    name,
    description,
    meterId,
    priceType,
    unitPrice,
    tiers,
    includedUnits,
    currency,
  } = req.body;

  if (!name || !meterId || !priceType) {
    return badRequest(res, "name, meterId, and priceType are required.");
  }

  const newRateCard: RateCard = {
    id: "rc_" + Date.now().toString().slice(-6),
    name,
    description: description ?? "",
    meterId,
    priceType,
    ...(unitPrice !== undefined && { unitPrice: toNum(unitPrice, 0) }),
    ...(tiers !== undefined && { tiers }),
    ...(includedUnits !== undefined && {
      includedUnits: toNum(includedUnits, 0),
    }),
    currency: currency ?? "USD",
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  db.rateCards.unshift(newRateCard);
  saveDatabase();
  writeAuditLog(
    ws.id,
    "Admin",
    "CREATE",
    "RATE_CARD",
    newRateCard.id,
    null,
    newRateCard,
  );
  return res.status(201).json(newRateCard);
});

// ──────────────────────────────────────────────────────────────
// DISCOUNTS
// ──────────────────────────────────────────────────────────────

router.get("/discounts", (_req, res) => {
  return res.json(db.discounts.filter((d) => !d.isDeleted));
});

router.get("/discounts/:id", (req, res) => {
  const discount = db.discounts.find((d) => d.id === req.params.id);
  if (!discount) return notFound(res, "Discount");
  return res.json(discount);
});

router.post("/discounts", (req, res) => {
  const ws = resolveWorkspace(req);
  const { name, type, value, appliesTo, duration, durationMonths } = req.body;

  if (!name || !type || value === undefined) {
    return badRequest(res, "name, type, and value are required.");
  }

  const newDiscount: Discount = {
    id: "disc_" + genId(),
    name,
    type,
    value: toNum(value, 0),
    appliesTo: appliesTo ?? "all",
    duration: duration ?? "once",
    ...(durationMonths !== undefined && {
      durationMonths: toNum(durationMonths, 0),
    }),
    createdAt: new Date().toISOString(),
  };

  db.discounts.push(newDiscount);
  saveDatabase();
  writeAuditLog(
    ws.id,
    "Admin",
    "CREATE",
    "DISCOUNT",
    newDiscount.id,
    null,
    newDiscount,
  );
  return res.status(201).json(newDiscount);
});

router.delete("/discounts/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const discount = db.discounts.find((d) => d.id === req.params.id);
  if (!discount) return notFound(res, "Discount");

  const before = { ...discount };
  discount.isDeleted = true;

  saveDatabase();
  writeAuditLog(
    ws.id,
    "Admin",
    "DELETE",
    "DISCOUNT",
    discount.id,
    before,
    discount,
  );
  return res.json({ deleted: true, id: discount.id });
});

// ──────────────────────────────────────────────────────────────
// COUPONS
// ──────────────────────────────────────────────────────────────

router.get("/coupons", (req, res) => {
  let coupons = db.coupons;
  if (req.query.isActive !== undefined) {
    const isActive = req.query.isActive === "true";
    coupons = coupons.filter((c) => c.isActive === isActive);
  }
  return res.json(coupons);
});

router.get("/coupons/:id", (req, res) => {
  const coupon = db.coupons.find((c) => c.id === req.params.id);
  if (!coupon) return notFound(res, "Coupon");
  return res.json(coupon);
});

router.post("/coupons", (req, res) => {
  const ws = resolveWorkspace(req);
  const { name, discountId, code, expireAt, maxRedemptions } = req.body;

  if (!name || !discountId || !code) {
    return badRequest(res, "name, discountId, and code are required.");
  }

  const normalizedCode = code.trim().toUpperCase();

  const collision = db.coupons.find(
    (c) => c.code === normalizedCode && c.isActive,
  );
  if (collision) {
    return conflict(
      res,
      `An active coupon with code '${normalizedCode}' already exists.`,
    );
  }

  const newCoupon: Coupon = {
    id: "cp_" + genId(),
    name,
    discountId,
    code: normalizedCode,
    isActive: true,
    ...(expireAt !== undefined && { expireAt }),
    ...(maxRedemptions !== undefined && {
      maxRedemptions: toNum(maxRedemptions, 0),
    }),
    timesRedeemed: 0,
    createdAt: new Date().toISOString(),
  };

  db.coupons.push(newCoupon);
  saveDatabase();
  writeAuditLog(
    ws.id,
    "Admin",
    "CREATE",
    "COUPON",
    newCoupon.id,
    null,
    newCoupon,
  );
  return res.status(201).json(newCoupon);
});

router.patch("/coupons/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const coupon = db.coupons.find((c) => c.id === req.params.id);
  if (!coupon) return notFound(res, "Coupon");

  const before = { ...coupon };
  const { isActive, expireAt, maxRedemptions } = req.body;

  if (isActive !== undefined) coupon.isActive = !!isActive;
  if (expireAt !== undefined) coupon.expireAt = expireAt;
  if (maxRedemptions !== undefined)
    coupon.maxRedemptions = toNum(maxRedemptions, 0);

  saveDatabase();
  writeAuditLog(ws.id, "Admin", "UPDATE", "COUPON", coupon.id, before, coupon);
  return res.json(coupon);
});

// ──────────────────────────────────────────────────────────────
// CUSTOM CONTRACTS
// ──────────────────────────────────────────────────────────────

router.get("/contracts", (_req, res) => {
  return res.json(db.customContracts.filter((c) => !c.isDeleted));
});

router.get("/contracts/:id", (req, res) => {
  const contract = db.customContracts.find((c) => c.id === req.params.id);
  if (!contract) return notFound(res, "Contract");
  return res.json(contract);
});

router.post("/contracts", (req, res) => {
  const ws = resolveWorkspace(req);
  const {
    customerId,
    name,
    customBaseFee,
    customSeatPrice,
    customOverageUnitPrice,
    minimumSpend,
    additionalDiscountPercentage,
    expireAt,
  } = req.body;

  if (!customerId || !name || customBaseFee === undefined) {
    return badRequest(res, "customerId, name, and customBaseFee are required.");
  }

  const defaultExpire = new Date();
  defaultExpire.setFullYear(defaultExpire.getFullYear() + 1);

  const newContract: CustomContract = {
    id: "cc_" + genId(),
    customerId,
    name,
    customBaseFee: toNum(customBaseFee, 0),
    ...(customSeatPrice !== undefined && {
      customSeatPrice: toNum(customSeatPrice, 0),
    }),
    ...(customOverageUnitPrice !== undefined && {
      customOverageUnitPrice: toNum(customOverageUnitPrice, 0),
    }),
    ...(minimumSpend !== undefined && { minimumSpend: toNum(minimumSpend, 0) }),
    ...(additionalDiscountPercentage !== undefined && {
      additionalDiscountPercentage: toNum(additionalDiscountPercentage, 0),
    }),
    expireAt: expireAt ?? defaultExpire.toISOString(),
    createdAt: new Date().toISOString(),
  };

  db.customContracts.unshift(newContract);
  saveDatabase();
  writeAuditLog(
    ws.id,
    "Admin",
    "CREATE",
    "CONTRACT",
    newContract.id,
    null,
    newContract,
  );
  return res.status(201).json(newContract);
});

router.delete("/contracts/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const contract = db.customContracts.find((c) => c.id === req.params.id);
  if (!contract) return notFound(res, "Contract");

  const before = { ...contract };
  contract.isDeleted = true;

  saveDatabase();
  writeAuditLog(
    ws.id,
    "Admin",
    "DELETE",
    "CONTRACT",
    contract.id,
    before,
    contract,
  );
  return res.json({ deleted: true, id: contract.id });
});

// ──────────────────────────────────────────────────────────────
// PRICING CALCULATOR
// ──────────────────────────────────────────────────────────────

router.post("/pricing-calculate", (req, res) => {
  const {
    customerId,
    priceId,
    planId,
    seatsCount,
    usageUnits,
    couponCode,
    useCredits,
  } = req.body;

  let activePrice: Price | null = null;

  // 1. Resolve price from catalog
  if (priceId) {
    activePrice = db.prices.find((p) => p.id === priceId) || null;
  } else if (planId) {
    activePrice =
      db.prices.find((p) => p.planId === planId && p.isActive) || null;
  }

  // 2. Fallback: synthesize a Price from the Plan record
  if (!activePrice) {
    const matchedPlan = db.plans.find((p) => p.id === planId);
    if (matchedPlan) {
      activePrice = {
        id: "pr_impl_" + matchedPlan.id,
        planId: matchedPlan.id,
        name: matchedPlan.name + " Default Price",
        type:
          (matchedPlan.pricingType === "per_seat"
            ? "seat"
            : matchedPlan.pricingType) || "hybrid",
        billingPeriod: matchedPlan.billingPeriod,
        currency: matchedPlan.currency,
        baseFee: matchedPlan.price,
        includedSeats: matchedPlan.includedSeats,
        includedUsage: matchedPlan.includedUsage,
        overageUnitPrice: matchedPlan.overageUnitPrice,
        version: 1,
        isActive: true,
        createdAt: matchedPlan.createdAt,
      };
    } else {
      return res
        .status(404)
        .json({
          error:
            "Pricing schema parameter structure not defined in this catalog.",
        });
    }
  }

  // 3. Resolve customer + contract override
  let targetCustomer: { seatsUsed: number; usageUnits: number } | null = null;
  let contractOverride: CustomContract | null = null;

  if (customerId) {
    targetCustomer = db.customers.find((c) => c.id === customerId) || null;
    contractOverride =
      db.customContracts.find(
        (cc) => cc.customerId === customerId && !cc.isDeleted,
      ) || null;
  }

  const seatsInput =
    seatsCount !== undefined
      ? Number(seatsCount)
      : targetCustomer
        ? targetCustomer.seatsUsed
        : activePrice.includedSeats || 1;
  const usageInput =
    usageUnits !== undefined
      ? Number(usageUnits)
      : targetCustomer
        ? targetCustomer.usageUnits
        : 0;

  // 4. Apply contract overrides
  let baseFee = activePrice.baseFee;
  let seatPrice = activePrice.seatPrice || 0;
  let overageUnitPrice = activePrice.overageUnitPrice || 0;

  if (contractOverride) {
    baseFee = contractOverride.customBaseFee;
    if (contractOverride.customSeatPrice !== undefined)
      seatPrice = contractOverride.customSeatPrice;
    if (contractOverride.customOverageUnitPrice !== undefined)
      overageUnitPrice = contractOverride.customOverageUnitPrice;
  }

  const modelType = activePrice.type;
  const seatsIncluded = activePrice.includedSeats || 0;
  const usageIncluded = activePrice.includedUsage || 0;

  const seatsOverage = Math.max(0, seatsInput - seatsIncluded);
  const seatCharge = seatsOverage * seatPrice;

  let overageUnits = 0;
  let overageCharge = 0;
  let tierBreakdown: {
    tierRange: string;
    units: number;
    rate: number;
    charge: number;
  }[] = [];

  // 5. Calculate overage by pricing model
  if (modelType === "flat") {
    overageCharge = 0;
  } else if (modelType === "usage") {
    overageUnits = usageInput;
    overageCharge = usageInput * overageUnitPrice;
  } else if (modelType === "seat") {
    // seat charge already computed; no usage overage
    overageCharge = 0;
  } else if (modelType === "tiered") {
    const tiers = activePrice.tiers || [];
    let remaining = usageInput;
    let lastBorder = 0;
    for (const tier of tiers) {
      const limit = tier.upTo === "infinity" ? Infinity : Number(tier.upTo);
      const capacity = limit - lastBorder;
      const consumedInTier = Math.min(remaining, capacity);
      if (consumedInTier > 0) {
        const cost = consumedInTier * tier.unitPrice;
        overageCharge += cost;
        remaining -= consumedInTier;
        tierBreakdown.push({
          tierRange: `${lastBorder} - ${tier.upTo === "infinity" ? "\u221e" : tier.upTo}`,
          units: consumedInTier,
          rate: tier.unitPrice,
          charge: cost,
        });
      }
      lastBorder = limit;
      if (remaining <= 0) break;
    }
    overageUnits = usageInput;
  } else if (modelType === "volume") {
    const tiers = activePrice.tiers || [];
    let rateToUse = overageUnitPrice;
    for (const tier of tiers) {
      const limit = tier.upTo === "infinity" ? Infinity : Number(tier.upTo);
      if (usageInput <= limit) {
        rateToUse = tier.unitPrice;
        break;
      }
    }
    overageUnits = usageInput;
    overageCharge = usageInput * rateToUse;
    tierBreakdown.push({
      tierRange: "Entire Volume Tier",
      units: usageInput,
      rate: rateToUse,
      charge: overageCharge,
    });
  } else if (modelType === "package") {
    const size = activePrice.packageSize || 10000;
    const pricePerSize = activePrice.packagePrice || 5000;
    const packagesNeeded = Math.ceil(usageInput / size);
    overageUnits = usageInput;
    overageCharge = packagesNeeded * pricePerSize;
    tierBreakdown.push({
      tierRange: `Incremental Packages of ${size}`,
      units: packagesNeeded,
      rate: pricePerSize,
      charge: overageCharge,
    });
  } else if (modelType === "hybrid" || modelType === "custom_contract") {
    overageUnits = Math.max(0, usageInput - usageIncluded);
    overageCharge = overageUnits * overageUnitPrice;
  }

  // 6. Coupon + discount resolution
  let discountAmount = 0;
  let activeDiscount: Discount | null = null;

  if (couponCode) {
    const coupon = db.coupons.find(
      (c) => c.code === couponCode.trim().toUpperCase() && c.isActive,
    );
    if (coupon) {
      activeDiscount =
        db.discounts.find((d) => d.id === coupon.discountId) || null;
    }
  }

  const grossSum = baseFee + seatCharge + overageCharge;

  if (activeDiscount) {
    if (activeDiscount.type === "percentage") {
      const pct = activeDiscount.value / 100;
      if (activeDiscount.appliesTo === "all") discountAmount = grossSum * pct;
      else if (activeDiscount.appliesTo === "base_fee")
        discountAmount = baseFee * pct;
      else if (activeDiscount.appliesTo === "overage")
        discountAmount = overageCharge * pct;
      else if (activeDiscount.appliesTo === "seat_fee")
        discountAmount = seatCharge * pct;
    } else if (activeDiscount.type === "fixed") {
      const fixedVal = activeDiscount.value;
      if (activeDiscount.appliesTo === "all")
        discountAmount = Math.min(grossSum, fixedVal);
      else if (activeDiscount.appliesTo === "base_fee")
        discountAmount = Math.min(baseFee, fixedVal);
      else if (activeDiscount.appliesTo === "overage")
        discountAmount = Math.min(overageCharge, fixedVal);
      else if (activeDiscount.appliesTo === "seat_fee")
        discountAmount = Math.min(seatCharge, fixedVal);
    }
  }

  // 7. Minimum spend commitment
  let subtotal = grossSum - discountAmount;
  let enterpriseMinimumAdjust = 0;
  if (contractOverride && contractOverride.minimumSpend !== undefined) {
    const minSpend = contractOverride.minimumSpend;
    if (subtotal < minSpend) {
      enterpriseMinimumAdjust = minSpend - subtotal;
      subtotal = minSpend;
    }
  }

  // 8. Credit ledger
  let creditBalance = 0;
  let creditApplied = 0;
  if (customerId) {
    creditBalance = db.creditLedger
      .filter((e) => e.customerId === customerId)
      .reduce((sum, e) => sum + e.amount, 0);
  }
  if (useCredits && creditBalance > 0 && subtotal > 0) {
    creditApplied = Math.min(subtotal, creditBalance);
    subtotal -= creditApplied;
  }

  const finalTotal = Math.max(0, subtotal);

  return res.json({
    price_id: activePrice.id,
    price_name: activePrice.name,
    pricing_type: modelType,
    currency: activePrice.currency,
    billing_period: activePrice.billingPeriod,
    base_fee: baseFee,
    included_seats: seatsIncluded,
    seats_consumed: seatsInput,
    seat_fee_per_unit: seatPrice,
    seat_charge: seatCharge,
    included_usage: usageIncluded,
    usage_consumed: usageInput,
    overage_units: overageUnits,
    overage_charge: overageCharge,
    tier_breakdown: tierBreakdown,
    discount_applied: discountAmount,
    discount_name: activeDiscount?.name || null,
    minimum_spend_adjustment: enterpriseMinimumAdjust,
    credit_balance: creditBalance,
    credit_applied: creditApplied,
    total: finalTotal,
    has_contract_override: !!contractOverride,
  });
});

export default router;
