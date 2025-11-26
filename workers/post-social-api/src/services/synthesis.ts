// Synthesis service - "Git for ideas"
// Automatically synthesize discussions into evolved post versions

import { getModelConfig } from '../config/ai-models';

export interface SynthesisConfig {
  autoSynthesizeThreshold: number;  // Trigger after N comments
  model: string;
  promptId: string;
}

export interface SynthesisResult {
  success: boolean;
  versionId?: string;
  version?: number;
  synthesizedContent?: string;
  summary?: string;
  tags?: string[];
  model?: string;
  error?: string;
}

/**
 * Check if post is ready for synthesis
 */
export async function checkSynthesisReady(
  db: D1Database,
  postId: string,
  threshold: number = 5
): Promise<{ ready: boolean; commentCount: number; currentVersion: number }> {
  
  // Get comment count
  const { count } = await db.prepare(
    'SELECT COUNT(*) as count FROM comments WHERE post_id = ?'
  ).bind(postId).first<{ count: number }>();
  
  // Get current version
  const post = await db.prepare(
    'SELECT version FROM posts WHERE id = ?'
  ).bind(postId).first<{ version: number }>();
  
  return {
    ready: (count || 0) >= threshold,
    commentCount: count || 0,
    currentVersion: post?.version || 1,
  };
}

/**
 * Generate synthesis of post + comments
 */
export async function synthesizeDiscussion(
  ai: Ai,
  db: D1Database,
  postId: string,
  config?: Partial<SynthesisConfig>
): Promise<SynthesisResult> {
  
  const finalConfig: SynthesisConfig = {
    autoSynthesizeThreshold: config?.autoSynthesizeThreshold || 5,
    model: config?.model || '@cf/meta/llama-3.1-8b-instruct',
    promptId: config?.promptId || 'synthesis-v1',
  };
  
  try {
    // Get post
    const post = await db.prepare(
      'SELECT id, content, summary, version FROM posts WHERE id = ?'
    ).bind(postId).first<{ id: string; content: string; summary: string | null; version: number }>();
    
    if (!post) {
      return { success: false, error: 'Post not found' };
    }
    
    // Get all comments
    const { results: comments } = await db.prepare(
      `SELECT content, created_at FROM comments 
       WHERE post_id = ? 
       ORDER BY created_at ASC`
    ).bind(postId).all<{ content: string; created_at: number }>();
    
    if (!comments || comments.length === 0) {
      return { success: false, error: 'No comments to synthesize' };
    }
    
    // Build synthesis prompt
    const commentsText = comments.map((c, i) => 
      `Comment ${i + 1}: ${c.content}`
    ).join('\n\n');
    
    const prompt = buildSynthesisPrompt(post.content, commentsText, finalConfig.promptId);
    
    // Run AI synthesis
    const response = await ai.run(finalConfig.model, {
      prompt,
      max_tokens: 1000,
    }) as { response?: string };
    
    if (!response?.response) {
      return { success: false, error: 'No synthesis generated' };
    }
    
    const synthesizedContent = response.response.trim();
    
    // Parse for summary and tags if included
    let summary = null;
    let tags: string[] = [];
    
    // Simple extraction (in production, you might want structured output)
    const summaryMatch = synthesizedContent.match(/SUMMARY: (.+?)(?:\n|$)/);
    if (summaryMatch) {
      summary = summaryMatch[1].substring(0, 280);
    }
    
    const tagsMatch = synthesizedContent.match(/TAGS: (.+?)(?:\n|$)/);
    if (tagsMatch) {
      tags = tagsMatch[1].split(',').map(t => t.trim().toLowerCase()).slice(0, 5);
    }
    
    // Extract just the synthesized content (remove metadata)
    let cleanContent = synthesizedContent
      .replace(/SUMMARY: .+?(?:\n|$)/, '')
      .replace(/TAGS: .+?(?:\n|$)/, '')
      .trim();
    
    // Create new version
    const versionId = crypto.randomUUID();
    const newVersion = (post.version || 1) + 1;
    const now = Date.now();
    
    await db.prepare(
      `INSERT INTO post_versions 
       (id, post_id, version, content, summary, tags, synthesis_model, synthesis_prompt_id, comment_count_at_synthesis, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      versionId,
      postId,
      newVersion,
      cleanContent,
      summary,
      tags.length > 0 ? JSON.stringify(tags) : null,
      finalConfig.model,
      finalConfig.promptId,
      comments.length,
      now
    ).run();
    
    return {
      success: true,
      versionId,
      version: newVersion,
      synthesizedContent: cleanContent,
      summary: summary || undefined,
      tags,
      model: finalConfig.model,
    };
    
  } catch (error) {
    console.error('[SYNTHESIS] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Approve a synthesized version (author only)
 */
export async function approveSynthesizedVersion(
  db: D1Database,
  versionId: string,
  postId: string
): Promise<boolean> {
  
  try {
    // Get version
    const version = await db.prepare(
      'SELECT id, post_id, version, content, summary, tags FROM post_versions WHERE id = ?'
    ).bind(versionId).first<{
      id: string;
      post_id: string;
      version: number;
      content: string;
      summary: string | null;
      tags: string | null;
    }>();
    
    if (!version || version.post_id !== postId) {
      return false;
    }
    
    const now = Date.now();
    
    // Mark version as approved
    await db.prepare(
      'UPDATE post_versions SET author_approved = 1, approved_at = ? WHERE id = ?'
    ).bind(now, versionId).run();
    
    // Update main post with synthesized content
    await db.prepare(
      `UPDATE posts 
       SET content = ?, summary = ?, tags = ?, version = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      version.content,
      version.summary,
      version.tags,
      version.version,
      now,
      postId
    ).run();
    
    return true;
    
  } catch (error) {
    console.error('[SYNTHESIS] Approve error:', error);
    return false;
  }
}

/**
 * Get version history for a post
 */
export async function getVersionHistory(
  db: D1Database,
  postId: string
): Promise<any[]> {
  
  const { results: versions } = await db.prepare(
    `SELECT 
      id, version, content, summary, tags,
      synthesis_model, comment_count_at_synthesis,
      author_approved, approved_at, created_at
     FROM post_versions
     WHERE post_id = ?
     ORDER BY version DESC`
  ).bind(postId).all();
  
  return versions || [];
}

/**
 * Build synthesis prompt
 */
function buildSynthesisPrompt(originalContent: string, commentsText: string, promptId: string): string {
  
  if (promptId === 'synthesis-v1') {
    return `You are synthesizing a discussion into an evolved version of the original post.

ORIGINAL POST:
${originalContent}

DISCUSSION (Comments):
${commentsText}

Your task is to create a new version of the post that:
1. Preserves the core meaning and intent
2. Incorporates insights from the discussion
3. Addresses questions or corrections raised
4. Maintains the author's voice
5. Is clearer and more complete than the original

Format your response as:
SUMMARY: [One sentence summary, max 280 chars]
TAGS: [5 relevant tags, comma-separated]

[The synthesized post content - preserve markdown if present]

Keep the synthesized content concise but comprehensive. This is version control for ideas.`;
  }
  
  // Fallback
  return `Synthesize this post and its discussion into an improved version:\n\nPost: ${originalContent}\n\nComments:\n${commentsText}`;
}
