// ============================================================
// Gateway Routes
// Connect/manage payment gateway connections and receive webhooks.
// ============================================================

// @ts-nocheck -- repository contract migration pending; tracked separately.
import { Router } from "express";
import {
  resolveWorkspace,
  writeAuditLog,
  genId,
  gatewayRepo,
  gatewayEventRepo,
  dunningRepo,
  customerRepo,
  invoiceRepo,
  subscriptionRepo,
  query,
} from "../db.ts";
import { asyncHandler, badRequest, notFound, parsePagination } from "../middleware.ts";
import { getAdapter, listAdapters, encrypt, decrypt, previewKey, validateKeyFormat } from "../../gateways/index.ts";

export const router = Router();
// Provider deliveries are mounted before dashboard session auth.  Keep this
// router restricted to signed inbound webhook endpoints only.
export const providerWebhookRouter = Router();

// ─────────────────────────────────────────────────────────────
// Connection Management
// ─────────────────────────────────────────────────────────────

/** List connected gateways for the workspace */
router.get("/gateways", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const gateways = await gatewayRepo.findByWorkspace(ws.id);
  res.json(gateways);
}));

/** Connect a payment gateway (validate format → encrypt → verify → store) */
router.post("/gateways/connect", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { gateway, apiKey, mode, webhookSecret } = req.body as {
    gateway?: string;
    apiKey?: string;
    mode?: string;
    webhookSecret?: string;
  };

  if (!gateway || !apiKey) {
    return badRequest(res, "gateway and apiKey are required");
  }
  if (!["stripe", "paystack", "flutterwave"].includes(gateway)) {
    return badRequest(res, `gateway must be one of: ${listAdapters().join(", ")}`);
  }
  const gwMode = mode === "live" ? "live" : "test";

  // 1. Validate key format locally
  const formatCheck = validateKeyFormat(gateway, apiKey);
  if (!formatCheck.valid) {
    return badRequest(res, formatCheck.error!);
  }

  // 2. Verify connection with the gateway API
  const adapter = getAdapter(gateway);
  const verifyResult = await adapter.verifyConnection(apiKey);
  if (!verifyResult.verified) {
    return res.status(422).json({
      error: "Gateway connection failed",
      detail: verifyResult.error || "Could not verify API key with the gateway",
      code: "GATEWAY_VERIFICATION_FAILED",
    });
  }

  // 3. Encrypt the key
  const encryptedKey = encrypt(apiKey);
  const encryptedSecret = webhookSecret ? encrypt(webhookSecret) : undefined;
  const keyPreview_ = previewKey(apiKey);

  // 4. Store the connection
  const conn = await gatewayRepo.create(null, {
    id: "gw_" + genId(),
    workspaceId: ws.id,
    gateway,
    mode: gwMode,
    encryptedApiKey: encryptedKey,
    encryptedWebhookSecret: encryptedSecret,
    keyPreview: keyPreview_,
  });

  // 5. Update verification fields
  await gatewayRepo.updateVerification(null, conn.id, {
    isVerified: true,
    accountId: verifyResult.accountId,
    accountName: verifyResult.accountName,
    accountEmail: verifyResult.accountEmail,
  });

  // 6. Reload to get updated record
  const updated = await gatewayRepo.findById(conn.id);
  await writeAuditLog(ws.id, "System", "CREATE", "WEBHOOK", conn.id, null, { gateway, mode: gwMode, accountName: verifyResult.accountName });

  res.status(201).json({
    ...updated,
    message: `${gateway} (${gwMode}) connected successfully as ${verifyResult.accountName || verifyResult.accountId}`,
  });
}));

/** Disconnect (remove) a gateway connection */
router.delete("/gateways/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const conn = await gatewayRepo.findById(req.params.id);
  if (!conn || conn.workspace_id !== ws.id) return notFound(res, "Gateway connection");
  await gatewayRepo.remove(null, conn.id);
  await writeAuditLog(ws.id, "System", "DELETE", "WEBHOOK", conn.id, conn, null);
  res.json({ deleted: true, id: conn.id, gateway: conn.gateway });
}));

