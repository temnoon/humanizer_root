// Comments API routes
// Threaded discussion on posts

import { Hono } from 'hono';
import { requireAuth, optionalAuth, getAuthContext } from '../middleware/auth';
import { synthesizeDiscussion, checkSynthesisReady } from '../services/synthesis';

const commentsRoutes = new Hono();

/**
 * POST /api/posts/:postId/comments - Add comment to post
 */
commentsRoutes.post('/:postId/comments', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const postId = c.req.param('postId');
  
  try {
    const { content } = await c.req.json();
    
    if (!content || content.trim().length === 0) {
      return c.json({ error: 'Content is required' }, 400);
    }
    
    if (content.length > 2000) {
      return c.json({ error: 'Content too long (max 2000 characters)' }, 400);
    }
    
    // Verify post exists
    const post = await c.env.DB.prepare(
      'SELECT id, user_id FROM posts WHERE id = ?'
    ).bind(postId).first();
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    const commentId = crypto.randomUUID();
    const now = Date.now();
    
    // Insert comment
    await c.env.DB.prepare(
      `INSERT INTO comments (id, post_id, user_id, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(commentId, postId, auth.userId, content, now, now).run();
    
    // Get comment count for this post
    const { count } = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM comments WHERE post_id = ?'
    ).bind(postId).first<{ count: number }>();
    
    // Check if we should auto-trigger synthesis
    const synthesisThreshold = 5; // TODO: Make configurable
    const readiness = await checkSynthesisReady(c.env.DB, postId, synthesisThreshold);
    
    let synthesisTriggered = false;
    if (readiness.ready && readiness.commentCount === synthesisThreshold) {
      // Trigger synthesis in background (don't wait for result)
      synthesizeDiscussion(c.env.AI, c.env.DB, postId).catch(err => {
        console.error('[COMMENTS] Auto-synthesis error:', err);
      });
      synthesisTriggered = true;
    }
    
    return c.json({
      id: commentId,
      post_id: postId,
      user_id: auth.userId,
      user_email: auth.email,
      content,
      created_at: now,
      updated_at: now,
      meta: {
        totalComments: count || 0,
        synthesisThreshold,
        synthesisReady: readiness.ready,
        synthesisTriggered,
      },
    }, 201);
    
  } catch (error) {
    console.error('[COMMENTS] Create error:', error);
    return c.json({ error: 'Failed to create comment' }, 500);
  }
});

/**
 * GET /api/posts/:postId/comments - Get all comments for a post
 */
commentsRoutes.get('/:postId/comments', optionalAuth(), async (c) => {
  const postId = c.req.param('postId');
  
  try {
    // Verify post exists and user can view it
    const post = await c.env.DB.prepare(
      'SELECT id, visibility, user_id FROM posts WHERE id = ?'
    ).bind(postId).first<{ id: string; visibility: string; user_id: string }>();
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    // Check visibility permissions
    let userId: string | null = null;
    try {
      const auth = getAuthContext(c);
      userId = auth?.userId ?? null;
    } catch {
      // Anonymous access
    }
    
    if (post.visibility === 'private' && post.user_id !== userId) {
      return c.json({ error: 'Post not accessible' }, 403);
    }
    
    // Fetch comments ordered by creation time
    const { results: comments } = await c.env.DB.prepare(
      `SELECT id, post_id, user_id, content, created_at, updated_at
       FROM comments
       WHERE post_id = ?
       ORDER BY created_at ASC`
    ).bind(postId).all<Record<string, unknown>>();
    
    return c.json({
      comments: comments || [],
      totalComments: comments?.length || 0,
    });
    
  } catch (error) {
    console.error('[COMMENTS] List error:', error);
    return c.json({ error: 'Failed to fetch comments' }, 500);
  }
});

/**
 * PUT /api/comments/:commentId - Update comment (own comments only)
 */
commentsRoutes.put('/comments/:commentId', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const commentId = c.req.param('commentId');
  
  try {
    const { content } = await c.req.json();
    
    if (!content || content.trim().length === 0) {
      return c.json({ error: 'Content is required' }, 400);
    }
    
    if (content.length > 2000) {
      return c.json({ error: 'Content too long (max 2000 characters)' }, 400);
    }
    
    // Verify comment exists and belongs to user
    const comment = await c.env.DB.prepare(
      'SELECT id, user_id FROM comments WHERE id = ?'
    ).bind(commentId).first<{ id: string; user_id: string }>();
    
    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }
    
    if (comment.user_id !== auth.userId) {
      return c.json({ error: 'Not authorized to edit this comment' }, 403);
    }
    
    const now = Date.now();
    
    await c.env.DB.prepare(
      'UPDATE comments SET content = ?, updated_at = ? WHERE id = ?'
    ).bind(content, now, commentId).run();
    
    return c.json({
      id: commentId,
      content,
      updated_at: now,
    });
    
  } catch (error) {
    console.error('[COMMENTS] Update error:', error);
    return c.json({ error: 'Failed to update comment' }, 500);
  }
});

/**
 * DELETE /api/comments/:commentId - Delete comment (own comments only, or post author)
 */
commentsRoutes.delete('/comments/:commentId', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const commentId = c.req.param('commentId');
  
  try {
    // Get comment with post info
    const comment = await c.env.DB.prepare(
      `SELECT c.id, c.user_id, p.user_id as post_author
       FROM comments c
       JOIN posts p ON c.post_id = p.id
       WHERE c.id = ?`
    ).bind(commentId).first<{ id: string; user_id: string; post_author: string }>();
    
    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }
    
    // Allow deletion if user is comment author OR post author
    if (comment.user_id !== auth.userId && comment.post_author !== auth.userId) {
      return c.json({ error: 'Not authorized to delete this comment' }, 403);
    }
    
    await c.env.DB.prepare(
      'DELETE FROM comments WHERE id = ?'
    ).bind(commentId).run();
    
    return c.json({ success: true });
    
  } catch (error) {
    console.error('[COMMENTS] Delete error:', error);
    return c.json({ error: 'Failed to delete comment' }, 500);
  }
});

export default commentsRoutes;
