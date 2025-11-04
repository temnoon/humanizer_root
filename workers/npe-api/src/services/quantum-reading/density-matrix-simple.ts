/**
 * Simplified Density Matrix Operations for Cloudflare Workers
 *
 * Avoids complex eigenvalue computations that don't work well in Workers
 * Uses a simpler diagonal approximation that's Workers-compatible
 */

const RANK = 32;

export interface DensityMatrixState {
  matrix: number[][]; // 32×32 diagonal matrix
  purity: number;     // Tr(ρ²) ∈ [1/32, 1]
  entropy: number;    // -Tr(ρ log ρ) ∈ [0, ln(32)]
  eigenvalues: number[]; // Diagonal elements (sorted descending)
  timestamp: string;
}

/**
 * Create initial maximally-mixed density matrix (ρ₀)
 */
export function createMaximallyMixedState(): DensityMatrixState {
  const uniformProb = 1.0 / RANK;
  const eigenvalues = Array(RANK).fill(uniformProb);

  return {
    matrix: createDiagonalMatrix(eigenvalues),
    purity: 1.0 / RANK,
    entropy: Math.log(RANK),
    eigenvalues,
    timestamp: new Date().toISOString()
  };
}

/**
 * Construct density matrix from embedding (simplified)
 * Uses squared normalized embedding as diagonal probabilities
 */
export function constructDensityMatrix(embedding: number[]): DensityMatrixState {
  // Project to RANK dimensions
  const projected = projectToRank(embedding, RANK);

  // Normalize
  const norm = Math.sqrt(projected.reduce((sum, x) => sum + x * x, 0));
  const normalized = projected.map(x => x / (norm || 1));

  // Use squared values as probabilities (diagonal of ρ)
  let probs = normalized.map(x => x * x);

  // Normalize probabilities to sum to 1
  const sumProbs = probs.reduce((sum, p) => sum + p, 0);
  probs = probs.map(p => p / (sumProbs || 1));

  // Sort descending (eigenvalues)
  const eigenvalues = [...probs].sort((a, b) => b - a);

  return {
    matrix: createDiagonalMatrix(eigenvalues),
    purity: computePurity(eigenvalues),
    entropy: computeEntropy(eigenvalues),
    eigenvalues,
    timestamp: new Date().toISOString()
  };
}

/**
 * Update density matrix after measurement
 * Blends current state with new measurement
 */
export function updateDensityMatrixAfterMeasurement(
  currentRho: DensityMatrixState,
  newEmbedding: number[],
  weight: number = 0.3
): DensityMatrixState {
  const newRho = constructDensityMatrix(newEmbedding);

  // Weighted blend of eigenvalues
  const blended = currentRho.eigenvalues.map((val, i) =>
    (1 - weight) * val + weight * newRho.eigenvalues[i]
  );

  // Renormalize
  const sum = blended.reduce((s, v) => s + v, 0);
  const normalized = blended.map(v => v / sum);

  // Re-sort
  const eigenvalues = [...normalized].sort((a, b) => b - a);

  return {
    matrix: createDiagonalMatrix(eigenvalues),
    purity: computePurity(eigenvalues),
    entropy: computeEntropy(eigenvalues),
    eigenvalues,
    timestamp: new Date().toISOString()
  };
}

/**
 * Helper: Create diagonal matrix from eigenvalues
 */
function createDiagonalMatrix(eigenvalues: number[]): number[][] {
  return Array(RANK).fill(0).map((_, i) =>
    Array(RANK).fill(0).map((_, j) => i === j ? (eigenvalues[i] || 0) : 0)
  );
}

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
 * Compute purity from eigenvalues: Tr(ρ²) = Σλᵢ²
 */
function computePurity(eigenvalues: number[]): number {
  const purity = eigenvalues.reduce((sum, λ) => sum + λ * λ, 0);
  return Math.max(1.0 / RANK, Math.min(1.0, purity));
}

/**
 * Compute entropy: -Σλᵢ log(λᵢ)
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

/**
 * Serialize to JSON
 */
export function serializeDensityMatrix(rho: DensityMatrixState): string {
  return JSON.stringify({
    eigenvalues: rho.eigenvalues,
    purity: rho.purity,
    entropy: rho.entropy,
    timestamp: rho.timestamp
  });
}

/**
 * Deserialize from JSON
 */
export function deserializeDensityMatrix(json: string): DensityMatrixState {
  const data = JSON.parse(json);

  return {
    matrix: createDiagonalMatrix(data.eigenvalues),
    purity: data.purity,
    entropy: data.entropy,
    eigenvalues: data.eigenvalues,
    timestamp: data.timestamp
  };
}

/**
 * Get top N eigenvalues
 */
export function getTopEigenvalues(rho: DensityMatrixState, n: number = 5): number[] {
  return rho.eigenvalues.slice(0, n);
}

/**
 * Distance between density matrices (eigenvalue distance)
 */
export function densityMatrixDistance(rho1: DensityMatrixState, rho2: DensityMatrixState): number {
  let distance = 0;
  for (let i = 0; i < RANK; i++) {
    distance += Math.abs((rho1.eigenvalues[i] || 0) - (rho2.eigenvalues[i] || 0));
  }
  return 0.5 * distance;
}
