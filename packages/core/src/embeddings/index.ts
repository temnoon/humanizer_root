/**
 * Embeddings Module
 *
 * Provides 3-level embedding infrastructure:
 * - L0: Base chunks (~1000 tokens each)
 * - L1: Summary embeddings (grouped L0 chunks)
 * - Apex: Document synthesis
 *
 * Uses OllamaAdapter (nomic-embed-text) for embeddings.
 */

export {
  EmbeddingService,
  getEmbeddingService,
  initEmbeddingService,
  resetEmbeddingService,
} from './embedding-service.js';

export type {
  EmbeddingServiceConfig,
  EmbeddingBatchResult,
  ContentEmbeddingResult,
} from './embedding-service.js';
