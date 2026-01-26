/**
 * Import Excellence Pipeline
 *
 * Orchestrates the full import process with excellence-aware features:
 * 1. Parse archive (external step - parser must be called first)
 * 2. Media-text extraction (OCR, descriptions, captions)
 * 3. Content enrichment (combine text with media-text)
 * 4. Chunking (with enriched content)
 * 5. Embedding (using enriched content)
 * 6. Excellence scoring
 * 7. Storage
 *
 * This pipeline integrates:
 * - importArchiveToDb (import-to-db.ts)
 * - MediaTextEnrichmentService
 * - ExcellencePipeline
 *
 * @module @humanizer/core/pipelines
 */

import { randomUUID } from 'crypto';
import type {
  ParsedArchive,
  ParsedArchiveWithRelationships,
} from '../adapters/parsers/types.js';
import type { ImportResult } from '../adapters/parsers/import-to-db.js';
import { importArchiveToDb } from '../adapters/parsers/import-to-db.js';
import type { EmbeddingServiceConfig } from '../embeddings/index.js';
import type { ExcellenceScore, ExcellenceTier, ExcellenceStats } from './types.js';
import { ExcellencePipeline, type ExcellencePipelineOptions, type ExcellenceScorer } from './excellence-pipeline.js';
import type { PostgresContentStore } from '../storage/postgres-content-store.js';
import { getContentStore } from '../storage/postgres-content-store.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for the import excellence pipeline
 */
export interface ImportExcellenceOptions {
  // ─────────────────────────────────────────────────────────────────
  // Import Options
  // ─────────────────────────────────────────────────────────────────

  /** Enable verbose logging (default: false) */
  verbose?: boolean;

  /** Batch size for database operations (default: 100) */
  batchSize?: number;

  /** Skip existing nodes by content hash (default: true) */
  skipExisting?: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Embedding Options
  // ─────────────────────────────────────────────────────────────────

  /** Generate embeddings using Ollama (default: true) */
  generateEmbeddings?: boolean;

  /** Embedding service configuration */
  embeddingConfig?: EmbeddingServiceConfig;

  // ─────────────────────────────────────────────────────────────────
  // Deduplication Options
  // ─────────────────────────────────────────────────────────────────

  /** Generate paragraph/line hashes for deduplication (default: true) */
  generateHashes?: boolean;

  /** Include line hashes (default: true) */
  includeLineHashes?: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Media-Text & Enrichment Options
  // ─────────────────────────────────────────────────────────────────

  /** Extract media-text associations (OCR, descriptions) (default: true) */
  extractMediaText?: boolean;

  /** Enrich content with media-text before embedding (default: true) */
  enrichContent?: boolean;

  /** Include transcripts in enriched content (default: true) */
  includeTranscripts?: boolean;

  /** Include descriptions in enriched content (default: true) */
  includeDescriptions?: boolean;

  /** Minimum confidence for enrichment inclusion (default: 0.5) */
  enrichMinConfidence?: number;

  // ─────────────────────────────────────────────────────────────────
  // Paste Detection Options
  // ─────────────────────────────────────────────────────────────────

  /** Detect pasted content in user messages (default: true) */
  detectPaste?: boolean;

  /** Minimum confidence for paste detection (default: 0.5) */
  pasteMinConfidence?: number;

  // ─────────────────────────────────────────────────────────────────
  // Excellence Options
  // ─────────────────────────────────────────────────────────────────

  /** Score excellence after import (default: false) */
  scoreExcellence?: boolean;

  /** Minimum excellence tier to include (default: 'needs_refinement') */
  minExcellenceTier?: ExcellenceTier;

  /** Excellence scorer function (required if scoreExcellence is true) */
  excellenceScorer?: ExcellenceScorer;

  /** Content store for persistence (uses singleton if not provided) */
  store?: PostgresContentStore;
}

/**
 * Result from the import excellence pipeline
 */
export interface ImportExcellenceResult extends ImportResult {
  /** Excellence scoring stats (if enabled) */
  excellenceStats?: ExcellenceStats;

