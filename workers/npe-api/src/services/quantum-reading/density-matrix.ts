/**
 * Density Matrix Operations for Quantum Reading Analysis
 *
 * Implements 32×32 density matrix (ρ) construction and analysis.
 * Based on quantum mechanics formalism from humanizer/ml/density.py
 */

import { matrix, Matrix, multiply, add, eigs, trace, log, transpose, conj, MathArray } from 'mathjs';

const RANK = 32; // Simplified from 64×64 for Workers performance
const SHRINKAGE_ALPHA = 0.01; // Regularization parameter

export interface DensityMatrixState {
  matrix: number[][]; // 32×32 matrix
  purity: number;     // Tr(ρ²) ∈ [1/32, 1]
  entropy: number;    // -Tr(ρ log ρ) ∈ [0, ln(32)]
  eigenvalues: number[]; // Sorted descending
  timestamp: string;
}

/**
 * Create initial maximally-mixed density matrix (ρ₀)
 * Represents "blank slate" reader with uniform distribution
 */
export function createMaximallyMixedState(): DensityMatrixState {
  // ρ = (1/N) * I (identity matrix scaled)
  const uniformProb = 1.0 / RANK;
  const rhoMatrix: number[][] = Array(RANK).fill(0).map((_, i) =>
    Array(RANK).fill(0).map((_, j) => i === j ? uniformProb : 0)
  );

  const purity = 1.0 / RANK; // Tr(ρ²) for maximally mixed state
  const entropy = Math.log(RANK); // Maximum entropy

  return {
    matrix: rhoMatrix,
    purity,
    entropy,
    eigenvalues: Array(RANK).fill(uniformProb),
    timestamp: new Date().toISOString()
  };
}

/**
 * Construct density matrix from embedding vector
 *
 * Process:
 * 1. Project embedding to RANK dimensions
 * 2. Create scatter matrix S = v ⊗ v^T
 * 3. Add shrinkage: S + α*I
 * 4. Eigendecompose and normalize
 */
export function constructDensityMatrix(embedding: number[]): DensityMatrixState {
  // Project to RANK dimensions if needed
  const projectedEmbedding = projectToRank(embedding, RANK);

  // Normalize
  const norm = Math.sqrt(projectedEmbedding.reduce((sum, x) => sum + x * x, 0));
  const normalized = projectedEmbedding.map(x => x / norm);

  // Create scatter matrix: S = v ⊗ v^T
  const scatterMatrix = matrix(
    normalized.map(vi =>
      normalized.map(vj => vi * vj)
    )
  );

  // Add shrinkage: S + α*I
  const identityMatrix = matrix(
    Array(RANK).fill(0).map((_, i) =>
      Array(RANK).fill(0).map((_, j) => i === j ? SHRINKAGE_ALPHA : 0)
    )
  );

  const regularized = add(scatterMatrix, identityMatrix) as Matrix;

  // Eigendecomposition
  const { values: eigenvalues } = eigs(regularized);

  // Extract real parts and sort descending
  const realEigenvalues = (Array.isArray(eigenvalues) ? eigenvalues : eigenvalues.toArray() as MathArray)
    .map((v: any) => typeof v === 'number' ? v : v.re)
    .filter((v: number) => !isNaN(v) && isFinite(v))
    .sort((a: number, b: number) => b - a);

  // Normalize eigenvalues
  const sumEigenvalues = realEigenvalues.reduce((sum: number, v: number) => sum + v, 0);
  const normalizedEigenvalues = realEigenvalues.map((v: number) => v / sumEigenvalues);

  // Construct ρ from eigendecomposition (simplified: use diagonal matrix)
  // For full implementation, would reconstruct from eigenvectors
  const rhoMatrix: number[][] = Array(RANK).fill(0).map((_, i) =>
    Array(RANK).fill(0).map((_, j) =>
      i === j ? (normalizedEigenvalues[i] || 0) : 0
    )
  );

  // Compute purity: Tr(ρ²)
  const purity = computePurity(rhoMatrix);

  // Compute entropy: -Tr(ρ log ρ)
  const entropy = computeEntropy(normalizedEigenvalues);

  return {
    matrix: rhoMatrix,
    purity,
    entropy,
    eigenvalues: normalizedEigenvalues.slice(0, RANK),
    timestamp: new Date().toISOString()
  };
}

/**
 * Project high-dimensional embedding to RANK dimensions
 * Uses simple averaging for dimensionality reduction
 */
