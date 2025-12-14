/**
 * Model Settings Routes
 * User-facing endpoints for LLM model configuration and preferences
 */

import { Hono } from 'hono';
import { requireAuth, getAuthContext, optionalLocalAuth } from '../middleware/auth';
import type { Env } from '../../shared/types';
import {
  getAvailableModels,
  getModelsForUser,
  getUserModelPreference,
  setUserModelPreference,
  getUserUsageSummary,
  type ModelInfo,
} from '../services/model-selector';
import { encryptAPIKey, decryptAPIKey } from '../utils/encryption';

const modelSettingsRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /models - Get all active models in registry
 * Public endpoint - shows what models are available system-wide
 * NO AUTH REQUIRED
 */
modelSettingsRoutes.get('/models', async (c) => {
  const env = c.env;
  const capability = c.req.query('capability');
  const provider = c.req.query('provider');

  const models = await getAvailableModels(env, {
    capability: capability || undefined,
    provider: provider || undefined,
    status: 'active',
  });

  return c.json({
    models,
    count: models.length,
  });
});

// All other routes require authentication
modelSettingsRoutes.use('/models/available', optionalLocalAuth());
modelSettingsRoutes.use('/preferences', optionalLocalAuth());
modelSettingsRoutes.use('/preferences/*', optionalLocalAuth());
modelSettingsRoutes.use('/api-keys', optionalLocalAuth());
modelSettingsRoutes.use('/api-keys/*', optionalLocalAuth());
modelSettingsRoutes.use('/usage', optionalLocalAuth());
modelSettingsRoutes.use('/usage/*', optionalLocalAuth());

/**
 * GET /models/available - Get models available to current user
 * Requires authentication - filters by tier and API keys
 */
modelSettingsRoutes.get('/models/available', async (c) => {
  const env = c.env;
  const auth = getAuthContext(c);
  const capability = c.req.query('capability');

  const models = await getModelsForUser(
    env,
    auth.userId,
    auth.role || 'free',
    capability || undefined
  );

  return c.json({
    models,
    count: models.length,
    tier: auth.role || 'free',
  });
});

/**
 * GET /preferences - Get user's model preferences for all use cases
 */
modelSettingsRoutes.get('/preferences', async (c) => {
  const env = c.env;
  const auth = getAuthContext(c);

  const useCases = ['persona', 'style', 'translation', 'round_trip', 'detection', 'general', 'extraction'];

  const preferences: Record<string, string | null> = {};
  for (const useCase of useCases) {
    preferences[useCase] = await getUserModelPreference(env, auth.userId, useCase as any);
  }

  return c.json({ preferences });
});

/**
 * PUT /preferences/:useCase - Set model preference for a use case
 */
modelSettingsRoutes.put('/preferences/:useCase', async (c) => {
  const env = c.env;
  const auth = getAuthContext(c);
  const useCase = c.req.param('useCase');
  const { modelId } = await c.req.json();

  const validUseCases = ['persona', 'style', 'translation', 'round_trip', 'detection', 'general', 'extraction'];
  if (!validUseCases.includes(useCase)) {
    return c.json({ error: 'Invalid use case' }, 400);
  }

  if (!modelId) {
    return c.json({ error: 'modelId is required' }, 400);
  }

  // Verify model exists and user can use it
  const availableModels = await getModelsForUser(env, auth.userId, auth.role || 'free');
  const isAvailable = availableModels.some(m => m.id === modelId);

  if (!isAvailable) {
    return c.json({
      error: 'Model not available',
      message: 'This model requires a higher tier or API key configuration',
    }, 403);
  }

  await setUserModelPreference(env, auth.userId, useCase as any, modelId);

  return c.json({ success: true, useCase, modelId });
});

/**
 * DELETE /preferences/:useCase - Remove model preference (use default)
 */
