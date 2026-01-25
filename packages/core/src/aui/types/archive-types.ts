/**
 * Unified AUI Types - Archive Types
 *
 * Archive, embedding, and clustering types.
 *
 * @module @humanizer/core/aui/types/archive-types
 */

// ═══════════════════════════════════════════════════════════════════════════
// ARCHIVE & EMBEDDING TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Statistics about the archive and embeddings.
 */
export interface ArchiveStats {
  /** Total content nodes */
  totalNodes: number;

  /** Nodes with embeddings */
  nodesWithEmbeddings: number;

  /** Nodes needing embeddings */
  nodesNeedingEmbeddings: number;

  /** Embedding coverage percentage */
  embeddingCoverage: number;

  /** Nodes by source type */
  bySourceType: Record<string, number>;

  /** Nodes by author role */
  byAuthorRole: Record<string, number>;

  /** Date range */
  dateRange: {
    earliest: Date | null;
    latest: Date | null;
  };

  /** Average word count */
  avgWordCount: number;

  /** Total word count */
  totalWordCount: number;
}

/**
 * Options for embedding all archive content.
 */
export interface EmbedAllOptions {
  /** Batch size for embedding */
  batchSize?: number;

  /** Minimum word count (filter short messages) */
  minWordCount?: number;

  /** Maximum nodes to process (limit for testing) */
  limit?: number;

  /** Source types to include */
  sourceTypes?: string[];

  /** Author roles to include */
  authorRoles?: ('user' | 'assistant' | 'system' | 'tool')[];

  /** Content filter function */
  contentFilter?: (text: string) => boolean;

  /** Progress callback */
  onProgress?: (progress: EmbeddingProgress) => void;

  /** Whether to skip already embedded nodes */
  skipExisting?: boolean;
}

/**
 * Progress update during embedding.
 */
export interface EmbeddingProgress {
  /** Current phase */
  phase: 'loading' | 'filtering' | 'embedding' | 'storing' | 'complete';

  /** Nodes processed */
  processed: number;

  /** Total nodes */
  total: number;

  /** Current batch */
  currentBatch: number;

  /** Total batches */
  totalBatches: number;

  /** Nodes skipped (already embedded or filtered) */
  skipped: number;

  /** Nodes failed */
  failed: number;

  /** Elapsed time (ms) */
  elapsedMs: number;

  /** Estimated remaining time (ms) */
  estimatedRemainingMs: number;

  /** Current node being processed */
  currentNode?: string;

  /** Error messages */
  errors: string[];
}

/**
 * Result from embedding operation.
 */
export interface EmbedResult {
  /** Whether operation succeeded */
  success: boolean;

  /** Nodes embedded */
  embedded: number;

  /** Nodes skipped */
  skipped: number;

  /** Nodes failed */
  failed: number;

  /** Duration (ms) */
  durationMs: number;

  /** Error message (if failed) */
  error?: string;

  /** Detailed errors */
  errors: Array<{ nodeId: string; error: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUSTERING TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for cluster discovery.
 */
export interface ClusterDiscoveryOptions {
  /** Sample size for random node selection */
  sampleSize?: number;

  /** Minimum cluster size */
  minClusterSize?: number;

  /** Maximum clusters to return */
  maxClusters?: number;

  /** Minimum similarity threshold for cluster membership */
  minSimilarity?: number;

  /** Alias for minSimilarity */
  similarityThreshold?: number;

  /** Content filters (exclude certain patterns) */
  excludePatterns?: string[];

  /** Minimum word count for passages */
  minWordCount?: number;

  /** Source types to include */
  sourceTypes?: string[];

  /** Author roles to include */
  authorRoles?: ('user' | 'assistant')[];

  /** Whether to generate cluster labels using LLM */
  generateLabels?: boolean;

  /** Progress callback */
  onProgress?: (progress: ClusteringProgress) => void;
}

/**
 * Progress update during clustering.
 */
export interface ClusteringProgress {
  /** Current phase */
  phase: 'loading' | 'sampling' | 'clustering' | 'labeling' | 'complete';

  /** Current step */
  step: number;

  /** Total steps */
  totalSteps: number;

  /** Message */
  message: string;
}

/**
 * A discovered cluster of semantically related content.
 */
export interface ContentCluster {
  /** Cluster ID */
  id: string;

  /** Generated label for this cluster */
  label: string;

  /** Cluster description */
  description: string;

  /** Representative passages (top by centrality) */
  passages: ClusterPassage[];

  /** Number of total passages in cluster */
  totalPassages: number;

  /** Cluster coherence score (0-1) */
  coherence: number;

  /** Keywords extracted from cluster */
  keywords: string[];

  /** Source distribution */
  sourceDistribution: Record<string, number>;

  /** Date range of passages */
  dateRange: {
    earliest: Date | null;
    latest: Date | null;
  };

  /** Average word count */
  avgWordCount: number;

  /** Centroid embedding (optional) */
  centroid?: number[];
}

/**
 * A passage within a cluster.
 */
export interface ClusterPassage {
  /** Node ID */
  id: string;

  /** Text content */
  text: string;

  /** Source type */
  sourceType: string;

  /** Author role */
  authorRole?: string;

  /** Word count */
  wordCount: number;

  /** Distance from cluster centroid (0 = center) */
  distanceFromCentroid: number;

  /** Source created date */
  sourceCreatedAt?: Date;

  /** Conversation/thread title */
  title?: string;
}

/**
 * Result from cluster discovery.
 */
export interface ClusterDiscoveryResult {
  /** Discovered clusters */
  clusters: ContentCluster[];

  /** Total passages analyzed */
  totalPassages: number;

  /** Passages assigned to clusters */
  assignedPassages: number;

  /** Noise passages (not assigned) */
  noisePassages: number;

  /** Duration (ms) */
  durationMs: number;
}
