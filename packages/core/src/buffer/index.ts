/**
 * Content Buffer Module
 *
 * API-first buffer system with full provenance tracking.
 * Enables content to flow between Archive, Buffer, and Book.
 *
 * @module @humanizer/core/buffer
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type {
  // Core buffer types
  ContentBuffer,
  BufferContentFormat,
  BufferState,

  // Origin types
  BufferOrigin,
  SourceType,
  SourceNodeType,
  BufferAuthorRole,
  BookContext,

  // Operation types
  BufferOperation,
  BufferOperationType,
  OperationPerformer,
  OperationHashes,
  QualityImpact,

  // Provenance types
  ProvenanceChain,
  ProvenanceBranch,

  // Quality types (buffer-specific)
  QualityMetrics as BufferQualityMetrics,
  QualityIssue as BufferQualityIssue,
  AIDetectionResult as BufferAIDetectionResult,
  ReadabilityMetrics as BufferReadabilityMetrics,
  VoiceMetrics as BufferVoiceMetrics,

  // Service option types (buffer-specific)
  LoadFromArchiveOptions,
  LoadFromBookOptions,
  CreateFromTextOptions,
  TransformRequest,
  SplitOptions as BufferSplitOptions,
  MergeOptions as BufferMergeOptions,
  CommitToBookOptions,
  ExportToArchiveOptions,
  DerivedBufferResult,

  // Serialization types
  SerializedContentBuffer,
  SerializedProvenanceChain,
  SerializedBufferOperation,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

export type {
  BufferService,
  BufferServiceOptions,
  ArchiveStoreAdapter,
  BooksStoreAdapter,
  AuiStoreAdapter,
} from './buffer-service.js';

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export {
  computeContentHash,
  computeWordCount,
  detectContentFormat,
} from './hash-utils.js';

export {
  ProvenanceTracker,
  createProvenanceChain,
  addOperation,
} from './provenance-tracker.js';

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

export {
  BufferServiceImpl,
  createBufferService,
  getBufferService,
  initBufferService,
  resetBufferService,
} from './buffer-service-impl.js';
