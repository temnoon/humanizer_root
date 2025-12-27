/**
 * AUI Tools - Tool definitions and execution for the AI assistant
 *
 * Features:
 * - Tool definitions with parameters
 * - Tool parsing from AUI responses
 * - Tool execution with context
 * - Workspace awareness (current content, selected media/posts)
 * - Archive search (semantic search across ChatGPT/Facebook)
 * - Passage management (curate content into book)
 */

import type { BookProject, DraftChapter, SourcePassage } from '../../components/archive/book-project/types';
import type { SelectedFacebookMedia, SelectedFacebookContent } from '../../components/archive/types';
import type { PinnedContent } from '../buffer/pins';

// Import transform service for persona/style operations
import {
  transformPersona,
  transformStyle,
  getPersonas,
  getStyles,
  humanize,
  detectAI,
  detectAILite,
  analyzeSentences,
  type DetectionResponse,
} from '../transform/service';
import { getStoredToken } from '../auth';

// Import profile extraction service
import {
  extractPersona as extractPersonaAPI,
  extractStyle as extractStyleAPI,
  discoverVoices as discoverVoicesAPI,
  toUnifiedPersona,
  toUnifiedStyle,
} from '../profile';

// Import pyramid building service
import {
  buildPyramid,
  searchChunks,
} from '../pyramid';

// Import agent bridge
import { getAgentBridge } from './agent-bridge';

// Archive server for API calls
const ARCHIVE_SERVER = 'http://localhost:3002';
const NPE_API_BASE = import.meta.env.VITE_API_URL || 'https://npe-api.tem-527.workers.dev';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface AUIToolResult {
  success: boolean;
  message?: string;
  content?: string;
  data?: unknown;
  error?: string;

  /**
   * Teaching output - shows the user how to do this themselves
   * Following the "Teach By Doing" philosophy
   */
  teaching?: {
    /** What this action accomplished */
    whatHappened: string;
    /** GUI path to do this manually */
    guiPath?: string[];
    /** Command/shortcut if available */
    shortcut?: string;
    /** Explanation of why this matters */
    why?: string;
  };
}

/** Workspace state - what's currently displayed */
export interface WorkspaceState {
  /** Current text content in the buffer */
  bufferContent: string | null;
  /** Buffer name/title */
  bufferName: string | null;
  /** Selected Facebook media (if viewing media) */
  selectedMedia: SelectedFacebookMedia | null;
  /** Selected Facebook content (if viewing post/comment) */
  selectedContent: SelectedFacebookContent | null;
  /** Current view mode */
  viewMode: 'text' | 'media' | 'content' | 'graph' | 'book';
}

export interface AUIContext {
  // Book operations
  activeProject: BookProject | null;
  updateChapter: (chapterId: string, content: string, changes?: string) => void;
  createChapter: (title: string, content?: string) => DraftChapter | null;
  deleteChapter: (chapterId: string) => void;
  renderBook: () => string;
  getChapter: (chapterId: string) => DraftChapter | null;

  // Passage operations (new)
  addPassage?: (passage: {
    content: string;
    conversationId?: string;
    conversationTitle: string;
    role?: 'user' | 'assistant';
    tags?: string[];
  }) => SourcePassage | null;
  updatePassage?: (passageId: string, updates: Partial<SourcePassage>) => void;
  getPassages?: () => SourcePassage[];

  // Workspace state (new)
  workspace?: WorkspaceState;

  // Pinned content (Items 9-12: tool integration with pins)
  pinnedContent?: PinnedContent[];
}

export interface ParsedToolUse {
  name: string;
  params: Record<string, unknown>;
  raw: string;
}

// ═══════════════════════════════════════════════════════════════════
// TOOL PARSER
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse USE_TOOL invocations from AUI response
 */
export function parseToolUses(response: string): ParsedToolUse[] {
  const uses: ParsedToolUse[] = [];

  // Pattern: USE_TOOL(name, {json params}) or USE_TOOL(name, {})
  const pattern = /USE_TOOL\s*\(\s*(\w+)\s*,\s*(\{[^}]*\})\s*\)/g;

  let match;
  while ((match = pattern.exec(response)) !== null) {
    try {
      const name = match[1];
      const paramsStr = match[2];
      const params = JSON.parse(paramsStr);

      uses.push({
        name,
        params,
        raw: match[0],
      });
    } catch (e) {
      console.warn('Failed to parse tool use:', match[0], e);
    }
  }

  return uses;
}

/**
 * Remove tool invocations from response for clean display
 * (Optional - you might want to keep them visible)
 */
export function cleanToolsFromResponse(response: string): string {
  return response.replace(/USE_TOOL\s*\(\s*\w+\s*,\s*\{[^}]*\}\s*\)/g, '').trim();
}

// ═══════════════════════════════════════════════════════════════════
// TOOL EXECUTOR
// ═══════════════════════════════════════════════════════════════════

/**
 * Execute a single tool
 */
export async function executeTool(
  toolUse: ParsedToolUse,
  context: AUIContext
): Promise<AUIToolResult> {
  const { name, params } = toolUse;

  switch (name) {
    // Book chapter tools
    case 'update_chapter':
      return executeUpdateChapter(params, context);

    case 'create_chapter':
      return executeCreateChapter(params, context);

    case 'delete_chapter':
      return executeDeleteChapter(params, context);

    case 'render_book':
      return executeRenderBook(context);

    case 'list_chapters':
      return executeListChapters(context);

    case 'get_chapter':
      return executeGetChapter(params, context);

    // Workspace tools (new)
    case 'get_workspace':
      return executeGetWorkspace(context);

    case 'save_to_chapter':
      return executeSaveToChapter(params, context);

    // Archive tools (new)
    case 'search_archive':
      return executeSearchArchive(params);

    case 'search_facebook':
      return executeSearchFacebook(params);

    case 'list_conversations':
      return executeListConversations(params);

    case 'harvest_archive':
      return executeHarvestArchive(params, context);

    // Passage tools (new)
    case 'add_passage':
      return executeAddPassage(params, context);

    case 'list_passages':
      return executeListPassages(context);

    case 'mark_passage':
      return executeMarkPassage(params, context);

    // Image tools (new)
    case 'describe_image':
      return executeDescribeImage(params, context);

    case 'search_images':
      return executeSearchImages(params);

    case 'classify_image':
      return executeClassifyImage(params, context);

    case 'find_similar_images':
      return executeFindSimilarImages(params, context);

    case 'cluster_images':
      return executeClusterImages(params);

    case 'add_image_passage':
      return executeAddImagePassage(params, context);

    // Persona/Style tools
    case 'list_personas':
      return executeListPersonas();

    case 'list_styles':
      return executeListStyles();

    case 'apply_persona':
      return executeApplyPersona(params, context);

    case 'apply_style':
      return executeApplyStyle(params, context);

    case 'extract_persona':
      return executeExtractPersona(params, context);

    case 'extract_style':
      return executeExtractStyle(params, context);

    case 'discover_voices':
      return executeDiscoverVoices(params);

    case 'create_persona':
      return executeCreatePersona(params);

    case 'create_style':
      return executeCreateStyle(params);

    // Text transformation tools
    case 'humanize':
      return executeHumanize(params, context);

    case 'detect_ai':
      return executeDetectAI(params, context);

    case 'translate':
      return executeTranslate(params, context);

    case 'analyze_text':
      return executeAnalyzeText(params, context);

    case 'quantum_read':
      return executeQuantumRead(params, context);

    // Pyramid building tools
    case 'build_pyramid':
      return executeBuildPyramid(params, context);

    case 'get_pyramid':
      return executeGetPyramid(context);

    case 'search_pyramid':
      return executeSearchPyramid(params, context);

    // Draft generation tools
    case 'generate_first_draft':
      return executeGenerateFirstDraft(params, context);

    // Agent tools
    case 'list_agents':
      return executeListAgents();

    case 'get_agent_status':
      return executeGetAgentStatus(params);

    case 'list_pending_proposals':
      return executeListPendingProposals();

    case 'request_agent':
      return executeRequestAgent(params);

    // Workflow tools
    case 'discover_threads':
      return executeDiscoverThreads(params, context);

    case 'start_book_workflow':
      return executeStartBookWorkflow(params, context);

    default:
      return {
        success: false,
        error: `Unknown tool: ${name}`,
      };
  }
}

/**
 * Execute all tools in a response
 */
export async function executeAllTools(
  response: string,
  context: AUIContext
): Promise<{ results: AUIToolResult[]; hasTools: boolean }> {
  const toolUses = parseToolUses(response);

  if (toolUses.length === 0) {
    return { results: [], hasTools: false };
  }

  const results: AUIToolResult[] = [];

  for (const toolUse of toolUses) {
    const result = await executeTool(toolUse, context);
    results.push(result);
  }

  return { results, hasTools: true };
}

// ═══════════════════════════════════════════════════════════════════
// TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════

