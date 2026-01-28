/**
 * Provider API Key Validator
 *
 * Validates API keys for cloud providers with lightweight API calls.
 * Uses minimal quota to verify keys work without wasting resources.
 *
 * Supported Providers:
 * - OpenAI: GET /v1/models (free, lists available models)
 * - Anthropic: POST /v1/messages with minimal content
 * - Voyage: GET /v1/models (or POST /v1/embeddings with tiny input)
 * - Google: GET /v1beta/models (Gemini API)
 *
 * @module models/provider-validator
 */

import type { ModelProvider } from './model-registry.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of API key validation
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  provider: ModelProvider;
  error?: string;
  errorCode?: string;
  timestamp: Date;
  /** Available models (if validation also lists them) */
  availableModels?: string[];
  /** Account/organization info if available */
  accountInfo?: {
    organizationId?: string;
    organizationName?: string;
    tier?: string;
  };
}

/**
 * Options for validation
 */
export interface ApiKeyValidationOptions {
  /** Custom base URL for the provider */
  baseUrl?: string;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; timeout: number }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', timeout: 10000 },
  anthropic: { baseUrl: 'https://api.anthropic.com', timeout: 10000 },
  voyage: { baseUrl: 'https://api.voyageai.com/v1', timeout: 10000 },
  google: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', timeout: 10000 },
  cohere: { baseUrl: 'https://api.cohere.ai/v1', timeout: 10000 },
};

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate an OpenAI API key.
 *
 * Uses GET /v1/models which is free and returns list of available models.
 */
export async function validateOpenAIKey(
  apiKey: string,
  options?: ApiKeyValidationOptions
): Promise<ApiKeyValidationResult> {
  const baseUrl = options?.baseUrl ?? PROVIDER_DEFAULTS.openai.baseUrl;
  const timeout = options?.timeoutMs ?? PROVIDER_DEFAULTS.openai.timeout;
  const timestamp = new Date();

  try {
    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(timeout),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        data: Array<{ id: string; owned_by: string }>;
      };

      return {
        valid: true,
        provider: 'openai',
        timestamp,
        availableModels: data.data.map(m => m.id),
      };
    }

    // Parse error response
    const errorData = await response.json().catch(() => ({})) as {
      error?: { message?: string; code?: string; type?: string };
    };

    const errorMessage = errorData.error?.message ?? `HTTP ${response.status}`;
    const errorCode = errorData.error?.code ?? errorData.error?.type ?? response.status.toString();

    return {
      valid: false,
      provider: 'openai',
      error: errorMessage,
      errorCode,
      timestamp,
    };
  } catch (error) {
    return {
      valid: false,
      provider: 'openai',
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'connection_error',
      timestamp,
    };
  }
}

/**
 * Validate an Anthropic API key.
 *
 * Uses POST /v1/messages with minimal content.
 * Note: This does consume a small amount of quota (~10 tokens).
 */
export async function validateAnthropicKey(
  apiKey: string,
  options?: ApiKeyValidationOptions
): Promise<ApiKeyValidationResult> {
  const baseUrl = options?.baseUrl ?? PROVIDER_DEFAULTS.anthropic.baseUrl;
  const timeout = options?.timeoutMs ?? PROVIDER_DEFAULTS.anthropic.timeout;
  const timestamp = new Date();

  try {
    // Use a minimal message to validate the key
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (response.ok) {
      return {
        valid: true,
        provider: 'anthropic',
        timestamp,
      };
    }

    // Parse error response
    const errorData = await response.json().catch(() => ({})) as {
      error?: { message?: string; type?: string };
      type?: string;
      message?: string;
    };

    const errorMessage = errorData.error?.message ?? errorData.message ?? `HTTP ${response.status}`;
    const errorCode = errorData.error?.type ?? errorData.type ?? response.status.toString();

    // Special case: 401 = invalid key, 403 = valid but not authorized for model
    if (response.status === 403) {
      // Key is valid, just not authorized for this specific model
      return {
        valid: true,
        provider: 'anthropic',
        timestamp,
      };
    }

    return {
      valid: false,
      provider: 'anthropic',
      error: errorMessage,
      errorCode,
      timestamp,
    };
  } catch (error) {
    return {
      valid: false,
      provider: 'anthropic',
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'connection_error',
      timestamp,
    };
  }
}

/**
 * Validate a Voyage AI API key.
 *
 * Uses POST /v1/embeddings with minimal input.
 */
export async function validateVoyageKey(
  apiKey: string,
  options?: ApiKeyValidationOptions
): Promise<ApiKeyValidationResult> {
  const baseUrl = options?.baseUrl ?? PROVIDER_DEFAULTS.voyage.baseUrl;
  const timeout = options?.timeoutMs ?? PROVIDER_DEFAULTS.voyage.timeout;
  const timestamp = new Date();

  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'voyage-2',
        input: 'test',
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (response.ok) {
      return {
        valid: true,
        provider: 'voyage',
        timestamp,
      };
    }

    // Parse error response
    const errorData = await response.json().catch(() => ({})) as {
      error?: string;
      detail?: string;
    };

    const errorMessage = errorData.error ?? errorData.detail ?? `HTTP ${response.status}`;

    return {
      valid: false,
      provider: 'voyage',
      error: errorMessage,
      errorCode: response.status.toString(),
      timestamp,
    };
  } catch (error) {
    return {
      valid: false,
      provider: 'voyage',
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'connection_error',
      timestamp,
    };
  }
}

/**
 * Validate a Google (Gemini) API key.
 *
 * Uses GET /v1beta/models which is free.
 */
