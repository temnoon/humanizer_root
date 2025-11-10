/**
 * Attribute Extraction Service - LLM-powered attribute creation
 *
 * Uses Llama 3.1 8B to extract structured creative attributes from
 * free-form descriptions through conversational dialogue.
 */

import type { Env } from '../../shared/types';
import {
  AttributeType,
  AttributeDefinition,
  ExtractAttributeRequest,
  ExtractAttributeResponse,
  RefineAttributeRequest,
  RefineAttributeResponse,
  DialogueMessage,
  AttributeDialogue,
} from '../domain/attribute-models';

// ============================================================================
// System Prompts by Type
// ============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting structured creative attributes from free-form descriptions.

Your task is to help users define:
- **Personas**: Voice patterns, perspectives, speaking styles, personality traits
- **Namespaces**: Conceptual frameworks, metaphorical spaces, domains of knowledge
- **Styles**: Writing patterns, aesthetic choices, structural approaches
- **Voices**: Specific character voices, narrative tones, speaking mannerisms

When extracting:
1. If the description is clear and detailed, extract a complete definition
2. If ambiguous or needs more detail, ask 2-3 clarifying questions
3. Generate appropriate prompt fields based on the attribute type
4. Assign confidence score: >0.7 for clear descriptions, <0.5 for ambiguous ones

Output JSON only (no markdown, no code blocks):
{
  "definition": {
    "name": "short memorable name",
    "description": "clear 1-2 sentence description",
    "systemPrompt": "for personas/voices: how they should speak",
    "contextPrompt": "for namespaces: conceptual framework to use",
    "stylePrompt": "for styles: writing patterns to follow",
    "examples": ["optional example 1", "optional example 2"]
  },
  "questions": ["question 1 if needed", "question 2 if needed"],
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of extraction logic"
}

If you need clarification, set definition to null and provide questions instead.`;

const TYPE_SPECIFIC_PROMPTS = {
  persona: `
Focus on extracting:
- Personality traits and worldview
- Speaking patterns and vocabulary
- Emotional tone and attitude
- Background and expertise
- How they relate to others`,

  namespace: `
Focus on extracting:
- Conceptual domain or field
- Key metaphors and analogies
- Technical vocabulary
- Symbolic systems
- Underlying philosophy`,

  style: `
Focus on extracting:
- Sentence structure and length
- Vocabulary complexity
- Rhythm and pacing
- Literary devices
- Formatting preferences`,

  voice: `
