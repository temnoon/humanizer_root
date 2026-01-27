/**
 * Preferences Service
 *
 * User preferences management for models, prompts, transformations, and UI settings.
 * Supports PRO+ custom prompts feature.
 *
 * @module @humanizer/core/aui/service/preferences-service
 */

import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import {
  GET_AUI_USER_PREFERENCES,
  UPSERT_AUI_USER_PREFERENCES,
} from '../../storage/schema-aui.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ModelPreferences {
  defaultModel?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface TransformationDefaults {
  persona?: string;
  style?: string;
  tone?: string;
  preserveFormatting?: boolean;
}

export interface UiPreferences {
  theme?: 'light' | 'dark' | 'system';
  compactMode?: boolean;
  showTokenCount?: boolean;
  showCost?: boolean;
  editorFontSize?: number;
}

export interface CustomPrompt {
  id: string;
  name: string;
  description?: string;
  template: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  userId: string;
  tenantId: string;
  modelPreferences: ModelPreferences;
  promptCustomizations: Record<string, CustomPrompt>;
  transformationDefaults: TransformationDefaults;
  uiPreferences: UiPreferences;
  updatedAt: Date;
}

export interface PreferencesUpdateInput {
  modelPreferences?: Partial<ModelPreferences>;
  transformationDefaults?: Partial<TransformationDefaults>;
  uiPreferences?: Partial<UiPreferences>;
}

