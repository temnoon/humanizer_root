/**
 * UCG Storage Types
 *
 * Type definitions for the SQLite-backed Universal Content Graph storage.
 * These types bridge the gap between:
 * - ImportedNode (from adapters) - raw parsed content
 * - StoredNode (in database) - persisted with embeddings and indexes
 *
 * Design Principles:
 * 1. Archive-first: Immutable after import, admin CRUD only
 * 2. Source-preserving: All metadata and context references retained
 * 3. Embedding-ready: Schema supports vector search from day one
 * 4. Configurable paths: Support multiple database domains (archive, book studio)
 */

// ═══════════════════════════════════════════════════════════════════
// STORED NODE - Database representation
// ═══════════════════════════════════════════════════════════════════

/**
 * A content node as stored in SQLite.
 *
 * This is the canonical storage format. ImportedNodes from adapters
 * are converted to this format before persistence.
 */
export interface StoredNode {
  // ─────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────

  /** Primary key - UUID v4 */
  id: string;

  /** Content hash for deduplication (SHA-256 of normalized content) */
  contentHash: string;

  /** Unique URI: content://{source}/{type}/{id} */
  uri: string;

  // ─────────────────────────────────────────────────────────────────
  // Content
  // ─────────────────────────────────────────────────────────────────

  /** The actual text content */
  text: string;

  /** Content format */
  format: ContentFormat;

  /** Word count (computed on insert) */
  wordCount: number;

  // ─────────────────────────────────────────────────────────────────
  // Source Tracking
  // ─────────────────────────────────────────────────────────────────

  /** Source platform: 'chatgpt', 'claude', 'facebook', 'twitter', etc. */
  sourceType: string;

  /** Adapter that imported this node */
  sourceAdapter: string;

  /** Original ID in the source system */
  sourceOriginalId?: string;

  /** Original path/location in the source export */
  sourceOriginalPath?: string;

  /** Import job that created this node */
  importJobId?: string;

  // ─────────────────────────────────────────────────────────────────
  // Hierarchy & Threading
  // ─────────────────────────────────────────────────────────────────

  /** Parent node ID (for replies, comments, chunks) */
  parentNodeId?: string;

  /** Position within parent (for ordering siblings) */
  position?: number;

  /** For chunked content: chunk index (0-based) */
  chunkIndex?: number;

  /** For chunked content: character offset start */
  chunkStartOffset?: number;

  /** For chunked content: character offset end */
  chunkEndOffset?: number;

  /**
   * Hierarchy level for pyramid structure:
   * - 0: Base content (messages, chunks)
   * - 1: Summary level (grouped chunks)
   * - 2: Apex level (document summary)
   */
  hierarchyLevel: number;

  /** Thread/conversation root ID for grouping */
  threadRootId?: string;

  // ─────────────────────────────────────────────────────────────────
  // Embedding
  // ─────────────────────────────────────────────────────────────────

  /** Embedding model used (e.g., 'nomic-embed-text') */
  embeddingModel?: string;

  /** When embedding was generated (epoch ms) */
  embeddingAt?: number;

  /** Hash of text used for embedding (staleness detection) */
  embeddingTextHash?: string;

  // ─────────────────────────────────────────────────────────────────
  // Attribution
  // ─────────────────────────────────────────────────────────────────

  /** Title (for conversations, posts) */
  title?: string;

  /** Author identifier */
  author?: string;

  /** Author role: 'user', 'assistant', 'system' */
  authorRole?: AuthorRole;

  /** Tags (JSON array in DB) */
  tags?: string[];

  // ─────────────────────────────────────────────────────────────────
  // Media References
  // ─────────────────────────────────────────────────────────────────

  /** Media attachments (JSON array in DB) */
  mediaRefs?: MediaRef[];

  // ─────────────────────────────────────────────────────────────────
  // Source Metadata
  // ─────────────────────────────────────────────────────────────────

  /** Arbitrary source-specific metadata (JSON in DB) */
  sourceMetadata?: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────────
  // Fine-Grained Deduplication
  // ─────────────────────────────────────────────────────────────────

  /** Paragraph-level hashes for duplicate detection */
  paragraphHashes?: ParagraphHashRecord[];

  /** Line-level hashes for copy-paste detection */
  lineHashes?: LineHashRecord[];

  /** When this content was first seen (provenance tracking) */
  firstSeenAt?: number;

  // ─────────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────────

  /** When created in source system (epoch ms) */
  sourceCreatedAt?: number;

  /** When updated in source system (epoch ms) */
  sourceUpdatedAt?: number;

  /** When stored in our database (epoch ms) */
  createdAt: number;

  /** When imported (epoch ms) */
  importedAt: number;
}

// ═══════════════════════════════════════════════════════════════════
// SUPPORTING TYPES
// ═══════════════════════════════════════════════════════════════════

/** Content format types */
export type ContentFormat = 'text' | 'markdown' | 'html' | 'code' | 'conversation';

/** Author roles */
export type AuthorRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Media reference attached to content
 */
export interface MediaRef {
  /** Media ID */
  id: string;

