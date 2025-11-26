// AI Curator Routes
// Real-time AI analysis and suggestions for the Studio
import { Hono } from 'hono';
import { requireAuth, optionalAuth, getAuthContext } from '../middleware/auth';
import { summarizePost, extractTags, curatePost, generateCuratorResponse } from '../services/curation';
import { checkSafety } from '../services/safety-gate';
import { generateEmbedding } from '../services/embeddings';

const curatorRoutes = new Hono();

/**
 * POST /api/curator/analyze - Analyze content for suggestions
 * Returns clarity, depth, coherence metrics + AI suggestions
 */
curatorRoutes.post('/analyze', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  
  try {
    const { content, context } = await c.req.json();
    
    if (!content || content.trim().length < 50) {
      return c.json({ 
        error: 'Content too short',
        message: 'Need at least 50 characters for analysis' 
      }, 400);
    }
    
    // Run safety check first
    const safetyResult = await checkSafety(c.env.AI, content);
    if (!safetyResult.safe) {
      return c.json({
        safe: false,
        message: 'Content may contain problematic elements',
        categories: safetyResult.category ? [safetyResult.category] : [],
      }, 400);
    }
    
    // Analyze content with AI
    const startTime = Date.now();
    
    // Run multiple analyses in parallel
    const [curationResult, embedResult] = await Promise.all([
      curatePost(c.env.AI, content),
      generateEmbedding(c.env.AI, content.substring(0, 2000)) // Limit for embedding
    ]);
    
    // Generate suggestions based on content analysis
    const suggestions = await generateSuggestions(c.env.AI, content, context);
    
    // Calculate metrics (simplified scoring based on content characteristics)
    const metrics = calculateContentMetrics(content);
    
    return c.json({
      analysis: {
        metrics,
        suggestions,
        curation: {
          summary: curationResult.summary,
          tags: curationResult.tags,
        },
        processingTimeMs: Date.now() - startTime,
        model: curationResult.model,
      }
    });
    
  } catch (error) {
    console.error('[CURATOR] Analysis error:', error);
    return c.json({ error: 'Analysis failed' }, 500);
  }
});

/**
 * POST /api/curator/suggest-tags - Get tag suggestions for content
 */
curatorRoutes.post('/suggest-tags', requireAuth(), async (c) => {
  try {
    const { content } = await c.req.json();
    
    if (!content || content.trim().length < 20) {
      return c.json({ tags: [] });
    }
    
    const tagResult = await extractTags(c.env.AI, content);
    
    return c.json({
      tags: tagResult.tags,
      model: tagResult.model,
      processingTimeMs: tagResult.processingTimeMs,
    });
    
  } catch (error) {
    console.error('[CURATOR] Tag suggestion error:', error);
    return c.json({ tags: [], error: 'Failed to suggest tags' });
  }
});

/**
 * POST /api/curator/evaluate-comment - Evaluate a comment for synthesis potential
 */
curatorRoutes.post('/evaluate-comment', requireAuth(), async (c) => {
  try {
    const { comment, narrativeContent, existingComments } = await c.req.json();
    
    if (!comment || !narrativeContent) {
      return c.json({ error: 'Comment and narrative content required' }, 400);
    }
    
    // Safety check the comment
    const safetyResult = await checkSafety(c.env.AI, comment);
    if (!safetyResult.safe) {
      return c.json({
        evaluation: {
          quality: 0,
          relevance: 0,
          synthesizable: false,
          reason: 'Content flagged by safety check',
          categories: safetyResult.category ? [safetyResult.category] : [],
        }
      });
    }
    
    // Evaluate comment quality and relevance
    const evaluation = await evaluateCommentForSynthesis(
      c.env.AI,
      comment,
      narrativeContent,
      existingComments || ''
    );
    
    return c.json({ evaluation });
    
  } catch (error) {
    console.error('[CURATOR] Comment evaluation error:', error);
    return c.json({ error: 'Evaluation failed' }, 500);
  }
});

