/**
 * UCG - Unified Concept Graph / Content Pyramid
 *
 * Multi-resolution content representation:
 * - L0: Sentences (finest grain)
 * - L1: Passages (paragraphs, coherent thoughts)
 * - L2: Sections (chapter sections, topics)
 * - L3: Chapters (major divisions)
 * - Apex: Single summary of entire content
 *
 * This enables:
 * - Multi-resolution retrieval (find right granularity)
 * - Progressive summarization
 * - Context-aware search
 * - Efficient embedding storage
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Content resolution levels
 */
export type ResolutionLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'apex';

/**
 * A node in the content pyramid
 */
export interface ContentNode {
  /** Unique identifier */
  id: string;

  /** Resolution level */
  level: ResolutionLevel;

  /** The content text */
  content: string;

  /** Word count */
  wordCount: number;

  /** Embedding vector */
  embedding?: number[];

  /** Parent node ID (higher resolution) */
  parentId?: string;

  /** Child node IDs (lower resolution) */
  childIds: string[];

  /** Source reference */
  source: ContentSource;

  /** Position within parent */
  position: number;

  /** Metadata */
  metadata: ContentMetadata;

  /** When created */
  createdAt: number;
}

/**
 * Source reference for content
 */
export interface ContentSource {
  /** Source type */
  type: 'conversation' | 'document' | 'book' | 'import' | 'generated';

  /** Source ID */
  sourceId: string;

  /** Original message/paragraph/section ID */
  originalId?: string;

  /** Character offset in original */
  offset?: { start: number; end: number };

  /** Role if from conversation */
  role?: 'user' | 'assistant' | 'system';

  /** Timestamp of original */
  timestamp?: number;
}

/**
 * Metadata for content nodes
 */
export interface ContentMetadata {
  /** Content type */
  contentType?: 'prose' | 'code' | 'math' | 'list' | 'quote' | 'mixed';

  /** Language for code */
  language?: string;

  /** Topics/themes */
  topics?: string[];

  /** Named entities */
  entities?: string[];

  /** Sentiment score (-1 to 1) */
  sentiment?: number;

  /** Quality score (0 to 1) */
  qualityScore?: number;

  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * The content pyramid structure
 */
export interface ContentPyramid {
  /** Pyramid ID */
  id: string;

  /** Source identifier (e.g., book ID, archive ID) */
  sourceId: string;

  /** L0 nodes (sentences) */
  L0: ContentNode[];

  /** L1 nodes (passages) */
  L1: ContentNode[];

  /** L2 nodes (sections) */
  L2: ContentNode[];

  /** L3 nodes (chapters) */
  L3: ContentNode[];

  /** Apex summary */
  apex: ApexNode;

  /** Statistics */
  stats: PyramidStats;

  /** When built */
  builtAt: number;

  /** Version for cache invalidation */
  version: number;
}

/**
 * The apex (top) of the pyramid - single summary
 */
export interface ApexNode {
  /** Summary text */
  summary: string;

  /** Embedding */
  embedding?: number[];

  /** Key themes */
  themes: string[];

  /** Key entities */
  entities: string[];

  /** Total word count in pyramid */
  totalWords: number;

  /** Date range of content */
  dateRange?: { start: number; end: number };

  /** When generated */
  generatedAt: number;
}

/**
 * Statistics about the pyramid
 */
export interface PyramidStats {
  /** Node counts by level */
  nodeCounts: Record<ResolutionLevel, number>;

  /** Total nodes */
  totalNodes: number;

  /** Total words */
  totalWords: number;

  /** Average node size by level */
  avgNodeSize: Record<ResolutionLevel, number>;

  /** Embedding coverage (% of nodes with embeddings) */
  embeddingCoverage: number;
}

/**
 * Search result from the pyramid
 */
export interface PyramidSearchResult {
  /** Matched node */
  node: ContentNode;

  /** Similarity score */
  similarity: number;

  /** Context (surrounding nodes) */
  context?: {
    before?: ContentNode;
    after?: ContentNode;
    parent?: ContentNode;
  };

  /** Highlight positions in content */
  highlights?: Array<{ start: number; end: number }>;
}

/**
 * Options for pyramid search
 */
export interface PyramidSearchOptions {
  /** Which levels to search */
  levels?: ResolutionLevel[];

  /** Minimum similarity threshold */
  minSimilarity?: number;

  /** Maximum results */
  maxResults?: number;

  /** Include context */
  includeContext?: boolean;

  /** Filter by content type */
  contentType?: string;

  /** Filter by topic */
  topic?: string;

  /** Date range filter */
  dateRange?: { start: number; end: number };
}

// ═══════════════════════════════════════════════════════════════════
// UCG PROVIDER INTERFACE
// ═══════════════════════════════════════════════════════════════════

/**
 * UCG Provider interface
 */
export interface UCGProvider {
  /**
   * Build a pyramid from content
   */
  buildPyramid(content: PyramidBuildInput): Promise<ContentPyramid>;

