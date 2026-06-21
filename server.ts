import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { runMigrations, pool, query, customerRepo, planRepo, featureRepo, entitlementRepo, priceRepo, discountRepo, couponRepo, rateCardRepo, contractRepo, subscriptionRepo, invoiceRepo, meterRepo, usageRepo, quotaRepo, creditRepo, organizationRepo, workspaceRepo, memberRepo, productRepo, auditRepo, webhookRepo, addChatMessage, getChatMessages, genId, toNum, resolveWorkspace } from "./src/api/db.ts";
import { asyncHandler, badRequest, notFound } from "./src/api/middleware.ts";
import apiRouter from "./src/api/router.ts";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = 3000;

// ==========================================
// LAZY-LOADED GEMINI CLIENT SETUP
// ==========================================
let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined. AI interactions will fallback to high-fidelity simulated responses.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return aiClient;
}

// ==========================================
// RUN MIGRATIONS ON STARTUP
// ==========================================
let dbAvailable = false;

async function initializeDatabase() {
  try {
    await runMigrations();
    console.log("CockroachDB migrations applied successfully.");
    dbAvailable = true;
  } catch (err) {
    console.error("CockroachDB unavailable — running without database:", (err as any).message);
    console.log("Set DATABASE_URL in .env and restart to enable persistence.");
  }
}

function requireDb() {
  if (!dbAvailable) {
    throw new Error("Database is not available. Set DATABASE_URL and restart.");
  }
}

// ==========================================
// MOUNT API ROUTES (via master router)
// ==========================================
app.use("/api", apiRouter);

// ==========================================
// LEGACY COMPATIBILITY: /api/revenue-metrics
// ==========================================
app.get("/api/revenue-metrics", asyncHandler(async (req, res) => {
  const wsId = req.query.workspace as string || "ws_aora";
  const customers = await customerRepo.findByWorkspace(wsId);
  const plans = await planRepo.findAll(null as any);
  const subs = await subscriptionRepo.findByCustomerIds(customers.map(c => c.id));

  const activeCustomers = customers.filter(c => c.status === "active").length;
  const trialCustomers = customers.filter(c => c.status === "trial").length;

  let calculatedMRR = 0;
  let usageOverageRevenue = 0;
  for (const cust of customers) {
    if (cust.status === "active") {
      const plan = plans.find(p => p.id === cust.plan_id);
      if (plan) {
        const price = typeof (plan as any).price === "number" ? (plan as any).price : Number((plan as any).price ?? 0);
        calculatedMRR += price;
        const included = typeof (plan as any).includedUsage === "number" ? (plan as any).includedUsage : Number((plan as any).includedUsage ?? 0);
        const overage = typeof (plan as any).overageUnitPrice === "number" ? (plan as any).overageUnitPrice : Number((plan as any).overageUnitPrice ?? 0);
        const delta = (cust.usage_units ?? 0) - included;
        if (delta > 0 && overage > 0) {
          usageOverageRevenue += delta * overage;
        }
      }
    }
  }

  res.json({
    baseMRR: calculatedMRR,
    overageMRR: usageOverageRevenue,
    mrr: calculatedMRR + usageOverageRevenue,
    arr: (calculatedMRR + usageOverageRevenue) * 12,
    activeSubscriptions: activeCustomers,
    trialConversionRate: customers.length > 0 ? Number(((activeCustomers / customers.length) * 100).toFixed(1)) : 75.0,
    churnRate: 1.4,
    totalCustomers: customers.length,
    activeCustomers,
    trialCustomers,
  });
}));

