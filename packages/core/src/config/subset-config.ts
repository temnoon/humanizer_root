/**
 * Archive Subset Configuration
 *
 * Centralizes all subset-related configuration keys and defaults.
 * Includes settings for:
 * - Sensitivity detection
 * - Export options
 * - Filtering defaults
 *
 * Usage:
 * ```typescript
 * import { SUBSET_CONFIG_KEYS, SUBSET_DEFAULTS } from './subset-config';
 * import { getConfigManager } from './in-memory-config';
 *
 * const config = getConfigManager();
 * const maxSensitivity = await config.get('subset', SUBSET_CONFIG_KEYS.DEFAULT_MAX_SENSITIVITY)
 *   ?? SUBSET_DEFAULTS[SUBSET_CONFIG_KEYS.DEFAULT_MAX_SENSITIVITY];
 * ```
 *
 * @module config/subset-config
 */

import type { SensitivityLevel, SubsetExportFormat, SubsetSharingMode } from '../aui/types/subset-types';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration keys for subset-related settings.
 * Use these with ConfigManager instead of hardcoding strings.
 */
export const SUBSET_CONFIG_KEYS = {
  // ─────────────────────────────────────────────────────────────────
  // Sensitivity Detection
  // ─────────────────────────────────────────────────────────────────

  /** Enable sensitivity detection during subset evaluation (default: true) */
  ENABLE_SENSITIVITY_DETECTION: 'subset.enableSensitivityDetection',

  /** Minimum confidence for sensitivity detection (default: 0.7) */
  SENSITIVITY_MIN_CONFIDENCE: 'subset.sensitivityMinConfidence',

  /** Default sensitivity level for unclassified content (default: 'public') */
  DEFAULT_SENSITIVITY: 'subset.defaultSensitivity',

  /** Default maximum sensitivity to include in new subsets (default: 'private') */
  DEFAULT_MAX_SENSITIVITY: 'subset.defaultMaxSensitivity',

  /** Default action for sensitive content (default: 'exclude') */
  DEFAULT_SENSITIVE_ACTION: 'subset.defaultSensitiveAction',

  // ─────────────────────────────────────────────────────────────────
  // Export Settings
  // ─────────────────────────────────────────────────────────────────

  /** Default export format (default: 'json') */
  DEFAULT_EXPORT_FORMAT: 'subset.defaultExportFormat',

  /** Default sharing mode (default: 'private') */
  DEFAULT_SHARING_MODE: 'subset.defaultSharingMode',

  /** Enable encryption by default (default: false) */
  DEFAULT_ENCRYPTION_ENABLED: 'subset.defaultEncryptionEnabled',

  /** Default encryption algorithm (default: 'aes-256-gcm') */
  DEFAULT_ENCRYPTION_ALGORITHM: 'subset.defaultEncryptionAlgorithm',

  // ─────────────────────────────────────────────────────────────────
  // Processing Settings
  // ─────────────────────────────────────────────────────────────────

  /** Batch size for building mappings (default: 500) */
  MAPPING_BATCH_SIZE: 'subset.mappingBatchSize',

  /** Maximum nodes to evaluate for stats (default: 10000) */
  MAX_EVALUATION_SAMPLE: 'subset.maxEvaluationSample',

  /** Export batch size (default: 100) */
  EXPORT_BATCH_SIZE: 'subset.exportBatchSize',

  // ─────────────────────────────────────────────────────────────────
  // Cloud Storage
  // ─────────────────────────────────────────────────────────────────

  /** Default cloud provider (default: 'local') */
  DEFAULT_CLOUD_PROVIDER: 'subset.defaultCloudProvider',

  /** Cloudflare R2 bucket name (required for R2) */
  R2_BUCKET_NAME: 'subset.r2BucketName',

  /** Cloudflare R2 account ID (required for R2) */
  R2_ACCOUNT_ID: 'subset.r2AccountId',

  /** Google Drive folder ID (required for Google Drive) */
  GDRIVE_FOLDER_ID: 'subset.gdriveFolderId',

  /** Local export directory (default: './exports') */
  LOCAL_EXPORT_PATH: 'subset.localExportPath',

  // ─────────────────────────────────────────────────────────────────
  // Redaction Settings
  // ─────────────────────────────────────────────────────────────────

  /** Format for redacted content (default: '[REDACTED:{type}]') */
  REDACTION_FORMAT: 'subset.redactionFormat',

  /** Show redaction reason type (default: true) */
  SHOW_REDACTION_TYPE: 'subset.showRedactionType',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default values for subset configuration.
 * Used as fallback when ConfigManager doesn't have a value.
 */
export const SUBSET_DEFAULTS: Record<string, string | number | boolean> = {
  // Sensitivity Detection
  [SUBSET_CONFIG_KEYS.ENABLE_SENSITIVITY_DETECTION]: true,
  [SUBSET_CONFIG_KEYS.SENSITIVITY_MIN_CONFIDENCE]: 0.7,
  [SUBSET_CONFIG_KEYS.DEFAULT_SENSITIVITY]: 'public',
  [SUBSET_CONFIG_KEYS.DEFAULT_MAX_SENSITIVITY]: 'private',
  [SUBSET_CONFIG_KEYS.DEFAULT_SENSITIVE_ACTION]: 'exclude',

  // Export Settings
  [SUBSET_CONFIG_KEYS.DEFAULT_EXPORT_FORMAT]: 'json',
  [SUBSET_CONFIG_KEYS.DEFAULT_SHARING_MODE]: 'private',
  [SUBSET_CONFIG_KEYS.DEFAULT_ENCRYPTION_ENABLED]: false,
  [SUBSET_CONFIG_KEYS.DEFAULT_ENCRYPTION_ALGORITHM]: 'aes-256-gcm',

  // Processing Settings
  [SUBSET_CONFIG_KEYS.MAPPING_BATCH_SIZE]: 500,
  [SUBSET_CONFIG_KEYS.MAX_EVALUATION_SAMPLE]: 10000,
  [SUBSET_CONFIG_KEYS.EXPORT_BATCH_SIZE]: 100,

  // Cloud Storage
  [SUBSET_CONFIG_KEYS.DEFAULT_CLOUD_PROVIDER]: 'local',
  [SUBSET_CONFIG_KEYS.R2_BUCKET_NAME]: '',
  [SUBSET_CONFIG_KEYS.R2_ACCOUNT_ID]: '',
  [SUBSET_CONFIG_KEYS.GDRIVE_FOLDER_ID]: '',
  [SUBSET_CONFIG_KEYS.LOCAL_EXPORT_PATH]: './exports',

  // Redaction Settings
  [SUBSET_CONFIG_KEYS.REDACTION_FORMAT]: '[REDACTED:{type}]',
  [SUBSET_CONFIG_KEYS.SHOW_REDACTION_TYPE]: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get subset config value with type safety
 */
export function getSubsetDefault<K extends keyof typeof SUBSET_CONFIG_KEYS>(
  key: K
): (typeof SUBSET_DEFAULTS)[typeof SUBSET_CONFIG_KEYS[K]] {
  return SUBSET_DEFAULTS[SUBSET_CONFIG_KEYS[key]];
}

/**
 * Valid sensitivity levels for configuration
 */
export const VALID_SENSITIVITY_LEVELS: SensitivityLevel[] = [
  'public',
  'internal',
  'private',
  'sensitive',
];

/**
 * Validate sensitivity level value
 */
export function isValidSensitivityLevel(value: string): value is SensitivityLevel {
  return VALID_SENSITIVITY_LEVELS.includes(value as SensitivityLevel);
}

/**
 * Valid export formats
 */
export const VALID_EXPORT_FORMATS: SubsetExportFormat[] = [
  'json',
  'jsonl',
  'markdown',
  'html',
  'sqlite',
  'archive',
];

/**
 * Validate export format value
 */
export function isValidExportFormat(value: string): value is SubsetExportFormat {
  return VALID_EXPORT_FORMATS.includes(value as SubsetExportFormat);
}

/**
 * Valid sharing modes
 */
export const VALID_SHARING_MODES: SubsetSharingMode[] = [
  'private',
  'zero-trust',
  'link-only',
  'public',
];

/**
 * Validate sharing mode value
 */
export function isValidSharingMode(value: string): value is SubsetSharingMode {
  return VALID_SHARING_MODES.includes(value as SubsetSharingMode);
}

/**
 * Sensitivity level ordering (for comparison)
 */
export const SENSITIVITY_ORDER: Record<SensitivityLevel, number> = {
  public: 0,
  internal: 1,
  private: 2,
  sensitive: 3,
};

/**
 * Compare sensitivity levels
 * Returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareSensitivity(a: SensitivityLevel, b: SensitivityLevel): number {
  return SENSITIVITY_ORDER[a] - SENSITIVITY_ORDER[b];
}
