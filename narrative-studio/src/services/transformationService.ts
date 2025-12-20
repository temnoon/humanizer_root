// ============================================================
// TRANSFORMATION SERVICE - API Abstraction Layer
// ============================================================
// Handles routing to Ollama (local) or Cloudflare AI (cloud)
// Provides unified interface for all transformation tools
// Uses 3-stage pipeline for reliable output filtering

import type { TransformConfig, TransformResult } from '../types';
import * as ollamaService from './ollamaService';
import { stripThinkingPreamble } from './ollamaService';
import { filterCloudOutput } from './transformationPipeline';
import { STORAGE_PATHS } from '../config/storage-paths';
import { getCloudModelPreference, getDeepAnalysisPreference } from '../components/settings/CloudAISettings';

// Check if running in Electron (same logic as feature-flags)
function isElectronApp(): boolean {
  return typeof window !== 'undefined' && (
    (window as any).isElectron === true ||
    (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron'))
  );
}

// Get current provider from localStorage
// Default: 'cloudflare' for web, 'local' for Electron
function getCurrentProvider(): 'local' | 'cloudflare' {
  const savedProvider = localStorage.getItem('narrative-studio-provider');

  // If no saved preference, use environment-appropriate default
  if (savedProvider !== 'local' && savedProvider !== 'cloudflare') {
    return isElectronApp() ? 'local' : 'cloudflare';
  }

  // In web app, force 'cloudflare' even if 'local' was saved
  // (the ProviderContext will also fix this, but we need consistency)
  if (!isElectronApp() && savedProvider === 'local') {
    return 'cloudflare';
  }

  return savedProvider;
}

/**
 * Check if we should use direct Ollama calls instead of API
 * This is true when:
 * 1. Provider is 'local'
 * 2. Ollama is available (running on localhost:11434)
 * 3. User hasn't skipped Ollama setup (Electron only)
 *
 * Note: Works in both Electron AND web browser - if Ollama is running,
 * we can call it directly via fetch (CORS should be enabled by default).
 */
async function shouldUseOllama(): Promise<boolean> {
  // Must have 'local' provider selected
  const provider = getCurrentProvider();
  if (provider !== 'local') {
    return false;
  }

  // In Electron mode, check if user skipped Ollama
  if (window.isElectron && window.electronAPI?.store) {
    try {
      const ollamaSkipped = await window.electronAPI.store.get('ollamaSkipped');
      if (ollamaSkipped) {
        return false;
      }
    } catch {
      // Continue to check Ollama availability
    }
  }

  // Check if Ollama is actually running (works in both Electron and browser)
  const available = await ollamaService.isOllamaAvailable();
  console.log(`[TransformationService] Ollama available: ${available}`);
  return available;
}

// Get API base URL based on user's provider preference
function getApiBase(): string {
  const provider = getCurrentProvider();
  // Use centralized config - handles local/production automatically
  const apiBase = STORAGE_PATHS.npeApiUrl;

  console.log(`[TransformationService] Using ${provider.toUpperCase()} backend: ${apiBase}`);
  return apiBase;
}

// Export provider info for UI feedback
export function getProviderInfo() {
  const provider = getCurrentProvider();
  // In Electron with 'local', it could be Ollama or Workers API
  // In web, always cloudflare
  const isElectron = isElectronApp();
  let label: string;
  let emoji: string;

  if (provider === 'cloudflare') {
    label = 'Cloud (Cloudflare Workers)';
    emoji = '☁️';
  } else if (isElectron) {
    label = 'Local (Ollama)';
    emoji = '🏠';
  } else {
    // Web with 'local' shouldn't happen, but fallback
    label = 'Cloud (Cloudflare Workers)';
    emoji = '☁️';
  }

  return { provider, label, emoji };
}

// Helper to get auth token (check both possible storage keys)
function getAuthToken(): string | null {
  return localStorage.getItem('narrative-studio-auth-token') ||
         localStorage.getItem('post-social:token');
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
  model?: string;                    // LLM choice for polish pass (default: gpt-oss-20b)
  enableSicAnalysis?: boolean;       // Enable deep constraint analysis (paid tiers only)
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
    modelUsed?: string;
    gptzeroAnalysis?: unknown;  // GPTZero-specific analysis data
    // SIC (Subjective Intentional Constraint) analysis results
    sicAnalysis?: {
      baseline?: {
        sicScore: number;
        aiProbability: number;
        genre: string;
        features: Record<string, { score: number; notes: string }>;
      };
      final?: {
        sicScore: number;
        aiProbability: number;
        features: Record<string, { score: number; notes: string }>;
      };
      constraintGapsIdentified: string[];
      constraintImprovement?: {
        sicScoreChange: number;
        featuresImproved: string[];
        featuresDeclined: string[];
      };
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

  // Get user's model preference for cloud transformations
  const cloudModel = options.model || getCloudModelPreference();
  // Get deep analysis preference (SIC)
  const enableSicAnalysis = options.enableSicAnalysis ?? getDeepAnalysisPreference();
  console.log(`[TransformationService] Humanizer using model: ${cloudModel}, SIC: ${enableSicAnalysis}`);

  // Use API backend - SIC adds ~60s, so extend timeout when enabled
  const controller = new AbortController();
  const timeoutMs = enableSicAnalysis ? 240000 : 120000; // 4 min with SIC, 2 min without
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getApiBase()}/transformations/computer-humanizer`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        text,
        intensity: options.intensity,
        enableLLMPolish: options.useLLM ?? true,
        voiceSamples: options.voiceProfile ? [options.voiceProfile] : undefined,
        model: cloudModel,
        enableSicAnalysis,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || 'Computer Humanizer failed');
    }

    const data = await response.json();
    return mapComputerHumanizerResponse(data, text);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const timeoutMinutes = enableSicAnalysis ? '4' : '2';
      throw new Error(`Computer Humanizer timed out after ${timeoutMinutes} minutes. Try using a shorter text${enableSicAnalysis ? ' or disable deep analysis.' : '.'}`);
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
    transformation_id: data.transformation_id || crypto.randomUUID(),
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
      // New fields for model selection and GPTZero targeting
      modelUsed: data.model_used,
      gptzeroAnalysis: data.gptzeroAnalysis,
      // SIC (Subjective Intentional Constraint) analysis results
      sicAnalysis: data.sicAnalysis ? {
        baseline: data.sicAnalysis.baseline ? {
          sicScore: data.sicAnalysis.baseline.sicScore,
          aiProbability: data.sicAnalysis.baseline.aiProbability,
          genre: data.sicAnalysis.baseline.genre,
          features: data.sicAnalysis.baseline.features,
        } : undefined,
        final: data.sicAnalysis.final ? {
          sicScore: data.sicAnalysis.final.sicScore,
          aiProbability: data.sicAnalysis.final.aiProbability,
          features: data.sicAnalysis.final.features,
        } : undefined,
        constraintGapsIdentified: data.sicAnalysis.constraintGapsIdentified || [],
        constraintImprovement: data.sicAnalysis.constraintImprovement,
      } : undefined,
    },
  };
}

// ============================================================
// AI DETECTION
// ============================================================

export interface AIDetectionOptions {
  threshold?: number;
  detectorType?: 'lite' | 'gptzero' | 'v2';
  useLLMJudge?: boolean;
  /** v2 detector options */
  returnSentenceAnalysis?: boolean;
  returnHumanizationRecommendations?: boolean;
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
      method?: 'lite' | 'gptzero' | 'v2' | 'v3'; // Which detector was used
      // Lite detector additional metrics
      avgSentenceLength?: number;
      sentenceLengthStd?: number;
      typeTokenRatio?: number;
      repeatedNgrams?: number;
      heuristicScore?: number;
      llmScore?: number;
      confidence_level?: 'low' | 'medium' | 'high';
      highlights?: Array<{
        start: number;
        end: number;
        reason: string;
        score?: number;
      }>;
      // Sentence-level analysis
      sentenceAnalysis?: Array<{
        sentence: string;
        index: number;
        aiScore: number;
        tellPhrases: Array<{ phrase: string; category: string; weight: number }>;
        patterns: string[];
      }>;
      suspectSentences?: Array<{
        sentence: string;
        index: number;
        aiScore: number;
        tellPhrases: Array<{ phrase: string; category: string; weight: number }>;
        patterns: string[];
      }>;
      // GPTZero specific fields
      highlightedSentences?: string[]; // AI-flagged sentences (GPTZero)
      paraphrasedProbability?: number; // GPTZero paraphrased detection probability
      confidenceCategory?: string; // GPTZero confidence category
      subclassType?: string; // GPTZero subclass type
      paragraphScores?: Array<{
        start_sentence_index: number;
        num_sentences: number;
        completely_generated_prob: number;
      }>;
      modelVersion?: string; // GPTZero model version
      processingTimeMs?: number; // Processing time
      // V2 detector specific fields
      semicolonRate?: number;
      emDashRate?: number;
      tellPhraseScore?: number;
      humanizationRecommendations?: any[];
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
  } else if (detectorType === 'v2') {
    return v2Detection(text, options);
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
 *
 * Backend returns:
 *   ai_likelihood: 0-1, confidence: 'low'|'medium'|'high', label: 'likely_human'|'mixed'|'likely_ai'
 *   metrics: { burstiness, avgSentenceLength, sentenceLengthStd, typeTokenRatio, repeatedNgrams }
 *   phraseHits: Array<{phrase, count, weight, category}>
 *   highlights: Array<{start, end, reason, score}>
 *   heuristicScore: number, llmScore?: number
 */
function mapLiteDetectionResponse(data: any, text: string): AIDetectionResult {
  // Convert ai_likelihood (0-1) to confidence percentage (0-100)
  const confidence = data.ai_likelihood * 100;

  // Map label to verdict
  const verdict: 'human' | 'ai' | 'mixed' =
    data.label === 'likely_human' ? 'human' :
    data.label === 'likely_ai' ? 'ai' :
    'mixed';

  // Extract tell-words from phraseHits with full structure
  const tellWords = data.phraseHits?.map((hit: any) => ({
    word: hit.phrase,
    category: hit.category || 'unknown',
    count: hit.count ?? 1,
    weight: hit.weight ?? 0.5,
  })) || [];

  // Map to TransformResult format - pass through all fields for UI
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
        // Pass through additional metrics for UI
        avgSentenceLength: data.metrics?.avgSentenceLength || 0,
        sentenceLengthStd: data.metrics?.sentenceLengthStd || 0,
        typeTokenRatio: data.metrics?.typeTokenRatio || 0,
        repeatedNgrams: data.metrics?.repeatedNgrams || 0,
        // Pass through detection details
        heuristicScore: data.heuristicScore,
        llmScore: data.llmScore,
        confidence_level: data.confidence, // 'low' | 'medium' | 'high'
        highlights: data.highlights || [],
        // Pass through sentence-level analysis
        sentenceAnalysis: data.sentenceAnalysis || [],
        suspectSentences: data.suspectSentences || [],
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
 * HumanizerDetect v2 - Statistical AI Detection (86.4% accuracy)
 *
 * Uses burstiness, semicolon/em-dash patterns, and tell-phrase matching.
 * Based on empirical analysis of 330+ human/AI samples.
 */
async function v2Detection(
  text: string,
  options: AIDetectionOptions
): Promise<AIDetectionResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${getApiBase()}/ai-detection/detect-v2`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        text,
        options: {
          returnSentenceAnalysis: options.returnSentenceAnalysis ?? true,
          returnHumanizationRecommendations: options.returnHumanizationRecommendations ?? true,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'HumanizerDetect v2 failed');
    }

    const data = await response.json();
    return mapV2DetectionResponse(data, text);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('AI Detection timed out after 60 seconds.');
    }
    throw error;
  }
}

