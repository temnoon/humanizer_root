/**
 * Ollama Model Discovery Service
 *
 * Discovers models from local Ollama instance and registers them
 * in ModelConfigService with appropriate availability status.
 *
 * Features:
 * - Automatic model discovery from Ollama API
 * - Capability inference based on model name patterns
 * - Periodic refresh support
 * - Integration with ModelConfigService for persistence
 * - Health status tracking
 *
 * @module models/ollama-discovery
 */

import type { ModelCapability } from './model-registry.js';
import type { VettedModel } from './model-registry.js';
import type { ModelConfigService, ModelAvailabilityStatus } from '../aui/service/model-config-service.js';
import type { ProviderConfigService } from '../aui/service/provider-config-service.js';
import { DEFAULT_MODELS } from './default-model-registry.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ollama model info from API
 */
export interface OllamaModelInfo {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

/**
 * Discovery result for a single model
 */
export interface DiscoveredModel {
  id: string;
  name: string;
  capabilities: ModelCapability[];
  dimensions?: number;
  contextWindow?: number;
  parameterSize?: string;
  quantization?: string;
  family?: string;
  isKnown: boolean; // Whether it matches a DEFAULT_MODEL
}

/**
 * Result of discovery operation
 */
export interface OllamaDiscoveryResult {
  success: boolean;
  modelsFound: number;
  modelsRegistered: number;
  models: DiscoveredModel[];
  error?: string;
  timestamp: Date;
}

/**
 * Options for OllamaDiscoveryService
 */
export interface OllamaDiscoveryOptions {
  baseUrl?: string;
  timeoutMs?: number;
  defaultTenantId?: string;
  /** Auto-refresh interval in ms (0 = disabled) */
  refreshIntervalMs?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY INFERENCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Known embedding model patterns
 */
const EMBEDDING_MODEL_PATTERNS = [
  /^nomic-embed/i,
  /^mxbai-embed/i,
  /^all-minilm/i,
  /^snowflake-arctic-embed/i,
  /^bge-/i,
  /^gte-/i,
  /-embed/i,
  /embedding/i,
];

/**
 * Known code-capable model patterns
 */
const CODE_MODEL_PATTERNS = [
  /^codellama/i,
  /^deepseek-coder/i,
  /^starcoder/i,
  /^wizardcoder/i,
  /^phind-codellama/i,
  /^code/i,
  /-code/i,
];

/**
 * Known vision-capable model patterns
 */
const VISION_MODEL_PATTERNS = [
  /^llava/i,
  /^bakllava/i,
  /^moondream/i,
  /-vision/i,
];

/**
 * Known embedding dimensions by model family
 */
const EMBEDDING_DIMENSIONS: Record<string, number> = {
  'nomic-embed-text': 768,
  'mxbai-embed-large': 1024,
  'all-minilm': 384,
  'snowflake-arctic-embed': 1024,
  'bge-small': 384,
  'bge-base': 768,
  'bge-large': 1024,
  'gte-small': 384,
  'gte-base': 768,
  'gte-large': 1024,
};

/**
 * Infer capabilities from model name
 */
function inferCapabilities(modelName: string): ModelCapability[] {
  const name = modelName.toLowerCase();

  // Embedding models
  if (EMBEDDING_MODEL_PATTERNS.some(p => p.test(name))) {
    return ['embedding'];
  }

  // Start with base capabilities
  const capabilities: ModelCapability[] = ['completion', 'chat'];

  // Add code capability
  if (CODE_MODEL_PATTERNS.some(p => p.test(name))) {
    capabilities.push('code');
  }

  // Add vision capability
  if (VISION_MODEL_PATTERNS.some(p => p.test(name))) {
    capabilities.push('vision');
  }

  // Larger models get analysis capability
  const sizeMatch = name.match(/(\d+)b/i);
  if (sizeMatch) {
    const sizeB = parseInt(sizeMatch[1], 10);
    if (sizeB >= 7) {
      capabilities.push('analysis');
    }
    if (sizeB >= 13) {
      capabilities.push('creative');
    }
  }

  return capabilities;
}

/**
 * Infer embedding dimensions from model name
 */
function inferDimensions(modelName: string): number | undefined {
  const name = modelName.toLowerCase();

  for (const [pattern, dims] of Object.entries(EMBEDDING_DIMENSIONS)) {
    if (name.includes(pattern)) {
      return dims;
    }
  }

  // Default for unknown embedding models
  if (EMBEDDING_MODEL_PATTERNS.some(p => p.test(name))) {
    return 768; // Common default
  }

  return undefined;
}

/**
 * Infer context window from model name/family
 */
function inferContextWindow(modelName: string): number {
  const name = modelName.toLowerCase();

  // Check for explicit context in name
  const contextMatch = name.match(/(\d+)k/i);
  if (contextMatch) {
    return parseInt(contextMatch[1], 10) * 1024;
  }

  // Model-specific defaults
  if (name.includes('llama3')) return 8192;
  if (name.includes('llama2')) return 4096;
  if (name.includes('mistral')) return 8192;
  if (name.includes('mixtral')) return 32768;
  if (name.includes('gemma')) return 8192;
  if (name.includes('phi')) return 2048;
  if (name.includes('qwen')) return 8192;

  // Default
  return 4096;
}

// ═══════════════════════════════════════════════════════════════════════════
// OLLAMA DISCOVERY SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * OllamaDiscoveryService discovers and registers models from Ollama.
 */
export class OllamaDiscoveryService {
  private baseUrl: string;
  private timeoutMs: number;
  private tenantId: string;
  private refreshInterval: NodeJS.Timeout | null = null;

