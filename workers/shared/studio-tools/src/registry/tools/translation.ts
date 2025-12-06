/**
 * Translation tool definition
 */

import type { ToolDefinition } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../types/parameters';

/**
 * Convert language list to parameter options
 */
const languageOptions = SUPPORTED_LANGUAGES.map((lang) => ({
  value: lang.code,
  label: `${lang.name} (${lang.nativeName})`,
}));

/**
 * Translation - Translate content to other languages
 */
export const translationTool: ToolDefinition = {
  id: 'translation',
  name: 'Translation',
  description: 'Translate content to 40+ languages',
  longDescription: `
    Translate text to any of 40+ supported languages.
    Optionally specify the source language for better accuracy,
    or let the system auto-detect it.
  `,

  category: 'transformation',
  tier: 'free',
  availableIn: ['all'],

  icon: '\ud83c\udf10',
  color: '#3b82f6',

  parameters: [
    {
      name: 'targetLanguage',
      label: 'Target Language',
      type: 'select',
      required: true,
      default: 'es',
      options: languageOptions,
      description: 'Language to translate into',
    },
    {
      name: 'sourceLanguage',
      label: 'Source Language',
      type: 'select',
      required: false,
      options: [
        { value: 'auto', label: 'Auto-detect' },
        ...languageOptions,
      ],
      default: 'auto',
      description: 'Original language (auto-detect if unknown)',
    },
    {
      name: 'preserveTone',
      label: 'Preserve Tone',
      type: 'boolean',
      default: true,
      description: 'Try to maintain the original tone and style',
    },
  ],

  inputType: 'text',
  outputType: 'text',
  supportsStreaming: false,

  endpoint: '/transformations/translate',
  apiTarget: 'npe',

  validateInput: (input) => {
    if (input.length < 10) {
      return { valid: false, error: 'Text must be at least 10 characters' };
    }
    if (input.length > 20000) {
      return { valid: false, error: 'Text must be under 20,000 characters' };
    }
    return { valid: true };
  },

  formatResult: (raw: unknown) => {
    const data = raw as {
      translatedText?: string;
      detectedLanguage?: string;
      targetLanguage?: string;
      tokensUsed?: number;
    };
    return {
      success: true,
      toolId: 'translation',
      transformedText: data.translatedText,
      analysis: {
        details: {
          detectedLanguage: data.detectedLanguage,
          targetLanguage: data.targetLanguage,
        },
      },
      tokensUsed: data.tokensUsed,
    };
  },
};

/**
 * Round-Trip Analysis - Detect semantic drift via back-translation
 */
export const roundTripTool: ToolDefinition = {
  id: 'round-trip',
  name: 'Round-Trip Analysis',
  description: 'Detect semantic drift via back-translation',
  longDescription: `
    Translates text to an intermediate language and back to detect
    semantic drift and ambiguity. Useful for checking if your
    writing conveys clear, unambiguous meaning.
  `,

  category: 'analysis',
  tier: 'free',
  availableIn: ['all'],

  icon: '\ud83d\udd04',
  color: '#6366f1',

  parameters: [
    {
      name: 'intermediateLanguage',
      label: 'Intermediate Language',
      type: 'select',
      required: true,
      default: 'zh',
      options: [
        { value: 'zh', label: 'Chinese', description: 'Good for structural differences' },
        { value: 'ja', label: 'Japanese', description: 'Good for contextual meaning' },
        { value: 'de', label: 'German', description: 'Good for precision' },
        { value: 'ar', label: 'Arabic', description: 'Good for cultural nuance' },
      ],
      description: 'Language to translate through',
    },
  ],

  inputType: 'text',
  outputType: 'analysis',
  supportsStreaming: false,

  endpoint: '/transformations/round-trip',
  apiTarget: 'npe',

  validateInput: (input) => {
    if (input.length < 50) {
      return { valid: false, error: 'Text must be at least 50 characters' };
    }
    if (input.length > 5000) {
      return { valid: false, error: 'Text must be under 5,000 characters' };
    }
    return { valid: true };
  },

  formatResult: (raw: unknown) => {
    const data = raw as {
      forwardTranslation?: string;
      backTranslation?: string;
      driftScore?: number;
      driftHighlights?: Array<{
        original: string;
        returned: string;
        position: number;
      }>;
    };
    return {
      success: true,
      toolId: 'round-trip',
      transformedText: data.backTranslation,
      analysis: {
        scores: {
          drift: data.driftScore ?? 0,
        },
        details: {
          forwardTranslation: data.forwardTranslation,
          backTranslation: data.backTranslation,
          driftHighlights: data.driftHighlights,
        },
      },
    };
  },
};
