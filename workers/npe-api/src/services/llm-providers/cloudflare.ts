/**
 * Cloudflare Workers AI Provider
 * Uses Cloudflare's native AI binding (@cf/ models)
 */

import type { Env } from '../../../shared/types';
import type { LLMProvider, LLMRequest, LLMResponse } from './base';

export class CloudflareProvider implements LLMProvider {
  constructor(
    private env: Env,
    private modelId: string
  ) {}

  async call(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await this.env.AI.run(this.modelId, {
        messages: request.messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature
      });

      return {
        response: response.response || '',
        model: this.modelId
      };
    } catch (error) {
      console.error('Cloudflare AI call failed:', error);
      throw new Error(`Cloudflare AI failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getProviderName(): string {
    return 'cloudflare';
  }

  async isAvailable(): Promise<boolean> {
    // Cloudflare models are always available (no API key needed)
    return true;
  }
}
