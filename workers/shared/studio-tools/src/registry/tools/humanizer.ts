/**
 * Humanizer tool definition
 */

import type { ToolDefinition } from '../../types';

/**
 * Humanizer - Remove AI patterns and improve naturalness
 */
export const humanizerTool: ToolDefinition = {
  id: 'humanizer',
  name: 'Humanizer',
  description: 'Remove AI patterns and improve naturalness',
  longDescription: `
    The Humanizer tool analyzes text for common AI-generated patterns
    and rewrites it to sound more natural and human-written. Choose
    intensity based on how much you want the text modified.

    Optionally provide voice samples to match your personal writing style.
  `,

  category: 'transformation',
  tier: 'free',
  availableIn: ['all'],

  icon: '\ud83c\udfad',
  color: '#10b981',

  parameters: [
    {
      name: 'intensity',
      label: 'Intensity',
      type: 'select',
      required: true,
      default: 'moderate',
      options: [
        {
          value: 'light',
          label: 'Light',
          description: 'Minimal changes, preserve most structure',
        },
        {
          value: 'moderate',
          label: 'Moderate',
          description: 'Balanced rewriting',
        },
        {
          value: 'aggressive',
          label: 'Aggressive',
          description: 'Heavy rewriting for maximum naturalness',
        },
      ],
      description: 'How aggressively to transform the text',
    },
    {
      name: 'enableLLMPolish',
      label: 'LLM Polish',
      type: 'boolean',
      default: true,
      description: 'Use AI to refine the final output',
    },
    {
      name: 'voiceSamples',
      label: 'Voice Samples',
      type: 'textarea',
      required: false,
      placeholder: 'Paste examples of your writing style...',
      description: 'Optional: provide samples to match your voice',
    },
  ],

  inputType: 'text',
  outputType: 'text',
  supportsStreaming: false,

  endpoint: '/transformations/computer-humanizer',
  apiTarget: 'npe',

  validateInput: (input) => {
    if (input.length < 50) {
      return { valid: false, error: 'Text must be at least 50 characters' };
    }
    if (input.length > 10000) {
      return { valid: false, error: 'Text must be under 10,000 characters' };
    }
    return { valid: true };
  },

  formatResult: (raw: unknown) => {
    const data = raw as {
      humanizedText?: string;
      baseline?: number;
      final?: number;
      improvement?: number;
      tokensUsed?: number;
    };
    return {
      success: true,
      toolId: 'humanizer',
      transformedText: data.humanizedText,
      analysis: {
        scores: {
          baseline: data.baseline ?? 0,
          final: data.final ?? 0,
          improvement: data.improvement ?? 0,
        },
      },
      tokensUsed: data.tokensUsed,
    };
  },
};
