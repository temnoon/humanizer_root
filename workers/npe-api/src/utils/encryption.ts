/**
 * AES-GCM Encryption Utilities for API Key Storage
 *
 * Security Model:
 * - Each user has a unique encryption key derived from SHA-256(JWT_SECRET + user_id)
 * - Uses AES-GCM (256-bit) for authenticated encryption
 * - Random IV (Initialization Vector) generated for each encryption
 * - Storage format: base64(iv):base64(encrypted_data)
 *
 * CRITICAL SECURITY NOTES:
 * - Never log API keys (even partially)
 * - Never include keys in error messages
 * - Each encryption must use a fresh random IV
 * - Decryption requires both JWT_SECRET and correct user_id
 */

/**
 * Derive a user-specific encryption key from JWT_SECRET and user_id
 * Using SHA-256 ensures each user has a unique encryption key
 */
async function deriveEncryptionKey(jwtSecret: string, userId: string): Promise<CryptoKey> {
  // Combine JWT_SECRET and user_id to create user-specific key material
  const keyMaterial = `${jwtSecret}:${userId}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyMaterial);

  // Hash to get 256-bit key material
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);

  // Import as AES-GCM key
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt an API key using AES-GCM
 *
 * @param apiKey - The plaintext API key to encrypt
 * @param jwtSecret - The JWT_SECRET from environment
 * @param userId - The user's ID (used to derive unique encryption key)
 * @returns Encrypted string in format: base64(iv):base64(encrypted_data)
 */
export async function encryptAPIKey(
  apiKey: string,
  jwtSecret: string,
  userId: string
): Promise<string> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('API key cannot be empty');
  }

  if (!jwtSecret || !userId) {
    throw new Error('JWT secret and user ID are required for encryption');
  }

  try {
    // Derive user-specific encryption key
    const key = await deriveEncryptionKey(jwtSecret, userId);

    // Generate random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the API key
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    // Convert to base64 for storage
    const encryptedArray = new Uint8Array(encryptedBuffer);
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));

    // Return in format: iv:encrypted_data
    return `${ivBase64}:${encryptedBase64}`;
  } catch (error) {
    // Never log the actual API key in errors
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt an API key using AES-GCM
 *
 * @param encryptedData - Encrypted string in format: base64(iv):base64(encrypted_data)
 * @param jwtSecret - The JWT_SECRET from environment
 * @param userId - The user's ID (must match the one used for encryption)
 * @returns Decrypted API key
 * @throws Error if decryption fails (wrong key, corrupted data, or wrong user_id)
 */
export async function decryptAPIKey(
  encryptedData: string,
  jwtSecret: string,
  userId: string
): Promise<string> {
  if (!encryptedData || !encryptedData.includes(':')) {
    throw new Error('Invalid encrypted data format');
  }

  if (!jwtSecret || !userId) {
    throw new Error('JWT secret and user ID are required for decryption');
  }

  try {
    // Parse the encrypted data
    const [ivBase64, encryptedBase64] = encryptedData.split(':');

    // Convert from base64
    const iv = new Uint8Array(
      atob(ivBase64).split('').map(c => c.charCodeAt(0))
    );
    const encryptedArray = new Uint8Array(
      atob(encryptedBase64).split('').map(c => c.charCodeAt(0))
    );

    // Derive the same encryption key (must use same user_id)
    const key = await deriveEncryptionKey(jwtSecret, userId);

    // Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedArray
    );

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    // Generic error message to avoid leaking information
    throw new Error('Decryption failed: invalid key or corrupted data');
  }
}

/**
 * Validate that an API key can be encrypted and decrypted successfully
 * Useful for testing encryption setup
 */
export async function testEncryptionRoundtrip(
  testKey: string,
  jwtSecret: string,
  userId: string
): Promise<boolean> {
  try {
    const encrypted = await encryptAPIKey(testKey, jwtSecret, userId);
    const decrypted = await decryptAPIKey(encrypted, jwtSecret, userId);
    return decrypted === testKey;
  } catch {
    return false;
  }
}
