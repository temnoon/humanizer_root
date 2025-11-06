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
}

/**
 * Determine which provider to use based on model ID
 */
export function getProviderType(modelId: string): 'cloudflare' | 'openai' | 'anthropic' | 'google' {
  if (modelId.startsWith('@cf/')) {
    return 'cloudflare';
  }
  if (modelId.startsWith('gpt-')) {
    return 'openai';
  }
  if (modelId.startsWith('claude-')) {
    return 'anthropic';
  }
  if (modelId.startsWith('gemini-')) {
    return 'google';
  }

  // Default to Cloudflare if unknown
  return 'cloudflare';
}
