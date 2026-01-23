/**
 * Ollama LLM Adapter
 *
 * Connects to local Ollama instance for completions and embeddings.
 * Uses nomic-embed-text for embeddings (768 dimensions).
 */

import type { LlmAdapter, LlmCompletionOptions, EmbeddingResponse } from './types.js';
import { normalize } from './normalizer.js';

/**
 * Ollama configuration
 */
export interface OllamaConfig {
  /** Ollama API base URL */
  baseUrl?: string;
  /** Default model for completions */
  model?: string;
  /** Model for embeddings */
  embedModel?: string;
  /** Request timeout in ms */
  timeout?: number;
}

const DEFAULT_CONFIG: Required<OllamaConfig> = {
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2:3b',
  embedModel: 'nomic-embed-text:latest',
  timeout: 60000,
};

/**
 * Ollama LLM adapter
 */
export class OllamaAdapter implements LlmAdapter {
  readonly name = 'ollama';
  readonly defaultModel: string;

  private config: Required<OllamaConfig>;

  constructor(config: OllamaConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.defaultModel = this.config.model;
  }

  async complete(
    systemPrompt: string,
    userInput: string,
    options?: LlmCompletionOptions
  ): Promise<string> {
    const model = options?.model ?? this.config.model;

    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: userInput,
        system: options?.system ?? systemPrompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.max_tokens ?? 2048,
          stop: options?.stop,
        },
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as { response: string };
    return data.response;
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    const response = await fetch(`${this.config.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.embedModel,
        input: text,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama embed error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as { embeddings: number[][] };
    const embedding = data.embeddings[0];

    return {
      embedding,
      model: this.config.embedModel,
      dimensions: embedding.length,
    };
  }

  normalize(response: string): string {
    return normalize(response);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.config.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }

    const data = (await response.json()) as { models: Array<{ name: string }> };
    return data.models.map((m) => m.name);
  }
}

/**
 * Create an Ollama adapter with default config
 */
export function createOllamaAdapter(config?: OllamaConfig): OllamaAdapter {
  return new OllamaAdapter(config);
}
