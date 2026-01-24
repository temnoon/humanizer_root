/**
 * AUI PostgreSQL Store
 *
 * Persistent storage for AUI sessions, buffers, books, clusters, and artifacts.
 * Implements write-through + lazy loading pattern.
 *
 * @module @humanizer/core/storage/aui-postgres-store
 */

import { randomUUID } from 'crypto';
import type { Pool, PoolClient } from 'pg';
import { toSql, fromSql } from 'pgvector';
import type {
  UnifiedAuiSession,
  VersionedBuffer,
  BufferVersion,
  BufferBranch,
  AgentTask,
  Book,
  BookChapter,
  ContentCluster,
  NarrativeArc,
  SessionMetadata,
} from '../aui/types.js';
import {
  INSERT_AUI_SESSION,
  GET_AUI_SESSION,
  UPDATE_AUI_SESSION,
  DELETE_AUI_SESSION,
  LIST_AUI_SESSIONS,
  TOUCH_AUI_SESSION,
  CLEANUP_EXPIRED_SESSIONS,
  INSERT_AUI_BUFFER,
  GET_AUI_BUFFER,
  GET_AUI_BUFFER_BY_NAME,
  UPDATE_AUI_BUFFER,
  DELETE_AUI_BUFFER,
  LIST_AUI_BUFFERS,
  INSERT_AUI_BRANCH,
  GET_AUI_BRANCH,
  UPDATE_AUI_BRANCH,
  DELETE_AUI_BRANCH,
  LIST_AUI_BRANCHES,
  INSERT_AUI_VERSION,
  GET_AUI_VERSION,
  GET_AUI_VERSION_HISTORY,
  PRUNE_AUI_VERSIONS,
  INSERT_AUI_TASK,
  GET_AUI_TASK,
  UPDATE_AUI_TASK,
  GET_AUI_TASK_HISTORY,
  INSERT_AUI_BOOK,
  GET_AUI_BOOK,
  UPDATE_AUI_BOOK,
  DELETE_AUI_BOOK,
  LIST_AUI_BOOKS,
  INSERT_AUI_CHAPTER,
  GET_AUI_CHAPTERS,
  UPDATE_AUI_CHAPTER,
  DELETE_AUI_CHAPTER,
  INSERT_AUI_CLUSTER,
  GET_AUI_CLUSTER,
  LIST_AUI_CLUSTERS,
  FIND_SIMILAR_CLUSTERS,
  DELETE_AUI_CLUSTER,
  CLEANUP_EXPIRED_CLUSTERS,
  INSERT_AUI_ARTIFACT,
  GET_AUI_ARTIFACT,
  LIST_AUI_ARTIFACTS,
  UPDATE_AUI_ARTIFACT_DOWNLOAD,
  DELETE_AUI_ARTIFACT,
  CLEANUP_EXPIRED_ARTIFACTS,
  INSERT_AUI_PERSONA_PROFILE,
  GET_AUI_PERSONA_PROFILE,
  GET_AUI_PERSONA_PROFILE_BY_NAME,
  GET_AUI_DEFAULT_PERSONA_PROFILE,
  UPDATE_AUI_PERSONA_PROFILE,
  DELETE_AUI_PERSONA_PROFILE,
  LIST_AUI_PERSONA_PROFILES,
  CLEAR_DEFAULT_PERSONA_PROFILE,
} from './schema-aui.js';

// ═══════════════════════════════════════════════════════════════════
// DB ROW TYPES
// ═══════════════════════════════════════════════════════════════════

interface DbSessionRow {
  id: string;
  user_id: string | null;
  name: string | null;
  active_buffer_name: string | null;
  search_session_id: string | null;
  command_history: string[];
  variables: Record<string, unknown>;
  metadata: SessionMetadata;
  created_at: Date;
  updated_at: Date;
  expires_at: Date | null;
  last_accessed_at: Date | null;
}

interface DbBufferRow {
  id: string;
  session_id: string;
  name: string;
  current_branch: string;
  working_content: unknown[];
  is_dirty: boolean;
  schema: unknown | null;
  created_at: Date;
  updated_at: Date;
}

interface DbBranchRow {
  id: string;
  buffer_id: string;
  name: string;
  head_version_id: string | null;
  parent_branch: string | null;
  description: string | null;
  created_at: Date;
}

interface DbVersionRow {
  id: string;
  buffer_id: string;
  content: unknown[];
  message: string;
  parent_id: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: Date;
}

interface DbTaskRow {
  id: string;
  session_id: string | null;
  request: string;
  status: string;
  steps: unknown[];
  plan: unknown[] | null;
  result: unknown | null;
  error: string | null;
  priority: number;
  total_tokens: number;
  total_cost_cents: number;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
}

