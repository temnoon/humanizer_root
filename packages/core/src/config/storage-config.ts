/**
 * Storage Configuration
 *
 * Centralizes all storage-related configuration keys and defaults.
 * Supports environment variable overrides for deployment flexibility.
 * Part of Phase 2: Configuration Centralization.
 *
 * Usage:
 * ```typescript
 * import { STORAGE_CONFIG_KEYS, getStorageDefaults } from './storage-config';
 *
 * const defaults = getStorageDefaults();
 * const maxConnections = defaults[STORAGE_CONFIG_KEYS.MAX_CONNECTIONS];
 * ```
 *
 * @module config/storage-config
 */

import type { ConfigCategory } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration keys for storage-related settings.
 * Use these with ConfigManager instead of hardcoding strings.
 */
export const STORAGE_CONFIG_KEYS = {
  // ─────────────────────────────────────────────────────────────────
  // Database Connection
  // ─────────────────────────────────────────────────────────────────

  /** Database host */
  DB_HOST: 'storage.dbHost',

  /** Database port */
  DB_PORT: 'storage.dbPort',

  /** Database name */
  DB_NAME: 'storage.dbName',

  /** Database user */
  DB_USER: 'storage.dbUser',

  /** Database password (use env var in production) */
  DB_PASSWORD: 'storage.dbPassword',

  /** Full connection string (alternative to individual params) */
  DATABASE_URL: 'storage.databaseUrl',

  // ─────────────────────────────────────────────────────────────────
  // Connection Pool
  // ─────────────────────────────────────────────────────────────────

  /** Maximum concurrent connections */
  MAX_CONNECTIONS: 'storage.maxConnections',

  /** Minimum pool size */
  MIN_CONNECTIONS: 'storage.minConnections',

  /** Idle connection timeout in milliseconds */
  IDLE_TIMEOUT_MS: 'storage.idleTimeoutMs',

  /** Connection acquisition timeout in milliseconds */
  CONNECTION_TIMEOUT_MS: 'storage.connectionTimeoutMs',

  /** Statement timeout in milliseconds */
  STATEMENT_TIMEOUT_MS: 'storage.statementTimeoutMs',

  // ─────────────────────────────────────────────────────────────────
  // Vector Search
  // ─────────────────────────────────────────────────────────────────

  /** Vector index type (ivfflat, hnsw) */
  VECTOR_INDEX_TYPE: 'storage.vectorIndexType',

  /** Number of lists for IVFFlat index */
  IVFFLAT_LISTS: 'storage.ivfflatLists',

  /** M parameter for HNSW index */
  HNSW_M: 'storage.hnswM',

  /** ef_construction for HNSW index */
  HNSW_EF_CONSTRUCTION: 'storage.hnswEfConstruction',

  /** ef_search for HNSW queries */
  HNSW_EF_SEARCH: 'storage.hnswEfSearch',

  /** Probes for IVFFlat queries */
  IVFFLAT_PROBES: 'storage.ivfflatProbes',

  // ─────────────────────────────────────────────────────────────────
  // Schema Management
  // ─────────────────────────────────────────────────────────────────

  /** Auto-run migrations on startup */
  AUTO_MIGRATE: 'storage.autoMigrate',

  /** Schema version to target */
  TARGET_SCHEMA_VERSION: 'storage.targetSchemaVersion',

  // ─────────────────────────────────────────────────────────────────
  // Query Limits
  // ─────────────────────────────────────────────────────────────────

  /** Default limit for paginated queries */
  DEFAULT_PAGE_SIZE: 'storage.defaultPageSize',

  /** Maximum allowed page size */
  MAX_PAGE_SIZE: 'storage.maxPageSize',

  /** Maximum results for vector search */
  MAX_VECTOR_RESULTS: 'storage.maxVectorResults',
} as const;

/**
 * Type for storage config keys
 */