/**
 * POST /api/curator/respond - Generate curator response to a comment
 */
curatorRoutes.post('/respond', requireAuth(), async (c) => {
  try {
    const { comment, narrativeContent, existingComments } = await c.req.json();
    
    if (!comment || !narrativeContent) {
      return c.json({ error: 'Comment and narrative content required' }, 400);
    }
    
    const response = await generateCuratorResponse(
      c.env.AI,
      narrativeContent,
      existingComments || '',
      comment
    );
    
    return c.json({
      response: response.response,
      model: response.model,
      processingTimeMs: response.processingTimeMs,
    });
    
  } catch (error) {
    console.error('[CURATOR] Response generation error:', error);
    return c.json({ error: 'Failed to generate response' }, 500);
  }
});

/**
 * POST /api/curator/suggest-synthesis - Suggest synthesized content from comments
 */
curatorRoutes.post('/suggest-synthesis', requireAuth(), async (c) => {
  try {
    const { narrativeId, narrativeContent, comments } = await c.req.json();
    
    if (!narrativeContent || !comments || comments.length === 0) {
      return c.json({ error: 'Narrative and comments required' }, 400);
    }
    
    // Format comments for synthesis
    const commentsText = comments
      .map((c: { author?: string; content: string }, i: number) => 
        `Comment ${i + 1}${c.author ? ` (${c.author})` : ''}: ${c.content}`
      )
      .join('\n\n');
    
    // Generate synthesis suggestion
    const synthesis = await generateSynthesisSuggestion(
      c.env.AI,
      narrativeContent,
      commentsText
    );
    
    return c.json({
      suggestion: synthesis.suggestion,
      reasoning: synthesis.reasoning,
      changes: synthesis.changes,
      model: synthesis.model,
      processingTimeMs: synthesis.processingTimeMs,
    });
    
  } catch (error) {
    console.error('[CURATOR] Synthesis suggestion error:', error);
    return c.json({ error: 'Failed to generate synthesis' }, 500);
  }
});

/**
 * GET /api/curator/node/:nodeId/context - Get Node's AI curator context
 * Returns the node's personality, subscriptions, and feed preferences
 */
curatorRoutes.get('/node/:nodeId/context', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const nodeId = c.req.param('nodeId');
  
  try {
    // Get node with curator config
    const node = await c.env.DB.prepare(
      `SELECT id, name, description, curator_config, creator_user_id
       FROM nodes WHERE id = ? AND status = 'active'`
    ).bind(nodeId).first<Record<string, unknown>>();
    
    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }
    
    if (node.creator_user_id !== auth.userId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Get node's subscriptions (nodes this node follows)
    const { results: subscriptions } = await c.env.DB.prepare(
      `SELECT ns.*, n.name as subscribed_node_name, n.description as subscribed_node_description
       FROM node_subscriptions ns
       JOIN nodes n ON ns.node_id = n.id
       WHERE ns.user_id = ? AND n.status = 'active'`
    ).bind(auth.userId).all();
    
    const curatorConfig = node.curator_config 
      ? JSON.parse(node.curator_config as string) 
      : getDefaultCuratorConfig();
    
    return c.json({
      node: {
        id: node.id,
        name: node.name,
        description: node.description,
      },
      curatorConfig,
      subscriptions: (subscriptions || []).map(s => ({
        nodeId: s.node_id,
        nodeName: s.subscribed_node_name,
        nodeDescription: s.subscribed_node_description,
      })),
    });
    
  } catch (error) {
    console.error('[CURATOR] Node context error:', error);
    return c.json({ error: 'Failed to load node context' }, 500);
  }
});

/**
 * PUT /api/curator/node/:nodeId/config - Update Node's AI curator config
 */
