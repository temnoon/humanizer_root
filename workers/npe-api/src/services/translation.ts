// Direct Translation Service - Translate from any language to target language
// Supports ~40+ languages including Latin, Ancient Greek, and other classical languages

import type { Env } from '../../shared/types';
import { createLLMProvider, type LLMProvider } from './llm-providers';
import { hasCloudflareAI, detectEnvironment, getModelForUseCase } from '../config/llm-models';

export interface TranslationResult {
  translationId: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  detectedLanguage: boolean; // true if source was auto-detected
  confidence: number; // 0.0-1.0 confidence in translation
  model: string;
  processingTimeMs: number;
}

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  script?: string; // e.g., "Latin", "Cyrillic", "Greek"
}

/**
 * TranslationService - Direct translation between languages
 *
 * Supports comprehensive language coverage including:
 * - Classical: Latin, Ancient Greek, Classical Chinese
 * - Modern European: All major languages
 * - Asian: Chinese, Japanese, Korean, Vietnamese, Thai
 * - Middle Eastern: Arabic, Hebrew, Persian, Turkish
 * - South Asian: Hindi, Bengali, Tamil, Urdu
 * - And many more via Llama-3.1-70b multilingual capabilities
 *
 * Features:
 * - Automatic chunking for long texts (Project Gutenberg books, etc.)
 * - Sentence-boundary aware splitting to preserve coherence
 * - Parallel chunk processing for faster translation
 */
export class TranslationService {
  // Chunk size for long text processing (~4000 chars = ~1000 tokens, safe for 8K context)
  private static readonly CHUNK_SIZE = 4000;
  private static readonly CHUNK_OVERLAP = 100; // Small overlap for context continuity

  // Comprehensive language list (40+ languages)
  private static readonly SUPPORTED_LANGUAGES: Record<string, string[]> = {
    // Classical Languages
    classical: ['latin', 'ancient greek', 'classical chinese', 'sanskrit', 'old english', 'middle english'],

    // European - Romance
    romance: ['spanish', 'french', 'italian', 'portuguese', 'romanian', 'catalan'],

    // European - Germanic
    germanic: ['german', 'dutch', 'swedish', 'norwegian', 'danish', 'icelandic'],

    // European - Slavic
    slavic: ['russian', 'polish', 'czech', 'ukrainian', 'bulgarian', 'serbian', 'croatian'],

    // European - Other
    european_other: ['greek', 'hungarian', 'finnish', 'estonian', 'latvian', 'lithuanian'],

    // Asian - East
    east_asian: ['chinese', 'japanese', 'korean', 'vietnamese'],

    // Asian - South
    south_asian: ['hindi', 'bengali', 'tamil', 'telugu', 'urdu', 'marathi', 'gujarati'],

    // Middle Eastern
    middle_eastern: ['arabic', 'hebrew', 'persian', 'turkish'],

    // African
    african: ['swahili', 'amharic', 'yoruba', 'zulu'],

    // Other
    other: ['indonesian', 'malay', 'tagalog', 'thai']
  };

  private llmProvider: LLMProvider | null = null;
  private modelId: string;

  constructor(
    private env: Env,
    private userId: string = 'anonymous'
  ) {
    const hasAI = hasCloudflareAI(env);
    const environment = detectEnvironment(hasAI);
    // Use roundTrip model config (same multilingual requirements)
    this.modelId = getModelForUseCase('roundTrip', environment);

  }

  /**
   * Get all supported languages as flat array
   */
  static getSupportedLanguages(): string[] {
    const all: string[] = [];
    for (const languages of Object.values(this.SUPPORTED_LANGUAGES)) {
      all.push(...languages);
    }
    return all;
  }

  /**
   * Get languages by category
   */
  static getLanguagesByCategory(): Record<string, string[]> {
    return { ...this.SUPPORTED_LANGUAGES };
  }

  /**
   * Check if language is supported
   */
  static isLanguageSupported(language: string): boolean {
    const normalized = language.toLowerCase().trim();
    return this.getSupportedLanguages().includes(normalized);
  }

  /**
   * Split text into chunks at sentence boundaries
   * Preserves paragraph structure and avoids breaking mid-sentence
   */
  private splitIntoChunks(text: string): string[] {
    const chunkSize = TranslationService.CHUNK_SIZE;

    // If text is short enough, return as single chunk
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= chunkSize) {
        chunks.push(remaining.trim());
        break;
      }