interface DbBookRow {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  arc: NarrativeArc | null;
  status: string;
  source_cluster_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface DbChapterRow {
  id: string;
  book_id: string;
  title: string;
  content: string;
  position: number;
  word_count: number;
  passage_ids: string[];
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface DbClusterRow {
  id: string;
  user_id: string | null;
  label: string;
  description: string | null;
  passages: unknown[];
  total_passages: number;
  coherence: number | null;
  keywords: string[];
  source_distribution: Record<string, number>;
  date_range: { earliest: string | null; latest: string | null } | null;
  avg_word_count: number | null;
  centroid: string | number[] | null;
  discovery_options: unknown | null;
  created_at: Date;
  expires_at: Date | null;
}

interface DbArtifactRow {
  id: string;
  user_id: string | null;
  name: string;
  artifact_type: string;
  content: string | null;
  content_binary: Buffer | null;
  mime_type: string;
  size_bytes: number | null;
  source_type: string | null;
  source_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  expires_at: Date | null;
  download_count: number;
  last_downloaded_at: Date | null;
}

interface DbPersonaProfileRow {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  voice_traits: string[];
  tone_markers: string[];
  formality_min: number;
  formality_max: number;
  style_guide: StyleGuide;
  reference_examples: string[];
  voice_fingerprint: VoiceFingerprint | null;
  is_default: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

// ═══════════════════════════════════════════════════════════════════
// ARTIFACT TYPES
// ═══════════════════════════════════════════════════════════════════

export interface AuiArtifact {
  id: string;
  userId?: string;
  name: string;
  artifactType: 'markdown' | 'pdf' | 'epub' | 'html' | 'json' | 'zip';
  content?: string;
  contentBinary?: Buffer;
  mimeType: string;
  sizeBytes?: number;
  sourceType?: string;
  sourceId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
  downloadCount: number;
  lastDownloadedAt?: Date;
}

export interface CreateArtifactOptions {
  userId?: string;
  name: string;
  artifactType: AuiArtifact['artifactType'];
  content?: string;
  contentBinary?: Buffer;
  mimeType: string;
  sourceType?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

// ═══════════════════════════════════════════════════════════════════
// PERSONA PROFILE TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Style guide for persona-consistent writing
 */
export interface StyleGuide {
  /** Phrases that should never appear in generated text */
  forbiddenPhrases: string[];
  /** Preferred patterns to use naturally */
  preferredPatterns: string[];
  /** Sentence variety level */
  sentenceVariety: 'low' | 'medium' | 'high';
  /** Paragraph length style */
  paragraphStyle: 'short' | 'medium' | 'long';
  /** Whether to use contractions */
  useContractions: boolean;
  /** Whether to use rhetorical questions */
  useRhetoricalQuestions: boolean;
}

/**
 * Quantitative voice fingerprint extracted from reference examples
 */
export interface VoiceFingerprint {
  /** Average sentence length in words */
  avgSentenceLength: number;
  /** Sentence length variance */
  sentenceLengthVariance: number;
  /** Contraction frequency (0-1) */
  contractionFrequency: number;
  /** Question frequency (0-1) */
  questionFrequency: number;
  /** First person frequency (0-1) */
  firstPersonFrequency: number;
  /** Common n-grams with frequency */
  commonPhrases: Array<{ phrase: string; frequency: number }>;
  /** Vocabulary richness score (0-1) */
  vocabularyRichness: number;
  /** Embedding of combined reference examples */
  referenceEmbedding?: number[];
}

/**
 * Persona profile for voice-consistent book creation
 */
export interface PersonaProfile {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  /** Voice characteristics */
  voiceTraits: string[];
  /** Tone markers */
  toneMarkers: string[];
  /** Formality range (0=casual, 1=formal) */
  formalityRange: [number, number];
  /** Writing style guide */
  styleGuide: StyleGuide;
  /** Reference examples demonstrating the voice */
  referenceExamples: string[];
  /** Quantitative voice fingerprint */
  voiceFingerprint?: VoiceFingerprint;
  /** Whether this is the user's default persona */
  isDefault: boolean;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePersonaProfileOptions {
  userId?: string;
  name: string;
  description?: string;
  voiceTraits?: string[];
  toneMarkers?: string[];
  formalityRange?: [number, number];
  styleGuide?: Partial<StyleGuide>;
  referenceExamples?: string[];
  voiceFingerprint?: VoiceFingerprint;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// STORE OPTIONS
// ═══════════════════════════════════════════════════════════════════

export interface AuiPostgresStoreOptions {
  /** Maximum version history to keep per buffer */
  maxVersionHistory?: number;
  /** Session expiration time in ms (default: 7 days) */
  sessionExpirationMs?: number;
  /** Cluster cache expiration in days (default: 30) */
  clusterCacheDays?: number;
  /** Artifact expiration in days (default: 7) */
  artifactExpirationDays?: number;
}

const DEFAULT_OPTIONS: Required<AuiPostgresStoreOptions> = {
  maxVersionHistory: 100,
  sessionExpirationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  clusterCacheDays: 30,
  artifactExpirationDays: 7,
};

// ═══════════════════════════════════════════════════════════════════
// AUI POSTGRES STORE
// ═══════════════════════════════════════════════════════════════════

/**
 * PostgreSQL store for AUI persistent storage
 */
export class AuiPostgresStore {
  private pool: Pool;
  private options: Required<AuiPostgresStoreOptions>;

  constructor(pool: Pool, options: AuiPostgresStoreOptions = {}) {
    this.pool = pool;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ═══════════════════════════════════════════════════════════════════
  // SESSIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a new session
   */
  async createSession(options?: {
    id?: string;
    userId?: string;
    name?: string;
  }): Promise<UnifiedAuiSession> {
    const now = new Date();
    const id = options?.id || randomUUID();
    const expiresAt = new Date(now.getTime() + this.options.sessionExpirationMs);

    const result = await this.pool.query(INSERT_AUI_SESSION, [
      id,
      options?.userId ?? null,
      options?.name ?? null,
      null, // active_buffer_name
      null, // search_session_id
      [], // command_history
      {}, // variables
      { commandCount: 0, searchCount: 0, taskCount: 0 }, // metadata
      now,
      now,
      expiresAt,
    ]);

    return this.rowToSession(result.rows[0] as DbSessionRow);
  }

  /**
   * Get a session by ID
   */
  async getSession(id: string): Promise<UnifiedAuiSession | undefined> {
    const result = await this.pool.query(GET_AUI_SESSION, [id]);
    if (result.rows.length === 0) return undefined;

    const row = result.rows[0] as DbSessionRow;
    if (row.expires_at && row.expires_at < new Date()) {
      await this.deleteSession(id);
      return undefined;
    }

    return this.rowToSession(row);
  }

  /**
   * Update a session
   */
  async updateSession(
    id: string,
    update: Partial<{
      name: string;
      activeBufferName: string;
      searchSessionId: string;
      commandHistory: string[];
      variables: Record<string, unknown>;
      metadata: SessionMetadata;
      expiresAt: Date;
    }>
  ): Promise<UnifiedAuiSession | undefined> {
    const result = await this.pool.query(UPDATE_AUI_SESSION, [
      id,
      update.name ?? null,
      update.activeBufferName ?? null,
      update.searchSessionId ?? null,
      update.commandHistory ?? null,
      update.variables ? JSON.stringify(update.variables) : null,
      update.metadata ? JSON.stringify(update.metadata) : null,
      update.expiresAt ?? null,
    ]);

    if (result.rows.length === 0) return undefined;
    return this.rowToSession(result.rows[0] as DbSessionRow);
  }

  /**
   * Delete a session
   */
  async deleteSession(id: string): Promise<boolean> {
    const result = await this.pool.query(DELETE_AUI_SESSION, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * List sessions
   */
  async listSessions(options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<UnifiedAuiSession[]> {
    const result = await this.pool.query(LIST_AUI_SESSIONS, [
      options?.userId ?? null,
      options?.limit ?? 100,
      options?.offset ?? 0,
    ]);

    return result.rows.map((row) => this.rowToSession(row as DbSessionRow));
  }

  /**
   * Touch a session (update last accessed time)
   */
  async touchSession(id: string): Promise<void> {
    await this.pool.query(TOUCH_AUI_SESSION, [id]);
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.pool.query(CLEANUP_EXPIRED_SESSIONS);
    return result.rowCount ?? 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUFFERS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a buffer
   */
  async createBuffer(
    sessionId: string,
    name: string,
    content?: unknown[]
  ): Promise<VersionedBuffer> {
    const now = new Date();
    const id = randomUUID();

    const result = await this.pool.query(INSERT_AUI_BUFFER, [
      id,
      sessionId,
      name,
      'main', // current_branch
      JSON.stringify(content ?? []),
      false, // is_dirty
      null, // schema
      now,
      now,
    ]);

    const bufferRow = result.rows[0] as DbBufferRow;

    // Create default 'main' branch
    await this.createBranch(id, 'main');

    return this.rowToBuffer(bufferRow);
  }

  /**
   * Get a buffer by ID
   */
  async getBuffer(id: string): Promise<VersionedBuffer | undefined> {
    const result = await this.pool.query(GET_AUI_BUFFER, [id]);
    if (result.rows.length === 0) return undefined;
    return this.rowToBuffer(result.rows[0] as DbBufferRow);
  }

  /**
   * Get a buffer by session ID and name
   */
  async getBufferByName(
    sessionId: string,
    name: string
  ): Promise<VersionedBuffer | undefined> {
    const result = await this.pool.query(GET_AUI_BUFFER_BY_NAME, [sessionId, name]);
    if (result.rows.length === 0) return undefined;
    return this.rowToBuffer(result.rows[0] as DbBufferRow);
  }

  /**
   * Update a buffer
   */
  async updateBuffer(
    id: string,
    update: Partial<{
      currentBranch: string;
      workingContent: unknown[];
      isDirty: boolean;
      schema: unknown;
    }>
  ): Promise<VersionedBuffer | undefined> {
    const result = await this.pool.query(UPDATE_AUI_BUFFER, [
      id,
      update.currentBranch ?? null,
      update.workingContent ? JSON.stringify(update.workingContent) : null,
      update.isDirty ?? null,
      update.schema ? JSON.stringify(update.schema) : null,
    ]);

    if (result.rows.length === 0) return undefined;
    return this.rowToBuffer(result.rows[0] as DbBufferRow);
  }

  /**
   * Delete a buffer
   */
  async deleteBuffer(id: string): Promise<boolean> {
    const result = await this.pool.query(DELETE_AUI_BUFFER, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * List buffers for a session
   */
  async listBuffers(sessionId: string): Promise<VersionedBuffer[]> {
    const result = await this.pool.query(LIST_AUI_BUFFERS, [sessionId]);
    return result.rows.map((row) => this.rowToBuffer(row as DbBufferRow));
  }

  // ═══════════════════════════════════════════════════════════════════
  // BRANCHES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a branch
   */
  async createBranch(
    bufferId: string,
    name: string,
    options?: {
      headVersionId?: string;
      parentBranch?: string;
      description?: string;
    }
  ): Promise<BufferBranch> {
    const now = new Date();
    const id = randomUUID();

    const result = await this.pool.query(INSERT_AUI_BRANCH, [
      id,
      bufferId,
      name,
      options?.headVersionId ?? null,
      options?.parentBranch ?? null,
      options?.description ?? null,
      now,
    ]);

    return this.rowToBranch(result.rows[0] as DbBranchRow);
  }

  /**
   * Get a branch
   */
  async getBranch(bufferId: string, name: string): Promise<BufferBranch | undefined> {
    const result = await this.pool.query(GET_AUI_BRANCH, [bufferId, name]);
    if (result.rows.length === 0) return undefined;
    return this.rowToBranch(result.rows[0] as DbBranchRow);
  }

  /**
   * Update a branch
   */
  async updateBranch(
    bufferId: string,
    name: string,
    update: Partial<{
      headVersionId: string;
      description: string;
    }>
  ): Promise<BufferBranch | undefined> {
    const result = await this.pool.query(UPDATE_AUI_BRANCH, [
      bufferId,
      name,
      update.headVersionId ?? null,
      update.description ?? null,
    ]);

    if (result.rows.length === 0) return undefined;
    return this.rowToBranch(result.rows[0] as DbBranchRow);
  }

  /**
   * Delete a branch
   */
  async deleteBranch(bufferId: string, name: string): Promise<boolean> {
    const result = await this.pool.query(DELETE_AUI_BRANCH, [bufferId, name]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * List branches for a buffer
   */
  async listBranches(bufferId: string): Promise<BufferBranch[]> {
    const result = await this.pool.query(LIST_AUI_BRANCHES, [bufferId]);
    return result.rows.map((row) => this.rowToBranch(row as DbBranchRow));
  }

  // ═══════════════════════════════════════════════════════════════════
  // VERSIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a version (commit)
   */
  async createVersion(
    bufferId: string,
    version: {
      id: string;
      content: unknown[];
      message: string;
      parentId?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<BufferVersion> {
    const now = new Date();

    const result = await this.pool.query(INSERT_AUI_VERSION, [
      version.id,
      bufferId,
      JSON.stringify(version.content),
      version.message,
      version.parentId ?? null,
      version.tags ?? [],
      JSON.stringify(version.metadata ?? {}),
      now,
    ]);

    return this.rowToVersion(result.rows[0] as DbVersionRow);
  }

  /**
   * Get a version by ID
   */
  async getVersion(id: string): Promise<BufferVersion | undefined> {
    const result = await this.pool.query(GET_AUI_VERSION, [id]);
    if (result.rows.length === 0) return undefined;
    return this.rowToVersion(result.rows[0] as DbVersionRow);
  }

  /**
   * Get version history for a buffer
   */
  async getVersionHistory(bufferId: string, limit?: number): Promise<BufferVersion[]> {
    const result = await this.pool.query(GET_AUI_VERSION_HISTORY, [
      bufferId,
      limit ?? this.options.maxVersionHistory,
    ]);
    return result.rows.map((row) => this.rowToVersion(row as DbVersionRow));
  }

  /**
   * Prune old versions, keeping only the most recent
   */
  async pruneVersions(bufferId: string, keep?: number): Promise<number> {
    const result = await this.pool.query(PRUNE_AUI_VERSIONS, [
      bufferId,
      keep ?? this.options.maxVersionHistory,
    ]);
    return result.rowCount ?? 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  // TASKS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a task
   */
  async createTask(
    sessionId: string,
    task: Omit<AgentTask, 'id' | 'context'>
  ): Promise<AgentTask> {
    const now = new Date();
    const id = randomUUID();

    const result = await this.pool.query(INSERT_AUI_TASK, [
      id,
      sessionId,
      task.request,
      task.status,
      JSON.stringify(task.steps),
      task.plan ? JSON.stringify(task.plan) : null,
      task.result ? JSON.stringify(task.result) : null,
      task.error ?? null,
      task.priority,
      task.totalTokens,
      task.totalCostCents,
      new Date(task.startedAt),
      task.completedAt ? new Date(task.completedAt) : null,
      now,
    ]);

    return this.rowToTask(result.rows[0] as DbTaskRow);
  }

  /**
   * Get a task by ID
   */
  async getTask(id: string): Promise<AgentTask | undefined> {
    const result = await this.pool.query(GET_AUI_TASK, [id]);
    if (result.rows.length === 0) return undefined;
    return this.rowToTask(result.rows[0] as DbTaskRow);
  }

  /**
   * Update a task
   */
  async updateTask(
    id: string,
    update: Partial<{
      status: AgentTask['status'];
      steps: AgentTask['steps'];
      plan: AgentTask['plan'];
      result: unknown;
      error: string;
      totalTokens: number;
      totalCostCents: number;
      completedAt: number;
    }>
  ): Promise<AgentTask | undefined> {
    const result = await this.pool.query(UPDATE_AUI_TASK, [
      id,
      update.status ?? null,
      update.steps ? JSON.stringify(update.steps) : null,
      update.plan ? JSON.stringify(update.plan) : null,
      update.result ? JSON.stringify(update.result) : null,
      update.error ?? null,
      update.totalTokens ?? null,
      update.totalCostCents ?? null,
      update.completedAt ? new Date(update.completedAt) : null,
    ]);

    if (result.rows.length === 0) return undefined;
    return this.rowToTask(result.rows[0] as DbTaskRow);
  }

  /**
   * Get task history for a session
   */
  async getTaskHistory(sessionId: string, limit?: number): Promise<AgentTask[]> {
    const result = await this.pool.query(GET_AUI_TASK_HISTORY, [
      sessionId,
      limit ?? 50,
    ]);
    return result.rows.map((row) => this.rowToTask(row as DbTaskRow));
  }

  // ═══════════════════════════════════════════════════════════════════
  // BOOKS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a book
   */
  async createBook(book: Omit<Book, 'id'>): Promise<Book> {
    const now = new Date();
    const id = randomUUID();

    const result = await this.pool.query(INSERT_AUI_BOOK, [
      id,
      (book as Book & { userId?: string }).userId ?? null,
      book.title,
      book.description ?? null,
      book.arc ? JSON.stringify(book.arc) : null,
      book.status,
      book.sourceClusterId ?? null,
      JSON.stringify(book.metadata ?? {}),
      now,
      now,
    ]);

    const bookRow = result.rows[0] as DbBookRow;

    // Create chapters
    for (const chapter of book.chapters) {
      await this.createChapter(id, chapter);
    }

    return this.rowToBook(bookRow, book.chapters);
  }

  /**
   * Get a book by ID
   */
  async getBook(id: string): Promise<Book | undefined> {
    const result = await this.pool.query(GET_AUI_BOOK, [id]);
    if (result.rows.length === 0) return undefined;

    const chapters = await this.getChapters(id);
    return this.rowToBook(result.rows[0] as DbBookRow, chapters);
  }

  /**
   * Update a book
   */
  async updateBook(
    id: string,
    update: Partial<{
      title: string;
      description: string;
      arc: NarrativeArc;
      status: Book['status'];
      metadata: Record<string, unknown>;
    }>
  ): Promise<Book | undefined> {
    const result = await this.pool.query(UPDATE_AUI_BOOK, [
      id,
      update.title ?? null,
      update.description ?? null,
      update.arc ? JSON.stringify(update.arc) : null,
      update.status ?? null,
      update.metadata ? JSON.stringify(update.metadata) : null,
    ]);

    if (result.rows.length === 0) return undefined;

    const chapters = await this.getChapters(id);
    return this.rowToBook(result.rows[0] as DbBookRow, chapters);
  }

  /**
   * Delete a book
   */
  async deleteBook(id: string): Promise<boolean> {
    const result = await this.pool.query(DELETE_AUI_BOOK, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * List books
   */
  async listBooks(options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Book[]> {
    const result = await this.pool.query(LIST_AUI_BOOKS, [
      options?.userId ?? null,
      options?.limit ?? 100,
      options?.offset ?? 0,
    ]);

    const books: Book[] = [];
    for (const row of result.rows) {
      const chapters = await this.getChapters((row as DbBookRow).id);
      books.push(this.rowToBook(row as DbBookRow, chapters));
    }
    return books;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CHAPTERS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a chapter
   */
  async createChapter(
    bookId: string,
    chapter: BookChapter
  ): Promise<BookChapter> {
    const now = new Date();
    const id = chapter.id || randomUUID();

    const result = await this.pool.query(INSERT_AUI_CHAPTER, [
      id,
      bookId,
      chapter.title,
      chapter.content,
      chapter.position,
      chapter.wordCount,
      chapter.passageIds,
      JSON.stringify({}),
      now,
      now,
    ]);

    return this.rowToChapter(result.rows[0] as DbChapterRow);
  }

  /**
   * Get chapters for a book
   */
  async getChapters(bookId: string): Promise<BookChapter[]> {
    const result = await this.pool.query(GET_AUI_CHAPTERS, [bookId]);
    return result.rows.map((row) => this.rowToChapter(row as DbChapterRow));
  }

  /**
   * Update a chapter
   */
  async updateChapter(
    id: string,
    update: Partial<{
      title: string;
      content: string;
      position: number;
      wordCount: number;
      passageIds: string[];
      metadata: Record<string, unknown>;
    }>
  ): Promise<BookChapter | undefined> {
    const result = await this.pool.query(UPDATE_AUI_CHAPTER, [
      id,
      update.title ?? null,
      update.content ?? null,
      update.position ?? null,
      update.wordCount ?? null,
      update.passageIds ?? null,
      update.metadata ? JSON.stringify(update.metadata) : null,
    ]);

    if (result.rows.length === 0) return undefined;
    return this.rowToChapter(result.rows[0] as DbChapterRow);
  }

  /**
   * Delete a chapter
   */
  async deleteChapter(id: string): Promise<boolean> {
    const result = await this.pool.query(DELETE_AUI_CHAPTER, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CLUSTERS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Save a cluster (upsert)
   */
  async saveCluster(cluster: ContentCluster, userId?: string): Promise<ContentCluster> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.options.clusterCacheDays * 24 * 60 * 60 * 1000
    );

    let centroidSql: string | null = null;
    if (cluster.centroid && cluster.centroid.length > 0) {
      centroidSql = toSql(cluster.centroid);
    }

    const result = await this.pool.query(INSERT_AUI_CLUSTER, [
      cluster.id,
      userId ?? null,
      cluster.label,
      cluster.description ?? null,
      JSON.stringify(cluster.passages),
      cluster.totalPassages,
      cluster.coherence ?? null,
      cluster.keywords,
      JSON.stringify(cluster.sourceDistribution),
      cluster.dateRange
        ? JSON.stringify({
            earliest: cluster.dateRange.earliest?.toISOString() ?? null,
            latest: cluster.dateRange.latest?.toISOString() ?? null,
          })
        : null,
      cluster.avgWordCount ?? null,
      centroidSql,
      null, // discovery_options
      now,
      expiresAt,
    ]);

    return this.rowToCluster(result.rows[0] as DbClusterRow);
  }

  /**
   * Get a cluster by ID
   */
  async getCluster(id: string): Promise<ContentCluster | undefined> {
    const result = await this.pool.query(GET_AUI_CLUSTER, [id]);
    if (result.rows.length === 0) return undefined;

    const row = result.rows[0] as DbClusterRow;
    if (row.expires_at && row.expires_at < new Date()) {
      await this.deleteCluster(id);
      return undefined;
    }

    return this.rowToCluster(row);
  }

  /**
   * List clusters
   */
  async listClusters(options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ContentCluster[]> {
    const result = await this.pool.query(LIST_AUI_CLUSTERS, [
      options?.userId ?? null,
      options?.limit ?? 100,
      options?.offset ?? 0,
    ]);

    return result.rows.map((row) => this.rowToCluster(row as DbClusterRow));
  }

  /**
   * Find similar clusters by centroid embedding
   */
  async findSimilarClusters(
    embedding: number[],
    limit?: number
  ): Promise<Array<ContentCluster & { similarity: number }>> {
    const vectorSql = toSql(embedding);
    const result = await this.pool.query(FIND_SIMILAR_CLUSTERS, [
      vectorSql,
      limit ?? 10,
    ]);

    return result.rows.map((row) => ({
      ...this.rowToCluster(row as DbClusterRow),
      similarity: (row as DbClusterRow & { similarity: number }).similarity,
    }));
  }

  /**
   * Delete a cluster
   */
  async deleteCluster(id: string): Promise<boolean> {
    const result = await this.pool.query(DELETE_AUI_CLUSTER, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Clean up expired clusters
   */
  async cleanupExpiredClusters(): Promise<number> {
    const result = await this.pool.query(CLEANUP_EXPIRED_CLUSTERS);
    return result.rowCount ?? 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  // ARTIFACTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create an artifact
   */
  async createArtifact(options: CreateArtifactOptions): Promise<AuiArtifact> {
    const now = new Date();
    const id = randomUUID();
    const sizeBytes =
      options.content?.length ?? options.contentBinary?.length ?? 0;
    const expiresAt =
      options.expiresAt ??
      new Date(
        now.getTime() + this.options.artifactExpirationDays * 24 * 60 * 60 * 1000
      );

    const result = await this.pool.query(INSERT_AUI_ARTIFACT, [
      id,
      options.userId ?? null,
      options.name,
      options.artifactType,
      options.content ?? null,
      options.contentBinary ?? null,
      options.mimeType,
      sizeBytes,
      options.sourceType ?? null,
      options.sourceId ?? null,
      JSON.stringify(options.metadata ?? {}),
      now,
      expiresAt,
    ]);

    return this.rowToArtifact(result.rows[0] as DbArtifactRow);
  }

  /**
   * Get an artifact by ID
   */
  async getArtifact(id: string): Promise<AuiArtifact | undefined> {
    const result = await this.pool.query(GET_AUI_ARTIFACT, [id]);
    if (result.rows.length === 0) return undefined;

    const row = result.rows[0] as DbArtifactRow;
    if (row.expires_at && row.expires_at < new Date()) {
      await this.deleteArtifact(id);
      return undefined;
    }

    return this.rowToArtifact(row);
  }

  /**
   * List artifacts (without content for efficiency)
   */
  async listArtifacts(options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Omit<AuiArtifact, 'content' | 'contentBinary'>[]> {
    const result = await this.pool.query(LIST_AUI_ARTIFACTS, [
      options?.userId ?? null,
      options?.limit ?? 100,
      options?.offset ?? 0,
    ]);

    return result.rows.map((row) => {
      const artifact = this.rowToArtifact(row as DbArtifactRow);
      const { content, contentBinary, ...rest } = artifact;
      return rest;
    });
  }

  /**
   * Export an artifact (get with content and increment download count)
   */
  async exportArtifact(id: string): Promise<AuiArtifact | undefined> {
    const artifact = await this.getArtifact(id);
    if (!artifact) return undefined;

    await this.pool.query(UPDATE_AUI_ARTIFACT_DOWNLOAD, [id]);
    artifact.downloadCount++;
    artifact.lastDownloadedAt = new Date();

    return artifact;
  }

  /**
   * Delete an artifact
   */
  async deleteArtifact(id: string): Promise<boolean> {
    const result = await this.pool.query(DELETE_AUI_ARTIFACT, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Clean up expired artifacts
   */
  async cleanupExpiredArtifacts(): Promise<number> {
    const result = await this.pool.query(CLEANUP_EXPIRED_ARTIFACTS);
    return result.rowCount ?? 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  // PERSONA PROFILES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a persona profile
   */
  async createPersonaProfile(options: CreatePersonaProfileOptions): Promise<PersonaProfile> {
    const now = new Date();
    const id = randomUUID();

    const defaultStyleGuide: StyleGuide = {
      forbiddenPhrases: [],
      preferredPatterns: [],
      sentenceVariety: 'medium',
      paragraphStyle: 'medium',
      useContractions: true,
      useRhetoricalQuestions: false,
    };

    const styleGuide = {
      ...defaultStyleGuide,
      ...options.styleGuide,
    };

    const formalityRange = options.formalityRange ?? [0.3, 0.7];

    // If setting as default, clear existing default
    if (options.isDefault && options.userId) {
      await this.pool.query(CLEAR_DEFAULT_PERSONA_PROFILE, [options.userId]);
    }

    const result = await this.pool.query(INSERT_AUI_PERSONA_PROFILE, [
      id,
      options.userId ?? null,
      options.name,
      options.description ?? null,
      options.voiceTraits ?? [],
      options.toneMarkers ?? [],
      formalityRange[0],
      formalityRange[1],
      JSON.stringify(styleGuide),
      options.referenceExamples ?? [],
      options.voiceFingerprint ? JSON.stringify(options.voiceFingerprint) : null,
      options.isDefault ?? false,
      JSON.stringify(options.metadata ?? {}),
      now,
      now,
    ]);

    return this.rowToPersonaProfile(result.rows[0] as DbPersonaProfileRow);
  }

  /**
   * Get a persona profile by ID
   */
  async getPersonaProfile(id: string): Promise<PersonaProfile | undefined> {
    const result = await this.pool.query(GET_AUI_PERSONA_PROFILE, [id]);
    if (result.rows.length === 0) return undefined;
    return this.rowToPersonaProfile(result.rows[0] as DbPersonaProfileRow);
  }

  /**
   * Get a persona profile by user ID and name
   */
  async getPersonaProfileByName(
    userId: string,
    name: string
  ): Promise<PersonaProfile | undefined> {
    const result = await this.pool.query(GET_AUI_PERSONA_PROFILE_BY_NAME, [userId, name]);
    if (result.rows.length === 0) return undefined;
    return this.rowToPersonaProfile(result.rows[0] as DbPersonaProfileRow);
  }

  /**
   * Get the default persona profile for a user
   */
  async getDefaultPersonaProfile(userId: string): Promise<PersonaProfile | undefined> {
    const result = await this.pool.query(GET_AUI_DEFAULT_PERSONA_PROFILE, [userId]);
    if (result.rows.length === 0) return undefined;
    return this.rowToPersonaProfile(result.rows[0] as DbPersonaProfileRow);
  }

  /**
   * Update a persona profile
   */
  async updatePersonaProfile(
    id: string,
    update: Partial<{
      name: string;
      description: string;
      voiceTraits: string[];
      toneMarkers: string[];
      formalityMin: number;
      formalityMax: number;
      styleGuide: StyleGuide;
      referenceExamples: string[];
      voiceFingerprint: VoiceFingerprint;
      isDefault: boolean;
      metadata: Record<string, unknown>;
    }>
  ): Promise<PersonaProfile | undefined> {
    // If setting as default, get the profile first to find userId
    if (update.isDefault) {
      const existing = await this.getPersonaProfile(id);
      if (existing?.userId) {
        await this.pool.query(CLEAR_DEFAULT_PERSONA_PROFILE, [existing.userId]);
      }
    }

    const result = await this.pool.query(UPDATE_AUI_PERSONA_PROFILE, [
      id,
      update.name ?? null,
      update.description ?? null,
      update.voiceTraits ?? null,
      update.toneMarkers ?? null,
      update.formalityMin ?? null,
      update.formalityMax ?? null,
      update.styleGuide ? JSON.stringify(update.styleGuide) : null,
      update.referenceExamples ?? null,
      update.voiceFingerprint ? JSON.stringify(update.voiceFingerprint) : null,
      update.isDefault ?? null,
      update.metadata ? JSON.stringify(update.metadata) : null,
    ]);

    if (result.rows.length === 0) return undefined;
    return this.rowToPersonaProfile(result.rows[0] as DbPersonaProfileRow);
  }

  /**
   * Delete a persona profile
   */
  async deletePersonaProfile(id: string): Promise<boolean> {
    const result = await this.pool.query(DELETE_AUI_PERSONA_PROFILE, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * List persona profiles
   */
  async listPersonaProfiles(options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PersonaProfile[]> {
    const result = await this.pool.query(LIST_AUI_PERSONA_PROFILES, [
      options?.userId ?? null,
      options?.limit ?? 100,
      options?.offset ?? 0,
    ]);

    return result.rows.map((row) => this.rowToPersonaProfile(row as DbPersonaProfileRow));
  }

  // ═══════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Run all cleanup tasks
   */
  async runCleanup(): Promise<{
    sessions: number;
    clusters: number;
    artifacts: number;
  }> {
    const [sessions, clusters, artifacts] = await Promise.all([
      this.cleanupExpiredSessions(),
      this.cleanupExpiredClusters(),
      this.cleanupExpiredArtifacts(),
    ]);

    return { sessions, clusters, artifacts };
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private rowToSession(row: DbSessionRow): UnifiedAuiSession {
    return {
      id: row.id,
      name: row.name ?? undefined,
      userId: row.user_id ?? undefined,
      buffers: new Map(), // Will be populated lazily
      activeBufferName: row.active_buffer_name ?? undefined,
      searchSessionId: row.search_session_id ?? undefined,
      taskHistory: [], // Will be populated lazily
      commandHistory: row.command_history ?? [],
      variables: new Map(Object.entries(row.variables ?? {})),
      createdAt: row.created_at.getTime(),
      updatedAt: row.updated_at.getTime(),
      expiresAt: row.expires_at?.getTime(),
      metadata: row.metadata ?? {
        commandCount: 0,
        searchCount: 0,
        taskCount: 0,
      },
    };
  }

  private rowToBuffer(row: DbBufferRow): VersionedBuffer {
    return {
      id: row.id,
      name: row.name,
      branches: new Map(), // Will be populated when needed
      versions: new Map(), // Will be populated when needed
      currentBranch: row.current_branch,
      workingContent: row.working_content ?? [],
      isDirty: row.is_dirty,
      createdAt: row.created_at.getTime(),
      updatedAt: row.updated_at.getTime(),
      schema: row.schema as any,
    };
  }

  private rowToBranch(row: DbBranchRow): BufferBranch {
    return {
      name: row.name,
      headVersionId: row.head_version_id ?? '',
      createdAt: row.created_at.getTime(),
      description: row.description ?? undefined,
      parentBranch: row.parent_branch ?? undefined,
    };
  }

  private rowToVersion(row: DbVersionRow): BufferVersion {
    return {
      id: row.id,
      content: row.content ?? [],
      message: row.message,
      timestamp: row.created_at.getTime(),
      parentId: row.parent_id,
      tags: row.tags ?? [],
      metadata: row.metadata ?? {},
    };
  }

  private rowToTask(row: DbTaskRow): AgentTask {
    return {
      id: row.id,
      request: row.request,
      status: row.status as AgentTask['status'],
      steps: (row.steps ?? []) as AgentTask['steps'],
      plan: row.plan as AgentTask['plan'],
      currentStepIndex: 0,
      result: row.result,
      error: row.error ?? undefined,
      startedAt: row.started_at.getTime(),
      completedAt: row.completed_at?.getTime(),
      totalTokens: row.total_tokens,
      totalCostCents: row.total_cost_cents,
      context: {
        variables: new Map(),
      },
      priority: row.priority,
      userId: undefined,
    };
  }

  private rowToBook(row: DbBookRow, chapters: BookChapter[]): Book {
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      arc: row.arc ?? {
        title: row.title,
        arcType: 'thematic',
        introduction: '',
        chapters: [],
        themes: [],
        transitions: [],
      },
      chapters,
      sourceClusterId: row.source_cluster_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status as Book['status'],
      metadata: row.metadata ?? {},
    };
  }

  private rowToChapter(row: DbChapterRow): BookChapter {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      passageIds: row.passage_ids ?? [],
      position: row.position,
      wordCount: row.word_count,
    };
  }

  private rowToCluster(row: DbClusterRow): ContentCluster {
    let centroid: number[] | undefined;
    if (row.centroid) {
      if (Array.isArray(row.centroid)) {
        centroid = row.centroid;
      } else {
        centroid = fromSql(row.centroid);
      }
    }

    let dateRange: { earliest: Date | null; latest: Date | null } = {
      earliest: null,
      latest: null,
    };
    if (row.date_range) {
      dateRange = {
        earliest: row.date_range.earliest
          ? new Date(row.date_range.earliest)
          : null,
        latest: row.date_range.latest ? new Date(row.date_range.latest) : null,
      };
    }

    return {
      id: row.id,
      label: row.label,
      description: row.description ?? '',
      passages: row.passages as ContentCluster['passages'],
      totalPassages: row.total_passages,
      coherence: row.coherence ?? 0,
      keywords: row.keywords ?? [],
      sourceDistribution: row.source_distribution ?? {},
      dateRange,
      avgWordCount: row.avg_word_count ?? 0,
      centroid,
    };
  }

  private rowToArtifact(row: DbArtifactRow): AuiArtifact {
    return {
      id: row.id,
      userId: row.user_id ?? undefined,
      name: row.name,
      artifactType: row.artifact_type as AuiArtifact['artifactType'],
      content: row.content ?? undefined,
      contentBinary: row.content_binary ?? undefined,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes ?? undefined,
      sourceType: row.source_type ?? undefined,
      sourceId: row.source_id ?? undefined,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? undefined,
      downloadCount: row.download_count,
      lastDownloadedAt: row.last_downloaded_at ?? undefined,
    };
  }

  private rowToPersonaProfile(row: DbPersonaProfileRow): PersonaProfile {
    return {
      id: row.id,
      userId: row.user_id ?? undefined,
      name: row.name,
      description: row.description ?? undefined,
      voiceTraits: row.voice_traits ?? [],
      toneMarkers: row.tone_markers ?? [],
      formalityRange: [row.formality_min, row.formality_max],
      styleGuide: row.style_guide ?? {
        forbiddenPhrases: [],
        preferredPatterns: [],
        sentenceVariety: 'medium',
        paragraphStyle: 'medium',
        useContractions: true,
        useRhetoricalQuestions: false,
      },
      referenceExamples: row.reference_examples ?? [],
      voiceFingerprint: row.voice_fingerprint ?? undefined,
      isDefault: row.is_default,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _auiStore: AuiPostgresStore | null = null;

/**
 * Get the AUI store singleton
 */
export function getAuiStore(): AuiPostgresStore | null {
  return _auiStore;
}

/**
 * Initialize the AUI store singleton
 */
export function initAuiStore(
  pool: Pool,
  options?: AuiPostgresStoreOptions
): AuiPostgresStore {
  _auiStore = new AuiPostgresStore(pool, options);
  return _auiStore;
}

/**
 * Reset the AUI store singleton
 */
export function resetAuiStore(): void {
  _auiStore = null;
}
