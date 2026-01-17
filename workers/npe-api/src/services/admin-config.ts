/**
 * Admin Config Service
 *
 * Provides CRUD operations for admin configuration with:
 * - Encryption for sensitive values
 * - Audit logging for all changes
 * - Type-safe value parsing
 * - Caching for frequently accessed values
 */

import type { Env } from '../../shared/types';
import {
  encryptConfigValue,
  decryptConfigValue,
  redactValue,
  isEncryptedValue,
} from '../utils/config-encryption';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ConfigCategory = 'pricing' | 'stripe' | 'features' | 'limits' | 'secrets' | 'ui';
export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json';

export interface ConfigValue {
  id: string;
  category: ConfigCategory;
  key: string;
  value: unknown; // Parsed value
  rawValue: string; // Original string value
  valueType: ConfigValueType;
  isEncrypted: boolean;
  isSecret: boolean;
  description: string | null;
  updatedBy: string | null;
  updatedAt: number;
  createdAt: number;
}

export interface ConfigUpdate {
  value: unknown;
  description?: string;
  isSecret?: boolean;
  encrypt?: boolean;
}

export interface AuditEntry {
  id: string;
  configId: string;
  category: string;
  key: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedByEmail: string | null;
  changedAt: number;
  changeType: 'create' | 'update' | 'delete';
  ipAddress: string | null;
  reason: string | null;
}

export interface PricingTier {
  id: string;
  tierKey: string;
  displayName: string;
  description: string | null;
  badgeText: string | null;
  priceCentsMonthly: number;
  priceCentsAnnual: number;
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnual: string | null;
  transformationsPerMonth: number;
  tokensPerMonth: number;
  maxCostPerMonthCents: number;
  canUseCloudProviders: boolean;
  canUseFrontierModels: boolean;
  allowedProviders: string[];
  features: Record<string, boolean>;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}

// In-memory cache for config values (short TTL)
const configCache = new Map<string, { value: ConfigValue; expiresAt: number }>();
const CACHE_TTL_MS = 60000; // 1 minute

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG CRUD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a single config value
 */
