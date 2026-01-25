/**
 * UCG Import Adapter Types
 *
 * Defines the contract for content source adapters that import data
 * into the Universal Content Graph (UCG) pyramid structure.
 *
 * Adapters convert platform-specific export formats (ChatGPT, Claude,
 * Facebook, Twitter, etc.) into standardized ContentNodes that feed
 * into the UCG pyramid.
 *
 * Key Design Principles:
 * 1. All adapters implement the same interface
 * 2. Detection is separate from parsing (fail-fast pattern)
 * 3. Parsing uses async iterators for memory efficiency
 * 4. All configuration via ConfigManager (no hardcoded literals)
 * 5. Progress reporting for long-running imports
 */

import type { ContentSource, ContentMetadata } from '../ucg/index.js';

// ═══════════════════════════════════════════════════════════════════
// CORE ADAPTER INTERFACE
// ═══════════════════════════════════════════════════════════════════

/**
 * Content source adapter interface
 *
 * All adapters must implement this interface to be registered
 * with the adapter registry.
 */
export interface ContentAdapter {
  /** Unique adapter identifier (e.g., 'chatgpt', 'twitter') */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Description of what this adapter handles */
  readonly description: string;

  /** Version of the adapter */
  readonly version: string;

  /** Content types this adapter produces */
  readonly contentTypes: string[];

  /** File extensions this adapter can process */
  readonly supportedExtensions: string[];

  /**
   * Detect if this adapter can handle the given source
   *
   * This should be fast - only check for characteristic files/structure,
   * don't parse content.
   */
  detect(source: AdapterSource): Promise<DetectionResult>;

  /**
   * Validate the source before parsing
   *
   * More thorough than detect() - can check file integrity,
   * required fields, etc.
   */
  validate(source: AdapterSource): Promise<ValidationResult>;

  /**
   * Parse the source and yield content nodes
   *
   * Uses async generator for memory efficiency with large imports.
   * Yields ImportedNode objects that can be converted to ContentNodes.
   */
  parse(source: AdapterSource, options?: ParseOptions): AsyncGenerator<ImportedNode, ParseStats, undefined>;

  /**
   * Get metadata about the source without full parsing
   *
   * Useful for previewing imports before committing.
   */
  getSourceMetadata(source: AdapterSource): Promise<SourceMetadata>;
}

// ═══════════════════════════════════════════════════════════════════
// SOURCE TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Source specification for an adapter
 */
export interface AdapterSource {
  /** Source type */
  type: 'file' | 'directory' | 'zip' | 'json' | 'stream';

  /** Path to the source (file, directory, or zip) */
  path: string;

  /** Original filename if from upload */
  originalName?: string;

  /** Additional source configuration */
  config?: Record<string, unknown>;
}

/**
 * Detection result from an adapter
 */
export interface DetectionResult {
  /** Whether this adapter can handle the source */
  canHandle: boolean;

  /** Confidence level (0.0 - 1.0) */
  confidence: number;

  /** Detected format identifier */
  format?: string;

  /** Detected format version */
  formatVersion?: string;

  /** Reason for detection result */
  reason?: string;

  /** Additional detection metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Validation result from an adapter
 */
export interface ValidationResult {
  /** Whether the source is valid */
  valid: boolean;

  /** Validation errors */
  errors: ValidationError[];

  /** Validation warnings */
  warnings: ValidationWarning[];

  /** Suggested fixes for errors */
  suggestions?: string[];
}

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
  details?: Record<string, unknown>;
}

export interface ValidationWarning {
  code: string;
  message: string;
  path?: string;
}

// ═══════════════════════════════════════════════════════════════════
// PARSING TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for parsing
 */
export interface ParseOptions {
  /** Maximum items to process (for preview) */
  limit?: number;

  /** Skip items before this offset */
  offset?: number;

  /** Include media references */
  includeMedia?: boolean;

  /** Preserve original metadata */
  preserveOriginal?: boolean;

  /** Date range filter */
  dateRange?: {
    start?: Date;
    end?: Date;
  };

  /** Content type filter */
  contentTypes?: string[];

  /** Progress callback */
  onProgress?: (progress: ImportProgress) => void;

  /** Job ID for tracking */
  jobId?: string;
}

