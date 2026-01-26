/**
 * Import Configuration
 *
 * Centralizes all import-related configuration keys and defaults.
 * Includes settings for:
 * - Media-text enrichment
 * - Excellence scoring integration
 * - Paste detection
 * - Deduplication
 *
 * Usage:
 * ```typescript
 * import { IMPORT_CONFIG_KEYS, IMPORT_DEFAULTS } from './import-config';
 * import { getConfigManager } from './in-memory-config';
 *
 * const config = getConfigManager();
 * const enrichEnabled = await config.get('import', IMPORT_CONFIG_KEYS.ENRICH_WITH_TRANSCRIPTS)
 *   ?? IMPORT_DEFAULTS[IMPORT_CONFIG_KEYS.ENRICH_WITH_TRANSCRIPTS];
 * ```
 *
 * @module config/import-config
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration keys for import-related settings.
 * Use these with ConfigManager instead of hardcoding strings.
 */
export const IMPORT_CONFIG_KEYS = {
  // ─────────────────────────────────────────────────────────────────
  // Enrichment Settings
  // ─────────────────────────────────────────────────────────────────

  /** Include OCR transcripts in enriched content (default: true) */
  ENRICH_WITH_TRANSCRIPTS: 'import.enrichWithTranscripts',

  /** Include AI descriptions in enriched content (default: true) */
  ENRICH_WITH_DESCRIPTIONS: 'import.enrichWithDescriptions',

  /** Include user captions in enriched content (default: true) */
  ENRICH_WITH_CAPTIONS: 'import.enrichWithCaptions',

  /** Minimum confidence for including media-text in enrichment (default: 0.7) */
  MIN_TRANSCRIPT_CONFIDENCE: 'import.minTranscriptConfidence',

  /** Maximum combined content length after enrichment (default: 10000) */
  MAX_ENRICHED_LENGTH: 'import.maxEnrichedLength',

  /** Separator between content sections in enriched output (default: '\n\n---\n\n') */
  SECTION_SEPARATOR: 'import.sectionSeparator',

  // ─────────────────────────────────────────────────────────────────
  // Excellence Integration
  // ─────────────────────────────────────────────────────────────────

  /** Run excellence scoring during import (default: true) */
  SCORE_ON_IMPORT: 'import.scoreOnImport',

  /** Minimum excellence tier for inclusion (default: 'needs_refinement') */
  MIN_EXCELLENCE_TIER: 'import.minExcellenceTier',

  /** Filter out nodes below minimum tier (default: false) */
  FILTER_BY_TIER: 'import.filterByTier',

  // ─────────────────────────────────────────────────────────────────
  // Media-Text Extraction
  // ─────────────────────────────────────────────────────────────────

  /** Extract media-text associations (default: true) */
  EXTRACT_MEDIA_TEXT: 'import.extractMediaText',

  /** Only process known gizmos for media-text (default: true) */
  GIZMO_ONLY: 'import.gizmoOnly',

  // ─────────────────────────────────────────────────────────────────
  // Paste Detection
  // ─────────────────────────────────────────────────────────────────

  /** Detect pasted content in user messages (default: true) */
  DETECT_PASTE: 'import.detectPaste',

  /** Minimum confidence for paste detection (default: 0.5) */
  MIN_PASTE_CONFIDENCE: 'import.minPasteConfidence',

  // ─────────────────────────────────────────────────────────────────
  // Deduplication
  // ─────────────────────────────────────────────────────────────────

  /** Generate paragraph hashes for deduplication (default: true) */
  GENERATE_PARAGRAPH_HASHES: 'import.generateParagraphHashes',

  /** Generate line hashes for copy-paste detection (default: true) */
  GENERATE_LINE_HASHES: 'import.generateLineHashes',

  /** Minimum words for paragraph to be hashed (default: 5) */
  MIN_PARAGRAPH_WORDS: 'import.minParagraphWords',

  /** Minimum chars for line to be hashed (default: 10) */
  MIN_LINE_CHARS: 'import.minLineChars',

  // ─────────────────────────────────────────────────────────────────
  // Embedding
  // ─────────────────────────────────────────────────────────────────

  /** Generate embeddings during import (default: true) */
  GENERATE_EMBEDDINGS: 'import.generateEmbeddings',

  /** Use enriched content for embeddings (default: true) */
  USE_ENRICHED_FOR_EMBEDDING: 'import.useEnrichedForEmbedding',

  // ─────────────────────────────────────────────────────────────────
  // Batch Processing
  // ─────────────────────────────────────────────────────────────────

  /** Batch size for database operations (default: 100) */
  BATCH_SIZE: 'import.batchSize',

  /** Skip nodes that already exist by content hash (default: true) */
  SKIP_EXISTING: 'import.skipExisting',

  /** Enable verbose logging (default: false) */
  VERBOSE: 'import.verbose',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default values for import configuration.
 * Used as fallback when ConfigManager doesn't have a value.
 */
export const IMPORT_DEFAULTS: Record<string, string | number | boolean> = {
  // Enrichment
  [IMPORT_CONFIG_KEYS.ENRICH_WITH_TRANSCRIPTS]: true,
  [IMPORT_CONFIG_KEYS.ENRICH_WITH_DESCRIPTIONS]: true,
  [IMPORT_CONFIG_KEYS.ENRICH_WITH_CAPTIONS]: true,
  [IMPORT_CONFIG_KEYS.MIN_TRANSCRIPT_CONFIDENCE]: 0.7,
  [IMPORT_CONFIG_KEYS.MAX_ENRICHED_LENGTH]: 10000,
  [IMPORT_CONFIG_KEYS.SECTION_SEPARATOR]: '\n\n---\n\n',

  // Excellence
  [IMPORT_CONFIG_KEYS.SCORE_ON_IMPORT]: true,
  [IMPORT_CONFIG_KEYS.MIN_EXCELLENCE_TIER]: 'needs_refinement',
  [IMPORT_CONFIG_KEYS.FILTER_BY_TIER]: false,

  // Media-Text
  [IMPORT_CONFIG_KEYS.EXTRACT_MEDIA_TEXT]: true,
  [IMPORT_CONFIG_KEYS.GIZMO_ONLY]: true,

  // Paste Detection
  [IMPORT_CONFIG_KEYS.DETECT_PASTE]: true,
  [IMPORT_CONFIG_KEYS.MIN_PASTE_CONFIDENCE]: 0.5,

  // Deduplication
  [IMPORT_CONFIG_KEYS.GENERATE_PARAGRAPH_HASHES]: true,
  [IMPORT_CONFIG_KEYS.GENERATE_LINE_HASHES]: true,
  [IMPORT_CONFIG_KEYS.MIN_PARAGRAPH_WORDS]: 5,
  [IMPORT_CONFIG_KEYS.MIN_LINE_CHARS]: 10,

  // Embedding
  [IMPORT_CONFIG_KEYS.GENERATE_EMBEDDINGS]: true,
  [IMPORT_CONFIG_KEYS.USE_ENRICHED_FOR_EMBEDDING]: true,

  // Batch Processing
  [IMPORT_CONFIG_KEYS.BATCH_SIZE]: 100,
  [IMPORT_CONFIG_KEYS.SKIP_EXISTING]: true,
  [IMPORT_CONFIG_KEYS.VERBOSE]: false,
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get import config value with type safety
 */
export function getImportDefault<K extends keyof typeof IMPORT_CONFIG_KEYS>(
  key: K
): (typeof IMPORT_DEFAULTS)[typeof IMPORT_CONFIG_KEYS[K]] {
  return IMPORT_DEFAULTS[IMPORT_CONFIG_KEYS[key]];
}

/**
 * Valid excellence tier values for configuration
 */
export const VALID_EXCELLENCE_TIERS = [
  'excellence',
  'polished',
  'needs_refinement',
  'raw_gem',
  'noise',
] as const;

/**
 * Validate excellence tier value
 */
export function isValidExcellenceTier(value: string): boolean {
  return VALID_EXCELLENCE_TIERS.includes(value as typeof VALID_EXCELLENCE_TIERS[number]);
}
