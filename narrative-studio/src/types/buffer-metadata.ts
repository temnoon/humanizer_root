/**
 * Buffer Metadata Types
 *
 * Comprehensive metadata structures for preserving all available
 * information from content sources (conversations, Facebook posts, etc.)
 */

// ============================================================
// TIMESTAMP METADATA
// ============================================================

export interface TimestampMeta {
  /** Unix timestamp (milliseconds) when content was created */
  createdAt?: number;
  /** Unix timestamp when content was last modified */
  updatedAt?: number;
  /** ISO 8601 date string for display */
  createdAtISO?: string;
  updatedAtISO?: string;
  /** Relative time description (computed) */
  relativeTime?: string;
  /** Timezone of original content if known */
  timezone?: string;
}

// ============================================================
// AUTHORSHIP METADATA
// ============================================================

export interface AuthorMeta {
  /** Display name of author */
  name?: string;
  /** Author identifier (user ID, email, etc.) */
  id?: string;
  /** Role in conversation */
  role?: 'user' | 'assistant' | 'system';
  /** AI model if assistant (e.g., "gpt-4", "claude-3") */
  aiModel?: string;
  /** Model version/snapshot */
  aiModelVersion?: string;
  /** Platform-specific author URL */
  profileUrl?: string;
}

// ============================================================
// MEDIA REFERENCE METADATA
// ============================================================

export interface MediaRef {
  /** Unique ID for this media item */
  id: string;
  /** Media type */
  type: 'image' | 'audio' | 'video' | 'file' | 'link';
  /** Local file path (for local archives) */
  localPath?: string;
  /** Local server URL (e.g., http://localhost:3002/media/...) */
  localUrl?: string;
  /** Cloud/CDN URL if uploaded */
  cloudUrl?: string;
  /** Original source URL (e.g., file-service://...) */
  originalRef?: string;
  /** MIME type */
  mimeType?: string;
  /** File size in bytes */
  sizeBytes?: number;
  /** Image/video dimensions */
  width?: number;
  height?: number;
  /** Duration for audio/video (seconds) */
  durationSeconds?: number;
  /** Alt text or caption */
  caption?: string;
  /** Filename */
  filename?: string;
  /** For DALL-E generations */
  generationPrompt?: string;
  /** Thumbnail URL if available */
  thumbnailUrl?: string;
}

// ============================================================
// LINK METADATA
// ============================================================

export interface LinkRef {
  /** The URL */
  url: string;
  /** Display text used in content */
  text?: string;
  /** Link title from page or preview */
  title?: string;
  /** Meta description */
  description?: string;
  /** Favicon or preview image */
  previewImageUrl?: string;
  /** Domain extracted */
  domain?: string;
  /** Link type detected */
  type?: 'webpage' | 'image' | 'video' | 'document' | 'social' | 'code';
  /** Position in text (character offset) */
  position?: { start: number; end: number };
}

// ============================================================
// CONTENT ANALYSIS METADATA
// ============================================================

export interface ContentStatsMeta {
  /** Word count */
  wordCount?: number;
  /** Character count */
  charCount?: number;
  /** Sentence count */
  sentenceCount?: number;
  /** Paragraph count */
  paragraphCount?: number;
  /** Estimated reading time (minutes) */
  readingTimeMinutes?: number;
  /** Has code blocks */
  hasCode?: boolean;
  /** Programming languages detected */
  codeLanguages?: string[];
  /** Has images embedded */
  hasImages?: boolean;
  /** Image count */
  imageCount?: number;
  /** Has links */
  hasLinks?: boolean;
  /** Link count */
  linkCount?: number;
  /** Primary language of content */
  language?: string;
  /** Content format */
  format?: 'plain' | 'markdown' | 'html';
}

// ============================================================
// SOURCE TRACKING METADATA
// ============================================================

