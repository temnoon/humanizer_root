/**
 * Archive Subset Types
 *
 * Type definitions for filtered archive subsets with:
 * - Content filtering by date, tags, source type, sensitivity
 * - Sensitive content detection and redaction
 * - Export configuration for cloud storage sharing
 * - Provenance tracking for subset lineage
 *
 * @module @humanizer/core/aui/types/subset-types
 */

// ═══════════════════════════════════════════════════════════════════
// SENSITIVITY CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Sensitivity levels for content classification
 *
 * Used to filter what content can be included in public/shared subsets.
 * Detection is automatic based on patterns + optional manual overrides.
 */
export type SensitivityLevel =
  | 'public'      // Safe for public sharing (post-social nodes)
  | 'internal'    // Internal use only (named individuals, work context)
  | 'private'     // Private (personal details, relationships)
  | 'sensitive';  // Highly sensitive (credentials, health, financial)

/**
 * Detected sensitive content marker
 */
export interface SensitiveContentMarker {
  /** Start character offset in text */
  start: number;
  /** End character offset in text */
  end: number;
  /** Type of sensitive content detected */
  type: SensitiveContentType;
  /** Confidence of detection (0-1) */
  confidence: number;
  /** Optional replacement text for redaction */
  redactedText?: string;
  /** Manual override by user */
  userOverride?: 'keep' | 'redact' | 'reclassify';
  /** Override sensitivity level */
  overrideLevel?: SensitivityLevel;
}

/**
 * Types of sensitive content that can be detected
 */
export type SensitiveContentType =
  // Identity
  | 'full_name'
  | 'email_address'
  | 'phone_number'
  | 'physical_address'
  | 'date_of_birth'
  | 'government_id'
  // Financial
  | 'credit_card'
  | 'bank_account'
  | 'financial_amount'
  // Technical
  | 'api_key'
  | 'password'
  | 'secret_token'
  | 'private_key'
  | 'connection_string'
  // Personal
  | 'health_info'
  | 'relationship_detail'
  | 'location_history'
  | 'workplace_detail'
  // Custom
  | 'custom_pattern';

// ═══════════════════════════════════════════════════════════════════
// FILTER CRITERIA
// ═══════════════════════════════════════════════════════════════════

/**
 * Criteria for filtering content into a subset
 */
export interface SubsetFilterCriteria {
  // ─────────────────────────────────────────────────────────────────
  // Date Filtering
  // ─────────────────────────────────────────────────────────────────

  /** Only include content from this date forward (epoch ms) */
  dateFrom?: number;
  /** Only include content up to this date (epoch ms) */
  dateTo?: number;

  // ─────────────────────────────────────────────────────────────────
  // Source Filtering
  // ─────────────────────────────────────────────────────────────────

  /** Include only these source types (chatgpt, claude, facebook, etc.) */
  sourceTypes?: string[];
  /** Exclude these source types */
  excludeSourceTypes?: string[];
  /** Include only content from these adapters */
  adapterIds?: string[];
  /** Include only content from these import jobs */
  importJobIds?: string[];

  // ─────────────────────────────────────────────────────────────────
  // Content Filtering
  // ─────────────────────────────────────────────────────────────────

  /** Include only these author roles */
  authorRoles?: ('user' | 'assistant' | 'system' | 'tool')[];
  /** Include only content at these hierarchy levels */
  hierarchyLevels?: number[];
  /** Minimum word count */
  minWordCount?: number;
  /** Maximum word count */
  maxWordCount?: number;

  // ─────────────────────────────────────────────────────────────────
  // Tag Filtering
  // ─────────────────────────────────────────────────────────────────

  /** Include content with ANY of these tags */
  includeTags?: string[];
  /** Include content with ALL of these tags */
  requireTags?: string[];
  /** Exclude content with ANY of these tags */
  excludeTags?: string[];

  // ─────────────────────────────────────────────────────────────────
  // Conversation/Thread Filtering
  // ─────────────────────────────────────────────────────────────────

  /** Include only these specific thread/conversation IDs */
  threadRootIds?: string[];
  /** Exclude these specific thread/conversation IDs */
  excludeThreadRootIds?: string[];
  /** Include only conversations matching this title pattern (regex) */
  titlePattern?: string;

  // ─────────────────────────────────────────────────────────────────
  // Sensitivity Filtering
  // ─────────────────────────────────────────────────────────────────

  /** Maximum sensitivity level to include (default: 'private') */
  maxSensitivity?: SensitivityLevel;
  /** Exclude content with these detected sensitive types */
  excludeSensitiveTypes?: SensitiveContentType[];
  /** Action for sensitive content: exclude, redact, or include */
  sensitiveContentAction?: 'exclude' | 'redact' | 'include';

