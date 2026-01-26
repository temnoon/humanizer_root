/**
 * Pattern Discovery System
 *
 * A comprehensive system for:
 * 1. Autonomous pattern discovery - notice patterns without being told
 * 2. Learning from corrections - adapt based on user feedback
 * 3. Pattern composition - combine patterns with algebra
 *
 * This extends ContentPatternMatcher with intelligence and memory.
 *
 * @module @humanizer/core/agentic-search
 */

import { randomUUID } from 'crypto';
import type { Pool } from 'pg';

// ═══════════════════════════════════════════════════════════════════
// TYPES: PATTERN DISCOVERY
// ═══════════════════════════════════════════════════════════════════

/**
 * A discovered pattern - something the system noticed
 */
export interface DiscoveredPattern {
  /** Unique ID */
  id: string;

  /** What was noticed */
  observation: string;

  /** Evidence supporting this pattern */
  evidence: PatternEvidence[];

  /** Statistical confidence */
  confidence: number;

  /** Number of instances observed */
  instanceCount: number;

  /** Pattern dimensions extracted */
  dimensions: PatternDimension[];

  /** Discovery method */
  discoveryMethod: 'statistical' | 'clustering' | 'sequence' | 'user-guided';

  /** When discovered */
  discoveredAt: Date;

  /** Status */
  status: 'candidate' | 'confirmed' | 'rejected' | 'refined';
}

/**
 * Evidence for a discovered pattern
 */
export interface PatternEvidence {
  /** Example content IDs */
  contentIds: string[];

  /** What made this evidence */
  reason: string;

  /** Strength of evidence (0-1) */
  strength: number;
}

/**
 * Pattern dimension (shared with ContentPatternMatcher)
 */
export interface PatternDimension {
  type: 'structural' | 'content' | 'metadata' | 'semantic' | 'temporal';
  description: string;
  query: PatternQuery;
  weight: number;
  learned?: boolean; // Was this dimension learned from feedback?
}

export interface PatternQuery {
  sqlFragment?: string;
  sqlParams?: unknown[];
  contentPatterns?: RegExp[];
  metadataFields?: Record<string, unknown>;
  semanticTargets?: string[];
  semanticThreshold?: number;
  temporalConstraints?: TemporalConstraint[];
}

export interface TemporalConstraint {
  relation: 'before' | 'after' | 'within';
  targetSelector: string;
  maxDurationMs?: number;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES: LEARNING FROM CORRECTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * User feedback on a pattern match
 */
export interface PatternFeedback {
  /** Feedback ID */
  id: string;

  /** Pattern this feedback is for */
  patternId: string;

  /** Content that was matched */
  contentId: string;

  /** User's judgment */
  judgment: 'correct' | 'incorrect' | 'partial';

  /** User's explanation */
  explanation?: string;

  /** What should have been different */
  correction?: {
    shouldInclude?: string[];
    shouldExclude?: string[];
    wrongBecause?: string;
  };

  /** When given */
  givenAt: Date;
}

/**
 * Learned constraint from feedback
 */
export interface LearnedConstraint {
  /** Constraint ID */
  id: string;

  /** Pattern this applies to */
  patternId: string;

  /** What was learned */
  description: string;

  /** How to apply this constraint */
  constraint: {
    type: 'exclude' | 'require' | 'prefer' | 'penalize';
    dimension: PatternDimension;
  };

  /** Feedback that led to this */
  sourceFeeback: string[];

  /** Confidence in this constraint */
  confidence: number;

  /** When learned */
  learnedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES: PATTERN COMPOSITION
// ═══════════════════════════════════════════════════════════════════

/**
 * A named, reusable pattern
 */
export interface NamedPattern {
  /** Unique name (user-friendly) */
  name: string;

  /** Machine ID */
  id: string;

  /** Description */
  description: string;

  /** Base pattern or composition */
  definition: PatternDefinition;

  /** Usage count */
  usageCount: number;

  /** Success rate (correct matches / total feedback) */
  successRate?: number;

  /** Tags for organization */
  tags: string[];

  /** When created */
  createdAt: Date;

