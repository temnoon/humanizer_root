// Admin routes for pipeline monitoring and management
// Requires admin role for most operations

import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';
import { getPipelineStats } from '../services/pipeline';
import { listModels, validateConfig, ACTIVE_CONFIG } from '../config/ai-models';

const adminRoutes = new Hono();

/**
 * Middleware to require admin role
 */
const requireAdmin = () => {
  return requireAuth({ roles: ['admin'] });
};

/**
 * GET /api/admin/stats - Get pipeline statistics
 */
adminRoutes.get('/stats', requireAdmin(), async (c) => {
  try {
    const stats = await getPipelineStats(c.env.DB);
    
    // Get recent queue items
    const { results: recentQueue } = await c.env.DB.prepare(
      `SELECT post_id, status, stage, error_message, queued_at, completed_at
       FROM curation_queue
       ORDER BY queued_at DESC
       LIMIT 20`
    ).all();
    
    return c.json({
      posts: stats,
      recentQueue: recentQueue || [],
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[ADMIN] Stats error:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

/**
 * GET /api/admin/config - Get current AI configuration
 */
adminRoutes.get('/config', requireAdmin(), (c) => {
  const validation = validateConfig();
  
  return c.json({
    active: ACTIVE_CONFIG,
    validation,
    availableModels: {
      safety: listModels('safety'),
      curation: listModels('curation'),
      embedding: listModels('embedding'),
    },
    features: {
      vectorize: !!c.env.POST_VECTORS,
      queue: !!c.env.CURATION_QUEUE,
    },
  });
});

/**
 * GET /api/admin/queue - List curation queue items
 */
adminRoutes.get('/queue', requireAdmin(), async (c) => {
  const status = c.req.query('status'); // queued, processing, completed, failed
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  
  try {
    let query = `
      SELECT q.*, p.content, p.user_id
      FROM curation_queue q
      JOIN posts p ON q.post_id = p.id
    `;
    const params: (string | number)[] = [];
    
    if (status && ['queued', 'processing', 'completed', 'failed'].includes(status)) {
      query += ` WHERE q.status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY q.queued_at DESC LIMIT ?`;
    params.push(limit);
    
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    
    return c.json({ queue: results || [] });
  } catch (error) {
    console.error('[ADMIN] Queue error:', error);
    return c.json({ error: 'Failed to fetch queue' }, 500);
  }
});

/**
 * POST /api/admin/retry/:postId - Retry failed curation
 */
adminRoutes.post('/retry/:postId', requireAdmin(), async (c) => {
  const postId = c.req.param('postId');
  
  try {
    // Get post
    const post = await c.env.DB.prepare(
      `SELECT id, user_id, content, visibility, status 
       FROM posts WHERE id = ?`
    ).bind(postId).first<{
      id: string;
      user_id: string;
      content: string;
      visibility: string;
      status: string;
    }>();
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    // Import pipeline to avoid circular deps
    const { runCurationPipeline, updatePostCuration, trackCurationQueue } = 
      await import('../services/pipeline');
    
    // Re-queue and process
    await trackCurationQueue(c.env.DB, postId, 'queued');
    
    const result = await runCurationPipeline(
      c.env.AI,
      c.env.POST_VECTORS ?? null,
      post.id,
      post.content,
      post.user_id,
      post.visibility,
      { skipSafety: post.status === 'approved' } // Skip safety if already approved
    );
    
    await updatePostCuration(c.env.DB, postId, result);
    await trackCurationQueue(c.env.DB, postId, 'completed');
    
    return c.json({
      success: true,
      postId,
      newStatus: result.status,
      summary: result.curation?.summary,
      tags: result.curation?.tags,
    });
    
  } catch (error) {
    console.error('[ADMIN] Retry error:', error);
    return c.json({ error: 'Retry failed' }, 500);
  }
});

/**
 * POST /api/admin/batch-retry - Retry all failed posts
 */
adminRoutes.post('/batch-retry', requireAdmin(), async (c) => {
  try {
    // Get failed posts
    const { results: failed } = await c.env.DB.prepare(
      `SELECT p.id, p.user_id, p.content, p.visibility
       FROM posts p
       JOIN curation_queue q ON p.id = q.post_id
       WHERE q.status = 'failed'
       LIMIT 50`
    ).all<{
      id: string;
      user_id: string;
      content: string;
      visibility: string;
    }>();
    
    if (!failed || failed.length === 0) {
      return c.json({ message: 'No failed posts to retry', retried: 0 });
    }
    
    const { runCurationPipeline, updatePostCuration, trackCurationQueue } = 
      await import('../services/pipeline');
    
    let retried = 0;
    const errors: Array<{ postId: string; error: string }> = [];
    
    for (const post of failed) {
      try {
        await trackCurationQueue(c.env.DB, post.id, 'queued');
        
        const result = await runCurationPipeline(
          c.env.AI,
          c.env.POST_VECTORS ?? null,
          post.id,
          post.content,
          post.user_id,
          post.visibility
        );
        
        await updatePostCuration(c.env.DB, post.id, result);
        await trackCurationQueue(c.env.DB, post.id, 'completed');
        retried++;
      } catch (err) {
        errors.push({ 
          postId: post.id, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
      }
    }
    
    return c.json({
      retried,
      total: failed.length,
      errors: errors.length > 0 ? errors : undefined,
    });
    
  } catch (error) {
    console.error('[ADMIN] Batch retry error:', error);
    return c.json({ error: 'Batch retry failed' }, 500);
  }
});

/**
 * DELETE /api/admin/queue/clear - Clear completed queue items
 */
adminRoutes.delete('/queue/clear', requireAdmin(), async (c) => {
  try {
    const result = await c.env.DB.prepare(
      `DELETE FROM curation_queue WHERE status = 'completed'`
    ).run();
    
    return c.json({ 
      success: true, 
      deleted: result.meta.changes,
    });
  } catch (error) {
    console.error('[ADMIN] Clear queue error:', error);
    return c.json({ error: 'Failed to clear queue' }, 500);
  }
});

/**
 * GET /api/admin/posts/rejected - List rejected posts
 */
adminRoutes.get('/posts/rejected', requireAdmin(), async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, user_id, content, safety_check, created_at, updated_at
       FROM posts
       WHERE status = 'rejected'
       ORDER BY updated_at DESC
       LIMIT ?`
    ).bind(limit).all<Record<string, unknown>>();
    
    const posts = (results || []).map(post => ({
      ...post,
      safety_check: post.safety_check ? JSON.parse(post.safety_check as string) : null,
    }));
    
    return c.json({ posts });
  } catch (error) {
    console.error('[ADMIN] Rejected posts error:', error);
    return c.json({ error: 'Failed to fetch rejected posts' }, 500);
  }
});

/**
 * POST /api/admin/posts/:id/approve - Manually approve a rejected post
 */
adminRoutes.post('/posts/:id/approve', requireAdmin(), async (c) => {
  const postId = c.req.param('id');
  
  try {
    const post = await c.env.DB.prepare(
      `SELECT id, status, content, user_id, visibility FROM posts WHERE id = ?`
    ).bind(postId).first<{
      id: string;
      status: string;
      content: string;
      user_id: string;
      visibility: string;
    }>();
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    if (post.status !== 'rejected') {
      return c.json({ error: 'Post is not rejected' }, 400);
    }
    
    // Re-run curation skipping safety
    const { runCurationPipeline, updatePostCuration } = 
      await import('../services/pipeline');
    
    const result = await runCurationPipeline(
      c.env.AI,
      c.env.POST_VECTORS ?? null,
      post.id,
      post.content,
      post.user_id,
      post.visibility,
      { skipSafety: true }
    );
    
    await updatePostCuration(c.env.DB, postId, result);
    
    return c.json({
      success: true,
      postId,
      newStatus: result.status,
    });
    
  } catch (error) {
    console.error('[ADMIN] Approve error:', error);
    return c.json({ error: 'Failed to approve post' }, 500);
  }
});

export default adminRoutes;
