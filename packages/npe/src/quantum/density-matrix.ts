/**
 * Density Matrix Operations
 *
 * Implements embedding-based "density matrix" representation.
 *
 * HONEST REBRANDING NOTE:
 * This is NOT true quantum mechanics. It's a classical probability distribution
 * derived from embedding vectors that we call a "density matrix" by analogy.
 * The math is inspired by quantum formalism but operates on semantic embeddings.
 *
 * What it actually does:
 * - Projects embeddings to a lower-dimensional space (RANK=32)
 * - Uses squared normalized values as a probability distribution
 * - Computes purity and entropy as measures of distribution concentration
 *
 * What it DOESN'T do:
 * - Actual quantum superposition (no complex amplitudes)
 * - True quantum measurement (no projection operators)
 * - Born rule computation (p(i) = Tr(ρ E_i))
 * - Coherences (off-diagonal elements are zero)
 */

import type { DensityMatrixState } from '../types.js';

const RANK = 32;

/**
 * Create maximally-mixed state (uniform distribution)
 * Represents maximum uncertainty / "blank slate"
 */
export function createMaximallyMixedState(): DensityMatrixState {
  const uniformProb = 1.0 / RANK;
  const eigenvalues = Array(RANK).fill(uniformProb);

  return {
    eigenvalues,
    purity: 1.0 / RANK,  // Minimum purity
    entropy: Math.log(RANK),  // Maximum entropy
    trace: 1.0,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Construct density matrix from embedding
 *
 * Process:
 * 1. Project embedding to RANK dimensions
 * 2. Normalize to unit vector
 * 3. Square values to get probabilities
 * 4. Sort descending (eigenvalue convention)
 */
export function constructDensityMatrix(embedding: number[]): DensityMatrixState {
  // Project to RANK dimensions
  const projected = projectToRank(embedding, RANK);

  // Normalize to unit vector
  const norm = Math.sqrt(projected.reduce((sum, x) => sum + x * x, 0));
  const normalized = projected.map(x => x / (norm || 1));

  // Square to get probabilities
  let probs = normalized.map(x => x * x);

  // Ensure they sum to 1
  const sumProbs = probs.reduce((sum, p) => sum + p, 0);
  probs = probs.map(p => p / (sumProbs || 1));

  // Sort descending (eigenvalue convention)
  const eigenvalues = [...probs].sort((a, b) => b - a);
  const trace = eigenvalues.reduce((sum, λ) => sum + λ, 0);

  return {
    eigenvalues,
    purity: computePurity(eigenvalues),
    entropy: computeEntropy(eigenvalues),
    trace,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Update density matrix after "measurement"
 *
 * This blends the current state with a new observation.
 * NOT true quantum collapse - just weighted averaging.
 */
export function updateAfterMeasurement(
  currentRho: DensityMatrixState,
  newEmbedding: number[],
  weight: number = 0.3
): DensityMatrixState {
  const newRho = constructDensityMatrix(newEmbedding);

  // Weighted blend
  const blended = currentRho.eigenvalues.map((val, i) =>
    (1 - weight) * val + weight * newRho.eigenvalues[i]
  );

  // Renormalize
  const sum = blended.reduce((s, v) => s + v, 0);
  const normalized = blended.map(v => v / sum);

  // Re-sort
  const eigenvalues = [...normalized].sort((a, b) => b - a);

  return {
    eigenvalues,
    purity: computePurity(eigenvalues),
    entropy: computeEntropy(eigenvalues),
    trace: 1.0,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Compute distance between two density matrices
 * Uses trace distance: D(ρ1, ρ2) = ½ Σ|λ1_i - λ2_i|
 */
export function densityMatrixDistance(
  rho1: DensityMatrixState,
  rho2: DensityMatrixState
): number {
  let distance = 0;
  for (let i = 0; i < RANK; i++) {
    distance += Math.abs((rho1.eigenvalues[i] || 0) - (rho2.eigenvalues[i] || 0));
  }
  return 0.5 * distance;
}

/**
 * Get top eigenvalues
 */
export function getTopEigenvalues(rho: DensityMatrixState, n: number = 5): number[] {
  return rho.eigenvalues.slice(0, n);
}

/**
 * Serialize to JSON
 */
export function serializeDensityMatrix(rho: DensityMatrixState): string {
  return JSON.stringify({
    eigenvalues: rho.eigenvalues,
    purity: rho.purity,
    entropy: rho.entropy,
    timestamp: rho.timestamp,
  });
}

/**
 * Deserialize from JSON
 */
export function deserializeDensityMatrix(json: string): DensityMatrixState {
  const data = JSON.parse(json);
  return {
    eigenvalues: data.eigenvalues,
    purity: data.purity,
    entropy: data.entropy,
    trace: data.eigenvalues.reduce((sum: number, λ: number) => sum + λ, 0),
    timestamp: data.timestamp,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Project embedding to target dimensions
 */
function projectToRank(embedding: number[], targetDim: number): number[] {
  const embeddingDim = embedding.length;

  if (embeddingDim <= targetDim) {
    return [...embedding, ...Array(targetDim - embeddingDim).fill(0)];
  }

  // Average blocks
  const blockSize = Math.floor(embeddingDim / targetDim);
  const projected: number[] = [];

  for (let i = 0; i < targetDim; i++) {
    const start = i * blockSize;
    const end = i === targetDim - 1 ? embeddingDim : (i + 1) * blockSize;
    const block = embedding.slice(start, end);
    projected.push(block.reduce((sum, x) => sum + x, 0) / block.length);
  }

  return projected;
}

/**
 * Compute purity: Tr(ρ²) = Σλᵢ²
 * Range: [1/RANK, 1] where 1 = pure state, 1/RANK = maximally mixed
 */
function computePurity(eigenvalues: number[]): number {
  const purity = eigenvalues.reduce((sum, λ) => sum + λ * λ, 0);
  return Math.max(1.0 / RANK, Math.min(1.0, purity));
}

/**
 * Compute entropy: -Σλᵢ log(λᵢ)
 * Range: [0, log(RANK)] where 0 = pure, log(RANK) = maximally mixed
 */
function computeEntropy(eigenvalues: number[]): number {
  let entropy = 0;
  for (const λ of eigenvalues) {
    if (λ > 1e-10) {
      entropy -= λ * Math.log(λ);
    }
  }
  return Math.max(0, Math.min(Math.log(RANK), entropy));
}