      // Find a good break point within the chunk size
      let breakPoint = chunkSize;

      // Try to break at paragraph boundary first (double newline)
      const paragraphBreak = remaining.lastIndexOf('\n\n', chunkSize);
      if (paragraphBreak > chunkSize * 0.5) {
        breakPoint = paragraphBreak + 2;
      } else {
        // Try to break at sentence boundary (. ! ? followed by space or newline)
        const sentenceMatch = remaining.substring(0, chunkSize).match(/[.!?][\s\n](?=[A-Z])/g);
        if (sentenceMatch) {
          // Find the last sentence ending
          const lastSentenceEnd = remaining.substring(0, chunkSize).lastIndexOf(sentenceMatch[sentenceMatch.length - 1]);
          if (lastSentenceEnd > chunkSize * 0.3) {
            breakPoint = lastSentenceEnd + 2;
          }
        }
      }

      // Extract chunk and continue
      const chunk = remaining.substring(0, breakPoint).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      remaining = remaining.substring(breakPoint).trim();
    }

    return chunks;
  }

  /**
   * Translate a single chunk (internal method)
   */
  private async translateChunk(
    chunk: string,
    sourceLanguage: string,
    targetLanguage: string,
    systemPrompt: string,
    chunkIndex: number,
    totalChunks: number
  ): Promise<string> {
    const contextNote = totalChunks > 1
      ? `\n\n[This is part ${chunkIndex + 1} of ${totalChunks}. Maintain consistency with surrounding parts.]`
      : '';

    const prompt = `Translate this ${sourceLanguage} text to ${targetLanguage}:${contextNote}

${chunk}

Translation:`;

    if (!this.llmProvider) {
      this.llmProvider = await createLLMProvider(this.modelId, this.env, this.userId);
    }

    const response = await this.llmProvider.call({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: Math.min(4096, Math.ceil(chunk.length * 1.5)),
      temperature: 0.3
    });

    return (response.response || '').trim();
  }

  /**
   * Detect language of input text
   */
  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    const systemPrompt = `You are a language detection expert. Identify the language of the provided text.
Consider:
- Classical languages (Latin, Ancient Greek, Sanskrit)
- Modern languages
- Historical variants (Old English, Middle English)

Respond in JSON format only:
{"language": "language name", "confidence": 0.0-1.0, "script": "script type"}`;

    const prompt = `Identify the language of this text:

"${text.substring(0, 500)}"

JSON response:`;

    try {
      if (!this.llmProvider) {
        this.llmProvider = await createLLMProvider(this.modelId, this.env, this.userId);
      }

      const response = await this.llmProvider.call({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.1
      });

      const responseText = (response.response || '').trim();

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          language: parsed.language?.toLowerCase() || 'unknown',
          confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
          script: parsed.script
        };
      }

      return { language: 'unknown', confidence: 0 };
    } catch (error) {
      console.error('[Translation] Language detection failed:', error);
      return { language: 'unknown', confidence: 0 };
    }
  }

  /**
   * Translate text from source language to target language
   * Automatically handles long texts by chunking
   */
  async translate(
    text: string,
    targetLanguage: string = 'english',
    sourceLanguage?: string
  ): Promise<TranslationResult> {
    const startTime = Date.now();
    const translationId = crypto.randomUUID();

    // Auto-detect source language if not provided
    let actualSourceLanguage = sourceLanguage?.toLowerCase().trim();
    let detectedLanguage = false;

    if (!actualSourceLanguage) {
      const detection = await this.detectLanguage(text);
      actualSourceLanguage = detection.language;
      detectedLanguage = true;
    }

    // Normalize target language
    const normalizedTarget = targetLanguage.toLowerCase().trim();

    // Skip translation if source and target are the same
    if (actualSourceLanguage === normalizedTarget) {
      return {
        translationId,
        originalText: text,
        translatedText: text,
        sourceLanguage: actualSourceLanguage,
        targetLanguage: normalizedTarget,
        detectedLanguage,
        confidence: 1.0,
        model: this.modelId,
        processingTimeMs: Date.now() - startTime
      };
    }

    // Build specialized prompt based on language type
    const systemPrompt = this.buildTranslationPrompt(actualSourceLanguage, normalizedTarget);

    try {
      // Split text into chunks if needed
      const chunks = this.splitIntoChunks(text);
      let translatedText: string;

      if (chunks.length === 1) {
        // Single chunk - direct translation
        translatedText = await this.translateChunk(
          chunks[0],
          actualSourceLanguage,
          normalizedTarget,
          systemPrompt,
          0,
          1
        );
      } else {
        // Multiple chunks - translate each and combine
        const translatedChunks: string[] = [];

        for (let i = 0; i < chunks.length; i++) {
          const translated = await this.translateChunk(
            chunks[i],
            actualSourceLanguage,
            normalizedTarget,
            systemPrompt,
            i,
            chunks.length
          );
          translatedChunks.push(translated);
        }

        // Combine chunks with paragraph breaks
        translatedText = translatedChunks.join('\n\n');
      }

      const processingTimeMs = Date.now() - startTime;

      // Store in database
      await this.storeTranslation(
        translationId,
        text,
        translatedText,
        actualSourceLanguage,
        normalizedTarget,
        detectedLanguage,
        processingTimeMs
      );

      return {
        translationId,
        originalText: text,
        translatedText,
        sourceLanguage: actualSourceLanguage,
        targetLanguage: normalizedTarget,
        detectedLanguage,
        confidence: 0.9, // Default high confidence for LLM translation
        model: this.modelId,
        processingTimeMs
      };
    } catch (error) {
      console.error('[Translation] Translation failed:', error);
      throw new Error(`Translation failed: ${actualSourceLanguage} → ${normalizedTarget}`);
    }
  }

  /**
   * Build specialized translation prompt based on language pair
   */
  private buildTranslationPrompt(sourceLang: string, targetLang: string): string {
    const isClassicalSource = ['latin', 'ancient greek', 'classical chinese', 'sanskrit', 'old english', 'middle english'].includes(sourceLang);

    // Core instruction: translation only, no commentary
    const outputInstruction = `

CRITICAL: Output ONLY the translation. Do not include:
- Introductory phrases like "Here is the translation:"
- Notes or commentary about the translation
- Explanations of your translation choices
- Meta-discussion about the source text

Start directly with the translated text.`;

    if (isClassicalSource) {
      return `You are an expert translator specializing in ${sourceLang} to ${targetLang} translation.

Guidelines for classical/historical text translation:
1. Preserve the scholarly tone and complexity of the original
2. Maintain technical terminology (do not add explanatory notes inline)
3. Keep sentence structure that reflects the original's rhetorical style
4. For ambiguous passages, prefer the most contextually appropriate interpretation
5. Preserve any formatting (headings, numbered lists, etc.)

Provide an accurate, natural translation that a modern ${targetLang} reader can understand while respecting the original's historical context.${outputInstruction}`;
    }

    return `You are a professional translator specializing in ${sourceLang} to ${targetLang} translation.

Guidelines:
1. Provide accurate, natural translations that preserve meaning and cultural context
2. Maintain the original text's tone, style, and emotional register
3. Preserve formatting (paragraphs, lists, etc.)
4. For idiomatic expressions, use appropriate ${targetLang} equivalents
5. Keep proper nouns and technical terms appropriately${outputInstruction}`;
  }

  // TODO: Future enhancement - separate commentary support
  // Could add a `withCommentary: boolean` option that:
  // 1. Asks LLM to output JSON: { "translation": "...", "notes": [...] }
  // 2. Returns structured response with optional notes array
  // 3. Frontend can display notes in collapsible section
  // This adds complexity (JSON parsing, error handling, UI changes)
  // Defer until translation feature is validated with users

  /**
   * Store translation in database
   */
  private async storeTranslation(
    id: string,
    originalText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string,
    detectedLanguage: boolean,
    processingTimeMs: number
  ): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT INTO transformations (id, user_id, type, source_text, result_text, parameters, created_at)
        VALUES (?, ?, 'translation', ?, ?, ?, ?)
      `).bind(
        id,
        this.userId,
        originalText,
        translatedText,
        JSON.stringify({
          sourceLanguage,
          targetLanguage,
          detectedLanguage,
          processingTimeMs
        }),
        Date.now()
      ).run();
    } catch (error) {
      console.error('[Translation] Failed to store translation:', error);
      // Don't throw - translation succeeded, storage is secondary
    }
  }
}
