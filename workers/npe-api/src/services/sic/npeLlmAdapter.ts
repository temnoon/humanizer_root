/**
 * Subjective Intentional Constraint (SIC) - NPE LLM Adapter
 *
 * Adapter that wraps the existing NPE LLM provider infrastructure
 * for use with the SIC engine.
 */

import type { Env } from '../../../shared/types';
import type { LlmAdapter } from './types';
import { createLLMProvider, type LLMProvider } from '../llm-providers';
import { normalizeResponse } from './chunk';

/**
 * Default models for different passes
 */
export const DEFAULT_MODELS = {
  /** Fast model for extraction pass */
  extractor: '@cf/meta/llama-3.1-8b-instruct',
  /** Stronger model for judge pass */
  judge: '@cf/meta/llama-3.1-70b-instruct',
  /** Alternative cloud models */
  cloud: {
    extractor: 'gpt-4o-mini',
    judge: 'gpt-4o',
  },
};

/**
 * NPE LLM Adapter
 * Wraps the existing LLM provider infrastructure
 */
export class NpeLlmAdapter implements LlmAdapter {
  private provider: LLMProvider | null = null;
  private env: Env;
  private userId: string;
  private modelId: string;
  private callCount: number = 0;

  constructor(env: Env, userId: string, modelId?: string) {
    this.env = env;
    this.userId = userId;
    this.modelId = modelId || DEFAULT_MODELS.extractor;
  }

  /**
   * Get the current call count
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Reset the call count
   */
  resetCallCount(): void {
    this.callCount = 0;
  }

  /**
   * Get or create the LLM provider
   */
  private async getProvider(): Promise<LLMProvider> {
    if (!this.provider) {
      this.provider = await createLLMProvider(
        this.modelId,
        this.env,
        this.userId
      );
    }
    return this.provider;
  }

  /**
   * Complete a prompt
   */
  async complete(
    systemPrompt: string,
    userInput: string,
    options?: {
      temperature?: number;
      max_tokens?: number;
      model?: string;
    }
  ): Promise<string> {
    // If a different model is specified, create a new provider
    let provider: LLMProvider;
    if (options?.model && options.model !== this.modelId) {
      provider = await createLLMProvider(
        options.model,
        this.env,
        this.userId
      );
    } else {
      provider = await this.getProvider();
    }

    this.callCount++;

    const response = await provider.call({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ],
      max_tokens: options?.max_tokens || 2000,
      temperature: options?.temperature ?? 0.3,
    });

    return response.response;
  }

  /**
   * Normalize response to clean JSON
   */
  normalize(response: string): string {
    return normalizeResponse(response);
  }

  /**
   * Get provider name for logging
   */
  getProviderName(): string {
    return this.provider?.getProviderName() || 'npe-pending';
  }
}

/**
 * Factory function to create an adapter for extraction pass
 */
export function createExtractorAdapter(
  env: Env,
  userId: string,
  useCloud: boolean = false
): NpeLlmAdapter {
  const modelId = useCloud
    ? DEFAULT_MODELS.cloud.extractor
    : DEFAULT_MODELS.extractor;
  return new NpeLlmAdapter(env, userId, modelId);
}

/**
 * Factory function to create an adapter for judge pass
 */
export function createJudgeAdapter(
  env: Env,
  userId: string,
  useCloud: boolean = false
): NpeLlmAdapter {
  const modelId = useCloud
    ? DEFAULT_MODELS.cloud.judge
    : DEFAULT_MODELS.judge;
  return new NpeLlmAdapter(env, userId, modelId);
}

/**
 * Adapter configuration for different tiers
 */
export interface AdapterConfig {
  extractorModel: string;
  judgeModel: string;
  maxChunks: number;
  skipGenreDetection: boolean;
}

/**
 * Get adapter configuration for a pricing tier
 */
export function getAdapterConfigForTier(tier: 'free' | 'reader' | 'author' | 'scholar'): AdapterConfig {
  switch (tier) {
    case 'free':
      return {
        extractorModel: DEFAULT_MODELS.extractor,
        judgeModel: DEFAULT_MODELS.extractor, // Use cheap model for judge too
        maxChunks: 2,
        skipGenreDetection: true,
      };
    case 'reader':
      return {
        extractorModel: DEFAULT_MODELS.extractor,
        judgeModel: DEFAULT_MODELS.judge,
        maxChunks: 5,
        skipGenreDetection: false,
      };
    case 'author':
      return {
        extractorModel: DEFAULT_MODELS.extractor,
        judgeModel: DEFAULT_MODELS.judge,
        maxChunks: 10,
        skipGenreDetection: false,
      };
    case 'scholar':
      return {
        extractorModel: DEFAULT_MODELS.cloud.extractor,
        judgeModel: DEFAULT_MODELS.cloud.judge,
        maxChunks: 20,
        skipGenreDetection: false,
      };
  }
}
