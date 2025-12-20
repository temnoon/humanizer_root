/**
 * Embedding Service Types
 *
 * Type definitions for the hybrid ChromaDB + SQLite embedding system.
 */

// =============================================================================
// Core Entities
// =============================================================================

export interface Conversation {
  id: string;
  folder: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  totalTokens: number;
  isInteresting: boolean;
  summary: string | null;
  summaryEmbeddingId: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  parentId: string | null;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: number;
  tokenCount: number;
  embeddingId: string | null;
}

export interface Chunk {
  id: string;
  messageId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embeddingId: string | null;
  granularity: 'paragraph' | 'sentence';
}

// =============================================================================
// User Curation
// =============================================================================

export type MarkType = 'interesting' | 'anchor_candidate' | 'cluster_seed';
export type TargetType = 'conversation' | 'message' | 'chunk';

export interface UserMark {
  id: string;
  targetType: TargetType;
  targetId: string;
  markType: MarkType;
  note: string | null;
  createdAt: number;
}

// =============================================================================
// Discovered Structures
// =============================================================================

export interface Cluster {
  id: string;
  name: string | null;
  description: string | null;
  centroidEmbeddingId: string | null;
  memberCount: number;
  coherenceScore: number;
  createdAt: number;
}

export interface ClusterMember {
  clusterId: string;
  embeddingId: string;
  distanceToCentroid: number;
}

export type AnchorType = 'anchor' | 'anti_anchor';

export interface Anchor {
  id: string;
  name: string;
  description: string | null;
  anchorType: AnchorType;
  embedding: number[];  // 384-dim vector
  sourceEmbeddingIds: string[];
  createdAt: number;
}

// =============================================================================
// ChromaDB Metadata
// =============================================================================

export interface SummaryMetadata {
  conversation_id: string;
  title: string;
  created_at: number;
  message_count: number;
}

export interface MessageMetadata {
  conversation_id: string;
  message_id: string;
  role: string;
  created_at: number;
}

export interface ParagraphMetadata {
  conversation_id: string;
  message_id: string;
  chunk_index: number;
  role: string;
}

export interface SentenceMetadata {
  conversation_id: string;
  message_id: string;
  chunk_index: number;
  sentence_index: number;
}

export interface AnchorMetadata {
  anchor_type: AnchorType;
  name: string;
  source_count: number;
}

// =============================================================================
// Search Results
// =============================================================================

export interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
  conversationId: string;
  conversationTitle?: string;
  messageRole?: string;
}

export interface ClusterSummary {
  id: string;
  name: string | null;
  memberCount: number;
  coherenceScore: number;
  sampleTexts: string[];
}

// =============================================================================
// OpenAI Conversation Format (from mapping tree)
// =============================================================================

export interface OpenAIMappingNode {
  id: string;
  parent: string | null;
  children: string[];
  message: {
    id: string;
    author: {
      role: 'user' | 'assistant' | 'system' | 'tool';
      name?: string;
      metadata?: Record<string, unknown>;
    };
    create_time: number | null;
    update_time: number | null;
    content: {
      content_type: string;
      parts?: (string | Record<string, unknown>)[];
      text?: string;
    };
    status: string;
    end_turn?: boolean;
    weight: number;
    metadata?: Record<string, unknown>;
    recipient?: string;
  } | null;
}

export interface OpenAIConversation {
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, OpenAIMappingNode>;
  moderation_results: unknown[];
  current_node: string;
  plugin_ids: string[] | null;
  conversation_id: string;
  conversation_template_id: string | null;
  gizmo_id: string | null;
  is_archived: boolean;
  safe_urls: string[];
  default_model_slug: string;
  id: string;
}

// =============================================================================
// Embedding Service Configuration
// =============================================================================

export interface EmbeddingConfig {
  archivePath: string;
  sqlitePath: string;
  chromaDbPath: string;
  embeddingModel: string;
  embeddingDimensions: number;
  batchSize: number;
}

export const DEFAULT_CONFIG: Partial<EmbeddingConfig> = {
  embeddingModel: 'all-MiniLM-L6-v2',
  embeddingDimensions: 384,
  batchSize: 32,
};