  /** When last used */
  lastUsedAt?: Date;
}

/**
 * Pattern definition - can be atomic or composed
 */
export type PatternDefinition =
  | AtomicPattern
  | ComposedPattern;

/**
 * An atomic (base) pattern
 */
export interface AtomicPattern {
  type: 'atomic';
  dimensions: PatternDimension[];
  confidenceThreshold: number;
}

/**
 * A composed pattern using algebra
 */
export interface ComposedPattern {
  type: 'composed';
  operator: PatternOperator;
  operands: PatternDefinition[];
  /** Optional constraints that apply to the composition */
  constraints?: LearnedConstraint[];
}

/**
 * Pattern composition operators
 */
export type PatternOperator =
  | { op: 'AND' }                    // Both patterns must match
  | { op: 'OR' }                     // Either pattern matches
  | { op: 'NOT'; base: string }     // Base pattern minus exclusion
  | { op: 'SEQUENCE'; ordered: boolean }  // Patterns in sequence
  | { op: 'REFINE'; base: string }  // Base pattern with additional constraints
  | { op: 'SPECIALIZE'; base: string; specialization: string };  // Hierarchical

// ═══════════════════════════════════════════════════════════════════
// PATTERN DISCOVERY ENGINE
// ═══════════════════════════════════════════════════════════════════

/**
 * Autonomous pattern discovery
 *
 * Scans content to notice patterns without being told what to look for.
 */
export class PatternDiscoveryEngine {
  private pool: Pool;
  private embedFn: (text: string) => Promise<number[]>;

  constructor(pool: Pool, embedFn: (text: string) => Promise<number[]>) {
    this.pool = pool;
    this.embedFn = embedFn;
  }

  /**
   * Discover patterns in the content
   *
   * Runs various discovery strategies and returns candidate patterns.
   */
  async discover(options?: {
    sourceTypes?: string[];
    limit?: number;
    minInstances?: number;
  }): Promise<DiscoveredPattern[]> {
    const patterns: DiscoveredPattern[] = [];

    // Strategy 1: Structural sequence patterns
    const sequencePatterns = await this.discoverSequencePatterns(options);
    patterns.push(...sequencePatterns);

    // Strategy 2: Content structure co-occurrence
    const cooccurrencePatterns = await this.discoverCooccurrencePatterns(options);
    patterns.push(...cooccurrencePatterns);

    // Strategy 3: Metadata clustering
    const metadataPatterns = await this.discoverMetadataPatterns(options);
    patterns.push(...metadataPatterns);

    // Strategy 4: Semantic clustering
    const semanticPatterns = await this.discoverSemanticPatterns(options);
    patterns.push(...semanticPatterns);

    return patterns;
  }

