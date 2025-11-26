// Style Extraction Service - Extract writing style patterns from passages
// Analyzes text to create reusable styles for transformation tools

import type { Env } from '../../shared/types';
import { createLLMProvider, type LLMProvider } from './llm-providers';
import { hasCloudflareAI, detectEnvironment, getModelForUseCase } from '../config/llm-models';

export interface StyleAttributes {
  sentenceStructure: string;    // e.g., "complex, nested clauses", "short, declarative"
  vocabulary: string;           // e.g., "technical, Latin-derived", "colloquial"
  rhythm: string;               // e.g., "measured, deliberate", "staccato"
  paragraphStructure: string;   // e.g., "long, flowing", "short, punchy"
  punctuationStyle: string;     // e.g., "heavy use of semicolons", "minimal"
  rhetoricalDevices: string[];  // e.g., ["parallelism", "anaphora", "enumeration"]
}

export interface ExtractedStyle {
  id: number;
  name: string;
  stylePrompt: string;
  attributes: StyleAttributes;
  exampleSentences: string[];  // Representative sentences
  sourceInfo: {
    bookTitle?: string;
    author?: string;
    chapter?: string;
    sampleLength: number;
  };
  extractionId: string;
  processingTimeMs: number;
}

export interface StyleExtractionOptions {
  bookTitle?: string;
  author?: string;
  chapter?: string;
  customName?: string;
}

/**
 * StyleExtractionService - Extract writing style from text passages
 *
 * Analyzes:
 * - Sentence structure and complexity
 * - Vocabulary level and register
 * - Rhythmic patterns
 * - Punctuation tendencies
 * - Rhetorical devices used
 *
 * Creates reusable styles for the transformation pipeline
 */
export class StyleExtractionService {
  private llmProvider: LLMProvider | null = null;
  private modelId: string;

  constructor(
    private env: Env,
    private userId: string = 'anonymous'
  ) {
    const hasAI = hasCloudflareAI(env);
    const environment = detectEnvironment(hasAI);
    this.modelId = getModelForUseCase('style', environment);

    console.log(`[StyleExtraction] Environment: ${environment}, Model: ${this.modelId}`);
  }

  /**
   * Extract style from a text passage
   */
  async extractStyle(
    text: string,
    options: StyleExtractionOptions = {}
  ): Promise<ExtractedStyle> {
    const startTime = Date.now();
    const extractionId = crypto.randomUUID();

    // Validate input
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 50) {
      throw new Error('Text must be at least 50 words for reliable style extraction');
    }

    // Truncate if too long
    const sampleText = text.length > 8000 ? text.substring(0, 8000) : text;

    // Step 1: Analyze style attributes
    const attributes = await this.analyzeAttributes(sampleText);

    // Step 2: Extract example sentences
    const examples = await this.extractExamples(sampleText);

    // Step 3: Generate style name
    const name = await this.generateStyleName(attributes, options);

    // Step 4: Generate style prompt
    const stylePrompt = this.generateStylePrompt(attributes, examples, options);

    // Step 5: Store in database
    const styleId = await this.storeStyle(
      options.customName || name,
      stylePrompt
    );

    const processingTimeMs = Date.now() - startTime;

    // Log extraction
    await this.logExtraction(extractionId, text, styleId, attributes, processingTimeMs);

