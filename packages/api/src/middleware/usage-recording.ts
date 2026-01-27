/**
 * Usage Recording Wrapper
 *
 * Wraps embedding functions and LLM adapters to automatically record usage
 * via the UsageService. Uses AsyncLocalStorage context for user attribution.
 *
 * The wrappers get UsageService lazily at call time, allowing the embedFn
 * to be created during bootstrap before UsageService is initialized.
 *
 * @module @humanizer/api/middleware/usage-recording
 */

import { getUsageService, type UsageService } from '@humanizer/core';
import { getUsageContext } from './usage-context.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type EmbedFunction = (text: string) => Promise<number[]>;

export interface LlmAdapter {
  complete(
    systemPrompt: string,
    userInput: string,
    options?: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      stop?: string[];
      system?: string;
    }
  ): Promise<string>;
  embed(text: string): Promise<{ embedding: number[] }>;
  isAvailable(): Promise<boolean>;
}

export interface UsageRecordingOptions {
  /** Model ID for the embedding model */
  embedModelId?: string;
  /** Model ID for the completion model */
  completionModelId?: string;
  /** Provider name (e.g., 'ollama', 'openai') */
  provider?: string;
  /** Whether to fail silently on recording errors (default: true) */
  failSilent?: boolean;
  /** Skip recording for anonymous users (default: false) */
  skipAnonymous?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// EMBEDDING WRAPPER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wrap an embedding function with usage recording.
 *
 * The wrapper:
 * 1. Gets UsageService lazily at call time (allows bootstrap ordering)
 * 2. Checks for user context from AsyncLocalStorage
 * 3. Records the embedding call to UsageService after completion
 * 4. Gracefully handles recording failures (logs warning, doesn't block)
 *
 * @example
 * ```ts
 * const rawEmbedFn = async (text) => ollamaAdapter.embed(text).then(r => r.embedding);
 *
 * const trackedEmbedFn = wrapEmbedFnWithUsageRecording(
 *   rawEmbedFn,
 *   { embedModelId: 'nomic-embed-text:latest', provider: 'ollama' }
 * );
 * ```
 */
export function wrapEmbedFnWithUsageRecording(
  embedFn: EmbedFunction,
  options: UsageRecordingOptions = {}
): EmbedFunction {
  const {
    embedModelId = 'nomic-embed-text:latest',
    provider = 'ollama',
    failSilent = true,
    skipAnonymous = false,
  } = options;

  return async (text: string): Promise<number[]> => {
    const startTime = Date.now();
    let embedding: number[];
    let error: Error | undefined;

    try {
      embedding = await embedFn(text);
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
      throw e;
    } finally {
      // Get usage service lazily (may not be initialized at wrapper creation time)
      const usageService = getUsageService();

      // Record usage asynchronously
      if (usageService) {
        const ctx = getUsageContext();
        const shouldRecord = ctx && (ctx.userId !== 'anonymous' || !skipAnonymous);

        if (shouldRecord) {
          const latencyMs = Date.now() - startTime;
          // Estimate tokens: ~4 chars per token for English text
          const estimatedTokens = Math.ceil(text.length / 4);

          recordUsageAsync(
            usageService,
            {
              userId: ctx.userId,
              tenantId: ctx.tenantId,
              operationType: ctx.operationType ?? 'embedding',
              modelId: embedModelId,
              modelProvider: provider,
              tokensInput: estimatedTokens,
              tokensOutput: 0, // Embeddings have no output tokens
              latencyMs,
              status: error ? 'failed' : 'completed',
              error: error?.message,
              sessionId: ctx.sessionId,
              requestId: ctx.requestId,
            },
            failSilent
          );
        }
      }
    }

    return embedding!;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LLM ADAPTER WRAPPER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wrap an LLM adapter with usage recording.
 *
 * Tracks both completions and embeddings from the adapter.
 * Gets UsageService lazily at call time.
 */
export function wrapLlmAdapterWithUsageRecording<T extends LlmAdapter>(
  adapter: T,
  options: UsageRecordingOptions = {}
): T {
  const {
    embedModelId = 'nomic-embed-text:latest',
    completionModelId = 'llama3.2:3b',
    provider = 'ollama',
    failSilent = true,
    skipAnonymous = false,
  } = options;

  return {
    ...adapter,

    async complete(
      systemPrompt: string,
      userInput: string,
      completionOptions?: {
        model?: string;
        temperature?: number;
        max_tokens?: number;
        stop?: string[];
        system?: string;
      }
    ): Promise<string> {
      const startTime = Date.now();
      let response: string | undefined;
      let error: Error | undefined;

      try {
        response = await adapter.complete(systemPrompt, userInput, completionOptions);
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
        throw e;
      } finally {
        // Get usage service lazily
        const usageService = getUsageService();

        // Record usage asynchronously
        if (usageService) {
          const ctx = getUsageContext();
          const shouldRecord = ctx && (ctx.userId !== 'anonymous' || !skipAnonymous);

          if (shouldRecord) {
            const latencyMs = Date.now() - startTime;
            // Estimate tokens (rough: ~4 chars per token)
            const inputTokens = Math.ceil((systemPrompt.length + userInput.length) / 4);
            const outputTokens = response ? Math.ceil(response.length / 4) : 0;

            recordUsageAsync(
              usageService,
              {
                userId: ctx.userId,
                tenantId: ctx.tenantId,
                operationType: ctx.operationType ?? 'completion',
                modelId: completionOptions?.model ?? completionModelId,
                modelProvider: provider,
                tokensInput: inputTokens,
                tokensOutput: outputTokens,
                latencyMs,
                status: error ? 'failed' : 'completed',
                error: error?.message,
                sessionId: ctx.sessionId,
                requestId: ctx.requestId,
              },
              failSilent
            );
          }
        }
      }

      return response!;
    },

    async embed(text: string): Promise<{ embedding: number[] }> {
      const startTime = Date.now();
      let result: { embedding: number[] } | undefined;
      let error: Error | undefined;

      try {
        result = await adapter.embed(text);
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
        throw e;
      } finally {
        // Get usage service lazily
        const usageService = getUsageService();

        // Record usage asynchronously
        if (usageService) {
          const ctx = getUsageContext();
          const shouldRecord = ctx && (ctx.userId !== 'anonymous' || !skipAnonymous);

          if (shouldRecord) {
            const latencyMs = Date.now() - startTime;
            const estimatedTokens = Math.ceil(text.length / 4);

            recordUsageAsync(
              usageService,
              {
                userId: ctx.userId,
                tenantId: ctx.tenantId,
                operationType: ctx.operationType ?? 'embedding',
                modelId: embedModelId,
                modelProvider: provider,
                tokensInput: estimatedTokens,
                tokensOutput: 0,
                latencyMs,
                status: error ? 'failed' : 'completed',
                error: error?.message,
                sessionId: ctx.sessionId,
                requestId: ctx.requestId,
              },
              failSilent
            );
          }
        }
      }

      return result!;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

interface UsageEntry {
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
}

/**
 * Record usage asynchronously without blocking.
 */
function recordUsageAsync(
  usageService: UsageService,
  entry: UsageEntry,
  failSilent: boolean
): void {
  usageService
    .recordCall({
      userId: entry.userId,
      tenantId: entry.tenantId ?? 'humanizer',
      operationType: entry.operationType,
      modelId: entry.modelId,
      modelProvider: entry.modelProvider,
      tokensInput: entry.tokensInput,
      tokensOutput: entry.tokensOutput,
      latencyMs: entry.latencyMs,
      status: entry.status ?? 'completed',
      error: entry.error,
      sessionId: entry.sessionId,
      requestId: entry.requestId,
    })
    .catch((err) => {
      if (!failSilent) {
        throw err;
      }
      console.warn('Failed to record usage:', err);
    });
}
