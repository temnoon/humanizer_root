/**
 * Model Config Service
 *
 * Persists model configurations per user or system-wide.
 *
 * Features:
 * - Enable/disable specific models
 * - Set default models per capability
 * - Override model parameters (temperature, etc.)
 * - Track model availability status
 * - Merge user configs with system defaults
 *
 * Config Precedence (highest to lowest):
 * 1. User-specific config
 * 2. System-wide config
 * 3. VettedModel defaults from registry
 *
 * @module @humanizer/core/aui/service/model-config-service
 */

import type { Pool } from 'pg';
import type { ModelCapability, ModelProvider, VettedModel } from '../../models/model-registry.js';
import {
  INSERT_AUI_MODEL_CONFIG,
  GET_AUI_MODEL_CONFIG,
  GET_AUI_MODEL_CONFIG_USER,
  LIST_AUI_MODEL_CONFIGS,
  LIST_AUI_MODEL_CONFIGS_FOR_USER,
  LIST_AUI_MODEL_CONFIGS_ENABLED,
  GET_AUI_DEFAULT_MODEL_FOR_CAPABILITY,
  UPDATE_AUI_MODEL_CONFIG,
  UPDATE_AUI_MODEL_CONFIG_AVAILABILITY,
  CLEAR_AUI_MODEL_CONFIG_DEFAULT,
  DELETE_AUI_MODEL_CONFIG,
  BATCH_UPDATE_AUI_MODEL_CONFIGS_AVAILABILITY,
} from '../../storage/schema-aui.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Model availability status
 */
export type ModelAvailabilityStatus = 'available' | 'unavailable' | 'unknown';

/**
 * Parameter overrides for a model
 */
export interface ModelParameterOverrides {
  /** Override temperature (0-1) */
  temperature?: number;

  /** Override top_p (0-1) */
  topP?: number;

  /** Override max tokens */
  maxTokens?: number;

  /** Override frequency penalty */
  frequencyPenalty?: number;

  /** Override presence penalty */
  presencePenalty?: number;

  /** Custom stop sequences */
  stopSequences?: string[];

  /** Provider-specific overrides */
  providerSpecific?: Record<string, unknown>;
}

/**
 * Model configuration stored in database
 */
export interface ModelConfig {
  id: string;
  tenantId: string;
  userId: string | null;
  modelId: string;
  provider: ModelProvider;
  isEnabled: boolean;
  defaultForCapability: ModelCapability | null;
  parameterOverrides: ModelParameterOverrides;
  availabilityStatus: ModelAvailabilityStatus;
  lastAvailabilityCheck: Date | null;
  availabilityError: string | null;
  displayName: string | null;
  displayOrder: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Model config with source information (user or system)
 */
export interface ModelConfigWithSource extends ModelConfig {
  configSource: 'user' | 'system';
}

/**
 * Options for creating/updating model config
 */
export interface ModelConfigInput {
  isEnabled?: boolean;
  defaultForCapability?: ModelCapability | null;
  parameterOverrides?: ModelParameterOverrides;
  availabilityStatus?: ModelAvailabilityStatus;
  displayName?: string | null;
  displayOrder?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Options for ModelConfigService
 */
export interface ModelConfigServiceOptions {
  defaultTenantId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODEL CONFIG SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ModelConfigService provides persistent model configuration.
 *
 * Supports both system-wide (userId = null) and user-specific configurations.
 * User configs override system configs for the same model.
 */
export class ModelConfigService {
  private pool: Pool;
  private options: Required<ModelConfigServiceOptions>;

