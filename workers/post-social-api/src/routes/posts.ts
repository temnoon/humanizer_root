// Post-social posts API routes
// Now with AI curation pipeline
import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';
import { runCurationPipeline, updatePostCuration, trackCurationQueue } from '../services/pipeline';

const postsRoutes = new Hono();

/**
 * POST /api/posts - Create new post (requires auth)
 * 
 * Flow:
 * 1. Validate input
 * 2. Insert post with 'pending' status
 * 3. Run curation pipeline (safety + summarize + tag + embed)
 * 4. Update post with curation results
 * 5. Return post with curation metadata
 */
postsRoutes.post('/', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  
  try {
    const { content, visibility = 'public' } = await c.req.json();

    if (!content || content.trim().length === 0) {
      return c.json({ error: 'Content is required' }, 400);
    }

    if (content.length > 5000) {
      return c.json({ error: 'Content too long (max 5000 characters)' }, 400);
    }

    const validVisibilities = ['public', 'friends', 'private'];
    if (!validVisibilities.includes(visibility)) {
      return c.json({ error: 'Invalid visibility. Use: public, friends, private' }, 400);
    }

    const postId = crypto.randomUUID();
    const now = Date.now();

    // Insert post with pending status
    await c.env.DB.prepare(
      `INSERT INTO posts (id, user_id, content, visibility, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`
    ).bind(postId, auth.userId, content, visibility, now, now).run();

    // Track in curation queue
    await trackCurationQueue(c.env.DB, postId, 'queued');

    // Run curation pipeline
    let pipelineResult;
    try {
      await trackCurationQueue(c.env.DB, postId, 'processing', 'safety');
      
      pipelineResult = await runCurationPipeline(
        c.env.AI,
        c.env.POST_VECTORS ?? null,
        postId,
        content,
        auth.userId,
        visibility,
        { userRole: auth.role }
      );
      
      // Update post with curation results
      await updatePostCuration(c.env.DB, postId, pipelineResult);
      await trackCurationQueue(c.env.DB, postId, 'completed');
      
    } catch (pipelineError) {
      console.error('[POSTS] Pipeline error:', pipelineError);
      await trackCurationQueue(
        c.env.DB, 
        postId, 
        'failed', 
        undefined,
        pipelineError instanceof Error ? pipelineError.message : 'Unknown error'
      );
      
      // Update post to approved status (safety passed, curation failed)
      await c.env.DB.prepare(
        `UPDATE posts SET status = 'approved', updated_at = ? WHERE id = ?`
      ).bind(Date.now(), postId).run();
    }

    // Return response based on status
    if (pipelineResult?.status === 'rejected') {
      // Post was rejected by safety check
      return c.json({
        error: 'Content rejected',
        reason: pipelineResult.safety.reason,
        category: pipelineResult.safety.category,
      }, 422);
    }

    // Success - return post with curation data
    return c.json({
      id: postId,
      user_id: auth.userId,
      user_email: auth.email,
      content,
      visibility,
      status: pipelineResult?.status ?? 'approved',
      summary: pipelineResult?.curation?.summary ?? null,
      tags: pipelineResult?.curation?.tags ?? [],
      curation: pipelineResult ? {
        model: pipelineResult.curation?.model,
        processingTimeMs: pipelineResult.totalProcessingTimeMs,
        embeddingIndexed: !!pipelineResult.embeddingId,
      } : null,
      created_at: now,
      updated_at: now,
    }, 201);
    
  } catch (error) {
    console.error('[POSTS] Create error:', error);
    return c.json({ error: 'Failed to create post' }, 500);
  }
});

/**
 * GET /api/posts - List user's posts (requires auth)
 */