/**
 * Map v2 detection API response to TransformResult format
 */
function mapV2DetectionResponse(data: any, text: string): AIDetectionResult {
  // Map sentence analysis to the expected format
  const sentenceAnalysis = data.sentenceAnalysis?.map((s: any, i: number) => ({
    sentence: s.text,
    index: i,
    aiScore: s.aiLikelihood,
    tellPhrases: s.flags?.filter((f: string) => f.includes('tell'))?.map((f: string) => ({
      phrase: f,
      category: 'tell',
      weight: 1.0,
    })) || [],
    patterns: s.flags || [],
  }));

  // Filter for suspect sentences (aiLikelihood > 65)
  const suspectSentences = sentenceAnalysis?.filter((s: any) => s.aiScore > 65);

  // Map tell-phrase matches to the expected format
  const tellWords = data.tellPhrases?.matches
    ?.filter((m: any) => m.direction === 'ai')
    ?.map((m: any) => ({
      word: m.phrase,
      category: m.category,
      count: m.count,
      weight: m.weight,
    })) || [];

  return {
    transformation_id: crypto.randomUUID(),
    original: text,
    transformed: text,
    metadata: {
      aiDetection: {
        confidence: data.aiLikelihood,
        verdict: data.verdict,
        tellWords,
        burstiness: (data.features?.burstiness || 0) * 100, // Convert to percentage for UI
        perplexity: 0, // v2 doesn't use perplexity
        reasoning: generateV2Reasoning(data),
        method: 'v2',
        // v2 specific metrics
        avgSentenceLength: data.extractedFeatures?.burstiness?.meanSentenceLength,
        sentenceLengthStd: data.extractedFeatures?.burstiness?.stdSentenceLength,
        typeTokenRatio: data.extractedFeatures?.vocabulary?.typeTokenRatio,
        repeatedNgrams: 0,
        heuristicScore: data.aiLikelihood / 100,
        confidence_level: data.confidence,
        highlights: data.humanizationRecommendations?.map((r: any) => ({
          start: 0,
          end: 0,
          reason: r.description,
          score: r.priority === 'high' ? 0.9 : r.priority === 'medium' ? 0.6 : 0.3,
        })) || [],
        sentenceAnalysis,
        suspectSentences,
        // v2 specific fields
        semicolonRate: data.features?.semicolonRate,
        emDashRate: data.features?.emDashRate,
        tellPhraseScore: data.features?.tellPhraseScore,
        humanizationRecommendations: data.humanizationRecommendations,
        processingTimeMs: data.processingTimeMs,
        modelVersion: data.detectorVersion,
      },
    },
  };
}