  /** Media type */
  type: 'image' | 'video' | 'audio' | 'document' | 'other';

  /** MIME type */
  mimeType?: string;

  /** URL or path to media in source */
  sourceUrl?: string;

  /** Local file path (after import) */
  localPath?: string;

  /** File size in bytes */
  size?: number;

  /** Dimensions for images/video */
  dimensions?: { width: number; height: number };

  /** Duration for audio/video (seconds) */
  duration?: number;

  /** Alt text or description */
  alt?: string;

  /** Transcript (for audio/video) */
  transcript?: string;
}

// ═══════════════════════════════════════════════════════════════════
// FINE-GRAINED DEDUPLICATION TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * A hash record for a paragraph (stored in JSONB)
 */
export interface ParagraphHashRecord {
  /** SHA-256 hash of normalized paragraph text */
  hash: string;
  /** Zero-based position of this paragraph in the content */
  position: number;
  /** Character length of the original paragraph */
  length: number;
  /** Word count for filtering short paragraphs */
  wordCount: number;
}

/**
 * A hash record for a line (stored in JSONB)
 */
export interface LineHashRecord {
  /** SHA-256 hash of normalized line text */
  hash: string;
  /** Zero-based position of this line in the content */
  position: number;
  /** The original line text (for debugging/display) */
  text: string;
  /** Character length of the original line */
  length: number;
}

// ═══════════════════════════════════════════════════════════════════
// MEDIA-TEXT ASSOCIATION TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Association types between media and text
 */
export type MediaTextAssociationType =
  | 'ocr'              // OCR transcript from image
  | 'description'      // AI-generated description
  | 'caption'          // User-provided caption
  | 'title'            // Extracted title
  | 'alt-text'         // Alt text for accessibility
  | 'generated-from'   // Image generated from this text
  | 'echo-of';         // Echo/variation of source image

/**
 * A media-text association linking an image to extracted text
 */
export interface MediaTextAssociation {
  /** Association ID */
  id: string;

  /** Media reference ID (from media_refs or file pointer ID) */
  mediaId: string;

  /** Full media pointer (file-service://file-XXX or sediment://file_XXX) */
  mediaPointer?: string;

  /** Node containing the extracted text */
  nodeId?: string;

  /** Start position of text span within node */
  textSpanStart?: number;

  /** End position of text span within node */
  textSpanEnd?: number;

  /** The extracted text itself (denormalized) */
  extractedText?: string;

  /** Type of association */
  associationType: MediaTextAssociationType;

  /** Source media ID (for echo chains) */
  sourceMediaId?: string;

  /** Position in echo chain (0 = original) */
  chainPosition: number;

  /** How the text was extracted */
  extractionMethod?: string;

  /** Confidence score (0-1) */
  confidence?: number;

  /** Custom GPT gizmo_id */
  gizmoId?: string;

  /** Original conversation ID */
  conversationId?: string;

  /** Message ID containing the extraction */
  messageId?: string;

  /** Batch ID (for multiple images → one text) */
  batchId?: string;

  /** Position within batch */
  batchPosition?: number;

  /** Import job that created this */
  importJobId?: string;

  /** When the source content was created (epoch ms) */
  sourceCreatedAt?: number;

  /** When this association was created (epoch ms) */
  createdAt: number;
}

/**
 * Statistics about media-text associations
 */
export interface MediaTextStats {
  totalAssociations: number;
  ocrCount: number;
  descriptionCount: number;
  echoCount: number;
  uniqueGizmos: number;
  uniqueConversations: number;
  batchCount: number;
}

/**
 * Known Custom GPT gizmo IDs for specialized extraction
 */
export const KNOWN_GIZMO_IDS = {
  /** Journal Recognizer OCR - Handwritten notebook transcription */
  JOURNAL_RECOGNIZER_OCR: 'g-T7bW2qVzx',
  /** Image Name Echo & Bounce - Visual art analysis and echo generation */
  IMAGE_ECHO_BOUNCE: 'g-FmQp1Tm1G',
} as const;

// ═══════════════════════════════════════════════════════════════════
// LINK TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Link between content nodes
 */
export interface StoredLink {
  /** Link ID */
  id: string;

  /** Source node ID */
  sourceId: string;

  /** Target node ID */
  targetId: string;

  /** Link type */
  linkType: ContentLinkType;

  /** Additional metadata (JSON in DB) */
  metadata?: Record<string, unknown>;

  /** When created (epoch ms) */
  createdAt: number;
}

/**
 * Supported link types
 */
export type ContentLinkType =
  | 'parent'        // Structural parent
  | 'child'         // Structural child
  | 'follows'       // Temporal sequence
  | 'reply-to'      // Reply relationship
  | 'quotes'        // Quote/repost
  | 'references'    // General reference
  | 'thread-root'   // Link to conversation root
  | 'chunk-of'      // Chunk belongs to parent
  | 'summary-of'    // Summary of content
  | 'media';        // Media attachment

