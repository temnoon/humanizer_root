// Round-Trip Translation Service - Semantic drift analysis through language
// Adapted from LPE translation_roundtrip.py for Cloudflare Workers

import type { Env } from '../../shared/types';

export interface RoundTripResult {
  transformation_id: string;
  original_text: string;
  intermediate_language: string;
  forward_translation: string;
  backward_translation: string;
  semantic_drift: number; // 0.0 = identical, 1.0 = completely different
  preserved_elements: string[];
  lost_elements: string[];
  gained_elements: string[];
  linguistic_analysis: {
    tone_change?: string;
    style_change?: string;
    complexity_change?: string;
    structural_changes?: string[];
    notable_patterns?: string[];
  };
  total_duration_ms: number;
}

/**
 * RoundTripTranslationService - Analyze semantic drift through language translation
 *
 * Process: English → Intermediate Language → English
 * Analyzes what is preserved, lost, or gained in the round-trip
 *
 * Based on LPE's LanguageRoundTripAnalyzer with 18 supported languages
 */
export class RoundTripTranslationService {
  private static readonly SUPPORTED_LANGUAGES = [
    'spanish', 'french', 'german', 'italian', 'portuguese', 'russian',
    'chinese', 'japanese', 'korean', 'arabic', 'hebrew', 'hindi',
    'dutch', 'swedish', 'norwegian', 'danish', 'polish', 'czech'
  ];

  constructor(private env: Env) {}

  /**
   * Check if language is supported
   */
  static isLanguageSupported(language: string): boolean {
    return this.SUPPORTED_LANGUAGES.includes(language.toLowerCase());
  }

  /**
   * Get list of supported languages
   */
  static getSupportedLanguages(): string[] {
    return [...this.SUPPORTED_LANGUAGES];
  }

