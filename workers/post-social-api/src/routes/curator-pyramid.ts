/**
 * Curator Pyramid API Routes
 *
 * Endpoints for building and querying the hierarchical chunk pyramid:
 * - Build pyramid from Gutenberg text
 * - Search corpus semantically
 * - Initiate curator discourse
 * - Query pyramid stats
 */

import { Hono } from 'hono';
import { requireAuth, getAuthContext, isOwnerOrWheel } from '../middleware/auth';

// Services
import {
  preprocessGutenbergText,
  fetchGutenbergText,
  WELL_KNOWN_BOOKS,
} from '../services/gutenberg-preprocessor';
import { createChunks } from '../services/semantic-chunker';
import { buildPyramid } from '../services/pyramid-builder';
import {
  searchCorpus,
  getChapterChunks,
  formatCuratorQuote,
  buildConversationContext,
} from '../services/curator-search';
import {
  reformatGutenbergText,
  storeWorkingTexts,
} from '../services/text-reformatter';
import {
  findVisitationCandidates,
  initiateDiscourse,
  getDiscourseSummary,
} from '../services/discourse-engine';
import {
  getPyramidStats,
  getApexByNode,
  getChunksByNode,
  getSummariesByLevel,
} from '../services/curator-pyramid';
import {
  chat,
  getConversationHistory,
  listConversations,
} from '../services/curator-chat';

const pyramidRoutes = new Hono();

// ==========================================
// PYRAMID BUILDING
// ==========================================

/**
 * POST /api/curator-pyramid/build
 * Build a pyramid for a node from Gutenberg text
 */
pyramidRoutes.post('/build', requireAuth(), async (c) => {
  const auth = getAuthContext(c);

  try {
    const { nodeId, gutenbergId, gutenbergSlug } = await c.req.json();

    if (!nodeId) {
      return c.json({ error: 'nodeId is required' }, 400);
    }

    // Resolve Gutenberg ID
    let resolvedId = gutenbergId;
    if (gutenbergSlug && WELL_KNOWN_BOOKS[gutenbergSlug as keyof typeof WELL_KNOWN_BOOKS]) {
      resolvedId = WELL_KNOWN_BOOKS[gutenbergSlug as keyof typeof WELL_KNOWN_BOOKS];
    }

    if (!resolvedId) {
      return c.json({
        error: 'gutenbergId or gutenbergSlug required',
        wellKnownBooks: Object.keys(WELL_KNOWN_BOOKS),
      }, 400);
    }

    // Verify node ownership
    const node = await c.env.DB.prepare(
      `SELECT creator_user_id FROM nodes WHERE id = ?`
    ).bind(nodeId).first<{ creator_user_id: string }>();

    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }

    if (!isOwnerOrWheel(c, node.creator_user_id)) {
      return c.json({ error: 'Only node creator can build pyramid' }, 403);
    }

    // Preprocess text
    const preprocessed = await preprocessGutenbergText(resolvedId);

    // Create chunks
    const { chunks, stats: chunkStats } = createChunks(preprocessed);

    // Build pyramid (this takes a while)
    const pyramid = await buildPyramid(
      c.env.AI,
      c.env.DB,
      c.env.NODE_CHUNKS!,
      nodeId,
      chunks,
      preprocessed.metadata
    );

    // Step 2: Create working texts (clean markdown for reading)
    // This runs after pyramid building to ensure the node exists and has content
    let workingTextResult = { success: false, chapters: 0, stored: 0 };
    try {
      const reformatted = await reformatGutenbergText(c.env.AI, preprocessed.text);

      if (reformatted.success && reformatted.chapters.length > 0) {
        const storeResult = await storeWorkingTexts(c.env.DB, nodeId, reformatted.chapters);
        workingTextResult = {
          success: true,
          chapters: reformatted.chapters.length,
          stored: storeResult.stored
        };

        // Update node metadata
        const archiveMetadata = {
          ...preprocessed.metadata,
          hasWorkingTexts: true,
          workingTextsProcessedAt: Date.now(),
          chapterCount: reformatted.chapters.length,
        };

        await c.env.DB.prepare(
          `UPDATE nodes SET archive_metadata = ?, updated_at = ? WHERE id = ?`
        ).bind(JSON.stringify(archiveMetadata), Date.now(), nodeId).run();
      }
    } catch (reformatError) {
      console.error('[CURATOR-PYRAMID] Reformatting error (non-fatal):', reformatError);
      // Continue even if reformatting fails - pyramid is the primary artifact
    }

    return c.json({
      success: true,
      nodeId,
      gutenbergId: resolvedId,
      metadata: preprocessed.metadata,
      stats: {
        ...chunkStats,
        pyramidDepth: pyramid.stats.pyramidDepth,
        processingTimeMs: pyramid.stats.processingTimeMs,
      },
      apex: {
        themes: pyramid.apex.coreThemes,
        theQuestion: pyramid.apex.theQuestion,
        resonanceHooks: pyramid.apex.resonanceHooks,
      },
      workingText: workingTextResult,
    });

  } catch (error) {
    console.error('[CURATOR-PYRAMID] Build error:', error);
    return c.json({ error: 'Failed to build pyramid', details: String(error) }, 500);
  }
});

