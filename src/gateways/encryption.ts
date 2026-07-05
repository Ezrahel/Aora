// ============================================================
// AES-256-GCM Encryption for Gateway API Keys
// Keys are encrypted at rest in CockroachDB, never logged or
// returned in API responses.
// ============================================================

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyHex = process.env.GATEWAY_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'GATEWAY_ENCRYPTION_KEY must be set to 32 bytes (64 hex chars). ' +
      'Generate one with: openssl rand -hex 32'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a plaintext API key. Returns "iv:tag:ciphertext" hex format.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a ciphertext string in "iv:tag:ciphertext" hex format.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format: expected 3 colon-separated hex parts');
  }
  const [ivHex, tagHex, encryptedHex] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Return a safe display preview of an API key (last 4 chars).
 * Never returns the full key.
 */
export function previewKey(apiKey: string): string {
  const cleaned = apiKey.replace(/^sk_(live|test)_/, '');
  return cleaned.length > 4
    ? '...' + cleaned.slice(-4)
    : '...' + cleaned;
}