modelSettingsRoutes.delete('/preferences/:useCase', async (c) => {
  const env = c.env;
  const auth = getAuthContext(c);
  const useCase = c.req.param('useCase');

  await env.DB.prepare(`
    DELETE FROM user_model_preferences
    WHERE user_id = ? AND use_case = ?
  `).bind(auth.userId, useCase).run();

  return c.json({ success: true, message: 'Preference removed, will use default' });
});

/**
 * GET /api-keys - Get status of user's API keys (not the keys themselves)
 */
modelSettingsRoutes.get('/api-keys', async (c) => {
  const env = c.env;
  const auth = getAuthContext(c);

  const paidTiers = ['pro', 'premium', 'admin'];
  if (!paidTiers.includes(auth.role || 'free')) {
    return c.json({
      error: 'Upgrade required',
      message: 'API key management requires Pro tier or higher',
    }, 403);
  }

  const user = await env.DB.prepare(`
    SELECT
      openai_api_key_encrypted IS NOT NULL as has_openai,
      anthropic_api_key_encrypted IS NOT NULL as has_anthropic,
      google_api_key_encrypted IS NOT NULL as has_google,
      groq_api_key_encrypted IS NOT NULL as has_groq,
      api_keys_updated_at
    FROM users WHERE id = ?
  `).bind(auth.userId).first();

  return c.json({
    providers: {
      openai: { configured: !!user?.has_openai },
      anthropic: { configured: !!user?.has_anthropic },
      google: { configured: !!user?.has_google },
      groq: { configured: !!user?.has_groq },
    },
    lastUpdated: user?.api_keys_updated_at || null,
  });
});

/**
 * PUT /api-keys/:provider - Set API key for a provider
 */
modelSettingsRoutes.put('/api-keys/:provider', async (c) => {
  const env = c.env;
  const auth = getAuthContext(c);
  const provider = c.req.param('provider');
  const { apiKey } = await c.req.json();

  const paidTiers = ['pro', 'premium', 'admin'];
  if (!paidTiers.includes(auth.role || 'free')) {
    return c.json({
      error: 'Upgrade required',
      message: 'API key management requires Pro tier or higher',
    }, 403);
  }

  const validProviders = ['openai', 'anthropic', 'google', 'groq'];
  if (!validProviders.includes(provider)) {
    return c.json({ error: 'Invalid provider' }, 400);
  }

  if (!apiKey || apiKey.length < 10) {
    return c.json({ error: 'Invalid API key' }, 400);
  }

  // Encrypt the API key
  const encrypted = await encryptAPIKey(apiKey, env.JWT_SECRET, auth.userId);

  // Update the appropriate column
  const column = `${provider}_api_key_encrypted`;
  await env.DB.prepare(`
    UPDATE users
    SET ${column} = ?, api_keys_updated_at = unixepoch()
    WHERE id = ?
  `).bind(encrypted, auth.userId).run();

  return c.json({ success: true, provider });
});

/**
 * DELETE /api-keys/:provider - Remove API key for a provider
 */
modelSettingsRoutes.delete('/api-keys/:provider', async (c) => {
  const env = c.env;
  const auth = getAuthContext(c);
  const provider = c.req.param('provider');

  const validProviders = ['openai', 'anthropic', 'google', 'groq'];
  if (!validProviders.includes(provider)) {
    return c.json({ error: 'Invalid provider' }, 400);
  }

  const column = `${provider}_api_key_encrypted`;
  await env.DB.prepare(`
    UPDATE users
    SET ${column} = NULL, api_keys_updated_at = unixepoch()
    WHERE id = ?
  `).bind(auth.userId).run();

  return c.json({ success: true, message: `${provider} API key removed` });
});

/**
 * POST /api-keys/:provider/test - Test API key by making a simple call
 */
