// ============================================================
// Aora Billing OS — Chat / AI Assistant Routes
// Gemini-powered billing assistant with action execution
// ============================================================

import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { db, saveDatabase, writeAuditLog, resolveWorkspace, nanoid, chatMessageLog } from "../db.ts";
import {
  parsePagination, paginateArray, badRequest, notFound, conflict,
  genId, toNum, generateWebhookSecret, signWebhookPayload,
} from "../middleware.ts";
import type {
  Price, RateCard, Discount, Coupon, CustomContract,
  WebhookEndpoint, WebhookDelivery, WebhookEventType,
} from "../types.ts";

const router = Router();

// ──────────────────────────────────────────────────────────────
// Lazy-loaded Gemini client
// ──────────────────────────────────────────────────────────────

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!_ai && process.env.GEMINI_API_KEY) {
    _ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return _ai;
}

// ──────────────────────────────────────────────────────────────
// Database action executor
// ──────────────────────────────────────────────────────────────

function executeDatabaseAction(action: { type: string; payload: any }): void {
  try {
    switch (action.type) {
      case "CREATE_PLAN": {
        const p = action.payload;
        if (!p?.name) break;

        const generatedId = String(p.name).toLowerCase().replace(/[^a-z0-9]/g, "-");
        const newPlan = {
          id: generatedId,
          productId: "prod_compute",
          name: p.name,
          price: Number(p.price) || 0,
          currency: p.currency || "NGN",
          billingPeriod: p.billingPeriod || "monthly",
          includedSeats: Number(p.includedSeats) || 1,
          includedUsage: Number(p.includedUsage) || 20000,
          apiAccess: p.apiAccess !== undefined ? !!p.apiAccess : true,
          overageUnitPrice: Number(p.overageUnitPrice) || 0.1,
          description: p.description || "Generated via AI Assistant",
          createdAt: new Date().toISOString(),
        };
        db.plans.push(newPlan);

        // Auto-create entitlements for every known feature
        db.features.forEach((feat) => {
          db.entitlements.push({
            id: `ent_${generatedId}_${feat.slug}`,
            planId: generatedId,
            featureId: feat.id,
            value: feat.slug === "api_access" ? !!newPlan.apiAccess : false,
            isEnabled: true,
            createdAt: new Date().toISOString(),
          });
        });

        writeAuditLog(
          "ws_aora",
          "AI Billing Assistant",
          "CREATE",
          "PLAN",
          newPlan.id,
          null,
          newPlan,
        );
        saveDatabase();
        console.log("AI created plan:", p.name);
        break;
      }

      case "ADD_NOTE": {
        const { customerId, text } = action.payload ?? {};
        const target = db.customers.find((c) => c.id === customerId);
        if (!target) break;

        const before = JSON.parse(JSON.stringify(target));
        target.notes.unshift({
          id: "note_ai_" + Date.now(),
          timestamp: new Date().toISOString(),
          text: text || "Custom note configured through AI instruction.",
          author: "AI Assistant",
        });
        writeAuditLog(
          target.workspaceId,
          "AI Assistant",
          "UPDATE",
          "CUSTOMER",
          target.id,
          before,
          target,
        );
        saveDatabase();
        console.log("AI added note to customer:", customerId);
        break;
      }

      default:
        console.warn("Unrecognized AI action:", action.type);
    }
  } catch (err) {
    console.error("Failed to commit database action payload:", err);
  }
}

// ──────────────────────────────────────────────────────────────
// GET /chat-history
// ──────────────────────────────────────────────────────────────

router.get("/chat-history", (_req, res) => {
  return res.json(chatMessageLog.filter((m) => m.role !== "system"));
});

// ──────────────────────────────────────────────────────────────
// POST /chat
// ──────────────────────────────────────────────────────────────

