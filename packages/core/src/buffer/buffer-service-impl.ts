/**
 * Buffer Service Implementation
 *
 * Core implementation of the API-first buffer system.
 * All business logic for content transformation pipelines lives here.
 *
 * @module @humanizer/core/buffer/buffer-service-impl
 */

import type {
  ContentBuffer,
  BufferOrigin,
  BufferContentFormat,
  BufferState,
  ProvenanceChain,
  BufferOperation,
  QualityMetrics,
  LoadFromArchiveOptions,
  LoadFromBookOptions,
  CreateFromTextOptions,
  TransformRequest,
  SplitOptions,
  MergeOptions,
  CommitToBookOptions,
  ExportToArchiveOptions,
  DerivedBufferResult,
  BufferAuthorRole,
} from './types.js';
import type {
  BufferService,
  BufferServiceOptions,
  ArchiveStoreAdapter,
  BooksStoreAdapter,
  AuiStoreAdapter,
} from './buffer-service.js';
import type { BookChapter } from '../aui/types.js';
import type { StoredNode } from '../storage/types.js';
import {
  computeContentHash,
  computeWordCount,
  detectContentFormat,
  generateUUID,
} from './hash-utils.js';
import {
  ProvenanceTracker,
  createProvenanceChain,
  createLoadOperation,
  createRewriteOperation,
  createMergeOperation,
  createSplitOperation,
  createAnalyzeOperation,
  createDetectAIOperation,
  createCommitOperation,
  createExportOperation,
  createEmbedOperation,
  createOperation,
} from './provenance-tracker.js';
import { getBuilderAgent, mergePersonaWithStyle } from '../houses/builder.js';
import type { AuiPostgresStore } from '../storage/aui-postgres-store.js';

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER SERVICE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * BufferServiceImpl - Main implementation of BufferService
 *
 * Provides:
 * - Content loading from archive/book
 * - Immutable transformations
 * - Quality analysis
 * - Provenance tracking
 * - Persistence
 */
export class BufferServiceImpl implements BufferService {
  private options: BufferServiceOptions;
  private provenanceTracker: ProvenanceTracker;

