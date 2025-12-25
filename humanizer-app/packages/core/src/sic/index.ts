/**
 * SIC Module Exports
 *
 * Subjective Intentional Constraint analysis
 */

export { analyzeSIC, quickSIC, batchAnalyzeSIC } from './analyzer.js';
export type { AnalyzeOptions, LLMProvider } from './analyzer.js';
export { POSITIVE_WEIGHTS, NEGATIVE_WEIGHTS } from './weights.js';
export * as lexicons from './lexicons.js';