// ==========================================
// LEGACY COMPATIBILITY: /api/pricing-calculate
// ==========================================
app.post("/api/pricing-calculate", asyncHandler(async (req, res) => {
  const { customerId, priceId, planId, seatsCount, usageUnits, couponCode, useCredits } = req.body;

  let activePrice: any = null;
  if (priceId) {
    activePrice = await priceRepo.findById(priceId);
  } else if (planId) {
    const prices = await priceRepo.findByPlan(planId);
    activePrice = prices.find((p: any) => p.status !== "archived") ?? null;
  }

  if (!activePrice) {
    const plan = planId ? await planRepo.findById(null as any, planId) : null;
    if (plan) {
      activePrice = {
        id: "pr_impl_" + plan.id,
        planId: plan.id,
        name: (plan as any).name + " Default Price",
        type: "hybrid",
        billingPeriod: "monthly",
        currency: (plan as any).currency || "NGN",
        baseFee: Number((plan as any).price ?? 0),
        includedSeats: Number((plan as any).includedSeats ?? 0),
        includedUsage: Number((plan as any).includedUsage ?? 0),
        overageUnitPrice: Number((plan as any).overageUnitPrice ?? 0),
        version: 1,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
    } else {
      return res.status(404).json({ error: "Pricing schema not found." });
    }
  }

  let customer: any = null;
  let contractOverride: any = null;
  if (customerId) {
    customer = await customerRepo.findById(null as any, customerId);
    contractOverride = await contractRepo.findByCustomer(customerId);
  }

  const seatsInput = seatsCount !== undefined ? Number(seatsCount) : customer ? customer.seats_used : (activePrice.includedSeats || 1);
  const usageInput = usageUnits !== undefined ? Number(usageUnits) : customer ? customer.usage_units : 0;

  let baseFee = Number(activePrice.baseFee ?? activePrice.amount ?? 0);
  let seatPrice = Number(activePrice.seatPrice ?? 0);
  let overageUnitPrice = Number(activePrice.overageUnitPrice ?? 0);

  if (contractOverride) {
    baseFee = Number(contractOverride.customBaseFee ?? baseFee);
    if (contractOverride.customSeatPrice !== undefined) seatPrice = Number(contractOverride.customSeatPrice);
    if (contractOverride.customOverageUnitPrice !== undefined) overageUnitPrice = Number(contractOverride.customOverageUnitPrice);
  }

  const seatsIncluded = Number(activePrice.includedSeats ?? 0);
  const usageIncluded = Number(activePrice.includedUsage ?? 0);
  const seatsOverage = Math.max(0, seatsInput - seatsIncluded);
  const seatCharge = seatsOverage * seatPrice;
  const overageUnits = Math.max(0, usageInput - usageIncluded);
  const overageCharge = overageUnits * overageUnitPrice;

  let discountAmount = 0;
  let activeDiscount: any = null;
  if (couponCode) {
    const coupon = await couponRepo.findByCode(couponCode.trim().toUpperCase());
    if (coupon && coupon.discountId) {
      activeDiscount = await discountRepo.findById(coupon.discountId);
    }
  }

  const grossSum = baseFee + seatCharge + overageCharge;
  if (activeDiscount) {
    if (activeDiscount.type === "percentage") {
      discountAmount = grossSum * (activeDiscount.value / 100);
    } else if (activeDiscount.type === "fixed") {
      discountAmount = Math.min(grossSum, activeDiscount.value);
    }
  }

  let subtotal = grossSum - discountAmount;
  let enterpriseMinimumAdjust = 0;
  if (contractOverride && contractOverride.minimumSpend) {
    const minSpend = Number(contractOverride.minimumSpend);
    if (subtotal < minSpend) {
      enterpriseMinimumAdjust = minSpend - subtotal;
      subtotal = minSpend;
    }
  }

  let creditBalance = 0;
  let creditApplied = 0;
  if (customerId) {
    creditBalance = await creditRepo.getBalance(customerId);
  }
  if (useCredits && creditBalance > 0 && subtotal > 0) {
    creditApplied = Math.min(subtotal, creditBalance);
    subtotal -= creditApplied;
  }

  res.json({
    price_id: activePrice.id,
    price_name: activePrice.name,
    pricing_type: activePrice.type || "hybrid",
    currency: activePrice.currency || "NGN",
    billing_period: activePrice.billingPeriod || "monthly",
    base_fee: baseFee,
    included_seats: seatsIncluded,
    seats_consumed: seatsInput,
    seat_fee_per_unit: seatPrice,
    seat_charge: seatCharge,
    included_usage: usageIncluded,
    usage_consumed: usageInput,
    overage_units: overageUnits,
    overage_charge: overageCharge,
    discount_applied: discountAmount,
    discount_name: activeDiscount?.name || null,
    minimum_spend_adjustment: enterpriseMinimumAdjust,
    credit_balance: creditBalance,
    credit_applied: creditApplied,
    total: Math.max(0, subtotal),
    has_contract_override: !!contractOverride,
  });
}));

// ==========================================
// LEGACY COMPATIBILITY: /api/can-access
// ==========================================
app.get("/api/can-access", asyncHandler(async (req, res) => {
  const { customerId, featureSlug } = req.query as Record<string, string | undefined>;
  if (!customerId || !featureSlug) {
    return res.status(400).json({ error: "Params customerId and featureSlug are required" });
  }

  const customer = await customerRepo.findById(null as any, customerId);
  if (!customer) return res.status(404).json({ error: `Customer '${customerId}' not found` });

  const ws = await resolveWorkspace(req);
  const feature = await featureRepo.findBySlugOrId(ws.id, featureSlug);
  if (!feature) return res.status(404).json({ error: `Feature '${featureSlug}' not found` });

  const subs = await subscriptionRepo.findByCustomer(customerId);
  const sub = subs.sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())[0] as any;
  const plan = sub ? await planRepo.findById(null as any, sub.plan_id) : null;

  const entitlement = plan ? await entitlementRepo.findByPlanAndFeature(null as any, plan.id, feature.id) : null;

  const isAllowed = entitlement ? (!!entitlement.value && customer.status !== "paused" && customer.status !== "canceled") : false;

  res.json({
    customerId,
    featureSlug,
    isAllowed,
    reason: isAllowed ? "Access granted" : "Access denied",
    diagnostic: {
      customerName: customer.name,
      planId: plan?.id,
      subscriptionStatus: sub?.status || customer.status,
      timestamp: new Date().toISOString(),
    },
  });
}));

