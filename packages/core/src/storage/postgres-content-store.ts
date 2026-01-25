/**
 * PostgresContentStore - PostgreSQL-backed UCG Storage
 *
 * Production-ready storage for the Universal Content Graph using
 * PostgreSQL + pgvector for HNSW-indexed vector search.
 *
 * Key features:
 * - Content deduplication via SHA-256 hashing
 * - Full-text search via tsvector + GIN index
 * - Vector search via pgvector HNSW index
 * - Batch operations for efficient imports
 * - Import job tracking
 * - Async API throughout
 */

import { createHash, randomUUID } from 'crypto';
import { Pool, PoolClient } from 'pg';
import { registerTypes } from 'pgvector/pg';
import { toSql, fromSql } from 'pgvector';
import {
  initializeSchema,
  PostgresStorageConfig,
  DEFAULT_POSTGRES_CONFIG,
  INSERT_CONTENT_NODE,
  UPDATE_EMBEDDING,
  INSERT_LINK,
  INSERT_JOB,
  VECTOR_SEARCH,
  GET_RANDOM_EMBEDDED_NODES,
  FTS_SEARCH,
  GET_NODE_BY_ID,
  GET_NODE_BY_URI,
  GET_NODE_BY_HASH,
  DELETE_NODE,
  GET_LINKS_FROM,
  GET_LINKS_TO,
  GET_JOB,
  GET_JOBS,
  GET_NODES_NEEDING_EMBEDDINGS,
  GET_EMBEDDING,
  GET_STATS,
  GET_NODES_BY_SOURCE_TYPE,
  GET_NODES_BY_ADAPTER,
  // Fine-grained deduplication
  FIND_NODES_BY_PARAGRAPH_HASH,
  FIND_NODES_BY_LINE_HASH,
  FIND_NODES_BY_ANY_PARAGRAPH_HASH,
  FIND_NODES_BY_ANY_LINE_HASH,
  UPDATE_FIRST_SEEN,
  GET_FIRST_SEEN_BY_HASH,
  GET_DUPLICATE_STATS,
  // Media-text associations
  INSERT_MEDIA_TEXT_ASSOCIATION,
  GET_ASSOCIATIONS_BY_MEDIA,
  GET_ASSOCIATIONS_BY_NODE,
  GET_ASSOCIATIONS_BY_GIZMO,
  GET_MEDIA_CHAIN,
  GET_BATCH_ASSOCIATIONS,
  GET_TEXT_FOR_MEDIA,
  GET_MEDIA_FOR_TEXT,
  GET_ASSOCIATIONS_BY_CONVERSATION,
  GET_MEDIA_TEXT_STATS,
  SEARCH_EXTRACTED_TEXT,
} from './schema-postgres.js';
import type {
  StoredNode,
  StoredLink,
  ImportJob,
  ImportJobStatus,
  QueryOptions,
  QueryResult,
  SearchResult,
  EmbeddingSearchOptions,
  KeywordSearchOptions,
  ContentStoreStats,
  BatchStoreResult,
  BatchEmbeddingResult,
  MediaRef,
  AuthorRole,
  ContentFormat,
  ContentLinkType,
} from './types.js';
import type { ImportedNode, ContentLink } from '../adapters/types.js';
import type { ParagraphHash, LineHash } from '../chunking/content-hasher.js';
import type { MediaTextAssociation, MediaTextStats } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// DATABASE ROW TYPES
// ═══════════════════════════════════════════════════════════════════

interface DbRow {
  id: string;
  content_hash: string;
  uri: string;
  text: string;
  format: string;
  word_count: number;
  embedding: string | null;
  embedding_model: string | null;
  embedding_at: Date | null;
  embedding_text_hash: string | null;
  parent_node_id: string | null;
  position: number | null;
  chunk_index: number | null;
  chunk_start_offset: number | null;
  chunk_end_offset: number | null;
  hierarchy_level: number;
  thread_root_id: string | null;
  source_type: string;
  source_adapter: string;
  source_original_id: string | null;
  source_original_path: string | null;
  import_job_id: string | null;
  title: string | null;
  author: string | null;
  author_role: string | null;
  tags: string[] | null;
  media_refs: MediaRef[] | null;
  source_metadata: Record<string, unknown> | null;
  // Fine-grained deduplication
  paragraph_hashes: ParagraphHash[] | null;
  line_hashes: LineHash[] | null;
  first_seen_at: Date | null;
  // Timestamps
  source_created_at: Date | null;
  source_updated_at: Date | null;
  created_at: Date;
  imported_at: Date;
}