function executeUpdateChapter(
  params: Record<string, unknown>,
  context: AUIContext
): AUIToolResult {
  const { chapterId, content, changes } = params as {
    chapterId?: string;
    content?: string;
    changes?: string;
  };

  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  if (!chapterId) {
    return { success: false, error: 'Missing chapterId parameter' };
  }

  if (!content) {
    return { success: false, error: 'Missing content parameter' };
  }

  try {
    context.updateChapter(chapterId, content, changes);

    // Get the updated chapter to report version
    const chapter = context.getChapter(chapterId);
    const version = chapter?.version || '?';
    const wordCount = chapter?.wordCount || 0;

    return {
      success: true,
      message: `Chapter updated to version ${version}`,
      data: { chapterId, version },
      teaching: {
        whatHappened: `Saved new version (v${version}) of "${chapter?.title || 'chapter'}" - ${wordCount} words`,
        guiPath: [
          'Click on a chapter to open the editor',
          'Make your edits in the text area',
          'Changes are auto-saved as new versions',
          'Use the version dropdown to see history',
        ],
        why: 'Every edit creates a new version. You can always go back to previous versions if needed.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to update chapter',
    };
  }
}

function executeCreateChapter(
  params: Record<string, unknown>,
  context: AUIContext
): AUIToolResult {
  const { title, content } = params as {
    title?: string;
    content?: string;
  };

  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  if (!title) {
    return { success: false, error: 'Missing title parameter' };
  }

  try {
    const chapter = context.createChapter(title, content);

    if (!chapter) {
      return { success: false, error: 'Failed to create chapter' };
    }

    return {
      success: true,
      message: `Created Chapter ${chapter.number}: ${chapter.title}`,
      data: { chapterId: chapter.id, number: chapter.number, title: chapter.title },
      teaching: {
        whatHappened: `Created a new chapter "${chapter.title}" as Chapter ${chapter.number}`,
        guiPath: [
          'Open the Book panel (right side)',
          'Click the "Chapters" tab',
          'Click "+ New Chapter"',
          'Enter the title',
        ],
        shortcut: 'Press "N" while in the Book panel',
        why: 'Chapters organize your book. Start with an outline, then fill in content from your curated passages.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to create chapter',
    };
  }
}

function executeDeleteChapter(
  params: Record<string, unknown>,
  context: AUIContext
): AUIToolResult {
  const { chapterId } = params as { chapterId?: string };

  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  if (!chapterId) {
    return { success: false, error: 'Missing chapterId parameter' };
  }

  try {
    context.deleteChapter(chapterId);
    return {
      success: true,
      message: `Chapter deleted`,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to delete chapter',
    };
  }
}

function executeRenderBook(context: AUIContext): AUIToolResult {
  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  try {
    const rendered = context.renderBook();
    return {
      success: true,
      message: `Book rendered (${context.activeProject.stats.chapters} chapters, ${context.activeProject.stats.wordCount} words)`,
      content: rendered,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to render book',
    };
  }
}

function executeListChapters(context: AUIContext): AUIToolResult {
  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  const projectChapters = context.activeProject.chapters || context.activeProject.drafts?.chapters || [];
  const chapters = projectChapters.map(c => ({
    id: c.id,
    number: c.number,
    title: c.title,
    status: c.status,
    version: c.version,
    wordCount: c.wordCount,
  }));

  return {
    success: true,
    message: `${chapters.length} chapter(s) in project`,
    data: { chapters },
  };
}

function executeGetChapter(
  params: Record<string, unknown>,
  context: AUIContext
): AUIToolResult {
  const { chapterId } = params as { chapterId?: string };

  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  if (!chapterId) {
    return { success: false, error: 'Missing chapterId parameter' };
  }

  const chapter = context.getChapter(chapterId);

  if (!chapter) {
    return { success: false, error: `Chapter ${chapterId} not found` };
  }

  return {
    success: true,
    data: {
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      content: chapter.content,
      version: chapter.version,
      wordCount: chapter.wordCount,
      status: chapter.status,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// WORKSPACE TOOLS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get current workspace state - what's being displayed
 */
function executeGetWorkspace(context: AUIContext): AUIToolResult {
  const ws = context.workspace;

  if (!ws) {
    return {
      success: true,
      message: 'Workspace state not available',
      data: { viewMode: 'unknown' },
    };
  }

  const result: Record<string, unknown> = {
    viewMode: ws.viewMode,
  };

  if (ws.bufferContent) {
    result.buffer = {
      name: ws.bufferName,
      content: ws.bufferContent.slice(0, 500), // Preview only
      length: ws.bufferContent.length,
      wordCount: ws.bufferContent.split(/\s+/).filter(w => w).length,
    };
  }

  if (ws.selectedMedia) {
    result.media = {
      id: ws.selectedMedia.id,
      type: ws.selectedMedia.media_type,
      filename: ws.selectedMedia.filename,
      hasLinkedContent: (ws.selectedMedia.linkedContent?.length || 0) > 0,
    };
  }

  if (ws.selectedContent) {
    result.facebookContent = {
      id: ws.selectedContent.id,
      type: ws.selectedContent.type,
      title: ws.selectedContent.title,
      textPreview: ws.selectedContent.text.slice(0, 200),
      textLength: ws.selectedContent.text.length,
      hasMedia: (ws.selectedContent.media?.length || 0) > 0,
      isOwnContent: ws.selectedContent.is_own_content,
    };
  }

  return {
    success: true,
    message: `Workspace viewing: ${ws.viewMode}`,
    data: result,
  };
}

/**
 * Save current workspace content to a chapter
 */
function executeSaveToChapter(
  params: Record<string, unknown>,
  context: AUIContext
): AUIToolResult {
  const { chapterId, append } = params as { chapterId?: string; append?: boolean };

  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  if (!chapterId) {
    return { success: false, error: 'Missing chapterId parameter' };
  }

  const ws = context.workspace;
  if (!ws) {
    return { success: false, error: 'Workspace state not available' };
  }

  // Determine content to save
  let content: string | null = null;
  let source: string = 'unknown';

  if (ws.selectedContent) {
    content = ws.selectedContent.text;
    source = `Facebook ${ws.selectedContent.type}`;
  } else if (ws.bufferContent) {
    content = ws.bufferContent;
    source = ws.bufferName || 'buffer';
  }

  if (!content) {
    return { success: false, error: 'No content in workspace to save' };
  }

  try {
    const chapter = context.getChapter(chapterId);
    if (!chapter) {
      return { success: false, error: `Chapter ${chapterId} not found` };
    }

    const finalContent = append
      ? `${chapter.content}\n\n---\n\n${content}`
      : content;

    context.updateChapter(chapterId, finalContent, `Added content from ${source}`);

    const wordCount = content.split(/\s+/).filter(w => w).length;

    return {
      success: true,
      message: `${append ? 'Appended to' : 'Replaced'} chapter "${chapter.title}" with ${source} content`,
      data: { chapterId, contentLength: content.length },
      teaching: {
        whatHappened: `${append ? 'Added' : 'Replaced content with'} ${wordCount} words from ${source} in "${chapter.title}"`,
        guiPath: [
          'View content in the workspace (center panel)',
          'Open the Book panel (right side)',
          'Click "Add to Chapter" button',
          'Select a chapter from the dropdown',
          `Choose "${append ? 'Append' : 'Replace'}"`,
        ],
        why: append
          ? 'Appending adds new content to the end with a separator, preserving existing work.'
          : 'Replacing overwrites the chapter - useful when starting fresh.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to save to chapter',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// ARCHIVE SEARCH TOOLS
// ═══════════════════════════════════════════════════════════════════

/**
 * Search ChatGPT archive semantically
 */
async function executeSearchArchive(
  params: Record<string, unknown>
): Promise<AUIToolResult> {
  const { query, limit = 10 } = params as { query?: string; limit?: number };

  if (!query) {
    return { success: false, error: 'Missing query parameter' };
  }

  try {
    const response = await fetch(`${ARCHIVE_SERVER}/api/embeddings/search/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
    });

    if (!response.ok) {
      // Fallback to text search if embeddings not available
      const fallbackResponse = await fetch(
        `${ARCHIVE_SERVER}/api/conversations?search=${encodeURIComponent(query)}&limit=${limit}`
      );

      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        return {
          success: true,
          message: `Found ${data.conversations?.length || 0} conversations (text search)`,
          data: {
            results: (data.conversations || []).slice(0, limit).map((c: { id: string; title: string; folder: string; message_count: number; created_at: number }) => ({
              id: c.id,
              title: c.title,
              folder: c.folder,
              messageCount: c.message_count,
              created: c.created_at,
            })),
            searchType: 'text',
          },
        };
      }

      return { success: false, error: 'Archive search failed' };
    }

    const data = await response.json();

    const resultCount = data.results?.length || 0;

    return {
      success: true,
      message: `Found ${resultCount} messages (semantic search)`,
      data: {
        results: (data.results || []).map((r: { message_id: string; conversation_id: string; content: string; similarity: number; role: string }) => ({
          messageId: r.message_id,
          conversationId: r.conversation_id,
          content: r.content?.slice(0, 200),
          similarity: r.similarity,
          role: r.role,
        })),
        searchType: 'semantic',
      },
      teaching: {
        whatHappened: `Searched your ChatGPT archive for "${query}" - found ${resultCount} semantically similar passages`,
        guiPath: [
          'Open the Archive panel (left side)',
          'Click the "Explore" tab',
          'Enter your search in the semantic search box',
          'Results are ranked by meaning similarity, not just keywords',
        ],
        why: 'Semantic search finds related ideas even when the words differ. Use it to find thematic connections across conversations.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Archive search failed',
    };
  }
}

/**
 * Search Facebook archive
 */
async function executeSearchFacebook(
  params: Record<string, unknown>
): Promise<AUIToolResult> {
  const { query, type, limit = 20 } = params as {
    query?: string;
    type?: 'post' | 'comment' | 'all';
    limit?: number;
  };

  if (!query) {
    return { success: false, error: 'Missing query parameter' };
  }

  try {
    const searchParams = new URLSearchParams({
      source: 'facebook',
      limit: String(limit),
    });

    if (type && type !== 'all') {
      searchParams.append('type', type);
    }

    const response = await fetch(
      `${ARCHIVE_SERVER}/api/content/items?${searchParams}`
    );

    if (!response.ok) {
      return { success: false, error: 'Facebook search failed' };
    }

    const data = await response.json();

    // Client-side filter by query (server may not support text search)
    const q = query.toLowerCase();
    const filtered = (data.items || []).filter((item: { text?: string; title?: string }) =>
      item.text?.toLowerCase().includes(q) || item.title?.toLowerCase().includes(q)
    );

    return {
      success: true,
      message: `Found ${filtered.length} Facebook items matching "${query}"`,
      data: {
        results: filtered.slice(0, limit).map((item: { id: string; type: string; text?: string; title?: string; created_at: number; is_own_content: boolean }) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          textPreview: item.text?.slice(0, 150),
          created: item.created_at,
          isOwnContent: item.is_own_content,
        })),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Facebook search failed',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// PASSAGE MANAGEMENT TOOLS
// ═══════════════════════════════════════════════════════════════════

/**
 * Add a passage to the book project
 */
function executeAddPassage(
  params: Record<string, unknown>,
  context: AUIContext
): AUIToolResult {
  const { text, title, tags } = params as {
    text?: string;
    title?: string;
    tags?: string[];
  };

  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  if (!context.addPassage) {
    return { success: false, error: 'Passage management not available' };
  }

  // If no text provided, use workspace content
  let passageContent = text;
  let passageTitle = title;

  if (!passageContent && context.workspace) {
    if (context.workspace.selectedContent) {
      passageContent = context.workspace.selectedContent.text;
      passageTitle = passageTitle || context.workspace.selectedContent.title || `Facebook ${context.workspace.selectedContent.type}`;
    } else if (context.workspace.bufferContent) {
      passageContent = context.workspace.bufferContent;
      passageTitle = passageTitle || context.workspace.bufferName || 'Untitled passage';
    }
  }

  if (!passageContent) {
    return { success: false, error: 'No text provided and no content in workspace' };
  }

  try {
    const passage = context.addPassage({
      content: passageContent,
      conversationTitle: passageTitle || passageContent.slice(0, 50) + '...',
      role: 'user',
      tags: tags || ['uncategorized'],
    });

    if (!passage) {
      return { success: false, error: 'Failed to add passage' };
    }

    const wordCount = passageContent.split(/\s+/).filter(w => w).length;

    return {
      success: true,
      message: `Added passage "${passage.conversationTitle}" with tags: ${passage.tags.join(', ')}`,
      data: {
        passageId: passage.id,
        title: passage.conversationTitle,
        tags: passage.tags,
        wordCount,
      },
      // Teaching output - show the user how to do this themselves
      teaching: {
        whatHappened: `Saved ${wordCount} words to your book's passage library under "${passage.conversationTitle}"`,
        guiPath: [
          'Open the Book panel (right side)',
          'Click the "Passages" tab',
          'Click "+ Add Passage"',
          'Paste your text and add tags',
        ],
        shortcut: 'Select text → Right-click → "Add to Book"',
        why: 'Passages are the raw material for your book. They get curated (approved/gem/rejected) before becoming chapters.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to add passage',
    };
  }
}

/**
 * List passages in the book project
 */
function executeListPassages(context: AUIContext): AUIToolResult {
  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  if (!context.getPassages) {
    return { success: false, error: 'Passage management not available' };
  }

  try {
    const passages = context.getPassages();

    // Group by tags
    const byTag: Record<string, { count: number; gems: number; unreviewed: number }> = {};
    for (const p of passages) {
      for (const tag of p.tags || ['uncategorized']) {
        if (!byTag[tag]) {
          byTag[tag] = { count: 0, gems: 0, unreviewed: 0 };
        }
        byTag[tag].count++;
        if (p.status === 'gem') byTag[tag].gems++;
        if (p.status === 'unreviewed') byTag[tag].unreviewed++;
      }
    }

    const gemCount = passages.filter(p => p.status === 'gem').length;
    const unreviewedCount = passages.filter(p => p.status === 'unreviewed').length;

    return {
      success: true,
      message: `${passages.length} passage(s) with ${Object.keys(byTag).length} tag(s)`,
      data: {
        total: passages.length,
        byTag,
        passages: passages.slice(0, 20).map(p => ({
          id: p.id,
          title: p.conversationTitle,
          tags: p.tags,
          status: p.status,
          preview: p.content?.slice(0, 100),
        })),
      },
      teaching: {
        whatHappened: `Found ${passages.length} passages: ${gemCount} gems, ${unreviewedCount} unreviewed`,
        guiPath: [
          'Open the Book panel (right side)',
          'Click the "Passages" tab',
          'Use the filter dropdown to show gems/unreviewed',
        ],
        why: 'Review passages to mark the best ones as "gems" - these become the foundation of your chapters.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to list passages',
    };
  }
}

/**
 * Mark a passage with curation status
 */
function executeMarkPassage(
  params: Record<string, unknown>,
  context: AUIContext
): AUIToolResult {
  const { passageId, status, notes } = params as {
    passageId?: string;
    status?: 'unreviewed' | 'approved' | 'gem' | 'rejected';
    notes?: string;
  };

  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  if (!context.updatePassage) {
    return { success: false, error: 'Passage management not available' };
  }

  if (!passageId) {
    return { success: false, error: 'Missing passageId parameter' };
  }

  if (!status) {
    return { success: false, error: 'Missing status parameter (unreviewed/approved/gem/rejected)' };
  }

  try {
    context.updatePassage(passageId, {
      status,
      curatorNotes: notes,
    });

    const statusEmoji: Record<string, string> = {
      gem: '💎',
      approved: '✓',
      rejected: '✗',
      unreviewed: '○',
    };

    return {
      success: true,
      message: `${statusEmoji[status] || ''} Passage marked as "${status}"${notes ? ` with notes` : ''}`,
      data: { passageId, status },
      teaching: {
        whatHappened: `Changed passage status to "${status}"${status === 'gem' ? ' - this is your best material!' : ''}`,
        guiPath: [
          'Click on a passage in the Passages tab',
          'Click the status dropdown (unreviewed/approved/gem/rejected)',
          'Select the new status',
        ],
        shortcut: status === 'gem' ? 'Press "G" while viewing a passage' : undefined,
        why: status === 'gem'
          ? 'Gems are passages with exceptional quality - inflection points, high velocity, tension, or commitment.'
          : 'Curating passages helps you organize material for chapters.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to mark passage',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// IMAGE TOOLS
// ═══════════════════════════════════════════════════════════════════

/**
 * Describe the current workspace image using AI vision
 */
async function executeDescribeImage(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const ws = context.workspace;
  const { imagePath } = params as { imagePath?: string };

  // Use workspace image if no path provided
  const targetPath = imagePath || ws?.selectedMedia?.file_path;

  if (!targetPath) {
    return { success: false, error: 'No image selected in workspace' };
  }

  try {
    const response = await fetch(`${ARCHIVE_SERVER}/api/vision/describe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath: targetPath }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      message: 'Image described',
      data: {
        description: data.description,
        categories: data.categories,
        objects: data.objects,
        scene: data.scene,
        mood: data.mood,
        cached: data.cached,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to describe image',
    };
  }
}

/**
 * Search images by description
 */
async function executeSearchImages(
  params: Record<string, unknown>
): Promise<AUIToolResult> {
  const { query, mode = 'text', limit = 20, source } = params as {
    query?: string;
    mode?: 'text' | 'semantic' | 'hybrid';
    limit?: number;
    source?: string;
  };

  if (!query) {
    return { success: false, error: 'Missing query parameter' };
  }

  try {
    const response = await fetch(`${ARCHIVE_SERVER}/api/vision/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, mode, limit, source }),
    });

    if (!response.ok) {
      throw new Error(`Vision search error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      message: `Found ${data.count || 0} image(s) matching "${query}"`,
      data: {
        results: data.results?.slice(0, 10).map((r: any) => ({
          file_path: r.file_path,
          description: r.description?.slice(0, 100),
          categories: r.categories,
          source: r.source,
        })),
        total: data.count,
        mode,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Image search failed',
    };
  }
}

/**
 * Get category tags for the workspace image
 */
async function executeClassifyImage(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const ws = context.workspace;
  const { imagePath } = params as { imagePath?: string };

  const targetPath = imagePath || ws?.selectedMedia?.file_path;

  if (!targetPath) {
    return { success: false, error: 'No image selected in workspace' };
  }

  try {
    const response = await fetch(`${ARCHIVE_SERVER}/api/vision/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath: targetPath }),
    });

    if (!response.ok) {
      throw new Error(`Vision classify error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      message: `Image classified: ${data.categories?.join(', ') || 'no categories'}`,
      data: {
        categories: data.categories,
        confidence: data.confidence,
        model: data.model,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to classify image',
    };
  }
}

/**
 * Find visually similar images
 */
async function executeFindSimilarImages(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const ws = context.workspace;
  const { imagePath, limit = 10 } = params as {
    imagePath?: string;
    limit?: number;
  };

  const targetPath = imagePath || ws?.selectedMedia?.file_path;

  if (!targetPath) {
    return { success: false, error: 'No image selected or specified' };
  }

  try {
    const response = await fetch(`${ARCHIVE_SERVER}/api/vision/similar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath: targetPath, limit }),
    });

    if (!response.ok) {
      throw new Error(`Similarity search error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      message: `Found ${data.count || 0} similar image(s)`,
      data: {
        results: data.results?.map((r: any) => ({
          file_path: r.file_path,
          description: r.description?.slice(0, 80),
          categories: r.categories,
          similarity: r.similarity,
        })),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Similarity search failed',
    };
  }
}

/**
 * Cluster all archive images by visual similarity
 */
async function executeClusterImages(
  params: Record<string, unknown>
): Promise<AUIToolResult> {
  const { method = 'category', source } = params as {
    method?: 'category' | 'visual';
    source?: string;
  };

  try {
    const response = await fetch(`${ARCHIVE_SERVER}/api/vision/cluster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, source }),
    });

    if (!response.ok) {
      throw new Error(`Clustering error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      message: `Created ${data.count || 0} image cluster(s)`,
      data: {
        clusters: data.clusters?.map((c: any) => ({
          id: c.id,
          name: c.name,
          image_count: c.image_count,
          description: c.description,
        })),
        method: data.method,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Clustering failed',
    };
  }
}

/**
 * Save image + description as a passage to the book
 */
async function executeAddImagePassage(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  if (!context.addPassage) {
    return { success: false, error: 'Passage management not available' };
  }

  const ws = context.workspace;
  const { title, tags } = params as {
    title?: string;
    tags?: string[];
  };

  if (!ws?.selectedMedia) {
    return { success: false, error: 'No image selected in workspace' };
  }

  try {
    // Get image description from vision API
    const descResponse = await fetch(`${ARCHIVE_SERVER}/api/vision/describe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath: ws.selectedMedia.file_path }),
    });

    if (!descResponse.ok) {
      throw new Error('Failed to describe image');
    }

    const { description, categories } = await descResponse.json();

    // Create passage with image markdown and description
    const content = `![${ws.selectedMedia.filename || 'Image'}](${ws.selectedMedia.file_path})

${description || 'No description available.'}

**Categories**: ${categories?.join(', ') || 'uncategorized'}`;

    const passage = context.addPassage({
      content,
      conversationTitle: title || ws.selectedMedia.filename || 'Image',
      tags: tags || categories || ['image'],
    });

    if (!passage) {
      return { success: false, error: 'Failed to add passage' };
    }

    return {
      success: true,
      message: `Added image passage "${passage.conversationTitle}"`,
      data: {
        passageId: passage.id,
        description,
        categories,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to add image passage',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// PERSONA/STYLE TOOLS
// ═══════════════════════════════════════════════════════════════════

/**
 * List available personas
 */
async function executeListPersonas(): Promise<AUIToolResult> {
  try {
    const personas = await getPersonas();

    return {
      success: true,
      message: `Found ${personas.length} persona(s)`,
      data: {
        personas: personas.map(p => ({
          name: p.name,
          description: p.description,
          icon: p.icon,
        })),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to fetch personas',
    };
  }
}

/**
 * List available styles
 */
async function executeListStyles(): Promise<AUIToolResult> {
  try {
    const styles = await getStyles();

    return {
      success: true,
      message: `Found ${styles.length} style(s)`,
      data: {
        styles: styles.map(s => ({
          name: s.name,
          description: s.description,
          icon: s.icon,
        })),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to fetch styles',
    };
  }
}

/**
 * Apply a persona transformation to text
 */
async function executeApplyPersona(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const { persona, text } = params as { persona?: string; text?: string };

  if (!persona) {
    return { success: false, error: 'Missing persona parameter' };
  }

  // Use provided text or workspace content
  let targetText = text;
  if (!targetText && context.workspace) {
    if (context.workspace.selectedContent) {
      targetText = context.workspace.selectedContent.text;
    } else if (context.workspace.bufferContent) {
      targetText = context.workspace.bufferContent;
    }
  }

  if (!targetText) {
    return { success: false, error: 'No text provided and no content in workspace' };
  }

  try {
    const result = await transformPersona(targetText, persona);

    return {
      success: true,
      message: `Transformed with persona "${persona}"`,
      content: result.transformed,
      data: {
        original: targetText.slice(0, 100) + '...',
        transformed: result.transformed,
        modelUsed: result.metadata?.modelUsed,
        improvement: result.metadata?.improvement,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Persona transformation failed',
    };
  }
}

/**
 * Apply a style transformation to text
 */
async function executeApplyStyle(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const { style, text } = params as { style?: string; text?: string };

  if (!style) {
    return { success: false, error: 'Missing style parameter' };
  }

  // Use provided text or workspace content
  let targetText = text;
  if (!targetText && context.workspace) {
    if (context.workspace.selectedContent) {
      targetText = context.workspace.selectedContent.text;
    } else if (context.workspace.bufferContent) {
      targetText = context.workspace.bufferContent;
    }
  }

  if (!targetText) {
    return { success: false, error: 'No text provided and no content in workspace' };
  }

  try {
    const result = await transformStyle(targetText, style);

    return {
      success: true,
      message: `Transformed with style "${style}"`,
      content: result.transformed,
      data: {
        original: targetText.slice(0, 100) + '...',
        transformed: result.transformed,
        modelUsed: result.metadata?.modelUsed,
        improvement: result.metadata?.improvement,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Style transformation failed',
    };
  }
}

/**
 * Extract a persona from sample text using Profile Factory
 */
async function executeExtractPersona(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const { text, name, bookTitle, author } = params as {
    text?: string;
    name?: string;
    bookTitle?: string;
    author?: string;
  };

  // Use provided text or workspace content
  let sampleText = text;
  if (!sampleText && context.workspace) {
    if (context.workspace.selectedContent) {
      sampleText = context.workspace.selectedContent.text;
    } else if (context.workspace.bufferContent) {
      sampleText = context.workspace.bufferContent;
    }
  }

  if (!sampleText) {
    return { success: false, error: 'No text provided and no content in workspace' };
  }

  // Validate text length
  if (sampleText.length < 200) {
    return { success: false, error: 'Text must be at least 200 characters for meaningful extraction' };
  }

  try {
    // Use the new ProfileExtractionService
    const response = await extractPersonaAPI(sampleText, {
      customName: name,
      bookTitle: bookTitle || context.activeProject?.name,
      author: author || context.activeProject?.author,
    });

    // Convert to unified type for storage
    const unifiedPersona = toUnifiedPersona(response, author || 'user');

    return {
      success: true,
      message: `Extracted persona "${response.name}"`,
      data: {
        name: response.name,
        description: response.description,
        attributes: response.attributes,
        system_prompt: response.system_prompt?.slice(0, 200) + '...',
        example_patterns: response.example_patterns?.slice(0, 3),
        unified: unifiedPersona,
      },
      teaching: {
        whatHappened: `Analyzed ${sampleText.split(/\s+/).length} words and extracted a persona profile with voice characteristics, perspective, and tone.`,
        guiPath: ['Studio', 'Transform Panel', 'Extract', 'Persona'],
        why: 'Personas capture WHO is speaking - their perspective, vocabulary, and emotional register. Use this persona to transform other text to sound like this voice.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Persona extraction failed',
    };
  }
}

/**
 * Extract a style from sample text using ProfileExtractionService
 */
async function executeExtractStyle(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const { text, name, bookTitle, author } = params as {
    text?: string;
    name?: string;
    bookTitle?: string;
    author?: string;
  };

  // Use provided text or workspace content
  let sampleText = text;
  if (!sampleText && context.workspace) {
    if (context.workspace.selectedContent) {
      sampleText = context.workspace.selectedContent.text;
    } else if (context.workspace.bufferContent) {
      sampleText = context.workspace.bufferContent;
    }
  }

  if (!sampleText) {
    return { success: false, error: 'No text provided and no content in workspace' };
  }

  // Validate text length
  if (sampleText.length < 200) {
    return { success: false, error: 'Text must be at least 200 characters for meaningful extraction' };
  }

  try {
    // Use the new ProfileExtractionService
    const response = await extractStyleAPI(sampleText, {
      customName: name,
      bookTitle: bookTitle || context.activeProject?.name,
      author: author || context.activeProject?.author,
    });

    // Convert to unified type for storage
    const unifiedStyle = toUnifiedStyle(response, author || 'user');

    return {
      success: true,
      message: `Extracted style "${response.name}"`,
      data: {
        name: response.name,
        attributes: response.attributes,
        style_prompt: response.style_prompt?.slice(0, 200) + '...',
        example_sentences: response.example_sentences?.slice(0, 3),
        unified: unifiedStyle,
      },
      teaching: {
        whatHappened: `Analyzed ${sampleText.split(/\s+/).length} words and extracted a style profile with sentence structure, vocabulary, and rhythm patterns.`,
        guiPath: ['Studio', 'Transform Panel', 'Extract', 'Style'],
        why: 'Styles capture HOW text is written - sentence patterns, vocabulary complexity, and rhetorical devices. Use this style to give any text a consistent feel.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Style extraction failed',
    };
  }
}

/**
 * Auto-discover personas and styles from writing samples using ProfileExtractionService
 */
async function executeDiscoverVoices(
  params: Record<string, unknown>
): Promise<AUIToolResult> {
  const { min_clusters, max_clusters } = params as {
    min_clusters?: number;
    max_clusters?: number;
  };

  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Authentication required for voice discovery' };
    }

    // Use the new ProfileExtractionService
    const data = await discoverVoicesAPI({
      min_clusters: min_clusters || 3,
      max_clusters: max_clusters || 7,
    });

    return {
      success: true,
      message: `Discovered ${data.personas_discovered} persona(s) and ${data.styles_discovered} style(s)`,
      data: {
        personas_discovered: data.personas_discovered,
        styles_discovered: data.styles_discovered,
        total_words_analyzed: data.total_words_analyzed,
        personas: data.personas?.slice(0, 5).map((p) => ({
          name: p.name,
          description: p.description,
        })),
        styles: data.styles?.slice(0, 5).map((s) => ({
          name: s.name,
          description: s.description,
        })),
      },
      teaching: {
        whatHappened: `Analyzed ${data.total_words_analyzed.toLocaleString()} words across your writing samples and clustered them into ${data.personas_discovered} distinct voices.`,
        guiPath: ['Studio', 'Profile', 'Discover Voices'],
        why: 'Voice discovery uses K-means clustering on text embeddings to find patterns in how you write differently in different contexts.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Voice discovery failed',
    };
  }
}

/**
 * Create a custom persona
 */
async function executeCreatePersona(
  params: Record<string, unknown>
): Promise<AUIToolResult> {
  const { name, description, example_texts } = params as {
    name?: string;
    description?: string;
    example_texts?: string[];
  };

  if (!name) {
    return { success: false, error: 'Missing name parameter' };
  }

  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Authentication required to create personas' };
    }

    const response = await fetch(`${NPE_API_BASE}/personal/personas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        description: description || `Custom persona: ${name}`,
        example_texts: example_texts || [],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Creation failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      message: `Created persona "${name}"`,
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Persona creation failed',
    };
  }
}

/**
 * Create a custom style
 */
async function executeCreateStyle(
  params: Record<string, unknown>
): Promise<AUIToolResult> {
  const { name, description, formality_score, complexity_score, tone_markers, example_texts } = params as {
    name?: string;
    description?: string;
    formality_score?: number;
    complexity_score?: number;
    tone_markers?: string[];
    example_texts?: string[];
  };

  if (!name) {
    return { success: false, error: 'Missing name parameter' };
  }

  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Authentication required to create styles' };
    }

    const response = await fetch(`${NPE_API_BASE}/personal/styles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        description: description || `Custom style: ${name}`,
        formality_score: formality_score ?? 0.5,
        complexity_score: complexity_score ?? 0.5,
        tone_markers: tone_markers || [],
        example_texts: example_texts || [],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Creation failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      message: `Created style "${name}"`,
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        formality_score: data.formality_score,
        complexity_score: data.complexity_score,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Style creation failed',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// TEXT TRANSFORMATION TOOLS
// ═══════════════════════════════════════════════════════════════════

/**
 * Humanize AI-generated text
 */
async function executeHumanize(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const { text, intensity, voiceSamples } = params as {
    text?: string;
    intensity?: 'light' | 'moderate' | 'aggressive';
    voiceSamples?: string[];
  };

  // Use provided text or workspace content
  let targetText = text;
  if (!targetText && context.workspace) {
    if (context.workspace.selectedContent) {
      targetText = context.workspace.selectedContent.text;
    } else if (context.workspace.bufferContent) {
      targetText = context.workspace.bufferContent;
    }
  }

  if (!targetText) {
    return { success: false, error: 'No text provided and no content in workspace' };
  }

  try {
    const result = await humanize(targetText, {
      intensity: intensity || 'moderate',
      voiceSamples,
      enableLLMPolish: true,
    });

    return {
      success: true,
      message: `Humanized with ${intensity || 'moderate'} intensity`,
      content: result.transformed,
      data: {
        original: targetText.slice(0, 100) + '...',
        transformed: result.transformed,
        modelUsed: result.metadata?.modelUsed,
        baseline: result.metadata?.baseline,
        final: result.metadata?.final,
        improvement: result.metadata?.improvement,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Humanization failed',
    };
  }
}

/**
 * Detect if text is AI-generated
 */
async function executeDetectAI(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const { text, lite } = params as { text?: string; lite?: boolean };

  // Use provided text or workspace content
  let targetText = text;
  if (!targetText && context.workspace) {
    if (context.workspace.selectedContent) {
      targetText = context.workspace.selectedContent.text;
    } else if (context.workspace.bufferContent) {
      targetText = context.workspace.bufferContent;
    }
  }

  if (!targetText) {
    return { success: false, error: 'No text provided and no content in workspace' };
  }

  try {
    const result: DetectionResponse = lite
      ? await detectAILite(targetText)
      : await detectAI(targetText);

    const verdictText = result.confidence > 0.7
      ? 'Likely AI-generated'
      : result.confidence > 0.4
        ? 'Mixed/uncertain'
        : 'Likely human-written';

    return {
      success: true,
      message: `${verdictText} (${Math.round(result.confidence * 100)}% AI confidence)`,
      data: {
        confidence: result.confidence,
        verdict: result.verdict,
        verdictText,
        method: result.method,
        explanation: result.explanation,
        details: result.details,
        processingTimeMs: result.processingTimeMs,
        textLength: targetText.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'AI detection failed',
    };
  }
}

/**
 * Translate text to another language
 */
async function executeTranslate(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const { text, targetLanguage, sourceLanguage } = params as {
    text?: string;
    targetLanguage?: string;
    sourceLanguage?: string;
  };

  if (!targetLanguage) {
    return { success: false, error: 'Missing targetLanguage parameter (e.g., "Spanish", "French", "Japanese")' };
  }

  // Use provided text or workspace content
  let targetText = text;
  if (!targetText && context.workspace) {
    if (context.workspace.selectedContent) {
      targetText = context.workspace.selectedContent.text;
    } else if (context.workspace.bufferContent) {
      targetText = context.workspace.bufferContent;
    }
  }

  if (!targetText) {
    return { success: false, error: 'No text provided and no content in workspace' };
  }

  try {
    const token = getStoredToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${NPE_API_BASE}/transformations/translate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: targetText,
        target_language: targetLanguage,
        source_language: sourceLanguage,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Translation failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      message: `Translated to ${targetLanguage}`,
      content: data.translated_text,
      data: {
        original: targetText.slice(0, 100) + '...',
        translated: data.translated_text,
        sourceLanguage: data.source_language || sourceLanguage || 'auto-detected',
        targetLanguage: data.target_language || targetLanguage,
        confidence: data.confidence,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Translation failed',
    };
  }
}

/**
 * Analyze text for linguistic features
 */
async function executeAnalyzeText(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const { text } = params as { text?: string };

  // Use provided text or workspace content
  let targetText = text;
  if (!targetText && context.workspace) {
    if (context.workspace.selectedContent) {
      targetText = context.workspace.selectedContent.text;
    } else if (context.workspace.bufferContent) {
      targetText = context.workspace.bufferContent;
    }
  }

  if (!targetText) {
    return { success: false, error: 'No text provided and no content in workspace' };
  }

  try {
    const token = getStoredToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${NPE_API_BASE}/ai-detection/detect-v2/features`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: targetText }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Analysis failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Summarize key findings
    const highlights: string[] = [];
    if (data.burstiness !== undefined) {
      highlights.push(`Burstiness: ${data.burstiness.toFixed(2)} (${data.burstiness > 0.5 ? 'varied' : 'uniform'} sentence lengths)`);
    }
    if (data.vocabulary_diversity !== undefined) {
      highlights.push(`Vocabulary diversity: ${data.vocabulary_diversity.toFixed(2)}`);
    }
    if (data.tell_phrase_count !== undefined && data.tell_phrase_count > 0) {
      highlights.push(`AI tell-phrases detected: ${data.tell_phrase_count}`);
    }

    return {
      success: true,
      message: `Analyzed ${targetText.split(/\s+/).length} words`,
      data: {
        wordCount: targetText.split(/\s+/).filter(w => w).length,
        sentenceCount: targetText.split(/[.!?]+/).filter(s => s.trim()).length,
        burstiness: data.burstiness,
        vocabularyDiversity: data.vocabulary_diversity,
        avgSentenceLength: data.avg_sentence_length,
        tellPhraseCount: data.tell_phrase_count,
        tellPhrases: data.tell_phrases?.slice(0, 5),
        punctuationDensity: data.punctuation_density,
        highlights,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Text analysis failed',
    };
  }
}

/**
 * Quantum reading - sentence-by-sentence tetralemma analysis
 */
async function executeQuantumRead(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const { text, detailed } = params as { text?: string; detailed?: boolean };

  // Use provided text or workspace content
  let targetText = text;
  if (!targetText && context.workspace) {
    if (context.workspace.selectedContent) {
      targetText = context.workspace.selectedContent.text;
    } else if (context.workspace.bufferContent) {
      targetText = context.workspace.bufferContent;
    }
  }

  if (!targetText) {
    return { success: false, error: 'No text provided and no content in workspace' };
  }

  try {
    const result = await analyzeSentences(targetText);

    // Summarize the quantum reading
    const stanceEmoji: Record<string, string> = {
      literal: '📐',
      metaphorical: '🌀',
      both: '⚛️',
      neither: '○',
    };

    const dominantStance = result.overall.dominantStance as keyof typeof stanceEmoji;
    const summary = `${stanceEmoji[dominantStance] || '?'} Dominant: ${dominantStance} | Entropy: ${result.overall.avgEntropy.toFixed(2)} | Purity: ${result.overall.avgPurity.toFixed(2)}`;

    // Create sentence breakdown if detailed
    const sentenceBreakdown = detailed
      ? result.sentences.map(s => ({
          text: s.text.slice(0, 60) + (s.text.length > 60 ? '...' : ''),
          stance: s.dominant,
          emoji: stanceEmoji[s.dominant] || '?',
          tetralemma: {
            L: Math.round(s.tetralemma.literal * 100),
            M: Math.round(s.tetralemma.metaphorical * 100),
            B: Math.round(s.tetralemma.both * 100),
            N: Math.round(s.tetralemma.neither * 100),
          },
        }))
      : undefined;

    return {
      success: true,
      message: summary,
      data: {
        totalSentences: result.overall.totalSentences,
        dominantStance: result.overall.dominantStance,
        avgEntropy: result.overall.avgEntropy,
        avgPurity: result.overall.avgPurity,
        stanceCounts: {
          literal: result.sentences.filter(s => s.dominant === 'literal').length,
          metaphorical: result.sentences.filter(s => s.dominant === 'metaphorical').length,
          both: result.sentences.filter(s => s.dominant === 'both').length,
          neither: result.sentences.filter(s => s.dominant === 'neither').length,
        },
        sentences: sentenceBreakdown,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Quantum reading failed',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// PYRAMID BUILDING TOOLS
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a pyramid from book passages or text
 */
async function executeBuildPyramid(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const { text, usePassages } = params as {
    text?: string;
    usePassages?: boolean;
  };

  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  // Determine source content
  let sourceText = text;

  if (!sourceText && usePassages !== false && context.getPassages) {
    // Build from approved/gem passages
    const passages = context.getPassages();
    const usablePassages = passages.filter(
      p => (p.curation?.status || p.status) === 'gem' || (p.curation?.status || p.status) === 'approved'
    );

    if (usablePassages.length === 0) {
      return {
        success: false,
        error: 'No approved or gem passages to build pyramid from. Mark some passages as approved or gem first.',
      };
    }

    sourceText = usablePassages
      .map(p => p.text || p.content || '')
      .filter(t => t.length > 0)
      .join('\n\n---\n\n');
  }

  // Fall back to workspace content
  if (!sourceText && context.workspace) {
    if (context.workspace.bufferContent) {
      sourceText = context.workspace.bufferContent;
    }
  }

  if (!sourceText) {
    return {
      success: false,
      error: 'No text provided and no passages or workspace content available',
    };
  }

  if (sourceText.length < 500) {
    return {
      success: false,
      error: 'Text must be at least 500 characters for meaningful pyramid building',
    };
  }

  try {
    const result = await buildPyramid(sourceText, {
      sourceInfo: {
        bookTitle: context.activeProject.name,
        author: context.activeProject.author,
      },
      onProgress: (progress) => {
        // Progress could be sent to UI via callback
        console.log(`[Pyramid] ${progress.message}`);
      },
    });

    if (!result.success || !result.pyramid) {
      return {
        success: false,
        error: result.error || 'Pyramid building failed',
      };
    }

    const pyramid = result.pyramid;
    const wordCount = sourceText.split(/\s+/).length;

    return {
      success: true,
      message: `Built ${pyramid.meta.depth}-level pyramid from ${wordCount} words`,
      data: {
        depth: pyramid.meta.depth,
        totalChunks: pyramid.meta.chunkCount,
        totalSummaries: pyramid.summaries.length,
        compressionRatio: pyramid.meta.compressionRatio.toFixed(1),
        apex: pyramid.apex ? {
          summary: pyramid.apex.summary.substring(0, 200) + '...',
          themes: pyramid.apex.themes,
          characters: pyramid.apex.characters,
          arc: pyramid.apex.arc,
          mood: pyramid.apex.mood,
        } : null,
        processingTimeMs: result.stats.processingTimeMs,
      },
      teaching: {
        whatHappened: `Processed ${wordCount} words into ${pyramid.meta.chunkCount} chunks, built ${pyramid.meta.depth} levels of summaries, and extracted ${pyramid.apex?.themes?.length || 0} themes.`,
        guiPath: ['Book Panel', 'Profile Tab', 'Build Pyramid'],
        why: 'Pyramid summarization lets your book "know itself" - the apex contains themes, characters, and arc that can guide editing and help readers understand the work at any level of depth.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Pyramid building failed',
    };
  }
}

/**
 * Get the pyramid structure for the active book
 */
function executeGetPyramid(context: AUIContext): AUIToolResult {
  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  const pyramid = context.activeProject.pyramid;

  if (!pyramid || !pyramid.chunks || pyramid.chunks.length === 0) {
    return {
      success: true,
      message: 'No pyramid built for this book yet',
      data: { hasPyramid: false },
      teaching: {
        whatHappened: 'This book does not have a pyramid structure yet.',
        guiPath: ['Book Panel', 'Profile Tab', 'Build Pyramid'],
        why: 'Use the build_pyramid tool to create one from your passages or provide text directly.',
      },
    };
  }

  const apex = pyramid.apex;

  return {
    success: true,
    message: `${pyramid.chunks.length} chunks, ${pyramid.summaries?.length || 0} summaries, ${apex ? 'apex complete' : 'no apex'}`,
    data: {
      hasPyramid: true,
      depth: (pyramid.summaries?.reduce((max, s) => Math.max(max, s.level), 0) || 0) + 1,
      chunkCount: pyramid.chunks.length,
      summaryCount: pyramid.summaries?.length || 0,
      hasApex: !!apex,
      apex: apex ? {
        summary: apex.summary?.substring(0, 300),
        themes: apex.themes,
        characters: apex.characters,
        arc: apex.arc,
        mood: apex.mood,
        generatedAt: apex.generatedAt,
      } : null,
      levels: (() => {
        const levels: Array<{ level: number; count: number; avgWords: number }> = [];
        // L0 - chunks
        const chunkWords = pyramid.chunks.map(c => c.wordCount || 0);
        levels.push({
          level: 0,
          count: pyramid.chunks.length,
          avgWords: Math.round(chunkWords.reduce((a, b) => a + b, 0) / chunkWords.length || 0),
        });
        // L1+ - summaries
        const maxLevel = pyramid.summaries?.reduce((max, s) => Math.max(max, s.level), 0) || 0;
        for (let l = 1; l <= maxLevel; l++) {
          const levelSummaries = pyramid.summaries?.filter(s => s.level === l) || [];
          const words = levelSummaries.map(s => s.wordCount || 0);
          levels.push({
            level: l,
            count: levelSummaries.length,
            avgWords: Math.round(words.reduce((a, b) => a + b, 0) / words.length || 0),
          });
        }
        return levels;
      })(),
    },
    teaching: {
      whatHappened: `This book has a ${pyramid.chunks.length}-chunk pyramid with ${apex ? 'a complete apex' : 'no apex yet'}.`,
      guiPath: ['Book Panel', 'Profile Tab'],
      why: 'The pyramid lets you understand the book at any level of detail - from individual passages up to the complete thematic summary.',
    },
  };
}

/**
 * Search within the pyramid's chunks
 */
function executeSearchPyramid(
  params: Record<string, unknown>,
  context: AUIContext
): AUIToolResult {
  const { query, limit = 5 } = params as { query?: string; limit?: number };

  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  if (!query) {
    return { success: false, error: 'Missing query parameter' };
  }

  const pyramid = context.activeProject.pyramid;

  if (!pyramid || !pyramid.chunks || pyramid.chunks.length === 0) {
    return {
      success: false,
      error: 'No pyramid built for this book. Use build_pyramid first.',
    };
  }

  try {
    // Create a temporary pyramid structure for the search function
    const pyramidStructure = {
      chunks: pyramid.chunks,
      summaries: pyramid.summaries || [],
      apex: pyramid.apex,
      meta: {
        depth: (pyramid.summaries?.reduce((max, s) => Math.max(max, s.level), 0) || 0) + 1,
        chunkCount: pyramid.chunks.length,
        sourceWordCount: pyramid.chunks.reduce((sum, c) => sum + (c.wordCount || 0), 0),
        compressionRatio: 1,
        builtAt: pyramid.apex?.generatedAt || Date.now(),
        config: {
          chunkSize: 300,
          compressionTarget: 5,
          summarizerModel: 'haiku',
          extractorModel: 'sonnet',
          computeEmbeddings: false,
        },
      },
    };

    const results = searchChunks(pyramidStructure, query, { limit });

    return {
      success: true,
      message: `Found ${results.length} matching chunk(s) for "${query}"`,
      data: {
        query,
        results: results.map(r => ({
          chunkId: r.chunk.id,
          index: r.chunk.index,
          score: r.score.toFixed(3),
          preview: r.chunk.content.substring(0, 150) + '...',
          wordCount: r.chunk.wordCount,
        })),
      },
      teaching: {
        whatHappened: `Searched ${pyramid.chunks.length} chunks and found ${results.length} matches for "${query}".`,
        guiPath: ['Book Panel', 'Profile Tab', 'Search Pyramid'],
        why: 'Searching the pyramid helps you find specific passages within the hierarchical structure of your book.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Pyramid search failed',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONVERSATION & HARVESTING TOOLS
// ═══════════════════════════════════════════════════════════════════

/**
 * List conversations from the archive
 */
async function executeListConversations(
  params: Record<string, unknown>
): Promise<AUIToolResult> {
  const { limit = 20, search, hasImages } = params as {
    limit?: number;
    search?: string;
    hasImages?: boolean;
  };

  try {
    // Build query params
    const queryParams = new URLSearchParams();
    queryParams.set('limit', String(limit));
    if (search) queryParams.set('search', search);
    if (hasImages !== undefined) queryParams.set('hasImages', String(hasImages));

    const response = await fetch(`${ARCHIVE_SERVER}/api/conversations?${queryParams}`);

    if (!response.ok) {
      return { success: false, error: 'Failed to fetch conversations' };
    }

    const data = await response.json();
    const conversations = data.conversations || [];

    return {
      success: true,
      message: `Found ${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`,
      data: {
        conversations: conversations.slice(0, limit).map((c: {
          id: string;
          title: string;
          folder?: string;
          message_count?: number;
          created_at?: number;
          updated_at?: number;
        }) => ({
          id: c.id,
          title: c.title || 'Untitled',
          folder: c.folder,
          messageCount: c.message_count,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        })),
        total: data.total || conversations.length,
      },
      teaching: {
        whatHappened: `Listed ${conversations.length} conversations from your ChatGPT archive${search ? ` matching "${search}"` : ''}`,
        guiPath: [
          'Click Archive panel (left side)',
          'Select "Conversations" tab',
          search ? `Use search box to filter by "${search}"` : 'Browse the full list',
        ],
        why: 'Your archive contains your AI conversation history - the raw material for your book.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to list conversations',
    };
  }
}

/**
 * Harvest passages from archive into the active book project
 * Combines search + auto-add to bookshelf
 */
async function executeHarvestArchive(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const { query, limit = 10, minSimilarity = 0.6 } = params as {
    query?: string;
    limit?: number;
    minSimilarity?: number;
  };

  if (!query) {
    return { success: false, error: 'Missing query parameter' };
  }

  if (!context.activeProject) {
    return { success: false, error: 'No active book project. Select a book first.' };
  }

  if (!context.addPassage) {
    return { success: false, error: 'Passage operations not available' };
  }

  try {
    // First, search the archive
    const response = await fetch(`${ARCHIVE_SERVER}/api/embeddings/search/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: limit * 2 }), // Get more, filter by similarity
    });

    if (!response.ok) {
      return { success: false, error: 'Archive search failed' };
    }

    const data = await response.json();
    const results = (data.results || []).filter(
      (r: { similarity: number }) => r.similarity >= minSimilarity
    ).slice(0, limit);

    if (results.length === 0) {
      return {
        success: true,
        message: `No passages found matching "${query}" with similarity >= ${minSimilarity}`,
        data: { harvested: 0 },
        teaching: {
          whatHappened: 'Search found no results meeting your similarity threshold.',
          guiPath: ['Archive Panel', 'Explore Tab', 'Semantic Search'],
          why: 'Try a different query or lower the similarity threshold.',
        },
      };
    }

    // Add each result as a passage to the book
    const addedPassages: Array<{ id: string; content: string; similarity: number }> = [];

    for (const result of results as Array<{
      content: string;
      conversation_id: string;
      role: string;
      similarity: number;
    }>) {
      const passage = context.addPassage({
        content: result.content,
        conversationId: result.conversation_id,
        conversationTitle: `Harvested: ${query}`,
        role: (result.role as 'user' | 'assistant') || 'assistant',
        tags: ['harvested', query.split(' ')[0]],
      });

      if (passage) {
        addedPassages.push({
          id: passage.id,
          content: result.content.substring(0, 100) + '...',
          similarity: result.similarity,
        });
      }
    }

    return {
      success: true,
      message: `Harvested ${addedPassages.length} passages for "${query}"`,
      data: {
        harvested: addedPassages.length,
        passages: addedPassages,
        query,
        minSimilarity,
      },
      teaching: {
        whatHappened: `Found ${results.length} semantically relevant passages and added ${addedPassages.length} to your bookshelf`,
        guiPath: [
          'Archive Panel → Explore Tab → Semantic Search',
          'Select passages you want',
          'Click "Add to Bookshelf"',
        ],
        why: 'Harvesting brings relevant content from your archive into your book project for curation.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Harvest failed',
    };
  }
}

/**
 * Generate a first draft chapter from approved passages
 */
async function executeGenerateFirstDraft(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const { chapterTitle, passageIds, style } = params as {
    chapterTitle?: string;
    passageIds?: string[];
    style?: string;
  };

  if (!chapterTitle) {
    return { success: false, error: 'Missing chapterTitle parameter' };
  }

  if (!context.activeProject) {
    return { success: false, error: 'No active book project' };
  }

  if (!context.getPassages || !context.createChapter) {
    return { success: false, error: 'Book operations not available' };
  }

  try {
    // Get passages - either specified or approved/gem passages
    const allPassages = context.getPassages();
    let sourcePas: SourcePassage[];

    if (passageIds && passageIds.length > 0) {
      sourcePas = allPassages.filter(p => passageIds.includes(p.id));
    } else {
      // Use approved or gem passages
      sourcePas = allPassages.filter(
        p => p.curation?.status === 'approved' || p.curation?.status === 'gem'
      );
    }

    if (sourcePas.length === 0) {
      return {
        success: false,
        error: 'No passages available. Add some passages to the bookshelf and mark them as approved or gem first.',
      };
    }

    // Collect passage content
    const passageContent = sourcePas
      .map((p, i) => `[Passage ${i + 1}]\n${p.content}`)
      .join('\n\n---\n\n');

    // Build prompt for draft generation
    const prompt = `You are writing a chapter titled "${chapterTitle}" for a book.
${style ? `Write in the style: ${style}` : ''}

Use the following passages as source material. Weave them together into a coherent chapter.
Preserve the key ideas but improve flow. Add transitions where needed.
Do not use meta-commentary - just write the chapter content.

=== SOURCE PASSAGES ===
${passageContent}
=== END PASSAGES ===

Write the chapter now:`;

    // Call LLM via the npe-api
    const token = await getStoredToken();
    const llmResponse = await fetch(`${NPE_API_BASE}/transform/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        prompt,
        maxTokens: 2000,
        model: 'haiku', // Fast for drafts
      }),
    });

    if (!llmResponse.ok) {
      // Fallback: just concatenate passages
      const fallbackContent = `# ${chapterTitle}\n\n${sourcePas.map(p => p.content).join('\n\n')}`;

      const chapter = context.createChapter(chapterTitle, fallbackContent);
      if (!chapter) {
        return { success: false, error: 'Failed to create chapter' };
      }

      return {
        success: true,
        message: `Created draft chapter "${chapterTitle}" (passages concatenated - LLM unavailable)`,
        data: {
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          wordCount: chapter.wordCount,
          passageCount: sourcePas.length,
          mode: 'fallback',
        },
        teaching: {
          whatHappened: `Created chapter from ${sourcePas.length} passages (LLM generation unavailable, used concatenation)`,
          guiPath: ['Book Panel', 'Chapters', chapter.title],
          why: 'The chapter was created from your source material. Edit it to improve flow and add transitions.',
        },
      };
    }

    const llmData = await llmResponse.json();
    const generatedContent = llmData.text || llmData.content || '';

    // Create the chapter with generated content
    const fullContent = `# ${chapterTitle}\n\n${generatedContent}`;
    const chapter = context.createChapter(chapterTitle, fullContent);

    if (!chapter) {
      return { success: false, error: 'Failed to create chapter' };
    }

    return {
      success: true,
      message: `Created draft chapter "${chapterTitle}" from ${sourcePas.length} passages`,
      data: {
        chapterId: chapter.id,
        chapterNumber: chapter.number,
        wordCount: chapter.wordCount,
        passageCount: sourcePas.length,
        mode: 'generated',
      },
      teaching: {
        whatHappened: `Wove ${sourcePas.length} passages into a ${chapter.wordCount}-word chapter draft`,
        guiPath: ['Book Panel', 'Chapters', chapter.title, 'Edit'],
        why: 'First drafts are starting points. Review, revise, and refine to make it yours.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Draft generation failed',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// AGENT TOOLS
// ═══════════════════════════════════════════════════════════════════

/**
 * List available agents in the council
 */
function executeListAgents(): AUIToolResult {
  try {
    const bridge = getAgentBridge();
    const agents = bridge.getAgents();
    const isConnected = bridge.isConnected();

    if (!isConnected) {
      return {
        success: true,
        message: 'Agent council not connected (running in standalone mode)',
        data: { connected: false, agents: [] },
      };
    }

    const statusEmoji: Record<string, string> = {
      idle: '🟢',
      working: '🔵',
      waiting: '🟡',
      error: '🔴',
      disabled: '⚫',
    };

    return {
      success: true,
      message: `${agents.length} agent(s) available`,
      data: {
        connected: true,
        agents: agents.map(a => ({
          id: a.id,
          name: a.name,
          house: a.house,
          status: `${statusEmoji[a.status] || '?'} ${a.status}`,
          capabilities: a.capabilities,
        })),
      },
      teaching: {
        whatHappened: `Found ${agents.length} agents in the council`,
        guiPath: ['Settings', 'Agent Council', 'View Agents'],
        why: 'Agents assist with harvesting, curating, building, and reviewing your book content.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to list agents',
    };
  }
}

/**
 * Get status of a specific agent
 */
function executeGetAgentStatus(params: Record<string, unknown>): AUIToolResult {
  const { agentId } = params as { agentId?: string };

  if (!agentId) {
    return { success: false, error: 'Missing agentId parameter' };
  }

  try {
    const bridge = getAgentBridge();
    const agents = bridge.getAgents();
    const agent = agents.find(a => a.id === agentId);

    if (!agent) {
      return {
        success: false,
        error: `Agent not found: ${agentId}. Available: ${agents.map(a => a.id).join(', ')}`,
      };
    }

    const statusEmoji: Record<string, string> = {
      idle: '🟢 Ready',
      working: '🔵 Working',
      waiting: '🟡 Waiting for approval',
      error: '🔴 Error',
      disabled: '⚫ Disabled',
    };

    return {
      success: true,
      message: `${agent.name}: ${statusEmoji[agent.status] || agent.status}`,
      data: {
        id: agent.id,
        name: agent.name,
        house: agent.house,
        status: agent.status,
        statusDescription: statusEmoji[agent.status] || agent.status,
        capabilities: agent.capabilities,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to get agent status',
    };
  }
}

/**
 * List pending proposals from agents
 */
function executeListPendingProposals(): AUIToolResult {
  try {
    const bridge = getAgentBridge();
    const proposals = bridge.getPendingProposals();

    if (proposals.length === 0) {
      return {
        success: true,
        message: 'No pending agent proposals',
        data: { proposals: [] },
      };
    }

    const urgencyEmoji: Record<string, string> = {
      low: '📋',
      normal: '📝',
      high: '⚡',
      critical: '🚨',
    };

    return {
      success: true,
      message: `${proposals.length} pending proposal(s)`,
      data: {
        proposals: proposals.map(p => ({
          id: p.id,
          agent: p.agentName,
          urgency: `${urgencyEmoji[p.urgency] || ''} ${p.urgency}`,
          action: p.actionType,
          title: p.title,
          description: p.description,
          createdAt: new Date(p.createdAt).toLocaleTimeString(),
          expiresAt: p.expiresAt ? new Date(p.expiresAt).toLocaleTimeString() : null,
        })),
      },
      teaching: {
        whatHappened: `Found ${proposals.length} proposals awaiting your decision`,
        guiPath: ['AUI Chat', 'View proposal', 'Approve or Reject'],
        why: 'Agents propose actions that may need your approval. Review and approve to let them proceed.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to list proposals',
    };
  }
}

/**
 * Request work from a specific agent
 */
async function executeRequestAgent(params: Record<string, unknown>): Promise<AUIToolResult> {
  const { agentId, taskType, payload, projectId } = params as {
    agentId?: string;
    taskType?: string;
    payload?: Record<string, unknown>;
    projectId?: string;
  };

  if (!agentId) {
    return { success: false, error: 'Missing agentId parameter' };
  }

  if (!taskType) {
    return { success: false, error: 'Missing taskType parameter' };
  }

  try {
    const bridge = getAgentBridge();

    // Verify agent exists
    const agents = bridge.getAgents();
    const agent = agents.find(a => a.id === agentId);

    if (!agent) {
      return {
        success: false,
        error: `Agent not found: ${agentId}. Available: ${agents.map(a => a.id).join(', ')}`,
      };
    }

    // Request work
    const result = await bridge.requestAgentWork(agentId, taskType, payload || {}, projectId);

    if ('error' in result) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      message: `Requested ${taskType} from ${agent.name}`,
      data: {
        taskId: result.taskId,
        agent: agentId,
        taskType,
      },
      teaching: {
        whatHappened: `Dispatched a "${taskType}" task to ${agent.name}`,
        guiPath: ['AUI Chat', 'View pending proposals', 'Approve when ready'],
        why: 'The agent will work on your request and may propose actions for your approval.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to request agent work',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// WORKFLOW TOOLS
// ═══════════════════════════════════════════════════════════════════

/**
 * Passage reference within a discovered thread
 */
interface ThreadPassage {
  /** Passage ID */
  id: string;
  /** Preview text (first 100 chars) */
  text: string;
  /** Jaccard similarity to the thread theme (0.0 to 1.0) */
  similarity: number;
}

/**
 * A thematic thread discovered from passage analysis
 */
interface DiscoveredThread {
  /** Theme keyword (capitalized) */
  theme: string;
  /** Passages belonging to this thread */
  passages: ThreadPassage[];
}

/**
 * Discover thematic threads in passages using AI clustering
 * Groups similar passages together to reveal common themes
 */
async function executeDiscoverThreads(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const { minPassages, maxThreads } = params as {
    minPassages?: number;
    maxThreads?: number;
  };

  // Get passages from book context
  if (!context.activeProject) {
    return {
      success: false,
      error: 'No active book project. Open a book project first.',
    };
  }

  const passages = context.getPassages?.() || [];
  if (passages.length < 3) {
    return {
      success: false,
      error: `Need at least 3 passages to discover threads. Currently have ${passages.length}.`,
    };
  }

  try {
    // Group passages by similarity using simple text clustering
    // In a full implementation, this would use embeddings
    const threads: DiscoveredThread[] = [];

    // Simple keyword extraction and grouping
    const keywordMap = new Map<string, string[]>();
    const passageKeywords = new Map<string, string[]>();

    // Extract keywords from each passage
    for (const passage of passages) {
      const text = typeof passage.content === 'string' ? passage.content : JSON.stringify(passage.content);
      // Simple keyword extraction (words 5+ chars, not common words)
      const commonWords = new Set(['about', 'which', 'their', 'there', 'would', 'could', 'should', 'where', 'these', 'those', 'being', 'having', 'making', 'during', 'through']);
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w: string) => w.length >= 5 && !commonWords.has(w));

      // Count word frequency
      const wordFreq = new Map<string, number>();
      for (const word of words) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }

      // Top keywords for this passage
      const topKeywords = Array.from(wordFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([w]) => w);

      passageKeywords.set(passage.id, topKeywords);

      // Build global keyword → passage mapping
      for (const kw of topKeywords) {
        if (!keywordMap.has(kw)) {
          keywordMap.set(kw, []);
        }
        keywordMap.get(kw)!.push(passage.id);
      }
    }

    // Find keywords that appear in multiple passages (themes)
    const themeKeywords = Array.from(keywordMap.entries())
      .filter(([, ids]) => ids.length >= (minPassages || 2))
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, maxThreads || 5);

    // Build threads from theme keywords
    const usedPassages = new Set<string>();
    for (const [theme, passageIds] of themeKeywords) {
      if (threads.length >= (maxThreads || 5)) break;

      const threadPassages = passageIds
        .filter((id: string) => !usedPassages.has(id))
        .map((id: string) => {
          const p = passages.find((p: SourcePassage) => p.id === id);
          if (!p) return null;
          usedPassages.add(id);

          // Calculate Jaccard similarity: how many of this passage's keywords match the theme
          const pKeywords = passageKeywords.get(id) || [];
          const matchingKeywords = pKeywords.filter((kw: string) => kw === theme.toLowerCase());
          const totalKeywords = Math.max(pKeywords.length, 1);
          const similarity = matchingKeywords.length / totalKeywords;

          return {
            id: p.id,
            text: (typeof p.content === 'string' ? p.content : '').slice(0, 100) + '...',
            similarity: Math.round(similarity * 100) / 100, // 0.0 to 1.0
          };
        })
        .filter(Boolean) as ThreadPassage[];

      if (threadPassages.length >= (minPassages || 2)) {
        threads.push({
          theme: theme.charAt(0).toUpperCase() + theme.slice(1),
          passages: threadPassages,
        });
      }
    }

    // Group remaining unclustered passages
    const unclustered = passages
      .filter((p: SourcePassage) => !usedPassages.has(p.id))
      .map((p: SourcePassage) => ({
        id: p.id,
        text: (typeof p.content === 'string' ? p.content : '').slice(0, 100) + '...',
      }));

    return {
      success: true,
      message: `Discovered ${threads.length} thematic threads from ${passages.length} passages`,
      data: {
        totalPassages: passages.length,
        threadCount: threads.length,
        threads: threads.map(t => ({
          theme: t.theme,
          passageCount: t.passages.length,
          previewPassages: t.passages.slice(0, 3),
        })),
        unclusteredCount: unclustered.length,
        unclustered: unclustered.slice(0, 5),
      },
      teaching: {
        whatHappened: `Analyzed ${passages.length} passages and found ${threads.length} common themes`,
        guiPath: ['Bookshelf', 'Threads', 'Review grouped passages'],
        why: 'Discovering threads helps you see patterns in your collected material and organize chapters around themes.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Thread discovery failed',
    };
  }
}

/**
 * Start a guided book-building workflow
 * Orchestrates multiple agents to help build a book step by step
 */
async function executeStartBookWorkflow(
  params: Record<string, unknown>,
  context: AUIContext
): Promise<AUIToolResult> {
  const { workflowType, topic } = params as {
    workflowType?: 'harvest' | 'curate' | 'build' | 'full';
    topic?: string;
  };

  if (!context.activeProject) {
    return {
      success: false,
      error: 'No active book project. Create or open a book project first.',
    };
  }

  const workflow = workflowType || 'full';
  const projectTitle = context.activeProject.name || 'Untitled Book';

  try {
    // Define workflow steps based on type
    const steps: Array<{
      name: string;
      agentId: string;
      taskType: string;
      description: string;
    }> = [];

    switch (workflow) {
      case 'harvest':
        steps.push({
          name: 'Search Archive',
          agentId: 'harvester',
          taskType: 'search-archive',
          description: `Search for passages about "${topic || 'your topic'}"`,
        });
        break;

      case 'curate':
        steps.push({
          name: 'Assess Quality',
          agentId: 'curator',
          taskType: 'assess-passages',
          description: 'Review passages for book-worthiness',
        });
        steps.push({
          name: 'Organize Content',
          agentId: 'curator',
          taskType: 'organize-passages',
          description: 'Group passages by theme',
        });
        break;

      case 'build':
        steps.push({
          name: 'Discover Threads',
          agentId: 'builder',
          taskType: 'discover-threads',
          description: 'Find thematic patterns',
        });
        steps.push({
          name: 'Compose Chapters',
          agentId: 'builder',
          taskType: 'compose-chapter',
          description: 'Draft chapters from passages',
        });
        break;

      case 'full':
      default:
        steps.push({
          name: 'Harvest',
          agentId: 'harvester',
          taskType: 'search-archive',
          description: `Search for passages about "${topic || 'your topic'}"`,
        });
        steps.push({
          name: 'Curate',
          agentId: 'curator',
          taskType: 'assess-passages',
          description: 'Review and approve passages',
        });
        steps.push({
          name: 'Build Pyramid',
          agentId: 'builder',
          taskType: 'build-pyramid',
          description: 'Create hierarchical summary',
        });
        steps.push({
          name: 'Compose',
          agentId: 'builder',
          taskType: 'compose-chapter',
          description: 'Draft chapters from approved content',
        });
        steps.push({
          name: 'Review',
          agentId: 'reviewer',
          taskType: 'review-content',
          description: 'Check AI detection and quality',
        });
        break;
    }

    // Get current status
    const allPassages = context.getPassages?.() || [];
    const passageCount = allPassages.length;
    const approvedCount = allPassages.filter(
      (p: SourcePassage) => p.status === 'approved' || p.status === 'gem'
    ).length;
    const chapterCount = context.activeProject?.chapters?.length || 0;

    return {
      success: true,
      message: `Starting ${workflow} workflow for "${projectTitle}"`,
      data: {
        workflowType: workflow,
        project: projectTitle,
        currentState: {
          passages: passageCount,
          approved: approvedCount,
          chapters: chapterCount,
        },
        steps: steps.map((s, i) => ({
          step: i + 1,
          name: s.name,
          agent: s.agentId,
          description: s.description,
          status: 'pending',
        })),
        nextAction: steps[0]
          ? `First, the ${steps[0].agentId} will ${steps[0].description.toLowerCase()}`
          : 'No steps defined',
      },
      teaching: {
        whatHappened: `Initialized the "${workflow}" workflow with ${steps.length} steps`,
        guiPath: ['AUI Chat', 'Follow prompts', 'Approve agent proposals'],
        why: 'Guided workflows break complex tasks into manageable steps. Each agent specializes in a part of the process.',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to start workflow',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════

export const AUI_BOOK_SYSTEM_PROMPT = `
## Book Project & Archive Capabilities

You can help users with their book projects, search their archives, and curate content. You have REAL tools that work.

### How It Works:
1. When user asks for something, explain what you'll do
2. Execute with USE_TOOL
3. Report the result

---

## CHAPTER TOOLS

1. **update_chapter** - Save content to a chapter (creates new version)
   \`USE_TOOL(update_chapter, {"chapterId": "ch-1", "content": "# Chapter content...", "changes": "Added introduction"})\`

2. **create_chapter** - Create a new chapter
   \`USE_TOOL(create_chapter, {"title": "The Beginning", "content": "Optional initial content"})\`

3. **delete_chapter** - Delete a chapter
   \`USE_TOOL(delete_chapter, {"chapterId": "ch-1"})\`

4. **render_book** - Compile all chapters into full book preview
   \`USE_TOOL(render_book, {})\`

5. **list_chapters** - Show all chapters in current project
   \`USE_TOOL(list_chapters, {})\`

6. **get_chapter** - Get a specific chapter's content
   \`USE_TOOL(get_chapter, {"chapterId": "ch-1"})\`

---

## WORKSPACE TOOLS

7. **get_workspace** - See what's currently displayed in the workspace
   \`USE_TOOL(get_workspace, {})\`
   Returns: current view mode, buffer content preview, selected media/content info

8. **save_to_chapter** - Save current workspace content to a chapter
   \`USE_TOOL(save_to_chapter, {"chapterId": "ch-1", "append": false})\`
   - If append=true, adds to end of chapter with separator
   - If append=false (default), replaces chapter content

---

## ARCHIVE SEARCH TOOLS

9. **search_archive** - Search ChatGPT conversations (semantic or text search)
   \`USE_TOOL(search_archive, {"query": "phenomenology of perception", "limit": 10})\`
   Returns: matching messages or conversations with previews

10. **search_facebook** - Search Facebook posts and comments
    \`USE_TOOL(search_facebook, {"query": "family gathering", "type": "post", "limit": 20})\`
    - type: "post", "comment", or "all"

11. **list_conversations** - List all conversations from ChatGPT archive
    \`USE_TOOL(list_conversations, {"limit": 20, "search": "philosophy"})\`
    - Returns: conversation list with titles, message counts, dates
    - Opens Archive panel to show results

12. **harvest_archive** - Search and auto-add passages to bookshelf
    \`USE_TOOL(harvest_archive, {"query": "consciousness", "limit": 10, "minSimilarity": 0.6})\`
    - Combines semantic search + passage adding
    - Great for quickly populating a book project

---

## PASSAGE MANAGEMENT TOOLS

13. **add_passage** - Add content to the book's passage library
    \`USE_TOOL(add_passage, {"text": "The text...", "title": "Title", "tags": ["phenomenology", "husserl"]})\`
    - If no text provided, uses current workspace content
    - tags: categorization tags for the passage

14. **list_passages** - Show all passages organized by tags
    \`USE_TOOL(list_passages, {})\`
    Returns: passages grouped by tag with curation status

15. **mark_passage** - Curate a passage (gem/approved/rejected)
    \`USE_TOOL(mark_passage, {"passageId": "p-123", "status": "gem", "notes": "Perfect opening"})\`
    - status: "unreviewed", "approved", "gem", "rejected"

---

## IMAGE TOOLS

These tools let you analyze, search, and curate images in the archive.

14. **describe_image** - Get AI description of workspace image
    \`USE_TOOL(describe_image, {})\`
    - Uses the image currently displayed in the workspace
    - Returns: description, categories, objects, scene, mood

15. **search_images** - Search images by description
    \`USE_TOOL(search_images, {"query": "family gathering outdoors", "mode": "text", "limit": 10})\`
    - mode: "text" (description match), "semantic" (meaning), "hybrid" (both)
    - Returns: matching images with descriptions and categories

16. **classify_image** - Get category tags for workspace image
    \`USE_TOOL(classify_image, {})\`
    - Returns: category tags (person, landscape, screenshot, etc.)

17. **find_similar_images** - Find visually similar images
    \`USE_TOOL(find_similar_images, {"limit": 10})\`
    - Uses the current workspace image to find similar ones
    - Returns: images with similarity scores

18. **cluster_images** - Group all archive images by visual similarity
    \`USE_TOOL(cluster_images, {"method": "category"})\`
    - method: "category" (group by type)
    - Returns: clusters with image counts

19. **add_image_passage** - Save image + description to book
    \`USE_TOOL(add_image_passage, {"title": "Family Photo", "tags": ["family", "2024"]})\`
    - Adds current workspace image as a passage with AI description

---

## PERSONA & STYLE TOOLS

These tools let you analyze writing voices, apply transformations, and manage personas/styles.

**Understanding Personas vs Styles:**
- **Personas** = WHO perceives (epistemic/perceptual layer - worldview, attention, values, reader relationship)
- **Styles** = HOW they write (mechanical/aesthetic layer - sentence structure, formality, vocabulary, rhythm)

20. **list_personas** - List available personas
    \`USE_TOOL(list_personas, {})\`
    - Returns: persona names, descriptions, and icons

21. **list_styles** - List available styles
    \`USE_TOOL(list_styles, {})\`
    - Returns: style names, descriptions, and icons

22. **apply_persona** - Transform text through a persona's perspective
    \`USE_TOOL(apply_persona, {"persona": "Academic", "text": "Optional - uses workspace if omitted"})\`
    - Changes narrative distance, affective tone, rhetorical stance
    - Preserves content, setting, and mechanical style

23. **apply_style** - Transform text with a writing style
    \`USE_TOOL(apply_style, {"style": "Concise", "text": "Optional - uses workspace if omitted"})\`
    - Changes sentence structure, formality, lexical choices
    - Preserves content and narrative voice

24. **extract_persona** - Extract a persona from sample text
    \`USE_TOOL(extract_persona, {"name": "My Writing Voice"})\`
    - Uses workspace content or provided text
    - Returns: name, description, attributes, system prompt
    - Pro+ tier required

25. **extract_style** - Extract a style from sample text
    \`USE_TOOL(extract_style, {"name": "My Style"})\`
    - Uses workspace content or provided text
    - Returns: name, description, style prompt, example sentences
    - Pro+ tier required

26. **discover_voices** - Auto-discover personas and styles from your writing
    \`USE_TOOL(discover_voices, {"min_clusters": 3, "max_clusters": 7})\`
    - Analyzes your archive to find distinct writing voices
    - Uses K-means clustering on linguistic features
    - Returns: discovered personas and styles with descriptions

27. **create_persona** - Create a custom persona
    \`USE_TOOL(create_persona, {"name": "Skeptical Reader", "description": "Questions everything, demands evidence"})\`
    - Optional: example_texts for better characterization

28. **create_style** - Create a custom style
    \`USE_TOOL(create_style, {"name": "Punchy", "description": "Short sentences. Direct. No fluff."})\`
    - Optional: formality_score (0-1), complexity_score (0-1), tone_markers, example_texts

---

## TEXT TRANSFORMATION TOOLS

These tools analyze and transform text content.

29. **humanize** - Transform AI-generated text to sound more human
    \`USE_TOOL(humanize, {"intensity": "moderate"})\`
    - Uses workspace content if no text provided
    - intensity: "light", "moderate", or "aggressive"
    - Optional: voiceSamples (array of text samples to match your voice)
    - Returns: humanized text with improvement metrics

30. **detect_ai** - Check if text sounds AI-generated
    \`USE_TOOL(detect_ai, {"lite": false})\`
    - Uses workspace content if no text provided
    - lite: true for free-tier detection (no GPTZero)
    - Returns: AI probability, verdict, burstiness, features

31. **translate** - Translate text to another language
    \`USE_TOOL(translate, {"targetLanguage": "Spanish"})\`
    - Uses workspace content if no text provided
    - Supports 40+ languages including Latin, Ancient Greek
    - Optional: sourceLanguage (auto-detects if omitted)
    - Returns: translated text with confidence

32. **analyze_text** - Get linguistic feature analysis
    \`USE_TOOL(analyze_text, {})\`
    - Uses workspace content if no text provided
    - Returns: burstiness, vocabulary diversity, sentence stats
    - Detects AI "tell-phrases" that reveal machine origin

33. **quantum_read** - Sentence-level tetralemma analysis
    \`USE_TOOL(quantum_read, {"detailed": true})\`
    - Measures each sentence on literal/metaphorical/both/neither axes
    - Returns: dominant stance, entropy, purity scores
    - detailed: true to get per-sentence breakdown
    - Uses quantum-inspired measurement model

---

## PYRAMID BUILDING TOOLS

These tools create and query the hierarchical pyramid structure for a book.
The pyramid enables "knowing" a book at any level of detail.

34. **build_pyramid** - Build a pyramid from book passages or text
    \`USE_TOOL(build_pyramid, {"usePassages": true})\`
    - Uses approved/gem passages from the book by default
    - Or provide text directly: \`{"text": "Your book content..."}\`
    - Creates chunks (~300 words each), summaries at each level, and an apex
    - Apex contains: themes, characters, arc, mood
    - Returns: pyramid structure with stats

35. **get_pyramid** - Get the pyramid structure for the active book
    \`USE_TOOL(get_pyramid, {})\`
    - Shows pyramid depth, chunk count, summary count
    - Returns apex summary, themes, characters if available
    - Shows statistics per level (count, avg words)

36. **search_pyramid** - Search within the pyramid's chunks
    \`USE_TOOL(search_pyramid, {"query": "phenomenology", "limit": 5})\`
    - Searches L0 chunks by content matching
    - Returns: matching chunks with previews and scores
    - Use this to find specific passages in the hierarchical structure

37. **generate_first_draft** - Create a chapter from approved passages
    \`USE_TOOL(generate_first_draft, {"chapterTitle": "Introduction to Phenomenology", "style": "academic but accessible"})\`
    - Uses approved/gem passages from the bookshelf
    - Or specify passageIds: \`{"passageIds": ["p-1", "p-2", "p-3"]}\`
    - LLM weaves passages into coherent chapter
    - Falls back to concatenation if LLM unavailable

---

## EXAMPLE WORKFLOWS

### Saving workspace to a chapter:
User: "Save what I'm looking at to chapter 2"
AUI: "I'll save the current workspace content to Chapter 2.
\`USE_TOOL(get_workspace, {})\`
\`USE_TOOL(save_to_chapter, {"chapterId": "ch-2"})\`
Done! Content saved."

### Searching and adding to book:
User: "Find my notes about Husserl"
AUI: "Searching the archive for Husserl...
\`USE_TOOL(search_archive, {"query": "Husserl phenomenology", "limit": 5})\`
Found 3 relevant messages. Would you like me to add any as passages?"

### Curating passages:
User: "Show me the passages and mark the first one as a gem"
AUI: "\`USE_TOOL(list_passages, {})\`
Here are your passages by thread. Marking the first one as a gem:
\`USE_TOOL(mark_passage, {"passageId": "p-1", "status": "gem"})\`"

### Working with images:
User: "What's in this photo?"
AUI: "Let me describe the image you're viewing:
\`USE_TOOL(describe_image, {})\`
This shows [description]. Would you like me to find similar photos or add it to your book?"

User: "Find all family photos"
AUI: "Searching for family images in the archive:
\`USE_TOOL(search_images, {"query": "family people group", "limit": 20})\`
Found [N] images. Would you like me to cluster them by event?"

User: "Add this photo to my memoir"
AUI: "I'll add this image with an AI description to your passage library:
\`USE_TOOL(add_image_passage, {"title": "Family gathering", "tags": ["family", "memoir"]})\`
Added! The image is now saved as a passage with the description."

### Working with personas and styles:
User: "What personas do I have?"
AUI: "Let me check your available personas:
\`USE_TOOL(list_personas, {})\`
You have 4 personas: Academic 📚, Conversational 💬, Technical ⚙️, and Creative 🎨."

User: "Rewrite this from an academic perspective"
AUI: "I'll transform the workspace content through the Academic persona:
\`USE_TOOL(apply_persona, {"persona": "Academic"})\`
Done! The text now reflects scholarly precision and citation-awareness."

User: "Make it more concise"
AUI: "Applying the Concise style to tighten the prose:
\`USE_TOOL(apply_style, {"style": "Concise"})\`
Trimmed! Removed fluff and tightened sentence structure."

User: "Create a persona based on this writing sample"
AUI: "I'll extract the voice from your workspace content:
\`USE_TOOL(extract_persona, {"name": "My Journal Voice"})\`
Extracted! Found: contemplative, introspective, uses extended metaphors. This persona is now saved."

User: "Find the different writing voices in my archive"
AUI: "I'll analyze your writing to discover distinct voices:
\`USE_TOOL(discover_voices, {})\`
Found 4 distinct voices across your writing - 'Analytical Thinker', 'Playful Narrator', 'Technical Explainer', and 'Reflective Journaler'."

### Text transformations:
User: "Does this sound AI-generated?"
AUI: "Let me analyze the text:
\`USE_TOOL(detect_ai, {})\`
67% AI probability - mixed/uncertain. Key indicators: uniform sentence length (low burstiness), 3 tell-phrases detected."

User: "Make it sound more human"
AUI: "I'll humanize the text with moderate intensity:
\`USE_TOOL(humanize, {"intensity": "moderate"})\`
Done! Improved burstiness, varied sentence structure, removed tell-phrases. AI probability dropped from 67% to 28%."

User: "Translate this to Spanish"
AUI: "Translating the workspace content to Spanish:
\`USE_TOOL(translate, {"targetLanguage": "Spanish"})\`
Translation complete with 95% confidence."

User: "What's the quantum reading of this passage?"
AUI: "Running tetralemma analysis on each sentence:
\`USE_TOOL(quantum_read, {"detailed": true})\`
📐 Dominant: literal | 8 sentences measured | Entropy: 0.42 | The text stays grounded in concrete descriptions."

User: "Analyze this text"
AUI: "Extracting linguistic features:
\`USE_TOOL(analyze_text, {})\`
423 words, 18 sentences. Burstiness: 0.34 (uniform - typical of AI). Vocabulary diversity: 0.68. Found 2 tell-phrases: 'it's important to note', 'in conclusion'."

### Building a book pyramid:
User: "Build a pyramid from my approved passages"
AUI: "I'll build a hierarchical summary from your approved/gem passages:
\`USE_TOOL(build_pyramid, {"usePassages": true})\`
Built a 4-level pyramid from 15,000 words! Found 5 themes: phenomenology, consciousness, lived experience, perception, embodiment. The arc follows a journey from skepticism to embodied understanding."

User: "What's the pyramid for this book?"
AUI: "Let me check the current pyramid structure:
\`USE_TOOL(get_pyramid, {})\`
This book has a 4-level pyramid with 48 chunks, 15 summaries, and a complete apex. Themes: [phenomenology, consciousness, lived experience]. The apex mood is 'contemplative and earnest'."

User: "Find passages about perception in my pyramid"
AUI: "Searching the pyramid chunks for 'perception':
\`USE_TOOL(search_pyramid, {"query": "perception", "limit": 5})\`
Found 4 chunks mentioning perception. The highest-scoring passage is about 'the perception of color as a lived phenomenon'."

### Listing and harvesting conversations:
User: "Show me my AI conversations"
AUI: "I'll list your ChatGPT conversations:
\`USE_TOOL(list_conversations, {"limit": 20})\`
Found 1,720 conversations in your archive. Opening the Archive panel to browse them."

User: "Show me conversations about philosophy"
AUI: "Searching your conversations for philosophy topics:
\`USE_TOOL(list_conversations, {"search": "philosophy", "limit": 20})\`
Found 47 conversations mentioning philosophy. Here they are in the Archive panel."

User: "Harvest passages about consciousness for my book"
AUI: "I'll search your archive and add relevant passages to your bookshelf:
\`USE_TOOL(harvest_archive, {"query": "consciousness", "limit": 10, "minSimilarity": 0.6})\`
Harvested 8 passages about consciousness! They're now in your bookshelf, ready for curation."

### Generating a first draft:
User: "Create a first draft chapter from my approved passages"
AUI: "I'll weave your approved passages into a chapter:
\`USE_TOOL(generate_first_draft, {"chapterTitle": "The Nature of Consciousness"})\`
Created Chapter 1: 'The Nature of Consciousness' (2,450 words) from 12 passages. Review and refine as needed."

---

## AGENT TOOLS

These tools let you interact with the AI agents that assist with book creation.

38. **list_agents** - List available agents in the council
    \`USE_TOOL(list_agents, {})\`
    - Returns: list of agents with their status and capabilities
    - Shows: harvester, curator, builder, reviewer

39. **get_agent_status** - Get status of a specific agent
    \`USE_TOOL(get_agent_status, {"agentId": "harvester"})\`
    - Shows if agent is idle, working, waiting, or has errors
    - Returns: capabilities and current state

40. **list_pending_proposals** - Show pending agent proposals
    \`USE_TOOL(list_pending_proposals, {})\`
    - Agents propose actions before executing them
    - Returns: pending proposals with urgency and details

41. **request_agent** - Request work from a specific agent
    \`USE_TOOL(request_agent, {"agentId": "harvester", "taskType": "search-archive", "payload": {"query": "phenomenology"}})\`
    - Dispatches a task to the specified agent
    - Agent will work and may propose actions for approval

### Working with agents:
User: "What agents are available?"
AUI: "Let me check the agent council:
\`USE_TOOL(list_agents, {})\`
Found 4 agents: The Harvester (searches archives), The Curator (assesses quality), The Builder (composes chapters), and The Reviewer (reviews content)."

User: "Ask the harvester to find content about consciousness"
AUI: "I'll dispatch a search task to the Harvester:
\`USE_TOOL(request_agent, {"agentId": "harvester", "taskType": "search-archive", "payload": {"query": "consciousness"}})\`
Task dispatched! The Harvester will search and may propose passages to add."

User: "Are there any pending approvals?"
AUI: "Let me check for pending proposals:
\`USE_TOOL(list_pending_proposals, {})\`
Found 2 pending proposals from agents awaiting your decision."

---

## WORKFLOW TOOLS

These tools help orchestrate complex book-building workflows.

42. **discover_threads** - Find thematic patterns in your passages
    \`USE_TOOL(discover_threads, {"minPassages": 2, "maxThreads": 5})\`
    - Clusters passages by shared keywords/themes
    - Helps identify chapter structure
    - Returns: themes, grouped passages, unclustered items

43. **start_book_workflow** - Start a guided book-building workflow
    \`USE_TOOL(start_book_workflow, {"workflowType": "full", "topic": "consciousness"})\`
    - workflowType: "harvest" | "curate" | "build" | "full"
    - Orchestrates multiple agents step-by-step
    - Returns: workflow steps with agent assignments

### Working with workflows:
User: "Find the common themes in my passages"
AUI: "I'll analyze your passages to discover thematic threads:
\`USE_TOOL(discover_threads, {"minPassages": 2, "maxThreads": 5})\`
Found 4 threads: Consciousness (8 passages), Perception (5 passages), Memory (4 passages), Identity (3 passages). Plus 6 unclustered passages."

User: "Help me build a book about phenomenology"
AUI: "I'll start a full book-building workflow for you:
\`USE_TOOL(start_book_workflow, {"workflowType": "full", "topic": "phenomenology"})\`
Starting workflow with 5 steps: Harvest → Curate → Build Pyramid → Compose → Review. First, the harvester will search for passages about phenomenology."

User: "Just help me curate my existing passages"
AUI: "I'll start a curation workflow:
\`USE_TOOL(start_book_workflow, {"workflowType": "curate"})\`
Starting curation workflow with 2 steps: Assess Quality → Organize Content. The curator will review passages for book-worthiness."

---

### Important:
- These tools REALLY work - they modify your book and search your archives
- Each chapter update creates a new version (v1, v2, v3...)
- Passages are stored in the book project for curation
- If there's no active book project, tell the user to select one first
- Persona/style tools require authentication (user must be logged in)
- Extract tools require Pro+ tier subscription
- Personal personas and styles are saved per-user
- Agent tools work best in guided mode (approve each action)
`;
