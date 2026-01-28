/**
 * Database-Aware Model Registry
 *
 * Extends DefaultModelRegistry with database-backed configuration:
 * - User-configured default models per capability
 * - Enable/disable models per user
 * - Parameter overrides from database
 * - Availability status from discovery
 *
 * Fallback Behavior:
 * - If no database connection, falls back to DefaultModelRegistry
 * - If no user config, falls back to system config
 * - If no config at all, uses quality-based selection
 *
 * @module models/database-model-registry
 */

import type { Pool } from 'pg';
import type {
  ModelRegistry,
  VettedModel,
  VettingStatus,
  ModelCapability,
  PerformanceProfile,
  PromptRequirements,
  CompatibilityResult,
  ScoredModel,
} from './model-registry.js';
import { ModelNotFoundError } from './model-registry.js';
import { DefaultModelRegistry, DEFAULT_MODELS } from './default-model-registry.js';
import {
  ModelConfigService,
  type ModelConfig,
  type ModelConfigServiceOptions,
} from '../aui/service/model-config-service.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for DatabaseModelRegistry
 */
export interface DatabaseModelRegistryOptions extends ModelConfigServiceOptions {
  /** User ID for user-specific configs (null for system-only) */
  userId?: string | null;

  /** Whether to auto-sync DEFAULT_MODELS to database on init */
  syncDefaultModels?: boolean;
}

/**
 * Context for model lookups (allows per-request user context)
 */
export interface ModelLookupContext {
  userId?: string | null;
  tenantId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE MODEL REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DatabaseModelRegistry wraps DefaultModelRegistry with database-backed config.
 *
 * This is the production registry that should be used when a database is available.
 * It respects user preferences for default models while falling back to
 * quality-based selection when no preference is set.
 */
export class DatabaseModelRegistry implements ModelRegistry {
  private baseRegistry: DefaultModelRegistry;
  private configService: ModelConfigService;
  private options: DatabaseModelRegistryOptions;
  private initialized = false;

