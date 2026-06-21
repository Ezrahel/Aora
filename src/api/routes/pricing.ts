// @ts-nocheck

import { Router } from "express";
import {
  resolveWorkspace,
  writeAuditLog,
  genId,
  toNum,
  priceRepo,
  rateCardRepo,
  discountRepo,
  couponRepo,
  planRepo,
  productRepo,
} from "../db.ts";
import { asyncHandler, badRequest, notFound, conflict } from "../middleware.ts";

export const router = Router();

router.get("/prices", asyncHandler(async (req, res) => {
  const { productId, type } = req.query as Record<string, string | undefined>;
  const prices = await priceRepo.findAll(null as any, { productId, type });
  res.json(prices);
}));

router.get("/prices/:id", asyncHandler(async (req, res) => {
  const price = await priceRepo.findById(null as any, req.params.id);
  if (!price) return notFound(res, "Price");
  res.json(price);
}));

router.post("/prices", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { productId, type, amount, currency, interval, usageType, unit, tierMode, tiers, metadata } = req.body as {
    productId?: string; type?: string; amount?: number; currency?: string; interval?: string;
    usageType?: string; unit?: string; tierMode?: string; tiers?: any[]; metadata?: Record<string, unknown>;
  };
  if (!productId || !type || amount === undefined) return badRequest(res, "productId, type, and amount are required");

  const product = await productRepo.findById(null as any, productId);
  if (!product) return notFound(res, "Product");

  const id = "price_" + genId();
  const price = await priceRepo.create(null as any, {
    id,
    productId,
    type: type as any,
    amount: toNum(amount, 0),
    currency: currency ?? "usd",
    interval: type === "recurring" ? (interval ?? "monthly") : undefined,
    usageType: type === "usage" ? (usageType ?? "licensed") : undefined,
    unit: unit ?? "unit",
    tierMode: type === "tiered" ? (tierMode as any) : undefined,
    tiers: type === "tiered" ? tiers ?? [] : undefined,
    metadata,
  });

  await writeAuditLog(ws.id, "System", "CREATE", "PRICE", price.id, null, price);
  res.status(201).json(price);
}));

router.put("/prices/:id", asyncHandler(async (req, res) => {
  const price = await priceRepo.findById(null as any, req.params.id);
  if (!price) return notFound(res, "Price");
  const before = { ...price };
  const { amount, currency, interval, usageType, unit, tierMode, tiers, metadata, status } = req.body;
  const updated = await priceRepo.update(null as any, price.id, {
    amount: amount !== undefined ? toNum(amount, 0) : undefined,
    currency, interval, usageType, unit, tierMode, tiers, metadata, status,
  });
  if (!updated) return notFound(res, "Price");

  const ws = await resolveWorkspace(req);
  await writeAuditLog(ws.id, "System", "UPDATE", "PRICE", price.id, before, updated);
  res.json(updated);
}));

router.delete("/prices/:id", asyncHandler(async (req, res) => {
  const price = await priceRepo.findById(null as any, req.params.id);
  if (!price) return notFound(res, "Price");
  const before = { ...price };
  await priceRepo.softDelete(null as any, price.id);

  const ws = await resolveWorkspace(req);
  await writeAuditLog(ws.id, "System", "DELETE", "PRICE", price.id, before, { ...price, status: "archived" });
  res.json({ deleted: true, id: price.id });
}));

router.get("/rate-cards", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await (await import("../db.ts")).customerRepo.findByWorkspace(ws.id);
  const customerIds = customers.map((c) => c.id);
  if (customerIds.length === 0) return res.json([]);

  const cards = await rateCardRepo.findByCustomerIds(customerIds);
  const enriched = await Promise.all(cards.map(async (c: any) => {
    const cust = customers.find((cc) => cc.id === c.customerId);
    return { ...c, customerName: cust?.name ?? c.customerId };
  }));
  res.json(enriched);
}));

router.get("/rate-cards/:customerId", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await (await import("../db.ts")).customerRepo.findByWorkspace(ws.id);
  const customer = customers.find((c: any) => c.id === req.params.customerId);
  if (!customer) return notFound(res, "Customer");

  const cards = await rateCardRepo.findByCustomerIds([customer.id]);
  res.json(cards);
}));

router.post("/rate-cards", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { customerId, priceId, overrideAmount, metadata } = req.body as {
    customerId?: string; priceId?: string; overrideAmount?: number; metadata?: Record<string, unknown>;
  };
  if (!customerId || !priceId) return badRequest(res, "customerId and priceId are required");

  const customers = await (await import("../db.ts")).customerRepo.findByWorkspace(ws.id);
  const customer = customers.find((c: any) => c.id === customerId);
  if (!customer) return notFound(res, "Customer");
  const price = await priceRepo.findById(null as any, priceId);
  if (!price) return notFound(res, "Price");

  const id = "ratecard_" + genId();
  const card = await rateCardRepo.create(null as any, {
    id,
    customerId,
    priceId,
    overrideAmount: overrideAmount !== undefined ? toNum(overrideAmount, 0) : undefined,
    metadata,
  });

  await writeAuditLog(ws.id, "System", "CREATE", "RATE_CARD", card.id, null, card);
  res.status(201).json(card);
}));

