/**
 * Curator Agent Routes
 * 
 * The AI Curator as an active agent that:
 * 1. Gates narrative publishing against node rules
 * 2. Responds to comments in conversation
 * 3. Compiles synthesis suggestions from approved comments
 * 4. Manages curator rules configuration
 */

import { Hono } from 'hono';
import { requireAuth, getAuthContext, isOwnerOrWheel } from '../middleware/auth';
import { checkSafety } from '../services/safety-gate';

const curatorAgentRoutes = new Hono();

// ==========================================
// CURATOR RULES MANAGEMENT
// ==========================================

/**
 * GET /api/curator-agent/node/:nodeId/rules
 * Get the curator rules for a node
 */
curatorAgentRoutes.get('/node/:nodeId/rules', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const nodeId = c.req.param('nodeId');
  
  try {
    const node = await c.env.DB.prepare(
      `SELECT id, name, creator_user_id, curator_rules, curator_config
       FROM nodes WHERE id = ? AND status = 'active'`
    ).bind(nodeId).first<Record<string, unknown>>();
    
    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }
    
    // Only creator or wheel can view full rules
    if (!isOwnerOrWheel(c, node.creator_user_id as string)) {
      // Return public summary for non-owners
      const rules = node.curator_rules ? JSON.parse(node.curator_rules as string) : {};
      return c.json({
        nodeId: node.id,
        nodeName: node.name,
        publicGuidelines: {
          acceptedTopics: rules.publishing?.acceptedTopics || [],
          minWordCount: rules.publishing?.minWordCount || 0,
          requiresApproval: rules.publishing?.requireApproval || false,
        }
      });
    }
    
    return c.json({
      nodeId: node.id,
      nodeName: node.name,
      rules: node.curator_rules ? JSON.parse(node.curator_rules as string) : getDefaultRules(),
      config: node.curator_config ? JSON.parse(node.curator_config as string) : {},
    });
    
  } catch (error) {
    console.error('[CURATOR-AGENT] Get rules error:', error);
    return c.json({ error: 'Failed to get rules' }, 500);
  }
});

/**
 * PUT /api/curator-agent/node/:nodeId/rules
 * Update curator rules for a node (owner only)
 */
curatorAgentRoutes.put('/node/:nodeId/rules', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const nodeId = c.req.param('nodeId');
  
  try {
    // Verify ownership
    const node = await c.env.DB.prepare(
      `SELECT creator_user_id FROM nodes WHERE id = ? AND status = 'active'`
    ).bind(nodeId).first<{ creator_user_id: string }>();
    
    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }
    
    if (!isOwnerOrWheel(c, node.creator_user_id)) {
      return c.json({ error: 'Only node creator or admin can update rules' }, 403);
    }
    
    const rules = await c.req.json();
    const validatedRules = validateRules(rules);
    
    await c.env.DB.prepare(
      `UPDATE nodes SET curator_rules = ?, updated_at = ? WHERE id = ?`
    ).bind(JSON.stringify(validatedRules), Date.now(), nodeId).run();
    
    return c.json({ success: true, rules: validatedRules });
    
  } catch (error) {
    console.error('[CURATOR-AGENT] Update rules error:', error);
    return c.json({ error: 'Failed to update rules' }, 500);
  }
});

// ==========================================
// PRE-PUBLISH APPROVAL
// ==========================================

/**
 * POST /api/curator-agent/pre-publish-check
 * Evaluate content before publishing to a node
 * Returns approval status and curator feedback
 */