  private modelConfigService: ModelConfigService | null = null;
  private providerConfigService: ProviderConfigService | null = null;

  private lastDiscovery: OllamaDiscoveryResult | null = null;

  constructor(options?: OllamaDiscoveryOptions) {
    this.baseUrl = options?.baseUrl ?? 'http://localhost:11434';
    this.timeoutMs = options?.timeoutMs ?? 5000;
    this.tenantId = options?.defaultTenantId ?? 'humanizer';

    if (options?.refreshIntervalMs && options.refreshIntervalMs > 0) {
      this.startAutoRefresh(options.refreshIntervalMs);
    }
  }

  /**
   * Set the ModelConfigService for persistence.
   */
  setModelConfigService(service: ModelConfigService): void {
    this.modelConfigService = service;
  }

  /**
   * Set the ProviderConfigService for health tracking.
   */
  setProviderConfigService(service: ProviderConfigService): void {
    this.providerConfigService = service;
  }

  /**
   * Set a custom base URL for Ollama.
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Check if Ollama is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get the current Ollama URL (may be from ProviderConfigService).
   */
  async getEffectiveBaseUrl(userId?: string): Promise<string> {
    if (this.providerConfigService) {
      const customUrl = await this.providerConfigService.getBaseUrl('ollama', userId ?? null, this.tenantId);
      if (customUrl) {
        return customUrl;
      }
    }
    return this.baseUrl;
  }