/** Re-verify a gateway connection */
router.post("/gateways/:id/verify", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const conn = await gatewayRepo.findByWorkspaceAndGateway(ws.id, req.params.gateway || "", req.params.mode || "test");
  // Actually need to find by ID with key
  const connection = await gatewayRepo.findById(req.params.id);
  if (!connection) return notFound(res, "Gateway connection");
  if (connection.workspace_id !== ws.id) return notFound(res, "Gateway connection");

  // Re-fetch with encrypted key
  const fullConn = await gatewayRepo.findByWorkspaceAndGateway(ws.id, connection.gateway, connection.mode);
  if (!fullConn) return notFound(res, "Gateway connection");

  const apiKey = decrypt(fullConn.encrypted_api_key);
  const adapter = getAdapter(connection.gateway);
  const verifyResult = await adapter.verifyConnection(apiKey);

  await gatewayRepo.updateVerification(null, fullConn.id, {
    isVerified: verifyResult.verified,
    accountId: verifyResult.accountId,
    accountName: verifyResult.accountName,
    accountEmail: verifyResult.accountEmail,
  });

  await writeAuditLog(ws.id, "System", "ACCESS_VERIFY", "WEBHOOK", fullConn.id, null, { verified: verifyResult.verified });

  const updated = await gatewayRepo.findById(fullConn.id);
  if (!verifyResult.verified) {
    return res.status(422).json({ ...updated, error: verifyResult.error });
  }
  res.json(updated);
}));

/** Get live gateway account info */
router.get("/gateways/:id/account", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const conn = await gatewayRepo.findById(req.params.id);
  if (!conn || conn.workspace_id !== ws.id) return notFound(res, "Gateway connection");

  const fullConn = await gatewayRepo.findByWorkspaceAndGateway(ws.id, conn.gateway, conn.mode);
  if (!fullConn) return notFound(res, "Gateway connection");

  const apiKey = decrypt(fullConn.encrypted_api_key);
  const adapter = getAdapter(conn.gateway);
  const result = await adapter.verifyConnection(apiKey);

  res.json(result);
}));

// ─────────────────────────────────────────────────────────────
// Webhook Receivers
// ─────────────────────────────────────────────────────────────

const WEBHOOK_GATEWAY_MAP: Record<string, string> = {
  "stripe": "stripe",
  "paystack": "paystack",
  "flutterwave": "flutterwave",
};

/** Generic webhook handler used by all gateway endpoints */
async function handleIncomingWebhook(req, res, gatewayName: string) {
  const signatureHeader = (req.headers["stripe-signature"]
    || req.headers["x-paystack-signature"]
    || req.headers["verif-hash"]
    || req.headers["x-webhook-signature"]
    || "") as string;

  // Use exact raw bytes when available — re-serialization breaks Stripe HMAC.
  const rawBody: string = (req as any).rawBody ?? JSON.stringify(req.body);
  const adapter = getAdapter(gatewayName);

  // We need to figure out which workspace this webhook is for.
  // Gateways don't send workspace IDs, so we try to find it via the
  // gateway connection that has a matching secret, or we use a default.
  // For now, try each workspace that has this gateway connected.
  const { rows: connections } = await (await import("../db.ts")).query(
    "SELECT id, workspace_id, gateway, mode, encrypted_webhook_secret FROM gateway_connections WHERE gateway = $1",
    [gatewayName],
  );

  let matchedWs: string | null = null;
  let matchedConnId: string | null = null;
  let hasAnySecret = false;

  for (const conn of connections) {
    if (conn.encrypted_webhook_secret) {
      hasAnySecret = true;
      try {
        const secret = decrypt(conn.encrypted_webhook_secret);
        if (signatureHeader && adapter.verifyWebhookSignature(rawBody, signatureHeader, secret)) {
          matchedWs = conn.workspace_id;
          matchedConnId = conn.id;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (!matchedWs) {
    // Test-mode convenience: no webhook secrets configured anywhere and no
    // signature sent — accept under the single connection for local testing.
    if (!hasAnySecret && !signatureHeader && connections[0]?.workspace_id) {
      matchedWs = connections[0].workspace_id;
      console.warn(`[webhook] ${gatewayName}: no secrets configured, accepting unsigned test event.`);
    } else {
      // LIVE safety: never attribute an unverified webhook to another workspace.
      console.warn(`[webhook] Unverified ${gatewayName} signature — no matching workspace. Returning 401.`);
      return res.status(401).json({ received: false, error: "Invalid webhook signature", code: "INVALID_SIGNATURE" });
    }
  }

  // Map the webhook event
  const mapped = adapter.mapWebhookEvent(gatewayName, req.body);
  const eventId = req.body?.id || req.body?.data?.id || `webhook_${Date.now()}`;

  // Find customer ID if available from mapped data
  let customerId: string | null = null;
  if (mapped?.customerId) {
    // Try to find by gateway customer ID
    const { rows: subs } = await query(
      "SELECT customer_id FROM subscriptions WHERE gateway_customer_id = $1 LIMIT 1",
      [mapped.customerId],
    );
    if (subs[0]) customerId = subs[0].customer_id;
  }

  // Store the event
  const evt = await gatewayEventRepo.create({
    id: "gwe_" + genId(),
    workspaceId: matchedWs,
    gateway: gatewayName,
    eventType: mapped?.type || req.body?.type || req.body?.event || "unknown",
    gatewayEventId: mapped?.eventId || eventId,
    customerId,
    rawPayload: req.body,
    mappedData: mapped || undefined,
  });

  res.status(200).json({ received: true, eventId: evt.id });
}

providerWebhookRouter.post("/gateways/webhooks/stripe", asyncHandler(async (req, res) => {
  await handleIncomingWebhook(req, res, "stripe");
}));

providerWebhookRouter.post("/gateways/webhooks/paystack", asyncHandler(async (req, res) => {
  await handleIncomingWebhook(req, res, "paystack");
}));

providerWebhookRouter.post("/gateways/webhooks/flutterwave", asyncHandler(async (req, res) => {
  await handleIncomingWebhook(req, res, "flutterwave");
}));

// ─────────────────────────────────────────────────────────────
// Gateway Events
// ─────────────────────────────────────────────────────────────

/** List gateway events */
router.get("/gateways/events", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { gateway, eventType, status, from, to } = req.query as Record<string, string | undefined>;
  const pagination = parsePagination(req);

  const result = await gatewayEventRepo.findByWorkspace(ws.id, { gateway, eventType, status, from, to }, pagination.limit, pagination.offset);
  res.json({
    data: result.rows,
    total: result.total,
    page: pagination.page,
    limit: pagination.limit,
    hasMore: pagination.offset + pagination.limit < result.total,
  });
}));

/** Get a single gateway event */
router.get("/gateways/events/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const evt = await gatewayEventRepo.findById(req.params.id);
  if (!evt || evt.workspace_id !== ws.id) return notFound(res, "Gateway event");
  res.json(evt);
}));