  /**
   * Discover sequence patterns
   *
   * Notice common sequences like: user+image → assistant+codeblock
   */
  private async discoverSequencePatterns(options?: {
    sourceTypes?: string[];
    minInstances?: number;
  }): Promise<DiscoveredPattern[]> {
    const minInstances = options?.minInstances || 5;

    // Find common user→assistant patterns where user has media
    const result = await this.pool.query(`
      WITH user_with_media AS (
        SELECT
          id, thread_root_id, source_created_at,
          media_refs IS NOT NULL AND media_refs::text LIKE '%file-%' as has_media,
          text LIKE '%?%' as is_question,
          LENGTH(text) < 100 as is_short
        FROM content_nodes
        WHERE author_role = 'user'
          AND source_type LIKE '%chatgpt%'
      ),
      assistant_responses AS (
        SELECT
          id, thread_root_id, source_created_at,
          text LIKE '%\`\`\`%' as has_codeblock,
          text ILIKE '%image%' OR text ILIKE '%photo%' as mentions_image,
          text ILIKE '%transcri%' as mentions_transcription,
          source_metadata::text LIKE '%gpt-4-gizmo%' as is_gizmo
        FROM content_nodes
        WHERE author_role = 'assistant'
          AND source_type LIKE '%chatgpt%'
      ),
      patterns AS (
        SELECT
          u.has_media,
          a.has_codeblock,
          a.mentions_image,
          a.mentions_transcription,
          a.is_gizmo,
          COUNT(*) as instance_count
        FROM user_with_media u
        JOIN assistant_responses a ON u.thread_root_id = a.thread_root_id
          AND a.source_created_at > u.source_created_at
        GROUP BY u.has_media, a.has_codeblock, a.mentions_image, a.mentions_transcription, a.is_gizmo
        HAVING COUNT(*) >= $1
      )
      SELECT * FROM patterns
      ORDER BY instance_count DESC
      LIMIT 20
    `, [minInstances]);

    const patterns: DiscoveredPattern[] = [];

    for (const row of result.rows) {
      // Build observation description
      const userPart = row.has_media ? 'user uploads image' : 'user sends message';
      const assistantParts: string[] = [];
      if (row.has_codeblock) assistantParts.push('code block');
      if (row.mentions_transcription) assistantParts.push('transcription');
      if (row.mentions_image) assistantParts.push('image description');
      if (row.is_gizmo) assistantParts.push('Custom GPT');

      if (assistantParts.length === 0) continue;

      const observation = `When ${userPart}, assistant often responds with ${assistantParts.join(' + ')}`;

      patterns.push({
        id: `seq-${randomUUID().slice(0, 8)}`,
        observation,
        evidence: [{
          contentIds: [], // Would populate with examples
          reason: `Observed ${row.instance_count} times`,
          strength: Math.min(row.instance_count / 100, 1),
        }],
        confidence: Math.min(row.instance_count / 50, 0.95),
        instanceCount: parseInt(row.instance_count),
        dimensions: this.buildDimensionsFromSequence(row),
        discoveryMethod: 'sequence',
        discoveredAt: new Date(),
        status: 'candidate',
      });
    }

    return patterns;
  }

  private buildDimensionsFromSequence(row: any): PatternDimension[] {
    const dimensions: PatternDimension[] = [];

    // Structural: user → assistant sequence
    dimensions.push({
      type: 'structural',
      description: 'User message followed by assistant response',
      query: {
        sqlFragment: `
          EXISTS (
            SELECT 1 FROM content_nodes u
            WHERE u.thread_root_id = a.thread_root_id
              AND u.author_role = 'user'
              AND u.source_created_at < a.source_created_at
              ${row.has_media ? "AND u.media_refs::text LIKE '%file-%'" : ''}
          )
        `,
      },
      weight: 0.3,
    });

    // Content patterns
    if (row.has_codeblock) {
      dimensions.push({
        type: 'content',
        description: 'Contains code block',
        query: { contentPatterns: [/```[\s\S]*?```/] },
        weight: 0.25,
      });
    }

    if (row.mentions_transcription) {
      dimensions.push({
        type: 'content',
        description: 'Mentions transcription',
        query: { contentPatterns: [/transcri(pt|be|ption)/i] },
        weight: 0.25,
      });
    }

    // Metadata
    if (row.is_gizmo) {
      dimensions.push({
        type: 'metadata',
        description: 'From Custom GPT',
        query: { sqlFragment: `source_metadata::text LIKE '%gpt-4-gizmo%'` },
        weight: 0.2,
      });
    }

    return dimensions;
  }

  /**
   * Discover content structure co-occurrence patterns
   */
  private async discoverCooccurrencePatterns(options?: any): Promise<DiscoveredPattern[]> {
    // Find content structures that commonly appear together
    // e.g., tables + bullet lists, code + explanations
    return []; // TODO: Implement
  }

  /**
   * Discover metadata-based patterns
   */
  private async discoverMetadataPatterns(options?: any): Promise<DiscoveredPattern[]> {
    // Find clusters based on metadata fields
    // e.g., certain gizmo IDs always produce certain content types
    return []; // TODO: Implement
  }

  /**
   * Discover semantic patterns via embedding clustering
   */
  private async discoverSemanticPatterns(options?: any): Promise<DiscoveredPattern[]> {
    // Cluster embeddings to find semantic groupings
    // e.g., "physics discussions", "code reviews", "creative writing"
    return []; // TODO: Implement
  }
}

// ═══════════════════════════════════════════════════════════════════
// FEEDBACK LEARNER
// ═══════════════════════════════════════════════════════════════════

/**
 * Learns from user corrections to improve patterns
 */
export class FeedbackLearner {
  private pool: Pool;
  private embedFn: (text: string) => Promise<number[]>;

