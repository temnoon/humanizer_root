/**
 * Admin Service
 *
 * Administrative capabilities for the AUI system:
 * - Configuration management
 * - Prompt template management
 * - LLM cost tracking
 * - User tier system
 * - Usage analytics
 *
 * @module @humanizer/core/aui/admin-service
 */

import { randomUUID } from 'crypto';
import type {
  UserTier,
  TierLimits,
  UserUsage,
  ModelUsage,
  OperationUsage,
  LlmCostEntry,
  CostReportOptions,
  CostReport,
  ModelCost,
  PeriodCost,
  LimitCheckResult,
  ExceededLimit,
  LimitWarning,
  UsageReportOptions,
  UsageReport,
  UsageBreakdown,
  AdminServiceOptions,
} from './types.js';
import type {
  ConfigManager,
  PromptTemplate,
  CompiledPrompt,
  ConfigEntry,
  ConfigCategory,
  ConfigAuditEntry,
} from '../config/types.js';
import { AUI_DEFAULTS, DEFAULT_TIERS, MODEL_COST_RATES, OPERATION_TYPES } from './constants.js';
import { getModelRegistry } from '../models/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * AdminService provides administrative capabilities for the AUI system.
 */
export class AdminService {
  private configManager: ConfigManager;
  private costEntries: LlmCostEntry[] = [];
  private userUsage: Map<string, UserUsage> = new Map();
  private userTiers: Map<string, string> = new Map(); // userId -> tierId
  private tiers: Map<string, UserTier> = new Map();
  private options: AdminServiceOptions;

