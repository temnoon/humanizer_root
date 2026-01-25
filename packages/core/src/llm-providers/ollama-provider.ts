/**
 * Ollama LLM Provider
 *
 * Connects to local Ollama instance for completions and embeddings.
 * This is a thin execution layer - Model-Master decides which model to use.
 *
 * @module llm-providers/ollama-provider
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

const DEFAULT_URL = 'http://localhost:11434';
const DEFAULT_TIMEOUT = 60000;

/**
 * Ollama provider configuration
 */
export interface OllamaProviderConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

/**
 * Ollama LLM provider
 */
export class OllamaProvider implements LlmProvider {
  readonly name = 'ollama' as const;

  private baseUrl: string;
  private timeoutMs: number;
  private lastStatus: ProviderStatus | null = null;

  constructor(config: OllamaProviderConfig = {}) {
    this.baseUrl = config.baseUrl || DEFAULT_URL;
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT;
  }

  async chat(request: LlmRequest): Promise<LlmResponse> {
    const startTime = Date.now();
    const timeout = request.timeoutMs || this.timeoutMs;

    try {
      // Convert messages to Ollama format
      const systemMessage = request.messages.find(m => m.role === 'system');
      const userMessages = request.messages.filter(m => m.role !== 'system');

      // Build the prompt from messages
      let prompt = '';
      for (const msg of userMessages) {
        if (msg.role === 'user') {
          prompt += `User: ${msg.content}\n`;
        } else if (msg.role === 'assistant') {
          prompt += `Assistant: ${msg.content}\n`;
        }
      }
      prompt += 'Assistant:';

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.modelId,
          prompt,
          system: systemMessage?.content,
          stream: false,
          options: {
            temperature: request.temperature ?? 0.7,
            num_predict: request.maxTokens ?? 2048,
            stop: request.stop,
          },
          format: request.jsonMode ? 'json' : undefined,
        }),
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new ProviderError(this.name, request.modelId, `HTTP ${response.status}: ${error}`);
      }

      const data = (await response.json()) as {
        response: string;
        prompt_eval_count?: number;
        eval_count?: number;
        done: boolean;
      };

      const latencyMs = Date.now() - startTime;

      return {
        content: data.response,
        modelId: request.modelId,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        latencyMs,
        finishReason: data.done ? 'stop' : 'length',
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const cause = error instanceof Error ? error : new Error(String(error));
      throw new ProviderError(this.name, request.modelId, cause.message, cause);
    }
  }

  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const data = (await response.json()) as { embeddings: number[][] };
      const embedding = data.embeddings[0];

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
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<ProviderStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        this.lastStatus = {
          available: false,
          lastCheck: new Date(),
          error: `HTTP ${response.status}`,
        };
        return this.lastStatus;
      }

      const data = (await response.json()) as { models: Array<{ name: string }> };
      this.lastStatus = {
        available: true,
        lastCheck: new Date(),
        availableModels: data.models.map(m => m.name),
      };
      return this.lastStatus;
    } catch (error) {
      this.lastStatus = {
        available: false,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
      return this.lastStatus;
    }
  }

  async listModels(): Promise<string[]> {
    const status = await this.getStatus();
    return status.availableModels || [];
  }
}