function projectToRank(embedding: number[], targetDim: number): number[] {
  const embeddingDim = embedding.length;

  if (embeddingDim <= targetDim) {
    // Pad with zeros if embedding is smaller
    return [...embedding, ...Array(targetDim - embeddingDim).fill(0)];
  }

  // Average blocks of dimensions
  const blockSize = Math.floor(embeddingDim / targetDim);
  const projected: number[] = [];

  for (let i = 0; i < targetDim; i++) {
    const start = i * blockSize;
    const end = i === targetDim - 1 ? embeddingDim : (i + 1) * blockSize;
    const block = embedding.slice(start, end);
    const avg = block.reduce((sum, x) => sum + x, 0) / block.length;
    projected.push(avg);
  }

  return projected;
}

/**
 * Compute purity: Tr(ρ²)
 * Range: [1/N, 1] where 1/N = maximally mixed, 1 = pure state
 */
function computePurity(rhoMatrix: number[][]): number {
  // For diagonal matrix, Tr(ρ²) = Σ λᵢ²
  let purity = 0;
  for (let i = 0; i < RANK; i++) {
    purity += rhoMatrix[i][i] * rhoMatrix[i][i];
  }
  return Math.max(1.0 / RANK, Math.min(1.0, purity)); // Clamp to valid range
}

/**
 * Compute von Neumann entropy: -Tr(ρ log ρ) = -Σ λᵢ log λᵢ
 * Range: [0, ln(N)] where 0 = pure state, ln(N) = maximally mixed
 */
function computeEntropy(eigenvalues: number[]): number {
  let entropy = 0;
  for (const lambda of eigenvalues) {
    if (lambda > 1e-10) { // Avoid log(0)
      entropy -= lambda * Math.log(lambda);
    }
  }
  return Math.max(0, Math.min(Math.log(RANK), entropy)); // Clamp to valid range
}

/**
 * Update density matrix after measurement (simplified)
 * In full quantum theory, this would be: ρ' = E_i ρ E_i† / Tr(E_i ρ E_i†)
 *
 * Simplified: Blend current ρ with new measurement-induced state
 */
export function updateDensityMatrixAfterMeasurement(
  currentRho: DensityMatrixState,
  newEmbedding: number[],
  measurementWeight: number = 0.3 // How much the measurement affects state
): DensityMatrixState {
  const newRho = constructDensityMatrix(newEmbedding);

  // Weighted blend of current and new state
  const blendedMatrix: number[][] = currentRho.matrix.map((row, i) =>
    row.map((val, j) =>
      (1 - measurementWeight) * val + measurementWeight * newRho.matrix[i][j]
    )
  );

  // Renormalize to ensure Tr(ρ) = 1
  const traceVal = blendedMatrix.reduce((sum, row, i) => sum + row[i], 0);
  const normalized = blendedMatrix.map(row => row.map(val => val / traceVal));

  // Extract diagonal eigenvalues (simplified)
  const eigenvalues = normalized.map((row, i) => row[i]).sort((a, b) => b - a);

  return {
    matrix: normalized,
    purity: computePurity(normalized),
    entropy: computeEntropy(eigenvalues),
    eigenvalues,
    timestamp: new Date().toISOString()
  };
}

/**
 * Serialize density matrix state to JSON string
 * Stores only essential information to reduce storage
 */
export function serializeDensityMatrix(rho: DensityMatrixState): string {
  return JSON.stringify({
    // Store only diagonal (eigenvalues) for simplified representation
    eigenvalues: rho.eigenvalues,
    purity: rho.purity,
    entropy: rho.entropy,
    timestamp: rho.timestamp
  });
}

/**
 * Deserialize density matrix from JSON string
 * Reconstructs diagonal matrix from eigenvalues
 */
export function deserializeDensityMatrix(json: string): DensityMatrixState {
  const data = JSON.parse(json);

  // Reconstruct diagonal matrix from eigenvalues
  const matrix: number[][] = Array(RANK).fill(0).map((_, i) =>
    Array(RANK).fill(0).map((_, j) =>
      i === j ? (data.eigenvalues[i] || 0) : 0
    )
  );

  return {
    matrix,
    purity: data.purity,
    entropy: data.entropy,
    eigenvalues: data.eigenvalues,
    timestamp: data.timestamp
  };
}

/**
 * Get top N eigenvalues for display
 */
export function getTopEigenvalues(rho: DensityMatrixState, n: number = 5): number[] {
  return rho.eigenvalues.slice(0, n);
}

/**
 * Compute distance between two density matrices
 * Uses trace distance: D(ρ1, ρ2) = 0.5 * Tr(|ρ1 - ρ2|)
 *
 * Simplified: Eigenvalue distance for diagonal matrices
 */
export function densityMatrixDistance(rho1: DensityMatrixState, rho2: DensityMatrixState): number {
  let distance = 0;
  for (let i = 0; i < RANK; i++) {
    distance += Math.abs((rho1.eigenvalues[i] || 0) - (rho2.eigenvalues[i] || 0));
  }
  return 0.5 * distance;
}
