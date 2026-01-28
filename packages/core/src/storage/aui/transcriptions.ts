/**
 * AUI PostgreSQL Store - Transcription Methods
 *
 * Transcription version and job CRUD operations.
 *
 * @module @humanizer/core/storage/aui/transcriptions
 */

import { randomUUID } from 'crypto';
import type { Pool, QueryResult } from 'pg';
import type {
  TranscriptionVersion,
  TranscriptionJob,
  TranscriptionType,
  TranscriptionStatus,
  TranscriptionSegment,
  TranscriptionModelInfo,
  TranscriptionQualityMetrics,
  TranscriptionPriority,
  CreateTranscriptionRequest,
  ListTranscriptionsOptions,
  SetPreferredResult,
  MediaTranscriptionSummary,
} from '../../aui/types/transcription-types.js';
import {
  INSERT_AUI_TRANSCRIPTION_VERSION,
  GET_AUI_TRANSCRIPTION_VERSION,
  GET_AUI_TRANSCRIPTION_VERSIONS_FOR_MEDIA,
  GET_AUI_PREFERRED_TRANSCRIPTION,
  LIST_AUI_TRANSCRIPTION_VERSIONS,
  UPDATE_AUI_TRANSCRIPTION_STATUS,
  UPDATE_AUI_TRANSCRIPTION_CONTENT,
  CLEAR_AUI_PREFERRED_TRANSCRIPTION,
  SET_AUI_PREFERRED_TRANSCRIPTION,
  GET_AUI_TRANSCRIPTION_SUMMARY,
  DELETE_AUI_TRANSCRIPTION_VERSION,
  DELETE_AUI_TRANSCRIPTIONS_FOR_MEDIA,
  INSERT_AUI_TRANSCRIPTION_JOB,
  GET_AUI_TRANSCRIPTION_JOB,
  UPDATE_AUI_TRANSCRIPTION_JOB,
  GET_AUI_PENDING_TRANSCRIPTION_JOBS,
  GET_AUI_TRANSCRIPTION_JOBS_FOR_MEDIA,
  DELETE_AUI_TRANSCRIPTION_JOB,
  CLEANUP_AUI_COMPLETED_TRANSCRIPTION_JOBS,
  // Embedding queries (first-class citizen support)
  UPDATE_AUI_TRANSCRIPTION_EMBEDDING,
  GET_AUI_TRANSCRIPTIONS_NEEDING_EMBEDDING,
  GET_AUI_TRANSCRIPTIONS_STALE_EMBEDDING,
  UPDATE_AUI_TRANSCRIPTION_SOURCE_CONTEXT,
} from '../schema-aui.js';

// ═══════════════════════════════════════════════════════════════════════════
// ROW TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface DbTranscriptionVersionRow {
  id: string;
  media_id: string;
  archive_id: string;
  type: string;
  status: string;
  text: string | null;
  segments: unknown | null;
  error_message: string | null;
  model_id: string;
  model_provider: string;
  model_version: string | null;
  model_variant: string | null;
  confidence: number | null;
  word_count: number | null;
  segment_count: number | null;
  language: string | null;
  // Embedding fields (first-class citizen in universal content space)
  embedding: string | null;         // pgvector returns as string
  embedding_model: string | null;
  embedding_at: Date | null;
  embedding_text_hash: string | null;
  // Source context (link back to original content)
  source_node_id: string | null;
  source_conversation_id: string | null;
  source_created_at: Date | null;
  // Versioning
  version_number: number;
  is_preferred: boolean;
  supersedes_version_id: string | null;
  requested_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  processing_duration_ms: number | null;
  requested_by: string | null;
  created_at: Date;
}

export interface DbTranscriptionJobRow {
  id: string;
  media_id: string;
  archive_id: string;
  type: string;
  status: string;
  progress: number | null;
  model_id: string | null;
  priority: string;
  queued_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  result_version_id: string | null;
  error: string | null;
  requested_by: string | null;
  created_at: Date;
}

/** Row type for transcriptions needing embedding */
export interface DbTranscriptionNeedingEmbeddingRow {
  id: string;
  text: string;
  word_count: number | null;
}

/** Row type for transcriptions with stale embeddings */
export interface DbTranscriptionStaleEmbeddingRow {
  id: string;
  text: string;
  word_count: number | null;
  embedding_text_hash: string;
}

/** Transcription needing embedding */
export interface TranscriptionNeedingEmbedding {
  id: string;
  text: string;
  wordCount?: number;
}

