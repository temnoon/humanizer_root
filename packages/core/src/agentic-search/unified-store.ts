/**
 * Unified Store
 *
 * Abstraction layer over archive (content_nodes) and books (book_nodes) stores.
 * Provides a single interface for searching and querying across both stores.
 *
 * Architecture:
 * - Archive store: PostgresContentStore (humanizer_archive.content_nodes)
 * - Books store: PostgresBooksStore (humanizer_books.book_nodes) - optional
 *
 * When the books store is not available, operations gracefully degrade
 * to archive-only mode.
 */

import type { Pool } from 'pg';
import type { StoredNode, EmbeddingSearchOptions, KeywordSearchOptions } from '../storage/types.js';
import type { PostgresContentStore } from '../storage/postgres-content-store.js';
import type {
  BookNode,
  SearchTarget,
  UnifiedSearchOptions,
  UnifiedStoreResult,
  UnifiedQueryOptions,
  UnifiedQueryResult,
} from './types.js';
import { DEFAULT_LIMIT, DEFAULT_THRESHOLD } from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// BOOKS STORE INTERFACE
// ═══════════════════════════════════════════════════════════════════

/**
 * Interface for a books store implementation.
 * This can be implemented separately or the UnifiedStore can work without it.
 */
export interface BooksStoreInterface {
  /** Search by embedding vector */
  searchByEmbedding(
    embedding: number[],
    options?: {
      limit?: number;
      threshold?: number;
      bookId?: string;
      hierarchyLevel?: number;
    }
  ): Promise<Array<{ node: BookNode; score: number }>>;

  /** Search by keyword (full-text) */
  searchByKeyword(
    query: string,
    options?: {
      limit?: number;
      bookId?: string;
      hierarchyLevel?: number;
    }
  ): Promise<Array<{ node: BookNode; score: number }>>;

  /** Get node by ID */
  getNode(id: string): Promise<BookNode | undefined>;

  /** Get nodes by IDs */
  getNodes(ids: string[]): Promise<BookNode[]>;

  /** Get embedding for a node */
  getEmbedding(nodeId: string): Promise<number[] | undefined>;

  /** Get embeddings for multiple nodes */
  getEmbeddings(nodeIds: string[]): Promise<Map<string, number[]>>;

  /** Check if store is available */
  isAvailable(): boolean;
}

// ═══════════════════════════════════════════════════════════════════
// UNIFIED STORE
// ═══════════════════════════════════════════════════════════════════

/**
 * UnifiedStore provides a single interface for searching across
 * both archive and books stores.
 */
export class UnifiedStore {
  private archiveStore: PostgresContentStore;
  private booksStore: BooksStoreInterface | null;
  private verbose: boolean;

  constructor(
    archiveStore: PostgresContentStore,
    booksStore?: BooksStoreInterface,
    options?: { verbose?: boolean }
  ) {
    this.archiveStore = archiveStore;
    this.booksStore = booksStore || null;
    this.verbose = options?.verbose ?? false;
  }

  /**
   * Check if the books store is available
   */
  hasBooksStore(): boolean {
    return this.booksStore !== null && this.booksStore.isAvailable();
  }

  /**
   * Search both stores by embedding vector.
   * Returns results from both stores merged by score.
   */
  async searchByEmbedding(
    embedding: number[],
    options: UnifiedSearchOptions
  ): Promise<UnifiedStoreResult[]> {
    const { target, limit, threshold, hierarchyLevel, sourceType, bookId } = options;
    const results: UnifiedStoreResult[] = [];

    // Search archive if target includes it
    if (target === 'archive' || target === 'all') {
      const archiveOpts: EmbeddingSearchOptions = {
        limit: limit ?? DEFAULT_LIMIT,
        threshold: threshold ?? DEFAULT_THRESHOLD,
        sourceType,
        hierarchyLevel,
      };

      const archiveResults = await this.archiveStore.searchByEmbedding(embedding, archiveOpts);

      for (const result of archiveResults) {
        results.push({
          id: result.node.id,
          source: 'archive',
          node: result.node,
          score: result.score,
        });
      }

      if (this.verbose) {
        console.log(`[UnifiedStore] Archive search: ${archiveResults.length} results`);
      }
    }

    // Search books if target includes it and store is available
    if ((target === 'books' || target === 'all') && this.hasBooksStore()) {
      const booksResults = await this.booksStore!.searchByEmbedding(embedding, {
        limit: limit ?? DEFAULT_LIMIT,
        threshold: threshold ?? DEFAULT_THRESHOLD,
        bookId,
        hierarchyLevel,
      });

      for (const result of booksResults) {
        results.push({
          id: result.node.id,
          source: 'books',
          node: result.node,
          score: result.score,
        });
      }

      if (this.verbose) {
        console.log(`[UnifiedStore] Books search: ${booksResults.length} results`);
      }
    }

    // Sort by score descending and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit ?? DEFAULT_LIMIT);
  }

