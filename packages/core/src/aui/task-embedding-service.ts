/**
 * Task Embedding Service
 *
 * Manages task embeddings for intelligent agent routing.
 * Part of Phase 5: Rho Integration.
 *
 * Features:
 * - Task embedding generation
 * - Similar task lookup with temporal decay
 * - Adaptive thresholds based on historical success
 * - Agent routing suggestions
 *
 * Rho (ρ) represents the similarity measure between task embeddings,
 * used to determine which agent best handles a given task.
 *
 * @module aui/task-embedding-service
 */

import { randomUUID } from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A recorded task with its embedding
 */
export interface TaskEmbeddingRecord {
  /** Unique task ID */
  taskId: string;

  /** Original task request text */
  request: string;

  /** Task embedding vector */
  embedding: number[];

  /** Agent that handled this task */
  agentId: string;

  /** Whether the task was successful */
  success: boolean;

  /** Quality score if available (0-1) */
  qualityScore?: number;

  /** When the task was created */
  createdAt: Date;

  /** When the task completed */
  completedAt?: Date;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of a similar task search
 */
export interface SimilarTaskResult {
  /** Task ID */
  taskId: string;

  /** Raw similarity score (cosine similarity, 0-1) */
  similarity: number;

  /** Similarity after temporal decay */
  decayedSimilarity: number;

  /** Agent that handled this task */
  agentUsed: string;

  /** Whether that task was successful */
  wasSuccessful: boolean;

  /** Age of task in milliseconds */
  ageMs: number;

  /** Original request (for context) */
  request: string;
}

/**
 * Agent suggestion from rho analysis
 */
export interface AgentSuggestion {
  /** Suggested agent ID */
  agentId: string;

  /** Confidence in suggestion (0-1) */
  confidence: number;

  /** Number of similar historical tasks considered */
  supportingTasks: number;

  /** Average success rate for this agent on similar tasks */
  historicalSuccessRate: number;

  /** Reasoning for the suggestion */
  reasoning: string;
}

/**
 * Outcome of a task for feedback
 */
export interface TaskOutcome {
  /** Task ID */
  taskId: string;

  /** Was the task successful? */
  success: boolean;

  /** Quality score (0-1) */
  qualityScore?: number;

  /** Any error message */
  errorMessage?: string;

  /** Duration in milliseconds */
  durationMs?: number;
}

/**
 * Configuration for temporal decay
 */
export interface TemporalDecayConfig {
  /** Half-life in days (default: 30) */
  halfLifeDays: number;

  /** Minimum weight after decay (default: 0.1) */
  minimumWeight: number;

  /** Whether to apply decay (default: true) */
  enabled: boolean;
}

/**
 * Configuration for adaptive thresholds
 */
export interface AdaptiveThresholdConfig {
  /** Base threshold (default: 0.7) */
  baseThreshold: number;

  /** Whether to adapt based on history (default: true) */
  adaptFromHistory: boolean;

  /** Target success rate for calibration (default: 0.85) */
  targetSuccessRate: number;

  /** Maximum threshold adjustment (default: 0.1) */
  maxAdjustment: number;

  /** Number of recent tasks to consider for adaptation (default: 100) */
  recentTaskWindow: number;
}

/**
 * Options for TaskEmbeddingService
 */
export interface TaskEmbeddingServiceOptions {
  /** Temporal decay configuration */
  decay?: Partial<TemporalDecayConfig>;

  /** Adaptive threshold configuration */
  threshold?: Partial<AdaptiveThresholdConfig>;

  /** Maximum number of historical tasks to store per agent */
  maxHistoryPerAgent?: number;

  /** Embedding dimension (for validation) */
  embeddingDimension?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// TASK EMBEDDING SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Embedder callback type
 */
export type Embedder = (text: string) => Promise<number[]>;

/**
 * TaskEmbeddingService manages task embeddings for agent routing.
 *
 * The service uses "rho" (ρ) as a similarity measure between tasks,
 * applying temporal decay to favor recent examples and adapting
 * thresholds based on historical success rates.
 */
export class TaskEmbeddingService {
  private history: Map<string, TaskEmbeddingRecord[]> = new Map();
  private outcomes: Map<string, TaskOutcome> = new Map();
  private embedder?: Embedder;

