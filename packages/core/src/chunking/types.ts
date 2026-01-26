/**
 * Chunking Types
 *
 * Type definitions for the content chunking system.
 * Chunking breaks large content into smaller, semantically coherent pieces
 * suitable for embedding and retrieval.
 */

// ═══════════════════════════════════════════════════════════════════
// CHUNK BOUNDARIES
// ═══════════════════════════════════════════════════════════════════

/**
 * The strategy used to determine a chunk boundary
 */
export type BoundaryType =
  | 'conversation'  // Split on message turns (for chat exports)
  | 'paragraph'     // Split on double newline
  | 'sentence'      // Split on . ! ?
  | 'clause'        // Split on , ; :
  | 'hard';         // Character limit fallback

/**
 * A detected boundary in the content
 */
export interface ChunkBoundary {
  /** Byte offset where the boundary occurs */
  offset: number;

  /** Type of boundary detected */
  type: BoundaryType;

  /** Confidence score (0-1) */
  confidence: number;
}

// ═══════════════════════════════════════════════════════════════════
// CONTENT CHUNKS
// ═══════════════════════════════════════════════════════════════════

/**
 * A single chunk of content after splitting
 */
export interface ContentChunk {
  /** Zero-based chunk index within parent */
  index: number;

  /** The chunk text content */
  text: string;

  /** Character offset start in original content */
  startOffset: number;

  /** Character offset end in original content */
  endOffset: number;

  /** Word count */
  wordCount: number;

  /** Character count */
  charCount: number;

  /** Boundary type that created this chunk */
  boundaryType: BoundaryType;

  /** Parent node ID if available */
  parentId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// CHUNKING RESULT
// ═══════════════════════════════════════════════════════════════════

/**
 * Result of a chunking operation
 */
export interface ChunkingResult {
  /** The produced chunks */
  chunks: ContentChunk[];

  /** Statistics about the chunking operation */
  stats: ChunkingStats;
}

/**
 * Statistics from a chunking operation
 */
export interface ChunkingStats {
  /** Original content character count */
  originalCharCount: number;

  /** Original content word count */
  originalWordCount: number;

  /** Number of chunks produced */
  chunkCount: number;

  /** Average chunk size in characters */
  avgChunkChars: number;

  /** Average chunk size in words */
  avgChunkWords: number;

  /** Minimum chunk size in characters */
  minChunkChars: number;

  /** Maximum chunk size in characters */
  maxChunkChars: number;

  /** Strategies used in cascade (in order applied) */
  strategiesUsed: BoundaryType[];

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════
// CHUNKING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Configuration for the chunking service
 */
export interface ChunkingConfig {
  /** Target chunk size in characters (~400-500 words) */
  targetChunkChars: number;

  /** Maximum chunk size in characters (hard limit) */
  maxChunkChars: number;

  /** Minimum chunk size in characters (avoid tiny chunks) */
  minChunkChars: number;

  /** Overlap between chunks in characters */
  overlapChars: number;

  /** Whether to preserve paragraph boundaries when possible */
  preserveParagraphs: boolean;

  /** Whether to preserve sentence boundaries when possible */
  preserveSentences: boolean;

  /** Strategy cascade order (tried in sequence until content fits) */
  strategyCascade: BoundaryType[];
}

/**
 * Enriched content from media-text extraction
 * (Lightweight version for chunking - full type in adapters/parsers/media-text-enrichment.ts)
 */
export interface ChunkEnrichedContent {
  /** Original node content */
  original: string;

  /** OCR transcriptions from images/documents */
  transcripts?: string[];

  /** AI-generated descriptions of media */
  descriptions?: string[];

  /** User-provided captions */
  captions?: string[];

  /** All content merged */
  combined?: string;
}

/**
 * Input for chunking operations
 */
export interface ChunkingInput {
  /** Content to chunk */
  content: string;

  /** Optional parent node ID (for linking chunks back) */
  parentId?: string;

  /** Content format hint */
  format?: 'text' | 'markdown' | 'conversation';

  /** Custom configuration overrides */
  config?: Partial<ChunkingConfig>;

  /** Enriched content from media-text extraction */
  enrichedContent?: ChunkEnrichedContent;

  /** Whether to append media-text to chunk content (default: false) */
  appendMediaText?: boolean;
}
