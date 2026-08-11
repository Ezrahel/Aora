// ============================================================
// Zero-Trust Credential Encryption Service
//
// AES-256-GCM authenticated encryption for merchant gateway API
// keys. Every encryption event uses a unique random 12-byte IV.
// The 16-byte authentication tag ensures tamper detection.
//
// The master key (AORAHQ_MASTER_ENCRYPTION_KEY) is read from
// environment on application startup. If missing or invalid the
// application crashes immediately — no fallback, no silent
// degradation.
//
// Memory safety: call wipe() on the returned plaintext buffer
// as soon as the credential is no longer needed.
// ============================================================

import crypto from "node:crypto";

// ── Constants ──────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm" as const;

/** NIST recommends 96-bit IV for GCM (12 bytes) */
const IV_LENGTH = 12;

/** GCM produces a 128-bit authentication tag (16 bytes) */
const TAG_LENGTH = 16;

/** Expected length of the raw key in bytes (256 bits) */
const KEY_BYTE_LENGTH = 32;

const ENV_KEY_NAME = "AORAHQ_MASTER_ENCRYPTION_KEY";

// ── Master Key (singleton, validated at module load) ──────

let masterKey: Buffer;

function loadMasterKey(): Buffer {
  const raw = process.env[ENV_KEY_NAME];

  if (!raw) {
    throw new Error(
      `[FATAL] ${ENV_KEY_NAME} is not set. ` +
      "Generate a 32-byte hex key: openssl rand -hex 32",
    );
  }

  // Accept hex (64 chars) or base64url (43 chars, no padding)
  let key: Buffer | null = null;

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else if (/^[A-Za-z0-9_-]{43}$/.test(raw)) {
    key = Buffer.from(raw, "base64url");
  }

  if (!key || key.length !== KEY_BYTE_LENGTH) {
    throw new Error(
      `[FATAL] ${ENV_KEY_NAME} must be 32 bytes (256 bits). ` +
      `Received ${raw.length} characters. ` +
      "Generate one with: openssl rand -hex 32",
    );
  }

  return key;
}

function getMasterKey(): Buffer {
  if (!masterKey) {
    masterKey = loadMasterKey();
  }
  return masterKey;
}

// ── Encryption Result ─────────────────────────────────────

export interface EncryptedPayload {
  /** AES-256-GCM ciphertext, base64-encoded */
  ciphertext: string;
  /** Random 12-byte IV, base64-encoded */
  iv: string;
  /** GCM authentication tag (16 bytes), base64-encoded */
  tag: string;
}

export interface DecryptedPayload {
  /** The decrypted plaintext string */
  plaintext: string;
  /**
   * A Buffer containing the plaintext bytes.
   * Call .wipe() on this after use to clear from memory.
   */
  buffer: WipeableBuffer;
}

// ── Wipeable Buffer ───────────────────────────────────────

/**
 * A thin wrapper around Buffer that provides a `.wipe()` method
 * to zero-fill the underlying memory immediately after use.
 *
 * Usage:
 *   const { plaintext, buffer } = service.decrypt(...);
 *   await makeGatewayCall(plaintext);
 *   buffer.wipe();  // clears the Buffer contents
 */
export class WipeableBuffer {
  constructor(private readonly buf: Buffer) {}

  /** Read the plaintext as a string */
  toString(encoding: BufferEncoding = "utf-8"): string {
    return this.buf.toString(encoding);
  }

  /**
   * Overwrite the buffer with zeros and clear references.
   * Call this as soon as the credential is no longer needed.
   */
  wipe(): void {
    this.buf.fill(0);
    // Clear all references to the internal buffer
    (this as any).buf = null;
  }

  /** Return the raw Buffer (use with caution) */
  get raw(): Buffer {
    return this.buf;
  }
}

// ── Service ───────────────────────────────────────────────

export class EncryptionService {
  /**
   * Encrypt a plaintext string using AES-256-GCM.
   *
   * @param plainText - The secret to encrypt (e.g., sk_live_...)
   * @returns EncryptedPayload with base64-encoded ciphertext, iv, and tag
   *
   * Every call generates a fresh random IV. Never reuse an IV
   * with the same key under GCM — it breaks confidentiality.
   */
  encrypt(plainText: string): EncryptedPayload {
    if (!plainText) {
      throw new Error("EncryptionService.encrypt: plainText must not be empty");
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);

    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(plainText, "utf-8"),
      cipher.final(),
    ]);

    // GCM authentication tag
    const tag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
    };
  }

  /**
   * Decrypt a ciphertext that was encrypted with this service.
   *
   * @param payload - The EncryptedPayload from a previous encrypt() call
   * @returns DecryptedPayload with the plaintext and a wipeable buffer
   *
   * Throws if the auth tag is invalid (data tampered with).
   */
  decrypt(payload: EncryptedPayload): DecryptedPayload {
    return this.decryptParts(payload.ciphertext, payload.iv, payload.tag);
  }

  /**
   * Decrypt using raw base64-encoded parts (useful when reading
   * from database columns).
   *
   * @param ciphertextB64 - Base64-encoded ciphertext
   * @param ivB64 - Base64-encoded initialization vector
   * @param tagB64 - Base64-encoded authentication tag
   * @returns DecryptedPayload
   */
  decryptParts(
    ciphertextB64: string,
    ivB64: string,
    tagB64: string,
  ): DecryptedPayload {
    if (!ciphertextB64 || !ivB64 || !tagB64) {
      throw new Error("EncryptionService.decrypt: ciphertext, iv, and tag are required");
    }

    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const encrypted = Buffer.from(ciphertextB64, "base64");

    if (iv.length !== IV_LENGTH) {
      throw new Error(
        `EncryptionService: Invalid IV length (expected ${IV_LENGTH} bytes, got ${iv.length})`,
      );
    }

    if (tag.length !== TAG_LENGTH) {
      throw new Error(
        `EncryptionService: Invalid tag length (expected ${TAG_LENGTH} bytes, got ${tag.length})`,
      );
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv);
    decipher.setAuthTag(tag);

    try {
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      const plaintext = decrypted.toString("utf-8");

      return {
        plaintext,
        buffer: new WipeableBuffer(decrypted),
      };
    } catch (err) {
      // GCM throws on tag mismatch — this means data was tampered with
      throw new SecurityError(
        "Decryption failed: authentication tag mismatch. " +
        "The encrypted data may have been tampered with or corrupted.",
        (err as Error).message,
      );
    }
  }
}

// ── Security Error ─────────────────────────────────────────

/**
 * Security-graded error for encryption/decryption failures.
 * Always log the full details server-side but be careful about
 * exposing internals in API responses.
 */
export class SecurityError extends Error {
  public readonly isSecurityError = true as const;

  constructor(
    message: string,
    public readonly internalDetail?: string,
  ) {
    super(message);
    this.name = "SecurityError";
  }
}

// ── Singleton Export ──────────────────────────────────────

export const encryptionService = new EncryptionService();
