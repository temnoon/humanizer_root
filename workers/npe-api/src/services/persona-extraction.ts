// Persona Extraction Service - Extract narrative voice/persona from passages
// Analyzes text to create reusable personas for transformation tools

import type { Env } from '../../shared/types';
import { createLLMProvider, type LLMProvider } from './llm-providers';
import { hasCloudflareAI, detectEnvironment, getModelForUseCase } from '../config/llm-models';

export interface PersonaAttributes {
  voice: string;        // e.g., "scholarly, methodical"
  perspective: string;  // e.g., "third-person omniscient", "first-person reflective"
  tone: string;         // e.g., "formal, authoritative", "warm, conversational"
  register: string;     // e.g., "academic", "literary", "journalistic"
  rhetoricalMode: string; // e.g., "expository", "narrative", "argumentative"
}

export interface ExtractedPersona {
  id: number;
  name: string;
  description: string;
  systemPrompt: string;
  attributes: PersonaAttributes;
  examplePatterns: string[];  // Characteristic phrases/structures
  sourceInfo: {
    bookTitle?: string;
    author?: string;
    chapter?: string;
    sampleLength: number;
  };
  extractionId: string;
  processingTimeMs: number;
}

export interface PersonaExtractionOptions {
  bookTitle?: string;
  author?: string;
  chapter?: string;
  customName?: string;  // Override auto-generated name
}

/**
 * PersonaExtractionService - Extract narrative persona from text passages
 *
 * Analyzes:
 * - Narrative voice and perspective
 * - Tone and emotional register
 * - Rhetorical patterns and devices
 * - Characteristic sentence structures
 *
 * Creates reusable personas for the transformation pipeline
 */
export class PersonaExtractionService {
  private llmProvider: LLMProvider | null = null;
  private modelId: string;

  constructor(
    private env: Env,
    private userId: string = 'anonymous'
  ) {
    const hasAI = hasCloudflareAI(env);
    const environment = detectEnvironment(hasAI);
    this.modelId = getModelForUseCase('persona', environment);

    console.log(`[PersonaExtraction] Environment: ${environment}, Model: ${this.modelId}`);
  }

  /**
   * Extract persona from a text passage
   */
  async extractPersona(
    text: string,
    options: PersonaExtractionOptions = {}
  ): Promise<ExtractedPersona> {
    const startTime = Date.now();
    const extractionId = crypto.randomUUID();

    // Validate input
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 50) {
      throw new Error('Text must be at least 50 words for reliable persona extraction');
    }

    // Truncate if too long (use representative sample)
    const sampleText = text.length > 8000 ? text.substring(0, 8000) : text;

    // Step 1: Analyze persona attributes
    const attributes = await this.analyzeAttributes(sampleText);

    // Step 2: Extract characteristic patterns
    const patterns = await this.extractPatterns(sampleText);

    // Step 3: Generate name and description
    const { name, description } = await this.generateNameAndDescription(
      attributes,
      options
    );

    // Step 4: Generate system prompt
    const systemPrompt = this.generateSystemPrompt(attributes, patterns, options);

    // Step 5: Store in database
    const personaId = await this.storePersona(
      options.customName || name,
      description,
      systemPrompt,
      attributes,
      options
    );

    const processingTimeMs = Date.now() - startTime;

    // Log extraction
    await this.logExtraction(extractionId, text, personaId, attributes, processingTimeMs);

