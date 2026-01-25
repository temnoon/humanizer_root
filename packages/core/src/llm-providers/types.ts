/**
 * LLM Provider Types
 *
 * Defines the interface for LLM providers that Model-Master uses to execute requests.
 * Providers are thin execution layers - Model-Master decides WHICH model via ModelRegistry,
 * providers just execute the call.
 *
 * @module llm-providers/types
 */

import type { ModelProvider } from '../models/model-registry.js';

/**
 * Chat message format
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Request to an LLM provider
 */
export interface LlmRequest {
  /** Model ID to use (from ModelRegistry) */
  modelId: string;

  /** Messages for chat completion */
  messages: ChatMessage[];

  /** Sampling temperature (0-2) */
  temperature?: number;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Stop sequences */
  stop?: string[];

  /** Request JSON mode / structured output */
  jsonMode?: boolean;

  /** Stream the response */
  stream?: boolean;

  /** Request timeout in ms */
  timeoutMs?: number;
}

/**
 * Response from an LLM provider
 */
export interface LlmResponse {
  /** Generated content */
  content: string;

  /** Model that was used */
  modelId: string;

  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  /** Response latency in ms */
  latencyMs: number;

  /** Structured output if JSON mode was requested */
  structured?: unknown;

  /** Finish reason */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error';
}

/**
 * Embedding request
 */
export interface EmbedRequest {
  /** Model ID to use (from ModelRegistry) */
  modelId: string;

  /** Text to embed */
  text: string;
}

/**
 * Embedding response
 */
export interface EmbedResponse {
  /** Embedding vector */
  embedding: number[];

  /** Model that was used */
  modelId: string;

  /** Dimensions of the embedding */
  dimensions: number;
}

/**
 * Provider health status
 */
export interface ProviderStatus {
  /** Is the provider available? */
  available: boolean;

  /** Last health check time */
  lastCheck: Date;

  /** Error message if unavailable */
  error?: string;

  /** Available models (if known) */
  availableModels?: string[];
}

/**
 * LLM Provider interface
 *
 * Providers execute LLM calls. They don't decide which model to use -
 * that's Model-Master's job via ModelRegistry.
 */
export interface LlmProvider {
  /** Provider identifier (matches ModelProvider type) */
  readonly name: ModelProvider;

  /**
   * Execute a chat completion
   */
  chat(request: LlmRequest): Promise<LlmResponse>;

  /**
   * Generate embeddings
   */
  embed(request: EmbedRequest): Promise<EmbedResponse>;

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get detailed provider status
   */
  getStatus(): Promise<ProviderStatus>;

  /**
   * List available models on this provider
   */
  listModels?(): Promise<string[]>;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** Ollama URL */
  ollamaUrl?: string;

  /** OpenAI API key */
  openaiApiKey?: string;

  /** Anthropic API key */
  anthropicApiKey?: string;

  /** Default timeout in ms */
  defaultTimeoutMs?: number;
}

/**
 * Error thrown when a provider call fails
 */
export class ProviderError extends Error {
  constructor(
    public readonly provider: ModelProvider,
    public readonly modelId: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(`[${provider}/${modelId}] ${message}`);
    this.name = 'ProviderError';
  }
}

/**
 * Error thrown when provider is unavailable
 */
export class ProviderUnavailableError extends ProviderError {
  constructor(provider: ModelProvider) {
    super(provider, '', `Provider ${provider} is unavailable`);
    this.name = 'ProviderUnavailableError';
  }
}
