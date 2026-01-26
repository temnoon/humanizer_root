/**
 * Embedding Service
 *
 * Bridges packages/npe (OllamaAdapter) with packages/core (PyramidBuilder, ContentStore).
 * Provides 3-level embedding: L0 chunks, L1 summaries, Apex synthesis.
 *
 * Architecture:
 * - Uses ModelRegistry for model selection (embedding + completion)
 * - Uses OllamaAdapter for embedding generation
 * - Uses OllamaAdapter for summarization
 * - Integrates with PyramidBuilder for hierarchical content
 * - Stores embeddings via ContentStore.storeEmbeddings()
 *
 * Model Configuration:
 * - Models are resolved from ModelRegistry when available
 * - Falls back to config values if registry unavailable
 * - Use getEmbedDimensionsAsync() for registry-aware dimension lookup
 */

import type { Embedder, Summarizer, PyramidBuildResult, PyramidNode, ApexNode } from '../pyramid/types.js';
import type { EnrichedContent } from '../adapters/parsers/media-text-enrichment.js';
import { PyramidBuilder, initPyramidBuilder } from '../pyramid/builder.js';
import { MIN_WORDS_FOR_PYRAMID } from '../pyramid/constants.js';
import { countWords, ChunkingService, MAX_CHUNK_CHARS } from '../chunking/index.js';
import type { StoredNode, ContentLinkType } from '../storage/types.js';
import { getModelRegistry } from '../models/index.js';
import { randomUUID } from 'crypto';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Embedding service configuration
 */
