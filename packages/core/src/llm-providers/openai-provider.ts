/**
 * OpenAI LLM Provider
 *
 * Connects to OpenAI API for completions and embeddings.
 * This is a thin execution layer - Model-Master decides which model to use.
 *
 * @module llm-providers/openai-provider
 */

import type {
  LlmProvider,
  LlmRequest,
  LlmResponse,
  EmbedRequest,
  EmbedResponse,
  ProviderStatus,
} from './types.js';
import { ProviderError, ProviderUnavailableError } from './types.js';

const DEFAULT_URL = 'https://api.openai.com/v1';
const DEFAULT_TIMEOUT = 60000;

/**
 * OpenAI provider configuration
 */
export interface OpenAIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

/**
 * OpenAI LLM provider
 */
export class OpenAIProvider implements LlmProvider {
  readonly name = 'openai' as const;

  private apiKey: string | undefined;
  private baseUrl: string;
  private timeoutMs: number;
  private lastStatus: ProviderStatus | null = null;

  constructor(config: OpenAIProviderConfig = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.baseUrl = config.baseUrl || DEFAULT_URL;
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT;
  }

  async chat(request: LlmRequest): Promise<LlmResponse> {
    if (!this.apiKey) {
      throw new ProviderUnavailableError(this.name);
    }

    const startTime = Date.now();
    const timeout = request.timeoutMs || this.timeoutMs;

    try {
      const body: Record<string, unknown> = {
        model: request.modelId,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
        stream: false,
      };

      if (request.stop) {
        body.stop = request.stop;
      }

      if (request.jsonMode) {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new ProviderError(this.name, request.modelId, `HTTP ${response.status}: ${error}`);
      }

      const data = (await response.json()) as {
        choices: Array<{
          message: { content: string };
          finish_reason: string;
        }>;
        usage: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      const latencyMs = Date.now() - startTime;
      const choice = data.choices[0];

      return {
        content: choice.message.content,
        modelId: request.modelId,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        latencyMs,
        finishReason: choice.finish_reason as LlmResponse['finishReason'],
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const cause = error instanceof Error ? error : new Error(String(error));
      throw new ProviderError(this.name, request.modelId, cause.message, cause);
    }
  }

  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    if (!this.apiKey) {
      throw new ProviderUnavailableError(this.name);
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: request.modelId,
          input: request.text,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new ProviderError(this.name, request.modelId, `HTTP ${response.status}: ${error}`);
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>;
      };
      const embedding = data.data[0].embedding;

      return {
        embedding,
        modelId: request.modelId,
        dimensions: embedding.length,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const cause = error instanceof Error ? error : new Error(String(error));
      throw new ProviderError(this.name, request.modelId, cause.message, cause);
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async getStatus(): Promise<ProviderStatus> {
    if (!this.apiKey) {
      this.lastStatus = {
        available: false,
        lastCheck: new Date(),
        error: 'No API key configured',
      };
      return this.lastStatus;
    }

    // OpenAI doesn't have a simple health check endpoint
    // We consider it available if we have an API key
    this.lastStatus = {
      available: true,
      lastCheck: new Date(),
    };
    return this.lastStatus;
  }
}
