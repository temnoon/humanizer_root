/**
 * Agentic Search Handlers
 *
 * MCP tool handlers for the unified agentic search service.
 * Connects to AgenticSearchService for search, refinement, quality, and navigation.
 *
 * Note: These handlers require Ollama for embeddings. Handlers check
 * availability and return helpful errors if services are unavailable.
 */

import type { MCPResult, HandlerContext } from '../types.js';
import { getContentStore } from '../../storage/index.js';
import { AgenticSearchService } from '../../agentic-search/agentic-search-service.js';
import { UnifiedStore, StubBooksStore } from '../../agentic-search/unified-store.js';
import {
  SessionManager,
  getSessionManager,
} from '../../agentic-search/session-manager.js';
import type {
  AgenticSearchOptions,
  RefineOptions,
  QualityGateOptions,
  ClusterOptions,
  SearchSession,
} from '../../agentic-search/types.js';

// ═══════════════════════════════════════════════════════════════════
// LAZY-LOADED DEPENDENCIES
// ═══════════════════════════════════════════════════════════════════

let OllamaAdapter: typeof import('@humanizer/npe').OllamaAdapter | null = null;
let adapter: InstanceType<typeof import('@humanizer/npe').OllamaAdapter> | null = null;
let searchService: AgenticSearchService | null = null;

async function ensureNpeLoaded(): Promise<void> {
  if (!OllamaAdapter) {
    const npe = await import('@humanizer/npe');
    OllamaAdapter = npe.OllamaAdapter;
  }
}

async function getEmbedder(): Promise<(text: string) => Promise<number[]>> {
  await ensureNpeLoaded();

  if (!adapter) {
    adapter = new OllamaAdapter!();
    const isAvailable = await adapter.isAvailable();
    if (!isAvailable) {
      throw new Error('Ollama is not available. Please ensure Ollama is running on localhost:11434');
    }
  }

  return async (text: string) => {
    const result = await adapter!.embed(text);
    return result.embedding;
  };
}

async function getSearchService(): Promise<AgenticSearchService> {
  if (!searchService) {
    const store = getContentStore();
    const embedFn = await getEmbedder();
    const unifiedStore = new UnifiedStore(store, new StubBooksStore());
    searchService = new AgenticSearchService(unifiedStore, embedFn);
  }
  return searchService;
}

// ═══════════════════════════════════════════════════════════════════
// RESULT HELPERS
// ═══════════════════════════════════════════════════════════════════

function jsonResult(data: unknown): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

function sessionToJson(session: SearchSession): object {
  return {
    id: session.id,
    name: session.name,
    resultCount: session.results.length,
    historyCount: session.history.length,
    positiveAnchors: session.positiveAnchors.length,
    negativeAnchors: session.negativeAnchors.length,
    excludedCount: session.excludedIds.size,
    pinnedCount: session.pinnedIds.size,
    metadata: session.metadata,
  };
}

// ═══════════════════════════════════════════════════════════════════
// SESSION HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface CreateSessionInput {
  name?: string;
  notes?: string;
}

async function handleCreateSession(args: CreateSessionInput): Promise<MCPResult> {
  try {
    const sessionManager = getSessionManager();
    const session = sessionManager.createSession({
      name: args.name,
      notes: args.notes,
    });
    return jsonResult({
      success: true,
      session: sessionToJson(session),
    });
  } catch (err) {
    return errorResult(`Failed to create session: ${(err as Error).message}`);
  }
}

async function handleListSessions(): Promise<MCPResult> {
  try {
    const sessionManager = getSessionManager();
    const sessions = sessionManager.listSessions();
    return jsonResult({
      sessions: sessions.map(sessionToJson),
      stats: sessionManager.getStats(),
    });
  } catch (err) {
    return errorResult(`Failed to list sessions: ${(err as Error).message}`);
  }
}

interface GetSessionInput {
  sessionId: string;
}

