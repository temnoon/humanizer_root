// ============================================================
// TRANSFORMATION SERVICE - API Abstraction Layer
// ============================================================
// Handles routing to Ollama (local) or Cloudflare AI (cloud)
// Provides unified interface for all transformation tools

import type { TransformConfig, TransformResult } from '../types';

// Environment detection
// Use local backend (wrangler dev on :8787) when on localhost
// Use cloud backend (Cloudflare Workers) when on production domain
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocalhost
  ? 'http://localhost:8787'  // Local wrangler dev server
  : 'https://npe-api.tem-527.workers.dev';  // Cloud production

console.log(`[TransformationService] Using ${isLocalhost ? 'LOCAL' : 'CLOUD'} backend: ${API_BASE}`);

// Helper to get auth token
function getAuthToken(): string | null {
  return localStorage.getItem('narrative-studio-auth-token');
}

// Helper to get auth headers
function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ============================================================
// COMPUTER HUMANIZER
// ============================================================

export interface ComputerHumanizerOptions {
  intensity: 'light' | 'moderate' | 'aggressive';
  useLLM?: boolean;
  voiceProfile?: string;
}

export interface ComputerHumanizerResult extends TransformResult {
  metadata: {
    aiConfidenceBefore: number;
    aiConfidenceAfter: number;
    burstinessBefore: number;
    burstinessAfter: number;
    tellWordsRemoved: number;
    tellWordsFound: string[];
    processingTime: number;
    stages: {
      original: string;
      tellWordsRemoved: string;
      burstinessEnhanced: string;
      llmPolished?: string;
    };
  };
}

export async function computerHumanizer(
  text: string,
  options: ComputerHumanizerOptions
): Promise<ComputerHumanizerResult> {
  const response = await fetch(`${API_BASE}/transformations/computer-humanizer`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ text, ...options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Computer Humanizer failed');
  }

  const data = await response.json();

  // Map backend response to TransformResult format
  return {
    transformation_id: crypto.randomUUID(),
    original: text,
    transformed: data.humanizedText,  // Backend returns humanizedText
    metadata: {
      aiConfidenceBefore: data.baseline?.detection?.confidence || 0,
      aiConfidenceAfter: data.final?.detection?.confidence || 0,
      burstinessBefore: data.baseline?.detection?.burstiness || 0,
      burstinessAfter: data.final?.detection?.burstiness || 0,
      tellWordsRemoved: data.improvement?.tellWordsRemoved || 0,
      tellWordsFound: data.baseline?.detection?.tellWords || [],
      processingTime: data.processing?.totalDurationMs || 0,
      stages: {
        original: text,
        tellWordsRemoved: data.stages?.tellWordsRemoved || '',
        burstinessEnhanced: data.stages?.burstinessEnhanced || '',
        llmPolished: data.stages?.llmPolished,
      },
    },
  };
}

// ============================================================
// AI DETECTION
// ============================================================

export interface AIDetectionOptions {
  threshold?: number;
  detectorType?: 'lite' | 'gptzero';
  useLLMJudge?: boolean;
}

export interface AIDetectionResult extends TransformResult {
  metadata: {
    aiDetection: {
      confidence: number;
      verdict: 'human' | 'ai' | 'mixed';
      tellWords: Array<{
        word: string;
        category: string;
        count: number;
        weight: number;
      }>;
      burstiness: number;
      perplexity: number;
      reasoning: string;
    };
  };
}

export async function aiDetection(
  text: string,
  options: AIDetectionOptions = {}
): Promise<AIDetectionResult> {
  const detectorType = options.detectorType || 'lite';

  // Route to appropriate detector
  if (detectorType === 'lite') {
    return liteDetection(text, options);
  } else {
    return gptzeroDetection(text, options);
  }
}

/**
 * Lite AI Detector (Free tier - heuristic analysis)
 */
