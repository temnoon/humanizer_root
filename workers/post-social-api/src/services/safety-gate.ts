// Safety Gate Service
// Content moderation using Llama Guard
// All model and prompt configurations from ai-models.ts

import {
  ACTIVE_CONFIG,
  getActiveModel,
  getActivePrompt,
  interpolatePrompt,
  type ModelConfig,
} from '../config/ai-models';

export interface SafetyResult {
  safe: boolean;
  category: string | null;
  reason: string | null;
  confidence: number;
  model: string;
  promptId: string;
  processingTimeMs: number;
}

export interface SafetyCheckOptions {
  skipForRoles?: string[];
  userRole?: string;
}

/**
 * Check content safety using the configured safety model
 * 
 * @param ai - Cloudflare AI binding
 * @param content - Content to check
 * @param options - Optional configuration
 * @returns SafetyResult with classification
 */
export async function checkSafety(
  ai: Ai,
  content: string,
  options: SafetyCheckOptions = {}
): Promise<SafetyResult> {
  const startTime = Date.now();
  
  // Skip for trusted roles if configured
  const skipRoles = options.skipForRoles ?? ACTIVE_CONFIG.safety.skipForRoles;
  if (options.userRole && skipRoles.includes(options.userRole)) {
    return {
      safe: true,
      category: null,
      reason: 'Trusted role - safety check skipped',
      confidence: 1.0,
      model: 'skipped',
      promptId: 'skipped',
      processingTimeMs: 0,
    };
  }

  const modelConfig = getActiveModel('safety') as ModelConfig;
  const promptConfig = getActivePrompt('safety');
  
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
    
    const processingTimeMs = Date.now() - startTime;
    
    // Parse JSON response
    try {
      const responseText = typeof response === 'object' && 'response' in response 
        ? (response as { response: string }).response 
        : String(response);
      
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[SAFETY] No JSON found in response:', responseText);
        return createFallbackResult(modelConfig, promptConfig.id, processingTimeMs, true);
      }
      
      const result = JSON.parse(jsonMatch[0]);
      
      return {
        safe: result.safe ?? true,
        category: result.category ?? null,
        reason: result.reason ?? null,
        confidence: result.confidence ?? 0.8,
        model: modelConfig.model,
        promptId: promptConfig.id,
        processingTimeMs,
      };
    } catch (parseError) {
      console.error('[SAFETY] JSON parse error:', parseError);
      // If parsing fails, assume safe (fail open for better UX)
      return createFallbackResult(modelConfig, promptConfig.id, processingTimeMs, true);
    }
  } catch (error) {
    console.error('[SAFETY] AI call error:', error);
    const processingTimeMs = Date.now() - startTime;
    // On AI error, default to safe (fail open)
    return createFallbackResult(modelConfig, promptConfig.id, processingTimeMs, true, 'AI service error');
  }
}

/**
 * Create a fallback safety result when things go wrong
 */
function createFallbackResult(
  modelConfig: ModelConfig,
  promptId: string,
  processingTimeMs: number,
  safe: boolean,
  reason?: string
): SafetyResult {
  return {
    safe,
    category: null,
    reason: reason ?? 'Fallback result - parsing failed',
    confidence: 0.5,
    model: modelConfig.model,
    promptId,
    processingTimeMs,
  };
}

/**
 * Batch check multiple pieces of content
 * Useful for checking post + comments together
 */
export async function batchCheckSafety(
  ai: Ai,
  contents: string[],
  options: SafetyCheckOptions = {}
): Promise<SafetyResult[]> {
  // Run checks in parallel but with reasonable concurrency
  const results = await Promise.all(
    contents.map(content => checkSafety(ai, content, options))
  );
  return results;
}

/**
 * Check if any result in a batch is unsafe
 */
export function hasUnsafeContent(results: SafetyResult[]): boolean {
  return results.some(r => !r.safe);
}

/**
 * Get the most severe unsafe result from a batch
 */
export function getMostSevereViolation(results: SafetyResult[]): SafetyResult | null {
  const unsafeResults = results.filter(r => !r.safe);
  if (unsafeResults.length === 0) return null;
  
  // Sort by confidence (highest first) and return the most confident violation
  return unsafeResults.sort((a, b) => b.confidence - a.confidence)[0];
}
