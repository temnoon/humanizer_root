/**
 * Tests for density matrix operations
 */

import { describe, it, expect } from 'vitest';
import {
  createMaximallyMixedState,
  constructDensityMatrix,
  updateAfterMeasurement,
  densityMatrixDistance,
  getTopEigenvalues,
  serializeDensityMatrix,
  deserializeDensityMatrix,
} from './density-matrix.js';

describe('createMaximallyMixedState', () => {
  it('should create uniform probability distribution', () => {
    const state = createMaximallyMixedState();

    // All eigenvalues should be equal
    const first = state.eigenvalues[0];
    for (const λ of state.eigenvalues) {
      expect(λ).toBeCloseTo(first, 10);
    }
  });

  it('should sum to 1', () => {
    const state = createMaximallyMixedState();
    const sum = state.eigenvalues.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('should have minimum purity', () => {
    const state = createMaximallyMixedState();
    // Purity of maximally mixed state = 1/d
    expect(state.purity).toBeCloseTo(1 / 32, 10);
  });

  it('should have maximum entropy', () => {
    const state = createMaximallyMixedState();
    // Entropy of maximally mixed state = log(d)
    expect(state.entropy).toBeCloseTo(Math.log(32), 10);
  });

  it('should have trace 1', () => {
    const state = createMaximallyMixedState();
    expect(state.trace).toBeCloseTo(1.0, 10);
  });
});

describe('constructDensityMatrix', () => {
  it('should construct from embedding', () => {
    // Create a simple embedding
    const embedding = Array(100).fill(0).map((_, i) => Math.sin(i));
    const state = constructDensityMatrix(embedding);

    expect(state.eigenvalues.length).toBe(32);
    expect(state.trace).toBeCloseTo(1.0, 10);
  });

  it('should normalize to sum 1', () => {
    const embedding = Array(100).fill(1);
    const state = constructDensityMatrix(embedding);

    const sum = state.eigenvalues.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('should sort eigenvalues descending', () => {
    const embedding = Array(100).fill(0).map(() => Math.random());
    const state = constructDensityMatrix(embedding);

    for (let i = 1; i < state.eigenvalues.length; i++) {
      expect(state.eigenvalues[i]).toBeLessThanOrEqual(state.eigenvalues[i - 1]);
    }
  });

  it('should handle short embeddings', () => {
    const embedding = [1, 2, 3];
    const state = constructDensityMatrix(embedding);
    expect(state.eigenvalues.length).toBe(32);
  });

  it('should compute purity in valid range', () => {
    const embedding = Array(100).fill(0).map(() => Math.random());
    const state = constructDensityMatrix(embedding);

    expect(state.purity).toBeGreaterThanOrEqual(1 / 32);
    expect(state.purity).toBeLessThanOrEqual(1);
  });

  it('should compute entropy in valid range', () => {
    const embedding = Array(100).fill(0).map(() => Math.random());
    const state = constructDensityMatrix(embedding);

    expect(state.entropy).toBeGreaterThanOrEqual(0);
    expect(state.entropy).toBeLessThanOrEqual(Math.log(32));
  });
});

describe('updateAfterMeasurement', () => {
  it('should blend current and new state', () => {
    const current = createMaximallyMixedState();
    const newEmbedding = Array(100).fill(0).map((_, i) => i === 0 ? 1 : 0);

    const updated = updateAfterMeasurement(current, newEmbedding, 0.5);

    expect(updated.eigenvalues.length).toBe(32);
    expect(updated.trace).toBeCloseTo(1.0, 10);
  });

  it('should preserve normalization', () => {
    const current = createMaximallyMixedState();
    const newEmbedding = Array(100).fill(0).map(() => Math.random());

    const updated = updateAfterMeasurement(current, newEmbedding, 0.3);

    const sum = updated.eigenvalues.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('should use default weight of 0.3', () => {
    const current = createMaximallyMixedState();
    const newEmbedding = Array(100).fill(0).map(() => Math.random());

    const updated = updateAfterMeasurement(current, newEmbedding);

    expect(updated.eigenvalues.length).toBe(32);
  });
});

describe('densityMatrixDistance', () => {
  it('should return 0 for identical states', () => {
    const state = createMaximallyMixedState();
    const distance = densityMatrixDistance(state, state);
    expect(distance).toBeCloseTo(0, 10);
  });

  it('should return positive distance for different states', () => {
    const state1 = createMaximallyMixedState();
    const embedding = Array(100).fill(0).map((_, i) => i === 0 ? 10 : 0.1);
    const state2 = constructDensityMatrix(embedding);

    const distance = densityMatrixDistance(state1, state2);
    expect(distance).toBeGreaterThan(0);
  });

  it('should be symmetric', () => {
    const state1 = createMaximallyMixedState();
    const embedding = Array(100).fill(0).map(() => Math.random());
    const state2 = constructDensityMatrix(embedding);

    const d12 = densityMatrixDistance(state1, state2);
    const d21 = densityMatrixDistance(state2, state1);
    expect(d12).toBeCloseTo(d21, 10);
  });

  it('should be bounded by 1', () => {
    const state1 = createMaximallyMixedState();
    const embedding = Array(100).fill(0).map(() => Math.random());
    const state2 = constructDensityMatrix(embedding);

    const distance = densityMatrixDistance(state1, state2);
    expect(distance).toBeLessThanOrEqual(1);
  });
});

describe('getTopEigenvalues', () => {
  it('should return top n eigenvalues', () => {
    const state = createMaximallyMixedState();
    const top5 = getTopEigenvalues(state, 5);

    expect(top5.length).toBe(5);
  });

  it('should return eigenvalues in descending order', () => {
    const embedding = Array(100).fill(0).map(() => Math.random());
    const state = constructDensityMatrix(embedding);
    const top5 = getTopEigenvalues(state, 5);

    for (let i = 1; i < top5.length; i++) {
      expect(top5[i]).toBeLessThanOrEqual(top5[i - 1]);
    }
  });

  it('should default to 5', () => {
    const state = createMaximallyMixedState();
    const top = getTopEigenvalues(state);
    expect(top.length).toBe(5);
  });
});

describe('serialization', () => {
  it('should roundtrip through JSON', () => {
    const original = createMaximallyMixedState();
    const json = serializeDensityMatrix(original);
    const restored = deserializeDensityMatrix(json);

    expect(restored.eigenvalues).toEqual(original.eigenvalues);
    expect(restored.purity).toBe(original.purity);
    expect(restored.entropy).toBe(original.entropy);
  });

  it('should reconstruct trace', () => {
    const embedding = Array(100).fill(0).map(() => Math.random());
    const original = constructDensityMatrix(embedding);
    const json = serializeDensityMatrix(original);
    const restored = deserializeDensityMatrix(json);

    expect(restored.trace).toBeCloseTo(1.0, 10);
  });
});
