/**
 * Vector Analysis Module
 *
 * Sentence-by-sentence trajectory through semantic space.
 * Each sentence has a position; the passage has a trajectory.
 * Inflection points mark where the text pivots.
 */

// Types
export type {
  SemanticPosition,
  SentenceVector,
  Inflection,
  CraftMetrics,
  PassageRho,
  SemanticRegion,
} from '../types/vector.js';

export { SEMANTIC_REGIONS } from '../types/vector.js';

// Position analysis
export {
  analyzePosition,
  identifyRegion,
  positionDistance,
} from './position.js';

// Craft metrics
export { computeCraftMetrics } from './craft.js';

// Trajectory analysis
export {
  analyzePassage,
  compareTrajectories,
  formatTrajectory,
  type TrajectoryComparison,
} from './trajectory.js';