  /**
   * Search both stores by keyword (full-text search).
   */
  async searchByKeyword(
    query: string,
    options: UnifiedSearchOptions
  ): Promise<UnifiedStoreResult[]> {
    const { target, limit, hierarchyLevel, sourceType, bookId } = options;
    const results: UnifiedStoreResult[] = [];

    // Search archive if target includes it
    if (target === 'archive' || target === 'all') {
      const archiveOpts: KeywordSearchOptions = {
        limit: limit ?? DEFAULT_LIMIT,
        sourceType,
        hierarchyLevel,
      };

      const archiveResults = await this.archiveStore.searchByKeyword(query, archiveOpts);

      for (const result of archiveResults) {
        results.push({
          id: result.node.id,
          source: 'archive',
          node: result.node,
          score: result.score,
        });
      }

      if (this.verbose) {
        console.log(`[UnifiedStore] Archive keyword search: ${archiveResults.length} results`);
      }
    }

    // Search books if target includes it and store is available
    if ((target === 'books' || target === 'all') && this.hasBooksStore()) {
      const booksResults = await this.booksStore!.searchByKeyword(query, {
        limit: limit ?? DEFAULT_LIMIT,
        bookId,
        hierarchyLevel,
      });

      for (const result of booksResults) {
        results.push({
          id: result.node.id,
          source: 'books',
          node: result.node,
          score: result.score,
        });
      }

      if (this.verbose) {
        console.log(`[UnifiedStore] Books keyword search: ${booksResults.length} results`);
      }
    }

    // Sort by score descending and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit ?? DEFAULT_LIMIT);
  }

  /**
   * Query nodes without search (by filters).
   */
  async queryNodes(options: UnifiedQueryOptions): Promise<UnifiedQueryResult> {
    const { target, ids, sourceType, hierarchyLevel, bookId, limit, offset } = options;
    const archiveNodes: StoredNode[] = [];
    const bookNodes: BookNode[] = [];
    let total = 0;

    // Query archive if target includes it
    if (target === 'archive' || target === 'all') {
      if (ids && ids.length > 0) {
        // Get specific nodes by ID
        for (const id of ids) {
          const node = await this.archiveStore.getNode(id);
          if (node) {
            archiveNodes.push(node);
          }
        }
      } else {
        // Query with filters
        const result = await this.archiveStore.queryNodes({
          sourceType,
          hierarchyLevel,
          limit: limit ?? DEFAULT_LIMIT,
          offset: offset ?? 0,
        });
        archiveNodes.push(...result.nodes);
        total += result.total;
      }
    }

    // Query books if target includes it and store is available
    if ((target === 'books' || target === 'all') && this.hasBooksStore()) {
      if (ids && ids.length > 0) {
        const nodes = await this.booksStore!.getNodes(ids);
        bookNodes.push(...nodes);
      }
      // Note: Full book querying would need additional implementation
    }

    return {
      archiveNodes,
      bookNodes,
      total: total + archiveNodes.length + bookNodes.length,
      hasMore: archiveNodes.length + bookNodes.length >= (limit ?? DEFAULT_LIMIT),
    };
  }