/**
 * Generate reasoning text from v2 detection results
 */
function generateV2Reasoning(data: any): string {
  const parts: string[] = [];

  // Verdict
  if (data.verdict === 'ai') {
    parts.push('Text shows patterns typical of AI generation.');
  } else if (data.verdict === 'human') {
    parts.push('Text shows patterns typical of human writing.');
  } else {
    parts.push('Text shows mixed patterns.');
  }

  // Key signals
  if (data.features) {
    const burstiness = data.features.burstiness;
    if (burstiness < 0.45) {
      parts.push(`Low burstiness (${(burstiness * 100).toFixed(0)}%) indicates uniform sentence lengths.`);
    } else if (burstiness > 0.70) {
      parts.push(`High burstiness (${(burstiness * 100).toFixed(0)}%) indicates varied sentence lengths.`);
    }

    if (data.features.emDashRate > 2.5) {
      parts.push(`High em-dash usage (${data.features.emDashRate.toFixed(1)}%) is an AI pattern.`);
    }

    if (data.features.semicolonRate > 0.5) {
      parts.push(`Semicolon usage (${data.features.semicolonRate.toFixed(1)}%) suggests human writing.`);
    }
  }

  // Tell-phrases
  const aiTells = data.tellPhrases?.matches?.filter((m: any) => m.direction === 'ai')?.length || 0;
  if (aiTells > 3) {
    parts.push(`${aiTells} AI tell-phrases detected.`);
  }

  return parts.join(' ');
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

  // Get user's model preference for cloud transformations
  const cloudModel = getCloudModelPreference();
  console.log(`[TransformationService] Persona using model: ${cloudModel}`);

  try {
    const requestBody = {
      text,
      persona: options.persona,
      preserveLength: true,
      enableValidation: true,
      model: cloudModel,
    };
    console.log(`[TransformationService] Persona request:`, {
      textLength: text?.length,
      persona: options.persona,
      hasToken: !!getAuthToken(),
    });

    const response = await fetch(`${getApiBase()}/transformations/persona`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[TransformationService] Persona error (${response.status}):`, errorData);
      throw new Error(errorData.error || errorData.message || 'Persona transformation failed');
    }

    const data = await response.json();

    // Use LLM-based filtering for cloud responses (more reliable than regex)
    let cleanedText = data.transformed_text || '';
    try {
      // Check if Ollama is available for filtering
      const ollamaAvailable = await ollamaService.isOllamaAvailable();
      if (ollamaAvailable) {
        cleanedText = await filterCloudOutput(cleanedText, text);
      } else {
        // Fallback to regex stripping if Ollama not available
        cleanedText = stripThinkingPreamble(cleanedText);
      }
    } catch (filterError) {
      console.warn('[TransformationService] Cloud filtering failed, using regex fallback:', filterError);
      cleanedText = stripThinkingPreamble(cleanedText);
    }

    // Map backend response to TransformResult format
    return {
      transformation_id: data.transformation_id,
      original: text,
      transformed: cleanedText,
      metadata: {
        aiConfidenceBefore: data.baseline?.detection?.aiConfidence,
        aiConfidenceAfter: data.final?.detection?.aiConfidence,
        burstinessBefore: data.baseline?.detection?.burstinessScore,
        burstinessAfter: data.final?.detection?.burstinessScore,
        filteringApplied: true,
        modelUsed: data.model_used || cloudModel,
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

  // Get user's model preference for cloud transformations
  const cloudModel = getCloudModelPreference();
  console.log(`[TransformationService] Style using model: ${cloudModel}`);

  try {
    console.log(`[TransformationService] Style request:`, {
      textLength: text?.length,
      style: options.style,
      hasToken: !!getAuthToken(),
    });

    const response = await fetch(`${getApiBase()}/transformations/style`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        text,
        style: options.style,
        preserveLength: true,
        enableValidation: true,
        model: cloudModel,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[TransformationService] Style error (${response.status}):`, errorData);
      throw new Error(errorData.error || errorData.message || 'Style transformation failed');
    }

    const data = await response.json();

    // Use LLM-based filtering for cloud responses (more reliable than regex)
    let cleanedText = data.transformed_text || '';
    try {
      // Check if Ollama is available for filtering
      const ollamaAvailable = await ollamaService.isOllamaAvailable();
      if (ollamaAvailable) {
        cleanedText = await filterCloudOutput(cleanedText, text);
      } else {
        // Fallback to regex stripping if Ollama not available
        cleanedText = stripThinkingPreamble(cleanedText);
      }
    } catch (filterError) {
      console.warn('[TransformationService] Cloud filtering failed, using regex fallback:', filterError);
      cleanedText = stripThinkingPreamble(cleanedText);
    }

    // Map backend response to TransformResult format
    return {
      transformation_id: data.transformation_id,
      original: text,
      transformed: cleanedText,
      metadata: {
        aiConfidenceBefore: data.baseline?.detection?.aiConfidence,
        aiConfidenceAfter: data.final?.detection?.aiConfidence,
        burstinessBefore: data.baseline?.detection?.burstinessScore,
        burstinessAfter: data.final?.detection?.burstinessScore,
        filteringApplied: true,
        modelUsed: data.model_used || cloudModel,
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

  // Get user's model preference for cloud transformations
  const cloudModel = getCloudModelPreference();
  console.log(`[TransformationService] Namespace using model: ${cloudModel}`);

  try {
    const response = await fetch(`${getApiBase()}/transformations/namespace`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        text,
        namespace: options.namespace,
        preserveLength: true,
        enableValidation: true,
        model: cloudModel,
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
        modelUsed: data.model_used || cloudModel,
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
// TEXT HUMANIZATION
// ============================================================

export interface HumanizationOptions {
  targetAiLikelihood?: number;  // Default: 30 (aim for 30% AI likelihood)
  maxIterations?: number;       // Default: 3 (max validation iterations)
  intensity?: 'light' | 'moderate' | 'aggressive';
  enableBurstiness?: boolean;   // Default: true
  enableSemicolons?: boolean;   // Default: true
  enableTellWords?: boolean;    // Default: true
  enableEmDashReduction?: boolean; // Default: true
}

export interface HumanizationChange {
  type: 'burstiness' | 'semicolon' | 'tell-word' | 'em-dash';
  original: string;
  replacement: string;
  position: number;
  reason: string;
}

export interface HumanizationMetrics {
  burstinessBefore: number;
  burstinessAfter: number;
  semicolonRateBefore: number;
  semicolonRateAfter: number;
  emDashRateBefore: number;
  emDashRateAfter: number;
  tellWordsRemoved: number;
}

export interface HumanizationResult {
  original: string;
  transformed: string;
  aiLikelihoodBefore: number;
  aiLikelihoodAfter: number;
  iterations: number;
  changesApplied: {
    burstiness: number;
    semicolons: number;
    tellWords: number;
    emDashes: number;
    total: number;
  };
  changes: HumanizationChange[];
  metrics: HumanizationMetrics;
  processingTimeMs: number;
  humanizerVersion: string;
}

export interface HumanizationPreview {
  aiLikelihood: number;
  wouldApply: {
    burstiness: number;
    semicolons: number;
    tellWords: number;
    emDashes: number;
  };
  tellWordsFound: Array<{
    original: string;
    replacement: string;
    weight: number;
    category: string;
  }>;
  metrics: {
    burstiness: number;
    semicolonRate: number;
    emDashRate: number;
  };
}

/**
 * Full humanization with validation loop
 * Transforms text to appear more human-like using:
 * - Burstiness injection (sentence length variance)
 * - Semicolon insertion (humans use more semicolons)
 * - Tell-word replacement (AI-characteristic phrases)
 * - Em-dash reduction (AI overuses em-dashes)
 */
export async function humanizeText(
  text: string,
  options: HumanizationOptions = {}
): Promise<HumanizationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const response = await fetch(`${getApiBase()}/ai-detection/humanize`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text, options }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Humanization failed');
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Humanization timed out after 60 seconds. Try using a shorter text.');
    }
    throw error;
  }
}

/**
 * Quick humanization without validation loop (single pass)
 */
export async function humanizeTextQuick(
  text: string,
  options: HumanizationOptions = {}
): Promise<HumanizationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch(`${getApiBase()}/ai-detection/humanize/quick`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text, options }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Quick humanization failed');
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Humanization timed out after 30 seconds.');
    }
    throw error;
  }
}