curatorAgentRoutes.post('/pre-publish-check', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  
  try {
    const { nodeId, title, content, tags } = await c.req.json();
    
    if (!nodeId || !title || !content) {
      return c.json({ error: 'nodeId, title, and content are required' }, 400);
    }
    
    // Get node and rules
    const node = await c.env.DB.prepare(
      `SELECT id, name, creator_user_id, curator_rules, curator_config
       FROM nodes WHERE id = ? AND status = 'active'`
    ).bind(nodeId).first<Record<string, unknown>>();
    
    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }
    
    const rules = node.curator_rules ? JSON.parse(node.curator_rules as string) : getDefaultRules();
    const config = node.curator_config ? JSON.parse(node.curator_config as string) : {};
    
    // Auto-approve if creator and rule allows
    if (node.creator_user_id === auth.userId && rules.publishing?.autoApproveCreator) {
      return c.json({
        status: 'approved',
        message: 'Auto-approved for node creator',
        canPublish: true,
      });
    }
    
    // Safety check first
    const safetyResult = await checkSafety(c.env.AI, content);
    if (!safetyResult.safe) {
      // Create rejected publish request
      const requestId = crypto.randomUUID();
      await c.env.DB.prepare(
        `INSERT INTO publish_requests (id, node_id, author_user_id, title, content, tags, status, feedback, created_at, evaluated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'rejected', ?, ?, ?)`
      ).bind(
        requestId, nodeId, auth.userId, title, content, JSON.stringify(tags || []),
        'Content flagged by safety check: ' + (safetyResult.category || 'unspecified concern'),
        Date.now(), Date.now()
      ).run();
      
      return c.json({
        status: 'rejected',
        requestId,
        message: 'Content does not meet safety guidelines',
        canPublish: false,
        feedback: safetyResult.reason || 'Please review content for potential issues.',
      });
    }
    
    // Run curator evaluation
    const evaluation = await evaluateForPublishing(
      c.env.AI,
      { title, content, tags: tags || [] },
      rules,
      config
    );
    
    // Create publish request record
    const requestId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO publish_requests (id, node_id, author_user_id, title, content, tags, status, evaluation, feedback, suggestions, created_at, evaluated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      requestId, nodeId, auth.userId, title, content, JSON.stringify(tags || []),
      evaluation.status,
      JSON.stringify(evaluation.scores),
      evaluation.feedback,
      JSON.stringify(evaluation.suggestions),
      Date.now(), Date.now()
    ).run();
    
    return c.json({
      status: evaluation.status,
      requestId,
      message: evaluation.message,
      canPublish: evaluation.status === 'approved',
      feedback: evaluation.feedback,
      suggestions: evaluation.suggestions,
      scores: evaluation.scores,
    });
    
  } catch (error) {
    console.error('[CURATOR-AGENT] Pre-publish check error:', error);
    return c.json({ error: 'Evaluation failed' }, 500);
  }
});

/**
 * POST /api/curator-agent/publish-request/:requestId/publish
 * Publish an approved request
 */
curatorAgentRoutes.post('/publish-request/:requestId/publish', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const requestId = c.req.param('requestId');
  
  try {
    // Get the request
    const request = await c.env.DB.prepare(
      `SELECT * FROM publish_requests WHERE id = ? AND author_user_id = ?`
    ).bind(requestId, auth.userId).first<Record<string, unknown>>();
    
    if (!request) {
      return c.json({ error: 'Publish request not found' }, 404);
    }
    
    if (request.status !== 'approved') {
      return c.json({ 
        error: 'Cannot publish - request is ' + request.status,
        status: request.status,
        feedback: request.feedback 
      }, 400);
    }
    
    if (request.narrative_id) {
      return c.json({ error: 'Already published', narrativeId: request.narrative_id }, 400);
    }
    
    // Create the narrative
    const narrativeId = crypto.randomUUID();
    const slug = generateSlug(request.title as string);
    const now = Date.now();
    const tags = request.tags ? JSON.parse(request.tags as string) : [];
    
    await c.env.DB.batch([
      // Create narrative
      c.env.DB.prepare(
        `INSERT INTO narratives (id, node_id, title, slug, content, current_version, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
      ).bind(
        narrativeId, request.node_id, request.title, slug, request.content,
        JSON.stringify({ tags, wordCount: (request.content as string).split(/\s+/).length }),
        now, now
      ),
      
      // Create initial version
      c.env.DB.prepare(
        `INSERT INTO narrative_versions (id, narrative_id, version, content, changes, trigger_info, created_at)
         VALUES (?, ?, 1, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), narrativeId, request.content,
        JSON.stringify({ summary: 'Initial publication' }),
        JSON.stringify({ type: 'initial', actor: auth.userId }),
        now
      ),
      
      // Update publish request
      c.env.DB.prepare(
        `UPDATE publish_requests SET narrative_id = ?, published_at = ? WHERE id = ?`
      ).bind(narrativeId, now, requestId),
      
      // Update node metadata
      c.env.DB.prepare(
        `UPDATE nodes SET 
         archive_metadata = json_set(archive_metadata, '$.lastPublished', ?),
         updated_at = ?
         WHERE id = ?`
      ).bind(new Date(now).toISOString(), now, request.node_id)
    ]);
    
    return c.json({
      success: true,
      narrativeId,
      slug,
      message: 'Narrative published successfully'
    });
    
  } catch (error) {
    console.error('[CURATOR-AGENT] Publish error:', error);
    return c.json({ error: 'Failed to publish' }, 500);
  }
});