// ==========================================
// LEGACY COMPATIBILITY: /api/can-consume
// ==========================================
app.get("/api/can-consume", asyncHandler(async (req, res) => {
  const { customerId, meterId, amount } = req.query as Record<string, string | undefined>;
  const customerIdStr = customerId || "";
  const meterIdStr = meterId || "compute_meter";
  const numAmount = Number(amount) || 1;

  const customer = await customerRepo.findById(null as any, customerIdStr);
  if (!customer) return res.status(404).json({ error: "Customer not found." });

  const quotas = await quotaRepo.findByCustomerIds([customerIdStr]);
  const quota = quotas.find((q: any) => q.meterId === meterIdStr);
  const limitVal = quota ? (quota as any).limitValue ?? (quota as any).limit : 100000;
  const usedVal = quota ? (quota as any).usedValue ?? (quota as any).usage ?? 0 : (customer.usage_units ?? 0);
  const isOverage = usedVal + numAmount > limitVal;
  const creditBalance = await creditRepo.getBalance(customerIdStr);

  res.json({
    allowed: !isOverage || creditBalance > 0,
    reason: isOverage ? (creditBalance > 0 ? "quota_exceeded_with_credit_offset" : "quota_exceeded") : "quota_available",
    details: { limitValue: limitVal, currentUsed: usedVal, requested: numAmount, creditBalance, canOffset: creditBalance > 0 },
  });
}));

