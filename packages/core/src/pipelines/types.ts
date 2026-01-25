/**
 * Excellence Pipeline Types
 *
 * Type definitions for the multi-stage content processing pipeline.
 *
 * Pipeline Stages:
 * 1. Ingest - Load content from source
 * 2. Chunk - Break into L0 base nodes
 * 3. Embed L0 - Generate embeddings for chunks
 * 4. Summarize L1 - Create summary level
 * 5. Apex - Create document synthesis
 * 6. Score - Calculate excellence scores
 * 7. Index - Store in database
 *
 * @module @humanizer/core/pipelines
 */

import type { StoredNode } from '../storage/types.js';
import type { PyramidNode, ApexNode, PyramidStats } from '../pyramid/types.js';
import type { ImportedNode } from '../adapters/types.js';

// ═══════════════════════════════════════════════════════════════════
// PIPELINE STAGES
// ═══════════════════════════════════════════════════════════════════

/**
 * Pipeline stage identifiers
 */
export type PipelineStage =
  | 'ingest'
  | 'chunk'
  | 'embed-l0'
  | 'summarize-l1'
  | 'apex'
  | 'score'
  | 'index'
  | 'complete'
  | 'error';

/**
 * Stage display names
 */
export const STAGE_NAMES: Record<PipelineStage, string> = {
  ingest: 'Ingest',
  chunk: 'Chunk',
  'embed-l0': 'Embed L0',
  'summarize-l1': 'Summarize L1',
  apex: 'Apex Synthesis',
  score: 'Excellence Scoring',
  index: 'Index Storage',
  complete: 'Complete',
  error: 'Error',
};

/**
 * Stage order for progression
 */
export const STAGE_ORDER: readonly PipelineStage[] = [
  'ingest',
  'chunk',
  'embed-l0',
  'summarize-l1',
  'apex',
  'score',
  'index',
  'complete',
] as const;

// ═══════════════════════════════════════════════════════════════════
// PIPELINE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Pipeline configuration options
 */
export interface PipelineConfig {
  /** Maximum items to process in parallel */
  parallelism: number;

  /** Batch size for database operations */
  batchSize: number;

  /** Whether to generate embeddings */
  generateEmbeddings: boolean;

  /** Whether to build pyramid structure */
  buildPyramid: boolean;

  /** Whether to score excellence */
  scoreExcellence: boolean;

  /** Minimum confidence for excellence scoring */
  minExcellenceConfidence: number;

  /** Whether to save checkpoints */
  enableCheckpoints: boolean;

  /** Checkpoint interval (number of items) */
  checkpointInterval: number;

  /** Whether to continue from last checkpoint */
  resumeFromCheckpoint: boolean;

  /** Job ID for tracking */
  jobId?: string;
}

/**
 * Default pipeline configuration
 */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  parallelism: 4,
  batchSize: 100,
  generateEmbeddings: true,
  buildPyramid: true,
  scoreExcellence: true,
  minExcellenceConfidence: 0.5,
  enableCheckpoints: true,
  checkpointInterval: 500,
  resumeFromCheckpoint: false,
};

// ═══════════════════════════════════════════════════════════════════
// PIPELINE INPUT/OUTPUT
// ═══════════════════════════════════════════════════════════════════

/**
 * Input for pipeline execution
 */
export interface PipelineInput {
  /** Content source type */
  sourceType: 'archive' | 'import' | 'nodes' | 'text';

  /** Path to archive or import folder */
  sourcePath?: string;

  /** Pre-loaded nodes (for sourceType: 'nodes') */
  nodes?: ImportedNode[];

  /** Raw text content (for sourceType: 'text') */
  text?: string;

  /** Title for the content */
  title?: string;

  /** Thread/document root ID (auto-generated if not provided) */
  threadRootId?: string;

  /** Configuration overrides */
  config?: Partial<PipelineConfig>;

  /** Resume from checkpoint file */
  checkpointFile?: string;
}