async function liteDetection(
  text: string,
  options: AIDetectionOptions
): Promise<AIDetectionResult> {
  const response = await fetch(`${API_BASE}/ai-detection/lite`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      text,
      useLLMJudge: options.useLLMJudge ?? false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Lite Detection failed');
  }

  const data = await response.json();

  // Convert ai_likelihood (0-1) to confidence percentage (0-100)
  const confidence = data.ai_likelihood * 100;

  // Map label to verdict
  const verdict: 'human' | 'ai' | 'mixed' =
    data.label === 'likely_human' ? 'human' :
    data.label === 'likely_ai' ? 'ai' :
    'mixed';

  // Extract tell-words from phraseHits
  const tellWords = data.phraseHits?.map((hit: any) => ({ word: hit.phrase })) || [];

  // Map to TransformResult format
  return {
    transformation_id: crypto.randomUUID(),
    original: text,
    transformed: text, // Detection doesn't change the text
    metadata: {
      aiDetection: {
        confidence,
        verdict,
        tellWords,
        burstiness: data.metrics?.burstiness || 0,
        perplexity: (data.metrics?.typeTokenRatio || 0) * 100, // Convert 0-1 to 0-100
        reasoning: data.llmScore !== undefined
          ? `Lite detector (with LLM meta-judge): ${tellWords.length} AI phrases detected. Processing time: ${data.processingTimeMs}ms.`
          : `Lite detector (heuristic only): ${tellWords.length} AI phrases detected. Processing time: ${data.processingTimeMs}ms.`,
        method: 'lite', // Add method so UI knows which detector was used
      },
    },
  };
}

/**
 * Strip markdown formatting from text for GPTZero analysis
 * GPTZero flags markdown syntax as AI-like, so we send plain text
 * Also used for "Copy as Plain Text" functionality
 */
export function stripMarkdown(text: string): string {
  return text
    // Remove bold/italic markers
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')  // ***bold italic***
    .replace(/\*\*(.*?)\*\*/g, '$1')      // **bold**
    .replace(/\*(.*?)\*/g, '$1')          // *italic*
    .replace(/__(.*?)__/g, '$1')          // __bold__
    .replace(/_(.*?)_/g, '$1')            // _italic_
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove links
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove list markers
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '');
}

/**
 * GPTZero Detector (Pro/Premium - ALWAYS calls GPTZero API)
 */
async function gptzeroDetection(
  text: string,
  options: AIDetectionOptions
): Promise<AIDetectionResult> {
  // Strip markdown formatting before sending to GPTZero
  // (markdown syntax gets flagged as AI-like)
  const plainText = stripMarkdown(text);

  const response = await fetch(`${API_BASE}/ai-detection/detect`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ text: plainText }),
  });

  if (!response.ok) {
    const error = await response.json();

    // Return HONEST error to user - no mock results
    if (error.apiKeyMissing) {
      throw new Error('GPTZero API not configured. Please contact support.');
    }
    if (error.apiCallFailed) {
      throw new Error(`GPTZero API failed: ${error.error}. This is a real error, not a fallback result.`);
    }
    if (error.upgradeRequired) {
      throw new Error('GPTZero detection requires Pro or Premium subscription.');
    }

    throw new Error(error.error || 'GPTZero Detection failed');
  }

  const data = await response.json();

  // Verify API was actually called
  if (data.method !== 'gptzero') {
    throw new Error('Internal error: GPTZero endpoint did not call GPTZero API');
  }

  // Extract highlighted sentences (premium feature)
  const highlightedSentences = data.details?.sentences
    ?.filter((s: any) => s.highlight_sentence_for_ai)
    .map((s: any) => s.sentence) || [];

  // Calculate average paraphrased probability
  const paraphrasedProb = data.details?.sentences?.length
    ? data.details.sentences.reduce((sum: number, s: any) =>
        sum + (s.paraphrased_prob || 0), 0) / data.details.sentences.length
    : 0;

  // Map GPTZero API response to TransformResult format with premium features
  return {
    transformation_id: crypto.randomUUID(),
    original: text,
    transformed: text, // Detection doesn't change the text
    metadata: {
      aiDetection: {
        confidence: data.confidence || 0, // Now includes 3 decimal places
        verdict: data.verdict || 'mixed',
        tellWords: [], // GPTZero doesn't provide tell-words (that's local detection)
        burstiness: 0, // GPTZero API doesn't provide this metric
        perplexity: 0, // GPTZero API doesn't provide this metric
        reasoning: data.result_message || data.explanation || 'No explanation provided',
        method: 'gptzero', // Add method so UI knows which detector was used
        highlightedSentences, // Premium: AI-flagged sentences
        paraphrasedProbability: paraphrasedProb, // Premium: paraphrased detection
        confidenceCategory: data.confidence_category, // "low" | "medium" | "high"
        subclassType: data.subclass_type, // "pure_ai" | "ai_paraphrased"
        paragraphScores: data.details?.paragraphs || [],
        modelVersion: `${data.classVersion || 'unknown'} (${data.modelVersion || 'unknown'})`,
        processingTimeMs: data.processingTimeMs,
      },
    },
  };
}

