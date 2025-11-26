// Synthesis routes - Version control for ideas
import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';
import { 
  synthesizeDiscussion, 
  approveSynthesizedVersion, 
  getVersionHistory,
  checkSynthesisReady 
} from '../services/synthesis';

const synthesisRoutes = new Hono();

/**
 * POST /api/posts/:postId/synthesize - Manually trigger synthesis
 */
synthesisRoutes.post('/:postId/synthesize', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const postId = c.req.param('postId');
  
  try {
    // Verify post exists and user is author
    const post = await c.env.DB.prepare(
      'SELECT id, user_id FROM posts WHERE id = ?'
    ).bind(postId).first<{ id: string; user_id: string }>();
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    if (post.user_id !== auth.userId && auth.role !== 'admin') {
      return c.json({ error: 'Only post author can trigger synthesis' }, 403);
    }
    
    // Check if ready
    const readiness = await checkSynthesisReady(c.env.DB, postId, 1); // Min 1 comment for manual
    if (!readiness.ready) {
      return c.json({ 
        error: 'No comments to synthesize',
        commentCount: readiness.commentCount 
      }, 400);
    }
    
    // Run synthesis
    const result = await synthesizeDiscussion(c.env.AI, c.env.DB, postId);
    
    if (!result.success) {
      return c.json({ error: result.error || 'Synthesis failed' }, 500);
    }
    
    return c.json({
      success: true,
      versionId: result.versionId,
      version: result.version,
      synthesizedContent: result.synthesizedContent,
      summary: result.summary,
      tags: result.tags,
      model: result.model,
      message: 'Synthesis complete. Review and approve to update post.',
    });
    
  } catch (error) {
    console.error('[SYNTHESIS] Trigger error:', error);
    return c.json({ error: 'Failed to trigger synthesis' }, 500);
  }
});

/**
 * POST /api/posts/:postId/versions/:versionId/approve - Approve synthesized version
 */
synthesisRoutes.post('/:postId/versions/:versionId/approve', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const postId = c.req.param('postId');
  const versionId = c.req.param('versionId');
  
  try {
    // Verify post exists and user is author
    const post = await c.env.DB.prepare(
      'SELECT id, user_id FROM posts WHERE id = ?'
    ).bind(postId).first<{ id: string; user_id: string }>();
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    if (post.user_id !== auth.userId && auth.role !== 'admin') {
      return c.json({ error: 'Only post author can approve versions' }, 403);
    }
    
    const approved = await approveSynthesizedVersion(c.env.DB, versionId, postId);
    
    if (!approved) {
      return c.json({ error: 'Failed to approve version' }, 500);
    }
    
    return c.json({
      success: true,
      message: 'Version approved and post updated',
    });
    
  } catch (error) {
    console.error('[SYNTHESIS] Approve error:', error);
    return c.json({ error: 'Failed to approve version' }, 500);
  }
});

/**
 * GET /api/posts/:postId/versions - Get version history
 */
synthesisRoutes.get('/:postId/versions', async (c) => {
  const postId = c.req.param('postId');
  
  try {
    // Verify post exists
    const post = await c.env.DB.prepare(
      'SELECT id FROM posts WHERE id = ?'
    ).bind(postId).first();
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    const versions = await getVersionHistory(c.env.DB, postId);
    
    return c.json({
      versions,
      totalVersions: versions.length,
    });
    
  } catch (error) {
    console.error('[SYNTHESIS] History error:', error);
    return c.json({ error: 'Failed to fetch version history' }, 500);
  }
});

/**
 * GET /api/posts/:postId/synthesis-status - Check if ready for synthesis
 */
synthesisRoutes.get('/:postId/synthesis-status', async (c) => {
  const postId = c.req.param('postId');
  
  try {
    const status = await checkSynthesisReady(c.env.DB, postId);
    
    return c.json({
      ready: status.ready,
      commentCount: status.commentCount,
      currentVersion: status.currentVersion,
      threshold: 5, // TODO: Make configurable
    });
    
  } catch (error) {
    console.error('[SYNTHESIS] Status error:', error);
    return c.json({ error: 'Failed to check synthesis status' }, 500);
  }
});

export default synthesisRoutes;
