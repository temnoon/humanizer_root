/**
 * ArchiveIndexer - Build embedding index for an archive
 *
 * Orchestrates the indexing process:
 * 1. Walk archive to extract conversations
 * 2. Generate embeddings for messages
 * 3. Store in SQLite + sqlite-vec
 */

import { v4 as uuidv4 } from 'uuid';
import { EmbeddingDatabase } from './EmbeddingDatabase.js';
import {
  walkArchive,
  splitIntoParagraphs,
  splitIntoSentences,
  generateChunkId,
  type ExtractedConversation,
} from './ConversationWalker.js';
import {
  initializeEmbedding,
  embed,
  embedBatch,
} from './EmbeddingGenerator.js';
import type { IndexingProgress, Chunk } from './types.js';

export interface IndexingOptions {
  /** Only embed messages from conversations marked as interesting */
  interestingOnly?: boolean;
  /** Include paragraph-level embeddings for all conversations */
  includeParagraphs?: boolean;
  /** Include sentence-level embeddings for selected messages */
  includeSentences?: boolean;
  /** Batch size for embedding generation */
  batchSize?: number;
  /** Progress callback */
  onProgress?: (progress: IndexingProgress) => void;
}

const DEFAULT_OPTIONS: IndexingOptions = {
  interestingOnly: false,
  includeParagraphs: false,
  includeSentences: false,
  batchSize: 32,
};

export class ArchiveIndexer {
  private db: EmbeddingDatabase;
  private archivePath: string;
  private progress: IndexingProgress;

  constructor(archivePath: string) {
    this.archivePath = archivePath;
    this.db = new EmbeddingDatabase(archivePath);
    this.progress = {
      status: 'idle',
      phase: '',
      current: 0,
      total: 0,
    };
  }

  /**
   * Get the database instance
   */
  getDatabase(): EmbeddingDatabase {
    return this.db;
  }

  /**
   * Get current indexing progress
   */
  getProgress(): IndexingProgress {
    return { ...this.progress };
  }

  /**
   * Build the full index for the archive
   */
  async buildIndex(options: IndexingOptions = {}): Promise<void> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
      this.progress = {
        status: 'indexing',
        phase: 'initializing',
        current: 0,
        total: 0,
        startedAt: Date.now(),
      };
      this.notifyProgress(opts.onProgress);

      // Initialize embedding model
      this.progress.phase = 'loading_model';
      this.notifyProgress(opts.onProgress);
      await initializeEmbedding();

      // Phase 1: Extract and store conversations + messages
      await this.extractConversations(opts);

      // Phase 2: Generate message embeddings
      await this.embedMessages(opts);

      // Phase 3: Generate paragraph embeddings (if enabled)
      if (opts.includeParagraphs) {
        await this.embedParagraphs(opts);
      }