export interface CustomPromptInput {
  name: string;
  description?: string;
  template: string;
  variables?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export class PreferencesService {
  private pool: Pool;
  private defaultTenantId: string;

  constructor(pool: Pool, defaultTenantId = 'humanizer') {
    this.pool = pool;
    this.defaultTenantId = defaultTenantId;
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string, tenantId?: string): Promise<UserPreferences> {
    const tenant = tenantId ?? this.defaultTenantId;

    const result = await this.pool.query(GET_AUI_USER_PREFERENCES, [userId, tenant]);

    if (result.rows.length === 0) {
      // Return defaults
      return {
        userId,
        tenantId: tenant,
        modelPreferences: {},
        promptCustomizations: {},
        transformationDefaults: {},
        uiPreferences: {},
        updatedAt: new Date(),
      };
    }

    const row = result.rows[0];
    return {
      userId: row.user_id,
      tenantId: row.tenant_id,
      modelPreferences: (row.model_preferences as ModelPreferences) ?? {},
      promptCustomizations: (row.prompt_customizations as Record<string, CustomPrompt>) ?? {},
      transformationDefaults: (row.transformation_defaults as TransformationDefaults) ?? {},
      uiPreferences: (row.ui_preferences as UiPreferences) ?? {},
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Update user preferences (merges with existing)
   */
  async updatePreferences(
    userId: string,
    input: PreferencesUpdateInput,
    tenantId?: string
  ): Promise<UserPreferences> {
    const tenant = tenantId ?? this.defaultTenantId;

    // Get existing preferences to merge
    const existing = await this.getPreferences(userId, tenant);

    const mergedModelPrefs = { ...existing.modelPreferences, ...input.modelPreferences };
    const mergedTransformDefaults = { ...existing.transformationDefaults, ...input.transformationDefaults };
    const mergedUiPrefs = { ...existing.uiPreferences, ...input.uiPreferences };

    const result = await this.pool.query(UPSERT_AUI_USER_PREFERENCES, [
      userId,
      tenant,
      JSON.stringify(mergedModelPrefs),
      JSON.stringify(existing.promptCustomizations), // Don't modify prompts here
      JSON.stringify(mergedTransformDefaults),
      JSON.stringify(mergedUiPrefs),
    ]);

    const row = result.rows[0];
    return {
      userId: row.user_id,
      tenantId: row.tenant_id,
      modelPreferences: (row.model_preferences as ModelPreferences) ?? {},
      promptCustomizations: (row.prompt_customizations as Record<string, CustomPrompt>) ?? {},
      transformationDefaults: (row.transformation_defaults as TransformationDefaults) ?? {},
      uiPreferences: (row.ui_preferences as UiPreferences) ?? {},
      updatedAt: new Date(row.updated_at),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOM PROMPTS (PRO+ Feature)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List user's custom prompts
   */
  async listCustomPrompts(userId: string, tenantId?: string): Promise<CustomPrompt[]> {
    const prefs = await this.getPreferences(userId, tenantId);
    return Object.values(prefs.promptCustomizations);
  }

  /**
   * Get a specific custom prompt
   */
  async getCustomPrompt(
    userId: string,
    promptId: string,
    tenantId?: string
  ): Promise<CustomPrompt | null> {
    const prefs = await this.getPreferences(userId, tenantId);
    return prefs.promptCustomizations[promptId] ?? null;
  }

  /**
   * Create a custom prompt
   */
  async createCustomPrompt(
    userId: string,
    input: CustomPromptInput,
    tenantId?: string,
    maxPrompts = 10
  ): Promise<CustomPrompt> {
    const tenant = tenantId ?? this.defaultTenantId;
    const existing = await this.getPreferences(userId, tenant);

    // Check limit
    const currentCount = Object.keys(existing.promptCustomizations).length;
    if (currentCount >= maxPrompts) {
      throw new Error(`Custom prompt limit reached (${maxPrompts})`);
    }

    // Extract variables from template
    const variables = input.variables ?? this.extractVariables(input.template);

    const prompt: CustomPrompt = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      template: input.template,
      variables,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add to prompt customizations
    const updatedPrompts = {
      ...existing.promptCustomizations,
      [prompt.id]: prompt,
    };

    await this.pool.query(UPSERT_AUI_USER_PREFERENCES, [
      userId,
      tenant,
      JSON.stringify(existing.modelPreferences),
      JSON.stringify(updatedPrompts),
      JSON.stringify(existing.transformationDefaults),
      JSON.stringify(existing.uiPreferences),
    ]);

    return prompt;
  }

  /**
   * Update a custom prompt
   */
  async updateCustomPrompt(
    userId: string,
    promptId: string,
    input: Partial<CustomPromptInput>,
    tenantId?: string
  ): Promise<CustomPrompt> {
    const tenant = tenantId ?? this.defaultTenantId;
    const existing = await this.getPreferences(userId, tenant);

    const prompt = existing.promptCustomizations[promptId];
    if (!prompt) {
      throw new Error('Custom prompt not found');
    }

    // Update prompt
    const updated: CustomPrompt = {
      ...prompt,
      name: input.name ?? prompt.name,
      description: input.description ?? prompt.description,
      template: input.template ?? prompt.template,
      variables: input.variables ?? (input.template ? this.extractVariables(input.template) : prompt.variables),
      updatedAt: new Date().toISOString(),
    };

    const updatedPrompts = {
      ...existing.promptCustomizations,
      [promptId]: updated,
    };

    await this.pool.query(UPSERT_AUI_USER_PREFERENCES, [
      userId,
      tenant,
      JSON.stringify(existing.modelPreferences),
      JSON.stringify(updatedPrompts),
      JSON.stringify(existing.transformationDefaults),
      JSON.stringify(existing.uiPreferences),
    ]);

    return updated;
  }

  /**
   * Delete a custom prompt
   */
  async deleteCustomPrompt(userId: string, promptId: string, tenantId?: string): Promise<boolean> {
    const tenant = tenantId ?? this.defaultTenantId;
    const existing = await this.getPreferences(userId, tenant);

    if (!existing.promptCustomizations[promptId]) {
      return false;
    }

    // Remove prompt
    const { [promptId]: _, ...remainingPrompts } = existing.promptCustomizations;

    await this.pool.query(UPSERT_AUI_USER_PREFERENCES, [
      userId,
      tenant,
      JSON.stringify(existing.modelPreferences),
      JSON.stringify(remainingPrompts),
      JSON.stringify(existing.transformationDefaults),
      JSON.stringify(existing.uiPreferences),
    ]);

    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Extract variables from a template string ({{variableName}} format)
   */
  private extractVariables(template: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const vars: string[] = [];
    let match;
    while ((match = regex.exec(template)) !== null) {
      const varName = match[1].trim();
      if (!vars.includes(varName)) {
        vars.push(varName);
      }
    }
    return vars;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let _preferencesService: PreferencesService | null = null;

export function initPreferencesService(pool: Pool, tenantId?: string): PreferencesService {
  _preferencesService = new PreferencesService(pool, tenantId);
  return _preferencesService;
}

export function getPreferencesService(): PreferencesService | null {
  return _preferencesService;
}

export function resetPreferencesService(): void {
  _preferencesService = null;
}
