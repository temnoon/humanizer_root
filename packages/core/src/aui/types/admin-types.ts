/**
 * Unified AUI Types - Admin Types
 *
 * Admin layer types for tiers, usage, costs, and limits.
 *
 * @module @humanizer/core/aui/types/admin-types
 */

import type { ConfigCategory } from '../../config/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * User tier with associated limits and features.
 */
export interface UserTier {
  /** Tier ID (e.g., 'free', 'pro', 'enterprise') */
  id: string;

  /** Human-readable tier name */
  name: string;

  /** Tier description */
  description?: string;

  /** Resource limits for this tier */
  limits: TierLimits;

  /** Enabled features for this tier */
  features: string[];

  /** Monthly price in cents (0 for free) */
  priceMonthly?: number;

  /** Annual price in cents (0 for free) */
  priceAnnual?: number;

  /** Display priority (lower = higher priority) */
  priority: number;

  /** Whether this tier is publicly available */
  isPublic: boolean;
}

/**
 * Resource limits for a tier.
 */
export interface TierLimits {
  /** Tokens allowed per day */
  tokensPerDay: number;

  /** Tokens allowed per month */
  tokensPerMonth: number;

  /** Requests per minute */
  requestsPerMinute: number;

  /** Maximum buffer size (MB) */
  maxBufferSizeMb: number;

  /** Maximum branches per buffer */
  maxBranches: number;

  /** Maximum version history depth */
  maxHistoryDepth: number;

  /** Maximum concurrent tasks */
  maxConcurrentTasks: number;

  /** Maximum search results per query */
  maxSearchResults: number;

  /** LLM models this tier can use */
  allowedModels: string[];

  /** Maximum file upload size (MB) */
  maxUploadSizeMb: number;
}

/**
 * Usage tracking for a user.
 */
export interface UserUsage {
  /** User ID */
  userId: string;

  /** Current tier ID */
  tierId: string;

  /** Usage period ('YYYY-MM-DD' for daily, 'YYYY-MM' for monthly) */
  period: string;

  /** Total tokens used this period */
  tokensUsed: number;

  /** Total requests this period */
  requestsCount: number;

  /** Total cost accrued this period (cents) */
  costAccruedCents: number;

  /** Breakdown by model */
  byModel: Map<string, ModelUsage>;

  /** Breakdown by operation */
  byOperation: Map<string, OperationUsage>;

  /** When this record was last updated */
  updatedAt: number;
}

/**
 * Usage breakdown by model.
 */
export interface ModelUsage {
  /** Model name */
  model: string;

  /** Input tokens */
  inputTokens: number;

  /** Output tokens */
  outputTokens: number;

  /** Total requests */
  requests: number;

  /** Cost (cents) */
  costCents: number;

  /** Average latency (ms) */
  avgLatencyMs: number;
}

/**
 * Usage breakdown by operation.
 */
export interface OperationUsage {
  /** Operation name */
  operation: string;

  /** Number of invocations */
  count: number;

  /** Total tokens */
  tokens: number;

  /** Cost (cents) */
  costCents: number;
}

/**
 * LLM cost tracking entry.
 */
export interface LlmCostEntry {
  /** Entry ID */
  id: string;

  /** When this occurred (epoch ms) */
  timestamp: number;

  /** User ID (if attributed) */
  userId?: string;

  /** Session ID */
  sessionId?: string;

  /** Model used */
  model: string;

  /** Operation performed */
  operation: string;

  /** Input tokens */
  inputTokens: number;

  /** Output tokens */
  outputTokens: number;

  /** Cost (cents) */
  costCents: number;

  /** Latency (ms) */
  latencyMs: number;

  /** Whether the call succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for generating a cost report.
 */
export interface CostReportOptions {
  /** Start date for the report */
  startDate: Date;

  /** End date for the report (default: now) */
  endDate?: Date;

  /** Group by (day, week, month) */
  groupBy?: 'day' | 'week' | 'month';

  /** Filter by user ID */
  userId?: string;

  /** Filter by model */
  model?: string;

  /** Filter by operation */
  operation?: string;