  /**
   * Get a node by ID from either store.
   */
  async getNode(id: string): Promise<StoredNode | BookNode | undefined> {
    // Try archive first
    const archiveNode = await this.archiveStore.getNode(id);
    if (archiveNode) {
      return archiveNode;
    }

    // Try books if available
    if (this.hasBooksStore()) {
      return await this.booksStore!.getNode(id);
    }

    return undefined;
  }

  /**
   * Get nodes by IDs from both stores.
   */
  async getNodes(ids: string[]): Promise<Array<StoredNode | BookNode>> {
    const nodes: Array<StoredNode | BookNode> = [];
    const notFoundInArchive: string[] = [];

    // Try archive first
    for (const id of ids) {
      const node = await this.archiveStore.getNode(id);
      if (node) {
        nodes.push(node);
      } else {
        notFoundInArchive.push(id);
      }
    }

    // Try books for remaining IDs
    if (notFoundInArchive.length > 0 && this.hasBooksStore()) {
      const bookNodes = await this.booksStore!.getNodes(notFoundInArchive);
      nodes.push(...bookNodes);
    }

    return nodes;
  }

  /**
   * Get embedding for a node.
   */
  async getEmbedding(nodeId: string): Promise<number[] | undefined> {
    // Try archive first
    const archiveEmbedding = await this.archiveStore.getEmbedding(nodeId);
    if (archiveEmbedding) {
      return archiveEmbedding;
    }

    // Try books if available
    if (this.hasBooksStore()) {
      return await this.booksStore!.getEmbedding(nodeId);
    }

    return undefined;
  }

  /**
   * Get embeddings for multiple nodes.
   */
  async getEmbeddings(nodeIds: string[]): Promise<Map<string, number[]>> {
    const embeddings = new Map<string, number[]>();
    const notFoundInArchive: string[] = [];

    // Try archive first - get embeddings one at a time
    for (const id of nodeIds) {
      const embedding = await this.archiveStore.getEmbedding(id);
      if (embedding) {
        embeddings.set(id, embedding);
      } else {
        notFoundInArchive.push(id);
      }
    }

    // Try books for remaining IDs
    if (notFoundInArchive.length > 0 && this.hasBooksStore()) {
      const bookEmbeddings = await this.booksStore!.getEmbeddings(notFoundInArchive);
      for (const [id, embedding] of bookEmbeddings) {
        embeddings.set(id, embedding);
      }
    }

    return embeddings;
  }

  /**
   * Determine which store a node belongs to.
   */
  async getNodeSource(nodeId: string): Promise<'archive' | 'books' | undefined> {
    const archiveNode = await this.archiveStore.getNode(nodeId);
    if (archiveNode) {
      return 'archive';
    }

    if (this.hasBooksStore()) {
      const bookNode = await this.booksStore!.getNode(nodeId);
      if (bookNode) {
        return 'books';
      }
    }

    return undefined;
  }

  /**
   * Get archive store for direct access if needed.
   */
  getArchiveStore(): PostgresContentStore {
    return this.archiveStore;
  }

  /**
   * Get books store for direct access if needed.
   */
  getBooksStore(): BooksStoreInterface | null {
    return this.booksStore;
  }
}

// ═══════════════════════════════════════════════════════════════════
// STUB BOOKS STORE (for testing or when books DB is not available)
// ═══════════════════════════════════════════════════════════════════

/**
 * A stub implementation of BooksStoreInterface that always returns empty results.
 * Useful for testing or when the books database is not available.
 */
export class StubBooksStore implements BooksStoreInterface {
  private available: boolean;

  constructor(options?: { available?: boolean }) {
    this.available = options?.available ?? false;
  }

  isAvailable(): boolean {
    return this.available;
  }

  async searchByEmbedding(): Promise<Array<{ node: BookNode; score: number }>> {
    return [];
  }

  async searchByKeyword(): Promise<Array<{ node: BookNode; score: number }>> {
    return [];
  }

  async getNode(): Promise<BookNode | undefined> {
    return undefined;
  }

  async getNodes(): Promise<BookNode[]> {
    return [];
  }

  async getEmbedding(): Promise<number[] | undefined> {
    return undefined;
  }

  async getEmbeddings(): Promise<Map<string, number[]>> {
    return new Map();
  }
}
