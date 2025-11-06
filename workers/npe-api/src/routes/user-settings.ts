// User settings routes - API key management and preferences
import { Hono } from 'hono';
import { requireAuth, requireProPlus, getAuthContext } from '../middleware/auth';
import { encryptAPIKey, decryptAPIKey } from '../utils/encryption';
import type { Env } from '../../shared/types';

const userSettingsRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /user/api-keys - Set or update API keys (PRO+ only)
 *
 * Request body:
 * {
 *   openai_api_key?: string | null,
 *   anthropic_api_key?: string | null,
 *   google_api_key?: string | null
 * }
 *
 * Use null to delete a specific API key
 */
userSettingsRoutes.post('/api-keys', requireAuth(), requireProPlus(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json() as {
      openai_api_key?: string | null;
      anthropic_api_key?: string | null;
      google_api_key?: string | null;
    };

    // Validate at least one key is provided
    if (!body.openai_api_key && !body.anthropic_api_key && !body.google_api_key &&
        body.openai_api_key !== null && body.anthropic_api_key !== null && body.google_api_key !== null) {
      return c.json({ error: 'At least one API key must be provided' }, 400);
    }

    // Encrypt keys that are provided (skip null values which mean delete)
    const encryptedKeys: Record<string, string | null> = {};

    if (body.openai_api_key !== undefined) {
      encryptedKeys.openai_api_key_encrypted = body.openai_api_key === null
        ? null
        : await encryptAPIKey(body.openai_api_key, c.env.JWT_SECRET, auth.userId);
    }

    if (body.anthropic_api_key !== undefined) {
      encryptedKeys.anthropic_api_key_encrypted = body.anthropic_api_key === null
        ? null
        : await encryptAPIKey(body.anthropic_api_key, c.env.JWT_SECRET, auth.userId);
    }

    if (body.google_api_key !== undefined) {
      encryptedKeys.google_api_key_encrypted = body.google_api_key === null
        ? null
        : await encryptAPIKey(body.google_api_key, c.env.JWT_SECRET, auth.userId);
    }

    // Build dynamic UPDATE query
    const updateFields: string[] = [];
    const bindings: any[] = [];

    if (encryptedKeys.openai_api_key_encrypted !== undefined) {
      updateFields.push('openai_api_key_encrypted = ?');
      bindings.push(encryptedKeys.openai_api_key_encrypted);
    }

    if (encryptedKeys.anthropic_api_key_encrypted !== undefined) {
      updateFields.push('anthropic_api_key_encrypted = ?');
      bindings.push(encryptedKeys.anthropic_api_key_encrypted);
    }

    if (encryptedKeys.google_api_key_encrypted !== undefined) {
      updateFields.push('google_api_key_encrypted = ?');
      bindings.push(encryptedKeys.google_api_key_encrypted);
    }

    // Always update timestamp
    updateFields.push('api_keys_updated_at = ?');
    bindings.push(Date.now());

    // Add user_id to bindings
    bindings.push(auth.userId);

    // Execute update
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    await c.env.DB.prepare(query).bind(...bindings).run();

    return c.json({
      success: true,
      message: 'API keys updated successfully',
      updated: Object.keys(encryptedKeys)
    }, 200);

  } catch (error) {
    console.error('API key update error:', error);
    // Never log the actual API keys
    return c.json({ error: 'Failed to update API keys' }, 500);
  }
});

/**
 * GET /user/api-keys/status - Check which API keys are configured (PRO+ only)
 *
 * Returns which providers have keys configured (not the actual keys)
 */
userSettingsRoutes.get('/api-keys/status', requireAuth(), requireProPlus(), async (c) => {
  try {
    const auth = getAuthContext(c);

    const row = await c.env.DB.prepare(
      'SELECT openai_api_key_encrypted, anthropic_api_key_encrypted, google_api_key_encrypted, api_keys_updated_at FROM users WHERE id = ?'
    ).bind(auth.userId).first();

    if (!row) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      has_openai_key: !!row.openai_api_key_encrypted,
      has_anthropic_key: !!row.anthropic_api_key_encrypted,
      has_google_key: !!row.google_api_key_encrypted,
      last_updated: row.api_keys_updated_at as number | null
    }, 200);

  } catch (error) {
    console.error('API key status check error:', error);
    return c.json({ error: 'Failed to check API key status' }, 500);
  }
});

/**
 * DELETE /user/api-keys/:provider - Delete a specific API key (PRO+ only)
 *
 * :provider = openai | anthropic | google
 */
