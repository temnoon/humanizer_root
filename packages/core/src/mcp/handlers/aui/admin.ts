/**
 * AUI Admin Handlers
 *
 * MCP handlers for admin operations: config, prompts, costs, usage, and tiers.
 *
 * @module @humanizer/core/mcp/handlers/aui/admin
 */

import type { MCPResult } from '../../types.js';
import { jsonResult, errorResult, getService } from './helpers.js';

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN CONFIG HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAdminConfigGet(args: {
  category: string;
  key: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const value = await service.getConfig(args.category, args.key);
    return jsonResult({ category: args.category, key: args.key, value });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminConfigSet(args: {
  category: string;
  key: string;
  value: string;
  reason?: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const parsedValue = JSON.parse(args.value);
    await service.setConfig(args.category, args.key, parsedValue);
    return jsonResult({ success: true, category: args.category, key: args.key });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminConfigList(args: {
  category: string;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../../aui/admin-service.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }
    const entries = await admin.listConfig(args.category as any);
    return jsonResult({
      category: args.category,
      entries: entries.map(e => ({ key: e.key, value: e.value })),
      count: entries.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminConfigAudit(args: {
  category?: string;
  limit?: number;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../../aui/admin-service.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }
    const entries = await admin.getConfigAudit(args.category as any, args.limit);
    return jsonResult({
      entries: entries.slice(0, args.limit ?? 50),
      count: entries.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN PROMPT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAdminPromptList(args: {
  tag?: string;
  usedBy?: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const prompts = await service.listPrompts();
    return jsonResult({
      prompts: prompts.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        requiredVariables: p.requiredVariables,
      })),
      count: prompts.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminPromptGet(args: {
  id: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const prompt = await service.getPrompt(args.id);
    if (!prompt) {
      return errorResult(`Prompt "${args.id}" not found`);
    }
    return jsonResult(prompt);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminPromptSet(args: {
  id: string;
  name: string;
  template: string;
  description?: string;
  requiredVariables?: string[];
}): Promise<MCPResult> {
  try {
    const service = getService();
    await service.setPrompt({
      id: args.id,
      name: args.name,
      template: args.template,
      description: args.description,
      requiredVariables: args.requiredVariables ?? [],
    });
    return jsonResult({ success: true, id: args.id });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminPromptTest(args: {
  id: string;
  variables: Record<string, string>;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../../aui/admin-service.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }
    const result = await admin.testPrompt(args.id, args.variables);
    return jsonResult({ compiledPrompt: result });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN COST & USAGE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAdminCostRecord(args: {
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  userId?: string;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../../aui/admin-service.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }
    const costCents = admin.calculateCost(args.model, args.inputTokens, args.outputTokens);
    admin.recordLlmCost({
      model: args.model,
      operation: args.operation,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      costCents,
      latencyMs: args.latencyMs,
      success: args.success,
      userId: args.userId,
    });
    return jsonResult({ success: true, costCents });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminCostReport(args: {
  startDate: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
  userId?: string;
  model?: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const report = await service.getCostReport({
      startDate: new Date(args.startDate),
      endDate: args.endDate ? new Date(args.endDate) : undefined,
      groupBy: args.groupBy,
      userId: args.userId,
      model: args.model,
    });
    return jsonResult({
      totalCostCents: report.totalCostCents,
      totalTokens: report.totalTokens,
      totalRequests: report.totalRequests,
      byModelCount: report.byModel.size,
      byOperationCount: report.byOperation.size,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminUsageGet(args: {
  userId: string;
  period?: 'day' | 'month';
}): Promise<MCPResult> {
  try {
    const service = getService();
    const usage = await service.getUsage(args.userId);
    return jsonResult({
      userId: usage.userId,
      tierId: usage.tierId,
      period: usage.period,
      tokensUsed: usage.tokensUsed,
      requestsCount: usage.requestsCount,
      costAccruedCents: usage.costAccruedCents,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminUsageCheck(args: {
  userId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.checkLimits(args.userId);
    return jsonResult({
      withinLimits: result.withinLimits,
      exceededLimits: result.exceededLimits,
      warnings: result.warnings,
      tierName: result.tier.name,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminUsageReport(args: {
  startDate: string;
  endDate?: string;
  groupBy?: 'user' | 'tier' | 'model' | 'operation';
  limit?: number;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../../aui/admin-service.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }
    const report = await admin.getUsageReport({
      startDate: new Date(args.startDate),
      endDate: args.endDate ? new Date(args.endDate) : undefined,
      groupBy: args.groupBy,
      limit: args.limit,
    });
    return jsonResult({
      totalUsers: report.totalUsers,
      activeUsers: report.activeUsers,
      totalTokens: report.totalTokens,
      totalCostCents: report.totalCostCents,
      breakdownCount: report.breakdown.size,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN TIER HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAdminTierList(): Promise<MCPResult> {
  try {
    const service = getService();
    const tiers = await service.listTiers();
    return jsonResult({
      tiers: tiers.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        priceMonthly: t.priceMonthly,
        tokensPerDay: t.limits.tokensPerDay,
      })),
      count: tiers.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminTierGet(args: {
  tierId: string;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../../aui/admin-service.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }
    const tier = await admin.getTier(args.tierId);
    if (!tier) {
      return errorResult(`Tier "${args.tierId}" not found`);
    }
    return jsonResult(tier);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminTierSet(args: {
  id: string;
  name: string;
  description?: string;
  limits?: Record<string, unknown>;
  features?: string[];
  priceMonthly?: number;
  isPublic?: boolean;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../../aui/admin-service.js');
    const { DEFAULT_TIERS } = await import('../../../aui/constants.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }

    // Get base tier limits from defaults
    const baseTier = DEFAULT_TIERS.free;

    await admin.setTier({
      id: args.id,
      name: args.name,
      description: args.description,
      limits: { ...baseTier.limits, ...(args.limits as any) },
      features: args.features ?? [],
      priceMonthly: args.priceMonthly,
      priority: 2,
      isPublic: args.isPublic ?? true,
    });
    return jsonResult({ success: true, id: args.id });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminUserTierGet(args: {
  userId: string;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../../aui/admin-service.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }
    const tier = await admin.getUserTier(args.userId);
    return jsonResult({
      userId: args.userId,
      tier: {
        id: tier.id,
        name: tier.name,
      },
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminUserTierSet(args: {
  userId: string;
  tierId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    await service.setUserTier(args.userId, args.tierId);
    return jsonResult({ success: true, userId: args.userId, tierId: args.tierId });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}