/**
 * GET /api/curator-pyramid/well-known-books
 * List available well-known Gutenberg books
 */
pyramidRoutes.get('/well-known-books', async (c) => {
  return c.json({
    books: Object.entries(WELL_KNOWN_BOOKS).map(([slug, id]) => ({
      slug,
      gutenbergId: id,
    })),
  });
});

// ==========================================
// PYRAMID QUERIES
// ==========================================

/**
 * GET /api/curator-pyramid/node/:nodeId/stats
 * Get pyramid statistics for a node
 */
pyramidRoutes.get('/node/:nodeId/stats', async (c) => {
  const nodeId = c.req.param('nodeId');

  try {
    const stats = await getPyramidStats(c.env.DB, nodeId);
    const apex = await getApexByNode(c.env.DB, nodeId);

    return c.json({
      nodeId,
      stats,
      apex: apex ? {
        lifecycleState: apex.lifecycleState,
        coreThemes: apex.coreThemes,
        theQuestion: apex.theQuestion,
        sourceTitle: apex.sourceTitle,
        sourceAuthor: apex.sourceAuthor,
      } : null,
    });
  } catch (error) {
    console.error('[CURATOR-PYRAMID] Stats error:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

/**
 * GET /api/curator-pyramid/node/:nodeId/apex
 * Get the apex (curator consciousness) for a node
 */
pyramidRoutes.get('/node/:nodeId/apex', async (c) => {
  const nodeId = c.req.param('nodeId');

  try {
    const apex = await getApexByNode(c.env.DB, nodeId);

    if (!apex) {
      return c.json({ error: 'No apex found - pyramid may not be built' }, 404);
    }

    return c.json({ apex });
  } catch (error) {
    console.error('[CURATOR-PYRAMID] Apex error:', error);
    return c.json({ error: 'Failed to get apex' }, 500);
  }
});

/**
 * GET /api/curator-pyramid/node/:nodeId/chunks
 * Get chunks for a node (paginated)
 */
pyramidRoutes.get('/node/:nodeId/chunks', async (c) => {
  const nodeId = c.req.param('nodeId');
  const chapter = c.req.query('chapter') ? parseInt(c.req.query('chapter')!) : undefined;
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    const chunks = await getChunksByNode(c.env.DB, nodeId, {
      chapter,
      limit,
      offset,
    });

    return c.json({
      nodeId,
      chunks: chunks.map(chunk => ({
        id: chunk.id,
        chunkIndex: chunk.chunkIndex,
        chapterNumber: chunk.chapterNumber,
        chapterTitle: chunk.chapterTitle,
        structuralPosition: chunk.structuralPosition,
        chunkType: chunk.chunkType,
        tokenCount: chunk.tokenCount,
        preview: chunk.content.substring(0, 200) + '...',
      })),
      pagination: { limit, offset, returned: chunks.length },
    });
  } catch (error) {
    console.error('[CURATOR-PYRAMID] Chunks error:', error);
    return c.json({ error: 'Failed to get chunks' }, 500);
  }
});

// ==========================================
// SEARCH
// ==========================================

/**
 * POST /api/curator-pyramid/node/:nodeId/search
 * Semantic search within a node's corpus
 */
pyramidRoutes.post('/node/:nodeId/search', async (c) => {
  const nodeId = c.req.param('nodeId');

  try {
    const { query, maxResults, chapterFilter, includeContext } = await c.req.json();

    if (!query) {
      return c.json({ error: 'query is required' }, 400);
    }

    const results = await searchCorpus(
      c.env.AI,
      c.env.DB,
      c.env.NODE_CHUNKS!,
      nodeId,
      query,
      {
        maxResults: maxResults || 5,
        chapterFilter,
        includeContext: includeContext ?? true,
      }
    );

    return c.json({
      query,
      nodeId,
      searchTimeMs: results.searchTimeMs,
      totalMatches: results.totalMatches,
      passages: results.passages.map(p => ({
        chunkId: p.chunkId,
        quote: p.quote,
        citation: p.citation.formatted,
        relevanceScore: p.relevanceScore,
        chunkType: p.chunkType,
        formattedQuote: formatCuratorQuote(p),
      })),
    });
  } catch (error) {
    console.error('[CURATOR-PYRAMID] Search error:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

/**
 * POST /api/curator-pyramid/node/:nodeId/context
 * Build conversation context for a curator response
 */
pyramidRoutes.post('/node/:nodeId/context', async (c) => {
  const nodeId = c.req.param('nodeId');

  try {
    const { query, maxTokens } = await c.req.json();

    if (!query) {
      return c.json({ error: 'query is required' }, 400);
    }

    const context = await buildConversationContext(
      c.env.AI,
      c.env.DB,
      c.env.NODE_CHUNKS!,
      nodeId,
      query,
      { maxTokens }
    );

    return c.json({
      nodeId,
      query,
      apex: context.apex ? {
        themes: context.apex.coreThemes,
        theQuestion: context.apex.theQuestion,
      } : null,
      passageCount: context.relevantPassages.length,
      contextText: context.contextText,
    });
  } catch (error) {
    console.error('[CURATOR-PYRAMID] Context error:', error);
    return c.json({ error: 'Failed to build context' }, 500);
  }
});

// ==========================================
// DISCOURSE
// ==========================================

/**
 * GET /api/curator-pyramid/node/:nodeId/visitation-candidates
 * Find nodes this curator could visit
 */
pyramidRoutes.get('/node/:nodeId/visitation-candidates', async (c) => {
  const nodeId = c.req.param('nodeId');

  try {
    const candidates = await findVisitationCandidates(
      c.env.AI,
      c.env.DB,
      c.env.NODE_CHUNKS!,
      nodeId,
      { maxCandidates: 5 }
    );

    return c.json({
      sourceNodeId: nodeId,
      candidates: candidates.map(c => ({
        nodeId: c.nodeId,
        title: c.title,
        author: c.author,
        matchScore: c.matchScore,
        matchReason: c.matchReason,
      })),
    });
  } catch (error) {
    console.error('[CURATOR-PYRAMID] Candidates error:', error);
    return c.json({ error: 'Failed to find candidates' }, 500);
  }
});

/**
 * POST /api/curator-pyramid/discourse/initiate
 * Initiate a curator-to-curator discourse
 */
pyramidRoutes.post('/discourse/initiate', requireAuth(), async (c) => {
  const auth = getAuthContext(c);

  try {
    const { visitorNodeId, hostNodeId, discourseType } = await c.req.json();

    if (!visitorNodeId || !hostNodeId) {
      return c.json({ error: 'visitorNodeId and hostNodeId are required' }, 400);
    }

    // Verify ownership of visitor node
    const visitorNode = await c.env.DB.prepare(
      `SELECT creator_user_id FROM nodes WHERE id = ?`
    ).bind(visitorNodeId).first<{ creator_user_id: string }>();

    if (!visitorNode) {
      return c.json({ error: 'Visitor node not found' }, 404);
    }

    if (!isOwnerOrWheel(c, visitorNode.creator_user_id)) {
      return c.json({ error: 'Only visitor node creator can initiate discourse' }, 403);
    }

    const result = await initiateDiscourse(
      c.env.AI,
      c.env.DB,
      visitorNodeId,
      hostNodeId,
      discourseType || 'visitation'
    );

    return c.json({
      success: true,
      conversationId: result.conversationId,
      exchangeCount: result.exchanges.length,
      crossReference: result.crossReference,
      summary: getDiscourseSummary(result),
      processingTimeMs: result.processingTimeMs,
    });

  } catch (error) {
    console.error('[CURATOR-PYRAMID] Discourse error:', error);
    return c.json({ error: 'Discourse failed', details: String(error) }, 500);
  }
});

// ==========================================
// CURATOR CHAT
// ==========================================

/**
 * POST /api/curator-pyramid/node/:nodeId/chat
 * Chat with the node's curator
 *
 * Body: { message: string, sessionId?: string, maxPassages?: number }
 * Returns: curator response with conversation context
 */
pyramidRoutes.post('/node/:nodeId/chat', async (c) => {
  const nodeId = c.req.param('nodeId');

  try {
    const body = await c.req.json();
    const { message, sessionId, maxPassages } = body;

    if (!message || typeof message !== 'string') {
      return c.json({ error: 'message is required' }, 400);
    }

    if (message.length > 2000) {
      return c.json({ error: 'message too long (max 2000 chars)' }, 400);
    }

    // Get user ID if authenticated (optional for chat)
    let userId: string | undefined;
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { getAuthContext } = await import('../middleware/auth');
        // Try to get auth context, but don't require it
        const auth = getAuthContext(c);
        userId = auth?.userId;
      } catch {
        // Anonymous chat is fine
      }
    }

    const result = await chat(
      c.env.AI,
      c.env.DB,
      c.env.NODE_CHUNKS!,
      nodeId,
      {
        message,
        sessionId,
        maxPassages: maxPassages || 3,
        includeQuotes: true,
      },
      userId
    );

    return c.json({
      conversationId: result.conversationId,
      sessionId: result.sessionId,
      response: result.curatorResponse,
      turnNumber: result.turnNumber,
      passagesCited: result.passagesCited,
      processingTimeMs: result.processingTimeMs,
    });

  } catch (error) {
    console.error('[CURATOR-PYRAMID] Chat error:', error);
    const message = error instanceof Error ? error.message : 'Chat failed';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /api/curator-pyramid/node/:nodeId/chat/history
 * Get conversation history for a session
 */
pyramidRoutes.get('/node/:nodeId/chat/history', async (c) => {
  const nodeId = c.req.param('nodeId');
  const sessionId = c.req.query('sessionId');

  if (!sessionId) {
    return c.json({ error: 'sessionId query param required' }, 400);
  }

  try {
    const conversation = await getConversationHistory(c.env.DB, nodeId, sessionId);

    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    return c.json({
      conversationId: conversation.id,
      sessionId: conversation.sessionId,
      turns: conversation.turns.map(t => ({
        role: t.role,
        content: t.content,
        timestamp: t.createdAt,
      })),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });

  } catch (error) {
    console.error('[CURATOR-PYRAMID] History error:', error);
    return c.json({ error: 'Failed to get history' }, 500);
  }
});

/**
 * GET /api/curator-pyramid/node/:nodeId/chat/conversations
 * List all conversations for a node (for admin/owner)
 */
pyramidRoutes.get('/node/:nodeId/chat/conversations', requireAuth(), async (c) => {
  const nodeId = c.req.param('nodeId');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    // Verify ownership
    const auth = getAuthContext(c);
    const node = await c.env.DB.prepare(
      `SELECT creator_user_id FROM nodes WHERE id = ?`
    ).bind(nodeId).first<{ creator_user_id: string }>();

    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }

    if (!isOwnerOrWheel(c, node.creator_user_id)) {
      return c.json({ error: 'Only node owner can view all conversations' }, 403);
    }

    const result = await listConversations(c.env.DB, nodeId, { limit, offset });

    return c.json({
      nodeId,
      conversations: result.conversations,
      total: result.total,
      pagination: { limit, offset },
    });

  } catch (error) {
    console.error('[CURATOR-PYRAMID] List conversations error:', error);
    return c.json({ error: 'Failed to list conversations' }, 500);
  }
});

/**
 * GET /api/curator-pyramid/debug/vectorize
 * Debug endpoint to check Vectorize index status
 */
pyramidRoutes.get('/debug/vectorize', async (c) => {
  try {
    // Generate a test embedding
    const testEmbedding = await c.env.AI.run('@cf/baai/bge-small-en-v1.5' as Parameters<Ai['run']>[0], {
      text: ['test query for debugging'],
    }) as { data: number[][] };

    // Query without filter to see what's in the index
    const vectorize = c.env.NODE_CHUNKS;
    if (!vectorize) {
      return c.json({ error: 'NODE_CHUNKS not configured' }, 500);
    }

    const unfilteredResults = await vectorize.query(testEmbedding.data[0], {
      topK: 5,
      returnMetadata: 'all',
    });

    // Also try with a specific nodeId if provided
    const nodeId = c.req.query('nodeId');
    let filteredResults = null;
    if (nodeId) {
      filteredResults = await vectorize.query(testEmbedding.data[0], {
        topK: 5,
        filter: { nodeId },
        returnMetadata: 'all',
      });
    }

    return c.json({
      embeddingDimensions: testEmbedding.data[0].length,
      unfilteredMatches: unfilteredResults.matches.length,
      unfilteredResults: unfilteredResults.matches.map(m => ({
        id: m.id,
        score: m.score,
        metadata: m.metadata,
      })),
      filteredMatches: filteredResults ? filteredResults.matches.length : null,
      filteredResults: filteredResults ? filteredResults.matches.map(m => ({
        id: m.id,
        score: m.score,
        metadata: m.metadata,
      })) : null,
    });
  } catch (error) {
    console.error('[CURATOR-PYRAMID] Debug error:', error);
    return c.json({ error: 'Debug failed', details: String(error) }, 500);
  }
});

export default pyramidRoutes;