  // In-memory feedback store (would persist to DB in production)
  private feedback: Map<string, PatternFeedback[]> = new Map();
  private constraints: Map<string, LearnedConstraint[]> = new Map();

  constructor(pool: Pool, embedFn: (text: string) => Promise<number[]>) {
    this.pool = pool;
    this.embedFn = embedFn;
  }

  /**
   * Record user feedback on a pattern match
   */
  async recordFeedback(feedback: Omit<PatternFeedback, 'id' | 'givenAt'>): Promise<PatternFeedback> {
    const fullFeedback: PatternFeedback = {
      ...feedback,
      id: randomUUID(),
      givenAt: new Date(),
    };

    const existing = this.feedback.get(feedback.patternId) || [];
    existing.push(fullFeedback);
    this.feedback.set(feedback.patternId, existing);

    // Trigger learning if we have enough feedback
    if (existing.length >= 3) {
      await this.learnFromFeedback(feedback.patternId);
    }

    return fullFeedback;
  }

  /**
   * Learn constraints from accumulated feedback
   */
  async learnFromFeedback(patternId: string): Promise<LearnedConstraint[]> {
    const feedbackList = this.feedback.get(patternId) || [];
    if (feedbackList.length < 3) return [];

    const newConstraints: LearnedConstraint[] = [];

    // Separate correct and incorrect matches
    const correct = feedbackList.filter(f => f.judgment === 'correct');
    const incorrect = feedbackList.filter(f => f.judgment === 'incorrect');

    if (incorrect.length === 0) return [];

    // Analyze what makes incorrect matches different
    const incorrectContentIds = incorrect.map(f => f.contentId);
    const correctContentIds = correct.map(f => f.contentId);

    // Get content for analysis
    const incorrectContent = await this.getContent(incorrectContentIds);
    const correctContent = await this.getContent(correctContentIds);

    // Strategy 1: Content pattern differences
    const contentConstraint = await this.learnContentConstraint(
      correctContent,
      incorrectContent,
      patternId
    );
    if (contentConstraint) {
      newConstraints.push(contentConstraint);
    }

    // Strategy 2: Semantic differences
    const semanticConstraint = await this.learnSemanticConstraint(
      correctContent,
      incorrectContent,
      patternId
    );
    if (semanticConstraint) {
      newConstraints.push(semanticConstraint);
    }

    // Store learned constraints
    const existing = this.constraints.get(patternId) || [];
    this.constraints.set(patternId, [...existing, ...newConstraints]);

    return newConstraints;
  }

  /**
   * Get constraints for a pattern
   */
  getConstraints(patternId: string): LearnedConstraint[] {
    return this.constraints.get(patternId) || [];
  }

  /**
   * Apply learned constraints to pattern dimensions
   */
  applyConstraints(
    dimensions: PatternDimension[],
    patternId: string
  ): PatternDimension[] {
    const constraints = this.getConstraints(patternId);
    if (constraints.length === 0) return dimensions;

    const newDimensions = [...dimensions];

    for (const constraint of constraints) {
      if (constraint.constraint.type === 'exclude') {
        // Add exclusion dimension
        newDimensions.push({
          ...constraint.constraint.dimension,
          weight: -0.5, // Negative weight to penalize matches
          learned: true,
        });
      } else if (constraint.constraint.type === 'require') {
        // Add required dimension
        newDimensions.push({
          ...constraint.constraint.dimension,
          weight: 0.3,
          learned: true,
        });
      }
    }

    return newDimensions;
  }

  private async getContent(ids: string[]): Promise<any[]> {
    if (ids.length === 0) return [];

    const result = await this.pool.query(`
      SELECT id, text, source_metadata, media_refs
      FROM content_nodes
      WHERE id = ANY($1)
    `, [ids]);

    return result.rows;
  }