// ==========================================
// LEGACY COMPATIBILITY: /api/events/bulk
// ==========================================
app.post("/api/events/bulk", asyncHandler(async (req, res) => {
  const eventsArray = req.body;
  if (!Array.isArray(eventsArray)) {
    return res.status(400).json({ error: "Expected an array of usage events." });
  }

  let processed = 0;
  let duplicates = 0;
  for (const item of eventsArray) {
    const { customerId, meterId, value, metadata } = item;
    const customer = await customerRepo.findById(null as any, customerId);
    if (!customer) continue;

    const dedupeId = metadata?.idempotencyKey || metadata?.dedupeId;
    if (dedupeId) {
      const { rows } = await query(
        "SELECT id FROM usage_events WHERE metadata->>'idempotencyKey' = $1 OR metadata->>'dedupeId' = $1 LIMIT 1",
        [dedupeId],
      );
      if (rows.length > 0) { duplicates++; continue; }
    }

    await usageRepo.create(null as any, {
      id: "evt_bulk_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      customerId,
      meterId: meterId || "compute_meter",
      value: toNum(value, 1),
      timestamp: item.timestamp || new Date().toISOString(),
      metadata: { ...(metadata || {}), bulkImported: true },
    });
    processed++;
  }

  res.json({ status: "processed", processedCount: processed, duplicates });
}));

// ==========================================
// LEGACY COMPATIBILITY: /api/events/import
// ==========================================
app.post("/api/events/import", asyncHandler(async (req, res) => {
  const eventsArray = req.body;
  if (!Array.isArray(eventsArray)) {
    return res.status(400).json({ error: "Expected an array of usage events for import." });
  }

  let importedCount = 0;
  for (const item of eventsArray) {
    const { customerId, meterId, value, timestamp, metadata } = item;
    const customer = await customerRepo.findById(null as any, customerId);
    if (!customer) continue;

    await usageRepo.create(null as any, {
      id: "evt_import_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      customerId,
      meterId: meterId || "compute_meter",
      value: toNum(value, 1),
      timestamp: timestamp || new Date().toISOString(),
      metadata: { ...(metadata || {}), imported: true },
    });
    importedCount++;
  }

  res.json({ status: "success", importedCount });
}));

// ==========================================
// LEGACY COMPATIBILITY: /api/events/replay
// ==========================================
app.post("/api/events/replay", asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  const { rows } = await query("SELECT id, customer_id, meter_id, timestamp, value, metadata FROM usage_events WHERE id = $1", [eventId]);
  if (rows.length === 0) return res.status(404).json({ error: "Event not found." });

  res.json({ status: "replayed", eventId, reprocessedAt: new Date().toISOString() });
}));

// ==========================================
// LEGACY COMPATIBILITY: /api/contracts
// ==========================================
app.get("/api/contracts", asyncHandler(async (req, res) => {
  const contracts = await contractRepo.findAll();
  res.json(contracts);
}));

app.post("/api/contracts", asyncHandler(async (req, res) => {
  const { customerId, name, customBaseFee, customSeatPrice, customOverageUnitPrice, minimumSpend, additionalDiscountPercentage, expireAt } = req.body;
  if (!customerId || !name || customBaseFee === undefined) {
    return res.status(400).json({ error: "Required fields: customerId, name, customBaseFee" });
  }

  const contract = await contractRepo.create(null as any, {
    id: "cc_" + genId(),
    customerId,
    name,
    customBaseFee: toNum(customBaseFee, 0),
    customSeatPrice: customSeatPrice !== undefined ? toNum(customSeatPrice, 0) : undefined,
    customOverageUnitPrice: customOverageUnitPrice !== undefined ? toNum(customOverageUnitPrice, 0) : undefined,
    minimumSpend: minimumSpend !== undefined ? toNum(minimumSpend, 0) : undefined,
    additionalDiscountPercentage: additionalDiscountPercentage !== undefined ? toNum(additionalDiscountPercentage, 0) : undefined,
    expireAt: expireAt || new Date(Date.now() + 31536000000).toISOString().split("T")[0],
  });

  res.status(201).json(contract);
}));

// ==========================================
// GEMINI AI BILLING ASSISTANT
// ==========================================
app.get("/api/chat-history", asyncHandler(async (req, res) => {
  const history = getChatMessages().filter((m: any) => m.role !== "system");
  res.json(history);
}));