  /**
   * Get a pyramid by ID
   */
  getPyramid(pyramidId: string): Promise<ContentPyramid | undefined>;

  /**
   * Search the pyramid
   */
  search(
    pyramidId: string,
    query: string,
    options?: PyramidSearchOptions
  ): Promise<PyramidSearchResult[]>;

  /**
   * Search by embedding
   */
  searchByEmbedding(
    pyramidId: string,
    embedding: number[],
    options?: PyramidSearchOptions
  ): Promise<PyramidSearchResult[]>;

  /**
   * Get nodes at a specific level
   */
  getLevel(pyramidId: string, level: ResolutionLevel): Promise<ContentNode[]>;

  /**
   * Get a specific node
   */
  getNode(nodeId: string): Promise<ContentNode | undefined>;

  /**
   * Get node with context
   */
  getNodeWithContext(nodeId: string): Promise<{
    node: ContentNode;
    parent?: ContentNode;
    children: ContentNode[];
    siblings: { before?: ContentNode; after?: ContentNode };
  } | undefined>;

  /**
   * Update the apex summary
   */
  updateApex(pyramidId: string, apex: Partial<ApexNode>): Promise<void>;

  /**
   * Delete a pyramid
   */
  deletePyramid(pyramidId: string): Promise<void>;

  /**
   * Rebuild a level of the pyramid
   */
  rebuildLevel(pyramidId: string, level: ResolutionLevel): Promise<void>;
}

/**
 * Input for building a pyramid
 */
export interface PyramidBuildInput {
  /** Source ID */
  sourceId: string;

  /** Content to process */
  content: Array<{
    text: string;
    source: ContentSource;
    metadata?: Partial<ContentMetadata>;
  }>;

  /** Embedding function */
  embedder?: (texts: string[]) => Promise<number[][]>;

  /** Summarization function */
  summarizer?: (text: string, targetLength: number) => Promise<string>;