modelSettingsRoutes.post('/api-keys/:provider/test', async (c) => {
  const env = c.env;
  const auth = getAuthContext(c);
  const provider = c.req.param('provider');

  const paidTiers = ['pro', 'premium', 'admin'];
  if (!paidTiers.includes(auth.role || 'free')) {
    return c.json({ error: 'Upgrade required' }, 403);
  }

  const validProviders = ['openai', 'anthropic', 'google', 'groq'];
  if (!validProviders.includes(provider)) {
    return c.json({ error: 'Invalid provider' }, 400);
  }

  // Get the encrypted key
  const column = `${provider}_api_key_encrypted`;
  const user = await env.DB.prepare(`
    SELECT ${column} as encrypted_key FROM users WHERE id = ?
  `).bind(auth.userId).first();

  if (!user?.encrypted_key) {
    return c.json({ error: 'No API key configured for this provider' }, 400);
  }

  try {
    const apiKey = await decryptAPIKey(
      user.encrypted_key as string,
      env.JWT_SECRET,
      auth.userId
    );

    // Make a minimal test call based on provider
    let testResult: { valid: boolean; message: string };

    switch (provider) {
      case 'openai': {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        testResult = {
          valid: response.ok,
          message: response.ok ? 'API key is valid' : `Error: ${response.status}`,
        };
        break;
      }
      case 'anthropic': {
        // Anthropic doesn't have a simple /models endpoint, so we just verify key format
        testResult = {
          valid: apiKey.startsWith('sk-ant-'),
          message: apiKey.startsWith('sk-ant-') ? 'API key format is valid' : 'Invalid key format',
        };
        break;
      }
      case 'google': {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        testResult = {
          valid: response.ok,
          message: response.ok ? 'API key is valid' : `Error: ${response.status}`,
        };
        break;
      }
      case 'groq': {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        testResult = {
          valid: response.ok,
          message: response.ok ? 'API key is valid' : `Error: ${response.status}`,
        };
        break;
      }
      default:
        testResult = { valid: false, message: 'Unknown provider' };
    }

    return c.json(testResult);
  } catch (error) {
    return c.json({
      valid: false,
      message: error instanceof Error ? error.message : 'Test failed',
    });
  }
});

/**
 * GET /usage - Get API usage summary for current month
 */
modelSettingsRoutes.get('/usage', async (c) => {
  const env = c.env;
  const auth = getAuthContext(c);
  const yearMonth = c.req.query('month'); // Optional: '2025-12'

  const usage = await getUserUsageSummary(env, auth.userId, yearMonth || undefined);

  // Calculate totals
  const totalCost = usage.reduce((sum, u) => sum + u.totalEstimatedCost, 0);
  const totalCalls = usage.reduce((sum, u) => sum + u.callCount, 0);

  return c.json({
    month: yearMonth || new Date().toISOString().slice(0, 7),
    byProvider: usage,
    totals: {
      estimatedCost: totalCost,
      callCount: totalCalls,
    },
  });
});

/**
 * GET /usage/history - Get usage history for multiple months
 */
modelSettingsRoutes.get('/usage/history', async (c) => {
  const env = c.env;
  const auth = getAuthContext(c);
  const months = parseInt(c.req.query('months') || '6');

  const result = await env.DB.prepare(`
    SELECT
      year_month,
      provider,
      total_tokens_input,
      total_tokens_output,
      total_estimated_cost,
      call_count
    FROM api_key_usage_monthly
    WHERE user_id = ?
    ORDER BY year_month DESC
    LIMIT ?
  `).bind(auth.userId, months * 5).all(); // 5 providers max per month

  // Group by month
  const byMonth: Record<string, {
    providers: Record<string, any>;
    totalCost: number;
    totalCalls: number;
  }> = {};

  for (const row of result.results || []) {
    const month = row.year_month as string;
    if (!byMonth[month]) {
      byMonth[month] = { providers: {}, totalCost: 0, totalCalls: 0 };
    }
    byMonth[month].providers[row.provider as string] = {
      tokensInput: row.total_tokens_input,
      tokensOutput: row.total_tokens_output,
      estimatedCost: row.total_estimated_cost,
      callCount: row.call_count,
    };
    byMonth[month].totalCost += row.total_estimated_cost as number;
    byMonth[month].totalCalls += row.call_count as number;
  }

  return c.json({ history: byMonth });
});

export default modelSettingsRoutes;
