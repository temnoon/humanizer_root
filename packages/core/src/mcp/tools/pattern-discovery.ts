/**
 * Pattern Discovery Tool Definitions
 *
 * MCP tools for the Pattern Discovery System:
 * - Autonomous pattern discovery
 * - User-described patterns
 * - Feedback learning
 * - Pattern composition
 */

import type { MCPToolDefinition } from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// DISCOVERY TOOLS
// ═══════════════════════════════════════════════════════════════════

export const DISCOVERY_TOOLS: MCPToolDefinition[] = [
  {
    name: 'pattern_discover',
    description: `Autonomously discover patterns in the archive without being told what to look for.

    The system scans content to notice common structures, sequences, and relationships.
    For example, it might discover: "When user uploads image, assistant often responds with code block + transcription"

    Returns candidate patterns with confidence scores and instance counts.`,
    category: 'pattern-discovery',
    inputSchema: {
      type: 'object',
      properties: {
        sourceTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by source types (e.g., ["chatgpt", "claude"])',
        },
        minInstances: {
          type: 'number',
          minimum: 2,
          default: 5,
          description: 'Minimum instances required for a pattern to be reported',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Maximum patterns to return',
        },
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// PATTERN MANAGEMENT TOOLS
// ═══════════════════════════════════════════════════════════════════

export const PATTERN_MANAGEMENT_TOOLS: MCPToolDefinition[] = [
  {
    name: 'pattern_describe',
    description: `Create a pattern from a natural language description.

    Describe what you're looking for in plain language, and the system will create
    a reusable pattern that can be executed, refined, and composed with other patterns.

    Examples:
    - "Find OCR transcriptions of handwritten notebook pages"
    - "DALL-E images with their generation prompts"
    - "Code reviews where the assistant suggests changes"
    - "German physics texts with mathematical formulas"`,
    category: 'pattern-discovery',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Natural language description of the pattern',
          minLength: 10,
        },
        name: {
          type: 'string',
          description: 'Optional custom name for the pattern (auto-generated if not provided)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for organization',
        },
      },
      required: ['description'],
    },
  },
  {
    name: 'pattern_execute',
    description: `Execute a pattern to find matching content.

    Run a named pattern (built-in or custom) and return matches with confidence scores.
    Learned constraints from previous feedback are automatically applied.`,
    category: 'pattern-discovery',
    inputSchema: {
      type: 'object',
      properties: {
        patternName: {
          type: 'string',
          description: 'Name of the pattern to execute',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 200,
          default: 100,
          description: 'Maximum results to return',
        },
        minConfidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.5,
          description: 'Minimum confidence threshold for matches',
        },
      },
      required: ['patternName'],
    },
  },
  {
    name: 'pattern_list',
    description: `List all available patterns in the library.

    Shows built-in patterns (ocr-transcription, image-description, dalle-generation)
    and any custom patterns you've created or composed.`,
    category: 'pattern-discovery',
    inputSchema: {
      type: 'object',
      properties: {
        includeBuiltin: {
          type: 'boolean',
          default: true,
          description: 'Include built-in patterns',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
      },
    },
  },
  {
    name: 'pattern_get',
    description: 'Get details of a specific pattern including its dimensions and learned constraints.',
    category: 'pattern-discovery',
    inputSchema: {
      type: 'object',
      properties: {
        patternName: {
          type: 'string',
          description: 'Name of the pattern',
        },
      },
      required: ['patternName'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// FEEDBACK TOOLS
// ═══════════════════════════════════════════════════════════════════

export const FEEDBACK_TOOLS: MCPToolDefinition[] = [
  {
    name: 'pattern_feedback',
    description: `Provide feedback on a pattern match to help the system learn.

    When a pattern returns results, you can mark them as:
    - correct: "Yes, this is what I wanted"
    - incorrect: "No, this doesn't match" (explain why)
    - partial: "Close, but not quite"

    The system learns from feedback to improve future matches by:
    - Finding content patterns common in incorrect but rare in correct
    - Learning semantic distinctions via embedding analysis
    - Applying learned constraints to future executions`,
    category: 'pattern-discovery',
    inputSchema: {
      type: 'object',
      properties: {
        patternName: {
          type: 'string',
          description: 'Name of the pattern',
        },
        contentId: {
          type: 'string',
          description: 'ID of the content being judged',
        },
        judgment: {
          type: 'string',
          enum: ['correct', 'incorrect', 'partial'],
          description: 'Your judgment on whether this match was correct',
        },
        explanation: {
          type: 'string',
          description: 'Why this match was correct/incorrect (helps the system learn)',
        },
      },
      required: ['patternName', 'contentId', 'judgment'],
    },
  },
  {
    name: 'pattern_get_constraints',
    description: 'Get learned constraints for a pattern (what the system learned from feedback).',
    category: 'pattern-discovery',
    inputSchema: {
      type: 'object',
      properties: {
        patternName: {
          type: 'string',
          description: 'Name of the pattern',
        },
      },
      required: ['patternName'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// COMPOSITION TOOLS
// ═══════════════════════════════════════════════════════════════════

export const COMPOSITION_TOOLS: MCPToolDefinition[] = [
  {
    name: 'pattern_compose',
    description: `Compose patterns using algebra operators.

    Combine existing patterns to create more specific or complex patterns:

    Operators:
    - AND: Both patterns must match (e.g., OCR AND German = German OCR)
    - OR: Either pattern matches
    - NOT: Base pattern minus exclusion (e.g., OCR NOT code = OCR excluding code)
    - SEQUENCE: Patterns in order (e.g., user-image SEQUENCE assistant-description)
    - REFINE: Add constraints to base (e.g., OCR refined by "notebook pages")`,
    category: 'pattern-discovery',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name for the composed pattern',
        },
        description: {
          type: 'string',
          description: 'Description of what the composition finds',
        },
        operator: {
          type: 'string',
          enum: ['AND', 'OR', 'NOT', 'SEQUENCE', 'REFINE'],
          description: 'Composition operator',
        },
        patterns: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 5,
          description: 'Pattern names to compose (order matters for NOT and SEQUENCE)',
        },
      },
      required: ['name', 'description', 'operator', 'patterns'],
    },
  },
  {
    name: 'pattern_specialize',
    description: `Create a specialized version of a base pattern.

    Build pattern hierarchies:
    - ocr-transcription → notebook-ocr → journal-ocr
    - image-description → photo-description → landscape-photos`,
    category: 'pattern-discovery',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name for the specialized pattern',
        },
        description: {
          type: 'string',
          description: 'Description of the specialization',
        },
        basePattern: {
          type: 'string',
          description: 'Name of the base pattern to specialize',
        },
        specialization: {
          type: 'string',
          description: 'Natural language description of the specialization',
        },
      },
      required: ['name', 'description', 'basePattern', 'specialization'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// ALL PATTERN DISCOVERY TOOLS
// ═══════════════════════════════════════════════════════════════════

export const PATTERN_DISCOVERY_TOOLS: MCPToolDefinition[] = [
  ...DISCOVERY_TOOLS,
  ...PATTERN_MANAGEMENT_TOOLS,
  ...FEEDBACK_TOOLS,
  ...COMPOSITION_TOOLS,
];

/**
 * Get all pattern discovery tools
 */
export function getPatternDiscoveryTools(): MCPToolDefinition[] {
  return PATTERN_DISCOVERY_TOOLS;
}
