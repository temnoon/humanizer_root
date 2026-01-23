/**
 * Bookmaking Tool Definitions
 *
 * MCP tools for the complete bookmaking workflow:
 * - Search: Hybrid semantic + keyword search
 * - Cluster: Group content by semantic similarity
 * - Anchor: Navigate embedding space with reference points
 * - Harvest: Collect passages for threads/chapters
 * - Outline: Generate chapter structure
 * - Draft: Compose chapters from passages
 *
 * Follows the FIND → REFINE → HARVEST pattern.
 */

import type { MCPToolDefinition } from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// SEARCH TOOLS
// ═══════════════════════════════════════════════════════════════════

export const SEARCH_TOOLS: MCPToolDefinition[] = [
  {
    name: 'search_archive',
    description: 'Hybrid search combining semantic (embedding) and keyword search. Uses Reciprocal Rank Fusion to merge results. Start here for any content discovery.',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query text',
          minLength: 2,
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Maximum results to return',
        },
        minRelevance: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.5,
          description: 'Minimum relevance score (0-1)',
        },
        denseWeight: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.6,
          description: 'Weight for semantic search (0-1)',
        },
        sparseWeight: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.4,
          description: 'Weight for keyword search (0-1)',
        },
        sourceFilter: {
          type: 'object',
          properties: {
            conversationIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter to specific conversations',
            },
            dateRange: {
              type: 'object',
              properties: {
                start: { type: 'number', description: 'Start timestamp (ms)' },
                end: { type: 'number', description: 'End timestamp (ms)' },
              },
            },
          },
          description: 'Optional source filters',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'find_similar',
    description: 'Find passages similar to a given text. Useful for expanding threads with related content.',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Reference text to find similar content for',
          minLength: 10,
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Maximum results to return',
        },
        excludeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs to exclude from results',
        },
      },
      required: ['text'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// CLUSTERING TOOLS
// ═══════════════════════════════════════════════════════════════════

export const CLUSTERING_TOOLS: MCPToolDefinition[] = [
  {
    name: 'cluster_content',
    description: 'Cluster content by semantic similarity using HDBSCAN. Returns groups of related passages with statistics. Useful for discovering themes and structure.',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        contentIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of content to cluster (if known)',
        },
        query: {
          type: 'string',
          description: 'Alternatively, search query to find content to cluster',
        },
        minClusterSize: {
          type: 'number',
          minimum: 2,
          maximum: 20,
          default: 3,
          description: 'Minimum points to form a cluster',
        },
        maxClusters: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Maximum clusters to return',
        },
        computeCentroids: {
          type: 'boolean',
          default: true,
          description: 'Compute cluster centroids for navigation',
        },
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// ANCHOR TOOLS
// ═══════════════════════════════════════════════════════════════════

export const ANCHOR_TOOLS: MCPToolDefinition[] = [
  {
    name: 'create_anchor',
    description: 'Create a semantic anchor from text or an existing passage. Anchors are reference points for navigating embedding space - "find content like this" or "avoid content like this".',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name for the anchor (e.g., "childhood memories", "technical details")',
        },
        text: {
          type: 'string',
          description: 'Text to create anchor from',
          minLength: 10,
        },
        type: {
          type: 'string',
          enum: ['positive', 'negative'],
          default: 'positive',
          description: 'Positive anchors attract results, negative anchors filter them out',
        },
      },
      required: ['name', 'text'],
    },
  },
  {
    name: 'refine_by_anchors',
    description: 'Refine search results using semantic anchors. Boosts results similar to positive anchors, filters out results similar to negative anchors. The REFINE step in FIND→REFINE→HARVEST.',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find initial results',
        },
        positiveAnchors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              text: { type: 'string' },
            },
            required: ['name', 'text'],
          },
          description: 'Positive anchors - attract similar content',
        },
        negativeAnchors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              text: { type: 'string' },
            },
            required: ['name', 'text'],
          },
          description: 'Negative anchors - filter out similar content',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 20,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'find_between_anchors',
    description: 'Find content that lies between two semantic anchors - content related to both concepts. Useful for discovering connections and bridges.',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        anchor1: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            text: { type: 'string' },
          },
          required: ['name', 'text'],
          description: 'First anchor',
        },
        anchor2: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            text: { type: 'string' },
          },
          required: ['name', 'text'],
          description: 'Second anchor',
        },
        balanceThreshold: {
          type: 'number',
          minimum: 0,
          maximum: 0.5,
          default: 0.2,
          description: 'How equidistant results must be from both anchors (lower = stricter)',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
        },
      },
      required: ['anchor1', 'anchor2'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// HARVEST TOOLS
// ═══════════════════════════════════════════════════════════════════

export const HARVEST_TOOLS: MCPToolDefinition[] = [
  {
    name: 'harvest_for_thread',
    description: 'Harvest relevant passages for a thread or chapter. Runs multiple queries and deduplicates results. The HARVEST step in FIND→REFINE→HARVEST.',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          description: 'Theme or topic of the thread',
        },
        queries: {
          type: 'array',
          items: { type: 'string' },
          description: 'Search queries to harvest from (multiple queries = broader coverage)',
        },
        existingPassageIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of passages already in the thread (to avoid duplicates)',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 20,
        },
      },
      required: ['theme', 'queries'],
    },
  },
  {
    name: 'discover_connections',
    description: 'Discover unexpected thematic connections from seed passages. Finds content that is related but not too similar - tangential discoveries.',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        seedTexts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Seed texts to explore from',
          minItems: 1,
        },
        explorationDepth: {
          type: 'number',
          minimum: 1,
          maximum: 3,
          default: 1,
          description: 'How deep to explore (higher = more tangential)',
        },
      },
      required: ['seedTexts'],
    },
  },
  {
    name: 'expand_thread',
    description: 'Expand an existing thread in a specific direction. Find deeper, broader, or contrasting content.',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          description: 'Theme of the thread',
        },
        existingTexts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Text of passages already in the thread',
        },
        direction: {
          type: 'string',
          enum: ['deeper', 'broader', 'contrasting'],
          description: 'Direction to expand: deeper (more specific), broader (wider context), contrasting (opposing views)',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
        },
      },
      required: ['theme', 'existingTexts', 'direction'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// OUTLINE & DRAFT TOOLS
// ═══════════════════════════════════════════════════════════════════

export const COMPOSITION_TOOLS: MCPToolDefinition[] = [
  {
    name: 'create_outline',
    description: 'Generate a chapter outline from passages. Determines optimal structure: opening, body sections, transitions, conclusion.',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          description: 'Theme/topic of the chapter',
        },
        passages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              text: { type: 'string' },
              role: {
                type: 'string',
                enum: ['anchor', 'supporting', 'contrast', 'evidence'],
                description: 'Role of this passage in the chapter',
              },
            },
            required: ['text'],
          },
          description: 'Passages to structure into a chapter',
          minItems: 1,
        },
        targetLength: {
          type: 'number',
          minimum: 500,
          maximum: 10000,
          default: 2000,
          description: 'Target word count for the chapter',
        },
      },
      required: ['theme', 'passages'],
    },
  },
  {
    name: 'compose_chapter',
    description: 'Compose a full chapter draft from passages. Creates outline, writes sections, adds transitions, analyzes style.',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Chapter title',
        },
        theme: {
          type: 'string',
          description: 'Theme/topic of the chapter',
        },
        passages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              text: { type: 'string' },
              role: {
                type: 'string',
                enum: ['anchor', 'supporting', 'contrast', 'evidence'],
                default: 'supporting',
              },
            },
            required: ['text'],
          },
          minItems: 1,
        },
        targetLength: {
          type: 'number',
          minimum: 500,
          maximum: 10000,
          default: 2000,
        },
        styleGuidelines: {
          type: 'string',
          description: 'Optional style instructions (e.g., "conversational", "academic")',
        },
        persona: {
          type: 'string',
          description: 'Optional persona to write as (e.g., "empiricist", "romantic")',
        },
      },
      required: ['title', 'theme', 'passages'],
    },
  },
  {
    name: 'analyze_structure',
    description: 'Analyze the structure of existing chapter content. Returns narrative arc, pacing score, issues, and suggestions.',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Chapter content to analyze',
          minLength: 100,
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'suggest_improvements',
    description: 'Get specific improvement suggestions for a chapter draft.',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Chapter content to analyze',
          minLength: 100,
        },
      },
      required: ['content'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// TERM EXTRACTION TOOLS
// ═══════════════════════════════════════════════════════════════════

export const EXTRACTION_TOOLS: MCPToolDefinition[] = [
  {
    name: 'extract_terms',
    description: 'Extract key terms, entities, and themes from text. Useful for understanding content and generating queries.',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to extract terms from',
          minLength: 50,
        },
        types: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['keywords', 'entities', 'themes', 'phrases'],
          },
          default: ['keywords', 'themes'],
          description: 'Types of terms to extract',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Maximum terms per type',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'compute_centroid',
    description: 'Compute the semantic centroid of multiple texts. Creates a synthetic anchor representing the "center" of the texts.',
    category: 'bookmaking',
    inputSchema: {
      type: 'object',
      properties: {
        texts: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          description: 'Texts to compute centroid from',
        },
        name: {
          type: 'string',
          description: 'Name for the resulting anchor',
        },
      },
      required: ['texts', 'name'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// ALL BOOKMAKING TOOLS
// ═══════════════════════════════════════════════════════════════════

export const BOOKMAKING_TOOLS: MCPToolDefinition[] = [
  ...SEARCH_TOOLS,
  ...CLUSTERING_TOOLS,
  ...ANCHOR_TOOLS,
  ...HARVEST_TOOLS,
  ...COMPOSITION_TOOLS,
  ...EXTRACTION_TOOLS,
];

/**
 * Get all bookmaking tools
 */
export function getBookmakingTools(): MCPToolDefinition[] {
  return BOOKMAKING_TOOLS;
}
