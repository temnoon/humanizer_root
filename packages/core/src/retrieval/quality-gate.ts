/**
 * Quality-Gated Retrieval Pipeline
 *
 * Filters and enriches search results through quality gates:
 *
 * 1. Word count filtering (≥30 words)
 * 2. Quality score filtering (≥0.4)
 * 3. Context expansion for short chunks (fetch parent)
 * 4. Statistics collection
 *
 * This ensures retrieval results are substantive and contextually complete.
 */

import type { PostgresContentStore } from '../storage/postgres-content-store.js';
import type { StoredNode } from '../storage/types.js';
import type {
  FusedResult,
  QualityGateOptions,
  QualityGatedResult,
  EnrichedResult,
  QualityIndicators,
  QualityGateStats,
} from './types.js';
import {
  DEFAULT_QUALITY_GATE_OPTIONS,
  MIN_WORD_COUNT,
  MIN_QUALITY_SCORE,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// QUALITY GATE PIPELINE
// ═══════════════════════════════════════════════════════════════════

/**
 * Quality-gated retrieval pipeline
 */
export class QualityGatedPipeline {
  private readonly store: PostgresContentStore;
  private readonly options: Required<QualityGateOptions>;

  constructor(
    store: PostgresContentStore,
    options: QualityGateOptions = {}
  ) {
    this.store = store;
    this.options = { ...DEFAULT_QUALITY_GATE_OPTIONS, ...options };
  }

  /**
   * Process results through quality gates
   */
  async process(results: FusedResult[]): Promise<QualityGatedResult> {
    const startTime = Date.now();

    const stats: QualityGateStats = {
      inputCount: results.length,
      passedCount: 0,
      filteredByWords: 0,
      filteredByQuality: 0,
      contextExpandedCount: 0,
      processingTimeMs: 0,
    };

    const enrichedResults: EnrichedResult[] = [];

    for (const result of results) {
      const indicators = this.evaluateQuality(result);

      if (!indicators.passedGate) {
        if (!indicators.hasMinWords) {
          stats.filteredByWords++;
        }
        if (!indicators.hasMinQuality) {
          stats.filteredByQuality++;
        }
        continue;
      }

      // Expand context for short chunks if enabled
      let enriched: EnrichedResult = {
        ...result,
        contextExpanded: false,
        qualityIndicators: indicators,
      };

      if (
        this.options.expandContext &&
        result.node.wordCount < this.options.minWordCount * 2 &&
        result.node.parentNodeId
      ) {
        const expanded = await this.expandContext(result);
        if (expanded) {
          enriched = expanded;
          stats.contextExpandedCount++;
        }
      }

      enrichedResults.push(enriched);
      stats.passedCount++;
    }

    stats.processingTimeMs = Date.now() - startTime;

    return { results: enrichedResults, stats };
  }

  /**
   * Evaluate quality indicators for a result
   */
  private evaluateQuality(result: FusedResult): QualityIndicators {
    const wordCount = result.node.wordCount;
    const qualityScore = this.getQualityScore(result.node);

    const hasMinWords = wordCount >= this.options.minWordCount;
    const hasMinQuality = qualityScore >= this.options.minQualityScore;
    const isComplete = !this.isTruncated(result.node);

    return {
      hasMinWords,
      hasMinQuality,
      isComplete,
      passedGate: hasMinWords && hasMinQuality,
    };
  }

  /**
   * Get quality score for a node
   * Falls back to estimated score if not available
   */
  private getQualityScore(node: StoredNode): number {
    // Check if quality score is in metadata
    const metadata = node.sourceMetadata as Record<string, unknown> | undefined;

    if (metadata?.qualityScore !== undefined) {
      return metadata.qualityScore as number;
    }

    // Estimate quality based on content characteristics
    return this.estimateQuality(node);
  }

  /**
   * Estimate quality score based on content characteristics
   */
  private estimateQuality(node: StoredNode): number {
    let score = 0.5; // Base score

    // Word count contribution
    if (node.wordCount >= 100) {
      score += 0.2;
    } else if (node.wordCount >= 50) {
      score += 0.1;
    }

    // Has title
    if (node.title) {
      score += 0.1;
    }

    // Not a system message
    if (node.authorRole !== 'system') {
      score += 0.1;
    }

    // Has tags (suggests categorization)
    if (node.tags && node.tags.length > 0) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * Check if content appears truncated
   */
  private isTruncated(node: StoredNode): boolean {
    const text = node.text;

    // Check for common truncation patterns
    if (text.endsWith('...')) return true;
    if (text.endsWith('[truncated]')) return true;
    if (text.endsWith('[continued]')) return true;

    // Check if chunk offsets indicate partial content
    if (node.chunkIndex !== undefined && node.chunkIndex > 0) {
      // Not first chunk - may be missing context
      return true;
    }

    return false;
  }

  /**
   * Expand context by fetching parent node
   */
  private async expandContext(result: FusedResult): Promise<EnrichedResult | null> {
    const parentId = result.node.parentNodeId;
    if (!parentId) return null;

    const parentNode = await this.store.getNode(parentId);
    if (!parentNode) return null;

    // Combine parent and current content
    const contextText = this.combineContext(parentNode, result.node);

    return {
      ...result,
      parentNode,
      contextText,
      contextExpanded: true,
      qualityIndicators: {
        hasMinWords: true,
        hasMinQuality: true,
        isComplete: true,
        passedGate: true,
      },
    };
  }

  /**
   * Combine parent and child content for context
   */
  private combineContext(parent: StoredNode, child: StoredNode): string {
    // If child is at beginning of parent, return parent text
    if (child.chunkIndex === 0 || child.chunkStartOffset === 0) {
      return parent.text;
    }

    // Otherwise, prepend parent context
    const parentPreview = parent.text.slice(0, 500);
    const ellipsis = parent.text.length > 500 ? '...\n\n' : '\n\n';

    return `[Context from parent]\n${parentPreview}${ellipsis}[Current chunk]\n${child.text}`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Quick quality check without full pipeline
 */
export function passesQualityGate(
  node: StoredNode,
  options: QualityGateOptions = {}
): boolean {
  const minWords = options.minWordCount ?? MIN_WORD_COUNT;
  const minQuality = options.minQualityScore ?? MIN_QUALITY_SCORE;

  if (node.wordCount < minWords) {
    return false;
  }

  // Estimate quality
  const metadata = node.sourceMetadata as Record<string, unknown> | undefined;
  const qualityScore = (metadata?.qualityScore as number) ?? 0.5;

  return qualityScore >= minQuality;
}

/**
 * Filter results by quality gate (simplified)
 */
export function filterByQuality(
  results: FusedResult[],
  options: QualityGateOptions = {}
): FusedResult[] {
  return results.filter((result) => passesQualityGate(result.node, options));
}

/**
 * Get results that need context expansion
 */
export function getNeedingExpansion(
  results: FusedResult[],
  options: QualityGateOptions = {}
): FusedResult[] {
  const minWords = options.minWordCount ?? MIN_WORD_COUNT;

  return results.filter(
    (result) =>
      result.node.wordCount < minWords * 2 &&
      result.node.parentNodeId !== undefined
  );
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _qualityPipeline: QualityGatedPipeline | null = null;

/**
 * Get quality-gated pipeline singleton
 */
export function getQualityPipeline(
  store: PostgresContentStore,
  options: QualityGateOptions = {}
): QualityGatedPipeline {
  if (!_qualityPipeline) {
    _qualityPipeline = new QualityGatedPipeline(store, options);
  }
  return _qualityPipeline;
}

/**
 * Initialize quality pipeline
 */
export function initQualityPipeline(
  store: PostgresContentStore,
  options: QualityGateOptions = {}
): QualityGatedPipeline {
  _qualityPipeline = new QualityGatedPipeline(store, options);
  return _qualityPipeline;
}

/**
 * Reset quality pipeline (for testing)
 */
export function resetQualityPipeline(): void {
  _qualityPipeline = null;
}
