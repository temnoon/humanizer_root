/**
 * npe-api HTTP client for tool execution
 */

import type { ToolResult, ToolDefinition } from '../types';

/**
 * API configuration
 */
export interface ApiConfig {
  baseUrl: string;
  authToken?: string;
  timeout?: number;
}

/**
 * Default API URLs by target
 */
export const API_URLS = {
  // npe-api (main backend)
  production: 'https://npe-api.tem-527.workers.dev',
  local: 'http://localhost:8787',
  // Local archive server (narrative-studio)
  archiveServer: 'http://localhost:3002',
  // Ollama (local AI)
  ollama: 'http://localhost:11434',
};

/**
 * Execution options
 */
export interface ExecuteOptions {
  timeout?: number;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

/**
 * Client state
 */
let currentConfig: ApiConfig = {
  baseUrl: API_URLS.production,
  timeout: 30000,
};

/**
 * Local server URL (for narrative-studio archive-server)
 */
let localServerUrl: string = API_URLS.archiveServer;

/**
 * Ollama server URL
 */
let ollamaServerUrl: string = API_URLS.ollama;

/**
 * Extended configuration options
 */
export interface ExtendedApiConfig extends Partial<ApiConfig> {
  localServerUrl?: string;
  ollamaServerUrl?: string;
}

/**
 * Configure the API client
 */
export function configureApiClient(config: ExtendedApiConfig): void {
  const { localServerUrl: localUrl, ollamaServerUrl: ollamaUrl, ...apiConfig } = config;
  currentConfig = { ...currentConfig, ...apiConfig };
  if (localUrl) localServerUrl = localUrl;
  if (ollamaUrl) ollamaServerUrl = ollamaUrl;
}

/**
 * Set the auth token
 */
export function setAuthToken(token: string): void {
  currentConfig.authToken = token;
}

/**
 * Clear the auth token
 */
export function clearAuthToken(): void {
  currentConfig.authToken = undefined;
}

/**
 * Get current config (for testing)
 */
export function getApiConfig(): ApiConfig {
  return { ...currentConfig };
}

/**
 * Execute a tool via the API
 */
export async function executeTool(
  tool: ToolDefinition,
  input: string,
  parameters: Record<string, unknown>,
  options?: ExecuteOptions
): Promise<ToolResult> {
  const startedAt = Date.now();

  // Validate input if validator exists
  if (tool.validateInput) {
    const validation = tool.validateInput(input);
    if (!validation.valid) {
      return {
        success: false,
        toolId: tool.id,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error ?? 'Invalid input',
        },
      };
    }
  }

  // Determine base URL based on apiTarget
  let baseUrl: string;
  switch (tool.apiTarget) {
    case 'local':
      baseUrl = localServerUrl;
      break;
    case 'ollama':
      baseUrl = ollamaServerUrl;
      break;
    case 'npe':
    case 'post-social':
    default:
      baseUrl = currentConfig.baseUrl;
      break;
  }

  // Build request
  const url = `${baseUrl}${tool.endpoint}`;
  const body = {
    text: input,
    ...parameters,
  };

  // Set up abort controller for timeout
  const controller = new AbortController();
  const timeout = options?.timeout ?? currentConfig.timeout ?? 30000;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Use provided signal if available
  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(currentConfig.authToken
          ? { Authorization: `Bearer ${currentConfig.authToken}` }
          : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        (errorData as { error?: string }).error ??
        `API error: ${response.status}`;

      return {
        success: false,
        toolId: tool.id,
        startedAt,
        completedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        error: {
          code: `HTTP_${response.status}`,
          message: errorMessage,
          details: errorData,
        },
      };
    }

    const rawResult = await response.json();

    // Format result using tool's formatter if available
    if (tool.formatResult) {
      const formatted = tool.formatResult(rawResult);
      return {
        ...formatted,
        startedAt,
        completedAt: Date.now(),
        durationMs: Date.now() - startedAt,
      };
    }

    // Default formatting
    return {
      success: true,
      toolId: tool.id,
      startedAt,
      completedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      transformedText: (rawResult as { transformedText?: string }).transformedText,
      analysis: (rawResult as { analysis?: unknown }).analysis as ToolResult['analysis'],
    };
  } catch (err) {
    clearTimeout(timeoutId);

    const error = err as Error;
    const isAbort = error.name === 'AbortError';

    return {
      success: false,
      toolId: tool.id,
      startedAt,
      completedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      error: {
        code: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: isAbort ? 'Request timed out' : error.message,
      },
    };
  }
}

/**
 * Option source type
 */
export type OptionType = 'personas' | 'styles' | 'languages' | 'nodes' | 'anchors';

/**
 * Fetch dynamic options from API (personas, styles, etc.)
 */
export async function fetchOptions(
  optionType: OptionType,
  filter?: Record<string, unknown>
): Promise<Array<{ value: string; label: string; description?: string }>> {
  // Determine which server to fetch from
  const localOptions = ['anchors'];
  const useLocalServer = localOptions.includes(optionType);
  const baseUrl = useLocalServer ? localServerUrl : currentConfig.baseUrl;

  const endpoints: Record<string, string> = {
    personas: '/assets/personas',
    styles: '/assets/styles',
    languages: '/transformations/languages',
    nodes: '/nodes/list',
    anchors: '/api/anchors',
  };

  const endpoint = endpoints[optionType];
  if (!endpoint) {
    console.warn(`Unknown option type: ${optionType}`);
    return [];
  }

  try {
    const url = new URL(`${baseUrl}${endpoint}`);
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        ...(currentConfig.authToken
          ? { Authorization: `Bearer ${currentConfig.authToken}` }
          : {}),
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${optionType}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    // Handle various response formats
    let items: unknown[];
    if (Array.isArray(data)) {
      items = data;
    } else if ((data as { items?: unknown[] }).items) {
      items = (data as { items: unknown[] }).items;
    } else if ((data as { anchors?: unknown[] }).anchors) {
      items = (data as { anchors: unknown[] }).anchors;
    } else {
      items = [];
    }

    return items.map((item: unknown) => {
      const i = item as { id?: string; name?: string; description?: string };
      return {
        value: i.id ?? '',
        label: i.name ?? i.id ?? '',
        description: i.description,
      };
    });
  } catch (err) {
    console.error(`Failed to fetch ${optionType}:`, err);
    return [];
  }
}
