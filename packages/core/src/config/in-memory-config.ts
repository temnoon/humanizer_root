/**
 * In-Memory Configuration Manager
 *
 * A simple in-memory implementation of ConfigManager for:
 * - Testing
 * - Standalone/Electron apps
 * - Development
 *
 * For production, use DatabaseConfigManager or RemoteConfigManager.
 */

import type {
  ConfigManager,
  ConfigCategory,
  ConfigEntry,
  ConfigValidation,
  ConfigValueType,
  ConfigAuditEntry,
  PromptTemplate,
  CompiledPrompt,
  SetConfigOptions,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════
// IN-MEMORY CONFIG MANAGER
// ═══════════════════════════════════════════════════════════════════

export class InMemoryConfigManager implements ConfigManager {
  private configs: Map<string, ConfigEntry> = new Map();
  private prompts: Map<string, PromptTemplate> = new Map();
  private auditLog: ConfigAuditEntry[] = [];
  private changeListeners: Set<(entry: ConfigEntry, action: 'update' | 'delete') => void> = new Set();
  private currentUser: string = 'system';

  constructor(private options: InMemoryConfigOptions = {}) {
    this.currentUser = options.userId ?? 'system';
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private makeKey(category: ConfigCategory, key: string): string {
    return `${category}:${key}`;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private recordAudit(
    category: ConfigCategory,
    key: string,
    action: 'create' | 'update' | 'delete',
    previousValue: unknown | null,
    newValue: unknown | null,
    reason?: string
  ): void {
    if (this.options.disableAudit) return;

    const entry: ConfigAuditEntry = {
      id: this.generateId(),
      category,
      key,
      action,
      previousValue,
      newValue,
      changedBy: this.currentUser,
      changedAt: Date.now(),
      reason,
      source: 'api',
    };

    this.auditLog.push(entry);

    // Keep audit log bounded
    const maxAuditEntries = this.options.maxAuditEntries ?? 1000;
    if (this.auditLog.length > maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-maxAuditEntries);
    }
  }

  private notifyChange(entry: ConfigEntry, action: 'update' | 'delete'): void {
    for (const listener of this.changeListeners) {
      try {
        listener(entry, action);
      } catch (error) {
        console.error('[ConfigManager] Change listener error:', error);
      }
    }
  }

  private validateValue(value: unknown, validation?: ConfigValidation): void {
    if (!validation) return;

    if (validation.required && (value === undefined || value === null)) {
      throw new Error('Value is required');
    }

    if (typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        throw new Error(`Value ${value} is below minimum ${validation.min}`);
      }
      if (validation.max !== undefined && value > validation.max) {
        throw new Error(`Value ${value} is above maximum ${validation.max}`);
      }
    }

    if (typeof value === 'string') {
      if (validation.minLength !== undefined && value.length < validation.minLength) {
        throw new Error(`String length ${value.length} is below minimum ${validation.minLength}`);
      }
      if (validation.maxLength !== undefined && value.length > validation.maxLength) {
        throw new Error(`String length ${value.length} is above maximum ${validation.maxLength}`);
      }
      if (validation.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          throw new Error(`Value does not match pattern ${validation.pattern}`);
        }
      }
    }

    if (validation.enum && !validation.enum.includes(value)) {
      throw new Error(`Value must be one of: ${validation.enum.join(', ')}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // READ OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  async get<T>(category: ConfigCategory, key: string): Promise<T | undefined> {
    const fullKey = this.makeKey(category, key);
    const entry = this.configs.get(fullKey);
    return entry?.value as T | undefined;
  }

  async getOrDefault<T>(category: ConfigCategory, key: string, defaultValue: T): Promise<T> {
    const value = await this.get<T>(category, key);
    return value ?? defaultValue;
  }

  async getCategory(category: ConfigCategory): Promise<ConfigEntry[]> {
    const entries: ConfigEntry[] = [];
    for (const [key, entry] of this.configs) {
      if (key.startsWith(`${category}:`)) {
        entries.push(entry);
      }
    }
    return entries;
  }

  async getByTag(tag: string): Promise<ConfigEntry[]> {
    const entries: ConfigEntry[] = [];
    for (const entry of this.configs.values()) {
      if (entry.tags?.includes(tag)) {
        entries.push(entry);
      }
    }
    return entries;
  }

  async has(category: ConfigCategory, key: string): Promise<boolean> {
    const fullKey = this.makeKey(category, key);
    return this.configs.has(fullKey);
  }

  // ─────────────────────────────────────────────────────────────────
  // WRITE OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  async set<T>(
    category: ConfigCategory,
    key: string,
    value: T,
    options?: SetConfigOptions
  ): Promise<void> {
    const fullKey = this.makeKey(category, key);
    const existing = this.configs.get(fullKey);

    // Validate if rules provided
    this.validateValue(value, options?.validation ?? existing?.validation);

    const entry: ConfigEntry<T> = {
      key,
      category,
      value,
      valueType: options?.valueType ?? this.inferValueType(value),
      description: options?.description ?? existing?.description,
      defaultValue: existing?.defaultValue as T | undefined,
      encrypted: options?.encrypt ?? existing?.encrypted,
      version: (existing?.version ?? 0) + 1,
      updatedAt: Date.now(),
      updatedBy: this.currentUser,
      tags: options?.tags ?? existing?.tags,
      validation: options?.validation ?? existing?.validation,
    };

    this.configs.set(fullKey, entry as ConfigEntry);

    this.recordAudit(
      category,
      key,
      existing ? 'update' : 'create',
      existing?.value ?? null,
      value,
      options?.reason
    );

    this.notifyChange(entry as ConfigEntry, 'update');
  }

  async delete(category: ConfigCategory, key: string, reason?: string): Promise<void> {
    const fullKey = this.makeKey(category, key);
    const existing = this.configs.get(fullKey);

    if (!existing) return;

    this.configs.delete(fullKey);

    this.recordAudit(category, key, 'delete', existing.value, null, reason);
    this.notifyChange(existing, 'delete');
  }

  async setBulk(entries: Array<{
    category: ConfigCategory;
    key: string;
    value: unknown;
  }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.category, entry.key, entry.value);
    }
  }

  private inferValueType(value: unknown): ConfigValueType {
    if (typeof value === 'string') {
      return value.includes('\n') ? 'prompt' : 'string';
    }
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'json';
  }

  // ─────────────────────────────────────────────────────────────────
  // PROMPT OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  async getPrompt(id: string): Promise<PromptTemplate | undefined> {
    return this.prompts.get(id);
  }

  async compilePrompt(id: string, variables: Record<string, string>): Promise<CompiledPrompt> {
    const template = await this.getPrompt(id);
    if (!template) {
      throw new Error(`Prompt template not found: ${id}`);
    }

    // Check required variables
    for (const required of template.requiredVariables) {
      if (!(required in variables)) {
        throw new Error(`Missing required variable: ${required}`);
      }
    }

    // Merge with optional defaults
    const allVariables = {
      ...template.optionalVariables,
      ...variables,
    };

    // Substitute variables
    let text = template.template;
    for (const [varName, varValue] of Object.entries(allVariables)) {
      text = text.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), varValue);
    }

    return {
      templateId: id,
      text,
      variables: allVariables,
      compiledAt: Date.now(),
    };
  }

  async listPrompts(filter?: { tag?: string; usedBy?: string }): Promise<PromptTemplate[]> {
    let prompts = Array.from(this.prompts.values());

    if (filter?.tag) {
      prompts = prompts.filter(p => p.tags?.includes(filter.tag!));
    }

    if (filter?.usedBy) {
      prompts = prompts.filter(p => p.usedBy?.includes(filter.usedBy!));
    }

    return prompts;
  }

  async savePrompt(template: Omit<PromptTemplate, 'version'>): Promise<void> {
    const existing = this.prompts.get(template.id);
    const fullTemplate: PromptTemplate = {
      ...template,
      version: (existing?.version ?? 0) + 1,
    };

    this.prompts.set(template.id, fullTemplate);

    // Also record in audit
    this.recordAudit(
      'prompts',
      template.id,
      existing ? 'update' : 'create',
      existing?.template ?? null,
      template.template
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // AUDIT OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  async getAuditHistory(
    category: ConfigCategory,
    key: string,
    limit = 50
  ): Promise<ConfigAuditEntry[]> {
    return this.auditLog
      .filter(e => e.category === category && e.key === key)
      .slice(-limit)
      .reverse();
  }

  async getRecentAudit(limit = 50): Promise<ConfigAuditEntry[]> {
    return this.auditLog.slice(-limit).reverse();
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    // Load seed data if provided
    if (this.options.seedData) {
      for (const entry of this.options.seedData) {
        await this.set(entry.category, entry.key, entry.value, {
          description: entry.description,
          valueType: entry.valueType,
          tags: entry.tags,
          validation: entry.validation,
        });
      }
    }

    // Load seed prompts if provided
    if (this.options.seedPrompts) {
      for (const prompt of this.options.seedPrompts) {
        await this.savePrompt(prompt);
      }
    }
  }

  async refresh(): Promise<void> {
    // No-op for in-memory - data is already current
  }

  onConfigChange(
    callback: (entry: ConfigEntry, action: 'update' | 'delete') => void
  ): () => void {
    this.changeListeners.add(callback);
    return () => {
      this.changeListeners.delete(callback);
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // UTILITY METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Set the current user for audit logging
   */
  setCurrentUser(userId: string): void {
    this.currentUser = userId;
  }

  /**
   * Export all configs (for backup/migration)
   */
  exportAll(): { configs: ConfigEntry[]; prompts: PromptTemplate[] } {
    return {
      configs: Array.from(this.configs.values()),
      prompts: Array.from(this.prompts.values()),
    };
  }

  /**
   * Import configs (for restore/migration)
   */
  async importAll(data: { configs: ConfigEntry[]; prompts: PromptTemplate[] }): Promise<void> {
    for (const entry of data.configs) {
      const fullKey = this.makeKey(entry.category, entry.key);
      this.configs.set(fullKey, entry);
    }

    for (const prompt of data.prompts) {
      this.prompts.set(prompt.id, prompt);
    }
  }

  /**
   * Clear all configs (for testing)
   */
  clear(): void {
    this.configs.clear();
    this.prompts.clear();
    this.auditLog = [];
  }
}

export interface InMemoryConfigOptions {
  /** User ID for audit logging */
  userId?: string;

  /** Disable audit logging */
  disableAudit?: boolean;

  /** Maximum audit entries to keep */
  maxAuditEntries?: number;

  /** Seed data to load on initialize */
  seedData?: Array<{
    category: ConfigCategory;
    key: string;
    value: unknown;
    description?: string;
    valueType?: ConfigValueType;
    tags?: string[];
    validation?: ConfigValidation;
  }>;

  /** Seed prompts to load on initialize */
  seedPrompts?: Array<Omit<PromptTemplate, 'version'>>;
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _configManager: ConfigManager | null = null;

/**
 * Get the singleton config manager
 */
export function getConfigManager(): ConfigManager {
  if (!_configManager) {
    _configManager = new InMemoryConfigManager();
  }
  return _configManager;
}

/**
 * Set a custom config manager
 */
export function setConfigManager(manager: ConfigManager): void {
  _configManager = manager;
}

/**
 * Reset the config manager (for testing)
 */
export function resetConfigManager(): void {
  _configManager = null;
}
