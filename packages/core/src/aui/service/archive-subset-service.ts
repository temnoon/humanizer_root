/**
 * Archive Subset Service
 *
 * Manages filtered archive subsets with:
 * - Subset creation with filter criteria
 * - Sensitive content detection and classification
 * - Content redaction for safe sharing
 * - Export to various formats and cloud destinations
 *
 * @module @humanizer/core/aui/service/archive-subset-service
 */

import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import type {
  ArchiveSubset,
  SubsetFilterCriteria,
  SubsetStatus,
  SubsetExportFormat,
  SubsetSharingMode,
  CloudDestination,
  SubsetEncryption,
  SubsetNodeMapping,
  SubsetExportJob,
  ExportJobStatus,
  SensitivityLevel,
  SensitiveContentMarker,
  SensitiveContentType,
  SensitivityDetectionConfig,
  SubsetStats,
} from '../types/subset-types';
import type { StoredNode, QueryOptions, AuthorRole } from '../../storage/types';

// ═══════════════════════════════════════════════════════════════════
// TIER DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * User tier type for feature gating
 */
export type UserTier = 'free' | 'member' | 'pro' | 'premium' | 'admin';

/**
 * Tier hierarchy for comparison (higher = more access)
 */
const TIER_HIERARCHY: Record<UserTier, number> = {
  free: 0,
  member: 1,
  pro: 2,
  premium: 3,
  admin: 4,
};

/**
 * Feature requirements by tier
 */
export const SUBSET_TIER_LIMITS: Record<UserTier, {
  maxSubsets: number;
  maxNodesPerSubset: number;
  allowedExportFormats: SubsetExportFormat[];
  allowedDestinations: ('local' | 'cloudflare-r2' | 'google-drive')[];
  canShare: boolean;
  canRedact: boolean;
}> = {
  free: {
    maxSubsets: 3,
    maxNodesPerSubset: 100,
    allowedExportFormats: ['json'],
    allowedDestinations: ['local'],
    canShare: false,
    canRedact: false,
  },
  member: {
    maxSubsets: 10,
    maxNodesPerSubset: 1000,
    allowedExportFormats: ['json', 'jsonl', 'markdown'],
    allowedDestinations: ['local'],
    canShare: false,
    canRedact: true,
  },
  pro: {
    maxSubsets: 50,
    maxNodesPerSubset: 10000,
    allowedExportFormats: ['json', 'jsonl', 'markdown', 'html'],
    allowedDestinations: ['local', 'cloudflare-r2'],
    canShare: true,
    canRedact: true,
  },
  premium: {
    maxSubsets: -1, // unlimited
    maxNodesPerSubset: -1, // unlimited
    allowedExportFormats: ['json', 'jsonl', 'markdown', 'html', 'sqlite', 'archive'],
    allowedDestinations: ['local', 'cloudflare-r2', 'google-drive'],
    canShare: true,
    canRedact: true,
  },
  admin: {
    maxSubsets: -1,
    maxNodesPerSubset: -1,
    allowedExportFormats: ['json', 'jsonl', 'markdown', 'html', 'sqlite', 'archive'],
    allowedDestinations: ['local', 'cloudflare-r2', 'google-drive'],
    canShare: true,
    canRedact: true,
  },
};

/**
 * Check if user tier meets minimum requirement
 */
export function meetsMinimumTier(userTier: UserTier, requiredTier: UserTier): boolean {
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier];
}

/**
 * Result of tier check
 */