interface DbLinkRow {
  id: string;
  source_id: string;
  target_id: string;
  link_type: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

interface DbJobRow {
  id: string;
  adapter_id: string;
  source_path: string;
  status: string;
  nodes_imported: number;
  nodes_skipped: number;
  nodes_failed: number;
  links_created: number;
  started_at: Date | null;
  completed_at: Date | null;
  error: string | null;
  stats: Record<string, unknown> | null;
}

// Row types for duplicate detection queries
interface DbDuplicateRow {
  id: string;
  content_hash: string;
  first_seen_at: Date | null;
  created_at: Date;
  title?: string | null;
}

interface DbDuplicateDetailedRow extends DbDuplicateRow {
  paragraph_hashes?: ParagraphHash[] | null;
  line_hashes?: LineHash[] | null;
  source_type: string;
}

// ═══════════════════════════════════════════════════════════════════
// DUPLICATE DETECTION TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * A match from duplicate detection
 */
export interface DuplicateMatch {
  /** Node ID */
  nodeId: string;
  /** Content hash of the node */
  contentHash: string;
  /** When this content was first seen (provenance) */
  firstSeenAt?: number;
  /** When this node was created */
  createdAt: number;
}

/**
 * Detailed duplicate match with hash arrays
 */
export interface DuplicateMatchDetailed extends DuplicateMatch {
  /** Paragraph hashes from this node */
  paragraphHashes?: ParagraphHash[];
  /** Line hashes from this node */
  lineHashes?: LineHash[];
  /** Node title if available */
  title?: string;
  /** Source type */
  sourceType: string;
}

/**
 * Statistics about duplicate content
 */
export interface DuplicateStats {
  /** Number of unique paragraphs appearing in multiple nodes */
  duplicateParagraphCount: number;
  /** Total paragraph duplications (sum of occurrences) */
  totalParagraphDuplicates: number;
  /** Number of unique lines appearing in multiple nodes */
  duplicateLineCount: number;
  /** Total line duplications (sum of occurrences) */
  totalLineDuplicates: number;
}

// Row type for media_text_associations
interface DbMediaTextRow {
  id: string;
  media_id: string;
  media_pointer: string | null;
  node_id: string | null;
  text_span_start: number | null;
  text_span_end: number | null;
  extracted_text: string | null;
  association_type: string;
  source_media_id: string | null;
  chain_position: number;
  extraction_method: string | null;
  confidence: number | null;
  gizmo_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  batch_id: string | null;
  batch_position: number | null;
  import_job_id: string | null;
  source_created_at: Date | null;
  created_at: Date;
  // Joined fields
  full_node_text?: string;
  node_title?: string;
  rank?: number;
}

// ═══════════════════════════════════════════════════════════════════
// CONTENT STORE CLASS
// ═══════════════════════════════════════════════════════════════════

/**
 * PostgreSQL-backed content store for UCG
 */
export class PostgresContentStore {
  private pool: Pool | null = null;
  private config: PostgresStorageConfig;
  private initialized = false;

  constructor(config: Partial<PostgresStorageConfig> = {}) {
    this.config = { ...DEFAULT_POSTGRES_CONFIG, ...config };
  }

  /**
   * Initialize the database connection and schema
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create connection pool
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      max: this.config.maxConnections,
      idleTimeoutMillis: this.config.idleTimeoutMs,
      connectionTimeoutMillis: this.config.connectionTimeoutMs,
    });

    // Register pgvector types on each new connection
    this.pool.on('connect', async (client) => {
      await registerTypes(client);
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err);
    });

    // Initialize pgvector types on existing connections by getting a client
    const client = await this.pool.connect();
    await registerTypes(client);
    client.release();

    // Initialize schema
    await initializeSchema(this.pool, this.config);

    this.initialized = true;
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.initialized = false;
  }

  /**
   * Get the raw pool for advanced operations
   */
  getPool(): Pool {
    this.ensureInitialized();
    return this.pool!;
  }

  // ─────────────────────────────────────────────────────────────────
  // NODE OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Store a single node from an adapter
   */
  async storeNode(node: ImportedNode, jobId?: string): Promise<StoredNode> {
    this.ensureInitialized();

    // Check for duplicate by content hash
    const existing = await this.getNodeByHash(node.contentHash);
    if (existing) {
      return existing;
    }

    const now = new Date();
    const id = node.id || randomUUID();

    // Compute word count
    const wordCount = this.countWords(node.content);

    // Extract source adapter from URI
    const sourceAdapter = node.uri.split('/')[2] || 'unknown';

    // Resolve parent and thread root IDs
    const parentNodeId = node.parentUri ? await this.uriToId(node.parentUri) : null;
    const threadRootId = node.threadRootUri ? await this.uriToId(node.threadRootUri) : null;

    const params = [
      id,
      node.contentHash,
      node.uri,
      node.content,
      node.format,
      wordCount,
      null, // embedding
      null, // embedding_model
      null, // embedding_at
      null, // embedding_text_hash
      parentNodeId,
      node.position ?? null,
      node.chunkIndex ?? null,
      node.chunkStartOffset ?? null,
      node.chunkEndOffset ?? null,
      node.hierarchyLevel ?? 0,
      threadRootId,
      node.sourceType,
      node.sourceAdapter || sourceAdapter,
      (node.metadata?.originalId as string) ?? null,
      (node.metadata?.originalPath as string) ?? null,
      jobId ?? null,
      (node.metadata?.title as string) ?? null,
      node.author?.name || node.author?.handle || null,
      node.author?.role ?? null,
      JSON.stringify((node.metadata?.tags as string[]) ?? []),
      JSON.stringify(node.media ?? []),
      node.metadata ? JSON.stringify(node.metadata) : null,
      // Fine-grained deduplication hashes
      JSON.stringify(node.paragraphHashes ?? []),
      JSON.stringify(node.lineHashes ?? []),
      node.firstSeenAt ?? now, // Default to now if not set
      // Timestamps
      node.sourceCreatedAt ?? null,
      node.sourceUpdatedAt ?? null,
      now,
      now,
    ];

    const result = await this.pool!.query(INSERT_CONTENT_NODE, params);
    const row = result.rows[0] as DbRow;

    // Store links
    if (node.links) {
      for (const link of node.links) {
        await this.createLink(id, link);
      }
    }

    return this.rowToNode(row);
  }

  /**
   * Store multiple nodes in batch
   */
  async storeNodes(nodes: ImportedNode[], jobId?: string): Promise<BatchStoreResult> {
    this.ensureInitialized();

    const result: BatchStoreResult = {
      stored: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    const client = await this.pool!.connect();
    
    try {
      await client.query('BEGIN');

      for (const node of nodes) {
        try {
          const existing = await this.getNodeByHashWithClient(client, node.contentHash);
          if (existing) {
            result.skipped++;
            continue;
          }

          await this.storeNodeWithClient(client, node, jobId);
          result.stored++;
        } catch (error) {
          result.failed++;
          result.errors?.push({
            nodeId: node.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return result;
  }

  /**
   * Get a node by ID
   */
  async getNode(id: string): Promise<StoredNode | undefined> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_NODE_BY_ID, [id]);
    const row = result.rows[0] as DbRow | undefined;

    return row ? this.rowToNode(row) : undefined;
  }

  /**
   * Get a node by URI
   */
  async getNodeByUri(uri: string): Promise<StoredNode | undefined> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_NODE_BY_URI, [uri]);
    const row = result.rows[0] as DbRow | undefined;

    return row ? this.rowToNode(row) : undefined;
  }

  /**
   * Get a node by content hash
   */
  async getNodeByHash(hash: string): Promise<StoredNode | undefined> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_NODE_BY_HASH, [hash]);
    const row = result.rows[0] as DbRow | undefined;

    return row ? this.rowToNode(row) : undefined;
  }

