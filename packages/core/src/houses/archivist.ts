/**
 * Archivist Agent
 *
 * The expression indexer. Builds and maintains category indexes mapping
 * concepts to their best expressions. Enables "find the canonical way
 * to say X" queries.
 *
 * Concerns:
 * - Building category indexes
 * - Registering new expressions
 * - Finding canonical expressions for concepts
 * - Expression deduplication
 * - Index maintenance and optimization
 *
 * NOTE: This agent uses ConfigManager for all thresholds and prompts.
 * NO hardcoded literals allowed.
 */

import { AgentBase } from '../runtime/agent-base.js';
import type { AgentMessage, HouseType } from '../runtime/types.js';
import { getConfigManager } from '../config/index.js';
import type { ConfigManager } from '../config/types.js';
import { EXCELLENCE_CONFIG_KEYS } from '../config/excellence-config.js';

// ═══════════════════════════════════════════════════════════════════
// ARCHIVIST TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * A registered expression in the index
 */
export interface IndexedExpression {
  /** Unique identifier */
  id: string;

  /** The expression text */
  text: string;

  /** Concept category it belongs to */
  category: string;

  /** Excellence score */
  excellenceScore: number;

  /** Source node ID for provenance */
  sourceNodeId?: string;

  /** Embedding vector (for similarity search) */
  embedding?: number[];

  /** Usage count in outputs */
  usageCount: number;

  /** When it was indexed */
  indexedAt: Date;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A concept category with its expressions
 */
export interface ExpressionCategory {
  /** Category identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this category covers */
  description: string;

  /** Number of expressions in this category */
  expressionCount: number;

  /** The canonical (best) expression for this category */
  canonicalId?: string;

  /** Average excellence score */
  avgScore: number;

  /** Category embedding (centroid of expressions) */
  embedding?: number[];
}

/**
 * Result of finding a canonical expression
 */
export interface CanonicalResult {
  /** The best expression found */
  expression: IndexedExpression | null;

  /** Alternative expressions */
  alternatives: IndexedExpression[];

  /** Confidence in the match (0-1) */
  confidence: number;

  /** The category that matched */
  matchedCategory?: string;
}

/**
 * Expression anchor for semantic navigation
 */
export interface ExpressionAnchor {
  id: string;
  anchorType: 'expression' | 'category' | 'concept';
  text: string;
  embedding?: number[];
  qualityThreshold: number;
  linkedExpressions: string[];
}

/**
 * Index building result
 */
export interface IndexBuildResult {
  /** Categories created/updated */
  categoriesProcessed: number;

  /** Expressions indexed */
  expressionsIndexed: number;

  /** Duplicates removed */
  duplicatesRemoved: number;

  /** Time taken in ms */
  durationMs: number;

  /** Any errors encountered */
  errors: string[];
}

/**
 * Archivist intention
 */
export interface ArchivistIntention {
  type: 'index' | 'dedupe' | 'promote' | 'cleanup';
  priority: number;
  reason: string;
  targetIds: string[];
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface BuildCategoryIndexRequest {
  category: string;
  expressions: Array<{
    text: string;
    score: number;
    sourceNodeId?: string;
  }>;
  projectId?: string;
}

interface RegisterExpressionRequest {
  text: string;
  category: string;
  score: number;
  sourceNodeId?: string;
  metadata?: Record<string, unknown>;
  projectId?: string;
}

interface FindCanonicalRequest {
  concept: string;
  category?: string;
  minScore?: number;
  projectId?: string;
}

interface SuggestRefinementRequest {
  text: string;
  category?: string;
  projectId?: string;
}

interface DeduplicateRequest {
  category?: string;
  threshold?: number;
  projectId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// ARCHIVIST AGENT
// ═══════════════════════════════════════════════════════════════════

export class ArchivistAgent extends AgentBase {
  readonly id = 'archivist';
  readonly name = 'The Archivist';
  readonly house: HouseType = 'archivist';
  readonly capabilities = [
    'build-category-index',
    'register-expression',
    'find-canonical',
    'suggest-refinement',
    'deduplicate',
    'list-categories',
    'get-category-expressions',
  ];

  private configManager: ConfigManager;
  private pendingIntentions: ArchivistIntention[] = [];

