/**
 * Content Buffer Types
 *
 * Type definitions for the API-first buffer system with full provenance tracking.
 * Enables content to flow between Archive, Buffer, and Book with transformation lineage.
 *
 * @module @humanizer/core/buffer/types
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT BUFFER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Content format types for buffers
 * Note: Named BufferContentFormat to avoid conflict with storage ContentFormat
 */
export type BufferContentFormat = 'text' | 'markdown' | 'html' | 'code';

/**
 * Buffer lifecycle states
 */
export type BufferState = 'transient' | 'staged' | 'committed' | 'archived';

/**
 * ContentBuffer - Immutable wrapper with provenance
 *
 * Each transformation creates a NEW buffer; buffers are never mutated.
 * Content is addressed by SHA-256 hash for deduplication.
 */
export interface ContentBuffer {
  /** Unique buffer ID (UUID) */
  id: string;

  /** SHA-256 hash of text content for deduplication */
  contentHash: string;

  /** The text content */
  text: string;

  /** Word count */
  wordCount: number;

  /** Content format */
  format: BufferContentFormat;

  /** Buffer lifecycle state */
  state: BufferState;

  /** Where the content originated */
  origin: BufferOrigin;

  /** Full transformation history */
  provenanceChain: ProvenanceChain;

  /** Quality metrics (computed lazily) */
  qualityMetrics?: QualityMetrics;

  /** Embedding vector (computed lazily) */
  embedding?: number[];

  /** Creation timestamp (epoch ms) */
  createdAt: number;

  /** Last update timestamp (epoch ms) */
  updatedAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER ORIGIN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Source types for buffer origin
 */
export type SourceType = 'archive' | 'book' | 'manual' | 'generated';

/**
 * Node types that can be sources
 */
export type SourceNodeType = 'StoredNode' | 'BookNode';

/**
 * Author roles for buffer origin
 * Note: Aliased from storage types to avoid conflict
 */
export type BufferAuthorRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * BufferOrigin - Where content came from
 *
 * Tracks the original source of content for provenance.
 */
export interface BufferOrigin {
  /** Type of source (archive, book, manual entry, generated) */
  sourceType: SourceType;

  /** ID of the source node (StoredNode or BookNode) */
  sourceNodeId?: string;

  /** Type of source node */
  sourceNodeType?: SourceNodeType;

  /** Thread/conversation root ID */
  threadRootId?: string;

  /** Book context if from a book */
  bookContext?: BookContext;

  /** Platform the content came from (e.g., 'chatgpt', 'claude') */
  sourcePlatform?: string;

  /** Author of the original content */
  author?: string;

  /** Role of the author */
  authorRole?: BufferAuthorRole;

  /** Additional origin metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Book context for origin tracking
 */
export interface BookContext {
  bookId: string;
  bookTitle: string;
  chapterId?: string;
  chapterTitle?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Types of operations that can be performed on buffers
 */
export type BufferOperationType =
  | 'load_archive'       // Loaded from archive
  | 'load_book'          // Loaded from book
  | 'create_manual'      // Manually created
  | 'rewrite_persona'    // Rewritten for persona/style
  | 'rewrite_humanize'   // Humanization pass
  | 'merge'              // Multiple buffers merged
  | 'split'              // Buffer split into multiple
  | 'analyze_quality'    // Quality analysis performed
  | 'detect_ai'          // AI detection performed
  | 'embed'              // Embedding generated
  | 'commit_book'        // Committed to book
  | 'export_archive'     // Exported to archive
  | 'transform_custom';  // Custom transformation

/**
 * Who or what performed an operation
 */
export interface OperationPerformer {
  /** Type of performer (user, agent, system) */
  type: 'user' | 'agent' | 'system';

  /** ID of the performer */
  id: string;

  /** Model ID if performed by an LLM */
  modelId?: string;

  /** Prompt ID if a prompt was used */
  promptId?: string;
}

/**
 * Hash information for operation tracking
 */
export interface OperationHashes {
  /** Content hash before operation */
  beforeHash: string;

  /** Content hash after operation */
  afterHash: string;

  /** Hash of the delta/diff (optional) */
  deltaHash?: string;
}

/**
 * Quality impact of an operation
 */
export interface QualityImpact {
  /** Change in overall quality score */
  scoreChange: number;

  /** Which metrics were affected */
  metricsAffected: string[];

  /** Issues that were fixed */
  issuesFixed: string[];

  /** Issues that were introduced */
  issuesIntroduced: string[];
}

/**
 * BufferOperation - Records what happened to a buffer
 *
 * Each operation is an immutable record in the provenance chain.
 */
export interface BufferOperation {
  /** Operation ID (UUID) */
  id: string;

  /** Type of operation */
  type: BufferOperationType;

  /** When the operation occurred (epoch ms) */
  timestamp: number;

  /** Who/what performed the operation */
  performer: OperationPerformer;

  /** Operation parameters */
  parameters: Record<string, unknown>;

  /** Before/after content hashes */
  hashes: OperationHashes;

  /** Impact on quality metrics */
  qualityImpact?: QualityImpact;

  /** Human-readable description of what was done */
  description: string;

  /** Operation duration (ms) */
  durationMs?: number;

  /** Cost in cents (for LLM operations) */
  costCents?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVENANCE CHAIN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Branch information for provenance chains
 */
export interface ProvenanceBranch {
  /** Branch name */
  name: string;

  /** Branch description */
  description?: string;

  /** Whether this is the main branch */
  isMain: boolean;
}

/**
 * ProvenanceChain - Linked list of transformations
 *
 * Tracks the full history of a buffer through all operations.
 * Supports branching for parallel experimentation.
 */
export interface ProvenanceChain {
  /** Chain ID (UUID) */
  id: string;

