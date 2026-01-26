/**
 * Usage Recording Wrapper
 *
 * Wraps LLM providers to automatically record usage after each call.
 * Provides transparent usage tracking without modifying provider implementations.
 *
 * @module llm-providers/usage-wrapper
 */

import type { ModelProvider } from '../models/model-registry.js';
import type {
  LlmProvider,
  LlmRequest,
  LlmResponse,
  EmbedRequest,
  EmbedResponse,
  ProviderStatus,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Usage recorder interface (adapter for UsageService)
 */
export interface UsageRecorder {
  recordCall(entry: {
    userId: string;
    tenantId?: string;
    operationType: string;
    modelId: string;
    modelProvider: string;
    tokensInput: number;
    tokensOutput: number;
    latencyMs?: number;
    status?: 'completed' | 'failed' | 'timeout' | 'rate_limited';
    error?: string;
    sessionId?: string;
    requestId?: string;
  }): Promise<void>;
}

/**
 * Request metadata for usage attribution
 */
export interface UsageMetadata {
  userId: string;
  tenantId?: string;
  sessionId?: string;
  requestId?: string;
  operationType?: string;
}

/**
 * Extended LLM request with metadata
 */
export interface LlmRequestWithMeta extends LlmRequest {
  metadata?: UsageMetadata;
}

/**
 * Options for the usage wrapper
 */
export interface UsageWrapperOptions {
  /** Skip recording for certain models (e.g., local Ollama) */
  skipModels?: string[];
  /** Skip recording for certain providers */
  skipProviders?: ModelProvider[];
  /** Default operation type */
  defaultOperationType?: string;
  /** Whether to fail silently on recording errors */
  failSilent?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// WRAPPER IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wrap an LLM provider with usage recording.
 *
 * The wrapped provider will automatically record usage after each successful
 * or failed call. Usage is recorded asynchronously to not block the response.
 *
 * @example
 * ```ts
 * const usageService = getUsageService();
 * const ollamaProvider = new OllamaProvider();
 * const wrappedOllama = wrapWithUsageRecording(ollamaProvider, usageService);
 *
 * // Usage is recorded automatically
 * const response = await wrappedOllama.chat({
 *   modelId: 'llama3.2:3b',
 *   messages: [...],
 *   metadata: { userId: 'user123', operationType: 'transform' }
 * });
 * ```
 */
export function wrapWithUsageRecording(
  provider: LlmProvider,
  recorder: UsageRecorder,
  options?: UsageWrapperOptions
): LlmProvider {
  const skipModels = new Set(options?.skipModels ?? []);
  const skipProviders = new Set(options?.skipProviders ?? []);
  const defaultOpType = options?.defaultOperationType ?? 'completion';
  const failSilent = options?.failSilent ?? true;

  // Check if this provider should be skipped
  if (skipProviders.has(provider.name)) {
    return provider;
  }

  return {
    get name(): ModelProvider {
      return provider.name;
    },

    async chat(request: LlmRequestWithMeta): Promise<LlmResponse> {
      const startTime = Date.now();
      let response: LlmResponse;
      let error: Error | undefined;

      try {
        response = await provider.chat(request);
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
        throw e;
      } finally {
        // Record usage (async, don't await)
        const metadata = request.metadata;
        if (metadata?.userId && !skipModels.has(request.modelId)) {
          const latencyMs = Date.now() - startTime;

          recordUsageAsync(recorder, {
            userId: metadata.userId,
            tenantId: metadata.tenantId,
            operationType: metadata.operationType ?? defaultOpType,
            modelId: request.modelId,
            modelProvider: provider.name,
            tokensInput: response!?.usage?.promptTokens ?? 0,
            tokensOutput: response!?.usage?.completionTokens ?? 0,
            latencyMs,
            status: error ? 'failed' : 'completed',
            error: error?.message,
            sessionId: metadata.sessionId,
            requestId: metadata.requestId,
          }, failSilent);
        }
      }

      return response!;
    },

    async embed(request: EmbedRequest & { metadata?: UsageMetadata }): Promise<EmbedResponse> {
      const startTime = Date.now();
      let response: EmbedResponse;
      let error: Error | undefined;

      try {
        response = await provider.embed(request);
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
        throw e;
      } finally {
        // Record usage (async, don't await)
        const metadata = (request as { metadata?: UsageMetadata }).metadata;
        if (metadata?.userId && !skipModels.has(request.modelId)) {
          const latencyMs = Date.now() - startTime;

          // Estimate tokens for embeddings (rough: 4 chars per token)
          const estimatedTokens = Math.ceil(request.text.length / 4);

          recordUsageAsync(recorder, {
            userId: metadata.userId,
            tenantId: metadata.tenantId,
            operationType: 'embedding',
            modelId: request.modelId,
            modelProvider: provider.name,
            tokensInput: estimatedTokens,
            tokensOutput: 0,
            latencyMs,
            status: error ? 'failed' : 'completed',
            error: error?.message,
            sessionId: metadata.sessionId,
            requestId: metadata.requestId,
          }, failSilent);
        }
      }

      return response!;
    },

    async isAvailable(): Promise<boolean> {
      return provider.isAvailable();
    },

    async getStatus(): Promise<ProviderStatus> {
      return provider.getStatus();
    },

    listModels: provider.listModels
      ? async () => provider.listModels!()
      : undefined,
  };
}

/**
 * Record usage asynchronously without blocking.
 */
function recordUsageAsync(
  recorder: UsageRecorder,
  entry: Parameters<UsageRecorder['recordCall']>[0],
  failSilent: boolean
): void {
  recorder.recordCall(entry).catch(err => {
    if (!failSilent) {
      throw err;
    }
    console.warn('Failed to record usage:', err);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER MANAGER INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wrap all providers in a provider manager with usage recording.
 * Returns a new manager with wrapped providers.
 *
 * @example
 * ```ts
 * const manager = getProviderManager();
 * const usageService = getUsageService();
 * const wrappedManager = wrapProviderManagerWithUsage(manager, usageService);
 * ```
 */
export function wrapProviderManagerWithUsage(
  manager: {
    getRegistered(): ModelProvider[];
    get(name: ModelProvider): LlmProvider;
    register(provider: LlmProvider): void;
  },
  recorder: UsageRecorder,
  options?: UsageWrapperOptions
): void {
  // Wrap each registered provider
  for (const providerName of manager.getRegistered()) {
    const original = manager.get(providerName);
    const wrapped = wrapWithUsageRecording(original, recorder, options);
    manager.register(wrapped);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE HELPER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a request enhancer that adds metadata to LLM requests.
 * Use this in route handlers to inject user context.
 *
 * @example
 * ```ts
 * const enhancer = createRequestEnhancer();
 *
 * // In route handler:
 * const request = enhancer(baseRequest, {
 *   userId: auth.userId,
 *   tenantId: auth.tenantId,
 *   sessionId,
 *   operationType: 'transform'
 * });
 * ```
 */
export function createRequestEnhancer(): (
  request: LlmRequest,
  metadata: UsageMetadata
) => LlmRequestWithMeta {
  return (request, metadata) => ({
    ...request,
    metadata,
  });
}