curatorRoutes.put('/node/:nodeId/config', requireAuth(), async (c) => {
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
    
    if (node.creator_user_id !== auth.userId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const config = await c.req.json();
    
    // Validate config structure
    const validatedConfig = validateCuratorConfig(config);
    
    // Update node
    await c.env.DB.prepare(
      `UPDATE nodes SET curator_config = ?, updated_at = ? WHERE id = ?`
    ).bind(JSON.stringify(validatedConfig), Date.now(), nodeId).run();
    
    return c.json({ success: true, config: validatedConfig });
    
  } catch (error) {
    console.error('[CURATOR] Config update error:', error);
    return c.json({ error: 'Failed to update config' }, 500);
  }
});

/**
 * POST /api/curator/node/:nodeId/suggest-feeds - AI suggests feeds for node to follow
 */
curatorRoutes.post('/node/:nodeId/suggest-feeds', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const nodeId = c.req.param('nodeId');
  
  try {
    // Get node context
    const node = await c.env.DB.prepare(
      `SELECT id, name, description, creator_user_id FROM nodes WHERE id = ? AND status = 'active'`
    ).bind(nodeId).first<Record<string, unknown>>();
    
    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }
    
    if (node.creator_user_id !== auth.userId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Get other available nodes
    const { results: availableNodes } = await c.env.DB.prepare(
      `SELECT id, name, description, slug FROM nodes 
       WHERE status = 'active' AND id != ?`
    ).bind(nodeId).all();
    
    // Use AI to suggest relevant feeds based on node context
    const suggestions = await suggestRelevantFeeds(
      c.env.AI,
      {
        name: node.name as string,
        description: node.description as string,
      },
      availableNodes || []
    );
    
    return c.json({ suggestions });
    
  } catch (error) {
    console.error('[CURATOR] Feed suggestion error:', error);
    return c.json({ error: 'Failed to suggest feeds' }, 500);
  }
});

// ===== Helper Functions =====

function getDefaultCuratorConfig() {
  return {
    personality: 'thoughtful',
    tone: 'professional',
    autoSynthesis: false,
    synthesisThreshold: 5,
    commentModeration: 'manual', // 'auto', 'manual', 'hybrid'
    feedPreferences: {
      topicsOfInterest: [],
      excludeTopics: [],
    }
  };
}

function validateCuratorConfig(config: Record<string, unknown>) {
  const defaults = getDefaultCuratorConfig();
  return {
    personality: config.personality || defaults.personality,
    tone: config.tone || defaults.tone,
    autoSynthesis: typeof config.autoSynthesis === 'boolean' ? config.autoSynthesis : defaults.autoSynthesis,
    synthesisThreshold: typeof config.synthesisThreshold === 'number' 
      ? Math.max(1, Math.min(20, config.synthesisThreshold)) 
      : defaults.synthesisThreshold,
    commentModeration: ['auto', 'manual', 'hybrid'].includes(config.commentModeration as string) 
      ? config.commentModeration 
      : defaults.commentModeration,
    feedPreferences: {
      topicsOfInterest: Array.isArray((config.feedPreferences as Record<string, unknown>)?.topicsOfInterest) 
        ? (config.feedPreferences as Record<string, unknown[]>).topicsOfInterest 
        : [],
      excludeTopics: Array.isArray((config.feedPreferences as Record<string, unknown>)?.excludeTopics) 
        ? (config.feedPreferences as Record<string, unknown[]>).excludeTopics 
        : [],
    }
  };
}

