/**
 * Transformation Service
 *
 * Client for the NPE API transformation endpoints.
 * Handles provider detection (Ollama vs Cloud) and request routing.
 */

import type {
  HumanizerRequest,
  HumanizerResponse,
  PersonaRequest,
  PersonaResponse,
  StyleRequest,
  StyleResponse,
  DetectionRequest,
  DetectionResponse,
  TransformResult,
  ServiceError,
  TransformProvider,
  HumanizationIntensity,
} from './types';
import { getStoredToken } from '../auth';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

// API base URLs
const CLOUD_API_BASE = import.meta.env.VITE_API_URL || 'https://npe-api.tem-527.workers.dev';
const OLLAMA_API_BASE = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';

// Request timeouts
const DEFAULT_TIMEOUT = 120_000; // 2 minutes
const LONG_TIMEOUT = 300_000;    // 5 minutes for deep analysis

// ═══════════════════════════════════════════════════════════════════
// PROVIDER DETECTION
// ═══════════════════════════════════════════════════════════════════

let ollamaAvailable: boolean | null = null;
let ollamaCheckTime = 0;
const OLLAMA_CHECK_INTERVAL = 30_000; // Check every 30 seconds

/**
 * Check if Ollama is available locally
 */
export async function checkOllamaAvailable(): Promise<boolean> {
  const now = Date.now();

  // Use cached result if recent
  if (ollamaAvailable !== null && now - ollamaCheckTime < OLLAMA_CHECK_INTERVAL) {
    return ollamaAvailable;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${OLLAMA_API_BASE}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    ollamaAvailable = response.ok;
    ollamaCheckTime = now;

    return ollamaAvailable;
  } catch {
    ollamaAvailable = false;
    ollamaCheckTime = now;
    return false;
  }
}

/**
 * Get the current provider based on availability
 */
export async function getCurrentProvider(): Promise<TransformProvider> {
  const isOllamaUp = await checkOllamaAvailable();
  return isOllamaUp ? 'ollama' : 'cloud';
}

/**
 * Get the API base URL for the current provider
 */
export function getApiBase(provider: TransformProvider): string {
  return provider === 'ollama' ? OLLAMA_API_BASE : CLOUD_API_BASE;
}

// ═══════════════════════════════════════════════════════════════════
// HTTP CLIENT
// ═══════════════════════════════════════════════════════════════════

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
}

async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { method = 'POST', body, timeout = DEFAULT_TIMEOUT, signal } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Combine external signal with timeout
  const combinedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  // Build headers with auth if available
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${CLOUD_API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: combinedSignal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as ServiceError;
      throw new Error(errorData.error || `Request failed: ${response.statusText}`);
    }

    return await response.json() as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }

    throw new Error('Unknown error occurred');
  }
}

// ═══════════════════════════════════════════════════════════════════
// HUMANIZER
// ═══════════════════════════════════════════════════════════════════

/**
 * Humanize AI-generated text
 */
export async function humanize(
  text: string,
  options: {
    intensity?: HumanizationIntensity;
    voiceSamples?: string[];
    enableLLMPolish?: boolean;
    enableSicAnalysis?: boolean;
    model?: string;
  } = {},
  signal?: AbortSignal
): Promise<TransformResult> {
  const request: HumanizerRequest = {
    text,
    intensity: options.intensity || 'moderate',
    voiceSamples: options.voiceSamples,
    enableLLMPolish: options.enableLLMPolish ?? true,
    enableSicAnalysis: options.enableSicAnalysis ?? false,
    model: options.model,
  };

  const response = await apiFetch<HumanizerResponse>(
    '/transformations/computer-humanizer',
    { body: request, timeout: LONG_TIMEOUT, signal }
  );

  return {
    transformationId: response.transformation_id,
    original: text,
    transformed: response.humanizedText,
    metadata: {
      modelUsed: response.model_used,
      processingTimeMs: response.processing?.totalTimeMs,
      baseline: response.baseline,
      final: response.final,
      improvement: response.improvement,
    },
  };
}

/**
 * Analyze text for humanization needs (pre-flight check)
 */
export async function analyzeForHumanization(
  text: string
): Promise<{
  needsHumanization: boolean;
  recommendation: HumanizationIntensity;
  currentMetrics: {
    aiConfidence?: number;
    burstiness?: number;
    lexicalDiversity?: number;
  };
  reasons: string[];
}> {
  return apiFetch('/transformations/computer-humanizer/analyze', {
    body: { text },
    timeout: DEFAULT_TIMEOUT,
  });
}

// ═══════════════════════════════════════════════════════════════════
// PERSONA TRANSFORMATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Transform text using a persona
 * Supports both named personas (from DB) and free-text personas
 */
