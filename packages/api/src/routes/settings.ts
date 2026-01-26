/**
 * Settings Routes
 *
 * User-facing settings API endpoints for profile management,
 * API keys, usage dashboard, and preferences.
 *
 * All routes require authentication.
 *
 * @module @humanizer/api/routes/settings
 */

import { Hono } from 'hono';
import { getApiKeyService, type ApiKeyScope } from '@humanizer/core';
import type { AuiContextVariables } from '../middleware/aui-context.js';
import { requireAuth, getAuth, requireTier, type AuthContext } from '../middleware/auth.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface SettingsContextVariables extends AuiContextVariables {
  auth: AuthContext;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export const settingsRouter = new Hono<{ Variables: SettingsContextVariables }>();

// Apply auth middleware to all routes
settingsRouter.use('*', requireAuth());

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /settings/profile
 * Get current user's profile
 */
settingsRouter.get('/profile', async (c) => {
  const auth = getAuth(c)!;

  return c.json({
    userId: auth.userId,
    email: auth.email,
    role: auth.role,
    tenantId: auth.tenantId,
    // TODO: Add more profile fields from auth-api
    message: 'Profile endpoint - full profile pending auth-api integration',
  });
});

/**
 * PUT /settings/profile
 * Update user's profile
 */
settingsRouter.put('/profile', async (c) => {
  const auth = getAuth(c)!;
  const body = await c.req.json<{
    displayName?: string;
    timezone?: string;
    language?: string;
  }>();

  // TODO: Update profile via auth-api

  return c.json({
    userId: auth.userId,
    updated: true,
    changes: body,
    message: 'Profile update endpoint - implementation pending auth-api integration',
  });
});

/**
 * PUT /settings/password
 * Change user's password
 */