export interface SourceMeta {
  /** Source platform */
  platform?: 'openai' | 'anthropic' | 'facebook' | 'twitter' | 'manual' | 'import';
  /** Archive name in local storage */
  archiveName?: string;
  /** Original conversation/thread folder */
  folder?: string;
  /** Original file path if imported */
  importedFrom?: string;
  /** Import date */
  importedAt?: number;
  /** Conversation ID in source system */
  conversationId?: string;
  /** Message ID in source system */
  messageId?: string;
  /** Position in conversation (0-indexed) */
  messageIndex?: number;
  /** Total messages in conversation */
  totalMessages?: number;
  /** Export/backup version */
  exportVersion?: string;
}

// ============================================================
// TRANSFORMATION HISTORY METADATA
// ============================================================

export interface TransformationRecord {
  /** Tool that was applied */
  tool: string;
  /** Tool settings used */
  settings: Record<string, unknown>;
  /** Timestamp of transformation */
  appliedAt: number;
  /** Hash of input content */
  inputHash?: string;
  /** Hash of output content */
  outputHash?: string;
  /** Any analysis results from the tool */
  analysisResult?: Record<string, unknown>;
}

export interface TransformationHistoryMeta {
  /** Original content hash (before any transforms) */
  originalHash?: string;
  /** Chain of transformations applied */
  transformations?: TransformationRecord[];
  /** Current version number (increments with each transform) */
  version?: number;
}

// ============================================================
// SEMANTIC/EMBEDDING METADATA
// ============================================================

export interface SemanticMeta {
  /** Embedding vector (for semantic search) */
  embedding?: number[];
  /** Embedding model used */
  embeddingModel?: string;
  /** Cluster ID if clustered */
  clusterId?: string;
  /** Cluster label */
  clusterLabel?: string;
  /** Similarity score (if from search) */
  similarityScore?: number;
  /** Topics/themes detected */
  topics?: string[];
  /** Named entities extracted */
  entities?: Array<{
    text: string;
    type: 'person' | 'place' | 'organization' | 'date' | 'other';
    position?: { start: number; end: number };
  }>;
}

// ============================================================
// TAGGING METADATA
// ============================================================

export interface TagsMeta {
  /** Auto-generated tags */
  autoTags?: string[];
  /** User-added tags */
  userTags?: string[];
  /** Year tag (e.g., "2024") */
  year?: string;
  /** Month tag (e.g., "2024-03") */
  month?: string;
  /** Recency category */
  recency?: 'today' | 'this-week' | 'this-month' | 'this-year' | 'archive';
  /** Length category */
  lengthCategory?: 'brief' | 'medium' | 'extended' | 'deep-dive';
  /** Content category */
  category?: 'technical' | 'creative' | 'personal' | 'professional' | 'other';
}

// ============================================================
// LOCATION METADATA (for Facebook check-ins, etc.)
// ============================================================

export interface LocationMeta {
  /** Place name */
  name?: string;
  /** Address */
  address?: string;
  /** City */
  city?: string;
  /** Country */
  country?: string;
  /** Coordinates */
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// ============================================================
// COMBINED METADATA INTERFACE
// ============================================================

export interface BufferMetadata {
  /** Timestamp information */
  timestamps?: TimestampMeta;
  /** Author information */
  author?: AuthorMeta;
  /** Media attachments */
  media?: MediaRef[];
  /** Links found in content */
  links?: LinkRef[];
  /** Content statistics */
  stats?: ContentStatsMeta;
  /** Source tracking */
  source?: SourceMeta;
  /** Transformation history */
  history?: TransformationHistoryMeta;
  /** Semantic/embedding data */
  semantic?: SemanticMeta;
  /** Tags */
  tags?: TagsMeta;
  /** Location (if available) */
  location?: LocationMeta;
  /** Additional platform-specific data */
  platformData?: Record<string, unknown>;
  /** Custom user-defined metadata */
  custom?: Record<string, unknown>;
}