  // ─────────────────────────────────────────────────────────────────
  // Quality Filtering
  // ─────────────────────────────────────────────────────────────────

  /** Minimum excellence tier (excellence, polished, needs_refinement, raw_gem, noise) */
  minExcellenceTier?: string;
  /** Exclude content detected as having pasted content */
  excludePastedContent?: boolean;
  /** Maximum paste confidence to include (0-1) */
  maxPasteConfidence?: number;

  // ─────────────────────────────────────────────────────────────────
  // Deduplication
  // ─────────────────────────────────────────────────────────────────

  /** Skip content that duplicates earlier content (by paragraph hash) */
  deduplicateByParagraph?: boolean;
  /** Include only first occurrence of duplicated content */
  keepFirstOccurrence?: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Search/Semantic Filtering
  // ─────────────────────────────────────────────────────────────────

  /** Full-text search query (must match) */
  searchText?: string;
  /** Semantic search query (vector similarity) */
  semanticQuery?: string;
  /** Minimum semantic similarity threshold (0-1) */
  semanticThreshold?: number;
  /** Include only content in these cluster IDs */
  clusterIds?: string[];
}

// ═══════════════════════════════════════════════════════════════════
// SUBSET DEFINITION
// ═══════════════════════════════════════════════════════════════════

/**
 * Archive subset definition - a saved filter configuration
 */
export interface ArchiveSubset {
  /** Unique identifier (UUID) */
  id: string;
  /** User who owns this subset */
  userId?: string;
  /** Human-readable name */
  name: string;
  /** Description of what this subset contains */
  description?: string;
  /** Filter criteria for this subset */
  criteria: SubsetFilterCriteria;
  /** Current status */
  status: SubsetStatus;

  // ─────────────────────────────────────────────────────────────────
  // Export Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Target export format */
  exportFormat?: SubsetExportFormat;
  /** Cloud storage destination */
  cloudDestination?: CloudDestination;
  /** Sharing mode */
  sharingMode?: SubsetSharingMode;
  /** Encryption settings for export */
  encryption?: SubsetEncryption;

  // ─────────────────────────────────────────────────────────────────
  // Statistics (computed)
  // ─────────────────────────────────────────────────────────────────

  /** Total nodes matching criteria */
  nodeCount?: number;
  /** Total word count */
  totalWordCount?: number;
  /** Date range of content */
  dateRange?: {
    earliest?: number;
    latest?: number;
  };
  /** Source type distribution */
  sourceDistribution?: Record<string, number>;
  /** Sensitivity level distribution */
  sensitivityDistribution?: Record<SensitivityLevel, number>;

  // ─────────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────────

  /** When this subset was created */
  createdAt: number;
  /** When this subset was last updated */
  updatedAt: number;
  /** When this subset was last exported */
  lastExportedAt?: number;
  /** When criteria were last evaluated */
  lastEvaluatedAt?: number;
}

/**
 * Subset lifecycle status
 */
export type SubsetStatus =
  | 'draft'       // Definition being edited
  | 'active'      // Ready for use/export
  | 'exporting'   // Export in progress
  | 'exported'    // Successfully exported
  | 'archived';   // No longer in use

/**
 * Export format options
 */
export type SubsetExportFormat =
  | 'json'        // Raw JSON (full fidelity)
  | 'jsonl'       // JSON Lines (streaming)
  | 'markdown'    // Markdown documents
  | 'html'        // HTML documents
  | 'sqlite'      // SQLite database
  | 'archive';    // Full archive format with media

/**
 * Cloud storage destinations
 */
export interface CloudDestination {
  /** Storage provider */
  provider: 'cloudflare-r2' | 'google-drive' | 's3' | 'local';
  /** Bucket/folder path */
  path: string;
  /** Access configuration reference (not the actual credentials) */
  configRef?: string;
  /** Public URL after export (if applicable) */
  publicUrl?: string;
}

/**
 * Sharing mode for exported subsets
 */
export type SubsetSharingMode =
  | 'private'         // Only owner can access
  | 'zero-trust'      // Cloudflare Zero Trust protected
  | 'link-only'       // Anyone with link can access
  | 'public';         // Publicly listed on post-social node

/**
 * Encryption settings for exported subsets
 */
export interface SubsetEncryption {
  /** Enable encryption */
  enabled: boolean;
  /** Encryption algorithm */
  algorithm?: 'aes-256-gcm' | 'aes-256-cbc';
  /** Key derivation (if password-based) */
  keyDerivation?: 'pbkdf2' | 'scrypt';
}

