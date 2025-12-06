/**
 * Transformation Pipeline
 *
 * 3-stage pipeline for reliable LLM transformations:
 *   Stage 1: Prompt Optimization (using model-specific tricks)
 *   Stage 2: Main Transformation (LLM call)
 *   Stage 3: Intelligent Filtering (LLM extraction)
 *
 * Includes feedback collection for continuous improvement.
 */

import * as ollamaService from './ollamaService';
import {
  modelRegistry,
  buildOptimizedPrompt,
  stripModelSpecificThinking,
  type ModelProfile,
} from './modelProfileRegistry';

// ============================================================
// TYPES
// ============================================================

export interface PipelineOptions {
  modelId?: string;
  provider: 'local' | 'cloudflare';
  transformationType: 'persona' | 'style' | 'humanizer' | 'round-trip';
  personaOrStyle?: string;
  skipStage3?: boolean;  // Skip LLM filtering (for testing)
}

export interface PipelineResult {
  transformationId: string;
  originalText: string;
  rawOutput: string;      // What Stage 2 produced
  filteredOutput: string; // What Stage 3 cleaned (or rawOutput if skipped)
  processingTimeMs: number;
  modelUsed: string;
  filteringApplied: boolean;

  // For feedback
  _internal: {
    profile: ModelProfile;
    stage2Success: boolean;
    stage3Success: boolean;
  };
}

// ============================================================
// STAGE 3: INTELLIGENT LLM FILTER
// ============================================================

/**
 * Use an LLM to extract ONLY the transformed content from raw output.
 * This is more reliable than regex patterns across different models/personas.
 */
async function llmFilterOutput(
  rawOutput: string,
  originalText: string,
  profile: ModelProfile
): Promise<string> {
  // First, try model-specific stripping (fast, catches obvious cases)
  const quickStripped = stripModelSpecificThinking(rawOutput, profile);

  // Check if quick stripping was sufficient
  // If the result doesn't look like it contains thinking, skip LLM filter
  if (!looksLikeThinking(quickStripped, profile)) {
    return quickStripped;
  }

  // Build context-aware filter prompt
  const knownPatterns = profile.failurePatterns.thinkingPreambles.slice(0, 5).join('", "');

  const filterPrompt = `You are a text extraction tool. Your ONLY job is to extract the transformed/rewritten content from an LLM response.

CONTEXT: This output came from ${profile.displayName} (${profile.family} family).
This model commonly adds preambles like: "${knownPatterns}"

The response may contain:
- Reasoning about how to do the transformation
- Explanations of the persona/style being used
- Meta-commentary like "Let me...", "I need to...", "First, I will..."
- Headers like "Here's the rewritten text:" or "Transformed version:"
- The actual transformed text (THIS IS WHAT WE WANT)

REMOVE ALL:
- Meta-commentary and reasoning
- Explanations of approach
- Headers and labels
- Anything that isn't the direct rewritten version

KEEP ONLY: The actual transformed/rewritten text.

Original text for reference (so you know what was being transformed):
---
${originalText.substring(0, 500)}${originalText.length > 500 ? '...' : ''}
---

LLM response to filter:
---
${rawOutput}
---

Output ONLY the transformed content. Nothing else. No explanation of what you extracted:`;

  try {
    // Use a lower temperature for more deterministic extraction
    const extracted = await ollamaService.generate(filterPrompt, {
      temperature: 0.2,  // Very low temp for extraction
      system: 'You extract text. Output only the extracted content, nothing else.',
    });

    // Validate extraction - should be meaningfully different from original
    // and not just repeat the filter instructions
    if (isValidExtraction(extracted, originalText, rawOutput)) {
      return extracted.trim();
    }

    // Fallback to quick-stripped version
    return quickStripped;
  } catch (error) {
    console.warn('[Pipeline] Stage 3 LLM filter failed, using quick-stripped:', error);
    return quickStripped;
  }
}

