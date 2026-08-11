// ============================================================
// AES-256-GCM Encryption for Gateway API Keys (Legacy Wrapper)
//
// Delegates to the EncryptionService. Exists for backward
// compatibility with existing gateway routes. New code should
// import EncryptionService directly from encryption-service.ts.
//
// The "iv:tag:ciphertext" colon-delimited format used by the
// old encrypt/decrypt functions is still supported here for
// reading legacy gateway_connections rows.
// ============================================================

import { encryptionService, SecurityError } from "./encryption-service.ts";

// ── Backward-compatible helpers ───────────────────────────

/**
 * Encrypt a plaintext and return "iv:tag:ciphertext" hex format.
 *
 * @deprecated Use encryptionService.encrypt() directly.
 */
export function encrypt(plaintext: string): string {
  const result = encryptionService.encrypt(plaintext);
  // Map to old colon-delimited hex format for backward compat
  const ivHex = Buffer.from(result.iv, "base64").toString("hex");
  const tagHex = Buffer.from(result.tag, "base64").toString("hex");
  const cipherHex = Buffer.from(result.ciphertext, "base64").toString("hex");
  return `${ivHex}:${tagHex}:${cipherHex}`;
}

/**
 * Decrypt a "iv:tag:ciphertext" hex format string.
 *
 * @deprecated Use encryptionService.decrypt() directly.
 */
export function decrypt(compound: string): string {
  const parts = compound.split(":");
  if (parts.length !== 3) {
    throw new SecurityError(
      "Invalid encrypted format: expected 3 colon-separated hex parts",
    );
  }
  const [ivHex, tagHex, cipherHex] = parts;

  // Convert from hex to base64 for the new service
  const ivB64 = Buffer.from(ivHex, "hex").toString("base64");
  const tagB64 = Buffer.from(tagHex, "hex").toString("base64");
  const cipherB64 = Buffer.from(cipherHex, "hex").toString("base64");

  const result = encryptionService.decryptParts(cipherB64, ivB64, tagB64);
  return result.plaintext;
}

/**
 * Return a safe display preview of an API key (last 4 chars).
 * Never returns the full key.
 */
export function previewKey(apiKey: string): string {
  const cleaned = apiKey.replace(/^sk_(live|test)_/, "");
  return cleaned.length > 4
    ? "..." + cleaned.slice(-4)
    : "..." + cleaned;
}
