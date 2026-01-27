/**
 * Feature Flag Service
 *
 * Persistent feature flag management with tier-based gating and gradual rollouts.
 *
 * @module @humanizer/core/aui/service/feature-flag-service
 */

import type { Pool } from 'pg';
import {
  GET_AUI_FEATURE_FLAG,
  LIST_AUI_FEATURE_FLAGS,
  UPSERT_AUI_FEATURE_FLAG,
  DELETE_AUI_FEATURE_FLAG,
} from '../../storage/schema-aui.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FeatureFlag {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  category: 'core' | 'premium' | 'beta' | 'experimental';
  enabled: boolean;
  rolloutPercentage: number;
  tierOverrides: Array<{ tier: string; enabled: boolean }>;
  createdBy?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlagInput {
  id: string;
  name: string;
  description?: string;
  category?: 'core' | 'premium' | 'beta' | 'experimental';
  enabled?: boolean;
  rolloutPercentage?: number;
  tierOverrides?: Array<{ tier: string; enabled: boolean }>;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export interface FeatureFlagCheckResult {
  id: string;
  enabled: boolean;
  reason: 'global_disabled' | 'tier_override' | 'rollout_excluded' | 'enabled';
}

// ═══════════════════════════════════════════════════════════════════════════
// ROW CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

interface FeatureFlagRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: string;
  enabled: boolean;
  rollout_percentage: number | null;
  tier_overrides: unknown;
  created_by: string | null;
  metadata: unknown;
  created_at: Date;
  updated_at: Date;
}

function rowToFeatureFlag(row: FeatureFlagRow): FeatureFlag {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category as FeatureFlag['category'],
    enabled: row.enabled,
    rolloutPercentage: row.rollout_percentage ?? 100,
    tierOverrides: (row.tier_overrides as Array<{ tier: string; enabled: boolean }>) ?? [],
    createdBy: row.created_by ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export class FeatureFlagService {
  private pool: Pool;
  private tenantId: string;

  constructor(pool: Pool, tenantId = 'humanizer') {
    this.pool = pool;
    this.tenantId = tenantId;
  }

  /**
   * Get a specific feature flag
   */
  async getFlag(id: string): Promise<FeatureFlag | null> {
    const result = await this.pool.query<FeatureFlagRow>(GET_AUI_FEATURE_FLAG, [
      this.tenantId,
      id,
    ]);
    return result.rows[0] ? rowToFeatureFlag(result.rows[0]) : null;
  }

  /**
   * List all feature flags
   */
  async listFlags(): Promise<FeatureFlag[]> {
    const result = await this.pool.query<FeatureFlagRow>(LIST_AUI_FEATURE_FLAGS, [this.tenantId]);
    return result.rows.map(rowToFeatureFlag);
  }

  /**
   * Create or update a feature flag
   */
  async upsertFlag(input: FeatureFlagInput): Promise<FeatureFlag> {
    const result = await this.pool.query<FeatureFlagRow>(UPSERT_AUI_FEATURE_FLAG, [
      input.id,
      this.tenantId,
      input.name,
      input.description ?? null,
      input.category ?? 'core',
      input.enabled ?? true,
      input.rolloutPercentage ?? 100,
      JSON.stringify(input.tierOverrides ?? []),
      input.createdBy ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]);
    return rowToFeatureFlag(result.rows[0]);
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(id: string): Promise<boolean> {
    const result = await this.pool.query(DELETE_AUI_FEATURE_FLAG, [this.tenantId, id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Check if a feature is enabled for a user
   */
  async isEnabled(
    featureId: string,
    userTier: string,
    userId?: string
  ): Promise<FeatureFlagCheckResult> {
    const flag = await this.getFlag(featureId);

    if (!flag) {
      return { id: featureId, enabled: false, reason: 'global_disabled' };
    }

    // Check global enable
    if (!flag.enabled) {
      return { id: featureId, enabled: false, reason: 'global_disabled' };
    }

    // Check tier override
    const tierOverride = flag.tierOverrides.find((o) => o.tier === userTier);
    if (tierOverride !== undefined) {
      return {
        id: featureId,
        enabled: tierOverride.enabled,
        reason: tierOverride.enabled ? 'enabled' : 'tier_override',
      };
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100 && userId) {
      // Use userId hash to determine rollout bucket (consistent per user)
      const hash = this.hashString(userId + featureId);
      const bucket = hash % 100;
      if (bucket >= flag.rolloutPercentage) {
        return { id: featureId, enabled: false, reason: 'rollout_excluded' };
      }
    }

    return { id: featureId, enabled: true, reason: 'enabled' };
  }

  /**
   * Simple string hash for rollout bucketing
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let featureFlagServiceInstance: FeatureFlagService | null = null;

export function initFeatureFlagService(pool: Pool, tenantId?: string): FeatureFlagService {
  featureFlagServiceInstance = new FeatureFlagService(pool, tenantId);
  return featureFlagServiceInstance;
}

export function getFeatureFlagService(): FeatureFlagService | null {
  return featureFlagServiceInstance;
}