  private decayConfig: TemporalDecayConfig;
  private thresholdConfig: AdaptiveThresholdConfig;
  private options: Required<Omit<TaskEmbeddingServiceOptions, 'decay' | 'threshold'>>;

  constructor(options?: TaskEmbeddingServiceOptions) {
    this.decayConfig = {
      halfLifeDays: options?.decay?.halfLifeDays ?? 30,
      minimumWeight: options?.decay?.minimumWeight ?? 0.1,
      enabled: options?.decay?.enabled ?? true,
    };

    this.thresholdConfig = {
      baseThreshold: options?.threshold?.baseThreshold ?? 0.7,
      adaptFromHistory: options?.threshold?.adaptFromHistory ?? true,
      targetSuccessRate: options?.threshold?.targetSuccessRate ?? 0.85,
      maxAdjustment: options?.threshold?.maxAdjustment ?? 0.1,
      recentTaskWindow: options?.threshold?.recentTaskWindow ?? 100,
    };

    this.options = {
      maxHistoryPerAgent: options?.maxHistoryPerAgent ?? 1000,
      embeddingDimension: options?.embeddingDimension ?? 768,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set the embedder function for generating embeddings
   */
  setEmbedder(embedder: Embedder): void {
    this.embedder = embedder;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Core Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate embedding for a task request
   */
  async embedTask(request: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embedder not configured. Call setEmbedder first.');
    }
    return this.embedder(request);
  }

  /**
   * Find similar historical tasks
   */
  async findSimilarTasks(
    embedding: number[],
    options?: {
      agentId?: string;
      limit?: number;
      onlySuccessful?: boolean;
    }
  ): Promise<SimilarTaskResult[]> {
    const limit = options?.limit ?? 5;
    const now = Date.now();
    const results: SimilarTaskResult[] = [];

    // Collect tasks to search
    const tasksToSearch: TaskEmbeddingRecord[] = [];
    if (options?.agentId) {
      const agentTasks = this.history.get(options.agentId) ?? [];
      tasksToSearch.push(...agentTasks);
    } else {
      for (const tasks of this.history.values()) {
        tasksToSearch.push(...tasks);
      }
    }

    // Filter and score
    for (const task of tasksToSearch) {
      if (options?.onlySuccessful && !task.success) {
        continue;
      }

      const similarity = this.cosineSimilarity(embedding, task.embedding);
      const ageMs = now - task.createdAt.getTime();
      const decayedSimilarity = this.decayConfig.enabled
        ? this.applyTemporalDecay(similarity, ageMs)
        : similarity;

      results.push({
        taskId: task.taskId,
        similarity,
        decayedSimilarity,
        agentUsed: task.agentId,
        wasSuccessful: task.success,
        ageMs,
        request: task.request,
      });
    }

    // Sort by decayed similarity and limit
    results.sort((a, b) => b.decayedSimilarity - a.decayedSimilarity);
    return results.slice(0, limit);
  }

  /**
   * Suggest an agent based on task embedding (rho-based routing)
   */
  async suggestAgentByRho(
    taskEmbedding: number[],
    options?: {
      baseThreshold?: number;
      adaptFromHistory?: boolean;
      candidateAgents?: string[];
    }
  ): Promise<AgentSuggestion | null> {
    // Get adaptive threshold
    const threshold = await this.getAdaptiveThreshold({
      baseThreshold: options?.baseThreshold,
      adaptFromHistory: options?.adaptFromHistory,
    });

    // Find similar tasks
    const similarTasks = await this.findSimilarTasks(taskEmbedding, { limit: 20 });

    if (similarTasks.length === 0) {
      return null;
    }

    // Filter by threshold
    const relevantTasks = similarTasks.filter(
      (t) => t.decayedSimilarity >= threshold
    );

    if (relevantTasks.length === 0) {
      return null;
    }

    // Group by agent and calculate scores
    const agentScores = new Map<
      string,
      { totalSimilarity: number; successCount: number; totalCount: number }
    >();

    for (const task of relevantTasks) {
      // Filter by candidate agents if specified
      if (
        options?.candidateAgents &&
        !options.candidateAgents.includes(task.agentUsed)
      ) {
        continue;
      }

      const current = agentScores.get(task.agentUsed) ?? {
        totalSimilarity: 0,
        successCount: 0,
        totalCount: 0,
      };

      current.totalSimilarity += task.decayedSimilarity;
      current.totalCount += 1;
      if (task.wasSuccessful) {
        current.successCount += 1;
      }

      agentScores.set(task.agentUsed, current);
    }

    // Find best agent
    let bestAgent: string | null = null;
    let bestScore = 0;
    let bestSuccessRate = 0;
    let bestCount = 0;

    for (const [agentId, scores] of agentScores) {
      const successRate = scores.successCount / scores.totalCount;
      const avgSimilarity = scores.totalSimilarity / scores.totalCount;

      // Combined score: similarity * success rate
      const combinedScore = avgSimilarity * successRate;

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestAgent = agentId;
        bestSuccessRate = successRate;
        bestCount = scores.totalCount;
      }
    }

    if (!bestAgent) {
      return null;
    }

    return {
      agentId: bestAgent,
      confidence: bestScore,
      supportingTasks: bestCount,
      historicalSuccessRate: bestSuccessRate,
      reasoning: `Based on ${bestCount} similar historical tasks, ` +
        `agent "${bestAgent}" has a ${(bestSuccessRate * 100).toFixed(0)}% success rate ` +
        `with average similarity ${bestScore.toFixed(3)}.`,
    };
  }

  /**
   * Record a task completion for future routing
   */
  async recordTaskCompletion(
    taskId: string,
    request: string,
    embedding: number[],
    agentUsed: string,
    outcome: TaskOutcome
  ): Promise<TaskEmbeddingRecord> {
    const record: TaskEmbeddingRecord = {
      taskId,
      request,
      embedding,
      agentId: agentUsed,
      success: outcome.success,
      qualityScore: outcome.qualityScore,
      createdAt: new Date(),
      completedAt: new Date(),
    };

    // Store in history
    const agentHistory = this.history.get(agentUsed) ?? [];
    agentHistory.unshift(record);

    // Trim to max size
    if (agentHistory.length > this.options.maxHistoryPerAgent) {
      agentHistory.pop();
    }

    this.history.set(agentUsed, agentHistory);

    // Store outcome
    this.outcomes.set(taskId, outcome);

    return record;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Temporal Decay
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Apply temporal decay to a similarity score
   */
  applyTemporalDecay(similarity: number, ageMs: number): number {
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const lambda = Math.LN2 / this.decayConfig.halfLifeDays;
    const decay = Math.max(
      this.decayConfig.minimumWeight,
      Math.exp(-lambda * ageDays)
    );

    return similarity * decay;
  }

  /**
   * Update decay configuration
   */
  setDecayConfig(config: Partial<TemporalDecayConfig>): void {
    this.decayConfig = { ...this.decayConfig, ...config };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Adaptive Thresholds
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get adaptive threshold based on historical success
   */
  async getAdaptiveThreshold(options?: {
    baseThreshold?: number;
    adaptFromHistory?: boolean;
  }): Promise<number> {
    const base = options?.baseThreshold ?? this.thresholdConfig.baseThreshold;
    const adapt = options?.adaptFromHistory ?? this.thresholdConfig.adaptFromHistory;

    if (!adapt) {
      return base;
    }

    const recentOutcomes = await this.getRecentTaskOutcomes(
      this.thresholdConfig.recentTaskWindow
    );

    if (recentOutcomes.length < 10) {
      // Not enough data to adapt
      return base;
    }

    const successRate =
      recentOutcomes.filter((o) => o.success).length / recentOutcomes.length;

    // Adjust threshold based on success rate vs target
    // If success rate is high, we can be more permissive (lower threshold)
    // If low, be more conservative (higher threshold)
    const adjustment =
      (successRate - this.thresholdConfig.targetSuccessRate) *
      this.thresholdConfig.maxAdjustment * -1; // Invert: high success → lower threshold

    return Math.max(0.5, Math.min(0.9, base + adjustment));
  }

  /**
   * Get recent task outcomes for threshold adaptation
   */
  async getRecentTaskOutcomes(limit: number): Promise<TaskOutcome[]> {
    // Collect all outcomes and sort by recency
    const allOutcomes: Array<{ outcome: TaskOutcome; timestamp: Date }> = [];

    for (const tasks of this.history.values()) {
      for (const task of tasks) {
        const outcome = this.outcomes.get(task.taskId);
        if (outcome) {
          allOutcomes.push({
            outcome,
            timestamp: task.completedAt ?? task.createdAt,
          });
        }
      }
    }

    allOutcomes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return allOutcomes.slice(0, limit).map((o) => o.outcome);
  }

  /**
   * Update threshold configuration
   */
  setThresholdConfig(config: Partial<AdaptiveThresholdConfig>): void {
    this.thresholdConfig = { ...this.thresholdConfig, ...config };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get statistics about the task embedding history
   */
  getStatistics(): {
    totalTasks: number;
    tasksByAgent: Record<string, number>;
    successRate: number;
    avgQualityScore: number;
    oldestTask: Date | null;
    newestTask: Date | null;
  } {
    let totalTasks = 0;
    const tasksByAgent: Record<string, number> = {};
    let successCount = 0;
    let qualitySum = 0;
    let qualityCount = 0;
    let oldestTask: Date | null = null;
    let newestTask: Date | null = null;

    for (const [agentId, tasks] of this.history) {
      tasksByAgent[agentId] = tasks.length;
      totalTasks += tasks.length;

      for (const task of tasks) {
        if (task.success) {
          successCount++;
        }
        if (task.qualityScore !== undefined) {
          qualitySum += task.qualityScore;
          qualityCount++;
        }
        if (!oldestTask || task.createdAt < oldestTask) {
          oldestTask = task.createdAt;
        }
        if (!newestTask || task.createdAt > newestTask) {
          newestTask = task.createdAt;
        }
      }
    }

    return {
      totalTasks,
      tasksByAgent,
      successRate: totalTasks > 0 ? successCount / totalTasks : 0,
      avgQualityScore: qualityCount > 0 ? qualitySum / qualityCount : 0,
      oldestTask,
      newestTask,
    };
  }

  /**
   * Get routing accuracy (for validation of threshold tuning)
   */
  async getRoutingAccuracy(recentTasks?: number): Promise<{
    totalRouted: number;
    successfulRoutes: number;
    accuracy: number;
    threshold: number;
  }> {
    const outcomes = await this.getRecentTaskOutcomes(recentTasks ?? 100);
    const threshold = await this.getAdaptiveThreshold();

    const successfulRoutes = outcomes.filter((o) => o.success).length;

    return {
      totalRouted: outcomes.length,
      successfulRoutes,
      accuracy: outcomes.length > 0 ? successfulRoutes / outcomes.length : 0,
      threshold,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(
        `Vector dimensions must match: ${a.length} vs ${b.length}`
      );
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;

    return dotProduct / denom;
  }

  /**
   * Clear all history (for testing)
   */
  clear(): void {
    this.history.clear();
    this.outcomes.clear();
  }

  /**
   * Get task count by agent
   */
  getTaskCountByAgent(agentId: string): number {
    return this.history.get(agentId)?.length ?? 0;
  }

  /**
   * Export history for persistence
   */
  exportHistory(): TaskEmbeddingRecord[] {
    const allRecords: TaskEmbeddingRecord[] = [];
    for (const tasks of this.history.values()) {
      allRecords.push(...tasks);
    }
    return allRecords;
  }

  /**
   * Import history from persistence
   */
  importHistory(records: TaskEmbeddingRecord[]): void {
    for (const record of records) {
      const agentHistory = this.history.get(record.agentId) ?? [];
      agentHistory.push(record);
      this.history.set(record.agentId, agentHistory);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let _taskEmbeddingService: TaskEmbeddingService | null = null;

/**
 * Get the global TaskEmbeddingService instance
 */
export function getTaskEmbeddingService(): TaskEmbeddingService {
  if (!_taskEmbeddingService) {
    _taskEmbeddingService = new TaskEmbeddingService();
  }
  return _taskEmbeddingService;
}

/**
 * Set a custom TaskEmbeddingService instance
 */
export function setTaskEmbeddingService(service: TaskEmbeddingService): void {
  _taskEmbeddingService = service;
}

/**
 * Reset the global TaskEmbeddingService (for testing)
 */
export function resetTaskEmbeddingService(): void {
  _taskEmbeddingService = null;
}
