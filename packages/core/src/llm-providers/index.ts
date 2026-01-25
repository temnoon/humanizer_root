/**
 * LLM Providers - Barrel Export
 *
 * Thin execution layer for LLM calls. Providers execute requests;
 * Model-Master decides which model to use via ModelRegistry.
 *
 * @module llm-providers
 */

// Types
export type {
  LlmProvider,
  LlmRequest,
  LlmResponse,
  EmbedRequest,
  EmbedResponse,
  ProviderStatus,
  ProviderConfig,
  ChatMessage,
} from './types.js';

export {
  ProviderError,
  ProviderUnavailableError,
} from './types.js';

// Providers
export { OllamaProvider, type OllamaProviderConfig } from './ollama-provider.js';
export { OpenAIProvider, type OpenAIProviderConfig } from './openai-provider.js';
export { AnthropicProvider, type AnthropicProviderConfig } from './anthropic-provider.js';

// Manager
export {
  ProviderManager,
  getProviderManager,
  initializeProviders,
  resetProviderManager,
} from './provider-manager.js';