Focus on extracting:
- Character identity
- Speech patterns
- Catchphrases or verbal tics
- Emotional range
- Perspective and bias`
};

// ============================================================================
// Extraction Service Class
// ============================================================================

export class AttributeExtractionService {
  private ai: any; // AI binding from Cloudflare Workers

  constructor(ai: any) {
    this.ai = ai;
  }

  /**
   * Extract an attribute definition from a free-form description
   */
  async extractAttribute(
    request: ExtractAttributeRequest
  ): Promise<ExtractAttributeResponse> {
    try {
      // Build the conversation context
      const messages = this.buildMessages(request);

      // Call LLM for extraction
      const response = await this.callLLM(messages);

      // Parse and validate response
      return this.parseResponse(response);
    } catch (error) {
      console.error('[AttributeExtraction] Error:', error);
      throw new Error(`Failed to extract attribute: ${error.message}`);
    }
  }

  /**
   * Refine an existing definition based on user feedback
   */
  async refineAttribute(
    request: RefineAttributeRequest,
    type: AttributeType,
    previousMessages: DialogueMessage[]
  ): Promise<RefineAttributeResponse> {
    try {
      // Build refinement context
      const messages = this.buildRefinementMessages(
        request,
        type,
        previousMessages
      );

      // Call LLM for refinement
      const response = await this.callLLM(messages);

      // Parse and validate response
      return this.parseResponse(response);
    } catch (error) {
      console.error('[AttributeExtraction] Refinement error:', error);
      throw new Error(`Failed to refine attribute: ${error.message}`);
    }
  }

  /**
   * Build messages for initial extraction
   */
  private buildMessages(request: ExtractAttributeRequest): any[] {
    const typePrompt = TYPE_SPECIFIC_PROMPTS[request.type];

    const messages = [
      {
        role: 'system',
        content: EXTRACTION_SYSTEM_PROMPT + typePrompt
      },
      {
        role: 'user',
        content: `Extract a ${request.type} attribute from this description:\n\n"${request.description}"`
      }
    ];

    // Add context from previous dialogue if available
    if (request.context && request.context.length > 0) {
      messages.push({
        role: 'assistant',
        content: 'I understand the context from our previous discussion. Let me extract the attribute based on your description.'
      });
    }

    return messages;
  }

  /**
   * Build messages for refinement
   */
  private buildRefinementMessages(
    request: RefineAttributeRequest,
    type: AttributeType,
    previousMessages: DialogueMessage[]
  ): any[] {
    const typePrompt = TYPE_SPECIFIC_PROMPTS[type];

    const messages = [
      {
        role: 'system',
        content: EXTRACTION_SYSTEM_PROMPT + typePrompt
      }
    ];

    // Add previous dialogue context
    previousMessages.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current refinement request
    messages.push({
      role: 'user',
      content: request.feedback
    });

    return messages;
  }

  /**
   * Call the LLM and get response
   */
  private async callLLM(messages: any[]): Promise<string> {
    // Using Llama 3.1 8B (same as POVM measurement)
    const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    if (!response || typeof response !== 'object' || !('response' in response)) {
      throw new Error('Invalid LLM response structure');
    }

    return response.response as string;
  }

  /**
   * Parse LLM response into structured format
   */
  private parseResponse(response: string): ExtractAttributeResponse {
    try {
      // Clean the response (remove any markdown formatting)
      const cleaned = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Parse JSON
      const parsed = JSON.parse(cleaned);

      // Validate and return
      const result: ExtractAttributeResponse = {
        definition: parsed.definition || undefined,
        questions: parsed.questions || undefined,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || undefined,
      };

      // Ensure we have either a definition or questions
      if (!result.definition && !result.questions) {
        result.questions = [
          'Could you provide more details about what you have in mind?',
          'What specific characteristics or qualities should this include?'
        ];
        result.confidence = 0.3;
      }

      return result;
    } catch (error) {
      console.error('[AttributeExtraction] Failed to parse LLM response:', error);
      console.error('Raw response:', response);

      // Return a fallback response asking for clarification
      return {
        definition: undefined,
        questions: [
          'I need more information to create this attribute.',
          'Could you describe in more detail what you\'re looking for?',
          'What are the key characteristics you want to capture?'
        ],
        confidence: 0.2,
        reasoning: 'Failed to parse LLM response - requesting clarification'
      };
    }
  }

  /**
   * Generate example output for a given attribute
   */
  async generateExample(
    definition: AttributeDefinition,
    type: AttributeType,
    sampleText: string
  ): Promise<string> {
    try {
      // Build the appropriate prompt based on type
      let systemPrompt = '';

      switch (type) {
        case 'persona':
        case 'voice':
          systemPrompt = definition.systemPrompt || definition.description;
          break;
        case 'namespace':
          systemPrompt = `Use this conceptual framework: ${definition.contextPrompt || definition.description}`;
          break;
        case 'style':
          systemPrompt = `Write in this style: ${definition.stylePrompt || definition.description}`;
          break;
      }

      const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Transform this text according to the ${type} "${definition.name}":\n\n${sampleText}`
        }
      ];

      const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages,
        temperature: 0.8,
        max_tokens: 500,
      });

      return response.response as string;
    } catch (error) {
      console.error('[AttributeExtraction] Failed to generate example:', error);
      return 'Failed to generate example';
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAttributeExtractionService(env: Env): AttributeExtractionService {
  return new AttributeExtractionService(env.AI);
}