/**
 * Base types and interfaces for LLM providers
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  max_tokens: number;
  temperature: number;
  model?: string; // For providers with multiple model variants
}

export interface LLMResponse {
  response: string;
  tokens_used?: number;
  model?: string;
}

/**
 * Base interface that all LLM providers must implement
 */
export interface LLMProvider {
  /**
   * Call the LLM with a request
   */
  call(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Get the provider name
   */
  getProviderName(): string;

  /**
   * Check if this provider is available (e.g., API key configured)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Simple text generation (convenience method)
   */
  generateText(prompt: string, options: { max_tokens: number; temperature: number }): Promise<string>;
}

export type ProviderType = 'cloudflare' | 'openai' | 'anthropic' | 'google' | 'groq' | 'ollama';

/**
 * Determine which provider to use based on model ID
 */
export function getProviderType(modelId: string): ProviderType {
  if (modelId.startsWith('@cf/')) {
    return 'cloudflare';
  }
  if (modelId.startsWith('gpt-') || modelId.startsWith('o1-') || modelId.startsWith('o3-')) {
    return 'openai';
  }
  if (modelId.startsWith('claude-')) {
    return 'anthropic';
  }
  if (modelId.startsWith('gemini-')) {
    return 'google';
  }
  // Groq models: llama-3.1-70b-versatile, mixtral-8x7b-32768, etc.
  if (modelId.startsWith('llama-') || modelId.startsWith('mixtral-') || modelId.startsWith('groq/')) {
    return 'groq';
  }
  if (modelId.startsWith('ollama/') || modelId.startsWith('local/')) {
    return 'ollama';
  }

  // Default to Cloudflare if unknown
  return 'cloudflare';
}
