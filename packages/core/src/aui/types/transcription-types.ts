/**
 * Unified AUI Types - Transcription Types
 *
 * Types for media transcription versioning system:
 * - Transcription types (audio, ocr, caption, description, manual)
 * - Transcription versions with model provenance
 * - Transcription segments with timestamps
 * - Transcription jobs for async processing
 *
 * @module @humanizer/core/aui/types/transcription-types
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════
// TRANSCRIPTION ENUMS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Types of transcriptions supported
 */
export type TranscriptionType =
  | 'audio'       // Audio transcription (Whisper, etc.)
  | 'ocr'         // Image text extraction
  | 'caption'     // Brief image/video description
  | 'description' // Detailed content description
  | 'manual';     // Human-entered transcription

/**
 * Transcription job/version status
 */
export type TranscriptionStatus =
  | 'pending'     // Requested but not started
  | 'processing'  // Currently transcribing
  | 'completed'   // Successfully completed
  | 'failed'      // Transcription failed
  | 'cancelled';  // User cancelled

/**
 * Model providers for transcription
 */
export type TranscriptionProvider =
  | 'ollama'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'cloudflare'
  | 'local';

// ═══════════════════════════════════════════════════════════════════════════
// MODEL PROVENANCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Model information for provenance tracking
 * CRITICAL: Never lose this data - it's essential for reproducibility
 */
export interface TranscriptionModelInfo {
  /** Model identifier (e.g., 'whisper-large-v3', 'llava:13b') */
  id: string;

  /** Provider name */
  provider: TranscriptionProvider;

  /** Specific version if known (e.g., 'v3', '1.5') */
  version?: string;

  /** Model variant (e.g., 'large-v3', 'turbo') */
  variant?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSCRIPTION SEGMENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Word-level timing information
 */
export interface TranscriptionWord {
  /** The word text */
  word: string;

  /** Start time in seconds */
  start: number;

  /** End time in seconds */
  end: number;

  /** Confidence score (0-1) */
  confidence?: number;
}

/**
 * A segment of transcribed content with timestamps
 * Used for audio/video transcriptions
 */
export interface TranscriptionSegment {
  /** Sequential segment ID */
  id: number;

  /** Start time in seconds */
  start: number;

  /** End time in seconds */
  end: number;

  /** Segment text */
  text: string;

  /** Segment-level confidence (0-1) */
  confidence?: number;

  /** Speaker ID if diarization is available */
  speaker?: string;

  /** Word-level timing (if available) */
  words?: TranscriptionWord[];
}

// ═══════════════════════════════════════════════════════════════════════════
// QUALITY METRICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quality metrics for a transcription
 */
export interface TranscriptionQualityMetrics {
  /** Overall confidence score (0-1) */
  confidence?: number;

  /** Total word count */
  wordCount?: number;

  /** Number of segments */
  segmentCount?: number;

  /** Detected language code (e.g., 'en', 'es', 'zh') */
  language?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSCRIPTION VERSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A complete transcription version
 * Immutable once created - versions are append-only
 */
export interface TranscriptionVersion {
  /** Unique version ID */
  id: string;

  /** Media item ID this transcription belongs to */
  mediaId: string;

  /** Archive ID for data isolation */
  archiveId: string;

  /** Type of transcription */
  type: TranscriptionType;

  /** Current status */
  status: TranscriptionStatus;

  // ─────────────────────────────────────────────────────────────────
  // CONTENT
  // ─────────────────────────────────────────────────────────────────

  /** Full transcription text */
  text?: string;

  /** Timestamped segments (for audio/video) */
  segments?: TranscriptionSegment[];

  /** Error message if failed */
  errorMessage?: string;

  // ─────────────────────────────────────────────────────────────────
  // MODEL PROVENANCE (CRITICAL)
  // ─────────────────────────────────────────────────────────────────

  /** Model information - NEVER lose this */
  model: TranscriptionModelInfo;

  // ─────────────────────────────────────────────────────────────────
  // QUALITY
  // ─────────────────────────────────────────────────────────────────

  /** Quality metrics */
  quality: TranscriptionQualityMetrics;

  // ─────────────────────────────────────────────────────────────────
  // EMBEDDING (First-Class Citizen in Universal Content Space)
  // ─────────────────────────────────────────────────────────────────

  /** Embedding vector for semantic search (stored as number[]) */
  embedding?: number[];

  /** Model that created the embedding */
  embeddingModel?: string;

  /** When the embedding was created */
  embeddingAt?: Date;

  /** Hash of text that was embedded (for staleness detection) */
  embeddingTextHash?: string;

  // ─────────────────────────────────────────────────────────────────
  // SOURCE CONTEXT (Link back to original content)
  // ─────────────────────────────────────────────────────────────────

  /** content_node ID that contains the source media */
  sourceNodeId?: string;

  /** Original conversation ID */
  sourceConversationId?: string;

  /** When the source media was originally created */
  sourceCreatedAt?: Date;

  // ─────────────────────────────────────────────────────────────────
  // VERSIONING
  // ─────────────────────────────────────────────────────────────────

  /** Version number (auto-incremented per media+type) */
  versionNumber: number;

