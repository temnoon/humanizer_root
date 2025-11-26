// Curation Service
// AI-powered summarization, tagging, and curator responses
// All model and prompt configurations from ai-models.ts

import {
  ACTIVE_CONFIG,
  getActiveModel,
  getActivePrompt,
  interpolatePrompt,
  type ModelConfig,
} from '../config/ai-models';

export interface SummaryResult {
  summary: string;
  model: string;
  promptId: string;
  processingTimeMs: number;
}

export interface TagResult {
  tags: string[];
  model: string;
  promptId: string;
  processingTimeMs: number;
}

export interface CurationResult {
  summary: string;
  tags: string[];
  model: string;
  summarizePromptId: string;
  tagPromptId: string;
  totalProcessingTimeMs: number;
}

export interface CuratorResponseResult {
  response: string;
  model: string;
  promptId: string;
  processingTimeMs: number;
}

/**
 * Generate a concise summary of post content
 */
export async function summarizePost(
  ai: Ai,
  content: string
): Promise<SummaryResult> {
  const startTime = Date.now();
  
  const modelConfig = getActiveModel('curation') as ModelConfig;
  const promptConfig = getActivePrompt('summarize');
  
  const userPrompt = interpolatePrompt(promptConfig.userPromptTemplate, { content });
  
  try {
    const response = await ai.run(modelConfig.model as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: promptConfig.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: modelConfig.maxTokens,
      temperature: modelConfig.temperature,
    });
    
    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);
    
    // Clean up the summary - remove any leading/trailing whitespace
    // and truncate to 280 chars if needed
    let summary = responseText.trim();
    if (summary.length > 280) {
      summary = summary.substring(0, 277) + '...';
    }
    
    return {
      summary,
      model: modelConfig.model,
      promptId: promptConfig.id,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[CURATION] Summarize error:', error);
    // Fallback: create a simple truncated version
    const fallbackSummary = content.length > 280
      ? content.substring(0, 277) + '...'
      : content;
    
    return {
      summary: fallbackSummary,
      model: 'fallback',
      promptId: promptConfig.id,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Extract topic tags from content
 */
export async function extractTags(
  ai: Ai,
  content: string
): Promise<TagResult> {
  const startTime = Date.now();
  
  const modelConfig = getActiveModel('curation') as ModelConfig;
  const promptConfig = getActivePrompt('tags');
  
  const userPrompt = interpolatePrompt(promptConfig.userPromptTemplate, { content });
  
  try {
    const response = await ai.run(modelConfig.model as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: promptConfig.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 100,
      temperature: 0, // Deterministic for consistent tagging
    });
    
    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);
    
    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[CURATION] No JSON found in tag response:', responseText);
      return {
        tags: [],
        model: modelConfig.model,
        promptId: promptConfig.id,
        processingTimeMs: Date.now() - startTime,
      };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    let tags: string[] = parsed.tags || [];
    
    // Normalize tags: lowercase, hyphenated, no duplicates
    tags = [...new Set(
      tags
        .map((t: string) => t.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
        .filter((t: string) => t.length > 1 && t.length < 50)
    )].slice(0, 5); // Max 5 tags
    
    return {
      tags,
      model: modelConfig.model,
      promptId: promptConfig.id,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[CURATION] Tag extraction error:', error);
    return {
      tags: [],
      model: 'fallback',
      promptId: promptConfig.id,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Full curation: summarize + tag extraction in parallel
 */
export async function curatePost(
  ai: Ai,
  content: string
): Promise<CurationResult> {
  const startTime = Date.now();
  
  // Run summarization and tag extraction in parallel
  const [summaryResult, tagResult] = await Promise.all([
    summarizePost(ai, content),
    extractTags(ai, content),
  ]);
  
  return {
    summary: summaryResult.summary,
    tags: tagResult.tags,
    model: summaryResult.model, // Same model for both
    summarizePromptId: summaryResult.promptId,
    tagPromptId: tagResult.promptId,
    totalProcessingTimeMs: Date.now() - startTime,
  };
}

/**
 * Generate a curator response to a comment
 */
export async function generateCuratorResponse(
  ai: Ai,
  postContent: string,
  existingComments: string,
  newComment: string
): Promise<CuratorResponseResult> {
  const startTime = Date.now();
  
  const modelConfig = getActiveModel('curation') as ModelConfig;
  const promptConfig = getActivePrompt('curator');
  
  const userPrompt = interpolatePrompt(promptConfig.userPromptTemplate, {
    postContent,
    comments: existingComments,
    newComment,
  });
  
  try {
    const response = await ai.run(modelConfig.model as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: promptConfig.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: modelConfig.maxTokens,
      temperature: 0.7, // Slightly more creative for responses
    });
    
    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);
    
    return {
      response: responseText.trim(),
      model: modelConfig.model,
      promptId: promptConfig.id,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[CURATION] Curator response error:', error);
    return {
      response: '',
      model: 'error',
      promptId: promptConfig.id,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Generate synthesis of a post based on discussion
 * This creates an evolved version of the post
 */
export async function synthesizePost(
  ai: Ai,
  postContent: string,
  comments: string,
  currentVersion: number
): Promise<{
  content: string;
  summary: string;
  tags: string[];
  model: string;
  promptId: string;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  
  const modelConfig = getActiveModel('curation') as ModelConfig;
  const promptConfig = getActivePrompt('synthesis');
  
  const nextVersion = currentVersion + 1;
  const userPrompt = interpolatePrompt(promptConfig.userPromptTemplate, {
    postContent,
    comments,
    version: String(currentVersion),
    nextVersion: String(nextVersion),
  });
  
  try {
    const response = await ai.run(modelConfig.model as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: promptConfig.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2000, // More tokens for full synthesis
      temperature: 0.5,
    });
    
    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);
    
    // After synthesis, re-curate the new content
    const curationResult = await curatePost(ai, responseText);
    
    return {
      content: responseText.trim(),
      summary: curationResult.summary,
      tags: curationResult.tags,
      model: modelConfig.model,
      promptId: promptConfig.id,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[CURATION] Synthesis error:', error);
    return {
      content: postContent, // Return original on error
      summary: '',
      tags: [],
      model: 'error',
      promptId: promptConfig.id,
      processingTimeMs: Date.now() - startTime,
    };
  }
}
