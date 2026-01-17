/**
 * Admin Configuration Routes
 *
 * API endpoints for managing admin configuration.
 * All routes require admin role authentication.
 */

import { Hono } from 'hono';
import { requireAuth, requireAdmin, getAuthContext } from '../middleware/auth';
import type { Env } from '../../shared/types';
import {
  getConfig,
  getConfigByCategory,
  getAllConfig,
  setConfig,
  deleteConfig,
  getPricingTiers,
  getPricingTier,
  updatePricingTier,
  getAuditLog,
  type ConfigCategory,
} from '../services/admin-config';
import { validateEncryptionKey } from '../utils/config-encryption';

const adminConfigRoutes = new Hono<{ Bindings: Env }>();

// All routes require admin role
adminConfigRoutes.use('/*', requireAuth(), requireAdmin());

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/config - List all config
 */
adminConfigRoutes.get('/config', async (c) => {
  try {
    const configs = await getAllConfig(c.env);

    // Mask secret values in response
    const masked = configs.map(cfg => ({
      ...cfg,
      value: cfg.isSecret ? '[REDACTED]' : cfg.value,
      rawValue: cfg.isSecret ? '[REDACTED]' : cfg.rawValue,
    }));

    return c.json({ configs: masked });
  } catch (error) {
    console.error('Error fetching config:', error);
    return c.json({ error: 'Failed to fetch configuration' }, 500);
  }
});

/**
 * GET /admin/config/:category - List config by category
 */
adminConfigRoutes.get('/config/:category', async (c) => {
  const category = c.req.param('category') as ConfigCategory;

  if (!['pricing', 'stripe', 'features', 'limits', 'secrets', 'ui'].includes(category)) {
    return c.json({ error: 'Invalid category' }, 400);
  }

  try {
    const configs = await getConfigByCategory(c.env, category);

    const masked = configs.map(cfg => ({
      ...cfg,
      value: cfg.isSecret ? '[REDACTED]' : cfg.value,
      rawValue: cfg.isSecret ? '[REDACTED]' : cfg.rawValue,
    }));

    return c.json({ category, configs: masked });
  } catch (error) {
    console.error('Error fetching config:', error);
    return c.json({ error: 'Failed to fetch configuration' }, 500);
  }
});

/**
 * GET /admin/config/:category/:key - Get single config value
 */
adminConfigRoutes.get('/config/:category/:key', async (c) => {
  const category = c.req.param('category') as ConfigCategory;
  const key = c.req.param('key');

  try {
    const config = await getConfig(c.env, category, key);

    if (!config) {
      return c.json({ error: 'Config not found' }, 404);
    }

    // For secrets, return metadata but not the actual value
    if (config.isSecret) {
      return c.json({
        ...config,
        value: '[REDACTED]',
        rawValue: '[REDACTED]',
        hint: 'Secret values are not returned via API. Use the admin UI to view/edit.',
      });
    }

    return c.json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    return c.json({ error: 'Failed to fetch configuration' }, 500);
  }
});

/**
 * PUT /admin/config/:category/:key - Set config value
 */
adminConfigRoutes.put('/config/:category/:key', async (c) => {
  const auth = getAuthContext(c);
  const category = c.req.param('category') as ConfigCategory;
  const key = c.req.param('key');

  try {
    const body = await c.req.json() as {
      value: unknown;
      description?: string;
      isSecret?: boolean;
      encrypt?: boolean;
      reason?: string;
    };

    if (body.value === undefined) {
      return c.json({ error: 'Value is required' }, 400);
    }

    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');

    const config = await setConfig(
      c.env,
      category,
      key,
      {
        value: body.value,
        description: body.description,
        isSecret: body.isSecret,
        encrypt: body.encrypt,
      },
      auth.userId,
      auth.email,
      ipAddress,
      body.reason
    );

    return c.json({
      success: true,
      config: config.isSecret
        ? { ...config, value: '[REDACTED]', rawValue: '[REDACTED]' }
        : config,
    });
  } catch (error) {
    console.error('Error setting config:', error);
    return c.json({ error: 'Failed to set configuration' }, 500);
  }
});

/**
 * DELETE /admin/config/:category/:key - Delete config value
 */