export type StorageConfigKey = typeof STORAGE_CONFIG_KEYS[keyof typeof STORAGE_CONFIG_KEYS];

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT VARIABLE MAPPING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps config keys to environment variable names.
 * Environment variables take precedence over defaults.
 */
export const STORAGE_ENV_VARS: Partial<Record<StorageConfigKey, string>> = {
  [STORAGE_CONFIG_KEYS.DB_HOST]: 'DB_HOST',
  [STORAGE_CONFIG_KEYS.DB_PORT]: 'DB_PORT',
  [STORAGE_CONFIG_KEYS.DB_NAME]: 'DB_NAME',
  [STORAGE_CONFIG_KEYS.DB_USER]: 'DB_USER',
  [STORAGE_CONFIG_KEYS.DB_PASSWORD]: 'DB_PASSWORD',
  [STORAGE_CONFIG_KEYS.DATABASE_URL]: 'DATABASE_URL',
  [STORAGE_CONFIG_KEYS.MAX_CONNECTIONS]: 'DB_MAX_CONNECTIONS',
};

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Static default values (not from environment).
 * Use getStorageDefaults() for environment-aware defaults.
 */
export const STORAGE_STATIC_DEFAULTS: Partial<Record<StorageConfigKey, unknown>> = {
  // Connection pool
  [STORAGE_CONFIG_KEYS.MAX_CONNECTIONS]: 20,
  [STORAGE_CONFIG_KEYS.MIN_CONNECTIONS]: 2,
  [STORAGE_CONFIG_KEYS.IDLE_TIMEOUT_MS]: 30000,
  [STORAGE_CONFIG_KEYS.CONNECTION_TIMEOUT_MS]: 5000,
  [STORAGE_CONFIG_KEYS.STATEMENT_TIMEOUT_MS]: 30000,

  // Vector search
  [STORAGE_CONFIG_KEYS.VECTOR_INDEX_TYPE]: 'hnsw',
  [STORAGE_CONFIG_KEYS.IVFFLAT_LISTS]: 100,
  [STORAGE_CONFIG_KEYS.HNSW_M]: 16,
  [STORAGE_CONFIG_KEYS.HNSW_EF_CONSTRUCTION]: 64,
  [STORAGE_CONFIG_KEYS.HNSW_EF_SEARCH]: 40,
  [STORAGE_CONFIG_KEYS.IVFFLAT_PROBES]: 10,

  // Schema management
  [STORAGE_CONFIG_KEYS.AUTO_MIGRATE]: true,

  // Query limits
  [STORAGE_CONFIG_KEYS.DEFAULT_PAGE_SIZE]: 50,
  [STORAGE_CONFIG_KEYS.MAX_PAGE_SIZE]: 500,
  [STORAGE_CONFIG_KEYS.MAX_VECTOR_RESULTS]: 100,
};

/**
 * Get storage defaults with environment variable overrides.
 * Environment variables take precedence over static defaults.
 */
