/**
 * Admin Routes
 *
 * Administrative API endpoints for user management, tier configuration,
 * usage analytics, and system configuration.
 *
 * All routes require admin role authentication.
 *
 * @module @humanizer/api/routes/admin
 */

import { Hono } from 'hono';
import {
  getUsageService,
  getApiKeyService,
  getModelRegistry,
  getFeatureFlagService,
  getAuditService,
} from '@humanizer/core';
import type { AuiContextVariables } from '../middleware/aui-context.js';
import { requireAuth, requireAdmin, getAuth, type AuthContext } from '../middleware/auth.js';

// Helper to get UsageService with error handling
function requireUsageService() {
  const service = getUsageService();
  if (!service) {
    throw new Error('Usage service not initialized');
  }
  return service;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface AdminContextVariables extends AuiContextVariables {
  auth: AuthContext;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export const adminRouter = new Hono<{ Variables: AdminContextVariables }>();

// Apply admin middleware to all routes
adminRouter.use('*', requireAuth(), requireAdmin());

// ═══════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/users
 * List all users with filters
 *
 * Note: Currently returns mock data. Real integration with auth-api pending.
 */
adminRouter.get('/users', async (c) => {
  const { tier, status, limit = '50', offset = '0', search } = c.req.query();
  const limitNum = parseInt(limit, 10);
  const offsetNum = parseInt(offset, 10);

  // Mock user data for UI development
  // In production, this would query auth-api
  const mockUsers = [
    {
      id: 'user-001',
      email: 'admin@humanizer.com',
      role: 'admin',
      tenantId: 'humanizer',
      createdAt: '2024-01-01T00:00:00Z',
      lastActiveAt: new Date().toISOString(),
      bannedAt: null,
    },
    {
      id: 'user-002',
      email: 'pro@example.com',
      role: 'pro',
      tenantId: 'humanizer',
      createdAt: '2024-06-15T00:00:00Z',
      lastActiveAt: new Date(Date.now() - 3600000).toISOString(),
      bannedAt: null,
    },
    {
      id: 'user-003',
      email: 'member@example.com',
      role: 'member',
      tenantId: 'humanizer',
      createdAt: '2024-09-20T00:00:00Z',
      lastActiveAt: new Date(Date.now() - 86400000).toISOString(),
      bannedAt: null,
    },
    {
      id: 'user-004',
      email: 'free@example.com',
      role: 'free',
      tenantId: 'humanizer',
      createdAt: '2025-01-10T00:00:00Z',
      lastActiveAt: new Date(Date.now() - 172800000).toISOString(),
      bannedAt: null,
    },
    {
      id: 'user-005',
      email: 'banned@example.com',
      role: 'free',
      tenantId: 'humanizer',
      createdAt: '2024-11-01T00:00:00Z',
      lastActiveAt: '2025-01-15T00:00:00Z',
      bannedAt: '2025-01-20T00:00:00Z',
      banReason: 'Terms of service violation',
    },
  ];

  // Apply filters
  let filteredUsers = mockUsers;

  if (search) {
    const searchLower = search.toLowerCase();
    filteredUsers = filteredUsers.filter(u =>
      u.email.toLowerCase().includes(searchLower)
    );
  }

  if (tier) {
    filteredUsers = filteredUsers.filter(u => u.role === tier);
  }

  if (status === 'active') {
    filteredUsers = filteredUsers.filter(u => !u.bannedAt);
  } else if (status === 'banned') {
    filteredUsers = filteredUsers.filter(u => !!u.bannedAt);
  }

  const total = filteredUsers.length;
  const users = filteredUsers.slice(offsetNum, offsetNum + limitNum);

  return c.json({
    users,
    total,
    limit: limitNum,
    offset: offsetNum,
    filters: { tier, status, search },
  });
});

/**
 * GET /admin/users/:id
 * Get detailed user information
 *
 * Note: Currently combines mock profile data with real usage data.
 */
adminRouter.get('/users/:id', async (c) => {
  const userId = c.req.param('id');

  // Mock user profiles (in production, query auth-api)
  const mockProfiles: Record<string, {
    id: string;
    email: string;
    role: string;
    tenantId: string;
    createdAt: string;
    lastActiveAt: string | null;
    bannedAt: string | null;
    banReason?: string;
  }> = {
    'user-001': {
      id: 'user-001',
      email: 'admin@humanizer.com',
      role: 'admin',
      tenantId: 'humanizer',
      createdAt: '2024-01-01T00:00:00Z',
      lastActiveAt: new Date().toISOString(),
      bannedAt: null,
    },
    'user-002': {
      id: 'user-002',
      email: 'pro@example.com',
      role: 'pro',
      tenantId: 'humanizer',
      createdAt: '2024-06-15T00:00:00Z',
      lastActiveAt: new Date(Date.now() - 3600000).toISOString(),
      bannedAt: null,
    },
    'user-003': {
      id: 'user-003',
      email: 'member@example.com',
      role: 'member',
      tenantId: 'humanizer',
      createdAt: '2024-09-20T00:00:00Z',
      lastActiveAt: new Date(Date.now() - 86400000).toISOString(),
      bannedAt: null,
    },
    'user-004': {
      id: 'user-004',
      email: 'free@example.com',
      role: 'free',
      tenantId: 'humanizer',
      createdAt: '2025-01-10T00:00:00Z',
      lastActiveAt: new Date(Date.now() - 172800000).toISOString(),
      bannedAt: null,
    },
    'user-005': {
      id: 'user-005',
      email: 'banned@example.com',
      role: 'free',
      tenantId: 'humanizer',
      createdAt: '2024-11-01T00:00:00Z',
      lastActiveAt: '2025-01-15T00:00:00Z',
      bannedAt: '2025-01-20T00:00:00Z',
      banReason: 'Terms of service violation',
    },
  };

  const profile = mockProfiles[userId];

  if (!profile) {
    return c.json({ error: 'User not found' }, 404);
  }

  try {
    const usageService = requireUsageService();
    const usage = await usageService.getUsage(userId);

    return c.json({
      ...profile,
      usage: usage
        ? {
            tokensUsed: usage.tokensUsed,
            requestsCount: usage.requestsCount,
            costMillicents: usage.costMillicents,
            period: usage.billingPeriod,
          }
        : {
            tokensUsed: Math.floor(Math.random() * 50000),
            requestsCount: Math.floor(Math.random() * 100),
            costMillicents: Math.floor(Math.random() * 5000),
            period: new Date().toISOString().substring(0, 7),
          },
    });
  } catch {
    // If usage service fails, still return profile with mock usage
    return c.json({
      ...profile,
      usage: {
        tokensUsed: Math.floor(Math.random() * 50000),
        requestsCount: Math.floor(Math.random() * 100),
        costMillicents: Math.floor(Math.random() * 5000),
        period: new Date().toISOString().substring(0, 7),
      },
    });
  }
});

/**
 * PUT /admin/users/:id/role
 * Change user role/tier
 *
 * Note: This endpoint is a stub. User roles are managed via auth-api/Stripe.
 * This endpoint can be used to set quota overrides for the user.
 */
adminRouter.put('/users/:id/role', async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json<{ role: string; reason?: string }>();

  if (!body.role) {
    return c.json({ error: 'Role is required' }, 400);
  }

  const auth = getAuth(c)!;

  // TODO: Implement via auth-api integration or set quota override
  // For now, return success stub

  return c.json({
    userId,
    role: body.role,
    updatedBy: auth.userId,
    updatedAt: new Date().toISOString(),
    message: 'User role change endpoint - implementation pending auth-api integration',
  });
});

/**
 * POST /admin/users/:id/ban
 * Ban a user
 */
adminRouter.post('/users/:id/ban', async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json<{ reason: string; duration?: string }>();

  if (!body.reason) {
    return c.json({ error: 'Reason is required' }, 400);
  }

  // TODO: Implement user banning in auth-api

  return c.json({
    userId,
    banned: true,
    reason: body.reason,
    duration: body.duration ?? 'permanent',
    message: 'User ban endpoint - implementation pending auth-api integration',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER & QUOTA MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/tiers
 * List all tier configurations
 */
adminRouter.get('/tiers', async (c) => {
  try {
    const usageService = requireUsageService();
    const tiers = await usageService.listTiers();

    return c.json({
      tiers: tiers.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        limits: t.limits,
        features: t.features,
        priceMonthly: t.priceMonthly,
        priceAnnual: t.priceAnnual,
        priority: t.priority,
        isPublic: t.isPublic,
      })),
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 503);
  }
});

/**
 * PUT /admin/tiers/:tier
 * Update tier configuration
 */
adminRouter.put('/tiers/:tier', async (c) => {
  const tierId = c.req.param('tier');
  const body = await c.req.json<{
    tokensPerMonth?: number;
    requestsPerMonth?: number;
    costCentsPerMonth?: number;
    requestsPerMinute?: number;
    maxApiKeys?: number;
    displayName?: string;
    description?: string;
    priceMonthly?: number;
    priceAnnual?: number;
    isPublic?: boolean;
    features?: string[];
    priority?: number;
  }>();

  try {
    const usageService = requireUsageService();
    const updated = await usageService.updateTier(tierId, body);

    return c.json({
      tier: updated.id,
      updated: true,
      config: {
        name: updated.name,
        description: updated.description,
        limits: updated.limits,
        features: updated.features,
        priceMonthly: updated.priceMonthly,
        priceAnnual: updated.priceAnnual,
        priority: updated.priority,
        isPublic: updated.isPublic,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      return c.json({ error: message }, 404);
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /admin/overrides
 * List all quota overrides
 */
adminRouter.get('/overrides', async (c) => {
  const { limit = '50', offset = '0' } = c.req.query();
  const limitNum = parseInt(limit, 10);
  const offsetNum = parseInt(offset, 10);

  try {
    const usageService = requireUsageService();
    const result = await usageService.listQuotaOverrides({ limit: limitNum, offset: offsetNum });

    return c.json({
      overrides: result.overrides.map((o) => ({
        userId: o.userId,
        tokensPerMonth: o.tokensPerMonth,
        requestsPerMonth: o.requestsPerMonth,
        costCentsPerMonth: o.costCentsPerMonth,
        reason: o.reason,
        grantedBy: o.grantedBy,
        effectiveUntil: o.effectiveUntil?.toISOString() ?? null,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
      total: result.total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 503);
  }
});

/**
 * PUT /admin/overrides/:userId
 * Set or update quota override for a user
 */
adminRouter.put('/overrides/:userId', async (c) => {
  const userId = c.req.param('userId');
  const auth = getAuth(c)!;
  const body = await c.req.json<{
    tokensPerMonth?: number;
    requestsPerMonth?: number;
    costCentsPerMonth?: number;
    reason: string;
    effectiveUntil?: string;
  }>();

  if (!body.reason) {
    return c.json({ error: 'Reason is required' }, 400);
  }

  try {
    const usageService = requireUsageService();
    const override = await usageService.setQuotaOverride(userId, {
      tokensPerMonth: body.tokensPerMonth,
      requestsPerMonth: body.requestsPerMonth,
      costCentsPerMonth: body.costCentsPerMonth,
      reason: body.reason,
      grantedBy: auth.userId,
      effectiveUntil: body.effectiveUntil ? new Date(body.effectiveUntil) : undefined,
    });

    return c.json({
      userId,
      override: {
        tokensPerMonth: override.tokensPerMonth,
        requestsPerMonth: override.requestsPerMonth,
        costCentsPerMonth: override.costCentsPerMonth,
        reason: override.reason,
        effectiveUntil: override.effectiveUntil?.toISOString() ?? null,
        grantedBy: override.grantedBy,
        createdAt: override.createdAt.toISOString(),
        updatedAt: override.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

/**
 * DELETE /admin/overrides/:userId
 * Remove quota override for a user
 */
adminRouter.delete('/overrides/:userId', async (c) => {
  const userId = c.req.param('userId');

  try {
    const usageService = requireUsageService();
    const removed = await usageService.removeQuotaOverride(userId);

    if (!removed) {
      return c.json({ error: 'Override not found' }, 404);
    }

    return c.json({
      userId,
      removed: true,
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// API KEY MANAGEMENT (Admin View)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/api-keys
 * List all API keys (redacted)
 */
adminRouter.get('/api-keys', async (c) => {
  const { userId, status, limit = '50', offset = '0' } = c.req.query();
  const apiKeyService = getApiKeyService();

  if (!apiKeyService) {
    return c.json({ error: 'API Key service not initialized' }, 503);
  }

  const result = await apiKeyService.adminListKeys({
    userId: userId || undefined,
    status: (status as 'active' | 'revoked' | 'expired') || undefined,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  });

  return c.json({
    keys: result.keys.map(k => ({
      id: k.id,
      userId: k.userId,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes,
      rateLimitRpm: k.rateLimitRpm,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      usageCount: k.usageCount,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      revokedAt: k.revokedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
    total: result.total,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    filters: { userId, status },
  });
});

/**
 * DELETE /admin/api-keys/:id
 * Revoke an API key (admin action)
 */
adminRouter.delete('/api-keys/:id', async (c) => {
  const keyId = c.req.param('id');
  const auth = getAuth(c)!;
  const body = await c.req.json<{ reason: string }>().catch(() => ({ reason: 'Admin revocation' }));

  const apiKeyService = getApiKeyService();

  if (!apiKeyService) {
    return c.json({ error: 'API Key service not initialized' }, 503);
  }

  const revoked = await apiKeyService.adminRevokeKey(keyId);

  if (!revoked) {
    return c.json({ error: 'Key not found or already revoked' }, 404);
  }

  return c.json({
    keyId,
    revoked: true,
    revokedBy: auth.userId,
    reason: body.reason,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/analytics/usage
 * Get usage analytics
 */
adminRouter.get('/analytics/usage', async (c) => {
  const { startDate, endDate, groupBy = 'day' } = c.req.query();

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  try {
    const usageService = requireUsageService();
    const report = await usageService.getCostReport({
      startDate: start,
      endDate: end,
      groupBy: groupBy as 'day' | 'week' | 'month',
    });

    return c.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totalCostCents: report.totalCostCents,
      totalTokens: report.totalTokens,
      totalRequests: report.totalRequests,
      byModel: Object.fromEntries(report.byModel),
      byOperation: Object.fromEntries(report.byOperation),
      byPeriod: Object.fromEntries(report.byPeriod),
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 503);
  }
});

/**
 * GET /admin/analytics/revenue
 * Get revenue analytics
 */
adminRouter.get('/analytics/revenue', async (c) => {
  const { startDate, endDate } = c.req.query();

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  try {
    const usageService = requireUsageService();
    const analytics = await usageService.getRevenueAnalytics({
      startDate: start,
      endDate: end,
    });

    return c.json({
      period: {
        start: analytics.period.start.toISOString(),
        end: analytics.period.end.toISOString(),
      },
      totalRevenueMillicents: analytics.totalRevenueMillicents,
      totalCostMillicents: analytics.totalCostMillicents,
      marginMillicents: analytics.marginMillicents,
      marginPercent: analytics.marginPercent,
      totalRequests: analytics.totalRequests,
      totalTokens: analytics.totalTokens,
      byPeriod: analytics.byPeriod,
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 503);
  }
});

/**
 * GET /admin/analytics/costs
 * Get provider cost analytics
 */
adminRouter.get('/analytics/costs', async (c) => {
  const { startDate, endDate, includeDaily } = c.req.query();

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  try {
    const usageService = requireUsageService();
    const analytics = await usageService.getCostAnalytics({
      startDate: start,
      endDate: end,
      includeDaily: includeDaily === 'true',
    });

    return c.json({
      period: {
        start: analytics.period.start.toISOString(),
        end: analytics.period.end.toISOString(),
      },
      totalProviderCostMillicents: analytics.totalProviderCostMillicents,
      totalTokens: analytics.totalTokens,
      totalRequests: analytics.totalRequests,
      byProvider: analytics.byProvider,
      byModel: analytics.byModel,
      ...(analytics.byDay && { byDay: analytics.byDay }),
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 503);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/models
 * List available models from the registry
 */
adminRouter.get('/models', async (c) => {
  const registry = getModelRegistry();
  const allModels = await registry.listAllModels();

  const models = allModels.map((m) => ({
    id: m.id,
    name: m.description ?? m.id.split(':')[0],
    provider: m.provider,
    type: m.capabilities.includes('embedding') ? 'embedding' : 'chat',
    capabilities: m.capabilities,
    contextWindow: m.contextWindow,
    dimensions: m.dimensions,
    maxOutput: undefined,
    costPerMtokInput: m.costPer1kTokens.input * 1000, // Convert to per million
    costPerMtokOutput: m.costPer1kTokens.output * 1000,
    isDefault: false, // Would need to check against getDefault()
    enabled: m.vettingStatus === 'approved',
  }));

  // Group by provider
  const byProvider = models.reduce<Record<string, typeof models>>((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {});

  return c.json({
    models,
    byProvider,
    total: models.length,
  });
});

/**
 * PUT /admin/models/:id
 * Update model configuration
 */
adminRouter.put('/models/:id', async (c) => {
  const modelId = c.req.param('id');
  const body = await c.req.json<{
    enabled?: boolean;
    isDefault?: boolean;
    costPerMtokInput?: number;
    costPerMtokOutput?: number;
  }>();

  // TODO: Persist model config to database
  // For now, model registry is read-only from code

  return c.json({
    modelId,
    updated: true,
    changes: body,
    message: 'Model update endpoint - model registry is currently read-only',
  });
});

/**
 * GET /admin/prompts
 * List all prompt templates
 */
adminRouter.get('/prompts', async (c) => {
  const aui = c.get('aui');
  const prompts = await aui.listPrompts();

  return c.json({
    prompts: prompts.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      version: p.version,
      usedBy: p.usedBy,
      tags: p.tags,
    })),
  });
});

/**
 * GET /admin/prompts/:id
 * Get prompt template details
 */
adminRouter.get('/prompts/:id', async (c) => {
  const id = c.req.param('id');
  const aui = c.get('aui');
  const prompt = await aui.getPrompt(id);

  if (!prompt) {
    return c.json({ error: 'Prompt not found' }, 404);
  }

  return c.json({ prompt });
});

/**
 * PUT /admin/prompts/:id
 * Update prompt template
 */
adminRouter.put('/prompts/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    description?: string;
    template: string;
    usedBy?: string[];
    tags?: string[];
    requiredVariables?: string[];
  }>();

  if (!body.template) {
    return c.json({ error: 'Template is required' }, 400);
  }

  const aui = c.get('aui');

  // Extract variables from template (e.g., {{variable}})
  const variableRegex = /\{\{([^}]+)\}\}/g;
  const extractedVariables: string[] = [];
  let match;
  while ((match = variableRegex.exec(body.template)) !== null) {
    const varName = match[1].trim();
    if (!extractedVariables.includes(varName)) {
      extractedVariables.push(varName);
    }
  }

  try {
    await aui.setPrompt({
      id,
      name: body.name ?? id,
      description: body.description,
      template: body.template,
      usedBy: body.usedBy ?? [],
      tags: body.tags ?? [],
      requiredVariables: body.requiredVariables ?? extractedVariables,
    });

    return c.json({
      id,
      updated: true,
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

/**
 * GET /admin/provider-costs
 * List provider cost rates
 */
adminRouter.get('/provider-costs', async (c) => {
  const { provider } = c.req.query();

  try {
    const usageService = requireUsageService();
    const rates = await usageService.listProviderCosts(provider || undefined);

    return c.json({
      rates: rates.map((r) => ({
        provider: r.provider,
        modelId: r.modelId,
        inputCostPerMtok: r.inputCostPerMtok,
        outputCostPerMtok: r.outputCostPerMtok,
        effectiveFrom: r.effectiveFrom.toISOString(),
        effectiveUntil: r.effectiveUntil?.toISOString() ?? null,
      })),
      total: rates.length,
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 503);
  }
});

/**
 * POST /admin/provider-costs
 * Add new provider cost rate
 */
adminRouter.post('/provider-costs', async (c) => {
  const body = await c.req.json<{
    provider: string;
    modelId: string;
    inputCostPerMtok: number;
    outputCostPerMtok: number;
    effectiveFrom?: string;
  }>();

  if (!body.provider || !body.modelId) {
    return c.json({ error: 'Provider and modelId are required' }, 400);
  }

  if (typeof body.inputCostPerMtok !== 'number' || typeof body.outputCostPerMtok !== 'number') {
    return c.json({ error: 'inputCostPerMtok and outputCostPerMtok are required' }, 400);
  }

  try {
    const usageService = requireUsageService();
    const rate = await usageService.addProviderCost({
      provider: body.provider,
      modelId: body.modelId,
      inputCostPerMtok: body.inputCostPerMtok,
      outputCostPerMtok: body.outputCostPerMtok,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
    });

    return c.json({
      created: true,
      rate: {
        provider: rate.provider,
        modelId: rate.modelId,
        inputCostPerMtok: rate.inputCostPerMtok,
        outputCostPerMtok: rate.outputCostPerMtok,
        effectiveFrom: rate.effectiveFrom.toISOString(),
      },
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH & STATUS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/status
 * Get system status
 */
adminRouter.get('/status', async (c) => {
  const aui = c.get('aui');

  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    stores: {
      aui: aui.hasStore(),
      archive: aui.hasArchiveStore(),
      books: aui.hasBooksStore(),
    },
    services: {
      bufferService: aui.hasBufferService(),
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/providers
 * List all LLM providers with status
 */
adminRouter.get('/providers', async (c) => {
  // TODO: Get from database/config when provider management is implemented
  // For now, return provider status based on environment
  const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';

  const providers = [
    {
      id: 'ollama',
      name: 'Ollama',
      type: 'local' as const,
      status: 'connected' as const, // Would check actual connection
      enabled: true,
      endpoint: ollamaUrl,
      apiKeyConfigured: false, // Ollama doesn't need API key
      models: [
        { id: 'nomic-embed-text:latest', name: 'Nomic Embed', type: 'embedding', enabled: true },
        { id: 'llama3.2:latest', name: 'Llama 3.2', type: 'chat', enabled: true },
      ],
      lastHealthCheck: new Date().toISOString(),
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      type: 'cloud' as const,
      status: process.env.ANTHROPIC_API_KEY ? 'connected' as const : 'disconnected' as const,
      enabled: !!process.env.ANTHROPIC_API_KEY,
      apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
      models: [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', type: 'chat', enabled: true },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', type: 'chat', enabled: true },
      ],
      rateLimitRpm: 60,
      costPerMtokInput: 3000, // $3/Mtok input
      costPerMtokOutput: 15000, // $15/Mtok output
    },
    {
      id: 'openai',
      name: 'OpenAI',
      type: 'cloud' as const,
      status: process.env.OPENAI_API_KEY ? 'connected' as const : 'disconnected' as const,
      enabled: !!process.env.OPENAI_API_KEY,
      apiKeyConfigured: !!process.env.OPENAI_API_KEY,
      models: [
        { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', type: 'chat', enabled: true },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', type: 'chat', enabled: true },
        { id: 'text-embedding-3-small', name: 'Embedding Small', type: 'embedding', enabled: true },
      ],
      rateLimitRpm: 60,
    },
  ];

  return c.json({ providers });
});

/**
 * PUT /admin/providers/:id
 * Update provider configuration
 */
adminRouter.put('/providers/:id', async (c) => {
  const providerId = c.req.param('id');
  const body = await c.req.json<{
    enabled?: boolean;
    endpoint?: string;
    rateLimitRpm?: number;
    models?: Array<{ id: string; enabled: boolean }>;
  }>();

  // TODO: Persist provider config to database

  return c.json({
    providerId,
    updated: true,
    changes: body,
    message: 'Provider update endpoint - implementation pending database integration',
  });
});

/**
 * POST /admin/providers/:id/health
 * Check provider health
 */
adminRouter.post('/providers/:id/health', async (c) => {
  const providerId = c.req.param('id');

  // TODO: Actually ping the provider

  return c.json({
    providerId,
    status: 'connected',
    latencyMs: Math.floor(Math.random() * 100) + 20,
    checkedAt: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE FLAGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/features
 * List all feature flags
 */
adminRouter.get('/features', async (c) => {
  const featureFlagService = getFeatureFlagService();

  if (featureFlagService) {
    try {
      const flags = await featureFlagService.listFlags();
      return c.json({
        features: flags.map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description,
          category: f.category,
          enabled: f.enabled,
          rolloutPercentage: f.rolloutPercentage,
          tierOverrides: f.tierOverrides,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      console.warn('Feature flag service error, using fallback:', error);
    }
  }

  // Fallback mock data when service not available
  const features = [
    {
      id: 'semantic_search',
      name: 'Semantic Search',
      description: 'Enable semantic search powered by embeddings',
      category: 'core' as const,
      enabled: true,
      tierOverrides: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'custom_prompts',
      name: 'Custom Prompts',
      description: 'Allow users to create custom prompt templates',
      category: 'premium' as const,
      enabled: true,
      tierOverrides: [
        { tier: 'free', enabled: false },
        { tier: 'member', enabled: false },
        { tier: 'pro', enabled: true },
        { tier: 'premium', enabled: true },
      ],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'api_access',
      name: 'API Access',
      description: 'Enable API key creation and external API access',
      category: 'premium' as const,
      enabled: true,
      tierOverrides: [
        { tier: 'free', enabled: false },
        { tier: 'member', enabled: true },
        { tier: 'pro', enabled: true },
        { tier: 'premium', enabled: true },
      ],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'book_export',
      name: 'Book Export',
      description: 'Export books to various formats (EPUB, PDF, etc)',
      category: 'core' as const,
      enabled: true,
      tierOverrides: [],
      createdAt: '2024-06-01T00:00:00Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'advanced_analytics',
      name: 'Advanced Analytics',
      description: 'Detailed usage analytics and insights',
      category: 'beta' as const,
      enabled: false,
      rolloutPercentage: 25,
      tierOverrides: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: new Date().toISOString(),
    },
  ];

  return c.json({ features });
});

/**
 * PUT /admin/features/:id
 * Update feature flag
 */
adminRouter.put('/features/:id', async (c) => {
  const featureId = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    description?: string;
    enabled?: boolean;
    rolloutPercentage?: number;
    tierOverrides?: Array<{ tier: string; enabled: boolean }>;
  }>();

  const featureFlagService = getFeatureFlagService();

  if (featureFlagService) {
    try {
      // Get existing flag to merge with updates
      const existing = await featureFlagService.getFlag(featureId);
      if (!existing) {
        return c.json({ error: 'Feature flag not found' }, 404);
      }

      const updated = await featureFlagService.upsertFlag({
        id: featureId,
        name: body.name ?? existing.name,
        description: body.description ?? existing.description,
        category: existing.category,
        enabled: body.enabled ?? existing.enabled,
        rolloutPercentage: body.rolloutPercentage ?? existing.rolloutPercentage,
        tierOverrides: body.tierOverrides ?? existing.tierOverrides,
      });

      return c.json({
        featureId,
        updated: true,
        feature: {
          id: updated.id,
          name: updated.name,
          description: updated.description,
          category: updated.category,
          enabled: updated.enabled,
          rolloutPercentage: updated.rolloutPercentage,
          tierOverrides: updated.tierOverrides,
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  }

  return c.json({
    featureId,
    updated: true,
    changes: body,
    message: 'Feature flag service not available',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS (Admin View)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/subscriptions
 * List all subscriptions
 */
adminRouter.get('/subscriptions', async (c) => {
  const { tier, status, limit = '50', offset = '0' } = c.req.query();

  // TODO: Get from auth-api/Stripe when integrated
  // For now, return mock subscriptions
  const mockSubscriptions = [
    {
      id: 'sub-001',
      userId: 'user-002',
      userEmail: 'pro@example.com',
      tier: 'pro',
      status: 'active' as const,
      currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: 'sub_stripe_001',
      monthlyAmount: 2900, // $29
      createdAt: '2024-06-15T00:00:00Z',
    },
    {
      id: 'sub-002',
      userId: 'user-003',
      userEmail: 'member@example.com',
      tier: 'member',
      status: 'active' as const,
      currentPeriodStart: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: 'sub_stripe_002',
      monthlyAmount: 900, // $9
      createdAt: '2024-09-20T00:00:00Z',
    },
    {
      id: 'sub-003',
      userId: 'user-006',
      userEmail: 'enterprise@corp.com',
      tier: 'premium',
      status: 'active' as const,
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: 'sub_stripe_003',
      monthlyAmount: 9900, // $99
      createdAt: '2025-01-10T00:00:00Z',
    },
    {
      id: 'sub-004',
      userId: 'user-007',
      userEmail: 'canceling@example.com',
      tier: 'pro',
      status: 'active' as const,
      currentPeriodStart: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: true,
      stripeSubscriptionId: 'sub_stripe_004',
      monthlyAmount: 2900,
      createdAt: '2024-08-01T00:00:00Z',
    },
  ];

  // Apply filters
  let filtered = mockSubscriptions;
  if (tier) {
    filtered = filtered.filter(s => s.tier === tier);
  }
  if (status) {
    filtered = filtered.filter(s => s.status === status);
  }

  const limitNum = parseInt(limit, 10);
  const offsetNum = parseInt(offset, 10);
  const total = filtered.length;
  const subscriptions = filtered.slice(offsetNum, offsetNum + limitNum);

  // Calculate stats
  const stats = {
    total: mockSubscriptions.length,
    active: mockSubscriptions.filter(s => s.status === 'active' && !s.cancelAtPeriodEnd).length,
    canceling: mockSubscriptions.filter(s => s.cancelAtPeriodEnd).length,
    mrr: mockSubscriptions
      .filter(s => s.status === 'active')
      .reduce((sum, s) => sum + s.monthlyAmount, 0),
  };

  return c.json({
    subscriptions,
    stats,
    total,
    limit: limitNum,
    offset: offsetNum,
    filters: { tier, status },
  });
});

/**
 * GET /admin/subscriptions/:id
 * Get subscription details
 */
adminRouter.get('/subscriptions/:id', async (c) => {
  const subscriptionId = c.req.param('id');

  // TODO: Get from Stripe

  return c.json({
    subscriptionId,
    message: 'Subscription detail endpoint - implementation pending Stripe integration',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/audit
 * Get audit log events
 */
adminRouter.get('/audit', async (c) => {
  const { category, success, limit = '50', offset = '0', search } = c.req.query();
  const limitNum = parseInt(limit, 10);
  const offsetNum = parseInt(offset, 10);

  const auditService = getAuditService();

  if (auditService) {
    try {
      // If search is provided, use search method
      if (search) {
        const events = await auditService.searchEvents(search, { limit: limitNum, offset: offsetNum });
        return c.json({
          events: events.map((e) => ({
            id: e.id,
            timestamp: e.createdAt.toISOString(),
            action: e.action,
            category: e.category,
            actor: e.actor,
            target: e.target,
            metadata: e.metadata,
            ip: e.ipAddress,
            success: e.success,
          })),
          total: events.length,
          limit: limitNum,
          offset: offsetNum,
          filters: { category, success, search },
        });
      }

      // Otherwise use list with filters
      const result = await auditService.listEvents({
        category: category && category !== 'all' ? (category as 'auth' | 'admin' | 'billing' | 'api' | 'system') : undefined,
        success: success === 'true' ? true : success === 'false' ? false : undefined,
        limit: limitNum,
        offset: offsetNum,
      });

      return c.json({
        events: result.events.map((e) => ({
          id: e.id,
          timestamp: e.createdAt.toISOString(),
          action: e.action,
          category: e.category,
          actor: e.actor,
          target: e.target,
          metadata: e.metadata,
          ip: e.ipAddress,
          success: e.success,
        })),
        total: result.total,
        limit: limitNum,
        offset: offsetNum,
        filters: { category, success, search },
      });
    } catch (error) {
      console.warn('Audit service error, using fallback:', error);
    }
  }

  // Fallback mock events
  const mockEvents = [
    {
      id: 'evt-001',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      action: 'user.login',
      category: 'auth' as const,
      actor: { type: 'user' as const, id: 'user-001', email: 'admin@humanizer.com' },
      metadata: { method: 'oauth', provider: 'google' },
      ip: '192.168.1.1',
      success: true,
    },
    {
      id: 'evt-002',
      timestamp: new Date(Date.now() - 180000).toISOString(),
      action: 'admin.user.role_change',
      category: 'admin' as const,
      actor: { type: 'user' as const, id: 'user-001', email: 'admin@humanizer.com' },
      target: { type: 'user', id: 'user-002', name: 'pro@example.com' },
      metadata: { oldRole: 'free', newRole: 'pro', reason: 'Beta tester promotion' },
      success: true,
    },
    {
      id: 'evt-003',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      action: 'api_key.create',
      category: 'api' as const,
      actor: { type: 'user' as const, id: 'user-002', email: 'pro@example.com' },
      target: { type: 'api_key', id: 'key-001', name: 'Production Key' },
      metadata: { scopes: ['read', 'write', 'transform'] },
      success: true,
    },
    {
      id: 'evt-004',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      action: 'billing.subscription.created',
      category: 'billing' as const,
      actor: { type: 'user' as const, id: 'user-006', email: 'enterprise@corp.com' },
      metadata: { tier: 'premium', stripeSubscriptionId: 'sub_123ABC' },
      success: true,
    },
    {
      id: 'evt-005',
      timestamp: new Date(Date.now() - 900000).toISOString(),
      action: 'user.login_failed',
      category: 'auth' as const,
      actor: { type: 'user' as const, id: 'unknown', email: 'hacker@suspicious.net' },
      metadata: { reason: 'invalid_credentials', attempts: 3 },
      ip: '10.0.0.99',
      success: false,
    },
    {
      id: 'evt-006',
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      action: 'admin.prompt.update',
      category: 'admin' as const,
      actor: { type: 'user' as const, id: 'user-001', email: 'admin@humanizer.com' },
      target: { type: 'prompt', id: 'PERSONA_STYLE_TRANSFER', name: 'Style Transfer' },
      metadata: { version: 2 },
      success: true,
    },
    {
      id: 'evt-007',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      action: 'api.transform',
      category: 'api' as const,
      actor: { type: 'api_key' as const, id: 'key-001' },
      metadata: { model: 'claude-3-sonnet', tokens: 4521, duration_ms: 2341 },
      success: true,
    },
    {
      id: 'evt-008',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      action: 'system.maintenance.started',
      category: 'system' as const,
      actor: { type: 'system' as const, id: 'scheduler' },
      metadata: { task: 'database_vacuum', estimated_duration: '5m' },
      success: true,
    },
  ];

  // Apply filters
  let filtered = mockEvents;
  if (category && category !== 'all') {
    filtered = filtered.filter(e => e.category === category);
  }
  if (success === 'true') {
    filtered = filtered.filter(e => e.success);
  } else if (success === 'false') {
    filtered = filtered.filter(e => !e.success);
  }
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(e =>
      e.action.toLowerCase().includes(searchLower) ||
      e.actor.email?.toLowerCase().includes(searchLower) ||
      e.target?.name?.toLowerCase().includes(searchLower)
    );
  }

  const total = filtered.length;
  const events = filtered.slice(offsetNum, offsetNum + limitNum);

  return c.json({
    events,
    total,
    limit: limitNum,
    offset: offsetNum,
    filters: { category, success, search },
  });
});

/**
 * GET /admin/audit/:id
 * Get audit event details
 */
adminRouter.get('/audit/:id', async (c) => {
  const eventId = c.req.param('id');

  const auditService = getAuditService();

  if (auditService) {
    try {
      const event = await auditService.getEvent(eventId);
      if (!event) {
        return c.json({ error: 'Audit event not found' }, 404);
      }

      return c.json({
        event: {
          id: event.id,
          timestamp: event.createdAt.toISOString(),
          action: event.action,
          category: event.category,
          actor: event.actor,
          target: event.target,
          metadata: event.metadata,
          ip: event.ipAddress,
          userAgent: event.userAgent,
          success: event.success,
          errorMessage: event.errorMessage,
        },
      });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  }

  return c.json({
    eventId,
    message: 'Audit service not available',
  });
});