export async function validateGoogleKey(
  apiKey: string,
  options?: ApiKeyValidationOptions
): Promise<ApiKeyValidationResult> {
  const baseUrl = options?.baseUrl ?? PROVIDER_DEFAULTS.google.baseUrl;
  const timeout = options?.timeoutMs ?? PROVIDER_DEFAULTS.google.timeout;
  const timestamp = new Date();

  try {
    const response = await fetch(`${baseUrl}/models?key=${apiKey}`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeout),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        models: Array<{ name: string; displayName: string }>;
      };

      return {
        valid: true,
        provider: 'google',
        timestamp,
        availableModels: data.models.map(m => m.name.replace('models/', '')),
      };
    }

    // Parse error response
    const errorData = await response.json().catch(() => ({})) as {
      error?: { message?: string; status?: string };
    };

    const errorMessage = errorData.error?.message ?? `HTTP ${response.status}`;
    const errorCode = errorData.error?.status ?? response.status.toString();

    return {
      valid: false,
      provider: 'google',
      error: errorMessage,
      errorCode,
      timestamp,
    };
  } catch (error) {
    return {
      valid: false,
      provider: 'google',
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'connection_error',
      timestamp,
    };
  }
}

/**
 * Validate a Cohere API key.
 *
 * Uses GET /v1/models which is free.
 */
export async function validateCohereKey(
  apiKey: string,
  options?: ApiKeyValidationOptions
): Promise<ApiKeyValidationResult> {
  const baseUrl = options?.baseUrl ?? PROVIDER_DEFAULTS.cohere.baseUrl;
  const timeout = options?.timeoutMs ?? PROVIDER_DEFAULTS.cohere.timeout;
  const timestamp = new Date();

  try {
    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(timeout),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        models: Array<{ name: string }>;
      };

      return {
        valid: true,
        provider: 'cohere',
        timestamp,
        availableModels: data.models.map(m => m.name),
      };
    }

    // Parse error response
    const errorData = await response.json().catch(() => ({})) as {
      message?: string;
    };

    const errorMessage = errorData.message ?? `HTTP ${response.status}`;

    return {
      valid: false,
      provider: 'cohere',
      error: errorMessage,
      errorCode: response.status.toString(),
      timestamp,
    };
  } catch (error) {
    return {
      valid: false,
      provider: 'cohere',
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'connection_error',
      timestamp,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate an API key for any supported provider.
 */
export async function validateApiKey(
  provider: ModelProvider,
  apiKey: string,
  options?: ApiKeyValidationOptions
): Promise<ApiKeyValidationResult> {
  switch (provider) {
    case 'openai':
      return validateOpenAIKey(apiKey, options);
    case 'anthropic':
      return validateAnthropicKey(apiKey, options);
    case 'voyage':
      return validateVoyageKey(apiKey, options);
    case 'google':
      return validateGoogleKey(apiKey, options);
    case 'cohere':
      return validateCohereKey(apiKey, options);
    case 'ollama':
    case 'local':
      // Local providers don't need API key validation
      return {
        valid: true,
        provider,
        timestamp: new Date(),
      };
    default:
      return {
        valid: false,
        provider,
        error: `Unsupported provider: ${provider}`,
        errorCode: 'unsupported_provider',
        timestamp: new Date(),
      };
  }
}

/**
 * Validate multiple API keys in parallel.
 */
export async function validateMultipleKeys(
  keys: Array<{ provider: ModelProvider; apiKey: string; options?: ApiKeyValidationOptions }>
): Promise<ApiKeyValidationResult[]> {
  return Promise.all(
    keys.map(({ provider, apiKey, options }) => validateApiKey(provider, apiKey, options))
  );
}

/**
 * Check if a provider requires an API key.
 */
export function providerRequiresApiKey(provider: ModelProvider): boolean {
  switch (provider) {
    case 'ollama':
    case 'local':
      return false;
    default:
      return true;
  }
}

/**
 * Get the expected API key format for a provider.
 */
export function getApiKeyFormat(provider: ModelProvider): {
  prefix?: string;
  length?: number;
  pattern?: RegExp;
  description: string;
} {
  switch (provider) {
    case 'openai':
      return {
        prefix: 'sk-',
        description: 'OpenAI API key (starts with sk-)',
        pattern: /^sk-[a-zA-Z0-9]{32,}$/,
      };
    case 'anthropic':
      return {
        prefix: 'sk-ant-',
        description: 'Anthropic API key (starts with sk-ant-)',
        pattern: /^sk-ant-[a-zA-Z0-9-]{32,}$/,
      };
    case 'voyage':
      return {
        prefix: 'pa-',
        description: 'Voyage API key',
        pattern: /^pa-[a-zA-Z0-9-]{32,}$/,
      };
    case 'google':
      return {
        description: 'Google API key (39 characters)',
        length: 39,
        pattern: /^AIza[a-zA-Z0-9_-]{35}$/,
      };
    case 'cohere':
      return {
        description: 'Cohere API key',
        pattern: /^[a-zA-Z0-9]{40}$/,
      };
    default:
      return {
        description: 'API key for ' + provider,
      };
  }
}

/**
 * Validate API key format without making a network request.
 */
export function validateApiKeyFormat(
  provider: ModelProvider,
  apiKey: string
): { valid: boolean; error?: string } {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key is required' };
  }

  const format = getApiKeyFormat(provider);

  if (format.prefix && !apiKey.startsWith(format.prefix)) {
    return {
      valid: false,
      error: `API key should start with "${format.prefix}"`,
    };
  }

  if (format.length && apiKey.length !== format.length) {
    return {
      valid: false,
      error: `API key should be ${format.length} characters`,
    };
  }

  if (format.pattern && !format.pattern.test(apiKey)) {
    return {
      valid: false,
      error: `Invalid API key format for ${provider}`,
    };
  }

  return { valid: true };
}