export interface TierCheckResult {
  allowed: boolean;
  reason?: string;
  requiredTier?: UserTier;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface CreateSubsetOptions {
  name: string;
  description?: string;
  criteria: SubsetFilterCriteria;
  exportFormat?: SubsetExportFormat;
  sharingMode?: SubsetSharingMode;
  cloudDestination?: CloudDestination;
  encryption?: SubsetEncryption;
  /** User's tier for feature gating (defaults to 'free' if not provided) */
  userTier?: UserTier;
}

export interface UpdateSubsetOptions {
  name?: string;
  description?: string;
  criteria?: SubsetFilterCriteria;
  status?: SubsetStatus;
  exportFormat?: SubsetExportFormat;
  sharingMode?: SubsetSharingMode;
  cloudDestination?: CloudDestination;
  encryption?: SubsetEncryption;
}

export interface EvaluateSubsetResult {
  subsetId: string;
  nodeCount: number;
  totalWordCount: number;
  dateRange: { earliest?: number; latest?: number };
  sourceDistribution: Record<string, number>;
  sensitivityDistribution: Record<SensitivityLevel, number>;
  redactableNodes: number;
  evaluatedAt: number;
}

export interface SensitivityPattern {
  id: string;
  name: string;
  description?: string;
  pattern: string;
  contentType: SensitiveContentType;
  sensitivityLevel: SensitivityLevel;
  isEnabled: boolean;
  isSystem: boolean;
  priority: number;
}

// ═══════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════

export class ArchiveSubsetService {
  private pool: Pool;
  private tenantId: string;
  private sensitivityPatterns: Map<string, RegExp> = new Map();
  private patternsLoaded = false;

  constructor(pool: Pool, tenantId = 'humanizer') {
    this.pool = pool;
    this.tenantId = tenantId;
  }

