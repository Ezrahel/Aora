// @ts-nocheck
import { Router } from "express";
import {
  resolveWorkspace,
  writeAuditLog,
  getChatMessages,
  addChatMessage,
} from "../db.ts";
import { asyncHandler, badRequest } from "../middleware.ts";

export const router = Router();

router.get("/chat/messages", asyncHandler(async (req, res) => {
  await resolveWorkspace(req);
  const messages = getChatMessages();
  res.json(messages);
}));

router.post("/chat/messages", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { role, content, metadata } = req.body as {
    role?: string; content?: string; metadata?: Record<string, unknown>;
  };
  if (!role || !content) return badRequest(res, "role and content are required");

  const message = addChatMessage(role as any, content, metadata);
  await writeAuditLog(ws.id, "System", "CREATE", "CHAT_MESSAGE", message.id, null, message);
  res.status(201).json(message);
}));

router.post("/chat/messages/batch", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { messages } = req.body as {
    messages?: Array<{ role: string; content: string; metadata?: Record<string, unknown> }>;
  };
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return badRequest(res, "messages array is required");
  }

  const added = messages.map((msg: any) => addChatMessage(msg.role, msg.content, msg.metadata));
  await writeAuditLog(ws.id, "System", "CREATE", "CHAT_MESSAGE", "batch", null, { count: added.length });
  res.status(201).json(added);
}));

export default router;