  /** Include detailed entries */
  includeDetails?: boolean;
}

/**
 * Generated cost report.
 */
export interface CostReport {
  /** Report period */
  period: { start: Date; end: Date };

  /** Total cost (cents) */
  totalCostCents: number;

  /** Total tokens used */
  totalTokens: number;

  /** Total requests */
  totalRequests: number;

  /** Breakdown by model */
  byModel: Map<string, ModelCost>;

  /** Breakdown by operation */
  byOperation: Map<string, number>;

  /** Breakdown by time period (based on groupBy) */
  byPeriod: Map<string, PeriodCost>;

  /** Top users by cost */
  topUsers?: Array<{ userId: string; costCents: number }>;

  /** Detailed entries (if requested) */
  entries?: LlmCostEntry[];
}

/**
 * Model cost summary.
 */
export interface ModelCost {
  /** Model name */
  model: string;

  /** Input tokens */
  inputTokens: number;

  /** Output tokens */
  outputTokens: number;

  /** Total requests */
  requests: number;

  /** Total cost (cents) */
  costCents: number;

  /** Average latency (ms) */
  avgLatencyMs: number;

  /** Error rate (0-1) */
  errorRate: number;
}

/**
 * Cost for a time period.
 */
export interface PeriodCost {
  /** Period key (e.g., '2024-01-15') */
  period: string;

  /** Cost (cents) */
  costCents: number;

  /** Tokens used */
  tokens: number;

  /** Requests */
  requests: number;
}

/**
 * Result from checking user limits.
 */
export interface LimitCheckResult {
  /** Whether the user is within limits */
  withinLimits: boolean;

  /** Which limits are exceeded */
  exceededLimits: ExceededLimit[];

  /** Current usage */
  currentUsage: UserUsage;

  /** User's tier */
  tier: UserTier;

  /** Warnings (approaching limits) */
  warnings: LimitWarning[];
}

/**
 * An exceeded limit.
 */
export interface ExceededLimit {
  /** Limit name */
  limit: string;

  /** Current value */
  current: number;

  /** Maximum allowed */
  maximum: number;

  /** Percentage over limit */
  percentOver: number;
}

/**
 * Warning about approaching a limit.
 */
export interface LimitWarning {
  /** Limit name */
  limit: string;

  /** Current usage percentage (0-100) */
  percentUsed: number;

  /** Message */
  message: string;
}

/**
 * Options for usage report.
 */
export interface UsageReportOptions {
  /** Start date */
  startDate: Date;

  /** End date */
  endDate?: Date;

  /** Group by */
  groupBy?: 'user' | 'tier' | 'model' | 'operation';

  /** Include inactive users */
  includeInactive?: boolean;

  /** Limit results */
  limit?: number;
}

/**
 * Generated usage report.
 */
export interface UsageReport {
  /** Report period */
  period: { start: Date; end: Date };

  /** Total users */
  totalUsers: number;

  /** Active users */
  activeUsers: number;

  /** Total tokens */
  totalTokens: number;

  /** Total cost (cents) */
  totalCostCents: number;

  /** Breakdown (based on groupBy) */
  breakdown: Map<string, UsageBreakdown>;
}

/**
 * Usage breakdown entry.
 */
export interface UsageBreakdown {
  key: string;
  users: number;
  tokens: number;
  costCents: number;
  requests: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN SERVICE TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for AdminService.
 */
export interface AdminServiceOptions {
  /** Enable cost tracking */
  enableCostTracking?: boolean;

  /** Cost entry retention (days) */
  costRetentionDays?: number;

  /** Usage retention (days) */
  usageRetentionDays?: number;

  /** Default tier ID */
  defaultTierId?: string;
}

/**
 * Config entry with additional metadata.
 */
export interface ConfigEntryWithMeta<T = unknown> {
  /** The value */
  value: T;

  /** Category */
  category: ConfigCategory;

  /** Key */
  key: string;

  /** Last updated */
  updatedAt: number;

  /** Updated by */
  updatedBy: string;

  /** Version */
  version: number;
}
