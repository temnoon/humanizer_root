/**
 * Content Pattern Matcher
 *
 * Enables the AUI to find and relate content based on natural language
 * descriptions of patterns. This generalizes the hardcoded extraction
 * logic into a flexible, user-guided discovery system.
 *
 * Example usage:
 * ```typescript
 * const matcher = new ContentPatternMatcher(store, embedFn);
 *
 * // User describes what they're looking for
 * const pattern = await matcher.describePattern(
 *   "Find OCR transcriptions of handwritten notebook pages. " +
 *   "These are assistant messages with code blocks that follow " +
 *   "user messages containing uploaded images. The Custom GPT " +
 *   "called Journal Recognizer produces these."
 * );
 *
 * // Execute the pattern to find matches
 * const matches = await matcher.execute(pattern);
 *
 * // Refine based on results
 * const refined = await matcher.refine(pattern, {
 *   include: ["German physics texts with TeX formulas"],
 *   exclude: ["JSON prompts, not actual transcripts"]
 * });
 * ```
 *
 * @module @humanizer/core/agentic-search
 */

import type { Pool } from 'pg';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * A pattern dimension describes one aspect of the content relationship
 */
export interface PatternDimension {
  /** Dimension type */
  type: 'structural' | 'content' | 'metadata' | 'semantic';

  /** Human-readable description */
  description: string;

  /** How to query this dimension */
  query: PatternQuery;

  /** Weight for scoring (0-1) */
  weight: number;
}

/**
 * Query specification for a pattern dimension
 */
export interface PatternQuery {
  /** SQL WHERE clause fragment (parameterized) */
  sqlFragment?: string;

  /** Parameters for SQL fragment */
  sqlParams?: unknown[];

  /** Content regex patterns */
  contentPatterns?: RegExp[];

  /** Required metadata fields */
  metadataFields?: Record<string, unknown>;

  /** Semantic similarity targets */
  semanticTargets?: string[];

  /** Minimum similarity threshold */
  semanticThreshold?: number;
}

/**
 * A complete pattern specification
 */
export interface ContentPattern {
  /** Unique pattern ID */
  id: string;

  /** User's original description */
  description: string;

  /** Parsed dimensions */
  dimensions: PatternDimension[];

  /** How to relate matched content */
  relationship: RelationshipSpec;

  /** Confidence threshold for matches */
  confidenceThreshold: number;

  /** Created timestamp */
  createdAt: Date;

  /** Refinement history */
  refinements: PatternRefinement[];
}

/**
 * How to create relationships from matched content
 */
export interface RelationshipSpec {
  /** Source content selector (e.g., "user message with images") */
  sourceSelector: string;

  /** Target content selector (e.g., "following assistant code block") */
  targetSelector: string;

  /** Relationship type to create */
  associationType: string;

  /** How to handle multiple matches */
  multiplicity: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';

  /** Whether to batch related items */
  batchRelated: boolean;
}

/**
 * A refinement to a pattern
 */
export interface PatternRefinement {
  /** Refinement type */
  type: 'include' | 'exclude' | 'adjust';

  /** User's refinement description */
  description: string;

  /** Changes to dimensions */
  dimensionChanges: Partial<PatternDimension>[];

  /** When refined */
  refinedAt: Date;
}

/**
 * A match found by the pattern
 */
export interface PatternMatch {
  /** Source content ID(s) */
  sourceIds: string[];

  /** Target content ID(s) */
  targetIds: string[];

  /** Overall confidence score */
  confidence: number;

  /** Per-dimension scores */
  dimensionScores: Record<string, number>;

  /** Explanation of why this matched */
  explanation: string;

