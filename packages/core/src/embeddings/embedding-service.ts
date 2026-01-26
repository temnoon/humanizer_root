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
import { EMBEDDING_CONFIG_KEYS, EMBEDDING_DEFAULTS, getEmbeddingDefault } from '../config/embedding-config.js';

// ═══════════════════════════════════════════════════════════════════
// CONTENT TYPE DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Content types affect tokenization efficiency
 * - Code: ~2-3 chars/token (dense syntax, symbols)
 * - URLs: ~1-2 chars/token (special chars, base64)
 * - Prose: ~4-5 chars/token (natural language)
 */
type ContentType = 'code' | 'urls' | 'prose' | 'mixed';

/**
 * Detect content type to choose appropriate chunk size limits.
 * Tokenization varies significantly by content type.
 */
function detectContentType(text: string): ContentType {
  // Count indicators
  const codeIndicators = (text.match(/```|import\s+|export\s+|function\s+|const\s+\w+\s*=|class\s+\w+|=>/g) || []).length;
  const urlIndicators = (text.match(/https?:\/\/|www\.|file:\/\/|[a-zA-Z0-9+/]{20,}={0,2}/g) || []).length;
  const totalChars = text.length;

  // Thresholds (per 1000 chars)
  const codeRatio = (codeIndicators * 1000) / totalChars;
  const urlRatio = (urlIndicators * 1000) / totalChars;

  // URLs are most dangerous for tokenization
  if (urlRatio > 2) return 'urls';
  // Code is moderately dangerous
  if (codeRatio > 5) return 'code';
  // Mixed if both present but below thresholds
  if (codeRatio > 1 || urlRatio > 0.5) return 'mixed';
  // Default to prose (most efficient)
  return 'prose';
}

/**
 * Get max chars for embedding based on content type.
 * Uses config values with sensible defaults.
 */
function getMaxCharsForContentType(contentType: ContentType): number {
  switch (contentType) {
    case 'urls':
      return getEmbeddingDefault<number>(EMBEDDING_CONFIG_KEYS.MAX_CHARS_URLS);
    case 'code':
      return getEmbeddingDefault<number>(EMBEDDING_CONFIG_KEYS.MAX_CHARS_CODE);
    case 'prose':
      return getEmbeddingDefault<number>(EMBEDDING_CONFIG_KEYS.MAX_CHARS_PROSE);
    case 'mixed':
    default:
      // Use standard MAX_CHUNK_CHARS for mixed content
      return getEmbeddingDefault<number>(EMBEDDING_CONFIG_KEYS.MAX_CHUNK_CHARS);
  }
}

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
   *
   * For long texts that exceed the model's context length, this will
   * automatically chunk the content, embed ALL chunks, and return a centroid
   * embedding that represents the full content in the latent space.
   *
   * Content-type-aware: adjusts chunk limits based on tokenization efficiency
   * (code/URLs tokenize poorly, prose tokenizes well).
   */
  async embed(text: string): Promise<number[]> {
    // Detect content type and get appropriate limit
    const contentType = detectContentType(text);
    const maxChars = getMaxCharsForContentType(contentType);

    if (text.length <= maxChars) {
      return this.embedSingleText(text);
    }

    // Content exceeds safe limit - chunk and use centroid strategy
    // This ensures ALL content is represented (no information loss)
    const chunks = this.chunkLongText(text, maxChars);

    if (this.config.verbose && chunks.length > 1) {
      console.log(`  Text (${contentType}) split into ${chunks.length} chunks for centroid embedding`);
    }

    // Embed ALL chunks
    const chunkEmbeddings: number[][] = [];
    for (const chunk of chunks) {
      const embedding = await this.embedSingleText(chunk);
      chunkEmbeddings.push(embedding);
    }

    // Return centroid embedding (normalized average of all chunks)
    return this.computeCentroidEmbedding(chunkEmbeddings);
  }

  /**
   * Embed a single text (internal, no chunking)
   */
  private async embedSingleText(text: string): Promise<number[]> {
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
   * Chunk long text into smaller pieces at sentence boundaries
   */
  private chunkLongText(text: string, maxChars: number): string[] {
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxChars) {
        chunks.push(remaining);
        break;
      }

      // Find a good break point (sentence end)
      let breakPoint = maxChars;
      const searchStart = Math.max(0, maxChars - 500);
      const searchArea = remaining.substring(searchStart, maxChars);

      // Look for sentence endings
      const sentenceEnd = searchArea.lastIndexOf('. ');
      if (sentenceEnd > 0) {
        breakPoint = searchStart + sentenceEnd + 2;
      } else {
        // Fall back to paragraph break
        const paraEnd = searchArea.lastIndexOf('\n\n');
        if (paraEnd > 0) {
          breakPoint = searchStart + paraEnd + 2;
        }
      }

      chunks.push(remaining.substring(0, breakPoint).trim());
      remaining = remaining.substring(breakPoint).trim();
    }

    return chunks;
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

    // Use ChunkingService with content-type-aware limits
    // Limit varies by content type (code/URLs tokenize poorly)
    const targetChars = getEmbeddingDefault<number>(EMBEDDING_CONFIG_KEYS.TARGET_CHUNK_CHARS);
    const maxChars = getEmbeddingDefault<number>(EMBEDDING_CONFIG_KEYS.MAX_CHUNK_CHARS);
    const chunker = new ChunkingService({
      targetChunkChars: targetChars,
      maxChunkChars: maxChars,
      preserveParagraphs: true,
      preserveSentences: true,
    });

    // Extract texts with content-type-aware chunking
    // Uses centroid strategy for long content (via embed())
    const texts = needsEmbedding.map((n) => {
      const text = n.text || '';
      const contentType = detectContentType(text);
      const safeChars = getMaxCharsForContentType(contentType);

      if (text.length <= safeChars) {
        return text;
      }

      // Use chunking cascade for long texts
      const result = chunker.chunk({
        content: text,
        parentId: n.id,
        format: 'markdown', // Preserves structure better
      });

      // Return full text - embed() will handle chunking + centroid
      // This ensures ALL content is represented
      if (result.chunks.length > 0) {
        if (this.config.verbose) {
          console.log(`  Content (${contentType}) ${text.length} chars → ${result.chunks.length} chunks for centroid embedding`);
        }
      }

      return text; // embed() handles chunking and centroid
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

    // Get max combined content size from config
    const maxCombinedChars = getEmbeddingDefault<number>(EMBEDDING_CONFIG_KEYS.MAX_COMBINED_CHARS);

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

      // VALIDATION: If combined content is too large, embed nodes individually
      // This prevents memory issues and context overflow in pyramid building
      if (combinedContent.length > maxCombinedChars) {
        if (this.config.verbose) {
          console.log(`  Thread ${threadId.slice(0, 8)} too large (${combinedContent.length} chars), embedding nodes individually`);
        }
        // Fall through to simple embedding (handled after pyramid check)
        const simpleResults = await this.embedNodesSimple(threadNodes, enrichedContent);
        embeddingItems.push(...simpleResults);
        continue;
      }

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
   * Simple embedding for nodes - chunks long content and embeds ALL chunks
   *
   * For content exceeding the model's context length:
   * 1. Chunks the content at natural boundaries
   * 2. Embeds EVERY chunk (nothing is truncated/lost)
   * 3. Returns the centroid embedding for the node (average of all chunks)
   *
   * This ensures ALL content is represented in the latent space.
   *
   * @param nodes - Nodes to embed
   * @param enrichedContent - Optional enriched content map
   */
  private async embedNodesSimple(
    nodes: StoredNode[],
    enrichedContent?: Map<string, EnrichedContent>
  ): Promise<Array<{ nodeId: string; embedding: number[] }>> {
    if (nodes.length === 0) return [];

    const results: Array<{ nodeId: string; embedding: number[] }> = [];

    for (const node of nodes) {
      // Use enriched content if available
      const enriched = enrichedContent?.get(node.id);
      const text = enriched?.combined || node.text || '';

      // Detect content type and get appropriate limit
      const contentType = detectContentType(text);
      const maxChars = getMaxCharsForContentType(contentType);

      if (text.length <= maxChars) {
        // Content fits in single embedding
        const embedding = await this.embedSingleText(text);
        results.push({ nodeId: node.id, embedding });
      } else {
        // Content needs to be chunked - embed ALL chunks
        const chunks = this.chunkLongText(text, maxChars);

        if (this.config.verbose) {
          console.log(`    Node ${node.id.slice(0, 8)}... (${contentType}) chunked into ${chunks.length} parts for embedding`);
        }

        // Embed all chunks
        const chunkEmbeddings: number[][] = [];
        for (const chunk of chunks) {
          const embedding = await this.embedSingleText(chunk);
          chunkEmbeddings.push(embedding);
        }

        // Create centroid embedding (average of all chunks)
        // This ensures the full content is represented
        const centroid = this.computeCentroidEmbedding(chunkEmbeddings);
        results.push({ nodeId: node.id, embedding: centroid });
      }
    }

    return results;
  }

  /**
   * Compute centroid (average) of multiple embeddings
   * This creates a single embedding that represents the combined semantic space
   */
  private computeCentroidEmbedding(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];
    if (embeddings.length === 1) return embeddings[0];

    const dimensions = embeddings[0].length;
    const centroid = new Array(dimensions).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += embedding[i];
      }
    }

    // Average
    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= embeddings.length;
    }

    // Normalize to unit length for consistent similarity comparisons
    const magnitude = Math.sqrt(centroid.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] /= magnitude;
      }
    }

    return centroid;
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