// ==========================================
// COMMENT CONVERSATION
// ==========================================

/**
 * POST /api/curator-agent/comment/:commentId/respond
 * Generate and store curator response to a comment
 */
curatorAgentRoutes.post('/comment/:commentId/respond', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const commentId = c.req.param('commentId');
  
  try {
    // Get comment with narrative and node context
    const comment = await c.env.DB.prepare(
      `SELECT nc.*, n.content as narrative_content, n.title as narrative_title,
              nd.curator_rules, nd.curator_config, nd.creator_user_id as node_creator
       FROM narrative_comments nc
       JOIN narratives n ON nc.narrative_id = n.id
       JOIN nodes nd ON n.node_id = nd.id
       WHERE nc.id = ?`
    ).bind(commentId).first<Record<string, unknown>>();
    
    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }
    
    // Check if already responded
    const existingResponse = await c.env.DB.prepare(
      `SELECT id FROM curator_responses WHERE comment_id = ?`
    ).bind(commentId).first();
    
    if (existingResponse) {
      return c.json({ error: 'Curator has already responded to this comment' }, 400);
    }
    
    const rules = comment.curator_rules ? JSON.parse(comment.curator_rules as string) : getDefaultRules();
    const config = comment.curator_config ? JSON.parse(comment.curator_config as string) : {};
    
    // Generate curator response
    const curatorResponse = await generateCuratorCommentResponse(
      c.env.AI,
      {
        commentContent: comment.content as string,
        narrativeTitle: comment.narrative_title as string,
        narrativeContent: comment.narrative_content as string,
        contextQuote: comment.context ? JSON.parse(comment.context as string).quotedText : null,
      },
      rules,
      config
    );
    
    // Store response
    const responseId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO curator_responses (id, comment_id, response, response_type, model, processing_time_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      responseId, commentId, curatorResponse.response, curatorResponse.type,
      curatorResponse.model, curatorResponse.processingTimeMs, Date.now()
    ).run();
    
    // Update comment with evaluation
    await c.env.DB.prepare(
      `UPDATE narrative_comments SET curator_evaluation = ?, evaluated_at = ?, status = ? WHERE id = ?`
    ).bind(
      JSON.stringify(curatorResponse.evaluation),
      Date.now(),
      curatorResponse.evaluation.synthesizable ? 'approved' : 'rejected',
      commentId
    ).run();
    
    return c.json({
      responseId,
      response: curatorResponse.response,
      responseType: curatorResponse.type,
      evaluation: curatorResponse.evaluation,
    });
    
  } catch (error) {
    console.error('[CURATOR-AGENT] Comment response error:', error);
    return c.json({ error: 'Failed to generate response' }, 500);
  }
});

/**
 * GET /api/curator-agent/comment/:commentId/conversation
 * Get the full conversation thread for a comment
 */
curatorAgentRoutes.get('/comment/:commentId/conversation', async (c) => {
  const commentId = c.req.param('commentId');
  
  try {
    const comment = await c.env.DB.prepare(
      `SELECT nc.*, cr.response as curator_response, cr.response_type, cr.created_at as response_at
       FROM narrative_comments nc
       LEFT JOIN curator_responses cr ON nc.id = cr.comment_id
       WHERE nc.id = ?`
    ).bind(commentId).first<Record<string, unknown>>();
    
    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }
    
    return c.json({
      comment: {
        id: comment.id,
        content: comment.content,
        context: comment.context ? JSON.parse(comment.context as string) : null,
        status: comment.status,
        createdAt: comment.created_at,
      },
      curatorResponse: comment.curator_response ? {
        response: comment.curator_response,
        type: comment.response_type,
        respondedAt: comment.response_at,
      } : null,
      evaluation: comment.curator_evaluation ? JSON.parse(comment.curator_evaluation as string) : null,
    });
    
  } catch (error) {
    console.error('[CURATOR-AGENT] Get conversation error:', error);
    return c.json({ error: 'Failed to get conversation' }, 500);
  }
});