/**
 * Output from pipeline execution
 */
export interface PipelineOutput {
  /** Pipeline job ID */
  jobId: string;

  /** Whether pipeline completed successfully */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Final stage reached */
  finalStage: PipelineStage;

  /** Total items processed */
  totalProcessed: number;

  /** Created node IDs */
  createdNodeIds: string[];

  /** Pyramid statistics (if built) */
  pyramidStats?: PyramidStats;

  /** Excellence scoring results */
  excellenceStats?: ExcellenceStats;

  /** Timing breakdown by stage */
  timingMs: Record<PipelineStage, number>;

  /** Total duration in milliseconds */
  totalDurationMs: number;

  /** Checkpoint file path (if enabled) */
  checkpointFile?: string;
}

// ═══════════════════════════════════════════════════════════════════
// PROGRESS TRACKING
// ═══════════════════════════════════════════════════════════════════

/**
 * Pipeline progress information
 */
export interface PipelineProgress {
  /** Current stage */
  stage: PipelineStage;

  /** Stage index (0-based) */
  stageIndex: number;

  /** Total stages */
  totalStages: number;

  /** Progress within current stage (0-1) */
  stageProgress: number;

  /** Overall progress (0-1) */
  overallProgress: number;

  /** Items processed in current stage */
  itemsProcessed: number;

  /** Total items in current stage */
  totalItems: number;

  /** Current item description */
  currentItem?: string;

  /** Human-readable message */
  message: string;

  /** Elapsed time in milliseconds */
  elapsedMs: number;

  /** Estimated remaining time in milliseconds */
  estimatedRemainingMs?: number;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: PipelineProgress) => void;

// ═══════════════════════════════════════════════════════════════════
// CHECKPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Checkpoint data for resumable processing
 */
export interface PipelineCheckpoint {
  /** Job ID */
  jobId: string;

  /** Timestamp of checkpoint */
  timestamp: number;

  /** Last completed stage */
  lastCompletedStage: PipelineStage;

  /** Last processed item index */
  lastProcessedIndex: number;

  /** Accumulated results */
  accumulatedResults: {
    /** Node IDs created so far */
    createdNodeIds: string[];

    /** L0 nodes created */
    l0NodeIds: string[];

    /** L1 nodes created */
    l1NodeIds: string[];

    /** Apex node ID */
    apexNodeId?: string;

    /** Scored node count */
    scoredCount: number;

    /** Indexed node count */
    indexedCount: number;
  };

  /** Timing so far */
  timingMs: Partial<Record<PipelineStage, number>>;

  /** Original input (for resumption) */
  input: PipelineInput;
}

// ═══════════════════════════════════════════════════════════════════
// EXCELLENCE SCORING
// ═══════════════════════════════════════════════════════════════════

/**
 * Excellence score for a piece of content
 */
export interface ExcellenceScore {
  /** Composite score (0-100) */
  compositeScore: number;

  /** Score dimensions */
  dimensions: {
    /** Novel ideas per paragraph */
    insightDensity: number;

    /** Clarity and memorability */
    expressivePower: number;

    /** Reader connection potential */
    emotionalResonance: number;

    /** Flow and pacing quality */
    structuralElegance: number;

    /** Distinctiveness of voice */
    voiceAuthenticity: number;
  };

  /** Quality tier */
  tier: ExcellenceTier;

  /** Standout quotes from the content */
  standoutQuotes: string[];

  /** Confidence in the score (0-1) */
  confidence: number;
}

/**
 * Excellence tier classification
 */
export type ExcellenceTier =
  | 'excellence'       // 80+: Outstanding content
  | 'polished'         // 60-79: Good quality
  | 'needs_refinement' // 40-59: Has potential
  | 'raw_gem'          // High insight, low expression
  | 'noise';           // <40: Low value

/**
 * Raw gem detection result
 */
