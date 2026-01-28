/**
 * Default Model Registry Implementation
 *
 * In-memory registry with pre-configured models for common use cases.
 * Loads additional models from ConfigManager if available.
 *
 * @module models/default-model-registry
 */

import { getConfigManager } from '../config/index.js';
import type {
  ModelRegistry,
  VettedModel,
  VettingStatus,
  ModelCapability,
  PerformanceProfile,
  FallbackChain,
  PromptRequirements,
  CompatibilityResult,
  ScoredModel,
} from './model-registry.js';
import {
  DEFAULT_FALLBACK_CHAINS,
  CAPABILITY_MAPPINGS,
  ModelNotFoundError,
} from './model-registry.js';

// ═══════════════════════════════════════════════════════════════════
// DEFAULT MODELS
// ═══════════════════════════════════════════════════════════════════

/**
 * Pre-configured models for common use cases.
 * These are loaded by default and can be overridden via config.
 */
export const DEFAULT_MODELS: VettedModel[] = [
  // ─────────────────────────────────────────────────────────────────
  // Ollama Local Models
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'nomic-embed-text:latest',
    provider: 'ollama',
    capabilities: ['embedding'],
    dimensions: 768,
    maxBatchSize: 10,
    tokenLimit: 2048,
    warmupRequired: true,
    costPer1kTokens: { input: 0, output: 0 },
    vettingStatus: 'approved',
    aliases: ['nomic-embed-text', 'nomic'],
    description: 'Local embedding model via Ollama',
    privacyLevel: 'local',
    privacyInfo: {
      level: 'local',
      warning: undefined, // No warning needed - data stays local
      dataRetention: 'None - processed locally',
      mayTrainOnData: false,
    },
    performanceProfile: {
      avgLatencyMs: 50,
      qualityScore: 0.85,
      lastVetted: new Date('2026-01-01'),
      approvedCapabilities: ['embedding'],
    },
  },
  {
    id: 'llama3.2:3b',
    provider: 'ollama',
    capabilities: ['completion', 'chat', 'analysis', 'creative'],
    contextWindow: 8192,
    warmupRequired: true,
    supportsStreaming: true,
    costPer1kTokens: { input: 0, output: 0 },
    vettingStatus: 'approved',
    aliases: ['llama3.2', 'llama', 'llama-3b'],
    description: 'Local completion model via Ollama',
    privacyLevel: 'local',
    privacyInfo: {
      level: 'local',
      warning: undefined,
      dataRetention: 'None - processed locally',
      mayTrainOnData: false,
    },
    performanceProfile: {
      avgLatencyMs: 200,
      qualityScore: 0.75,
      lastVetted: new Date('2026-01-01'),
      approvedCapabilities: ['completion', 'chat'],
    },
  },
  // ─────────────────────────────────────────────────────────────────
  // Ollama Vision Models (for OCR and image description)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'llava:13b',
    provider: 'ollama',
    capabilities: ['vision', 'completion', 'chat'],
    contextWindow: 4096,
    warmupRequired: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1kTokens: { input: 0, output: 0 },
    vettingStatus: 'approved',
    aliases: ['llava', 'llava13b', 'llava-13b'],
    description: 'Vision-language model for image understanding, OCR, and descriptions (13B)',
    privacyLevel: 'local',
    privacyInfo: {
      level: 'local',
      warning: undefined,
      dataRetention: 'None - processed locally',
      mayTrainOnData: false,
    },
    performanceProfile: {
      avgLatencyMs: 2000,
      qualityScore: 0.85,
      lastVetted: new Date('2026-01-27'),
      approvedCapabilities: ['vision', 'completion'],
    },
  },
  {
    id: 'llava:7b',
    provider: 'ollama',
    capabilities: ['vision', 'completion', 'chat'],
    contextWindow: 4096,
    warmupRequired: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1kTokens: { input: 0, output: 0 },
    vettingStatus: 'approved',
    aliases: ['llava-7b'],
    description: 'Vision-language model for image understanding, OCR (7B, faster)',
    privacyLevel: 'local',
    privacyInfo: {
      level: 'local',
      warning: undefined,
      dataRetention: 'None - processed locally',
      mayTrainOnData: false,
    },
    performanceProfile: {
      avgLatencyMs: 1000,
      qualityScore: 0.80,
      lastVetted: new Date('2026-01-27'),
      approvedCapabilities: ['vision', 'completion'],
    },
  },
  {
    id: 'bakllava:latest',
    provider: 'ollama',
    capabilities: ['vision', 'completion', 'chat'],
    contextWindow: 4096,
    warmupRequired: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1kTokens: { input: 0, output: 0 },
    vettingStatus: 'approved',
    aliases: ['bakllava'],
    description: 'BakLLaVA vision model - improved LLaVA architecture for OCR',
    privacyLevel: 'local',
    privacyInfo: {
      level: 'local',
      warning: undefined,
      dataRetention: 'None - processed locally',
      mayTrainOnData: false,
    },
    performanceProfile: {
      avgLatencyMs: 1500,
      qualityScore: 0.82,
      lastVetted: new Date('2026-01-27'),
      approvedCapabilities: ['vision', 'completion'],
    },
  },
  {
    id: 'moondream:latest',
    provider: 'ollama',
    capabilities: ['vision', 'completion'],
    contextWindow: 2048,
    warmupRequired: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1kTokens: { input: 0, output: 0 },
    vettingStatus: 'approved',
    aliases: ['moondream', 'moondream2'],
    description: 'Lightweight vision model (1.6B params) - fast for simple OCR tasks',
    privacyLevel: 'local',
    privacyInfo: {
      level: 'local',
      warning: undefined,
      dataRetention: 'None - processed locally',
      mayTrainOnData: false,
    },
    performanceProfile: {
      avgLatencyMs: 500,
      qualityScore: 0.72,
      lastVetted: new Date('2026-01-27'),
      approvedCapabilities: ['vision'],
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // OpenAI Models (THIRD-PARTY - data sent to OpenAI servers)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'text-embedding-3-small',
    provider: 'openai',
    capabilities: ['embedding'],
    dimensions: 1536,
    maxBatchSize: 100,
    tokenLimit: 8191,
    costPer1kTokens: { input: 0.00002, output: 0 },
    vettingStatus: 'approved',
    aliases: ['openai-embed-small', 'te3-small'],
    description: 'OpenAI small embedding model',
    privacyLevel: 'third-party',
    privacyInfo: {
      level: 'third-party',
      warning: 'Your content will be sent to OpenAI servers for processing',
      dataRetention: '30 days for abuse monitoring (API)',
      mayTrainOnData: false, // API data not used for training by default
      privacyPolicyUrl: 'https://openai.com/policies/privacy-policy',
    },
    performanceProfile: {
      avgLatencyMs: 100,
      qualityScore: 0.90,
      lastVetted: new Date('2026-01-01'),
      approvedCapabilities: ['embedding'],
    },
  },
  {
    id: 'text-embedding-ada-002',
    provider: 'openai',
    capabilities: ['embedding'],
    dimensions: 1536,
    maxBatchSize: 100,
    tokenLimit: 8191,
    costPer1kTokens: { input: 0.0001, output: 0 },
    vettingStatus: 'approved',
    aliases: ['ada-002', 'ada'],
    description: 'OpenAI Ada embedding model (legacy)',
    privacyLevel: 'third-party',
    privacyInfo: {
      level: 'third-party',
      warning: 'Your content will be sent to OpenAI servers for processing',
      dataRetention: '30 days for abuse monitoring (API)',
      mayTrainOnData: false,
      privacyPolicyUrl: 'https://openai.com/policies/privacy-policy',
    },
    performanceProfile: {
      avgLatencyMs: 100,
      qualityScore: 0.85,
      lastVetted: new Date('2026-01-01'),
      approvedCapabilities: ['embedding'],
    },
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    capabilities: ['completion', 'chat', 'analysis', 'code', 'json-mode'],
    contextWindow: 128000,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1kTokens: { input: 0.00015, output: 0.0006 },
    vettingStatus: 'approved',
    aliases: ['gpt4o-mini', '4o-mini'],
    description: 'OpenAI GPT-4o Mini',
    privacyLevel: 'third-party',
    privacyInfo: {
      level: 'third-party',
      warning: 'Your content will be sent to OpenAI servers for processing',
      dataRetention: '30 days for abuse monitoring (API)',
      mayTrainOnData: false,
      privacyPolicyUrl: 'https://openai.com/policies/privacy-policy',
    },
    performanceProfile: {
      avgLatencyMs: 300,
      qualityScore: 0.85,
      lastVetted: new Date('2026-01-01'),
    },
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    capabilities: ['completion', 'chat', 'analysis', 'creative', 'code', 'vision', 'json-mode', 'long-context'],
    contextWindow: 128000,
    supportsStreaming: true,
    supportsVision: true,
    supportsJsonMode: true,
    costPer1kTokens: { input: 0.005, output: 0.015 },
    vettingStatus: 'approved',
    aliases: ['gpt4o', '4o'],
    description: 'OpenAI GPT-4o',
    privacyLevel: 'third-party',
    privacyInfo: {
      level: 'third-party',
      warning: 'Your content will be sent to OpenAI servers for processing',
      dataRetention: '30 days for abuse monitoring (API)',
      mayTrainOnData: false,
      privacyPolicyUrl: 'https://openai.com/policies/privacy-policy',
    },
    performanceProfile: {
      avgLatencyMs: 500,
      qualityScore: 0.92,
      lastVetted: new Date('2026-01-01'),
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // Anthropic Models (THIRD-PARTY - data sent to Anthropic servers)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    capabilities: ['completion', 'chat', 'analysis', 'code'],
    contextWindow: 200000,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.00025, output: 0.00125 },
    vettingStatus: 'approved',
    aliases: ['claude-haiku', 'haiku'],
    description: 'Anthropic Claude 3 Haiku',
    privacyLevel: 'third-party',
    privacyInfo: {
      level: 'third-party',
      warning: 'Your content will be sent to Anthropic servers for processing',
      dataRetention: '30 days for trust & safety (API)',
      mayTrainOnData: false,
      privacyPolicyUrl: 'https://www.anthropic.com/privacy',
    },
    performanceProfile: {
      avgLatencyMs: 200,
      qualityScore: 0.80,
      lastVetted: new Date('2026-01-01'),
    },
  },
  {
    id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    capabilities: ['completion', 'chat', 'analysis', 'creative', 'code', 'vision', 'thinking', 'long-context'],
    contextWindow: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costPer1kTokens: { input: 0.003, output: 0.015 },
    vettingStatus: 'approved',
    aliases: ['claude-sonnet', 'sonnet', 'claude-sonnet-4'],
    description: 'Anthropic Claude Sonnet 4',
    privacyLevel: 'third-party',
    privacyInfo: {
      level: 'third-party',
      warning: 'Your content will be sent to Anthropic servers for processing',
      dataRetention: '30 days for trust & safety (API)',
      mayTrainOnData: false,
      privacyPolicyUrl: 'https://www.anthropic.com/privacy',
    },
    performanceProfile: {
      avgLatencyMs: 400,
      qualityScore: 0.93,
      lastVetted: new Date('2026-01-01'),
    },
  },
  {
    id: 'claude-opus-4-20250514',
    provider: 'anthropic',
    capabilities: ['completion', 'chat', 'analysis', 'creative', 'code', 'vision', 'thinking', 'long-context'],
    contextWindow: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costPer1kTokens: { input: 0.015, output: 0.075 },
    vettingStatus: 'approved',
    aliases: ['claude-opus', 'opus', 'claude-opus-4'],
    description: 'Anthropic Claude Opus 4',
    privacyLevel: 'third-party',
    privacyInfo: {
      level: 'third-party',
      warning: 'Your content will be sent to Anthropic servers for processing',
      dataRetention: '30 days for trust & safety (API)',
      mayTrainOnData: false,
      privacyPolicyUrl: 'https://www.anthropic.com/privacy',
    },
    performanceProfile: {
      avgLatencyMs: 600,
      qualityScore: 0.97,
      lastVetted: new Date('2026-01-01'),
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // Voyage Models (THIRD-PARTY - data sent to Voyage AI servers)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'voyage-2',
    provider: 'voyage',
    capabilities: ['embedding'],
    dimensions: 1024,
    maxBatchSize: 128,
    tokenLimit: 4000,
    costPer1kTokens: { input: 0.0001, output: 0 },
    vettingStatus: 'approved',
    aliases: ['voyage'],
    description: 'Voyage AI embedding model',
    privacyLevel: 'third-party',
    privacyInfo: {
      level: 'third-party',
      warning: 'Your content will be sent to Voyage AI servers for embedding',
      dataRetention: 'Not specified',
      mayTrainOnData: false,
      privacyPolicyUrl: 'https://www.voyageai.com/privacy',
    },
    performanceProfile: {
      avgLatencyMs: 80,
      qualityScore: 0.92,
      lastVetted: new Date('2026-01-01'),
      approvedCapabilities: ['embedding'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// DEFAULT MODEL REGISTRY
// ═══════════════════════════════════════════════════════════════════

export class DefaultModelRegistry implements ModelRegistry {
  private models: Map<string, VettedModel> = new Map();
  private aliases: Map<string, string> = new Map();
  private fallbackChains: Map<ModelCapability, FallbackChain> = new Map();
  private initialized = false;

  // ─────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load default models
    for (const model of DEFAULT_MODELS) {
      this.registerModel(model);
    }

    // Try to load additional models from config (stored in 'agents' category)
    try {
      const config = getConfigManager();
      const configModels = await config.get<VettedModel[]>('agents', 'model-registry');
      if (configModels) {
        for (const model of configModels) {
          this.registerModel(model);
        }
      }
    } catch {
      // Config not available, use defaults only
    }

    // Load fallback chains
    for (const chain of DEFAULT_FALLBACK_CHAINS) {
      this.fallbackChains.set(chain.capability, chain);
    }

    this.initialized = true;
  }

  async refresh(): Promise<void> {
    this.models.clear();
    this.aliases.clear();
    this.fallbackChains.clear();
    this.initialized = false;
    await this.initialize();
  }

  private registerModel(model: VettedModel): void {
    this.models.set(model.id, model);

    // Register aliases
    if (model.aliases) {
      for (const alias of model.aliases) {
        this.aliases.set(alias, model.id);
      }
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      // Sync initialize for backward compatibility
      for (const model of DEFAULT_MODELS) {
        this.registerModel(model);
      }
      for (const chain of DEFAULT_FALLBACK_CHAINS) {
        this.fallbackChains.set(chain.capability, chain);
      }
      this.initialized = true;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Query Operations
  // ─────────────────────────────────────────────────────────────────

  async getForCapability(capability: ModelCapability): Promise<VettedModel[]> {
    this.ensureInitialized();

    const models: VettedModel[] = [];
    for (const model of this.models.values()) {
      if (
        model.capabilities.includes(capability) &&
        model.vettingStatus === 'approved'
      ) {
        models.push(model);
      }
    }

    // Sort by quality score descending
    models.sort((a, b) => b.performanceProfile.qualityScore - a.performanceProfile.qualityScore);

    return models;
  }

  async get(modelId: string): Promise<VettedModel | undefined> {
    this.ensureInitialized();
    const resolved = await this.resolveAlias(modelId);
    return this.models.get(resolved);
  }

  async resolveAlias(aliasOrId: string): Promise<string> {
    this.ensureInitialized();
    return this.aliases.get(aliasOrId) ?? aliasOrId;
  }

  async getDefault(capability: ModelCapability): Promise<VettedModel> {
    this.ensureInitialized();

    const models = await this.getForCapability(capability);
    if (models.length === 0) {
      throw new ModelNotFoundError('', capability);
    }

    return models[0];
  }

  /**
   * Get the default model synchronously (from cache).
   * Returns undefined if not initialized or no model found.
   * Prefer async getDefault() when possible.
   */
  getDefaultSync(capability: ModelCapability): VettedModel | undefined {
    if (!this.initialized) {
      return undefined;
    }

    // Find first approved model with the capability
    for (const model of this.models.values()) {
      if (
        model.capabilities.includes(capability) &&
        model.vettingStatus === 'approved'
      ) {
        return model;
      }
    }

    return undefined;
  }

  async getWithFallback(capability: ModelCapability): Promise<VettedModel> {
    this.ensureInitialized();

    const chain = this.fallbackChains.get(capability);
    if (!chain) {
      return this.getDefault(capability);
    }

    // Try each model in the chain
    for (const option of chain.chain) {
      const model = this.models.get(option.modelId);
      if (!model || model.vettingStatus !== 'approved') {
        continue;
      }

      // Check conditions
      if (option.conditions?.requiresLocal && model.provider !== 'ollama' && model.provider !== 'local') {
        continue;
      }

      return model;
    }

    // Try ultimate fallback
    const fallback = this.models.get(chain.ultimateFallback);
    if (fallback && fallback.vettingStatus === 'approved') {
      return fallback;
    }

    // Handle failure based on chain configuration
    if (chain.onFailure === 'error') {
      throw new ModelNotFoundError('', capability);
    }

    // For 'degrade' or 'queue', return any available model
    const anyModel = await this.getDefault(capability);
    return anyModel;
  }

  async getEmbeddingDimensions(modelId?: string): Promise<number> {
    this.ensureInitialized();

    if (modelId) {
      const resolved = await this.resolveAlias(modelId);
      const model = this.models.get(resolved);
      if (model?.dimensions) {
        return model.dimensions;
      }
      throw new Error(`Model ${modelId} has no dimensions defined`);
    }

    // Get default embedding model
    const defaultModel = await this.getDefault('embedding');
    if (defaultModel.dimensions) {
      return defaultModel.dimensions;
    }

    throw new Error('Default embedding model has no dimensions defined');
  }

  async hasModel(modelId: string): Promise<boolean> {
    this.ensureInitialized();
    const resolved = await this.resolveAlias(modelId);
    const model = this.models.get(resolved);
    return model !== undefined && model.vettingStatus === 'approved';
  }

  async listModels(): Promise<string[]> {
    this.ensureInitialized();
    return Array.from(this.models.keys());
  }

  async listAllModels(): Promise<VettedModel[]> {
    this.ensureInitialized();
    return Array.from(this.models.values());
  }

  // ─────────────────────────────────────────────────────────────────
  // Cost Operations
  // ─────────────────────────────────────────────────────────────────

  async getCost(modelIdOrAlias: string): Promise<{ input: number; output: number }> {
    this.ensureInitialized();

    const resolved = await this.resolveAlias(modelIdOrAlias);
    const model = this.models.get(resolved);

    if (model) {
      return model.costPer1kTokens;
    }

    return this.getDefaultCost();
  }

  /**
   * Get cost for a model synchronously (from cache).
   * Returns default cost if model not found or registry not initialized.
   * Costs are per 1K tokens in dollars.
   */
  getCostSync(modelIdOrAlias: string): { input: number; output: number } {
    if (!this.initialized) {
      return this.getDefaultCost();
    }

    // Resolve alias synchronously
    const resolved = this.aliases.get(modelIdOrAlias) ?? modelIdOrAlias;
    const model = this.models.get(resolved);

    if (model) {
      return model.costPer1kTokens;
    }

    return this.getDefaultCost();
  }

  getDefaultCost(): { input: number; output: number } {
    // Conservative default for unknown models
    return { input: 0.01, output: 0.03 };
  }

  // ─────────────────────────────────────────────────────────────────
  // Capability Matching
  // ─────────────────────────────────────────────────────────────────

  async findModelsForRequirements(requirements: PromptRequirements): Promise<ScoredModel[]> {
    this.ensureInitialized();

    const scoredModels: ScoredModel[] = [];

    for (const model of this.models.values()) {
      if (model.vettingStatus !== 'approved') continue;

      const result = await this.canModelHandle(model.id, requirements);
      if (result.compatible) {
        scoredModels.push({
          model,
          score: result.score,
          matchedCapabilities: requirements.capabilities.filter(c => model.capabilities.includes(c)),
          warnings: result.warnings,
        });
      }
    }

    // Sort by score descending
    scoredModels.sort((a, b) => b.score - a.score);

    return scoredModels;
  }

  async canModelHandle(modelId: string, requirements: PromptRequirements): Promise<CompatibilityResult> {
    this.ensureInitialized();

    const resolved = await this.resolveAlias(modelId);
    const model = this.models.get(resolved);

    if (!model) {
      return {
        compatible: false,
        missingCapabilities: requirements.capabilities,
        warnings: [`Model ${modelId} not found`],
        score: 0,
      };
    }

    const missingCapabilities: ModelCapability[] = [];
    const warnings: string[] = [];
    let score = 1.0;

    // Check required capabilities
    for (const cap of requirements.capabilities) {
      if (!model.capabilities.includes(cap)) {
        // Check capability mappings
        const mappedCaps = CAPABILITY_MAPPINGS[cap];
        const hasMapped = mappedCaps?.some(mc => model.capabilities.includes(mc as ModelCapability));

        if (!hasMapped) {
          missingCapabilities.push(cap);
          score -= 0.3;
        }
      }
    }

    // Check context window
    if (requirements.minContextWindow && model.contextWindow) {
      if (model.contextWindow < requirements.minContextWindow) {
        warnings.push(`Context window ${model.contextWindow} < required ${requirements.minContextWindow}`);
        score -= 0.1;
      }
    }

    // Check local requirement
    if (requirements.requiresLocal) {
      if (model.provider !== 'ollama' && model.provider !== 'local') {
        warnings.push('Requires local model but model is cloud-based');
        score -= 0.2;
      }
    }

    // Check cost
    if (requirements.maxCostPer1k !== undefined) {
      const avgCost = (model.costPer1kTokens.input + model.costPer1kTokens.output) / 2;
      if (avgCost > requirements.maxCostPer1k) {
        warnings.push(`Cost ${avgCost} > max ${requirements.maxCostPer1k}`);
        score -= 0.1;
      }
    }

    // Check latency
    if (requirements.maxLatencyMs !== undefined) {
      if (model.performanceProfile.avgLatencyMs > requirements.maxLatencyMs) {
        warnings.push(`Latency ${model.performanceProfile.avgLatencyMs}ms > max ${requirements.maxLatencyMs}ms`);
        score -= 0.1;
      }
    }

    // Prefer preferred providers
    if (requirements.preferredProviders?.length) {
      const providerIndex = requirements.preferredProviders.indexOf(model.provider);
      if (providerIndex === -1) {
        score -= 0.05;
      } else {
        score += 0.05 * (requirements.preferredProviders.length - providerIndex);
      }
    }

    // Boost by quality score
    score *= model.performanceProfile.qualityScore;

    return {
      compatible: missingCapabilities.length === 0,
      missingCapabilities,
      warnings,
      score: Math.max(0, Math.min(1, score)),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Registration Operations
  // ─────────────────────────────────────────────────────────────────

  async register(model: VettedModel): Promise<void> {
    this.ensureInitialized();
    this.registerModel(model);
  }

  async updateVettingStatus(modelId: string, status: VettingStatus): Promise<void> {
    this.ensureInitialized();

    const resolved = await this.resolveAlias(modelId);
    const model = this.models.get(resolved);

    if (!model) {
      throw new ModelNotFoundError(modelId);
    }

    model.vettingStatus = status;
  }

  async updatePerformanceProfile(modelId: string, profile: Partial<PerformanceProfile>): Promise<void> {
    this.ensureInitialized();

    const resolved = await this.resolveAlias(modelId);
    const model = this.models.get(resolved);

    if (!model) {
      throw new ModelNotFoundError(modelId);
    }

    model.performanceProfile = {
      ...model.performanceProfile,
      ...profile,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _registry: ModelRegistry | null = null;

/**
 * Get the singleton model registry
 */
export function getModelRegistry(): ModelRegistry {
  if (!_registry) {
    _registry = new DefaultModelRegistry();
  }
  return _registry;
}

/**
 * Set a custom model registry (for testing)
 */
export function setModelRegistry(registry: ModelRegistry): void {
  _registry = registry;
}

/**
 * Reset the model registry (for testing)
 */
export function resetModelRegistry(): void {
  _registry = null;
}