  /** Whether this is the preferred version for display */
  isPreferred: boolean;

  /** ID of version this supersedes (if any) */
  supersedesVersionId?: string;

  // ─────────────────────────────────────────────────────────────────
  // TIMING
  // ─────────────────────────────────────────────────────────────────

  /** When transcription was requested */
  requestedAt: Date;

  /** When processing started */
  startedAt?: Date;

  /** When processing completed */
  completedAt?: Date;

  /** Processing duration in milliseconds */
  processingDurationMs?: number;

  // ─────────────────────────────────────────────────────────────────
  // AUDIT
  // ─────────────────────────────────────────────────────────────────

  /** User who requested this transcription */
  requestedBy?: string;

  /** When this record was created */
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSCRIPTION JOB
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Job priority levels
 */
export type TranscriptionPriority = 'low' | 'normal' | 'high';

/**
 * A transcription job for async processing
 */
export interface TranscriptionJob {
  /** Job ID */
  id: string;

  /** Media item ID */
  mediaId: string;

  /** Archive ID */
  archiveId: string;

  /** Transcription type to perform */
  type: TranscriptionType;

  /** Current status */
  status: TranscriptionStatus;

  /** Processing progress (0-100) */
  progress?: number;

  /** Model to use (or registry default if not specified) */
  modelId?: string;

  /** Job priority */
  priority: TranscriptionPriority;

  /** When job was queued */
  queuedAt: Date;

  /** When processing started */
  startedAt?: Date;

  /** When processing completed */
  completedAt?: Date;

  /** Resulting version ID if successful */
  resultVersionId?: string;

  /** Error message if failed */
  error?: string;

  /** User who requested */
  requestedBy?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST/RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Request to create a new transcription
 */
export interface CreateTranscriptionRequest {
  /** Media item ID */
  mediaId: string;

  /** Archive ID */
  archiveId: string;

  /** Transcription type */
  type: TranscriptionType;

  /** Specific model to use (optional, uses registry default) */
  modelId?: string;

  /** Job priority */
  priority?: TranscriptionPriority;

  /** User requesting */
  requestedBy?: string;
}

/**
 * Options for listing transcriptions
 */
export interface ListTranscriptionsOptions {
  /** Filter by media ID */
  mediaId?: string;

  /** Filter by archive ID */
  archiveId?: string;

  /** Filter by type */
  type?: TranscriptionType;

  /** Filter by status */
  status?: TranscriptionStatus;

  /** Only preferred versions */
  preferredOnly?: boolean;

  /** Maximum results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Result of setting preferred version
 */
export interface SetPreferredResult {
  /** Success flag */
  success: boolean;

  /** Previous preferred version ID (if any) */
  previousPreferredId?: string;

  /** New preferred version ID */
  newPreferredId: string;
}

/**
 * Summary of transcriptions for a media item
 */
export interface MediaTranscriptionSummary {
  /** Media item ID */
  mediaId: string;

  /** Total transcription count */
  totalCount: number;

  /** Count by type */
  countByType: Record<TranscriptionType, number>;

  /** Preferred version IDs by type */
  preferredByType: Partial<Record<TranscriptionType, string>>;

  /** Latest transcription date */
  latestAt?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// ZOD SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/** Transcription type enum schema */
export const TranscriptionTypeSchema = z.enum([
  'audio',
  'ocr',
  'caption',
  'description',
  'manual',
]);

/** Transcription status enum schema */
export const TranscriptionStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);

/** Transcription provider enum schema */
export const TranscriptionProviderSchema = z.enum([
  'ollama',
  'openai',
  'anthropic',
  'google',
  'cloudflare',
  'local',
]);

/** Transcription priority enum schema */
export const TranscriptionPrioritySchema = z.enum(['low', 'normal', 'high']);

/** Word schema */
export const TranscriptionWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
  confidence: z.number().optional(),
});

/** Segment schema */
export const TranscriptionSegmentSchema = z.object({
  id: z.number(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
  confidence: z.number().optional(),
  speaker: z.string().optional(),
  words: z.array(TranscriptionWordSchema).optional(),
});

/** Model info schema */
export const TranscriptionModelInfoSchema = z.object({
  id: z.string(),
  provider: TranscriptionProviderSchema,
  version: z.string().optional(),
  variant: z.string().optional(),
});

/** Quality metrics schema */
export const TranscriptionQualityMetricsSchema = z.object({
  confidence: z.number().optional(),
  wordCount: z.number().optional(),
  segmentCount: z.number().optional(),
  language: z.string().optional(),
});

/** Create transcription request schema */
export const CreateTranscriptionRequestSchema = z.object({
  mediaId: z.string(),
  archiveId: z.string(),
  type: TranscriptionTypeSchema,
  modelId: z.string().optional(),
  priority: TranscriptionPrioritySchema.optional(),
  requestedBy: z.string().optional(),
});

/** List transcriptions options schema */
export const ListTranscriptionsOptionsSchema = z.object({
  mediaId: z.string().optional(),
  archiveId: z.string().optional(),
  type: TranscriptionTypeSchema.optional(),
  status: TranscriptionStatusSchema.optional(),
  preferredOnly: z.boolean().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});