export interface EmbeddingServiceConfig {
  /** Ollama base URL */
  ollamaUrl?: string;
  /** Embedding model (default: nomic-embed-text:latest) */
  embedModel?: string;
  /** Completion model for summaries (default: llama3.2:3b) */
  completionModel?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Batch size for embedding */
  batchSize?: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Default config values - used as fallback when ModelRegistry unavailable.
 * Prefer using createEmbeddingServiceFromRegistry() for registry-aware initialization.
 */
const DEFAULT_CONFIG: Required<EmbeddingServiceConfig> = {
  ollamaUrl: 'http://localhost:11434',
  embedModel: 'nomic-embed-text:latest',  // Fallback - prefer registry lookup
  completionModel: 'llama3.2:3b',          // Fallback - prefer registry lookup
  timeout: 60000,
  batchSize: 10,
  verbose: false,
};

/**
 * Result from embedding a batch of texts
 */
export interface EmbeddingBatchResult {
  embeddings: number[][];
  model: string;
  dimensions: number;
  count: number;
  durationMs: number;
}

/**
 * Result from processing content with embeddings
 */
export interface ContentEmbeddingResult {
  /** Node IDs that were embedded */
  embeddedNodeIds: string[];
  /** Pyramid result (if content was large enough) */
  pyramid?: PyramidBuildResult;
  /** Total embeddings generated */
  totalEmbeddings: number;
  /** Processing time */
  durationMs: number;
  /** Whether Ollama was available */
  ollamaAvailable: boolean;
}

/**
 * A pyramid node converted to StoredNode format for persistence
 */
export interface PyramidStoredNode {
  /** Node ID (same as PyramidNode.id) */
  id: string;
  /** Text content */
  text: string;
  /** Content hash for deduplication */
  contentHash: string;
  /** Hierarchy level (0, 1, or 2) */
  hierarchyLevel: number;
  /** Thread root ID for grouping */
  threadRootId: string;
  /** Parent node ID (for L0 -> L1, L1 -> Apex) */
  parentNodeId?: string;
  /** Position within level */
  position: number;
  /** Word count */
  wordCount: number;
  /** Source type */
  sourceType: string;
  /** Chunk offsets (for L0 only) */
  chunkStartOffset?: number;
  chunkEndOffset?: number;
  chunkIndex?: number;
}

/**
 * Link between pyramid nodes
 */
export interface PyramidLink {
  sourceId: string;
  targetId: string;
  linkType: ContentLinkType;
}

/**
 * Result from embedding nodes with pyramid building
 */
export interface PyramidEmbeddingResult {
  /** Embedding items for existing nodes */
  embeddingItems: Array<{ nodeId: string; embedding: number[] }>;
  /** New pyramid nodes to store (L1 summaries and Apex) */
  newNodes: PyramidStoredNode[];
  /** Links to create between nodes */
  links: PyramidLink[];
  /** Number of pyramids built */
  pyramidsBuilt: number;
  /** Total embeddings generated */
  totalEmbeddings: number;
  /** Processing duration in ms */
  durationMs: number;
  /** Statistics by thread */
  threadStats: Map<string, {
    l0Count: number;
    l1Count: number;
    hasApex: boolean;
    totalWords: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════════
// EMBEDDING SERVICE
// ═══════════════════════════════════════════════════════════════════

/**
 * Embedding service - bridges npe → core for 3-level embeddings
 */
export class EmbeddingService {
  private config: Required<EmbeddingServiceConfig>;
  private pyramidBuilder: PyramidBuilder | null = null;

  constructor(config: EmbeddingServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      console.debug('[EmbeddingService] Ollama not available:', error);
      return false;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.config.ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.embedModel,
        input: text,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama embed error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as { embeddings: number[][] };
    return data.embeddings[0];
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async embedBatch(texts: string[]): Promise<EmbeddingBatchResult> {
    const startTime = Date.now();
    const embeddings: number[][] = [];

    // Process in batches to avoid overwhelming Ollama
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);

      // Embed each text in the batch (Ollama doesn't support true batch embedding)
      const batchEmbeddings = await Promise.all(
        batch.map((text) => this.embed(text))
      );

      embeddings.push(...batchEmbeddings);

      if (this.config.verbose && texts.length > this.config.batchSize) {
        console.log(`  Embedded ${Math.min(i + this.config.batchSize, texts.length)}/${texts.length} texts...`);
      }
    }

    // Get dimensions from actual embeddings or fallback to registry/default
    const dimensions = embeddings[0]?.length ?? await this.getEmbedDimensionsAsync();

    return {
      embeddings,
      model: this.config.embedModel,
      dimensions,
      count: embeddings.length,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Create an Embedder function for PyramidBuilder
   */
  createEmbedder(): Embedder {
    return async (texts: string[]): Promise<number[][]> => {
      const result = await this.embedBatch(texts);
      return result.embeddings;
    };
  }

  /**
   * Create a Summarizer function for PyramidBuilder
   */
  createSummarizer(): Summarizer {
    return async (
      text: string,
      targetWords: number,
      context?: { level: number; position: number }
    ): Promise<string> => {
      const levelName = context?.level === 2 ? 'document apex' : `level ${context?.level ?? 1} summary`;

      const systemPrompt = `You are a precise summarizer. Create a ${levelName} that captures the key ideas, themes, and essential information. Target approximately ${targetWords} words. Be concise but comprehensive. Preserve the voice and tone of the original.`;

      const userPrompt = `Summarize the following content into approximately ${targetWords} words:\n\n${text}`;

      const response = await fetch(`${this.config.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.completionModel,
          prompt: userPrompt,
          system: systemPrompt,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: targetWords * 2,
          },
        }),
        signal: AbortSignal.timeout(this.config.timeout * 2),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama summarize error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as { response: string };
      return data.response.trim();
    };
  }

  /**
   * Get or create PyramidBuilder with embedder and summarizer
   */
  getPyramidBuilder(): PyramidBuilder {
    if (!this.pyramidBuilder) {
      this.pyramidBuilder = initPyramidBuilder({
        embedder: this.createEmbedder(),
        summarizer: this.createSummarizer(),
        onProgress: this.config.verbose
          ? (progress) => console.log(`  [Pyramid] ${progress.phase}: ${progress.message}`)
          : undefined,
      });
    }
    return this.pyramidBuilder;
  }

  /**
   * Process content: chunk, build pyramid if needed, generate embeddings
   *
   * @param content - The text content to process
   * @param threadRootId - ID for grouping pyramid nodes
   * @param sourceType - Source type for attribution
   * @returns Pyramid build result with embeddings
   */
  async processContent(
    content: string,
    threadRootId: string,
    sourceType: string
  ): Promise<ContentEmbeddingResult> {
    const startTime = Date.now();
    const embeddedNodeIds: string[] = [];

    // Check if Ollama is available
    const ollamaAvailable = await this.isAvailable();
    if (!ollamaAvailable) {
      if (this.config.verbose) {
        console.log('  Ollama not available, skipping embeddings');
      }
      return {
        embeddedNodeIds: [],
        totalEmbeddings: 0,
        durationMs: Date.now() - startTime,
        ollamaAvailable: false,
      };
    }

    const wordCount = countWords(content);
    const needsPyramid = wordCount >= MIN_WORDS_FOR_PYRAMID;

    if (needsPyramid) {
      // Build full pyramid with L0, L1, and Apex
      if (this.config.verbose) {
        console.log(`  Building pyramid for ${wordCount} words...`);
      }

      const builder = this.getPyramidBuilder();
      const result = await builder.build({
        content,
        threadRootId,
        sourceType,
      });

      // Collect all node IDs with embeddings
      for (const node of result.pyramid.l0Nodes) {
        if (node.embedding) {
          embeddedNodeIds.push(node.id);
        }
      }
      for (const node of result.pyramid.l1Nodes) {
        if (node.embedding) {
          embeddedNodeIds.push(node.id);
        }
      }
      if (result.pyramid.apex?.embedding) {
        embeddedNodeIds.push(result.pyramid.apex.id);
      }

      return {
        embeddedNodeIds,
        pyramid: result,
        totalEmbeddings: embeddedNodeIds.length,
        durationMs: Date.now() - startTime,
        ollamaAvailable: true,
      };
    } else {
      // Single embedding for short content
      if (this.config.verbose) {
        console.log(`  Generating single embedding for ${wordCount} words...`);
      }

      const embedding = await this.embed(content);

      return {
        embeddedNodeIds: [threadRootId],
        totalEmbeddings: 1,
        durationMs: Date.now() - startTime,
        ollamaAvailable: true,
      };
    }
  }

  /**
   * Embed existing nodes from database.
   *
   * Long texts are chunked using the ChunkingService to fit within
   * embedding model context limits. Uses cascade strategies:
   * conversation → paragraph → sentence → clause → hard.
   *
   * For multi-chunk content, embeds the first chunk (use processContent
   * for full pyramid with all chunks).
   *
   * @param nodes - Nodes to embed
   * @returns Array of {nodeId, embedding} for storage
   */
  async embedNodes(
    nodes: StoredNode[]
  ): Promise<Array<{ nodeId: string; embedding: number[] }>> {
    const results: Array<{ nodeId: string; embedding: number[] }> = [];

    // Filter nodes that need embedding
    const needsEmbedding = nodes.filter((n) => !n.embeddingModel);

    if (needsEmbedding.length === 0) {
      return results;
    }

    if (this.config.verbose) {
      console.log(`  Embedding ${needsEmbedding.length} nodes...`);
    }

    // Use ChunkingService with target chars safe for embedding model
    // nomic-embed-text has 2048 token context, ~4 chars/token average = 8192 chars max
    // Use conservative limit of 4000 chars to account for tokenization variance
    const SAFE_CHARS = 4000;
    const chunker = new ChunkingService({
      targetChunkChars: 3000, // Target well under the limit
      maxChunkChars: SAFE_CHARS,    // Hard limit
      preserveParagraphs: true,
      preserveSentences: true,
    });

    // Extract texts, chunking long content
    const texts = needsEmbedding.map((n) => {
      const text = n.text || '';
      if (text.length <= SAFE_CHARS) {
        return text;
      }

      // Use chunking cascade for long texts
      const result = chunker.chunk({
        content: text,
        parentId: n.id,
        format: 'markdown', // Preserves structure better
      });

      // Use first chunk for embedding
      // (Full pyramid with all chunks via processContent)
      if (result.chunks.length > 0) {
        if (this.config.verbose) {
          console.log(`  Chunked ${text.length} chars into ${result.chunks.length} chunks, using first`);
        }
        return result.chunks[0].text;
      }

      return text.substring(0, SAFE_CHARS); // Fallback truncation
    });

    const batchResult = await this.embedBatch(texts);

    // Pair node IDs with embeddings
    for (let i = 0; i < needsEmbedding.length; i++) {
      results.push({
        nodeId: needsEmbedding[i].id,
        embedding: batchResult.embeddings[i],
      });
    }

    return results;
  }

  /**
   * Get embedding model name
   */
  getEmbedModel(): string {
    return this.config.embedModel;
  }

  /**
   * Embed nodes with automatic pyramid building for threads with sufficient content.
   *
   * This method:
   * 1. Groups nodes by threadRootId
   * 2. For threads with combined content >= MIN_WORDS_FOR_PYRAMID:
   *    - Builds L0/L1/Apex pyramid structure
   *    - Creates new nodes for L1 summaries and Apex
   *    - Generates embeddings for all levels
   * 3. For smaller threads: generates single embeddings per node
   *
   * @param nodes - Nodes to embed (typically from a single import job)
   * @param sourceType - Source type for new pyramid nodes
   * @param options - Optional enriched content and settings
   * @returns Result with embeddings, new nodes, and links to create
   */
  async embedNodesWithPyramid(
    nodes: StoredNode[],
    sourceType: string = 'pyramid',
    options?: {
      /** Enriched content from media-text extraction */
      enrichedContent?: Map<string, EnrichedContent>;
      /** Use enriched content for embedding (default: true when enrichedContent provided) */
      useEnrichedForEmbedding?: boolean;
    }
  ): Promise<PyramidEmbeddingResult> {
    const enrichedContent = options?.enrichedContent;
    const useEnriched = options?.useEnrichedForEmbedding ?? !!enrichedContent;
    const startTime = Date.now();
    const embeddingItems: Array<{ nodeId: string; embedding: number[] }> = [];
    const newNodes: PyramidStoredNode[] = [];
    const links: PyramidLink[] = [];
    const threadStats = new Map<string, {
      l0Count: number;
      l1Count: number;
      hasApex: boolean;
      totalWords: number;
    }>();
    let pyramidsBuilt = 0;

    // Filter nodes that need embedding
    const needsEmbedding = nodes.filter((n) => !n.embeddingModel);
    if (needsEmbedding.length === 0) {
      return {
        embeddingItems: [],
        newNodes: [],
        links: [],
        pyramidsBuilt: 0,
        totalEmbeddings: 0,
        durationMs: Date.now() - startTime,
        threadStats,
      };
    }

    // Group nodes by threadRootId
    const threadGroups = new Map<string, StoredNode[]>();
    const orphanNodes: StoredNode[] = [];

    for (const node of needsEmbedding) {
      const threadId = node.threadRootId || node.id;
      if (node.threadRootId) {
        const group = threadGroups.get(threadId) || [];
        group.push(node);
        threadGroups.set(threadId, group);
      } else {
        orphanNodes.push(node);
      }
    }

    if (this.config.verbose) {
      console.log(`  Processing ${threadGroups.size} threads + ${orphanNodes.length} orphan nodes`);
    }

    // Process each thread group
    for (const [threadId, threadNodes] of threadGroups) {
      // Combine content from all nodes in thread (ordered by position)
      const sorted = [...threadNodes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      // Use enriched content for embedding if available
      const combinedContent = useEnriched
        ? sorted.map((n) => {
            const enriched = enrichedContent?.get(n.id);
            return enriched?.combined || n.text || '';
          }).join('\n\n')
        : sorted.map((n) => n.text || '').join('\n\n');
      const totalWords = countWords(combinedContent);

      // Initialize thread stats
      threadStats.set(threadId, {
        l0Count: 0,
        l1Count: 0,
        hasApex: false,
        totalWords,
      });

      // Check if thread needs pyramid
      if (totalWords >= MIN_WORDS_FOR_PYRAMID && this.pyramidBuilder) {
        // Build pyramid for this thread
        if (this.config.verbose) {
          console.log(`  Building pyramid for thread ${threadId.slice(0, 8)}... (${totalWords} words)`);
        }

        try {
          const builder = this.getPyramidBuilder();
          const result = await builder.build({
            content: combinedContent,
            threadRootId: threadId,
            sourceType: `${sourceType}-pyramid`,
          });

          pyramidsBuilt++;

          // Process L0 nodes - these correspond to chunks of the original content
          // Map original nodes to L0 pyramid nodes for embedding
          const stats = threadStats.get(threadId)!;
          stats.l0Count = result.pyramid.l0Nodes.length;

          // For L0, we'll embed the original nodes using their content
          // (the pyramid L0 nodes are just chunked versions)
          for (const l0 of result.pyramid.l0Nodes) {
            if (l0.embedding) {
              // Store L0 as a new chunk node
              const l0Node = this.pyramidNodeToStoredNode(
                l0,
                threadId,
                `${sourceType}-chunk`
              );
              newNodes.push(l0Node);
              embeddingItems.push({
                nodeId: l0.id,
                embedding: l0.embedding,
              });
            }
          }

          // Process L1 summary nodes
          stats.l1Count = result.pyramid.l1Nodes.length;
          for (const l1 of result.pyramid.l1Nodes) {
            const l1Node = this.pyramidNodeToStoredNode(
              l1,
              threadId,
              `${sourceType}-summary`
            );
            newNodes.push(l1Node);

            if (l1.embedding) {
              embeddingItems.push({
                nodeId: l1.id,
                embedding: l1.embedding,
              });
            }

            // Create summary-of links from L1 to its L0 children
            for (const childId of l1.childIds) {
              links.push({
                sourceId: l1.id,
                targetId: childId,
                linkType: 'summary-of',
              });
            }
          }

          // Process Apex node
          if (result.pyramid.apex) {
            stats.hasApex = true;
            const apex = result.pyramid.apex;
            const apexNode = this.apexNodeToStoredNode(
              apex,
              threadId,
              `${sourceType}-apex`
            );
            newNodes.push(apexNode);

            if (apex.embedding) {
              embeddingItems.push({
                nodeId: apex.id,
                embedding: apex.embedding,
              });
            }

            // Create summary-of links from Apex to its L1 children
            for (const childId of apex.childIds) {
              links.push({
                sourceId: apex.id,
                targetId: childId,
                linkType: 'summary-of',
              });
            }

            // Link apex to thread root
            links.push({
              sourceId: apex.id,
              targetId: threadId,
              linkType: 'summary-of',
            });
          }
        } catch (err) {
          // Pyramid building failed, fall back to simple embedding
          if (this.config.verbose) {
            console.warn(`  Pyramid build failed for thread ${threadId.slice(0, 8)}:`, err);
          }
          const fallbackItems = await this.embedNodesSimple(threadNodes, enrichedContent);
          embeddingItems.push(...fallbackItems);
        }
      } else {
        // Thread too small for pyramid, use simple embedding
        const simpleItems = await this.embedNodesSimple(threadNodes, enrichedContent);
        embeddingItems.push(...simpleItems);
      }
    }

    // Process orphan nodes with simple embedding
    if (orphanNodes.length > 0) {
      const orphanItems = await this.embedNodesSimple(orphanNodes, enrichedContent);
      embeddingItems.push(...orphanItems);
    }

    return {
      embeddingItems,
      newNodes,
      links,
      pyramidsBuilt,
      totalEmbeddings: embeddingItems.length,
      durationMs: Date.now() - startTime,
      threadStats,
    };
  }

  /**
   * Simple embedding for nodes (no pyramid)
   *
   * @param nodes - Nodes to embed
   * @param enrichedContent - Optional enriched content map
   */
  private async embedNodesSimple(
    nodes: StoredNode[],
    enrichedContent?: Map<string, EnrichedContent>
  ): Promise<Array<{ nodeId: string; embedding: number[] }>> {
    if (nodes.length === 0) return [];

    const SAFE_CHARS = 4000;
    const chunker = new ChunkingService({
      targetChunkChars: 3000,
      maxChunkChars: SAFE_CHARS,
      preserveParagraphs: true,
      preserveSentences: true,
    });

    const texts = nodes.map((n) => {
      // Use enriched content if available
      const enriched = enrichedContent?.get(n.id);
      const text = enriched?.combined || n.text || '';
      if (text.length <= SAFE_CHARS) return text;

      const result = chunker.chunk({
        content: text,
        parentId: n.id,
        format: 'markdown',
      });

      if (result.chunks.length > 0) {
        return result.chunks[0].text;
      }
      return text.substring(0, SAFE_CHARS);
    });

    const batchResult = await this.embedBatch(texts);
    return nodes.map((n, i) => ({
      nodeId: n.id,
      embedding: batchResult.embeddings[i],
    }));
  }

  /**
   * Convert a PyramidNode to PyramidStoredNode format
   */
  private pyramidNodeToStoredNode(
    node: PyramidNode,
    threadRootId: string,
    sourceType: string
  ): PyramidStoredNode {
    return {
      id: node.id,
      text: node.text,
      contentHash: this.hashContent(node.text),
      hierarchyLevel: node.level,
      threadRootId,
      parentNodeId: node.parentId,
      position: node.position,
      wordCount: node.wordCount,
      sourceType,
      chunkStartOffset: node.sourceChunk?.startOffset,
      chunkEndOffset: node.sourceChunk?.endOffset,
      chunkIndex: node.sourceChunk?.index,
    };
  }

  /**
   * Convert an ApexNode to PyramidStoredNode format
   */
  private apexNodeToStoredNode(
    apex: ApexNode,
    threadRootId: string,
    sourceType: string
  ): PyramidStoredNode {
    return {
      id: apex.id,
      text: apex.text,
      contentHash: this.hashContent(apex.text),
      hierarchyLevel: 2,
      threadRootId,
      parentNodeId: undefined, // Apex has no parent
      position: 0,
      wordCount: apex.wordCount,
      sourceType,
    };
  }

  /**
   * Hash content for deduplication
   */
  private hashContent(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get embedding dimensions (synchronous fallback)
   * @deprecated Use getEmbedDimensionsAsync() for registry-aware lookup
   */
  getEmbedDimensions(): number {
    // Try to get from registry synchronously (if already initialized)
    try {
      const registry = getModelRegistry();
      const model = (registry as any).models?.get(this.config.embedModel);
      if (model?.dimensions) {
        return model.dimensions;
      }
    } catch {
      // Registry not available, use fallback
    }
    return 768; // Fallback for nomic-embed-text
  }

  /**
   * Get embedding dimensions from ModelRegistry (async, preferred)
   */
  async getEmbedDimensionsAsync(): Promise<number> {
    try {
      const registry = getModelRegistry();
      return await registry.getEmbeddingDimensions(this.config.embedModel);
    } catch {
      // Registry unavailable or model not found
      return 768; // Fallback
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _embeddingService: EmbeddingService | null = null;

/**
 * Get or create the embedding service singleton
 */
export function getEmbeddingService(config?: EmbeddingServiceConfig): EmbeddingService {
  if (!_embeddingService) {
    _embeddingService = new EmbeddingService(config);
  }
  return _embeddingService;
}

/**
 * Initialize embedding service with config
 */
export function initEmbeddingService(config: EmbeddingServiceConfig = {}): EmbeddingService {
  _embeddingService = new EmbeddingService(config);
  return _embeddingService;
}

/**
 * Reset embedding service (for testing)
 */
export function resetEmbeddingService(): void {
  _embeddingService = null;
}

/**
 * Create embedding service with models resolved from ModelRegistry.
 * This is the preferred way to create an EmbeddingService.
 *
 * @example
 * ```typescript
 * const service = await createEmbeddingServiceFromRegistry();
 * const embedding = await service.embed("hello world");
 * ```
 */
export async function createEmbeddingServiceFromRegistry(
  config: Partial<EmbeddingServiceConfig> = {}
): Promise<EmbeddingService> {
  const registry = getModelRegistry();
  await registry.initialize();

  // Resolve models from registry if not explicitly provided
  let embedModel = config.embedModel;
  let completionModel = config.completionModel;

  if (!embedModel) {
    try {
      const model = await registry.getDefault('embedding');
      embedModel = model.id;
    } catch {
      embedModel = DEFAULT_CONFIG.embedModel;
    }
  }

  if (!completionModel) {
    try {
      const model = await registry.getDefault('completion');
      completionModel = model.id;
    } catch {
      completionModel = DEFAULT_CONFIG.completionModel;
    }
  }

  return new EmbeddingService({
    ...config,
    embedModel,
    completionModel,
  });
}
