// Semantic search API routes
// Query posts using natural language via Vectorize embeddings

import { Hono } from 'hono';
import { requireAuth, getAuthContext, optionalAuth } from '../middleware/auth';
import { searchSimilarPosts, findSimilarContent, getEmbeddingConfig } from '../services/embeddings';

const searchRoutes = new Hono();

/**
 * POST /api/search - Semantic search for posts
 * 
 * Request body:
 * {
 *   query: string,           // Natural language search query
 *   limit?: number,          // Max results (default: 10, max: 50)
 *   includePrivate?: boolean // Include user's private posts (requires auth)
 * }
 */
searchRoutes.post('/', optionalAuth(), async (c) => {
  // Check if Vectorize is available
  if (!c.env.POST_VECTORS) {
    return c.json({ 
      error: 'Semantic search not available',
      message: 'Vectorize index not configured',
    }, 503);
  }
  
  let userId: string | null = null;
  try {
    const auth = getAuthContext(c);
    userId = auth?.userId ?? null;
  } catch {
    // Anonymous search
  }
  
  try {
    const body = await c.req.json();
    const { query, limit = 10, includePrivate = false, tags = [] } = body;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return c.json({ error: 'Query is required' }, 400);
    }
    
    if (query.length > 500) {
      return c.json({ error: 'Query too long (max 500 characters)' }, 400);
    }
    
    const effectiveLimit = Math.min(Math.max(1, limit), 50);
    
    // Search Vectorize WITHOUT metadata filter - we'll filter by visibility in SQL
    // This is more reliable than Vectorize metadata filtering
    const results = await searchSimilarPosts(
      c.env.AI,
      c.env.POST_VECTORS,
      query.trim(),
      { 
        topK: effectiveLimit * 2, // Fetch extra to account for filtering
      }
    );
    
    // Fetch full post data for results
    if (results.matches.length === 0) {
      return c.json({ 
        results: [],
        query,
        totalResults: 0,
        embeddingModel: getEmbeddingConfig().modelName,
      });
    }
    
    const postIds = results.matches.map(m => m.postId);
    const placeholders = postIds.map(() => '?').join(',');
    
    // Build SQL query with visibility filter
    // Public posts are always visible; private posts only visible to owner
    let sqlQuery = `
      SELECT 
        id, user_id, content, visibility, status,
        summary, tags, curated_at, created_at
      FROM posts 
      WHERE id IN (${placeholders})
        AND status = 'curated'
    `;
    
    // Add tag filter if tags are specified
    if (Array.isArray(tags) && tags.length > 0) {
      // Filter posts that have ALL the specified tags
      const tagConditions = tags.map(() => 'tags LIKE ?').join(' AND ');
      sqlQuery += ` AND (${tagConditions})`;
      // Add wildcard patterns to postIds array
      tags.forEach((tag: string) => {
        postIds.push(`%"${tag}"%`);
      });
    }
    
    // Apply visibility filter
    if (!includePrivate || !userId) {
      // Anonymous or not requesting private: only public posts
      sqlQuery += ` AND visibility = 'public'`;
    } else {
      // Authenticated and wants private: public + own private posts
      sqlQuery += ` AND (visibility = 'public' OR user_id = ?)`;
      postIds.push(userId);
    }
    
    const { results: posts } = await c.env.DB.prepare(sqlQuery).bind(...postIds).all<Record<string, unknown>>();
    
    // Map posts with scores, maintaining relevance order
    const postMap = new Map(posts?.map(p => [p.id as string, p]) ?? []);
    const enrichedResults = results.matches
      .filter(m => postMap.has(m.postId))
      .slice(0, effectiveLimit) // Apply limit after filtering
      .map(m => {
        const post = postMap.get(m.postId)!;
        return {
          ...post,
          tags: post.tags ? JSON.parse(post.tags as string) : [],
          relevanceScore: m.score,
        };
      });
    
    return c.json({
      results: enrichedResults,
      query,
      totalResults: enrichedResults.length,
      embeddingModel: getEmbeddingConfig().modelName,
      processingTimeMs: results.queryEmbedding.processingTimeMs,
    });
    
  } catch (error) {
    console.error('[SEARCH] Error:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

/**
 * GET /api/search/similar/:postId - Find posts similar to a given post
 */
searchRoutes.get('/similar/:postId', optionalAuth(), async (c) => {
  if (!c.env.POST_VECTORS) {
    return c.json({ 
      error: 'Semantic search not available',
      message: 'Vectorize index not configured',
    }, 503);
  }
  
  const postId = c.req.param('postId');
  const limit = Math.min(parseInt(c.req.query('limit') || '5'), 20);
  
  try {
    // Get the source post
    const post = await c.env.DB.prepare(
      `SELECT content, visibility FROM posts WHERE id = ? AND status = 'curated'`
    ).bind(postId).first<{ content: string; visibility: string }>();
    
    if (!post) {
      return c.json({ error: 'Post not found or not curated' }, 404);
    }
    
    // Find similar posts (no filter - we filter in SQL)
    const similar = await findSimilarContent(
      c.env.AI,
      c.env.POST_VECTORS,
      post.content,
      {
        excludePostId: postId,
        threshold: 0.6, // Lower threshold for "related" content
        topK: limit * 2, // Extra to account for filtering
      }
    );
    
    if (similar.length === 0) {
      return c.json({ results: [], sourcePostId: postId });
    }
    
    // Fetch full post data with visibility filter
    const postIds = similar.map(s => s.postId);
    const placeholders = postIds.map(() => '?').join(',');
    
    const { results: posts } = await c.env.DB.prepare(
      `SELECT 
        id, user_id, content, visibility, status,
        summary, tags, curated_at, created_at
       FROM posts 
       WHERE id IN (${placeholders})
         AND status = 'curated'
         AND visibility = 'public'`
    ).bind(...postIds).all<Record<string, unknown>>();
    
    const postMap = new Map(posts?.map(p => [p.id as string, p]) ?? []);
    const enrichedResults = similar
      .filter(s => postMap.has(s.postId))
      .slice(0, limit)
      .map(s => ({
        ...postMap.get(s.postId)!,
        tags: postMap.get(s.postId)!.tags 
          ? JSON.parse(postMap.get(s.postId)!.tags as string) 
          : [],
        similarityScore: s.score,
      }));
    
    return c.json({
      results: enrichedResults,
      sourcePostId: postId,
    });
    
  } catch (error) {
    console.error('[SEARCH] Similar error:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

/**
 * GET /api/search/config - Get search configuration info
 */
searchRoutes.get('/config', (c) => {
  const config = getEmbeddingConfig();
  
  return c.json({
    available: !!c.env.POST_VECTORS,
    embedding: config,
  });
});

export default searchRoutes;