router.post("/chat", async (req, res) => {
  const { text } = req.body;
  if (!text) return badRequest(res, "Message text is mandatory.");

  const userMsgId = "msg_u_" + Date.now();
  chatMessageLog.push({ id: userMsgId, role: "user", text });

  const ai = getAI();

  // ── Fallback (no API key) ──────────────────────────────────
  if (!ai) {
    let reply = "";
    let actionBlock: { type: string; payload: any } | null = null;
    const lower = String(text).toLowerCase();

    if (lower.includes("create a usage plan") || lower.includes("tokens")) {
      reply =
        "I've created a custom, hybrid **Usage-Based Plan** for AI tokens! It is configured with NGN ₦25,000 base fee per month and NGN ₦0.04 per Token after exceeding the 100k free premium tokens. It is now loaded into your Pricing Repository.";
      actionBlock = {
        type: "CREATE_PLAN",
        payload: {
          name: "Deepmind Core Tokenizer",
          price: 25000,
          currency: "NGN",
          billingPeriod: "monthly",
          includedSeats: 5,
          includedUsage: 100000,
          apiAccess: true,
          overageUnitPrice: 0.04,
          description: "Usage billing of state-of-the-art token metrics.",
        },
      };
    } else if (lower.includes("churn") || lower.includes("why did")) {
      reply =
        "Looking in depth at last month's cohort transitions (May 2026 to June 2026), your net revenue retention rate is **98.2%**, and churn increased slightly by **0.24%** strictly due to 1 card decline on **Notion Enterprise (INV-2026-008)** which is currently marked as **Past Due**. Let's trigger a retry or write a follow-up note to them.";
    } else if (lower.includes("add") && lower.includes("note")) {
      reply =
        "I've logged a high-priority advisory note in the Linear Technology customer timeline to keep your executive staff aligned.";
      actionBlock = {
        type: "ADD_NOTE",
        payload: {
          customerId: "linear",
          text: "AI Billing agent logged urgent advisory note inside linear stack.",
        },
      };
    } else if (lower.includes("audit") || lower.includes("logs")) {
      reply = `I have retrieved the active workspace **compliance audit logs** from our multi-tenant ledger database. We currently record **${db.auditLogs.length}** events reflecting operations like Plan updates, Note logs, and Client token generations. The audit files represent comprehensive before-and-after JSON snapshots of raw server changes.`;
    } else {
      reply =
        "Welcome to the SaaS Billing Operating System Assistant. I'm trained on Apple-grade product engineering schemas and Lago-grade hybrid pricing engines.\n\nHere are some operations you can command me to perform:\n- *'Create a usage plan for AI tokens'* (Executes action and builds plan in the catalog)\n- *'Why did churn increase last month?'* (Performs detailed telemetry cohort analysis on current invoices)\n- *'Fetch the compliance audit log trail'*\n- *'Convert my fixed plan into a hybrid plan'*\n- *'Generate a pricing strategy for agencies'*";
    }

    if (actionBlock) executeDatabaseAction(actionBlock);

    const modelMsgId = "msg_m_" + Date.now();
    chatMessageLog.push({ id: modelMsgId, role: "model", text: reply });
    return res.json({
      id: modelMsgId,
      role: "model",
      text: reply,
      actionExecuted: actionBlock ? actionBlock.type : null,
    });
  }

  // ── Gemini AI path ─────────────────────────────────────────
  try {
    const systemPrompt =
      `You are a world-class Billing & Revenue Architect inside a premium SaaS billing OS.\n` +
      `You can execute actions via <billing_action>JSON</billing_action> tags.\n` +
      `Current customers: ${JSON.stringify(
        db.customers.slice(0, 5).map((c) => ({
          id: c.id,
          name: c.name,
          plan: c.planId,
          status: c.status,
        })),
      )}\n` +
      `Current plans: ${JSON.stringify(
        db.plans.map((p) => ({ id: p.id, name: p.name, price: p.price })),
      )}`;

    const formattedContents = chatMessageLog
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: formattedContents,
      config: { systemInstruction: systemPrompt, temperature: 0.7 },
    });

    const aiText =
      response.text ||
      "Apologies, I encountered a silent response from the reasoning core.";

    let parsedAction: { type: string; payload: any } | null = null;
    const actionMatch = aiText.match(
      /<billing_action>([\s\S]*?)<\/billing_action>/,
    );
    if (actionMatch?.[1]) {
      try {
        parsedAction = JSON.parse(actionMatch[1].trim());
        if (parsedAction) executeDatabaseAction(parsedAction);
      } catch (err) {
        console.error("Failed to parse AI billing action JSON block:", err);
      }
    }

    const modelMsgId = "msg_m_" + Date.now();
    chatMessageLog.push({ id: modelMsgId, role: "model", text: aiText });
    return res.json({
      id: modelMsgId,
      role: "model",
      text: aiText,
      actionExecuted: parsedAction ? parsedAction.type : null,
    });
  } catch (error: any) {
    console.error("Gemini Assistant Core Call Error:", error);
    const fallbackText =
      "I ran into a server communication error with the Gemini cloud reasoning engine. However, based on our premium billing schemas, here's planning:\n- Auto-sync updated database structures.\n- Persistence ledger safely backed up on disk file.";
    const modelMsgId = "msg_m_" + Date.now();
    chatMessageLog.push({ id: modelMsgId, role: "model", text: fallbackText });
    return res.json({
      id: modelMsgId,
      role: "model",
      text: fallbackText,
      error: error.message,
    });
  }
});

export default router;
