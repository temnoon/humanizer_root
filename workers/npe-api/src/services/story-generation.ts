// Story Generation Service - Generate narratives from attributes
// The inverse problem: Attributes → Story (vs Transformation: Story → Attributes)

import type { Env, NPEPersona, NPENamespace, NPEStyle } from '../../shared/types';
import { createLLMProvider, type LLMProvider } from './llm-providers';

export type StoryLength = 'short' | 'medium' | 'long';

export interface StorySkeleton {
  characters: Character[];
  setting: string;
  conflict: string;
  stakes: string;
}

export interface Character {
  name: string;
  role: string;
  motivation: string;
}

export interface StoryGenerationResult {
  story_id: string;
  final_story: string;
  skeleton: StorySkeleton;
  plot_summary: string;
  verification?: {
    namespace_score: number;
    persona_score: number;
    style_score: number;
    overall_quality: number;
  };
  metadata: {
    word_count: number;
    generation_time_ms: number;
    model_used: string;
  };
}

/**
 * StoryGenerationService - Generate original narratives from attribute specifications
 *
 * The inverse of transformation: Instead of transforming existing text,
 * generate new narratives that embody specific persona, namespace, and style attributes.
 *
 * Pipeline: World Building → Plot Development → Narrative Realization → Verification
 */
export class StoryGenerationService {
  private llmProvider: LLMProvider | null = null;

  constructor(
    private env: Env,
    private persona: NPEPersona,
    private namespace: NPENamespace,
    private style: NPEStyle,
    private userId: string,
    private modelId: string = '@cf/meta/llama-3.1-8b-instruct',
    private length: StoryLength = 'medium',
    private seed?: string
  ) {}

  /**
   * Generate a complete story from attribute specifications
   */
  async generate(): Promise<StoryGenerationResult> {
    const startTime = Date.now();
    const storyId = crypto.randomUUID();

    // Initialize LLM provider
    this.llmProvider = await createLLMProvider(this.modelId, this.env, this.userId);

    // Phase 1: World Building - Create story skeleton
    const skeleton = await this.buildWorld();

    // Phase 2: Plot Development - Expand into narrative arc
    const plotSummary = await this.developPlot(skeleton);

    // Phase 3: Narrative Realization - Write full prose
    const finalStory = await this.realize(plotSummary);

    // Phase 4: Verification (optional) - Measure attribute alignment
    // const verification = await this.verify(finalStory);

    const wordCount = finalStory.split(/\s+/).length;
    const totalDuration = Date.now() - startTime;

    // Save to database (use 'allegorical' type with generation flag in parameters)
    await this.env.DB.prepare(`
      INSERT INTO transformations (id, user_id, type, source_text, result_text, parameters, created_at)
      VALUES (?, ?, 'allegorical', ?, ?, ?, ?)
    `).bind(
      storyId,
      this.userId,
      '', // No source text for generation
      finalStory,
      JSON.stringify({
        generation: true, // Flag to indicate this is generation, not transformation
        persona: this.persona.name,
        namespace: this.namespace.name,
        style: this.style.name,
        length: this.length,
        seed: this.seed,
        word_count: wordCount
      }),
      Date.now()
    ).run();

    return {
      story_id: storyId,
      final_story: finalStory,
      skeleton,
      plot_summary: plotSummary,
      metadata: {
        word_count: wordCount,
        generation_time_ms: totalDuration,
        model_used: this.modelId
      }
    };
  }

  /**
   * Phase 1: Build world and create story skeleton
   */
  private async buildWorld(): Promise<StorySkeleton> {
    const systemPrompt = `You are a world-building specialist for ${this.namespace.name}.

${this.namespace.context_prompt}

Your task is to create a rich, coherent story setting within this universe.`;

    const seedConstraint = this.seed ? `\n\nSEED CONSTRAINT: Incorporate this element into your world: "${this.seed}"` : '';

    const prompt = `Create a story setting for ${this.namespace.description}:${seedConstraint}

Generate:
1. **Characters** (3-5 characters):
   - Name (appropriate for ${this.namespace.name})
   - Role (protagonist, antagonist, mentor, ally, etc.)
   - Motivation (what they want/need)

2. **Setting**:
   - Time and place within ${this.namespace.name}
   - Relevant contextual details
   - Atmospheric description

3. **Conflict**:
   - Central tension or problem
   - Why it matters
   - What's at stake

4. **Stakes**:
   - What characters stand to gain
   - What they stand to lose
   - Why we should care

CONSTRAINTS:
- Use ONLY elements, terms, and names from ${this.namespace.name}
- Keep proper names consistent with ${this.namespace.name} conventions
- Be specific and concrete (avoid vague generalities)
- Total length: 200-300 words

Output a structured story skeleton in this format:

CHARACTERS:
- [Name]: [Role] - [Motivation]

SETTING:
[Description]

CONFLICT:
[Description]

STAKES:
[Description]`;

    const result = await this.callLLM(systemPrompt, prompt, 0.7, 400);
    return this.parseSkeleton(result);
  }