  constructor(pool: Pool, options?: ModelConfigServiceOptions) {
    this.pool = pool;
    this.options = {
      defaultTenantId: options?.defaultTenantId ?? 'humanizer',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE / UPSERT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create or update a model configuration.
   *
   * @param modelId - Model identifier (e.g., 'gpt-4o', 'llama3.2:3b')
   * @param provider - Model provider
   * @param input - Configuration options
   * @param userId - User ID (null for system-wide config)
   * @param tenantId - Tenant ID
   */
  async upsertConfig(
    modelId: string,
    provider: ModelProvider,
    input: ModelConfigInput,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ModelConfig> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    // If setting as default for capability, clear other defaults first
    if (input.defaultForCapability) {
      await this.pool.query(CLEAR_AUI_MODEL_CONFIG_DEFAULT, [
        tenant,
        userId,
        input.defaultForCapability,
        modelId,
      ]);
    }

    const result = await this.pool.query(INSERT_AUI_MODEL_CONFIG, [
      tenant,
      userId,
      modelId,
      provider,
      input.isEnabled ?? true,
      input.defaultForCapability ?? null,
      JSON.stringify(input.parameterOverrides ?? {}),
      input.availabilityStatus ?? 'unknown',
      input.displayName ?? null,
      input.displayOrder ?? 100,
      JSON.stringify(input.metadata ?? {}),
    ]);

    return this.rowToModelConfig(result.rows[0]);
  }

  /**
   * Create system-wide model configuration.
   */
  async upsertSystemConfig(
    modelId: string,
    provider: ModelProvider,
    input: ModelConfigInput,
    tenantId?: string
  ): Promise<ModelConfig> {
    return this.upsertConfig(modelId, provider, input, null, tenantId);
  }

  /**
   * Create user-specific model configuration.
   */
  async upsertUserConfig(
    userId: string,
    modelId: string,
    provider: ModelProvider,
    input: ModelConfigInput,
    tenantId?: string
  ): Promise<ModelConfig> {
    return this.upsertConfig(modelId, provider, input, userId, tenantId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get model configuration with fallback to system config.
   *
   * Returns user config if exists, otherwise system config.
   */
  async getConfig(
    modelId: string,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ModelConfig | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(GET_AUI_MODEL_CONFIG, [tenant, userId, modelId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToModelConfig(result.rows[0]);
  }

  /**
   * Get only user-specific config (no fallback to system).
   */
  async getUserConfig(
    userId: string,
    modelId: string,
    tenantId?: string
  ): Promise<ModelConfig | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(GET_AUI_MODEL_CONFIG_USER, [tenant, userId, modelId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToModelConfig(result.rows[0]);
  }

  /**
   * Get the default model for a capability.
   *
   * Checks user configs first, then system configs.
   */
  async getDefaultForCapability(
    capability: ModelCapability,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ModelConfig | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(GET_AUI_DEFAULT_MODEL_FOR_CAPABILITY, [
      tenant,
      userId,
      capability,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToModelConfig(result.rows[0]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List all model configurations.
   *
   * @param userId - Filter by user (null for system configs only)
   * @param provider - Filter by provider
   * @param tenantId - Tenant ID
   */
  async listConfigs(
    userId?: string | null,
    provider?: ModelProvider,
    tenantId?: string
  ): Promise<ModelConfig[]> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(LIST_AUI_MODEL_CONFIGS, [
      tenant,
      userId ?? null,
      provider ?? null,
    ]);

    return result.rows.map(row => this.rowToModelConfig(row));
  }

  /**
   * List model configs for a user, including system fallbacks.
   *
   * Returns configs with source information.
   */
  async listConfigsForUser(
    userId: string,
    tenantId?: string
  ): Promise<ModelConfigWithSource[]> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(LIST_AUI_MODEL_CONFIGS_FOR_USER, [tenant, userId]);

    return result.rows.map(row => ({
      ...this.rowToModelConfig(row),
      configSource: row.config_source as 'user' | 'system',
    }));
  }

  /**
   * List only enabled model configs for a user.
   */
  async listEnabledConfigsForUser(
    userId: string,
    tenantId?: string
  ): Promise<ModelConfigWithSource[]> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(LIST_AUI_MODEL_CONFIGS_ENABLED, [tenant, userId]);

    return result.rows.map(row => ({
      ...this.rowToModelConfig(row),
      configSource: row.config_source as 'user' | 'system',
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update an existing model configuration.
   */
  async updateConfig(
    modelId: string,
    input: Partial<ModelConfigInput>,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ModelConfig | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    // If setting as default for capability, clear other defaults first
    if (input.defaultForCapability) {
      await this.pool.query(CLEAR_AUI_MODEL_CONFIG_DEFAULT, [
        tenant,
        userId,
        input.defaultForCapability,
        modelId,
      ]);
    }

    const result = await this.pool.query(UPDATE_AUI_MODEL_CONFIG, [
      tenant,
      userId,
      modelId,
      input.isEnabled ?? null,
      input.defaultForCapability,  // Can be null to clear
      input.parameterOverrides ? JSON.stringify(input.parameterOverrides) : null,
      input.displayName ?? null,
      input.displayOrder ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToModelConfig(result.rows[0]);
  }

  /**
   * Update model availability status.
   *
   * Used after health checks or discovery.
   */
  async updateAvailability(
    modelId: string,
    status: ModelAvailabilityStatus,
    error: string | null = null,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ModelConfig | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(UPDATE_AUI_MODEL_CONFIG_AVAILABILITY, [
      tenant,
      userId,
      modelId,
      status,
      error,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToModelConfig(result.rows[0]);
  }

  /**
   * Batch update availability for multiple models (e.g., after Ollama discovery).
   */
  async batchUpdateAvailability(
    provider: ModelProvider,
    updates: Array<{ modelId: string; status: ModelAvailabilityStatus; error: string | null }>,
    userId: string | null = null,
    tenantId?: string
  ): Promise<void> {
    if (updates.length === 0) return;

    const tenant = tenantId ?? this.options.defaultTenantId;
    const modelIds = updates.map(u => u.modelId);
    const statuses = updates.map(u => u.status);
    const errors = updates.map(u => u.error ?? '');

    await this.pool.query(BATCH_UPDATE_AUI_MODEL_CONFIGS_AVAILABILITY, [
      tenant,
      userId,
      provider,
      modelIds,
      statuses,
      errors,
    ]);
  }

  /**
   * Enable a model.
   */
  async enableModel(
    modelId: string,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ModelConfig | null> {
    return this.updateConfig(modelId, { isEnabled: true }, userId, tenantId);
  }

  /**
   * Disable a model.
   */
  async disableModel(
    modelId: string,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ModelConfig | null> {
    return this.updateConfig(modelId, { isEnabled: false }, userId, tenantId);
  }

  /**
   * Set default model for a capability.
   */
  async setDefaultForCapability(
    modelId: string,
    capability: ModelCapability,
    userId: string | null = null,
    tenantId?: string
  ): Promise<ModelConfig | null> {
    return this.updateConfig(modelId, { defaultForCapability: capability }, userId, tenantId);
  }

  /**
   * Clear default model for a capability.
   */
  async clearDefaultForCapability(
    capability: ModelCapability,
    userId: string | null = null,
    tenantId?: string
  ): Promise<void> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    await this.pool.query(CLEAR_AUI_MODEL_CONFIG_DEFAULT, [
      tenant,
      userId,
      capability,
      '', // Won't match any model, so all defaults are cleared
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Delete a model configuration.
   */
  async deleteConfig(
    modelId: string,
    userId: string | null = null,
    tenantId?: string
  ): Promise<boolean> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(DELETE_AUI_MODEL_CONFIG, [tenant, userId, modelId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MERGE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Merge a VettedModel with its config overrides.
   *
   * Returns a VettedModel with parameter overrides applied.
   */
  mergeWithVettedModel(model: VettedModel, config: ModelConfig | null): VettedModel {
    if (!config) {
      return model;
    }

    return {
      ...model,
      // Apply config overrides
      configOverrides: {
        ...model.configOverrides,
        ...config.parameterOverrides,
      },
      // Apply display name if set
      description: config.displayName ?? model.description,
    };
  }

  /**
   * Check if a model is enabled for a user.
   *
   * Checks user config first, falls back to system config.
   * Returns true if no config exists (default enabled).
   */
  async isModelEnabled(
    modelId: string,
    userId: string | null = null,
    tenantId?: string
  ): Promise<boolean> {
    const config = await this.getConfig(modelId, userId, tenantId);
    return config?.isEnabled ?? true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Convert database row to ModelConfig.
   */
  private rowToModelConfig(row: Record<string, unknown>): ModelConfig {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string | null,
      modelId: row.model_id as string,
      provider: row.provider as ModelProvider,
      isEnabled: row.is_enabled as boolean,
      defaultForCapability: row.default_for_capability as ModelCapability | null,
      parameterOverrides: (row.parameter_overrides as ModelParameterOverrides) ?? {},
      availabilityStatus: row.availability_status as ModelAvailabilityStatus,
      lastAvailabilityCheck: row.last_availability_check
        ? new Date(row.last_availability_check as string)
        : null,
      availabilityError: row.availability_error as string | null,
      displayName: row.display_name as string | null,
      displayOrder: row.display_order as number,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let _modelConfigService: ModelConfigService | null = null;

/**
 * Initialize the global model config service.
 */
export function initModelConfigService(
  pool: Pool,
  options?: ModelConfigServiceOptions
): ModelConfigService {
  _modelConfigService = new ModelConfigService(pool, options);
  return _modelConfigService;
}

/**
 * Get the global model config service.
 */
export function getModelConfigService(): ModelConfigService | null {
  return _modelConfigService;
}

/**
 * Reset the global model config service.
 */
export function resetModelConfigService(): void {
  _modelConfigService = null;
}
