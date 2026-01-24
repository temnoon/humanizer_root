/**
 * Books PostgreSQL Store
 *
 * Implements BooksStoreInterface for the humanizer_books database.
 * Provides vector search across book content nodes.
 *
 * @module @humanizer/core/storage/books-postgres-store
 */

import { Pool, type PoolClient } from 'pg';
import { toSql, fromSql } from 'pgvector';
import type { BooksStoreInterface } from '../agentic-search/unified-store.js';
import type { BookNode } from '../agentic-search/types.js';
import {
  type BooksStorageConfig,
  DEFAULT_BOOKS_CONFIG,
  initializeBooksSchema,
  INSERT_BOOK_NODE,
  UPDATE_NODE_EMBEDDING,
  SEMANTIC_SEARCH_BOOK,
  FTS_SEARCH_BOOK,
} from './schema-books.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface BooksPostgresStoreOptions {
  verbose?: boolean;
}

interface DbBookNode {
  id: string;
  content_hash: string;
  book_id: string;
  chapter_id: string | null;
  text: string;
  format: 'text' | 'markdown' | 'html' | 'code';
  word_count: number;
  position: number;
  hierarchy_level: number;
  parent_node_id: string | null;
  chunk_index: number | null;
  chunk_start_offset: number | null;
  chunk_end_offset: number | null;
  embedding: string | null;
  embedding_model: string | null;
  embedding_at: Date | null;
  embedding_text_hash: string | null;
  source_archive_id: string | null;
  source_type: string | null;
  annotations: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBookNodeOptions {
  bookId: string;
  chapterId?: string;
  text: string;
  format?: 'text' | 'markdown' | 'html' | 'code';
  position: number;
  hierarchyLevel?: number;
  parentNodeId?: string;
  chunkIndex?: number;
  chunkStartOffset?: number;
  chunkEndOffset?: number;
  sourceArchiveId?: string;
  sourceType?: 'original' | 'extracted' | 'synthesized';
  annotations?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function computeContentHash(text: string): string {
  // Simple hash - in production use crypto.createHash('sha256')
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function mapDbToBookNode(row: DbBookNode): BookNode {
  return {
    id: row.id,
    contentHash: row.content_hash,
    bookId: row.book_id,
    chapterId: row.chapter_id ?? undefined,
    text: row.text,
    format: row.format,
    wordCount: row.word_count,
    position: row.position,
    hierarchyLevel: row.hierarchy_level,
    parentNodeId: row.parent_node_id ?? undefined,
    chunkIndex: row.chunk_index ?? undefined,
    chunkStartOffset: row.chunk_start_offset ?? undefined,
    chunkEndOffset: row.chunk_end_offset ?? undefined,
    sourceArchiveId: row.source_archive_id ?? undefined,
    sourceType: row.source_type as 'original' | 'extracted' | 'synthesized' | undefined,
    annotations: row.annotations,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ═══════════════════════════════════════════════════════════════════
// BOOKS POSTGRES STORE
// ═══════════════════════════════════════════════════════════════════

/**
 * PostgreSQL store for book content nodes.
 * Implements BooksStoreInterface for unified search.
 */
export class BooksPostgresStore implements BooksStoreInterface {
  private pool: Pool;
  private verbose: boolean;
  private available: boolean = false;

  constructor(pool: Pool, options?: BooksPostgresStoreOptions) {
    this.pool = pool;
    this.verbose = options?.verbose ?? false;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BOOKSSTORE INTERFACE IMPLEMENTATION
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Check if the store is available
   */
  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Set availability status (called after connection test)
   */
  setAvailable(available: boolean): void {
    this.available = available;
  }

  /**
   * Search by embedding vector
   */
  async searchByEmbedding(
    embedding: number[],
    options?: {
      limit?: number;
      threshold?: number;
      bookId?: string;
      hierarchyLevel?: number;
    }
  ): Promise<Array<{ node: BookNode; score: number }>> {
    if (!this.available) {
      return [];
    }

    const limit = options?.limit ?? 20;
    const threshold = options?.threshold ?? 0.5;

    let query: string;
    let params: unknown[];

    if (options?.bookId) {
      // Search within a specific book
      query = `
        SELECT *, 1 - (embedding <=> $1::vector) as similarity
        FROM book_nodes
        WHERE book_id = $2
          AND embedding IS NOT NULL
          ${options?.hierarchyLevel !== undefined ? 'AND hierarchy_level = $4' : ''}
          AND 1 - (embedding <=> $1::vector) >= $3
        ORDER BY embedding <=> $1::vector
        LIMIT $${options?.hierarchyLevel !== undefined ? 5 : 4}
      `;
      params = options?.hierarchyLevel !== undefined
        ? [toSql(embedding), options.bookId, threshold, options.hierarchyLevel, limit]
        : [toSql(embedding), options.bookId, threshold, limit];
    } else {
      // Search across all books
      query = `
        SELECT *, 1 - (embedding <=> $1::vector) as similarity
        FROM book_nodes
        WHERE embedding IS NOT NULL
          ${options?.hierarchyLevel !== undefined ? 'AND hierarchy_level = $3' : ''}
          AND 1 - (embedding <=> $1::vector) >= $2
        ORDER BY embedding <=> $1::vector
        LIMIT $${options?.hierarchyLevel !== undefined ? 4 : 3}
      `;
      params = options?.hierarchyLevel !== undefined
        ? [toSql(embedding), threshold, options.hierarchyLevel, limit]
        : [toSql(embedding), threshold, limit];
    }

    try {
      const result = await this.pool.query(query, params);
      return result.rows.map(row => ({
        node: mapDbToBookNode(row),
        score: row.similarity,
      }));
    } catch (error) {
      if (this.verbose) {
        console.error('BooksPostgresStore.searchByEmbedding error:', error);
      }
      return [];
    }
  }

  /**
   * Search by keyword (full-text)
   */
  async searchByKeyword(
    query: string,
    options?: {
      limit?: number;
      bookId?: string;
      hierarchyLevel?: number;
    }
  ): Promise<Array<{ node: BookNode; score: number }>> {
    if (!this.available) {
      return [];
    }

    const limit = options?.limit ?? 20;

    let sql: string;
    let params: unknown[];

    if (options?.bookId) {
      sql = `
        SELECT *, ts_rank(tsv, plainto_tsquery('english', $1)) as rank
        FROM book_nodes
        WHERE book_id = $2
          AND tsv @@ plainto_tsquery('english', $1)
          ${options?.hierarchyLevel !== undefined ? 'AND hierarchy_level = $3' : ''}
        ORDER BY rank DESC
        LIMIT $${options?.hierarchyLevel !== undefined ? 4 : 3}
      `;
      params = options?.hierarchyLevel !== undefined
        ? [query, options.bookId, options.hierarchyLevel, limit]
        : [query, options.bookId, limit];
    } else {
      sql = `
        SELECT *, ts_rank(tsv, plainto_tsquery('english', $1)) as rank
        FROM book_nodes
        WHERE tsv @@ plainto_tsquery('english', $1)
          ${options?.hierarchyLevel !== undefined ? 'AND hierarchy_level = $2' : ''}
        ORDER BY rank DESC
        LIMIT $${options?.hierarchyLevel !== undefined ? 3 : 2}
      `;
      params = options?.hierarchyLevel !== undefined
        ? [query, options.hierarchyLevel, limit]
        : [query, limit];
    }

    try {
      const result = await this.pool.query(sql, params);
      return result.rows.map(row => ({
        node: mapDbToBookNode(row),
        score: row.rank,
      }));
    } catch (error) {
      if (this.verbose) {
        console.error('BooksPostgresStore.searchByKeyword error:', error);
      }
      return [];
    }
  }

  /**
   * Get node by ID
   */
  async getNode(id: string): Promise<BookNode | undefined> {
    if (!this.available) {
      return undefined;
    }

    try {
      const result = await this.pool.query<DbBookNode>(
        'SELECT * FROM book_nodes WHERE id = $1',
        [id]
      );
      return result.rows[0] ? mapDbToBookNode(result.rows[0]) : undefined;
    } catch (error) {
      if (this.verbose) {
        console.error('BooksPostgresStore.getNode error:', error);
      }
      return undefined;
    }
  }

  /**
   * Get nodes by IDs
   */
  async getNodes(ids: string[]): Promise<BookNode[]> {
    if (!this.available || ids.length === 0) {
      return [];
    }

    try {
      const result = await this.pool.query<DbBookNode>(
        'SELECT * FROM book_nodes WHERE id = ANY($1)',
        [ids]
      );
      return result.rows.map(mapDbToBookNode);
    } catch (error) {
      if (this.verbose) {
        console.error('BooksPostgresStore.getNodes error:', error);
      }
      return [];
    }
  }

  /**
   * Get embedding for a node
   */
  async getEmbedding(nodeId: string): Promise<number[] | undefined> {
    if (!this.available) {
      return undefined;
    }

    try {
      const result = await this.pool.query(
        'SELECT embedding FROM book_nodes WHERE id = $1 AND embedding IS NOT NULL',
        [nodeId]
      );
      if (result.rows[0]?.embedding) {
        return fromSql(result.rows[0].embedding);
      }
      return undefined;
    } catch (error) {
      if (this.verbose) {
        console.error('BooksPostgresStore.getEmbedding error:', error);
      }
      return undefined;
    }
  }

  /**
   * Get embeddings for multiple nodes
   */
  async getEmbeddings(nodeIds: string[]): Promise<Map<string, number[]>> {
    const result = new Map<string, number[]>();
    if (!this.available || nodeIds.length === 0) {
      return result;
    }

    try {
      const queryResult = await this.pool.query(
        'SELECT id, embedding FROM book_nodes WHERE id = ANY($1) AND embedding IS NOT NULL',
        [nodeIds]
      );
      for (const row of queryResult.rows) {
        if (row.embedding) {
          result.set(row.id, fromSql(row.embedding));
        }
      }
    } catch (error) {
      if (this.verbose) {
        console.error('BooksPostgresStore.getEmbeddings error:', error);
      }
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  // ADDITIONAL CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a book node
   */
  async createNode(options: CreateBookNodeOptions): Promise<BookNode> {
    const contentHash = computeContentHash(options.text);
    const wordCount = countWords(options.text);

    const result = await this.pool.query<DbBookNode>(INSERT_BOOK_NODE, [
      options.bookId,
      options.chapterId || null,
      contentHash,
      options.text,
      options.format || 'markdown',
      wordCount,
      options.position,
      options.hierarchyLevel ?? 0,
      options.parentNodeId || null,
      options.chunkIndex ?? null,
      options.chunkStartOffset ?? null,
      options.chunkEndOffset ?? null,
      options.sourceArchiveId || null,
      options.sourceType || null,
      options.annotations || {},
      options.metadata || {},
    ]);

    return mapDbToBookNode(result.rows[0]);
  }

  /**
   * Update node embedding
   */
  async updateNodeEmbedding(
    nodeId: string,
    embedding: number[],
    model: string,
    textHash: string
  ): Promise<void> {
    await this.pool.query(UPDATE_NODE_EMBEDDING, [
      toSql(embedding),
      model,
      textHash,
      nodeId,
    ]);
  }

  /**
   * Get all nodes for a book
   */
  async getBookNodes(
    bookId: string,
    options?: { hierarchyLevel?: number; chapterId?: string }
  ): Promise<BookNode[]> {
    let query = 'SELECT * FROM book_nodes WHERE book_id = $1';
    const params: unknown[] = [bookId];
    let paramIdx = 2;

    if (options?.hierarchyLevel !== undefined) {
      query += ` AND hierarchy_level = $${paramIdx}`;
      params.push(options.hierarchyLevel);
      paramIdx++;
    }

    if (options?.chapterId) {
      query += ` AND chapter_id = $${paramIdx}`;
      params.push(options.chapterId);
      paramIdx++;
    }

    query += ' ORDER BY position ASC';

    const result = await this.pool.query<DbBookNode>(query, params);
    return result.rows.map(mapDbToBookNode);
  }

  /**
   * Get nodes missing embeddings
   */
  async getNodesWithoutEmbeddings(bookId?: string, limit?: number): Promise<BookNode[]> {
    let query = 'SELECT * FROM book_nodes WHERE embedding IS NULL';
    const params: unknown[] = [];

    if (bookId) {
      query += ' AND book_id = $1';
      params.push(bookId);
    }

    query += ' ORDER BY created_at ASC';

    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }

    const result = await this.pool.query<DbBookNode>(query, params);
    return result.rows.map(mapDbToBookNode);
  }

  /**
   * Delete nodes for a book
   */
  async deleteBookNodes(bookId: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM book_nodes WHERE book_id = $1',
      [bookId]
    );
    return result.rowCount || 0;
  }

  /**
   * Count nodes for a book by hierarchy level
   */
  async countNodesByLevel(bookId: string): Promise<Record<number, number>> {
    const result = await this.pool.query(
      `SELECT hierarchy_level, COUNT(*) as count
       FROM book_nodes
       WHERE book_id = $1
       GROUP BY hierarchy_level
       ORDER BY hierarchy_level`,
      [bookId]
    );

    const counts: Record<number, number> = {};
    for (const row of result.rows) {
      counts[row.hierarchy_level] = parseInt(row.count, 10);
    }
    return counts;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let booksStoreInstance: BooksPostgresStore | null = null;
let booksPoolInstance: Pool | null = null;

/**
 * Initialize the books store with a new connection pool.
 */
export async function initBooksStore(
  config: Partial<BooksStorageConfig> = {}
): Promise<BooksPostgresStore> {
  const fullConfig = { ...DEFAULT_BOOKS_CONFIG, ...config };

  // Create pool
  booksPoolInstance = new Pool({
    host: fullConfig.host,
    port: fullConfig.port,
    database: fullConfig.database,
    user: fullConfig.user,
    password: fullConfig.password,
    max: fullConfig.maxConnections,
    idleTimeoutMillis: fullConfig.idleTimeoutMs,
    connectionTimeoutMillis: fullConfig.connectionTimeoutMs,
  });

  // Test connection
  try {
    const client = await booksPoolInstance.connect();
    client.release();
  } catch (error) {
    console.warn('Books database not available, using stub store:', error);
    booksStoreInstance = new BooksPostgresStore(booksPoolInstance);
    booksStoreInstance.setAvailable(false);
    return booksStoreInstance;
  }

  // Initialize schema
  try {
    await initializeBooksSchema(booksPoolInstance, fullConfig);
  } catch (error) {
    console.warn('Failed to initialize books schema:', error);
  }

  booksStoreInstance = new BooksPostgresStore(booksPoolInstance);
  booksStoreInstance.setAvailable(true);

  return booksStoreInstance;
}

/**
 * Get the books store instance.
 */
export function getBooksStore(): BooksPostgresStore | null {
  return booksStoreInstance;
}

/**
 * Get the books pool instance.
 */
export function getBooksPool(): Pool | null {
  return booksPoolInstance;
}

/**
 * Close the books store and pool.
 */
export async function closeBooksStore(): Promise<void> {
  if (booksPoolInstance) {
    await booksPoolInstance.end();
    booksPoolInstance = null;
  }
  booksStoreInstance = null;
}

/**
 * Reset the books store (for testing).
 */
export function resetBooksStore(): void {
  booksStoreInstance = null;
  booksPoolInstance = null;
}
