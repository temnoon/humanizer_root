/**
 * API Key Service
 *
 * User-owned API key management for programmatic access.
 *
 * Features:
 * - Secure key generation with cryptographic randomness
 * - SHA-256 hashed storage (full key shown only at creation)
 * - Scoped permissions (read, write, transform)
 * - Rate limiting per key
 * - Automatic expiration support
 * - Usage tracking per key
 *
 * @module @humanizer/core/aui/service/api-key-service
 */

import { randomUUID, randomBytes, createHash } from 'crypto';
import type { Pool } from 'pg';
import {
  INSERT_AUI_API_KEY,
  GET_AUI_API_KEY_BY_HASH,
  LIST_AUI_API_KEYS,
  REVOKE_AUI_API_KEY,
  UPDATE_AUI_API_KEY_USAGE,
  DELETE_AUI_API_KEY,
  COUNT_AUI_API_KEYS,
  GET_AUI_TIER_DEFAULT,
  LIST_AUI_API_KEYS_ADMIN,
  COUNT_AUI_API_KEYS_ADMIN,
  ADMIN_REVOKE_AUI_API_KEY,
} from '../../storage/schema-aui.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * API key scopes
 */
export type ApiKeyScope = 'read' | 'write' | 'transform' | 'admin';

/**
 * API key info (returned to user, excludes hash)
 */
export interface ApiKeyInfo {
  id: string;
  userId: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  rateLimitRpm: number;
  lastUsedAt: Date | null;
  usageCount: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * Full API key record (internal use, includes hash)
 */
export interface ApiKeyRecord extends ApiKeyInfo {
  keyHash: string;
}

/**
 * Result of key creation (includes the full key, shown only once)
 */
export interface CreateKeyResult {
  key: string;
  id: string;
  keyPrefix: string;
}

/**
 * Result of key validation
 */
export interface ValidateKeyResult {
  valid: boolean;
  userId?: string;
  tenantId?: string;
  scopes?: ApiKeyScope[];
  rateLimitRpm?: number;
  keyId?: string;
  error?: string;
}

/**
 * Options for ApiKeyService
 */
export interface ApiKeyServiceOptions {
  defaultTenantId?: string;
  defaultScopes?: ApiKeyScope[];
  defaultRateLimitRpm?: number;
  keyPrefix?: string;
  keyLength?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// API KEY SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ApiKeyService provides user-owned API key management.
 */
export class ApiKeyService {
  private pool: Pool;
  private options: Required<ApiKeyServiceOptions>;

  // Cache for validated keys (short TTL for security)
  private validationCache: Map<string, { result: ValidateKeyResult; expiresAt: number }> = new Map();
  private static readonly CACHE_TTL_MS = 30_000; // 30 seconds

