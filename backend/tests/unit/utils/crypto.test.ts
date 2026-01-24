/**
 * Crypto Utility Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Crypto Utilities", () => {
  const originalEnv = process.env;

  // Valid 32-byte key as hex (64 characters)
  const VALID_HEX_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  // Valid 32-byte key as base64
  const VALID_BASE64_KEY = Buffer.from(
    "0123456789abcdef0123456789abcdef",
    "hex"
  ).toString("base64");

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("encrypt/decrypt", () => {
    it("should encrypt and decrypt plaintext correctly", async () => {
      process.env.TOKEN_ENC_KEY = VALID_HEX_KEY;

      const { encrypt, decrypt } = await import("../../../src/utils/crypto.js");

      const plaintext = "Hello, World!";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertext for same plaintext (due to random IV)", async () => {
      process.env.TOKEN_ENC_KEY = VALID_HEX_KEY;

      const { encrypt } = await import("../../../src/utils/crypto.js");

      const plaintext = "Same text";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should encrypt and decrypt JSON data", async () => {
      process.env.TOKEN_ENC_KEY = VALID_HEX_KEY;

      const { encrypt, decrypt } = await import("../../../src/utils/crypto.js");

      const data = {
        accessToken: "token123",
        refreshToken: "refresh456",
        expiresAt: "2024-01-01T00:00:00Z",
      };

      const plaintext = JSON.stringify(data);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(JSON.parse(decrypted)).toEqual(data);
    });

    it("should encrypt non-empty strings", async () => {
      process.env.TOKEN_ENC_KEY = VALID_HEX_KEY;

      const { encrypt, decrypt } = await import("../../../src/utils/crypto.js");

      // Test with short string
      const plaintext = "a";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle unicode characters", async () => {
      process.env.TOKEN_ENC_KEY = VALID_HEX_KEY;

      const { encrypt, decrypt } = await import("../../../src/utils/crypto.js");

      const plaintext = "Hello, "; // Unicode characters
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle long strings", async () => {
      process.env.TOKEN_ENC_KEY = VALID_HEX_KEY;

      const { encrypt, decrypt } = await import("../../../src/utils/crypto.js");

      const plaintext = "a".repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should throw on missing TOKEN_ENC_KEY", async () => {
      delete process.env.TOKEN_ENC_KEY;

      const { encrypt } = await import("../../../src/utils/crypto.js");

      // The error gets wrapped, so we check for the wrapped message
      expect(() => encrypt("test")).toThrow();
    });

    it("should throw on invalid key length", async () => {
      process.env.TOKEN_ENC_KEY = "tooshort";

      const { encrypt } = await import("../../../src/utils/crypto.js");

      expect(() => encrypt("test")).toThrow();
    });

    it("should accept hex key (64 characters)", async () => {
      process.env.TOKEN_ENC_KEY = VALID_HEX_KEY;

      const { encrypt, decrypt } = await import("../../../src/utils/crypto.js");

      const plaintext = "test";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should fail to decrypt with tampered ciphertext", async () => {
      process.env.TOKEN_ENC_KEY = VALID_HEX_KEY;

      const { encrypt, decrypt } = await import("../../../src/utils/crypto.js");

      const plaintext = "test data";
      const encrypted = encrypt(plaintext);

      // Tamper with the encrypted data
      const tamperedBuffer = Buffer.from(encrypted, "base64");
      tamperedBuffer[tamperedBuffer.length - 1] ^= 0xff; // Flip last byte
      const tampered = tamperedBuffer.toString("base64");

      expect(() => decrypt(tampered)).toThrow();
    });

    it("should fail to decrypt with wrong key", async () => {
      process.env.TOKEN_ENC_KEY = VALID_HEX_KEY;

      const { encrypt } = await import("../../../src/utils/crypto.js");

      const encrypted = encrypt("test data");

      // Change to different key
      vi.resetModules();
      process.env.TOKEN_ENC_KEY =
        "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

      const { decrypt } = await import("../../../src/utils/crypto.js");

      expect(() => decrypt(encrypted)).toThrow();
    });

    it("should throw on invalid encrypted data format", async () => {
      process.env.TOKEN_ENC_KEY = VALID_HEX_KEY;

      const { decrypt } = await import("../../../src/utils/crypto.js");

      // Too short to contain IV + auth tag
      expect(() => decrypt("dG9vIHNob3J0")).toThrow();
    });
  });

  describe("generateEncryptionKey", () => {
    it("should generate valid hex key", async () => {
      process.env.TOKEN_ENC_KEY = VALID_HEX_KEY;

      const { generateEncryptionKey } = await import(
        "../../../src/utils/crypto.js"
      );

      const { hex, base64 } = generateEncryptionKey();

      // Hex should be 64 characters (32 bytes)
      expect(hex.length).toBe(64);
      expect(/^[0-9a-f]+$/.test(hex)).toBe(true);

      // Base64 should decode to 32 bytes
      const decoded = Buffer.from(base64, "base64");
      expect(decoded.length).toBe(32);
    });

    it("should generate unique keys each time", async () => {
      process.env.TOKEN_ENC_KEY = VALID_HEX_KEY;

      const { generateEncryptionKey } = await import(
        "../../../src/utils/crypto.js"
      );

      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1.hex).not.toBe(key2.hex);
      expect(key1.base64).not.toBe(key2.base64);
    });
  });

  describe("validateEncryptionSetup", () => {
    it("should return true for valid setup", async () => {
      process.env.TOKEN_ENC_KEY = VALID_HEX_KEY;

      const { validateEncryptionSetup } = await import(
        "../../../src/utils/crypto.js"
      );

      expect(validateEncryptionSetup()).toBe(true);
    });

    it("should return false for invalid setup", async () => {
      delete process.env.TOKEN_ENC_KEY;

      const { validateEncryptionSetup } = await import(
        "../../../src/utils/crypto.js"
      );

      expect(validateEncryptionSetup()).toBe(false);
    });

    it("should return false for invalid key", async () => {
      process.env.TOKEN_ENC_KEY = "invalid";

      const { validateEncryptionSetup } = await import(
        "../../../src/utils/crypto.js"
      );

      expect(validateEncryptionSetup()).toBe(false);
    });
  });
});
