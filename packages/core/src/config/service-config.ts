/**
 * Service Configuration
 *
 * Centralizes all service-level configuration keys and defaults.
 * Covers tenant, auth, usage, API key, and other service settings.
 * Part of Phase 2: Configuration Centralization.
 *
 * @module config/service-config
 */

import type { ConfigCategory } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration keys for service-related settings.
 * Use these with ConfigManager instead of hardcoding strings.
 */
export const SERVICE_CONFIG_KEYS = {
  // ─────────────────────────────────────────────────────────────────
  // Tenant Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Default tenant ID for multi-tenant operations */
  DEFAULT_TENANT_ID: 'service.defaultTenantId',

  /** Default user tier for new users */
  DEFAULT_USER_TIER: 'service.defaultUserTier',

  // ─────────────────────────────────────────────────────────────────
  // Usage Service Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Cache TTL for usage data in milliseconds */
  USAGE_CACHE_TTL_MS: 'service.usageCacheTtlMs',

  /** Usage data retention days */
  USAGE_RETENTION_DAYS: 'service.usageRetentionDays',

  // ─────────────────────────────────────────────────────────────────
  // API Key Service Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Default scopes for new API keys */
  API_KEY_DEFAULT_SCOPES: 'service.apiKeyDefaultScopes',

  /** Default rate limit (requests per minute) for API keys */
  API_KEY_DEFAULT_RATE_LIMIT_RPM: 'service.apiKeyDefaultRateLimitRpm',

  /** Prefix for generated API keys */
  API_KEY_PREFIX: 'service.apiKeyPrefix',

  // ─────────────────────────────────────────────────────────────────
  // User Service Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Minimum password length */
  PASSWORD_MIN_LENGTH: 'service.passwordMinLength',

  /** Token expiry in hours */
  TOKEN_EXPIRY_HOURS: 'service.tokenExpiryHours',

  /** Password reset token expiry in hours */
  PASSWORD_RESET_EXPIRY_HOURS: 'service.passwordResetExpiryHours',

  /** Email verification token expiry in hours */
  EMAIL_VERIFICATION_EXPIRY_HOURS: 'service.emailVerificationExpiryHours',

  // ─────────────────────────────────────────────────────────────────
  // CORS Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Default CORS origins for development */
  CORS_DEV_ORIGINS: 'service.corsDevOrigins',

  // ─────────────────────────────────────────────────────────────────
  // Cost Tracking Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Enable cost tracking */
  COST_TRACKING_ENABLED: 'service.costTrackingEnabled',

  /** Cost data retention days */
  COST_RETENTION_DAYS: 'service.costRetentionDays',
} as const;

/**
 * Type for service config keys
 */
export type ServiceConfigKey = typeof SERVICE_CONFIG_KEYS[keyof typeof SERVICE_CONFIG_KEYS];

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default values for service configuration.
 * Used when config is not set or as initialization values.
 */
export const SERVICE_DEFAULTS: Record<ServiceConfigKey, unknown> = {
  // Tenant
  [SERVICE_CONFIG_KEYS.DEFAULT_TENANT_ID]: 'humanizer',
  [SERVICE_CONFIG_KEYS.DEFAULT_USER_TIER]: 'free',

  // Usage
  [SERVICE_CONFIG_KEYS.USAGE_CACHE_TTL_MS]: 60_000, // 1 minute
  [SERVICE_CONFIG_KEYS.USAGE_RETENTION_DAYS]: 90,

  // API Keys
  [SERVICE_CONFIG_KEYS.API_KEY_DEFAULT_SCOPES]: ['read', 'write'],
  [SERVICE_CONFIG_KEYS.API_KEY_DEFAULT_RATE_LIMIT_RPM]: 60,
  [SERVICE_CONFIG_KEYS.API_KEY_PREFIX]: 'hum_',

  // User
  [SERVICE_CONFIG_KEYS.PASSWORD_MIN_LENGTH]: 8,
  [SERVICE_CONFIG_KEYS.TOKEN_EXPIRY_HOURS]: 24,
  [SERVICE_CONFIG_KEYS.PASSWORD_RESET_EXPIRY_HOURS]: 1,
  [SERVICE_CONFIG_KEYS.EMAIL_VERIFICATION_EXPIRY_HOURS]: 48,

  // CORS (development defaults)
  [SERVICE_CONFIG_KEYS.CORS_DEV_ORIGINS]: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177',
    'http://localhost:5178',
    'http://localhost:5179',
  ],

  // Cost tracking
  [SERVICE_CONFIG_KEYS.COST_TRACKING_ENABLED]: true,
  [SERVICE_CONFIG_KEYS.COST_RETENTION_DAYS]: 365,
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps service config keys to their ConfigManager categories.
 */
export const SERVICE_CONFIG_CATEGORIES: Record<ServiceConfigKey, ConfigCategory> = {
  // Tenant config
  [SERVICE_CONFIG_KEYS.DEFAULT_TENANT_ID]: 'limits',
  [SERVICE_CONFIG_KEYS.DEFAULT_USER_TIER]: 'limits',

  // Usage config
  [SERVICE_CONFIG_KEYS.USAGE_CACHE_TTL_MS]: 'limits',
  [SERVICE_CONFIG_KEYS.USAGE_RETENTION_DAYS]: 'limits',

  // API Key config
  [SERVICE_CONFIG_KEYS.API_KEY_DEFAULT_SCOPES]: 'limits',
  [SERVICE_CONFIG_KEYS.API_KEY_DEFAULT_RATE_LIMIT_RPM]: 'limits',
  [SERVICE_CONFIG_KEYS.API_KEY_PREFIX]: 'limits',

  // User config
  [SERVICE_CONFIG_KEYS.PASSWORD_MIN_LENGTH]: 'limits',
  [SERVICE_CONFIG_KEYS.TOKEN_EXPIRY_HOURS]: 'limits',
  [SERVICE_CONFIG_KEYS.PASSWORD_RESET_EXPIRY_HOURS]: 'limits',
  [SERVICE_CONFIG_KEYS.EMAIL_VERIFICATION_EXPIRY_HOURS]: 'limits',

  // CORS config
  [SERVICE_CONFIG_KEYS.CORS_DEV_ORIGINS]: 'limits',

  // Cost tracking
  [SERVICE_CONFIG_KEYS.COST_TRACKING_ENABLED]: 'features',
  [SERVICE_CONFIG_KEYS.COST_RETENTION_DAYS]: 'limits',
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the category for a service config key
 */
export function getServiceConfigCategory(key: ServiceConfigKey): ConfigCategory {
  return SERVICE_CONFIG_CATEGORIES[key];
}

/**
 * Get the default value for a service config key
 */
export function getServiceDefault<T>(key: ServiceConfigKey): T {
  return SERVICE_DEFAULTS[key] as T;
}

/**
 * Seed service defaults into ConfigManager
 */
export async function seedServiceDefaults(
  configManager: { set: (category: ConfigCategory, key: string, value: unknown) => Promise<void> }
): Promise<void> {
  for (const [key, value] of Object.entries(SERVICE_DEFAULTS)) {
    const category = SERVICE_CONFIG_CATEGORIES[key as ServiceConfigKey];
    await configManager.set(category, key, value);
  }
}
