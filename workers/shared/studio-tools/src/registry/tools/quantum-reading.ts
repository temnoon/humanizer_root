/**
 * Quantum Reading tool - narrative-studio local analysis
 *
 * Uses local Ollama for semantic analysis of archive text.
 * Designed for exploring conversation archives with phenomenological depth.
 */

import type { ToolDefinition } from '../../types';

/**
 * Quantum Reading Tool - Deep semantic analysis
 */
export const quantumReadingTool: ToolDefinition = {
  id: 'quantum-reading',
  name: 'Quantum Reading',
  description: 'Deep semantic analysis using local AI',
  longDescription: `
    Performs multi-layered semantic analysis on text using local Ollama models.
    Explores phenomenological dimensions: surface meaning, emotional resonance,
    thematic connections, and quantum entanglement with other archive content.
    Results include anchors for semantic navigation.
  `,

  category: 'analysis',
  tier: 'free',
  availableIn: ['narrative-studio'],

  icon: '🔮',
  color: '#a855f7',

  parameters: [
    {
      name: 'depth',
      label: 'Analysis Depth',
      type: 'select',
      default: 'deep',
      description: 'How deeply to analyze the text',
      options: [
        {
          value: 'surface',
          label: 'Surface',
          description: 'Quick thematic summary',
        },
        {
          value: 'deep',
          label: 'Deep',
          description: 'Full semantic analysis with connections',
        },
        {
          value: 'quantum',
          label: 'Quantum',
          description: 'Multi-dimensional analysis with archive links',
        },
      ],
    },
    {
      name: 'focusTopics',
      label: 'Focus Topics',
      type: 'multi-select',
      required: false,
      description: 'Anchor points to focus analysis around (optional)',
      optionsFrom: 'anchors',
    },
    {
      name: 'includeEmotional',
      label: 'Emotional Analysis',
      type: 'boolean',
      default: true,
      description: 'Include emotional resonance mapping',
    },
    {
      name: 'findConnections',
      label: 'Find Connections',
      type: 'boolean',
      default: true,
      description: 'Search for related content in archive',
    },
  ],

  inputType: 'text',
  outputType: 'analysis',
  supportsStreaming: false,

  endpoint: '/api/quantum/analyze',
  apiTarget: 'local',

  validateInput: (input) => {
    if (input.length < 20) {
      return { valid: false, error: 'Text must be at least 20 characters' };
    }
    if (input.length > 100000) {
      return { valid: false, error: 'Text must be under 100,000 characters' };
    }
    return { valid: true };
  },

  formatResult: (raw: unknown) => {
    const data = raw as {
      themes?: string[];
      emotionalProfile?: Record<string, number>;
      connections?: Array<{
        messageId: string;
        snippet: string;
        similarity: number;
      }>;
      anchors?: Array<{
        term: string;
        significance: number;
        context: string;
      }>;
      summary?: string;
      depth?: string;
    };

    return {
      success: true,
      toolId: 'quantum-reading',
      analysis: {
        verdict: data.summary,
        confidence: 1.0,
        highlights: data.anchors?.map((anchor, i) => ({
          start: i,
          end: i + 1,
          type: 'anchor',
          label: anchor.term,
          score: anchor.significance,
        })),
        details: {
          themes: data.themes,
          emotionalProfile: data.emotionalProfile,
          connections: data.connections,
          anchors: data.anchors,
          depth: data.depth,
        },
      },
    };
  },
};
