/**
 * Tool Definitions - JSON Schema for LLM Tool Use
 *
 * Defines all available tools with their JSON schemas for LLM function calling.
 * Tools are organized by category: drafting, search, media, books.
 *
 * @module @humanizer/core/aui/tool-definitions
 */

import type { ToolDefinition, ToolParameter } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Build parameters object
// ═══════════════════════════════════════════════════════════════════════════

function param(
  type: ToolParameter['type'],
  description: string,
  extra?: Partial<ToolParameter>
): ToolParameter {
  return { type, description, ...extra };
}

// ═══════════════════════════════════════════════════════════════════════════
// DRAFTING TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const DRAFTING_TOOLS: ToolDefinition[] = [
  {
    name: 'draft_start',
    description: 'Start a new drafting session to create content from multiple sources. Sources can be AUI archives, clusters, file paths, URLs, or direct text.',
    parameters: {
      title: param('string', 'Title for the draft'),
      sources: param('array', 'Array of source configurations. Each source has a type property.'),
      narratorPersonaId: param('string', 'Optional persona ID to use for voice'),
      userId: param('string', 'User ID for the session'),
    },
    required: ['title', 'sources'],
  },
  {
    name: 'draft_gather',
    description: 'Gather material from all configured sources for a drafting session. Must be called after draft_start.',
    parameters: {
      sessionId: param('string', 'Drafting session ID'),
    },
    required: ['sessionId'],
  },
  {
    name: 'draft_generate',
    description: 'Generate an initial draft from gathered material. Must be called after draft_gather.',
    parameters: {
      sessionId: param('string', 'Drafting session ID'),
      targetWordCount: param('number', 'Target word count for the draft'),
      guidance: param('string', 'Additional guidance for the LLM'),
      focusPassageIds: param('array', 'Optional array of passage IDs to focus on'),
    },
    required: ['sessionId'],
  },
  {
    name: 'draft_revise',
    description: 'Revise the current draft based on user feedback.',
    parameters: {
      sessionId: param('string', 'Drafting session ID'),
      feedback: param('string', 'User feedback text'),
      sectionsToRevise: param('array', 'Optional array of section names to revise'),
      toneAdjustments: param('array', 'Optional tone adjustments to apply'),
      addContent: param('array', 'Content to add'),
      removeContent: param('array', 'Content to remove'),
      targetWordCount: param('number', 'Target word count for revision'),
    },
    required: ['sessionId', 'feedback'],
  },
  {
    name: 'draft_finalize',
    description: 'Finalize and export the draft in specified formats.',
    parameters: {
      sessionId: param('string', 'Drafting session ID'),
      formats: param('array', 'Export formats: markdown, html, json'),
      outputDir: param('string', 'Optional directory to save files'),
    },
    required: ['sessionId'],
  },
  {
    name: 'draft_get',
    description: 'Get a drafting session by ID.',
    parameters: {
      sessionId: param('string', 'Drafting session ID'),
    },
    required: ['sessionId'],
  },
  {
    name: 'draft_list',
    description: 'List drafting sessions, optionally filtered by user or status.',
    parameters: {
      userId: param('string', 'Filter by user ID'),
      status: param('string', 'Filter by status: gathering, drafting, awaiting-feedback, revising, finalizing, complete'),
      limit: param('number', 'Maximum sessions to return'),
    },
    required: [],
  },
  {
    name: 'draft_version',
    description: 'Get a specific draft version from a session.',
    parameters: {
      sessionId: param('string', 'Drafting session ID'),
      version: param('number', 'Version number to retrieve'),
    },
    required: ['sessionId', 'version'],
  },
  {
    name: 'draft_compare',
    description: 'Compare two draft versions to see changes.',
    parameters: {
      sessionId: param('string', 'Drafting session ID'),
      fromVersion: param('number', 'Earlier version number'),
      toVersion: param('number', 'Later version number'),
    },
    required: ['sessionId', 'fromVersion', 'toVersion'],
  },
  {
    name: 'draft_delete',
    description: 'Delete a drafting session. DESTRUCTIVE - requires approval.',
    parameters: {
      sessionId: param('string', 'Drafting session ID to delete'),
    },
    required: ['sessionId'],
    isDestructive: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH/ARCHIVE TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const SEARCH_TOOLS: ToolDefinition[] = [
  {
    name: 'search_archive',
    description: 'Semantic search across the AUI archive. Returns passages ranked by relevance.',
    parameters: {
      query: param('string', 'Search query text'),
      limit: param('number', 'Maximum results to return (default: 50)'),
      minRelevance: param('number', 'Minimum relevance score 0-1 (default: 0.5)'),
      dateRange: param('object', 'Optional date range with start and end dates'),
      sourceTypes: param('array', 'Filter by source types'),
      authorRoles: param('array', 'Filter by author roles (user, assistant)'),
    },
    required: ['query'],
  },
  {
    name: 'search_refine',
    description: 'Refine a previous search with additional criteria.',
    parameters: {
      previousQuery: param('string', 'Previous search query'),
      refinement: param('string', 'Refinement query or criteria'),
      excludeIds: param('array', 'IDs to exclude from results'),
    },
    required: ['previousQuery', 'refinement'],
  },
  {
    name: 'cluster_discover',
    description: 'Discover clusters of related content in the archive using embedding similarity.',
    parameters: {
      sampleSize: param('number', 'Number of passages to sample (default: 500)'),
      minClusterSize: param('number', 'Minimum passages per cluster (default: 5)'),
      maxClusters: param('number', 'Maximum clusters to find (default: 10)'),
      minSimilarity: param('number', 'Minimum similarity threshold (default: 0.7)'),
      sourceTypes: param('array', 'Filter by source types'),
      authorRoles: param('array', 'Filter by author roles'),
    },
    required: [],
  },
  {
    name: 'cluster_list',
    description: 'List discovered clusters.',
    parameters: {
      userId: param('string', 'Filter by user ID'),
      limit: param('number', 'Maximum clusters to return'),
    },
    required: [],
  },
  {
    name: 'cluster_get',
    description: 'Get details for a specific cluster including its passages.',
    parameters: {
      clusterId: param('string', 'Cluster ID'),
    },
    required: ['clusterId'],
  },
  {
    name: 'archive_stats',
    description: 'Get archive statistics including node counts, embedding coverage, and source distribution.',
    parameters: {},
    required: [],
  },
  {
    name: 'archive_embed',
    description: 'Start embedding nodes that need embeddings. Long-running operation.',
    parameters: {
      limit: param('number', 'Maximum nodes to embed'),
      batchSize: param('number', 'Batch size for processing'),
      minWordCount: param('number', 'Minimum word count to embed (default: 7)'),
      sourceTypes: param('array', 'Filter by source types'),
    },
    required: [],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA/TRANSCRIPTION TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const MEDIA_TOOLS: ToolDefinition[] = [
  {
    name: 'media_list',
    description: 'List media items in an archive (images, audio, video).',
    parameters: {
      archiveId: param('string', 'Archive ID'),
      type: param('string', 'Filter by type: image, audio, video, all'),
      limit: param('number', 'Maximum items to return'),
      offset: param('number', 'Offset for pagination'),
    },
    required: ['archiveId'],
  },
  {
    name: 'media_get',
    description: 'Get details for a specific media item.',
    parameters: {
      mediaId: param('string', 'Media item ID'),
    },
    required: ['mediaId'],
  },
  {
    name: 'transcribe_start',
    description: 'Start a transcription job for a media item.',
    parameters: {
      mediaId: param('string', 'Media item ID'),
      archiveId: param('string', 'Archive ID'),
      type: param('string', 'Transcription type: audio, ocr, caption, description'),
      modelId: param('string', 'Optional model ID override'),
      priority: param('string', 'Priority: low, normal, high'),
    },
    required: ['mediaId', 'archiveId', 'type'],
  },
  {
    name: 'transcribe_status',
    description: 'Check the status of a transcription job.',
    parameters: {
      jobId: param('string', 'Transcription job ID'),
    },
    required: ['jobId'],
  },
  {
    name: 'transcription_list',
    description: 'List all transcription versions for a media item.',
    parameters: {
      mediaId: param('string', 'Media item ID'),
      archiveId: param('string', 'Archive ID'),
    },
    required: ['mediaId', 'archiveId'],
  },
  {
    name: 'transcription_get',
    description: 'Get a specific transcription version.',
    parameters: {
      versionId: param('string', 'Transcription version ID'),
    },
    required: ['versionId'],
  },
  {
    name: 'transcription_set_preferred',
    description: 'Set a transcription version as preferred for its media item and type.',
    parameters: {
      versionId: param('string', 'Transcription version ID to set as preferred'),
    },
    required: ['versionId'],
  },
  {
    name: 'transcription_summary',
    description: 'Get a summary of transcriptions for a media item.',
    parameters: {
      mediaId: param('string', 'Media item ID'),
      archiveId: param('string', 'Archive ID'),
    },
    required: ['mediaId', 'archiveId'],
  },
  {
    name: 'transcription_delete',
    description: 'Delete a transcription version. DESTRUCTIVE - requires approval.',
    parameters: {
      versionId: param('string', 'Transcription version ID to delete'),
    },
    required: ['versionId'],
    isDestructive: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// BOOK TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const BOOK_TOOLS: ToolDefinition[] = [
  {
    name: 'book_harvest',
    description: 'Harvest passages from the archive based on a query. Returns ranked passages for book creation.',
    parameters: {
      query: param('string', 'Search query for harvesting'),
      limit: param('number', 'Maximum passages to harvest (default: 50)'),
      minRelevance: param('number', 'Minimum relevance score 0-1'),
      dateRange: param('object', 'Date range with start and end'),
      excludeIds: param('array', 'Passage IDs to exclude'),
      maxFromSingleSource: param('number', 'Max passages from single source type'),
    },
    required: ['query'],
  },
  {
    name: 'book_create',
    description: 'Create a new book from a cluster or harvested passages.',
    parameters: {
      title: param('string', 'Book title'),
      clusterId: param('string', 'Cluster ID to create book from'),
      personaId: param('string', 'Persona ID for voice'),
      styleId: param('string', 'Style ID'),
      arcType: param('string', 'Arc type: chronological, thematic, dramatic, exploratory'),
      maxPassages: param('number', 'Maximum passages to include'),
      userId: param('string', 'User ID'),
    },
    required: ['title'],
  },
  {
    name: 'book_create_with_persona',
    description: 'Create a book from a cluster or query, applying a persona voice.',
    parameters: {
      userId: param('string', 'User ID'),
      title: param('string', 'Book title'),
      clusterId: param('string', 'Cluster ID (if not using query)'),
      query: param('string', 'Search query (if not using cluster)'),
      personaId: param('string', 'Persona ID'),
      styleId: param('string', 'Style ID'),
      arcType: param('string', 'Arc type: chronological, thematic, dramatic, exploratory'),
      maxPassages: param('number', 'Maximum passages'),
    },
    required: ['userId'],
  },
  {
    name: 'book_generate_arc',
    description: 'Generate a narrative arc from passages without creating a full book.',
    parameters: {
      passageIds: param('array', 'Array of passage IDs'),
      arcType: param('string', 'Arc type: chronological, thematic, dramatic, exploratory'),
      introWordCount: param('number', 'Target word count for introduction'),
    },
    required: ['passageIds'],
  },
  {
    name: 'book_list',
    description: 'List books, optionally filtered by user.',
    parameters: {
      userId: param('string', 'Filter by user ID'),
      limit: param('number', 'Maximum books to return'),
    },
    required: [],
  },
  {
    name: 'book_get',
    description: 'Get a book by ID.',
    parameters: {
      bookId: param('string', 'Book ID'),
    },
    required: ['bookId'],
  },
  {
    name: 'book_add_chapter',
    description: 'Add a chapter to an existing book.',
    parameters: {
      bookId: param('string', 'Book ID'),
      title: param('string', 'Chapter title'),
      content: param('string', 'Chapter content'),
      position: param('number', 'Position in book (0-indexed)'),
    },
    required: ['bookId', 'title', 'content'],
  },
  {
    name: 'book_update_chapter',
    description: 'Update an existing chapter.',
    parameters: {
      bookId: param('string', 'Book ID'),
      chapterId: param('string', 'Chapter ID'),
      title: param('string', 'New title'),
      content: param('string', 'New content'),
    },
    required: ['bookId', 'chapterId'],
  },
  {
    name: 'book_export',
    description: 'Export a book to a file format.',
    parameters: {
      bookId: param('string', 'Book ID'),
      format: param('string', 'Format: markdown, html, json'),
    },
    required: ['bookId'],
  },
  {
    name: 'book_delete',
    description: 'Delete a book. DESTRUCTIVE - requires approval.',
    parameters: {
      bookId: param('string', 'Book ID to delete'),
    },
    required: ['bookId'],
    isDestructive: true,
  },
  {
    name: 'chapter_delete',
    description: 'Delete a chapter from a book. DESTRUCTIVE - requires approval.',
    parameters: {
      bookId: param('string', 'Book ID'),
      chapterId: param('string', 'Chapter ID to delete'),
    },
    required: ['bookId', 'chapterId'],
    isDestructive: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ALL TOOLS (Combined)
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_TOOL_DEFINITIONS: ToolDefinition[] = [
  ...DRAFTING_TOOLS,
  ...SEARCH_TOOLS,
  ...MEDIA_TOOLS,
  ...BOOK_TOOLS,
];

// ═══════════════════════════════════════════════════════════════════════════
// TOOL CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

export const TOOL_CATEGORIES = {
  drafting: DRAFTING_TOOLS.map(t => t.name),
  search: SEARCH_TOOLS.map(t => t.name),
  media: MEDIA_TOOLS.map(t => t.name),
  books: BOOK_TOOLS.map(t => t.name),
} as const;

/**
 * Get tools by category
 */
export function getToolsByCategory(category: keyof typeof TOOL_CATEGORIES): ToolDefinition[] {
  switch (category) {
    case 'drafting':
      return DRAFTING_TOOLS;
    case 'search':
      return SEARCH_TOOLS;
    case 'media':
      return MEDIA_TOOLS;
    case 'books':
      return BOOK_TOOLS;
    default:
      return [];
  }
}

/**
 * Get a tool definition by name
 */
export function getToolDefinition(name: string): ToolDefinition | undefined {
  return ALL_TOOL_DEFINITIONS.find(t => t.name === name);
}

/**
 * Check if a tool is destructive
 */
export function isDestructiveTool(name: string): boolean {
  const tool = getToolDefinition(name);
  return tool?.isDestructive ?? false;
}
