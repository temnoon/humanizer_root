/**
 * Quantum Reading Module
 *
 * Embedding-based semantic analysis using quantum-inspired formalism.
 *
 * This module provides:
 * - Density matrix representation of reader state
 * - Tetralemma (four-corner) measurement
 * - Reading session management with state evolution
 *
 * HONEST REBRANDING:
 * The terminology ("quantum", "density matrix", "POVM") is inspired by
 * quantum mechanics but the implementation operates on classical probability
 * distributions derived from embedding vectors. This is semantic analysis
 * with quantum-inspired math, not actual quantum computing.
 */

export {
  createMaximallyMixedState,
  constructDensityMatrix,
  updateAfterMeasurement,
  densityMatrixDistance,
  getTopEigenvalues,
  serializeDensityMatrix,
  deserializeDensityMatrix,
} from './density-matrix.js';

export {
  measureTetralemma,
  validateMeasurement,
  getDominantCorner,
} from './tetralemma.js';
export type { POVMAxis } from './tetralemma.js';

export { ReadingSessionManager } from './reading-session.js';
export type {
  EmbedderFn,
  ReadingSessionOptions,
  ReadingStep,
} from './reading-session.js';
