/**
 * Provider Config Service
 *
 * Manages provider configurations including BYOK (Bring Your Own Key).
 *
 * Features:
 * - Store user-provided API keys (encrypted at rest)
 * - Configure custom endpoints (e.g., custom Ollama URLs)
 * - Track provider health status
 * - Support both system-wide and user-specific configs
 *
 * Security:
 * - API keys are encrypted before storage
 * - Only key hints (last 4 chars) are stored in plaintext
 * - Full keys are never logged or exposed in queries
 *
 * Config Precedence (highest to lowest):
 * 1. User-specific config
 * 2. System-wide config
 * 3. Environment variables (handled at provider level)
 *
 * @module @humanizer/core/aui/service/provider-config-service
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import type { Pool } from 'pg';
import type { ModelProvider } from '../../models/model-registry.js';
import {
  INSERT_AUI_PROVIDER_CONFIG,
  GET_AUI_PROVIDER_CONFIG,
  GET_AUI_PROVIDER_CONFIG_USER,
  LIST_AUI_PROVIDER_CONFIGS,
  LIST_AUI_PROVIDER_CONFIGS_FOR_USER,
  UPDATE_AUI_PROVIDER_CONFIG,
  UPDATE_AUI_PROVIDER_CONFIG_HEALTH,
  DELETE_AUI_PROVIDER_CONFIG,
} from '../../storage/schema-aui.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Provider health status
 */
export type ProviderHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Provider configuration stored in database
 */
export interface ProviderConfig {
  id: string;
  tenantId: string;
  userId: string | null;
  provider: ModelProvider;
  apiKeyHint: string | null;
  hasApiKey: boolean;
  baseUrl: string | null;
  healthStatus: ProviderHealthStatus;
  lastHealthCheck: Date | null;
  healthError: string | null;
  isEnabled: boolean;
  priority: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Provider config with source information (user or system)
 */
export interface ProviderConfigWithSource extends ProviderConfig {
  configSource: 'user' | 'system';
}

/**
 * Options for creating/updating provider config
 */
export interface ProviderConfigInput {
  apiKey?: string | null;
  baseUrl?: string | null;
  isEnabled?: boolean;
  priority?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Result of API key decryption
 */
export interface DecryptedApiKey {
  apiKey: string;
  provider: ModelProvider;
  userId: string | null;
}

/**
 * Options for ProviderConfigService
 */
export interface ProviderConfigServiceOptions {
  defaultTenantId?: string;
  /** Encryption key for API keys (32 bytes hex or base64) */
  encryptionKey?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER CONFIG SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ProviderConfigService manages provider API keys and endpoints.
 *
 * Supports both system-wide (userId = null) and user-specific configurations.
 * User configs override system configs for the same provider.
 */
export class ProviderConfigService {
  private pool: Pool;
  private options: Required<ProviderConfigServiceOptions>;
  private encryptionKey: Buffer;

  // Cache for decrypted API keys (short TTL for security)
  private apiKeyCache: Map<string, { key: string; expiresAt: number }> = new Map();
  private static readonly CACHE_TTL_MS = 60_000; // 1 minute

