// Narrative Comments API routes
// Comments are synthesis input, not replies
import { Hono } from 'hono';
import { requireAuth, optionalAuth, getAuthContext } from '../middleware/auth';

const narrativeCommentsRoutes = new Hono();

/**
 * POST /api/narratives/:narrativeId/comments - Post comment on narrative
 */
narrativeCommentsRoutes.post('/:narrativeId/comments', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const narrativeId = c.req.param('narrativeId');
  
  try {
    // Get narrative with current version
    const narrative = await c.env.DB.prepare(
      `SELECT n.id, n.node_id, n.current_version, n.title, n.synthesis,
              nd.creator_user_id as node_creator
       FROM narratives n
       JOIN nodes nd ON n.node_id = nd.id
       WHERE n.id = ?`
    ).bind(narrativeId).first<Record<string, unknown>>();
    
    if (!narrative) {
      return c.json({ error: 'Narrative not found' }, 404);
    }
    
    const { content, context } = await c.req.json();

    if (!content || content.trim().length === 0) {
      return c.json({ error: 'Content is required' }, 400);
    }

    if (content.length > 5000) {
      return c.json({ error: 'Comment too long (max 5000 characters)' }, 400);
    }

    const commentId = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(
      `INSERT INTO narrative_comments (id, narrative_id, version, author_user_id, content, context, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(
      commentId,
      narrativeId,
      narrative.current_version,
      auth.userId,
      content.trim(),
      context ? JSON.stringify(context) : null,
      now
    ).run();

    // Update synthesis pending count
    const synthesis = narrative.synthesis ? JSON.parse(narrative.synthesis as string) : { status: 'none', pendingComments: 0 };
    synthesis.pendingComments = (synthesis.pendingComments || 0) + 1;
    
    await c.env.DB.prepare(
      `UPDATE narratives SET synthesis = ? WHERE id = ?`
    ).bind(JSON.stringify(synthesis), narrativeId).run();

    return c.json({
      comment: {
        id: commentId,
        narrativeId,
        version: narrative.current_version,
        authorUserId: auth.userId,
        content: content.trim(),
        context: context || null,
        status: 'pending',
        createdAt: now,
      }
    }, 201);
    
  } catch (error) {
    console.error('[NARRATIVE_COMMENTS] Create error:', error);
    return c.json({ error: 'Failed to create comment' }, 500);
  }
});

/**
 * GET /api/narratives/:narrativeId/comments - List comments on narrative
 */
narrativeCommentsRoutes.get('/:narrativeId/comments', optionalAuth(), async (c) => {
  const auth = getAuthContext(c);
  const narrativeId = c.req.param('narrativeId');
  const status = c.req.query('status');
  const version = c.req.query('version');
  
  try {
    // Check narrative access
    const narrative = await c.env.DB.prepare(
      `SELECT n.visibility, nd.creator_user_id as node_creator
       FROM narratives n
       JOIN nodes nd ON n.node_id = nd.id
       WHERE n.id = ?`
    ).bind(narrativeId).first<{ visibility: string; node_creator: string }>();
    
    if (!narrative) {
      return c.json({ error: 'Narrative not found' }, 404);
    }
    
    const isOwner = auth?.userId === narrative.node_creator;
    
    if (narrative.visibility !== 'public' && !isOwner) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    let query = `
      SELECT nc.*,
             ncr.response as curator_response_text,
             ncr.response_type as curator_response_type,
             ncr.created_at as curator_responded_at
      FROM narrative_comments nc
      LEFT JOIN narrative_curator_responses ncr ON nc.id = ncr.comment_id
      WHERE nc.narrative_id = ?
    `;
    const params: (string | number)[] = [narrativeId];

    // Filter by status
    if (status && ['pending', 'approved', 'synthesized', 'rejected'].includes(status)) {
      query += ` AND nc.status = ?`;
      params.push(status);
    } else if (!isOwner) {
      // Non-owners only see approved or synthesized comments
      query += ` AND nc.status IN ('approved', 'synthesized')`;
    }

    // Filter by version
    if (version) {
      query += ` AND nc.version = ?`;
      params.push(parseInt(version));
    }

    query += ` ORDER BY nc.created_at DESC`;

    const { results } = await c.env.DB.prepare(query).bind(...params).all();

    const comments = (results || []).map((comment: Record<string, unknown>) => ({
      id: comment.id,
      narrativeId: comment.narrative_id,
      version: comment.version,
      authorUserId: comment.author_user_id,
      content: comment.content,
      context: comment.context ? JSON.parse(comment.context as string) : null,
      status: comment.status,
      // Only show curator evaluation to owner
      ...(isOwner && comment.curator_evaluation && {
        curatorEvaluation: JSON.parse(comment.curator_evaluation as string),
      }),
      // Include curator response if exists
      ...(comment.curator_response_text && {
        curatorResponse: {
          response: comment.curator_response_text,
          type: comment.curator_response_type,
          respondedAt: comment.curator_responded_at,
        }
      }),
      synthesizedInVersion: comment.synthesized_in_version,
      createdAt: comment.created_at,
      evaluatedAt: comment.evaluated_at,
      synthesizedAt: comment.synthesized_at,
    }));

    return c.json({ comments });
  } catch (error) {
    console.error('[NARRATIVE_COMMENTS] List error:', error);
    return c.json({ error: 'Failed to fetch comments' }, 500);
  }
});

/**
 * POST /api/narrative-comments/:id/evaluate - Curator evaluates comment (Node owner only)
 */
narrativeCommentsRoutes.post('/:id/evaluate', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const commentId = c.req.param('id');
  
  try {
    // Get comment with ownership check
    const comment = await c.env.DB.prepare(
      `SELECT nc.*, nd.creator_user_id as node_creator
       FROM narrative_comments nc
       JOIN narratives n ON nc.narrative_id = n.id
       JOIN nodes nd ON n.node_id = nd.id
       WHERE nc.id = ?`
    ).bind(commentId).first<Record<string, unknown>>();
    
    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }
    
    if (comment.node_creator !== auth.userId) {
      return c.json({ error: 'Only Node owner can evaluate comments' }, 403);
    }
    
    const { quality, relevance, perspective, synthesisNotes, status } = await c.req.json();
    
    const validStatuses = ['approved', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      return c.json({ error: 'Status must be "approved" or "rejected"' }, 400);
    }
    
    const evaluation = {
      quality: quality ?? 0.5,
      relevance: relevance ?? 0.5,
      perspective: perspective || '',
      synthesisNotes: synthesisNotes || '',
    };
    
    const now = Date.now();
    
    await c.env.DB.prepare(
      `UPDATE narrative_comments 
       SET curator_evaluation = ?, status = ?, evaluated_at = ?
       WHERE id = ?`
    ).bind(
      JSON.stringify(evaluation),
      status || 'approved',
      now,
      commentId
    ).run();

    return c.json({
      comment: {
        id: commentId,
        status: status || 'approved',
        curatorEvaluation: evaluation,
        evaluatedAt: now,
      },
    });
  } catch (error) {
    console.error('[NARRATIVE_COMMENTS] Evaluate error:', error);
    return c.json({ error: 'Failed to evaluate comment' }, 500);
  }
});

/**
 * GET /api/narrative-comments/:id - Get single comment
 */
narrativeCommentsRoutes.get('/:id', optionalAuth(), async (c) => {
  const auth = getAuthContext(c);
  const commentId = c.req.param('id');
  
  try {
    const comment = await c.env.DB.prepare(
      `SELECT nc.*, nd.creator_user_id as node_creator, n.visibility
       FROM narrative_comments nc
       JOIN narratives n ON nc.narrative_id = n.id
       JOIN nodes nd ON n.node_id = nd.id
       WHERE nc.id = ?`
    ).bind(commentId).first<Record<string, unknown>>();
    
    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }
    
    const isOwner = auth?.userId === comment.node_creator;
    
    // Non-owners can only see approved/synthesized comments on public narratives
    if (!isOwner) {
      if (comment.visibility !== 'public') {
        return c.json({ error: 'Access denied' }, 403);
      }
      if (!['approved', 'synthesized'].includes(comment.status as string)) {
        return c.json({ error: 'Comment not found' }, 404);
      }
    }

    return c.json({
      comment: {
        id: comment.id,
        narrativeId: comment.narrative_id,
        version: comment.version,
        authorUserId: comment.author_user_id,
        content: comment.content,
        context: comment.context ? JSON.parse(comment.context as string) : null,
        status: comment.status,
        ...(isOwner && comment.curator_evaluation && {
          curatorEvaluation: JSON.parse(comment.curator_evaluation as string),
        }),
        synthesizedInVersion: comment.synthesized_in_version,
        createdAt: comment.created_at,
        evaluatedAt: comment.evaluated_at,
        synthesizedAt: comment.synthesized_at,
      },
    });
  } catch (error) {
    console.error('[NARRATIVE_COMMENTS] Get error:', error);
    return c.json({ error: 'Failed to fetch comment' }, 500);
  }
});

/**
 * DELETE /api/narrative-comments/:id - Delete comment (author or Node owner)
 */
narrativeCommentsRoutes.delete('/:id', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const commentId = c.req.param('id');
  
  try {
    const comment = await c.env.DB.prepare(
      `SELECT nc.author_user_id, nc.narrative_id, nc.status, nd.creator_user_id as node_creator
       FROM narrative_comments nc
       JOIN narratives n ON nc.narrative_id = n.id
       JOIN nodes nd ON n.node_id = nd.id
       WHERE nc.id = ?`
    ).bind(commentId).first<Record<string, unknown>>();
    
    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }
    
    // Allow deletion by author or node owner
    if (comment.author_user_id !== auth.userId && comment.node_creator !== auth.userId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Can't delete synthesized comments
    if (comment.status === 'synthesized') {
      return c.json({ error: 'Cannot delete synthesized comments' }, 400);
    }
    
    await c.env.DB.prepare(
      `DELETE FROM narrative_comments WHERE id = ?`
    ).bind(commentId).run();
    
    // Update synthesis pending count if was pending
    if (comment.status === 'pending') {
      await c.env.DB.prepare(
        `UPDATE narratives 
         SET synthesis = json_set(
           COALESCE(synthesis, '{}'),
           '$.pendingComments', MAX(0, COALESCE(json_extract(synthesis, '$.pendingComments'), 0) - 1)
         )
         WHERE id = ?`
      ).bind(comment.narrative_id).run();
    }

    return c.json({ success: true, id: commentId });
  } catch (error) {
    console.error('[NARRATIVE_COMMENTS] Delete error:', error);
    return c.json({ error: 'Failed to delete comment' }, 500);
  }
});

export default narrativeCommentsRoutes;
