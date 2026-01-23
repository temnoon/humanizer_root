/**
 * BookAgent Tool Definitions
 *
 * MCP tools for quantum reading analysis and Rho-based transformation.
 * Uses BookAgent from @humanizer/npe for:
 * - Density matrix evolution (purity/entropy)
 * - Quality-controlled transformations
 * - Load-bearing sentence detection
 */

import type { MCPToolDefinition } from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// AVAILABLE PERSONAS AND STYLES
// ═══════════════════════════════════════════════════════════════════

/**
 * Built-in persona names available for transformation
 */
export const AVAILABLE_PERSONAS = [
  // Philosophical
  'empiricist',
  'romantic',
  'stoic',
  'absurdist',
  // Analytical/Scientific
  'darwin_systematic',
  'holmes_analytical',
  'watson_documenter',
  // Literary
  'austen_ironic',
  'dickens_humanitarian',
  'thoreau_contemplative',
  'emerson_transcendent',
  'montaigne_reflective',
  'marcus_aurelius_meditative',
  // Modern
  'tech_optimist',
  'skeptical_analyst',
  'curious_generalist',
] as const;

/**
 * Built-in style names available for transformation
 */
export const AVAILABLE_STYLES = [
  // Formal
  'academic',
  'technical',
  'legal',
  // Journalism & Business
  'journalistic',
  'executive_summary',
  // Conversational
  'conversational',
  'reddit_casual',
  'blog_personal',
  // Literary
  'literary',
  'austen_precision',
  'dickens_dramatic',
  'hemingway_sparse',
  'orwell_clear',
  // Specialized
  'scientific',
  'philosophical',
] as const;

// ═══════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

export const BOOK_AGENT_TOOLS: MCPToolDefinition[] = [
  {
    name: 'analyze_text_rho',
    description: 'Analyze text using quantum density matrix to measure meaning concentration (purity/entropy). Higher purity = concentrated meaning. Lower entropy = coherent theme. Useful for evaluating text quality before/after transformations.',
    category: 'book-agent',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to analyze (minimum 10 characters)',
          minLength: 10,
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'transform_with_persona',
    description: 'Transform text using a persona with Rho quality control. The agent retries with adjusted parameters if the transformation dilutes meaning (purity drops or entropy spikes). Returns original text if all attempts fail quality checks.',
    category: 'book-agent',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to transform',
          minLength: 10,
        },
        persona: {
          type: 'string',
          enum: [...AVAILABLE_PERSONAS],
          description: 'Persona to apply. Controls WHO perceives/narrates the text (worldview, epistemics, attention).',
        },
      },
      required: ['text', 'persona'],
    },
  },
  {
    name: 'transform_with_style',
    description: 'Transform text using a style with Rho quality control. The agent retries with adjusted parameters if the transformation dilutes meaning. Style controls HOW the text is written (sentence patterns, vocabulary, tone).',
    category: 'book-agent',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to transform',
          minLength: 10,
        },
        style: {
          type: 'string',
          enum: [...AVAILABLE_STYLES],
          description: 'Style to apply. Controls HOW text is written (sentence structure, vocabulary, register).',
        },
      },
      required: ['text', 'style'],
    },
  },
  {
    name: 'find_load_bearing_sentences',
    description: 'Identify sentences with highest semantic weight in the text. These are "load-bearing" sentences that carry concentrated meaning - fragile if removed. Useful for understanding text structure and identifying key points.',
    category: 'book-agent',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to analyze',
          minLength: 10,
        },
        topN: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 5,
          description: 'Number of sentences to return (default: 5)',
        },
      },
      required: ['text'],
    },
  },
];

/**
 * Get book-agent tools
 */
export function getBookAgentTools(): MCPToolDefinition[] {
  return BOOK_AGENT_TOOLS;
}