  /**
   * Phase 2: Develop plot from skeleton
   */
  private async developPlot(skeleton: StorySkeleton): Promise<string> {
    const skeletonText = this.skeletonToText(skeleton);

    const systemPrompt = `You are a plot architect working within ${this.namespace.name}.

${this.namespace.context_prompt}

Your task is to develop a complete narrative arc from a story skeleton.`;

    const targetWords = this.getTargetWordCount();

    const prompt = `Expand this story skeleton into a complete narrative arc:

${skeletonText}

Develop a plot with these elements:

1. **OPENING** (15% of story):
   - Introduce characters in their world
   - Establish normal state
   - Present inciting incident

2. **RISING ACTION** (35% of story):
   - Characters respond to conflict
   - Complications arise
   - Tension escalates
   - Characters face obstacles

3. **CLIMAX** (15% of story):
   - Peak moment of conflict
   - Characters face their defining choice
   - Maximum tension

4. **FALLING ACTION** (20% of story):
   - Consequences unfold
   - Subplots resolve
   - Truth emerges

5. **RESOLUTION** (15% of story):
   - Conflict resolves
   - New equilibrium
   - Characters transformed

CONSTRAINTS:
- Maintain ${this.namespace.name} consistency throughout
- Target length: ${targetWords} words
- Clear beginning, middle, end
- No narrative voice yet (write as neutral plot summary)
- Keep all character names and setting details from skeleton
- Use only ${this.namespace.name} elements

Write the complete plot summary.`;

    const maxTokens = Math.ceil(targetWords * 1.3); // Account for overhead
    return await this.callLLM(systemPrompt, prompt, 0.6, maxTokens);
  }

  /**
   * Phase 3: Realize narrative with full voice and style
   */
  private async realize(plotSummary: string): Promise<string> {
    const systemPrompt = `You are a master storyteller with a specific voice and style.

${this.persona.system_prompt}

${this.style.style_prompt}

Your task is to transform a plot summary into a fully-realized narrative that embodies your distinctive voice and style.`;

    const targetWords = this.getTargetWordCount();

    const prompt = `Transform this plot summary into a complete narrative:

${plotSummary}

YOUR WRITING GOALS:

1. **VOICE (Persona)**: Embody ${this.persona.description}
   - Apply your distinctive narrative distance and subjectivity
   - Use your characteristic tone and perspective
   - Maintain your rhetorical stance throughout
   - Make your voice OBVIOUS and CONSISTENT

2. **STYLE (Form)**: Write in ${this.style.name} style
   - Apply appropriate sentence structure patterns
   - Maintain consistent formality level
   - Use characteristic lexical choices
   - Employ style-specific rhetorical devices

3. **COHERENCE (Universe)**: Maintain ${this.namespace.name} setting
   - Keep all proper names and specialized terms
   - Preserve conceptual framework throughout
   - Ensure all events fit within ${this.namespace.name} logic

4. **NARRATIVE QUALITY**:
   - Vivid scenes with sensory details
   - Natural dialogue (if appropriate)
   - Emotional resonance
   - Satisfying pacing and structure

CONSTRAINTS:
- Target length: ${targetWords} words (±10%)
- Complete story arc (beginning, middle, end)
- Maintain ${this.namespace.name} consistency
- Embody ${this.persona.name} voice throughout
- Apply ${this.style.name} style consistently

Write the complete narrative with full commitment to your voice and style.`;

    const maxTokens = Math.ceil(targetWords * 1.5); // Extra room for creative expression
    return await this.callLLM(systemPrompt, prompt, 0.8, maxTokens);
  }

  /**
   * Parse skeleton from LLM output
   */
  private parseSkeleton(text: string): StorySkeleton {
    // Simple parser - extract sections
    const characters: Character[] = [];
    let setting = '';
    let conflict = '';
    let stakes = '';

    const lines = text.split('\n');
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.toUpperCase().startsWith('CHARACTERS:')) {
        currentSection = 'characters';
        continue;
      } else if (trimmed.toUpperCase().startsWith('SETTING:')) {
        currentSection = 'setting';
        continue;
      } else if (trimmed.toUpperCase().startsWith('CONFLICT:')) {
        currentSection = 'conflict';
        continue;
      } else if (trimmed.toUpperCase().startsWith('STAKES:')) {
        currentSection = 'stakes';
        continue;
      }

      if (!trimmed || trimmed.startsWith('#')) continue;

      switch (currentSection) {
        case 'characters':
          if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
            const match = trimmed.match(/[-*]\s*(.+?):\s*(.+?)\s*-\s*(.+)/);
            if (match) {
              characters.push({
                name: match[1].trim(),
                role: match[2].trim(),
                motivation: match[3].trim()
              });
            }
          }
          break;
        case 'setting':
          setting += trimmed + ' ';
          break;
        case 'conflict':
          conflict += trimmed + ' ';
          break;
        case 'stakes':
          stakes += trimmed + ' ';
          break;
      }
    }

    return {
      characters: characters.length > 0 ? characters : [{
        name: 'Protagonist',
        role: 'Main character',
        motivation: 'To overcome the conflict'
      }],
      setting: setting.trim() || 'A setting within ' + this.namespace.name,
      conflict: conflict.trim() || 'A challenge arises',
      stakes: stakes.trim() || 'The outcome matters'
    };
  }

  /**
   * Convert skeleton to text
   */
  private skeletonToText(skeleton: StorySkeleton): string {
    let text = 'CHARACTERS:\n';
    for (const char of skeleton.characters) {
      text += `- ${char.name}: ${char.role} - ${char.motivation}\n`;
    }
    text += `\nSETTING:\n${skeleton.setting}\n`;
    text += `\nCONFLICT:\n${skeleton.conflict}\n`;
    text += `\nSTAKES:\n${skeleton.stakes}`;
    return text;
  }

  /**
   * Get target word count based on length preference
   */
  private getTargetWordCount(): number {
    switch (this.length) {
      case 'short': return 500;
      case 'medium': return 1000;
      case 'long': return 2000;
      default: return 1000;
    }
  }

  /**
   * Call LLM with specific parameters
   */
  private async callLLM(
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider not initialized');
    }

    try {
      const response = await this.llmProvider.call({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: maxTokens,
        temperature
      });

      return response.response || '';
    } catch (error) {
      console.error('LLM call failed:', error);
      throw new Error(`Failed to generate story phase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