// =============================================================================
// Indexing Progress
// =============================================================================

export interface IndexingProgress {
  status: 'idle' | 'indexing' | 'complete' | 'error';
  phase: string;
  current: number;
  total: number;
  currentItem?: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

// =============================================================================
// Import Tracking
// =============================================================================

export type ImportSource = 'openai' | 'facebook' | 'claude' | 'paste' | 'file' | 'gutenberg';
export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Import {
  id: string;
  source: ImportSource;
  sourcePath: string | null;
  status: ImportStatus;

  // Stats
  threadCount: number;
  messageCount: number;
  mediaCount: number;
  totalWords: number;

  // Timestamps
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;

  // Error tracking
  errorMessage: string | null;

  // Metadata (source-specific)
  metadata: Record<string, unknown> | null;
}

// =============================================================================
// Pyramid Types (Hierarchical Summarization)
// =============================================================================

export type ThreadType = 'conversation' | 'post' | 'document';
export type BoundaryType = 'paragraph' | 'section' | 'semantic';
export type ChildType = 'chunk' | 'summary';

/**
 * L0 base chunk - leaf node of the pyramid
 */
export interface PyramidChunk {
  id: string;
  threadId: string;
  threadType: ThreadType;

  chunkIndex: number;
  content: string;
  wordCount: number;

  // Structural metadata
  startOffset: number | null;
  endOffset: number | null;
  boundaryType: BoundaryType | null;

  // Embeddings
  embedding: number[] | null;
  embeddingModel: string;

  createdAt: number;
}

/**
 * L1+ summary node - intermediate pyramid level
 */
export interface PyramidSummary {
  id: string;
  threadId: string;
  level: number;  // 1 = summarizes chunks, 2 = summarizes L1, etc.

  content: string;
  wordCount: number;

  // What this summary covers
  childIds: string[];
  childType: ChildType;

  // Compression info
  sourceWordCount: number | null;
  compressionRatio: number | null;

  // Embeddings
  embedding: number[] | null;
  embeddingModel: string;

  // LLM tracking
  modelUsed: string | null;

  createdAt: number;
}

/**
 * Apex summary - top of the pyramid (one per thread)
 */
export interface PyramidApex {
  id: string;
  threadId: string;

  // Core synthesis
  summary: string;
  themes: string[] | null;

  // Narrative analysis (optional)
  characters: string[] | null;
  arc: string | null;

  // Stats
  totalChunks: number;
  pyramidDepth: number;
  totalSourceWords: number;

  // Embeddings
  embedding: number[] | null;
  embeddingModel: string;

  // LLM tracking
  modelUsed: string | null;

  createdAt: number;
  updatedAt: number | null;
}

/**
 * Full pyramid structure for a thread
 */
export interface Pyramid {
  threadId: string;
  threadType: ThreadType;

  chunks: PyramidChunk[];
  summaries: PyramidSummary[];  // Grouped by level
  apex: PyramidApex | null;

  // Computed stats
  depth: number;
  totalChunks: number;
  totalWords: number;
}

/**
 * Pyramid build configuration
 */
export interface PyramidBuildConfig {
  // Chunking
  targetChunkWords: number;  // ~500 words default
  maxChunkWords: number;     // ~800 words max
  boundaryStrategy: BoundaryType;

  // Summarization
  summaryRatio: number;      // 0.2 = summarize to 20% of source
  maxChildrenPerSummary: number;  // 4-6 chunks/summaries per level

  // Model selection
  embeddingModel: string;
  summaryModel: string;      // LLM for generating summaries
}

export const DEFAULT_PYRAMID_CONFIG: PyramidBuildConfig = {
  targetChunkWords: 500,
  maxChunkWords: 800,
  boundaryStrategy: 'semantic',
  summaryRatio: 0.2,
  maxChildrenPerSummary: 5,
  embeddingModel: 'all-MiniLM-L6-v2',
  summaryModel: 'claude-3-haiku-20240307',
};
