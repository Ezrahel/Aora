// ============================================================
// Encrypted Gateway Repository
//
// Provides a secure database access layer for merchant gateway
// credentials. Plaintext keys are NEVER written to the database.
// Instead, they are encrypted with AES-256-GCM before INSERT,
// and only decrypted in-memory when needed for operations.
//
// The three cryptographic primitives (ciphertext, iv, tag) are
// stored in separate columns for auditability — each column has
// a distinct semantic meaning and can be validated independently.
//
// Memory Safety Contract:
//   After calling getDecryptedKey(), the caller MUST call
//   credential.wipe() after the gateway request completes.
// ============================================================

import { query, withTransaction } from "../api/db/pool.ts";
import { encryptionService, WipeableBuffer, SecurityError } from "./encryption-service.ts";

// ── Types ──────────────────────────────────────────────────

export interface TenantGatewayRow {
  id: string;
  workspaceId: string;
  gateway: string;
  mode: "live" | "test";
  encryptedSecretKey: string;
  encryptionIv: string;
  encryptionTag: string;
  encryptedWebhookSecret: string | null;
  webhookIv: string | null;
  webhookTag: string | null;
  gatewayAccountId: string | null;
  gatewayAccountName: string | null;
  gatewayAccountEmail: string | null;
  isVerified: boolean;
  lastVerifiedAt: string | null;
  keyPreview: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantGatewayInput {
  workspaceId: string;
  gateway: string;
  mode: "live" | "test";
  /** The raw plaintext API key (encrypted before INSERT) */
  plaintextApiKey: string;
  /** Optional raw plaintext webhook secret (encrypted before INSERT) */
  plaintextWebhookSecret?: string;
  gatewayAccountId?: string;
  gatewayAccountName?: string;
  gatewayAccountEmail?: string;
  isVerified?: boolean;
  lastVerifiedAt?: string;
}

export interface DecryptedCredential {
  /** The decrypted secret key. WIPE AFTER USE. */
  secretKey: string;
  /** Wipeable buffer — call .wipe() when done */
  secretKeyBuffer: WipeableBuffer;
  /** Optional decrypted webhook secret. WIPE AFTER USE. */
  webhookSecret: string | null;
  /** Optional wipeable buffer for webhook secret */
  webhookBuffer: WipeableBuffer | null;
  /** The full gateway row metadata */
  row: TenantGatewayRow;
}

// ── Preview Helpers ───────────────────────────────────────

/**
 * Return a safe preview of an API key (last 4 chars).
 * Never returns the full key in any context (logs, API responses, etc.)
 */
export function previewKey(apiKey: string): string {
  const cleaned = apiKey.replace(/^sk_(live|test)_/, "");
  return cleaned.length > 4 ? "..." + cleaned.slice(-4) : "..." + cleaned;
}

// ── Repository ────────────────────────────────────────────

export class EncryptedGatewayRepository {
  /**
   * Create a new gateway connection.
   *
   * The plaintext API key is encrypted before touching the
   * database. If an encryption step fails, the entire operation
   * is rolled back.
   */
  async create(input: CreateTenantGatewayInput): Promise<TenantGatewayRow> {
    // 1. Encrypt the API key
    const apiKeyEncrypted = encryptionService.encrypt(input.plaintextApiKey);

    // 2. Optionally encrypt the webhook secret
    let webhookEncrypted:
      | { ciphertext: string; iv: string; tag: string }
      | null = null;
    if (input.plaintextWebhookSecret) {
      webhookEncrypted = encryptionService.encrypt(input.plaintextWebhookSecret);
    }

    const keyPreview = previewKey(input.plaintextApiKey);

    try {
      const { rows } = await query(
        `INSERT INTO tenant_gateways (
          workspace_id, gateway, mode,
          encrypted_secret_key, encryption_iv, encryption_tag,
          encrypted_webhook_secret, webhook_iv, webhook_tag,
          gateway_account_id, gateway_account_name, gateway_account_email,
          is_verified, last_verified_at, key_preview,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15,
          now(), now()
        ) RETURNING *`,
        [
          input.workspaceId,
          input.gateway,
          input.mode,
          apiKeyEncrypted.ciphertext,
          apiKeyEncrypted.iv,
          apiKeyEncrypted.tag,
          webhookEncrypted?.ciphertext ?? null,
          webhookEncrypted?.iv ?? null,
          webhookEncrypted?.tag ?? null,
          input.gatewayAccountId ?? null,
          input.gatewayAccountName ?? null,
          input.gatewayAccountEmail ?? null,
          input.isVerified ?? false,
          input.lastVerifiedAt ?? null,
          keyPreview,
        ],
      );

      return mapRow(rows[0]);
    } catch (err) {
      throw new Error(
        `Failed to create encrypted gateway connection: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Find a gateway connection for a workspace.
   */
  async findByWorkspace(
    workspaceId: string,
    gateway?: string,
    mode?: "live" | "test",
  ): Promise<TenantGatewayRow[]> {
    const conditions: string[] = ["workspace_id = $1"];
    const params: unknown[] = [workspaceId];
    let idx = 2;

    if (gateway) {
      conditions.push(`gateway = $${idx++}`);
      params.push(gateway);
    }
    if (mode) {
      conditions.push(`mode = $${idx++}`);
      params.push(mode);
    }

    const { rows } = await query(
      `SELECT * FROM tenant_gateways WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      params,
    );

    return rows.map(mapRow);
  }

  /**
   * Find a single gateway connection by ID.
   */
  async findById(id: string): Promise<TenantGatewayRow | null> {
    const { rows } = await query(
      "SELECT * FROM tenant_gateways WHERE id = $1",
      [id],
    );
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  /**
   * Retrieve and decrypt a gateway credential for use.
   *
   * IMPORTANT: Call .wipe() on the buffers after use.
   *
   * @example
   *   const cred = await repo.getDecryptedKey(gatewayId);
   *   await stripeAdapter.chargeToken({ secretKey: cred.secretKey, ... });
   *   cred.secretKeyBuffer.wipe();
   *   cred.webhookBuffer?.wipe();
   */
  async getDecryptedKey(id: string): Promise<DecryptedCredential> {
    const row = await this.findById(id);
    if (!row) {
      throw new Error(`Gateway connection not found: ${id}`);
    }

    // Decrypt the API key
    const apiKeyDecrypted = encryptionService.decryptParts(
      row.encryptedSecretKey,
      row.encryptionIv,
      row.encryptionTag,
    );

    // Decrypt the webhook secret if present
    let webhookDecrypted: ReturnType<typeof encryptionService.decryptParts> | null = null;
    if (
      row.encryptedWebhookSecret &&
      row.webhookIv &&
      row.webhookTag
    ) {
      webhookDecrypted = encryptionService.decryptParts(
        row.encryptedWebhookSecret,
        row.webhookIv,
        row.webhookTag,
      );
    }

    return {
      secretKey: apiKeyDecrypted.plaintext,
      secretKeyBuffer: apiKeyDecrypted.buffer,
      webhookSecret: webhookDecrypted?.plaintext ?? null,
      webhookBuffer: webhookDecrypted?.buffer ?? null,
      row,
    };
  }

  /**
   * Verify that the stored encrypted credentials can still be
   * decrypted successfully. This is a health-check — it does
   * not expose the plaintext.
   *
   * Returns true if decryption succeeds, false if the data
   * appears corrupted or the key has changed.
   */
  async verifyDecryption(id: string): Promise<boolean> {
    try {
      const row = await this.findById(id);
      if (!row) return false;

      // Attempt decryption; will throw SecurityError on tag mismatch
      encryptionService.decryptParts(
        row.encryptedSecretKey,
        row.encryptionIv,
        row.encryptionTag,
      );

      // Also verify webhook secret if present
      if (row.encryptedWebhookSecret && row.webhookIv && row.webhookTag) {
        encryptionService.decryptParts(
          row.encryptedWebhookSecret,
          row.webhookIv,
          row.webhookTag,
        );
      }

      return true;
    } catch (err) {
      if (err instanceof SecurityError) {
        console.error("[EncryptedGatewayRepo] Data integrity check failed:", err.message);
      }
      return false;
    }
  }

  /**
   * Update the API key for an existing gateway connection.
   * The new key is encrypted before the UPDATE statement.
   */
  async updateApiKey(
    id: string,
    newPlaintextKey: string,
  ): Promise<TenantGatewayRow> {
    const encrypted = encryptionService.encrypt(newPlaintextKey);
    const keyPreview = previewKey(newPlaintextKey);

    const { rows } = await query(
      `UPDATE tenant_gateways SET
        encrypted_secret_key = $2,
        encryption_iv = $3,
        encryption_tag = $4,
        key_preview = $5,
        updated_at = now()
      WHERE id = $1
      RETURNING *`,
      [id, encrypted.ciphertext, encrypted.iv, encrypted.tag, keyPreview],
    );

    if (rows.length === 0) {
      throw new Error(`Gateway connection not found: ${id}`);
    }

    return mapRow(rows[0]);
  }

  /**
   * Delete a gateway connection.
   */
  async delete(id: string): Promise<boolean> {
    const { rowCount } = await query(
      "DELETE FROM tenant_gateways WHERE id = $1",
      [id],
    );
    return (rowCount ?? 0) > 0;
  }
}

// ── Row Mapper ─────────────────────────────────────────────

function mapRow(row: any): TenantGatewayRow {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    gateway: row.gateway,
    mode: row.mode,
    encryptedSecretKey: row.encrypted_secret_key,
    encryptionIv: row.encryption_iv,
    encryptionTag: row.encryption_tag,
    encryptedWebhookSecret: row.encrypted_webhook_secret ?? null,
    webhookIv: row.webhook_iv ?? null,
    webhookTag: row.webhook_tag ?? null,
    gatewayAccountId: row.gateway_account_id ?? null,
    gatewayAccountName: row.gateway_account_name ?? null,
    gatewayAccountEmail: row.gateway_account_email ?? null,
    isVerified: row.is_verified ?? false,
    lastVerifiedAt: row.last_verified_at ?? null,
    keyPreview: row.key_preview,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const encryptedGatewayRepository = new EncryptedGatewayRepository();
