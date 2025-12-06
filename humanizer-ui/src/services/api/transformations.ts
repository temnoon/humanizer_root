/**
 * Transformation API Service
 * Computer Humanizer, AI Detection, Persona/Style, Round-Trip Translation
 */

import { ApiClient } from './client';

export interface TransformationRequest {
  text: string;
  options?: Record<string, any>;
}

export interface TransformationResponse {
  original: string;
  transformed: string;
  metadata?: Record<string, any>;
}

export interface AIDetectionResult {
  text: string;
  aiProbability: number;
  highlights: Array<{
    start: number;
    end: number;
    score: number;
    reason: string;
  }>;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  examples: string[];
}

export interface Style {
  id: string;
  name: string;
  description: string;
}

export interface RoundTripResult {
  original: string;
  translated: string;
  backTranslated: string;
  language: string;
  similarity: number;
}

export class TransformationService {
  constructor(private client: ApiClient) {}

  /**
   * Computer Humanizer - Make AI text sound more human
   */
  async humanize(text: string, options?: {
    mode?: 'basic' | 'advanced' | 'natural';
  }): Promise<TransformationResponse> {
    return this.client.post('/api/transformations/humanize', {
      text,
      ...options,
    });
  }

  /**
   * AI Detection - Detect AI-generated text
   */
  async detectAI(text: string): Promise<AIDetectionResult> {
    return this.client.post('/api/transformations/detect-ai', { text });
  }

  /**
   * List available personas
   */
  async listPersonas(): Promise<Persona[]> {
    return this.client.get('/api/transformations/personas');
  }

  /**
   * List available styles
   */
  async listStyles(): Promise<Style[]> {
    return this.client.get('/api/transformations/styles');
  }

  /**
   * Apply persona and style to text
   */
  async applyPersonaStyle(
    text: string,
    personaId: string,
    styleId: string
  ): Promise<TransformationResponse> {
    return this.client.post('/api/transformations/persona-style', {
      text,
      personaId,
      styleId,
    });
  }

  /**
   * Round-trip translation
   */
  async roundTrip(
    text: string,
    targetLanguage: string
  ): Promise<RoundTripResult> {
    return this.client.post('/api/transformations/round-trip', {
      text,
      targetLanguage,
    });
  }
}