/** Transcription with stale embedding */
export interface TranscriptionStaleEmbedding {
  id: string;
  text: string;
  wordCount?: number;
  embeddingTextHash: string;
}

/** Source context for linking transcription to original content */
export interface TranscriptionSourceContext {
  sourceNodeId?: string;
  sourceConversationId?: string;
  sourceCreatedAt?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROW CONVERTERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse pgvector string to number array
 * pgvector returns vectors as '[1.0,2.0,3.0]' strings
 */
function parseVectorString(vectorStr: string | null): number[] | undefined {
  if (!vectorStr) return undefined;
  try {
    // pgvector format: '[1.0,2.0,3.0]'
    const trimmed = vectorStr.replace(/^\[|\]$/g, '');
    return trimmed.split(',').map(Number);
  } catch {
    return undefined;
  }
}

export function rowToTranscriptionVersion(row: DbTranscriptionVersionRow): TranscriptionVersion {
  return {
    id: row.id,
    mediaId: row.media_id,
    archiveId: row.archive_id,
    type: row.type as TranscriptionType,
    status: row.status as TranscriptionStatus,
    text: row.text ?? undefined,
    segments: row.segments as TranscriptionSegment[] | undefined,
    errorMessage: row.error_message ?? undefined,
    model: {
      id: row.model_id,
      provider: row.model_provider as TranscriptionModelInfo['provider'],
      version: row.model_version ?? undefined,
      variant: row.model_variant ?? undefined,
    },
    quality: {
      confidence: row.confidence ?? undefined,
      wordCount: row.word_count ?? undefined,
      segmentCount: row.segment_count ?? undefined,
      language: row.language ?? undefined,
    },
    // Embedding (first-class citizen in universal content space)
    embedding: parseVectorString(row.embedding),
    embeddingModel: row.embedding_model ?? undefined,
    embeddingAt: row.embedding_at ?? undefined,
    embeddingTextHash: row.embedding_text_hash ?? undefined,
    // Source context
    sourceNodeId: row.source_node_id ?? undefined,
    sourceConversationId: row.source_conversation_id ?? undefined,
    sourceCreatedAt: row.source_created_at ?? undefined,
    // Versioning
    versionNumber: row.version_number,
    isPreferred: row.is_preferred,
    supersedesVersionId: row.supersedes_version_id ?? undefined,
    requestedAt: row.requested_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    processingDurationMs: row.processing_duration_ms ?? undefined,
    requestedBy: row.requested_by ?? undefined,
    createdAt: row.created_at,
  };
}

export function rowToTranscriptionJob(row: DbTranscriptionJobRow): TranscriptionJob {
  return {
    id: row.id,
    mediaId: row.media_id,
    archiveId: row.archive_id,
    type: row.type as TranscriptionType,
    status: row.status as TranscriptionStatus,
    progress: row.progress ?? undefined,
    modelId: row.model_id ?? undefined,
    priority: row.priority as TranscriptionPriority,
    queuedAt: row.queued_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    resultVersionId: row.result_version_id ?? undefined,
    error: row.error ?? undefined,
    requestedBy: row.requested_by ?? undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE METHODS INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

export interface TranscriptionStoreMethods {
  // Version management
  createTranscriptionVersion(
    request: CreateTranscriptionRequest,
    model: TranscriptionModelInfo
  ): Promise<TranscriptionVersion>;
  getTranscriptionVersion(id: string): Promise<TranscriptionVersion | undefined>;
  getTranscriptionVersionsForMedia(
    mediaId: string,
    archiveId: string
  ): Promise<TranscriptionVersion[]>;
  getPreferredTranscription(
    mediaId: string,
    archiveId: string,
    type: TranscriptionType
  ): Promise<TranscriptionVersion | undefined>;
  listTranscriptionVersions(options: ListTranscriptionsOptions): Promise<TranscriptionVersion[]>;
  setPreferredTranscriptionVersion(versionId: string): Promise<SetPreferredResult>;
  deleteTranscriptionVersion(id: string): Promise<boolean>;
  deleteTranscriptionsForMedia(mediaId: string, archiveId: string): Promise<number>;

  // Status updates
  updateTranscriptionStatus(
    id: string,
    status: TranscriptionStatus,
    error?: string
  ): Promise<TranscriptionVersion | undefined>;
  completeTranscription(
    id: string,
    text: string,
    segments: TranscriptionSegment[] | undefined,
    metrics: TranscriptionQualityMetrics
  ): Promise<TranscriptionVersion | undefined>;

  // Embedding management (first-class citizen in universal content space)
  updateTranscriptionEmbedding(
    id: string,
    embedding: number[],
    model: string,
    textHash: string
  ): Promise<TranscriptionVersion | undefined>;
  getTranscriptionsNeedingEmbedding(limit?: number): Promise<TranscriptionNeedingEmbedding[]>;
  getTranscriptionsWithStaleEmbedding(limit?: number): Promise<TranscriptionStaleEmbedding[]>;
  updateSourceContext(id: string, context: TranscriptionSourceContext): Promise<TranscriptionVersion | undefined>;

  // Summary
  getTranscriptionSummary(
    mediaId: string,
    archiveId: string
  ): Promise<MediaTranscriptionSummary | undefined>;

  // Job management
  createTranscriptionJob(request: CreateTranscriptionRequest): Promise<TranscriptionJob>;
  getTranscriptionJob(id: string): Promise<TranscriptionJob | undefined>;
  updateTranscriptionJob(
    id: string,
    updates: Partial<TranscriptionJob>
  ): Promise<TranscriptionJob | undefined>;
  getPendingTranscriptionJobs(limit?: number): Promise<TranscriptionJob[]>;
  getTranscriptionJobsForMedia(mediaId: string, archiveId: string): Promise<TranscriptionJob[]>;
  deleteTranscriptionJob(id: string): Promise<boolean>;
  cleanupCompletedTranscriptionJobs(): Promise<number>;
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

export function createTranscriptionMethods(pool: Pool): TranscriptionStoreMethods {
  const methods: TranscriptionStoreMethods = {
    // ─────────────────────────────────────────────────────────────────────────
    // VERSION METHODS
    // ─────────────────────────────────────────────────────────────────────────

    async createTranscriptionVersion(
      request: CreateTranscriptionRequest,
      model: TranscriptionModelInfo
    ): Promise<TranscriptionVersion> {
      const id = randomUUID();
      const now = new Date();

      const result = await pool.query<DbTranscriptionVersionRow>(INSERT_AUI_TRANSCRIPTION_VERSION, [
        id,                            // $1 id
        request.mediaId,               // $2 media_id
        request.archiveId,             // $3 archive_id
        request.type,                  // $4 type
        'pending',                     // $5 status
        null,                          // $6 text
        null,                          // $7 segments
        null,                          // $8 error_message
        model.id,                      // $9 model_id
        model.provider,                // $10 model_provider
        model.version ?? null,         // $11 model_version
        model.variant ?? null,         // $12 model_variant
        null,                          // $13 confidence
        null,                          // $14 word_count
        null,                          // $15 segment_count
        null,                          // $16 language
        0,                             // $17 version_number (trigger will set)
        false,                         // $18 is_preferred
        null,                          // $19 supersedes_version_id
        now,                           // $20 requested_at
        null,                          // $21 started_at
        null,                          // $22 completed_at
        null,                          // $23 processing_duration_ms
        request.requestedBy ?? null,   // $24 requested_by
      ]);

      if (!result.rows[0]) {
        throw new Error('Failed to create transcription version');
      }

      return rowToTranscriptionVersion(result.rows[0]);
    },

    async getTranscriptionVersion(id: string): Promise<TranscriptionVersion | undefined> {
      const result = await pool.query<DbTranscriptionVersionRow>(GET_AUI_TRANSCRIPTION_VERSION, [
        id,
      ]);
      return result.rows[0] ? rowToTranscriptionVersion(result.rows[0]) : undefined;
    },

    async getTranscriptionVersionsForMedia(
      mediaId: string,
      archiveId: string
    ): Promise<TranscriptionVersion[]> {
      const result = await pool.query<DbTranscriptionVersionRow>(
        GET_AUI_TRANSCRIPTION_VERSIONS_FOR_MEDIA,
        [mediaId, archiveId]
      );
      return result.rows.map(rowToTranscriptionVersion);
    },

    async getPreferredTranscription(
      mediaId: string,
      archiveId: string,
      type: TranscriptionType
    ): Promise<TranscriptionVersion | undefined> {
      const result = await pool.query<DbTranscriptionVersionRow>(GET_AUI_PREFERRED_TRANSCRIPTION, [
        mediaId,
        archiveId,
        type,
      ]);
      return result.rows[0] ? rowToTranscriptionVersion(result.rows[0]) : undefined;
    },

    async listTranscriptionVersions(
      options: ListTranscriptionsOptions
    ): Promise<TranscriptionVersion[]> {
      const result = await pool.query<DbTranscriptionVersionRow>(LIST_AUI_TRANSCRIPTION_VERSIONS, [
        options.mediaId ?? null,
        options.archiveId ?? null,
        options.type ?? null,
        options.status ?? null,
        options.preferredOnly ?? null,
        options.limit ?? 100,
        options.offset ?? 0,
      ]);
      return result.rows.map(rowToTranscriptionVersion);
    },

    async setPreferredTranscriptionVersion(versionId: string): Promise<SetPreferredResult> {
      // Get the version to find media info
      const version = await methods.getTranscriptionVersion(versionId);
      if (!version) {
        throw new Error(`Transcription version not found: ${versionId}`);
      }

      // Clear existing preferred for same media+type
      const clearedResult = await pool.query<{ id: string }>(CLEAR_AUI_PREFERRED_TRANSCRIPTION, [
        version.mediaId,
        version.archiveId,
        version.type,
      ]);
      const previousPreferredId = clearedResult.rows[0]?.id;

      // Set new preferred
      await pool.query(SET_AUI_PREFERRED_TRANSCRIPTION, [versionId]);

      return {
        success: true,
        previousPreferredId,
        newPreferredId: versionId,
      };
    },

    async deleteTranscriptionVersion(id: string): Promise<boolean> {
      const result = await pool.query(DELETE_AUI_TRANSCRIPTION_VERSION, [id]);
      return (result.rowCount ?? 0) > 0;
    },

    async deleteTranscriptionsForMedia(mediaId: string, archiveId: string): Promise<number> {
      const result = await pool.query(DELETE_AUI_TRANSCRIPTIONS_FOR_MEDIA, [mediaId, archiveId]);
      return result.rowCount ?? 0;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STATUS UPDATES
    // ─────────────────────────────────────────────────────────────────────────

    async updateTranscriptionStatus(
      id: string,
      status: TranscriptionStatus,
      error?: string
    ): Promise<TranscriptionVersion | undefined> {
      const now = new Date();
      const result = await pool.query<DbTranscriptionVersionRow>(UPDATE_AUI_TRANSCRIPTION_STATUS, [
        id,
        status,
        status === 'processing' ? now : null,
        status === 'completed' || status === 'failed' || status === 'cancelled' ? now : null,
        null, // processing_duration_ms - calculated in query if needed
        error ?? null,
      ]);
      return result.rows[0] ? rowToTranscriptionVersion(result.rows[0]) : undefined;
    },

    async completeTranscription(
      id: string,
      text: string,
      segments: TranscriptionSegment[] | undefined,
      metrics: TranscriptionQualityMetrics
    ): Promise<TranscriptionVersion | undefined> {
      const result = await pool.query<DbTranscriptionVersionRow>(UPDATE_AUI_TRANSCRIPTION_CONTENT, [
        id,
        text,
        segments ? JSON.stringify(segments) : null,
        metrics.confidence ?? null,
        metrics.wordCount ?? null,
        metrics.segmentCount ?? segments?.length ?? null,
        metrics.language ?? null,
      ]);
      return result.rows[0] ? rowToTranscriptionVersion(result.rows[0]) : undefined;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // EMBEDDING MANAGEMENT (First-class citizen in universal content space)
    // ─────────────────────────────────────────────────────────────────────────

    async updateTranscriptionEmbedding(
      id: string,
      embedding: number[],
      model: string,
      textHash: string
    ): Promise<TranscriptionVersion | undefined> {
      // Format vector as PostgreSQL array string for pgvector
      const vectorStr = `[${embedding.join(',')}]`;
      const result = await pool.query<DbTranscriptionVersionRow>(
        UPDATE_AUI_TRANSCRIPTION_EMBEDDING,
        [id, vectorStr, model, textHash]
      );
      return result.rows[0] ? rowToTranscriptionVersion(result.rows[0]) : undefined;
    },

    async getTranscriptionsNeedingEmbedding(limit = 100): Promise<TranscriptionNeedingEmbedding[]> {
      const result = await pool.query<DbTranscriptionNeedingEmbeddingRow>(
        GET_AUI_TRANSCRIPTIONS_NEEDING_EMBEDDING,
        [limit]
      );
      return result.rows.map((row) => ({
        id: row.id,
        text: row.text,
        wordCount: row.word_count ?? undefined,
      }));
    },

    async getTranscriptionsWithStaleEmbedding(limit = 100): Promise<TranscriptionStaleEmbedding[]> {
      const result = await pool.query<DbTranscriptionStaleEmbeddingRow>(
        GET_AUI_TRANSCRIPTIONS_STALE_EMBEDDING,
        [limit]
      );
      return result.rows.map((row) => ({
        id: row.id,
        text: row.text,
        wordCount: row.word_count ?? undefined,
        embeddingTextHash: row.embedding_text_hash,
      }));
    },

    async updateSourceContext(
      id: string,
      context: TranscriptionSourceContext
    ): Promise<TranscriptionVersion | undefined> {
      const result = await pool.query<DbTranscriptionVersionRow>(
        UPDATE_AUI_TRANSCRIPTION_SOURCE_CONTEXT,
        [
          id,
          context.sourceNodeId ?? null,
          context.sourceConversationId ?? null,
          context.sourceCreatedAt ?? null,
        ]
      );
      return result.rows[0] ? rowToTranscriptionVersion(result.rows[0]) : undefined;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────

    async getTranscriptionSummary(
      mediaId: string,
      archiveId: string
    ): Promise<MediaTranscriptionSummary | undefined> {
      const result = await pool.query(GET_AUI_TRANSCRIPTION_SUMMARY, [mediaId, archiveId]);
      const row = result.rows[0] as {
        media_id: string;
        total_count: string;
        count_by_type: Record<string, number> | null;
        preferred_by_type: Record<string, string> | null;
        latest_at: Date | null;
      } | undefined;

      if (!row) {
        return undefined;
      }

      return {
        mediaId: row.media_id,
        totalCount: parseInt(row.total_count, 10),
        countByType: (row.count_by_type || {}) as Record<TranscriptionType, number>,
        preferredByType: (row.preferred_by_type || {}) as Partial<Record<TranscriptionType, string>>,
        latestAt: row.latest_at ? new Date(row.latest_at) : undefined,
      };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // JOB METHODS
    // ─────────────────────────────────────────────────────────────────────────

    async createTranscriptionJob(request: CreateTranscriptionRequest): Promise<TranscriptionJob> {
      const id = randomUUID();

      const result = await pool.query<DbTranscriptionJobRow>(INSERT_AUI_TRANSCRIPTION_JOB, [
        id,
        request.mediaId,
        request.archiveId,
        request.type,
        'pending',
        request.modelId ?? null,
        request.priority ?? 'normal',
        request.requestedBy ?? null,
      ]);

      if (!result.rows[0]) {
        throw new Error('Failed to create transcription job');
      }

      return rowToTranscriptionJob(result.rows[0]);
    },

    async getTranscriptionJob(id: string): Promise<TranscriptionJob | undefined> {
      const result = await pool.query<DbTranscriptionJobRow>(GET_AUI_TRANSCRIPTION_JOB, [id]);
      return result.rows[0] ? rowToTranscriptionJob(result.rows[0]) : undefined;
    },

    async updateTranscriptionJob(
      id: string,
      updates: Partial<TranscriptionJob>
    ): Promise<TranscriptionJob | undefined> {
      const result = await pool.query<DbTranscriptionJobRow>(UPDATE_AUI_TRANSCRIPTION_JOB, [
        id,
        updates.status ?? null,
        updates.progress ?? null,
        updates.startedAt ?? null,
        updates.completedAt ?? null,
        updates.resultVersionId ?? null,
        updates.error ?? null,
      ]);
      return result.rows[0] ? rowToTranscriptionJob(result.rows[0]) : undefined;
    },

    async getPendingTranscriptionJobs(limit = 10): Promise<TranscriptionJob[]> {
      const result = await pool.query<DbTranscriptionJobRow>(GET_AUI_PENDING_TRANSCRIPTION_JOBS, [
        limit,
      ]);
      return result.rows.map(rowToTranscriptionJob);
    },

    async getTranscriptionJobsForMedia(
      mediaId: string,
      archiveId: string
    ): Promise<TranscriptionJob[]> {
      const result = await pool.query<DbTranscriptionJobRow>(GET_AUI_TRANSCRIPTION_JOBS_FOR_MEDIA, [
        mediaId,
        archiveId,
      ]);
      return result.rows.map(rowToTranscriptionJob);
    },

    async deleteTranscriptionJob(id: string): Promise<boolean> {
      const result = await pool.query(DELETE_AUI_TRANSCRIPTION_JOB, [id]);
      return (result.rowCount ?? 0) > 0;
    },

    async cleanupCompletedTranscriptionJobs(): Promise<number> {
      const result = await pool.query(CLEANUP_AUI_COMPLETED_TRANSCRIPTION_JOBS, []);
      return result.rowCount ?? 0;
    },
  };

  return methods;
}
