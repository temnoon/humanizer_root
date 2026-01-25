/**
 * Baseline Metrics Capture
 *
 * Captures quality metrics before configuration migrations to detect regressions.
 * Part of Phase 0 pre-requisites for configuration remediation.
 *
 * @module config/baseline-capture
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Quality metrics captured from the system
 */
export interface BaselineMetrics {
  // ─────────────────────────────────────────────────────────────────
  // Reviewer Metrics
  // ─────────────────────────────────────────────────────────────────

  /** Individual humanization scores from reviewer */
  humanizationScores: number[];

  /** Average humanization score */
  avgHumanizationScore: number;

  /** Standard deviation of humanization scores */
  stdHumanizationScore: number;

  // ─────────────────────────────────────────────────────────────────
  // Builder Metrics (Quantum Reading)
  // ─────────────────────────────────────────────────────────────────

  /** Average purity score from density matrix */
  avgPurityScore: number;

  /** Purity standard deviation */
  stdPurityScore: number;

  /** Average entropy from density matrix */
  avgEntropyScore: number;

  /** Entropy standard deviation */
  stdEntropyScore: number;

  // ─────────────────────────────────────────────────────────────────
  // Search Metrics
  // ─────────────────────────────────────────────────────────────────

  /** Precision at k=10 (relevant results in top 10) */
  searchPrecisionAt10: number;

  /** Mean reciprocal rank */
  searchMRR: number;

  // ─────────────────────────────────────────────────────────────────
  // Transformation Metrics
  // ─────────────────────────────────────────────────────────────────

  /** Forbidden phrase leakage rate */
  forbiddenPhraseLeakageRate: number;

  /** Average rewrite passes needed */
  avgRewritePasses: number;

  // ─────────────────────────────────────────────────────────────────
  // Sample Counts
  // ─────────────────────────────────────────────────────────────────

  /** Number of samples used for humanization scores */
  humanizationSampleCount: number;

  /** Number of samples used for purity/entropy */
  quantumReadingSampleCount: number;

  /** Number of search queries tested */
  searchQueryCount: number;
}

/**
 * A complete baseline capture with metadata
 */
export interface BaselineCapture {
  /** Unique identifier for this baseline */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of when/why captured */
  description?: string;

  /** The captured metrics */
  metrics: BaselineMetrics;

  /** When the baseline was captured */
  capturedAt: Date;

  /** Git commit hash at capture time */
  commitHash: string;

  /** Branch name at capture time */
  branchName?: string;

  /** Configuration version at capture time */
  configVersion?: string;

  /** Tags for organization */
  tags?: string[];
}

/**
 * Comparison result between current metrics and baseline
 */
export interface BaselineComparison {
  /** The baseline being compared against */
  baseline: BaselineCapture;

  /** Current metrics */
  current: BaselineMetrics;

  /** When comparison was made */
  comparedAt: Date;

  /** Overall pass/fail based on regression thresholds */
  passed: boolean;

  /** Individual metric comparisons */
  deltas: MetricDelta[];

  /** Regressions that exceed thresholds */
  regressions: MetricDelta[];

  /** Improvements over baseline */
  improvements: MetricDelta[];
}

/**
 * Delta for a single metric
 */
export interface MetricDelta {
  /** Metric name */
  metric: keyof BaselineMetrics;

  /** Baseline value */
  baselineValue: number;

  /** Current value */
  currentValue: number;

  /** Absolute change (current - baseline) */
  absoluteDelta: number;

  /** Relative change as percentage */
  relativeDelta: number;

  /** Is this a regression? (worse than baseline beyond threshold) */
  isRegression: boolean;

  /** Is this an improvement? */
  isImprovement: boolean;

  /** Threshold that was exceeded (if regression) */
  thresholdExceeded?: number;
}

// ═══════════════════════════════════════════════════════════════════
// REGRESSION THRESHOLDS
// ═══════════════════════════════════════════════════════════════════

/**
 * Maximum acceptable drops from baseline before triggering rollback
 */