export async function transformPersona(
  text: string,
  persona: string,
  options: {
    preserveLength?: boolean;
    enableValidation?: boolean;
    model?: string;
  } = {},
  signal?: AbortSignal
): Promise<TransformResult> {
  const request: PersonaRequest = {
    text,
    persona,
    preserveLength: options.preserveLength ?? true,
    enableValidation: options.enableValidation ?? true,
    model: options.model,
  };

  const response = await apiFetch<PersonaResponse>(
    '/transformations/persona',
    { body: request, timeout: LONG_TIMEOUT, signal }
  );

  return {
    transformationId: response.transformation_id,
    original: text,
    transformed: response.transformed_text,
    metadata: {
      modelUsed: response.model_used,
      processingTimeMs: response.processing?.totalTimeMs,
      baseline: response.baseline,
      final: response.final,
      improvement: response.improvement,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// STYLE TRANSFORMATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Transform text using a style
 */
export async function transformStyle(
  text: string,
  style: string,
  options: {
    preserveLength?: boolean;
    enableValidation?: boolean;
    model?: string;
  } = {},
  signal?: AbortSignal
): Promise<TransformResult> {
  const request: StyleRequest = {
    text,
    style,
    preserveLength: options.preserveLength ?? true,
    enableValidation: options.enableValidation ?? true,
    model: options.model,
  };

  const response = await apiFetch<StyleResponse>(
    '/transformations/style',
    { body: request, timeout: LONG_TIMEOUT, signal }
  );

  return {
    transformationId: response.transformation_id,
    original: text,
    transformed: response.transformed_text,
    metadata: {
      modelUsed: response.model_used,
      processingTimeMs: response.processing?.totalTimeMs,
      baseline: response.baseline,
      final: response.final,
      improvement: response.improvement,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// AI DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect if text is AI-generated
 */
export async function detectAI(
  text: string,
  signal?: AbortSignal
): Promise<DetectionResponse> {
  const request: DetectionRequest = { text };

  return apiFetch<DetectionResponse>(
    '/ai-detection/detect',
    { body: request, timeout: DEFAULT_TIMEOUT, signal }
  );
}

/**
 * Lite detection (free tier, no GPTZero)
 */
export async function detectAILite(
  text: string,
  signal?: AbortSignal
): Promise<DetectionResponse> {
  const request: DetectionRequest = { text };

  return apiFetch<DetectionResponse>(
    '/ai-detection/lite',
    { body: request, timeout: DEFAULT_TIMEOUT, signal }
  );
}

// ═══════════════════════════════════════════════════════════════════
// QUANTUM ANALYSIS (Sentencing)
// ═══════════════════════════════════════════════════════════════════

import type {
  QuantumSessionStartResponse,
  QuantumStepResponse,
  QuantumTraceResponse,
  SentenceAnalysisResult,
} from './types';

/**
 * Start a quantum analysis session
 */
export async function startQuantumSession(
  text: string,
  signal?: AbortSignal
): Promise<QuantumSessionStartResponse> {
  return apiFetch<QuantumSessionStartResponse>(
    '/quantum-analysis/start',
    { body: { text }, timeout: DEFAULT_TIMEOUT, signal }
  );
}

/**
 * Step through quantum analysis (process next sentence)
 */
export async function stepQuantumSession(
  sessionId: string,
  signal?: AbortSignal
): Promise<QuantumStepResponse> {
  return apiFetch<QuantumStepResponse>(
    `/quantum-analysis/${sessionId}/step`,
    { timeout: DEFAULT_TIMEOUT, signal }
  );
}

/**
 * Get the full trace of a quantum session
 */
export async function getQuantumTrace(
  sessionId: string,
  signal?: AbortSignal
): Promise<QuantumTraceResponse> {
  return apiFetch<QuantumTraceResponse>(
    `/quantum-analysis/${sessionId}/trace`,
    { method: 'GET', timeout: DEFAULT_TIMEOUT, signal }
  );
}

/**
 * Run full sentence analysis (all-at-once convenience function)
 * Starts a session and steps through all sentences
 */
export async function analyzeSentences(
  text: string,
  onProgress?: (current: number, total: number, sentence: QuantumStepResponse) => void,
  signal?: AbortSignal
): Promise<SentenceAnalysisResult> {
  // Start session
  const session = await startQuantumSession(text, signal);

  const results: QuantumStepResponse[] = [];
  let done = false;

  // Step through all sentences
  while (!done && !signal?.aborted) {
    const step = await stepQuantumSession(session.session_id, signal);
    results.push(step);
    done = step.done;

    if (onProgress) {
      onProgress(step.sentence_index + 1, session.total_sentences, step);
    }
  }

  // Transform to simplified result
  const sentences = results.map((r) => {
    const tetralemma = {
      literal: r.measurement.literal.probability,
      metaphorical: r.measurement.metaphorical.probability,
      both: r.measurement.both.probability,
      neither: r.measurement.neither.probability,
    };

    // Find dominant stance
    const max = Math.max(tetralemma.literal, tetralemma.metaphorical, tetralemma.both, tetralemma.neither);
    let dominant: 'literal' | 'metaphorical' | 'both' | 'neither' = 'literal';
    if (max === tetralemma.metaphorical) dominant = 'metaphorical';
    else if (max === tetralemma.both) dominant = 'both';
    else if (max === tetralemma.neither) dominant = 'neither';

    return {
      index: r.sentence_index,
      text: r.sentence,
      tetralemma,
      dominant,
      entropy: r.rho_after.entropy,
      purity: r.rho_after.purity,
    };
  });

  // Calculate overall stats
  const avgEntropy = sentences.reduce((sum, s) => sum + s.entropy, 0) / sentences.length;
  const avgPurity = sentences.reduce((sum, s) => sum + s.purity, 0) / sentences.length;

  // Find overall dominant stance
  const stanceCounts = { literal: 0, metaphorical: 0, both: 0, neither: 0 };
  for (const s of sentences) {
    stanceCounts[s.dominant]++;
  }
  const dominantStance = Object.entries(stanceCounts).sort((a, b) => b[1] - a[1])[0][0];

  return {
    sentences,
    overall: {
      totalSentences: sentences.length,
      avgEntropy,
      avgPurity,
      dominantStance,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// AVAILABLE PERSONAS AND STYLES
// ═══════════════════════════════════════════════════════════════════

export interface PersonaDefinition {
  id?: number;
  name: string;
  description: string;
  system_prompt?: string;
  icon?: string;
  usage_count?: number;
}

export interface StyleDefinition {
  id?: number;
  name: string;
  description?: string;
  style_prompt?: string;
  icon?: string;
  usage_count?: number;
}

// Icons for known profile names
const PERSONA_ICONS: Record<string, string> = {
  'Academic': '📚',
  'Conversational': '💬',
  'Technical': '⚙️',
  'Creative': '🎨',
  'Professional': '💼',
  'Casual': '😊',
  'Empathetic': '❤️',
  'Authoritative': '👔',
  'Playful': '🎮',
  'Analytical': '🔬',
  'default': '◐',
};

const STYLE_ICONS: Record<string, string> = {
  'Formal': '📝',
  'Casual': '✏️',
  'Concise': '✂️',
  'Elaborate': '📖',
  'Academic': '🎓',
  'Journalistic': '📰',
  'Literary': '✨',
  'Technical': '🔧',
  'Poetic': '🌸',
  'default': '❧',
};

/**
 * Get icon for persona by name
 */
export function getPersonaIcon(name: string): string {
  return PERSONA_ICONS[name] || PERSONA_ICONS['default'];
}

/**
 * Get icon for style by name
 */
export function getStyleIcon(name: string): string {
  return STYLE_ICONS[name] || STYLE_ICONS['default'];
}

/**
 * Fetch available personas from the API
 * Uses /config/personas endpoint which returns active personas from database
 */
export async function getPersonas(): Promise<PersonaDefinition[]> {
  try {
    // API returns array directly, not wrapped in object
    const response = await apiFetch<PersonaDefinition[]>(
      '/config/personas',
      { method: 'GET', timeout: 10_000 }
    );

    // Add icons to personas
    return response.map(p => ({
      ...p,
      icon: getPersonaIcon(p.name),
    }));
  } catch {
    // Return built-in defaults if API fails
    return [
      { name: 'Academic', description: 'Scholarly, precise, citation-aware', icon: '📚' },
      { name: 'Conversational', description: 'Friendly, accessible, warm', icon: '💬' },
      { name: 'Technical', description: 'Detailed, systematic, thorough', icon: '⚙️' },
      { name: 'Creative', description: 'Expressive, imaginative, flowing', icon: '🎨' },
    ];
  }
}

/**
 * Fetch available styles from the API
 * Uses /config/styles endpoint which returns active styles from database
 */
export async function getStyles(): Promise<StyleDefinition[]> {
  try {
    // API returns array directly, not wrapped in object
    const response = await apiFetch<StyleDefinition[]>(
      '/config/styles',
      { method: 'GET', timeout: 10_000 }
    );

    // Add icons and extract description from style_prompt if missing
    return response.map(s => ({
      ...s,
      description: s.description || extractStyleDescription(s.style_prompt),
      icon: getStyleIcon(s.name),
    }));
  } catch {
    // Return built-in defaults if API fails
    return [
      { name: 'Formal', description: 'Professional, polished', icon: '📝' },
      { name: 'Casual', description: 'Relaxed, natural', icon: '✏️' },
      { name: 'Concise', description: 'Tighten, remove fluff', icon: '✂️' },
      { name: 'Elaborate', description: 'Expand, add detail', icon: '📖' },
    ];
  }
}

/**
 * Extract a short description from a style_prompt
 */
function extractStyleDescription(prompt?: string): string {
  if (!prompt) return 'Custom style';
  // Get first sentence or first 50 chars
  const firstSentence = prompt.split(/[.!?]/)[0];
  if (firstSentence.length <= 60) return firstSentence;
  return firstSentence.substring(0, 57) + '...';
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export type {
  HumanizerRequest,
  HumanizerResponse,
  PersonaRequest,
  PersonaResponse,
  StyleRequest,
  StyleResponse,
  DetectionRequest,
  DetectionResponse,
  TransformResult,
  HumanizationIntensity,
};