  // In-memory index (would be persisted to DB in production)
  private expressionIndex: Map<string, IndexedExpression> = new Map();
  private categoryIndex: Map<string, ExpressionCategory> = new Map();
  private categoryExpressions: Map<string, Set<string>> = new Map();

  constructor() {
    super();
    this.configManager = getConfigManager();
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    this.log('info', 'Archivist awakening - ready to index expressions');

    this.subscribe('refiner:expression-polished');
    this.subscribe('prospector:excellence-found');
    this.subscribe('content:batch-indexed');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'Archivist retiring');
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'build-category-index':
        return this.buildCategoryIndex(message.payload as BuildCategoryIndexRequest);

      case 'register-expression':
        return this.registerExpression(message.payload as RegisterExpressionRequest);

      case 'find-canonical':
        return this.findCanonical(message.payload as FindCanonicalRequest);

      case 'suggest-refinement':
        return this.suggestRefinement(message.payload as SuggestRefinementRequest);

      case 'deduplicate':
        return this.deduplicate(message.payload as DeduplicateRequest);

      case 'list-categories':
        return this.listCategories();

      case 'get-category-expressions':
        return this.getCategoryExpressions(message.payload as { category: string; limit?: number });

      case 'get-intentions':
        return this.getIntentions();

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // INDEX BUILDING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Build or update a category index with expressions
   */
  private async buildCategoryIndex(request: BuildCategoryIndexRequest): Promise<IndexBuildResult> {
    const { category, expressions } = request;
    const startTime = Date.now();
    const errors: string[] = [];

    // Get config
    const minScore = await this.configManager.getOrDefault<number>(
      'thresholds',
      EXCELLENCE_CONFIG_KEYS.INDEX_MIN_SCORE,
      70
    );
    const maxPerCategory = await this.configManager.getOrDefault<number>(
      'limits',
      EXCELLENCE_CONFIG_KEYS.INDEX_MAX_PER_CATEGORY,
      100
    );
    const similarityThreshold = await this.configManager.getOrDefault<number>(
      'thresholds',
      EXCELLENCE_CONFIG_KEYS.INDEX_SIMILARITY_THRESHOLD,
      0.85
    );

    // Filter by minimum score
    const qualifyingExpressions = expressions.filter(e => e.score >= minScore);

    // Create/update category
    let categoryData = this.categoryIndex.get(category);
    if (!categoryData) {
      const categoryInfo = await this.analyzeCategory(category);
      categoryData = {
        id: category,
        name: categoryInfo.name,
        description: categoryInfo.description,
        expressionCount: 0,
        avgScore: 0,
      };
      this.categoryIndex.set(category, categoryData);
      this.categoryExpressions.set(category, new Set());
    }

    let indexedCount = 0;
    let duplicatesRemoved = 0;

    // Index each expression
    for (const expr of qualifyingExpressions) {
      try {
        // Check for duplicates
        const isDuplicate = await this.isDuplicateExpression(expr.text, category, similarityThreshold);
        if (isDuplicate) {
          duplicatesRemoved++;
          continue;
        }

        // Check category limit
        const categoryExprs = this.categoryExpressions.get(category)!;
        if (categoryExprs.size >= maxPerCategory) {
          // Remove lowest scored expression if new one is better
          const removed = await this.removeLowestScored(category, expr.score);
          if (!removed) {
            continue; // New expression isn't good enough
          }
        }

        // Register the expression
        await this.registerExpression({
          text: expr.text,
          category,
          score: expr.score,
          sourceNodeId: expr.sourceNodeId,
          projectId: request.projectId,
        });

        indexedCount++;
      } catch (error) {
        errors.push(`Failed to index expression: ${error}`);
      }
    }

    // Update category stats
    await this.updateCategoryStats(category);

    return {
      categoriesProcessed: 1,
      expressionsIndexed: indexedCount,
      duplicatesRemoved,
      durationMs: Date.now() - startTime,
      errors,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // EXPRESSION REGISTRATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Register a new expression in the index
   */
  private async registerExpression(request: RegisterExpressionRequest): Promise<IndexedExpression> {
    const { text, category, score, sourceNodeId, metadata } = request;

    const id = this.generateExpressionId(text, category);

    // Generate embedding for similarity search
    const embedding = await this.generateEmbedding(text);

    const expression: IndexedExpression = {
      id,
      text,
      category,
      excellenceScore: score,
      sourceNodeId,
      embedding,
      usageCount: 0,
      indexedAt: new Date(),
      metadata,
    };

    // Store in index
    this.expressionIndex.set(id, expression);

    // Add to category
    if (!this.categoryExpressions.has(category)) {
      this.categoryExpressions.set(category, new Set());
    }
    this.categoryExpressions.get(category)!.add(id);

    // Update category stats
    await this.updateCategoryStats(category);

    this.log('debug', `Registered expression in category "${category}": "${text.substring(0, 50)}..."`);

    return expression;
  }

  // ─────────────────────────────────────────────────────────────────
  // CANONICAL FINDING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Find the canonical (best) expression for a concept
   */
  private async findCanonical(request: FindCanonicalRequest): Promise<CanonicalResult> {
    const { concept, category, minScore = 60 } = request;

    // If category specified, search within it
    if (category) {
      return this.findCanonicalInCategory(concept, category, minScore);
    }

    // Otherwise, find best matching category first
    const matchedCategory = await this.findBestCategory(concept);
    if (!matchedCategory) {
      return {
        expression: null,
        alternatives: [],
        confidence: 0,
        matchedCategory: undefined,
      };
    }

    return this.findCanonicalInCategory(concept, matchedCategory, minScore);
  }

  /**
   * Find canonical expression within a specific category
   */
  private async findCanonicalInCategory(
    concept: string,
    category: string,
    minScore: number
  ): Promise<CanonicalResult> {
    const expressionIds = this.categoryExpressions.get(category);
    if (!expressionIds || expressionIds.size === 0) {
      return {
        expression: null,
        alternatives: [],
        confidence: 0,
        matchedCategory: category,
      };
    }

    // Get all expressions in category
    const expressions = Array.from(expressionIds)
      .map(id => this.expressionIndex.get(id)!)
      .filter(e => e.excellenceScore >= minScore);

    if (expressions.length === 0) {
      return {
        expression: null,
        alternatives: [],
        confidence: 0,
        matchedCategory: category,
      };
    }

    // Generate embedding for concept
    const conceptEmbedding = await this.generateEmbedding(concept);

    // Find most similar expressions
    const scored = expressions.map(expr => ({
      expression: expr,
      similarity: expr.embedding
        ? this.cosineSimilarity(conceptEmbedding, expr.embedding)
        : 0,
    }));

    // Sort by combined score (similarity + excellence)
    scored.sort((a, b) => {
      const scoreA = a.similarity * 0.4 + (a.expression.excellenceScore / 100) * 0.6;
      const scoreB = b.similarity * 0.4 + (b.expression.excellenceScore / 100) * 0.6;
      return scoreB - scoreA;
    });

    const best = scored[0];
    const alternatives = scored.slice(1, 4).map(s => s.expression);

    return {
      expression: best.expression,
      alternatives,
      confidence: best.similarity,
      matchedCategory: category,
    };
  }

  /**
   * Find the best matching category for a concept
   */
  private async findBestCategory(concept: string): Promise<string | null> {
    if (this.categoryIndex.size === 0) {
      return null;
    }

    const conceptEmbedding = await this.generateEmbedding(concept);

    let bestCategory: string | null = null;
    let bestSimilarity = 0;

    for (const [categoryId, category] of this.categoryIndex) {
      if (category.embedding) {
        const similarity = this.cosineSimilarity(conceptEmbedding, category.embedding);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCategory = categoryId;
        }
      }
    }

    // Also try text matching on category name/description
    const textAnalysis = await this.callAI('analysis', concept, {
      systemPrompt: `Match this concept to one of these categories:
${Array.from(this.categoryIndex.values()).map(c => `- ${c.id}: ${c.description}`).join('\n')}

Respond with JSON: { "categoryId": "best match or null", "confidence": 0.0-1.0 }`,
    });

    const parsed = this.parseAnalysis(textAnalysis) as { categoryId?: string; confidence?: number };

    if (parsed.categoryId && (parsed.confidence || 0) > bestSimilarity) {
      return parsed.categoryId;
    }

    return bestSimilarity > 0.5 ? bestCategory : null;
  }

  // ─────────────────────────────────────────────────────────────────
  // REFINEMENT SUGGESTIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Suggest better expressions for given text
   */
  private async suggestRefinement(request: SuggestRefinementRequest): Promise<{
    suggestions: IndexedExpression[];
    reasoning: string;
  }> {
    const { text, category } = request;

    // Find canonical for this concept
    const canonical = await this.findCanonical({
      concept: text,
      category,
      projectId: request.projectId,
    });

    if (!canonical.expression) {
      return {
        suggestions: [],
        reasoning: 'No similar expressions found in index',
      };
    }

    const suggestions = [canonical.expression, ...canonical.alternatives];

    // Generate reasoning
    const reasoning = await this.callAI('analysis', JSON.stringify({
      original: text,
      suggestions: suggestions.map(s => s.text),
    }), {
      systemPrompt: `Compare the original text to the suggested alternatives.
Explain briefly why the suggestions might be better expressions of the same idea.
Output 1-2 sentences.`,
    });

    return {
      suggestions,
      reasoning: reasoning.trim(),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // DEDUPLICATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Remove duplicate expressions from the index
   */
  private async deduplicate(request: DeduplicateRequest): Promise<{
    removed: number;
    categories: string[];
  }> {
    const threshold = request.threshold ?? await this.configManager.getOrDefault<number>(
      'thresholds',
      EXCELLENCE_CONFIG_KEYS.INDEX_SIMILARITY_THRESHOLD,
      0.85
    );

    let totalRemoved = 0;
    const affectedCategories: Set<string> = new Set();

    const categoriesToProcess = request.category
      ? [request.category]
      : Array.from(this.categoryExpressions.keys());

    for (const category of categoriesToProcess) {
      const expressionIds = this.categoryExpressions.get(category);
      if (!expressionIds) continue;

      const expressions = Array.from(expressionIds)
        .map(id => this.expressionIndex.get(id)!)
        .filter(Boolean);

      const toRemove: Set<string> = new Set();

      // Compare all pairs
      for (let i = 0; i < expressions.length; i++) {
        if (toRemove.has(expressions[i].id)) continue;

        for (let j = i + 1; j < expressions.length; j++) {
          if (toRemove.has(expressions[j].id)) continue;

          const similarity = expressions[i].embedding && expressions[j].embedding
            ? this.cosineSimilarity(expressions[i].embedding!, expressions[j].embedding!)
            : await this.textSimilarity(expressions[i].text, expressions[j].text);

          if (similarity >= threshold) {
            // Keep the higher scored one
            if (expressions[i].excellenceScore >= expressions[j].excellenceScore) {
              toRemove.add(expressions[j].id);
            } else {
              toRemove.add(expressions[i].id);
            }
          }
        }
      }

      // Remove duplicates
      for (const id of toRemove) {
        this.expressionIndex.delete(id);
        expressionIds.delete(id);
        totalRemoved++;
      }

      if (toRemove.size > 0) {
        affectedCategories.add(category);
        await this.updateCategoryStats(category);
      }
    }

    return {
      removed: totalRemoved,
      categories: Array.from(affectedCategories),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // CATEGORY MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * List all categories
   */
  private listCategories(): ExpressionCategory[] {
    return Array.from(this.categoryIndex.values());
  }

  /**
   * Get expressions in a category
   */
  private getCategoryExpressions(request: { category: string; limit?: number }): IndexedExpression[] {
    const { category, limit = 20 } = request;
    const expressionIds = this.categoryExpressions.get(category);

    if (!expressionIds) {
      return [];
    }

    return Array.from(expressionIds)
      .map(id => this.expressionIndex.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.excellenceScore - a.excellenceScore)
      .slice(0, limit);
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private generateExpressionId(text: string, category: string): string {
    const hash = this.simpleHash(text);
    return `expr-${category}-${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.bus.request('model-master', {
        type: 'call-capability',
        payload: {
          capability: 'embedding',
          input: text,
        },
      });

      if (response.success && response.data) {
        const data = response.data as { embedding?: number[] };
        return data.embedding || [];
      }
    } catch (error) {
      this.log('debug', `Embedding generation failed: ${error}`);
    }
    return [];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private async textSimilarity(text1: string, text2: string): Promise<number> {
    const embed1 = await this.generateEmbedding(text1);
    const embed2 = await this.generateEmbedding(text2);

    if (embed1.length > 0 && embed2.length > 0) {
      return this.cosineSimilarity(embed1, embed2);
    }

    // Fallback: Jaccard
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set(Array.from(words1).filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  private async isDuplicateExpression(
    text: string,
    category: string,
    threshold: number
  ): Promise<boolean> {
    const expressionIds = this.categoryExpressions.get(category);
    if (!expressionIds) return false;

    const newEmbedding = await this.generateEmbedding(text);

    for (const id of expressionIds) {
      const existing = this.expressionIndex.get(id);
      if (existing?.embedding) {
        const similarity = this.cosineSimilarity(newEmbedding, existing.embedding);
        if (similarity >= threshold) {
          return true;
        }
      }
    }

    return false;
  }

  private async removeLowestScored(category: string, newScore: number): Promise<boolean> {
    const expressionIds = this.categoryExpressions.get(category);
    if (!expressionIds) return false;

    let lowestId: string | null = null;
    let lowestScore = Infinity;

    for (const id of expressionIds) {
      const expr = this.expressionIndex.get(id);
      if (expr && expr.excellenceScore < lowestScore) {
        lowestScore = expr.excellenceScore;
        lowestId = id;
      }
    }

    if (lowestId && lowestScore < newScore) {
      this.expressionIndex.delete(lowestId);
      expressionIds.delete(lowestId);
      return true;
    }

    return false;
  }

  private async updateCategoryStats(category: string): Promise<void> {
    const expressionIds = this.categoryExpressions.get(category);
    const categoryData = this.categoryIndex.get(category);

    if (!expressionIds || !categoryData) return;

    const expressions = Array.from(expressionIds)
      .map(id => this.expressionIndex.get(id)!)
      .filter(Boolean);

    categoryData.expressionCount = expressions.length;

    if (expressions.length > 0) {
      categoryData.avgScore = expressions.reduce((sum, e) => sum + e.excellenceScore, 0) / expressions.length;

      // Find canonical (highest scored)
      const sorted = [...expressions].sort((a, b) => b.excellenceScore - a.excellenceScore);
      categoryData.canonicalId = sorted[0].id;

      // Calculate centroid embedding
      const embeddings = expressions.filter(e => e.embedding && e.embedding.length > 0).map(e => e.embedding!);
      if (embeddings.length > 0) {
        categoryData.embedding = this.calculateCentroid(embeddings);
      }
    }
  }

  private calculateCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];

    const dim = embeddings[0].length;
    const centroid = new Array(dim).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += embedding[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      centroid[i] /= embeddings.length;
    }

    return centroid;
  }

  private async analyzeCategory(category: string): Promise<{ name: string; description: string }> {
    const analysis = await this.callAI('analysis', category, {
      systemPrompt: `Generate a human-readable name and description for this expression category.
The category is: "${category}"

Respond with JSON: { "name": "Human Name", "description": "What expressions in this category cover" }`,
    });

    const parsed = this.parseAnalysis(analysis) as { name?: string; description?: string };

    return {
      name: parsed.name || category,
      description: parsed.description || `Expressions related to ${category}`,
    };
  }

  private async callAI(capability: string, input: string, options?: { systemPrompt?: string }): Promise<string> {
    const response = await this.bus.request('model-master', {
      type: 'call-capability',
      payload: {
        capability,
        input,
        params: options,
      },
    });

    if (!response.success) {
      throw new Error(response.error || 'AI call failed');
    }

    return (response.data as { output: string }).output;
  }

  private parseAnalysis(analysis: string): Record<string, unknown> | unknown[] {
    try {
      const arrayMatch = analysis.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]);
      }
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch {
      return {};
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // INTENTIONS
  // ─────────────────────────────────────────────────────────────────

  private addIntention(intention: ArchivistIntention): void {
    const exists = this.pendingIntentions.some(
      i => i.type === intention.type &&
           JSON.stringify(i.targetIds) === JSON.stringify(intention.targetIds)
    );
    if (!exists) {
      this.pendingIntentions.push(intention);
      this.pendingIntentions.sort((a, b) => b.priority - a.priority);
    }
  }

  private getIntentions(): ArchivistIntention[] {
    return [...this.pendingIntentions];
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _archivist: ArchivistAgent | null = null;

export function getArchivistAgent(): ArchivistAgent {
  if (!_archivist) {
    _archivist = new ArchivistAgent();
  }
  return _archivist;
}

/**
 * Reset the Archivist agent (for testing)
 */
export function resetArchivistAgent(): void {
  _archivist = null;
}