export interface RawGemDetection {
  /** Node ID */
  nodeId: string;

  /** Probability this is a raw gem (0-1) */
  gemProbability: number;

  /** Writing quality score (0-1) */
  writingQualityScore: number;

  /** Insight quality score (0-1) */
  insightQualityScore: number;

  /** Gap between insight and writing quality */
  qualityGap: number;

  /** Extractable insights found */
  extractableInsights: Array<{
    location: string;
    insight: string;
    originalPhrasing: string;
    confidence: number;
  }>;

  /** Noise segments to remove */
  noiseToRemove: string[];
}

/**
 * Excellence statistics from pipeline
 */
export interface ExcellenceStats {
  /** Total nodes scored */
  totalScored: number;

  /** Average composite score */
  avgCompositeScore: number;

  /** Counts by tier */
  tierCounts: Record<ExcellenceTier, number>;

  /** Raw gems detected */
  rawGemsDetected: number;

  /** Average dimension scores */
  avgDimensions: ExcellenceScore['dimensions'];

  /** Top standout quotes */
  topQuotes: Array<{
    quote: string;
    nodeId: string;
    score: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════════
// STAGE RESULTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Result from ingest stage
 */
export interface IngestResult {
  /** Number of items ingested */
  count: number;

  /** Ingested nodes */
  nodes: ImportedNode[];

  /** Source metadata */
  sourceMetadata?: Record<string, unknown>;
}

/**
 * Result from chunk stage
 */
export interface ChunkResult {
  /** Number of chunks created */
  count: number;

  /** L0 pyramid nodes */
  l0Nodes: PyramidNode[];

  /** Total word count */
  totalWords: number;
}

/**
 * Result from embed stage
 */
export interface EmbedResult {
  /** Number of nodes embedded */
  count: number;

  /** Nodes with embeddings */
  embeddedNodeIds: string[];

  /** Embedding model used */
  model: string;

  /** Embedding dimensions */
  dimensions: number;
}

/**
 * Result from summarize stage
 */
export interface SummarizeResult {
  /** Number of L1 summaries created */
  count: number;

  /** L1 pyramid nodes */
  l1Nodes: PyramidNode[];

  /** Compression ratio from L0 to L1 */
  compressionRatio: number;
}

/**
 * Result from apex stage
 */
export interface ApexResult {
  /** Apex node */
  apex: ApexNode;

  /** Themes extracted */
  themes: string[];

  /** Entities extracted */
  entities: string[];

  /** Overall compression ratio */
  compressionRatio: number;
}

/**
 * Result from score stage
 */
export interface ScoreResult {
  /** Number of nodes scored */
  count: number;

  /** Excellence scores by node ID */
  scores: Map<string, ExcellenceScore>;

  /** Raw gems detected */
  rawGems: RawGemDetection[];
}

/**
 * Result from index stage
 */
export interface IndexResult {
  /** Number of nodes indexed */
  count: number;

  /** Stored node IDs */
  storedNodeIds: string[];

  /** Links created */
  linksCreated: number;
}

// ═══════════════════════════════════════════════════════════════════
// PIPELINE EVENTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Pipeline event types
 */
export type PipelineEventType =
  | 'pipeline:started'
  | 'pipeline:completed'
  | 'pipeline:failed'
  | 'stage:started'
  | 'stage:completed'
  | 'stage:failed'
  | 'checkpoint:saved'
  | 'checkpoint:loaded'
  | 'progress:updated';

/**
 * Pipeline event
 */
export interface PipelineEvent {
  /** Event type */
  type: PipelineEventType;

  /** Job ID */
  jobId: string;

  /** Timestamp */
  timestamp: number;

  /** Stage (if applicable) */
  stage?: PipelineStage;

  /** Progress (if applicable) */
  progress?: PipelineProgress;

  /** Error (if applicable) */
  error?: Error;

  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Event listener type
 */
export type PipelineEventListener = (event: PipelineEvent) => void;
