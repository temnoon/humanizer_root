/**
 * Buffer Service Interface
 *
 * API-first buffer system for content transformation pipelines.
 * All business logic lives here, not in React contexts.
 *
 * @module @humanizer/core/buffer/buffer-service
 */

import type {
  ContentBuffer,
  LoadFromArchiveOptions,
  LoadFromBookOptions,
  CreateFromTextOptions,
  TransformRequest,
  SplitOptions,
  MergeOptions,
  CommitToBookOptions,
  ExportToArchiveOptions,
  ProvenanceChain,
  DerivedBufferResult,
} from './types.js';
import type { BookChapter } from '../aui/types.js';
import type { StoredNode } from '../storage/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER SERVICE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * BufferService - Main interface for content buffer operations
 *
 * Key principles:
 * - Immutable: Each operation returns a NEW buffer
 * - Content-addressed: SHA-256 hash for deduplication
 * - Full provenance: Every transformation is tracked
 * - API-first: All logic in core, not in UI
 */
export interface BufferService {
  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Load content from archive (StoredNode) into a buffer.
   * Creates a new buffer with origin tracking.
   */
  loadFromArchive(
    nodeId: string,
    options?: LoadFromArchiveOptions
  ): Promise<ContentBuffer>;

  /**
   * Load content from a book node into a buffer.
   * Creates a new buffer with book origin context.
   */
  loadFromBook(
    nodeId: string,
    options?: LoadFromBookOptions
  ): Promise<ContentBuffer>;

  /**
   * Create a buffer from raw text.
   * Used for manual entry or generated content.
   */
  createFromText(
    text: string,
    options?: CreateFromTextOptions
  ): Promise<ContentBuffer>;

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFORMATION (IMMUTABLE - RETURNS NEW BUFFER)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Apply a generic transformation to a buffer.
   * Returns a NEW buffer; original is never mutated.
   */
  transform(
    buffer: ContentBuffer,
    operation: TransformRequest
  ): Promise<ContentBuffer>;

  /**
   * Rewrite content for a specific persona/style.
   * Integrates with Builder agent's rewrite capabilities.
   */
  rewriteForPersona(
    buffer: ContentBuffer,
    personaId: string,
    styleId?: string
  ): Promise<ContentBuffer>;

  /**
   * Merge multiple buffers into one.
   * Creates a new buffer with merged provenance.
   */
  merge(
    buffers: ContentBuffer[],
    options?: MergeOptions
  ): Promise<ContentBuffer>;

  /**
   * Split a buffer into multiple buffers.
   * Each resulting buffer tracks its origin from the source.
   */
  split(
    buffer: ContentBuffer,
    options: SplitOptions
  ): Promise<ContentBuffer[]>;

  // ═══════════════════════════════════════════════════════════════════════════
  // QUALITY ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Analyze content quality and populate quality metrics.
   * Returns buffer with updated qualityMetrics.
   */
  analyzeQuality(buffer: ContentBuffer): Promise<ContentBuffer>;

  /**
   * Run AI detection on buffer content.
   * Returns buffer with AI detection results in qualityMetrics.
   */
  detectAI(buffer: ContentBuffer): Promise<ContentBuffer>;

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMIT (CREATE PERSISTENT NODES)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Commit buffer content to a book chapter.
   * Creates a BookNode and returns the chapter.
   * Bypasses harvest flow - direct buffer-to-book.
   */
  commitToBook(
    buffer: ContentBuffer,
    bookId: string,
    chapterId: string,
    options?: CommitToBookOptions
  ): Promise<BookChapter>;

  /**
   * Export buffer content back to archive.
   * Creates a StoredNode with full provenance metadata.
   */
  exportToArchive(
    buffer: ContentBuffer,
    options?: ExportToArchiveOptions
  ): Promise<StoredNode>;

  // ═══════════════════════════════════════════════════════════════════════════
  // PROVENANCE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get the full provenance chain for a buffer.
   */
  getProvenance(buffer: ContentBuffer): ProvenanceChain;

  /**
   * Trace a buffer back to its original root content.
   * Returns the original buffer that started this chain.
   */
  traceToOrigin(buffer: ContentBuffer): Promise<ContentBuffer>;

  /**
   * Find all buffers derived from a given buffer.
   * Useful for impact analysis and version tracking.
   */
  findDerived(buffer: ContentBuffer): Promise<DerivedBufferResult[]>;

