/**
 * Unified AUI Service - Transcription Methods
 *
 * Media transcription service with versioning and model provenance tracking.
 * Supports audio transcription, OCR, image captions, and descriptions.
 *
 * Features:
 * - Immutable transcription versions (append-only)
 * - Model provenance tracking (never lose what generated what)
 * - Async job queue for processing
 * - Multiple versions per media item with preferred selection
 *
 * @module @humanizer/core/aui/service/transcription
 */

import type {
  TranscriptionVersion,
  TranscriptionJob,
  TranscriptionType,
  TranscriptionStatus,
  TranscriptionSegment,
  TranscriptionModelInfo,
  TranscriptionQualityMetrics,
  CreateTranscriptionRequest,
  ListTranscriptionsOptions,
  SetPreferredResult,
  MediaTranscriptionSummary,
} from '../types/transcription-types.js';
import type {
  TranscriptionStoreMethods,
  TranscriptionNeedingEmbedding,
  TranscriptionStaleEmbedding,
  TranscriptionSourceContext,
} from '../../storage/aui/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Dependencies for transcription service */
export interface TranscriptionServiceDependencies {
  store: TranscriptionStoreMethods;
}

/** Result of starting a transcription */
export interface StartTranscriptionResult {
  job: TranscriptionJob;
  versionId: string;
}

/** Transcription methods interface */
export interface TranscriptionMethods {
  // Version management
  createVersion(request: CreateTranscriptionRequest, model: TranscriptionModelInfo): Promise<TranscriptionVersion>;
  getVersion(id: string): Promise<TranscriptionVersion | undefined>;
  getVersionsForMedia(mediaId: string, archiveId: string): Promise<TranscriptionVersion[]>;
  getPreferredVersion(mediaId: string, archiveId: string, type: TranscriptionType): Promise<TranscriptionVersion | undefined>;
  listVersions(options: ListTranscriptionsOptions): Promise<TranscriptionVersion[]>;
  setPreferredVersion(versionId: string): Promise<SetPreferredResult>;
  deleteVersion(id: string): Promise<boolean>;
  deleteAllForMedia(mediaId: string, archiveId: string): Promise<number>;

  // Content updates (during processing)
  updateStatus(id: string, status: TranscriptionStatus, error?: string): Promise<TranscriptionVersion | undefined>;
  completeTranscription(id: string, text: string, segments: TranscriptionSegment[] | undefined, metrics: TranscriptionQualityMetrics): Promise<TranscriptionVersion | undefined>;

  // Embedding management (first-class citizen in universal content space)
  updateEmbedding(id: string, embedding: number[], model: string, textHash: string): Promise<TranscriptionVersion | undefined>;
  getTranscriptionsNeedingEmbedding(limit?: number): Promise<TranscriptionNeedingEmbedding[]>;
  getTranscriptionsWithStaleEmbedding(limit?: number): Promise<TranscriptionStaleEmbedding[]>;
  updateSourceContext(id: string, context: TranscriptionSourceContext): Promise<TranscriptionVersion | undefined>;

  // Summary
  getSummary(mediaId: string, archiveId: string): Promise<MediaTranscriptionSummary | undefined>;

  // Job management
  createJob(request: CreateTranscriptionRequest): Promise<TranscriptionJob>;
  getJob(id: string): Promise<TranscriptionJob | undefined>;
  updateJob(id: string, updates: Partial<TranscriptionJob>): Promise<TranscriptionJob | undefined>;
  getPendingJobs(limit?: number): Promise<TranscriptionJob[]>;
  getJobsForMedia(mediaId: string, archiveId: string): Promise<TranscriptionJob[]>;
  deleteJob(id: string): Promise<boolean>;
  cleanupOldJobs(): Promise<number>;