async function handleGetSession(args: GetSessionInput): Promise<MCPResult> {
  try {
    const sessionManager = getSessionManager();
    const session = sessionManager.getSession(args.sessionId);
    if (!session) {
      return errorResult(`Session not found: ${args.sessionId}`);
    }
    return jsonResult({
      session: {
        ...sessionToJson(session),
        results: session.results.slice(0, 10), // First 10 results
        history: session.history.slice(-5), // Last 5 history entries
        positiveAnchors: session.positiveAnchors.map(a => ({
          id: a.id,
          name: a.name,
          createdAt: a.createdAt,
        })),
        negativeAnchors: session.negativeAnchors.map(a => ({
          id: a.id,
          name: a.name,
          createdAt: a.createdAt,
        })),
      },
    });
  } catch (err) {
    return errorResult(`Failed to get session: ${(err as Error).message}`);
  }
}

interface DeleteSessionInput {
  sessionId: string;
}

async function handleDeleteSession(args: DeleteSessionInput): Promise<MCPResult> {
  try {
    const sessionManager = getSessionManager();
    const deleted = sessionManager.deleteSession(args.sessionId);
    return jsonResult({
      success: deleted,
      message: deleted ? 'Session deleted' : 'Session not found',
    });
  } catch (err) {
    return errorResult(`Failed to delete session: ${(err as Error).message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface UnifiedSearchInput {
  query: string;
  sessionId?: string;
  target?: 'archive' | 'books' | 'all';
  limit?: number;
  threshold?: number;
  hierarchyLevel?: 'L0' | 'L1' | 'apex' | 'all';
  mode?: 'hybrid' | 'dense' | 'sparse';
  sourceTypes?: string[];
  authorRole?: 'user' | 'assistant' | 'system';
  bookId?: string;
}

async function handleUnifiedSearch(args: UnifiedSearchInput): Promise<MCPResult> {
  try {
    const service = await getSearchService();

    const options: AgenticSearchOptions = {
      target: args.target,
      limit: args.limit,
      threshold: args.threshold,
      hierarchyLevel: args.hierarchyLevel,
      mode: args.mode,
      sourceTypes: args.sourceTypes,
      authorRole: args.authorRole,
      bookId: args.bookId,
    };

    const response = args.sessionId
      ? await service.searchInSession(args.sessionId, args.query, options)
      : await service.search(args.query, options);

    return jsonResult({
      query: response.query,
      resultCount: response.results.length,
      results: response.results.map(r => ({
        id: r.id,
        source: r.source,
        score: r.score.toFixed(4),
        wordCount: r.wordCount,
        hierarchyLevel: r.hierarchyLevel,
        title: r.title,
        text: r.text.slice(0, 200) + (r.text.length > 200 ? '...' : ''),
        provenance: {
          sourceType: r.provenance.sourceType,
          authorRole: r.provenance.authorRole,
          threadTitle: r.provenance.threadTitle,
        },
      })),
      stats: response.stats,
      hasMore: response.hasMore,
      sessionId: response.sessionId,
    });
  } catch (err) {
    return errorResult(`Search failed: ${(err as Error).message}`);
  }
}

interface SearchWithinInput {
  sessionId: string;
  query: string;
  threshold?: number;
  limit?: number;
}

async function handleSearchWithinResults(args: SearchWithinInput): Promise<MCPResult> {
  try {
    const service = await getSearchService();
    const response = await service.searchWithinResults(args.sessionId, args.query, {
      threshold: args.threshold,
      limit: args.limit,
    });

    return jsonResult({
      query: response.query,
      resultCount: response.results.length,
      results: response.results.map(r => ({
        id: r.id,
        score: r.score.toFixed(4),
        title: r.title,
        text: r.text.slice(0, 200) + (r.text.length > 200 ? '...' : ''),
      })),
      stats: response.stats,
    });
  } catch (err) {
    return errorResult(`Search within failed: ${(err as Error).message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// REFINEMENT HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface RefineInput {
  sessionId: string;
  query?: string;
  likeThese?: string[];
  unlikeThese?: string[];
  minScore?: number;
  minWordCount?: number;
  limit?: number;
}

async function handleRefine(args: RefineInput): Promise<MCPResult> {
  try {
    const service = await getSearchService();
    const options: RefineOptions = {
      query: args.query,
      likeThese: args.likeThese,
      unlikeThese: args.unlikeThese,
      minScore: args.minScore,
      minWordCount: args.minWordCount,
      limit: args.limit,
    };

    const response = await service.refineResults(args.sessionId, options);

    return jsonResult({
      resultCount: response.results.length,
      results: response.results.slice(0, 10).map(r => ({
        id: r.id,
        score: r.score.toFixed(4),
        title: r.title,
        text: r.text.slice(0, 200) + (r.text.length > 200 ? '...' : ''),
      })),
      stats: response.stats,
    });
  } catch (err) {
    return errorResult(`Refinement failed: ${(err as Error).message}`);
  }
}

interface AddAnchorInput {
  sessionId: string;
  resultId: string;
  name?: string;
}

async function handleAddPositiveAnchor(args: AddAnchorInput): Promise<MCPResult> {
  try {
    const service = await getSearchService();
    const anchor = await service.addPositiveAnchor(
      args.sessionId,
      args.resultId,
      args.name
    );

    return jsonResult({
      success: true,
      anchor: {
        id: anchor.id,
        name: anchor.name,
        createdAt: anchor.createdAt,
      },
    });
  } catch (err) {
    return errorResult(`Failed to add positive anchor: ${(err as Error).message}`);
  }
}

async function handleAddNegativeAnchor(args: AddAnchorInput): Promise<MCPResult> {
  try {
    const service = await getSearchService();
    const anchor = await service.addNegativeAnchor(
      args.sessionId,
      args.resultId,
      args.name
    );

    return jsonResult({
      success: true,
      anchor: {
        id: anchor.id,
        name: anchor.name,
        createdAt: anchor.createdAt,
      },
    });
  } catch (err) {
    return errorResult(`Failed to add negative anchor: ${(err as Error).message}`);
  }
}

interface ApplyAnchorsInput {
  sessionId: string;
}

async function handleApplyAnchors(args: ApplyAnchorsInput): Promise<MCPResult> {
  try {
    const service = await getSearchService();
    const response = await service.applyAnchors(args.sessionId);

    return jsonResult({
      resultCount: response.results.length,
      filteredByAnchors: response.stats.filteredByAnchors,
      results: response.results.slice(0, 10).map(r => ({
        id: r.id,
        score: r.score.toFixed(4),
        anchorBoost: r.scoreBreakdown.anchorBoost?.toFixed(4),
        title: r.title,
      })),
    });
  } catch (err) {
    return errorResult(`Failed to apply anchors: ${(err as Error).message}`);
  }
}

interface ExcludeInput {
  sessionId: string;
  resultIds: string[];
}

async function handleExcludeResults(args: ExcludeInput): Promise<MCPResult> {
  try {
    const service = await getSearchService();
    service.excludeResults(args.sessionId, args.resultIds);

    return jsonResult({
      success: true,
      excludedCount: args.resultIds.length,
    });
  } catch (err) {
    return errorResult(`Failed to exclude results: ${(err as Error).message}`);
  }
}

interface PinInput {
  sessionId: string;
  resultIds: string[];
}

async function handlePinResults(args: PinInput): Promise<MCPResult> {
  try {
    const sessionManager = getSessionManager();
    sessionManager.pinResults(args.sessionId, args.resultIds);

    return jsonResult({
      success: true,
      pinnedCount: args.resultIds.length,
    });
  } catch (err) {
    return errorResult(`Failed to pin results: ${(err as Error).message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// QUALITY HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface ScrubInput {
  sessionId: string;
  minWordCount?: number;
  minQualityScore?: number;
  scrubSystemMessages?: boolean;
  scrubTrivialContent?: boolean;
  authorRole?: 'user' | 'assistant' | 'system';
}

async function handleScrubJunk(args: ScrubInput): Promise<MCPResult> {
  try {
    const service = await getSearchService();
    const options: QualityGateOptions = {
      minWordCount: args.minWordCount,
      minQualityScore: args.minQualityScore,
      scrubSystemMessages: args.scrubSystemMessages,
      scrubTrivialContent: args.scrubTrivialContent,
      authorRole: args.authorRole,
    };

    const response = await service.scrubResults(args.sessionId, options);

    return jsonResult({
      resultCount: response.results.length,
      filteredCount: response.stats.filteredByQuality,
      results: response.results.slice(0, 10).map(r => ({
        id: r.id,
        wordCount: r.wordCount,
        title: r.title,
      })),
    });
  } catch (err) {
    return errorResult(`Failed to scrub junk: ${(err as Error).message}`);
  }
}

interface EnrichInput {
  sessionId: string;
  resultIds?: string[];
  fields?: Array<'title' | 'summary' | 'rating' | 'categories' | 'keyTerms'>;
}

async function handleEnrichResults(args: EnrichInput): Promise<MCPResult> {
  // TODO: Integrate with EnrichmentService when LLM adapter is available
  return jsonResult({
    message: 'Enrichment requires LLM adapter. Feature pending integration.',
    sessionId: args.sessionId,
  });
}

interface ClusterInput {
  sessionId: string;
  minClusterSize?: number;
  maxClusters?: number;
  generateLabels?: boolean;
}

async function handleDiscoverClusters(args: ClusterInput): Promise<MCPResult> {
  try {
    const service = await getSearchService();
    const options: ClusterOptions = {
      minClusterSize: args.minClusterSize,
      maxClusters: args.maxClusters,
      generateLabels: args.generateLabels,
    };

    const result = await service.discoverClusters(args.sessionId, options);

    return jsonResult({
      clusterCount: result.clusters.length,
      clusters: result.clusters.map(c => ({
        id: c.id,
        label: c.label,
        memberCount: c.members.length,
        cohesion: c.cohesion.toFixed(4),
        representative: {
          id: c.representative.id,
          title: c.representative.title,
          text: c.representative.text.slice(0, 100),
        },
      })),
      stats: result.stats,
    });
  } catch (err) {
    return errorResult(`Failed to discover clusters: ${(err as Error).message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface GetContextInput {
  resultId: string;
}

async function handleGetContext(args: GetContextInput): Promise<MCPResult> {
  try {
    const service = await getSearchService();
    const parent = await service.getParentContext(args.resultId);

    if (!parent) {
      return jsonResult({
        message: 'No parent context found',
        resultId: args.resultId,
      });
    }

    return jsonResult({
      parent: {
        id: parent.id,
        source: parent.source,
        title: parent.title,
        text: parent.text.slice(0, 500),
        wordCount: parent.wordCount,
        hierarchyLevel: parent.hierarchyLevel,
      },
    });
  } catch (err) {
    return errorResult(`Failed to get context: ${(err as Error).message}`);
  }
}

interface GetChildrenInput {
  resultId: string;
}

async function handleGetChildren(args: GetChildrenInput): Promise<MCPResult> {
  try {
    const service = await getSearchService();
    const children = await service.getChildren(args.resultId);

    return jsonResult({
      childCount: children.length,
      children: children.map(c => ({
        id: c.id,
        title: c.title,
        text: c.text.slice(0, 200),
        wordCount: c.wordCount,
        hierarchyLevel: c.hierarchyLevel,
      })),
    });
  } catch (err) {
    return errorResult(`Failed to get children: ${(err as Error).message}`);
  }
}

interface GetThreadInput {
  resultId: string;
}

async function handleGetThread(args: GetThreadInput): Promise<MCPResult> {
  try {
    const service = await getSearchService();
    const thread = await service.getThread(args.resultId);

    return jsonResult({
      threadLength: thread.length,
      thread: thread.map(t => ({
        id: t.id,
        authorRole: t.provenance.authorRole,
        text: t.text.slice(0, 200),
        createdAt: t.provenance.sourceCreatedAt,
      })),
    });
  } catch (err) {
    return errorResult(`Failed to get thread: ${(err as Error).message}`);
  }
}

interface GetPyramidInput {
  resultId: string;
  direction?: 'up' | 'down';
}

async function handleGetPyramid(args: GetPyramidInput): Promise<MCPResult> {
  try {
    const service = await getSearchService();

    if (args.direction === 'down') {
      const children = await service.getChildren(args.resultId);
      return jsonResult({
        direction: 'down',
        childCount: children.length,
        children: children.slice(0, 10).map(c => ({
          id: c.id,
          hierarchyLevel: c.hierarchyLevel,
          text: c.text.slice(0, 200),
        })),
      });
    }

    // Default: up to apex
    const apex = await service.getApex(args.resultId);

    if (!apex) {
      return jsonResult({
        message: 'No apex found (this may be the top level)',
        resultId: args.resultId,
      });
    }

    return jsonResult({
      direction: 'up',
      apex: {
        id: apex.id,
        hierarchyLevel: apex.hierarchyLevel,
        title: apex.title,
        text: apex.text.slice(0, 500),
        wordCount: apex.wordCount,
      },
    });
  } catch (err) {
    return errorResult(`Failed to get pyramid: ${(err as Error).message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER REGISTRY
// ═══════════════════════════════════════════════════════════════════

export const AGENTIC_SEARCH_HANDLERS: Record<
  string,
  (args: unknown, context?: HandlerContext) => Promise<MCPResult>
> = {
  // Session management
  search_create_session: handleCreateSession as (args: unknown) => Promise<MCPResult>,
  search_list_sessions: handleListSessions as (args: unknown) => Promise<MCPResult>,
  search_get_session: handleGetSession as (args: unknown) => Promise<MCPResult>,
  search_delete_session: handleDeleteSession as (args: unknown) => Promise<MCPResult>,

  // Search
  search_unified: handleUnifiedSearch as (args: unknown) => Promise<MCPResult>,
  search_within_results: handleSearchWithinResults as (args: unknown) => Promise<MCPResult>,

  // Refinement
  search_refine: handleRefine as (args: unknown) => Promise<MCPResult>,
  search_add_positive_anchor: handleAddPositiveAnchor as (args: unknown) => Promise<MCPResult>,
  search_add_negative_anchor: handleAddNegativeAnchor as (args: unknown) => Promise<MCPResult>,
  search_apply_anchors: handleApplyAnchors as (args: unknown) => Promise<MCPResult>,
  search_exclude_results: handleExcludeResults as (args: unknown) => Promise<MCPResult>,
  search_pin_results: handlePinResults as (args: unknown) => Promise<MCPResult>,

  // Quality
  search_scrub_junk: handleScrubJunk as (args: unknown) => Promise<MCPResult>,
  search_enrich_results: handleEnrichResults as (args: unknown) => Promise<MCPResult>,
  search_discover_clusters: handleDiscoverClusters as (args: unknown) => Promise<MCPResult>,

  // Navigation
  search_get_context: handleGetContext as (args: unknown) => Promise<MCPResult>,
  search_get_children: handleGetChildren as (args: unknown) => Promise<MCPResult>,
  search_get_thread: handleGetThread as (args: unknown) => Promise<MCPResult>,
  search_get_pyramid: handleGetPyramid as (args: unknown) => Promise<MCPResult>,
};
