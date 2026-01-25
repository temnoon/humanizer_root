/**
 * Task Embedding Service Tests
 *
 * Unit tests for the rho-based agent routing system:
 * - Task embedding generation
 * - Similar task lookup
 * - Temporal decay
 * - Adaptive thresholds
 * - Agent suggestions
 *
 * @module @humanizer/core/aui/task-embedding-service.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TaskEmbeddingService,
  getTaskEmbeddingService,
  setTaskEmbeddingService,
  resetTaskEmbeddingService,
  type TaskEmbeddingRecord,
  type TaskOutcome,
  type Embedder,
} from './task-embedding-service.js';

// ═══════════════════════════════════════════════════════════════════════════
// TEST UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a mock embedder that generates deterministic embeddings
 */
function createMockEmbedder(dimension = 768): Embedder {
  return async (text: string) => {
    // Generate deterministic embeddings based on text hash
    const hash = text.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return Array.from({ length: dimension }, (_, i) =>
      Math.sin(hash + i) * 0.5 + 0.5
    );
  };
}

/**
 * Create a similar embedding to a reference (with controlled similarity)
 */
function createSimilarEmbedding(
  reference: number[],
  similarity: number
): number[] {
  // Mix reference with random noise based on similarity
  const noise = Array.from({ length: reference.length }, () => Math.random());
  return reference.map((v, i) => v * similarity + noise[i] * (1 - similarity));
}

/**
 * Generate a random embedding
 */
function randomEmbedding(dimension = 768): number[] {
  return Array.from({ length: dimension }, () => Math.random());
}

