/**
 * Mock LLM Adapter
 *
 * For testing - returns deterministic responses based on input patterns.
 */

import type { LlmAdapter, LlmCompletionOptions, EmbeddingResponse } from './types.js';
import { normalize } from './normalizer.js';

/**
 * Mock response configuration
 */
export interface MockResponse {
  /** Pattern to match in user input */
  pattern: RegExp;
  /** Response to return */
  response: string;
}

/**
 * Mock LLM adapter for testing
 */
export class MockLlmAdapter implements LlmAdapter {
  readonly name = 'mock';
  readonly defaultModel = 'mock-1.0';

  private responses: MockResponse[] = [];
  private defaultResponse: string;
  private callCount = 0;

  constructor(defaultResponse = '{"result": "mock response"}') {
    this.defaultResponse = defaultResponse;
  }

  /**
   * Add a mock response pattern
   */
  addResponse(pattern: RegExp, response: string): this {
    this.responses.push({ pattern, response });
    return this;
  }

  /**
   * Get call count
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Reset call count
   */
  resetCallCount(): void {
    this.callCount = 0;
  }

  async complete(
    systemPrompt: string,
    userInput: string,
    _options?: LlmCompletionOptions
  ): Promise<string> {
    this.callCount++;

    // Check for matching pattern
    for (const { pattern, response } of this.responses) {
      if (pattern.test(userInput) || pattern.test(systemPrompt)) {
        return response;
      }
    }

    return this.defaultResponse;
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    // Generate deterministic mock embedding based on text hash
    const hash = this.simpleHash(text);
    const dimensions = 384; // Common embedding size
    const embedding = Array.from({ length: dimensions }, (_, i) =>
      Math.sin(hash + i * 0.1) * 0.5
    );

    // Normalize to unit vector
    const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
    const normalized = embedding.map(x => x / norm);

    return {
      embedding: normalized,
      model: 'mock-embedding',
      dimensions,
    };
  }

  normalize(response: string): string {
    return normalize(response);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}

/**
 * Create a mock adapter with common test responses
 */
export function createTestAdapter(): MockLlmAdapter {
  return new MockLlmAdapter()
    .addResponse(
      /genre/i,
      '{"genre": "narrative", "confidence": 0.8}'
    )
    .addResponse(
      /tetralemma|literal|metaphor/i,
      JSON.stringify({
        literal: { probability: 0.3, evidence: 'Direct reference' },
        metaphorical: { probability: 0.4, evidence: 'Symbolic meaning' },
        both: { probability: 0.2, evidence: 'Layered meaning' },
        neither: { probability: 0.1, evidence: 'Transcends categories' },
      })
    )
    .addResponse(
      /sic|constraint|subjective/i,
      JSON.stringify({
        features: {
          commitment_irreversibility: { score: 65, evidence: [] },
          epistemic_risk_uncertainty: { score: 55, evidence: [] },
          time_pressure_tradeoffs: { score: 50, evidence: [] },
          situatedness_body_social: { score: 60, evidence: [] },
          scar_tissue_specificity: { score: 45, evidence: [] },
          bounded_viewpoint: { score: 70, evidence: [] },
          anti_smoothing: { score: 55, evidence: [] },
          meta_contamination: { score: 30, evidence: [] },
        },
        inflectionPoints: [],
        sicScore: 58,
        aiProbability: 0.42,
      })
    );
}