postsRoutes.get('/', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const status = c.req.query('status'); // Optional filter: pending, approved, rejected, curated
  const tag = c.req.query('tag'); // Optional tag filter
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = parseInt(c.req.query('offset') || '0');
  
  try {
    let query = `
      SELECT 
        id, user_id, content, visibility, status,
        summary, tags, curation_model, curated_at,
        created_at, updated_at
      FROM posts 
      WHERE user_id = ?
    `;
    const params: (string | number)[] = [auth.userId];
    
    // Status filter
    if (status && ['pending', 'approved', 'rejected', 'curated'].includes(status)) {
      query += ` AND status = ?`;
      params.push(status);
    }
    
    // Tag filter (JSON search)
    if (tag) {
      query += ` AND json_extract(tags, '$') LIKE ?`;
      params.push(`%"${tag}"%`);
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const { results } = await c.env.DB.prepare(query).bind(...params).all();

    // Parse tags JSON
    const posts = (results || []).map((post: Record<string, unknown>) => ({
      ...post,
      tags: post.tags ? JSON.parse(post.tags as string) : [],
    }));

    return c.json({ 
      posts,
      pagination: {
        limit,
        offset,
        hasMore: posts.length === limit,
      },
    });
  } catch (error) {
    console.error('[POSTS] List error:', error);
    return c.json({ error: 'Failed to fetch posts' }, 500);
  }
});

/**
 * GET /api/posts/feed - Public feed of curated posts
 * Shows public posts from all users
 */
postsRoutes.get('/feed', async (c) => {
  const tag = c.req.query('tag');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');
  
  try {
    let query = `
      SELECT 
        p.id, p.user_id, p.content, p.visibility, p.status,
        p.summary, p.tags, p.curated_at, p.created_at
      FROM posts p
      WHERE p.visibility = 'public' 
        AND p.status = 'curated'
    `;
    const params: (string | number)[] = [];
    
    // Tag filter
    if (tag) {
      query += ` AND json_extract(p.tags, '$') LIKE ?`;
      params.push(`%"${tag}"%`);
    }
    
    query += ` ORDER BY p.curated_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const { results } = await c.env.DB.prepare(query).bind(...params).all();

    const posts = (results || []).map((post: Record<string, unknown>) => ({
      ...post,
      tags: post.tags ? JSON.parse(post.tags as string) : [],
    }));

    return c.json({ 
      posts,
      pagination: {
        limit,
        offset,
        hasMore: posts.length === limit,
      },
    });
  } catch (error) {
    console.error('[POSTS] Feed error:', error);
    return c.json({ error: 'Failed to fetch feed' }, 500);
  }
});

/**
 * GET /api/posts/tags - List all tags with counts
 */
postsRoutes.get('/tags', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT name, post_count 
       FROM tags 
       WHERE post_count > 0
       ORDER BY post_count DESC 
       LIMIT ?`
    ).bind(limit).all();

    return c.json({ tags: results || [] });
  } catch (error) {
    console.error('[POSTS] Tags list error:', error);
    return c.json({ error: 'Failed to fetch tags' }, 500);
  }
});

/**
 * GET /api/posts/:id - Get specific post (requires auth for private posts)
 */
postsRoutes.get('/:id', async (c) => {
  const postId = c.req.param('id');
  
  // Try to get auth context (optional)
  let userId: string | null = null;
  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const auth = getAuthContext(c);
      userId = auth?.userId ?? null;
    }
  } catch {
    // No auth, continue as anonymous
  }
  
  try {
    const post = await c.env.DB.prepare(
      `SELECT 
        id, user_id, content, visibility, status,
        summary, tags, safety_check, curation_model,
        curated_at, version, created_at, updated_at
       FROM posts 
       WHERE id = ?`
    ).bind(postId).first<Record<string, unknown>>();

    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    // Check visibility permissions
    if (post.visibility !== 'public') {
      if (!userId || post.user_id !== userId) {
        return c.json({ error: 'Access denied' }, 403);
      }
    }

    // Parse JSON fields
    const enrichedPost = {
      ...post,
      tags: post.tags ? JSON.parse(post.tags as string) : [],
      safety_check: post.safety_check ? JSON.parse(post.safety_check as string) : null,
    };

    return c.json(enrichedPost);
  } catch (error) {
    console.error('[POSTS] Get error:', error);
    return c.json({ error: 'Failed to fetch post' }, 500);
  }
});

/**
 * PUT /api/posts/:id - Update post content (requires auth, triggers re-curation)
 */