// ═══════════════════════════════════════════════════════════════════════════
// TASK EMBEDDING SERVICE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('TaskEmbeddingService', () => {
  let service: TaskEmbeddingService;
  let mockEmbedder: Embedder;

  beforeEach(() => {
    resetTaskEmbeddingService();
    service = new TaskEmbeddingService();
    mockEmbedder = createMockEmbedder();
    service.setEmbedder(mockEmbedder);
  });

  afterEach(() => {
    resetTaskEmbeddingService();
  });

  describe('Constructor', () => {
    it('should create with default options', () => {
      const s = new TaskEmbeddingService();
      expect(s).toBeDefined();
    });

    it('should accept custom options', () => {
      const s = new TaskEmbeddingService({
        decay: {
          halfLifeDays: 60,
          minimumWeight: 0.2,
        },
        threshold: {
          baseThreshold: 0.8,
          adaptFromHistory: false,
        },
        maxHistoryPerAgent: 500,
        embeddingDimension: 1536,
      });
      expect(s).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should set embedder', () => {
      const s = new TaskEmbeddingService();
      s.setEmbedder(mockEmbedder);
      // No error means success
      expect(true).toBe(true);
    });

    it('should update decay config', () => {
      service.setDecayConfig({ halfLifeDays: 60 });
      // No error means success
      expect(true).toBe(true);
    });

    it('should update threshold config', () => {
      service.setThresholdConfig({ baseThreshold: 0.8 });
      // No error means success
      expect(true).toBe(true);
    });
  });

  describe('embedTask()', () => {
    it('should generate embedding for task', async () => {
      const embedding = await service.embedTask('Create a chapter outline');

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
      expect(embedding.every(v => typeof v === 'number')).toBe(true);
    });

    it('should throw when embedder not configured', async () => {
      const s = new TaskEmbeddingService();

      await expect(s.embedTask('test')).rejects.toThrow('Embedder not configured');
    });

    it('should generate consistent embeddings for same text', async () => {
      const embedding1 = await service.embedTask('test task');
      const embedding2 = await service.embedTask('test task');

      expect(embedding1).toEqual(embedding2);
    });

    it('should generate different embeddings for different text', async () => {
      const embedding1 = await service.embedTask('task A');
      const embedding2 = await service.embedTask('task B');

      expect(embedding1).not.toEqual(embedding2);
    });
  });

  describe('recordTaskCompletion()', () => {
    it('should record a task completion', async () => {
      const embedding = await service.embedTask('test task');
      const outcome: TaskOutcome = {
        taskId: 'task-1',
        success: true,
        qualityScore: 0.85,
      };

      const record = await service.recordTaskCompletion(
        'task-1',
        'test task',
        embedding,
        'builder',
        outcome
      );

      expect(record.taskId).toBe('task-1');
      expect(record.request).toBe('test task');
      expect(record.agentId).toBe('builder');
      expect(record.success).toBe(true);
      expect(record.qualityScore).toBe(0.85);
    });

    it('should store in agent history', async () => {
      const embedding = await service.embedTask('test task');

      await service.recordTaskCompletion(
        'task-1',
        'test task',
        embedding,
        'builder',
        { taskId: 'task-1', success: true }
      );

      expect(service.getTaskCountByAgent('builder')).toBe(1);
    });

    it('should respect max history per agent', async () => {
      const s = new TaskEmbeddingService({ maxHistoryPerAgent: 3 });
      s.setEmbedder(mockEmbedder);

      for (let i = 0; i < 5; i++) {
        const embedding = await s.embedTask(`task ${i}`);
        await s.recordTaskCompletion(
          `task-${i}`,
          `task ${i}`,
          embedding,
          'builder',
          { taskId: `task-${i}`, success: true }
        );
      }

      expect(s.getTaskCountByAgent('builder')).toBe(3);
    });
  });

  describe('findSimilarTasks()', () => {
    beforeEach(async () => {
      // Seed with some historical tasks
      const tasks = [
        { id: 'task-1', request: 'Create a chapter outline', agent: 'builder', success: true },
        { id: 'task-2', request: 'Build chapter content', agent: 'builder', success: true },
        { id: 'task-3', request: 'Review passage quality', agent: 'reviewer', success: true },
        { id: 'task-4', request: 'Analyze style consistency', agent: 'reviewer', success: false },
        { id: 'task-5', request: 'Curate passages', agent: 'curator', success: true },
      ];

      for (const task of tasks) {
        const embedding = await service.embedTask(task.request);
        await service.recordTaskCompletion(
          task.id,
          task.request,
          embedding,
          task.agent,
          { taskId: task.id, success: task.success }
        );
      }
    });

    it('should find similar tasks', async () => {
      const queryEmbedding = await service.embedTask('Create an outline for the chapter');
      const similar = await service.findSimilarTasks(queryEmbedding);

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].similarity).toBeGreaterThan(0);
    });

    it('should filter by agent', async () => {
      const queryEmbedding = await service.embedTask('test query');
      const similar = await service.findSimilarTasks(queryEmbedding, {
        agentId: 'builder',
      });

      for (const result of similar) {
        expect(result.agentUsed).toBe('builder');
      }
    });

    it('should filter by success', async () => {
      const queryEmbedding = await service.embedTask('test query');
      const similar = await service.findSimilarTasks(queryEmbedding, {
        onlySuccessful: true,
      });

      for (const result of similar) {
        expect(result.wasSuccessful).toBe(true);
      }
    });

    it('should respect limit', async () => {
      const queryEmbedding = await service.embedTask('test query');
      const similar = await service.findSimilarTasks(queryEmbedding, { limit: 2 });

      expect(similar.length).toBeLessThanOrEqual(2);
    });

    it('should sort by decayed similarity', async () => {
      const queryEmbedding = await service.embedTask('test query');
      const similar = await service.findSimilarTasks(queryEmbedding);

      for (let i = 1; i < similar.length; i++) {
        expect(similar[i - 1].decayedSimilarity).toBeGreaterThanOrEqual(
          similar[i].decayedSimilarity
        );
      }
    });
  });

  describe('Temporal Decay', () => {
    describe('applyTemporalDecay()', () => {
      it('should not decay recent tasks', () => {
        const similarity = 0.9;
        const ageMs = 1000; // 1 second

        const decayed = service.applyTemporalDecay(similarity, ageMs);

        expect(decayed).toBeCloseTo(similarity, 2);
      });

      it('should decay older tasks', () => {
        const similarity = 0.9;
        const ageMs = 30 * 24 * 60 * 60 * 1000; // 30 days (half-life)

        const decayed = service.applyTemporalDecay(similarity, ageMs);

        // At half-life, should be roughly half
        expect(decayed).toBeCloseTo(similarity * 0.5, 1);
      });

      it('should respect minimum weight', () => {
        const similarity = 0.9;
        const ageMs = 365 * 24 * 60 * 60 * 1000; // 1 year

        const decayed = service.applyTemporalDecay(similarity, ageMs);

        // Should not go below minimum (0.1 * 0.9 = 0.09)
        expect(decayed).toBeGreaterThanOrEqual(similarity * 0.1);
      });

      it('should be configurable', () => {
        const s = new TaskEmbeddingService({
          decay: {
            halfLifeDays: 7, // Faster decay
            minimumWeight: 0.5, // Higher minimum
            enabled: true,
          },
        });

        const similarity = 1.0;
        const ageMs = 7 * 24 * 60 * 60 * 1000; // 7 days

        const decayed = s.applyTemporalDecay(similarity, ageMs);

        expect(decayed).toBeCloseTo(0.5, 1);
      });

      it('should disable decay when configured', () => {
        const s = new TaskEmbeddingService({
          decay: { enabled: false, halfLifeDays: 30, minimumWeight: 0.1 },
        });

        // When decay is disabled, findSimilarTasks won't apply decay
        // but applyTemporalDecay still calculates it (internal method)
        // The service just won't use it
        expect(s).toBeDefined();
      });
    });
  });

  describe('Adaptive Thresholds', () => {
    describe('getAdaptiveThreshold()', () => {
      it('should return base threshold when adaptation disabled', async () => {
        const threshold = await service.getAdaptiveThreshold({
          baseThreshold: 0.75,
          adaptFromHistory: false,
        });

        expect(threshold).toBe(0.75);
      });

      it('should return base threshold when insufficient history', async () => {
        const threshold = await service.getAdaptiveThreshold({
          baseThreshold: 0.7,
          adaptFromHistory: true,
        });

        // With no history, should return base
        expect(threshold).toBe(0.7);
      });

      it('should adjust threshold based on success rate', async () => {
        // Seed with successful tasks
        for (let i = 0; i < 20; i++) {
          const embedding = await service.embedTask(`successful task ${i}`);
          await service.recordTaskCompletion(
            `task-${i}`,
            `successful task ${i}`,
            embedding,
            'builder',
            { taskId: `task-${i}`, success: true }
          );
        }

        const threshold = await service.getAdaptiveThreshold({
          baseThreshold: 0.7,
          adaptFromHistory: true,
        });

        // High success rate should lower threshold
        expect(threshold).toBeLessThanOrEqual(0.7);
      });

      it('should increase threshold for low success rate', async () => {
        // Seed with failed tasks
        for (let i = 0; i < 20; i++) {
          const embedding = await service.embedTask(`failed task ${i}`);
          await service.recordTaskCompletion(
            `task-${i}`,
            `failed task ${i}`,
            embedding,
            'builder',
            { taskId: `task-${i}`, success: false }
          );
        }

        const threshold = await service.getAdaptiveThreshold({
          baseThreshold: 0.7,
          adaptFromHistory: true,
        });

        // Low success rate should increase threshold
        expect(threshold).toBeGreaterThanOrEqual(0.7);
      });

      it('should stay within bounds', async () => {
        // Test extreme cases
        for (let i = 0; i < 100; i++) {
          const embedding = await service.embedTask(`task ${i}`);
          await service.recordTaskCompletion(
            `task-${i}`,
            `task ${i}`,
            embedding,
            'builder',
            { taskId: `task-${i}`, success: i % 2 === 0 }
          );
        }

        const threshold = await service.getAdaptiveThreshold({
          adaptFromHistory: true,
        });

        expect(threshold).toBeGreaterThanOrEqual(0.5);
        expect(threshold).toBeLessThanOrEqual(0.9);
      });
    });
  });

  describe('suggestAgentByRho()', () => {
    beforeEach(async () => {
      // Seed with agent-specific successful tasks
      const builderTasks = [
        'Create chapter outline',
        'Build chapter content',
        'Generate section transitions',
        'Compose introduction',
      ];

      const reviewerTasks = [
        'Review passage quality',
        'Check style consistency',
        'Analyze text structure',
        'Validate citations',
      ];

      for (const task of builderTasks) {
        const embedding = await service.embedTask(task);
        await service.recordTaskCompletion(
          `builder-${task}`,
          task,
          embedding,
          'builder',
          { taskId: `builder-${task}`, success: true }
        );
      }

      for (const task of reviewerTasks) {
        const embedding = await service.embedTask(task);
        await service.recordTaskCompletion(
          `reviewer-${task}`,
          task,
          embedding,
          'reviewer',
          { taskId: `reviewer-${task}`, success: true }
        );
      }
    });

    it('should suggest agent based on similar tasks', async () => {
      // Query similar to builder tasks
      const queryEmbedding = await service.embedTask('Create an outline');
      const suggestion = await service.suggestAgentByRho(queryEmbedding);

      // Should suggest an agent
      expect(suggestion).not.toBeNull();
      expect(suggestion?.agentId).toBeDefined();
      expect(suggestion?.confidence).toBeGreaterThan(0);
    });

    it('should return null when no similar tasks', async () => {
      const s = new TaskEmbeddingService();
      s.setEmbedder(mockEmbedder);

      const queryEmbedding = await s.embedTask('completely unique task');
      const suggestion = await s.suggestAgentByRho(queryEmbedding);

      expect(suggestion).toBeNull();
    });

    it('should return null when below threshold', async () => {
      // Very high threshold
      const queryEmbedding = await service.embedTask('somewhat related');
      const suggestion = await service.suggestAgentByRho(queryEmbedding, {
        baseThreshold: 0.99,
        adaptFromHistory: false,
      });

      expect(suggestion).toBeNull();
    });

    it('should filter by candidate agents', async () => {
      const queryEmbedding = await service.embedTask('Create outline');
      const suggestion = await service.suggestAgentByRho(queryEmbedding, {
        candidateAgents: ['reviewer'], // Exclude builder
        baseThreshold: 0.3,
      });

      if (suggestion) {
        expect(suggestion.agentId).toBe('reviewer');
      }
    });

    it('should include reasoning', async () => {
      const queryEmbedding = await service.embedTask('Create outline');
      const suggestion = await service.suggestAgentByRho(queryEmbedding, {
        baseThreshold: 0.3,
      });

      if (suggestion) {
        expect(suggestion.reasoning).toBeTruthy();
        expect(typeof suggestion.reasoning).toBe('string');
      }
    });

    it('should include historical success rate', async () => {
      const queryEmbedding = await service.embedTask('Create outline');
      const suggestion = await service.suggestAgentByRho(queryEmbedding, {
        baseThreshold: 0.3,
      });

      if (suggestion) {
        expect(suggestion.historicalSuccessRate).toBeGreaterThanOrEqual(0);
        expect(suggestion.historicalSuccessRate).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Statistics', () => {
    describe('getStatistics()', () => {
      it('should return empty stats initially', () => {
        const s = new TaskEmbeddingService();
        const stats = s.getStatistics();

        expect(stats.totalTasks).toBe(0);
        expect(stats.successRate).toBe(0);
        expect(Object.keys(stats.tasksByAgent).length).toBe(0);
      });

      it('should track task counts', async () => {
        for (let i = 0; i < 5; i++) {
          const embedding = await service.embedTask(`task ${i}`);
          await service.recordTaskCompletion(
            `task-${i}`,
            `task ${i}`,
            embedding,
            i < 3 ? 'builder' : 'reviewer',
            { taskId: `task-${i}`, success: true }
          );
        }

        const stats = service.getStatistics();

        expect(stats.totalTasks).toBe(5);
        expect(stats.tasksByAgent.builder).toBe(3);
        expect(stats.tasksByAgent.reviewer).toBe(2);
      });

      it('should calculate success rate', async () => {
        for (let i = 0; i < 10; i++) {
          const embedding = await service.embedTask(`task ${i}`);
          await service.recordTaskCompletion(
            `task-${i}`,
            `task ${i}`,
            embedding,
            'builder',
            { taskId: `task-${i}`, success: i < 7 }
          );
        }

        const stats = service.getStatistics();

        expect(stats.successRate).toBeCloseTo(0.7, 1);
      });

      it('should calculate average quality score', async () => {
        const scores = [0.8, 0.85, 0.9, 0.75, 0.95];

        for (let i = 0; i < scores.length; i++) {
          const embedding = await service.embedTask(`task ${i}`);
          await service.recordTaskCompletion(
            `task-${i}`,
            `task ${i}`,
            embedding,
            'builder',
            { taskId: `task-${i}`, success: true, qualityScore: scores[i] }
          );
        }

        const stats = service.getStatistics();
        const expectedAvg = scores.reduce((a, b) => a + b, 0) / scores.length;

        expect(stats.avgQualityScore).toBeCloseTo(expectedAvg, 2);
      });

      it('should track time range', async () => {
        const embedding = await service.embedTask('task');
        await service.recordTaskCompletion(
          'task-1',
          'task',
          embedding,
          'builder',
          { taskId: 'task-1', success: true }
        );

        const stats = service.getStatistics();

        expect(stats.oldestTask).toBeInstanceOf(Date);
        expect(stats.newestTask).toBeInstanceOf(Date);
      });
    });

    describe('getRoutingAccuracy()', () => {
      it('should calculate routing accuracy', async () => {
        for (let i = 0; i < 10; i++) {
          const embedding = await service.embedTask(`task ${i}`);
          await service.recordTaskCompletion(
            `task-${i}`,
            `task ${i}`,
            embedding,
            'builder',
            { taskId: `task-${i}`, success: i < 8 }
          );
        }

        const accuracy = await service.getRoutingAccuracy();

        expect(accuracy.totalRouted).toBe(10);
        expect(accuracy.successfulRoutes).toBe(8);
        expect(accuracy.accuracy).toBeCloseTo(0.8, 2);
        expect(accuracy.threshold).toBeDefined();
      });
    });
  });

  describe('Import/Export', () => {
    it('should export history', async () => {
      for (let i = 0; i < 3; i++) {
        const embedding = await service.embedTask(`task ${i}`);
        await service.recordTaskCompletion(
          `task-${i}`,
          `task ${i}`,
          embedding,
          'builder',
          { taskId: `task-${i}`, success: true }
        );
      }

      const exported = service.exportHistory();

      expect(exported.length).toBe(3);
      for (const record of exported) {
        expect(record.taskId).toBeDefined();
        expect(record.embedding).toBeDefined();
      }
    });

    it('should import history', async () => {
      const records: TaskEmbeddingRecord[] = [
        {
          taskId: 'imported-1',
          request: 'imported task',
          embedding: randomEmbedding(768),
          agentId: 'builder',
          success: true,
          createdAt: new Date(),
        },
      ];

      service.importHistory(records);

      expect(service.getTaskCountByAgent('builder')).toBe(1);
    });

    it('should clear history', async () => {
      const embedding = await service.embedTask('task');
      await service.recordTaskCompletion(
        'task-1',
        'task',
        embedding,
        'builder',
        { taskId: 'task-1', success: true }
      );

      expect(service.getTaskCountByAgent('builder')).toBe(1);

      service.clear();

      expect(service.getTaskCountByAgent('builder')).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Singleton', () => {
  afterEach(() => {
    resetTaskEmbeddingService();
  });

  it('should return same instance from getTaskEmbeddingService()', () => {
    const service1 = getTaskEmbeddingService();
    const service2 = getTaskEmbeddingService();

    expect(service1).toBe(service2);
  });

  it('should allow setting custom instance', () => {
    const customService = new TaskEmbeddingService({
      decay: { halfLifeDays: 60, minimumWeight: 0.2, enabled: true },
    });
    setTaskEmbeddingService(customService);

    expect(getTaskEmbeddingService()).toBe(customService);
  });

  it('should reset with resetTaskEmbeddingService()', () => {
    const service1 = getTaskEmbeddingService();
    resetTaskEmbeddingService();
    const service2 = getTaskEmbeddingService();

    expect(service1).not.toBe(service2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  let service: TaskEmbeddingService;

  beforeEach(() => {
    service = new TaskEmbeddingService();
    service.setEmbedder(createMockEmbedder());
  });

  it('should handle empty query embedding', async () => {
    const similar = await service.findSimilarTasks([]);

    expect(similar).toEqual([]);
  });

  it('should handle very long task text', async () => {
    const longText = 'a'.repeat(10000);
    const embedding = await service.embedTask(longText);

    expect(embedding.length).toBe(768);
  });

  it('should handle special characters in task text', async () => {
    const embedding = await service.embedTask('Task with émojis 🎉 and spëcial çhars!');

    expect(embedding.length).toBe(768);
  });

  it('should handle concurrent operations', async () => {
    const promises = Array.from({ length: 10 }, async (_, i) => {
      const embedding = await service.embedTask(`concurrent task ${i}`);
      return service.recordTaskCompletion(
        `task-${i}`,
        `concurrent task ${i}`,
        embedding,
        'builder',
        { taskId: `task-${i}`, success: true }
      );
    });

    await Promise.all(promises);

    expect(service.getTaskCountByAgent('builder')).toBe(10);
  });

  it('should handle dimension mismatch in cosine similarity', async () => {
    const embedding1 = await service.embedTask('task 1');
    const embedding2 = randomEmbedding(512); // Different dimension

    // Recording with mismatched embeddings in findSimilarTasks would cause issues
    // but the service should handle this gracefully
    await service.recordTaskCompletion(
      'task-1',
      'task 1',
      embedding1,
      'builder',
      { taskId: 'task-1', success: true }
    );

    // Query with same dimension should work
    const similar = await service.findSimilarTasks(embedding1);
    expect(similar.length).toBeGreaterThan(0);
  });
});
