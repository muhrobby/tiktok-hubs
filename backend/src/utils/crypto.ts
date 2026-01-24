import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { logger } from "./logger.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 * Expected format: 32 bytes as hex string (64 characters) or base64 (44 characters)
 */
function getEncryptionKey(): Buffer {
  const keyEnv = process.env.TOKEN_ENC_KEY;

  if (!keyEnv) {
    throw new Error("TOKEN_ENC_KEY environment variable is required");
  }

  let keyBuffer: Buffer;

  // Try to parse as hex first (64 characters = 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(keyEnv)) {
    keyBuffer = Buffer.from(keyEnv, "hex");
  }
  // Try base64 (44 characters with padding = 32 bytes)
  else if (keyEnv.length >= 43) {
    keyBuffer = Buffer.from(keyEnv, "base64");
  } else {
    throw new Error(
      "TOKEN_ENC_KEY must be 32 bytes as hex (64 chars) or base64 (44 chars). " +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  if (keyBuffer.length !== 32) {
    throw new Error(
      `TOKEN_ENC_KEY must be exactly 32 bytes, got ${keyBuffer.length} bytes`
    );
  }

  return keyBuffer;
}

/**
 * Encrypt plaintext using AES-256-GCM
 * Returns: base64(iv + authTag + ciphertext)
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Combine: iv (16) + authTag (16) + ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);

    return combined.toString("base64");
  } catch (error) {
    logger.error({ error }, "Encryption failed");
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt ciphertext encrypted with encrypt()
 * Input: base64(iv + authTag + ciphertext)
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, "base64");

    if (combined.length < IV_LENGTH + TAG_LENGTH + 1) {
      throw new Error("Invalid encrypted data: too short");
    }

    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
  } catch (error) {
    logger.error({ error }, "Decryption failed");
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Generate a new encryption key (for setup)
 */
export function generateEncryptionKey(): { hex: string; base64: string } {
  const key = randomBytes(32);
  return {
    hex: key.toString("hex"),
    base64: key.toString("base64"),
  };
}

/**
 * Validate that the encryption key is properly configured
 */
export function validateEncryptionSetup(): boolean {
  try {
    const testData = "encryption-test-" + Date.now();
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    return decrypted === testData;
  } catch {
    return false;
  }
}