adminConfigRoutes.delete('/config/:category/:key', async (c) => {
  const auth = getAuthContext(c);
  const category = c.req.param('category') as ConfigCategory;
  const key = c.req.param('key');

  try {
    const body = await c.req.json().catch(() => ({})) as { reason?: string };
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');

    const deleted = await deleteConfig(
      c.env,
      category,
      key,
      auth.userId,
      auth.email,
      ipAddress,
      body.reason
    );

    if (!deleted) {
      return c.json({ error: 'Config not found' }, 404);
    }

    return c.json({ success: true, deleted: { category, key } });
  } catch (error) {
    console.error('Error deleting config:', error);
    return c.json({ error: 'Failed to delete configuration' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PRICING TIER ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/pricing - Get all pricing tiers
 */
adminConfigRoutes.get('/pricing', async (c) => {
  const includeInactive = c.req.query('includeInactive') === 'true';

  try {
    const tiers = await getPricingTiers(c.env, includeInactive);
    return c.json({ tiers });
  } catch (error) {
    console.error('Error fetching pricing tiers:', error);
    return c.json({ error: 'Failed to fetch pricing tiers' }, 500);
  }
});

/**
 * GET /admin/pricing/:tierKey - Get single pricing tier
 */
adminConfigRoutes.get('/pricing/:tierKey', async (c) => {
  const tierKey = c.req.param('tierKey');

  try {
    const tier = await getPricingTier(c.env, tierKey);

    if (!tier) {
      return c.json({ error: 'Tier not found' }, 404);
    }

    return c.json(tier);
  } catch (error) {
    console.error('Error fetching pricing tier:', error);
    return c.json({ error: 'Failed to fetch pricing tier' }, 500);
  }
});

/**
 * PUT /admin/pricing/:tierKey - Update pricing tier
 */
adminConfigRoutes.put('/pricing/:tierKey', async (c) => {
  const auth = getAuthContext(c);
  const tierKey = c.req.param('tierKey');

  try {
    const updates = await c.req.json();

    const tier = await updatePricingTier(c.env, tierKey, updates, auth.userId);

    if (!tier) {
      return c.json({ error: 'Tier not found' }, 404);
    }

    return c.json({ success: true, tier });
  } catch (error) {
    console.error('Error updating pricing tier:', error);
    return c.json({ error: 'Failed to update pricing tier' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT LOG ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/audit - Get audit log
 */
adminConfigRoutes.get('/audit', async (c) => {
  const configId = c.req.query('configId');
  const category = c.req.query('category');
  const userId = c.req.query('userId');
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    const entries = await getAuditLog(c.env, {
      configId,
      category,
      userId,
      limit: Math.min(limit, 500),
      offset,
    });

    return c.json({ entries, limit, offset });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return c.json({ error: 'Failed to fetch audit log' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/encryption/status - Check encryption key status
 */
adminConfigRoutes.get('/encryption/status', async (c) => {
  try {
    const result = await validateEncryptionKey(c.env);

    return c.json({
      configured: result.valid,
      error: result.error,
      message: result.valid
        ? 'Encryption key is configured and working'
        : 'Encryption key is not configured or invalid',
    });
  } catch (error) {
    return c.json({
      configured: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /admin/config/seed - Re-seed default config (for initialization)
 */
adminConfigRoutes.post('/config/seed', async (c) => {
  const auth = getAuthContext(c);

  try {
    // This would run the seed portion of the migration again
    // For safety, we only seed values that don't exist
    const seeded: string[] = [];

    // Check and seed day pass price
    const dayPassPrice = await getConfig(c.env, 'pricing', 'day_pass_price_cents');
    if (!dayPassPrice) {
      await setConfig(c.env, 'pricing', 'day_pass_price_cents', {
        value: 100,
        description: 'Day pass price in cents ($1.00)',
      }, auth.userId, auth.email);
      seeded.push('pricing:day_pass_price_cents');
    }

    // Add more seeds as needed...

    return c.json({
      success: true,
      seeded,
      message: seeded.length > 0
        ? `Seeded ${seeded.length} config values`
        : 'All default config values already exist',
    });
  } catch (error) {
    console.error('Error seeding config:', error);
    return c.json({ error: 'Failed to seed configuration' }, 500);
  }
});

export default adminConfigRoutes;