  // High-level operations
  startTranscription(request: CreateTranscriptionRequest, model: TranscriptionModelInfo): Promise<StartTranscriptionResult>;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create transcription methods bound to the given dependencies
 */
export function createTranscriptionMethods(
  deps: TranscriptionServiceDependencies
): TranscriptionMethods {
  const { store } = deps;

  // ─────────────────────────────────────────────────────────────────────────
  // VERSION METHODS
  // ─────────────────────────────────────────────────────────────────────────

  async function createVersion(
    request: CreateTranscriptionRequest,
    model: TranscriptionModelInfo
  ): Promise<TranscriptionVersion> {
    return store.createTranscriptionVersion(request, model);
  }

  async function getVersion(id: string): Promise<TranscriptionVersion | undefined> {
    return store.getTranscriptionVersion(id);
  }

  async function getVersionsForMedia(
    mediaId: string,
    archiveId: string
  ): Promise<TranscriptionVersion[]> {
    return store.getTranscriptionVersionsForMedia(mediaId, archiveId);
  }

  async function getPreferredVersion(
    mediaId: string,
    archiveId: string,
    type: TranscriptionType
  ): Promise<TranscriptionVersion | undefined> {
    return store.getPreferredTranscription(mediaId, archiveId, type);
  }

  async function listVersions(options: ListTranscriptionsOptions): Promise<TranscriptionVersion[]> {
    return store.listTranscriptionVersions(options);
  }

  async function setPreferredVersion(versionId: string): Promise<SetPreferredResult> {
    return store.setPreferredTranscriptionVersion(versionId);
  }

  async function deleteVersion(id: string): Promise<boolean> {
    return store.deleteTranscriptionVersion(id);
  }

  async function deleteAllForMedia(mediaId: string, archiveId: string): Promise<number> {
    return store.deleteTranscriptionsForMedia(mediaId, archiveId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATUS UPDATES
  // ─────────────────────────────────────────────────────────────────────────

  async function updateStatus(
    id: string,
    status: TranscriptionStatus,
    error?: string
  ): Promise<TranscriptionVersion | undefined> {
    return store.updateTranscriptionStatus(id, status, error);
  }

  async function completeTranscription(
    id: string,
    text: string,
    segments: TranscriptionSegment[] | undefined,
    metrics: TranscriptionQualityMetrics
  ): Promise<TranscriptionVersion | undefined> {
    return store.completeTranscription(id, text, segments, metrics);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EMBEDDING MANAGEMENT (First-class citizen in universal content space)
  // ─────────────────────────────────────────────────────────────────────────

  async function updateEmbedding(
    id: string,
    embedding: number[],
    model: string,
    textHash: string
  ): Promise<TranscriptionVersion | undefined> {
    return store.updateTranscriptionEmbedding(id, embedding, model, textHash);
  }

  async function getTranscriptionsNeedingEmbedding(
    limit = 100
  ): Promise<TranscriptionNeedingEmbedding[]> {
    return store.getTranscriptionsNeedingEmbedding(limit);
  }

  async function getTranscriptionsWithStaleEmbedding(
    limit = 100
  ): Promise<TranscriptionStaleEmbedding[]> {
    return store.getTranscriptionsWithStaleEmbedding(limit);
  }

  async function updateSourceContext(
    id: string,
    context: TranscriptionSourceContext
  ): Promise<TranscriptionVersion | undefined> {
    return store.updateSourceContext(id, context);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────

  async function getSummary(
    mediaId: string,
    archiveId: string
  ): Promise<MediaTranscriptionSummary | undefined> {
    return store.getTranscriptionSummary(mediaId, archiveId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // JOB METHODS
  // ─────────────────────────────────────────────────────────────────────────

  async function createJob(request: CreateTranscriptionRequest): Promise<TranscriptionJob> {
    return store.createTranscriptionJob(request);
  }

  async function getJob(id: string): Promise<TranscriptionJob | undefined> {
    return store.getTranscriptionJob(id);
  }

  async function updateJob(
    id: string,
    updates: Partial<TranscriptionJob>
  ): Promise<TranscriptionJob | undefined> {
    return store.updateTranscriptionJob(id, updates);
  }

  async function getPendingJobs(limit = 10): Promise<TranscriptionJob[]> {
    return store.getPendingTranscriptionJobs(limit);
  }

  async function getJobsForMedia(mediaId: string, archiveId: string): Promise<TranscriptionJob[]> {
    return store.getTranscriptionJobsForMedia(mediaId, archiveId);
  }

  async function deleteJob(id: string): Promise<boolean> {
    return store.deleteTranscriptionJob(id);
  }

  async function cleanupOldJobs(): Promise<number> {
    return store.cleanupCompletedTranscriptionJobs();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HIGH-LEVEL OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  async function startTranscription(
    request: CreateTranscriptionRequest,
    model: TranscriptionModelInfo
  ): Promise<StartTranscriptionResult> {
    // Create version record (pending)
    const version = await createVersion(request, model);

    // Create job record
    const job = await createJob({
      ...request,
      modelId: model.id,
    });

    return {
      job,
      versionId: version.id,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RETURN METHODS
  // ─────────────────────────────────────────────────────────────────────────

  return {
    // Version management
    createVersion,
    getVersion,
    getVersionsForMedia,
    getPreferredVersion,
    listVersions,
    setPreferredVersion,
    deleteVersion,
    deleteAllForMedia,

    // Content updates
    updateStatus,
    completeTranscription,

    // Embedding management (first-class citizen in universal content space)
    updateEmbedding,
    getTranscriptionsNeedingEmbedding,
    getTranscriptionsWithStaleEmbedding,
    updateSourceContext,

    // Summary
    getSummary,

    // Job management
    createJob,
    getJob,
    updateJob,
    getPendingJobs,
    getJobsForMedia,
    deleteJob,
    cleanupOldJobs,

    // High-level
    startTranscription,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON PATTERN
// ═══════════════════════════════════════════════════════════════════════════

let transcriptionMethods: TranscriptionMethods | null = null;

/**
 * Initialize the transcription service singleton
 */
export function initTranscriptionMethods(deps: TranscriptionServiceDependencies): TranscriptionMethods {
  transcriptionMethods = createTranscriptionMethods(deps);
  return transcriptionMethods;
}

/**
 * Get the transcription service singleton
 * @throws Error if not initialized
 */
export function getTranscriptionMethods(): TranscriptionMethods {
  if (!transcriptionMethods) {
    throw new Error('Transcription service not initialized. Call initTranscriptionMethods first.');
  }
  return transcriptionMethods;
}

/**
 * Reset the transcription service singleton (for testing)
 */
export function resetTranscriptionMethods(): void {
  transcriptionMethods = null;
}
