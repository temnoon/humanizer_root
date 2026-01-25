/**
 * Provider Manager
 *
 * Singleton manager for LLM providers. Handles initialization,
 * availability checking, and provider selection.
 *
 * @module llm-providers/provider-manager
 */

import type { ModelProvider } from '../models/model-registry.js';
import type { LlmProvider, ProviderConfig, ProviderStatus } from './types.js';
import { ProviderUnavailableError } from './types.js';
import { OllamaProvider } from './ollama-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';

/**
 * Provider manager handles provider lifecycle and selection
 */
export class ProviderManager {
  private providers: Map<ModelProvider, LlmProvider> = new Map();
  private initialized = false;

  /**
   * Initialize providers with configuration
   */
  async initialize(config: ProviderConfig = {}): Promise<void> {
    if (this.initialized) return;

    // Always register Ollama (local, free)
    this.providers.set('ollama', new OllamaProvider({
      baseUrl: config.ollamaUrl,
      timeoutMs: config.defaultTimeoutMs,
    }));

    // Register OpenAI if key available
    if (config.openaiApiKey || process.env.OPENAI_API_KEY) {
      this.providers.set('openai', new OpenAIProvider({
        apiKey: config.openaiApiKey,
        timeoutMs: config.defaultTimeoutMs,
      }));
    }

    // Register Anthropic if key available
    if (config.anthropicApiKey || process.env.ANTHROPIC_API_KEY) {
      this.providers.set('anthropic', new AnthropicProvider({
        apiKey: config.anthropicApiKey,
        timeoutMs: config.defaultTimeoutMs,
      }));
    }

    // TODO: Add Voyage, Cohere, Google providers when needed

    this.initialized = true;
  }

  /**
   * Get a provider by name
   */
  get(providerName: ModelProvider): LlmProvider {
    this.ensureInitialized();

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new ProviderUnavailableError(providerName);
    }
    return provider;
  }

  /**
   * Check if a provider is registered
   */
  has(providerName: ModelProvider): boolean {
    this.ensureInitialized();
    return this.providers.has(providerName);
  }

  /**
   * Check if a provider is available (registered and healthy)
   */
  async isAvailable(providerName: ModelProvider): Promise<boolean> {
    this.ensureInitialized();

    const provider = this.providers.get(providerName);
    if (!provider) return false;

    return provider.isAvailable();
  }

  /**
   * Get status of all providers
   */
  async getAllStatus(): Promise<Map<ModelProvider, ProviderStatus>> {
    this.ensureInitialized();

    const statuses = new Map<ModelProvider, ProviderStatus>();
    for (const [name, provider] of this.providers) {
      statuses.set(name, await provider.getStatus());
    }
    return statuses;
  }

  /**
   * Get list of available providers
   */
  async getAvailable(): Promise<ModelProvider[]> {
    this.ensureInitialized();

    const available: ModelProvider[] = [];
    for (const [name, provider] of this.providers) {
      if (await provider.isAvailable()) {
        available.push(name);
      }
    }
    return available;
  }

  /**
   * Get list of registered provider names
   */
  getRegistered(): ModelProvider[] {
    this.ensureInitialized();
    return Array.from(this.providers.keys());
  }

  /**
   * Register a custom provider
   */
  register(provider: LlmProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Reset the manager (for testing)
   */
  reset(): void {
    this.providers.clear();
    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      // Auto-initialize with defaults
      this.providers.set('ollama', new OllamaProvider());

      if (process.env.OPENAI_API_KEY) {
        this.providers.set('openai', new OpenAIProvider());
      }

      if (process.env.ANTHROPIC_API_KEY) {
        this.providers.set('anthropic', new AnthropicProvider());
      }

      this.initialized = true;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _manager: ProviderManager | null = null;

/**
 * Get the provider manager singleton
 */
export function getProviderManager(): ProviderManager {
  if (!_manager) {
    _manager = new ProviderManager();
  }
  return _manager;
}

/**
 * Initialize providers with configuration
 * Call this at application startup before using model-master
 */
export async function initializeProviders(config: ProviderConfig = {}): Promise<void> {
  const manager = getProviderManager();
  await manager.initialize(config);
}

/**
 * Reset the provider manager (for testing)
 */
export function resetProviderManager(): void {
  if (_manager) {
    _manager.reset();
  }
  _manager = null;
}