  private async learnContentConstraint(
    correct: any[],
    incorrect: any[],
    patternId: string
  ): Promise<LearnedConstraint | null> {
    // Find content patterns common in incorrect but rare in correct
    const incorrectPatterns = this.extractCommonPatterns(incorrect.map(c => c.text));
    const correctPatterns = this.extractCommonPatterns(correct.map(c => c.text));

    // Patterns to exclude: common in incorrect, rare in correct
    for (const [pattern, count] of incorrectPatterns) {
      const correctCount = correctPatterns.get(pattern) || 0;
      if (count >= incorrect.length * 0.5 && correctCount < correct.length * 0.2) {
        return {
          id: randomUUID(),
          patternId,
          description: `Exclude content matching: ${pattern}`,
          constraint: {
            type: 'exclude',
            dimension: {
              type: 'content',
              description: `Learned exclusion: ${pattern}`,
              query: { contentPatterns: [new RegExp(this.escapeRegex(pattern), 'i')] },
              weight: -0.5,
              learned: true,
            },
          },
          sourceFeeback: incorrect.map(i => i.id),
          confidence: count / incorrect.length,
          learnedAt: new Date(),
        };
      }
    }

    return null;
  }

  private async learnSemanticConstraint(
    correct: any[],
    incorrect: any[],
    patternId: string
  ): Promise<LearnedConstraint | null> {
    if (correct.length === 0 || incorrect.length === 0) return null;

    // Compute centroid embeddings for correct and incorrect
    const correctEmbeddings = await Promise.all(
      correct.map(c => this.embedFn(c.text || ''))
    );
    const incorrectEmbeddings = await Promise.all(
      incorrect.map(c => this.embedFn(c.text || ''))
    );

    const correctCentroid = this.computeCentroid(correctEmbeddings);
    const incorrectCentroid = this.computeCentroid(incorrectEmbeddings);

    // If centroids are different enough, create a semantic constraint
    const similarity = this.cosineSimilarity(correctCentroid, incorrectCentroid);

    if (similarity < 0.7) {
      // Significant difference - create constraint to prefer correct-like content
      return {
        id: randomUUID(),
        patternId,
        description: 'Prefer content semantically similar to confirmed matches',
        constraint: {
          type: 'prefer',
          dimension: {
            type: 'semantic',
            description: 'Learned semantic preference',
            query: {
              // Would store actual centroid for comparison
              semanticTargets: correct.slice(0, 3).map(c => c.text?.slice(0, 500) || ''),
              semanticThreshold: 0.5,
            },
            weight: 0.3,
            learned: true,
          },
        },
        sourceFeeback: [...correct.map(c => c.id), ...incorrect.map(i => i.id)],
        confidence: 1 - similarity,
        learnedAt: new Date(),
      };
    }

    return null;
  }

