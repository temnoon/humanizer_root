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
import type { AuiContextVariables } from '../middleware/aui-context.js';
import { requireAuth, requireAdmin, getAuth, type AuthContext } from '../middleware/auth.js';

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
 */
adminRouter.get('/users', async (c) => {
  const auth = getAuth(c)!;
  const { tier, status, limit = '50', offset = '0', search } = c.req.query();

  // TODO: Implement user listing from database
  // For now, return placeholder
  return c.json({
    users: [],
    total: 0,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    filters: { tier, status, search },
    message: 'User management endpoint - implementation pending',
  });
});

/**
 * GET /admin/users/:id
 * Get detailed user information
 */
adminRouter.get('/users/:id', async (c) => {
  const userId = c.req.param('id');
  const aui = c.get('aui');

  // Get user usage
  const usage = await aui.getUsage(userId);

  // TODO: Get user profile from auth database

  return c.json({
    userId,
    usage: {
      tokensUsed: usage.tokensUsed,
      requestsCount: usage.requestsCount,
      costAccruedCents: usage.costAccruedCents,
      period: usage.period,
    },
    message: 'User detail endpoint - full profile pending auth-api integration',
  });
});

/**
 * PUT /admin/users/:id/role
 * Change user role/tier
 */
adminRouter.put('/users/:id/role', async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json<{ role: string; reason?: string }>();

  if (!body.role) {
    return c.json({ error: 'Role is required' }, 400);
  }

  const aui = c.get('aui');
  const auth = getAuth(c)!;

  try {
    await aui.setUserTier(userId, body.role);

    return c.json({
      userId,
      role: body.role,
      updatedBy: auth.userId,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
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
  const aui = c.get('aui');
  const tiers = await aui.listTiers();

  return c.json({
    tiers: tiers.map(t => ({
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
  }>();

  // TODO: Implement tier update via UsageService

  return c.json({
    tier: tierId,
    updated: true,
    changes: body,
    message: 'Tier update endpoint - implementation pending database integration',
  });
});

/**
 * GET /admin/overrides
 * List all quota overrides
 */
adminRouter.get('/overrides', async (c) => {
  const { limit = '50', offset = '0' } = c.req.query();

  // TODO: Query aui_user_quota_overrides table

  return c.json({
    overrides: [],
    total: 0,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    message: 'Quota overrides endpoint - implementation pending',
  });
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

  // TODO: Implement via UsageService

  return c.json({
    userId,
    override: {
      tokensPerMonth: body.tokensPerMonth,
      requestsPerMonth: body.requestsPerMonth,
      costCentsPerMonth: body.costCentsPerMonth,
      reason: body.reason,
      effectiveUntil: body.effectiveUntil,
      grantedBy: auth.userId,
    },
    message: 'Quota override endpoint - implementation pending',
  });
});

/**
 * DELETE /admin/overrides/:userId
 * Remove quota override for a user
 */
adminRouter.delete('/overrides/:userId', async (c) => {
  const userId = c.req.param('userId');

  // TODO: Implement via UsageService

  return c.json({
    userId,
    removed: true,
    message: 'Quota override removal endpoint - implementation pending',
  });
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

  // TODO: Query aui_api_keys table with admin view

  return c.json({
    keys: [],
    total: 0,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    filters: { userId, status },
    message: 'API keys admin endpoint - implementation pending',
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

  // TODO: Implement via ApiKeyService

  return c.json({
    keyId,
    revoked: true,
    revokedBy: auth.userId,
    reason: body.reason,
    message: 'API key revocation endpoint - implementation pending',
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
  const aui = c.get('aui');

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const report = await aui.getCostReport({
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
});

/**
 * GET /admin/analytics/revenue
 * Get revenue analytics
 */
adminRouter.get('/analytics/revenue', async (c) => {
  const { startDate, endDate } = c.req.query();

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // TODO: Query usage_events for revenue data

  return c.json({
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    totalRevenueMillicents: 0,
    totalCostMillicents: 0,
    marginMillicents: 0,
    marginPercent: 0,
    byTier: {},
    message: 'Revenue analytics endpoint - implementation pending',
  });
});

/**
 * GET /admin/analytics/costs
 * Get provider cost analytics
 */
adminRouter.get('/analytics/costs', async (c) => {
  const { startDate, endDate } = c.req.query();

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // TODO: Query usage_events for cost breakdown

  return c.json({
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    byProvider: {},
    byModel: {},
    totalProviderCostMillicents: 0,
    message: 'Cost analytics endpoint - implementation pending',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/models
 * List available models
 */
adminRouter.get('/models', async (c) => {
  // TODO: Get from ModelRegistry

  return c.json({
    models: [],
    message: 'Models endpoint - implementation pending ModelRegistry integration',
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
  }>();

  if (!body.template) {
    return c.json({ error: 'Template is required' }, 400);
  }

  const aui = c.get('aui');

  try {
    await aui.setPrompt({
      id,
      name: body.name ?? id,
      description: body.description,
      template: body.template,
      usedBy: body.usedBy ?? [],
      tags: body.tags ?? [],
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
  // TODO: Query aui_provider_cost_rates table

  return c.json({
    rates: [],
    message: 'Provider costs endpoint - implementation pending',
  });
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
  }>();

  if (!body.provider || !body.modelId) {
    return c.json({ error: 'Provider and modelId are required' }, 400);
  }

  // TODO: Insert into aui_provider_cost_rates table

  return c.json({
    created: true,
    rate: body,
    message: 'Provider cost creation endpoint - implementation pending',
  });
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