    return {
      id: personaId,
      name: options.customName || name,
      description,
      systemPrompt,
      attributes,
      examplePatterns: patterns,
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
   * Analyze persona attributes from text
   */
  private async analyzeAttributes(text: string): Promise<PersonaAttributes> {
    const systemPrompt = `You are a literary analyst specializing in narrative voice analysis.
Analyze the given text and extract precise persona attributes.
Respond in JSON format only.`;

    const prompt = `Analyze the narrative voice in this text:

"${text.substring(0, 3000)}"

Extract these attributes in JSON format:
{
  "voice": "description of the narrative voice (2-4 words)",
  "perspective": "narrative perspective (e.g., 'first-person reflective', 'third-person omniscient')",
  "tone": "emotional tone (2-4 words)",
  "register": "formality level (e.g., 'academic', 'literary', 'conversational')",
  "rhetoricalMode": "primary rhetorical mode (e.g., 'expository', 'narrative', 'argumentative')"
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
        max_tokens: 300,
        temperature: 0.3
      });

      const responseText = (response.response || '').trim();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          voice: parsed.voice || 'neutral',
          perspective: parsed.perspective || 'third-person',
          tone: parsed.tone || 'measured',
          register: parsed.register || 'standard',
          rhetoricalMode: parsed.rhetoricalMode || 'expository'
        };
      }

      throw new Error('Failed to parse attributes');
    } catch (error) {
      console.error('[PersonaExtraction] Attribute analysis failed:', error);
      // Return defaults
      return {
        voice: 'analytical',
        perspective: 'third-person',
        tone: 'neutral',
        register: 'standard',
        rhetoricalMode: 'expository'
      };
    }
  }

  /**
   * Extract characteristic patterns and phrases
   */
  private async extractPatterns(text: string): Promise<string[]> {
    const systemPrompt = `You are a stylistic analyst. Identify characteristic patterns in the text.
Focus on:
- Recurring sentence structures
- Characteristic opening/closing patterns
- Distinctive word choices
- Rhetorical devices used

Return a JSON array of 3-5 example patterns.`;

    const prompt = `Identify characteristic patterns in this text:

"${text.substring(0, 2000)}"

Return a JSON array of 3-5 pattern descriptions:
["pattern 1", "pattern 2", ...]`;

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
        temperature: 0.4
      });

      const responseText = (response.response || '').trim();
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
      }

      return [];
    } catch (error) {
      console.error('[PersonaExtraction] Pattern extraction failed:', error);
      return [];
    }
  }

  /**
   * Generate a descriptive name and description for the persona
   */
  private async generateNameAndDescription(
    attributes: PersonaAttributes,
    options: PersonaExtractionOptions
  ): Promise<{ name: string; description: string }> {
    const systemPrompt = `You are naming a writing persona based on its attributes.
Create a memorable, descriptive name and a 2-3 sentence description.`;

    const contextInfo = options.author
      ? `This persona is derived from "${options.bookTitle || 'a work'}" by ${options.author}.`
      : 'This persona is derived from an analyzed text passage.';

    const prompt = `Create a name and description for a writing persona with these attributes:

Voice: ${attributes.voice}
Perspective: ${attributes.perspective}
Tone: ${attributes.tone}
Register: ${attributes.register}
Rhetorical Mode: ${attributes.rhetoricalMode}

${contextInfo}

Respond in JSON format:
{
  "name": "The [Descriptive Name]",
  "description": "2-3 sentence description of this persona's characteristics"
}`;

    try {
      if (!this.llmProvider) {
        this.llmProvider = await createLLMProvider(this.modelId, this.env, this.userId);
      }

      const response = await this.llmProvider.call({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.6
      });

      const responseText = (response.response || '').trim();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          name: parsed.name || 'The Analyst',
          description: parsed.description || `A ${attributes.tone} ${attributes.voice} narrator.`
        };
      }

      throw new Error('Failed to parse name/description');
    } catch (error) {
      console.error('[PersonaExtraction] Name generation failed:', error);
      // Generate fallback
      const authorSuffix = options.author ? ` (${options.author})` : '';
      return {
        name: `The ${this.capitalize(attributes.voice)} Voice${authorSuffix}`,
        description: `A ${attributes.tone} narrator with a ${attributes.register} ${attributes.rhetoricalMode} approach.`
      };
    }
  }

  /**
   * Generate system prompt for the persona
   */
  private generateSystemPrompt(
    attributes: PersonaAttributes,
    patterns: string[],
    options: PersonaExtractionOptions
  ): string {
    const sourceAttribution = options.author
      ? `\nThis voice is inspired by ${options.author}${options.bookTitle ? ` ("${options.bookTitle}")` : ''}.`
      : '';

    const patternInstructions = patterns.length > 0
      ? `\n\nCharacteristic patterns to incorporate:\n${patterns.map(p => `- ${p}`).join('\n')}`
      : '';

    return `You are writing with the following narrative persona:

Voice: ${attributes.voice}
Perspective: ${attributes.perspective}
Tone: ${attributes.tone}
Register: ${attributes.register}
Primary Mode: ${attributes.rhetoricalMode}${sourceAttribution}

Maintain this persona consistently throughout your writing. Adapt the content to match this voice while preserving the original meaning.${patternInstructions}`;
  }

  /**
   * Store persona in database
   */
  private async storePersona(
    name: string,
    description: string,
    systemPrompt: string,
    attributes: PersonaAttributes,
    options: PersonaExtractionOptions
  ): Promise<number> {
    // Generate unique name if exists
    let finalName = name;
    let attempt = 0;

    while (attempt < 5) {
      try {
        const result = await this.env.DB.prepare(`
          INSERT INTO npe_personas (name, description, system_prompt)
          VALUES (?, ?, ?)
          RETURNING id
        `).bind(finalName, description, systemPrompt).first<{ id: number }>();

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

    throw new Error('Failed to create unique persona name');
  }

  /**
   * Log extraction for history
   */
  private async logExtraction(
    extractionId: string,
    sourceText: string,
    personaId: number,
    attributes: PersonaAttributes,
    processingTimeMs: number
  ): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT INTO transformations (id, user_id, type, source_text, result_text, parameters, created_at)
        VALUES (?, ?, 'persona_extraction', ?, ?, ?, ?)
      `).bind(
        extractionId,
        this.userId,
        sourceText.substring(0, 5000), // Truncate for storage
        `Persona ID: ${personaId}`,
        JSON.stringify({
          personaId,
          attributes,
          processingTimeMs
        }),
        Date.now()
      ).run();
    } catch (error) {
      console.error('[PersonaExtraction] Failed to log extraction:', error);
    }
  }

  /**
   * Helper: Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