  /**
   * Query nodes with filters
   */
  async queryNodes(options: QueryOptions): Promise<QueryResult> {
    this.ensureInitialized();

    const { sql, params } = this.buildQuerySql(options);

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await this.pool!.query(countSql, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    let paginatedSql = sql;
    const paginatedParams = [...params];

    if (options.orderBy) {
      const orderCol = this.columnNameMap[options.orderBy] || 'created_at';
      const orderDir = options.orderDir?.toUpperCase() || 'DESC';
      paginatedSql += ` ORDER BY ${orderCol} ${orderDir}`;
    } else {
      paginatedSql += ' ORDER BY created_at DESC';
    }

    if (options.limit) {
      paginatedSql += ` LIMIT $${paginatedParams.length + 1}`;
      paginatedParams.push(options.limit);
    }

    if (options.offset) {
      paginatedSql += ` OFFSET $${paginatedParams.length + 1}`;
      paginatedParams.push(options.offset);
    }

    const result = await this.pool!.query(paginatedSql, paginatedParams);
    const nodes = result.rows.map((row: DbRow) => this.rowToNode(row));

    return {
      nodes,
      total,
      hasMore: (options.offset ?? 0) + nodes.length < total,
    };
  }

  /**
   * Delete a node by ID
   */
  async deleteNode(id: string): Promise<boolean> {
    this.ensureInitialized();

    const result = await this.pool!.query(DELETE_NODE, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete nodes by import job
   */
  async deleteByJob(jobId: string): Promise<number> {
    this.ensureInitialized();

    const result = await this.pool!.query(
      'DELETE FROM content_nodes WHERE import_job_id = $1',
      [jobId]
    );
    return result.rowCount ?? 0;
  }

  // ─────────────────────────────────────────────────────────────────
  // EMBEDDING OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Store an embedding for a node
   */
  async storeEmbedding(nodeId: string, embedding: number[], model: string): Promise<void> {
    this.ensureInitialized();

    if (!this.config.enableVec) {
      throw new Error('Vector search is not enabled');
    }

    // Get node to compute text hash
    const node = await this.getNode(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const textHash = this.hashText(node.text);
    const now = new Date();

    // Convert to pgvector format
    const vectorSql = toSql(embedding);

    await this.pool!.query(UPDATE_EMBEDDING, [vectorSql, model, now, textHash, nodeId]);
  }

  /**
   * Store embeddings in batch
   */
  async storeEmbeddings(
    items: Array<{ nodeId: string; embedding: number[] }>,
    model: string
  ): Promise<BatchEmbeddingResult> {
    this.ensureInitialized();

    const result: BatchEmbeddingResult = {
      stored: 0,
      skipped: 0,
      failed: 0,
    };

    const client = await this.pool!.connect();

    try {
      await client.query('BEGIN');

      for (const { nodeId, embedding } of items) {
        try {
          // Get node text for hash
          const nodeResult = await client.query('SELECT text FROM content_nodes WHERE id = $1', [nodeId]);
          if (nodeResult.rows.length === 0) {
            result.failed++;
            continue;
          }

          const textHash = this.hashText(nodeResult.rows[0].text);
          const vectorSql = toSql(embedding);
          const now = new Date();

          await client.query(UPDATE_EMBEDDING, [vectorSql, model, now, textHash, nodeId]);
          result.stored++;
        } catch (error) {
          console.debug('[PostgresContentStore] Failed to store embedding:', error);
          result.failed++;
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return result;
  }

  /**
   * Get embedding for a node
   */
  async getEmbedding(nodeId: string): Promise<number[] | undefined> {
    this.ensureInitialized();

    if (!this.config.enableVec) {
      return undefined;
    }

    const result = await this.pool!.query(GET_EMBEDDING, [nodeId]);
    if (result.rows.length === 0 || !result.rows[0].embedding) {
      return undefined;
    }

    const embedding = result.rows[0].embedding;
    // When pgvector types are registered, embedding is already a number[]
    // Only call fromSql if it's still a string
    if (Array.isArray(embedding)) {
      return embedding;
    }
    return fromSql(embedding);
  }

  /**
   * Check if an embedding is stale (text changed since embedding)
   */
  async isEmbeddingStale(nodeId: string): Promise<boolean> {
    this.ensureInitialized();

    const node = await this.getNode(nodeId);
    if (!node || !node.embeddingTextHash) {
      return true;
    }

    const currentHash = this.hashText(node.text);
    return currentHash !== node.embeddingTextHash;
  }

  /**
   * Get nodes that need embeddings
   */
  async getNodesNeedingEmbeddings(limit: number): Promise<StoredNode[]> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_NODES_NEEDING_EMBEDDINGS, [limit]);
    return result.rows.map((row: DbRow) => this.rowToNode(row));
  }

  /**
   * Get random nodes that have embeddings (for clustering seed selection).
   * Returns node IDs only for efficiency - use getNode() to fetch full data.
   */
  async getRandomEmbeddedNodeIds(limit: number): Promise<string[]> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_RANDOM_EMBEDDED_NODES, [limit]);
    return result.rows.map((row: { id: string }) => row.id);
  }

  // ─────────────────────────────────────────────────────────────────
  // SEARCH OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Search by embedding similarity
   */
  async searchByEmbedding(
    embedding: number[],
    options: EmbeddingSearchOptions = {}
  ): Promise<SearchResult[]> {
    this.ensureInitialized();

    if (!this.config.enableVec) {
      throw new Error('Vector search is not enabled');
    }

    const limit = options.limit ?? 20;
    const vectorSql = toSql(embedding);

    // Get candidates from vector search
    const vecResults = await this.pool!.query(VECTOR_SEARCH, [vectorSql, limit * 2]);

    // Filter and enrich results
    const results: SearchResult[] = [];
    for (const row of vecResults.rows as Array<{ id: string; similarity: number }>) {
      const similarity = row.similarity;

      if (options.threshold && similarity < options.threshold) {
        continue;
      }

      const node = await this.getNode(row.id);
      if (!node) continue;

      // Apply filters
      if (options.sourceType) {
        const types = Array.isArray(options.sourceType)
          ? options.sourceType
          : [options.sourceType];
        if (!types.includes(node.sourceType)) continue;
      }

      if (options.hierarchyLevel !== undefined && node.hierarchyLevel !== options.hierarchyLevel) {
        continue;
      }

      if (options.threadRootId && node.threadRootId !== options.threadRootId) {
        continue;
      }

      results.push({
        node,
        score: similarity,
        distance: 1 - similarity,
      });

      if (results.length >= limit) break;
    }

    return results;
  }

  /**
   * Search by keywords (FTS)
   */
  async searchByKeyword(query: string, options: KeywordSearchOptions = {}): Promise<SearchResult[]> {
    this.ensureInitialized();

    if (!this.config.enableFTS) {
      throw new Error('Full-text search is not enabled');
    }

    const limit = options.limit ?? 20;

    // Search using tsvector
    const ftsResults = await this.pool!.query(FTS_SEARCH, [query, limit * 2]);

    // Enrich results
    const results: SearchResult[] = [];
    for (const row of ftsResults.rows as Array<{ id: string; rank: number }>) {
      const node = await this.getNode(row.id);
      if (!node) continue;

      // Apply filters
      if (options.sourceType) {
        const types = Array.isArray(options.sourceType)
          ? options.sourceType
          : [options.sourceType];
        if (!types.includes(node.sourceType)) continue;
      }

      if (options.hierarchyLevel !== undefined && node.hierarchyLevel !== options.hierarchyLevel) {
        continue;
      }

      if (options.threadRootId && node.threadRootId !== options.threadRootId) {
        continue;
      }

      results.push({
        node,
        score: row.rank,
        bm25Score: row.rank,
      });

      if (results.length >= limit) break;
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────
  // FINE-GRAINED DEDUPLICATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Find nodes that contain a specific paragraph hash
   *
   * @param hash - The paragraph hash to search for
   * @returns Nodes containing this paragraph, ordered by first_seen_at
   */
  async findNodesByParagraphHash(hash: string): Promise<DuplicateMatch[]> {
    this.ensureInitialized();

    // Search for hash in the JSONB array
    const searchPattern = JSON.stringify([{ hash }]);
    const result = await this.pool!.query(FIND_NODES_BY_PARAGRAPH_HASH, [searchPattern]);

    return result.rows.map((row: DbDuplicateRow) => ({
      nodeId: row.id,
      contentHash: row.content_hash,
      firstSeenAt: row.first_seen_at?.getTime(),
      createdAt: row.created_at.getTime(),
    }));
  }

  /**
   * Find nodes that contain a specific line hash
   *
   * @param hash - The line hash to search for
   * @returns Nodes containing this line, ordered by first_seen_at
   */
  async findNodesByLineHash(hash: string): Promise<DuplicateMatch[]> {
    this.ensureInitialized();

    const searchPattern = JSON.stringify([{ hash }]);
    const result = await this.pool!.query(FIND_NODES_BY_LINE_HASH, [searchPattern]);

    return result.rows.map((row: DbDuplicateRow) => ({
      nodeId: row.id,
      contentHash: row.content_hash,
      firstSeenAt: row.first_seen_at?.getTime(),
      createdAt: row.created_at.getTime(),
    }));
  }

  /**
   * Find nodes containing ANY of the provided paragraph hashes
   * Efficient batch lookup for duplicate detection during import
   *
   * @param hashes - Array of paragraph hashes to search for
   * @returns Nodes containing any of these paragraphs
   */
  async findNodesByAnyParagraphHash(hashes: string[]): Promise<DuplicateMatchDetailed[]> {
    this.ensureInitialized();

    if (hashes.length === 0) return [];

    const result = await this.pool!.query(FIND_NODES_BY_ANY_PARAGRAPH_HASH, [hashes]);

    return result.rows.map((row: DbDuplicateDetailedRow) => ({
      nodeId: row.id,
      contentHash: row.content_hash,
      firstSeenAt: row.first_seen_at?.getTime(),
      createdAt: row.created_at.getTime(),
      paragraphHashes: row.paragraph_hashes ?? [],
      title: row.title ?? undefined,
      sourceType: row.source_type,
    }));
  }

  /**
   * Find nodes containing ANY of the provided line hashes
   * Useful for detecting copy-pasted content
   *
   * @param hashes - Array of line hashes to search for
   * @returns Nodes containing any of these lines
   */
  async findNodesByAnyLineHash(hashes: string[]): Promise<DuplicateMatchDetailed[]> {
    this.ensureInitialized();

    if (hashes.length === 0) return [];

    const result = await this.pool!.query(FIND_NODES_BY_ANY_LINE_HASH, [hashes]);

    return result.rows.map((row: DbDuplicateDetailedRow) => ({
      nodeId: row.id,
      contentHash: row.content_hash,
      firstSeenAt: row.first_seen_at?.getTime(),
      createdAt: row.created_at.getTime(),
      lineHashes: row.line_hashes ?? [],
      title: row.title ?? undefined,
      sourceType: row.source_type,
    }));
  }

  /**
   * Get the first occurrence of content by its hash
   * Used for provenance tracking
   *
   * @param contentHash - The content hash to look up
   * @returns The earliest node with this content
   */
  async getFirstSeenByHash(contentHash: string): Promise<DuplicateMatch | undefined> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_FIRST_SEEN_BY_HASH, [contentHash]);
    const row = result.rows[0] as DbDuplicateRow | undefined;

    if (!row) return undefined;

    return {
      nodeId: row.id,
      contentHash: row.content_hash,
      firstSeenAt: row.first_seen_at?.getTime(),
      createdAt: row.created_at.getTime(),
    };
  }

  /**
   * Update the first_seen_at timestamp for a node
   * Used when importing content that we know existed earlier
   *
   * @param nodeId - The node to update
   * @param firstSeenAt - The timestamp when content was first seen
   */
  async updateFirstSeen(nodeId: string, firstSeenAt: Date): Promise<void> {
    this.ensureInitialized();

    await this.pool!.query(UPDATE_FIRST_SEEN, [firstSeenAt, nodeId]);
  }

  /**
   * Get statistics about duplicate content in the store
   */
  async getDuplicateStats(): Promise<DuplicateStats> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_DUPLICATE_STATS);
    const row = result.rows[0];

    return {
      duplicateParagraphCount: parseInt(row.duplicate_paragraph_count ?? '0', 10),
      totalParagraphDuplicates: parseInt(row.total_paragraph_duplicates ?? '0', 10),
      duplicateLineCount: parseInt(row.duplicate_line_count ?? '0', 10),
      totalLineDuplicates: parseInt(row.total_line_duplicates ?? '0', 10),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // MEDIA-TEXT ASSOCIATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Store a media-text association
   */
  async storeMediaTextAssociation(
    association: Omit<MediaTextAssociation, 'id' | 'createdAt'>
  ): Promise<MediaTextAssociation> {
    this.ensureInitialized();

    const id = randomUUID();
    const now = new Date();

    const params = [
      id,
      association.mediaId,
      association.mediaPointer ?? null,
      association.nodeId ?? null,
      association.textSpanStart ?? null,
      association.textSpanEnd ?? null,
      association.extractedText ?? null,
      association.associationType,
      association.sourceMediaId ?? null,
      association.chainPosition ?? 0,
      association.extractionMethod ?? null,
      association.confidence ?? null,
      association.gizmoId ?? null,
      association.conversationId ?? null,
      association.messageId ?? null,
      association.batchId ?? null,
      association.batchPosition ?? null,
      association.importJobId ?? null,
      association.sourceCreatedAt ? new Date(association.sourceCreatedAt) : null,
      now,
    ];

    const result = await this.pool!.query(INSERT_MEDIA_TEXT_ASSOCIATION, params);
    return this.rowToMediaTextAssociation(result.rows[0]);
  }

  /**
   * Store multiple media-text associations in batch
   */
  async storeMediaTextAssociations(
    associations: Array<Omit<MediaTextAssociation, 'id' | 'createdAt'>>
  ): Promise<{ stored: number; failed: number }> {
    this.ensureInitialized();

    const client = await this.pool!.connect();
    let stored = 0;
    let failed = 0;

    try {
      await client.query('BEGIN');

      for (const association of associations) {
        try {
          const id = randomUUID();
          const now = new Date();

          const params = [
            id,
            association.mediaId,
            association.mediaPointer ?? null,
            association.nodeId ?? null,
            association.textSpanStart ?? null,
            association.textSpanEnd ?? null,
            association.extractedText ?? null,
            association.associationType,
            association.sourceMediaId ?? null,
            association.chainPosition ?? 0,
            association.extractionMethod ?? null,
            association.confidence ?? null,
            association.gizmoId ?? null,
            association.conversationId ?? null,
            association.messageId ?? null,
            association.batchId ?? null,
            association.batchPosition ?? null,
            association.importJobId ?? null,
            association.sourceCreatedAt ? new Date(association.sourceCreatedAt) : null,
            now,
          ];

          await client.query(INSERT_MEDIA_TEXT_ASSOCIATION, params);
          stored++;
        } catch (error) {
          failed++;
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return { stored, failed };
  }

  /**
   * Get associations for a media item
   */
  async getAssociationsByMedia(mediaId: string): Promise<MediaTextAssociation[]> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_ASSOCIATIONS_BY_MEDIA, [mediaId]);
    return result.rows.map((row: DbMediaTextRow) => this.rowToMediaTextAssociation(row));
  }

  /**
   * Get associations for a node
   */
  async getAssociationsByNode(nodeId: string): Promise<MediaTextAssociation[]> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_ASSOCIATIONS_BY_NODE, [nodeId]);
    return result.rows.map((row: DbMediaTextRow) => this.rowToMediaTextAssociation(row));
  }

  /**
   * Get associations by Custom GPT gizmo ID
   */
  async getAssociationsByGizmo(gizmoId: string): Promise<MediaTextAssociation[]> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_ASSOCIATIONS_BY_GIZMO, [gizmoId]);
    return result.rows.map((row: DbMediaTextRow) => this.rowToMediaTextAssociation(row));
  }