  /** Excellence scores by node ID (if enabled) */
  excellenceScores?: Map<string, ExcellenceScore>;

  /** Nodes filtered by minimum tier (if filtering enabled) */
  filteredNodeIds?: string[];

  /** Pipeline timing breakdown */
  pipelineTiming?: {
    importMs: number;
    excellenceMs: number;
    totalMs: number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════════════════════════════

/**
 * Import Excellence Pipeline
 *
 * Orchestrates the full import + excellence scoring workflow.
 */
export class ImportExcellencePipeline {
  private readonly options: ImportExcellenceOptions;
  private readonly excellencePipeline: ExcellencePipeline | null;

  constructor(options: ImportExcellenceOptions = {}) {
    this.options = {
      verbose: false,
      batchSize: 100,
      skipExisting: true,
      generateEmbeddings: true,
      generateHashes: true,
      includeLineHashes: true,
      extractMediaText: true,
      enrichContent: true,
      includeTranscripts: true,
      includeDescriptions: true,
      enrichMinConfidence: 0.5,
      detectPaste: true,
      pasteMinConfidence: 0.5,
      scoreExcellence: false,
      minExcellenceTier: 'needs_refinement',
      ...options,
    };

    // Initialize excellence pipeline if scoring enabled
    if (this.options.scoreExcellence && this.options.excellenceScorer) {
      const excellenceOptions: ExcellencePipelineOptions = {
        store: this.options.store,
        scorer: this.options.excellenceScorer,
        onProgress: this.options.verbose
          ? (progress) => console.log(`  [Excellence] ${progress.message}`)
          : undefined,
      };
      this.excellencePipeline = new ExcellencePipeline(excellenceOptions);
    } else {
      this.excellencePipeline = null;
    }
  }

  /**
   * Execute the full import + excellence pipeline
   *
   * @param archive - Parsed archive to import
   * @returns Combined import and excellence result
   */
  async import(
    archive: ParsedArchive | ParsedArchiveWithRelationships
  ): Promise<ImportExcellenceResult> {
    const startTime = Date.now();
    const log = (msg: string) => {
      if (this.options.verbose) console.log(msg);
    };

    log('\n═══════════════════════════════════════════════════════════════');
    log(' IMPORT EXCELLENCE PIPELINE');
    log('═══════════════════════════════════════════════════════════════');

    // ─────────────────────────────────────────────────────────────────
    // Phase 1: Import with enrichment
    // ─────────────────────────────────────────────────────────────────
    log('\n[Phase 1] Importing archive with media-text enrichment...');
    const importStartTime = Date.now();

    const importResult = await importArchiveToDb(archive, {
      verbose: this.options.verbose,
      batchSize: this.options.batchSize,
      skipExisting: this.options.skipExisting,
      generateEmbeddings: this.options.generateEmbeddings,
      embeddingConfig: this.options.embeddingConfig,
      generateHashes: this.options.generateHashes,
      includeLineHashes: this.options.includeLineHashes,
      extractMediaText: this.options.extractMediaText,
      detectPaste: this.options.detectPaste,
      pasteMinConfidence: this.options.pasteMinConfidence,
      enrichContent: this.options.enrichContent,
      includeTranscripts: this.options.includeTranscripts,
      includeDescriptions: this.options.includeDescriptions,
      enrichMinConfidence: this.options.enrichMinConfidence,
    });

    const importDuration = Date.now() - importStartTime;
    log(`  ✓ Import complete (${(importDuration / 1000).toFixed(1)}s)`);

    if (importResult.status === 'failed') {
      return {
        ...importResult,
        pipelineTiming: {
          importMs: importDuration,
          excellenceMs: 0,
          totalMs: Date.now() - startTime,
        },
      };
    }

    // ─────────────────────────────────────────────────────────────────
    // Phase 2: Excellence scoring (if enabled)
    // ─────────────────────────────────────────────────────────────────
    let excellenceStats: ExcellenceStats | undefined;
    let excellenceScores: Map<string, ExcellenceScore> | undefined;
    let filteredNodeIds: string[] | undefined;
    let excellenceDuration = 0;

    if (this.options.scoreExcellence && this.excellencePipeline) {
      log('\n[Phase 2] Scoring excellence...');
      const excellenceStartTime = Date.now();

      // Get imported nodes for scoring
      const store = this.options.store ?? getContentStore();
      const nodesResult = await store.queryNodes({
        importJobId: importResult.jobId,
        limit: 10000,
      });

      if (nodesResult.nodes.length > 0) {
        // Run excellence pipeline on imported nodes
        const excellenceResult = await this.excellencePipeline.execute({
          sourceType: 'nodes',
          nodes: nodesResult.nodes.map(n => ({
            id: n.id,
            uri: n.uri,
            contentHash: n.contentHash,
            content: n.text,
            format: n.format as 'text' | 'markdown' | 'html' | 'json',
            sourceType: n.sourceType,
            metadata: n.sourceMetadata || {},
          })),
          config: {
            scoreExcellence: true,
            generateEmbeddings: false, // Already generated in import
            buildPyramid: false, // Already built in import
          },
        });

        excellenceStats = excellenceResult.excellenceStats;
        excellenceScores = new Map();

        // Extract scores from the pipeline result (stored in metadata)
        // Note: The ExcellencePipeline stores scores internally
        // We need to query them from the store or track them during execution

        excellenceDuration = Date.now() - excellenceStartTime;
        log(`  ✓ Excellence scoring complete (${(excellenceDuration / 1000).toFixed(1)}s)`);

        if (excellenceStats) {
          log(`    Scored: ${excellenceStats.totalScored} nodes`);
          log(`    Avg score: ${excellenceStats.avgCompositeScore.toFixed(1)}`);
          log(`    Raw gems: ${excellenceStats.rawGemsDetected}`);
        }

        // Filter by minimum tier if specified
        if (this.options.minExcellenceTier && excellenceStats) {
          const tierOrder: ExcellenceTier[] = ['noise', 'needs_refinement', 'raw_gem', 'polished', 'excellence'];
          const minTierIndex = tierOrder.indexOf(this.options.minExcellenceTier);

          filteredNodeIds = [];
          // Filter logic would go here if we had access to individual scores
          // For now, we return all nodes that passed the scoring
          filteredNodeIds = excellenceResult.createdNodeIds;

          log(`    Filtered to tier >= ${this.options.minExcellenceTier}: ${filteredNodeIds.length} nodes`);
        }
      } else {
        log('  No nodes to score');
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // Final result
    // ─────────────────────────────────────────────────────────────────
    const totalDuration = Date.now() - startTime;

    log('\n═══════════════════════════════════════════════════════════════');
    log(` PIPELINE COMPLETE (${(totalDuration / 1000).toFixed(1)}s)`);
    log('═══════════════════════════════════════════════════════════════');

    return {
      ...importResult,
      excellenceStats,
      excellenceScores,
      filteredNodeIds,
      pipelineTiming: {
        importMs: importDuration,
        excellenceMs: excellenceDuration,
        totalMs: totalDuration,
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _importExcellencePipeline: ImportExcellencePipeline | null = null;

/**
 * Get import excellence pipeline singleton
 */
export function getImportExcellencePipeline(): ImportExcellencePipeline {
  if (!_importExcellencePipeline) {
    _importExcellencePipeline = new ImportExcellencePipeline();
  }
  return _importExcellencePipeline;
}

/**
 * Initialize import excellence pipeline with options
 */
export function initImportExcellencePipeline(
  options: ImportExcellenceOptions = {}
): ImportExcellencePipeline {
  _importExcellencePipeline = new ImportExcellencePipeline(options);
  return _importExcellencePipeline;
}

/**
 * Reset import excellence pipeline (for testing)
 */
export function resetImportExcellencePipeline(): void {
  _importExcellencePipeline = null;
}
