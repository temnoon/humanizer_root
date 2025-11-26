/**
 * Embeddings Module
 *
 * Unified embedding system for conversation archives.
 * Uses SQLite + sqlite-vec for portable per-archive storage.
 */

export { EmbeddingDatabase } from './EmbeddingDatabase.js';
export { ArchiveIndexer, type IndexingOptions } from './ArchiveIndexer.js';
export { ClusteringService, type ClusteringOptions, type DiscoveredCluster, type AnchorResult } from './ClusteringService.js';
export {
  walkArchive,
  extractConversation,
  splitIntoParagraphs,
  splitIntoSentences,
  estimateTokens,
  generateChunkId,
  type ExtractedConversation,
  type WalkOptions,
} from './ConversationWalker.js';
export {
  initializeEmbedding,
  embed,
  embedBatch,
  getEmbeddingDimension,
  getModelName,
  isInitialized,
  cosineSimilarity,
  computeCentroid,
  findMedoid,
  findFurthest,
} from './EmbeddingGenerator.js';
export * from './types.js';