  constructor(options: BufferServiceOptions = {}) {
    this.options = options;
    this.provenanceTracker = new ProvenanceTracker();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  async loadFromArchive(
    nodeId: string,
    options?: LoadFromArchiveOptions
  ): Promise<ContentBuffer> {
    if (!this.options.archiveStore) {
      throw new Error('Archive store not configured');
    }

    const node = await this.options.archiveStore.getNode(nodeId);
    if (!node) {
      throw new Error(`Archive node not found: ${nodeId}`);
    }

    const text = node.text || '';
    const contentHash = computeContentHash(text);
    const wordCount = computeWordCount(text);
    const format = detectContentFormat(text);

    const origin: BufferOrigin = {
      sourceType: 'archive',
      sourceNodeId: nodeId,
      sourceNodeType: 'StoredNode',
      threadRootId: node.threadRootId,
      sourcePlatform: node.sourceType,
      author: node.author,
      authorRole: node.authorRole,
    };

    const buffer = this.createBuffer(text, contentHash, wordCount, format, origin, options?.initialState);

    // Create provenance chain
    const chain = this.provenanceTracker.createChain(buffer.id);
    const loadOp = createLoadOperation('archive', nodeId, contentHash, {
      type: 'system',
      id: 'buffer-service',
    });
    this.provenanceTracker.recordOperation(chain.id, loadOp, buffer.id);

    // Attach provenance to buffer
    buffer.provenanceChain = this.provenanceTracker.getChainForBuffer(buffer.id)!;

    // Optionally embed
    if (options?.includeEmbedding && this.options.embedFn) {
      return this.embed(buffer);
    }

    // Optionally analyze quality
    if (options?.computeQuality) {
      return this.analyzeQuality(buffer);
    }

    return buffer;
  }

  async loadFromBook(
    nodeId: string,
    options?: LoadFromBookOptions
  ): Promise<ContentBuffer> {
    if (!this.options.booksStore) {
      throw new Error('Books store not configured');
    }

    const chapter = await this.options.booksStore.getChapter(nodeId);
    if (!chapter) {
      throw new Error(`Book chapter not found: ${nodeId}`);
    }

    const text = chapter.content || '';
    const contentHash = computeContentHash(text);
    const wordCount = computeWordCount(text);
    const format = detectContentFormat(text);

    const origin: BufferOrigin = {
      sourceType: 'book',
      sourceNodeId: nodeId,
      sourceNodeType: 'BookNode',
      bookContext: {
        bookId: '', // Would need to be passed or looked up
        bookTitle: '',
        chapterId: chapter.id,
        chapterTitle: chapter.title,
      },
    };

    const buffer = this.createBuffer(text, contentHash, wordCount, format, origin, options?.initialState);

    // Create provenance chain
    const chain = this.provenanceTracker.createChain(buffer.id);
    const loadOp = createLoadOperation('book', nodeId, contentHash, {
      type: 'system',
      id: 'buffer-service',
    });
    this.provenanceTracker.recordOperation(chain.id, loadOp, buffer.id);

    buffer.provenanceChain = this.provenanceTracker.getChainForBuffer(buffer.id)!;

    if (options?.includeEmbedding && this.options.embedFn) {
      return this.embed(buffer);
    }

    if (options?.computeQuality) {
      return this.analyzeQuality(buffer);
    }

    return buffer;
  }

  async createFromText(
    text: string,
    options?: CreateFromTextOptions
  ): Promise<ContentBuffer> {
    const contentHash = computeContentHash(text);
    const wordCount = computeWordCount(text);
    const format = options?.format ?? detectContentFormat(text);

    const origin: BufferOrigin = {
      sourceType: 'manual',
      sourcePlatform: options?.sourcePlatform,
      author: options?.author,
      authorRole: options?.authorRole,
      metadata: options?.metadata,
    };

    const buffer = this.createBuffer(text, contentHash, wordCount, format, origin, options?.initialState);

    // Create provenance chain
    const chain = this.provenanceTracker.createChain(buffer.id);
    const createOp = createOperation(
      'create_manual',
      { type: 'user', id: options?.author ?? 'unknown' },
      '',
      contentHash,
      'Created from text',
      { sourcePlatform: options?.sourcePlatform }
    );
    this.provenanceTracker.recordOperation(chain.id, createOp, buffer.id);

    buffer.provenanceChain = this.provenanceTracker.getChainForBuffer(buffer.id)!;

    return buffer;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFORMATION
  // ═══════════════════════════════════════════════════════════════════════════

  async transform(
    buffer: ContentBuffer,
    operation: TransformRequest
  ): Promise<ContentBuffer> {
    const startTime = Date.now();

    // Create operation record
    const op = createOperation(
      operation.type,
      { type: 'system', id: 'buffer-service' },
      buffer.contentHash,
      buffer.contentHash, // Will be updated if content changes
      operation.description ?? `Transform: ${operation.type}`,
      operation.parameters
    );

    // For now, return unchanged buffer with operation recorded
    // Specific transformations will override this
    const newBuffer = this.cloneBuffer(buffer);
    newBuffer.updatedAt = Date.now();

    // Record operation
    const chain = this.provenanceTracker.getChainForBuffer(buffer.id);
    if (chain) {
      this.provenanceTracker.recordOperation(chain.id, op, newBuffer.id);
      newBuffer.provenanceChain = this.provenanceTracker.getChainForBuffer(newBuffer.id)!;
    }

    return newBuffer;
  }

  async rewriteForPersona(
    buffer: ContentBuffer,
    personaId: string,
    styleId?: string
  ): Promise<ContentBuffer> {
    const startTime = Date.now();

    // Get persona and style from store
    const auiStore = this.options.auiStore as unknown as AuiPostgresStore;
    if (!auiStore) {
      throw new Error('AUI store required for persona rewriting');
    }

    const persona = await auiStore.getPersonaProfile(personaId);
    if (!persona) {
      throw new Error(`Persona not found: ${personaId}`);
    }

    let style;
    if (styleId) {
      style = await auiStore.getStyleProfile(styleId);
    }

    // Merge persona and style
    const personaForRewrite = mergePersonaWithStyle(persona, style);

    // Get builder agent
    const builder = getBuilderAgent();
    if (!builder) {
      throw new Error('Builder agent not available');
    }

    // Perform rewrite using the public retry-enabled method
    const result = await builder.rewriteForPersonaWithRetry({
      text: buffer.text,
      persona: personaForRewrite,
      sourceType: buffer.origin.sourcePlatform,
    });

    const durationMs = Date.now() - startTime;

    // Create new buffer with rewritten content
    const newText = result.rewritten;
    const newHash = computeContentHash(newText);
    const newWordCount = computeWordCount(newText);

    const newBuffer = this.cloneBuffer(buffer);
    newBuffer.id = generateUUID();
    newBuffer.text = newText;
    newBuffer.contentHash = newHash;
    newBuffer.wordCount = newWordCount;
    newBuffer.updatedAt = Date.now();

    // Record operation
    const op = createRewriteOperation(
      buffer.contentHash,
      newHash,
      personaId,
      styleId,
      result.changesApplied,
      { type: 'agent', id: 'builder', modelId: 'default' },
      { durationMs, confidenceScore: result.confidenceScore }
    );

    const chain = this.provenanceTracker.getChainForBuffer(buffer.id);
    if (chain) {
      this.provenanceTracker.recordOperation(chain.id, op, newBuffer.id);
      newBuffer.provenanceChain = this.provenanceTracker.getChainForBuffer(newBuffer.id)!;
    }

    return newBuffer;
  }

  async merge(
    buffers: ContentBuffer[],
    options?: MergeOptions
  ): Promise<ContentBuffer> {
    if (buffers.length === 0) {
      throw new Error('Cannot merge empty buffer array');
    }

    if (buffers.length === 1) {
      return buffers[0];
    }

    const joinWith = options?.joinWith ?? '\n\n';
    const mergedText = buffers.map(b => b.text).join(joinWith);
    const contentHash = computeContentHash(mergedText);
    const wordCount = computeWordCount(mergedText);
    const format = buffers[0].format; // Use first buffer's format

    const origin: BufferOrigin = {
      sourceType: 'generated',
      metadata: {
        mergedFrom: buffers.map(b => b.id),
      },
    };

    const newBuffer = this.createBuffer(mergedText, contentHash, wordCount, format, origin, 'staged');

    // Create provenance chain
    const chain = this.provenanceTracker.createChain(newBuffer.id);
    const op = createMergeOperation(
      buffers.map(b => b.id),
      contentHash,
      { type: 'system', id: 'buffer-service' }
    );
    this.provenanceTracker.recordOperation(chain.id, op, newBuffer.id);

    newBuffer.provenanceChain = this.provenanceTracker.getChainForBuffer(newBuffer.id)!;

    return newBuffer;
  }

  async split(
    buffer: ContentBuffer,
    options: SplitOptions
  ): Promise<ContentBuffer[]> {
    let chunks: string[];

    switch (options.strategy) {
      case 'sentences':
        chunks = this.splitBySentences(buffer.text);
        break;
      case 'paragraphs':
        chunks = this.splitByParagraphs(buffer.text);
        break;
      case 'fixed_length':
        chunks = this.splitByLength(buffer.text, options.maxChunkSize ?? 500, options.overlap ?? 0);
        break;
      case 'semantic':
        // For now, fall back to paragraphs
        chunks = this.splitByParagraphs(buffer.text);
        break;
      default:
        chunks = [buffer.text];
    }

    const resultBuffers: ContentBuffer[] = [];
    const resultHashes: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const contentHash = computeContentHash(chunk);
      const wordCount = computeWordCount(chunk);

      resultHashes.push(contentHash);

      const origin: BufferOrigin = {
        sourceType: 'generated',
        metadata: {
          splitFrom: buffer.id,
          splitIndex: i,
          splitTotal: chunks.length,
        },
      };

      const newBuffer = this.createBuffer(
        chunk,
        contentHash,
        wordCount,
        buffer.format,
        origin,
        'staged'
      );

      resultBuffers.push(newBuffer);
    }

    // Record split operation on source buffer's chain
    const chain = this.provenanceTracker.getChainForBuffer(buffer.id);
    if (chain) {
      const op = createSplitOperation(
        buffer.contentHash,
        resultHashes,
        options.strategy,
        { type: 'system', id: 'buffer-service' }
      );
      // Record on source buffer (split doesn't create new buffer in chain, it creates separate chains)
      this.provenanceTracker.recordOperation(chain.id, op, buffer.id);
    }

    // Create provenance chains for each result
    for (const resultBuffer of resultBuffers) {
      const resultChain = this.provenanceTracker.createChain(resultBuffer.id);
      resultBuffer.provenanceChain = resultChain;
    }

    return resultBuffers;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUALITY ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════

  async analyzeQuality(buffer: ContentBuffer): Promise<ContentBuffer> {
    const startTime = Date.now();

    // Basic quality metrics
    const metrics: QualityMetrics = {
      overallScore: 0.7, // Placeholder
      readability: {
        fleschKincaidGrade: this.estimateReadingLevel(buffer.text),
        fleschReadingEase: 60, // Placeholder
        avgSentenceLength: this.avgSentenceLength(buffer.text),
        avgWordLength: this.avgWordLength(buffer.text),
      },
      voice: {
        formalityLevel: 0.5, // Placeholder
        detectedTone: 'neutral',
      },
      issues: [],
      computedAt: Date.now(),
    };

    const durationMs = Date.now() - startTime;

    // Clone buffer with metrics
    const newBuffer = this.cloneBuffer(buffer);
    newBuffer.qualityMetrics = metrics;
    newBuffer.updatedAt = Date.now();

    // Record operation
    const op = createAnalyzeOperation(
      buffer.contentHash,
      {
        scoreChange: metrics.overallScore,
        metricsAffected: ['readability', 'voice'],
        issuesFixed: [],
        issuesIntroduced: [],
      },
      { type: 'system', id: 'buffer-service' },
      durationMs
    );

    const chain = this.provenanceTracker.getChainForBuffer(buffer.id);
    if (chain) {
      this.provenanceTracker.recordOperation(chain.id, op, newBuffer.id);
      newBuffer.provenanceChain = this.provenanceTracker.getChainForBuffer(newBuffer.id)!;
    }

    return newBuffer;
  }

  async detectAI(buffer: ContentBuffer): Promise<ContentBuffer> {
    const startTime = Date.now();

    // Placeholder AI detection
    const aiProbability = 0.3; // Would use actual detection
    const tellsFound = 0;

    const durationMs = Date.now() - startTime;

    // Clone buffer with AI detection results
    const newBuffer = this.cloneBuffer(buffer);
    if (!newBuffer.qualityMetrics) {
      newBuffer.qualityMetrics = {
        overallScore: 0.7,
        issues: [],
        computedAt: Date.now(),
      };
    }
    newBuffer.qualityMetrics.aiDetection = {
      probability: aiProbability,
      tells: [],
      confidence: 0.8,
    };
    newBuffer.updatedAt = Date.now();

    // Record operation
    const op = createDetectAIOperation(
      buffer.contentHash,
      aiProbability,
      tellsFound,
      { type: 'system', id: 'buffer-service' },
      durationMs
    );

    const chain = this.provenanceTracker.getChainForBuffer(buffer.id);
    if (chain) {
      this.provenanceTracker.recordOperation(chain.id, op, newBuffer.id);
      newBuffer.provenanceChain = this.provenanceTracker.getChainForBuffer(newBuffer.id)!;
    }

    return newBuffer;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMIT
  // ═══════════════════════════════════════════════════════════════════════════

  async commitToBook(
    buffer: ContentBuffer,
    bookId: string,
    chapterId: string,
    options?: CommitToBookOptions
  ): Promise<BookChapter> {
    if (!this.options.booksStore) {
      throw new Error('Books store not configured');
    }

    // Add content to chapter
    const chapter = await this.options.booksStore.addToChapter(
      bookId,
      chapterId,
      buffer.text,
      options?.position
    );

    // Update buffer state
    const newBuffer = this.cloneBuffer(buffer);
    newBuffer.state = 'committed';
    newBuffer.updatedAt = Date.now();

    // Record operation
    const op = createCommitOperation(
      buffer.contentHash,
      bookId,
      chapterId,
      { type: 'system', id: 'buffer-service' }
    );

    const chain = this.provenanceTracker.getChainForBuffer(buffer.id);
    if (chain) {
      this.provenanceTracker.recordOperation(chain.id, op, newBuffer.id);
    }

    return chapter;
  }

  async exportToArchive(
    buffer: ContentBuffer,
    options?: ExportToArchiveOptions
  ): Promise<StoredNode> {
    if (!this.options.archiveStore) {
      throw new Error('Archive store not configured');
    }

    const now = Date.now();

    // Create archive node with all required fields
    const nodeData: Omit<StoredNode, 'id'> = {
      text: buffer.text,
      contentHash: buffer.contentHash,
      wordCount: buffer.wordCount,
      format: buffer.format,
      uri: `content://buffer/${buffer.id}`,
      sourceType: options?.nodeType ?? 'buffer-export',
      sourceAdapter: 'buffer-service',
      hierarchyLevel: 0,
      author: buffer.origin.author,
      authorRole: buffer.origin.authorRole,
      createdAt: now,
      importedAt: now,
      sourceCreatedAt: buffer.createdAt,
      sourceMetadata: {
        ...options?.metadata,
        bufferOrigin: buffer.origin,
        provenanceChainId: buffer.provenanceChain.id,
      },
    };

    const node = await this.options.archiveStore.createNode(nodeData);

    // Update buffer state
    const newBuffer = this.cloneBuffer(buffer);
    newBuffer.state = 'archived';
    newBuffer.updatedAt = Date.now();

    // Record operation
    const op = createExportOperation(
      buffer.contentHash,
      node.id,
      { type: 'system', id: 'buffer-service' }
    );

    const chain = this.provenanceTracker.getChainForBuffer(buffer.id);
    if (chain) {
      this.provenanceTracker.recordOperation(chain.id, op, newBuffer.id);
    }

    return node;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROVENANCE
  // ═══════════════════════════════════════════════════════════════════════════

  getProvenance(buffer: ContentBuffer): ProvenanceChain {
    return buffer.provenanceChain;
  }

  async traceToOrigin(buffer: ContentBuffer): Promise<ContentBuffer> {
    const chain = this.provenanceTracker.getChainForBuffer(buffer.id);
    if (!chain) {
      return buffer;
    }

    const rootBufferId = this.provenanceTracker.traceToRoot(chain.id);
    if (rootBufferId === buffer.id) {
      return buffer;
    }

    // Load root buffer from store
    if (this.options.auiStore) {
      const rootBuffer = await this.options.auiStore.loadContentBuffer(rootBufferId);
      if (rootBuffer) {
        return rootBuffer;
      }
    }

    return buffer;
  }

  async findDerived(buffer: ContentBuffer): Promise<DerivedBufferResult[]> {
    const derivedIds = this.provenanceTracker.findDerived(buffer.id);
    const results: DerivedBufferResult[] = [];

    for (const derivedId of derivedIds) {
      if (derivedId === buffer.id) continue;

      if (this.options.auiStore) {
        const derivedBuffer = await this.options.auiStore.loadContentBuffer(derivedId);
        if (derivedBuffer) {
          const chain = this.provenanceTracker.getChainForBuffer(derivedId);
          const distance = chain?.transformationCount ?? 0;
          const lastOp = chain?.operations[chain.operations.length - 1];

          if (lastOp) {
            results.push({
              buffer: derivedBuffer,
              distance,
              derivingOperation: lastOp,
            });
          }
        }
      }
    }

    return results;
  }

  async branch(
    buffer: ContentBuffer,
    branchName: string,
    description?: string
  ): Promise<ContentBuffer> {
    const chain = this.provenanceTracker.getChainForBuffer(buffer.id);
    if (!chain) {
      throw new Error('Buffer has no provenance chain');
    }

    // Create branch
    const newChain = this.provenanceTracker.createBranch(chain.id, branchName, description);

    // Clone buffer with new chain
    const newBuffer = this.cloneBuffer(buffer);
    newBuffer.id = generateUUID();
    newBuffer.provenanceChain = newChain;
    newBuffer.updatedAt = Date.now();

    return newBuffer;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════════

  async save(buffer: ContentBuffer): Promise<ContentBuffer> {
    if (!this.options.auiStore) {
      throw new Error('AUI store not configured');
    }

    const saved = await this.options.auiStore.saveContentBuffer(buffer);

    // Also save provenance chain
    await this.options.auiStore.saveProvenanceChain(buffer.provenanceChain);

    return saved;
  }

  async load(bufferId: string): Promise<ContentBuffer | undefined> {
    if (!this.options.auiStore) {
      return undefined;
    }

    return this.options.auiStore.loadContentBuffer(bufferId);
  }

  async findByContentHash(hash: string): Promise<ContentBuffer[]> {
    if (!this.options.auiStore) {
      return [];
    }

    return this.options.auiStore.findContentBuffersByHash(hash);
  }

  async delete(bufferId: string): Promise<boolean> {
    if (!this.options.auiStore) {
      return false;
    }

    return this.options.auiStore.deleteContentBuffer(bufferId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EMBEDDING
  // ═══════════════════════════════════════════════════════════════════════════

  async embed(buffer: ContentBuffer): Promise<ContentBuffer> {
    if (!this.options.embedFn) {
      throw new Error('Embedding function not configured');
    }

    const startTime = Date.now();
    const embedding = await this.options.embedFn(buffer.text);
    const durationMs = Date.now() - startTime;

    const newBuffer = this.cloneBuffer(buffer);
    newBuffer.embedding = embedding;
    newBuffer.updatedAt = Date.now();

    // Record operation
    const op = createEmbedOperation(
      buffer.contentHash,
      embedding.length,
      { type: 'system', id: 'buffer-service' },
      durationMs
    );

    const chain = this.provenanceTracker.getChainForBuffer(buffer.id);
    if (chain) {
      this.provenanceTracker.recordOperation(chain.id, op, newBuffer.id);
      newBuffer.provenanceChain = this.provenanceTracker.getChainForBuffer(newBuffer.id)!;
    }

    return newBuffer;
  }

  async findSimilar(
    buffer: ContentBuffer,
    limit?: number,
    minSimilarity?: number
  ): Promise<Array<ContentBuffer & { similarity: number }>> {
    if (!buffer.embedding) {
      throw new Error('Buffer has no embedding - call embed() first');
    }

    if (!this.options.auiStore) {
      return [];
    }

    const store = this.options.auiStore as unknown as AuiPostgresStore;
    const results = await store.findSimilarContentBuffers(buffer.embedding, limit ?? 10);

    // Filter by minimum similarity
    if (minSimilarity !== undefined) {
      return results.filter(r => r.similarity >= minSimilarity);
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private createBuffer(
    text: string,
    contentHash: string,
    wordCount: number,
    format: BufferContentFormat,
    origin: BufferOrigin,
    state?: BufferState
  ): ContentBuffer {
    const now = Date.now();
    return {
      id: generateUUID(),
      contentHash,
      text,
      wordCount,
      format,
      state: state ?? this.options.defaultState ?? 'transient',
      origin,
      provenanceChain: createProvenanceChain(''),
      createdAt: now,
      updatedAt: now,
    };
  }

  private cloneBuffer(buffer: ContentBuffer): ContentBuffer {
    return {
      ...buffer,
      id: generateUUID(),
      origin: { ...buffer.origin },
      provenanceChain: { ...buffer.provenanceChain },
      qualityMetrics: buffer.qualityMetrics ? { ...buffer.qualityMetrics } : undefined,
      embedding: buffer.embedding ? [...buffer.embedding] : undefined,
    };
  }

  private splitBySentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 0);
  }

  private splitByParagraphs(text: string): string[] {
    return text
      .split(/\n\s*\n/)
      .filter(p => p.trim().length > 0);
  }

  private splitByLength(text: string, maxLength: number, overlap: number): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let start = 0;

    while (start < words.length) {
      const end = Math.min(start + maxLength, words.length);
      chunks.push(words.slice(start, end).join(' '));
      start = end - overlap;
      if (start >= words.length - overlap) break;
    }

    return chunks;
  }

  private estimateReadingLevel(text: string): number {
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const syllables = this.countSyllables(text);

    if (sentences === 0 || words === 0) return 0;

    // Simplified Flesch-Kincaid formula
    return 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  }

  private countSyllables(text: string): number {
    const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
    let count = 0;
    for (const word of words) {
      count += this.syllablesInWord(word);
    }
    return count;
  }

  private syllablesInWord(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  private avgSentenceLength(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    const totalWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0);
    return totalWords / sentences.length;
  }

  private avgWordLength(text: string): number {
    const words = text.match(/\b\w+\b/g) || [];
    if (words.length === 0) return 0;
    const totalChars = words.reduce((sum, w) => sum + w.length, 0);
    return totalChars / words.length;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

let _bufferService: BufferServiceImpl | null = null;

/**
 * Create a new BufferService instance.
 */
export function createBufferService(options?: BufferServiceOptions): BufferServiceImpl {
  return new BufferServiceImpl(options);
}

/**
 * Get the singleton BufferService instance.
 */
export function getBufferService(): BufferServiceImpl | null {
  return _bufferService;
}

/**
 * Initialize the singleton BufferService.
 */
export function initBufferService(options?: BufferServiceOptions): BufferServiceImpl {
  _bufferService = new BufferServiceImpl(options);
  return _bufferService;
}

/**
 * Reset the singleton BufferService.
 */
export function resetBufferService(): void {
  _bufferService = null;
}
