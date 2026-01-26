/**
 * Usage Service
 *
 * Persistent usage tracking and quota enforcement service.
 * Replaces in-memory tracking in AdminService with PostgreSQL storage.
 *
 * Features:
 * - Pre-flight quota checks before LLM operations
 * - Atomic usage recording after LLM calls
 * - Aggregated usage snapshots for fast quota lookups
 * - Cost tracking with provider/user charge separation
 * - Admin reporting and analytics
 *
 * @module @humanizer/core/aui/service/usage-service
 */

import { randomUUID } from 'crypto';
import type { Pool, PoolClient } from 'pg';
import {
  INSERT_AUI_USAGE_EVENT,
  GET_AUI_USER_USAGE_SNAPSHOT,
  UPSERT_AUI_USER_USAGE_SNAPSHOT,
  INCREMENT_AUI_USER_USAGE,
  GET_AUI_USAGE_EVENTS_AGGREGATE,
  GET_AUI_TIER_DEFAULT,
  GET_AUI_USER_QUOTA_OVERRIDE,
  GET_AUI_PROVIDER_COST_RATE,
} from '../../storage/schema-aui.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Usage event entry for recording LLM calls
 */
export interface UsageEntry {
  userId: string;
  tenantId?: string;
  operationType: string;
  modelId: string;
  modelProvider: string;
  tokensInput: number;
  tokensOutput: number;
  providerCostMillicents?: number;
  userChargeMillicents?: number;
  latencyMs?: number;
  status?: 'completed' | 'failed' | 'timeout' | 'rate_limited';
  error?: string;
  sessionId?: string;
  requestId?: string;
  apiKeyId?: string;
}

/**
 * Result of quota pre-flight check
 */
export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  usage: {
    tokensUsed: number;
    tokensLimit: number;
    requestsUsed: number;
    requestsLimit: number;
    percentUsed: number;
  };
  tier: string;
  hasOverride: boolean;
}

/**
 * User usage summary for a billing period
 */
export interface UserUsageSummary {
  userId: string;
  tenantId: string;
  billingPeriod: string;
  tokensUsed: number;
  requestsCount: number;
  costMillicents: number;
  tokensLimit: number;
  requestsLimit: number;
  costLimitMillicents: number;
  byModel: Record<string, { tokens: number; requests: number; cost: number }>;
  byOperation: Record<string, { tokens: number; requests: number; cost: number }>;
  updatedAt: Date;
}

/**
 * Admin cost/usage report
 */
export interface UsageReport {
  period: { start: Date; end: Date };
  totalTokens: number;
  totalRequests: number;
  totalProviderCostMillicents: number;
  totalUserChargeMillicents: number;
  marginMillicents: number;
  byUser: Map<string, { tokens: number; requests: number; cost: number }>;
  byModel: Map<string, { tokens: number; requests: number; cost: number }>;
  byOperation: Map<string, { tokens: number; requests: number; cost: number }>;
}

/**
 * Options for UsageService
 */
export interface UsageServiceOptions {
  defaultTenantId?: string;
  defaultUserTier?: string;
  cacheTtlMs?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// USAGE SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * UsageService provides persistent usage tracking and quota enforcement.
 */
export class UsageService {
  private pool: Pool;
  private options: Required<UsageServiceOptions>;

  // In-memory cache for hot path (quota checks)
  private snapshotCache: Map<string, { snapshot: UserUsageSummary; expiresAt: number }> = new Map();
  private tierCache: Map<string, { tier: TierDefaults; expiresAt: number }> = new Map();