export const REGRESSION_THRESHOLDS = {
  // ─────────────────────────────────────────────────────────────────
  // Maximum Acceptable Score Drops (as relative percentages)
  // ─────────────────────────────────────────────────────────────────

  /** Max humanization score drop (3%) */
  maxHumanizationDrop: 0.03,

  /** Max purity score drop (5%) */
  maxPurityDrop: 0.05,

  /** Max search precision drop (2%) */
  maxSearchPrecisionDrop: 0.02,

  /** Max MRR drop (5%) */
  maxMRRDrop: 0.05,

  // ─────────────────────────────────────────────────────────────────
  // Maximum Acceptable Increases (for inverse metrics)
  // ─────────────────────────────────────────────────────────────────

  /** Max entropy increase (10%) */
  maxEntropyIncrease: 0.10,

  /** Max forbidden phrase leakage increase (absolute 1%) */
  maxLeakageIncrease: 0.01,

  /** Max rewrite passes increase (20%) */
  maxRewritePassesIncrease: 0.20,

  // ─────────────────────────────────────────────────────────────────
  // Monitoring Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Hours to monitor after config change */
  monitoringWindowHours: 24,

  /** Consecutive failures before rollback */
  rollbackOnConsecutiveFailures: 3,

  /** Minimum samples before comparison is valid */
  minimumSamplesRequired: 10,
} as const;

export type RegressionThresholds = typeof REGRESSION_THRESHOLDS;

// ═══════════════════════════════════════════════════════════════════
// CAPTURE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create empty metrics (for initialization)
 */
export function createEmptyMetrics(): BaselineMetrics {
  return {
    humanizationScores: [],
    avgHumanizationScore: 0,
    stdHumanizationScore: 0,
    avgPurityScore: 0,
    stdPurityScore: 0,
    avgEntropyScore: 0,
    stdEntropyScore: 0,
    searchPrecisionAt10: 0,
    searchMRR: 0,
    forbiddenPhraseLeakageRate: 0,
    avgRewritePasses: 0,
    humanizationSampleCount: 0,
    quantumReadingSampleCount: 0,
    searchQueryCount: 0,
  };
}

/**
 * Calculate statistics from an array of numbers
 */
function calculateStats(values: number[]): { avg: number; std: number } {
  if (values.length === 0) {
    return { avg: 0, std: 0 };
  }

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(variance);

  return { avg, std };
}

/**
 * Aggregate metrics from individual measurements
 */
export function aggregateMetrics(measurements: {
  humanizationScores?: number[];
  purityScores?: number[];
  entropyScores?: number[];
  searchPrecisions?: number[];
  searchRanks?: number[];
  leakageCounts?: { leaked: number; total: number }[];
  rewritePasses?: number[];
}): BaselineMetrics {
  const humanStats = calculateStats(measurements.humanizationScores || []);
  const purityStats = calculateStats(measurements.purityScores || []);
  const entropyStats = calculateStats(measurements.entropyScores || []);
  const precisionStats = calculateStats(measurements.searchPrecisions || []);

  // MRR = mean of 1/rank
  const mrr = measurements.searchRanks && measurements.searchRanks.length > 0
    ? measurements.searchRanks.reduce((sum, rank) => sum + (rank > 0 ? 1 / rank : 0), 0) / measurements.searchRanks.length
    : 0;

  // Leakage rate
  let leakageRate = 0;
  if (measurements.leakageCounts && measurements.leakageCounts.length > 0) {
    const totalLeaked = measurements.leakageCounts.reduce((sum, c) => sum + c.leaked, 0);
    const totalItems = measurements.leakageCounts.reduce((sum, c) => sum + c.total, 0);
    leakageRate = totalItems > 0 ? totalLeaked / totalItems : 0;
  }

  const rewriteStats = calculateStats(measurements.rewritePasses || []);

  return {
    humanizationScores: measurements.humanizationScores || [],
    avgHumanizationScore: humanStats.avg,
    stdHumanizationScore: humanStats.std,
    avgPurityScore: purityStats.avg,
    stdPurityScore: purityStats.std,
    avgEntropyScore: entropyStats.avg,
    stdEntropyScore: entropyStats.std,
    searchPrecisionAt10: precisionStats.avg,
    searchMRR: mrr,
    forbiddenPhraseLeakageRate: leakageRate,
    avgRewritePasses: rewriteStats.avg,
    humanizationSampleCount: (measurements.humanizationScores || []).length,
    quantumReadingSampleCount: (measurements.purityScores || []).length,
    searchQueryCount: (measurements.searchPrecisions || []).length,
  };
}