  private extractCommonPatterns(texts: string[]): Map<string, number> {
    const patterns = new Map<string, number>();

    // Look for common phrases, structures
    const phrases = [
      /\{[\s\S]*?\}/,           // JSON-like
      /```\w+/,                  // Code block with language
      /\|[^\n]+\|/,             // Table row
      /^\s*[-*]\s/m,            // Bullet point
      /^\s*\d+\.\s/m,           // Numbered list
      /https?:\/\/\S+/,         // URL
      /\$[^$]+\$/,              // LaTeX inline
    ];

    for (const text of texts) {
      for (const pattern of phrases) {
        if (pattern.test(text || '')) {
          const key = pattern.source;
          patterns.set(key, (patterns.get(key) || 0) + 1);
        }
      }
    }

    return patterns;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private computeCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];
    const dim = embeddings[0].length;
    const centroid = new Array(dim).fill(0);

    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += emb[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      centroid[i] /= embeddings.length;
    }

    return centroid;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// ═══════════════════════════════════════════════════════════════════
// PATTERN COMPOSER
// ═══════════════════════════════════════════════════════════════════

/**
 * Composes patterns using algebra
 */
export class PatternComposer {
  private patterns: Map<string, NamedPattern> = new Map();

  /**
   * Register a named pattern
   */
  register(pattern: NamedPattern): void {
    this.patterns.set(pattern.name, pattern);
    this.patterns.set(pattern.id, pattern);
  }

  /**
   * Get a pattern by name or ID
   */
  get(nameOrId: string): NamedPattern | undefined {
    return this.patterns.get(nameOrId);
  }

  /**
   * Compose patterns using operators
   */
  compose(
    name: string,
    description: string,
    operator: PatternOperator,
    operandNames: string[]
  ): NamedPattern {
    const operands: PatternDefinition[] = [];

    for (const opName of operandNames) {
      const pattern = this.patterns.get(opName);
      if (!pattern) {
        throw new Error(`Pattern not found: ${opName}`);
      }
      operands.push(pattern.definition);
    }

    const composed: NamedPattern = {
      name,
      id: randomUUID(),
      description,
      definition: {
        type: 'composed',
        operator,
        operands,
      },
      usageCount: 0,
      tags: [],
      createdAt: new Date(),
    };

    this.register(composed);
    return composed;
  }

  /**
   * Create pattern algebra shortcuts
   */
  and(name: string, description: string, ...patterns: string[]): NamedPattern {
    return this.compose(name, description, { op: 'AND' }, patterns);
  }

  or(name: string, description: string, ...patterns: string[]): NamedPattern {
    return this.compose(name, description, { op: 'OR' }, patterns);
  }

  not(name: string, description: string, base: string, exclusion: string): NamedPattern {
    return this.compose(name, description, { op: 'NOT', base }, [base, exclusion]);
  }

  sequence(name: string, description: string, ordered: boolean, ...patterns: string[]): NamedPattern {
    return this.compose(name, description, { op: 'SEQUENCE', ordered }, patterns);
  }

  refine(name: string, description: string, base: string, refinement: string): NamedPattern {
    return this.compose(name, description, { op: 'REFINE', base }, [base, refinement]);
  }

  /**
   * List all registered patterns
   */
  list(): NamedPattern[] {
    const seen = new Set<string>();
    const result: NamedPattern[] = [];

    for (const pattern of this.patterns.values()) {
      if (!seen.has(pattern.id)) {
        seen.add(pattern.id);
        result.push(pattern);
      }
    }

    return result;
  }

  /**
   * Flatten a composed pattern into dimensions for execution
   */
  flatten(definition: PatternDefinition): PatternDimension[] {
    if (definition.type === 'atomic') {
      return definition.dimensions;
    }

    // Composed pattern - recursively flatten
    const allDimensions: PatternDimension[] = [];

    for (const operand of definition.operands) {
      const dims = this.flatten(operand);

      switch (definition.operator.op) {
        case 'AND':
          // All dimensions required
          allDimensions.push(...dims);
          break;

        case 'OR':
          // Any dimension sufficient - lower weights
          allDimensions.push(...dims.map(d => ({ ...d, weight: d.weight * 0.5 })));
          break;

        case 'NOT':
          // First operand positive, second negative
          if (allDimensions.length === 0) {
            allDimensions.push(...dims);
          } else {
            allDimensions.push(...dims.map(d => ({ ...d, weight: -d.weight })));
          }
          break;

        case 'SEQUENCE':
          // Add temporal constraints
          allDimensions.push(...dims.map(d => ({
            ...d,
            query: {
              ...d.query,
              temporalConstraints: [{
                relation: 'after' as const,
                targetSelector: 'previous in sequence',
              }],
            },
          })));
          break;

        case 'REFINE':
        case 'SPECIALIZE':
          // Add refinement dimensions with higher weight
          if (allDimensions.length === 0) {
            allDimensions.push(...dims);
          } else {
            allDimensions.push(...dims.map(d => ({ ...d, weight: d.weight * 1.5 })));
          }
          break;
      }
    }

    // Apply any learned constraints
    if (definition.constraints) {
      for (const constraint of definition.constraints) {
        allDimensions.push({
          ...constraint.constraint.dimension,
          learned: true,
        });
      }
    }

    return allDimensions;
  }
}

// ═══════════════════════════════════════════════════════════════════
// UNIFIED PATTERN SYSTEM
// ═══════════════════════════════════════════════════════════════════

/**
 * Unified Pattern System
 *
 * Combines discovery, learning, and composition into a single interface
 * for the AUI to use.
 */
export class PatternSystem {
  readonly discovery: PatternDiscoveryEngine;
  readonly learner: FeedbackLearner;
  readonly composer: PatternComposer;

  private pool: Pool;
  private embedFn: (text: string) => Promise<number[]>;

  constructor(pool: Pool, embedFn: (text: string) => Promise<number[]>) {
    this.pool = pool;
    this.embedFn = embedFn;

    this.discovery = new PatternDiscoveryEngine(pool, embedFn);
    this.learner = new FeedbackLearner(pool, embedFn);
    this.composer = new PatternComposer();

    // Register built-in patterns
    this.registerBuiltinPatterns();
  }

  private registerBuiltinPatterns(): void {
    // OCR Transcription pattern
    this.composer.register({
      name: 'ocr-transcription',
      id: 'builtin-ocr',
      description: 'OCR transcription of uploaded images',
      definition: {
        type: 'atomic',
        dimensions: [
          {
            type: 'structural',
            description: 'Assistant after user image upload',
            query: {
              sqlFragment: `
                author_role = 'assistant'
                AND EXISTS (
                  SELECT 1 FROM content_nodes u
                  WHERE u.thread_root_id = content_nodes.thread_root_id
                    AND u.author_role = 'user'
                    AND u.source_created_at < content_nodes.source_created_at
                    AND u.media_refs::text LIKE '%file-%'
                )
              `,
            },
            weight: 0.3,
          },
          {
            type: 'content',
            description: 'Contains code block',
            query: { contentPatterns: [/```[\s\S]*?```/] },
            weight: 0.3,
          },
          {
            type: 'content',
            description: 'Mentions transcription',
            query: { contentPatterns: [/transcri(pt|be|ption)/i, /here is the.*text/i] },
            weight: 0.2,
          },
          {
            type: 'metadata',
            description: 'From Custom GPT',
            query: { sqlFragment: `source_metadata::text LIKE '%gpt-4-gizmo%'` },
            weight: 0.2,
          },
        ],
        confidenceThreshold: 0.6,
      },
      usageCount: 0,
      tags: ['ocr', 'transcription', 'images'],
      createdAt: new Date(),
    });

    // Image description pattern
    this.composer.register({
      name: 'image-description',
      id: 'builtin-image-desc',
      description: 'AI description of uploaded image',
      definition: {
        type: 'atomic',
        dimensions: [
          {
            type: 'structural',
            description: 'Assistant after user image upload',
            query: {
              sqlFragment: `
                author_role = 'assistant'
                AND EXISTS (
                  SELECT 1 FROM content_nodes u
                  WHERE u.thread_root_id = content_nodes.thread_root_id
                    AND u.author_role = 'user'
                    AND u.source_created_at < content_nodes.source_created_at
                    AND u.media_refs::text LIKE '%file-%'
                )
              `,
            },
            weight: 0.4,
          },
          {
            type: 'content',
            description: 'Describes visual content',
            query: {
              contentPatterns: [
                /the image (shows|depicts|features|contains)/i,
                /I can see/i,
              ],
            },
            weight: 0.4,
          },
        ],
        confidenceThreshold: 0.5,
      },
      usageCount: 0,
      tags: ['description', 'images', 'vision'],
      createdAt: new Date(),
    });

    // DALL-E generation pattern
    this.composer.register({
      name: 'dalle-generation',
      id: 'builtin-dalle',
      description: 'DALL-E generated image with description',
      definition: {
        type: 'atomic',
        dimensions: [
          {
            type: 'structural',
            description: 'Assistant message with image',
            query: {
              sqlFragment: `
                author_role = 'assistant'
                AND media_refs IS NOT NULL
                AND media_refs::text LIKE '%file-%'
              `,
            },
            weight: 0.3,
          },
          {
            type: 'content',
            description: 'Mentions image creation',
            query: {
              contentPatterns: [
                /I('ve| have) (created|generated)/i,
                /here('s| is) (an?|the) (image|illustration)/i,
              ],
            },
            weight: 0.4,
          },
        ],
        confidenceThreshold: 0.6,
      },
      usageCount: 0,
      tags: ['dalle', 'generation', 'images'],
      createdAt: new Date(),
    });
  }

  /**
   * Describe and create a pattern from natural language
   */
  async describe(description: string): Promise<NamedPattern> {
    // Try to match against existing patterns first
    const existingMatch = this.findSimilarPattern(description);
    if (existingMatch) {
      return existingMatch;
    }

    // Parse description into dimensions (would use LLM in production)
    const dimensions = await this.parseDescription(description);

    const pattern: NamedPattern = {
      name: `custom-${Date.now()}`,
      id: randomUUID(),
      description,
      definition: {
        type: 'atomic',
        dimensions,
        confidenceThreshold: 0.5,
      },
      usageCount: 0,
      tags: this.extractTags(description),
      createdAt: new Date(),
    };

    this.composer.register(pattern);
    return pattern;
  }

  /**
   * Execute a pattern and apply learned constraints
   */
  async execute(patternName: string): Promise<any[]> {
    const pattern = this.composer.get(patternName);
    if (!pattern) {
      throw new Error(`Pattern not found: ${patternName}`);
    }

    // Get dimensions
    let dimensions = this.composer.flatten(pattern.definition);

    // Apply learned constraints
    dimensions = this.learner.applyConstraints(dimensions, pattern.id);

    // Execute query
    const results = await this.executeQuery(dimensions);

    // Update usage
    pattern.usageCount++;
    pattern.lastUsedAt = new Date();

    return results;
  }

  /**
   * Provide feedback on a match
   */
  async feedback(
    patternName: string,
    contentId: string,
    judgment: 'correct' | 'incorrect' | 'partial',
    explanation?: string
  ): Promise<void> {
    const pattern = this.composer.get(patternName);
    if (!pattern) {
      throw new Error(`Pattern not found: ${patternName}`);
    }

    await this.learner.recordFeedback({
      patternId: pattern.id,
      contentId,
      judgment,
      explanation,
    });
  }

  private findSimilarPattern(description: string): NamedPattern | undefined {
    const lower = description.toLowerCase();

    for (const pattern of this.composer.list()) {
      if (
        pattern.tags.some(t => lower.includes(t)) ||
        lower.includes(pattern.name)
      ) {
        return pattern;
      }
    }

    return undefined;
  }

  private async parseDescription(description: string): Promise<PatternDimension[]> {
    // Simple keyword-based parsing (would use LLM in production)
    const dimensions: PatternDimension[] = [];
    const lower = description.toLowerCase();

    if (lower.includes('image') || lower.includes('photo') || lower.includes('picture')) {
      dimensions.push({
        type: 'structural',
        description: 'Related to images',
        query: { sqlFragment: `media_refs IS NOT NULL AND media_refs::text LIKE '%file-%'` },
        weight: 0.3,
      });
    }

    if (lower.includes('code') || lower.includes('```')) {
      dimensions.push({
        type: 'content',
        description: 'Contains code block',
        query: { contentPatterns: [/```[\s\S]*?```/] },
        weight: 0.3,
      });
    }

    if (lower.includes('transcript') || lower.includes('ocr')) {
      dimensions.push({
        type: 'content',
        description: 'Transcription content',
        query: { contentPatterns: [/transcri/i] },
        weight: 0.3,
      });
    }

    // Always add semantic dimension
    dimensions.push({
      type: 'semantic',
      description: 'Semantic match to description',
      query: {
        semanticTargets: [description],
        semanticThreshold: 0.4,
      },
      weight: 0.4,
    });

    return dimensions;
  }

  private extractTags(description: string): string[] {
    const tags: string[] = [];
    const lower = description.toLowerCase();

    const tagWords = ['image', 'ocr', 'transcript', 'code', 'dalle', 'description', 'notebook', 'handwritten'];
    for (const word of tagWords) {
      if (lower.includes(word)) {
        tags.push(word);
      }
    }

    return tags;
  }

  private async executeQuery(dimensions: PatternDimension[]): Promise<any[]> {
    // Build SQL from dimensions
    const sqlParts: string[] = [];

    for (const dim of dimensions) {
      if (dim.query.sqlFragment && dim.weight > 0) {
        sqlParts.push(`(${dim.query.sqlFragment})`);
      }
    }

    const whereClause = sqlParts.length > 0 ? sqlParts.join(' AND ') : 'true';

    const query = `
      SELECT *
      FROM content_nodes
      WHERE ${whereClause}
      ORDER BY source_created_at DESC NULLS LAST
      LIMIT 100
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }
}

// Classes are exported at definition with 'export class'
