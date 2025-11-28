// ============================================================
// TRANSFORMATION SERVICE - API Abstraction Layer
// ============================================================
// Handles routing to Ollama (local) or Cloudflare AI (cloud)
// Provides unified interface for all transformation tools

import type { TransformConfig, TransformResult } from '../types';
import * as ollamaService from './ollamaService';

// Get current provider from localStorage
function getCurrentProvider(): 'local' | 'cloudflare' {
  const savedProvider = localStorage.getItem('narrative-studio-provider');
  return (savedProvider === 'local' || savedProvider === 'cloudflare')
    ? savedProvider
    : 'local'; // Default to local
}

/**
 * Check if we should use direct Ollama calls instead of API
 * This is true when:
 * 1. Running in Electron
 * 2. Provider is 'local'
 * 3. User hasn't skipped Ollama setup
 */
async function shouldUseOllama(): Promise<boolean> {
  // Must be in Electron
  if (!window.isElectron || !window.electronAPI) {
    return false;
  }

  // Must have 'local' provider selected
  const provider = getCurrentProvider();
  if (provider !== 'local') {
    return false;
  }

  // Check if user skipped Ollama
  try {
    const ollamaSkipped = await window.electronAPI.store.get('ollamaSkipped');
    if (ollamaSkipped) {
      return false;
    }
  } catch {
    return false;
  }

  // Check if Ollama is actually running
  const available = await ollamaService.isOllamaAvailable();
  return available;
}

// Get API base URL based on user's provider preference
function getApiBase(): string {
  const provider = getCurrentProvider();
  const apiBase = provider === 'local'
    ? 'http://localhost:8787'  // Local wrangler dev server
    : 'https://npe-api.tem-527.workers.dev';  // Cloud production

  console.log(`[TransformationService] Using ${provider.toUpperCase()} backend: ${apiBase}`);
  return apiBase;
}

// Export provider info for UI feedback
export function getProviderInfo() {
  const provider = getCurrentProvider();
  return {
    provider,
    label: provider === 'local' ? 'Local (Ollama)' : 'Cloud (Cloudflare Workers)',
    emoji: provider === 'local' ? '🏠' : '☁️',
  };
}

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
  // Check if we should use local Ollama
  if (await shouldUseOllama()) {
    console.log('[TransformationService] Using local Ollama for Computer Humanizer');
    const data = await ollamaService.localComputerHumanizer(text, {
      intensity: options.intensity,
      useLLM: options.useLLM,
    });
    return mapComputerHumanizerResponse(data, text);
  }

  // Use API backend
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout (can be slow with LLM)

  try {
    const response = await fetch(`${getApiBase()}/transformations/computer-humanizer`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text, ...options }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Computer Humanizer failed');
    }

    const data = await response.json();
    return mapComputerHumanizerResponse(data, text);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Computer Humanizer timed out after 2 minutes. Try using a shorter text.');
    }
    throw error;
  }
}

/**
 * Map Computer Humanizer API response to TransformResult format
 */
function mapComputerHumanizerResponse(data: any, text: string): ComputerHumanizerResult {

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
      highlightedMarkdown?: string; // Markdown with <mark> tags for highlights
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
  // Check if we should use local Ollama
  if (await shouldUseOllama()) {
    console.log('[TransformationService] Using local Ollama for AI Detection');
    const data = await ollamaService.localAIDetection(text, {
      useLLMJudge: options.useLLMJudge,
    });
    return mapLiteDetectionResponse(data, text);
  }

  // Use API backend
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const response = await fetch(`${getApiBase()}/ai-detection/lite`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        text,
        useLLMJudge: options.useLLMJudge ?? false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Lite Detection failed');
    }

    const data = await response.json();
    return mapLiteDetectionResponse(data, text);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('AI Detection timed out after 60 seconds. Try using a shorter text or the GPTZero detector.');
    }
    throw error;
  }
}