/**
 * Get current git commit hash
 */
async function getGitCommitHash(): Promise<string> {
  try {
    const { execSync } = await import('child_process');
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Get current git branch name
 */
async function getGitBranch(): Promise<string | undefined> {
  try {
    const { execSync } = await import('child_process');
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Create a baseline capture from current metrics
 */
export async function createBaseline(
  name: string,
  metrics: BaselineMetrics,
  options?: {
    description?: string;
    tags?: string[];
    configVersion?: string;
  }
): Promise<BaselineCapture> {
  const [commitHash, branchName] = await Promise.all([
    getGitCommitHash(),
    getGitBranch(),
  ]);

  return {
    id: `baseline-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    name,
    description: options?.description,
    metrics,
    capturedAt: new Date(),
    commitHash,
    branchName,
    configVersion: options?.configVersion,
    tags: options?.tags,
  };
}

// ═══════════════════════════════════════════════════════════════════
// COMPARISON FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Compare current metrics against a baseline
 */
export function compareToBaseline(
  baseline: BaselineCapture,
  current: BaselineMetrics,
  thresholds: RegressionThresholds = REGRESSION_THRESHOLDS
): BaselineComparison {
  const deltas: MetricDelta[] = [];
  const regressions: MetricDelta[] = [];
  const improvements: MetricDelta[] = [];

  // Metrics where higher is better
  const higherIsBetter: (keyof BaselineMetrics)[] = [
    'avgHumanizationScore',
    'avgPurityScore',
    'searchPrecisionAt10',
    'searchMRR',
  ];

  // Metrics where lower is better
  const lowerIsBetter: (keyof BaselineMetrics)[] = [
    'avgEntropyScore',
    'forbiddenPhraseLeakageRate',
    'avgRewritePasses',
  ];

  // Threshold mapping
  const thresholdMap: Partial<Record<keyof BaselineMetrics, number>> = {
    avgHumanizationScore: thresholds.maxHumanizationDrop,
    avgPurityScore: thresholds.maxPurityDrop,
    searchPrecisionAt10: thresholds.maxSearchPrecisionDrop,
    searchMRR: thresholds.maxMRRDrop,
    avgEntropyScore: thresholds.maxEntropyIncrease,
    forbiddenPhraseLeakageRate: thresholds.maxLeakageIncrease,
    avgRewritePasses: thresholds.maxRewritePassesIncrease,
  };

  // Compare each metric
  for (const metric of [...higherIsBetter, ...lowerIsBetter]) {
    const baselineValue = baseline.metrics[metric] as number;
    const currentValue = current[metric] as number;

    if (typeof baselineValue !== 'number' || typeof currentValue !== 'number') {
      continue;
    }

    const absoluteDelta = currentValue - baselineValue;
    const relativeDelta = baselineValue !== 0 ? absoluteDelta / baselineValue : 0;

    const isHigherBetter = higherIsBetter.includes(metric);
    const threshold = thresholdMap[metric] || 0.05;

    let isRegression = false;
    let isImprovement = false;

    if (isHigherBetter) {
      // For higher-is-better, a drop is regression
      isRegression = relativeDelta < -threshold;
      isImprovement = relativeDelta > threshold;
    } else {
      // For lower-is-better, an increase is regression
      isRegression = relativeDelta > threshold;
      isImprovement = relativeDelta < -threshold;
    }

    const delta: MetricDelta = {
      metric,
      baselineValue,
      currentValue,
      absoluteDelta,
      relativeDelta,
      isRegression,
      isImprovement,
      thresholdExceeded: isRegression ? threshold : undefined,
    };

    deltas.push(delta);

    if (isRegression) {
      regressions.push(delta);
    } else if (isImprovement) {
      improvements.push(delta);
    }
  }

  return {
    baseline,
    current,
    comparedAt: new Date(),
    passed: regressions.length === 0,
    deltas,
    regressions,
    improvements,
  };
}

// ═══════════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_BASELINE_DIR = '.baselines';

/**
 * Save a baseline to disk
 */
export async function saveBaseline(
  baseline: BaselineCapture,
  directory: string = DEFAULT_BASELINE_DIR
): Promise<string> {
  await fs.mkdir(directory, { recursive: true });

  const filename = `${baseline.id}.json`;
  const filepath = path.join(directory, filename);

  await fs.writeFile(filepath, JSON.stringify(baseline, null, 2), 'utf-8');

  return filepath;
}

/**
 * Load a baseline from disk by ID
 */
export async function loadBaseline(
  id: string,
  directory: string = DEFAULT_BASELINE_DIR
): Promise<BaselineCapture> {
  const filepath = path.join(directory, `${id}.json`);
  const content = await fs.readFile(filepath, 'utf-8');
  const baseline = JSON.parse(content) as BaselineCapture;

  // Restore Date object
  baseline.capturedAt = new Date(baseline.capturedAt);

  return baseline;
}

/**
 * List all saved baselines
 */
export async function listBaselines(
  directory: string = DEFAULT_BASELINE_DIR
): Promise<BaselineCapture[]> {
  try {
    const files = await fs.readdir(directory);
    const baselines: BaselineCapture[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filepath = path.join(directory, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const baseline = JSON.parse(content) as BaselineCapture;
        baseline.capturedAt = new Date(baseline.capturedAt);
        baselines.push(baseline);
      }
    }

    // Sort by capture date, newest first
    baselines.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());

    return baselines;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Get the most recent baseline
 */
export async function getLatestBaseline(
  directory: string = DEFAULT_BASELINE_DIR
): Promise<BaselineCapture | null> {
  const baselines = await listBaselines(directory);
  return baselines[0] || null;
}

// ═══════════════════════════════════════════════════════════════════
// REPORTING
// ═══════════════════════════════════════════════════════════════════

/**
 * Format a comparison as a human-readable report
 */
export function formatComparisonReport(comparison: BaselineComparison): string {
  const lines: string[] = [];

  lines.push(`═══ Baseline Comparison Report ═══`);
  lines.push(`Baseline: ${comparison.baseline.name} (${comparison.baseline.capturedAt.toISOString()})`);
  lines.push(`Commit: ${comparison.baseline.commitHash.substring(0, 8)}`);
  lines.push(`Status: ${comparison.passed ? '✓ PASSED' : '✗ FAILED'}`);
  lines.push('');

  if (comparison.regressions.length > 0) {
    lines.push(`❌ REGRESSIONS (${comparison.regressions.length}):`);
    for (const r of comparison.regressions) {
      const pct = (r.relativeDelta * 100).toFixed(1);
      lines.push(`  ${r.metric}: ${r.baselineValue.toFixed(3)} → ${r.currentValue.toFixed(3)} (${pct}%)`);
    }
    lines.push('');
  }

  if (comparison.improvements.length > 0) {
    lines.push(`✅ IMPROVEMENTS (${comparison.improvements.length}):`);
    for (const i of comparison.improvements) {
      const pct = (i.relativeDelta * 100).toFixed(1);
      lines.push(`  ${i.metric}: ${i.baselineValue.toFixed(3)} → ${i.currentValue.toFixed(3)} (${pct}%)`);
    }
    lines.push('');
  }

  const unchanged = comparison.deltas.filter(d => !d.isRegression && !d.isImprovement);
  if (unchanged.length > 0) {
    lines.push(`➖ UNCHANGED (${unchanged.length}):`);
    for (const u of unchanged) {
      lines.push(`  ${u.metric}: ${u.currentValue.toFixed(3)}`);
    }
  }

  lines.push(`══════════════════════════════════`);

  return lines.join('\n');
}