router.delete("/rate-cards/:id", asyncHandler(async (req, res) => {
  const card = await rateCardRepo.findById(null as any, req.params.id);
  if (!card) return notFound(res, "Rate card");
  await rateCardRepo.softDelete(null as any, card.id);

  const ws = await resolveWorkspace(req);
  await writeAuditLog(ws.id, "System", "DELETE", "RATE_CARD", card.id, null, null);
  res.json({ deleted: true, id: card.id });
}));

router.get("/discounts", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await (await import("../db.ts")).customerRepo.findByWorkspace(ws.id);
  const customerIds = customers.map((c) => c.id);
  if (customerIds.length === 0) return res.json([]);

  const discounts = await discountRepo.findByCustomerIds(customerIds);
  res.json(discounts);
}));

router.post("/discounts", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { customerId, type, value, duration, maxUses, description } = req.body as {
    customerId?: string; type?: string; value?: number; duration?: string; maxUses?: number; description?: string;
  };
  if (!customerId || !type || value === undefined) return badRequest(res, "customerId, type, and value are required");

  const customers = await (await import("../db.ts")).customerRepo.findByWorkspace(ws.id);
  const customer = customers.find((c: any) => c.id === customerId);
  if (!customer) return notFound(res, "Customer");

  const discount = await discountRepo.create(null as any, {
    id: "disc_" + genId(),
    customerId,
    type: type as any,
    value: toNum(value, 0),
    duration: (duration ?? "once") as any,
    maxUses: maxUses ?? 1,
    description,
  });

  await writeAuditLog(ws.id, "System", "CREATE", "DISCOUNT", discount.id, null, discount);
  res.status(201).json(discount);
}));

router.delete("/discounts/:id", asyncHandler(async (req, res) => {
  const discount = await discountRepo.findById(null as any, req.params.id);
  if (!discount) return notFound(res, "Discount");

  const ws = await resolveWorkspace(req);
  await writeAuditLog(ws.id, "System", "DELETE", "DISCOUNT", discount.id, null, null);
  await discountRepo.softDelete(null as any, discount.id);
  res.json({ deleted: true, id: discount.id });
}));

router.get("/coupons", asyncHandler(async (req, res) => {
  const coupons = await couponRepo.findAll(null as any);
  res.json(coupons);
}));

router.post("/coupons", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { code, discountType, discountValue, maxRedemptions, expiresAt, description } = req.body as {
    code?: string; discountType?: string; discountValue?: number; maxRedemptions?: number; expiresAt?: string; description?: string;
  };
  if (!code || !discountType || discountValue === undefined) return badRequest(res, "code, discountType, and discountValue are required");

  const existing = await couponRepo.findByCode(null as any, code);
  if (existing) return conflict(res, `Coupon with code '${code}' already exists`);

  const coupon = await couponRepo.create(null as any, {
    id: "coup_" + genId(),
    code: code.toUpperCase(),
    discountType: discountType as any,
    discountValue: toNum(discountValue, 0),
    maxRedemptions: maxRedemptions ?? 0,
    expiresAt,
    description,
  });

  await writeAuditLog(ws.id, "System", "CREATE", "COUPON", coupon.id, null, coupon);
  res.status(201).json(coupon);
}));

router.delete("/coupons/:id", asyncHandler(async (req, res) => {
  const coupon = await couponRepo.findById(null as any, req.params.id);
  if (!coupon) return notFound(res, "Coupon");

  const ws = await resolveWorkspace(req);
  await writeAuditLog(ws.id, "System", "DELETE", "COUPON", coupon.id, null, null);
  await couponRepo.softDelete(null as any, coupon.id);
  res.json({ deleted: true, id: coupon.id });
}));

router.post("/coupons/validate", asyncHandler(async (req, res) => {
  const { code, customerId } = req.body as { code?: string; customerId?: string };
  if (!code) return badRequest(res, "code is required");

  const coupon = await couponRepo.findByCode(null as any, code.toUpperCase());
  if (!coupon) return notFound(res, "Coupon");

  if (coupon.status === "archived" || coupon.status === "expired") {
    return conflict(res, `Coupon '${code}' is ${coupon.status}`);
  }

  if (coupon.maxRedemptions > 0 && coupon.redemptionCount >= coupon.maxRedemptions) {
    return conflict(res, `Coupon '${code}' has reached maximum redemptions`);
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return conflict(res, `Coupon '${code}' has expired`);
  }

  res.json({ valid: true, coupon: { ...coupon, id: undefined, workspace_id: undefined } });
}));

export default router;
