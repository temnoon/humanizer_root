/**
 * Config Encryption Utility
 *
 * Provides AES-GCM encryption for sensitive configuration values.
 * Uses CONFIG_ENCRYPTION_KEY from Wrangler secrets.
 *
 * Encrypted values are stored as base64 strings containing:
 * - 12 bytes IV (initialization vector)
 * - N bytes ciphertext
 * - 16 bytes auth tag (included in ciphertext by Web Crypto)
 */

import type { Env } from '../../shared/types';

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const KEY_LENGTH = 32; // 256 bits for AES-256

// Cache the derived key to avoid repeated imports
let cachedKey: CryptoKey | null = null;
let cachedKeySource: string | null = null;

/**
 * Encrypt a config value
 * @param value - Plain text value to encrypt
 * @param env - Environment with CONFIG_ENCRYPTION_KEY secret
 * @returns Base64-encoded encrypted value (IV + ciphertext)
 */
export async function encryptConfigValue(value: string, env: Env): Promise<string> {
  const key = await getEncryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(value);

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  // Combine IV + ciphertext into single buffer
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a config value
 * @param encrypted - Base64-encoded encrypted value
 * @param env - Environment with CONFIG_ENCRYPTION_KEY secret
 * @returns Decrypted plain text value
 */
export async function decryptConfigValue(encrypted: string, env: Env): Promise<string> {
  const key = await getEncryptionKey(env);

  // Decode base64
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Check if a value appears to be encrypted (base64 with correct length)
 */
export function isEncryptedValue(value: string): boolean {
  try {
    const decoded = atob(value);
    // Minimum length: 12 (IV) + 16 (auth tag) + 1 (min ciphertext)
    return decoded.length >= 29;
  } catch {
    return false;
  }
}

/**
 * Redact a sensitive value for logging/display
 * Shows first 4 and last 4 characters with asterisks in between
 */
export function redactValue(value: string): string {
  if (value.length <= 12) {
    return '****';
  }
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

/**
 * Get or derive the encryption key from environment
 */
async function getEncryptionKey(env: Env): Promise<CryptoKey> {
  const keySource = (env as Env & { CONFIG_ENCRYPTION_KEY?: string }).CONFIG_ENCRYPTION_KEY;

  if (!keySource) {
    throw new Error('CONFIG_ENCRYPTION_KEY not configured. Run: wrangler secret put CONFIG_ENCRYPTION_KEY');
  }

  // Return cached key if source hasn't changed
  if (cachedKey && cachedKeySource === keySource) {
    return cachedKey;
  }

  // Derive a proper 256-bit key using PBKDF2
  // This allows the secret to be any string, not necessarily 32 bytes
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keySource),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  cachedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('humanizer-admin-config-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH * 8 },
    false,
    ['encrypt', 'decrypt']
  );

  cachedKeySource = keySource;
  return cachedKey;
}

/**
 * Validate that encryption key is configured and working
 */
export async function validateEncryptionKey(env: Env): Promise<{ valid: boolean; error?: string }> {
  try {
    const testValue = 'encryption-test-' + Date.now();
    const encrypted = await encryptConfigValue(testValue, env);
    const decrypted = await decryptConfigValue(encrypted, env);

    if (decrypted !== testValue) {
      return { valid: false, error: 'Decryption produced incorrect value' };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown encryption error'
    };
  }
}
