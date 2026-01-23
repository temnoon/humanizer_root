/**
 * Agents Module
 *
 * Autonomous agents that combine NPE capabilities:
 * - Quantum reading (ρ analysis)
 * - Transformations (persona, style)
 * - Self-iteration based on quality metrics
 */

export {
  BookAgent,
  createBookAgent,
  type BookAgentOptions,
  type BookAgentResult,
  type QualityThresholds,
  type RetryConfig,
  type RhoAnalysis,
  type TransformAttempt,
} from './book-agent.js';
