/**
 * LLM Adapter Types
 *
 * Abstracts different LLM backends (Ollama, Workers AI, OpenAI, etc.)
 * Allows npe services to work with any compliant provider.
 */

/**
 * LLM completion options
 */
export interface LlmCompletionOptions {
  /** Model identifier */
  model?: string;
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Stop sequences */
  stop?: string[];
  /** System prompt override */
  system?: string;
}

/**
 * LLM completion response
 */
export interface LlmCompletionResponse {
  /** Generated text */
  content: string;
  /** Model used */
  model: string;
  /** Tokens used (if available) */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /** Response latency in ms */
  latency_ms?: number;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  /** Embedding vector */
  embedding: number[];
  /** Model used */
  model: string;
  /** Dimensions */
  dimensions: number;
}

/**
 * LLM adapter interface - implement for each backend
 */
export interface LlmAdapter {
  /** Unique identifier for this adapter */
  readonly name: string;

  /** Default model for this adapter */
  readonly defaultModel: string;

  /**
   * Complete a prompt with optional system message
   */
  complete(
    systemPrompt: string,
    userInput: string,
    options?: LlmCompletionOptions
  ): Promise<string>;

  /**
   * Generate an embedding for text
   * Returns undefined if adapter doesn't support embeddings
   */
  embed?(text: string): Promise<EmbeddingResponse>;

  /**
   * Normalize LLM response (extract JSON, clean markdown, etc.)
   */
  normalize?(response: string): string;

  /**
   * Check if adapter is available/healthy
   */
  isAvailable?(): Promise<boolean>;
}

/**
 * Chat message format
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Chat completion adapter (for multi-turn)
 */
export interface ChatAdapter extends LlmAdapter {
  /**
   * Complete a chat conversation
   */
  chat(
    messages: ChatMessage[],
    options?: LlmCompletionOptions
  ): Promise<LlmCompletionResponse>;
}

/**
 * Streaming adapter (for real-time responses)
 */
export interface StreamingAdapter extends LlmAdapter {
  /**
   * Stream completion tokens
   */
  stream(
    systemPrompt: string,
    userInput: string,
    options?: LlmCompletionOptions
  ): AsyncIterable<string>;
}
