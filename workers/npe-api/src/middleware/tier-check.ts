// Tier validation middleware for Personalizer feature
import type { Context, Next } from 'hono';
import type { Env } from '../../shared/types';

/**
 * Middleware to require PRO or higher tier for Personalizer features
 * Personalizer is a premium feature requiring PRO, PREMIUM, or ADMIN role
 */
export function requireProPlus() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const auth = c.get('auth');

    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user has PRO or higher tier
    const allowedRoles = ['pro', 'premium', 'admin'];
    if (!allowedRoles.includes(auth.role.toLowerCase())) {
      return c.json({
        error: 'Personalizer requires PRO or higher tier',
        upgrade_url: '/pricing',
        current_tier: auth.role
      }, 403);
    }

    await next();
  };
}

/**
 * Check if user has enough quota for a transformation
 * Returns remaining quota or throws error
 */
export async function checkQuota(
  env: Env,
  userId: string,
  role: string,
  estimatedTokens: number
): Promise<{ remainingTransformations: number; remainingTokens: number }> {
  // Get user's current usage
  const user = await env.DB.prepare(
    'SELECT monthly_transformations, monthly_tokens_used, last_reset_date FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user) {
    throw new Error('User not found');
  }

  const monthlyTransformations = (user.monthly_transformations as number) || 0;
  const monthlyTokensUsed = (user.monthly_tokens_used as number) || 0;

  // Define quota limits per tier
  const quotas: Record<string, { transformations: number; tokens: number }> = {
    free: { transformations: 10, tokens: 5000 },
    member: { transformations: 50, tokens: 100000 },
    pro: { transformations: 200, tokens: 1600000 },
    premium: { transformations: Infinity, tokens: Infinity },
    admin: { transformations: Infinity, tokens: Infinity }
  };

  const userQuota = quotas[role.toLowerCase()] || quotas.free;

  // Check transformation limit
  if (monthlyTransformations >= userQuota.transformations) {
    throw new Error(`Monthly transformation limit reached (${userQuota.transformations})`);
  }

  // Check token limit
  if (monthlyTokensUsed + estimatedTokens > userQuota.tokens) {
    throw new Error(`Monthly token limit would be exceeded (${userQuota.tokens})`);
  }

  return {
    remainingTransformations: userQuota.transformations - monthlyTransformations,
    remainingTokens: userQuota.tokens - monthlyTokensUsed
  };
}

/**
 * Update user's usage after a transformation
 */
export async function updateUsage(
  env: Env,
  userId: string,
  tokensUsed: number
): Promise<void> {
  // Check if we need to reset monthly counters
  const user = await env.DB.prepare(
    'SELECT last_reset_date FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user) {
    throw new Error('User not found');
  }

  const lastReset = user.last_reset_date ? new Date(user.last_reset_date as string) : null;
  const now = new Date();
  const shouldReset = !lastReset ||
    (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear());

  if (shouldReset) {
    // Reset counters for new month
    await env.DB.prepare(`
      UPDATE users
      SET monthly_transformations = 1,
          monthly_tokens_used = ?,
          last_reset_date = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(tokensUsed, userId).run();
  } else {
    // Increment existing counters
    await env.DB.prepare(`
      UPDATE users
      SET monthly_transformations = monthly_transformations + 1,
          monthly_tokens_used = monthly_tokens_used + ?
      WHERE id = ?
    `).bind(tokensUsed, userId).run();
  }
}