/**
 * A node imported from a source
 *
 * This is the intermediate format before conversion to ContentNode.
 * Contains all the raw data from the source.
 */
export interface ImportedNode {
  /** Unique ID within the import */
  id: string;

  /** URI using content:// scheme */
  uri: string;

  /** Content hash for deduplication */
  contentHash: string;

  /** The actual content text */
  content: string;

  /** Content format */
  format: 'text' | 'markdown' | 'html' | 'json';

  /** Source-specific content type */
  sourceType: string;

  /** When the content was created in the source */
  sourceCreatedAt?: Date;

  /** When the content was last updated in the source */
  sourceUpdatedAt?: Date;

  /** Author information */
  author?: {
    id?: string;
    name?: string;
    handle?: string;
    role?: 'user' | 'assistant' | 'system' | 'tool';
  };

  /** Parent node reference (for threading) */
  parentUri?: string;

  /** Thread root reference */
  threadRootUri?: string;

  /** Position in sequence */
  position?: number;

  /** Chunk index (for chunked content) */
  chunkIndex?: number;

  /** Chunk start offset (for chunked content) */
  chunkStartOffset?: number;

  /** Chunk end offset (for chunked content) */
  chunkEndOffset?: number;

  /**
   * Hierarchy level for pyramid structure:
   * - 0: Base content (messages, chunks)
   * - 1: Summary level (grouped chunks)
   * - 2: Apex level (document summary)
   */
  hierarchyLevel?: number;

  /** Source adapter ID */
  sourceAdapter?: string;

  /** Media attachments */
  media?: MediaReference[];

  /** Links to other content */
  links?: ContentLink[];

  /** Source-specific metadata */
  metadata: Record<string, unknown>;

  /** Raw original data (if preserveOriginal is true) */
  original?: unknown;
}

/**
 * Media attachment reference
 */
export interface MediaReference {
  /** Media ID */
  id: string;

  /** Media type */
  type: 'image' | 'video' | 'audio' | 'document' | 'other';

  /** MIME type */
  mimeType?: string;

  /** URL or path to media */
  url?: string;

  /** Local file path */
  localPath?: string;

  /** File size in bytes */
  size?: number;

  /** Dimensions for images/video */
  dimensions?: { width: number; height: number };

  /** Duration for audio/video */
  duration?: number;

  /** Alt text or description */
  alt?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Link between content nodes
 */
export interface ContentLink {
  /** Link type */
  type: LinkType;

  /** Target URI */
  targetUri: string;

  /** Link metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Supported link types
 */
export type LinkType =
  | 'parent'           // Structural parent (message -> conversation)
  | 'child'            // Structural child
  | 'follows'          // Temporal sequence (message 2 -> message 1)
  | 'precedes'         // Inverse of follows
  | 'reply-to'         // Reply relationship
  | 'quotes'           // Quote tweet, etc.
  | 'retweet-of'       // Retweet/repost
  | 'references'       // General reference
  | 'thread-root'      // Link to thread root
  | 'duet-of'          // TikTok duet
  | 'stitch-of'        // TikTok stitch
  | 'derived-from'     // Creative derivation
  | 'similar'          // Semantic similarity
  | 'attached-media';  // Media attachment

// ═══════════════════════════════════════════════════════════════════
// PROGRESS & STATS
// ═══════════════════════════════════════════════════════════════════

/**
 * Import progress information
 */
export interface ImportProgress {
  /** Current phase */
  phase: 'detecting' | 'validating' | 'parsing' | 'linking' | 'complete' | 'error';

  /** Items processed so far */
  processed: number;

  /** Total items (if known) */
  total?: number;

  /** Progress percentage (0-100) */
  percent?: number;

  /** Current item being processed */
  currentItem?: string;

  /** Errors encountered */
  errors: number;

  /** Warnings encountered */
  warnings: number;

  /** Elapsed time in ms */
  elapsedMs: number;

  /** Estimated time remaining in ms */
  estimatedRemainingMs?: number;
}

/**
 * Statistics from a parse operation
 */
export interface ParseStats {
  /** Total items parsed */
  totalParsed: number;

  /** Items by content type */
  byContentType: Record<string, number>;

  /** Items skipped (filtered out) */
  skipped: number;

  /** Errors encountered */
  errors: number;

  /** Warnings encountered */
  warnings: number;

  /** Media files found */
  mediaCount: number;