postsRoutes.put('/:id', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const postId = c.req.param('id');
  
  try {
    const { content, visibility } = await c.req.json();
    
    // Verify ownership
    const existing = await c.env.DB.prepare(
      `SELECT user_id, content, visibility FROM posts WHERE id = ?`
    ).bind(postId).first<{ user_id: string; content: string; visibility: string }>();
    
    if (!existing) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    if (existing.user_id !== auth.userId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Prepare update
    const newContent = content ?? existing.content;
    const newVisibility = visibility ?? existing.visibility;
    
    if (newContent.length > 5000) {
      return c.json({ error: 'Content too long (max 5000 characters)' }, 400);
    }
    
    // If content changed, re-run curation
    if (content && content !== existing.content) {
      // Reset to pending for re-curation
      await c.env.DB.prepare(
        `UPDATE posts 
         SET content = ?, visibility = ?, status = 'pending', 
             summary = NULL, tags = NULL, embedding_id = NULL,
             updated_at = ?
         WHERE id = ?`
      ).bind(newContent, newVisibility, Date.now(), postId).run();
      
      // Re-run pipeline
      const pipelineResult = await runCurationPipeline(
        c.env.AI,
        c.env.POST_VECTORS ?? null,
        postId,
        newContent,
        auth.userId,
        newVisibility,
        { userRole: auth.role }
      );
      
      await updatePostCuration(c.env.DB, postId, pipelineResult);
      
      if (pipelineResult.status === 'rejected') {
        return c.json({
          error: 'Updated content rejected',
          reason: pipelineResult.safety.reason,
        }, 422);
      }
    } else {
      // Just update visibility
      await c.env.DB.prepare(
        `UPDATE posts SET visibility = ?, updated_at = ? WHERE id = ?`
      ).bind(newVisibility, Date.now(), postId).run();
    }
    
    // Fetch updated post
    const updated = await c.env.DB.prepare(
      `SELECT * FROM posts WHERE id = ?`
    ).bind(postId).first();
    
    return c.json(updated);
    
  } catch (error) {
    console.error('[POSTS] Update error:', error);
    return c.json({ error: 'Failed to update post' }, 500);
  }
});

/**
 * DELETE /api/posts/:id - Delete post (requires auth)
 */
postsRoutes.delete('/:id', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const postId = c.req.param('id');
  
  try {
    // Get post to check ownership and remove from vectorize
    const post = await c.env.DB.prepare(
      `SELECT user_id, embedding_id FROM posts WHERE id = ?`
    ).bind(postId).first<{ user_id: string; embedding_id: string | null }>();
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    if (post.user_id !== auth.userId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Remove from vectorize index if indexed
    if (post.embedding_id && c.env.POST_VECTORS) {
      try {
        await c.env.POST_VECTORS.deleteByIds([postId]);
      } catch (vectorError) {
        console.error('[POSTS] Failed to remove from vectorize:', vectorError);
        // Continue with deletion anyway
      }
    }
    
    // Delete post (cascades to related tables)
    await c.env.DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(postId).run();

    return c.json({ success: true, id: postId });
  } catch (error) {
    console.error('[POSTS] Delete error:', error);
    return c.json({ error: 'Failed to delete post' }, 500);
  }
});

/**
 * POST /api/posts/:id/recurate - Manually trigger re-curation (requires auth)
 */
postsRoutes.post('/:id/recurate', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const postId = c.req.param('id');
  
  try {
    const post = await c.env.DB.prepare(
      `SELECT user_id, content, visibility FROM posts WHERE id = ?`
    ).bind(postId).first<{ user_id: string; content: string; visibility: string }>();
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    if (post.user_id !== auth.userId && auth.role !== 'admin') {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Re-run pipeline
    const pipelineResult = await runCurationPipeline(
      c.env.AI,
      c.env.POST_VECTORS ?? null,
      postId,
      post.content,
      post.user_id,
      post.visibility,
      { userRole: auth.role }
    );
    
    await updatePostCuration(c.env.DB, postId, pipelineResult);
    
    return c.json({
      success: true,
      status: pipelineResult.status,
      summary: pipelineResult.curation?.summary,
      tags: pipelineResult.curation?.tags,
      processingTimeMs: pipelineResult.totalProcessingTimeMs,
    });
    
  } catch (error) {
    console.error('[POSTS] Recurate error:', error);
    return c.json({ error: 'Failed to recurate post' }, 500);
  }
});

export default postsRoutes;
