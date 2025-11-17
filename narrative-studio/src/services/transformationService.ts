// ============================================================
// TRANSFORMATION SERVICE - API Abstraction Layer
// ============================================================
// Handles routing to Ollama (local) or Cloudflare AI (cloud)
// Provides unified interface for all transformation tools

import type { TransformConfig, TransformResult } from '../types';

// Environment detection
// NOTE: Always use deployed backend for now (no local backend running)
const API_BASE = 'https://npe-api.tem-527.workers.dev';

console.log(`[TransformationService] Using DEPLOYED backend: ${API_BASE}`);

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
      aiConfidenceBefore: data.baseline?.detection?.aiConfidence || 0,
      aiConfidenceAfter: data.final?.detection?.aiConfidence || 0,
      burstinessBefore: data.baseline?.detection?.burstinessScore || 0,
      burstinessAfter: data.final?.detection?.burstinessScore || 0,
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
}

export interface AIDetectionResult extends TransformResult {
  metadata: {
    aiDetection: {
      confidence: number;
      verdict: 'human' | 'ai' | 'mixed';
      tellWords: string[];
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
  const response = await fetch(`${API_BASE}/ai-detection/detect`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ text, ...options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'AI Detection failed');
  }

  const data = await response.json();

  // Map backend AI detection response to TransformResult format
  // AI detection doesn't transform text, so transformed === original
  return {
    transformation_id: crypto.randomUUID(),
    original: text,
    transformed: text, // Detection doesn't change the text
    metadata: {
      aiDetection: {
        confidence: data.confidence || 0,
        verdict: data.verdict || 'uncertain',
        tellWords: data.tellWords || [],
        burstiness: data.burstiness || 0,
        perplexity: data.perplexity || 0,
        reasoning: data.reasoning || '',
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
