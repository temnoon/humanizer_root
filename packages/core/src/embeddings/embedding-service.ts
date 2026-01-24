/**
 * Embedding Service
 *
 * Bridges packages/npe (OllamaAdapter) with packages/core (PyramidBuilder, ContentStore).
 * Provides 3-level embedding: L0 chunks, L1 summaries, Apex synthesis.
 *
 * Architecture:
 * - Uses OllamaAdapter for embedding generation (nomic-embed-text, 768 dims)
 * - Uses OllamaAdapter for summarization (llama3.2:3b)
 * - Integrates with PyramidBuilder for hierarchical content
 * - Stores embeddings via ContentStore.storeEmbeddings()
 */

import type { Embedder, Summarizer, PyramidBuildResult } from '../pyramid/types.js';
import { PyramidBuilder, initPyramidBuilder } from '../pyramid/builder.js';
import { MIN_WORDS_FOR_PYRAMID } from '../pyramid/constants.js';
import { countWords, ChunkingService, MAX_CHUNK_CHARS } from '../chunking/index.js';
import type { StoredNode } from '../storage/types.js';

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

const DEFAULT_CONFIG: Required<EmbeddingServiceConfig> = {
  ollamaUrl: 'http://localhost:11434',
  embedModel: 'nomic-embed-text:latest',
  completionModel: 'llama3.2:3b',
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

    return {
      embeddings,
      model: this.config.embedModel,
      dimensions: embeddings[0]?.length ?? 768,
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
   * Get embedding dimensions (768 for nomic-embed-text)
   */
  getEmbedDimensions(): number {
    return 768; // nomic-embed-text standard
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