  /**
   * Get an image chain (original → echo → echo sequence)
   */
  async getMediaChain(mediaId: string): Promise<MediaTextAssociation[]> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_MEDIA_CHAIN, [mediaId]);
    return result.rows.map((row: DbMediaTextRow) => this.rowToMediaTextAssociation(row));
  }

  /**
   * Get associations for a batch (multiple images → one text)
   */
  async getBatchAssociations(batchId: string): Promise<MediaTextAssociation[]> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_BATCH_ASSOCIATIONS, [batchId]);
    return result.rows.map((row: DbMediaTextRow) => this.rowToMediaTextAssociation(row));
  }

  /**
   * Get text extractions for a media item (with full node text if available)
   */
  async getTextForMedia(
    mediaId: string
  ): Promise<Array<MediaTextAssociation & { fullNodeText?: string; nodeTitle?: string }>> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_TEXT_FOR_MEDIA, [mediaId]);
    return result.rows.map((row: DbMediaTextRow) => ({
      ...this.rowToMediaTextAssociation(row),
      fullNodeText: row.full_node_text ?? undefined,
      nodeTitle: row.node_title ?? undefined,
    }));
  }

  /**
   * Get media associated with a text node
   */
  async getMediaForText(
    nodeId: string
  ): Promise<Array<MediaTextAssociation & { fullNodeText?: string }>> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_MEDIA_FOR_TEXT, [nodeId]);
    return result.rows.map((row: DbMediaTextRow) => ({
      ...this.rowToMediaTextAssociation(row),
      fullNodeText: row.full_node_text ?? undefined,
    }));
  }

  /**
   * Get associations for a conversation
   */
  async getAssociationsByConversation(
    conversationId: string
  ): Promise<Array<MediaTextAssociation & { fullNodeText?: string; nodeTitle?: string }>> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_ASSOCIATIONS_BY_CONVERSATION, [conversationId]);
    return result.rows.map((row: DbMediaTextRow) => ({
      ...this.rowToMediaTextAssociation(row),
      fullNodeText: row.full_node_text ?? undefined,
      nodeTitle: row.node_title ?? undefined,
    }));
  }

  /**
   * Search extracted text
   */
  async searchExtractedText(
    query: string,
    limit: number = 20
  ): Promise<Array<MediaTextAssociation & { nodeTitle?: string; rank: number }>> {
    this.ensureInitialized();

    const result = await this.pool!.query(SEARCH_EXTRACTED_TEXT, [query, limit]);
    return result.rows.map((row: DbMediaTextRow) => ({
      ...this.rowToMediaTextAssociation(row),
      nodeTitle: row.node_title ?? undefined,
      rank: row.rank ?? 0,
    }));
  }

  /**
   * Get media-text association statistics
   */
  async getMediaTextStats(): Promise<MediaTextStats> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_MEDIA_TEXT_STATS);
    const row = result.rows[0];

    return {
      totalAssociations: parseInt(row.total_associations ?? '0', 10),
      ocrCount: parseInt(row.ocr_count ?? '0', 10),
      descriptionCount: parseInt(row.description_count ?? '0', 10),
      echoCount: parseInt(row.echo_count ?? '0', 10),
      uniqueGizmos: parseInt(row.unique_gizmos ?? '0', 10),
      uniqueConversations: parseInt(row.unique_conversations ?? '0', 10),
      batchCount: parseInt(row.batch_count ?? '0', 10),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // LINK OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a link between nodes (using ContentLink with targetUri)
   */
  async createLink(sourceId: string, link: ContentLink): Promise<StoredLink>;
  /**
   * Create a link between nodes (using direct node IDs)
   */
  async createLink(sourceId: string, targetId: string, linkType: ContentLinkType, metadata?: Record<string, unknown>): Promise<StoredLink>;
  async createLink(
    sourceId: string,
    linkOrTargetId: ContentLink | string,
    linkType?: ContentLinkType,
    metadata?: Record<string, unknown>
  ): Promise<StoredLink> {
    this.ensureInitialized();

    const id = randomUUID();
    const now = new Date();

    let targetId: string;
    let type: string;
    let meta: Record<string, unknown> | null;

    if (typeof linkOrTargetId === 'string') {
      // Called with direct IDs
      targetId = linkOrTargetId;
      type = linkType!;
      meta = metadata ?? null;
    } else {
      // Called with ContentLink object
      targetId = await this.uriToId(linkOrTargetId.targetUri);
      type = linkOrTargetId.type;
      meta = linkOrTargetId.metadata ?? null;
    }

    const result = await this.pool!.query(INSERT_LINK, [
      id,
      sourceId,
      targetId,
      type,
      meta,
      now,
    ]);

    const row = result.rows[0] as DbLinkRow;
    return this.rowToLink(row);
  }

  /**
   * Get links from a node
   */
  async getLinksFrom(nodeId: string): Promise<StoredLink[]> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_LINKS_FROM, [nodeId]);
    return result.rows.map((row: DbLinkRow) => this.rowToLink(row));
  }

  /**
   * Get links to a node
   */
  async getLinksTo(nodeId: string): Promise<StoredLink[]> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_LINKS_TO, [nodeId]);
    return result.rows.map((row: DbLinkRow) => this.rowToLink(row));
  }

  // ─────────────────────────────────────────────────────────────────
  // JOB OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create an import job
   */
  async createJob(adapterId: string, sourcePath: string): Promise<ImportJob> {
    this.ensureInitialized();

    const id = randomUUID();
    const now = new Date();

    const result = await this.pool!.query(INSERT_JOB, [id, adapterId, sourcePath, now]);
    const row = result.rows[0] as DbJobRow;

    return this.rowToJob(row);
  }

  /**
   * Update job status
   */
  async updateJob(jobId: string, update: Partial<ImportJob>): Promise<void> {
    this.ensureInitialized();

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (update.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(update.status);
    }
    if (update.nodesImported !== undefined) {
      setClauses.push(`nodes_imported = $${paramIndex++}`);
      params.push(update.nodesImported);
    }
    if (update.nodesSkipped !== undefined) {
      setClauses.push(`nodes_skipped = $${paramIndex++}`);
      params.push(update.nodesSkipped);
    }
    if (update.nodesFailed !== undefined) {
      setClauses.push(`nodes_failed = $${paramIndex++}`);
      params.push(update.nodesFailed);
    }
    if (update.linksCreated !== undefined) {
      setClauses.push(`links_created = $${paramIndex++}`);
      params.push(update.linksCreated);
    }
    if (update.completedAt !== undefined) {
      setClauses.push(`completed_at = $${paramIndex++}`);
      params.push(new Date(update.completedAt));
    }
    if (update.error !== undefined) {
      setClauses.push(`error = $${paramIndex++}`);
      params.push(update.error);
    }
    if (update.stats !== undefined) {
      setClauses.push(`stats = $${paramIndex++}`);
      params.push(update.stats);
    }

    if (setClauses.length === 0) return;

    params.push(jobId);
    await this.pool!.query(
      `UPDATE import_jobs SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      params
    );
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<ImportJob | undefined> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_JOB, [jobId]);
    const row = result.rows[0] as DbJobRow | undefined;

    return row ? this.rowToJob(row) : undefined;
  }

  /**
   * Get all jobs
   */
  async getJobs(status?: ImportJobStatus): Promise<ImportJob[]> {
    this.ensureInitialized();

    const result = await this.pool!.query(GET_JOBS, [status ?? null]);
    return result.rows.map((row: DbJobRow) => this.rowToJob(row));
  }

  // ─────────────────────────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get storage statistics
   */
  async getStats(): Promise<ContentStoreStats> {
    this.ensureInitialized();

    // Get basic stats
    const statsResult = await this.pool!.query(GET_STATS);
    const stats = statsResult.rows[0];

    // Get nodes by source type
    const byTypeResult = await this.pool!.query(GET_NODES_BY_SOURCE_TYPE);
    const nodesBySourceType: Record<string, number> = {};
    for (const row of byTypeResult.rows as Array<{ source_type: string; count: string }>) {
      nodesBySourceType[row.source_type] = parseInt(row.count, 10);
    }

    // Get nodes by adapter
    const byAdapterResult = await this.pool!.query(GET_NODES_BY_ADAPTER);
    const nodesByAdapter: Record<string, number> = {};
    for (const row of byAdapterResult.rows as Array<{ source_adapter: string; count: string }>) {
      nodesByAdapter[row.source_adapter] = parseInt(row.count, 10);
    }

    return {
      totalNodes: parseInt(stats.total_nodes, 10),
      nodesBySourceType,
      nodesByAdapter,
      nodesWithEmbeddings: parseInt(stats.nodes_with_embeddings, 10),
      totalLinks: parseInt(stats.total_links, 10),
      totalJobs: parseInt(stats.total_jobs, 10),
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool!.query('SELECT 1');
      return true;
    } catch (error) {
      console.debug('[PostgresContentStore] Health check failed:', error);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────

  private ensureInitialized(): void {
    if (!this.initialized || !this.pool) {
      throw new Error('ContentStore not initialized. Call initialize() first.');
    }
  }

  private async getNodeByHashWithClient(client: PoolClient, hash: string): Promise<StoredNode | undefined> {
    const result = await client.query(GET_NODE_BY_HASH, [hash]);
    const row = result.rows[0] as DbRow | undefined;
    return row ? this.rowToNode(row) : undefined;
  }

  private async storeNodeWithClient(client: PoolClient, node: ImportedNode, jobId?: string): Promise<StoredNode> {
    const now = new Date();
    const id = node.id || randomUUID();
    const wordCount = this.countWords(node.content);
    const sourceAdapter = node.uri.split('/')[2] || 'unknown';

    // Resolve parent and thread root IDs
    let parentNodeId: string | null = null;
    let threadRootId: string | null = null;

    if (node.parentUri) {
      const parentResult = await client.query(GET_NODE_BY_URI, [node.parentUri]);
      if (parentResult.rows.length > 0) {
        parentNodeId = parentResult.rows[0].id;
      }
    }

    if (node.threadRootUri) {
      const threadResult = await client.query(GET_NODE_BY_URI, [node.threadRootUri]);
      if (threadResult.rows.length > 0) {
        threadRootId = threadResult.rows[0].id;
      }
    }

    const params = [
      id,
      node.contentHash,
      node.uri,
      node.content,
      node.format,
      wordCount,
      null, // embedding
      null, // embedding_model
      null, // embedding_at
      null, // embedding_text_hash
      parentNodeId,
      node.position ?? null,
      node.chunkIndex ?? null,
      node.chunkStartOffset ?? null,
      node.chunkEndOffset ?? null,
      node.hierarchyLevel ?? 0,
      threadRootId,
      node.sourceType,
      node.sourceAdapter || sourceAdapter,
      (node.metadata?.originalId as string) ?? null,
      (node.metadata?.originalPath as string) ?? null,
      jobId ?? null,
      (node.metadata?.title as string) ?? null,
      node.author?.name || node.author?.handle || null,
      node.author?.role ?? null,
      JSON.stringify((node.metadata?.tags as string[]) ?? []),
      JSON.stringify(node.media ?? []),
      node.metadata ? JSON.stringify(node.metadata) : null,
      // Fine-grained deduplication hashes
      JSON.stringify(node.paragraphHashes ?? []),
      JSON.stringify(node.lineHashes ?? []),
      node.firstSeenAt ?? now, // Default to now if not set
      // Timestamps
      node.sourceCreatedAt ?? null,
      node.sourceUpdatedAt ?? null,
      now,
      now,
    ];

    const result = await client.query(INSERT_CONTENT_NODE, params);
    return this.rowToNode(result.rows[0] as DbRow);
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
  }

  private hashText(text: string): string {
    return createHash('sha256').update(text.normalize('NFC')).digest('hex');
  }

  private async uriToId(uri: string): Promise<string> {
    // Try to find node by URI and return its ID
    const node = await this.getNodeByUri(uri);
    if (node) return node.id;

    // If not found, extract ID from URI (last segment)
    const segments = uri.split('/');
    return segments[segments.length - 1];
  }

  private readonly columnNameMap: Record<string, string> = {
    createdAt: 'created_at',
    sourceCreatedAt: 'source_created_at',
    importedAt: 'imported_at',
    wordCount: 'word_count',
  };

  private buildQuerySql(options: QueryOptions): { sql: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.sourceType) {
      if (Array.isArray(options.sourceType)) {
        const placeholders = options.sourceType.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`source_type IN (${placeholders})`);
        params.push(...options.sourceType);
      } else {
        conditions.push(`source_type = $${paramIndex++}`);
        params.push(options.sourceType);
      }
    }

    if (options.adapterId) {
      conditions.push(`source_adapter = $${paramIndex++}`);
      params.push(options.adapterId);
    }

    if (options.importJobId) {
      conditions.push(`import_job_id = $${paramIndex++}`);
      params.push(options.importJobId);
    }

    if (options.hierarchyLevel !== undefined) {
      conditions.push(`hierarchy_level = $${paramIndex++}`);
      params.push(options.hierarchyLevel);
    }

    if (options.threadRootId) {
      conditions.push(`thread_root_id = $${paramIndex++}`);
      params.push(options.threadRootId);
    }

    if (options.parentNodeId) {
      conditions.push(`parent_node_id = $${paramIndex++}`);
      params.push(options.parentNodeId);
    }

    if (options.authorRole) {
      conditions.push(`author_role = $${paramIndex++}`);
      params.push(options.authorRole);
    }

    if (options.dateRange?.start) {
      conditions.push(`source_created_at >= $${paramIndex++}`);
      params.push(new Date(options.dateRange.start));
    }

    if (options.dateRange?.end) {
      conditions.push(`source_created_at <= $${paramIndex++}`);
      params.push(new Date(options.dateRange.end));
    }

    let sql = 'SELECT * FROM content_nodes';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    return { sql, params };
  }

  private rowToNode(row: DbRow): StoredNode {
    return {
      id: row.id,
      contentHash: row.content_hash,
      uri: row.uri,
      text: row.text,
      format: row.format as ContentFormat,
      wordCount: row.word_count,
      sourceType: row.source_type,
      sourceAdapter: row.source_adapter,
      sourceOriginalId: row.source_original_id ?? undefined,
      sourceOriginalPath: row.source_original_path ?? undefined,
      importJobId: row.import_job_id ?? undefined,
      parentNodeId: row.parent_node_id ?? undefined,
      position: row.position ?? undefined,
      chunkIndex: row.chunk_index ?? undefined,
      chunkStartOffset: row.chunk_start_offset ?? undefined,
      chunkEndOffset: row.chunk_end_offset ?? undefined,
      hierarchyLevel: row.hierarchy_level,
      threadRootId: row.thread_root_id ?? undefined,
      embeddingModel: row.embedding_model ?? undefined,
      embeddingAt: row.embedding_at?.getTime() ?? undefined,
      embeddingTextHash: row.embedding_text_hash ?? undefined,
      title: row.title ?? undefined,
      author: row.author ?? undefined,
      authorRole: row.author_role as AuthorRole | undefined,
      tags: row.tags ?? undefined,
      mediaRefs: row.media_refs ?? undefined,
      sourceMetadata: row.source_metadata ?? undefined,
      // Fine-grained deduplication
      paragraphHashes: row.paragraph_hashes ?? undefined,
      lineHashes: row.line_hashes ?? undefined,
      firstSeenAt: row.first_seen_at?.getTime() ?? undefined,
      // Timestamps
      sourceCreatedAt: row.source_created_at?.getTime() ?? undefined,
      sourceUpdatedAt: row.source_updated_at?.getTime() ?? undefined,
      createdAt: row.created_at.getTime(),
      importedAt: row.imported_at.getTime(),
    };
  }

  private rowToLink(row: DbLinkRow): StoredLink {
    return {
      id: row.id,
      sourceId: row.source_id,
      targetId: row.target_id,
      linkType: row.link_type as ContentLinkType,
      metadata: row.metadata ?? undefined,
      createdAt: row.created_at.getTime(),
    };
  }

  private rowToJob(row: DbJobRow): ImportJob {
    return {
      id: row.id,
      adapterId: row.adapter_id,
      sourcePath: row.source_path,
      status: row.status as ImportJobStatus,
      nodesImported: row.nodes_imported,
      nodesSkipped: row.nodes_skipped,
      nodesFailed: row.nodes_failed,
      linksCreated: row.links_created,
      startedAt: row.started_at?.getTime() ?? undefined,
      completedAt: row.completed_at?.getTime() ?? undefined,
      error: row.error ?? undefined,
      stats: row.stats ?? undefined,
    };
  }

  private rowToMediaTextAssociation(row: DbMediaTextRow): MediaTextAssociation {
    return {
      id: row.id,
      mediaId: row.media_id,
      mediaPointer: row.media_pointer ?? undefined,
      nodeId: row.node_id ?? undefined,
      textSpanStart: row.text_span_start ?? undefined,
      textSpanEnd: row.text_span_end ?? undefined,
      extractedText: row.extracted_text ?? undefined,
      associationType: row.association_type as MediaTextAssociation['associationType'],
      sourceMediaId: row.source_media_id ?? undefined,
      chainPosition: row.chain_position,
      extractionMethod: row.extraction_method ?? undefined,
      confidence: row.confidence ?? undefined,
      gizmoId: row.gizmo_id ?? undefined,
      conversationId: row.conversation_id ?? undefined,
      messageId: row.message_id ?? undefined,
      batchId: row.batch_id ?? undefined,
      batchPosition: row.batch_position ?? undefined,
      importJobId: row.import_job_id ?? undefined,
      sourceCreatedAt: row.source_created_at?.getTime() ?? undefined,
      createdAt: row.created_at.getTime(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _store: PostgresContentStore | null = null;

/**
 * Get the content store singleton
 */
export function getContentStore(): PostgresContentStore {
  if (!_store) {
    throw new Error('ContentStore not initialized. Call initContentStore() first.');
  }
  return _store;
}

/**
 * Initialize the content store singleton
 */
export async function initContentStore(
  config: Partial<PostgresStorageConfig> = {}
): Promise<PostgresContentStore> {
  if (_store) {
    await _store.close();
  }
  _store = new PostgresContentStore(config);
  await _store.initialize();
  return _store;
}

/**
 * Close the content store singleton
 */
export async function closeContentStore(): Promise<void> {
  if (_store) {
    await _store.close();
    _store = null;
  }
}