  constructor(pool: Pool, options?: ProviderConfigServiceOptions) {
    this.pool = pool;
    this.options = {
      defaultTenantId: options?.defaultTenantId ?? 'humanizer',
      encryptionKey: options?.encryptionKey ?? process.env.PROVIDER_KEY_ENCRYPTION_KEY ?? '',
    };

    // Derive encryption key (use scrypt for key derivation if needed)
    if (this.options.encryptionKey) {
      // If it looks like a hex key (64 chars), use directly
      if (/^[0-9a-fA-F]{64}$/.test(this.options.encryptionKey)) {
        this.encryptionKey = Buffer.from(this.options.encryptionKey, 'hex');
      } else {
        // Derive key from passphrase
        this.encryptionKey = scryptSync(this.options.encryptionKey, 'humanizer-salt', 32);
      }
    } else {
      // Development fallback - NOT SECURE FOR PRODUCTION
      console.warn('[ProviderConfigService] No encryption key provided. Using insecure fallback.');
      this.encryptionKey = scryptSync('dev-only-key', 'humanizer-salt', 32);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE / UPSERT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create or update a provider configuration.
   *
   * @param provider - Provider identifier (e.g., 'openai', 'anthropic')
   * @param input - Configuration options
   * @param userId - User ID (null for system-wide config)
   * @param tenantId - Tenant ID
   */
  async upsertConfig(
    provider: ModelProvider,
    input: ProviderConfigInput,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ProviderConfig> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    // Encrypt API key if provided
    let encryptedKey: string | null = null;
    let keyHint: string | null = null;

    if (input.apiKey) {
      encryptedKey = this.encryptApiKey(input.apiKey);
      keyHint = input.apiKey.slice(-4);

      // Invalidate cache for this config
      this.invalidateCache(tenant, userId, provider);
    }

    const result = await this.pool.query(INSERT_AUI_PROVIDER_CONFIG, [
      tenant,
      userId,
      provider,
      encryptedKey,
      keyHint,
      input.baseUrl ?? null,
      'unknown',  // health_status
      input.isEnabled ?? true,
      input.priority ?? 100,
      JSON.stringify(input.metadata ?? {}),
    ]);

    return this.rowToProviderConfig(result.rows[0]);
  }

  /**
   * Create system-wide provider configuration.
   */
  async upsertSystemConfig(
    provider: ModelProvider,
    input: ProviderConfigInput,
    tenantId?: string
  ): Promise<ProviderConfig> {
    return this.upsertConfig(provider, input, null, tenantId);
  }

  /**
   * Create user-specific provider configuration.
   */
  async upsertUserConfig(
    userId: string,
    provider: ModelProvider,
    input: ProviderConfigInput,
    tenantId?: string
  ): Promise<ProviderConfig> {
    return this.upsertConfig(provider, input, userId, tenantId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get provider configuration with fallback to system config.
   *
   * Returns user config if exists, otherwise system config.
   */
  async getConfig(
    provider: ModelProvider,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ProviderConfig | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(GET_AUI_PROVIDER_CONFIG, [tenant, userId, provider]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToProviderConfig(result.rows[0]);
  }

  /**
   * Get only user-specific config (no fallback to system).
   */
  async getUserConfig(
    userId: string,
    provider: ModelProvider,
    tenantId?: string
  ): Promise<ProviderConfig | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(GET_AUI_PROVIDER_CONFIG_USER, [tenant, userId, provider]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToProviderConfig(result.rows[0]);
  }

  /**
   * Get the decrypted API key for a provider.
   *
   * Checks user config first, falls back to system config.
   * Returns null if no API key is configured.
   */
  async getApiKey(
    provider: ModelProvider,
    userId: string | null = null,
    tenantId?: string
  ): Promise<string | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const cacheKey = this.getCacheKey(tenant, userId, provider);

    // Check cache
    const cached = this.apiKeyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.key;
    }

    // Query database
    const result = await this.pool.query(GET_AUI_PROVIDER_CONFIG, [tenant, userId, provider]);

    if (result.rows.length === 0 || !result.rows[0].api_key_encrypted) {
      return null;
    }

    const encryptedKey = result.rows[0].api_key_encrypted as string;
    const apiKey = this.decryptApiKey(encryptedKey);

    // Cache the decrypted key
    this.apiKeyCache.set(cacheKey, {
      key: apiKey,
      expiresAt: Date.now() + ProviderConfigService.CACHE_TTL_MS,
    });

    return apiKey;
  }

  /**
   * Get the base URL for a provider.
   *
   * Useful for custom Ollama instances, proxy servers, etc.
   */
  async getBaseUrl(
    provider: ModelProvider,
    userId: string | null = null,
    tenantId?: string
  ): Promise<string | null> {
    const config = await this.getConfig(provider, userId, tenantId);
    return config?.baseUrl ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List all provider configurations.
   *
   * @param userId - Filter by user (null for system configs only)
   * @param provider - Filter by provider
   * @param tenantId - Tenant ID
   */
  async listConfigs(
    userId?: string | null,
    provider?: ModelProvider,
    tenantId?: string
  ): Promise<ProviderConfig[]> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(LIST_AUI_PROVIDER_CONFIGS, [
      tenant,
      userId ?? null,
      provider ?? null,
    ]);

    return result.rows.map(row => this.rowToProviderConfig(row));
  }

  /**
   * List provider configs for a user, including system fallbacks.
   *
   * Returns configs with source information.
   */
  async listConfigsForUser(
    userId: string,
    tenantId?: string
  ): Promise<ProviderConfigWithSource[]> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(LIST_AUI_PROVIDER_CONFIGS_FOR_USER, [tenant, userId]);

    return result.rows.map(row => ({
      ...this.rowToProviderConfig(row),
      configSource: row.config_source as 'user' | 'system',
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update an existing provider configuration.
   */
  async updateConfig(
    provider: ModelProvider,
    input: Partial<ProviderConfigInput>,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ProviderConfig | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    // Encrypt API key if provided
    let encryptedKey: string | null = null;
    let keyHint: string | null = null;

    if (input.apiKey !== undefined) {
      if (input.apiKey) {
        encryptedKey = this.encryptApiKey(input.apiKey);
        keyHint = input.apiKey.slice(-4);
      }
      // Invalidate cache
      this.invalidateCache(tenant, userId, provider);
    }

    const result = await this.pool.query(UPDATE_AUI_PROVIDER_CONFIG, [
      tenant,
      userId,
      provider,
      encryptedKey,
      keyHint,
      input.baseUrl ?? null,
      input.isEnabled ?? null,
      input.priority ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToProviderConfig(result.rows[0]);
  }

  /**
   * Update provider health status.
   *
   * Used after health checks.
   */
  async updateHealth(
    provider: ModelProvider,
    status: ProviderHealthStatus,
    error: string | null = null,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ProviderConfig | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(UPDATE_AUI_PROVIDER_CONFIG_HEALTH, [
      tenant,
      userId,
      provider,
      status,
      error,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToProviderConfig(result.rows[0]);
  }

  /**
   * Enable a provider.
   */
  async enableProvider(
    provider: ModelProvider,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ProviderConfig | null> {
    return this.updateConfig(provider, { isEnabled: true }, userId, tenantId);
  }

  /**
   * Disable a provider.
   */
  async disableProvider(
    provider: ModelProvider,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ProviderConfig | null> {
    return this.updateConfig(provider, { isEnabled: false }, userId, tenantId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Delete a provider configuration.
   */
  async deleteConfig(
    provider: ModelProvider,
    userId: string | null = null,
    tenantId?: string
  ): Promise<boolean> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    // Invalidate cache
    this.invalidateCache(tenant, userId, provider);

    const result = await this.pool.query(DELETE_AUI_PROVIDER_CONFIG, [tenant, userId, provider]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Remove API key from a provider config.
   */
  async removeApiKey(
    provider: ModelProvider,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ProviderConfig | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    // Invalidate cache
    this.invalidateCache(tenant, userId, provider);

    // Set API key to null
    const result = await this.pool.query(UPDATE_AUI_PROVIDER_CONFIG, [
      tenant,
      userId,
      provider,
      null,  // api_key_encrypted
      null,  // api_key_hint
      null,  // base_url (preserve existing)
      null,  // is_enabled
      null,  // priority
      null,  // metadata
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToProviderConfig(result.rows[0]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if a provider is enabled for a user.
   *
   * Checks user config first, falls back to system config.
   * Returns true if no config exists (default enabled).
   */
  async isProviderEnabled(
    provider: ModelProvider,
    userId: string | null = null,
    tenantId?: string
  ): Promise<boolean> {
    const config = await this.getConfig(provider, userId, tenantId);
    return config?.isEnabled ?? true;
  }

  /**
   * Check if a provider has an API key configured.
   */
  async hasApiKey(
    provider: ModelProvider,
    userId: string | null = null,
    tenantId?: string
  ): Promise<boolean> {
    const config = await this.getConfig(provider, userId, tenantId);
    return config?.hasApiKey ?? false;
  }

  /**
   * Get all providers with configured API keys.
   */
  async getProvidersWithKeys(
    userId: string | null = null,
    tenantId?: string
  ): Promise<ModelProvider[]> {
    const configs = userId
      ? await this.listConfigsForUser(userId, tenantId)
      : await this.listConfigs(null, undefined, tenantId);

    return configs
      .filter(c => c.hasApiKey && c.isEnabled)
      .map(c => c.provider);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENCRYPTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Encrypt an API key for storage.
   *
   * Uses AES-256-GCM with random IV.
   */
  private encryptApiKey(apiKey: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt an API key from storage.
   */
  private decryptApiKey(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Convert database row to ProviderConfig.
   */
  private rowToProviderConfig(row: Record<string, unknown>): ProviderConfig {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string | null,
      provider: row.provider as ModelProvider,
      apiKeyHint: row.api_key_hint as string | null,
      hasApiKey: !!row.api_key_encrypted,
      baseUrl: row.base_url as string | null,
      healthStatus: row.health_status as ProviderHealthStatus,
      lastHealthCheck: row.last_health_check
        ? new Date(row.last_health_check as string)
        : null,
      healthError: row.health_error as string | null,
      isEnabled: row.is_enabled as boolean,
      priority: row.priority as number,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * Get cache key for API key cache.
   */
  private getCacheKey(tenantId: string, userId: string | null, provider: ModelProvider): string {
    return `${tenantId}:${userId ?? 'system'}:${provider}`;
  }

  /**
   * Invalidate cache for a specific config.
   */
  private invalidateCache(tenantId: string, userId: string | null, provider: ModelProvider): void {
    this.apiKeyCache.delete(this.getCacheKey(tenantId, userId, provider));
  }

  /**
   * Clear all caches.
   */
  clearCaches(): void {
    this.apiKeyCache.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let _providerConfigService: ProviderConfigService | null = null;

/**
 * Initialize the global provider config service.
 */
export function initProviderConfigService(
  pool: Pool,
  options?: ProviderConfigServiceOptions
): ProviderConfigService {
  _providerConfigService = new ProviderConfigService(pool, options);
  return _providerConfigService;
}

/**
 * Get the global provider config service.
 */
export function getProviderConfigService(): ProviderConfigService | null {
  return _providerConfigService;
}

/**
 * Reset the global provider config service.
 */
export function resetProviderConfigService(): void {
  _providerConfigService = null;
}