  // ─────────────────────────────────────────────────────────────────
  // SUBSET CRUD
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a new archive subset
   *
   * @throws {Error} If user has reached their subset limit for their tier
   * @throws {Error} If requested features exceed tier permissions
   */
  async createSubset(userId: string, options: CreateSubsetOptions): Promise<ArchiveSubset> {
    const userTier = options.userTier ?? 'free';
    const tierLimits = SUBSET_TIER_LIMITS[userTier];

    // Check if user has reached their subset limit
    if (tierLimits.maxSubsets !== -1) {
      const existingCount = await this.getSubsetCount(userId);
      if (existingCount >= tierLimits.maxSubsets) {
        throw new Error(
          `Subset limit reached. Your ${userTier} tier allows ${tierLimits.maxSubsets} subsets. ` +
          `Upgrade to Pro for more subsets.`
        );
      }
    }

    // Check if sharing mode is allowed
    if (options.sharingMode && options.sharingMode !== 'private' && !tierLimits.canShare) {
      throw new Error(
        `Sharing is not available for ${userTier} tier. Upgrade to Pro to share subsets.`
      );
    }

    // Check if export format is allowed
    if (options.exportFormat && !tierLimits.allowedExportFormats.includes(options.exportFormat)) {
      throw new Error(
        `Export format '${options.exportFormat}' is not available for ${userTier} tier. ` +
        `Allowed formats: ${tierLimits.allowedExportFormats.join(', ')}.`
      );
    }

    // Check if cloud destination is allowed
    if (options.cloudDestination) {
      const provider = options.cloudDestination.provider;
      if (!tierLimits.allowedDestinations.includes(provider as 'local' | 'cloudflare-r2' | 'google-drive')) {
        throw new Error(
          `Cloud destination '${provider}' is not available for ${userTier} tier. ` +
          `Upgrade to Pro for R2 storage.`
        );
      }
    }

    const client = await this.pool.connect();
    try {
      const id = randomUUID();
      const now = Date.now();

      const result = await client.query(
        `INSERT INTO aui_archive_subsets (
          id, tenant_id, user_id, name, description, criteria, status,
          export_format, cloud_destination, sharing_mode, encryption,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING *`,
        [
          id,
          this.tenantId,
          userId,
          options.name,
          options.description ?? null,
          JSON.stringify(options.criteria),
          'draft',
          options.exportFormat ?? null,
          options.cloudDestination ? JSON.stringify(options.cloudDestination) : null,
          options.sharingMode ?? 'private',
          options.encryption ? JSON.stringify(options.encryption) : JSON.stringify({ enabled: false }),
        ]
      );

      return this.rowToSubset(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get a subset by ID
   */
  async getSubset(subsetId: string, userId?: string): Promise<ArchiveSubset | null> {
    const client = await this.pool.connect();
    try {
      let query = `SELECT * FROM aui_archive_subsets WHERE id = $1 AND tenant_id = $2`;
      const params: any[] = [subsetId, this.tenantId];

      if (userId) {
        query += ` AND user_id = $3`;
        params.push(userId);
      }

      const result = await client.query(query, params);
      if (result.rows.length === 0) return null;

      return this.rowToSubset(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * List subsets for a user
   */
  async listSubsets(
    userId: string,
    options?: {
      status?: SubsetStatus | SubsetStatus[];
      sharingMode?: SubsetSharingMode;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ subsets: ArchiveSubset[]; total: number }> {
    const client = await this.pool.connect();
    try {
      const conditions = ['tenant_id = $1', 'user_id = $2'];
      const params: any[] = [this.tenantId, userId];
      let paramIdx = 3;

      if (options?.status) {
        if (Array.isArray(options.status)) {
          conditions.push(`status = ANY($${paramIdx})`);
          params.push(options.status);
        } else {
          conditions.push(`status = $${paramIdx}`);
          params.push(options.status);
        }
        paramIdx++;
      }

      if (options?.sharingMode) {
        conditions.push(`sharing_mode = $${paramIdx}`);
        params.push(options.sharingMode);
        paramIdx++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM aui_archive_subsets WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated results
      const limit = options?.limit ?? 50;
      const offset = options?.offset ?? 0;
      params.push(limit, offset);

      const result = await client.query(
        `SELECT * FROM aui_archive_subsets
         WHERE ${whereClause}
         ORDER BY updated_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        params
      );

      return {
        subsets: result.rows.map((row) => this.rowToSubset(row)),
        total,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get count of subsets for a user (for tier limit checking)
   */
  async getSubsetCount(userId: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT COUNT(*) as count FROM aui_archive_subsets
         WHERE tenant_id = $1 AND user_id = $2`,
        [this.tenantId, userId]
      );
      return parseInt(result.rows[0].count, 10);
    } finally {
      client.release();
    }
  }

  /**
   * Update a subset
   */
  async updateSubset(
    subsetId: string,
    userId: string,
    options: UpdateSubsetOptions
  ): Promise<ArchiveSubset | null> {
    const client = await this.pool.connect();
    try {
      const updates: string[] = ['updated_at = NOW()'];
      const params: any[] = [];
      let paramIdx = 1;

      if (options.name !== undefined) {
        updates.push(`name = $${paramIdx}`);
        params.push(options.name);
        paramIdx++;
      }
      if (options.description !== undefined) {
        updates.push(`description = $${paramIdx}`);
        params.push(options.description);
        paramIdx++;
      }
      if (options.criteria !== undefined) {
        updates.push(`criteria = $${paramIdx}`);
        params.push(JSON.stringify(options.criteria));
        paramIdx++;
      }
      if (options.status !== undefined) {
        updates.push(`status = $${paramIdx}`);
        params.push(options.status);
        paramIdx++;
      }
      if (options.exportFormat !== undefined) {
        updates.push(`export_format = $${paramIdx}`);
        params.push(options.exportFormat);
        paramIdx++;
      }
      if (options.sharingMode !== undefined) {
        updates.push(`sharing_mode = $${paramIdx}`);
        params.push(options.sharingMode);
        paramIdx++;
      }
      if (options.cloudDestination !== undefined) {
        updates.push(`cloud_destination = $${paramIdx}`);
        params.push(JSON.stringify(options.cloudDestination));
        paramIdx++;
      }
      if (options.encryption !== undefined) {
        updates.push(`encryption = $${paramIdx}`);
        params.push(JSON.stringify(options.encryption));
        paramIdx++;
      }

      params.push(subsetId, this.tenantId, userId);

      const result = await client.query(
        `UPDATE aui_archive_subsets SET ${updates.join(', ')}
         WHERE id = $${paramIdx} AND tenant_id = $${paramIdx + 1} AND user_id = $${paramIdx + 2}
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) return null;
      return this.rowToSubset(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Delete a subset and all its mappings
   */
  async deleteSubset(subsetId: string, userId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM aui_archive_subsets
         WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
        [subsetId, this.tenantId, userId]
      );
      return result.rowCount !== null && result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // EVALUATION & STATISTICS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Evaluate subset criteria and compute statistics
   *
   * This queries the content store to count matching nodes without
   * creating mappings. Use buildMappings() to actually create the mappings.
   */
  async evaluateSubset(
    subsetId: string,
    userId: string,
    contentStoreQuery: (options: QueryOptions) => Promise<{ nodes: StoredNode[]; total: number }>
  ): Promise<EvaluateSubsetResult> {
    const subset = await this.getSubset(subsetId, userId);
    if (!subset) {
      throw new Error(`Subset not found: ${subsetId}`);
    }

    // Build query options from criteria
    const queryOptions = this.criteriaToQueryOptions(subset.criteria);

    // Get matching nodes (limited sample for stats)
    const { nodes, total } = await contentStoreQuery({
      ...queryOptions,
      limit: 10000, // Sample size for stats
    });

    // Compute statistics
    const sourceDistribution: Record<string, number> = {};
    const sensitivityDistribution: Record<SensitivityLevel, number> = {
      public: 0,
      internal: 0,
      private: 0,
      sensitive: 0,
    };
    let totalWordCount = 0;
    let earliest: number | undefined;
    let latest: number | undefined;
    let redactableNodes = 0;

    // Load sensitivity patterns
    await this.loadSensitivityPatterns();

    for (const node of nodes) {
      // Source distribution
      sourceDistribution[node.sourceType] = (sourceDistribution[node.sourceType] || 0) + 1;

      // Word count
      totalWordCount += node.wordCount || 0;

      // Date range
      if (node.sourceCreatedAt) {
        if (!earliest || node.sourceCreatedAt < earliest) earliest = node.sourceCreatedAt;
        if (!latest || node.sourceCreatedAt > latest) latest = node.sourceCreatedAt;
      }

      // Sensitivity detection
      const sensitivity = this.detectSensitivity(node.text);
      sensitivityDistribution[sensitivity.level]++;
      if (sensitivity.markers.length > 0) {
        redactableNodes++;
      }
    }

    // Scale stats if we sampled
    const scaleFactor = total > nodes.length ? total / nodes.length : 1;
    if (scaleFactor > 1) {
      totalWordCount = Math.round(totalWordCount * scaleFactor);
      redactableNodes = Math.round(redactableNodes * scaleFactor);
      for (const key of Object.keys(sourceDistribution)) {
        sourceDistribution[key] = Math.round(sourceDistribution[key] * scaleFactor);
      }
      for (const key of Object.keys(sensitivityDistribution) as SensitivityLevel[]) {
        sensitivityDistribution[key] = Math.round(sensitivityDistribution[key] * scaleFactor);
      }
    }

    const evaluatedAt = Date.now();

    // Update subset with stats
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE aui_archive_subsets SET
          node_count = $1,
          total_word_count = $2,
          date_range = $3,
          source_distribution = $4,
          sensitivity_distribution = $5,
          last_evaluated_at = NOW(),
          updated_at = NOW()
         WHERE id = $6 AND tenant_id = $7`,
        [
          total,
          totalWordCount,
          JSON.stringify({ earliest, latest }),
          JSON.stringify(sourceDistribution),
          JSON.stringify(sensitivityDistribution),
          subsetId,
          this.tenantId,
        ]
      );
    } finally {
      client.release();
    }

    return {
      subsetId,
      nodeCount: total,
      totalWordCount,
      dateRange: { earliest, latest },
      sourceDistribution,
      sensitivityDistribution,
      redactableNodes,
      evaluatedAt,
    };
  }

  /**
   * Get statistics for a subset
   */
  async getSubsetStats(subsetId: string, userId: string): Promise<SubsetStats | null> {
    const subset = await this.getSubset(subsetId, userId);
    if (!subset) return null;

    // Get node mapping stats
    const client = await this.pool.connect();
    try {
      const mappingStats = await client.query(
        `SELECT
          COUNT(*) as total_nodes,
          COUNT(DISTINCT node_id) as unique_nodes,
          SUM(CASE WHEN redacted THEN 1 ELSE 0 END) as redacted_count,
          COUNT(CASE WHEN user_override = 'include' THEN 1 END) as included_overrides,
          COUNT(CASE WHEN user_override = 'exclude' THEN 1 END) as excluded_overrides
         FROM aui_subset_node_mappings
         WHERE subset_id = $1`,
        [subsetId]
      );

      const stats = mappingStats.rows[0];

      return {
        subsetId,
        totalNodes: subset.nodeCount ?? 0,
        nodesBySource: subset.sourceDistribution ?? {},
        nodesByRole: {}, // Would need to join with content nodes
        nodesBySensitivity: (subset.sensitivityDistribution as Record<SensitivityLevel, number>) ?? {
          public: 0,
          internal: 0,
          private: 0,
          sensitive: 0,
        },
        totalWordCount: subset.totalWordCount ?? 0,
        avgWordCount: subset.nodeCount ? (subset.totalWordCount ?? 0) / subset.nodeCount : 0,
        dateRange: subset.dateRange ?? {},
        uniqueThreads: 0, // Would need to count distinct threadRootIds
        nodesWithMedia: 0, // Would need to check mediaRefs
        redactableNodes: parseInt(stats.redacted_count ?? '0', 10),
        computedAt: subset.lastEvaluatedAt ?? Date.now(),
      };
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // NODE MAPPINGS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Build node mappings for a subset
   *
   * This creates the actual mappings from nodes to the subset,
   * including sensitivity analysis.
   */
  async buildMappings(
    subsetId: string,
    userId: string,
    contentStoreQuery: (options: QueryOptions) => Promise<{ nodes: StoredNode[]; total: number }>,
    options?: {
      batchSize?: number;
      onProgress?: (processed: number, total: number) => void;
    }
  ): Promise<{ created: number; skipped: number; total: number }> {
    const subset = await this.getSubset(subsetId, userId);
    if (!subset) {
      throw new Error(`Subset not found: ${subsetId}`);
    }

    const client = await this.pool.connect();
    try {
      // Clear existing mappings
      await client.query(
        `DELETE FROM aui_subset_node_mappings WHERE subset_id = $1`,
        [subsetId]
      );

      // Load sensitivity patterns
      await this.loadSensitivityPatterns();

      // Build query options
      const queryOptions = this.criteriaToQueryOptions(subset.criteria);
      const batchSize = options?.batchSize ?? 500;
      let offset = 0;
      let created = 0;
      let skipped = 0;
      let total = 0;

      // Process in batches
      while (true) {
        const { nodes, total: totalCount } = await contentStoreQuery({
          ...queryOptions,
          limit: batchSize,
          offset,
        });

        if (total === 0) total = totalCount;
        if (nodes.length === 0) break;

        // Create mappings for this batch
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          const sensitivity = this.detectSensitivity(node.text);

          // Check if node should be excluded based on sensitivity
          if (subset.criteria.maxSensitivity) {
            const sensitivityOrder: Record<SensitivityLevel, number> = {
              public: 0,
              internal: 1,
              private: 2,
              sensitive: 3,
            };
            if (sensitivityOrder[sensitivity.level] > sensitivityOrder[subset.criteria.maxSensitivity]) {
              if (subset.criteria.sensitiveContentAction === 'exclude') {
                skipped++;
                continue;
              }
            }
          }

          const shouldRedact =
            subset.criteria.sensitiveContentAction === 'redact' && sensitivity.markers.length > 0;

          await client.query(
            `INSERT INTO aui_subset_node_mappings (
              subset_id, node_id, position, sensitivity_markers,
              sensitivity_level, redacted, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (subset_id, node_id) DO UPDATE SET
              position = EXCLUDED.position,
              sensitivity_markers = EXCLUDED.sensitivity_markers,
              sensitivity_level = EXCLUDED.sensitivity_level,
              redacted = EXCLUDED.redacted`,
            [
              subsetId,
              node.id,
              offset + i,
              JSON.stringify(sensitivity.markers),
              sensitivity.level,
              shouldRedact,
            ]
          );
          created++;
        }

        offset += nodes.length;
        options?.onProgress?.(offset, total);

        if (nodes.length < batchSize) break;
      }

      // Update subset status
      await client.query(
        `UPDATE aui_archive_subsets SET status = 'active', updated_at = NOW()
         WHERE id = $1`,
        [subsetId]
      );

      return { created, skipped, total };
    } finally {
      client.release();
    }
  }

  /**
   * Override a node's inclusion in a subset
   */
  async overrideNodeMapping(
    subsetId: string,
    userId: string,
    nodeId: string,
    override: 'include' | 'exclude' | null,
    reason?: string
  ): Promise<boolean> {
    // Verify user owns the subset
    const subset = await this.getSubset(subsetId, userId);
    if (!subset) return false;

    const client = await this.pool.connect();
    try {
      if (override === null) {
        // Remove override
        await client.query(
          `UPDATE aui_subset_node_mappings SET
            user_override = NULL, override_reason = NULL
           WHERE subset_id = $1 AND node_id = $2`,
          [subsetId, nodeId]
        );
      } else {
        // Set override
        await client.query(
          `INSERT INTO aui_subset_node_mappings (
            subset_id, node_id, user_override, override_reason,
            sensitivity_level, redacted, created_at
          ) VALUES ($1, $2, $3, $4, 'public', false, NOW())
          ON CONFLICT (subset_id, node_id) DO UPDATE SET
            user_override = $3, override_reason = $4`,
          [subsetId, nodeId, override, reason ?? null]
        );
      }
      return true;
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // SENSITIVITY DETECTION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Load sensitivity patterns from the database
   */
  private async loadSensitivityPatterns(): Promise<void> {
    if (this.patternsLoaded) return;

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM aui_sensitivity_patterns
         WHERE tenant_id = $1 AND is_enabled = TRUE
         ORDER BY priority ASC`,
        [this.tenantId]
      );

      this.sensitivityPatterns.clear();
      for (const row of result.rows) {
        try {
          this.sensitivityPatterns.set(row.id, new RegExp(row.pattern, 'gi'));
        } catch (e) {
          console.warn(`Invalid sensitivity pattern ${row.name}: ${e}`);
        }
      }
      this.patternsLoaded = true;
    } finally {
      client.release();
    }
  }

  /**
   * Get loaded sensitivity patterns
   */
  async getSensitivityPatterns(): Promise<SensitivityPattern[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM aui_sensitivity_patterns
         WHERE tenant_id = $1
         ORDER BY priority ASC`,
        [this.tenantId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        pattern: row.pattern,
        contentType: row.content_type as SensitiveContentType,
        sensitivityLevel: row.sensitivity_level as SensitivityLevel,
        isEnabled: row.is_enabled,
        isSystem: row.is_system,
        priority: row.priority,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Detect sensitive content in text
   */
  detectSensitivity(text: string): { level: SensitivityLevel; markers: SensitiveContentMarker[] } {
    const markers: SensitiveContentMarker[] = [];
    let maxLevel: SensitivityLevel = 'public';

    // Ensure patterns are loaded (synchronous check)
    if (!this.patternsLoaded) {
      // Return default if patterns not loaded yet
      return { level: 'public', markers: [] };
    }

    // Get pattern metadata for sensitivity levels
    // Note: This is a simplified version - in production, you'd cache pattern metadata
    const sensitivityOrder: Record<SensitivityLevel, number> = {
      public: 0,
      internal: 1,
      private: 2,
      sensitive: 3,
    };

    // Apply built-in patterns
    const builtInPatterns: Array<{
      pattern: RegExp;
      type: SensitiveContentType;
      level: SensitivityLevel;
    }> = [
      { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, type: 'email_address', level: 'internal' },
      { pattern: /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, type: 'phone_number', level: 'private' },
      { pattern: /\d{3}-\d{2}-\d{4}/g, type: 'government_id', level: 'sensitive' },
      { pattern: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g, type: 'credit_card', level: 'sensitive' },
      { pattern: /(api[_-]?key|apikey)[=:\s]+[a-zA-Z0-9_-]{20,}/gi, type: 'api_key', level: 'sensitive' },
      { pattern: /AKIA[0-9A-Z]{16}/g, type: 'api_key', level: 'sensitive' },
      { pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g, type: 'private_key', level: 'sensitive' },
      { pattern: /(mongodb|postgres|mysql|redis):\/\/[^\s]+/gi, type: 'connection_string', level: 'sensitive' },
    ];

    for (const { pattern, type, level } of builtInPatterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex state
      while ((match = pattern.exec(text)) !== null) {
        markers.push({
          start: match.index,
          end: match.index + match[0].length,
          type,
          confidence: 0.9,
        });
        if (sensitivityOrder[level] > sensitivityOrder[maxLevel]) {
          maxLevel = level;
        }
      }
    }

    return { level: maxLevel, markers };
  }

  /**
   * Redact sensitive content from text
   */
  redactText(text: string, markers: SensitiveContentMarker[]): string {
    if (markers.length === 0) return text;

    // Sort markers by END position (descending) to process from right to left
    // This ensures overlapping markers are handled correctly
    const sorted = [...markers].sort((a, b) => b.end - a.end);

    let result = text;
    for (const marker of sorted) {
      const replacement = marker.redactedText ?? `[REDACTED:${marker.type}]`;
      result = result.slice(0, marker.start) + replacement + result.slice(marker.end);
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Start an export job for a subset
   *
   * @throws {Error} If export format is not allowed for user's tier
   * @throws {Error} If cloud destination is not allowed for user's tier
   */
  async startExport(
    subsetId: string,
    userId: string,
    options: {
      format: SubsetExportFormat;
      destination: CloudDestination;
      /** User's tier for feature gating (defaults to 'free' if not provided) */
      userTier?: UserTier;
    }
  ): Promise<SubsetExportJob> {
    const userTier = options.userTier ?? 'free';
    const tierLimits = SUBSET_TIER_LIMITS[userTier];

    // Check if export format is allowed for user's tier
    if (!tierLimits.allowedExportFormats.includes(options.format)) {
      throw new Error(
        `Export format '${options.format}' is not available for ${userTier} tier. ` +
        `Allowed formats: ${tierLimits.allowedExportFormats.join(', ')}. ` +
        `Upgrade to Pro for more export options.`
      );
    }

    // Check if cloud destination is allowed for user's tier
    const provider = options.destination.provider;
    if (!tierLimits.allowedDestinations.includes(provider as 'local' | 'cloudflare-r2' | 'google-drive')) {
      throw new Error(
        `Cloud destination '${provider}' is not available for ${userTier} tier. ` +
        `Upgrade to Pro for R2 cloud storage.`
      );
    }

    const subset = await this.getSubset(subsetId, userId);
    if (!subset) {
      throw new Error(`Subset not found: ${subsetId}`);
    }

    const client = await this.pool.connect();
    try {
      const jobId = randomUUID();

      // Count nodes for the job
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM aui_subset_node_mappings
         WHERE subset_id = $1
         AND (user_override IS NULL OR user_override = 'include')`,
        [subsetId]
      );
      const totalNodes = parseInt(countResult.rows[0].count, 10);

      const result = await client.query(
        `INSERT INTO aui_subset_export_jobs (
          id, subset_id, user_id, status, format, destination,
          total_nodes, exported_nodes, failed_nodes, redacted_nodes,
          created_at
        ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, 0, 0, 0, NOW())
        RETURNING *`,
        [jobId, subsetId, userId, options.format, JSON.stringify(options.destination), totalNodes]
      );

      // Update subset status
      await client.query(
        `UPDATE aui_archive_subsets SET status = 'exporting', updated_at = NOW()
         WHERE id = $1`,
        [subsetId]
      );

      return this.rowToExportJob(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get export job status
   */
  async getExportJob(jobId: string, userId?: string): Promise<SubsetExportJob | null> {
    const client = await this.pool.connect();
    try {
      let query = `SELECT * FROM aui_subset_export_jobs WHERE id = $1`;
      const params: any[] = [jobId];

      if (userId) {
        query += ` AND user_id = $2`;
        params.push(userId);
      }

      const result = await client.query(query, params);
      if (result.rows.length === 0) return null;

      return this.rowToExportJob(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Update export job progress
   */
  async updateExportProgress(
    jobId: string,
    update: {
      status?: ExportJobStatus;
      exportedNodes?: number;
      failedNodes?: number;
      redactedNodes?: number;
      outputPath?: string;
      outputSizeBytes?: number;
      error?: string;
    }
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      const updates: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (update.status !== undefined) {
        updates.push(`status = $${paramIdx}`);
        params.push(update.status);
        paramIdx++;
        if (update.status === 'exporting') {
          updates.push(`started_at = COALESCE(started_at, NOW())`);
        } else if (update.status === 'completed' || update.status === 'failed') {
          updates.push(`completed_at = NOW()`);
        }
      }
      if (update.exportedNodes !== undefined) {
        updates.push(`exported_nodes = $${paramIdx}`);
        params.push(update.exportedNodes);
        paramIdx++;
      }
      if (update.failedNodes !== undefined) {
        updates.push(`failed_nodes = $${paramIdx}`);
        params.push(update.failedNodes);
        paramIdx++;
      }
      if (update.redactedNodes !== undefined) {
        updates.push(`redacted_nodes = $${paramIdx}`);
        params.push(update.redactedNodes);
        paramIdx++;
      }
      if (update.outputPath !== undefined) {
        updates.push(`output_path = $${paramIdx}`);
        params.push(update.outputPath);
        paramIdx++;
      }
      if (update.outputSizeBytes !== undefined) {
        updates.push(`output_size_bytes = $${paramIdx}`);
        params.push(update.outputSizeBytes);
        paramIdx++;
      }
      if (update.error !== undefined) {
        updates.push(`error = $${paramIdx}`);
        params.push(update.error);
        paramIdx++;
      }

      if (updates.length === 0) return;

      params.push(jobId);
      await client.query(
        `UPDATE aui_subset_export_jobs SET ${updates.join(', ')}
         WHERE id = $${paramIdx}`,
        params
      );
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Convert filter criteria to query options
   */
  private criteriaToQueryOptions(criteria: SubsetFilterCriteria): QueryOptions {
    const options: QueryOptions = {};

    // Date range
    if (criteria.dateFrom || criteria.dateTo) {
      options.dateRange = {
        start: criteria.dateFrom,
        end: criteria.dateTo,
      };
    }

    // Source types
    if (criteria.sourceTypes && criteria.sourceTypes.length > 0) {
      options.sourceType = criteria.sourceTypes;
    }

    // Author roles
    if (criteria.authorRoles && criteria.authorRoles.length > 0) {
      options.authorRole = criteria.authorRoles[0] as AuthorRole; // QueryOptions only supports single role
    }

    // Hierarchy levels
    if (criteria.hierarchyLevels && criteria.hierarchyLevels.length > 0) {
      options.hierarchyLevel = criteria.hierarchyLevels[0]; // QueryOptions only supports single level
    }

    // Thread filtering
    if (criteria.threadRootIds && criteria.threadRootIds.length > 0) {
      options.threadRootId = criteria.threadRootIds[0]; // QueryOptions only supports single thread
    }

    // Search text
    if (criteria.searchText) {
      options.searchText = criteria.searchText;
    }

    // Adapter and import job
    if (criteria.adapterIds && criteria.adapterIds.length > 0) {
      options.adapterId = criteria.adapterIds[0];
    }
    if (criteria.importJobIds && criteria.importJobIds.length > 0) {
      options.importJobId = criteria.importJobIds[0];
    }

    return options;
  }

  /**
   * Convert database row to ArchiveSubset
   */
  private rowToSubset(row: any): ArchiveSubset {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      criteria: row.criteria || {},
      status: row.status as SubsetStatus,
      exportFormat: row.export_format as SubsetExportFormat | undefined,
      cloudDestination: row.cloud_destination,
      sharingMode: row.sharing_mode as SubsetSharingMode | undefined,
      encryption: row.encryption,
      nodeCount: row.node_count,
      totalWordCount: row.total_word_count,
      dateRange: row.date_range,
      sourceDistribution: row.source_distribution,
      sensitivityDistribution: row.sensitivity_distribution,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      lastExportedAt: row.last_exported_at ? new Date(row.last_exported_at).getTime() : undefined,
      lastEvaluatedAt: row.last_evaluated_at ? new Date(row.last_evaluated_at).getTime() : undefined,
    };
  }

  /**
   * Convert database row to SubsetExportJob
   */
  private rowToExportJob(row: any): SubsetExportJob {
    return {
      id: row.id,
      subsetId: row.subset_id,
      userId: row.user_id,
      status: row.status as ExportJobStatus,
      format: row.format as SubsetExportFormat,
      destination: row.destination,
      totalNodes: row.total_nodes,
      exportedNodes: row.exported_nodes,
      failedNodes: row.failed_nodes,
      redactedNodes: row.redacted_nodes,
      startedAt: row.started_at ? new Date(row.started_at).getTime() : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
      estimatedCompletionAt: row.estimated_completion_at
        ? new Date(row.estimated_completion_at).getTime()
        : undefined,
      outputPath: row.output_path,
      outputSizeBytes: row.output_size_bytes ? parseInt(row.output_size_bytes, 10) : undefined,
      error: row.error,
      createdAt: new Date(row.created_at).getTime(),
    };
  }
}