function calculateContentMetrics(content: string): Record<string, number> {
  const words = content.split(/\s+/).length;
  const sentences = content.split(/[.!?]+/).filter(s => s.trim()).length;
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim()).length;
  
  // Average sentence length (complexity indicator)
  const avgSentenceLength = sentences > 0 ? words / sentences : 0;
  
  // Vocabulary richness (unique words / total words)
  const uniqueWords = new Set(content.toLowerCase().match(/\b\w+\b/g) || []).size;
  const vocabularyRichness = words > 0 ? (uniqueWords / words) * 100 : 0;
  
  // Structure score based on paragraphs and headings
  const headings = (content.match(/^#{1,6}\s/gm) || []).length;
  const structureScore = Math.min(100, (paragraphs * 10) + (headings * 15));
  
  return {
    clarity: Math.min(100, 100 - Math.abs(avgSentenceLength - 15) * 2), // Optimal ~15 words/sentence
    depth: Math.min(100, vocabularyRichness * 2),
    coherence: structureScore,
    accessibility: Math.min(100, 100 - (avgSentenceLength - 10) * 3), // Lower sentence length = more accessible
    wordCount: words,
    sentenceCount: sentences,
    paragraphCount: paragraphs,
  };
}

async function generateSuggestions(
  ai: Ai,
  content: string,
  context?: { nodeType?: string; targetAudience?: string }
): Promise<Array<{ id: string; type: string; text: string; action?: string }>> {
  
  try {
    const systemPrompt = `You are a writing assistant analyzing content for improvement suggestions.
Focus on: clarity, engagement, structure, and completeness.
Respond ONLY with valid JSON array format.`;

    const userPrompt = `Analyze this content and provide 2-4 specific, actionable suggestions:

CONTENT:
${content.substring(0, 3000)}

${context?.nodeType ? `Node Type: ${context.nodeType}` : ''}
${context?.targetAudience ? `Target Audience: ${context.targetAudience}` : ''}

Respond with JSON array of suggestions:
[
  {
    "type": "clarity|expansion|reference|style|structure",
    "text": "Specific suggestion description",
    "action": "Brief action text for button (optional)"
  }
]`;

    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });
    
    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);
    
    // Parse JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return getDefaultSuggestions(content);
    }
    
    const suggestions = JSON.parse(jsonMatch[0]);
    return suggestions.map((s: { type: string; text: string; action?: string }, i: number) => ({
      id: `suggestion-${i}`,
      type: s.type || 'general',
      text: s.text,
      action: s.action,
    }));
    
  } catch (error) {
    console.error('[CURATOR] Suggestion generation error:', error);
    return getDefaultSuggestions(content);
  }
}

function getDefaultSuggestions(content: string): Array<{ id: string; type: string; text: string; action?: string }> {
  const suggestions = [];
  const words = content.split(/\s+/).length;
  
  if (words < 200) {
    suggestions.push({
      id: 'default-1',
      type: 'expansion',
      text: 'Consider expanding your narrative with more detail or examples.',
      action: 'Add more detail'
    });
  }
  
  if (!content.includes('#')) {
    suggestions.push({
      id: 'default-2',
      type: 'structure',
      text: 'Adding headings could improve readability and navigation.',
      action: 'Add headings'
    });
  }
  
  return suggestions;
}

async function evaluateCommentForSynthesis(
  ai: Ai,
  comment: string,
  narrativeContent: string,
  existingComments: string
): Promise<{
  quality: number;
  relevance: number;
  synthesizable: boolean;
  reason: string;
  perspective?: string;
}> {
  
  try {
    const systemPrompt = `You evaluate comments for synthesis into narrative versions.
Rate quality (0-100): clarity, constructiveness, depth
Rate relevance (0-100): how well it relates to the narrative
Determine if synthesizable: can this improve the narrative?
Respond ONLY with valid JSON.`;

    const userPrompt = `NARRATIVE (excerpt):
${narrativeContent.substring(0, 1500)}

NEW COMMENT:
${comment}

${existingComments ? `EXISTING COMMENTS:\n${existingComments.substring(0, 500)}` : ''}

Evaluate and respond with JSON:
{
  "quality": <0-100>,
  "relevance": <0-100>,
  "synthesizable": <true/false>,
  "reason": "<brief explanation>",
  "perspective": "<what unique viewpoint does this add, if any>"
}`;

    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0,
    });
    
    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback
    return {
      quality: 50,
      relevance: 50,
      synthesizable: true,
      reason: 'Automatic evaluation unavailable',
    };
    
  } catch (error) {
    console.error('[CURATOR] Comment evaluation error:', error);
    return {
      quality: 50,
      relevance: 50,
      synthesizable: true,
      reason: 'Evaluation error, defaulting to neutral',
    };
  }
}