  constructor(pool: Pool, options?: UsageServiceOptions) {
    this.pool = pool;
    this.options = {
      defaultTenantId: options?.defaultTenantId ?? 'humanizer',
      defaultUserTier: options?.defaultUserTier ?? 'free',
      cacheTtlMs: options?.cacheTtlMs ?? 60_000, // 1 minute cache
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUOTA ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Pre-flight check: Can user perform this operation?
   * Call this BEFORE making an LLM request.
   */
  async canPerform(
    userId: string,
    estimatedTokens: number,
    tenantId?: string
  ): Promise<QuotaCheckResult> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const billingPeriod = this.getCurrentBillingPeriod();

    // Get current usage (with caching for performance)
    const usage = await this.getOrCreateUsageSnapshot(userId, tenant, billingPeriod);

    // Check if limits are unlimited (-1)
    const isUnlimited =
      usage.tokensLimit === -1 || usage.requestsLimit === -1 || usage.costLimitMillicents === -1;

    if (isUnlimited) {
      return {
        allowed: true,
        usage: {
          tokensUsed: usage.tokensUsed,
          tokensLimit: usage.tokensLimit,
          requestsUsed: usage.requestsCount,
          requestsLimit: usage.requestsLimit,
          percentUsed: 0,
        },
        tier: 'unlimited',
        hasOverride: false,
      };
    }

    // Check token limit
    const projectedTokens = usage.tokensUsed + estimatedTokens;
    if (projectedTokens > usage.tokensLimit) {
      return {
        allowed: false,
        reason: `Token limit exceeded. Used: ${usage.tokensUsed}, Limit: ${usage.tokensLimit}, Requested: ${estimatedTokens}`,
        usage: {
          tokensUsed: usage.tokensUsed,
          tokensLimit: usage.tokensLimit,
          requestsUsed: usage.requestsCount,
          requestsLimit: usage.requestsLimit,
          percentUsed: (usage.tokensUsed / usage.tokensLimit) * 100,
        },
        tier: 'exceeded',
        hasOverride: false,
      };
    }

    // Check request limit
    if (usage.requestsCount >= usage.requestsLimit) {
      return {
        allowed: false,
        reason: `Request limit exceeded. Used: ${usage.requestsCount}, Limit: ${usage.requestsLimit}`,
        usage: {
          tokensUsed: usage.tokensUsed,
          tokensLimit: usage.tokensLimit,
          requestsUsed: usage.requestsCount,
          requestsLimit: usage.requestsLimit,
          percentUsed: (usage.requestsCount / usage.requestsLimit) * 100,
        },
        tier: 'exceeded',
        hasOverride: false,
      };
    }

    const percentUsed = Math.max(
      (usage.tokensUsed / usage.tokensLimit) * 100,
      (usage.requestsCount / usage.requestsLimit) * 100
    );

    return {
      allowed: true,
      usage: {
        tokensUsed: usage.tokensUsed,
        tokensLimit: usage.tokensLimit,
        requestsUsed: usage.requestsCount,
        requestsLimit: usage.requestsLimit,
        percentUsed,
      },
      tier: 'within_limits',
      hasOverride: false,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USAGE RECORDING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record an LLM call. Call this AFTER the LLM request completes.
   */
  async recordCall(entry: UsageEntry): Promise<void> {
    const tenant = entry.tenantId ?? this.options.defaultTenantId;
    const billingPeriod = this.getCurrentBillingPeriod();

    // Calculate costs if not provided
    let providerCost = entry.providerCostMillicents ?? 0;
    let userCharge = entry.userChargeMillicents ?? 0;

    if (!entry.providerCostMillicents) {
      providerCost = await this.calculateProviderCost(
        entry.modelProvider,
        entry.modelId,
        entry.tokensInput,
        entry.tokensOutput
      );
    }

    if (!entry.userChargeMillicents) {
      // User charge = provider cost + margin (e.g., 20%)
      userCharge = Math.ceil(providerCost * 1.2);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert usage event (audit log)
      const eventId = randomUUID();
      await client.query(INSERT_AUI_USAGE_EVENT, [
        eventId,
        tenant,
        entry.userId,
        entry.operationType,
        entry.modelId,
        entry.modelProvider,
        entry.tokensInput,
        entry.tokensOutput,
        providerCost,
        userCharge,
        entry.latencyMs ?? null,
        entry.status ?? 'completed',
        entry.error ?? null,
        entry.sessionId ?? null,
        entry.requestId ?? null,
        entry.apiKeyId ?? null,
        billingPeriod,
        new Date(),
      ]);

      // 2. Update usage snapshot (atomic increment)
      const totalTokens = entry.tokensInput + entry.tokensOutput;
      const result = await client.query(INCREMENT_AUI_USER_USAGE, [
        entry.userId,
        tenant,
        billingPeriod,
        totalTokens,
        userCharge,
      ]);

      // If no rows updated, create snapshot first
      if (result.rowCount === 0) {
        const tierDefaults = await this.getTierDefaults(entry.userId, tenant, client);
        await client.query(UPSERT_AUI_USER_USAGE_SNAPSHOT, [
          entry.userId,
          tenant,
          billingPeriod,
          totalTokens,
          1, // requests_count
          userCharge,
          tierDefaults.tokensPerMonth,
          tierDefaults.requestsPerMonth,
          tierDefaults.costCentsPerMonth * 1000, // Convert cents to millicents
          JSON.stringify({ [entry.modelId]: { tokens: totalTokens, requests: 1, cost: userCharge } }),
          JSON.stringify({ [entry.operationType]: { tokens: totalTokens, requests: 1, cost: userCharge } }),
          new Date(),
        ]);
      }

      await client.query('COMMIT');

      // Invalidate cache
      this.invalidateSnapshotCache(entry.userId, tenant, billingPeriod);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USAGE QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get usage summary for a user in a billing period.
   */
  async getUsage(
    userId: string,
    billingPeriod?: string,
    tenantId?: string
  ): Promise<UserUsageSummary | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const period = billingPeriod ?? this.getCurrentBillingPeriod();

    const result = await this.pool.query(GET_AUI_USER_USAGE_SNAPSHOT, [userId, tenant, period]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return this.rowToUsageSummary(row);
  }

  /**
   * Get aggregated usage report for admin analytics.
   */
  async getUsageReport(options: {
    startDate: Date;
    endDate?: Date;
    userId?: string;
    tenantId?: string;
  }): Promise<UsageReport> {
    const tenant = options.tenantId ?? this.options.defaultTenantId;
    const endDate = options.endDate ?? new Date();
    const billingPeriod = options.userId ? null : this.getCurrentBillingPeriod();

    const result = await this.pool.query(GET_AUI_USAGE_EVENTS_AGGREGATE, [
      options.userId ?? null,
      billingPeriod,
      options.startDate,
      endDate,
    ]);

    // Aggregate results
    let totalTokens = 0;
    let totalRequests = 0;
    let totalProviderCost = 0;
    let totalUserCharge = 0;
    const byUser = new Map<string, { tokens: number; requests: number; cost: number }>();
    const byModel = new Map<string, { tokens: number; requests: number; cost: number }>();
    const byOperation = new Map<string, { tokens: number; requests: number; cost: number }>();

    for (const row of result.rows) {
      totalTokens += parseInt(row.total_tokens, 10);
      totalRequests += parseInt(row.request_count, 10);
      totalProviderCost += parseInt(row.total_provider_cost, 10);
      totalUserCharge += parseInt(row.total_user_charge, 10);

      // By model
      const modelKey = row.model_id;
      const modelEntry = byModel.get(modelKey) ?? { tokens: 0, requests: 0, cost: 0 };
      modelEntry.tokens += parseInt(row.total_tokens, 10);
      modelEntry.requests += parseInt(row.request_count, 10);
      modelEntry.cost += parseInt(row.total_user_charge, 10);
      byModel.set(modelKey, modelEntry);

      // By operation
      const opKey = row.operation_type;
      const opEntry = byOperation.get(opKey) ?? { tokens: 0, requests: 0, cost: 0 };
      opEntry.tokens += parseInt(row.total_tokens, 10);
      opEntry.requests += parseInt(row.request_count, 10);
      opEntry.cost += parseInt(row.total_user_charge, 10);
      byOperation.set(opKey, opEntry);
    }

    return {
      period: { start: options.startDate, end: endDate },
      totalTokens,
      totalRequests,
      totalProviderCostMillicents: totalProviderCost,
      totalUserChargeMillicents: totalUserCharge,
      marginMillicents: totalUserCharge - totalProviderCost,
      byUser,
      byModel,
      byOperation,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get current billing period in YYYY-MM format.
   */
  private getCurrentBillingPeriod(): string {
    return new Date().toISOString().substring(0, 7);
  }

  /**
   * Get or create a usage snapshot for the current period.
   */
  private async getOrCreateUsageSnapshot(
    userId: string,
    tenantId: string,
    billingPeriod: string
  ): Promise<UserUsageSummary> {
    // Check cache first
    const cacheKey = `${userId}:${tenantId}:${billingPeriod}`;
    const cached = this.snapshotCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.snapshot;
    }

    // Query database
    const result = await this.pool.query(GET_AUI_USER_USAGE_SNAPSHOT, [
      userId,
      tenantId,
      billingPeriod,
    ]);

    if (result.rows.length > 0) {
      const snapshot = this.rowToUsageSummary(result.rows[0]);
      this.snapshotCache.set(cacheKey, {
        snapshot,
        expiresAt: Date.now() + this.options.cacheTtlMs,
      });
      return snapshot;
    }

    // Create new snapshot with tier defaults
    const tierDefaults = await this.getTierDefaults(userId, tenantId);

    const newSnapshot: UserUsageSummary = {
      userId,
      tenantId,
      billingPeriod,
      tokensUsed: 0,
      requestsCount: 0,
      costMillicents: 0,
      tokensLimit: tierDefaults.tokensPerMonth,
      requestsLimit: tierDefaults.requestsPerMonth,
      costLimitMillicents: tierDefaults.costCentsPerMonth * 1000,
      byModel: {},
      byOperation: {},
      updatedAt: new Date(),
    };

    // Insert the new snapshot
    await this.pool.query(UPSERT_AUI_USER_USAGE_SNAPSHOT, [
      userId,
      tenantId,
      billingPeriod,
      0, // tokens_used
      0, // requests_count
      0, // cost_millicents
      newSnapshot.tokensLimit,
      newSnapshot.requestsLimit,
      newSnapshot.costLimitMillicents,
      '{}', // by_model
      '{}', // by_operation
      new Date(),
    ]);

    this.snapshotCache.set(cacheKey, {
      snapshot: newSnapshot,
      expiresAt: Date.now() + this.options.cacheTtlMs,
    });

    return newSnapshot;
  }

  /**
   * Get tier defaults for a user (considering overrides).
   */
  private async getTierDefaults(
    userId: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<TierDefaults> {
    const conn = client ?? this.pool;

    // Check for user-specific override first
    const overrideResult = await conn.query(GET_AUI_USER_QUOTA_OVERRIDE, [userId, tenantId]);
    if (overrideResult.rows.length > 0) {
      const override = overrideResult.rows[0];
      // Get base tier and merge overrides
      const tierResult = await conn.query(GET_AUI_TIER_DEFAULT, [
        tenantId,
        this.options.defaultUserTier,
      ]);
      const baseTier = tierResult.rows[0] ?? getDefaultTierDefaults();

      return {
        tier: baseTier.tier,
        tokensPerMonth: override.tokens_per_month ?? baseTier.tokens_per_month,
        requestsPerMonth: override.requests_per_month ?? baseTier.requests_per_month,
        costCentsPerMonth: override.cost_cents_per_month ?? baseTier.cost_cents_per_month,
        requestsPerMinute: baseTier.requests_per_minute,
        maxApiKeys: baseTier.max_api_keys,
      };
    }

    // Check cache for tier
    const tierCacheKey = `${tenantId}:${this.options.defaultUserTier}`;
    const cachedTier = this.tierCache.get(tierCacheKey);
    if (cachedTier && cachedTier.expiresAt > Date.now()) {
      return cachedTier.tier;
    }

    // Query tier defaults
    const tierResult = await conn.query(GET_AUI_TIER_DEFAULT, [
      tenantId,
      this.options.defaultUserTier,
    ]);

    if (tierResult.rows.length === 0) {
      return getDefaultTierDefaults();
    }

    const row = tierResult.rows[0];
    const tier: TierDefaults = {
      tier: row.tier,
      tokensPerMonth: row.tokens_per_month,
      requestsPerMonth: row.requests_per_month,
      costCentsPerMonth: row.cost_cents_per_month,
      requestsPerMinute: row.requests_per_minute,
      maxApiKeys: row.max_api_keys,
    };

    this.tierCache.set(tierCacheKey, {
      tier,
      expiresAt: Date.now() + this.options.cacheTtlMs * 5, // Longer TTL for tiers
    });

    return tier;
  }

  /**
   * Calculate provider cost for tokens.
   */
  private async calculateProviderCost(
    provider: string,
    modelId: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<number> {
    const result = await this.pool.query(GET_AUI_PROVIDER_COST_RATE, [provider, modelId]);

    if (result.rows.length === 0) {
      // Fallback to zero cost (local models)
      return 0;
    }

    const rate = result.rows[0];
    const inputCost = (inputTokens / 1_000_000) * rate.input_cost_per_mtok;
    const outputCost = (outputTokens / 1_000_000) * rate.output_cost_per_mtok;

    return Math.ceil(inputCost + outputCost);
  }

  /**
   * Convert database row to UsageSummary.
   */
  private rowToUsageSummary(row: Record<string, unknown>): UserUsageSummary {
    return {
      userId: row.user_id as string,
      tenantId: row.tenant_id as string,
      billingPeriod: row.billing_period as string,
      tokensUsed: row.tokens_used as number,
      requestsCount: row.requests_count as number,
      costMillicents: row.cost_millicents as number,
      tokensLimit: row.tokens_limit as number,
      requestsLimit: row.requests_limit as number,
      costLimitMillicents: row.cost_limit_millicents as number,
      byModel: (row.by_model as Record<string, { tokens: number; requests: number; cost: number }>) ?? {},
      byOperation:
        (row.by_operation as Record<string, { tokens: number; requests: number; cost: number }>) ?? {},
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * Invalidate cached snapshot.
   */
  private invalidateSnapshotCache(userId: string, tenantId: string, billingPeriod: string): void {
    const cacheKey = `${userId}:${tenantId}:${billingPeriod}`;
    this.snapshotCache.delete(cacheKey);
  }

  /**
   * Clear all caches.
   */
  clearCaches(): void {
    this.snapshotCache.clear();
    this.tierCache.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface TierDefaults {
  tier: string;
  tokensPerMonth: number;
  requestsPerMonth: number;
  costCentsPerMonth: number;
  requestsPerMinute: number;
  maxApiKeys: number;
}

function getDefaultTierDefaults(): TierDefaults {
  return {
    tier: 'free',
    tokensPerMonth: 10000,
    requestsPerMonth: 20,
    costCentsPerMonth: 0,
    requestsPerMinute: 5,
    maxApiKeys: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let _usageService: UsageService | null = null;

/**
 * Initialize the global usage service.
 */
export function initUsageService(pool: Pool, options?: UsageServiceOptions): UsageService {
  _usageService = new UsageService(pool, options);
  return _usageService;
}

/**
 * Get the global usage service.
 */
export function getUsageService(): UsageService | null {
  return _usageService;
}

/**
 * Reset the global usage service.
 */
export function resetUsageService(): void {
  _usageService = null;
}