  /** Links created */
  linkCount: number;

  /** Date range of content */
  dateRange?: {
    earliest?: Date;
    latest?: Date;
  };

  /** Parse duration in ms */
  durationMs: number;
}

/**
 * Source metadata (preview information)
 */
export interface SourceMetadata {
  /** Detected format */
  format: string;

  /** Format version */
  formatVersion?: string;

  /** Estimated item count */
  estimatedCount?: number;

  /** Date range of content */
  dateRange?: {
    earliest?: Date;
    latest?: Date;
  };

  /** Content types present */
  contentTypes: string[];

  /** Account/user information */
  account?: {
    id?: string;
    name?: string;
    handle?: string;
    email?: string;
  };

  /** Export date */
  exportDate?: Date;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// REGISTRY TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Adapter registry interface
 */
export interface AdapterRegistry {
  /**
   * Register an adapter
   */
  register(adapter: ContentAdapter): void;

  /**
   * Get an adapter by ID
   */
  get(id: string): ContentAdapter | undefined;

  /**
   * Get all registered adapters
   */
  getAll(): ContentAdapter[];

  /**
   * Detect which adapter(s) can handle a source
   */
  detectAdapters(source: AdapterSource): Promise<Array<{
    adapter: ContentAdapter;
    detection: DetectionResult;
  }>>;

  /**
   * Get the best adapter for a source
   */
  getBestAdapter(source: AdapterSource): Promise<ContentAdapter | undefined>;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════

/**
 * Adapter configuration keys
 *
 * All adapter settings should use these keys with ConfigManager.
 */
export const ADAPTER_CONFIG = {
  // Detection
  MIN_CONFIDENCE: 'adapters.minConfidence',
  DETECTION_TIMEOUT_MS: 'adapters.detectionTimeoutMs',

  // Parsing
  DEFAULT_BATCH_SIZE: 'adapters.defaultBatchSize',
  MAX_CONTENT_LENGTH: 'adapters.maxContentLength',
  INCLUDE_MEDIA_DEFAULT: 'adapters.includeMediaDefault',

  // Encoding
  DEFAULT_ENCODING: 'adapters.defaultEncoding',
  FALLBACK_ENCODINGS: 'adapters.fallbackEncodings',

  // Progress
  PROGRESS_INTERVAL_MS: 'adapters.progressIntervalMs',
} as const;

// ═══════════════════════════════════════════════════════════════════
// HELPER TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Conversation structure (for chat imports)
 */
export interface ConversationStructure {
  id: string;
  title?: string;
  createdAt?: Date;
  updatedAt?: Date;
  participants?: string[];
  messageCount: number;
  messages: ImportedNode[];
}

/**
 * Thread structure (for social media)
 */
export interface ThreadStructure {
  rootId: string;
  replies: ImportedNode[];
  totalCount: number;
}

/**
 * Platform-specific source types
 */
export type PlatformSourceType =
  // Chat platforms
  | 'chatgpt-message'
  | 'chatgpt-conversation'
  | 'claude-message'
  | 'claude-conversation'
  | 'gemini-message'
  | 'gemini-conversation'
  // Social - Facebook/Meta
  | 'facebook-post'
  | 'facebook-comment'
  | 'facebook-message'
  | 'facebook-note'
  | 'facebook-reaction'
  // Social - Instagram
  | 'instagram-post'
  | 'instagram-story'
  | 'instagram-reel'
  | 'instagram-comment'
  | 'instagram-message'
  // Social - Twitter/X
  | 'twitter-tweet'
  | 'twitter-retweet'
  | 'twitter-quote'
  | 'twitter-reply'
  | 'twitter-dm'
  | 'twitter-like'
  | 'twitter-bookmark'
  // Social - Reddit
  | 'reddit-post'
  | 'reddit-comment'
  | 'reddit-message'
  | 'reddit-saved'
  // Social - TikTok
  | 'tiktok-video'
  | 'tiktok-comment'
  | 'tiktok-dm'
  | 'tiktok-like'
  // Content platforms
  | 'substack-post'
  | 'substack-note'
  | 'substack-comment'
  // Other
  | 'discord-message'
  | 'linkedin-post'
  | 'linkedin-message'
  // Generic
  | 'document'
  | 'markdown'
  | 'text'
  | 'json';