  constructor(pool: Pool, options?: DatabaseModelRegistryOptions) {
    this.baseRegistry = new DefaultModelRegistry();
    this.configService = new ModelConfigService(pool, options);
    this.options = {
      defaultTenantId: options?.defaultTenantId ?? 'humanizer',
      userId: options?.userId ?? null,
      syncDefaultModels: options?.syncDefaultModels ?? true,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize base registry first
    await this.baseRegistry.initialize();

    // Sync default models to database if enabled
    if (this.options.syncDefaultModels) {
      await this.syncDefaultModelsToDatabase();
    }

    this.initialized = true;
  }

  async refresh(): Promise<void> {
    await this.baseRegistry.refresh();
    // No additional refresh needed for database - it's always live
  }

  /**
   * Sync DEFAULT_MODELS to database as system-wide configs.
   *
   * This ensures all default models have database entries that can be
   * customized by users or admins.
   */
  private async syncDefaultModelsToDatabase(): Promise<void> {
    for (const model of DEFAULT_MODELS) {
      try {
        // Check if system config already exists
        const existing = await this.configService.getConfig(
          model.id,
          null, // system-wide
          this.options.defaultTenantId
        );

        if (!existing) {
          // Create system-wide config for this model
          await this.configService.upsertSystemConfig(
            model.id,
            model.provider,
            {
              isEnabled: model.vettingStatus === 'approved',
              availabilityStatus: 'unknown',
              displayName: model.description,
            },
            this.options.defaultTenantId
          );
        }
      } catch (error) {
        // Log but don't fail - database might not be ready
        console.warn(`[DatabaseModelRegistry] Failed to sync model ${model.id}:`, error);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY OPERATIONS (Database-Aware)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get all models with a specific capability.
   *
   * Filters out disabled models and applies database configs.
   */
  async getForCapability(
    capability: ModelCapability,
    context?: ModelLookupContext
  ): Promise<VettedModel[]> {
    const baseModels = await this.baseRegistry.getForCapability(capability);
    const userId = context?.userId ?? this.options.userId ?? null;
    const tenantId = context?.tenantId ?? this.options.defaultTenantId;

    // Filter and enhance with database configs
    const enhancedModels: VettedModel[] = [];

    for (const model of baseModels) {
      const config = await this.configService.getConfig(model.id, userId, tenantId);

      // Skip disabled models
      if (config && !config.isEnabled) {
        continue;
      }

      // Skip unavailable models (if availability has been checked)
      if (config?.availabilityStatus === 'unavailable') {
        continue;
      }

      // Apply config overrides
      const enhanced = config
        ? this.configService.mergeWithVettedModel(model, config)
        : model;

      enhancedModels.push(enhanced);
    }

    return enhancedModels;
  }

  async get(modelId: string): Promise<VettedModel | undefined> {
    return this.baseRegistry.get(modelId);
  }

  async resolveAlias(aliasOrId: string): Promise<string> {
    return this.baseRegistry.resolveAlias(aliasOrId);
  }

  /**
   * Get the default model for a capability.
   *
   * Priority:
   * 1. User-configured default (from database)
   * 2. System-configured default (from database)
   * 3. Highest quality approved model (from registry)
   */
  async getDefault(
    capability: ModelCapability,
    context?: ModelLookupContext
  ): Promise<VettedModel> {
    const userId = context?.userId ?? this.options.userId ?? null;
    const tenantId = context?.tenantId ?? this.options.defaultTenantId;

    // Check database for configured default
    const defaultConfig = await this.configService.getDefaultForCapability(
      capability,
      userId,
      tenantId
    );

    if (defaultConfig) {
      const model = await this.baseRegistry.get(defaultConfig.modelId);
      if (model && model.vettingStatus === 'approved') {
        return this.configService.mergeWithVettedModel(model, defaultConfig);
      }
    }

    // Fall back to quality-based selection
    const models = await this.getForCapability(capability, context);
    if (models.length === 0) {
      throw new ModelNotFoundError('', capability);
    }

    return models[0];
  }

  /**
   * Get the default model synchronously (from cache).
   *
   * Note: This bypasses database lookup for performance.
   * Use async getDefault() when database config is needed.
   */
  getDefaultSync(capability: ModelCapability): VettedModel | undefined {
    return this.baseRegistry.getDefaultSync?.(capability);
  }

  async getWithFallback(capability: ModelCapability): Promise<VettedModel> {
    try {
      return await this.getDefault(capability);
    } catch {
      return this.baseRegistry.getWithFallback(capability);
    }
  }

  async getEmbeddingDimensions(modelId?: string): Promise<number> {
    return this.baseRegistry.getEmbeddingDimensions(modelId);
  }

  async hasModel(modelId: string): Promise<boolean> {
    return this.baseRegistry.hasModel(modelId);
  }

  async listModels(): Promise<string[]> {
    return this.baseRegistry.listModels();
  }

  async listAllModels(): Promise<VettedModel[]> {
    return this.baseRegistry.listAllModels();
  }

  /**
   * List models with their database configs merged in.
   */
  async listModelsWithConfigs(
    context?: ModelLookupContext
  ): Promise<Array<VettedModel & { config?: ModelConfig }>> {
    const models = await this.baseRegistry.listAllModels();
    const userId = context?.userId ?? this.options.userId ?? null;
    const tenantId = context?.tenantId ?? this.options.defaultTenantId;

    const results: Array<VettedModel & { config?: ModelConfig }> = [];

    for (const model of models) {
      const config = await this.configService.getConfig(model.id, userId, tenantId);
      results.push({
        ...this.configService.mergeWithVettedModel(model, config),
        config: config ?? undefined,
      });
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COST OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async getCost(modelIdOrAlias: string): Promise<{ input: number; output: number }> {
    return this.baseRegistry.getCost(modelIdOrAlias);
  }

  getCostSync(modelIdOrAlias: string): { input: number; output: number } {
    return this.baseRegistry.getCostSync?.(modelIdOrAlias) ?? this.getDefaultCost();
  }

  getDefaultCost(): { input: number; output: number } {
    return this.baseRegistry.getDefaultCost();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAPABILITY MATCHING
  // ═══════════════════════════════════════════════════════════════════════════

  async findModelsForRequirements(requirements: PromptRequirements): Promise<ScoredModel[]> {
    return this.baseRegistry.findModelsForRequirements(requirements);
  }

  async canModelHandle(
    modelId: string,
    requirements: PromptRequirements
  ): Promise<CompatibilityResult> {
    return this.baseRegistry.canModelHandle(modelId, requirements);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRATION OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async register(model: VettedModel): Promise<void> {
    await this.baseRegistry.register(model);

    // Also create database config for the model
    try {
      await this.configService.upsertSystemConfig(
        model.id,
        model.provider,
        {
          isEnabled: model.vettingStatus === 'approved',
          availabilityStatus: 'unknown',
          displayName: model.description,
        },
        this.options.defaultTenantId
      );
    } catch (error) {
      console.warn(`[DatabaseModelRegistry] Failed to create config for ${model.id}:`, error);
    }
  }

  async updateVettingStatus(modelId: string, status: VettingStatus): Promise<void> {
    await this.baseRegistry.updateVettingStatus(modelId, status);

    // Update enabled status in database based on vetting
    try {
      await this.configService.updateConfig(
        modelId,
        { isEnabled: status === 'approved' },
        null, // system-wide
        this.options.defaultTenantId
      );
    } catch (error) {
      console.warn(`[DatabaseModelRegistry] Failed to update config for ${modelId}:`, error);
    }
  }

  async updatePerformanceProfile(
    modelId: string,
    profile: Partial<PerformanceProfile>
  ): Promise<void> {
    return this.baseRegistry.updatePerformanceProfile(modelId, profile);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASE-SPECIFIC OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set the default model for a capability (persists to database).
   */
  async setDefaultForCapability(
    modelId: string,
    capability: ModelCapability,
    context?: ModelLookupContext
  ): Promise<void> {
    const model = await this.baseRegistry.get(modelId);
    if (!model) {
      throw new ModelNotFoundError(modelId);
    }

    if (!model.capabilities.includes(capability)) {
      throw new Error(`Model ${modelId} does not support capability ${capability}`);
    }

    const userId = context?.userId ?? this.options.userId ?? null;
    const tenantId = context?.tenantId ?? this.options.defaultTenantId;

    await this.configService.setDefaultForCapability(modelId, capability, userId, tenantId);
  }

  /**
   * Clear the default model for a capability.
   */
  async clearDefaultForCapability(
    capability: ModelCapability,
    context?: ModelLookupContext
  ): Promise<void> {
    const userId = context?.userId ?? this.options.userId ?? null;
    const tenantId = context?.tenantId ?? this.options.defaultTenantId;

    await this.configService.clearDefaultForCapability(capability, userId, tenantId);
  }

  /**
   * Enable or disable a model for a user.
   */
  async setModelEnabled(
    modelId: string,
    enabled: boolean,
    context?: ModelLookupContext
  ): Promise<void> {
    const model = await this.baseRegistry.get(modelId);
    if (!model) {
      throw new ModelNotFoundError(modelId);
    }

    const userId = context?.userId ?? this.options.userId ?? null;
    const tenantId = context?.tenantId ?? this.options.defaultTenantId;

    if (enabled) {
      await this.configService.enableModel(modelId, userId, tenantId);
    } else {
      await this.configService.disableModel(modelId, userId, tenantId);
    }
  }

  /**
   * Update model availability status (from discovery).
   */
  async updateModelAvailability(
    modelId: string,
    available: boolean,
    error?: string,
    context?: ModelLookupContext
  ): Promise<void> {
    const userId = context?.userId ?? this.options.userId ?? null;
    const tenantId = context?.tenantId ?? this.options.defaultTenantId;

    await this.configService.updateAvailability(
      modelId,
      available ? 'available' : 'unavailable',
      error ?? null,
      userId,
      tenantId
    );
  }

  /**
   * Get the underlying config service for advanced operations.
   */
  getConfigService(): ModelConfigService {
    return this.configService;
  }

  /**
   * Get the underlying base registry.
   */
  getBaseRegistry(): DefaultModelRegistry {
    return this.baseRegistry;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let _databaseRegistry: DatabaseModelRegistry | null = null;

/**
 * Initialize the database-aware model registry.
 *
 * This should be called at application startup when a database is available.
 */
export async function initDatabaseModelRegistry(
  pool: Pool,
  options?: DatabaseModelRegistryOptions
): Promise<DatabaseModelRegistry> {
  _databaseRegistry = new DatabaseModelRegistry(pool, options);
  await _databaseRegistry.initialize();
  return _databaseRegistry;
}

/**
 * Get the database-aware model registry.
 */
export function getDatabaseModelRegistry(): DatabaseModelRegistry | null {
  return _databaseRegistry;
}

/**
 * Reset the database model registry.
 */
export function resetDatabaseModelRegistry(): void {
  _databaseRegistry = null;
}
