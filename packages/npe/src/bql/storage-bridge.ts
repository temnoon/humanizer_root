/**
 * BQL Storage Bridge
 *
 * Bridges between BQL executor's storage interface and @humanizer/core's
 * PostgresContentStore. Provides search, load, and save operations for pipelines.
 *
 * Search modes:
 * - Keyword search (default): Uses FTS for simple queries
 * - Semantic search: Requires embedding function, uses pgvector
 *
 * Buffer management:
 * - In-memory buffers for pipeline intermediate results
 * - Optional persistence to workspace files
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types (inline to avoid hard dependency on @humanizer/core)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Stored node from content store (matches @humanizer/core StoredNode subset)
 */
export interface StoredNodeSubset {
  id: string;
  contentHash: string;
  uri: string;
  text: string;
  format: string;
  wordCount: number;
  sourceType: string;
  sourceAdapter: string;
  parentNodeId?: string;
  hierarchyLevel: number;
  threadRootId?: string;
  title?: string;
  author?: string;
  authorRole?: string;
  tags?: string[];
  sourceCreatedAt?: number;
  createdAt: number;
  importedAt: number;
  [key: string]: unknown;
}

/**
 * Search result from content store
 */
export interface SearchResultSubset {
  node: StoredNodeSubset;
  score: number;
  distance?: number;
  bm25Score?: number;
  highlights?: string[];
}

/**
 * Core content store interface (matches @humanizer/core PostgresContentStore)
 */
export interface ContentStoreInterface {
  searchByKeyword(query: string, options?: { limit?: number }): Promise<SearchResultSubset[]>;
  searchByEmbedding(
    embedding: number[],
    options?: { limit?: number; threshold?: number }
  ): Promise<SearchResultSubset[]>;
  getNode(id: string): Promise<StoredNodeSubset | undefined>;
  queryNodes(options: {
    sourceType?: string | string[];
    limit?: number;
    offset?: number;
  }): Promise<{ nodes: StoredNodeSubset[]; total: number; hasMore: boolean }>;
}

/**
 * Embedding function for semantic search
 */
export type EmbeddingFunction = (text: string) => Promise<number[]>;

/**
 * Storage bridge options
 */
export interface StorageBridgeOptions {
  /** Content store instance */
  store: ContentStoreInterface;
  /** Embedding function for semantic search (optional) */
  embedFn?: EmbeddingFunction;
  /** Default search limit */
  defaultLimit?: number;
  /** Semantic search threshold (0-1) */
  semanticThreshold?: number;
  /** Search mode: 'keyword', 'semantic', or 'hybrid' */
  searchMode?: 'keyword' | 'semantic' | 'hybrid';
}

/**
 * BQL storage interface expected by executor
 */
export interface BqlStorageInterface {
  search: (query: string, limit?: number) => Promise<unknown[]>;
  load: (name: string) => Promise<unknown[]>;
  save: (name: string, data: unknown[]) => Promise<void>;
}

/**
 * Buffer item with metadata
 */
interface BufferItem {
  id: string;
  text: string;
  sourceType: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// Storage Bridge
// ═══════════════════════════════════════════════════════════════════════════

/**
 * BQL Storage Bridge
 *
 * Wraps @humanizer/core PostgresContentStore to provide the interface
 * expected by BQL executor.
 */
export class StorageBridge implements BqlStorageInterface {
  private store: ContentStoreInterface;
  private embedFn?: EmbeddingFunction;
  private defaultLimit: number;
  private semanticThreshold: number;
  private searchMode: 'keyword' | 'semantic' | 'hybrid';

  /** In-memory buffers for pipeline results */
  private buffers: Map<string, unknown[]> = new Map();

  constructor(options: StorageBridgeOptions) {
    this.store = options.store;
    this.embedFn = options.embedFn;
    this.defaultLimit = options.defaultLimit ?? 50;
    this.semanticThreshold = options.semanticThreshold ?? 0.5;
    this.searchMode = options.searchMode ?? 'keyword';
  }

  /**
   * Search the content store
   *
   * Query syntax:
   * - Plain text: keyword search
   * - Prefixed with "semantic:" : force semantic search
   * - Prefixed with "keyword:" : force keyword search
   */
  async search(query: string, limit?: number): Promise<unknown[]> {
    const effectiveLimit = limit ?? this.defaultLimit;

    // Parse query for search mode override
    let searchMode = this.searchMode;
    let searchQuery = query;

    if (query.startsWith('semantic:')) {
      searchMode = 'semantic';
      searchQuery = query.slice('semantic:'.length).trim();
    } else if (query.startsWith('keyword:')) {
      searchMode = 'keyword';
      searchQuery = query.slice('keyword:'.length).trim();
    }

    // Execute search based on mode
    switch (searchMode) {
      case 'semantic':
        return this.semanticSearch(searchQuery, effectiveLimit);
      case 'hybrid':
        return this.hybridSearch(searchQuery, effectiveLimit);
      case 'keyword':
      default:
        return this.keywordSearch(searchQuery, effectiveLimit);
    }
  }