async function generateSynthesisSuggestion(
  ai: Ai,
  narrativeContent: string,
  commentsText: string
): Promise<{
  suggestion: string;
  reasoning: string;
  changes: string[];
  model: string;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  
  try {
    const systemPrompt = `You suggest how to synthesize discussion into an improved narrative.
DO NOT rewrite the entire narrative.
Instead, suggest specific changes to incorporate insights from comments.
Preserve the author's voice and intent.`;

    const userPrompt = `ORIGINAL NARRATIVE:
${narrativeContent.substring(0, 2000)}

DISCUSSION TO SYNTHESIZE:
${commentsText.substring(0, 1500)}

Provide:
1. A brief suggestion (1-2 paragraphs) on how to evolve the narrative
2. Reasoning for the changes
3. Specific change points

Respond with JSON:
{
  "suggestion": "<synthesis suggestion>",
  "reasoning": "<why these changes improve the narrative>",
  "changes": ["<specific change 1>", "<specific change 2>", ...]
}`;

    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 800,
      temperature: 0.5,
    });
    
    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        suggestion: parsed.suggestion || '',
        reasoning: parsed.reasoning || '',
        changes: parsed.changes || [],
        model: '@cf/meta/llama-3.1-8b-instruct',
        processingTimeMs: Date.now() - startTime,
      };
    }
    
    return {
      suggestion: responseText,
      reasoning: '',
      changes: [],
      model: '@cf/meta/llama-3.1-8b-instruct',
      processingTimeMs: Date.now() - startTime,
    };
    
  } catch (error) {
    console.error('[CURATOR] Synthesis suggestion error:', error);
    return {
      suggestion: '',
      reasoning: 'Failed to generate suggestion',
      changes: [],
      model: 'error',
      processingTimeMs: Date.now() - startTime,
    };
  }
}

async function suggestRelevantFeeds(
  ai: Ai,
  nodeContext: { name: string; description: string },
  availableNodes: Array<Record<string, unknown>>
): Promise<Array<{ nodeId: string; nodeName: string; reason: string; relevanceScore: number }>> {
  
  if (availableNodes.length === 0) {
    return [];
  }
  
  try {
    const nodesList = availableNodes
      .map(n => `- ${n.name}: ${n.description || 'No description'}`)
      .join('\n');
    
    const systemPrompt = `You suggest which nodes a curator should follow based on topical relevance.
Respond ONLY with valid JSON array.`;

    const userPrompt = `MY NODE:
Name: ${nodeContext.name}
Description: ${nodeContext.description}

AVAILABLE NODES:
${nodesList}

Which nodes should I follow? Respond with JSON array (max 5):
[
  {
    "nodeName": "<exact node name from list>",
    "reason": "<brief reason for relevance>",
    "relevanceScore": <0-100>
  }
]`;

    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });
    
    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);
    
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const suggestions = JSON.parse(jsonMatch[0]);
      
      // Map back to node IDs
      return suggestions
        .map((s: { nodeName: string; reason: string; relevanceScore: number }) => {
          const matchedNode = availableNodes.find(
            n => (n.name as string).toLowerCase() === s.nodeName.toLowerCase()
          );
          if (!matchedNode) return null;
          return {
            nodeId: matchedNode.id as string,
            nodeName: matchedNode.name as string,
            reason: s.reason,
            relevanceScore: s.relevanceScore,
          };
        })
        .filter(Boolean)
        .slice(0, 5);
    }
    
    return [];
    
  } catch (error) {
    console.error('[CURATOR] Feed suggestion error:', error);
    return [];
  }
}

export default curatorRoutes;