export function getStorageDefaults(): Record<StorageConfigKey, unknown> {
  const defaults: Record<string, unknown> = { ...STORAGE_STATIC_DEFAULTS };

  // Database connection from environment
  defaults[STORAGE_CONFIG_KEYS.DB_HOST] = process.env.DB_HOST ?? 'localhost';
  defaults[STORAGE_CONFIG_KEYS.DB_PORT] = parseInt(process.env.DB_PORT ?? '5432', 10);
  defaults[STORAGE_CONFIG_KEYS.DB_NAME] = process.env.DB_NAME ?? 'humanizer_archive';
  defaults[STORAGE_CONFIG_KEYS.DB_USER] = process.env.DB_USER ?? 'postgres';
  defaults[STORAGE_CONFIG_KEYS.DB_PASSWORD] = process.env.DB_PASSWORD ?? '';

  // Full connection URL (takes precedence if set)
  if (process.env.DATABASE_URL) {
    defaults[STORAGE_CONFIG_KEYS.DATABASE_URL] = process.env.DATABASE_URL;
  }

  // Max connections from environment
  if (process.env.DB_MAX_CONNECTIONS) {
    defaults[STORAGE_CONFIG_KEYS.MAX_CONNECTIONS] = parseInt(process.env.DB_MAX_CONNECTIONS, 10);
  }

  return defaults as Record<StorageConfigKey, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps storage config keys to their ConfigManager categories.
 */
export const STORAGE_CONFIG_CATEGORIES: Record<StorageConfigKey, ConfigCategory> = {
  // Database connection in 'limits' (sensitive, not feature flags)
  [STORAGE_CONFIG_KEYS.DB_HOST]: 'limits',
  [STORAGE_CONFIG_KEYS.DB_PORT]: 'limits',
  [STORAGE_CONFIG_KEYS.DB_NAME]: 'limits',
  [STORAGE_CONFIG_KEYS.DB_USER]: 'limits',
  [STORAGE_CONFIG_KEYS.DB_PASSWORD]: 'limits',
  [STORAGE_CONFIG_KEYS.DATABASE_URL]: 'limits',

  // Connection pool
  [STORAGE_CONFIG_KEYS.MAX_CONNECTIONS]: 'limits',
  [STORAGE_CONFIG_KEYS.MIN_CONNECTIONS]: 'limits',
  [STORAGE_CONFIG_KEYS.IDLE_TIMEOUT_MS]: 'limits',
  [STORAGE_CONFIG_KEYS.CONNECTION_TIMEOUT_MS]: 'limits',
  [STORAGE_CONFIG_KEYS.STATEMENT_TIMEOUT_MS]: 'limits',

  // Vector search
  [STORAGE_CONFIG_KEYS.VECTOR_INDEX_TYPE]: 'limits',
  [STORAGE_CONFIG_KEYS.IVFFLAT_LISTS]: 'limits',
  [STORAGE_CONFIG_KEYS.HNSW_M]: 'limits',
  [STORAGE_CONFIG_KEYS.HNSW_EF_CONSTRUCTION]: 'limits',
  [STORAGE_CONFIG_KEYS.HNSW_EF_SEARCH]: 'limits',
  [STORAGE_CONFIG_KEYS.IVFFLAT_PROBES]: 'limits',

  // Schema management
  [STORAGE_CONFIG_KEYS.AUTO_MIGRATE]: 'features',
  [STORAGE_CONFIG_KEYS.TARGET_SCHEMA_VERSION]: 'limits',

  // Query limits
  [STORAGE_CONFIG_KEYS.DEFAULT_PAGE_SIZE]: 'limits',
  [STORAGE_CONFIG_KEYS.MAX_PAGE_SIZE]: 'limits',
  [STORAGE_CONFIG_KEYS.MAX_VECTOR_RESULTS]: 'limits',
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the category for a storage config key
 */
export function getStorageConfigCategory(key: StorageConfigKey): ConfigCategory {
  return STORAGE_CONFIG_CATEGORIES[key];
}

/**
 * Get a storage default value
 */
export function getStorageDefault<T>(key: StorageConfigKey): T {
  const defaults = getStorageDefaults();
  return defaults[key] as T;
}

/**
 * Build a connection URL from individual parameters
 */
export function buildConnectionUrl(params: {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
}): string {
  const { host, port, database, user, password } = params;
  const auth = password ? `${user}:${password}` : user;
  return `postgresql://${auth}@${host}:${port}/${database}`;
}

/**
 * Seed storage defaults into ConfigManager
 */
export async function seedStorageDefaults(
  configManager: { set: (category: ConfigCategory, key: string, value: unknown) => Promise<void> }
): Promise<void> {
  const defaults = getStorageDefaults();
  for (const [key, value] of Object.entries(defaults)) {
    // Skip password - should come from environment
    if (key === STORAGE_CONFIG_KEYS.DB_PASSWORD) continue;

    const category = STORAGE_CONFIG_CATEGORIES[key as StorageConfigKey];
    if (category && value !== undefined) {
      await configManager.set(category, key, value);
    }
  }
}
