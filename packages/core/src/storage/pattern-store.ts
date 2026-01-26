/**
 * Pattern Store
 *
 * PostgreSQL storage for pattern discovery persistence:
 * - Saved patterns (user-created and promoted)
 * - Pattern feedback (user judgments)
 * - Learned constraints (refinements from feedback)
 * - Discovered patterns (autonomous discoveries)
 *
 * @module @humanizer/core/storage/pattern-store
 */

import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import {
  INSERT_AUI_PATTERN,
  GET_AUI_PATTERN,
  GET_AUI_PATTERN_BY_NAME,
  UPDATE_AUI_PATTERN,
  INCREMENT_AUI_PATTERN_USAGE,
  DELETE_AUI_PATTERN,
  LIST_AUI_PATTERNS,
  LIST_AUI_PATTERNS_BY_TAGS,
  FIND_SIMILAR_PATTERNS,
  INSERT_AUI_PATTERN_FEEDBACK,
  GET_AUI_PATTERN_FEEDBACK,
  LIST_AUI_PATTERN_FEEDBACK,
  LIST_AUI_PATTERN_FEEDBACK_BY_JUDGMENT,
  COUNT_AUI_PATTERN_FEEDBACK,
  DELETE_AUI_PATTERN_FEEDBACK,
  INSERT_AUI_PATTERN_CONSTRAINT,
  GET_AUI_PATTERN_CONSTRAINT,
  LIST_AUI_PATTERN_CONSTRAINTS,
  UPDATE_AUI_PATTERN_CONSTRAINT,
  DELETE_AUI_PATTERN_CONSTRAINT,
  DEACTIVATE_AUI_PATTERN_CONSTRAINTS,
  INSERT_AUI_DISCOVERED_PATTERN,
  GET_AUI_DISCOVERED_PATTERN,
  LIST_AUI_DISCOVERED_PATTERNS,
  UPDATE_AUI_DISCOVERED_PATTERN_STATUS,
  DELETE_AUI_DISCOVERED_PATTERN,
  CLEANUP_EXPIRED_DISCOVERED_PATTERNS,
  FIND_SIMILAR_DISCOVERED_PATTERNS,
} from './schema-aui.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Pattern definition - atomic or composed
 */
export interface PatternDefinition {
  type: 'atomic' | 'composed';
  dimensions?: PatternDimension[];
  operator?: 'AND' | 'OR' | 'NOT' | 'SEQUENCE' | 'REFINE' | 'SPECIALIZE';
  operands?: string[];
}

export interface PatternDimension {
  type: 'structural' | 'content' | 'metadata' | 'semantic' | 'temporal';
  description: string;
  weight: number;
  learned?: boolean;
  config?: Record<string, unknown>;
}

/**
 * Persisted pattern
 */
export interface StoredPattern {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  definition: PatternDefinition;
  tags: string[];
  status: 'draft' | 'active' | 'archived';
  usageCount: number;
  successRate: number | null;
  centroid: number[] | null;
  sourceDiscoveredId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
}

/**
 * Pattern feedback record
 */