userSettingsRoutes.delete('/api-keys/:provider', requireAuth(), requireProPlus(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const provider = c.req.param('provider');

    // Validate provider
    const validProviders = ['openai', 'anthropic', 'google'];
    if (!validProviders.includes(provider)) {
      return c.json({ error: 'Invalid provider. Must be: openai, anthropic, or google' }, 400);
    }

    const column = `${provider}_api_key_encrypted`;

    // Delete the key
    await c.env.DB.prepare(
      `UPDATE users SET ${column} = NULL, api_keys_updated_at = ? WHERE id = ?`
    ).bind(Date.now(), auth.userId).run();

    return c.json({
      success: true,
      message: `${provider} API key deleted successfully`
    }, 200);

  } catch (error) {
    console.error('API key deletion error:', error);
    return c.json({ error: 'Failed to delete API key' }, 500);
  }
});

/**
 * GET /user/api-keys/:provider/decrypt - Decrypt and return a specific API key (PRO+ only)
 *
 * WARNING: This endpoint returns the actual decrypted key
 * Should only be used when necessary (e.g., for testing connections)
 *
 * :provider = openai | anthropic | google
 */
userSettingsRoutes.get('/api-keys/:provider/decrypt', requireAuth(), requireProPlus(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const provider = c.req.param('provider');

    // Validate provider
    const validProviders = ['openai', 'anthropic', 'google'];
    if (!validProviders.includes(provider)) {
      return c.json({ error: 'Invalid provider. Must be: openai, anthropic, or google' }, 400);
    }

    const column = `${provider}_api_key_encrypted`;

    // Fetch encrypted key
    const row = await c.env.DB.prepare(
      `SELECT ${column} FROM users WHERE id = ?`
    ).bind(auth.userId).first();

    if (!row) {
      return c.json({ error: 'User not found' }, 404);
    }

    const encryptedKey = row[column] as string | null;

    if (!encryptedKey) {
      return c.json({ error: `No ${provider} API key configured` }, 404);
    }

    // Decrypt the key
    const decryptedKey = await decryptAPIKey(encryptedKey, c.env.JWT_SECRET, auth.userId);

    return c.json({
      provider,
      api_key: decryptedKey
    }, 200);

  } catch (error) {
    console.error('API key decryption error:', error);
    // Never log the actual key
    return c.json({ error: 'Failed to decrypt API key' }, 500);
  }
});

/**
 * GET /user/preferences - Get user preferences (model, length, etc.)
 */
userSettingsRoutes.get('/preferences', requireAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);

    const row = await c.env.DB.prepare(
      'SELECT preferred_model, preferred_length FROM users WHERE id = ?'
    ).bind(auth.userId).first();

    if (!row) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      preferred_model: row.preferred_model as string || '@cf/meta/llama-3.1-8b-instruct',
      preferred_length: row.preferred_length as string || 'same'
    }, 200);

  } catch (error) {
    console.error('Preferences fetch error:', error);
    return c.json({ error: 'Failed to fetch preferences' }, 500);
  }
});

/**
 * PATCH /user/preferences - Update user preferences
 *
 * Request body:
 * {
 *   preferred_model?: string,
 *   preferred_length?: 'shorter' | 'same' | 'longer' | 'much_longer'
 * }
 */
userSettingsRoutes.patch('/preferences', requireAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json() as {
      preferred_model?: string;
      preferred_length?: string;
    };

    // Validate length if provided
    if (body.preferred_length) {
      const validLengths = ['shorter', 'same', 'longer', 'much_longer'];
      if (!validLengths.includes(body.preferred_length)) {
        return c.json({ error: 'Invalid preferred_length. Must be: shorter, same, longer, or much_longer' }, 400);
      }
    }

    // Build dynamic UPDATE query
    const updateFields: string[] = [];
    const bindings: any[] = [];

    if (body.preferred_model !== undefined) {
      updateFields.push('preferred_model = ?');
      bindings.push(body.preferred_model);
    }

    if (body.preferred_length !== undefined) {
      updateFields.push('preferred_length = ?');
      bindings.push(body.preferred_length);
    }

    if (updateFields.length === 0) {
      return c.json({ error: 'No preferences to update' }, 400);
    }

    bindings.push(auth.userId);

    // Execute update
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    await c.env.DB.prepare(query).bind(...bindings).run();

    return c.json({
      success: true,
      message: 'Preferences updated successfully'
    }, 200);

  } catch (error) {
    console.error('Preferences update error:', error);
    return c.json({ error: 'Failed to update preferences' }, 500);
  }
});

export default userSettingsRoutes;