/**
 * Check if text looks like it contains thinking/reasoning
 */
function looksLikeThinking(text: string, profile: ModelProfile): boolean {
  const lower = text.toLowerCase();
  const first200 = lower.substring(0, 200);

  // Check for common thinking indicators
  const thinkingIndicators = [
    'let me',
    "i'll",
    'i will',
    'first,',
    'to accomplish',
    'the user wants',
    'i need to',
    'this requires',
    'here is the',
    "here's the",
    'below is',
    'an intriguing',
    'a fascinating',
    'okay,',
    'alright,',
    'sure,',
  ];

  // Check model-specific preambles
  const modelPreambles = profile.failurePatterns.thinkingPreambles.map(p => p.toLowerCase());

  const allIndicators = [...thinkingIndicators, ...modelPreambles];

  for (const indicator of allIndicators) {
    if (first200.includes(indicator)) {
      return true;
    }
  }

  // Check for thinking tags
  if (text.includes('<think>') || text.includes('</think>')) {
    return true;
  }

  // Check for multiple paragraphs where first looks like reasoning
  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length > 1) {
    const firstPara = paragraphs[0].toLowerCase();
    if (
      firstPara.includes('let me') ||
      firstPara.includes('i need') ||
      firstPara.includes('first') ||
      firstPara.includes('approach')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Validate that the extraction is reasonable
 */
function isValidExtraction(
  extracted: string,
  original: string,
  raw: string
): boolean {
  const extractedLower = extracted.toLowerCase().trim();

  // Should not be empty
  if (extractedLower.length < 10) {
    return false;
  }

  // Should not be identical to original (that means no transformation)
  if (extractedLower === original.toLowerCase().trim()) {
    return false;
  }

  // Should not contain filter prompt artifacts
  if (
    extractedLower.includes('output only') ||
    extractedLower.includes('extract') ||
    extractedLower.includes('llm response')
  ) {
    return false;
  }

  // Should be substantially present in raw output (not hallucinated)
  // Check if at least 50% of extracted words appear in raw
  const extractedWords = new Set(extractedLower.split(/\s+/));
  const rawWords = new Set(raw.toLowerCase().split(/\s+/));
  let overlap = 0;
  for (const word of extractedWords) {
    if (rawWords.has(word)) overlap++;
  }
  const overlapRatio = overlap / extractedWords.size;
  if (overlapRatio < 0.5) {
    return false;
  }

  return true;
}

// ============================================================
// MAIN PIPELINE
// ============================================================

/**
 * Run the full transformation pipeline
 */
export async function runTransformationPipeline(
  text: string,
  transformPrompt: string,
  systemPrompt: string,
  options: PipelineOptions
): Promise<PipelineResult> {
  const startTime = Date.now();
  const transformationId = crypto.randomUUID();

  // Get model profile
  const modelId = options.modelId || await getCurrentModelId();
  const profile = modelRegistry.getProfile(modelId);

  console.log(`[Pipeline] Starting transformation with ${profile.displayName}`);

  let rawOutput = '';
  let filteredOutput = '';
  let stage2Success = false;
  let stage3Success = false;

  try {
    // ================================================================
    // STAGE 1: PROMPT OPTIMIZATION
    // ================================================================
    const optimized = buildOptimizedPrompt(profile, systemPrompt, text);

    // Build final prompt with transformation instructions
    const finalPrompt = transformPrompt
      ? `${transformPrompt}\n\n${optimized.prompt}`
      : optimized.prompt;

    // ================================================================
    // STAGE 2: MAIN TRANSFORMATION
    // ================================================================
    if (options.provider === 'local') {
      rawOutput = await ollamaService.generate(finalPrompt, {
        temperature: profile.tricks.temperature,
        system: optimized.system,
      });
    } else {
      // Cloud transformation - will be handled by caller
      // This pipeline is primarily for local Ollama
      throw new Error('Cloud transformations should use the API directly');
    }

    stage2Success = rawOutput.length > 0;

    // ================================================================
    // STAGE 3: INTELLIGENT FILTERING
    // ================================================================
    if (options.skipStage3) {
      filteredOutput = stripModelSpecificThinking(rawOutput, profile);
      stage3Success = true;
    } else {
      filteredOutput = await llmFilterOutput(rawOutput, text, profile);
      stage3Success = filteredOutput !== rawOutput;  // Filter actually changed something
    }

  } catch (error: any) {
    console.error('[Pipeline] Transformation failed:', error);
    throw error;
  }

  const processingTimeMs = Date.now() - startTime;

  return {
    transformationId,
    originalText: text,
    rawOutput,
    filteredOutput,
    processingTimeMs,
    modelUsed: modelId,
    filteringApplied: !options.skipStage3,
    _internal: {
      profile,
      stage2Success,
      stage3Success,
    },
  };
}

/**
 * Get the currently selected model ID
 */
async function getCurrentModelId(): Promise<string> {
  if (window.electronAPI?.store) {
    const model = await window.electronAPI.store.get('selectedModel') as string;
    return model || 'llama3.2:3b';
  }
  return 'llama3.2:3b';
}

// ============================================================
// SPECIALIZED PIPELINES
// ============================================================

/**
 * Persona transformation pipeline
 */
export async function runPersonaPipeline(
  text: string,
  persona: string,
  systemPrompt: string
): Promise<PipelineResult> {
  return runTransformationPipeline(
    text,
    '', // Transform prompt is in system prompt
    systemPrompt,
    {
      provider: 'local',
      transformationType: 'persona',
      personaOrStyle: persona,
    }
  );
}

/**
 * Style transformation pipeline
 */
export async function runStylePipeline(
  text: string,
  style: string,
  styleInstruction: string
): Promise<PipelineResult> {
  const systemPrompt = `You are a text transformation tool. Apply the following style: ${styleInstruction}`;

  return runTransformationPipeline(
    text,
    '',
    systemPrompt,
    {
      provider: 'local',
      transformationType: 'style',
      personaOrStyle: style,
    }
  );
}

// ============================================================
// FEEDBACK INTEGRATION
// ============================================================

/**
 * Record user feedback for a transformation
 */
export function recordTransformationFeedback(
  result: PipelineResult,
  rating: 'good' | 'bad',
  feedbackText?: string
): void {
  // Update model profile stats
  modelRegistry.recordResult(
    result.modelUsed,
    rating === 'good',
    result._internal.profile.id,
    feedbackText
  );

  // Store detailed feedback (to be implemented in feedbackService)
  const feedback = {
    transformationId: result.transformationId,
    modelId: result.modelUsed,
    originalText: result.originalText.substring(0, 500),
    rawOutput: result.rawOutput.substring(0, 1000),
    filteredOutput: result.filteredOutput.substring(0, 1000),
    rating,
    feedbackText,
    filteringApplied: result.filteringApplied,
    processingTimeMs: result.processingTimeMs,
    timestamp: new Date().toISOString(),
  };

  // For now, log to console - will be stored properly later
  console.log('[Pipeline] Feedback recorded:', feedback);

  // TODO: Send to feedbackService.storeFeedback(feedback)
}

// ============================================================
// CLOUD PIPELINE (for Cloudflare Workers)
// ============================================================

/**
 * Filter output from cloud transformations
 * This runs the Stage 3 filter locally even for cloud-transformed text
 */
export async function filterCloudOutput(
  rawOutput: string,
  originalText: string
): Promise<string> {
  // Use cloudflare profile for filtering
  const profile = modelRegistry.getProfile('cloudflare-llama');

  // Check if filtering is needed
  if (!looksLikeThinking(rawOutput, profile)) {
    return rawOutput;
  }

  // Run Stage 3 filter
  return llmFilterOutput(rawOutput, originalText, profile);
}
