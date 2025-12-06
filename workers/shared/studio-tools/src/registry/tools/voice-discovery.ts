/**
 * Voice Discovery tool - narrative-studio persona extraction
 *
 * Analyzes conversation text to extract persona characteristics.
 * Designed for discovering writing voices in archive conversations.
 */

import type { ToolDefinition } from '../../types';

/**
 * Voice Discovery Tool - Extract persona from text
 */
export const voiceDiscoveryTool: ToolDefinition = {
  id: 'voice-discovery',
  name: 'Voice Discovery',
  description: 'Extract writing voice and persona from text',
  longDescription: `
    Analyzes text to discover the underlying writing voice and persona.
    Identifies stylistic patterns, vocabulary preferences, sentence structures,
    emotional tones, and communication patterns. The extracted persona can be
    saved as an asset for use in humanization and generation tools.
  `,

  category: 'extraction',
  tier: 'free',
  availableIn: ['narrative-studio'],

  icon: '🎭',
  color: '#ec4899',

  parameters: [
    {
      name: 'personaName',
      label: 'Persona Name',
      type: 'text',
      required: true,
      placeholder: 'e.g., "Professional Voice" or "Casual Chat"',
      description: 'Name for the extracted persona',
    },
    {
      name: 'analysisScope',
      label: 'Analysis Scope',
      type: 'select',
      default: 'comprehensive',
      description: 'What aspects of voice to analyze',
      options: [
        {
          value: 'quick',
          label: 'Quick',
          description: 'Basic tone and style',
        },
        {
          value: 'comprehensive',
          label: 'Comprehensive',
          description: 'Full voice profile with examples',
        },
        {
          value: 'comparative',
          label: 'Comparative',
          description: 'Compare against existing personas',
        },
      ],
    },
    {
      name: 'includeExamples',
      label: 'Include Examples',
      type: 'boolean',
      default: true,
      description: 'Extract representative phrases as examples',
    },
    {
      name: 'detectMultipleVoices',
      label: 'Detect Multiple Voices',
      type: 'boolean',
      default: false,
      description: 'Check if text contains multiple distinct voices',
    },
  ],

  inputType: 'text',
  outputType: 'asset',
  supportsStreaming: false,

  endpoint: '/api/voice/extract',
  apiTarget: 'local',

  validateInput: (input) => {
    if (input.length < 100) {
      return { valid: false, error: 'Need at least 100 characters to analyze voice' };
    }
    if (input.length > 200000) {
      return { valid: false, error: 'Text must be under 200,000 characters' };
    }
    return { valid: true };
  },

  formatResult: (raw: unknown) => {
    const data = raw as {
      persona?: {
        name: string;
        description: string;
        traits: Array<{
          trait: string;
          strength: number;
          examples: string[];
        }>;
        vocabulary: {
          complexity: string;
          preferredTerms: string[];
          avoidedTerms: string[];
        };
        sentencePatterns: {
          averageLength: number;
          preferredStructures: string[];
        };
        tone: {
          primary: string;
          secondary: string[];
          emotionalRange: Record<string, number>;
        };
        systemPrompt?: string;
      };
      multipleVoices?: Array<{
        voiceId: number;
        percentage: number;
        characteristics: string[];
      }>;
      confidence: number;
    };

    return {
      success: true,
      toolId: 'voice-discovery',
      extractedAsset: {
        type: 'persona' as const,
        name: data.persona?.name ?? 'Extracted Voice',
        definition: data.persona,
        saved: false,
      },
      analysis: {
        verdict: data.persona?.description,
        confidence: data.confidence ?? 0.8,
        details: {
          traits: data.persona?.traits,
          vocabulary: data.persona?.vocabulary,
          sentencePatterns: data.persona?.sentencePatterns,
          tone: data.persona?.tone,
          multipleVoices: data.multipleVoices,
        },
      },
    };
  },
};