  /**
   * Discover models from Ollama API.
   */
  async discover(userId?: string): Promise<OllamaDiscoveryResult> {
    const timestamp = new Date();

    try {
      const baseUrl = await this.getEffectiveBaseUrl(userId);
      const response = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const error = `HTTP ${response.status}: ${await response.text()}`;
        await this.updateProviderHealth('unhealthy', error, userId);
        return {
          success: false,
          modelsFound: 0,
          modelsRegistered: 0,
          models: [],
          error,
          timestamp,
        };
      }

      const data = (await response.json()) as { models: OllamaModelInfo[] };
      const models = data.models || [];

      // Process discovered models
      const discoveredModels: DiscoveredModel[] = [];
      const availabilityUpdates: Array<{
        modelId: string;
        status: ModelAvailabilityStatus;
        error: string | null;
      }> = [];

      for (const ollamaModel of models) {
        const modelId = ollamaModel.name;
        const capabilities = inferCapabilities(modelId);
        const dimensions = inferDimensions(modelId);
        const contextWindow = inferContextWindow(modelId);

        // Check if this matches a known DEFAULT_MODEL
        const knownModel = DEFAULT_MODELS.find(
          m => m.id === modelId || m.aliases?.includes(modelId.split(':')[0])
        );

        const discovered: DiscoveredModel = {
          id: modelId,
          name: modelId.split(':')[0],
          capabilities,
          dimensions,
          contextWindow,
          parameterSize: ollamaModel.details?.parameter_size,
          quantization: ollamaModel.details?.quantization_level,
          family: ollamaModel.details?.family,
          isKnown: !!knownModel,
        };

        discoveredModels.push(discovered);
        availabilityUpdates.push({
          modelId,
          status: 'available',
          error: null,
        });
      }

      // Mark known models not in Ollama as unavailable
      const ollamaModels = DEFAULT_MODELS.filter(m => m.provider === 'ollama');
      for (const model of ollamaModels) {
        const found = discoveredModels.some(
          d => d.id === model.id || model.aliases?.includes(d.name)
        );
        if (!found) {
          availabilityUpdates.push({
            modelId: model.id,
            status: 'unavailable',
            error: 'Model not found in Ollama',
          });
        }
      }

      // Persist to ModelConfigService if available
      let modelsRegistered = 0;
      if (this.modelConfigService) {
        for (const discovered of discoveredModels) {
          try {
            await this.modelConfigService.upsertSystemConfig(
              discovered.id,
              'ollama',
              {
                isEnabled: true,
                availabilityStatus: 'available',
                displayName: discovered.name,
                metadata: {
                  family: discovered.family,
                  parameterSize: discovered.parameterSize,
                  quantization: discovered.quantization,
                  discoveredAt: timestamp.toISOString(),
                },
              },
              this.tenantId
            );
            modelsRegistered++;
          } catch (error) {
            console.warn(`[OllamaDiscovery] Failed to register ${discovered.id}:`, error);
          }
        }

        // Batch update availability for known models
        await this.modelConfigService.batchUpdateAvailability(
          'ollama',
          availabilityUpdates,
          null,
          this.tenantId
        );
      }

      // Update provider health
      await this.updateProviderHealth('healthy', null, userId);

      const result: OllamaDiscoveryResult = {
        success: true,
        modelsFound: discoveredModels.length,
        modelsRegistered,
        models: discoveredModels,
        timestamp,
      };

      this.lastDiscovery = result;
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateProviderHealth('unhealthy', errorMessage, userId);

      const result: OllamaDiscoveryResult = {
        success: false,
        modelsFound: 0,
        modelsRegistered: 0,
        models: [],
        error: errorMessage,
        timestamp,
      };

      this.lastDiscovery = result;
      return result;
    }
  }

  /**
   * Get the last discovery result.
   */
  getLastDiscovery(): OllamaDiscoveryResult | null {
    return this.lastDiscovery;
  }

  /**
   * Get detailed model info from Ollama.
   */
  async getModelInfo(modelId: string, userId?: string): Promise<OllamaModelInfo | null> {
    try {
      const baseUrl = await this.getEffectiveBaseUrl(userId);
      const response = await fetch(`${baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelId }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as OllamaModelInfo;
    } catch {
      return null;
    }
  }

  /**
   * Start auto-refresh of model discovery.
   */
  startAutoRefresh(intervalMs: number): void {
    this.stopAutoRefresh();
    this.refreshInterval = setInterval(() => {
      this.discover().catch(err => {
        console.warn('[OllamaDiscovery] Auto-refresh failed:', err);
      });
    }, intervalMs);
  }

  /**
   * Stop auto-refresh.
   */
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Update provider health status in ProviderConfigService.
   */
  private async updateProviderHealth(
    status: 'healthy' | 'unhealthy',
    error: string | null,
    userId?: string
  ): Promise<void> {
    if (!this.providerConfigService) return;

    try {
      await this.providerConfigService.updateHealth(
        'ollama',
        status,
        error,
        userId ?? null,
        this.tenantId
      );
    } catch (err) {
      console.warn('[OllamaDiscovery] Failed to update provider health:', err);
    }
  }

  /**
   * Cleanup resources.
   */
  destroy(): void {
    this.stopAutoRefresh();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let _discoveryService: OllamaDiscoveryService | null = null;

/**
 * Initialize the Ollama discovery service.
 */
export function initOllamaDiscovery(options?: OllamaDiscoveryOptions): OllamaDiscoveryService {
  _discoveryService = new OllamaDiscoveryService(options);
  return _discoveryService;
}

/**
 * Get the Ollama discovery service.
 */
export function getOllamaDiscovery(): OllamaDiscoveryService | null {
  return _discoveryService;
}

/**
 * Reset the Ollama discovery service.
 */
export function resetOllamaDiscovery(): void {
  if (_discoveryService) {
    _discoveryService.destroy();
    _discoveryService = null;
  }
}