    return {
      id: styleId,
      name: options.customName || name,
      stylePrompt,
      attributes,
      exampleSentences: examples,
      sourceInfo: {
        bookTitle: options.bookTitle,
        author: options.author,
        chapter: options.chapter,
        sampleLength: wordCount
      },
      extractionId,
      processingTimeMs
    };
  }

  /**
   * Analyze style attributes from text
   */
  private async analyzeAttributes(text: string): Promise<StyleAttributes> {
    const systemPrompt = `You are a stylistic analyst specializing in writing style identification.
Analyze the given text and extract precise style attributes.
Respond in JSON format only.`;

    const prompt = `Analyze the writing style in this text:

"${text.substring(0, 3000)}"

Extract these attributes in JSON format:
{
  "sentenceStructure": "describe typical sentence patterns (2-4 words)",
  "vocabulary": "describe vocabulary level and type (2-4 words)",
  "rhythm": "describe prose rhythm (2-4 words)",
  "paragraphStructure": "describe paragraph organization (2-4 words)",
  "punctuationStyle": "describe punctuation tendencies",
  "rhetoricalDevices": ["device1", "device2", "device3"]
}

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
        max_tokens: 400,
        temperature: 0.3
      });

      const responseText = (response.response || '').trim();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sentenceStructure: parsed.sentenceStructure || 'varied',
          vocabulary: parsed.vocabulary || 'standard',
          rhythm: parsed.rhythm || 'moderate',
          paragraphStructure: parsed.paragraphStructure || 'standard',
          punctuationStyle: parsed.punctuationStyle || 'conventional',
          rhetoricalDevices: Array.isArray(parsed.rhetoricalDevices)
            ? parsed.rhetoricalDevices
            : []
        };
      }

      throw new Error('Failed to parse attributes');
    } catch (error) {
      console.error('[StyleExtraction] Attribute analysis failed:', error);
      return {
        sentenceStructure: 'varied',
        vocabulary: 'standard',
        rhythm: 'moderate',
        paragraphStructure: 'balanced',
        punctuationStyle: 'conventional',
        rhetoricalDevices: []
      };
    }
  }

  /**
   * Extract representative example sentences
   */
  private async extractExamples(text: string): Promise<string[]> {
    const systemPrompt = `You are a stylistic analyst. Select 3-5 sentences that best represent the writing style.
Choose sentences that showcase:
- Characteristic sentence structure
- Typical vocabulary usage
- Representative rhetorical patterns

Return a JSON array of the actual sentences from the text.`;

    const prompt = `Select 3-5 representative sentences from this text:

"${text.substring(0, 3000)}"

Return a JSON array of the actual sentences:
["sentence 1", "sentence 2", ...]`;

    try {
      if (!this.llmProvider) {
        this.llmProvider = await createLLMProvider(this.modelId, this.env, this.userId);
      }

      const response = await this.llmProvider.call({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 600,
        temperature: 0.3
      });

      const responseText = (response.response || '').trim();
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
      }

      return [];
    } catch (error) {
      console.error('[StyleExtraction] Example extraction failed:', error);
      return [];
    }
  }

  /**
   * Generate a descriptive name for the style
   */
  private async generateStyleName(
    attributes: StyleAttributes,
    options: StyleExtractionOptions
  ): Promise<string> {
    const systemPrompt = `You are naming a writing style based on its attributes.
Create a concise, memorable name (3-5 words) that captures the essence of the style.`;

    const contextInfo = options.author ? `Style from ${options.author}.` : '';

    const prompt = `Create a name for a writing style with these attributes:

Sentence Structure: ${attributes.sentenceStructure}
Vocabulary: ${attributes.vocabulary}
Rhythm: ${attributes.rhythm}
Rhetorical Devices: ${attributes.rhetoricalDevices.join(', ') || 'varied'}

${contextInfo}

Respond with just the style name (3-5 words):`;

    try {
      if (!this.llmProvider) {
        this.llmProvider = await createLLMProvider(this.modelId, this.env, this.userId);
      }

      const response = await this.llmProvider.call({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 50,
        temperature: 0.6
      });

      const name = (response.response || '').trim().replace(/^["']|["']$/g, '');
      return name || `${this.capitalize(attributes.rhythm)} ${this.capitalize(attributes.vocabulary)} Style`;
    } catch (error) {
      console.error('[StyleExtraction] Name generation failed:', error);
      const authorSuffix = options.author ? ` (${options.author})` : '';
      return `${this.capitalize(attributes.sentenceStructure)} Style${authorSuffix}`;
    }
  }

  /**
   * Generate style prompt for transformations
   */
  private generateStylePrompt(
    attributes: StyleAttributes,
    examples: string[],
    options: StyleExtractionOptions
  ): string {
    const sourceAttribution = options.author
      ? `\nThis style is inspired by ${options.author}${options.bookTitle ? ` ("${options.bookTitle}")` : ''}.`
      : '';

    const devicesSection = attributes.rhetoricalDevices.length > 0
      ? `\n- Rhetorical devices: ${attributes.rhetoricalDevices.join(', ')}`
      : '';

    const examplesSection = examples.length > 0
      ? `\n\nExample sentences demonstrating this style:\n${examples.map((e, i) => `${i + 1}. "${e}"`).join('\n')}`
      : '';

    return `Write using the following style characteristics:

Sentence Structure: ${attributes.sentenceStructure}
- Build sentences that follow this structural pattern

Vocabulary: ${attributes.vocabulary}
- Use word choices consistent with this vocabulary level

Rhythm: ${attributes.rhythm}
- Maintain this rhythmic quality in prose flow

Paragraph Structure: ${attributes.paragraphStructure}
- Organize paragraphs following this pattern

Punctuation: ${attributes.punctuationStyle}${devicesSection}${sourceAttribution}${examplesSection}

Transform the content to match this style while preserving the original meaning.`;
  }

  /**
   * Store style in database
   */
  private async storeStyle(name: string, stylePrompt: string): Promise<number> {
    let finalName = name;
    let attempt = 0;

    while (attempt < 5) {
      try {
        const result = await this.env.DB.prepare(`
          INSERT INTO npe_styles (name, style_prompt)
          VALUES (?, ?)
          RETURNING id
        `).bind(finalName, stylePrompt).first<{ id: number }>();

        return result?.id || 0;
      } catch (error: any) {
        if (error.message?.includes('UNIQUE constraint')) {
          attempt++;
          finalName = `${name} (${attempt})`;
        } else {
          throw error;
        }
      }
    }

    throw new Error('Failed to create unique style name');
  }

  /**
   * Log extraction for history
   */
  private async logExtraction(
    extractionId: string,
    sourceText: string,
    styleId: number,
    attributes: StyleAttributes,
    processingTimeMs: number
  ): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT INTO transformations (id, user_id, type, source_text, result_text, parameters, created_at)
        VALUES (?, ?, 'style_extraction', ?, ?, ?, ?)
      `).bind(
        extractionId,
        this.userId,
        sourceText.substring(0, 5000),
        `Style ID: ${styleId}`,
        JSON.stringify({
          styleId,
          attributes,
          processingTimeMs
        }),
        Date.now()
      ).run();
    } catch (error) {
      console.error('[StyleExtraction] Failed to log extraction:', error);
    }
  }

  /**
   * Helper: Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
