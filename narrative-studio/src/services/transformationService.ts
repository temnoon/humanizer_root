// ============================================================
// TRANSFORMATION SERVICE - API Abstraction Layer
// ============================================================
// Handles routing to Ollama (local) or Cloudflare AI (cloud)
// Provides unified interface for all transformation tools

import type { TransformConfig, TransformResult } from '../types';

// Environment detection
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal
  ? 'http://localhost:3002/api'
  : 'https://npe-api.tem-527.workers.dev';

console.log(`[TransformationService] Using ${isLocal ? 'LOCAL' : 'CLOUD'} backend: ${API_BASE}`);

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
  const response = await fetch(`${API_BASE}/transform/computer-humanizer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ...options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Computer Humanizer failed');
  }

  return response.json();
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
  const response = await fetch(`${API_BASE}/transform/ai-detection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ...options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'AI Detection failed');
  }

  return response.json();
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
  const response = await fetch(`${API_BASE}/transform/persona`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ...options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Persona transformation failed');
  }

  return response.json();
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
  const response = await fetch(`${API_BASE}/transform/style`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ...options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Style transformation failed');
  }

  return response.json();
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
  const response = await fetch(`${API_BASE}/transform/namespace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ...options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Namespace transformation failed');
  }

  return response.json();
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

    case 'allegorical':
      // Legacy support - will be removed
      throw new Error('Allegorical transformation has been split into Persona, Style, and Namespace tools');

    default:
      throw new Error(`Unknown transformation type: ${config.type}`);
  }
}