// ═══════════════════════════════════════════════════════════════════
// SUBSET NODE MAPPING
// ═══════════════════════════════════════════════════════════════════

/**
 * Maps a node to a subset with optional modifications
 */
export interface SubsetNodeMapping {
  /** Subset ID */
  subsetId: string;
  /** Original node ID */
  nodeId: string;
  /** Position in subset (for ordering) */
  position?: number;
  /** Detected sensitivity markers */
  sensitivityMarkers?: SensitiveContentMarker[];
  /** Computed sensitivity level */
  sensitivityLevel: SensitivityLevel;
  /** Whether content was redacted for this subset */
  redacted: boolean;
  /** Hash of redacted content (if different from original) */
  redactedContentHash?: string;
  /** Manual inclusion/exclusion override */
  userOverride?: 'include' | 'exclude';
  /** Reason for override */
  overrideReason?: string;
  /** When this mapping was created */
  createdAt: number;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT JOB
// ═══════════════════════════════════════════════════════════════════

/**
 * Tracks subset export operations
 */
export interface SubsetExportJob {
  /** Job ID */
  id: string;
  /** Subset being exported */
  subsetId: string;
  /** User who initiated export */
  userId?: string;
  /** Current status */
  status: ExportJobStatus;
  /** Export format */
  format: SubsetExportFormat;
  /** Destination */
  destination: CloudDestination;

  // Progress
  /** Total nodes to export */
  totalNodes: number;
  /** Nodes exported so far */
  exportedNodes: number;
  /** Nodes that failed */
  failedNodes: number;
  /** Nodes redacted */
  redactedNodes: number;

  // Timing
  /** When job started */
  startedAt?: number;
  /** When job completed */
  completedAt?: number;
  /** Estimated completion time */
  estimatedCompletionAt?: number;

  // Result
  /** Export file path/URL */
  outputPath?: string;
  /** Export file size in bytes */
  outputSizeBytes?: number;
  /** Error message if failed */
  error?: string;

  /** When this job was created */
  createdAt: number;
}

/**
 * Export job status
 */
export type ExportJobStatus =
  | 'pending'     // Queued for processing
  | 'scanning'    // Evaluating criteria, counting nodes
  | 'exporting'   // Writing nodes to output
  | 'uploading'   // Uploading to cloud destination
  | 'completed'   // Successfully finished
  | 'failed'      // Failed with error
  | 'cancelled';  // Cancelled by user

// ═══════════════════════════════════════════════════════════════════
// SENSITIVITY DETECTION CONFIG
// ═══════════════════════════════════════════════════════════════════

/**
 * Configuration for sensitive content detection
 */
export interface SensitivityDetectionConfig {
  /** Enable/disable detection */
  enabled: boolean;
  /** Types to detect */
  detectTypes: SensitiveContentType[];
  /** Custom regex patterns */
  customPatterns?: Array<{
    name: string;
    pattern: string;
    type: SensitiveContentType;
    sensitivity: SensitivityLevel;
  }>;
  /** Minimum confidence to flag (0-1) */
  minConfidence: number;
  /** Default sensitivity for unclassified content */
  defaultSensitivity: SensitivityLevel;
}

// ═══════════════════════════════════════════════════════════════════
// STATS & REPORTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Statistics about a subset
 */
export interface SubsetStats {
  /** Subset ID */
  subsetId: string;
  /** Total nodes matching criteria */
  totalNodes: number;
  /** Nodes by source type */
  nodesBySource: Record<string, number>;
  /** Nodes by author role */
  nodesByRole: Record<string, number>;
  /** Nodes by sensitivity level */
  nodesBySensitivity: Record<SensitivityLevel, number>;
  /** Total word count */
  totalWordCount: number;
  /** Average word count per node */
  avgWordCount: number;
  /** Date range */
  dateRange: {
    earliest?: number;
    latest?: number;
  };
  /** Number of unique conversations/threads */
  uniqueThreads: number;
  /** Nodes with media attachments */
  nodesWithMedia: number;
  /** Nodes that would be redacted */
  redactableNodes: number;
  /** When stats were computed */
  computedAt: number;
}

/**
 * Comparison between two subsets
 */
export interface SubsetComparison {
  /** First subset ID */
  subsetA: string;
  /** Second subset ID */
  subsetB: string;
  /** Nodes only in A */
  onlyInA: number;
  /** Nodes only in B */
  onlyInB: number;
  /** Nodes in both */
  intersection: number;
  /** Union of both */
  union: number;
  /** Jaccard similarity coefficient */
  similarity: number;
}
