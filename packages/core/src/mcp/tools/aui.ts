/**
 * AUI (Ambient User Interface) Tool Definitions
 *
 * MCP tools for natural language interaction with the humanizer archive.
 * Wraps BQL (Batch Query Language) with LLM-powered interpretation.
 *
 * The AUI allows users to:
 * - Query the archive in natural language
 * - Execute complex pipelines through simple requests
 * - Transform, humanize, and organize content
 * - Build books and threads from discovered material
 *
 * @example
 * "Find my old vacation memories and make them sound more poetic"
 * → harvest "vacation memories" | transform style=literary | save vacation_poems
 */

import type { MCPToolDefinition } from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// CORE AUI TOOLS
// ═══════════════════════════════════════════════════════════════════

export const AUI_TOOLS: MCPToolDefinition[] = [
  {
    name: 'aui_query',
    description: `Natural language interface to the humanizer archive. Describe what you want to do in plain English and the AUI will translate it to a BQL pipeline and execute it.

Examples:
- "Find my old vacation memories"
- "Search for content about family and make it more poetic"
- "Take my tech notes and humanize them to sound less robotic"
- "Cluster my memories by theme and save the groups"
- "Find content similar to 'the smell of summer rain' and transform it with a nostalgic style"

The AUI understands:
- Search/harvest operations (find, search, get, harvest)
- Transformations (transform, make, convert, change)
- Humanization (humanize, make human-like, de-robotify)
- Analysis (detect AI, cluster, summarize)
- Output (save, export, show)`,
    category: 'aui',
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description: 'Natural language request describing what you want to do with your archive',
          minLength: 5,
        },
        dryRun: {
          type: 'boolean',
          default: false,
          description: 'If true, shows the generated pipeline without executing it',
        },
        maxItems: {
          type: 'number',
          minimum: 1,
          maximum: 1000,
          default: 100,
          description: 'Maximum items to process',
        },
        verbose: {
          type: 'boolean',
          default: false,
          description: 'Show detailed execution steps',
        },
      },
      required: ['request'],
    },
  },
  {
    name: 'bql_execute',
    description: `Execute a BQL (Batch Query Language) pipeline directly. For users who know BQL syntax.

BQL Syntax:
- Pipelines: step1 | step2 | step3
- Source: harvest "query", load buffer_name
- Filter: filter field > value, limit N, sample N
- Transform: transform persona=stoic style=literary
- Humanize: humanize light|moderate|aggressive
- Analysis: detect, cluster, summarize
- Output: save name, export format, print

Examples:
- harvest "childhood" | limit 20 | save memories
- load memories | transform persona=romantic | humanize moderate
- harvest "work" | filter quality > 0.7 | cluster | save work_themes`,
    category: 'aui',
    inputSchema: {
      type: 'object',
      properties: {
        pipeline: {
          type: 'string',
          description: 'BQL pipeline to execute',
          minLength: 3,
        },
        dryRun: {
          type: 'boolean',
          default: false,
        },
        maxItems: {
          type: 'number',
          minimum: 1,
          maximum: 1000,
          default: 100,
        },
        verbose: {
          type: 'boolean',
          default: false,
        },
      },
      required: ['pipeline'],
    },
  },
  {
    name: 'bql_parse',
    description: 'Parse natural language into a BQL pipeline without executing it. Useful for understanding what the AUI would do, or for tweaking the pipeline before execution.',
    category: 'aui',
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description: 'Natural language request to parse',
          minLength: 5,
        },
      },
      required: ['request'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT TOOLS
// ═══════════════════════════════════════════════════════════════════

export const AUI_SESSION_TOOLS: MCPToolDefinition[] = [
  {
    name: 'aui_buffers',
    description: 'List all buffers in the current AUI session. Buffers store intermediate results from pipeline executions.',
    category: 'aui',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'aui_buffer_get',
    description: 'Get the contents of a named buffer.',
    category: 'aui',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Buffer name (e.g., "memories", "_last")',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 10,
          description: 'Maximum items to return',
        },
        offset: {
          type: 'number',
          minimum: 0,
          default: 0,
          description: 'Number of items to skip',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'aui_buffer_set',
    description: 'Set or update a buffer with provided data.',
    category: 'aui',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Buffer name',
        },
        data: {
          type: 'array',
          description: 'Data to store in the buffer',
        },
      },
      required: ['name', 'data'],
    },
  },
  {
    name: 'aui_buffer_clear',
    description: 'Clear a buffer or all buffers.',
    category: 'aui',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Buffer name to clear, or omit to clear all',
        },
      },
    },
  },
  {
    name: 'aui_history',
    description: 'Get the command history for the current session.',
    category: 'aui',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
        },
      },
    },
  },
  {
    name: 'aui_reset',
    description: 'Reset the AUI session, clearing all buffers and history.',
    category: 'aui',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// RLM EXPLORATION TOOLS
// ═══════════════════════════════════════════════════════════════════

export const AUI_RLM_TOOLS: MCPToolDefinition[] = [
  {
    name: 'rlm_explore',
    description: `Start an RLM (Recursive Language Model) exploration session. This is for exploring very large datasets (10M+ tokens) by recursively drilling down using metadata-first queries.

The LLM receives context metadata instead of raw content, then writes filter expressions to navigate the data. Useful for:
- Exploring unfamiliar archives
- Finding patterns in large datasets
- Discovering unexpected connections

The exploration continues until the LLM finds what it's looking for or reaches a reasonable stopping point.`,
    category: 'aui',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'What you want to find or explore (e.g., "find themes about family across my archive")',
          minLength: 10,
        },
        maxDepth: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          default: 3,
          description: 'Maximum recursion depth',
        },
        maxExplorations: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 10,
          description: 'Maximum number of exploration steps',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'rlm_findings',
    description: 'Get the findings from the current or most recent RLM exploration.',
    category: 'aui',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
        },
        minRelevance: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.5,
        },
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// HELP TOOLS
// ═══════════════════════════════════════════════════════════════════

export const AUI_HELP_TOOLS: MCPToolDefinition[] = [
  {
    name: 'bql_help',
    description: 'Get help on BQL syntax and available operations.',
    category: 'aui',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: ['syntax', 'operations', 'examples', 'personas', 'styles'],
          description: 'Help topic',
        },
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// ALL AUI TOOLS
// ═══════════════════════════════════════════════════════════════════

export const ALL_AUI_TOOLS: MCPToolDefinition[] = [
  ...AUI_TOOLS,
  ...AUI_SESSION_TOOLS,
  ...AUI_RLM_TOOLS,
  ...AUI_HELP_TOOLS,
];

/**
 * Get all AUI tools
 */
export function getAuiTools(): MCPToolDefinition[] {
  return ALL_AUI_TOOLS;
}