// ═══════════════════════════════════════════════════════════════════
// IMPORT JOB TRACKING
// ═══════════════════════════════════════════════════════════════════

/**
 * Import job status
 */
export type ImportJobStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Import job record
 */
export interface ImportJob {
  /** Job ID */
  id: string;

  /** Adapter that ran the import */
  adapterId: string;

  /** Source path that was imported */
  sourcePath: string;

  /** Current status */
  status: ImportJobStatus;

  /** Nodes successfully imported */
  nodesImported: number;

  /** Nodes skipped (duplicates) */
  nodesSkipped: number;

  /** Nodes that failed to import */
  nodesFailed: number;

  /** Links created */
  linksCreated: number;

  /** When job started (epoch ms) */
  startedAt?: number;

  /** When job completed (epoch ms) */
  completedAt?: number;

  /** Error message if failed */
  error?: string;

  /** Additional stats (JSON in DB) */
  stats?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// QUERY TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for querying nodes
 */
export interface QueryOptions {
  /** Filter by source type(s) */
  sourceType?: string | string[];

  /** Filter by adapter */
  adapterId?: string;

  /** Filter by import job */
  importJobId?: string;

  /** Filter by hierarchy level */
  hierarchyLevel?: number;

  /** Filter by thread root */
  threadRootId?: string;

  /** Filter by parent node */
  parentNodeId?: string;

  /** Filter by author role */
  authorRole?: AuthorRole;

  /** Date range filter (source dates) */
  dateRange?: {
    start?: number;
    end?: number;
  };

  /** Full-text search query */
  searchText?: string;

  /** Limit results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Sort field */
  orderBy?: 'createdAt' | 'sourceCreatedAt' | 'importedAt' | 'wordCount';

  /** Sort direction */
  orderDir?: 'asc' | 'desc';

  /** Include embedding in results (expensive) */
  includeEmbedding?: boolean;
}

/**
 * Result from a node query
 */
export interface QueryResult {
  /** Matching nodes */
  nodes: StoredNode[];

  /** Total count (before limit) */
  total: number;

  /** Whether more results exist */
  hasMore: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Search result with relevance scoring
 */
export interface SearchResult {
  /** The matched node */
  node: StoredNode;

  /** Relevance score (0-1, higher is better) */
  score: number;

  /** Distance for vector search (lower is better) */
  distance?: number;

  /** BM25 score for keyword search */
  bm25Score?: number;

  /** Matched snippets with highlights */
  highlights?: string[];
}

/**
 * Options for embedding-based search
 */
export interface EmbeddingSearchOptions {
  /** Maximum results */
  limit?: number;

  /** Minimum similarity threshold (0-1) */
  threshold?: number;

  /** Filter by source type(s) */
  sourceType?: string | string[];

  /** Filter by hierarchy level */
  hierarchyLevel?: number;

  /** Filter by thread root */
  threadRootId?: string;
}

/**
 * Options for keyword (FTS5) search
 */
export interface KeywordSearchOptions {
  /** Maximum results */
  limit?: number;

  /** Filter by source type(s) */
  sourceType?: string | string[];

  /** Filter by hierarchy level */
  hierarchyLevel?: number;

  /** Filter by thread root */
  threadRootId?: string;

  /** Include title in search */
  searchTitle?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// STORAGE STATS
// ═══════════════════════════════════════════════════════════════════

/**
 * Storage statistics for ContentStore
 */
export interface ContentStoreStats {
  /** Total nodes */
  totalNodes: number;

  /** Nodes by source type */
  nodesBySourceType: Record<string, number>;

  /** Nodes by adapter */
  nodesByAdapter: Record<string, number>;

  /** Nodes with embeddings */
  nodesWithEmbeddings: number;

  /** Total links */
  totalLinks: number;

  /** Total import jobs */
  totalJobs: number;

  /** Database size in bytes */
  dbSizeBytes?: number;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Path to SQLite database file */
  dbPath: string;

  /** Embedding vector dimension (default: 768 for nomic-embed-text) */
  embeddingDimension: number;

  /** Enable FTS5 full-text search */
  enableFTS: boolean;

  /** Enable vec0 vector search */
  enableVec: boolean;

  /** WAL mode for better concurrency */
  enableWAL: boolean;
}

/**
 * Default storage configuration
 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  dbPath: '', // Must be provided
  embeddingDimension: 768,
  enableFTS: true,
  enableVec: true,
  enableWAL: true,
};

// ═══════════════════════════════════════════════════════════════════
// BATCH OPERATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Result from batch store operation
 */
export interface BatchStoreResult {
  /** Nodes successfully stored */
  stored: number;

  /** Nodes skipped (duplicates) */
  skipped: number;

  /** Nodes that failed */
  failed: number;

  /** Error details for failed nodes */
  errors?: Array<{ nodeId: string; error: string }>;
}

/**
 * Result from batch embedding operation
 */
export interface BatchEmbeddingResult {
  /** Embeddings successfully stored */
  stored: number;

  /** Embeddings skipped (already exist) */
  skipped: number;

  /** Embeddings that failed */
  failed: number;
}
