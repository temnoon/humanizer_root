/**
 * Anthropic LLM Provider
 *
 * Connects to Anthropic API for Claude completions.
 * This is a thin execution layer - Model-Master decides which model to use.
 *
 * @module llm-providers/anthropic-provider
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

const DEFAULT_URL = 'https://api.anthropic.com/v1';
const DEFAULT_TIMEOUT = 120000; // Anthropic can be slower for long responses
const API_VERSION = '2023-06-01';

/**
 * Anthropic provider configuration
 */
export interface AnthropicProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

/**
 * Anthropic LLM provider
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic' as const;

  private apiKey: string | undefined;
  private baseUrl: string;
  private timeoutMs: number;
  private lastStatus: ProviderStatus | null = null;

  constructor(config: AnthropicProviderConfig = {}) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
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
      // Extract system message
      const systemMessage = request.messages.find(m => m.role === 'system');
      const otherMessages = request.messages.filter(m => m.role !== 'system');

      const body: Record<string, unknown> = {
        model: request.modelId,
        messages: otherMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: request.maxTokens ?? 4096,
        stream: false,
      };

      if (systemMessage) {
        body.system = systemMessage.content;
      }

      if (request.temperature !== undefined) {
        body.temperature = request.temperature;
      }

      if (request.stop) {
        body.stop_sequences = request.stop;
      }

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new ProviderError(this.name, request.modelId, `HTTP ${response.status}: ${error}`);
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
        stop_reason: string;
        usage: {
          input_tokens: number;
          output_tokens: number;
        };
      };

      const latencyMs = Date.now() - startTime;

      // Extract text content
      const textContent = data.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('');

      return {
        content: textContent,
        modelId: request.modelId,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
        latencyMs,
        finishReason: this.mapStopReason(data.stop_reason),
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const cause = error instanceof Error ? error : new Error(String(error));
      throw new ProviderError(this.name, request.modelId, cause.message, cause);
    }
  }

  private mapStopReason(reason: string): LlmResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      default:
        return 'stop';
    }
  }

  async embed(_request: EmbedRequest): Promise<EmbedResponse> {
    // Anthropic doesn't provide embedding models
    throw new ProviderError(
      this.name,
      _request.modelId,
      'Anthropic does not support embeddings. Use Voyage, OpenAI, or Ollama for embeddings.'
    );
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

    // Anthropic doesn't have a simple health check endpoint
    // We consider it available if we have an API key
    this.lastStatus = {
      available: true,
      lastCheck: new Date(),
    };
    return this.lastStatus;
  }
}