// ==========================================
// SYNTHESIS MANAGEMENT
// ==========================================

/**
 * POST /api/curator-agent/narrative/:narrativeId/compile-synthesis
 * Compile approved comments into a synthesis suggestion
 */
curatorAgentRoutes.post('/narrative/:narrativeId/compile-synthesis', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const narrativeId = c.req.param('narrativeId');
  
  try {
    // Get narrative with node info
    const narrative = await c.env.DB.prepare(
      `SELECT n.*, nd.curator_rules, nd.curator_config, nd.creator_user_id
       FROM narratives n
       JOIN nodes nd ON n.node_id = nd.id
       WHERE n.id = ?`
    ).bind(narrativeId).first<Record<string, unknown>>();
    
    if (!narrative) {
      return c.json({ error: 'Narrative not found' }, 404);
    }
    
    // Only node creator or wheel can trigger synthesis
    if (!isOwnerOrWheel(c, narrative.creator_user_id as string)) {
      return c.json({ error: 'Only node creator or admin can compile synthesis' }, 403);
    }
    
    // Get approved comments not yet synthesized
    const { results: comments } = await c.env.DB.prepare(
      `SELECT * FROM narrative_comments 
       WHERE narrative_id = ? AND status = 'approved' AND synthesized_in_version IS NULL
       ORDER BY created_at ASC`
    ).bind(narrativeId).all();
    
    if (!comments || comments.length === 0) {
      return c.json({ error: 'No approved comments to synthesize' }, 400);
    }
    
    const rules = narrative.curator_rules ? JSON.parse(narrative.curator_rules as string) : getDefaultRules();
    
    // Check minimum threshold
    if (comments.length < (rules.comments?.synthesisThreshold || 1)) {
      return c.json({ 
        error: `Need at least ${rules.comments?.synthesisThreshold || 1} approved comments`,
        currentCount: comments.length 
      }, 400);
    }
    
    // Generate synthesis
    const synthesis = await compileSynthesis(
      c.env.AI,
      narrative.content as string,
      narrative.title as string,
      comments.map((c: any) => ({
        id: c.id,
        content: c.content,
        evaluation: c.curator_evaluation ? JSON.parse(c.curator_evaluation) : null,
      })),
      rules
    );
    
    // Create synthesis task
    const taskId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO synthesis_tasks 
       (id, narrative_id, status, comment_ids, suggestion, reasoning, proposed_changes, proposed_content, diff_summary, created_at)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      taskId, narrativeId,
      JSON.stringify(comments.map((c: any) => c.id)),
      synthesis.suggestion,
      synthesis.reasoning,
      JSON.stringify(synthesis.changes),
      synthesis.proposedContent,
      JSON.stringify(synthesis.diff),
      Date.now()
    ).run();
    
    return c.json({
      taskId,
      commentCount: comments.length,
      suggestion: synthesis.suggestion,
      reasoning: synthesis.reasoning,
      changes: synthesis.changes,
      diff: synthesis.diff,
    });
    
  } catch (error) {
    console.error('[CURATOR-AGENT] Compile synthesis error:', error);
    return c.json({ error: 'Failed to compile synthesis' }, 500);
  }
});

/**
 * GET /api/curator-agent/narrative/:narrativeId/synthesis-tasks
 * List synthesis tasks for a narrative
 */
curatorAgentRoutes.get('/narrative/:narrativeId/synthesis-tasks', requireAuth(), async (c) => {
  const narrativeId = c.req.param('narrativeId');
  
  try {
    const { results: tasks } = await c.env.DB.prepare(
      `SELECT * FROM synthesis_tasks WHERE narrative_id = ? ORDER BY created_at DESC`
    ).bind(narrativeId).all();
    
    return c.json({
      tasks: (tasks || []).map((t: any) => ({
        id: t.id,
        status: t.status,
        commentCount: JSON.parse(t.comment_ids || '[]').length,
        suggestion: t.suggestion,
        reasoning: t.reasoning,
        changes: JSON.parse(t.proposed_changes || '[]'),
        createdAt: t.created_at,
        reviewedAt: t.reviewed_at,
        appliedVersion: t.applied_version,
      }))
    });
    
  } catch (error) {
    console.error('[CURATOR-AGENT] List synthesis tasks error:', error);
    return c.json({ error: 'Failed to list tasks' }, 500);
  }
});