/**
 * Preview humanization without applying changes
 * Shows what would be changed and current metrics
 */
export async function previewHumanization(
  text: string,
  intensity: 'light' | 'moderate' | 'aggressive' = 'moderate'
): Promise<HumanizationPreview> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    const response = await fetch(`${getApiBase()}/ai-detection/humanize/preview`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text, intensity }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Preview failed');
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Preview timed out after 15 seconds.');
    }
    throw error;
  }
}

// ============================================================
// SIC (SUBJECTIVE INTENTIONAL CONSTRAINT) ANALYSIS
// ============================================================

export interface SicFeatureScore {
  score: number;
  notes: string;
  evidence?: Array<{
    quote: string;
    relevance: string;
  }>;
}

export interface SicAnalysisResult {
  version: string;
  sicScore: number;
  aiProbability: number;
  genre: string;
  features: {
    commitment_irreversibility: SicFeatureScore;
    epistemic_risk_uncertainty: SicFeatureScore;
    time_pressure_tradeoffs: SicFeatureScore;
    situatedness_body_social: SicFeatureScore;
    scar_tissue_specificity: SicFeatureScore;
    bounded_viewpoint: SicFeatureScore;
    anti_smoothing: SicFeatureScore;
    meta_contamination: SicFeatureScore;
  };
  constraintGaps: string[];
  notes: string;
  processingTimeMs: number;
  narrativeModeCaveat?: {
    isNarrativeMode: boolean;
    explanation: string;
  };
}