  /** Extracted relationship data */
  extractedData?: {
    mediaIds?: string[];
    extractedText?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Result of pattern execution
 */
export interface PatternExecutionResult {
  /** Pattern that was executed */
  pattern: ContentPattern;

  /** Matches found */
  matches: PatternMatch[];

  /** Execution statistics */
  stats: {
    candidatesScanned: number;
    matchesFound: number;
    executionTimeMs: number;
  };

  /** Suggested refinements based on results */
  suggestedRefinements?: string[];
}

// ═══════════════════════════════════════════════════════════════════
// PATTERN TEMPLATES
// ═══════════════════════════════════════════════════════════════════

/**
 * Pre-defined pattern templates for common relationships
 */
export const PATTERN_TEMPLATES = {
  /**
   * OCR transcription: images → code block transcript
   */
  OCR_TRANSCRIPTION: {
    description: 'OCR transcription of uploaded images',
    dimensions: [
      {
        type: 'structural' as const,
        description: 'Assistant message following user image upload',
        query: {
          sqlFragment: `
            a.author_role = 'assistant'
            AND EXISTS (
              SELECT 1 FROM content_nodes u
              WHERE u.thread_root_id = a.thread_root_id
                AND u.author_role = 'user'
                AND u.source_created_at < a.source_created_at
                AND u.media_refs::text LIKE '%file-%'
            )
          `,
        },
        weight: 0.3,
      },
      {
        type: 'content' as const,
        description: 'Contains code block (triple-tick)',
        query: {
          contentPatterns: [/```[\s\S]*?```/],
        },
        weight: 0.3,
      },
      {
        type: 'content' as const,
        description: 'Mentions transcription',
        query: {
          contentPatterns: [
            /transcri(pt|be|ption)/i,
            /here is the.*text/i,
            /OCR/i,
          ],
        },
        weight: 0.2,
      },
      {
        type: 'metadata' as const,
        description: 'From Custom GPT (gizmo)',
        query: {
          sqlFragment: `a.source_metadata::text LIKE '%gpt-4-gizmo%'`,
        },
        weight: 0.2,
      },
    ],
    relationship: {
      sourceSelector: 'user message with images',
      targetSelector: 'assistant code block',
      associationType: 'ocr',
      multiplicity: 'many-to-one' as const,
      batchRelated: true,
    },
    confidenceThreshold: 0.6,
  },

  /**
   * Image description: user image → assistant description
   */
  IMAGE_DESCRIPTION: {
    description: 'AI description of uploaded image',
    dimensions: [
      {
        type: 'structural' as const,
        description: 'Assistant message following user image upload',
        query: {
          sqlFragment: `
            a.author_role = 'assistant'
            AND EXISTS (
              SELECT 1 FROM content_nodes u
              WHERE u.thread_root_id = a.thread_root_id
                AND u.author_role = 'user'
                AND u.source_created_at < a.source_created_at
                AND u.media_refs::text LIKE '%file-%'
            )
          `,
        },
        weight: 0.4,
      },
      {
        type: 'content' as const,
        description: 'Describes visual content',
        query: {
          contentPatterns: [
            /the image (shows|depicts|features|contains)/i,
            /I can see/i,
            /looking at (this|the) (image|picture|photo)/i,
          ],
        },
        weight: 0.4,
      },
      {
        type: 'semantic' as const,
        description: 'Semantically similar to image description',
        query: {
          semanticTargets: ['visual description of photograph or image content'],
          semanticThreshold: 0.5,
        },
        weight: 0.2,
      },
    ],
    relationship: {
      sourceSelector: 'user message with images',
      targetSelector: 'assistant description text',
      associationType: 'description',
      multiplicity: 'one-to-one' as const,
      batchRelated: false,
    },
    confidenceThreshold: 0.5,
  },

  /**
   * DALL-E generation: prompt → generated image
   */
  DALLE_GENERATION: {
    description: 'DALL-E image generated from prompt',
    dimensions: [
      {
        type: 'structural' as const,
        description: 'Assistant message with image attachment',
        query: {
          sqlFragment: `
            a.author_role = 'assistant'
            AND a.media_refs IS NOT NULL
            AND a.media_refs::text LIKE '%file-%'
          `,
        },
        weight: 0.3,
      },
      {
        type: 'content' as const,
        description: 'Mentions image creation',
        query: {
          contentPatterns: [
            /I('ve| have) (created|generated)/i,
            /here('s| is) (an?|the) (image|illustration)/i,
            /DALL[·-]?E/i,
          ],
        },
        weight: 0.4,
      },
      {
        type: 'metadata' as const,
        description: 'DALL-E model or file pattern',
        query: {
          sqlFragment: `
            a.media_refs::text LIKE '%dalle%'
            OR a.source_metadata::text LIKE '%dall%'
          `,
        },
        weight: 0.3,
      },
    ],
    relationship: {
      sourceSelector: 'generation description/prompt',
      targetSelector: 'generated image',
      associationType: 'generated-from',
      multiplicity: 'one-to-many' as const,
      batchRelated: false,
    },
    confidenceThreshold: 0.6,
  },
};

// ═══════════════════════════════════════════════════════════════════
// CONTENT PATTERN MATCHER
// ═══════════════════════════════════════════════════════════════════

/**
 * Content Pattern Matcher
 *
 * Enables flexible, user-guided content relationship discovery.
 */
export class ContentPatternMatcher {
  private pool: Pool;
  private embedFn: (text: string) => Promise<number[]>;

  constructor(pool: Pool, embedFn: (text: string) => Promise<number[]>) {
    this.pool = pool;
    this.embedFn = embedFn;
  }

  /**
   * Parse a natural language description into a pattern
   *
   * This would ideally use an LLM to parse the description,
   * but for now we use template matching + heuristics.
   */
  async describePattern(description: string): Promise<ContentPattern> {
    const id = `pattern-${Date.now()}`;

    // Try to match against templates
    const template = this.matchTemplate(description);

    if (template) {
      return {
        id,
        description,
        dimensions: template.dimensions,
        relationship: template.relationship,
        confidenceThreshold: template.confidenceThreshold,
        createdAt: new Date(),
        refinements: [],
      };
    }

    // Fall back to generic pattern parsing
    return this.parseGenericPattern(id, description);
  }

  /**
   * Execute a pattern to find matches
   */
  async execute(pattern: ContentPattern): Promise<PatternExecutionResult> {
    const startTime = Date.now();
    const matches: PatternMatch[] = [];

    // Build and execute query based on dimensions
    const candidates = await this.findCandidates(pattern);

    // Score each candidate
    for (const candidate of candidates) {
      const match = await this.scoreCandidate(candidate, pattern);
      if (match.confidence >= pattern.confidenceThreshold) {
        matches.push(match);
      }
    }

    return {
      pattern,
      matches,
      stats: {
        candidatesScanned: candidates.length,
        matchesFound: matches.length,
        executionTimeMs: Date.now() - startTime,
      },
      suggestedRefinements: this.suggestRefinements(matches, pattern),
    };
  }

  /**
   * Refine a pattern based on user feedback
   */
  async refine(
    pattern: ContentPattern,
    feedback: { include?: string[]; exclude?: string[]; adjust?: string[] }
  ): Promise<ContentPattern> {
    const refinements: PatternRefinement[] = [];

    if (feedback.include) {
      for (const desc of feedback.include) {
        refinements.push({
          type: 'include',
          description: desc,
          dimensionChanges: await this.parseRefinement(desc, 'include'),
          refinedAt: new Date(),
        });
      }
    }

    if (feedback.exclude) {
      for (const desc of feedback.exclude) {
        refinements.push({
          type: 'exclude',
          description: desc,
          dimensionChanges: await this.parseRefinement(desc, 'exclude'),
          refinedAt: new Date(),
        });
      }
    }

    return {
      ...pattern,
      refinements: [...pattern.refinements, ...refinements],
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────

  private matchTemplate(description: string): typeof PATTERN_TEMPLATES[keyof typeof PATTERN_TEMPLATES] | null {
    const lower = description.toLowerCase();

    if (lower.includes('ocr') || lower.includes('transcript') || lower.includes('handwrit')) {
      return PATTERN_TEMPLATES.OCR_TRANSCRIPTION;
    }

    if (lower.includes('descri') && (lower.includes('image') || lower.includes('photo'))) {
      return PATTERN_TEMPLATES.IMAGE_DESCRIPTION;
    }

    if (lower.includes('dall') || lower.includes('generat') && lower.includes('image')) {
      return PATTERN_TEMPLATES.DALLE_GENERATION;
    }

    return null;
  }

  private async parseGenericPattern(id: string, description: string): Promise<ContentPattern> {
    // Generic pattern parsing - would benefit from LLM assistance
    const dimensions: PatternDimension[] = [];

    // Extract structural hints
    if (description.includes('follow') || description.includes('after')) {
      dimensions.push({
        type: 'structural',
        description: 'Sequential message relationship',
        query: { sqlFragment: 'true' }, // Placeholder
        weight: 0.3,
      });
    }

    // Extract content hints
    const contentPatterns: RegExp[] = [];
    if (description.includes('code block')) {
      contentPatterns.push(/```[\s\S]*?```/);
    }
    if (description.includes('table')) {
      contentPatterns.push(/\|[^\n]+\|/);
    }
    if (contentPatterns.length > 0) {
      dimensions.push({
        type: 'content',
        description: 'Content structure patterns',
        query: { contentPatterns },
        weight: 0.3,
      });
    }

    // Always add semantic dimension
    dimensions.push({
      type: 'semantic',
      description: 'Semantic similarity to description',
      query: {
        semanticTargets: [description],
        semanticThreshold: 0.4,
      },
      weight: 0.4,
    });

    return {
      id,
      description,
      dimensions,
      relationship: {
        sourceSelector: 'source content',
        targetSelector: 'related content',
        associationType: 'related',
        multiplicity: 'one-to-many',
        batchRelated: false,
      },
      confidenceThreshold: 0.5,
      createdAt: new Date(),
      refinements: [],
    };
  }

  private async findCandidates(pattern: ContentPattern): Promise<any[]> {
    // Build SQL from structural and metadata dimensions
    const sqlParts: string[] = [];
    const params: unknown[] = [];

    for (const dim of pattern.dimensions) {
      if (dim.query.sqlFragment) {
        sqlParts.push(`(${dim.query.sqlFragment})`);
        if (dim.query.sqlParams) {
          params.push(...dim.query.sqlParams);
        }
      }
    }

    const whereClause = sqlParts.length > 0 ? sqlParts.join(' AND ') : 'true';

    const query = `
      SELECT a.*, a.text as content
      FROM content_nodes a
      WHERE ${whereClause}
      ORDER BY a.source_created_at DESC NULLS LAST
      LIMIT 1000
    `;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  private async scoreCandidate(candidate: any, pattern: ContentPattern): Promise<PatternMatch> {
    const dimensionScores: Record<string, number> = {};
    let totalWeight = 0;
    let weightedScore = 0;

    for (const dim of pattern.dimensions) {
      const score = await this.scoreDimension(candidate, dim);
      dimensionScores[dim.type] = score;
      weightedScore += score * dim.weight;
      totalWeight += dim.weight;
    }

    const confidence = totalWeight > 0 ? weightedScore / totalWeight : 0;

    return {
      sourceIds: [candidate.id],
      targetIds: [],
      confidence,
      dimensionScores,
      explanation: this.explainMatch(candidate, dimensionScores, pattern),
    };
  }

  private async scoreDimension(candidate: any, dim: PatternDimension): Promise<number> {
    switch (dim.type) {
      case 'content':
        return this.scoreContentDimension(candidate.content || '', dim.query);

      case 'semantic':
        return this.scoreSemanticDimension(candidate, dim.query);

      case 'structural':
      case 'metadata':
        // Already filtered by SQL, so if we got here it matches
        return 1.0;

      default:
        return 0;
    }
  }

  private scoreContentDimension(content: string, query: PatternQuery): number {
    if (!query.contentPatterns || query.contentPatterns.length === 0) {
      return 0;
    }

    let matches = 0;
    for (const pattern of query.contentPatterns) {
      if (pattern.test(content)) {
        matches++;
      }
    }

    return matches / query.contentPatterns.length;
  }

  private async scoreSemanticDimension(candidate: any, query: PatternQuery): Promise<number> {
    if (!query.semanticTargets || query.semanticTargets.length === 0) {
      return 0;
    }

    // If candidate has embedding, use it; otherwise embed the content
    let candidateEmbedding: number[];
    if (candidate.embedding) {
      candidateEmbedding = candidate.embedding;
    } else {
      candidateEmbedding = await this.embedFn(candidate.content || '');
    }

    // Embed targets and compute max similarity
    let maxSim = 0;
    for (const target of query.semanticTargets) {
      const targetEmbedding = await this.embedFn(target);
      const sim = this.cosineSimilarity(candidateEmbedding, targetEmbedding);
      maxSim = Math.max(maxSim, sim);
    }

    return maxSim >= (query.semanticThreshold || 0) ? maxSim : 0;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private explainMatch(
    candidate: any,
    scores: Record<string, number>,
    pattern: ContentPattern
  ): string {
    const parts: string[] = [];

    for (const dim of pattern.dimensions) {
      const score = scores[dim.type];
      if (score > 0) {
        parts.push(`${dim.description} (${(score * 100).toFixed(0)}%)`);
      }
    }

    return `Matched: ${parts.join(', ')}`;
  }

  private suggestRefinements(matches: PatternMatch[], pattern: ContentPattern): string[] {
    const suggestions: string[] = [];

    if (matches.length === 0) {
      suggestions.push('Try relaxing content patterns or lowering confidence threshold');
    } else if (matches.length > 100) {
      suggestions.push('Consider adding more specific content patterns to reduce matches');
    }

    return suggestions;
  }

  private async parseRefinement(
    description: string,
    type: 'include' | 'exclude'
  ): Promise<Partial<PatternDimension>[]> {
    // Parse refinement description into dimension changes
    // This would benefit from LLM assistance
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export { ContentPatternMatcher as default };