  /**
   * Load a named buffer or query nodes
   *
   * Name patterns:
   * - "@buffer_name" : Load from in-memory buffer
   * - "source:chatgpt" : Query nodes by source type
   * - "all" or "*" : Query all nodes (with limit)
   * - Otherwise: treat as buffer name
   */
  async load(name: string): Promise<unknown[]> {
    // Check in-memory buffers first
    if (name.startsWith('@') || this.buffers.has(name)) {
      const bufferName = name.startsWith('@') ? name.slice(1) : name;
      return this.buffers.get(bufferName) ?? [];
    }

    // Query by source type
    if (name.startsWith('source:')) {
      const sourceType = name.slice('source:'.length);
      const result = await this.store.queryNodes({
        sourceType,
        limit: this.defaultLimit,
      });
      return result.nodes.map(this.nodeToBufferItem);
    }

    // Query all nodes
    if (name === 'all' || name === '*') {
      const result = await this.store.queryNodes({
        limit: this.defaultLimit,
      });
      return result.nodes.map(this.nodeToBufferItem);
    }

    // Try loading as buffer
    return this.buffers.get(name) ?? [];
  }

  /**
   * Save data to a named buffer
   *
   * Name patterns:
   * - "@buffer_name" : Save to in-memory buffer
   * - Otherwise: save to named buffer
   */
  async save(name: string, data: unknown[]): Promise<void> {
    const bufferName = name.startsWith('@') ? name.slice(1) : name;
    this.buffers.set(bufferName, data);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Search Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private async keywordSearch(query: string, limit: number): Promise<unknown[]> {
    const results = await this.store.searchByKeyword(query, { limit });
    return results.map((r) => this.searchResultToBufferItem(r));
  }

  private async semanticSearch(query: string, limit: number): Promise<unknown[]> {
    if (!this.embedFn) {
      console.warn('[StorageBridge] No embedding function configured, falling back to keyword search');
      return this.keywordSearch(query, limit);
    }

    try {
      const embedding = await this.embedFn(query);
      const results = await this.store.searchByEmbedding(embedding, {
        limit,
        threshold: this.semanticThreshold,
      });
      return results.map((r) => this.searchResultToBufferItem(r));
    } catch (error) {
      console.error('[StorageBridge] Semantic search failed:', error);
      return this.keywordSearch(query, limit);
    }
  }

  private async hybridSearch(query: string, limit: number): Promise<unknown[]> {
    // Run both searches in parallel
    const [keywordResults, semanticResults] = await Promise.all([
      this.keywordSearch(query, limit).catch(() => []),
      this.semanticSearch(query, limit).catch(() => []),
    ]);

    // Simple fusion: dedupe by ID, prefer semantic results
    const seen = new Set<string>();
    const fused: unknown[] = [];

    // Add semantic results first (higher priority)
    for (const item of semanticResults) {
      const id = (item as BufferItem).id;
      if (!seen.has(id)) {
        seen.add(id);
        fused.push(item);
      }
    }

    // Add keyword results that weren't in semantic
    for (const item of keywordResults) {
      const id = (item as BufferItem).id;
      if (!seen.has(id)) {
        seen.add(id);
        fused.push(item);
      }
    }

    return fused.slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Buffer Management
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List available buffers
   */
  listBuffers(): string[] {
    return Array.from(this.buffers.keys());
  }

  /**
   * Get buffer by name
   */
  getBuffer(name: string): unknown[] | undefined {
    return this.buffers.get(name);
  }

  /**
   * Clear a specific buffer
   */
  clearBuffer(name: string): void {
    this.buffers.delete(name);
  }

  /**
   * Clear all buffers
   */
  clearAllBuffers(): void {
    this.buffers.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private nodeToBufferItem(node: StoredNodeSubset): BufferItem {
    return {
      id: node.id,
      text: node.text,
      sourceType: node.sourceType,
      createdAt: node.createdAt,
      title: node.title,
      author: node.author,
      authorRole: node.authorRole,
      wordCount: node.wordCount,
      metadata: {
        uri: node.uri,
        contentHash: node.contentHash,
        sourceAdapter: node.sourceAdapter,
        tags: node.tags,
      },
    };
  }

  private searchResultToBufferItem(result: SearchResultSubset): BufferItem {
    const node = result.node;
    return {
      ...this.nodeToBufferItem(node),
      score: result.score,
      distance: result.distance,
      bm25Score: result.bm25Score,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a storage bridge for BQL
 *
 * Usage:
 * ```typescript
 * import { getContentStore } from '@humanizer/core';
 *
 * const bridge = createStorageBridge({
 *   store: getContentStore(),
 *   embedFn: async (text) => myEmbeddingModel.embed(text),
 *   searchMode: 'hybrid',
 * });
 *
 * const executor = new PipelineExecutor({
 *   llm: myAdapter,
 *   storage: bridge,
 * });
 * ```
 */
export function createStorageBridge(options: StorageBridgeOptions): StorageBridge {
  return new StorageBridge(options);
}

/**
 * Create a mock storage bridge for testing
 */
export function createMockStorageBridge(
  initialData: Map<string, unknown[]> = new Map()
): BqlStorageInterface {
  const buffers = new Map<string, unknown[]>(initialData);

  return {
    async search(query: string, limit?: number): Promise<unknown[]> {
      // Simple mock: search all buffers for matching text
      const results: unknown[] = [];
      const queryLower = query.toLowerCase();

      for (const items of buffers.values()) {
        for (const item of items) {
          const text = (item as Record<string, unknown>).text as string | undefined;
          if (text && text.toLowerCase().includes(queryLower)) {
            results.push(item);
          }
        }
      }

      return results.slice(0, limit ?? 50);
    },

    async load(name: string): Promise<unknown[]> {
      return buffers.get(name) ?? [];
    },

    async save(name: string, data: unknown[]): Promise<void> {
      buffers.set(name, data);
    },
  };
}