/**
 * POST /api/curator-agent/synthesis/:taskId/apply
 * Apply a synthesis task, creating a new narrative version
 */
curatorAgentRoutes.post('/synthesis/:taskId/apply', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const taskId = c.req.param('taskId');
  
  try {
    const { customContent } = await c.req.json().catch(() => ({}));
    
    // Get task with narrative info
    const task = await c.env.DB.prepare(
      `SELECT st.*, n.id as narrative_id, n.current_version, n.content as current_content,
              nd.creator_user_id
       FROM synthesis_tasks st
       JOIN narratives n ON st.narrative_id = n.id
       JOIN nodes nd ON n.node_id = nd.id
       WHERE st.id = ?`
    ).bind(taskId).first<Record<string, unknown>>();
    
    if (!task) {
      return c.json({ error: 'Synthesis task not found' }, 404);
    }
    
    if (!isOwnerOrWheel(c, task.creator_user_id as string)) {
      return c.json({ error: 'Only node creator or admin can apply synthesis' }, 403);
    }
    
    if (task.status !== 'pending' && task.status !== 'approved') {
      return c.json({ error: 'Task cannot be applied - status: ' + task.status }, 400);
    }
    
    const newVersion = (task.current_version as number) + 1;
    const newContent = customContent || task.proposed_content;
    const now = Date.now();
    const commentIds = JSON.parse(task.comment_ids as string);
    
    await c.env.DB.batch([
      // Create new version
      c.env.DB.prepare(
        `INSERT INTO narrative_versions (id, narrative_id, version, content, changes, trigger_info, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        task.narrative_id,
        newVersion,
        newContent,
        JSON.stringify({
          summary: task.suggestion,
          reasoning: task.reasoning,
          ...JSON.parse(task.diff_summary as string || '{}')
        }),
        JSON.stringify({
          type: 'comment-synthesis',
          actor: 'ai-curator',
          taskId: taskId,
          commentIds
        }),
        now
      ),
      
      // Update narrative
      c.env.DB.prepare(
        `UPDATE narratives SET content = ?, current_version = ?, updated_at = ?,
         synthesis = json_set(synthesis, '$.status', 'completed', '$.lastSynthesized', ?)
         WHERE id = ?`
      ).bind(newContent, newVersion, now, new Date(now).toISOString(), task.narrative_id),
      
      // Update task
      c.env.DB.prepare(
        `UPDATE synthesis_tasks SET status = 'applied', applied_at = ?, applied_version = ? WHERE id = ?`
      ).bind(now, newVersion, taskId),
      
      // Mark comments as synthesized
      ...commentIds.map((commentId: string) =>
        c.env.DB.prepare(
          `UPDATE narrative_comments SET status = 'synthesized', synthesized_in_version = ?, synthesized_at = ? WHERE id = ?`
        ).bind(newVersion, now, commentId)
      )
    ]);
    
    return c.json({
      success: true,
      newVersion,
      synthesizedComments: commentIds.length,
      message: `Created version ${newVersion} with ${commentIds.length} synthesized comments`
    });
    
  } catch (error) {
    console.error('[CURATOR-AGENT] Apply synthesis error:', error);
    return c.json({ error: 'Failed to apply synthesis' }, 500);
  }
});

/**
 * POST /api/curator-agent/synthesis/:taskId/reject
 * Reject a synthesis task
 */
curatorAgentRoutes.post('/synthesis/:taskId/reject', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const taskId = c.req.param('taskId');
  
  try {
    const { reason } = await c.req.json().catch(() => ({ reason: '' }));
    
    const task = await c.env.DB.prepare(
      `SELECT st.*, nd.creator_user_id
       FROM synthesis_tasks st
       JOIN narratives n ON st.narrative_id = n.id
       JOIN nodes nd ON n.node_id = nd.id
       WHERE st.id = ?`
    ).bind(taskId).first<Record<string, unknown>>();
    
    if (!task) {
      return c.json({ error: 'Synthesis task not found' }, 404);
    }
    
    if (!isOwnerOrWheel(c, task.creator_user_id as string)) {
      return c.json({ error: 'Only node creator or admin can reject synthesis' }, 403);
    }
    
    await c.env.DB.prepare(
      `UPDATE synthesis_tasks SET status = 'rejected', reviewed_at = ?, rejection_reason = ? WHERE id = ?`
    ).bind(Date.now(), reason, taskId).run();
    
    return c.json({ success: true, message: 'Synthesis rejected' });
    
  } catch (error) {
    console.error('[CURATOR-AGENT] Reject synthesis error:', error);
    return c.json({ error: 'Failed to reject synthesis' }, 500);
  }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getDefaultRules() {
  return {
    publishing: {
      requireApproval: true,
      autoApproveCreator: true,
      minWordCount: 100,
      maxWordCount: 20000,
      requiredElements: [],
      acceptedTopics: [],
      rejectedTopics: [],
      qualityThreshold: 0.6,
    },
    comments: {
      autoRespond: true,
      moderationLevel: 'conversational',
      synthesisThreshold: 3,
      synthesisQualityMin: 0.5,
    },
    persona: {
      name: 'Curator',
      voice: 'thoughtful and constructive',
      expertise: [],
      systemPrompt: '',
    }
  };
}

function validateRules(rules: any): any {
  const defaults = getDefaultRules();
  
  return {
    publishing: {
      requireApproval: rules.publishing?.requireApproval ?? defaults.publishing.requireApproval,
      autoApproveCreator: rules.publishing?.autoApproveCreator ?? defaults.publishing.autoApproveCreator,
      minWordCount: Math.max(0, Math.min(1000, rules.publishing?.minWordCount ?? defaults.publishing.minWordCount)),
      maxWordCount: Math.max(100, Math.min(100000, rules.publishing?.maxWordCount ?? defaults.publishing.maxWordCount)),
      requiredElements: Array.isArray(rules.publishing?.requiredElements) ? rules.publishing.requiredElements : [],
      acceptedTopics: Array.isArray(rules.publishing?.acceptedTopics) ? rules.publishing.acceptedTopics : [],
      rejectedTopics: Array.isArray(rules.publishing?.rejectedTopics) ? rules.publishing.rejectedTopics : [],
      qualityThreshold: Math.max(0, Math.min(1, rules.publishing?.qualityThreshold ?? defaults.publishing.qualityThreshold)),
    },
    comments: {
      autoRespond: rules.comments?.autoRespond ?? defaults.comments.autoRespond,
      moderationLevel: ['strict', 'conversational', 'permissive'].includes(rules.comments?.moderationLevel) 
        ? rules.comments.moderationLevel 
        : defaults.comments.moderationLevel,
      synthesisThreshold: Math.max(1, Math.min(50, rules.comments?.synthesisThreshold ?? defaults.comments.synthesisThreshold)),
      synthesisQualityMin: Math.max(0, Math.min(1, rules.comments?.synthesisQualityMin ?? defaults.comments.synthesisQualityMin)),
    },
    persona: {
      name: rules.persona?.name || defaults.persona.name,
      voice: rules.persona?.voice || defaults.persona.voice,
      expertise: Array.isArray(rules.persona?.expertise) ? rules.persona.expertise : [],
      systemPrompt: rules.persona?.systemPrompt || '',
    }
  };
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

async function evaluateForPublishing(
  ai: Ai,
  submission: { title: string; content: string; tags: string[] },
  rules: any,
  config: any
): Promise<{
  status: 'approved' | 'needs_revision' | 'rejected';
  message: string;
  feedback: string;
  suggestions: string[];
  scores: { quality: number; relevance: number; clarity: number };
}> {
  
  // Basic checks first
  const wordCount = submission.content.split(/\s+/).length;
  
  if (wordCount < (rules.publishing?.minWordCount || 0)) {
    return {
      status: 'needs_revision',
      message: 'Content is too short',
      feedback: `Your narrative has ${wordCount} words but this node requires at least ${rules.publishing.minWordCount} words.`,
      suggestions: ['Expand your ideas with more detail and examples'],
      scores: { quality: 0.3, relevance: 0.5, clarity: 0.5 }
    };
  }
  
  if (wordCount > (rules.publishing?.maxWordCount || 100000)) {
    return {
      status: 'needs_revision',
      message: 'Content is too long',
      feedback: `Your narrative has ${wordCount} words but this node allows a maximum of ${rules.publishing.maxWordCount} words.`,
      suggestions: ['Consider breaking this into multiple narratives', 'Focus on the core argument'],
      scores: { quality: 0.5, relevance: 0.5, clarity: 0.3 }
    };
  }
  
  // AI evaluation
  const personaPrompt = rules.persona?.systemPrompt || 
    `You are a thoughtful curator evaluating content for publication. 
     ${rules.persona?.expertise?.length ? `Your expertise includes: ${rules.persona.expertise.join(', ')}` : ''}
     ${rules.publishing?.acceptedTopics?.length ? `Accepted topics: ${rules.publishing.acceptedTopics.join(', ')}` : ''}
     ${rules.publishing?.rejectedTopics?.length ? `Rejected topics: ${rules.publishing.rejectedTopics.join(', ')}` : ''}`;
  
  try {
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: personaPrompt },
        { role: 'user', content: `Evaluate this submission for publication:

TITLE: ${submission.title}

CONTENT:
${submission.content.substring(0, 4000)}

TAGS: ${submission.tags.join(', ') || 'none'}

QUALITY THRESHOLD: ${rules.publishing?.qualityThreshold || 0.6}

Respond with JSON:
{
  "decision": "approve" | "revise" | "reject",
  "quality": <0-1>,
  "relevance": <0-1>,
  "clarity": <0-1>,
  "feedback": "<constructive feedback for the author>",
  "suggestions": ["<specific suggestion 1>", "<specific suggestion 2>"]
}` }
      ],
      max_tokens: 500,
      temperature: 0.3,
    });
    
    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      const avgScore = (result.quality + result.relevance + result.clarity) / 3;
      let status: 'approved' | 'needs_revision' | 'rejected' = 'approved';
      
      if (result.decision === 'reject' || avgScore < 0.3) {
        status = 'rejected';
      } else if (result.decision === 'revise' || avgScore < (rules.publishing?.qualityThreshold || 0.6)) {
        status = 'needs_revision';
      }
      
      return {
        status,
        message: status === 'approved' ? 'Content meets publication criteria' :
                 status === 'needs_revision' ? 'Some improvements needed' :
                 'Content not suitable for this node',
        feedback: result.feedback || '',
        suggestions: result.suggestions || [],
        scores: {
          quality: result.quality || 0.5,
          relevance: result.relevance || 0.5,
          clarity: result.clarity || 0.5,
        }
      };
    }
  } catch (error) {
    console.error('[CURATOR-AGENT] AI evaluation error:', error);
  }
  
  // Fallback - approve if basic checks passed
  return {
    status: 'approved',
    message: 'Content approved (AI evaluation unavailable)',
    feedback: '',
    suggestions: [],
    scores: { quality: 0.7, relevance: 0.7, clarity: 0.7 }
  };
}

async function generateCuratorCommentResponse(
  ai: Ai,
  context: {
    commentContent: string;
    narrativeTitle: string;
    narrativeContent: string;
    contextQuote: string | null;
  },
  rules: any,
  config: any
): Promise<{
  response: string;
  type: 'acknowledgment' | 'clarification' | 'pushback' | 'synthesis_note' | 'rejection';
  evaluation: { quality: number; relevance: number; synthesizable: boolean; perspective: string };
  model: string;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  
  const personaName = rules.persona?.name || 'Curator';
  const personaVoice = rules.persona?.voice || 'thoughtful and constructive';
  const moderationLevel = rules.comments?.moderationLevel || 'conversational';
  
  const systemPrompt = rules.persona?.systemPrompt || 
    `You are ${personaName}, a curator with a ${personaVoice} voice.
     
     Your role is to:
     1. Acknowledge thoughtful contributions
     2. Ask clarifying questions when needed
     3. Push back constructively on unclear or problematic claims
     4. Note how good comments might be synthesized into the narrative
     
     Moderation style: ${moderationLevel}
     ${moderationLevel === 'strict' ? 'Be rigorous about quality and relevance.' : ''}
     ${moderationLevel === 'conversational' ? 'Be welcoming while maintaining standards.' : ''}
     ${moderationLevel === 'permissive' ? 'Be open to diverse perspectives.' : ''}`;
  
  try {
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `A reader has commented on the narrative "${context.narrativeTitle}".

${context.contextQuote ? `QUOTED TEXT: "${context.contextQuote}"` : ''}

COMMENT: ${context.commentContent}

NARRATIVE EXCERPT:
${context.narrativeContent.substring(0, 2000)}

Respond as the curator. Also evaluate the comment for synthesis potential.

Respond with JSON:
{
  "response": "<your response to the commenter, 1-3 sentences>",
  "responseType": "acknowledgment" | "clarification" | "pushback" | "synthesis_note" | "rejection",
  "evaluation": {
    "quality": <0-100>,
    "relevance": <0-100>,
    "synthesizable": <true/false>,
    "perspective": "<what unique viewpoint this adds, if any>"
  }
}` }
      ],
      max_tokens: 400,
      temperature: 0.5,
    });
    
    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        response: result.response || "Thank you for your contribution.",
        type: result.responseType || 'acknowledgment',
        evaluation: {
          quality: (result.evaluation?.quality || 50) / 100,
          relevance: (result.evaluation?.relevance || 50) / 100,
          synthesizable: result.evaluation?.synthesizable ?? true,
          perspective: result.evaluation?.perspective || '',
        },
        model: '@cf/meta/llama-3.1-8b-instruct',
        processingTimeMs: Date.now() - startTime,
      };
    }
  } catch (error) {
    console.error('[CURATOR-AGENT] Comment response error:', error);
  }
  
  return {
    response: "Thank you for your comment. I'll review it for potential synthesis.",
    type: 'acknowledgment',
    evaluation: { quality: 0.5, relevance: 0.5, synthesizable: true, perspective: '' },
    model: 'fallback',
    processingTimeMs: Date.now() - startTime,
  };
}

async function compileSynthesis(
  ai: Ai,
  narrativeContent: string,
  narrativeTitle: string,
  comments: Array<{ id: string; content: string; evaluation: any }>,
  rules: any
): Promise<{
  suggestion: string;
  reasoning: string;
  changes: string[];
  proposedContent: string;
  diff: { addedSections: number; modifiedSections: number; overview: string };
}> {
  
  const commentsText = comments
    .map((c, i) => `[Comment ${i + 1}] ${c.content}${c.evaluation?.perspective ? ` (Adds: ${c.evaluation.perspective})` : ''}`)
    .join('\n\n');
  
  try {
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: `You synthesize reader comments into narrative improvements.
Preserve the author's voice. Make surgical improvements, not rewrites.
Focus on incorporating the strongest insights from comments.` },
        { role: 'user', content: `NARRATIVE: "${narrativeTitle}"

CURRENT CONTENT:
${narrativeContent.substring(0, 6000)}

COMMENTS TO SYNTHESIZE:
${commentsText}

Create a synthesis that incorporates the best insights from these comments.

Respond with JSON:
{
  "suggestion": "<1-2 paragraph description of proposed changes>",
  "reasoning": "<why these changes improve the narrative>",
  "changes": ["<specific change 1>", "<specific change 2>", ...],
  "proposedContent": "<the full updated narrative content with changes incorporated>"
}` }
      ],
      max_tokens: 4000,
      temperature: 0.4,
    });
    
    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        suggestion: result.suggestion || '',
        reasoning: result.reasoning || '',
        changes: result.changes || [],
        proposedContent: result.proposedContent || narrativeContent,
        diff: {
          addedSections: result.changes?.length || 0,
          modifiedSections: result.changes?.length || 0,
          overview: `${result.changes?.length || 0} improvements from ${comments.length} comments`,
        }
      };
    }
  } catch (error) {
    console.error('[CURATOR-AGENT] Synthesis compilation error:', error);
  }
  
  return {
    suggestion: 'Unable to generate synthesis automatically',
    reasoning: '',
    changes: [],
    proposedContent: narrativeContent,
    diff: { addedSections: 0, modifiedSections: 0, overview: 'No changes' }
  };
}

export default curatorAgentRoutes;
