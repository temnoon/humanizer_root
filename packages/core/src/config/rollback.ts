/**
 * Configuration Rollback Procedure
 *
 * Provides snapshot/restore capability for configuration changes.
 * Enables automatic rollback when quality regressions are detected.
 * Part of Phase 0 pre-requisites for configuration remediation.
 *
 * @module config/rollback
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type { ConfigManager, ConfigEntry, PromptTemplate } from './types.js';
import { getConfigManager, InMemoryConfigManager } from './in-memory-config.js';
import {
  type BaselineCapture,
  type BaselineComparison,
  type BaselineMetrics,
  compareToBaseline,
  REGRESSION_THRESHOLDS,
  type RegressionThresholds,
} from './baseline-capture.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * A snapshot of the entire configuration state
 */
export interface ConfigSnapshot {
  /** Unique identifier for this snapshot */
  id: string;

  /** Human-readable name */
  name: string;

  /** Why this snapshot was created */
  reason: 'pre-migration' | 'scheduled' | 'manual' | 'pre-rollback';

  /** Description */
  description?: string;

  /** All configuration entries */
  configs: ConfigEntry[];

  /** All prompt templates */
  prompts: PromptTemplate[];

  /** When the snapshot was taken */
  createdAt: Date;

  /** Git commit hash at snapshot time */
  commitHash: string;

  /** Related baseline (if any) */
  baselineId?: string;

  /** Tags for organization */
  tags?: string[];
}

/**
 * Result of a rollback operation
 */
export interface RollbackResult {
  /** Was rollback successful? */
  success: boolean;

  /** Snapshot that was restored */
  snapshot: ConfigSnapshot;

  /** When rollback occurred */
  rolledBackAt: Date;

  /** Number of configs restored */
  configsRestored: number;

  /** Number of prompts restored */
  promptsRestored: number;

  /** Error message if failed */
  error?: string;

  /** Trigger that caused the rollback (for auto-rollback) */
  trigger?: RollbackTrigger;
}

/**
 * What triggered an automatic rollback
 */
export interface RollbackTrigger {
  /** Type of trigger */
  type: 'regression' | 'consecutive-failures' | 'manual';

  /** Metrics that regressed */
  regressedMetrics?: string[];

  /** Number of consecutive failures */
  failureCount?: number;

  /** Comparison that triggered rollback */
  comparison?: BaselineComparison;
}

/**
 * Auto-rollback monitor state
 */
interface RollbackMonitorState {
  /** Is monitoring active? */
  active: boolean;

  /** Pre-change snapshot to restore if needed */
  preChangeSnapshot: ConfigSnapshot | null;

  /** Baseline to compare against */
  baseline: BaselineCapture | null;

  /** Thresholds for triggering rollback */
  thresholds: RegressionThresholds;

  /** Consecutive failure count */
  consecutiveFailures: number;

  /** Check interval in ms */
  checkIntervalMs: number;

  /** Timer handle */
  intervalHandle?: ReturnType<typeof setInterval>;

  /** Callback for metrics collection */
  metricsCollector?: () => Promise<BaselineMetrics>;

  /** Callback when rollback occurs */
  onRollback?: (result: RollbackResult) => void;
}

// ═══════════════════════════════════════════════════════════════════
// ROLLBACK MANAGER
// ═══════════════════════════════════════════════════════════════════

/**
 * Configuration Rollback Manager
 *
 * Handles:
 * - Taking configuration snapshots
 * - Restoring from snapshots
 * - Automatic rollback on quality regression
 */
export class RollbackManager {
  private configManager: ConfigManager;
  private snapshotDir: string;
  private monitorState: RollbackMonitorState;

