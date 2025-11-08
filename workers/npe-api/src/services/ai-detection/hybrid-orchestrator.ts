// Hybrid AI Detection Orchestrator
// Combines local statistical analysis with optional GPTZero API fallback
// Default: Local-only detection (GPTZero disabled until API key configured)

import { detectAILocal, LocalDetectionResult } from './local-detector';
import { detectAIWithGPTZero, GPTZeroDetectionResult } from './gptzero-client';

export interface HybridDetectionResult {
  verdict: 'human' | 'ai' | 'uncertain';
  confidence: number; // 0-100
  method: 'local' | 'gptzero' | 'hybrid';
  local?: LocalDetectionResult;
  api?: GPTZeroDetectionResult;
  message?: string; // Informational message (e.g., quota exceeded)
  processingTimeMs: number;
}

export interface DetectionOptions {
  useAPI?: boolean; // User opt-in for GPTZero API
  userTier?: string; // User's subscription tier
  apiKey?: string; // GPTZero API key (optional)
}

/**
 * Detect AI-generated text using hybrid approach
 *
 * Flow:
 * 1. Always run local detection first (fast, private, free)
 * 2. If confident (< 35% or > 65%), return local result
 * 3. If uncertain (35-65%) AND user opted in AND API key available, call GPTZero
 * 4. Otherwise, return local result with uncertainty message
 *
 * @param text - Text to analyze
 * @param options - Detection options (API opt-in, tier, key)
 * @returns Combined detection result
 */
export async function detectAI(
  text: string,
  options: DetectionOptions = {}
): Promise<HybridDetectionResult> {
  const startTime = Date.now();
  const { useAPI = false, userTier = 'free', apiKey } = options;

  // Validate input
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length < 20) {
    throw new Error('Text must be at least 20 words for accurate detection');
  }

  // Step 1: Always run local detection first
  let localResult: LocalDetectionResult;
  try {
    localResult = await detectAILocal(text);
  } catch (error) {
    throw new Error(`Local detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Step 2: Check if we need API fallback
  const isConfident = localResult.verdict !== 'uncertain';
  const hasAPIKey = Boolean(apiKey);
  const isProPlus = userTier === 'pro' || userTier === 'premium' || userTier === 'admin';

  // If confident, return local result immediately
  if (isConfident) {
    return {
      verdict: localResult.verdict,
      confidence: localResult.confidence,
      method: 'local',
      local: localResult,
      processingTimeMs: Date.now() - startTime
    };
  }

  // If uncertain but user didn't opt in, return local result with message
  if (!useAPI) {
    return {
      verdict: localResult.verdict,
      confidence: localResult.confidence,
      method: 'local',
      local: localResult,
      message: 'Uncertain result. Enable API detection for higher accuracy (PRO+ only).',
      processingTimeMs: Date.now() - startTime
    };
  }

  // If user opted in but no API key configured
  if (!hasAPIKey) {
    return {
      verdict: localResult.verdict,
      confidence: localResult.confidence,
      method: 'local',
      local: localResult,
      message: 'GPTZero API not configured. Contact admin to enable advanced detection.',
      processingTimeMs: Date.now() - startTime
    };
  }

  // If user opted in but not PRO+ tier
  if (!isProPlus) {
    return {
      verdict: localResult.verdict,
      confidence: localResult.confidence,
      method: 'local',
      local: localResult,
      message: 'API detection requires PRO+ subscription. Upgrade to access advanced features.',
      processingTimeMs: Date.now() - startTime
    };
  }

  // Step 3: Call GPTZero API for uncertain cases with PRO+ tier
  let apiResult: GPTZeroDetectionResult;
  try {
    apiResult = await detectAIWithGPTZero(text, apiKey);
  } catch (error) {
    // If API fails, return local result with error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
    return {
      verdict: localResult.verdict,
      confidence: localResult.confidence,
      method: 'local',
      local: localResult,
      message: `API detection failed: ${errorMessage}. Showing local results.`,
      processingTimeMs: Date.now() - startTime
    };
  }

  // Step 4: Return hybrid result (both local and API)
  return {
    verdict: apiResult.verdict,
    confidence: apiResult.confidence,
    method: 'hybrid',
    local: localResult,
    api: apiResult,
    message: 'Combined local and GPTZero API analysis',
    processingTimeMs: Date.now() - startTime
  };
}

/**
 * Explain detection result in human-readable terms
 */
export function explainResult(result: HybridDetectionResult): string {
  const { verdict, confidence, method } = result;

  let explanation = '';

  if (verdict === 'human') {
    if (confidence < 20) {
      explanation = 'Very likely written by a human';
    } else if (confidence < 35) {
      explanation = 'Likely written by a human';
    } else {
      explanation = 'Possibly written by a human';
    }
  } else if (verdict === 'ai') {
    if (confidence > 80) {
      explanation = 'Very likely written by AI';
    } else if (confidence > 65) {
      explanation = 'Likely written by AI';
    } else {
      explanation = 'Possibly written by AI';
    }
  } else {
    explanation = 'Uncertain - could be human or AI';
  }

  // Add method context
  if (method === 'local') {
    explanation += ' (statistical analysis)';
  } else if (method === 'gptzero') {
    explanation += ' (GPTZero API)';
  } else if (method === 'hybrid') {
    explanation += ' (local + GPTZero API)';
  }

  return explanation;
}
