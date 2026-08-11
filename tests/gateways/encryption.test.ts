// ============================================================
// Gateway Encryption Tests
// ============================================================

import { describe, it, expect, beforeAll, vi } from "vitest";
import { encrypt, decrypt, previewKey } from "../../src/gateways/encryption.ts";

// Set a fixed encryption key for tests
process.env.AORAHQ_MASTER_ENCRYPTION_KEY = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

describe("encryption", () => {
  it("should encrypt and decrypt a key correctly", () => {
    const original = "sk_test_xxxxxxxxxxxxxxxxxxxx";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("should produce different ciphertexts for the same plaintext (random IV)", () => {
    const key = "sk_test_xxxxxxxxxxxxxxxxxxxx";
    const encrypted1 = encrypt(key);
    const encrypted2 = encrypt(key);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("should reject invalid ciphertext format", () => {
    expect(() => decrypt("invalid")).toThrow("Invalid encrypted format");
    expect(() => decrypt("a:b")).toThrow("Invalid encrypted format");
  });

  it("should reject tampered ciphertext", () => {
    const original = "sk_test_xxxxxxxxxxxxxxxxxxxx";
    const encrypted = encrypt(original);
    // Tamper with the IV part
    const parts = encrypted.split(":");
    parts[0] = "00000000000000000000000000000000";
    const tampered = parts.join(":");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("should fail to decrypt with a different key", async () => {
    const original = "sk_test_xxxxxxxxxxxxxxxxxxxx";
    const encrypted = encrypt(original);

    // Swap to a different key and reload the module so the singleton
    // master key is re-derived from the new env value.
    process.env.AORAHQ_MASTER_ENCRYPTION_KEY = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    vi.resetModules();
    const differentModule = await import("../../src/gateways/encryption.ts");
    expect(() => differentModule.decrypt(encrypted)).toThrow();
    // Reset key for other tests
    process.env.AORAHQ_MASTER_ENCRYPTION_KEY = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
  });
});

describe("previewKey", () => {
  it("should show only last 4 characters", () => {
    expect(previewKey("sk_test_xxxxxxxxxxxxxxxxxxxx")).toBe("...xxxx");
    expect(previewKey("sk_live_xxxxxxxxxxxxxxxxxxxx")).toBe("...xxxx");
  });

  it("should handle short keys", () => {
    expect(previewKey("abc")).toBe("...abc");
  });
});