// ============================================================
// PERSONA TRANSFORMER
// ============================================================

export interface PersonaOptions {
  persona: string;
}

export async function personaTransform(
  text: string,
  options: PersonaOptions
): Promise<TransformResult> {
  const response = await fetch(`${API_BASE}/transformations/persona`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      text,
      persona: options.persona,
      preserveLength: true,
      enableValidation: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Persona transformation failed');
  }

  const data = await response.json();

  // Map backend response to TransformResult format
  return {
    transformation_id: data.transformation_id,
    original: text,
    transformed: data.transformed_text,
    metadata: {
      aiConfidenceBefore: data.baseline?.detection?.aiConfidence,
      aiConfidenceAfter: data.final?.detection?.aiConfidence,
      burstinessBefore: data.baseline?.detection?.burstinessScore,
      burstinessAfter: data.final?.detection?.burstinessScore,
    },
  };
}

// ============================================================
// STYLE TRANSFORMER
// ============================================================

export interface StyleOptions {
  style: string;
}

export async function styleTransform(
  text: string,
  options: StyleOptions
): Promise<TransformResult> {
  const response = await fetch(`${API_BASE}/transformations/style`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      text,
      style: options.style,
      preserveLength: true,
      enableValidation: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Style transformation failed');
  }

  const data = await response.json();

  // Map backend response to TransformResult format
  return {
    transformation_id: data.transformation_id,
    original: text,
    transformed: data.transformed_text,
    metadata: {
      aiConfidenceBefore: data.baseline?.detection?.aiConfidence,
      aiConfidenceAfter: data.final?.detection?.aiConfidence,
      burstinessBefore: data.baseline?.detection?.burstinessScore,
      burstinessAfter: data.final?.detection?.burstinessScore,
    },
  };
}

// ============================================================
// NAMESPACE TRANSFORMER
// ============================================================

export interface NamespaceOptions {
  namespace: string;
}

export async function namespaceTransform(
  text: string,
  options: NamespaceOptions
): Promise<TransformResult> {
  const response = await fetch(`${API_BASE}/transformations/namespace`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      text,
      namespace: options.namespace,
      preserveLength: true,
      enableValidation: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Namespace transformation failed');
  }

  const data = await response.json();

  // Map backend response to TransformResult format
  return {
    transformation_id: data.transformation_id,
    original: text,
    transformed: data.transformed_text,
    metadata: {
      aiConfidenceBefore: data.baseline?.detection?.aiConfidence,
      aiConfidenceAfter: data.final?.detection?.aiConfidence,
      burstinessBefore: data.baseline?.detection?.burstinessScore,
      burstinessAfter: data.final?.detection?.burstinessScore,
    },
  };
}

// ============================================================
// UNIFIED TRANSFORM FUNCTION
// ============================================================

export async function runTransform(config: TransformConfig, text: string): Promise<TransformResult> {
  switch (config.type) {
    case 'computer-humanizer':
      return computerHumanizer(text, {
        intensity: config.parameters.intensity || 'moderate',
        useLLM: config.parameters.useLLM ?? true,
        voiceProfile: config.parameters.voiceProfile,
      });

    case 'ai-detection':
      return aiDetection(text, {
        threshold: config.parameters.threshold,
        detectorType: config.parameters.detectorType || 'lite',
        useLLMJudge: config.parameters.useLLMJudge ?? false,
      });

    case 'persona':
      return personaTransform(text, {
        persona: config.parameters.persona || 'holmes_analytical',
      });

    case 'namespace':
      return namespaceTransform(text, {
        namespace: config.parameters.namespace || 'enlightenment_science',
      });

    case 'style':
      return styleTransform(text, {
        style: config.parameters.style || 'austen_precision',
      });

    case 'allegorical':
      // Legacy support - will be removed
      throw new Error('Allegorical transformation has been split into Persona, Style, and Namespace tools');

    default:
      throw new Error(`Unknown transformation type: ${config.type}`);
  }
}