  /**
   * Create a new branch from a buffer's provenance chain.
   * Allows parallel experimentation.
   */
  branch(
    buffer: ContentBuffer,
    branchName: string,
    description?: string
  ): Promise<ContentBuffer>;

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Save a buffer to persistent storage.
   * Returns the saved buffer (may have updated metadata).
   */
  save(buffer: ContentBuffer): Promise<ContentBuffer>;

  /**
   * Load a buffer from persistent storage.
   * Returns undefined if not found.
   */
  load(bufferId: string): Promise<ContentBuffer | undefined>;

  /**
   * Find buffers by content hash (deduplication).
   * Returns all buffers with matching content.
   */
  findByContentHash(hash: string): Promise<ContentBuffer[]>;

  /**
   * Delete a buffer from persistent storage.
   * Note: This may orphan provenance chains.
   */
  delete(bufferId: string): Promise<boolean>;

  // ═══════════════════════════════════════════════════════════════════════════
  // EMBEDDING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate and store embedding for buffer content.
   * Returns buffer with populated embedding field.
   */
  embed(buffer: ContentBuffer): Promise<ContentBuffer>;

  /**
   * Find similar buffers by semantic similarity.
   * Uses embedding vectors for comparison.
   */
  findSimilar(
    buffer: ContentBuffer,
    limit?: number,
    minSimilarity?: number
  ): Promise<Array<ContentBuffer & { similarity: number }>>;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for initializing BufferService
 */
export interface BufferServiceOptions {
  /** Embedding function for semantic operations */
  embedFn?: (text: string) => Promise<number[]>;

  /** Archive store for loading/exporting StoredNodes */
  archiveStore?: ArchiveStoreAdapter;

  /** Books store for committing to books */
  booksStore?: BooksStoreAdapter;

  /** AUI store for buffer persistence */
  auiStore?: AuiStoreAdapter;

  /** Enable automatic quality analysis on load */
  autoAnalyzeQuality?: boolean;

  /** Enable automatic embedding on save */
  autoEmbed?: boolean;

  /** Default buffer state for new buffers */
  defaultState?: 'transient' | 'staged';
}

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTER INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Adapter for archive store operations
 */
export interface ArchiveStoreAdapter {
  /** Get a node by ID */
  getNode(nodeId: string): Promise<StoredNode | undefined>;

  /** Create a node */
  createNode(node: Omit<StoredNode, 'id'>): Promise<StoredNode>;

  /** Update a node */
  updateNode(nodeId: string, updates: Partial<StoredNode>): Promise<StoredNode | undefined>;
}

/**
 * Adapter for books store operations
 */
export interface BooksStoreAdapter {
  /** Get a book chapter by ID */
  getChapter(chapterId: string): Promise<BookChapter | undefined>;

  /** Update chapter content */
  updateChapter(
    chapterId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<BookChapter | undefined>;

  /** Add content to chapter */
  addToChapter(
    bookId: string,
    chapterId: string,
    content: string,
    position?: number
  ): Promise<BookChapter>;
}

/**
 * Adapter for AUI buffer persistence
 */
export interface AuiStoreAdapter {
  /** Save a content buffer */
  saveContentBuffer(buffer: ContentBuffer): Promise<ContentBuffer>;

  /** Load a content buffer */
  loadContentBuffer(bufferId: string): Promise<ContentBuffer | undefined>;

  /** Find buffers by content hash */
  findContentBuffersByHash(hash: string): Promise<ContentBuffer[]>;

  /** Delete a content buffer */
  deleteContentBuffer(bufferId: string): Promise<boolean>;

  /** Save provenance chain */
  saveProvenanceChain(chain: ProvenanceChain): Promise<ProvenanceChain>;

  /** Load provenance chain */
  loadProvenanceChain(chainId: string): Promise<ProvenanceChain | undefined>;

  /** Find derived buffers */
  findDerivedBuffers(rootBufferId: string): Promise<ContentBuffer[]>;

  /** Get persona profile for rewriting */
  getPersonaProfile(id: string): Promise<import('../storage/aui/types.js').PersonaProfile | undefined>;

  /** Get style profile for rewriting */
  getStyleProfile(id: string): Promise<import('../storage/aui/types.js').StyleProfile | undefined>;
}