  constructor(pool: Pool, options?: ApiKeyServiceOptions) {
    this.pool = pool;
    this.options = {
      defaultTenantId: options?.defaultTenantId ?? 'humanizer',
      defaultScopes: options?.defaultScopes ?? ['read', 'write'],
      defaultRateLimitRpm: options?.defaultRateLimitRpm ?? 60,
      keyPrefix: options?.keyPrefix ?? 'hum_',
      keyLength: options?.keyLength ?? 32, // 256 bits
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KEY CREATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new API key for a user.
   * Returns the full key only once - it cannot be retrieved later.
   */
  async createKey(
    userId: string,
    name: string,
    options?: {
      tenantId?: string;
      scopes?: ApiKeyScope[];
      rateLimitRpm?: number;
      expiresAt?: Date;
      userTier?: string; // User's current tier for limit checking
    }
  ): Promise<CreateKeyResult> {
    const tenantId = options?.tenantId ?? this.options.defaultTenantId;
    const userTier = options?.userTier ?? 'free';

    // Check if user has reached max API keys for their tier
    await this.checkApiKeyLimit(userId, tenantId, userTier);

    // Generate secure random key
    const rawKey = randomBytes(this.options.keyLength).toString('base64url');
    const fullKey = `${this.options.keyPrefix}${rawKey}`;

    // Create key prefix (first 8 characters after prefix for identification)
    const keyPrefix = fullKey.substring(0, this.options.keyPrefix.length + 8);

    // Hash the full key for storage
    const keyHash = this.hashKey(fullKey);

    const keyId = randomUUID();
    const scopes = options?.scopes ?? this.options.defaultScopes;
    const rateLimitRpm = options?.rateLimitRpm ?? this.options.defaultRateLimitRpm;

    await this.pool.query(INSERT_AUI_API_KEY, [
      keyId,
      userId,
      tenantId,
      name,
      keyPrefix,
      keyHash,
      scopes,
      rateLimitRpm,
      options?.expiresAt ?? null,
      new Date(),
    ]);

    return {
      key: fullKey,
      id: keyId,
      keyPrefix,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KEY VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validate an API key and return associated user info.
   * Call this on every API request that uses key authentication.
   */
  async validateKey(key: string): Promise<ValidateKeyResult> {
    // Check cache first
    const keyHash = this.hashKey(key);
    const cached = this.validationCache.get(keyHash);
    if (cached && cached.expiresAt > Date.now()) {
      // Update usage asynchronously (don't block validation)
      if (cached.result.valid && cached.result.keyId) {
        this.updateUsageAsync(cached.result.keyId);
      }
      return cached.result;
    }

    // Validate key format
    if (!key.startsWith(this.options.keyPrefix)) {
      const result: ValidateKeyResult = {
        valid: false,
        error: 'Invalid key format',
      };
      return result;
    }

    // Query database
    const queryResult = await this.pool.query(GET_AUI_API_KEY_BY_HASH, [keyHash]);

    if (queryResult.rows.length === 0) {
      const result: ValidateKeyResult = {
        valid: false,
        error: 'Key not found or expired',
      };
      this.validationCache.set(keyHash, {
        result,
        expiresAt: Date.now() + ApiKeyService.CACHE_TTL_MS,
      });
      return result;
    }

    const row = queryResult.rows[0];

    // Check if revoked
    if (row.revoked_at) {
      const result: ValidateKeyResult = {
        valid: false,
        error: 'Key has been revoked',
      };
      this.validationCache.set(keyHash, {
        result,
        expiresAt: Date.now() + ApiKeyService.CACHE_TTL_MS,
      });
      return result;
    }

    // Check if expired
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      const result: ValidateKeyResult = {
        valid: false,
        error: 'Key has expired',
      };
      this.validationCache.set(keyHash, {
        result,
        expiresAt: Date.now() + ApiKeyService.CACHE_TTL_MS,
      });
      return result;
    }

    const result: ValidateKeyResult = {
      valid: true,
      userId: row.user_id,
      tenantId: row.tenant_id,
      scopes: row.scopes,
      rateLimitRpm: row.rate_limit_rpm,
      keyId: row.id,
    };

    // Cache the result
    this.validationCache.set(keyHash, {
      result,
      expiresAt: Date.now() + ApiKeyService.CACHE_TTL_MS,
    });

    // Update usage asynchronously
    this.updateUsageAsync(row.id);

    return result;
  }

  /**
   * Check if a key has a specific scope.
   */
  hasScope(result: ValidateKeyResult, scope: ApiKeyScope): boolean {
    return result.valid && result.scopes?.includes(scope) === true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KEY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List all API keys for a user (does not include key hashes).
   */
  async listKeys(userId: string, tenantId?: string): Promise<ApiKeyInfo[]> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(LIST_AUI_API_KEYS, [userId, tenant]);

    return result.rows.map(row => this.rowToApiKeyInfo(row));
  }

  /**
   * Revoke an API key (soft delete - keeps audit trail).
   */
  async revokeKey(userId: string, keyId: string, tenantId?: string): Promise<boolean> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(REVOKE_AUI_API_KEY, [keyId, userId, tenant]);

    if (result.rowCount && result.rowCount > 0) {
      // Invalidate cache entries for this key
      this.invalidateCacheForKey(keyId);
      return true;
    }

    return false;
  }

  /**
   * Permanently delete an API key.
   */
  async deleteKey(userId: string, keyId: string): Promise<boolean> {
    const result = await this.pool.query(DELETE_AUI_API_KEY, [keyId, userId]);
    this.invalidateCacheForKey(keyId);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Get the count of active (non-revoked) keys for a user.
   */
  async getKeyCount(userId: string, tenantId?: string): Promise<number> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(COUNT_AUI_API_KEYS, [userId, tenant]);
    return parseInt(result.rows[0].count, 10);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Admin: List all API keys with optional filters.
   * Does not include key hashes.
   */
  async adminListKeys(options?: {
    tenantId?: string;
    userId?: string;
    status?: 'active' | 'revoked' | 'expired';
    limit?: number;
    offset?: number;
  }): Promise<{ keys: ApiKeyInfo[]; total: number }> {
    const tenant = options?.tenantId ?? this.options.defaultTenantId;
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const [keysResult, countResult] = await Promise.all([
      this.pool.query(LIST_AUI_API_KEYS_ADMIN, [
        tenant,
        options?.userId ?? null,
        options?.status ?? null,
        limit,
        offset,
      ]),
      this.pool.query(COUNT_AUI_API_KEYS_ADMIN, [
        tenant,
        options?.userId ?? null,
        options?.status ?? null,
      ]),
    ]);

    return {
      keys: keysResult.rows.map(row => this.rowToApiKeyInfo(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Admin: Revoke any API key by ID (without user ownership check).
   */
  async adminRevokeKey(keyId: string, tenantId?: string): Promise<boolean> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(ADMIN_REVOKE_AUI_API_KEY, [keyId, tenant]);

    if (result.rowCount && result.rowCount > 0) {
      this.invalidateCacheForKey(keyId);
      return true;
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Hash an API key using SHA-256.
   */
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Update key usage (last_used_at, usage_count).
   * Called asynchronously to not block validation.
   */
  private updateUsageAsync(keyId: string): void {
    this.pool.query(UPDATE_AUI_API_KEY_USAGE, [keyId]).catch(err => {
      console.warn('Failed to update API key usage:', err);
    });
  }

  /**
   * Check if user has reached their API key limit.
   */
  private async checkApiKeyLimit(userId: string, tenantId: string, userTier: string): Promise<void> {
    // Get user's tier max_api_keys
    const tierResult = await this.pool.query(GET_AUI_TIER_DEFAULT, [tenantId, userTier]);
    const maxKeys = tierResult.rows[0]?.max_api_keys ?? 0;

    if (maxKeys === -1) {
      // Unlimited keys
      return;
    }

    if (maxKeys === 0) {
      throw new Error('API keys not available for your tier');
    }

    const currentCount = await this.getKeyCount(userId, tenantId);
    if (currentCount >= maxKeys) {
      throw new Error(`API key limit reached (${maxKeys}). Revoke existing keys or upgrade your tier.`);
    }
  }

  /**
   * Convert database row to ApiKeyInfo.
   */
  private rowToApiKeyInfo(row: Record<string, unknown>): ApiKeyInfo {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      keyPrefix: row.key_prefix as string,
      scopes: row.scopes as ApiKeyScope[],
      rateLimitRpm: row.rate_limit_rpm as number,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string) : null,
      usageCount: row.usage_count as number,
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
      revokedAt: row.revoked_at ? new Date(row.revoked_at as string) : null,
      createdAt: new Date(row.created_at as string),
    };
  }

  /**
   * Invalidate cache entries for a specific key.
   */
  private invalidateCacheForKey(keyId: string): void {
    // We need to iterate the cache to find entries with this keyId
    for (const [hash, entry] of this.validationCache.entries()) {
      if (entry.result.keyId === keyId) {
        this.validationCache.delete(hash);
      }
    }
  }

  /**
   * Clear all caches.
   */
  clearCaches(): void {
    this.validationCache.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let _apiKeyService: ApiKeyService | null = null;

/**
 * Initialize the global API key service.
 */
export function initApiKeyService(pool: Pool, options?: ApiKeyServiceOptions): ApiKeyService {
  _apiKeyService = new ApiKeyService(pool, options);
  return _apiKeyService;
}

/**
 * Get the global API key service.
 */
export function getApiKeyService(): ApiKeyService | null {
  return _apiKeyService;
}

/**
 * Reset the global API key service.
 */
export function resetApiKeyService(): void {
  _apiKeyService = null;
}
