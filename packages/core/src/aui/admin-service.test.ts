/**
 * AdminService Tests
 *
 * Unit tests for the administrative capabilities:
 * - Configuration management
 * - Prompt template management
 * - LLM cost tracking
 * - User tier system
 * - Usage analytics
 *
 * @module @humanizer/core/aui/admin-service.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AdminService,
  initAdminService,
  getAdminService,
  resetAdminService,
} from './admin-service.js';
import type {
  UserTier,
  LlmCostEntry,
  CostReportOptions,
  LimitCheckResult,
} from './types.js';
import { DEFAULT_TIERS, MODEL_COST_RATES } from './constants.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK CONFIG MANAGER
// ═══════════════════════════════════════════════════════════════════════════

function createMockConfigManager() {
  const storage = new Map<string, unknown>();
  const prompts = new Map<string, any>();
  const auditLog: any[] = [];

  return {
    // Config operations
    get: vi.fn(async <T>(category: string, key: string): Promise<T | undefined> => {
      return storage.get(`${category}:${key}`) as T | undefined;
    }),

    getOrDefault: vi.fn(async <T>(category: string, key: string, defaultValue: T): Promise<T> => {
      return (storage.get(`${category}:${key}`) as T) ?? defaultValue;
    }),

    set: vi.fn(async <T>(category: string, key: string, value: T, options?: any) => {
      storage.set(`${category}:${key}`, value);
      auditLog.push({
        category,
        key,
        value,
        reason: options?.reason,
        changedAt: Date.now(),
      });
    }),

    getCategory: vi.fn(async (category: string) => {
      const entries: any[] = [];
      for (const [k, v] of storage) {
        if (k.startsWith(`${category}:`)) {
          entries.push({ key: k.split(':')[1], value: v });
        }
      }
      return entries;
    }),

    getAuditHistory: vi.fn(async (category: string, key: string, limit?: number) => {
      return auditLog
        .filter(e => e.category === category && e.key === key)
        .slice(0, limit ?? 10);
    }),

    getRecentAudit: vi.fn(async (limit?: number) => {
      return auditLog.slice(-(limit ?? 50)).reverse();
    }),

    // Prompt operations
    listPrompts: vi.fn(async (filter?: any) => {
      return Array.from(prompts.values());
    }),

    getPrompt: vi.fn(async (id: string) => {
      return prompts.get(id);
    }),

    savePrompt: vi.fn(async (template: any) => {
      prompts.set(template.id, { ...template, version: 1 });
    }),

    compilePrompt: vi.fn(async (id: string, variables: Record<string, string>) => {
      const template = prompts.get(id);
      if (!template) {
        throw new Error(`Prompt "${id}" not found`);
      }
      let text = template.template;
      for (const [key, value] of Object.entries(variables)) {
        text = text.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
      return { text, promptId: id, variables };
    }),

    // Test helpers
    _storage: storage,
    _prompts: prompts,
    _auditLog: auditLog,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN SERVICE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('AdminService', () => {
  let adminService: AdminService;
  let mockConfig: ReturnType<typeof createMockConfigManager>;

  beforeEach(() => {
    resetAdminService();
    mockConfig = createMockConfigManager();
    adminService = new AdminService(mockConfig as any);
  });

  afterEach(() => {
    adminService.reset();
    resetAdminService();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Configuration Management', () => {
    it('gets config value', async () => {
      mockConfig._storage.set('aui:maxSteps', 30);

      const value = await adminService.getConfig<number>('aui', 'maxSteps');
      expect(value).toBe(30);
      expect(mockConfig.get).toHaveBeenCalledWith('aui', 'maxSteps');
    });

    it('gets config with default', async () => {
      const value = await adminService.getConfigOrDefault<number>('aui', 'nonexistent', 10);
      expect(value).toBe(10);
    });

    it('sets config value', async () => {
      await adminService.setConfig('aui', 'temperature', 0.5, { reason: 'Testing' });

      expect(mockConfig.set).toHaveBeenCalledWith('aui', 'temperature', 0.5, {
        reason: 'Testing',
        description: undefined,
      });
    });

    it('lists config in category', async () => {
      mockConfig._storage.set('aui:setting1', 'value1');
      mockConfig._storage.set('aui:setting2', 'value2');

      const entries = await adminService.listConfig('aui');
      expect(entries).toHaveLength(2);
    });

    it('gets config audit history', async () => {
      await adminService.setConfig('aui', 'test', 'value1');
      await adminService.setConfig('aui', 'test', 'value2');

      const audit = await adminService.getConfigAudit('aui');
      expect(audit.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROMPT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Prompt Management', () => {
    beforeEach(() => {
      mockConfig._prompts.set('test-prompt', {
        id: 'test-prompt',
        name: 'Test Prompt',
        template: 'Hello, {{name}}! You are a {{role}}.',
        variables: ['name', 'role'],
      });
    });

    it('lists prompts', async () => {
      const prompts = await adminService.listPrompts();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].id).toBe('test-prompt');
    });

    it('gets prompt by ID', async () => {
      const prompt = await adminService.getPrompt('test-prompt');
      expect(prompt?.name).toBe('Test Prompt');
    });

    it('returns undefined for non-existent prompt', async () => {
      const prompt = await adminService.getPrompt('nonexistent');
      expect(prompt).toBeUndefined();
    });

    it('creates/updates prompt', async () => {
      await adminService.setPrompt({
        id: 'new-prompt',
        name: 'New Prompt',
        template: 'New template',
        variables: [],
      });

      expect(mockConfig.savePrompt).toHaveBeenCalled();
    });

    it('compiles prompt with variables', async () => {
      const compiled = await adminService.compilePrompt('test-prompt', {
        name: 'Alice',
        role: 'curator',
      });

      expect(compiled.text).toBe('Hello, Alice! You are a curator.');
    });

    it('tests prompt with sample input', async () => {
      const result = await adminService.testPrompt('test-prompt', {
        name: 'Bob',
        role: 'reviewer',
      });

      expect(result).toBe('Hello, Bob! You are a reviewer.');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LLM COST TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('LLM Cost Tracking', () => {
    it('records LLM cost entry', () => {
      adminService.recordLlmCost({
        userId: 'user-1',
        model: 'claude-sonnet',
        operation: 'search',
        inputTokens: 1000,
        outputTokens: 500,
        costCents: 5,
        latencyMs: 200,
        success: true,
      });

      const stats = adminService.getStats();
      expect(stats.costEntriesCount).toBe(1);
    });

    it('calculates cost for Claude models', () => {
      // Claude Sonnet: $3/$15 per 1M tokens
      // Rates in MODEL_COST_RATES are per 1M tokens in cents
      // Input: 300 cents per 1M
      // Output: 1500 cents per 1M
      // For 1M input + 1M output: 300 + 1500 = 1800 cents = $18
      const cost = adminService.calculateCost('claude-sonnet', 1_000_000, 1_000_000);
      expect(cost).toBe(1800);
    });

    it('calculates cost for local models as zero', () => {
      const cost = adminService.calculateCost('llama3.2:3b', 1_000_000, 1_000_000);
      expect(cost).toBe(0);
    });

    it('uses default rates for unknown models', () => {
      const cost = adminService.calculateCost('unknown-model', 1_000_000, 1_000_000);
      expect(cost).toBeGreaterThan(0);
    });

    it('generates cost report', async () => {
      // Record some entries
      adminService.recordLlmCost({
        userId: 'user-1',
        model: 'claude-sonnet',
        operation: 'search',
        inputTokens: 1000,
        outputTokens: 500,
        costCents: 5,
        latencyMs: 200,
        success: true,
      });

      adminService.recordLlmCost({
        userId: 'user-1',
        model: 'claude-haiku',
        operation: 'transform',
        inputTokens: 500,
        outputTokens: 200,
        costCents: 2,
        latencyMs: 100,
        success: true,
      });

      const report = await adminService.getCostReport({
        startDate: new Date(Date.now() - 86400000),
      });

      expect(report.totalRequests).toBe(2);
      expect(report.totalCostCents).toBe(7);
      expect(report.byModel.size).toBe(2);
    });

    it('filters cost report by user', async () => {
      adminService.recordLlmCost({
        userId: 'user-1',
        model: 'claude-sonnet',
        operation: 'search',
        inputTokens: 1000,
        outputTokens: 500,
        costCents: 5,
        latencyMs: 200,
        success: true,
      });

      adminService.recordLlmCost({
        userId: 'user-2',
        model: 'claude-sonnet',
        operation: 'search',
        inputTokens: 1000,
        outputTokens: 500,
        costCents: 5,
        latencyMs: 200,
        success: true,
      });

      const report = await adminService.getCostReport({
        startDate: new Date(Date.now() - 86400000),
        userId: 'user-1',
      });

      expect(report.totalRequests).toBe(1);
    });

    it('groups cost by period', async () => {
      adminService.recordLlmCost({
        model: 'claude-sonnet',
        operation: 'search',
        inputTokens: 1000,
        outputTokens: 500,
        costCents: 5,
        latencyMs: 200,
        success: true,
      });

      const report = await adminService.getCostReport({
        startDate: new Date(Date.now() - 86400000),
        groupBy: 'day',
      });

      expect(report.byPeriod.size).toBe(1);
    });

    it('disables cost tracking when configured', () => {
      const disabledService = new AdminService(mockConfig as any, {
        enableCostTracking: false,
      });

      disabledService.recordLlmCost({
        model: 'claude-sonnet',
        operation: 'search',
        inputTokens: 1000,
        outputTokens: 500,
        costCents: 5,
        latencyMs: 200,
        success: true,
      });

      expect(disabledService.getStats().costEntriesCount).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // USER TIER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('User Tier Management', () => {
    it('initializes with default tiers', async () => {
      const tiers = await adminService.listTiers();
      expect(tiers.length).toBeGreaterThan(0);
      expect(tiers.some(t => t.id === 'free')).toBe(true);
      expect(tiers.some(t => t.id === 'pro')).toBe(true);
    });

    it('gets tier by ID', async () => {
      const freeTier = await adminService.getTier('free');
      expect(freeTier?.name).toBe('Free');
      expect(freeTier?.limits.tokensPerDay).toBe(10_000);
    });

    it('returns undefined for non-existent tier', async () => {
      const tier = await adminService.getTier('nonexistent');
      expect(tier).toBeUndefined();
    });

    it('creates/updates tier', async () => {
      await adminService.setTier({
        id: 'custom',
        name: 'Custom Tier',
        description: 'A custom tier',
        limits: {
          tokensPerDay: 50_000,
          tokensPerMonth: 500_000,
          requestsPerMinute: 30,
          maxBufferSizeMb: 50,
          maxBranches: 5,
          maxHistoryDepth: 50,
          maxConcurrentTasks: 2,
          maxSearchResults: 100,
          allowedModels: ['llama3.2:3b'],
          maxUploadSizeMb: 50,
        },
        features: ['basic_search'],
        priority: 2,
        isPublic: true,
      });

      const tier = await adminService.getTier('custom');
      expect(tier?.name).toBe('Custom Tier');
    });

    it('deletes tier', async () => {
      await adminService.setTier({
        id: 'deletable',
        name: 'Deletable',
        description: 'Will be deleted',
        limits: DEFAULT_TIERS.free.limits as any,
        features: [],
        priority: 5,
        isPublic: false,
      });

      const deleted = await adminService.deleteTier('deletable');
      expect(deleted).toBe(true);

      const tier = await adminService.getTier('deletable');
      expect(tier).toBeUndefined();
    });

    it('cannot delete free tier', async () => {
      await expect(adminService.deleteTier('free')).rejects.toThrow('Cannot delete');
    });

    it('gets user tier (default for new user)', async () => {
      const tier = await adminService.getUserTier('new-user');
      expect(tier.id).toBe('free');
    });

    it('sets user tier', async () => {
      await adminService.setUserTier('user-1', 'pro');
      const tier = await adminService.getUserTier('user-1');
      expect(tier.id).toBe('pro');
    });

    it('throws when setting non-existent tier', async () => {
      await expect(adminService.setUserTier('user-1', 'nonexistent'))
        .rejects.toThrow('not found');
    });

    it('checks if model is allowed for tier', async () => {
      const freeTier = await adminService.getTier('free');
      expect(adminService.isModelAllowed(freeTier!, 'llama3.2:3b')).toBe(true);
      expect(adminService.isModelAllowed(freeTier!, 'claude-opus')).toBe(false);

      const enterpriseTier = await adminService.getTier('enterprise');
      expect(adminService.isModelAllowed(enterpriseTier!, 'claude-opus')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // USAGE TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Usage Tracking', () => {
    it('records usage for user', () => {
      adminService.recordUsage('user-1', 1000, 'claude-sonnet', 5);

      const stats = adminService.getStats();
      expect(stats.usageRecordsCount).toBeGreaterThan(0);
    });

    it('updates usage on LLM cost recording', () => {
      adminService.recordLlmCost({
        userId: 'user-1',
        model: 'claude-sonnet',
        operation: 'search',
        inputTokens: 1000,
        outputTokens: 500,
        costCents: 5,
        latencyMs: 200,
        success: true,
      });

      // Usage should be tracked
      const stats = adminService.getStats();
      expect(stats.usageRecordsCount).toBeGreaterThan(0);
    });

    it('gets user usage for day', async () => {
      adminService.recordLlmCost({
        userId: 'user-1',
        model: 'claude-sonnet',
        operation: 'search',
        inputTokens: 1000,
        outputTokens: 500,
        costCents: 5,
        latencyMs: 200,
        success: true,
      });

      const usage = await adminService.getUsage('user-1', 'day');

      expect(usage.tokensUsed).toBe(1500);
      expect(usage.requestsCount).toBe(1);
      expect(usage.costAccruedCents).toBe(5);
    });

    it('tracks usage by model', async () => {
      adminService.recordLlmCost({
        userId: 'user-1',
        model: 'claude-sonnet',
        operation: 'search',
        inputTokens: 1000,
        outputTokens: 500,
        costCents: 5,
        latencyMs: 200,
        success: true,
      });

      const usage = await adminService.getUsage('user-1', 'day');

      expect(usage.byModel.has('claude-sonnet')).toBe(true);
      const modelUsage = usage.byModel.get('claude-sonnet')!;
      expect(modelUsage.inputTokens).toBe(1000);
      expect(modelUsage.outputTokens).toBe(500);
    });

    it('tracks usage by operation', async () => {
      adminService.recordLlmCost({
        userId: 'user-1',
        model: 'claude-sonnet',
        operation: 'transform',
        inputTokens: 1000,
        outputTokens: 500,
        costCents: 5,
        latencyMs: 200,
        success: true,
      });

      const usage = await adminService.getUsage('user-1', 'day');

      expect(usage.byOperation.has('transform')).toBe(true);
      const opUsage = usage.byOperation.get('transform')!;
      expect(opUsage.count).toBe(1);
    });

    it('checks user limits', async () => {
      // Record usage below limit
      adminService.recordLlmCost({
        userId: 'user-1',
        model: 'llama3.2:3b',
        operation: 'search',
        inputTokens: 5000,
        outputTokens: 2000,
        costCents: 0,
        latencyMs: 100,
        success: true,
      });

      const result = await adminService.checkLimits('user-1');

      expect(result.withinLimits).toBe(true);
      expect(result.tier.id).toBe('free');
    });

    it('detects exceeded limits', async () => {
      // Record usage exceeding free tier limit (10,000 tokens/day)
      for (let i = 0; i < 12; i++) {
        adminService.recordLlmCost({
          userId: 'user-2',
          model: 'llama3.2:3b',
          operation: 'search',
          inputTokens: 1000,
          outputTokens: 500,
          costCents: 0,
          latencyMs: 100,
          success: true,
        });
      }

      const result = await adminService.checkLimits('user-2');

      expect(result.withinLimits).toBe(false);
      expect(result.exceededLimits.length).toBeGreaterThan(0);
      expect(result.exceededLimits[0].limit).toBe('tokensPerDay');
    });

    it('generates warnings approaching limits', async () => {
      // Use 85% of daily limit (8,500 of 10,000)
      adminService.recordLlmCost({
        userId: 'user-3',
        model: 'llama3.2:3b',
        operation: 'search',
        inputTokens: 6000,
        outputTokens: 2500,
        costCents: 0,
        latencyMs: 100,
        success: true,
      });

      const result = await adminService.checkLimits('user-3');

      expect(result.withinLimits).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('Approaching');
    });

    it('generates usage report', async () => {
      adminService.recordLlmCost({
        userId: 'user-1',
        model: 'claude-sonnet',
        operation: 'search',
        inputTokens: 1000,
        outputTokens: 500,
        costCents: 5,
        latencyMs: 200,
        success: true,
      });

      const report = await adminService.getUsageReport({
        startDate: new Date(Date.now() - 86400000),
      });

      expect(report.totalUsers).toBeGreaterThanOrEqual(1);
      expect(report.totalTokens).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTICS & UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Statistics & Utilities', () => {
    it('returns service statistics', () => {
      const stats = adminService.getStats();

      expect(stats).toHaveProperty('costEntriesCount');
      expect(stats).toHaveProperty('usageRecordsCount');
      expect(stats).toHaveProperty('tierCount');
      expect(stats).toHaveProperty('userTierMappings');
    });

    it('resets all data', () => {
      adminService.recordLlmCost({
        model: 'claude-sonnet',
        operation: 'search',
        inputTokens: 1000,
        outputTokens: 500,
        costCents: 5,
        latencyMs: 200,
        success: true,
      });

      adminService.reset();

      const stats = adminService.getStats();
      expect(stats.costEntriesCount).toBe(0);
      expect(stats.usageRecordsCount).toBe(0);
    });

    it('preserves default tiers after reset', async () => {
      adminService.reset();

      const tiers = await adminService.listTiers();
      expect(tiers.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLETON MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Singleton Management', () => {
    beforeEach(() => {
      resetAdminService();
    });

    it('initializes global admin service', () => {
      const svc = initAdminService(mockConfig as any);
      expect(svc).toBeInstanceOf(AdminService);
    });

    it('gets global admin service', () => {
      initAdminService(mockConfig as any);
      const svc = getAdminService();
      expect(svc).toBeInstanceOf(AdminService);
    });

    it('returns null before initialization', () => {
      const svc = getAdminService();
      expect(svc).toBeNull();
    });

    it('resets global admin service', () => {
      initAdminService(mockConfig as any);
      resetAdminService();
      expect(getAdminService()).toBeNull();
    });
  });
});