  /** ID of the original/root buffer in this chain */
  rootBufferId: string;

  /** ID of the current/latest buffer in this chain */
  currentBufferId: string;

  /** All operations in this chain (ordered) */
  operations: BufferOperation[];

  /** Branch information */
  branch: ProvenanceBranch;

  /** Parent chain ID (if this is a branch) */
  parentChainId?: string;

  /** Child chain IDs (branches from this chain) */
  childChainIds: string[];

  /** Total number of transformations */
  transformationCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUALITY METRICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * AI detection result
 */
export interface AIDetectionResult {
  /** Overall AI probability (0-1) */
  probability: number;

  /** AI-tell phrases detected */
  tells: Array<{
    phrase: string;
    category: string;
    confidence: number;
  }>;

  /** Confidence in the detection */
  confidence: number;
}

/**
 * Readability metrics
 */
export interface ReadabilityMetrics {
  /** Flesch-Kincaid grade level */
  fleschKincaidGrade: number;

  /** Flesch reading ease score */
  fleschReadingEase: number;

  /** Average sentence length */
  avgSentenceLength: number;

  /** Average word length */
  avgWordLength: number;
}

/**
 * Voice consistency metrics
 */
export interface VoiceMetrics {
  /** Consistency with persona (0-1) */
  personaConsistency?: number;

  /** Persona ID compared against */
  personaId?: string;

  /** Formality level (0=casual, 1=formal) */
  formalityLevel: number;

  /** Detected tone */
  detectedTone: string;
}

/**
 * QualityMetrics - Computed quality analysis for a buffer
 */
export interface QualityMetrics {
  /** Overall quality score (0-1) */
  overallScore: number;

  /** AI detection results */
  aiDetection?: AIDetectionResult;

  /** Readability metrics */
  readability?: ReadabilityMetrics;

  /** Voice consistency metrics */
  voice?: VoiceMetrics;

  /** Issues detected */
  issues: QualityIssue[];

  /** When metrics were computed */
  computedAt: number;
}

/**
 * A quality issue detected in content
 */
export interface QualityIssue {
  /** Issue type */
  type: 'ai_tell' | 'readability' | 'voice' | 'structure' | 'length' | 'other';

  /** Severity (0-1) */
  severity: number;

  /** Issue description */
  description: string;

  /** Location in text (character offset) */
  location?: {
    start: number;
    end: number;
  };

  /** Suggested fix */
  suggestedFix?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for loading content from archive
 */
export interface LoadFromArchiveOptions {
  /** Include embedding if available */
  includeEmbedding?: boolean;

  /** Compute quality metrics on load */
  computeQuality?: boolean;

  /** Initial buffer state */
  initialState?: BufferState;
}

/**
 * Options for loading content from book
 */
export interface LoadFromBookOptions {
  /** Include embedding if available */
  includeEmbedding?: boolean;

  /** Compute quality metrics on load */
  computeQuality?: boolean;

  /** Initial buffer state */
  initialState?: BufferState;
}

/**
 * Options for creating a buffer from text
 */
export interface CreateFromTextOptions {
  /** Content format */
  format?: BufferContentFormat;

  /** Initial buffer state */
  initialState?: BufferState;

  /** Source platform */
  sourcePlatform?: string;

  /** Author */
  author?: string;

  /** Author role */
  authorRole?: BufferAuthorRole;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Transform request for generic transformations
 */
export interface TransformRequest {
  /** Type of transformation */
  type: BufferOperationType;

  /** Transformation parameters */
  parameters: Record<string, unknown>;

  /** Description of the transformation */
  description?: string;
}

/**
 * Options for splitting a buffer
 */
export interface SplitOptions {
  /** Split strategy */
  strategy: 'sentences' | 'paragraphs' | 'fixed_length' | 'semantic';

  /** Maximum chunk size (for fixed_length) */
  maxChunkSize?: number;

  /** Overlap between chunks (for fixed_length) */
  overlap?: number;
}

/**
 * Options for merging buffers
 */
export interface MergeOptions {
  /** How to join the buffers */
  joinWith?: string;

  /** Preserve individual provenance chains */
  preserveProvenance?: boolean;
}

/**
 * Options for committing to book
 */
export interface CommitToBookOptions {
  /** Position in chapter */
  position?: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for exporting to archive
 */
export interface ExportToArchiveOptions {
  /** Node type to create */
  nodeType?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of finding derived buffers
 */
export interface DerivedBufferResult {
  /** The derived buffer */
  buffer: ContentBuffer;

  /** Distance from the source buffer (number of operations) */
  distance: number;

  /** The operation that created this derived buffer */
  derivingOperation: BufferOperation;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Serialized content buffer for persistence
 */
export interface SerializedContentBuffer {
  id: string;
  contentHash: string;
  text: string;
  wordCount: number;
  format: BufferContentFormat;
  state: BufferState;
  origin: BufferOrigin;
  qualityMetrics?: QualityMetrics;
  embedding?: number[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Serialized provenance chain for persistence
 */
export interface SerializedProvenanceChain {
  id: string;
  rootBufferId: string;
  currentBufferId: string;
  branch: ProvenanceBranch;
  parentChainId?: string;
  childChainIds: string[];
  transformationCount: number;
}

/**
 * Serialized operation for persistence
 */
export interface SerializedBufferOperation {
  id: string;
  chainId: string;
  sequenceNumber: number;
  type: BufferOperationType;
  timestamp: number;
  performer: OperationPerformer;
  parameters: Record<string, unknown>;
  hashes: OperationHashes;
  qualityImpact?: QualityImpact;
  description: string;
  durationMs?: number;
  costCents?: number;
}