      this.progress = {
        status: 'complete',
        phase: 'done',
        current: this.progress.total,
        total: this.progress.total,
        startedAt: this.progress.startedAt,
        completedAt: Date.now(),
      };
      this.notifyProgress(opts.onProgress);

    } catch (error) {
      this.progress = {
        status: 'error',
        phase: 'failed',
        current: this.progress.current,
        total: this.progress.total,
        error: error instanceof Error ? error.message : String(error),
      };
      this.notifyProgress(opts.onProgress);
      throw error;
    }
  }

  /**
   * Phase 1: Extract conversations and messages from archive
   */
  private async extractConversations(opts: IndexingOptions): Promise<void> {
    this.progress.phase = 'extracting';
    this.notifyProgress(opts.onProgress);

    let count = 0;
    for await (const extracted of walkArchive(this.archivePath)) {
      // Store conversation
      this.db.insertConversation(extracted.conversation);

      // Store messages
      this.db.insertMessagesBatch(extracted.messages);

      count++;
      this.progress.current = count;
      this.progress.currentItem = extracted.conversation.title;

      if (count % 100 === 0) {
        this.notifyProgress(opts.onProgress);
      }
    }

    const stats = this.db.getStats();
    console.log(`Extracted ${stats.conversationCount} conversations, ${stats.messageCount} messages`);
  }

  /**
   * Phase 2: Generate embeddings for all messages
   */
  private async embedMessages(opts: IndexingOptions): Promise<void> {
    this.progress.phase = 'embedding_messages';
    this.notifyProgress(opts.onProgress);

    // Get messages without embeddings
    const messages = this.db.getMessagesWithoutEmbeddings();
    this.progress.total = messages.length;
    this.progress.current = 0;

    console.log(`Generating embeddings for ${messages.length} messages...`);

    const batchSize = opts.batchSize || 32;

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const texts = batch.map(m => m.content);

      // Generate embeddings
      const embeddings = await embedBatch(texts, { batchSize });

      // Prepare batch inserts
      const embeddingInserts: Array<{
        id: string;
        conversationId: string;
        messageId: string;
        role: string;
        embedding: number[];
      }> = [];

      const messageUpdates: Array<{ id: string; embeddingId: string }> = [];

      for (let j = 0; j < batch.length; j++) {
        const message = batch[j];
        const embeddingId = uuidv4();

        embeddingInserts.push({
          id: embeddingId,
          conversationId: message.conversationId,
          messageId: message.id,
          role: message.role,
          embedding: embeddings[j],
        });

        messageUpdates.push({
          id: message.id,
          embeddingId,
        });
      }

      // Insert embeddings into vector table
      this.db.insertMessageEmbeddingsBatch(embeddingInserts);

      // Update messages with embedding IDs
      this.db.updateMessageEmbeddingIdsBatch(messageUpdates);

      this.progress.current = Math.min(i + batchSize, messages.length);
      this.notifyProgress(opts.onProgress);
    }

    const vecStats = this.db.getVectorStats();
    console.log(`Generated ${vecStats.messageCount} message embeddings`);
  }

  /**
   * Phase 3: Generate paragraph embeddings for interesting conversations
   */
  private async embedParagraphs(opts: IndexingOptions): Promise<void> {
    this.progress.phase = 'embedding_paragraphs';
    this.notifyProgress(opts.onProgress);

    // Get conversations to process
    const conversations = opts.interestingOnly
      ? this.db.getInterestingConversations()
      : this.db.getAllConversations();

    let totalChunks = 0;

    for (const conv of conversations) {
      const messages = this.db.getMessagesForConversation(conv.id);

      for (const message of messages) {
        // Split into paragraphs
        const paragraphs = splitIntoParagraphs(message.content);

        for (let i = 0; i < paragraphs.length; i++) {
          const chunkId = generateChunkId(message.id, 'paragraph', i);
          const paragraph = paragraphs[i];

          // Skip very short paragraphs
          if (paragraph.length < 20) continue;

          // Store chunk in SQLite
          const chunk: Omit<Chunk, 'embeddingId'> = {
            id: chunkId,
            messageId: message.id,
            chunkIndex: i,
            content: paragraph,
            tokenCount: Math.ceil(paragraph.length / 4),
            granularity: 'paragraph',
          };
          this.db.insertChunk(chunk);

          // Generate and store embedding
          const embedding = await embed(paragraph);
          this.db.insertParagraphEmbedding(
            chunkId,
            conv.id,
            message.id,
            i,
            embedding
          );

          totalChunks++;
          this.progress.current = totalChunks;

          if (totalChunks % 100 === 0) {
            this.notifyProgress(opts.onProgress);
          }
        }
      }
    }

    console.log(`Generated ${totalChunks} paragraph embeddings`);
  }

  /**
   * Add sentence-level embeddings for a specific message
   */
  async embedMessageSentences(messageId: string): Promise<number> {
    const message = this.db.getMessage(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    const sentences = splitIntoSentences(message.content);
    let count = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (sentence.length < 10) continue;

      const chunkId = generateChunkId(messageId, 'sentence', i);

      // Store chunk
      const chunk: Omit<Chunk, 'embeddingId'> = {
        id: chunkId,
        messageId,
        chunkIndex: i,
        content: sentence,
        tokenCount: Math.ceil(sentence.length / 4),
        granularity: 'sentence',
      };
      this.db.insertChunk(chunk);

      // Generate and store embedding
      const embedding = await embed(sentence);
      this.db.insertSentenceEmbedding(
        chunkId,
        message.conversationId,
        messageId,
        i,
        i,  // sentence_index same as chunk_index for now
        embedding
      );

      count++;
    }

    return count;
  }

  /**
   * Mark a conversation as interesting (triggers finer-grain indexing)
   */
  async markInteresting(conversationId: string, interesting: boolean = true): Promise<void> {
    this.db.markConversationInteresting(conversationId, interesting);

    // If marking as interesting and paragraphs not already indexed, index them
    if (interesting) {
      const messages = this.db.getMessagesForConversation(conversationId);
      for (const message of messages) {
        const existingChunks = this.db.getChunksForMessage(message.id);
        const hasParagraphs = existingChunks.some(c => c.granularity === 'paragraph');

        if (!hasParagraphs) {
          const paragraphs = splitIntoParagraphs(message.content);
          for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];
            if (paragraph.length < 20) continue;

            const chunkId = generateChunkId(message.id, 'paragraph', i);
            const chunk: Omit<Chunk, 'embeddingId'> = {
              id: chunkId,
              messageId: message.id,
              chunkIndex: i,
              content: paragraph,
              tokenCount: Math.ceil(paragraph.length / 4),
              granularity: 'paragraph',
            };
            this.db.insertChunk(chunk);

            const embedding = await embed(paragraph);
            this.db.insertParagraphEmbedding(
              chunkId,
              conversationId,
              message.id,
              i,
              embedding
            );
          }
        }
      }
    }
  }

  /**
   * Generate summary embedding for a conversation
   */
  async generateSummaryEmbedding(conversationId: string, summary: string): Promise<string> {
    const embeddingId = uuidv4();
    const embedding = await embed(summary);

    this.db.insertSummaryEmbedding(embeddingId, conversationId, embedding);
    this.db.updateConversationSummary(conversationId, summary, embeddingId);

    return embeddingId;
  }

  /**
   * Search for similar messages
   */
  async searchMessages(query: string, limit: number = 20) {
    const queryEmbedding = await embed(query);
    return this.db.searchMessages(queryEmbedding, limit);
  }

  /**
   * Search for similar conversations (by summary)
   */
  async searchConversations(query: string, limit: number = 20) {
    const queryEmbedding = await embed(query);
    return this.db.searchSummaries(queryEmbedding, limit);
  }

  /**
   * Find messages similar to a given message
   */
  async findSimilarMessages(
    messageEmbeddingId: string,
    limit: number = 20,
    excludeSameConversation: boolean = false
  ) {
    return this.db.findSimilarToMessage(messageEmbeddingId, limit, excludeSameConversation);
  }

  /**
   * Get indexing statistics
   */
  getStats() {
    const dbStats = this.db.getStats();
    const vecStats = this.db.getVectorStats();

    return {
      ...dbStats,
      vectorStats: vecStats,
      hasVectorSupport: this.db.hasVectorSupport(),
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  private notifyProgress(callback?: (progress: IndexingProgress) => void): void {
    if (callback) {
      callback(this.getProgress());
    }
  }
}