export interface StoredPatternFeedback {
  id: string;
  patternId: string;
  contentId: string;
  judgment: 'correct' | 'incorrect' | 'partial';
  explanation: string | null;
  contentSnapshot: Record<string, unknown> | null;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Learned constraint
 */
export interface StoredPatternConstraint {
  id: string;
  patternId: string;
  constraintType: 'content' | 'semantic' | 'metadata' | 'structural';
  constraintDefinition: Record<string, unknown>;
  description: string;
  confidence: number;
  sourceFeedbackIds: string[];
  isActive: boolean;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Discovered pattern (autonomous discovery)
 */
export interface StoredDiscoveredPattern {
  id: string;
  userId: string | null;
  observation: string;
  dimensions: PatternDimension[];
  instanceCount: number;
  confidence: number;
  discoveryMethod: string;
  status: 'candidate' | 'validated' | 'rejected' | 'promoted';
  promotedToPatternId: string | null;
  sampleContentIds: string[];
  centroid: number[] | null;
  discoveryOptions: Record<string, unknown> | null;
  expiresAt: Date | null;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════
// CREATE INPUT TYPES
// ═══════════════════════════════════════════════════════════════════

export interface CreatePatternInput {
  id?: string;
  userId?: string;
  name: string;
  description?: string;
  definition: PatternDefinition;
  tags?: string[];
  status?: 'draft' | 'active' | 'archived';
  centroid?: number[];
  sourceDiscoveredId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePatternFeedbackInput {
  id?: string;
  patternId: string;
  contentId: string;
  judgment: 'correct' | 'incorrect' | 'partial';
  explanation?: string;
  contentSnapshot?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CreatePatternConstraintInput {
  id?: string;
  patternId: string;
  constraintType: 'content' | 'semantic' | 'metadata' | 'structural';
  constraintDefinition: Record<string, unknown>;
  description: string;
  confidence?: number;
  sourceFeedbackIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateDiscoveredPatternInput {
  id: string;
  userId?: string;
  observation: string;
  dimensions: PatternDimension[];
  instanceCount: number;
  confidence: number;
  discoveryMethod: string;
  status?: 'candidate' | 'validated' | 'rejected' | 'promoted';
  sampleContentIds?: string[];
  centroid?: number[];
  discoveryOptions?: Record<string, unknown>;
  expiresAt?: Date;
}

// ═══════════════════════════════════════════════════════════════════
// ROW MAPPERS
// ═══════════════════════════════════════════════════════════════════

function rowToPattern(row: any): StoredPattern {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    definition: row.definition,
    tags: row.tags || [],
    status: row.status,
    usageCount: row.usage_count,
    successRate: row.success_rate,
    centroid: row.centroid ? parseVector(row.centroid) : null,
    sourceDiscoveredId: row.source_discovered_id,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
  };
}

function rowToFeedback(row: any): StoredPatternFeedback {
  return {
    id: row.id,
    patternId: row.pattern_id,
    contentId: row.content_id,
    judgment: row.judgment,
    explanation: row.explanation,
    contentSnapshot: row.content_snapshot,
    createdAt: row.created_at,
    metadata: row.metadata || {},
  };
}

function rowToConstraint(row: any): StoredPatternConstraint {
  return {
    id: row.id,
    patternId: row.pattern_id,
    constraintType: row.constraint_type,
    constraintDefinition: row.constraint_definition,
    description: row.description,
    confidence: row.confidence,
    sourceFeedbackIds: row.source_feedback_ids || [],
    isActive: row.is_active,
    createdAt: row.created_at,
    metadata: row.metadata || {},
  };
}

function rowToDiscoveredPattern(row: any): StoredDiscoveredPattern {
  return {
    id: row.id,
    userId: row.user_id,
    observation: row.observation,
    dimensions: row.dimensions || [],
    instanceCount: row.instance_count,
    confidence: row.confidence,
    discoveryMethod: row.discovery_method,
    status: row.status,
    promotedToPatternId: row.promoted_to_pattern_id,
    sampleContentIds: row.sample_content_ids || [],
    centroid: row.centroid ? parseVector(row.centroid) : null,
    discoveryOptions: row.discovery_options,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function parseVector(v: string | number[]): number[] {
  if (Array.isArray(v)) return v;
  // PostgreSQL returns vectors as strings like "[0.1,0.2,0.3]"
  return JSON.parse(v.replace(/^\[/, '[').replace(/\]$/, ']'));
}

function formatVector(v: number[]): string {
  return `[${v.join(',')}]`;
}

// ═══════════════════════════════════════════════════════════════════
// PATTERN STORE CLASS
// ═══════════════════════════════════════════════════════════════════

export class PatternStore {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // ─────────────────────────────────────────────────────────────────
  // PATTERN CRUD
  // ─────────────────────────────────────────────────────────────────

  /**
   * Save a pattern (upsert by user_id + name)
   */
  async savePattern(input: CreatePatternInput): Promise<StoredPattern> {
    const id = input.id || randomUUID();
    const now = new Date();

    const result = await this.pool.query(INSERT_AUI_PATTERN, [
      id,
      input.userId || null,
      input.name,
      input.description || null,
      JSON.stringify(input.definition),
      input.tags || [],
      input.status || 'active',
      0, // usage_count
      null, // success_rate
      input.centroid ? formatVector(input.centroid) : null,
      input.sourceDiscoveredId || null,
      JSON.stringify(input.metadata || {}),
      now, // created_at
      now, // updated_at
      null, // last_used_at
    ]);

    return rowToPattern(result.rows[0]);
  }

  /**
   * Get pattern by ID
   */
  async getPattern(id: string): Promise<StoredPattern | null> {
    const result = await this.pool.query(GET_AUI_PATTERN, [id]);
    return result.rows[0] ? rowToPattern(result.rows[0]) : null;
  }

  /**
   * Get pattern by user and name
   */
  async getPatternByName(userId: string | null, name: string): Promise<StoredPattern | null> {
    const result = await this.pool.query(GET_AUI_PATTERN_BY_NAME, [userId, name]);
    return result.rows[0] ? rowToPattern(result.rows[0]) : null;
  }

  /**
   * Update pattern
   */
  async updatePattern(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      definition: PatternDefinition;
      tags: string[];
      status: 'draft' | 'active' | 'archived';
      usageCount: number;
      successRate: number;
      centroid: number[];
      metadata: Record<string, unknown>;
      lastUsedAt: Date;
    }>
  ): Promise<StoredPattern | null> {
    const result = await this.pool.query(UPDATE_AUI_PATTERN, [
      id,
      updates.name ?? null,
      updates.description ?? null,
      updates.definition ? JSON.stringify(updates.definition) : null,
      updates.tags ?? null,
      updates.status ?? null,
      updates.usageCount ?? null,
      updates.successRate ?? null,
      updates.centroid ? formatVector(updates.centroid) : null,
      updates.metadata ? JSON.stringify(updates.metadata) : null,
      updates.lastUsedAt ?? null,
    ]);

    return result.rows[0] ? rowToPattern(result.rows[0]) : null;
  }

  /**
   * Increment pattern usage count
   */
  async incrementPatternUsage(id: string): Promise<StoredPattern | null> {
    const result = await this.pool.query(INCREMENT_AUI_PATTERN_USAGE, [id]);
    return result.rows[0] ? rowToPattern(result.rows[0]) : null;
  }

  /**
   * Delete pattern
   */
  async deletePattern(id: string): Promise<boolean> {
    const result = await this.pool.query(DELETE_AUI_PATTERN, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * List patterns
   */
  async listPatterns(options: {
    userId?: string;
    status?: 'draft' | 'active' | 'archived';
    limit?: number;
    offset?: number;
  } = {}): Promise<StoredPattern[]> {
    const result = await this.pool.query(LIST_AUI_PATTERNS, [
      options.userId ?? null,
      options.status ?? null,
      options.limit ?? 100,
      options.offset ?? 0,
    ]);

    return result.rows.map(rowToPattern);
  }

  /**
   * List patterns by tags
   */
  async listPatternsByTags(
    tags: string[],
    options: { userId?: string; limit?: number; offset?: number } = {}
  ): Promise<StoredPattern[]> {
    const result = await this.pool.query(LIST_AUI_PATTERNS_BY_TAGS, [
      options.userId ?? null,
      tags,
      options.limit ?? 100,
      options.offset ?? 0,
    ]);

    return result.rows.map(rowToPattern);
  }

  /**
   * Find similar patterns by embedding
   */
  async findSimilarPatterns(
    embedding: number[],
    options: { userId?: string; limit?: number } = {}
  ): Promise<Array<StoredPattern & { similarity: number }>> {
    const result = await this.pool.query(FIND_SIMILAR_PATTERNS, [
      formatVector(embedding),
      options.userId ?? null,
      options.limit ?? 10,
    ]);

    return result.rows.map(row => ({
      ...rowToPattern(row),
      similarity: row.similarity,
    }));
  }

  // ─────────────────────────────────────────────────────────────────
  // FEEDBACK CRUD
  // ─────────────────────────────────────────────────────────────────

  /**
   * Record pattern feedback
   */
  async recordFeedback(input: CreatePatternFeedbackInput): Promise<StoredPatternFeedback> {
    const id = input.id || randomUUID();
    const now = new Date();

    const result = await this.pool.query(INSERT_AUI_PATTERN_FEEDBACK, [
      id,
      input.patternId,
      input.contentId,
      input.judgment,
      input.explanation || null,
      input.contentSnapshot ? JSON.stringify(input.contentSnapshot) : null,
      now,
      JSON.stringify(input.metadata || {}),
    ]);

    // Update pattern success rate
    await this.updatePatternSuccessRate(input.patternId);

    return rowToFeedback(result.rows[0]);
  }

  /**
   * Get feedback by ID
   */
  async getFeedback(id: string): Promise<StoredPatternFeedback | null> {
    const result = await this.pool.query(GET_AUI_PATTERN_FEEDBACK, [id]);
    return result.rows[0] ? rowToFeedback(result.rows[0]) : null;
  }

  /**
   * List feedback for a pattern
   */
  async listFeedback(
    patternId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<StoredPatternFeedback[]> {
    const result = await this.pool.query(LIST_AUI_PATTERN_FEEDBACK, [
      patternId,
      options.limit ?? 100,
      options.offset ?? 0,
    ]);

    return result.rows.map(rowToFeedback);
  }

  /**
   * List feedback by judgment
   */
  async listFeedbackByJudgment(
    patternId: string,
    judgment: 'correct' | 'incorrect' | 'partial',
    options: { limit?: number; offset?: number } = {}
  ): Promise<StoredPatternFeedback[]> {
    const result = await this.pool.query(LIST_AUI_PATTERN_FEEDBACK_BY_JUDGMENT, [
      patternId,
      judgment,
      options.limit ?? 100,
      options.offset ?? 0,
    ]);

    return result.rows.map(rowToFeedback);
  }

  /**
   * Count feedback by judgment
   */
  async countFeedback(patternId: string): Promise<Record<string, number>> {
    const result = await this.pool.query(COUNT_AUI_PATTERN_FEEDBACK, [patternId]);
    const counts: Record<string, number> = { correct: 0, incorrect: 0, partial: 0 };
    for (const row of result.rows) {
      counts[row.judgment] = parseInt(row.count, 10);
    }
    return counts;
  }

  /**
   * Delete feedback
   */
  async deleteFeedback(id: string): Promise<boolean> {
    const result = await this.pool.query(DELETE_AUI_PATTERN_FEEDBACK, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Update pattern success rate based on feedback
   */
  private async updatePatternSuccessRate(patternId: string): Promise<void> {
    const counts = await this.countFeedback(patternId);
    const total = counts.correct + counts.incorrect + counts.partial;
    if (total === 0) return;

    // Success rate: correct = 1.0, partial = 0.5, incorrect = 0.0
    const successRate = (counts.correct + counts.partial * 0.5) / total;

    await this.updatePattern(patternId, { successRate });
  }

  // ─────────────────────────────────────────────────────────────────
  // CONSTRAINT CRUD
  // ─────────────────────────────────────────────────────────────────

  /**
   * Save a learned constraint
   */
  async saveConstraint(input: CreatePatternConstraintInput): Promise<StoredPatternConstraint> {
    const id = input.id || randomUUID();
    const now = new Date();

    const result = await this.pool.query(INSERT_AUI_PATTERN_CONSTRAINT, [
      id,
      input.patternId,
      input.constraintType,
      JSON.stringify(input.constraintDefinition),
      input.description,
      input.confidence ?? 0.5,
      input.sourceFeedbackIds || [],
      true, // is_active
      now,
      JSON.stringify(input.metadata || {}),
    ]);

    return rowToConstraint(result.rows[0]);
  }

  /**
   * Get constraint by ID
   */
  async getConstraint(id: string): Promise<StoredPatternConstraint | null> {
    const result = await this.pool.query(GET_AUI_PATTERN_CONSTRAINT, [id]);
    return result.rows[0] ? rowToConstraint(result.rows[0]) : null;
  }

  /**
   * List constraints for a pattern
   */
  async listConstraints(
    patternId: string,
    options: { activeOnly?: boolean } = {}
  ): Promise<StoredPatternConstraint[]> {
    const result = await this.pool.query(LIST_AUI_PATTERN_CONSTRAINTS, [
      patternId,
      options.activeOnly ?? null,
    ]);

    return result.rows.map(rowToConstraint);
  }

  /**
   * Update constraint
   */
  async updateConstraint(
    id: string,
    updates: Partial<{
      confidence: number;
      sourceFeedbackIds: string[];
      isActive: boolean;
      metadata: Record<string, unknown>;
    }>
  ): Promise<StoredPatternConstraint | null> {
    const result = await this.pool.query(UPDATE_AUI_PATTERN_CONSTRAINT, [
      id,
      updates.confidence ?? null,
      updates.sourceFeedbackIds ?? null,
      updates.isActive ?? null,
      updates.metadata ? JSON.stringify(updates.metadata) : null,
    ]);

    return result.rows[0] ? rowToConstraint(result.rows[0]) : null;
  }

  /**
   * Delete constraint
   */
  async deleteConstraint(id: string): Promise<boolean> {
    const result = await this.pool.query(DELETE_AUI_PATTERN_CONSTRAINT, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Deactivate all constraints for a pattern
   */
  async deactivateConstraints(patternId: string): Promise<void> {
    await this.pool.query(DEACTIVATE_AUI_PATTERN_CONSTRAINTS, [patternId]);
  }

  // ─────────────────────────────────────────────────────────────────
  // DISCOVERED PATTERNS CRUD
  // ─────────────────────────────────────────────────────────────────

  /**
   * Save a discovered pattern
   */
  async saveDiscoveredPattern(input: CreateDiscoveredPatternInput): Promise<StoredDiscoveredPattern> {
    const now = new Date();
    const defaultExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const result = await this.pool.query(INSERT_AUI_DISCOVERED_PATTERN, [
      input.id,
      input.userId || null,
      input.observation,
      JSON.stringify(input.dimensions),
      input.instanceCount,
      input.confidence,
      input.discoveryMethod,
      input.status || 'candidate',
      null, // promoted_to_pattern_id
      input.sampleContentIds || [],
      input.centroid ? formatVector(input.centroid) : null,
      input.discoveryOptions ? JSON.stringify(input.discoveryOptions) : null,
      input.expiresAt || defaultExpiry,
      now,
    ]);

    return rowToDiscoveredPattern(result.rows[0]);
  }

  /**
   * Get discovered pattern by ID
   */
  async getDiscoveredPattern(id: string): Promise<StoredDiscoveredPattern | null> {
    const result = await this.pool.query(GET_AUI_DISCOVERED_PATTERN, [id]);
    return result.rows[0] ? rowToDiscoveredPattern(result.rows[0]) : null;
  }

  /**
   * List discovered patterns
   */
  async listDiscoveredPatterns(options: {
    userId?: string;
    status?: 'candidate' | 'validated' | 'rejected' | 'promoted';
    limit?: number;
    offset?: number;
  } = {}): Promise<StoredDiscoveredPattern[]> {
    const result = await this.pool.query(LIST_AUI_DISCOVERED_PATTERNS, [
      options.userId ?? null,
      options.status ?? null,
      options.limit ?? 100,
      options.offset ?? 0,
    ]);

    return result.rows.map(rowToDiscoveredPattern);
  }

  /**
   * Update discovered pattern status
   */
  async updateDiscoveredPatternStatus(
    id: string,
    status: 'candidate' | 'validated' | 'rejected' | 'promoted',
    promotedToPatternId?: string
  ): Promise<StoredDiscoveredPattern | null> {
    const result = await this.pool.query(UPDATE_AUI_DISCOVERED_PATTERN_STATUS, [
      id,
      status,
      promotedToPatternId || null,
    ]);

    return result.rows[0] ? rowToDiscoveredPattern(result.rows[0]) : null;
  }

  /**
   * Delete discovered pattern
   */
  async deleteDiscoveredPattern(id: string): Promise<boolean> {
    const result = await this.pool.query(DELETE_AUI_DISCOVERED_PATTERN, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Cleanup expired discovered patterns
   */
  async cleanupExpiredDiscoveredPatterns(): Promise<number> {
    const result = await this.pool.query(CLEANUP_EXPIRED_DISCOVERED_PATTERNS);
    return result.rowCount ?? 0;
  }

  /**
   * Find similar discovered patterns by embedding
   */
  async findSimilarDiscoveredPatterns(
    embedding: number[],
    options: { userId?: string; limit?: number } = {}
  ): Promise<Array<StoredDiscoveredPattern & { similarity: number }>> {
    const result = await this.pool.query(FIND_SIMILAR_DISCOVERED_PATTERNS, [
      formatVector(embedding),
      options.userId ?? null,
      options.limit ?? 10,
    ]);

    return result.rows.map(row => ({
      ...rowToDiscoveredPattern(row),
      similarity: row.similarity,
    }));
  }

  // ─────────────────────────────────────────────────────────────────
  // PROMOTION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Promote a discovered pattern to a saved pattern
   */
  async promoteDiscoveredPattern(
    discoveredId: string,
    name: string,
    options: { userId?: string; description?: string; tags?: string[] } = {}
  ): Promise<StoredPattern | null> {
    const discovered = await this.getDiscoveredPattern(discoveredId);
    if (!discovered || discovered.status === 'promoted') {
      return null;
    }

    // Create the saved pattern
    const pattern = await this.savePattern({
      userId: options.userId || discovered.userId || undefined,
      name,
      description: options.description || discovered.observation,
      definition: {
        type: 'atomic',
        dimensions: discovered.dimensions,
      },
      tags: options.tags || [],
      centroid: discovered.centroid || undefined,
      sourceDiscoveredId: discoveredId,
    });

    // Update discovered pattern status
    await this.updateDiscoveredPatternStatus(discoveredId, 'promoted', pattern.id);

    return pattern;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let patternStoreInstance: PatternStore | null = null;

/**
 * Initialize the pattern store with a pool
 */
export function initPatternStore(pool: Pool): PatternStore {
  patternStoreInstance = new PatternStore(pool);
  return patternStoreInstance;
}

/**
 * Get the pattern store instance
 */
export function getPatternStore(): PatternStore {
  if (!patternStoreInstance) {
    throw new Error('PatternStore not initialized. Call initPatternStore() first.');
  }
  return patternStoreInstance;
}
