/**
 * PyramidService - Database operations for hierarchical summarization
 *
 * Handles CRUD operations for:
 * - L0 chunks (leaf nodes)
 * - L1+ summaries (intermediate nodes)
 * - Apex summaries (root nodes)
 *
 * Works with the existing EmbeddingDatabase - shares the same SQLite file.
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type {
  PyramidChunk,
  PyramidSummary,
  PyramidApex,
  Pyramid,
  ThreadType,
  BoundaryType,
  ChildType,
} from '../embeddings/types.js';

const EMBEDDING_DIM = 384;

export class PyramidService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ===========================================================================
  // Chunk Operations (L0)
  // ===========================================================================

  insertChunk(chunk: Omit<PyramidChunk, 'id' | 'createdAt'>): PyramidChunk {
    const id = uuidv4();
    const createdAt = Date.now();

    this.db.prepare(`
      INSERT INTO pyramid_chunks (
        id, thread_id, thread_type, chunk_index, content, word_count,
        start_offset, end_offset, boundary_type, embedding, embedding_model, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      chunk.threadId,
      chunk.threadType,
      chunk.chunkIndex,
      chunk.content,
      chunk.wordCount,
      chunk.startOffset,
      chunk.endOffset,
      chunk.boundaryType,
      chunk.embedding ? this.embeddingToBlob(chunk.embedding) : null,
      chunk.embeddingModel,
      createdAt
    );

    return { ...chunk, id, createdAt };
  }

  insertChunksBatch(chunks: Omit<PyramidChunk, 'id' | 'createdAt'>[]): PyramidChunk[] {
    const results: PyramidChunk[] = [];
    const createdAt = Date.now();

    const insert = this.db.prepare(`
      INSERT INTO pyramid_chunks (
        id, thread_id, thread_type, chunk_index, content, word_count,
        start_offset, end_offset, boundary_type, embedding, embedding_model, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: typeof chunks) => {
      for (const chunk of items) {
        const id = uuidv4();
        insert.run(
          id,
          chunk.threadId,
          chunk.threadType,
          chunk.chunkIndex,
          chunk.content,
          chunk.wordCount,
          chunk.startOffset,
          chunk.endOffset,
          chunk.boundaryType,
          chunk.embedding ? this.embeddingToBlob(chunk.embedding) : null,
          chunk.embeddingModel,
          createdAt
        );
        results.push({ ...chunk, id, createdAt });
      }
    });

    insertMany(chunks);
    return results;
  }

  getChunk(id: string): PyramidChunk | null {
    const row = this.db.prepare('SELECT * FROM pyramid_chunks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToChunk(row);
  }

  getChunksForThread(threadId: string): PyramidChunk[] {
    const rows = this.db.prepare(
      'SELECT * FROM pyramid_chunks WHERE thread_id = ? ORDER BY chunk_index'
    ).all(threadId) as Record<string, unknown>[];
    return rows.map(this.rowToChunk.bind(this));
  }

  updateChunkEmbedding(id: string, embedding: number[]): void {
    this.db.prepare('UPDATE pyramid_chunks SET embedding = ? WHERE id = ?')
      .run(this.embeddingToBlob(embedding), id);
  }

  deleteChunksForThread(threadId: string): number {
    const result = this.db.prepare('DELETE FROM pyramid_chunks WHERE thread_id = ?').run(threadId);
    return result.changes;
  }

  private rowToChunk(row: Record<string, unknown>): PyramidChunk {
    return {
      id: row.id as string,
      threadId: row.thread_id as string,
      threadType: row.thread_type as ThreadType,
      chunkIndex: row.chunk_index as number,
      content: row.content as string,
      wordCount: row.word_count as number,
      startOffset: row.start_offset as number | null,
      endOffset: row.end_offset as number | null,
      boundaryType: row.boundary_type as BoundaryType | null,
      embedding: row.embedding ? this.blobToEmbedding(row.embedding as Buffer) : null,
      embeddingModel: row.embedding_model as string,
      createdAt: row.created_at as number,
    };
  }

  // ===========================================================================
  // Summary Operations (L1+)
  // ===========================================================================

  insertSummary(summary: Omit<PyramidSummary, 'id' | 'createdAt'>): PyramidSummary {
    const id = uuidv4();
    const createdAt = Date.now();

    this.db.prepare(`
      INSERT INTO pyramid_summaries (
        id, thread_id, level, content, word_count, child_ids, child_type,
        source_word_count, compression_ratio, embedding, embedding_model, model_used, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      summary.threadId,
      summary.level,
      summary.content,
      summary.wordCount,
      JSON.stringify(summary.childIds),
      summary.childType,
      summary.sourceWordCount,
      summary.compressionRatio,
      summary.embedding ? this.embeddingToBlob(summary.embedding) : null,
      summary.embeddingModel,
      summary.modelUsed,
      createdAt
    );

    return { ...summary, id, createdAt };
  }

  getSummary(id: string): PyramidSummary | null {
    const row = this.db.prepare('SELECT * FROM pyramid_summaries WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToSummary(row);
  }

  getSummariesForThread(threadId: string): PyramidSummary[] {
    const rows = this.db.prepare(
      'SELECT * FROM pyramid_summaries WHERE thread_id = ? ORDER BY level, id'
    ).all(threadId) as Record<string, unknown>[];
    return rows.map(this.rowToSummary.bind(this));
  }

  getSummariesByLevel(threadId: string, level: number): PyramidSummary[] {
    const rows = this.db.prepare(
      'SELECT * FROM pyramid_summaries WHERE thread_id = ? AND level = ? ORDER BY id'
    ).all(threadId, level) as Record<string, unknown>[];
    return rows.map(this.rowToSummary.bind(this));
  }

  updateSummaryEmbedding(id: string, embedding: number[]): void {
    this.db.prepare('UPDATE pyramid_summaries SET embedding = ? WHERE id = ?')
      .run(this.embeddingToBlob(embedding), id);
  }

  deleteSummariesForThread(threadId: string): number {
    const result = this.db.prepare('DELETE FROM pyramid_summaries WHERE thread_id = ?').run(threadId);
    return result.changes;
  }

  private rowToSummary(row: Record<string, unknown>): PyramidSummary {
    return {
      id: row.id as string,
      threadId: row.thread_id as string,
      level: row.level as number,
      content: row.content as string,
      wordCount: row.word_count as number,
      childIds: JSON.parse(row.child_ids as string) as string[],
      childType: row.child_type as ChildType,
      sourceWordCount: row.source_word_count as number | null,
      compressionRatio: row.compression_ratio as number | null,
      embedding: row.embedding ? this.blobToEmbedding(row.embedding as Buffer) : null,
      embeddingModel: row.embedding_model as string,
      modelUsed: row.model_used as string | null,
      createdAt: row.created_at as number,
    };
  }

  // ===========================================================================
  // Apex Operations
  // ===========================================================================

  upsertApex(apex: Omit<PyramidApex, 'id' | 'createdAt' | 'updatedAt'>): PyramidApex {
    const now = Date.now();

    // Check if apex exists
    const existing = this.db.prepare(
      'SELECT id, created_at FROM pyramid_apex WHERE thread_id = ?'
    ).get(apex.threadId) as { id: string; created_at: number } | undefined;

    if (existing) {
      // Update existing
      this.db.prepare(`
        UPDATE pyramid_apex SET
          summary = ?, themes = ?, characters = ?, arc = ?,
          total_chunks = ?, pyramid_depth = ?, total_source_words = ?,
          embedding = ?, embedding_model = ?, model_used = ?, updated_at = ?
        WHERE id = ?
      `).run(
        apex.summary,
        apex.themes ? JSON.stringify(apex.themes) : null,
        apex.characters ? JSON.stringify(apex.characters) : null,
        apex.arc,
        apex.totalChunks,
        apex.pyramidDepth,
        apex.totalSourceWords,
        apex.embedding ? this.embeddingToBlob(apex.embedding) : null,
        apex.embeddingModel,
        apex.modelUsed,
        now,
        existing.id
      );

      return {
        ...apex,
        id: existing.id,
        createdAt: existing.created_at,
        updatedAt: now,
      };
    } else {
      // Insert new
      const id = uuidv4();
      this.db.prepare(`
        INSERT INTO pyramid_apex (
          id, thread_id, summary, themes, characters, arc,
          total_chunks, pyramid_depth, total_source_words,
          embedding, embedding_model, model_used, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        apex.threadId,
        apex.summary,
        apex.themes ? JSON.stringify(apex.themes) : null,
        apex.characters ? JSON.stringify(apex.characters) : null,
        apex.arc,
        apex.totalChunks,
        apex.pyramidDepth,
        apex.totalSourceWords,
        apex.embedding ? this.embeddingToBlob(apex.embedding) : null,
        apex.embeddingModel,
        apex.modelUsed,
        now
      );

      return {
        ...apex,
        id,
        createdAt: now,
        updatedAt: null,
      };
    }
  }

  getApex(threadId: string): PyramidApex | null {
    const row = this.db.prepare('SELECT * FROM pyramid_apex WHERE thread_id = ?').get(threadId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToApex(row);
  }

  getApexById(id: string): PyramidApex | null {
    const row = this.db.prepare('SELECT * FROM pyramid_apex WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToApex(row);
  }

  getAllApexes(): PyramidApex[] {
    const rows = this.db.prepare('SELECT * FROM pyramid_apex ORDER BY created_at DESC').all() as Record<string, unknown>[];
    return rows.map(this.rowToApex.bind(this));
  }

  updateApexEmbedding(id: string, embedding: number[]): void {
    this.db.prepare('UPDATE pyramid_apex SET embedding = ?, updated_at = ? WHERE id = ?')
      .run(this.embeddingToBlob(embedding), Date.now(), id);
  }

  deleteApex(threadId: string): boolean {
    const result = this.db.prepare('DELETE FROM pyramid_apex WHERE thread_id = ?').run(threadId);
    return result.changes > 0;
  }

  private rowToApex(row: Record<string, unknown>): PyramidApex {
    return {
      id: row.id as string,
      threadId: row.thread_id as string,
      summary: row.summary as string,
      themes: row.themes ? JSON.parse(row.themes as string) : null,
      characters: row.characters ? JSON.parse(row.characters as string) : null,
      arc: row.arc as string | null,
      totalChunks: row.total_chunks as number,
      pyramidDepth: row.pyramid_depth as number,
      totalSourceWords: row.total_source_words as number,
      embedding: row.embedding ? this.blobToEmbedding(row.embedding as Buffer) : null,
      embeddingModel: row.embedding_model as string,
      modelUsed: row.model_used as string | null,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number | null,
    };
  }

  // ===========================================================================
  // Pyramid Retrieval (Full Structure)
  // ===========================================================================

  /**
   * Get the complete pyramid structure for a thread
   */
  getPyramid(threadId: string): Pyramid | null {
    const chunks = this.getChunksForThread(threadId);
    if (chunks.length === 0) return null;

    const summaries = this.getSummariesForThread(threadId);
    const apex = this.getApex(threadId);

    // Calculate depth (max summary level + 1 for apex if present)
    const maxLevel = summaries.length > 0
      ? Math.max(...summaries.map(s => s.level))
      : 0;
    const depth = apex ? maxLevel + 2 : maxLevel + 1;  // +1 for chunks, +1 for apex

    return {
      threadId,
      threadType: chunks[0].threadType,
      chunks,
      summaries,
      apex,
      depth,
      totalChunks: chunks.length,
      totalWords: chunks.reduce((sum, c) => sum + c.wordCount, 0),
    };
  }

  /**
   * Check if a pyramid exists for a thread
   */
  hasPyramid(threadId: string): boolean {
    const row = this.db.prepare(
      'SELECT 1 FROM pyramid_chunks WHERE thread_id = ? LIMIT 1'
    ).get(threadId);
    return !!row;
  }

  /**
   * Delete entire pyramid for a thread
   */
  deletePyramid(threadId: string): { chunks: number; summaries: number; apex: boolean } {
    const chunks = this.deleteChunksForThread(threadId);
    const summaries = this.deleteSummariesForThread(threadId);
    const apex = this.deleteApex(threadId);
    return { chunks, summaries, apex };
  }

  /**
   * Get pyramid stats without loading full content
   */
  getPyramidStats(threadId: string): {
    chunks: number;
    summaries: number;
    hasApex: boolean;
    depth: number;
    totalWords: number;
  } | null {
    const chunkStats = this.db.prepare(`
      SELECT COUNT(*) as count, SUM(word_count) as total_words
      FROM pyramid_chunks WHERE thread_id = ?
    `).get(threadId) as { count: number; total_words: number } | undefined;

    if (!chunkStats || chunkStats.count === 0) return null;

    const summaryStats = this.db.prepare(`
      SELECT COUNT(*) as count, MAX(level) as max_level
      FROM pyramid_summaries WHERE thread_id = ?
    `).get(threadId) as { count: number; max_level: number | null };

    const hasApex = !!this.db.prepare(
      'SELECT 1 FROM pyramid_apex WHERE thread_id = ? LIMIT 1'
    ).get(threadId);

    const maxLevel = summaryStats.max_level ?? 0;
    const depth = hasApex ? maxLevel + 2 : maxLevel + 1;

    return {
      chunks: chunkStats.count,
      summaries: summaryStats.count,
      hasApex,
      depth,
      totalWords: chunkStats.total_words ?? 0,
    };
  }

  // ===========================================================================
  // Embedding Utilities
  // ===========================================================================

  private embeddingToBlob(embedding: number[]): Buffer {
    const buffer = Buffer.alloc(embedding.length * 4);
    for (let i = 0; i < embedding.length; i++) {
      buffer.writeFloatLE(embedding[i], i * 4);
    }
    return buffer;
  }

  private blobToEmbedding(blob: Buffer): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < blob.length; i += 4) {
      embedding.push(blob.readFloatLE(i));
    }
    return embedding;
  }
}
