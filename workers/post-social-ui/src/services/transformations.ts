/**
 * Transformation Service
 *
 * API wrapper for npe-api humanizer transformation tools.
 * Provides translation, AI detection, humanization, and style transformations.
 */

const NPE_API_BASE = 'https://npe-api.tem-527.workers.dev';

// ==========================================
// Helpers
// ==========================================

/**
 * Build headers with optional auth token
 */
function getHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ==========================================
// Types
// ==========================================

export interface LanguageCategories {
  languages: string[];
  categories: Record<string, string[]>;
}

export interface TranslationResult {
  translation_id: string;
  original_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  detected_language?: string;
  confidence: number;
  model: string;
  processing_time_ms: number;
}

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  script?: string;
}

export interface AIDetectionHighlight {
  start: number;
  end: number;
  reason: string;
  score: number;
}

export interface AIDetectionResult {
  detector_type: 'lite';
  ai_likelihood: number;
  confidence: 'low' | 'medium' | 'high';
  label: 'likely_human' | 'mixed' | 'likely_ai';
  metrics: {
    burstiness: number;
    avgSentenceLength: number;
    sentenceLengthStd: number;
    typeTokenRatio: number;
    repeatedNgrams: number;
  };
  phraseHits: Array<{ phrase: string; count: number; weight: number; category: string }>;
  highlights: AIDetectionHighlight[];
  heuristicScore: number;
  llmScore: number | null;
  processingTimeMs: number;
}

export interface HumanizerResult {
  transformation_id: string;
  humanizedText: string;
  baseline: {
    ai_likelihood: number;
    burstiness?: number;
    lexicalDiversity?: number;
  };
  final: {
    ai_likelihood: number;
    burstiness?: number;
    lexicalDiversity?: number;
  };
  improvement: {
    ai_likelihood_reduction: number;
    burstiness_improvement?: number;
    lexical_diversity_improvement?: number;
  };
  stages?: Record<string, string>;
  voiceProfile?: Record<string, unknown>;
  processing: {
    total_ms: number;
  };
}

export interface RoundTripResult {
  transformation_id: string;
  forward_translation: string;
  backward_translation: string;
  semantic_drift: number;
  preserved_elements: string[];
  lost_elements: string[];
  gained_elements: string[];
  linguistic_analysis: {
    tone_change: string;
    style_change: string;
    complexity_change: string;
    structural_changes: string[];
    notable_patterns: string[];
  };
}

export interface PersonaTransformResult {
  transformation_id: string;
  transformed_text: string;
  baseline?: Record<string, unknown>;
  final?: Record<string, unknown>;
  improvement?: Record<string, unknown>;
  processing?: { total_ms: number };
}

export interface StyleTransformResult {
  transformation_id: string;
  transformed_text: string;
  baseline?: Record<string, unknown>;
  final?: Record<string, unknown>;
  improvement?: Record<string, unknown>;
  processing?: { total_ms: number };
}

export type TransformTool = 'translate' | 'detect' | 'humanize' | 'persona' | 'style' | 'roundtrip';

// ==========================================
// API Functions
// ==========================================

/**
 * Get supported languages with categories
 */
export async function getSupportedLanguages(): Promise<LanguageCategories> {
  const response = await fetch(`${NPE_API_BASE}/transformations/supported-languages`);
  if (!response.ok) {
    throw new Error(`Failed to get languages: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Detect language of text
 */
export async function detectLanguage(text: string): Promise<LanguageDetectionResult> {
  const response = await fetch(`${NPE_API_BASE}/transformations/detect-language`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new Error(`Language detection failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Translate text between languages
 */
export async function translate(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
  token?: string
): Promise<TranslationResult> {
  const response = await fetch(`${NPE_API_BASE}/transformations/translate`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({
      text,
      targetLanguage,
      sourceLanguage,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Translation failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Detect AI-generated content (lite/free version)
 */
export async function detectAI(
  text: string,
  useLLMJudge: boolean = false,
  token?: string
): Promise<AIDetectionResult> {
  const response = await fetch(`${NPE_API_BASE}/ai-detection/lite`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ text, useLLMJudge }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `AI detection failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Humanize AI-generated text
 */
export async function humanize(
  text: string,
  intensity: 'light' | 'moderate' | 'aggressive' = 'moderate',
  voiceSamples?: string[],
  token?: string
): Promise<HumanizerResult> {
  const response = await fetch(`${NPE_API_BASE}/transformations/computer-humanizer`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({
      text,
      intensity,
      voiceSamples,
      enableLLMPolish: true,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Humanization failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Transform text with a persona voice
 */
export async function transformPersona(
  text: string,
  persona: string,
  token?: string
): Promise<PersonaTransformResult> {
  const response = await fetch(`${NPE_API_BASE}/transformations/persona`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({
      text,
      persona,
      preserveLength: true,
      enableValidation: true,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Persona transformation failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Transform text with a style
 */
export async function transformStyle(
  text: string,
  style: string,
  token?: string
): Promise<StyleTransformResult> {
  const response = await fetch(`${NPE_API_BASE}/transformations/style`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({
      text,
      style,
      preserveLength: true,
      enableValidation: true,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Style transformation failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Round-trip translation for semantic drift analysis
 */
export async function roundTrip(
  text: string,
  intermediateLanguage: string,
  token?: string
): Promise<RoundTripResult> {
  const response = await fetch(`${NPE_API_BASE}/transformations/round-trip`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({
      text,
      intermediate_language: intermediateLanguage,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Round-trip failed: ${response.statusText}`);
  }
  return response.json();
}

// ==========================================
// Constants
// ==========================================

/**
 * Language categories for the picker UI
 */
export const LANGUAGE_CATEGORY_LABELS: Record<string, string> = {
  classical: 'Classical',
  romance: 'Romance',
  germanic: 'Germanic',
  slavic: 'Slavic',
  european_other: 'European (Other)',
  east_asian: 'East Asian',
  south_asian: 'South Asian',
  middle_eastern: 'Middle Eastern',
  african: 'African',
  other: 'Other',
};

/**
 * Round-trip supported languages (subset)
 */
export const ROUND_TRIP_LANGUAGES = [
  'spanish', 'french', 'german', 'italian', 'portuguese',
  'russian', 'chinese', 'japanese', 'korean', 'arabic',
  'hebrew', 'hindi', 'dutch', 'swedish', 'norwegian',
  'danish', 'polish', 'czech'
];

/**
 * Humanizer intensity descriptions
 */
export const HUMANIZER_INTENSITIES = {
  light: {
    label: 'Light',
    description: 'Subtle changes, preserves most original structure',
  },
  moderate: {
    label: 'Moderate',
    description: 'Balanced approach, good for most AI text',
  },
  aggressive: {
    label: 'Aggressive',
    description: 'Heavy rewriting, maximum human-like output',
  },
};

// Export service object
export const transformationService = {
  getSupportedLanguages,
  detectLanguage,
  translate,
  detectAI,
  humanize,
  transformPersona,
  transformStyle,
  roundTrip,
};
