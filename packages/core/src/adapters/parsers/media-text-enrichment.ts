/**
 * Media-Text Enrichment Service
 *
 * Combines node content with extracted media-text (OCR, descriptions, captions)
 * to create enriched content for embedding and retrieval.
 *
 * The enriched content improves semantic search by including:
 * - OCR transcriptions from images
 * - AI-generated image descriptions
 * - User-provided captions
 * - Audio transcripts
 *
 * @module @humanizer/core/adapters/parsers
 */

import type { MediaTextAssociation } from '../../storage/types.js';
import type { ImportedNode } from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Enriched content combining node text with extracted media-text
 */
export interface EnrichedContent {
  /** Original node content */
  original: string;

  /** OCR transcriptions from images/documents */
  transcripts: string[];

  /** AI-generated descriptions of media */
  descriptions: string[];

  /** User-provided captions */
  captions: string[];

  /** All content merged for embedding */
  combined: string;

  /** Average extraction confidence (0-1) */
  confidence: number;

  /** Associated media IDs */
  mediaIds: string[];

  /** Source association types */
  associationTypes: string[];

  /** Total word count of enriched content */
  wordCount: number;
}

/**
 * Options for content enrichment
 */
export interface EnrichmentOptions {
  /** Include OCR transcripts (default: true) */
  includeTranscripts?: boolean;

  /** Include AI descriptions (default: true) */
  includeDescriptions?: boolean;

  /** Include user captions (default: true) */
  includeCaptions?: boolean;

  /** Minimum confidence threshold for inclusion (default: 0.5) */
  minConfidence?: number;

  /** Maximum combined content length (default: 10000) */
  maxCombinedLength?: number;

  /** Separator between content sections (default: '\n\n---\n\n') */
  sectionSeparator?: string;
}

/**
 * Result from batch enrichment
 */
export interface BatchEnrichmentResult {
  /** Enriched content by node ID */
  enrichments: Map<string, EnrichedContent>;