export async function getConfig(
  env: Env,
  category: ConfigCategory,
  key: string
): Promise<ConfigValue | null> {
  const cacheKey = `${category}:${key}`;
  const cached = configCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const row = await env.DB.prepare(`
    SELECT * FROM admin_config WHERE category = ? AND key = ?
  `).bind(category, key).first();

  if (!row) return null;

  const config = await rowToConfigValue(row, env);

  // Cache the result
  configCache.set(cacheKey, {
    value: config,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return config;
}

/**
 * Get all config values for a category
 */
export async function getConfigByCategory(
  env: Env,
  category: ConfigCategory
): Promise<ConfigValue[]> {
  const result = await env.DB.prepare(`
    SELECT * FROM admin_config WHERE category = ? ORDER BY key
  `).bind(category).all();

  const configs: ConfigValue[] = [];
  for (const row of result.results) {
    configs.push(await rowToConfigValue(row, env));
  }

  return configs;
}

/**
 * Get all config values
 */
export async function getAllConfig(env: Env): Promise<ConfigValue[]> {
  const result = await env.DB.prepare(`
    SELECT * FROM admin_config ORDER BY category, key
  `).all();

  const configs: ConfigValue[] = [];
  for (const row of result.results) {
    configs.push(await rowToConfigValue(row, env));
  }

  return configs;
}

/**
 * Set a config value (create or update)
 */
export async function setConfig(
  env: Env,
  category: ConfigCategory,
  key: string,
  update: ConfigUpdate,
  userId: string,
  userEmail?: string,
  ipAddress?: string,
  reason?: string
): Promise<ConfigValue> {
  const now = Date.now();
  const existing = await getConfig(env, category, key);

  // Determine value type
  const valueType = getValueType(update.value);

  // Serialize value
  let rawValue = serializeValue(update.value, valueType);

  // Encrypt if requested
  const shouldEncrypt = update.encrypt ?? (category === 'secrets' || category === 'stripe');
  if (shouldEncrypt) {
    rawValue = await encryptConfigValue(rawValue, env);
  }

  const isSecret = update.isSecret ?? shouldEncrypt;

  if (existing) {
    // Update existing
    await env.DB.prepare(`
      UPDATE admin_config SET
        value = ?,
        value_type = ?,
        is_encrypted = ?,
        is_secret = ?,
        description = COALESCE(?, description),
        updated_by = ?,
        updated_at = ?
      WHERE category = ? AND key = ?
    `).bind(
      rawValue,
      valueType,
      shouldEncrypt ? 1 : 0,
      isSecret ? 1 : 0,
      update.description,
      userId,
      now,
      category,
      key
    ).run();

    // Log audit
    await logAudit(env, {
      configId: existing.id,
      category,
      key,
      oldValue: isSecret ? redactValue(existing.rawValue) : existing.rawValue,
      newValue: isSecret ? redactValue(rawValue) : rawValue,
      changedBy: userId,
      changedByEmail: userEmail,
      changedAt: now,
      changeType: 'update',
      ipAddress,
      reason,
    });
  } else {
    // Create new
    const id = `cfg_${category}_${key}_${crypto.randomUUID().slice(0, 8)}`;

    await env.DB.prepare(`
      INSERT INTO admin_config
      (id, category, key, value, value_type, is_encrypted, is_secret, description, updated_by, updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      category,
      key,
      rawValue,
      valueType,
      shouldEncrypt ? 1 : 0,
      isSecret ? 1 : 0,
      update.description ?? null,
      userId,
      now,
      now
    ).run();

    // Log audit
    await logAudit(env, {
      configId: id,
      category,
      key,
      oldValue: null,
      newValue: isSecret ? redactValue(rawValue) : rawValue,
      changedBy: userId,
      changedByEmail: userEmail,
      changedAt: now,
      changeType: 'create',
      ipAddress,
      reason,
    });
  }

  // Invalidate cache
  configCache.delete(`${category}:${key}`);

  // Return updated value
  return (await getConfig(env, category, key))!;
}

/**
 * Delete a config value
 */
export async function deleteConfig(
  env: Env,
  category: ConfigCategory,
  key: string,
  userId: string,
  userEmail?: string,
  ipAddress?: string,
  reason?: string
): Promise<boolean> {
  const existing = await getConfig(env, category, key);
  if (!existing) return false;

  await env.DB.prepare(`
    DELETE FROM admin_config WHERE category = ? AND key = ?
  `).bind(category, key).run();

  // Log audit
  await logAudit(env, {
    configId: existing.id,
    category,
    key,
    oldValue: existing.isSecret ? redactValue(existing.rawValue) : existing.rawValue,
    newValue: null,
    changedBy: userId,
    changedByEmail: userEmail,
    changedAt: Date.now(),
    changeType: 'delete',
    ipAddress,
    reason,
  });

  // Invalidate cache
  configCache.delete(`${category}:${key}`);

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// PRICING TIERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all pricing tiers
 */
export async function getPricingTiers(env: Env, includeInactive = false): Promise<PricingTier[]> {
  const query = includeInactive
    ? 'SELECT * FROM pricing_tiers ORDER BY sort_order'
    : 'SELECT * FROM pricing_tiers WHERE is_active = 1 ORDER BY sort_order';

  const result = await env.DB.prepare(query).all();

  return result.results.map(rowToPricingTier);
}

/**
 * Get a single pricing tier by key
 */
export async function getPricingTier(env: Env, tierKey: string): Promise<PricingTier | null> {
  const row = await env.DB.prepare(`
    SELECT * FROM pricing_tiers WHERE tier_key = ?
  `).bind(tierKey).first();

  return row ? rowToPricingTier(row) : null;
}

/**
 * Update a pricing tier
 */
export async function updatePricingTier(
  env: Env,
  tierKey: string,
  updates: Partial<Omit<PricingTier, 'id' | 'tierKey'>>,
  userId: string
): Promise<PricingTier | null> {
  const existing = await getPricingTier(env, tierKey);
  if (!existing) return null;

  const now = Date.now();

  // Build dynamic update
  const fields: string[] = ['updated_by = ?', 'updated_at = ?'];
  const values: unknown[] = [userId, now];

  if (updates.displayName !== undefined) {
    fields.push('display_name = ?');
    values.push(updates.displayName);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.priceCentsMonthly !== undefined) {
    fields.push('price_cents_monthly = ?');
    values.push(updates.priceCentsMonthly);
  }
  if (updates.priceCentsAnnual !== undefined) {
    fields.push('price_cents_annual = ?');
    values.push(updates.priceCentsAnnual);
  }
  if (updates.stripePriceIdMonthly !== undefined) {
    fields.push('stripe_price_id_monthly = ?');
    values.push(updates.stripePriceIdMonthly);
  }
  if (updates.transformationsPerMonth !== undefined) {
    fields.push('transformations_per_month = ?');
    values.push(updates.transformationsPerMonth);
  }
  if (updates.tokensPerMonth !== undefined) {
    fields.push('tokens_per_month = ?');
    values.push(updates.tokensPerMonth);
  }
  if (updates.maxCostPerMonthCents !== undefined) {
    fields.push('max_cost_per_month_cents = ?');
    values.push(updates.maxCostPerMonthCents);
  }
  if (updates.canUseCloudProviders !== undefined) {
    fields.push('can_use_cloud_providers = ?');
    values.push(updates.canUseCloudProviders ? 1 : 0);
  }
  if (updates.canUseFrontierModels !== undefined) {
    fields.push('can_use_frontier_models = ?');
    values.push(updates.canUseFrontierModels ? 1 : 0);
  }
  if (updates.allowedProviders !== undefined) {
    fields.push('allowed_providers = ?');
    values.push(JSON.stringify(updates.allowedProviders));
  }
  if (updates.features !== undefined) {
    fields.push('features = ?');
    values.push(JSON.stringify(updates.features));
  }
  if (updates.isActive !== undefined) {
    fields.push('is_active = ?');
    values.push(updates.isActive ? 1 : 0);
  }
  if (updates.sortOrder !== undefined) {
    fields.push('sort_order = ?');
    values.push(updates.sortOrder);
  }

  values.push(tierKey);

  await env.DB.prepare(`
    UPDATE pricing_tiers SET ${fields.join(', ')} WHERE tier_key = ?
  `).bind(...values).run();

  return getPricingTier(env, tierKey);
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get audit log entries
 */
export async function getAuditLog(
  env: Env,
  options: {
    configId?: string;
    category?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<AuditEntry[]> {
  const { configId, category, userId, limit = 100, offset = 0 } = options;

  let query = 'SELECT * FROM admin_config_audit WHERE 1=1';
  const params: unknown[] = [];

  if (configId) {
    query += ' AND config_id = ?';
    params.push(configId);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (userId) {
    query += ' AND changed_by = ?';
    params.push(userId);
  }

  query += ' ORDER BY changed_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...params).all();

  return result.results.map(row => ({
    id: row.id as string,
    configId: row.config_id as string,
    category: row.category as string,
    key: row.key as string,
    oldValue: row.old_value as string | null,
    newValue: row.new_value as string | null,
    changedBy: row.changed_by as string,
    changedByEmail: row.changed_by_email as string | null,
    changedAt: row.changed_at as number,
    changeType: row.change_type as 'create' | 'update' | 'delete',
    ipAddress: row.ip_address as string | null,
    reason: row.reason as string | null,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function rowToConfigValue(row: Record<string, unknown>, env: Env): Promise<ConfigValue> {
  let rawValue = row.value as string;
  const isEncrypted = row.is_encrypted === 1;

  // Decrypt if needed
  if (isEncrypted && isEncryptedValue(rawValue)) {
    try {
      rawValue = await decryptConfigValue(rawValue, env);
    } catch (error) {
      console.error(`Failed to decrypt config ${row.category}:${row.key}:`, error);
      // Return encrypted value as-is if decryption fails
    }
  }

  return {
    id: row.id as string,
    category: row.category as ConfigCategory,
    key: row.key as string,
    value: parseValue(rawValue, row.value_type as ConfigValueType),
    rawValue,
    valueType: row.value_type as ConfigValueType,
    isEncrypted,
    isSecret: row.is_secret === 1,
    description: row.description as string | null,
    updatedBy: row.updated_by as string | null,
    updatedAt: row.updated_at as number,
    createdAt: row.created_at as number,
  };
}

function rowToPricingTier(row: Record<string, unknown>): PricingTier {
  return {
    id: row.id as string,
    tierKey: row.tier_key as string,
    displayName: row.display_name as string,
    description: row.description as string | null,
    badgeText: row.badge_text as string | null,
    priceCentsMonthly: row.price_cents_monthly as number,
    priceCentsAnnual: row.price_cents_annual as number,
    stripePriceIdMonthly: row.stripe_price_id_monthly as string | null,
    stripePriceIdAnnual: row.stripe_price_id_annual as string | null,
    transformationsPerMonth: row.transformations_per_month as number,
    tokensPerMonth: row.tokens_per_month as number,
    maxCostPerMonthCents: row.max_cost_per_month_cents as number,
    canUseCloudProviders: row.can_use_cloud_providers === 1,
    canUseFrontierModels: row.can_use_frontier_models === 1,
    allowedProviders: JSON.parse((row.allowed_providers as string) || '[]'),
    features: JSON.parse((row.features as string) || '{}'),
    isActive: row.is_active === 1,
    isDefault: row.is_default === 1,
    sortOrder: row.sort_order as number,
  };
}

function parseValue(rawValue: string, valueType: ConfigValueType): unknown {
  switch (valueType) {
    case 'number':
      return parseFloat(rawValue);
    case 'boolean':
      return rawValue === 'true' || rawValue === '1';
    case 'json':
      try {
        return JSON.parse(rawValue);
      } catch {
        return rawValue;
      }
    case 'string':
    default:
      // Remove surrounding quotes if present (from JSON encoding)
      if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
        return rawValue.slice(1, -1);
      }
      return rawValue;
  }
}

function serializeValue(value: unknown, valueType: ConfigValueType): string {
  switch (valueType) {
    case 'number':
    case 'boolean':
      return String(value);
    case 'json':
      return JSON.stringify(value);
    case 'string':
    default:
      return String(value);
  }
}

function getValueType(value: unknown): ConfigValueType {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object') return 'json';
  return 'string';
}

async function logAudit(
  env: Env,
  entry: Omit<AuditEntry, 'id'>
): Promise<void> {
  const id = `audit_${crypto.randomUUID()}`;

  await env.DB.prepare(`
    INSERT INTO admin_config_audit
    (id, config_id, category, key, old_value, new_value, changed_by, changed_by_email, changed_at, change_type, ip_address, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    entry.configId,
    entry.category,
    entry.key,
    entry.oldValue,
    entry.newValue,
    entry.changedBy,
    entry.changedByEmail ?? null,
    entry.changedAt,
    entry.changeType,
    entry.ipAddress ?? null,
    entry.reason ?? null
  ).run();
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE GETTERS (typed access to common config)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get day pass price in cents
 */
export async function getDayPassPrice(env: Env): Promise<number> {
  const config = await getConfig(env, 'pricing', 'day_pass_price_cents');
  return config ? (config.value as number) : 299;
}

/**
 * Get trial period in days
 */
export async function getTrialDays(env: Env): Promise<number> {
  const config = await getConfig(env, 'pricing', 'trial_days');
  return config ? (config.value as number) : 7;
}

/**
 * Get tax rate
 */
export async function getTaxRate(env: Env): Promise<number> {
  const config = await getConfig(env, 'pricing', 'tax_rate');
  return config ? (config.value as number) : 0.08625;
}

/**
 * Check if signups are enabled
 */
export async function isSignupsEnabled(env: Env): Promise<boolean> {
  const config = await getConfig(env, 'features', 'signups_enabled');
  return config ? (config.value as boolean) : true;
}

/**
 * Check if maintenance mode is active
 */
export async function isMaintenanceMode(env: Env): Promise<boolean> {
  const config = await getConfig(env, 'features', 'maintenance_mode');
  return config ? (config.value as boolean) : false;
}
