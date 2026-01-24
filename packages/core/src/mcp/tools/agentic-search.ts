/**
 * Agentic Search Tool Definitions
 *
 * MCP tools for unified search across archive and books:
 * - Session management
 * - Search operations (stateless and session-based)
 * - Refinement with anchors
 * - Quality and enrichment
 * - Navigation
 */

import type { MCPToolDefinition } from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT TOOLS
// ═══════════════════════════════════════════════════════════════════

export const SESSION_TOOLS: MCPToolDefinition[] = [
  {
    name: 'search_create_session',
    description: 'Create a new search session for iterative refinement. Sessions maintain state including results, anchors, and exclusions across multiple searches.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Optional name for the session',
        },
        notes: {
          type: 'string',
          description: 'Optional notes about the session purpose',
        },
      },
    },
  },
  {
    name: 'search_list_sessions',
    description: 'List all active search sessions with their metadata.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'search_get_session',
    description: 'Get details of a specific session including current results, anchors, and history.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'search_delete_session',
    description: 'Delete a search session and all its state.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID to delete',
        },
      },
      required: ['sessionId'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// SEARCH TOOLS
// ═══════════════════════════════════════════════════════════════════

export const SEARCH_TOOLS: MCPToolDefinition[] = [
  {
    name: 'search_unified',
    description: 'Unified search across archive and books using hybrid (semantic + keyword) search. Returns ranked results with provenance and quality indicators.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query text',
          minLength: 2,
        },
        sessionId: {
          type: 'string',
          description: 'Optional session ID to store results in',
        },
        target: {
          type: 'string',
          enum: ['archive', 'books', 'all'],
          default: 'all',
          description: 'Which store(s) to search',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Maximum results to return',
        },
        threshold: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.3,
          description: 'Minimum relevance threshold (0-1)',
        },
        hierarchyLevel: {
          type: 'string',
          enum: ['L0', 'L1', 'apex', 'all'],
          default: 'all',
          description: 'Filter by pyramid level: L0 (chunks), L1 (summaries), apex (top-level)',
        },
        mode: {
          type: 'string',
          enum: ['hybrid', 'dense', 'sparse'],
          default: 'hybrid',
          description: 'Search mode: hybrid combines semantic and keyword, dense is semantic-only, sparse is keyword-only',
        },
        sourceTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by source types (e.g., ["chatgpt", "claude"])',
        },
        authorRole: {
          type: 'string',
          enum: ['user', 'assistant', 'system'],
          description: 'Filter by author role',
        },
        bookId: {
          type: 'string',
          description: 'Filter to specific book (books target only)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_within_results',
    description: 'Search within previous session results (drill-down). Re-ranks existing results by similarity to new query.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID containing results to search within',
        },
        query: {
          type: 'string',
          description: 'New query to rank results by',
          minLength: 2,
        },
        threshold: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.3,
          description: 'Minimum similarity threshold',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Maximum results after filtering',
        },
      },
      required: ['sessionId', 'query'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// REFINEMENT TOOLS
// ═══════════════════════════════════════════════════════════════════

export const REFINEMENT_TOOLS: MCPToolDefinition[] = [
  {
    name: 'search_refine',
    description: 'Refine session results with various criteria: query filter, positive/negative examples, score thresholds, word count.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID to refine',
        },
        query: {
          type: 'string',
          description: 'Optional new query to filter by',
        },
        likeThese: {
          type: 'array',
          items: { type: 'string' },
          description: 'Result IDs to use as positive examples (find more like these)',
        },
        unlikeThese: {
          type: 'array',
          items: { type: 'string' },
          description: 'Result IDs to use as negative examples (exclude similar)',
        },
        minScore: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Minimum score to keep',
        },
        minWordCount: {
          type: 'number',
          minimum: 0,
          description: 'Minimum word count to keep',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          description: 'Maximum results after refinement',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'search_add_positive_anchor',
    description: 'Create a positive semantic anchor from a result. Subsequent searches will boost similar content.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID',
        },
        resultId: {
          type: 'string',
          description: 'ID of the result to use as anchor',
        },
        name: {
          type: 'string',
          description: 'Optional name for the anchor',
        },
      },
      required: ['sessionId', 'resultId'],
    },
  },
  {
    name: 'search_add_negative_anchor',
    description: 'Create a negative semantic anchor from a result. Subsequent searches will filter out similar content.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID',
        },
        resultId: {
          type: 'string',
          description: 'ID of the result to use as anchor',
        },
        name: {
          type: 'string',
          description: 'Optional name for the anchor',
        },
      },
      required: ['sessionId', 'resultId'],
    },
  },
  {
    name: 'search_apply_anchors',
    description: 'Re-score current session results using all defined anchors (positive boost, negative filter).',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'search_exclude_results',
    description: 'Manually exclude specific results from the session. Excluded results won\'t appear in future searches.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID',
        },
        resultIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of results to exclude',
          minItems: 1,
        },
      },
      required: ['sessionId', 'resultIds'],
    },
  },
  {
    name: 'search_pin_results',
    description: 'Pin results to protect them from exclusion or filtering.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID',
        },
        resultIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of results to pin',
          minItems: 1,
        },
      },
      required: ['sessionId', 'resultIds'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// QUALITY & ENRICHMENT TOOLS
// ═══════════════════════════════════════════════════════════════════

export const QUALITY_TOOLS: MCPToolDefinition[] = [
  {
    name: 'search_scrub_junk',
    description: 'Remove low-quality content from session results based on word count, quality score, and content type filters.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID',
        },
        minWordCount: {
          type: 'number',
          minimum: 0,
          default: 20,
          description: 'Minimum word count to keep',
        },
        minQualityScore: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Minimum quality score to keep',
        },
        scrubSystemMessages: {
          type: 'boolean',
          default: false,
          description: 'Remove system messages',
        },
        scrubTrivialContent: {
          type: 'boolean',
          default: true,
          description: 'Remove trivial/empty content',
        },
        authorRole: {
          type: 'string',
          enum: ['user', 'assistant', 'system'],
          description: 'Keep only this author role',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'search_enrich_results',
    description: 'Generate AI enrichments (title, summary, rating, categories) for session results.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID',
        },
        resultIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific result IDs to enrich (default: all)',
        },
        fields: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['title', 'summary', 'rating', 'categories', 'keyTerms'],
          },
          description: 'Specific fields to generate (default: all)',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'search_discover_clusters',
    description: 'Discover thematic clusters in session results using semantic similarity.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID',
        },
        minClusterSize: {
          type: 'number',
          minimum: 2,
          default: 3,
          description: 'Minimum results per cluster',
        },
        maxClusters: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 5,
          description: 'Maximum clusters to return',
        },
        generateLabels: {
          type: 'boolean',
          default: true,
          description: 'Generate labels for clusters',
        },
      },
      required: ['sessionId'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION TOOLS
// ═══════════════════════════════════════════════════════════════════

export const NAVIGATION_TOOLS: MCPToolDefinition[] = [
  {
    name: 'search_get_context',
    description: 'Get parent context for a result (the containing document or conversation).',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        resultId: {
          type: 'string',
          description: 'ID of the result to get context for',
        },
      },
      required: ['resultId'],
    },
  },
  {
    name: 'search_get_children',
    description: 'Get child nodes (sub-chunks) of a result.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        resultId: {
          type: 'string',
          description: 'ID of the result to get children for',
        },
      },
      required: ['resultId'],
    },
  },
  {
    name: 'search_get_thread',
    description: 'Get the full conversation thread containing a result.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        resultId: {
          type: 'string',
          description: 'ID of the result to get thread for',
        },
      },
      required: ['resultId'],
    },
  },
  {
    name: 'search_get_pyramid',
    description: 'Navigate the pyramid hierarchy: get apex (top-level summary) for a result.',
    category: 'agentic-search',
    inputSchema: {
      type: 'object',
      properties: {
        resultId: {
          type: 'string',
          description: 'ID of the result',
        },
        direction: {
          type: 'string',
          enum: ['up', 'down'],
          default: 'up',
          description: 'Direction: up to apex, down to children',
        },
      },
      required: ['resultId'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// ALL AGENTIC SEARCH TOOLS
// ═══════════════════════════════════════════════════════════════════

export const AGENTIC_SEARCH_TOOLS: MCPToolDefinition[] = [
  ...SESSION_TOOLS,
  ...SEARCH_TOOLS,
  ...REFINEMENT_TOOLS,
  ...QUALITY_TOOLS,
  ...NAVIGATION_TOOLS,
];

/**
 * Get all agentic search tools
 */
export function getAgenticSearchTools(): MCPToolDefinition[] {
  return AGENTIC_SEARCH_TOOLS;
}