/** Retry processing a failed gateway event */
router.post("/gateways/events/retry", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { eventId } = req.body as { eventId?: string };
  if (!eventId) return badRequest(res, "eventId is required");

  const evt = await gatewayEventRepo.findById(eventId);
  if (!evt || evt.workspace_id !== ws.id) return notFound(res, "Gateway event");
  if (evt.status !== "failed") return badRequest(res, `Cannot retry event with status '${evt.status}'`);

  await gatewayEventRepo.retryEvent(eventId);
  res.json({ retried: true, id: eventId });
}));

// ─────────────────────────────────────────────────────────────
// Reconciliation
// ─────────────────────────────────────────────────────────────

/** Revenue reconciliation: compare internal vs gateway revenue */
router.get("/gateways/reconciliation", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { from, to, customerId } = req.query as Record<string, string | undefined>;
  const periodStart = from || new Date(Date.now() - 30 * 86400000).toISOString();
  const periodEnd = to || new Date().toISOString();

  // Get customers in workspace
  const customers = await customerRepo.findByWorkspace(ws.id);

  // Filter by customer ID if specified
  const filteredCustomers = customerId
    ? customers.filter((c: any) => c.id === customerId)
    : customers;

  const reports = [];

  for (const cust of filteredCustomers.slice(0, 50)) { // limit to 50 customers
    // Internal usage for period
    const { rows: usageRows } = await query(
      `SELECT COALESCE(SUM(value), 0) AS total FROM usage_events
       WHERE customer_id = $1 AND timestamp >= $2 AND timestamp < $3`,
      [cust.id, periodStart, periodEnd],
    );
    const internalUsage = Number(usageRows[0]?.total || 0);

    // Internal invoices for period
    const { rows: invoiceRows } = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM invoices
       WHERE customer_id = $1 AND created_at >= $2 AND created_at < $3 AND status IN ('paid', 'open')`,
      [cust.id, periodStart, periodEnd],
    );
    const internalRevenue = Number(invoiceRows[0]?.total || 0);

    // Gateway events for this customer
    const { rows: gwRows } = await query(
      `SELECT COALESCE(SUM((mapped_data->>'amount')::numeric), 0) AS total, COUNT(*) AS count
       FROM gateway_events
       WHERE customer_id = $1 AND status = 'processed'
         AND event_type IN ('charge.success', 'charge.succeeded', 'charge.completed', 'invoice.payment_succeeded')
         AND created_at >= $2 AND created_at < $3`,
      [cust.id, periodStart, periodEnd],
    );
    const gatewayRevenue = Number(gwRows[0]?.total || 0);

    reports.push({
      customerId: cust.id,
      customerName: cust.name,
      internalUsage,
      internalRevenue,
      gatewayRevenue,
      variance: Math.abs(internalRevenue - gatewayRevenue),
      variancePercent: internalRevenue > 0
        ? Math.round((Math.abs(internalRevenue - gatewayRevenue) / internalRevenue) * 100 * 100) / 100
        : 0,
    });
  }

  const totals = reports.reduce((acc, r) => ({
    internalRevenue: acc.internalRevenue + r.internalRevenue,
    gatewayRevenue: acc.gatewayRevenue + r.gatewayRevenue,
    variance: acc.variance + r.variance,
  }), { internalRevenue: 0, gatewayRevenue: 0, variance: 0 });

  res.json({
    periodStart,
    periodEnd,
    totals,
    customers: reports,
  });
}));

// ─────────────────────────────────────────────────────────────
// Encrypted Gateway V2 Routes (Zero-Trust)
// Uses EncryptionService + EncryptedGatewayRepository with
// AES-256-GCM and in-memory credential lifecycle management.
// ─────────────────────────────────────────────────────────────

import { encryptedGatewayRepository, previewKey as encPreviewKey } from "../../gateways/encrypted-gateway-repository.ts";
import { encryptionService } from "../../gateways/encryption-service.ts";
import { getNonCustodialGateway } from "../../gateways/non-custodial-registry.ts";

/**
 * POST /gateways/v2/connect
 *
 * Connect a payment gateway with zero-trust encryption.
 * The plaintext API key is AES-256-GCM encrypted before the
 * INSERT statement touches the database. Only ciphertext, IV,
 * and auth tag are stored in tenant_gateways.
 *
 * Request body:
 *   { gateway, apiKey, mode?, webhookSecret? }
 *
 * Response: TenantGatewayRow (without any decrypted secrets)
 */
router.post("/gateways/v2/connect", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { gateway, apiKey, mode, webhookSecret } = req.body as {
    gateway?: string;
    apiKey?: string;
    mode?: string;
    webhookSecret?: string;
  };

  if (!gateway || !apiKey) {
    return badRequest(res, "gateway and apiKey are required");
  }

  const gwMode = mode === "live" ? "live" : "test";

  // 1. Verify the key with the gateway while it's still in memory
  const adapter = getAdapter(gateway);
  const verifyResult = await adapter.verifyConnection(apiKey);
  if (!verifyResult.verified) {
    return res.status(422).json({
      error: "Gateway connection failed",
      detail: verifyResult.error || "Could not verify API key with the gateway",
      code: "GATEWAY_VERIFICATION_FAILED",
    });
  }

  // 2. Encrypt and persist — at this point the plaintext key
  //    exists only in the local `apiKey` variable. It will be
  //    garbage collected after this function returns.
  const created = await encryptedGatewayRepository.create({
    workspaceId: ws.id,
    gateway,
    mode: gwMode,
    plaintextApiKey: apiKey,
    plaintextWebhookSecret: webhookSecret,
    isVerified: true,
    lastVerifiedAt: new Date().toISOString(),
    gatewayAccountId: verifyResult.accountId,
    gatewayAccountName: verifyResult.accountName,
    gatewayAccountEmail: verifyResult.accountEmail,
  });

  // 3. Return the row — decrypted fields are NEVER exposed
  await writeAuditLog(ws.id, "System", "CREATE", "GATEWAY", created.id, null, {
    gateway,
    mode: gwMode,
    accountName: verifyResult.accountName,
  });

  res.status(201).json({
    ...created,
    message: `${gateway} (${gwMode}) connected securely with zero-trust encryption`,
  });
}));

/**
 * GET /gateways/v2
 *
 * List encrypted gateway connections for the workspace.
 * Only safe metadata is returned (no decrypted keys).
 */
router.get("/gateways/v2", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const gateways = await encryptedGatewayRepository.findByWorkspace(ws.id);
  res.json(gateways);
}));

/**
 * GET /gateways/v2/:id
 *
 * Get a single encrypted gateway connection by ID.
 */
router.get("/gateways/v2/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const conn = await encryptedGatewayRepository.findById(req.params.id);
  if (!conn) return notFound(res, "Gateway connection");
  if (conn.workspaceId !== ws.id) return notFound(res, "Gateway connection");
  res.json(conn);
}));

/**
 * POST /gateways/v2/:id/charge
 *
 * Demonstrates the secure in-memory credential lifecycle:
 *
 *   1. Load encrypted row from DB
 *   2. Decrypt in memory (AES-256-GCM with auth tag verification)
 *   3. Use the plaintext key for the gateway API call
 *   4. Wipe the buffer immediately after
 *
 * This pattern should be followed by all billing workers that
 * need to use merchant gateway credentials.
 */
router.post("/gateways/v2/:id/charge", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { customerToken, paymentToken, amount, currency, description } = req.body as {
    customerToken?: string;
    paymentToken?: string;
    amount?: number;
    currency?: string;
    description?: string;
  };

  if (!customerToken || !paymentToken || !amount || !currency) {
    return badRequest(res, "customerToken, paymentToken, amount, and currency are required");
  }

  // 1. Load and decrypt — credential exists in memory now
  const credential = await encryptedGatewayRepository.getDecryptedKey(req.params.id);

  if (credential.row.workspaceId !== ws.id) {
    // Wipe before returning 404 to avoid leaking
    credential.secretKeyBuffer.wipe();
    credential.webhookBuffer?.wipe();
    return notFound(res, "Gateway connection");
  }

  try {
    // 2. Use the decrypted key for the gateway call via the non-custodial registry
    // (custodial PaymentGatewayAdapter has no chargeToken — live charges go here)
    const ncGateway = getNonCustodialGateway(credential.row.gateway);
    if (!ncGateway) {
      return badRequest(res, `No non-custodial adapter for gateway: ${credential.row.gateway}`);
    }
    const result = await ncGateway.chargeToken({
      secretKey: credential.secretKey,
      customerToken,
      paymentToken,
      amount: BigInt(amount),
      currency,
      description,
    });

    res.json(result);
  } finally {
    // 3. Wipe credentials from memory — ALWAYS runs, even on error
    credential.secretKeyBuffer.wipe();
    credential.webhookBuffer?.wipe();
  }
}));

/**
 * POST /gateways/v2/:id/re-verify
 *
 * Re-verify a gateway connection by decrypting the stored key
 * and testing it against the gateway API.
 */
router.post("/gateways/v2/:id/re-verify", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);

  const credential = await encryptedGatewayRepository.getDecryptedKey(req.params.id);

  if (credential.row.workspaceId !== ws.id) {
    credential.secretKeyBuffer.wipe();
    credential.webhookBuffer?.wipe();
    return notFound(res, "Gateway connection");
  }

  try {
    const adapter = getAdapter(credential.row.gateway);
    const verifyResult = await adapter.verifyConnection(credential.secretKey);

    // Update verification status
    await query(
      `UPDATE tenant_gateways SET
        is_verified = $2, last_verified_at = $3, updated_at = now()
      WHERE id = $1`,
      [req.params.id, verifyResult.verified, new Date().toISOString()],
    );

    await writeAuditLog(ws.id, "System", "ACCESS_VERIFY", "GATEWAY", req.params.id, null, {
      verified: verifyResult.verified,
    });

    res.json({ verified: verifyResult.verified, accountName: verifyResult.accountName });
  } finally {
    credential.secretKeyBuffer.wipe();
    credential.webhookBuffer?.wipe();
  }
}));

/**
 * DELETE /gateways/v2/:id
 *
 * Delete a gateway connection.
 */
router.delete("/gateways/v2/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const conn = await encryptedGatewayRepository.findById(req.params.id);
  if (!conn || conn.workspaceId !== ws.id) return notFound(res, "Gateway connection");

  const deleted = await encryptedGatewayRepository.delete(req.params.id);
  if (deleted) {
    await writeAuditLog(ws.id, "System", "DELETE", "GATEWAY", req.params.id, conn, null);
  }
  res.json({ deleted, id: req.params.id });
}));

/**
 * GET /gateways/v2/:id/health
 *
 * Health check that verifies stored encrypted credentials can
 * still be decrypted (tests key integrity without exposing it).
 */
router.get("/gateways/v2/:id/health", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const conn = await encryptedGatewayRepository.findById(req.params.id);
  if (!conn || conn.workspaceId !== ws.id) return notFound(res, "Gateway connection");

  const canDecrypt = await encryptedGatewayRepository.verifyDecryption(req.params.id);
  res.json({
    id: req.params.id,
    gateway: conn.gateway,
    mode: conn.mode,
    isVerified: conn.isVerified,
    canDecrypt,
    keyPreview: conn.keyPreview,
    healthy: canDecrypt && conn.isVerified,
  });
}));

/** Get connection details (registered last so fixed paths like
 *  /gateways/events, /gateways/reconciliation and /gateways/v2
 *  are matched before this :id route) */
router.get("/gateways/:id", asyncHandler(async (req, res) => {
  const conn = await gatewayRepo.findById(req.params.id);
  if (!conn) return notFound(res, "Gateway connection");
  const ws = await resolveWorkspace(req);
  if (conn.workspace_id !== ws.id) return notFound(res, "Gateway connection");
  res.json(conn);
}));

export default router;