  /** Options */
  options?: {
    /** Target sentence length for L0 */
    l0TargetLength?: number;
    /** Target passage length for L1 */
    l1TargetLength?: number;
    /** Target section length for L2 */
    l2TargetLength?: number;
    /** Target chapter length for L3 */
    l3TargetLength?: number;
    /** Generate embeddings */
    generateEmbeddings?: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════
// IN-MEMORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * In-memory UCG provider for testing and development
 */
export class InMemoryUCGProvider implements UCGProvider {
  private pyramids: Map<string, ContentPyramid> = new Map();
  private nodes: Map<string, ContentNode> = new Map();

  async buildPyramid(input: PyramidBuildInput): Promise<ContentPyramid> {
    const pyramidId = `pyramid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Build L0 (sentences)
    const l0Nodes: ContentNode[] = [];
    for (const item of input.content) {
      const sentences = this.splitIntoSentences(item.text);
      for (let i = 0; i < sentences.length; i++) {
        const node = this.createNode('L0', sentences[i], item.source, i, item.metadata);
        l0Nodes.push(node);
        this.nodes.set(node.id, node);
      }
    }

    // Build L1 (passages) by grouping L0 nodes
    const l1Nodes = this.buildLevel(l0Nodes, 'L1', input.options?.l1TargetLength ?? 200);

    // Build L2 (sections) by grouping L1 nodes
    const l2Nodes = this.buildLevel(l1Nodes, 'L2', input.options?.l2TargetLength ?? 800);

    // Build L3 (chapters) by grouping L2 nodes
    const l3Nodes = this.buildLevel(l2Nodes, 'L3', input.options?.l3TargetLength ?? 3000);

    // Build apex
    const allContent = l3Nodes.map(n => n.content).join('\n\n');
    const apexSummary = input.summarizer
      ? await input.summarizer(allContent, 500)
      : this.simpleSummarize(allContent, 500);

    const apex: ApexNode = {
      summary: apexSummary,
      themes: this.extractThemes(l0Nodes),
      entities: this.extractEntities(l0Nodes),
      totalWords: l0Nodes.reduce((sum, n) => sum + n.wordCount, 0),
      generatedAt: Date.now(),
    };

    // Generate embeddings if requested
    if (input.options?.generateEmbeddings && input.embedder) {
      await this.generateEmbeddings([...l0Nodes, ...l1Nodes, ...l2Nodes, ...l3Nodes], input.embedder);
      apex.embedding = (await input.embedder([apex.summary]))[0];
    }

    // Build stats
    const stats: PyramidStats = {
      nodeCounts: {
        L0: l0Nodes.length,
        L1: l1Nodes.length,
        L2: l2Nodes.length,
        L3: l3Nodes.length,
        apex: 1,
      },
      totalNodes: l0Nodes.length + l1Nodes.length + l2Nodes.length + l3Nodes.length + 1,
      totalWords: apex.totalWords,
      avgNodeSize: {
        L0: this.avgWordCount(l0Nodes),
        L1: this.avgWordCount(l1Nodes),
        L2: this.avgWordCount(l2Nodes),
        L3: this.avgWordCount(l3Nodes),
        apex: this.wordCount(apex.summary),
      },
      embeddingCoverage: input.options?.generateEmbeddings ? 1.0 : 0.0,
    };

    const pyramid: ContentPyramid = {
      id: pyramidId,
      sourceId: input.sourceId,
      L0: l0Nodes,
      L1: l1Nodes,
      L2: l2Nodes,
      L3: l3Nodes,
      apex,
      stats,
      builtAt: Date.now(),
      version: 1,
    };

    this.pyramids.set(pyramidId, pyramid);
    return pyramid;
  }

  async getPyramid(pyramidId: string): Promise<ContentPyramid | undefined> {
    return this.pyramids.get(pyramidId);
  }

  async search(
    pyramidId: string,
    query: string,
    options?: PyramidSearchOptions
  ): Promise<PyramidSearchResult[]> {
    const pyramid = this.pyramids.get(pyramidId);
    if (!pyramid) return [];

    // Simple keyword search (real implementation would use embeddings)
    const levels = options?.levels ?? ['L1', 'L2'];
    const results: PyramidSearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const level of levels) {
      const nodes = pyramid[level] as ContentNode[];
      for (const node of nodes) {
        const contentLower = node.content.toLowerCase();
        if (contentLower.includes(queryLower)) {
          const similarity = this.calculateSimpleSimilarity(contentLower, queryLower);
          if (similarity >= (options?.minSimilarity ?? 0.1)) {
            results.push({
              node,
              similarity,
              context: options?.includeContext ? await this.getContextForNode(node, pyramid) : undefined,
            });
          }
        }
      }
    }

    // Sort by similarity and limit
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, options?.maxResults ?? 20);
  }

  async searchByEmbedding(
    pyramidId: string,
    embedding: number[],
    options?: PyramidSearchOptions
  ): Promise<PyramidSearchResult[]> {
    const pyramid = this.pyramids.get(pyramidId);
    if (!pyramid) return [];

    const levels = options?.levels ?? ['L1', 'L2'];
    const results: PyramidSearchResult[] = [];

    for (const level of levels) {
      const nodes = pyramid[level] as ContentNode[];
      for (const node of nodes) {
        if (node.embedding) {
          const similarity = this.cosineSimilarity(embedding, node.embedding);
          if (similarity >= (options?.minSimilarity ?? 0.5)) {
            results.push({
              node,
              similarity,
              context: options?.includeContext ? await this.getContextForNode(node, pyramid) : undefined,
            });
          }
        }
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, options?.maxResults ?? 20);
  }

  async getLevel(pyramidId: string, level: ResolutionLevel): Promise<ContentNode[]> {
    const pyramid = this.pyramids.get(pyramidId);
    if (!pyramid) return [];
    if (level === 'apex') return []; // Apex is not a ContentNode
    return pyramid[level];
  }

  async getNode(nodeId: string): Promise<ContentNode | undefined> {
    return this.nodes.get(nodeId);
  }

  async getNodeWithContext(nodeId: string): Promise<{
    node: ContentNode;
    parent?: ContentNode;
    children: ContentNode[];
    siblings: { before?: ContentNode; after?: ContentNode };
  } | undefined> {
    const node = this.nodes.get(nodeId);
    if (!node) return undefined;

    const parent = node.parentId ? this.nodes.get(node.parentId) : undefined;
    const children = node.childIds.map(id => this.nodes.get(id)).filter((n): n is ContentNode => !!n);

    // Find siblings
    let before: ContentNode | undefined;
    let after: ContentNode | undefined;

    if (parent) {
      const siblingIds = parent.childIds;
      const myIndex = siblingIds.indexOf(nodeId);
      if (myIndex > 0) before = this.nodes.get(siblingIds[myIndex - 1]);
      if (myIndex < siblingIds.length - 1) after = this.nodes.get(siblingIds[myIndex + 1]);
    }

    return {
      node,
      parent,
      children,
      siblings: { before, after },
    };
  }

  async updateApex(pyramidId: string, apex: Partial<ApexNode>): Promise<void> {
    const pyramid = this.pyramids.get(pyramidId);
    if (pyramid) {
      pyramid.apex = { ...pyramid.apex, ...apex, generatedAt: Date.now() };
      pyramid.version++;
    }
  }

  async deletePyramid(pyramidId: string): Promise<void> {
    const pyramid = this.pyramids.get(pyramidId);
    if (pyramid) {
      // Remove all nodes
      for (const node of [...pyramid.L0, ...pyramid.L1, ...pyramid.L2, ...pyramid.L3]) {
        this.nodes.delete(node.id);
      }
      this.pyramids.delete(pyramidId);
    }
  }

  async rebuildLevel(pyramidId: string, _level: ResolutionLevel): Promise<void> {
    // In a real implementation, this would rebuild the specified level
    // For now, just bump the version
    const pyramid = this.pyramids.get(pyramidId);
    if (pyramid) {
      pyramid.version++;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private createNode(
    level: ResolutionLevel,
    content: string,
    source: ContentSource,
    position: number,
    metadata?: Partial<ContentMetadata>
  ): ContentNode {
    return {
      id: `${level}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      level,
      content,
      wordCount: this.wordCount(content),
      parentId: undefined,
      childIds: [],
      source,
      position,
      metadata: metadata ?? {},
      createdAt: Date.now(),
    };
  }

  private buildLevel(
    lowerNodes: ContentNode[],
    level: ResolutionLevel,
    targetLength: number
  ): ContentNode[] {
    const nodes: ContentNode[] = [];
    let currentGroup: ContentNode[] = [];
    let currentLength = 0;

    for (const node of lowerNodes) {
      currentGroup.push(node);
      currentLength += node.wordCount;

      if (currentLength >= targetLength) {
        const parent = this.createNodeFromChildren(currentGroup, level, nodes.length);
        nodes.push(parent);
        this.nodes.set(parent.id, parent);

        // Link children to parent
        for (const child of currentGroup) {
          child.parentId = parent.id;
        }

        currentGroup = [];
        currentLength = 0;
      }
    }

    // Handle remaining nodes
    if (currentGroup.length > 0) {
      const parent = this.createNodeFromChildren(currentGroup, level, nodes.length);
      nodes.push(parent);
      this.nodes.set(parent.id, parent);

      for (const child of currentGroup) {
        child.parentId = parent.id;
      }
    }

    return nodes;
  }

  private createNodeFromChildren(
    children: ContentNode[],
    level: ResolutionLevel,
    position: number
  ): ContentNode {
    const content = children.map(c => c.content).join(' ');
    const node = this.createNode(
      level,
      content,
      children[0].source,
      position,
      children[0].metadata
    );
    node.childIds = children.map(c => c.id);
    return node;
  }

  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting
    return text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  private wordCount(text: string): number {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  private avgWordCount(nodes: ContentNode[]): number {
    if (nodes.length === 0) return 0;
    return nodes.reduce((sum, n) => sum + n.wordCount, 0) / nodes.length;
  }

  private simpleSummarize(text: string, targetLength: number): string {
    const words = text.split(/\s+/);
    if (words.length <= targetLength) return text;
    return words.slice(0, targetLength).join(' ') + '...';
  }

  private extractThemes(_nodes: ContentNode[]): string[] {
    // Placeholder - real implementation would use NLP
    return [];
  }

  private extractEntities(_nodes: ContentNode[]): string[] {
    // Placeholder - real implementation would use NER
    return [];
  }

  private async generateEmbeddings(
    nodes: ContentNode[],
    embedder: (texts: string[]) => Promise<number[][]>
  ): Promise<void> {
    const batchSize = 100;
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      const texts = batch.map(n => n.content);
      const embeddings = await embedder(texts);
      for (let j = 0; j < batch.length; j++) {
        batch[j].embedding = embeddings[j];
      }
    }
  }

  private calculateSimpleSimilarity(content: string, query: string): number {
    // Simple word overlap similarity
    const contentWords = new Set(content.split(/\s+/));
    const queryWords = query.split(/\s+/);
    const matches = queryWords.filter(w => contentWords.has(w)).length;
    return matches / queryWords.length;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private async getContextForNode(
    node: ContentNode,
    pyramid: ContentPyramid
  ): Promise<PyramidSearchResult['context']> {
    const level = pyramid[node.level] as ContentNode[];
    const index = level.findIndex(n => n.id === node.id);

    return {
      before: index > 0 ? level[index - 1] : undefined,
      after: index < level.length - 1 ? level[index + 1] : undefined,
      parent: node.parentId ? this.nodes.get(node.parentId) : undefined,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _ucgProvider: UCGProvider | null = null;

/**
 * Get the UCG provider
 */
export function getUCGProvider(): UCGProvider {
  if (!_ucgProvider) {
    _ucgProvider = new InMemoryUCGProvider();
  }
  return _ucgProvider;
}

/**
 * Set a custom UCG provider
 */
export function setUCGProvider(provider: UCGProvider): void {
  _ucgProvider = provider;
}

/**
 * Reset the UCG provider (for testing)
 */
export function resetUCGProvider(): void {
  _ucgProvider = null;
}