export interface SicAnalysisOptions {
  genreHint?: string;
  maxChunks?: number;
}

/**
 * SIC (Subjective Intentional Constraint) Analysis
 * Measures constraint traces in text - the "cost of authorship"
 *
 * Returns 8 features:
 * - commitment_irreversibility: Definitive stances with consequences
 * - epistemic_risk_uncertainty: Being wrong that mattered
 * - time_pressure_tradeoffs: Urgency, deadlines, asymmetric time
 * - situatedness_body_social: Physical/social grounding
 * - scar_tissue_specificity: Persistent residue ("still flinch")
 * - bounded_viewpoint: Non-omniscient narration
 * - anti_smoothing: Refusal of symmetry, taking sides
 * - meta_contamination: Preambles, "EDIT:", manager voice (negative)
 */
export async function sicAnalysis(
  text: string,
  options: SicAnalysisOptions = {}
): Promise<SicAnalysisResult> {
  // Validate input
  if (!text || text.trim().length < 50) {
    throw new Error('Text must be at least 50 characters for SIC analysis');
  }

  if (text.length > 50000) {
    throw new Error('Text too long for SIC analysis (max 50,000 characters)');
  }

  // SIC analysis ALWAYS uses cloud backend (requires LLM capabilities)
  // Local Ollama doesn't support the SIC analysis pipeline
  const CLOUD_API_URL = 'https://npe-api.tem-527.workers.dev';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

  console.log('[SIC Analysis] Using cloud API:', CLOUD_API_URL);

  try {
    const response = await fetch(`${CLOUD_API_URL}/ai-detection/sic/sic`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        text,
        genreHint: options.genreHint,
        maxChunks: options.maxChunks,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || 'SIC analysis failed');
    }

    const data = await response.json();

    // Map to result format
    return {
      version: data.version || 'sic.v1',
      sicScore: data.sicScore,
      aiProbability: data.aiProbability,
      genre: data.genre,
      features: {
        commitment_irreversibility: mapFeature(data.features?.commitment_irreversibility),
        epistemic_risk_uncertainty: mapFeature(data.features?.epistemic_risk_uncertainty),
        time_pressure_tradeoffs: mapFeature(data.features?.time_pressure_tradeoffs),
        situatedness_body_social: mapFeature(data.features?.situatedness_body_social),
        scar_tissue_specificity: mapFeature(data.features?.scar_tissue_specificity),
        bounded_viewpoint: mapFeature(data.features?.bounded_viewpoint),
        anti_smoothing: mapFeature(data.features?.anti_smoothing),
        meta_contamination: mapFeature(data.features?.meta_contamination),
      },
      constraintGaps: identifyGaps(data.features),
      notes: data.notes || '',
      processingTimeMs: data.diagnostics?.totalDurationMs || 0,
      narrativeModeCaveat: data.narrativeModeCaveat,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('SIC analysis timed out after 2 minutes. Try using a shorter text.');
    }
    throw error;
  }
}

