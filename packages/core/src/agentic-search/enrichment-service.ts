/**
 * Enrichment Service
 *
 * AI-powered enrichment for search results:
 * - Title generation for content without titles
 * - Summary generation
 * - Quality rating (0-5)
 * - Category/tag suggestions
 *
 * Uses lazy enrichment - generated on-demand, not at index time.
 */

import type {
  AgenticSearchResult,
  ResultEnrichment,
  LlmAdapter,
  EmbeddingFunction,
} from './types.js';
import {
  TITLE_GENERATION_MAX_CHARS,
  SUMMARY_GENERATION_MAX_CHARS,
  DEFAULT_SUMMARY_WORDS,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// ENRICHMENT SERVICE OPTIONS
// ═══════════════════════════════════════════════════════════════════

export interface EnrichmentServiceOptions {
  /** Default summary length in words */
  defaultSummaryWords?: number;

  /** Maximum parallel enrichment requests */
  maxParallel?: number;

  /** Cache enrichments */
  enableCache?: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════════

const TITLE_PROMPT = `Generate a concise, descriptive title (5-10 words) for the following text. The title should capture the main topic or theme. Return only the title, no quotes or explanation.

Text:
{text}

Title:`;

const SUMMARY_PROMPT = `Summarize the following text in approximately {words} words. Focus on the key points and main ideas. Return only the summary.

Text:
{text}

Summary:`;

const RATING_PROMPT = `Rate the quality of the following text on a scale of 0-5, where:
- 0: Spam, gibberish, or completely unintelligible
- 1: Very low quality, minimal content value
- 2: Low quality, some content but poorly expressed
- 3: Average quality, coherent and somewhat informative
- 4: Good quality, well-written and informative
- 5: Excellent quality, insightful, well-structured, and valuable

Return only a single number (0-5).

Text:
{text}

Rating:`;

const CATEGORIES_PROMPT = `Suggest 2-5 category tags for the following text. Categories should be broad topic areas like "technology", "philosophy", "personal", "work", etc. Return only the categories as a comma-separated list.

Text:
{text}

Categories:`;

const KEY_TERMS_PROMPT = `Extract 3-7 key terms or entities from the following text. These should be the most important concepts, names, or topics mentioned. Return only the terms as a comma-separated list.

Text:
{text}

Key terms:`;

// ═══════════════════════════════════════════════════════════════════
// ENRICHMENT SERVICE
// ═══════════════════════════════════════════════════════════════════

export class EnrichmentService {
  private llmAdapter: LlmAdapter;
  private embedFn: EmbeddingFunction;
  private options: EnrichmentServiceOptions;
  private cache: Map<string, ResultEnrichment>;

  constructor(
    llmAdapter: LlmAdapter,
    embedFn: EmbeddingFunction,
    options?: EnrichmentServiceOptions
  ) {
    this.llmAdapter = llmAdapter;
    this.embedFn = embedFn;
    this.options = options ?? {};
    this.cache = new Map();
  }

  // ─────────────────────────────────────────────────────────────────
  // INDIVIDUAL ENRICHMENTS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Generate a title for content without one.
   */
  async generateTitle(text: string): Promise<string> {
    const truncated = text.slice(0, TITLE_GENERATION_MAX_CHARS);
    const prompt = TITLE_PROMPT.replace('{text}', truncated);

    try {
      const response = await this.llmAdapter.complete(prompt, { maxTokens: 50 });
      return response.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
    } catch (error) {
      if (this.options.verbose) {
        console.error('[EnrichmentService] Title generation failed:', error);
      }
      // Fallback: first 10 words
      return text.split(/\s+/).slice(0, 10).join(' ') + '...';
    }
  }

  /**
   * Generate a summary.
   */
  async generateSummary(text: string, targetWords?: number): Promise<string> {
    const words = targetWords ?? this.options.defaultSummaryWords ?? DEFAULT_SUMMARY_WORDS;
    const truncated = text.slice(0, SUMMARY_GENERATION_MAX_CHARS);
    const prompt = SUMMARY_PROMPT
      .replace('{text}', truncated)
      .replace('{words}', String(words));

    try {
      const response = await this.llmAdapter.complete(prompt, { maxTokens: words * 2 });
      return response.trim();
    } catch (error) {
      if (this.options.verbose) {
        console.error('[EnrichmentService] Summary generation failed:', error);
      }
      // Fallback: first N words
      return text.split(/\s+/).slice(0, words).join(' ') + '...';
    }
  }

  /**
   * Generate quality rating (0-5).
   */
  async generateRating(text: string): Promise<number> {
    const truncated = text.slice(0, SUMMARY_GENERATION_MAX_CHARS);
    const prompt = RATING_PROMPT.replace('{text}', truncated);

    try {
      const response = await this.llmAdapter.complete(prompt, { maxTokens: 5 });
      const rating = parseInt(response.trim(), 10);
      if (isNaN(rating) || rating < 0 || rating > 5) {
        return 3; // Default to average
      }
      return rating;
    } catch (error) {
      if (this.options.verbose) {
        console.error('[EnrichmentService] Rating generation failed:', error);
      }
      return 3; // Default to average
    }
  }

  /**
   * Suggest categories for content.
   */
  async suggestCategories(text: string): Promise<string[]> {
    const truncated = text.slice(0, SUMMARY_GENERATION_MAX_CHARS);
    const prompt = CATEGORIES_PROMPT.replace('{text}', truncated);

    try {
      const response = await this.llmAdapter.complete(prompt, { maxTokens: 100 });
      return response
        .trim()
        .split(',')
        .map(c => c.trim().toLowerCase())
        .filter(c => c.length > 0);
    } catch (error) {
      if (this.options.verbose) {
        console.error('[EnrichmentService] Category generation failed:', error);
      }
      return [];
    }
  }

  /**
   * Extract key terms from content.
   */
  async extractKeyTerms(text: string): Promise<string[]> {
    const truncated = text.slice(0, SUMMARY_GENERATION_MAX_CHARS);
    const prompt = KEY_TERMS_PROMPT.replace('{text}', truncated);

    try {
      const response = await this.llmAdapter.complete(prompt, { maxTokens: 100 });
      return response
        .trim()
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
    } catch (error) {
      if (this.options.verbose) {
        console.error('[EnrichmentService] Key terms extraction failed:', error);
      }
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // BATCH ENRICHMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Enrich a single result with all enrichments.
   */
  async enrichResult(result: AgenticSearchResult): Promise<AgenticSearchResult> {
    // Check cache
    if (this.options.enableCache && this.cache.has(result.id)) {
      return {
        ...result,
        enrichment: this.cache.get(result.id),
      };
    }

    const enrichment: ResultEnrichment = {
      enrichedAt: Date.now(),
    };

    // Generate title if not present
    if (!result.title) {
      enrichment.title = await this.generateTitle(result.text);
    }

    // Generate summary
    enrichment.summary = await this.generateSummary(result.text);

    // Generate rating
    enrichment.rating = await this.generateRating(result.text);

    // Suggest categories
    enrichment.categories = await this.suggestCategories(result.text);

    // Extract key terms
    enrichment.keyTerms = await this.extractKeyTerms(result.text);

    // Cache the enrichment
    if (this.options.enableCache) {
      this.cache.set(result.id, enrichment);
    }

    return {
      ...result,
      enrichment,
      title: result.title ?? enrichment.title,
    };
  }

  /**
   * Batch enrich multiple results.
   */
  async enrichBatch(results: AgenticSearchResult[]): Promise<AgenticSearchResult[]> {
    const maxParallel = this.options.maxParallel ?? 3;
    const enriched: AgenticSearchResult[] = [];

    // Process in batches to avoid overwhelming the LLM
    for (let i = 0; i < results.length; i += maxParallel) {
      const batch = results.slice(i, i + maxParallel);
      const batchResults = await Promise.all(
        batch.map(result => this.enrichResult(result))
      );
      enriched.push(...batchResults);
    }

    return enriched;
  }

  /**
   * Enrich only specific fields.
   */
  async enrichFields(
    result: AgenticSearchResult,
    fields: Array<'title' | 'summary' | 'rating' | 'categories' | 'keyTerms'>
  ): Promise<AgenticSearchResult> {
    const enrichment: ResultEnrichment = {
      ...result.enrichment,
      enrichedAt: Date.now(),
    };

    for (const field of fields) {
      switch (field) {
        case 'title':
          if (!result.title) {
            enrichment.title = await this.generateTitle(result.text);
          }
          break;
        case 'summary':
          enrichment.summary = await this.generateSummary(result.text);
          break;
        case 'rating':
          enrichment.rating = await this.generateRating(result.text);
          break;
        case 'categories':
          enrichment.categories = await this.suggestCategories(result.text);
          break;
        case 'keyTerms':
          enrichment.keyTerms = await this.extractKeyTerms(result.text);
          break;
      }
    }

    return {
      ...result,
      enrichment,
      title: result.title ?? enrichment.title,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // CACHE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Clear the enrichment cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size.
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Remove a specific entry from cache.
   */
  removeCacheEntry(resultId: string): boolean {
    return this.cache.delete(resultId);
  }
}

// ═══════════════════════════════════════════════════════════════════
// STUB LLM ADAPTER (for testing)
// ═══════════════════════════════════════════════════════════════════

/**
 * A stub LLM adapter that returns placeholder responses.
 * Useful for testing or when no LLM is available.
 */
export class StubLlmAdapter implements LlmAdapter {
  async complete(prompt: string, options?: { maxTokens?: number }): Promise<string> {
    // Extract what type of enrichment is being requested
    if (prompt.includes('Title:')) {
      return 'Generated Title';
    }
    if (prompt.includes('Summary:')) {
      return 'This is a generated summary of the content.';
    }
    if (prompt.includes('Rating:')) {
      return '3';
    }
    if (prompt.includes('Categories:')) {
      return 'general, uncategorized';
    }
    if (prompt.includes('Key terms:')) {
      return 'term1, term2, term3';
    }
    return '';
  }
}

// ═══════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════

/**
 * Create an EnrichmentService with the given LLM adapter.
 */
export function createEnrichmentService(
  llmAdapter: LlmAdapter,
  embedFn: EmbeddingFunction,
  options?: EnrichmentServiceOptions
): EnrichmentService {
  return new EnrichmentService(llmAdapter, embedFn, options);
}
