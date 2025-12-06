/**
 * AI Detection tool definitions
 */

import type { ToolDefinition } from '../../types';

/**
 * AI Detection (Lite) - Heuristic-based detection
 */
export const aiDetectionLiteTool: ToolDefinition = {
  id: 'ai-detection-lite',
  name: 'AI Detection (Lite)',
  description: 'Detect AI-generated patterns using heuristics',
  longDescription: `
    Analyzes text for common patterns found in AI-generated content.
    Uses heuristic analysis to identify telltale signs like repetitive
    phrasing, unusual word choices, and structural patterns.
    Optional LLM judge provides additional confidence.
  `,

  category: 'analysis',
  tier: 'free',
  availableIn: ['all'],

  icon: '\ud83e\udd16',
  color: '#f59e0b',

  parameters: [
    {
      name: 'useLLMJudge',
      label: 'Use LLM Judge',
      type: 'boolean',
      default: false,
      description: 'Use AI to provide additional analysis (uses tokens)',
    },
  ],

  inputType: 'text',
  outputType: 'analysis',
  supportsStreaming: false,

  endpoint: '/ai-detection/lite',
  apiTarget: 'npe',

  validateInput: (input) => {
    if (input.length < 50) {
      return { valid: false, error: 'Text must be at least 50 characters' };
    }
    if (input.length > 50000) {
      return { valid: false, error: 'Text must be under 50,000 characters' };
    }
    return { valid: true };
  },

  formatResult: (raw: unknown) => {
    const data = raw as {
      verdict?: string;
      confidence?: number;
      highlights?: Array<{
        start: number;
        end: number;
        type: string;
        label?: string;
        score?: number;
      }>;
      patterns?: Record<string, number>;
    };
    return {
      success: true,
      toolId: 'ai-detection-lite',
      analysis: {
        verdict: data.verdict,
        confidence: data.confidence,
        highlights: data.highlights,
        details: data.patterns,
      },
    };
  },
};

/**
 * AI Detection (GPTZero) - Premium sentence-level analysis
 */
export const aiDetectionGPTZeroTool: ToolDefinition = {
  id: 'ai-detection-gptzero',
  name: 'AI Detection (GPTZero)',
  description: 'Premium AI detection with sentence-level analysis',
  longDescription: `
    Professional-grade AI detection powered by GPTZero.
    Provides detailed sentence-by-sentence analysis with
    confidence scores and specific detection reasoning.
  `,

  category: 'analysis',
  tier: 'pro',
  availableIn: ['all'],

  icon: '\ud83d\udd2c',
  color: '#8b5cf6',

  parameters: [],

  inputType: 'text',
  outputType: 'analysis',
  supportsStreaming: false,

  endpoint: '/ai-detection/detect',
  apiTarget: 'npe',

  validateInput: (input) => {
    if (input.length < 50) {
      return { valid: false, error: 'Text must be at least 50 characters' };
    }
    if (input.length > 50000) {
      return { valid: false, error: 'Text must be under 50,000 characters' };
    }
    return { valid: true };
  },

  formatResult: (raw: unknown) => {
    const data = raw as {
      verdict?: string;
      confidence?: number;
      sentences?: Array<{
        text: string;
        score: number;
        label: string;
      }>;
    };
    return {
      success: true,
      toolId: 'ai-detection-gptzero',
      analysis: {
        verdict: data.verdict,
        confidence: data.confidence,
        highlights: data.sentences?.map((s, i) => ({
          start: i,
          end: i + 1,
          type: s.label,
          label: s.text.substring(0, 50),
          score: s.score,
        })),
        details: data.sentences,
      },
    };
  },
};