/**
 * Helper to map feature data with defaults
 */
function mapFeature(feature: any): SicFeatureScore {
  return {
    score: feature?.score ?? 50,
    notes: feature?.notes || '',
    evidence: feature?.evidence || [],
  };
}

/**
 * Helper to identify constraint gaps (features below threshold)
 */
function identifyGaps(features: any): string[] {
  const GAP_THRESHOLD = 45;
  const gaps: string[] = [];

  if (!features) return gaps;

  const featureKeys = [
    'commitment_irreversibility',
    'epistemic_risk_uncertainty',
    'time_pressure_tradeoffs',
    'situatedness_body_social',
    'scar_tissue_specificity',
    'bounded_viewpoint',
    'anti_smoothing',
  ];

  for (const key of featureKeys) {
    const score = features[key]?.score;
    if (typeof score === 'number' && score < GAP_THRESHOLD) {
      gaps.push(key);
    }
  }

  // meta_contamination is negative, so HIGH score is bad
  if (features.meta_contamination?.score > 55) {
    gaps.push('meta_contamination');
  }

  return gaps;
}

/**
 * Get SIC feature definitions (for UI help text)
 */
export async function getSicFeatureDefinitions(): Promise<Array<{
  key: string;
  description: string;
  type: 'positive' | 'negative';
}>> {
  try {
    const response = await fetch(`${getApiBase()}/ai-detection/sic/features`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch SIC features');
    }

    const data = await response.json();
    return data.features || [];
  } catch (error) {
    // Return hardcoded fallback
    return [
      { key: 'commitment_irreversibility', description: 'Concrete decisions with consequences. "Humans trap themselves. LLMs keep exits open."', type: 'positive' },
      { key: 'epistemic_risk_uncertainty', description: 'Being wrong, surprises, ignorance that mattered. Not hedging, but genuine stakes.', type: 'positive' },
      { key: 'time_pressure_tradeoffs', description: 'Urgency, deadlines, asymmetric time awareness. Evidence of lived time.', type: 'positive' },
      { key: 'situatedness_body_social', description: 'Embodied risk, social cost, friction. Body, place, reputation at stake.', type: 'positive' },
      { key: 'scar_tissue_specificity', description: 'Persistent involuntary residue: "still flinch", "keeps me up". "Humans heal; LLMs regenerate."', type: 'positive' },
      { key: 'bounded_viewpoint', description: 'Non-omniscient narration. The narrator acknowledges not knowing everything.', type: 'positive' },
      { key: 'anti_smoothing', description: 'Refusal of symmetry. Does the author take a side or perform balance? High = chose a side.', type: 'positive' },
      { key: 'meta_contamination', description: 'Preambles, meta-exposition, "in conclusion". Manager voice replacing lived sequence.', type: 'negative' },
    ];
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
        voiceProfile: config.parameters.voiceProfile as string | undefined,
        model: config.parameters.model as string | undefined,
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
        namespace: (config.parameters.namespace as string) || 'enlightenment_science',
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