/**
 * Map lite detection API response to TransformResult format
 */
function mapLiteDetectionResponse(data: any, text: string): AIDetectionResult {

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
        highlightedMarkdown: data.highlightedMarkdown, // Pass through from API
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

  // Add timeout to prevent hanging on slow requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout

  try {
    const response = await fetch(`${getApiBase()}/ai-detection/detect`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text: plainText }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      return handleGPTZeroError(error);
    }

    const data = await response.json();
    return mapGPTZeroResponse(data, text);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('GPTZero detection timed out after 90 seconds. Try using a shorter text.');
    }
    throw error;
  }
}

/**
 * Handle GPTZero API errors
 */
function handleGPTZeroError(error: any): never {
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

/**
 * Map GPTZero API response to TransformResult format
 */
function mapGPTZeroResponse(data: any, text: string): AIDetectionResult {
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
        highlightedMarkdown: data.highlightedMarkdown, // Markdown with <mark> tags for AI sentences
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
  // Check if we should use local Ollama
  if (await shouldUseOllama()) {
    console.log('[TransformationService] Using local Ollama for Persona Transform');
    const data = await ollamaService.localPersonaTransform(text, {
      persona: options.persona,
    });
    return {
      transformation_id: data.transformation_id,
      original: text,
      transformed: data.transformed_text,
      metadata: {},
    };
  }

  // Use API backend
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

  try {
    const response = await fetch(`${getApiBase()}/transformations/persona`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        text,
        persona: options.persona,
        preserveLength: true,
        enableValidation: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Persona transformation timed out after 5 minutes. Try using a shorter text or splitting into smaller sections.');
    }
    throw error;
  }
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
  // Check if we should use local Ollama
  if (await shouldUseOllama()) {
    console.log('[TransformationService] Using local Ollama for Style Transform');
    const data = await ollamaService.localStyleTransform(text, {
      style: options.style,
    });
    return {
      transformation_id: data.transformation_id,
      original: text,
      transformed: data.transformed_text,
      metadata: {},
    };
  }

  // Use API backend
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

  try {
    const response = await fetch(`${getApiBase()}/transformations/style`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        text,
        style: options.style,
        preserveLength: true,
        enableValidation: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Style transformation timed out after 5 minutes. Try using a shorter text or splitting into smaller sections.');
    }
    throw error;
  }
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
  // Add timeout for long texts (5 minutes for LLM processing)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

  try {
    const response = await fetch(`${getApiBase()}/transformations/namespace`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        text,
        namespace: options.namespace,
        preserveLength: true,
        enableValidation: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Namespace transformation timed out after 5 minutes. Try using a shorter text or splitting into smaller sections.');
    }
    throw error;
  }
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

    case 'round-trip': {
      // Round-trip does 2 translations, so longer timeout (10 minutes)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minute timeout

      try {
        const response = await fetch(`${getApiBase()}/transformations/round-trip`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            text,
            intermediate_language: config.parameters.intermediateLanguage || 'spanish',
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Round-trip translation failed');
        }

        const data = await response.json();

        return {
          transformation_id: data.transformation_id || crypto.randomUUID(),
          original: text,
          transformed: data.backward_translation,
          metadata: {
            transformationType: 'round-trip',
            intermediateLanguage: config.parameters.intermediateLanguage,
            forwardTranslation: data.forward_translation,
            semanticDrift: data.semantic_drift,
            preservedElements: data.preserved_elements,
            lostElements: data.lost_elements,
            gainedElements: data.gained_elements,
          },
        };
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Round-trip translation timed out after 10 minutes. Try using a shorter text or splitting into smaller sections.');
        }
        throw error;
      }
    }

    case 'allegorical':
      // Legacy support - will be removed
      throw new Error('Allegorical transformation has been split into Persona, Style, and Namespace tools');

    default:
      throw new Error(`Unknown transformation type: ${config.type}`);
  }
}