  constructor(options: {
    configManager?: ConfigManager;
    snapshotDir?: string;
  } = {}) {
    this.configManager = options.configManager ?? getConfigManager();
    this.snapshotDir = options.snapshotDir ?? '.config-snapshots';
    this.monitorState = {
      active: false,
      preChangeSnapshot: null,
      baseline: null,
      thresholds: REGRESSION_THRESHOLDS,
      consecutiveFailures: 0,
      checkIntervalMs: 60000, // 1 minute default
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SNAPSHOT OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a snapshot of current configuration
   */
  async snapshotConfig(options: {
    name: string;
    reason: ConfigSnapshot['reason'];
    description?: string;
    baselineId?: string;
    tags?: string[];
  }): Promise<ConfigSnapshot> {
    // Export all configs from the manager
    let configs: ConfigEntry[] = [];
    let prompts: PromptTemplate[] = [];

    if (this.configManager instanceof InMemoryConfigManager) {
      const exported = this.configManager.exportAll();
      configs = exported.configs;
      prompts = exported.prompts;
    } else {
      // For other implementations, get by category
      const categories = ['prompts', 'thresholds', 'limits', 'labels', 'features', 'secrets', 'agents', 'aui'] as const;
      for (const category of categories) {
        const categoryConfigs = await this.configManager.getCategory(category);
        configs.push(...categoryConfigs);
      }
      prompts = await this.configManager.listPrompts();
    }

    const commitHash = await this.getGitCommitHash();

    const snapshot: ConfigSnapshot = {
      id: `snapshot-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      name: options.name,
      reason: options.reason,
      description: options.description,
      configs,
      prompts,
      createdAt: new Date(),
      commitHash,
      baselineId: options.baselineId,
      tags: options.tags,
    };

    return snapshot;
  }

  /**
   * Restore configuration from a snapshot
   */
  async restoreConfig(snapshot: ConfigSnapshot): Promise<RollbackResult> {
    const startTime = Date.now();

    try {
      if (this.configManager instanceof InMemoryConfigManager) {
        // Fast path for InMemoryConfigManager
        await this.configManager.importAll({
          configs: snapshot.configs,
          prompts: snapshot.prompts,
        });
      } else {
        // Generic path for other implementations
        for (const config of snapshot.configs) {
          await this.configManager.set(config.category, config.key, config.value, {
            description: config.description,
            valueType: config.valueType,
            tags: config.tags,
            validation: config.validation,
          });
        }

        for (const prompt of snapshot.prompts) {
          await this.configManager.savePrompt(prompt);
        }
      }

      return {
        success: true,
        snapshot,
        rolledBackAt: new Date(),
        configsRestored: snapshot.configs.length,
        promptsRestored: snapshot.prompts.length,
      };
    } catch (error) {
      return {
        success: false,
        snapshot,
        rolledBackAt: new Date(),
        configsRestored: 0,
        promptsRestored: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PERSISTENCE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Save a snapshot to disk
   */
  async saveSnapshot(snapshot: ConfigSnapshot): Promise<string> {
    await fs.mkdir(this.snapshotDir, { recursive: true });

    const filename = `${snapshot.id}.json`;
    const filepath = path.join(this.snapshotDir, filename);

    await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2), 'utf-8');

    return filepath;
  }

  /**
   * Load a snapshot from disk
   */
  async loadSnapshot(id: string): Promise<ConfigSnapshot> {
    const filepath = path.join(this.snapshotDir, `${id}.json`);
    const content = await fs.readFile(filepath, 'utf-8');
    const snapshot = JSON.parse(content) as ConfigSnapshot;

    // Restore Date object
    snapshot.createdAt = new Date(snapshot.createdAt);

    return snapshot;
  }

  /**
   * List all saved snapshots
   */
  async listSnapshots(): Promise<ConfigSnapshot[]> {
    try {
      const files = await fs.readdir(this.snapshotDir);
      const snapshots: ConfigSnapshot[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filepath = path.join(this.snapshotDir, file);
          const content = await fs.readFile(filepath, 'utf-8');
          const snapshot = JSON.parse(content) as ConfigSnapshot;
          snapshot.createdAt = new Date(snapshot.createdAt);
          snapshots.push(snapshot);
        }
      }

      // Sort by creation date, newest first
      snapshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return snapshots;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get the most recent snapshot
   */
  async getLatestSnapshot(): Promise<ConfigSnapshot | null> {
    const snapshots = await this.listSnapshots();
    return snapshots[0] || null;
  }

  /**
   * Delete old snapshots, keeping the most recent N
   */
  async pruneSnapshots(keepCount: number = 10): Promise<number> {
    const snapshots = await this.listSnapshots();
    let deletedCount = 0;

    for (let i = keepCount; i < snapshots.length; i++) {
      const filepath = path.join(this.snapshotDir, `${snapshots[i].id}.json`);
      await fs.unlink(filepath);
      deletedCount++;
    }

    return deletedCount;
  }

  // ─────────────────────────────────────────────────────────────────
  // AUTO-ROLLBACK
  // ─────────────────────────────────────────────────────────────────

  /**
   * Enable automatic rollback monitoring
   *
   * This will:
   * 1. Take a snapshot before config changes
   * 2. Periodically compare current metrics to baseline
   * 3. Automatically rollback if regression thresholds exceeded
   */
  async enableAutoRollback(options: {
    /** Baseline to compare against */
    baseline: BaselineCapture;

    /** Thresholds for triggering rollback */
    thresholds?: Partial<RegressionThresholds>;

    /** How often to check (ms) */
    checkIntervalMs?: number;

    /** Function to collect current metrics */
    metricsCollector: () => Promise<BaselineMetrics>;

    /** Callback when rollback occurs */
    onRollback?: (result: RollbackResult) => void;
  }): Promise<void> {
    // Take pre-change snapshot
    const preChangeSnapshot = await this.snapshotConfig({
      name: `Pre-change snapshot for ${options.baseline.name}`,
      reason: 'pre-migration',
      baselineId: options.baseline.id,
    });

    // Save it
    await this.saveSnapshot(preChangeSnapshot);

    // Set up monitoring state
    this.monitorState = {
      active: true,
      preChangeSnapshot,
      baseline: options.baseline,
      thresholds: { ...REGRESSION_THRESHOLDS, ...options.thresholds },
      consecutiveFailures: 0,
      checkIntervalMs: options.checkIntervalMs ?? 60000,
      metricsCollector: options.metricsCollector,
      onRollback: options.onRollback,
    };

    // Start monitoring
    this.monitorState.intervalHandle = setInterval(
      () => this.checkForRegressions(),
      this.monitorState.checkIntervalMs
    );

    console.log(`[RollbackManager] Auto-rollback monitoring enabled`);
    console.log(`  Baseline: ${options.baseline.name}`);
    console.log(`  Check interval: ${this.monitorState.checkIntervalMs}ms`);
    console.log(`  Max consecutive failures: ${this.monitorState.thresholds.rollbackOnConsecutiveFailures}`);
  }

  /**
   * Disable automatic rollback monitoring
   */
  disableAutoRollback(): void {
    if (this.monitorState.intervalHandle) {
      clearInterval(this.monitorState.intervalHandle);
      this.monitorState.intervalHandle = undefined;
    }
    this.monitorState.active = false;
    console.log(`[RollbackManager] Auto-rollback monitoring disabled`);
  }

  /**
   * Check current metrics against baseline and rollback if needed
   */
  private async checkForRegressions(): Promise<void> {
    if (!this.monitorState.active || !this.monitorState.baseline || !this.monitorState.metricsCollector) {
      return;
    }

    try {
      // Collect current metrics
      const currentMetrics = await this.monitorState.metricsCollector();

      // Compare to baseline
      const comparison = compareToBaseline(
        this.monitorState.baseline,
        currentMetrics,
        this.monitorState.thresholds
      );

      if (!comparison.passed) {
        // Regression detected
        this.monitorState.consecutiveFailures++;
        console.warn(`[RollbackManager] Regression detected (${this.monitorState.consecutiveFailures} consecutive)`);

        for (const r of comparison.regressions) {
          console.warn(`  ${r.metric}: ${r.baselineValue.toFixed(3)} → ${r.currentValue.toFixed(3)}`);
        }

        // Check if we should rollback
        if (this.monitorState.consecutiveFailures >= this.monitorState.thresholds.rollbackOnConsecutiveFailures) {
          await this.triggerAutoRollback(comparison);
        }
      } else {
        // Reset failure count on success
        this.monitorState.consecutiveFailures = 0;
      }
    } catch (error) {
      console.error(`[RollbackManager] Error checking for regressions:`, error);
    }
  }

  /**
   * Trigger automatic rollback
   */
  private async triggerAutoRollback(comparison: BaselineComparison): Promise<void> {
    if (!this.monitorState.preChangeSnapshot) {
      console.error(`[RollbackManager] Cannot rollback: no pre-change snapshot available`);
      return;
    }

    console.warn(`[RollbackManager] Triggering automatic rollback...`);

    const trigger: RollbackTrigger = {
      type: 'regression',
      regressedMetrics: comparison.regressions.map(r => r.metric),
      failureCount: this.monitorState.consecutiveFailures,
      comparison,
    };

    const result = await this.restoreConfig(this.monitorState.preChangeSnapshot);
    result.trigger = trigger;

    // Disable monitoring after rollback
    this.disableAutoRollback();

    // Notify callback
    if (this.monitorState.onRollback) {
      this.monitorState.onRollback(result);
    }

    if (result.success) {
      console.log(`[RollbackManager] Rollback successful`);
      console.log(`  Restored ${result.configsRestored} configs, ${result.promptsRestored} prompts`);
    } else {
      console.error(`[RollbackManager] Rollback failed: ${result.error}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private async getGitCommitHash(): Promise<string> {
    try {
      const { execSync } = await import('child_process');
      return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get current monitoring state (for debugging)
   */
  getMonitorState(): Omit<RollbackMonitorState, 'intervalHandle' | 'metricsCollector' | 'onRollback'> {
    return {
      active: this.monitorState.active,
      preChangeSnapshot: this.monitorState.preChangeSnapshot,
      baseline: this.monitorState.baseline,
      thresholds: this.monitorState.thresholds,
      consecutiveFailures: this.monitorState.consecutiveFailures,
      checkIntervalMs: this.monitorState.checkIntervalMs,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

let _rollbackManager: RollbackManager | null = null;

/**
 * Get the singleton rollback manager
 */
export function getRollbackManager(): RollbackManager {
  if (!_rollbackManager) {
    _rollbackManager = new RollbackManager();
  }
  return _rollbackManager;
}

/**
 * Create a pre-migration snapshot
 *
 * @example
 * ```typescript
 * // Before making config changes
 * const snapshot = await createPreMigrationSnapshot('v2.0 migration');
 *
 * // Make changes...
 *
 * // If something goes wrong
 * await getRollbackManager().restoreConfig(snapshot);
 * ```
 */
export async function createPreMigrationSnapshot(
  name: string,
  description?: string
): Promise<ConfigSnapshot> {
  const manager = getRollbackManager();
  const snapshot = await manager.snapshotConfig({
    name,
    reason: 'pre-migration',
    description,
  });
  await manager.saveSnapshot(snapshot);
  return snapshot;
}

/**
 * Quick rollback to most recent snapshot
 */
export async function rollbackToLatest(): Promise<RollbackResult | null> {
  const manager = getRollbackManager();
  const snapshot = await manager.getLatestSnapshot();

  if (!snapshot) {
    return null;
  }

  return manager.restoreConfig(snapshot);
}
