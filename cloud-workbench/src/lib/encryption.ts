/**
 * Client-Side Encryption Utilities
 *
 * Implements zero-knowledge encryption for secure file storage
 * All encryption/decryption happens in the browser using Web Crypto API
 * Server never sees plaintext or encryption keys
 *
 * Security model:
 * - User password → PBKDF2 → AES-256-GCM key
 * - Each file encrypted with unique IV (initialization vector)
 * - Keys stored in memory only, discarded on logout
 */

const PBKDF2_ITERATIONS = 100000; // 100k iterations for key derivation
const KEY_LENGTH = 256; // AES-256

/**
 * Encryption Key Manager
 * Singleton that holds the user's encryption key in memory
 */
class EncryptionKeyManager {
  private key: CryptoKey | null = null;
  private salt: Uint8Array | null = null;

  /**
   * Initialize encryption key from user password
   * This should be called after login, using a password different from login password
   *
   * @param password - User's encryption password (separate from login!)
   * @param saltBase64 - Base64-encoded salt from server
   */
  async initialize(password: string, saltBase64: string): Promise<void> {
    try {
      // Decode salt from base64
      const saltStr = atob(saltBase64);
      this.salt = new Uint8Array(saltStr.split('').map(c => c.charCodeAt(0)));

      // Derive key from password using PBKDF2
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      this.key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: this.salt as Uint8Array as any as BufferSource,
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256'
        },
        passwordKey,
        { name: 'AES-GCM', length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
      );

      console.log('Encryption key initialized successfully');
    } catch (error) {
      console.error('Failed to initialize encryption key:', error);
      throw new Error('Failed to initialize encryption');
    }
  }

  /**
   * Get the encryption key
   * Throws if not initialized
   */
  getKey(): CryptoKey {
    if (!this.key) {
      throw new Error('Encryption key not initialized. Please set your encryption password.');
    }
    return this.key;
  }

  /**
   * Check if key is initialized
   */
  isInitialized(): boolean {
    return this.key !== null;
  }

  /**
   * Destroy the key (on logout)
   * IMPORTANT: Call this when user logs out to remove key from memory
   */
  destroy(): void {
    this.key = null;
    this.salt = null;
    console.log('Encryption key destroyed');
  }
}

// Singleton instance
export const keyManager = new EncryptionKeyManager();

/**
 * Encrypt a file
 *
 * @param file - File to encrypt
 * @param key - Encryption key (from keyManager)
 * @returns Encrypted data + IV
 */
export async function encryptFile(file: File, key: CryptoKey): Promise<{
  encryptedData: Uint8Array;
  iv: number[];
}> {
  try {
    // Generate random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Read file as ArrayBuffer
    const fileData = await file.arrayBuffer();

    // Encrypt using AES-GCM
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      fileData
    );

    return {
      encryptedData: new Uint8Array(encrypted),
      iv: Array.from(iv) // Convert to array for JSON serialization
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt file');
  }
}

/**
 * Decrypt file data
 *
 * @param encryptedData - Encrypted data as Uint8Array or number array
 * @param iv - Initialization vector (number array)
 * @param key - Decryption key (from keyManager)
 * @returns Decrypted data as Uint8Array
 */
export async function decryptFile(
  encryptedData: Uint8Array | number[],
  iv: number[],
  key: CryptoKey
): Promise<Uint8Array> {
  try {
    // Ensure data is Uint8Array
    const data = encryptedData instanceof Uint8Array
      ? encryptedData
      : new Uint8Array(encryptedData);

    // Convert IV to Uint8Array
    const ivArray = new Uint8Array(iv);

    // Decrypt using AES-GCM
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivArray
      },
      key,
      data as Uint8Array as any as BufferSource
    );

    return new Uint8Array(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt file. Wrong password or corrupted data.');
  }
}

/**
 * Encrypt text (convenience wrapper)
 *
 * @param text - Plain text to encrypt
 * @param key - Encryption key
 * @returns Encrypted data + IV
 */
export async function encryptText(text: string, key: CryptoKey): Promise<{
  encryptedData: Uint8Array;
  iv: number[];
}> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return {
    encryptedData: new Uint8Array(encrypted),
    iv: Array.from(iv)
  };
}

/**
 * Decrypt text (convenience wrapper)
 *
 * @param encryptedData - Encrypted data
 * @param iv - Initialization vector
 * @param key - Decryption key
 * @returns Decrypted text
 */
export async function decryptText(
  encryptedData: Uint8Array | number[],
  iv: number[],
  key: CryptoKey
): Promise<string> {
  const decrypted = await decryptFile(encryptedData, iv, key);
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Convert Uint8Array to downloadable Blob
 *
 * @param data - Decrypted data
 * @param contentType - MIME type
 * @returns Blob for download
 */
export function uint8ArrayToBlob(data: Uint8Array, contentType: string): Blob {
  return new Blob([data as any], { type: contentType });
}

/**
 * Create download link for decrypted file
 *
 * @param data - Decrypted data
 * @param filename - Filename for download
 * @param contentType - MIME type
 */
export function downloadDecryptedFile(
  data: Uint8Array,
  filename: string,
  contentType: string
): void {
  const blob = uint8ArrayToBlob(data, contentType);
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/**
 * Helper: Convert decrypted text file to string
 *
 * @param data - Decrypted file data
 * @returns Text content
 */
export function uint8ArrayToText(data: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(data);
}

/**
 * Helper: Validate file type
 *
 * @param file - File to validate
 * @param allowedTypes - Array of allowed MIME types
 * @returns True if valid
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      return file.type.startsWith(type.slice(0, -2));
    }
    return file.type === type;
  });
}

/**
 * Helper: Format file size
 *
 * @param bytes - File size in bytes
 * @returns Human-readable size (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
