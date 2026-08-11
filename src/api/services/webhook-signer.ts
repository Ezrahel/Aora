// ============================================================
// Secure Webhook HMAC-SHA256 Signing Utility
//
// Every outgoing webhook payload is signed with the merchant's
// unique webhook secret using HMAC-SHA256. The signature header
// format follows Stripe's convention:
//
//   X-AoraHQ-Signature: t=1719300000,v1=sha256_hash
//
// The merchant verifies the signature to confirm the webhook
// originated from AoraHQ and has not been tampered with.
// The timestamp in the signature prevents replay attacks —
// merchants should reject signatures older than N minutes.
// ============================================================

import crypto from "node:crypto";

const ALGORITHM = "sha256";
const SIGNATURE_VERSION = "v1";
const SECRET_PREFIX = "whsec_";

// ── Types ──────────────────────────────────────────────────

export interface SignatureHeader {
  /** The full header value: "t=1719300000,v1=abc123..." */
  header: string;
  /** Unix epoch seconds when the signature was generated */
  timestamp: number;
  /** The hex-encoded HMAC-SHA256 signature */
  signature: string;
}

// ── Signer ─────────────────────────────────────────────────

export class WebhookSigner {
  /**
   * Generate a cryptographically secure random webhook secret.
   *
   * Format: whsec_{32 hex chars} = 128 bits of entropy
   * This is what the merchant configures in their webhook
   * endpoint settings and uses to verify incoming signatures.
   */
  static generateSecret(): string {
    const entropy = crypto.randomBytes(16).toString("hex");
    return `${SECRET_PREFIX}${entropy}`;
  }

  /**
   * Sign a JSON-serializable payload for webhook delivery.
   *
   * The signature is computed as:
   *   HMAC-SHA256(secret, timestamp + "." + payload)
   *
   * @param secret  - The merchant's webhook secret (whsec_...)
   * @param payload - The JSON-serializable event payload
   * @returns SignatureHeader with the formatted header value
   */
  static sign(
    secret: string,
    payload: Record<string, unknown>,
  ): SignatureHeader {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadStr = JSON.stringify(payload);
    const signedPayload = `${timestamp}.${payloadStr}`;

    const hmac = crypto.createHmac(ALGORITHM, secret);
    hmac.update(signedPayload, "utf-8");
    const signature = hmac.digest("hex");

    return {
      header: `t=${timestamp},${SIGNATURE_VERSION}=${signature}`,
      timestamp,
      signature,
    };
  }

  /**
   * Sign a raw string payload (when the payload has already
   * been serialized or needs exact byte-for-byte signing).
   */
  static signRaw(
    secret: string,
    payloadStr: string,
    timestamp?: number,
  ): SignatureHeader {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const signedPayload = `${ts}.${payloadStr}`;

    const hmac = crypto.createHmac(ALGORITHM, secret);
    hmac.update(signedPayload, "utf-8");
    const signature = hmac.digest("hex");

    return {
      header: `t=${ts},${SIGNATURE_VERSION}=${signature}`,
      timestamp: ts,
      signature,
    };
  }

  /**
   * Verify a received webhook signature (useful for testing).
   *
   * @param secret     - The merchant's webhook secret
   * @param payload    - The raw JSON payload string
   * @param header     - The X-AoraHQ-Signature header value
   * @param toleranceMs - Max age in ms for replay protection (default 5 min)
   * @returns true if the signature is valid and not expired
   */
  static verify(
    secret: string,
    payloadStr: string,
    header: string,
    toleranceMs: number = 300_000,
  ): boolean {
    const parsed = WebhookSigner.parseHeader(header);
    if (!parsed) return false;

    // Replay protection: check timestamp is within tolerance
    const now = Date.now();
    const headerTime = parsed.timestamp * 1000;
    if (Math.abs(now - headerTime) > toleranceMs) {
      return false;
    }

    // Recompute signature
    const expected = WebhookSigner.signRaw(secret, payloadStr, parsed.timestamp);

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(expected.signature, "hex"),
      Buffer.from(parsed.signature, "hex"),
    );
  }

  /**
   * Parse a signature header value into its components.
   *
   * Input:  "t=1719300000,v1=abc123def456"
   * Output: { timestamp: 1719300000, version: "v1", signature: "abc123def456" }
   */
  static parseHeader(
    header: string,
  ): { timestamp: number; version: string; signature: string } | null {
    const parts = header.split(",");
    if (parts.length < 2) return null;

    let timestamp = 0;
    let version = "";
    let signature = "";

    for (const part of parts) {
      const [key, ...rest] = part.split("=");
      const value = rest.join("=");
      if (key === "t") {
        timestamp = parseInt(value, 10);
      } else if (key.startsWith("v")) {
        version = key;
        signature = value;
      }
    }

    if (!timestamp || !signature) return null;

    return { timestamp, version, signature };
  }
}