  constructor(configManager: ConfigManager, options?: AdminServiceOptions) {
    this.configManager = configManager;
    this.options = {
      enableCostTracking: options?.enableCostTracking ?? true,
      costRetentionDays: options?.costRetentionDays ?? AUI_DEFAULTS.costRetentionDays,
      usageRetentionDays: options?.usageRetentionDays ?? AUI_DEFAULTS.usageRetentionDays,
      defaultTierId: options?.defaultTierId ?? AUI_DEFAULTS.defaultTier,
    };

    // Initialize default tiers
    this.initializeDefaultTiers();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get config value by category and key.
   */
  async getConfig<T>(category: ConfigCategory, key: string): Promise<T | undefined> {
    return this.configManager.get<T>(category, key);
  }

  /**
   * Get config value with default.
   */
  async getConfigOrDefault<T>(category: ConfigCategory, key: string, defaultValue: T): Promise<T> {
    return this.configManager.getOrDefault<T>(category, key, defaultValue);
  }

  /**
   * Set config value.
   */
  async setConfig<T>(
    category: ConfigCategory,
    key: string,
    value: T,
    options?: { reason?: string; description?: string }
  ): Promise<void> {
    await this.configManager.set(category, key, value, {
      reason: options?.reason,
      description: options?.description,
    });
  }

  /**
   * List all config in a category.
   */
  async listConfig(category: ConfigCategory): Promise<ConfigEntry[]> {
    return this.configManager.getCategory(category);
  }

  /**
   * Get config audit history.
   */
  async getConfigAudit(category?: ConfigCategory, limit?: number): Promise<ConfigAuditEntry[]> {
    if (category) {
      // Get audit for all keys in category
      const entries = await this.configManager.getCategory(category);
      const audits: ConfigAuditEntry[] = [];
      for (const entry of entries) {
        const history = await this.configManager.getAuditHistory(category, entry.key, limit);
        audits.push(...history);
      }
      return audits.sort((a, b) => b.changedAt - a.changedAt).slice(0, limit ?? 50);
    }
    return this.configManager.getRecentAudit(limit ?? 50);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROMPT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List all prompt templates.
   */
  async listPrompts(filter?: { tag?: string; usedBy?: string }): Promise<PromptTemplate[]> {
    return this.configManager.listPrompts(filter);
  }

  /**
   * Get prompt by ID.
   */
  async getPrompt(id: string): Promise<PromptTemplate | undefined> {
    return this.configManager.getPrompt(id);
  }

  /**
   * Update or create prompt.
   */
  async setPrompt(template: Omit<PromptTemplate, 'version'>): Promise<void> {
    await this.configManager.savePrompt(template);
  }

  /**
   * Compile prompt with variables.
   */
  async compilePrompt(id: string, variables: Record<string, string>): Promise<CompiledPrompt> {
    return this.configManager.compilePrompt(id, variables);
  }

  /**
   * Test prompt with sample input.
   */
  async testPrompt(id: string, testVariables: Record<string, string>): Promise<string> {
    const compiled = await this.configManager.compilePrompt(id, testVariables);
    return compiled.text;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LLM COST TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record an LLM interaction.
   */
  recordLlmCost(entry: Omit<LlmCostEntry, 'id' | 'timestamp'>): void {
    if (!this.options.enableCostTracking) return;

    const fullEntry: LlmCostEntry = {
      id: randomUUID(),
      timestamp: Date.now(),
      ...entry,
    };

    this.costEntries.push(fullEntry);

    // Update user usage if userId provided
    if (entry.userId) {
      this.updateUserUsage(entry.userId, entry.model, entry.operation, {
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        costCents: entry.costCents,
      });
    }

    // Prune old entries periodically
    if (this.costEntries.length % 1000 === 0) {
      this.pruneCostEntries();
    }
  }

  /**
   * Calculate cost for token usage.
   * Uses ModelRegistry for cost lookup, falling back to MODEL_COST_RATES.
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Try ModelRegistry first (costPer1kTokens in dollars)
    try {
      const registry = getModelRegistry();
      const rates = registry.getCostSync?.(model);
      if (rates) {
        // Registry costs are per 1K tokens in dollars
        const inputCost = (inputTokens / 1000) * rates.input;
        const outputCost = (outputTokens / 1000) * rates.output;
        return Math.round((inputCost + outputCost) * 100) / 100;
      }
    } catch {
      // Registry not available, fall through to legacy lookup
    }

    // Fallback to legacy MODEL_COST_RATES (per 1M tokens in cents)
    const rates = MODEL_COST_RATES[model as keyof typeof MODEL_COST_RATES]
      ?? MODEL_COST_RATES.default;

    const inputCost = (inputTokens / 1_000_000) * rates.input;
    const outputCost = (outputTokens / 1_000_000) * rates.output;

    return Math.round((inputCost + outputCost) * 100) / 100; // Round to 2 decimals
  }

  /**
   * Get cost report for time period.
   */
  async getCostReport(options: CostReportOptions): Promise<CostReport> {
    const startTime = options.startDate.getTime();
    const endTime = options.endDate?.getTime() ?? Date.now();

    // Filter entries
    let entries = this.costEntries.filter(e =>
      e.timestamp >= startTime && e.timestamp <= endTime
    );

    if (options.userId) {
      entries = entries.filter(e => e.userId === options.userId);
    }
    if (options.model) {
      entries = entries.filter(e => e.model === options.model);
    }
    if (options.operation) {
      entries = entries.filter(e => e.operation === options.operation);
    }

    // Calculate totals
    let totalCostCents = 0;
    let totalTokens = 0;
    let totalRequests = 0;

    const byModel = new Map<string, ModelCost>();
    const byOperation = new Map<string, number>();
    const byPeriod = new Map<string, PeriodCost>();

    for (const entry of entries) {
      totalCostCents += entry.costCents;
      totalTokens += entry.inputTokens + entry.outputTokens;
      totalRequests++;

      // By model
      if (!byModel.has(entry.model)) {
        byModel.set(entry.model, {
          model: entry.model,
          inputTokens: 0,
          outputTokens: 0,
          requests: 0,
          costCents: 0,
          avgLatencyMs: 0,
          errorRate: 0,
        });
      }
      const modelCost = byModel.get(entry.model)!;
      modelCost.inputTokens += entry.inputTokens;
      modelCost.outputTokens += entry.outputTokens;
      modelCost.requests++;
      modelCost.costCents += entry.costCents;
      modelCost.avgLatencyMs += entry.latencyMs;
      if (!entry.success) {
        modelCost.errorRate += 1;
      }

      // By operation
      byOperation.set(entry.operation, (byOperation.get(entry.operation) ?? 0) + entry.costCents);

      // By period
      const periodKey = this.getPeriodKey(entry.timestamp, options.groupBy ?? 'day');
      if (!byPeriod.has(periodKey)) {
        byPeriod.set(periodKey, {
          period: periodKey,
          costCents: 0,
          tokens: 0,
          requests: 0,
        });
      }
      const periodCost = byPeriod.get(periodKey)!;
      periodCost.costCents += entry.costCents;
      periodCost.tokens += entry.inputTokens + entry.outputTokens;
      periodCost.requests++;
    }

    // Calculate averages and rates
    for (const modelCost of byModel.values()) {
      if (modelCost.requests > 0) {
        modelCost.avgLatencyMs = Math.round(modelCost.avgLatencyMs / modelCost.requests);
        modelCost.errorRate = modelCost.errorRate / modelCost.requests;
      }
    }

    return {
      period: { start: options.startDate, end: options.endDate ?? new Date() },
      totalCostCents,
      totalTokens,
      totalRequests,
      byModel,
      byOperation,
      byPeriod,
      entries: options.includeDetails ? entries : undefined,
    };
  }

  /**
   * Get cost by model for time period.
   */
  async getCostByModel(startDate: Date, endDate?: Date): Promise<Map<string, ModelCost>> {
    const report = await this.getCostReport({ startDate, endDate });
    return report.byModel;
  }

  /**
   * Get cost by operation for time period.
   */
  async getCostByOperation(startDate: Date, endDate?: Date): Promise<Map<string, number>> {
    const report = await this.getCostReport({ startDate, endDate });
    return report.byOperation;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER TIER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List all tiers.
   */
  async listTiers(): Promise<UserTier[]> {
    return Array.from(this.tiers.values())
      .filter(t => t.isPublic)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get tier by ID.
   */
  async getTier(tierId: string): Promise<UserTier | undefined> {
    return this.tiers.get(tierId);
  }

  /**
   * Create or update tier.
   */
  async setTier(tier: UserTier): Promise<void> {
    this.tiers.set(tier.id, tier);
  }

  /**
   * Delete a tier.
   */
  async deleteTier(tierId: string): Promise<boolean> {
    if (tierId === 'free') {
      throw new Error('Cannot delete the free tier');
    }
    return this.tiers.delete(tierId);
  }

  /**
   * Get user's current tier.
   */
  async getUserTier(userId: string): Promise<UserTier> {
    const tierId = this.userTiers.get(userId) ?? this.options.defaultTierId;
    const tier = this.tiers.get(tierId!);
    if (!tier) {
      return this.tiers.get('free')!;
    }
    return tier;
  }

  /**
   * Set user's tier.
   */
  async setUserTier(userId: string, tierId: string): Promise<void> {
    if (!this.tiers.has(tierId)) {
      throw new Error(`Tier "${tierId}" not found`);
    }
    this.userTiers.set(userId, tierId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USAGE TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record usage for a user.
   */
  recordUsage(userId: string, tokens: number, model: string, costCents: number): void {
    this.updateUserUsage(userId, model, 'general', {
      inputTokens: tokens,
      outputTokens: 0,
      costCents,
    });
  }

  /**
   * Get usage for user in time period.
   */
  async getUsage(userId: string, period: 'day' | 'month' = 'day'): Promise<UserUsage> {
    const periodKey = this.getCurrentPeriodKey(period);
    const usageKey = `${userId}:${periodKey}`;

    let usage = this.userUsage.get(usageKey);
    if (!usage) {
      const tier = await this.getUserTier(userId);
      usage = this.createEmptyUsage(userId, tier.id, periodKey);
      this.userUsage.set(usageKey, usage);
    }

    return usage;
  }

  /**
   * Check if user is within limits.
   */
  async checkLimits(userId: string): Promise<LimitCheckResult> {
    const tier = await this.getUserTier(userId);
    const dayUsage = await this.getUsage(userId, 'day');
    const monthUsage = await this.getUsage(userId, 'month');

    const exceededLimits: ExceededLimit[] = [];
    const warnings: LimitWarning[] = [];

    // Check daily token limit
    if (dayUsage.tokensUsed > tier.limits.tokensPerDay) {
      exceededLimits.push({
        limit: 'tokensPerDay',
        current: dayUsage.tokensUsed,
        maximum: tier.limits.tokensPerDay,
        percentOver: ((dayUsage.tokensUsed - tier.limits.tokensPerDay) / tier.limits.tokensPerDay) * 100,
      });
    } else if (dayUsage.tokensUsed > tier.limits.tokensPerDay * 0.8) {
      warnings.push({
        limit: 'tokensPerDay',
        percentUsed: (dayUsage.tokensUsed / tier.limits.tokensPerDay) * 100,
        message: 'Approaching daily token limit',
      });
    }

    // Check monthly token limit
    if (monthUsage.tokensUsed > tier.limits.tokensPerMonth) {
      exceededLimits.push({
        limit: 'tokensPerMonth',
        current: monthUsage.tokensUsed,
        maximum: tier.limits.tokensPerMonth,
        percentOver: ((monthUsage.tokensUsed - tier.limits.tokensPerMonth) / tier.limits.tokensPerMonth) * 100,
      });
    } else if (monthUsage.tokensUsed > tier.limits.tokensPerMonth * 0.8) {
      warnings.push({
        limit: 'tokensPerMonth',
        percentUsed: (monthUsage.tokensUsed / tier.limits.tokensPerMonth) * 100,
        message: 'Approaching monthly token limit',
      });
    }

    return {
      withinLimits: exceededLimits.length === 0,
      exceededLimits,
      currentUsage: dayUsage,
      tier,
      warnings,
    };
  }

  /**
   * Get usage report (admin view).
   */
  async getUsageReport(options: UsageReportOptions): Promise<UsageReport> {
    const startTime = options.startDate.getTime();
    const endTime = options.endDate?.getTime() ?? Date.now();

    // Get all users with usage in the period
    const userSet = new Set<string>();
    const breakdown = new Map<string, UsageBreakdown>();

    for (const [key, usage] of this.userUsage.entries()) {
      if (usage.updatedAt >= startTime && usage.updatedAt <= endTime) {
        userSet.add(usage.userId);

        // Group by the specified field
        let groupKey: string;
        switch (options.groupBy) {
          case 'tier':
            groupKey = usage.tierId;
            break;
          case 'model':
            // Aggregate across all models
            for (const [model, modelUsage] of usage.byModel) {
              if (!breakdown.has(model)) {
                breakdown.set(model, { key: model, users: 0, tokens: 0, costCents: 0, requests: 0 });
              }
              const b = breakdown.get(model)!;
              b.tokens += modelUsage.inputTokens + modelUsage.outputTokens;
              b.costCents += modelUsage.costCents;
              b.requests += modelUsage.requests;
            }
            continue;
          case 'operation':
            for (const [op, opUsage] of usage.byOperation) {
              if (!breakdown.has(op)) {
                breakdown.set(op, { key: op, users: 0, tokens: 0, costCents: 0, requests: 0 });
              }
              const b = breakdown.get(op)!;
              b.tokens += opUsage.tokens;
              b.costCents += opUsage.costCents;
              b.requests += opUsage.count;
            }
            continue;
          default:
            groupKey = usage.userId;
        }

        if (!breakdown.has(groupKey)) {
          breakdown.set(groupKey, { key: groupKey, users: 0, tokens: 0, costCents: 0, requests: 0 });
        }
        const b = breakdown.get(groupKey)!;
        b.users++;
        b.tokens += usage.tokensUsed;
        b.costCents += usage.costAccruedCents;
        b.requests += usage.requestsCount;
      }
    }

    // Calculate unique users per group for model/operation grouping
    if (options.groupBy === 'model' || options.groupBy === 'operation') {
      for (const b of breakdown.values()) {
        b.users = userSet.size; // All users contribute
      }
    }

    // Calculate totals
    let totalTokens = 0;
    let totalCostCents = 0;
    for (const b of breakdown.values()) {
      totalTokens += b.tokens;
      totalCostCents += b.costCents;
    }

    return {
      period: { start: options.startDate, end: options.endDate ?? new Date() },
      totalUsers: userSet.size,
      activeUsers: userSet.size,
      totalTokens,
      totalCostCents,
      breakdown,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize default tiers.
   */
  private initializeDefaultTiers(): void {
    for (const [id, tier] of Object.entries(DEFAULT_TIERS)) {
      this.tiers.set(id, tier as UserTier);
    }
  }

  /**
   * Update user usage.
   */
  private updateUserUsage(
    userId: string,
    model: string,
    operation: string,
    data: { inputTokens: number; outputTokens: number; costCents: number }
  ): void {
    // Update daily usage
    const dayKey = this.getCurrentPeriodKey('day');
    const dayUsageKey = `${userId}:${dayKey}`;
    let dayUsage = this.userUsage.get(dayUsageKey);
    if (!dayUsage) {
      const tierId = this.userTiers.get(userId) ?? this.options.defaultTierId ?? 'free';
      dayUsage = this.createEmptyUsage(userId, tierId, dayKey);
      this.userUsage.set(dayUsageKey, dayUsage);
    }

    dayUsage.tokensUsed += data.inputTokens + data.outputTokens;
    dayUsage.requestsCount++;
    dayUsage.costAccruedCents += data.costCents;
    dayUsage.updatedAt = Date.now();

    // Update by model
    if (!dayUsage.byModel.has(model)) {
      dayUsage.byModel.set(model, {
        model,
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
        costCents: 0,
        avgLatencyMs: 0,
      });
    }
    const modelUsage = dayUsage.byModel.get(model)!;
    modelUsage.inputTokens += data.inputTokens;
    modelUsage.outputTokens += data.outputTokens;
    modelUsage.requests++;
    modelUsage.costCents += data.costCents;

    // Update by operation
    if (!dayUsage.byOperation.has(operation)) {
      dayUsage.byOperation.set(operation, {
        operation,
        count: 0,
        tokens: 0,
        costCents: 0,
      });
    }
    const opUsage = dayUsage.byOperation.get(operation)!;
    opUsage.count++;
    opUsage.tokens += data.inputTokens + data.outputTokens;
    opUsage.costCents += data.costCents;

    // Also update monthly usage
    const monthKey = this.getCurrentPeriodKey('month');
    const monthUsageKey = `${userId}:${monthKey}`;
    let monthUsage = this.userUsage.get(monthUsageKey);
    if (!monthUsage) {
      const tierId = this.userTiers.get(userId) ?? this.options.defaultTierId ?? 'free';
      monthUsage = this.createEmptyUsage(userId, tierId, monthKey);
      this.userUsage.set(monthUsageKey, monthUsage);
    }

    monthUsage.tokensUsed += data.inputTokens + data.outputTokens;
    monthUsage.requestsCount++;
    monthUsage.costAccruedCents += data.costCents;
    monthUsage.updatedAt = Date.now();
  }

  /**
   * Create empty usage record.
   */
  private createEmptyUsage(userId: string, tierId: string, period: string): UserUsage {
    return {
      userId,
      tierId,
      period,
      tokensUsed: 0,
      requestsCount: 0,
      costAccruedCents: 0,
      byModel: new Map(),
      byOperation: new Map(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Get period key for a timestamp.
   */
  private getPeriodKey(timestamp: number, groupBy: 'day' | 'week' | 'month'): string {
    const date = new Date(timestamp);
    switch (groupBy) {
      case 'day':
        return date.toISOString().split('T')[0];
      case 'week': {
        // Get start of week (Sunday)
        const d = new Date(date);
        d.setDate(d.getDate() - d.getDay());
        return d.toISOString().split('T')[0];
      }
      case 'month':
        return date.toISOString().substring(0, 7); // YYYY-MM
    }
  }

  /**
   * Get current period key.
   */
  private getCurrentPeriodKey(period: 'day' | 'month'): string {
    const now = new Date();
    if (period === 'day') {
      return now.toISOString().split('T')[0];
    }
    return now.toISOString().substring(0, 7);
  }

  /**
   * Prune old cost entries.
   */
  private pruneCostEntries(): void {
    const cutoff = Date.now() - (this.options.costRetentionDays! * 24 * 60 * 60 * 1000);
    this.costEntries = this.costEntries.filter(e => e.timestamp >= cutoff);
  }

  /**
   * Check if model is allowed for tier.
   */
  isModelAllowed(tier: UserTier, model: string): boolean {
    if (tier.limits.allowedModels.includes('*')) {
      return true;
    }
    return tier.limits.allowedModels.includes(model);
  }

  /**
   * Get statistics about the admin service.
   */
  getStats(): {
    costEntriesCount: number;
    usageRecordsCount: number;
    tierCount: number;
    userTierMappings: number;
  } {
    return {
      costEntriesCount: this.costEntries.length,
      usageRecordsCount: this.userUsage.size,
      tierCount: this.tiers.size,
      userTierMappings: this.userTiers.size,
    };
  }

  /**
   * Clear all data (for testing).
   */
  reset(): void {
    this.costEntries = [];
    this.userUsage.clear();
    this.userTiers.clear();
    this.initializeDefaultTiers();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let _adminService: AdminService | null = null;

/**
 * Initialize the global admin service.
 */
export function initAdminService(
  configManager: ConfigManager,
  options?: AdminServiceOptions
): AdminService {
  _adminService = new AdminService(configManager, options);
  return _adminService;
}

/**
 * Get the global admin service.
 */
export function getAdminService(): AdminService | null {
  return _adminService;
}

/**
 * Reset the global admin service.
 */
export function resetAdminService(): void {
  _adminService = null;
}
