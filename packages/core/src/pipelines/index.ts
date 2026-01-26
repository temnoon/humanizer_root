/**
 * Pipelines Module
 *
 * Multi-stage batch processing pipelines for content analysis.
 *
 * Currently includes:
 * - ExcellencePipeline: Full content processing with pyramid building and scoring
 *
 * @module @humanizer/core/pipelines
 */

// Types
export type {
  PipelineStage,
  PipelineConfig,
  PipelineInput,
  PipelineOutput,
  PipelineProgress,
  PipelineCheckpoint,
  PipelineEvent,
  PipelineEventType,
  PipelineEventListener,
  ProgressCallback,
  IngestResult,
  ChunkResult,
  EmbedResult,
  SummarizeResult,
  ApexResult,
  ScoreResult,
  IndexResult,
  ExcellenceScore,
  ExcellenceStats,
  ExcellenceTier,
  RawGemDetection,
} from './types.js';

export {
  DEFAULT_PIPELINE_CONFIG,
  STAGE_ORDER,
  STAGE_NAMES,
} from './types.js';

// Excellence Pipeline
export type { ExcellencePipelineOptions, ExcellenceScorer } from './excellence-pipeline.js';
export {
  ExcellencePipeline,
  getExcellencePipeline,
  initExcellencePipeline,
  resetExcellencePipeline,
} from './excellence-pipeline.js';

// Import Excellence Pipeline
export type {
  ImportExcellenceOptions,
  ImportExcellenceResult,
} from './import-excellence-pipeline.js';
export {
  ImportExcellencePipeline,
  getImportExcellencePipeline,
  initImportExcellencePipeline,
  resetImportExcellencePipeline,
} from './import-excellence-pipeline.js';