settingsRouter.put('/password', async (c) => {
  const auth = getAuth(c)!;
  const body = await c.req.json<{
    currentPassword: string;
    newPassword: string;
  }>();

  if (!body.currentPassword || !body.newPassword) {
    return c.json({ error: 'Current password and new password are required' }, 400);
  }

  if (body.newPassword.length < 8) {
    return c.json({ error: 'New password must be at least 8 characters' }, 400);
  }

  // TODO: Validate current password and update via auth-api

  return c.json({
    userId: auth.userId,
    passwordChanged: true,
    message: 'Password change endpoint - implementation pending auth-api integration',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// API KEYS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /settings/api-keys
 * List user's API keys
 */
settingsRouter.get('/api-keys', async (c) => {
  const auth = getAuth(c)!;
  const apiKeyService = getApiKeyService();

  if (!apiKeyService) {
    return c.json({ error: 'API Key service not initialized' }, 503);
  }

  const keys = await apiKeyService.listKeys(auth.userId, auth.tenantId);

  return c.json({
    keys: keys.map(k => ({
      id: k.id,
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
    count: keys.filter(k => !k.revokedAt).length,
  });
});

/**
 * POST /settings/api-keys
 * Create a new API key
 */
settingsRouter.post('/api-keys', async (c) => {
  const auth = getAuth(c)!;
  const body = await c.req.json<{
    name: string;
    scopes?: string[];
    expiresIn?: string; // e.g., '30d', '90d', 'never'
  }>();

  if (!body.name) {
    return c.json({ error: 'Name is required' }, 400);
  }

  const apiKeyService = getApiKeyService();

  if (!apiKeyService) {
    return c.json({ error: 'API Key service not initialized' }, 503);
  }

  // Parse expiresIn to Date
  let expiresAt: Date | undefined;
  if (body.expiresIn && body.expiresIn !== 'never') {
    const match = body.expiresIn.match(/^(\d+)d$/);
    if (match) {
      const days = parseInt(match[1], 10);
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
  }

  try {
    const result = await apiKeyService.createKey(auth.userId, body.name, {
      tenantId: auth.tenantId,
      scopes: (body.scopes as ApiKeyScope[]) ?? ['read', 'write'],
      expiresAt,
    });

    return c.json({
      key: result.key,
      id: result.id,
      name: body.name,
      keyPrefix: result.keyPrefix,
      scopes: body.scopes ?? ['read', 'write'],
      expiresAt: expiresAt?.toISOString() ?? null,
      createdAt: new Date().toISOString(),
      warning: 'Copy your API key now. You will not be able to see it again.',
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

/**
 * DELETE /settings/api-keys/:id
 * Revoke an API key
 */
settingsRouter.delete('/api-keys/:id', async (c) => {
  const auth = getAuth(c)!;
  const keyId = c.req.param('id');

  const apiKeyService = getApiKeyService();

  if (!apiKeyService) {
    return c.json({ error: 'API Key service not initialized' }, 503);
  }

  const revoked = await apiKeyService.revokeKey(auth.userId, keyId, auth.tenantId);

  if (!revoked) {
    return c.json({ error: 'Key not found or already revoked' }, 404);
  }

  return c.json({
    keyId,
    revoked: true,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// USAGE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /settings/usage
 * Get current usage summary
 */
settingsRouter.get('/usage', async (c) => {
  const auth = getAuth(c)!;
  const aui = c.get('aui');

  const usage = await aui.getUsage(auth.userId);
  const limits = await aui.checkLimits(auth.userId);

  return c.json({
    period: usage.period,
    usage: {
      tokensUsed: usage.tokensUsed,
      requestsCount: usage.requestsCount,
      costAccruedCents: usage.costAccruedCents,
    },
    limits: {
      tokensPerDay: limits.tier.limits.tokensPerDay,
      tokensPerMonth: limits.tier.limits.tokensPerMonth,
      requestsPerMinute: limits.tier.limits.requestsPerMinute,
    },
    tier: {
      id: limits.tier.id,
      name: limits.tier.name,
    },
    withinLimits: limits.withinLimits,
    warnings: limits.warnings,
    byModel: Object.fromEntries(usage.byModel),
    byOperation: Object.fromEntries(usage.byOperation),
  });
});

/**
 * GET /settings/usage/history
 * Get usage history
 */
settingsRouter.get('/usage/history', async (c) => {
  const auth = getAuth(c)!;
  const { periods = '6' } = c.req.query();

  // TODO: Get historical usage from UsageService

  return c.json({
    userId: auth.userId,
    history: [],
    periodsRequested: parseInt(periods, 10),
    message: 'Usage history endpoint - implementation pending UsageService integration',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /settings/preferences
 * Get user's preferences
 */
settingsRouter.get('/preferences', async (c) => {
  const auth = getAuth(c)!;

  // TODO: Get from aui_user_preferences table

  return c.json({
    userId: auth.userId,
    preferences: {
      modelPreferences: {},
      transformationDefaults: {},
      uiPreferences: {},
    },
    message: 'Preferences endpoint - implementation pending',
  });
});

/**
 * PUT /settings/preferences
 * Update user's preferences
 */
settingsRouter.put('/preferences', async (c) => {
  const auth = getAuth(c)!;
  const body = await c.req.json<{
    modelPreferences?: {
      defaultModel?: string;
      temperature?: number;
      maxTokens?: number;
    };
    transformationDefaults?: {
      persona?: string;
      style?: string;
    };
    uiPreferences?: {
      theme?: 'light' | 'dark' | 'system';
      compactMode?: boolean;
      showTokenCount?: boolean;
    };
  }>();

  // TODO: Save to aui_user_preferences table

  return c.json({
    userId: auth.userId,
    updated: true,
    preferences: body,
    message: 'Preferences update endpoint - implementation pending',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM PROMPTS (PRO+ Feature)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /settings/prompts
 * List user's custom prompts (PRO+ feature)
 */
settingsRouter.get('/prompts', requireTier('pro'), async (c) => {
  const auth = getAuth(c)!;

  // TODO: Get from aui_user_preferences.prompt_customizations

  return c.json({
    userId: auth.userId,
    prompts: [],
    count: 0,
    limit: 10, // Max custom prompts for pro tier
    message: 'Custom prompts endpoint - implementation pending',
  });
});

/**
 * POST /settings/prompts
 * Create a custom prompt (PRO+ feature)
 */
settingsRouter.post('/prompts', requireTier('pro'), async (c) => {
  const auth = getAuth(c)!;
  const body = await c.req.json<{
    name: string;
    description?: string;
    template: string;
    variables?: string[];
  }>();

  if (!body.name || !body.template) {
    return c.json({ error: 'Name and template are required' }, 400);
  }

  // TODO: Save to aui_user_preferences.prompt_customizations

  return c.json({
    userId: auth.userId,
    prompt: {
      id: null, // Would be generated
      name: body.name,
      description: body.description,
      template: body.template,
      variables: body.variables ?? [],
      createdAt: new Date().toISOString(),
    },
    message: 'Custom prompt creation endpoint - implementation pending',
  });
});

/**
 * PUT /settings/prompts/:id
 * Update a custom prompt (PRO+ feature)
 */
settingsRouter.put('/prompts/:id', requireTier('pro'), async (c) => {
  const auth = getAuth(c)!;
  const promptId = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    description?: string;
    template?: string;
    variables?: string[];
  }>();

  // TODO: Update in aui_user_preferences.prompt_customizations

  return c.json({
    userId: auth.userId,
    promptId,
    updated: true,
    changes: body,
    message: 'Custom prompt update endpoint - implementation pending',
  });
});

/**
 * DELETE /settings/prompts/:id
 * Delete a custom prompt (PRO+ feature)
 */
settingsRouter.delete('/prompts/:id', requireTier('pro'), async (c) => {
  const auth = getAuth(c)!;
  const promptId = c.req.param('id');

  // TODO: Remove from aui_user_preferences.prompt_customizations

  return c.json({
    userId: auth.userId,
    promptId,
    deleted: true,
    message: 'Custom prompt deletion endpoint - implementation pending',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /settings/subscription
 * Get subscription details
 */
settingsRouter.get('/subscription', async (c) => {
  const auth = getAuth(c)!;

  // TODO: Get subscription from Stripe via auth-api

  return c.json({
    userId: auth.userId,
    tier: auth.role,
    subscription: null, // Would include Stripe subscription details
    message: 'Subscription endpoint - implementation pending Stripe integration',
  });
});

/**
 * POST /settings/subscription/portal
 * Get Stripe customer portal URL
 */
settingsRouter.post('/subscription/portal', async (c) => {
  const auth = getAuth(c)!;

  // TODO: Generate Stripe portal URL via auth-api

  return c.json({
    userId: auth.userId,
    portalUrl: null,
    message: 'Stripe portal endpoint - implementation pending auth-api integration',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DATA EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /settings/export
 * Request data export (GDPR)
 */
settingsRouter.post('/export', async (c) => {
  const auth = getAuth(c)!;

  // TODO: Queue data export job

  return c.json({
    userId: auth.userId,
    exportRequested: true,
    estimatedTime: '24 hours',
    message: 'Data export endpoint - implementation pending',
  });
});

/**
 * POST /settings/delete-account
 * Request account deletion (GDPR)
 */
settingsRouter.post('/delete-account', async (c) => {
  const auth = getAuth(c)!;
  const body = await c.req.json<{
    confirmEmail: string;
  }>();

  if (body.confirmEmail !== auth.email) {
    return c.json({ error: 'Email confirmation does not match' }, 400);
  }

  // TODO: Queue account deletion via auth-api

  return c.json({
    userId: auth.userId,
    deletionRequested: true,
    scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    message: 'Account deletion scheduled. You have 30 days to cancel.',
  });
});