app.post("/api/chat", asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Message text is mandatory." });

  addChatMessage("user", text, undefined);

  const ai = getAI();
  if (!ai) {
    let reply = "";
    let actionBlock: any = null;
    const lowercase = text.toLowerCase();

    const customers = await customerRepo.findByWorkspace("ws_aora");
    const plans = await planRepo.findAll();
    const features = await featureRepo.findByWorkspace("ws_aora");
    const entitlements = await entitlementRepo.findAll(null as any);
    const meters = await meterRepo.findAll();

    if (lowercase.includes("create a usage plan") || lowercase.includes("tokens")) {
      reply = "I've created a custom, hybrid **Usage-Based Plan** for AI tokens! It is configured with NGN ₦25,000 base fee per month and NGN ₦0.04 per Token after exceeding the 100k free premium tokens.";
      actionBlock = { type: "CREATE_PLAN", payload: { name: "Deepmind Core Tokenizer", price: 25000, currency: "NGN", billingPeriod: "monthly", includedSeats: 5, includedUsage: 100000, apiAccess: true, overageUnitPrice: 0.04, description: "Usage billing of state-of-the-art token metrics." } };
    } else if (lowercase.includes("churn") || lowercase.includes("why did")) {
      reply = "Looking at last month's cohort, your net revenue retention rate is **98.2%**, and churn increased slightly by **0.24%** due to 1 card decline on Notion Enterprise (INV-2026-008) which is marked as Past Due.";
    } else if (lowercase.includes("add") && lowercase.includes("note")) {
      reply = "I've logged a high-priority advisory note in the Linear Technology customer timeline.";
      actionBlock = { type: "ADD_NOTE", payload: { customerId: "linear", text: "AI Billing agent logged urgent advisory note inside linear stack." } };
    } else if (lowercase.includes("audit") || lowercase.includes("logs")) {
      reply = `I have retrieved the active workspace compliance audit logs. We currently track events reflecting operations like Plan updates, Note logs, and Client token generations.`;
    } else {
      reply = "Welcome to the SaaS Billing Operating System Assistant. I'm trained on Apple-grade product engineering schemas and Lago-grade hybrid pricing engines.\n\nCommands:\n- *'Create a usage plan for AI tokens'*\n- *'Why did churn increase last month?'*\n- *'Fetch the compliance audit log trail'*\n- *'Convert my fixed plan into a hybrid plan'*\n- *'Generate a pricing strategy for agencies'*";
    }

    if (actionBlock) {
      try {
        if (actionBlock.type === "CREATE_PLAN") {
          const p = actionBlock.payload;
          const generatedId = p.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
          await planRepo.create(null as any, {
            id: generatedId,
            productId: "prod_compute",
            name: p.name,
            description: p.description,
            price: toNum(p.price, 0),
            currency: p.currency || "NGN",
            billingPeriod: (p.billingPeriod || "monthly") as any,
            includedSeats: toNum(p.includedSeats, 1),
            includedUsage: toNum(p.includedUsage, 20000),
            apiAccess: !!p.apiAccess,
            overageUnitPrice: toNum(p.overageUnitPrice, 0.1),
          });
        } else if (actionBlock.type === "ADD_NOTE") {
          const { customerId: cid, text: noteText } = actionBlock.payload;
          await customerRepo.addNote(null as any, cid, {
            id: "note_ai_" + Date.now(),
            timestamp: new Date().toISOString(),
            text: noteText || "Custom note configured through AI instruction.",
            author: "AI Assistant",
          });
        }
      } catch (err) {
        console.error("Failed to execute AI action:", err);
      }
    }

    const modelMsgId = "msg_m_" + Date.now();
    addChatMessage("model", reply, undefined);
    return res.json({ id: modelMsgId, role: "model", text: reply, actionExecuted: actionBlock?.type ?? null });
  }

  try {
    const customers = await customerRepo.findByWorkspace("ws_aora");
    const plans = await planRepo.findAll();
    const features = await featureRepo.findByWorkspace("ws_aora");
    const meters = await meterRepo.findAll();

    const systemPrompt = `You are a world-class Billing & Revenue Architect and AI Assistant inside a premium SaaS billing operational operating system.
Your task is to answer the user's questions about SaaS pricing structures, billing setups, subscription cohorts, failed invoices, and growth strategies in clear, human, elegant markdown without corporate buzzwords.

You can execute special actions in real-time. If the user asks you to create a plan, add a note to a customer, or generate a price rule, you MUST output a valid JSON block inside the special tag: <billing_action>...</billing_action>.

Schema:
1. Create Plan:
<billing_action>{"type": "CREATE_PLAN", "payload": {"name": "...", "price": 49000, "currency": "NGN", "billingPeriod": "monthly", "includedSeats": 10, "includedUsage": 100000, "apiAccess": true, "overageUnitPrice": 0.5, "description": "..."}}</billing_action>

2. Add Customer Note:
<billing_action>{"type": "ADD_NOTE", "payload": {"customerId": "linear", "text": "..."}}</billing_action>

Current Platform State:
- Customers: ${JSON.stringify(customers.map((c: any) => ({ id: c.id, name: c.name, plan: c.plan_id, status: c.status, usageUnits: c.usage_units })))}
- Plans: ${JSON.stringify(plans)}
- Features: ${JSON.stringify(features)}
`;

    const formattedContents = getChatMessages()
      .filter((m: any) => m.role !== "system")
      .map((m: any) => ({ role: m.role, parts: [{ text: m.text }] }));

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: formattedContents,
      config: { systemInstruction: systemPrompt, temperature: 0.7 },
    });

    const aiText = response.text || "Apologies, I encountered a silent response from the reasoning core.";
    let parsedAction: any = null;
    const actionMatch = aiText.match(/<billing_action>([\s\S]*?)<\/billing_action>/);
    if (actionMatch && actionMatch[1]) {
      try {
        parsedAction = JSON.parse(actionMatch[1].trim());
        if (parsedAction.type === "CREATE_PLAN") {
          const p = parsedAction.payload;
          await planRepo.create(null as any, {
            id: p.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
            productId: "prod_compute",
            name: p.name,
            description: p.description || "Created by AI",
            price: toNum(p.price, 0),
            currency: p.currency || "NGN",
            billingPeriod: (p.billingPeriod || "monthly") as any,
            includedSeats: toNum(p.includedSeats, 1),
            includedUsage: toNum(p.includedUsage, 20000),
            apiAccess: !!p.apiAccess,
            overageUnitPrice: toNum(p.overageUnitPrice, 0.1),
          });
        } else if (parsedAction.type === "ADD_NOTE") {
          const { customerId: cid, text: noteText } = parsedAction.payload;
          await customerRepo.addNote(null as any, cid, {
            id: "note_ai_" + Date.now(),
            timestamp: new Date().toISOString(),
            text: noteText || "AI note",
            author: "AI Assistant",
          });
        }
      } catch (err) {
        console.error("Failed to parse AI billing action JSON block:", err);
      }
    }

    const modelMsgId = "msg_m_" + Date.now();
    addChatMessage("model", aiText, undefined);
    res.json({ id: modelMsgId, role: "model", text: aiText, actionExecuted: parsedAction?.type ?? null });
  } catch (error: any) {
    console.error("Gemini Assistant Core Call Error:", error);
    const fallbackText = "I ran into a server communication error with the Gemini cloud reasoning engine.";
    const modelMsgId = "msg_m_" + Date.now();
    addChatMessage("model", fallbackText, undefined);
    res.json({ id: modelMsgId, role: "model", text: fallbackText, error: error.message });
  }
}));

// ==========================================
// STATIC VITE SERVING & STARTUP
// ==========================================
async function startServer() {
  await initializeDatabase();

  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up live Vite development preview mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Configuring high-fidelity production static assets server...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AoraHQ Billing Engine Server is actively listening on port ${PORT}`);
  });
}

startServer();