  /** Stats about the enrichment */
  stats: {
    nodesEnriched: number;
    nodesSkipped: number;
    totalTranscripts: number;
    totalDescriptions: number;
    totalCaptions: number;
    avgConfidence: number;
    processingTimeMs: number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_OPTIONS: Required<EnrichmentOptions> = {
  includeTranscripts: true,
  includeDescriptions: true,
  includeCaptions: true,
  minConfidence: 0.5,
  maxCombinedLength: 10000,
  sectionSeparator: '\n\n---\n\n',
};

// ═══════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════

/**
 * Service for enriching node content with media-text associations
 */
export class MediaTextEnrichmentService {
  private readonly options: Required<EnrichmentOptions>;

  constructor(options: EnrichmentOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Enrich a single node with media-text associations
   *
   * @param node - The imported node to enrich
   * @param associations - Media-text associations linked to this node
   * @returns Enriched content combining node text with media-text
   */
  enrichNode(
    node: ImportedNode,
    associations: MediaTextAssociation[]
  ): EnrichedContent {
    const transcripts: string[] = [];
    const descriptions: string[] = [];
    const captions: string[] = [];
    const mediaIds: string[] = [];
    const associationTypes: string[] = [];
    let totalConfidence = 0;
    let confidenceCount = 0;

    // Filter associations by confidence threshold
    const validAssociations = associations.filter(
      (a) => (a.confidence ?? 1) >= this.options.minConfidence
    );

    // Categorize associations
    for (const assoc of validAssociations) {
      if (!assoc.extractedText) continue;

      // Track media IDs
      if (assoc.mediaId && !mediaIds.includes(assoc.mediaId)) {
        mediaIds.push(assoc.mediaId);
      }

      // Track association types
      if (!associationTypes.includes(assoc.associationType)) {
        associationTypes.push(assoc.associationType);
      }

      // Accumulate confidence
      if (assoc.confidence) {
        totalConfidence += assoc.confidence;
        confidenceCount++;
      }

      // Categorize by type
      switch (assoc.associationType) {
        case 'ocr':
          // OCR is a transcript (text extracted from image)
          if (this.options.includeTranscripts) {
            transcripts.push(assoc.extractedText);
          }
          break;

        case 'description':
        case 'title':
          if (this.options.includeDescriptions) {
            descriptions.push(assoc.extractedText);
          }
          break;

        case 'caption':
        case 'alt-text':
          if (this.options.includeCaptions) {
            captions.push(assoc.extractedText);
          }
          break;

        case 'generated-from':
        case 'echo-of':
          // These are relationship types, skip text extraction
          break;
      }
    }

    // Build combined content
    const combined = this.buildCombinedContent(
      node.content,
      transcripts,
      descriptions,
      captions
    );

    // Calculate average confidence
    const avgConfidence = confidenceCount > 0
      ? totalConfidence / confidenceCount
      : 1;

    return {
      original: node.content,
      transcripts,
      descriptions,
      captions,
      combined,
      confidence: avgConfidence,
      mediaIds,
      associationTypes,
      wordCount: this.countWords(combined),
    };
  }

  /**
   * Enrich multiple nodes with their associated media-text
   *
   * @param nodes - Nodes to enrich
   * @param associations - All media-text associations (will be matched by node)
   * @returns Map of node ID to enriched content
   */
  enrichBatch(
    nodes: ImportedNode[],
    associations: MediaTextAssociation[]
  ): BatchEnrichmentResult {
    const startTime = Date.now();
    const enrichments = new Map<string, EnrichedContent>();

    // Index associations by message/conversation ID
    const assocByMessage = new Map<string, MediaTextAssociation[]>();
    const assocByConversation = new Map<string, MediaTextAssociation[]>();

    for (const assoc of associations) {
      if (assoc.messageId) {
        const existing = assocByMessage.get(assoc.messageId) || [];
        existing.push(assoc);
        assocByMessage.set(assoc.messageId, existing);
      }
      if (assoc.conversationId) {
        const existing = assocByConversation.get(assoc.conversationId) || [];
        existing.push(assoc);
        assocByConversation.set(assoc.conversationId, existing);
      }
    }

    // Stats tracking
    let nodesEnriched = 0;
    let nodesSkipped = 0;
    let totalTranscripts = 0;
    let totalDescriptions = 0;
    let totalCaptions = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    // Process each node
    for (const node of nodes) {
      // Find associations for this node
      const nodeAssociations: MediaTextAssociation[] = [];

      // Match by message ID (from metadata.originalId)
      const originalId = node.metadata?.originalId as string | undefined;
      if (originalId && assocByMessage.has(originalId)) {
        nodeAssociations.push(...(assocByMessage.get(originalId) || []));
      }

      // Match by node ID
      if (assocByMessage.has(node.id)) {
        nodeAssociations.push(...(assocByMessage.get(node.id) || []));
      }

      // Match by conversation (thread root)
      const threadId = node.threadRootUri?.split('/').pop();
      if (threadId && assocByConversation.has(threadId)) {
        // Only include if position matches
        const convAssocs = assocByConversation.get(threadId) || [];
        for (const assoc of convAssocs) {
          // Check if this association is for this specific message
          if (assoc.messageId === originalId || assoc.messageId === node.id) {
            nodeAssociations.push(assoc);
          }
        }
      }

      // Skip if no associations found
      if (nodeAssociations.length === 0) {
        nodesSkipped++;
        // Still create enrichment with just original content
        enrichments.set(node.id, {
          original: node.content,
          transcripts: [],
          descriptions: [],
          captions: [],
          combined: node.content,
          confidence: 1,
          mediaIds: [],
          associationTypes: [],
          wordCount: this.countWords(node.content),
        });
        continue;
      }

      // Enrich the node
      const enriched = this.enrichNode(node, nodeAssociations);
      enrichments.set(node.id, enriched);
      nodesEnriched++;

      // Update stats
      totalTranscripts += enriched.transcripts.length;
      totalDescriptions += enriched.descriptions.length;
      totalCaptions += enriched.captions.length;
      totalConfidence += enriched.confidence;
      confidenceCount++;
    }

    return {
      enrichments,
      stats: {
        nodesEnriched,
        nodesSkipped,
        totalTranscripts,
        totalDescriptions,
        totalCaptions,
        avgConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Build combined content from original and media-text
   */
  private buildCombinedContent(
    original: string,
    transcripts: string[],
    descriptions: string[],
    captions: string[]
  ): string {
    const sections: string[] = [original];

    // Add transcripts section
    if (transcripts.length > 0) {
      const transcriptText = transcripts.join('\n\n');
      sections.push(`[Transcribed text]\n${transcriptText}`);
    }

    // Add descriptions section
    if (descriptions.length > 0) {
      const descText = descriptions.join('\n\n');
      sections.push(`[Media descriptions]\n${descText}`);
    }

    // Add captions section
    if (captions.length > 0) {
      const captionText = captions.join('\n\n');
      sections.push(`[Captions]\n${captionText}`);
    }

    let combined = sections.join(this.options.sectionSeparator);

    // Truncate if too long
    if (combined.length > this.options.maxCombinedLength) {
      combined = combined.substring(0, this.options.maxCombinedLength) + '...';
    }

    return combined;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    const trimmed = text.trim();
    if (trimmed.length === 0) return 0;
    return trimmed.split(/\s+/).length;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _enrichmentService: MediaTextEnrichmentService | null = null;

/**
 * Get media-text enrichment service singleton
 */
export function getMediaTextEnrichmentService(): MediaTextEnrichmentService {
  if (!_enrichmentService) {
    _enrichmentService = new MediaTextEnrichmentService();
  }
  return _enrichmentService;
}

/**
 * Initialize media-text enrichment service with options
 */
export function initMediaTextEnrichmentService(
  options: EnrichmentOptions = {}
): MediaTextEnrichmentService {
  _enrichmentService = new MediaTextEnrichmentService(options);
  return _enrichmentService;
}

/**
 * Reset enrichment service (for testing)
 */
export function resetMediaTextEnrichmentService(): void {
  _enrichmentService = null;
}