  /**
   * Perform complete round-trip translation analysis
   */
  async performRoundTrip(
    text: string,
    intermediateLanguage: string,
    userId: string
  ): Promise<RoundTripResult> {
    const startTime = Date.now();

    // Validate language
    if (!RoundTripTranslationService.isLanguageSupported(intermediateLanguage)) {
      throw new Error(`Unsupported language: ${intermediateLanguage}. Supported: ${RoundTripTranslationService.SUPPORTED_LANGUAGES.join(', ')}`);
    }

    // Step 1: Forward translation (English → Intermediate)
    const forwardTranslation = await this.translate(text, 'english', intermediateLanguage);

    // Step 2: Backward translation (Intermediate → English)
    const backwardTranslation = await this.translate(forwardTranslation, intermediateLanguage, 'english');

    // Step 3: Calculate semantic drift
    const semanticDrift = await this.calculateSemanticDrift(text, backwardTranslation);

    // Step 4: Analyze element changes
    const { preserved, lost, gained } = await this.analyzeElementChanges(text, backwardTranslation);

    // Step 5: Linguistic analysis
    const linguisticAnalysis = await this.analyzeLinguisticChanges(text, backwardTranslation);

    const totalDuration = Date.now() - startTime;

    // Store in database
    const transformationId = crypto.randomUUID();

    await this.env.DB.prepare(`
      INSERT INTO transformations (id, user_id, type, source_text, result_text, parameters, created_at)
      VALUES (?, ?, 'round_trip', ?, ?, ?, ?)
    `).bind(
      transformationId,
      userId,
      text,
      backwardTranslation,
      JSON.stringify({ intermediate_language: intermediateLanguage }),
      Date.now()
    ).run();

    const roundTripId = crypto.randomUUID();

    await this.env.DB.prepare(`
      INSERT INTO round_trip_translations (
        id, transformation_id, intermediate_language,
        forward_translation, backward_translation, semantic_drift,
        preserved_elements, lost_elements, gained_elements
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      roundTripId,
      transformationId,
      intermediateLanguage,
      forwardTranslation,
      backwardTranslation,
      semanticDrift,
      JSON.stringify(preserved),
      JSON.stringify(lost),
      JSON.stringify(gained)
    ).run();

    return {
      transformation_id: transformationId,
      original_text: text,
      intermediate_language: intermediateLanguage,
      forward_translation: forwardTranslation,
      backward_translation: backwardTranslation,
      semantic_drift: semanticDrift,
      preserved_elements: preserved,
      lost_elements: lost,
      gained_elements: gained,
      linguistic_analysis: linguisticAnalysis,
      total_duration_ms: totalDuration
    };
  }

  /**
   * Translate text between two languages
   */
  private async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    const systemPrompt = `You are a professional translator specializing in ${sourceLang} to ${targetLang} translation.
Provide accurate, natural translations that preserve meaning and cultural context.
Translate the text preserving its narrative structure and emotional tone.`;

    const prompt = `Translate this ${sourceLang} text to ${targetLang}:

${text}

Translation:`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2048,
        temperature: 0.3 // Lower temperature for more accurate translation
      });

      return (response.response || '').trim();
    } catch (error) {
      console.error('Translation failed:', error);
      throw new Error(`Translation failed (${sourceLang} → ${targetLang})`);
    }
  }

  /**
   * Calculate semantic drift between original and final text
   * Returns score from 0.0 (identical meaning) to 1.0 (completely different)
   */
  private async calculateSemanticDrift(original: string, final: string): Promise<number> {
    const systemPrompt = `You are analyzing semantic similarity between two texts.
Rate the semantic similarity on a scale from 0.0 (completely different meaning) to 1.0 (identical meaning).
Consider meaning preservation, not just word similarity.
Respond with ONLY a number between 0.0 and 1.0.`;

    const prompt = `Compare these two texts for semantic similarity:

Original: ${original}

Final: ${final}

Semantic similarity score (0.0-1.0):`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 10,
        temperature: 0.1
      });

      const text = (response.response || '0.5').trim();
      const match = text.match(/(\d*\.?\d+)/);

      if (match) {
        const score = parseFloat(match[1]);
        // Return drift (inverse of similarity), clamped to valid range
        const drift = 1.0 - Math.max(0.0, Math.min(1.0, score));
        return drift;
      }

      return 0.5; // Default moderate drift if parsing fails
    } catch (error) {
      console.error('Semantic drift calculation failed:', error);
      return 0.5;
    }
  }

  /**
   * Analyze what elements were preserved, lost, or gained
   */
  private async analyzeElementChanges(
    original: string,
    final: string
  ): Promise<{ preserved: string[]; lost: string[]; gained: string[] }> {
    const systemPrompt = `You are analyzing content changes between two texts.
Identify what meaning elements were preserved, lost, or newly introduced.
Be specific and concise.`;

    const prompt = `Compare these texts for content changes:

Original: ${original}

Final: ${final}

List the changes in this exact format:
PRESERVED: element1, element2, element3
LOST: element1, element2, element3
GAINED: element1, element2, element3

Use concise phrases for each element.`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 512,
        temperature: 0.5
      });

      const text = response.response || '';
      const preserved: string[] = [];
      const lost: string[] = [];
      const gained: string[] = [];

      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('PRESERVED:')) {
          const content = trimmed.replace('PRESERVED:', '').trim();
          preserved.push(...this.parseElementList(content));
        } else if (trimmed.startsWith('LOST:')) {
          const content = trimmed.replace('LOST:', '').trim();
          lost.push(...this.parseElementList(content));
        } else if (trimmed.startsWith('GAINED:')) {
          const content = trimmed.replace('GAINED:', '').trim();
          gained.push(...this.parseElementList(content));
        }
      }

      return { preserved, lost, gained };
    } catch (error) {
      console.error('Element analysis failed:', error);
      return { preserved: [], lost: [], gained: [] };
    }
  }

  /**
   * Parse comma-separated element list
   */
  private parseElementList(text: string): string[] {
    if (!text || text === '[]' || text === 'none') return [];

    const elements = text
      .split(',')
      .map(e => e.trim().replace(/^["'\[\]]+|["'\[\]]+$/g, ''))
      .filter(e => e.length > 0 && e.toLowerCase() !== 'none');

    return elements;
  }

  /**
   * Analyze linguistic changes (tone, style, complexity)
   */
  private async analyzeLinguisticChanges(
    original: string,
    final: string
  ): Promise<Record<string, any>> {
    const systemPrompt = `You are a linguistic analyst. Analyze the linguistic changes between two texts.
Focus on changes in tone, style, complexity, and structural patterns.
Respond in valid JSON format.`;

    const prompt = `Analyze the linguistic changes between these texts:

Original: ${original}

Final: ${final}

Provide analysis in this JSON format:
{
  "tone_change": "description of tone changes",
  "style_change": "description of style changes",
  "complexity_change": "simpler/more_complex/similar",
  "structural_changes": ["change1", "change2"],
  "notable_patterns": ["pattern1", "pattern2"]
}`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 512,
        temperature: 0.5
      });

      const text = response.response || '';

      // Try to parse JSON response
      try {
        const parsed = JSON.parse(text);
        return parsed;
      } catch (parseError) {
        // Fallback to basic analysis
        return {
          tone_change: 'Analysis unavailable',
          style_change: 'Analysis unavailable',
          complexity_change: 'unknown',
          structural_changes: [],
          notable_patterns: []
        };
      }
    } catch (error) {
      console.error('Linguistic analysis failed:', error);
      return {};
    }
  }
}
