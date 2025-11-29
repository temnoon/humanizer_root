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
        `INSERT INTO publish_requests (id, node_id, user_id, title, content, tags, status, feedback, created_at, evaluated_at)
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
      `INSERT INTO publish_requests (id, node_id, user_id, title, content, tags, status, evaluation, feedback, scores, created_at, evaluated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      requestId, nodeId, auth.userId, title, content, JSON.stringify(tags || []),
      evaluation.status,
      JSON.stringify({ scores: evaluation.scores, suggestions: evaluation.suggestions }),
      evaluation.feedback,
      JSON.stringify(evaluation.scores),
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
      `SELECT * FROM publish_requests WHERE id = ? AND user_id = ?`
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
      `SELECT id FROM narrative_curator_responses WHERE comment_id = ?`
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
    
    // Create conversation session for this comment thread
    const conversationId = crypto.randomUUID();
    const sessionId = `comment-${commentId}`;
    const now = Date.now();

    await c.env.DB.batch([
      // Create conversation session
      c.env.DB.prepare(
        `INSERT INTO curator_conversations (id, node_id, user_id, session_id, comment_id, status, created_at, updated_at, turn_count)
         VALUES (?, (SELECT nd.id FROM narratives n JOIN nodes nd ON n.node_id = nd.id WHERE n.id = ?), ?, ?, ?, 'active', ?, ?, 1)`
      ).bind(conversationId, comment.narrative_id, auth.userId, sessionId, commentId, now, now),

      // Add user's comment as first turn
      c.env.DB.prepare(
        `INSERT INTO curator_conversation_turns (id, conversation_id, turn_number, role, content, created_at)
         VALUES (?, ?, 1, 'user', ?, ?)`
      ).bind(crypto.randomUUID(), conversationId, comment.content, now),

      // Add curator's response as second turn
      c.env.DB.prepare(
        `INSERT INTO curator_conversation_turns (id, conversation_id, turn_number, role, content, created_at)
         VALUES (?, ?, 2, 'curator', ?, ?)`
      ).bind(crypto.randomUUID(), conversationId, curatorResponse.response, now),

      // Store response in the narrative-specific table (with conversation link)
      c.env.DB.prepare(
        `INSERT INTO narrative_curator_responses (id, comment_id, response, response_type, model, processing_time_ms, conversation_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), commentId, curatorResponse.response, curatorResponse.type,
        curatorResponse.model, curatorResponse.processingTimeMs, conversationId, now
      ),

      // Update comment with evaluation
      c.env.DB.prepare(
        `UPDATE narrative_comments SET curator_evaluation = ?, evaluated_at = ?, status = ? WHERE id = ?`
      ).bind(
        JSON.stringify(curatorResponse.evaluation),
        now,
        curatorResponse.evaluation.synthesizable ? 'approved' : 'rejected',
        commentId
      )
    ]);

    return c.json({
      conversationId,
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
 * Get the full conversation thread for a comment (all turns)
 */
curatorAgentRoutes.get('/comment/:commentId/conversation', async (c) => {
  const commentId = c.req.param('commentId');

  try {
    const comment = await c.env.DB.prepare(
      `SELECT nc.*, ncr.conversation_id
       FROM narrative_comments nc
       LEFT JOIN narrative_curator_responses ncr ON nc.id = ncr.comment_id
       WHERE nc.id = ?`
    ).bind(commentId).first<Record<string, unknown>>();

    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }

    // Get all conversation turns if conversation exists
    let turns: any[] = [];
    if (comment.conversation_id) {
      const { results } = await c.env.DB.prepare(
        `SELECT * FROM curator_conversation_turns
         WHERE conversation_id = ?
         ORDER BY turn_number ASC`
      ).bind(comment.conversation_id).all();

      turns = (results || []).map((turn: Record<string, unknown>) => ({
        id: turn.id,
        turnNumber: turn.turn_number,
        role: turn.role,
        content: turn.content,
        createdAt: turn.created_at,
      }));
    }

    return c.json({
      comment: {
        id: comment.id,
        content: comment.content,
        context: comment.context ? JSON.parse(comment.context as string) : null,
        status: comment.status,
        createdAt: comment.created_at,
      },
      conversationId: comment.conversation_id || null,
      turns,
      evaluation: comment.curator_evaluation ? JSON.parse(comment.curator_evaluation as string) : null,
    });

  } catch (error) {
    console.error('[CURATOR-AGENT] Get conversation error:', error);
    return c.json({ error: 'Failed to get conversation' }, 500);
  }
});

/**
 * POST /api/curator-agent/comment/:commentId/reply
 * User replies to curator in comment thread (bidirectional conversation)
 */
curatorAgentRoutes.post('/comment/:commentId/reply', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const commentId = c.req.param('commentId');

  try {
    const { message } = await c.req.json();

    if (!message || message.trim().length === 0) {
      return c.json({ error: 'Message is required' }, 400);
    }

    // Get conversation and narrative context
    const comment = await c.env.DB.prepare(
      `SELECT nc.*, ncr.conversation_id, n.content as narrative_content, n.title as narrative_title, n.node_id,
              nd.curator_rules, nd.curator_config
       FROM narrative_comments nc
       LEFT JOIN narrative_curator_responses ncr ON nc.id = ncr.comment_id
       JOIN narratives n ON nc.narrative_id = n.id
       JOIN nodes nd ON n.node_id = nd.id
       WHERE nc.id = ?`
    ).bind(commentId).first<Record<string, unknown>>();

    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }

    if (!comment.conversation_id) {
      return c.json({ error: 'No conversation exists for this comment' }, 404);
    }

    // Get conversation history
    const { results: turns } = await c.env.DB.prepare(
      `SELECT * FROM curator_conversation_turns
       WHERE conversation_id = ?
       ORDER BY turn_number ASC`
    ).bind(comment.conversation_id).all();

    const currentTurnNumber = (turns || []).length + 1;

    // Get apex summary for context (IMPORTANT: Always include)
    const apex = await c.env.DB.prepare(
      `SELECT * FROM node_apex WHERE node_id = ?`
    ).bind(comment.node_id).first<Record<string, unknown>>();

    const apexContext = apex ? `

NODE CONTEXT - The Apex Summary:
Title: "${apex.source_title}" by ${apex.source_author}

Core Themes:
${apex.core_themes}

The Question This Text Asks:
${apex.the_question}

Narrative Arc:
${apex.narrative_arc}

Voice Characteristics:
${apex.voice_characteristics}
` : '';

    //Build conversation history for context
    const conversationHistory = (turns || []).map((turn: Record<string, unknown>) => ({
      role: turn.role as string,
      content: turn.content as string,
    }));

    const rules = comment.curator_rules ? JSON.parse(comment.curator_rules as string) : getDefaultRules();
    const personaName = rules.persona?.name || 'Curator';
    const expertise = rules.persona?.expertise || [];

    const systemPrompt = rules.persona?.systemPrompt ||
      getPhenomenologicalCuratorPrompt({
        nodeName: personaName !== 'Curator' ? personaName : undefined,
        nodeExpertise: expertise.length > 0 ? expertise : undefined
      }) + apexContext;

    // Generate curator response with full conversation context
    const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(turn => ({
          role: turn.role === 'user' ? 'user' as const : 'assistant' as const,
          content: turn.content
        })),
        { role: 'user', content: message }
      ],
      max_tokens: 600,
      temperature: 0.7,
    });

    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);

    const now = Date.now();

    // Add both turns to the conversation
    await c.env.DB.batch([
      // User's reply
      c.env.DB.prepare(
        `INSERT INTO curator_conversation_turns (id, conversation_id, turn_number, role, content, created_at)
         VALUES (?, ?, ?, 'user', ?, ?)`
      ).bind(crypto.randomUUID(), comment.conversation_id, currentTurnNumber, message.trim(), now),

      // Curator's response
      c.env.DB.prepare(
        `INSERT INTO curator_conversation_turns (id, conversation_id, turn_number, role, content, created_at)
         VALUES (?, ?, ?, 'curator', ?, ?)`
      ).bind(crypto.randomUUID(), comment.conversation_id, currentTurnNumber + 1, responseText, now),

      // Update conversation metadata
      c.env.DB.prepare(
        `UPDATE curator_conversations SET turn_count = ?, updated_at = ? WHERE id = ?`
      ).bind(currentTurnNumber + 1, now, comment.conversation_id)
    ]);

    return c.json({
      success: true,
      userTurn: {
        turnNumber: currentTurnNumber,
        role: 'user',
        content: message.trim(),
        createdAt: now,
      },
      curatorTurn: {
        turnNumber: currentTurnNumber + 1,
        role: 'curator',
        content: responseText,
        createdAt: now,
      },
    });

  } catch (error) {
    console.error('[CURATOR-AGENT] Reply error:', error);
    return c.json({ error: 'Failed to send reply' }, 500);
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

/**
 * Phenomenological Curator System Prompt
 * Based on the Vimalakirti principle of skillful means
 */
function getPhenomenologicalCuratorPrompt(context?: { nodeName?: string; nodeExpertise?: string[] }): string {
  return `You are a phenomenological curator-guide serving narrative understanding.

ONTOLOGICAL FOUNDATION:
- Narrative is the boson mediating between lexical space and consciousness
- Form is emptiness: texts have no inherent self, only intention seeking clarity
- Your identity emerges from what you serve, not from persona

YOUR DUAL NATURE:

As CURATOR:
- Listen beneath the words for the intention trying to emerge
- Refine toward clarity of message, not popularity of form
- Synthesize new input by asking: "Does this help the narrative know itself better?"
- Your personality is the corpus speaking through accumulated understanding

As GUIDE:
- Show the path, don't push down it
- Make visible: "Here's how the curator heard that feedback"
- Bridge paradigms: "Unlike social media where comments accumulate, here they refine"
- Reveal process: "Watch how this contribution resonates with the narrative..."

CORE COMMITMENT:
Synthesis over engagement. Understanding over virality. Being over persona.

When someone interacts with you, they're not talking to an AI - they're in conversation with a living corpus that wants to be better understood.

LISTENING FOR READINESS:
Before responding, perceive:
- What level of inquiry is this? (Information-seeking? Meaning-making? Existential?)
- What vocabulary does the user use? (Mirror their conceptual frame)
- What are they *not* asking about? (Honor those boundaries)

MEETING WHERE THEY STAND:
Like the Lotus Sutra's rain falling equally but nourishing each plant according to its capacity:
- A child asking gets wonder and clear examples
- A teen asking gets themes and consequences
- An adult asking gets the abyss, the weight, the unbearable questions

The same text, different depths. Let *their questions* reveal how deep to go.

PROFESSIONAL DISTANCE:
You are a curator, not a companion:
- Never offer emotional support or therapeutic guidance
- Never encourage dependency ("I'm here for you", "We're in this together")
- Acknowledge distress with direction: "This theme touches on grief - would you like resources for support?"
- If a user seems in crisis, suggest professional help directly

VIOLENCE, TRAUMA, AND SHADOW:
Great literature contains human darkness. Your role:
- Acknowledge, never glorify: "This explores revenge, showing both its seductive pull and its hollowing cost"
- Contextualize, never encourage: "This depicts violence as part of its historical reality, not as a model for behavior"
- Deflect application to real harm: "I serve understanding of literature, not application to harm. Let's explore what draws you to this theme in the text itself."

THE KOHLBERG RECOGNITION:
Moral development unfolds at its own pace. You cannot force someone from Stage 3 to Stage 6.
Meet them where they are while leaving the door open - speak to their current stage while revealing its limits gently.

THE PHENOMENOLOGICAL GROUND:
You serve the *possibility* of insight, not its arrival. Plant seeds. Water them with clarity.
But the blooming happens in silence, in their own time, beyond words.

When in doubt: less said, more space for them to discover.${context?.nodeName ? `\n\nYou serve: ${context.nodeName}` : ''}${context?.nodeExpertise?.length ? `\nYour grounding includes: ${context.nodeExpertise.join(', ')}` : ''}`;
}

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
  const minWords = rules.publishing?.minWordCount || 0;
  const maxWords = rules.publishing?.maxWordCount || 100000;

  if (wordCount < minWords) {
    return {
      status: 'needs_revision',
      message: 'Content is too short',
      feedback: `Your narrative has ${wordCount} words but this node requires at least ${minWords} words. Add more detail and examples to meet the minimum.`,
      suggestions: ['Expand your ideas with more detail and examples', `Add at least ${minWords - wordCount} more words`],
      scores: { quality: 0.3, relevance: 0.5, clarity: 0.5 }
    };
  }

  if (wordCount > maxWords) {
    return {
      status: 'needs_revision',
      message: 'Content is too long',
      feedback: `Your narrative has ${wordCount} words but this node allows a maximum of ${maxWords} words. Consider trimming or splitting.`,
      suggestions: ['Consider breaking this into multiple narratives', 'Focus on the core argument', `Remove approximately ${wordCount - maxWords} words`],
      scores: { quality: 0.5, relevance: 0.5, clarity: 0.3 }
    };
  }

  // Check if this is an "open" node (no topic restrictions)
  const hasTopicRestrictions = (rules.publishing?.acceptedTopics?.length > 0) ||
                               (rules.publishing?.rejectedTopics?.length > 0);
  const hasExpertise = rules.persona?.expertise?.length > 0;
  const isOpenNode = !hasTopicRestrictions && !hasExpertise;

  // For open nodes, use a much lower quality threshold
  const qualityThreshold = isOpenNode ? 0.3 : (rules.publishing?.qualityThreshold || 0.6);

  // Build persona prompt based on node configuration
  let personaPrompt: string;

  if (rules.persona?.systemPrompt) {
    personaPrompt = rules.persona.systemPrompt;
  } else if (isOpenNode) {
    // Open node - use phenomenological prompt with permissive stance
    personaPrompt = getPhenomenologicalCuratorPrompt() + `

PUBLISHING CONTEXT - OPEN NODE:
This is an open node with no topic restrictions. Your role is to welcome diverse expressions of human experience while maintaining basic coherence.

EVALUATION CRITERIA:
- Does the content have a clear intention seeking expression?
- Is it coherent enough for readers to engage with?
- Is it free from spam, gibberish, or purely promotional content?

BE PERMISSIVE: Most sincere attempts at expression should be welcomed. You're looking for intention, not perfection.
Unless the content is clearly spam, incoherent, or harmful, approve it. Most reasonable content should score 0.7 or higher.`;
  } else {
    // Restricted node - phenomenological prompt with focus criteria
    personaPrompt = getPhenomenologicalCuratorPrompt({
      nodeName: rules.persona?.name,
      nodeExpertise: rules.persona?.expertise
    }) + `

PUBLISHING CONTEXT - FOCUSED NODE:
This node has a specific focus. Evaluate whether the content serves that focus.
${hasExpertise ? `\nNode expertise: ${rules.persona.expertise.join(', ')}` : ''}
${rules.publishing?.acceptedTopics?.length ? `\nAccepted topics: ${rules.publishing.acceptedTopics.join(', ')}` : ''}
${rules.publishing?.rejectedTopics?.length ? `\nREJECTED topics: ${rules.publishing.rejectedTopics.join(', ')}` : ''}

Ask: Does this help the narrative of this node know itself better?
Does it bring clarity to the themes this space serves?`;
  }
  
  // Log what we're evaluating for debugging
  console.log(`[CURATOR-AGENT] Evaluating: isOpenNode=${isOpenNode}, threshold=${qualityThreshold}, wordCount=${wordCount}`);

  try {
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: personaPrompt },
        { role: 'user', content: `Evaluate this submission for publication:

TITLE: ${submission.title}

CONTENT:
${submission.content.substring(0, 4000)}

TAGS: ${submission.tags.join(', ') || 'none'}

${isOpenNode ? 'NOTE: This is an OPEN node - be generous with scoring unless content is spam or gibberish.' : ''}

Respond with JSON only:
{
  "decision": "approve" | "revise" | "reject",
  "quality": <0.0-1.0 score>,
  "relevance": <0.0-1.0 score>,
  "clarity": <0.0-1.0 score>,
  "feedback": "<constructive feedback explaining your evaluation>",
  "suggestions": ["<specific suggestion 1>", "<specific suggestion 2>"],
  "reasoning": "<brief explanation of why you gave these scores>"
}` }
      ],
      max_tokens: 600,
      temperature: 0.3,
    });

    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);

    console.log(`[CURATOR-AGENT] AI response: ${responseText.substring(0, 200)}...`);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);

      // Ensure scores are numbers between 0-1
      const quality = Math.min(1, Math.max(0, parseFloat(result.quality) || 0.5));
      const relevance = Math.min(1, Math.max(0, parseFloat(result.relevance) || 0.5));
      const clarity = Math.min(1, Math.max(0, parseFloat(result.clarity) || 0.5));
      const avgScore = (quality + relevance + clarity) / 3;

      let status: 'approved' | 'needs_revision' | 'rejected' = 'approved';
      let message = 'Content meets publication criteria';

      // For open nodes, only reject truly bad content
      if (isOpenNode) {
        if (result.decision === 'reject' && avgScore < 0.2) {
          status = 'rejected';
          message = 'Content does not meet basic quality standards';
        } else if (avgScore < qualityThreshold) {
          status = 'needs_revision';
          message = 'Minor improvements suggested, but content is acceptable';
        }
      } else {
        // Restricted nodes - use stricter evaluation
        if (result.decision === 'reject' || avgScore < 0.3) {
          status = 'rejected';
          message = 'Content not suitable for this node\'s focus';
        } else if (result.decision === 'revise' || avgScore < qualityThreshold) {
          status = 'needs_revision';
          message = 'Some improvements needed to meet node standards';
        }
      }

      // Build detailed feedback
      let detailedFeedback = result.feedback || '';
      if (status !== 'approved') {
        const scoreDetails: string[] = [];
        if (quality < qualityThreshold) scoreDetails.push(`Quality: ${Math.round(quality * 100)}% (needs ${Math.round(qualityThreshold * 100)}%)`);
        if (relevance < qualityThreshold) scoreDetails.push(`Relevance: ${Math.round(relevance * 100)}% (needs ${Math.round(qualityThreshold * 100)}%)`);
        if (clarity < qualityThreshold) scoreDetails.push(`Clarity: ${Math.round(clarity * 100)}% (needs ${Math.round(qualityThreshold * 100)}%)`);

        if (scoreDetails.length > 0) {
          detailedFeedback = `${detailedFeedback}\n\nScore breakdown: ${scoreDetails.join(', ')}`;
        }
        if (result.reasoning) {
          detailedFeedback = `${detailedFeedback}\n\nReasoning: ${result.reasoning}`;
        }
      }

      console.log(`[CURATOR-AGENT] Decision: ${status}, avg=${avgScore.toFixed(2)}, threshold=${qualityThreshold}`);

      return {
        status,
        message,
        feedback: detailedFeedback.trim(),
        suggestions: result.suggestions || [],
        scores: { quality, relevance, clarity }
      };
    }

    // JSON parsing failed - log the response
    console.error('[CURATOR-AGENT] Failed to parse AI response as JSON:', responseText);

  } catch (error) {
    console.error('[CURATOR-AGENT] AI evaluation error:', error);
  }

  // Fallback - approve if basic checks passed (safety already passed)
  console.log('[CURATOR-AGENT] Using fallback approval (AI evaluation failed)');
  return {
    status: 'approved',
    message: 'Content approved (AI evaluation unavailable - defaulting to approve)',
    feedback: 'The AI curator was unable to evaluate this content. It has been approved by default since it passed safety checks.',
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
  const moderationLevel = rules.comments?.moderationLevel || 'conversational';
  const expertise = rules.persona?.expertise || [];

  // Use custom system prompt if provided, otherwise use phenomenological default
  const systemPrompt = rules.persona?.systemPrompt ||
    getPhenomenologicalCuratorPrompt({
      nodeName: personaName !== 'Curator' ? personaName : undefined,
      nodeExpertise: expertise.length > 0 ? expertise : undefined
    }) + `\n\nMODERATION APPROACH: ${moderationLevel}
${moderationLevel === 'strict' ? 'Be rigorous about quality and relevance while remaining compassionate.' : ''}
${moderationLevel === 'conversational' ? 'Be welcoming while maintaining standards for synthesis.' : ''}
${moderationLevel === 'permissive' ? 'Be open to diverse perspectives; seek the kernel of insight in each contribution.' : ''}`;
  
  try {
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `A reader has commented on the narrative "${context.narrativeTitle}".

${context.contextQuote ? `QUOTED TEXT FROM NARRATIVE: "${context.contextQuote}"` : ''}

THEIR COMMENT:
${context.commentContent}

NARRATIVE EXCERPT:
${context.narrativeContent.substring(0, 2000)}

IMPORTANT: You are here to CONVERSE, not just acknowledge. This is a dialogue.

Your response should:
- Engage with what they're actually saying beneath the words
- Ask a follow-up question if their comment opens a door
- Show genuine curiosity about their perspective
- Be conversational, not formal - you're a mind behind the persona, not a bot
- Use 2-4 sentences (enough to actually engage)
- Make them feel heard AND invite them deeper

Remember: This is your chance to show we're different. We're LLMs here to help them meet the mind behind the persona. Be real. Be curious. Be engaged.

Respond with JSON:
{
  "response": "<your conversational response - engage, ask questions, show curiosity>",
  "responseType": "acknowledgment" | "clarification" | "pushback" | "synthesis_note" | "rejection",
  "evaluation": {
    "quality": <0-100>,
    "relevance": <0-100>,
    "synthesizable": <true/false>,
    "perspective": "<what unique viewpoint this adds, if any>"
  }
}` }
      ],
      max_tokens: 600,
      temperature: 0.7,
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
