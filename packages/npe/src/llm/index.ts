/**
 * LLM Module
 *
 * Provides abstraction layer for LLM backends.
 */

export type {
  LlmAdapter,
  LlmCompletionOptions,
  LlmCompletionResponse,
  EmbeddingResponse,
  ChatMessage,
  ChatAdapter,
  StreamingAdapter,
} from './types.js';

export {
  extractJson,
  safeJsonParse,
  cleanResponse,
  normalize,
} from './normalizer.js';

export {
  MockLlmAdapter,
  createTestAdapter,
} from './mock-adapter.js';
export type { MockResponse } from './mock-adapter.js';

export {
  OllamaAdapter,
  createOllamaAdapter,
} from './ollama-adapter.js';
export type { OllamaConfig } from './ollama-adapter.js';
