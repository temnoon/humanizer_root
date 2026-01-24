/**
 * Unified AUI Types
 *
 * Type definitions for the Unified Agentic User Interface (AUI):
 * - Versioned buffers with git-like branching
 * - Agentic loop (ReAct pattern)
 * - Admin layer (config, prompts, costs, tiers)
 * - Unified session management
 *
 * @module @humanizer/core/aui/types
 */

import type {
  AgenticSearchResult,
  AgenticSearchOptions,
  RefineOptions,
  SemanticAnchor,
} from '../agentic-search/types.js';
import type { ConfigCategory, PromptTemplate } from '../config/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// VERSIONED BUFFER TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single version of content in a buffer.
 * Represents a committed state of the buffer at a point in time.
 */
export interface BufferVersion {
  /** Unique version ID (short hash, e.g., 'a1b2c3d') */
  id: string;

  /** The committed content */
  content: unknown[];

  /** Commit message describing the changes */
  message: string;

  /** Timestamp when this version was created (epoch ms) */
  timestamp: number;

  /** Parent version ID (null for initial commit) */
  parentId: string | null;

  /** Named tags for easy reference (e.g., 'v1.0', 'stable') */
  tags: string[];

  /** Additional metadata attached to this version */
  metadata: Record<string, unknown>;
}

/**
 * A branch in the buffer version history.
 * Branches allow parallel experimentation with buffer content.
 */
export interface BufferBranch {
  /** Branch name (e.g., 'main', 'experiment-1') */
  name: string;

  /** Version ID at the tip of this branch */
  headVersionId: string;

  /** When this branch was created (epoch ms) */
  createdAt: number;

  /** Optional description of what this branch is for */
  description?: string;

  /** Branch from which this was created */
  parentBranch?: string;
}

/**
 * A versioned buffer with full git-like capabilities.
 * Stores content with history, branches, and merge support.
 */
export interface VersionedBuffer {
  /** Unique buffer identifier */
  id: string;

  /** User-facing buffer name */
  name: string;

  /** All branches in this buffer */
  branches: Map<string, BufferBranch>;

  /** All versions (commits) in this buffer */
  versions: Map<string, BufferVersion>;

  /** Currently active branch name */
  currentBranch: string;

  /** Uncommitted working content */
  workingContent: unknown[];

  /** Whether working content differs from HEAD */
  isDirty: boolean;

  /** When this buffer was created (epoch ms) */
  createdAt: number;

  /** When this buffer was last modified (epoch ms) */
  updatedAt: number;

  /** Optional schema for content validation */
  schema?: ContentSchema;
}

/**
 * Schema definition for buffer content validation.
 */
export interface ContentSchema {
  /** Schema name/type */
  type: string;

  /** Required fields in content items */
  requiredFields?: string[];

  /** Field type definitions */
  fieldTypes?: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>;
}

/**
 * Diff between two buffer versions.
 * Describes what changed between versions.
 */
export interface BufferDiff {
  /** Source version ID */
  fromVersion: string;

  /** Target version ID */
  toVersion: string;

  /** Items added in target */
  added: unknown[];

  /** Items removed from source */
  removed: unknown[];

  /** Items that changed */
  modified: DiffModification[];

  /** Human-readable summary */
  summary: string;

  /** Statistics about the diff */
  stats: DiffStats;
}

/**
 * A single modification in a diff.
 */
export interface DiffModification {
  /** Index of the modified item */
  index: number;

  /** Old value */
  old: unknown;

  /** New value */
  new: unknown;

  /** Which fields changed (for objects) */
  changedFields?: string[];
}

/**
 * Statistics about a diff.
 */
export interface DiffStats {
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  unchangedCount: number;
}

/**
 * Result of a merge operation.
 */
export interface MergeResult {
  /** Whether the merge succeeded */
  success: boolean;

  /** Conflicts that need resolution (if any) */
  conflicts: MergeConflict[];

  /** Merged content (if successful) */
  mergedContent?: unknown[];

  /** ID of the merge commit (if successful) */
  newVersionId?: string;

  /** Merge strategy used */
  strategy: MergeStrategy;

  /** Details about the merge */
  details: string;
}

/**
 * A conflict that occurred during merge.
 */
export interface MergeConflict {
  /** Index of the conflicting item */
  index: number;

  /** Value from current branch ('ours') */
  ours: unknown;

  /** Value from source branch ('theirs') */
  theirs: unknown;

  /** Common ancestor value (if available) */
  base?: unknown;

  /** Resolved value (set when conflict is resolved) */
  resolved?: unknown;

  /** How this conflict was resolved */
  resolution?: ConflictResolution;
}

/**
 * How a merge conflict was resolved.
 */
export type ConflictResolution = 'ours' | 'theirs' | 'both' | 'custom';

/**
 * Merge strategy to use.
 */
export type MergeStrategy = 'auto' | 'ours' | 'theirs' | 'union';

/**
 * Serialized buffer for persistence.
 */
export interface SerializedBuffer {
  id: string;
  name: string;
  branches: Array<[string, BufferBranch]>;
  versions: Array<[string, BufferVersion]>;
  currentBranch: string;
  workingContent: unknown[];
  isDirty: boolean;
  createdAt: number;
  updatedAt: number;
  schema?: ContentSchema;
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENTIC LOOP TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Step types in the ReAct agentic loop.
 */
export type AgentStepType =
  | 'reason'   // Analyzing current state, deciding next action
  | 'act'      // Executing a tool or action
  | 'observe'  // Processing tool result
  | 'adjust'   // Modifying plan based on observation
  | 'complete' // Task finished successfully
  | 'error';   // Task failed

/**
 * A single step in the agentic reasoning process.
 */
export interface AgentStep {
  /** Unique step identifier */
  id: string;

  /** Type of step */
  type: AgentStepType;

  /** The reasoning or action description */
  content: string;

  /** Tool call details (for 'act' steps) */
  toolCall?: ToolCall;

  /** Tool result (for 'observe' steps) */
  toolResult?: ToolResult;

  /** When this step occurred (epoch ms) */
  timestamp: number;

  /** How long this step took (ms) */
  durationMs?: number;

  /** Tokens used in this step */
  tokensUsed?: number;

  /** Confidence in this step (0-1) */
  confidence?: number;
}

/**
 * A tool call made by the agent.
 */
export interface ToolCall {
  /** Tool name (BQL operation, MCP tool, etc.) */
  tool: string;

  /** Arguments passed to the tool */
  args: Record<string, unknown>;

  /** Raw BQL pipeline (if tool is BQL execution) */
  rawBql?: string;

  /** Whether this is a destructive action */
  isDestructive?: boolean;

  /** Whether user approval is required */
  requiresApproval?: boolean;
}

/**
 * Result from executing a tool.
 */
export interface ToolResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Result data (if successful) */
  data?: unknown;

  /** Error message (if failed) */
  error?: string;

  /** Tokens used by the tool (e.g., for LLM-based tools) */
  tokensUsed?: number;

  /** Cost of this tool call (cents) */
  costCents?: number;

  /** Execution duration (ms) */
  durationMs?: number;

  /** Warnings from the tool */
  warnings?: string[];
}

/**
 * Task status in the agentic loop.
 */
export type AgentTaskStatus =
  | 'pending'        // Task created but not started
  | 'planning'       // Decomposing and planning steps
  | 'executing'      // Running through steps
  | 'awaiting_input' // Waiting for user approval or input
  | 'paused'         // Paused by user
  | 'completed'      // Successfully finished
  | 'failed'         // Failed with error
  | 'cancelled';     // Cancelled by user

/**
 * An agentic task being executed.
 */
export interface AgentTask {
  /** Unique task identifier */
  id: string;

  /** Original user request */
  request: string;

  /** Current task status */
  status: AgentTaskStatus;

  /** All steps executed so far */
  steps: AgentStep[];

  /** Decomposed plan (if planning was done) */
  plan?: AgentPlanStep[];

  /** Index of current step in plan */
  currentStepIndex: number;

  /** Final result (if completed) */
  result?: unknown;

  /** Error message (if failed) */
  error?: string;

  /** When task started (epoch ms) */
  startedAt: number;

  /** When task completed (epoch ms) */
  completedAt?: number;

  /** Total tokens used across all steps */
  totalTokens: number;

  /** Total cost (cents) */
  totalCostCents: number;

  /** Context for this task */
  context: TaskContext;

  /** Priority (1=highest, 5=lowest) */
  priority: number;

  /** User who initiated this task */
  userId?: string;
}

/**
 * A step in the agent's plan.
 */
export interface AgentPlanStep {
  /** Step description */
  description: string;

  /** Tool to use (if known) */
  tool?: string;

  /** Expected output */
  expectedOutput?: string;

  /** Dependencies on other steps (indices) */
  dependsOn?: number[];

  /** Whether this step is completed */
  completed: boolean;

  /** Actual result (when completed) */
  result?: unknown;
}

/**
 * Context for an agentic task.
 */
export interface TaskContext {
  /** Active buffer name */
  activeBuffer?: string;

  /** Active search session ID */
  searchSessionId?: string;

  /** Variables available to the task */
  variables: Map<string, unknown>;

  /** Previous task results (for chaining) */
  previousResults?: unknown[];

  /** Custom context data */
  custom?: Record<string, unknown>;
}

/**
 * Options for the agentic loop.
 */
export interface AgentLoopOptions {
  /** Maximum reasoning steps (default: 20) */
  maxSteps?: number;

  /** Maximum tokens per LLM call */
  maxTokens?: number;

  /** LLM temperature (0-1) */
  temperature?: number;

  /** Auto-approve destructive actions without user confirmation */
  autoApprove?: boolean;

  /** Emit step-by-step updates */
  verbose?: boolean;

  /** Model to use (default: configured default) */
  model?: string;

  /** Callback for each step */
  onStep?: (step: AgentStep) => void;

  /** Callback when approval is needed */
  onApprovalNeeded?: (action: ToolCall) => Promise<boolean>;

  /** Callback for status changes */
  onStatusChange?: (task: AgentTask) => void;

  /** Task priority (1-5) */
  priority?: number;

  /** Maximum time to run (ms) */
  timeoutMs?: number;
}

/**
 * Result from reasoning step.
 */
export interface ReasoningResult {
  /** Next action to take */
  nextAction: 'tool' | 'complete' | 'ask_user' | 'adjust_plan';

  /** Reasoning explanation */
  reasoning: string;

  /** Tool call (if nextAction is 'tool') */
  toolCall?: ToolCall;

  /** Answer (if nextAction is 'complete') */
  answer?: string;

  /** Question (if nextAction is 'ask_user') */
  question?: string;

  /** Plan adjustment (if nextAction is 'adjust_plan') */
  planAdjustment?: string;

  /** Confidence in this decision (0-1) */
  confidence: number;
}

/**
 * A tool definition for the agentic loop.
 */
export interface ToolDefinition {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Parameter schema */
  parameters: Record<string, ToolParameter>;

  /** Required parameters */
  required?: string[];

  /** Whether this is a destructive action */
  isDestructive?: boolean;

  /** Examples of usage */
  examples?: ToolExample[];
}

/**
 * A tool parameter definition.
 */
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: unknown[];
  default?: unknown;
  items?: ToolParameter; // For arrays
  properties?: Record<string, ToolParameter>; // For objects
}

/**
 * Example usage of a tool.
 */
export interface ToolExample {
  description: string;
  args: Record<string, unknown>;
  expectedOutput?: string;
}

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
// UNIFIED AUI SESSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Combined AUI session state.
 * A session spans all AUI capabilities: buffers, search, agent tasks.
 */
export interface UnifiedAuiSession {
  /** Session ID */
  id: string;

  /** Optional session name */
  name?: string;

  /** User ID (if authenticated) */
  userId?: string;

  // Buffer state
  /** Versioned buffers in this session */
  buffers: Map<string, VersionedBuffer>;

  /** Currently active buffer name */
  activeBufferName?: string;

  // Search state
  /** Linked search session ID */
  searchSessionId?: string;

  // Task state
  /** Currently running agent task */
  currentTask?: AgentTask;

  /** Completed task history */
  taskHistory: AgentTask[];

  // BQL state
  /** Command history */
  commandHistory: string[];

  /** Session variables */
  variables: Map<string, unknown>;

  // Metadata
  /** When created (epoch ms) */
  createdAt: number;

  /** When last updated (epoch ms) */
  updatedAt: number;

  /** When this session expires (epoch ms) */
  expiresAt?: number;

  /** Session metadata */
  metadata: SessionMetadata;
}

/**
 * Session metadata.
 */
export interface SessionMetadata {
  /** Total commands executed */
  commandCount: number;

  /** Total searches performed */
  searchCount: number;

  /** Total agent tasks run */
  taskCount: number;

  /** User agent string */
  userAgent?: string;

  /** Client IP (for rate limiting) */
  clientIp?: string;

  /** Custom metadata */
  custom?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for UnifiedAuiService.
 */
export interface UnifiedAuiServiceOptions {
  /** Default agent loop options */
  defaultAgentOptions?: Partial<AgentLoopOptions>;

  /** Default search options */
  defaultSearchOptions?: Partial<AgenticSearchOptions>;

  /** Maximum sessions to keep */
  maxSessions?: number;

  /** Session timeout (ms) */
  sessionTimeoutMs?: number;

  /** Enable cost tracking */
  enableCostTracking?: boolean;

  /** Enable audit logging */
  enableAuditLogging?: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Options for processing a request.
 */
export interface ProcessOptions {
  /** Whether this is a dry run */
  dryRun?: boolean;

  /** Maximum items to return */
  maxItems?: number;

  /** Verbose output */
  verbose?: boolean;

  /** Route hints (bypass intent detection) */
  route?: 'search' | 'bql' | 'agent' | 'admin';
}

/**
 * Response from processing a request.
 */
export interface AuiResponse {
  /** Response type */
  type: 'success' | 'error' | 'awaiting_input' | 'partial';

  /** Human-readable message */
  message: string;

  /** Result data */
  data?: unknown;

  /** Suggestions for next actions */
  suggestions?: string[];

  /** Whether more input is needed */
  awaitInput?: boolean;

  /** Prompt for user input (if awaitInput) */
  inputPrompt?: string;

  /** Tokens used */
  tokensUsed?: number;

  /** Cost (cents) */
  costCents?: number;
}

/**
 * Options for BQL execution.
 */
export interface BqlOptions {
  /** Dry run (parse only) */
  dryRun?: boolean;

  /** Maximum items */
  maxItems?: number;

  /** Verbose output */
  verbose?: boolean;

  /** Timeout (ms) */
  timeoutMs?: number;
}

/**
 * Result from BQL execution.
 */
export interface BqlResult {
  /** Execution type */
  type: 'success' | 'error' | 'partial';

  /** Message */
  message: string;

  /** Result data */
  data?: unknown[];

  /** Pipeline that was executed */
  pipeline?: string;

  /** Suggestions */
  suggestions?: string[];

  /** Execution statistics */
  stats?: BqlStats;
}

/**
 * BQL execution statistics.
 */
export interface BqlStats {
  /** Operations executed */
  operationsCount: number;

  /** Items processed */
  itemsProcessed: number;

  /** Items produced */
  itemsProduced: number;

  /** Duration (ms) */
  durationMs: number;

  /** Tokens used (if LLM operations) */
  tokensUsed?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP TYPES (for tool definitions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * MCP tool definition.
 */
export interface McpToolDefinition {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Input schema */
  inputSchema: {
    type: 'object';
    properties: Record<string, McpPropertySchema>;
    required?: string[];
  };
}

/**
 * MCP property schema.
 */
export interface McpPropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: unknown[];
  default?: unknown;
  items?: McpPropertySchema;
  properties?: Record<string, McpPropertySchema>;
  required?: string[];
}

/**
 * MCP tool result.
 */
export interface McpResult {
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
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

// ═══════════════════════════════════════════════════════════════════════════
// ARCHIVE & EMBEDDING TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Statistics about the archive and embeddings.
 */
export interface ArchiveStats {
  /** Total content nodes */
  totalNodes: number;

  /** Nodes with embeddings */
  nodesWithEmbeddings: number;

  /** Nodes needing embeddings */
  nodesNeedingEmbeddings: number;

  /** Embedding coverage percentage */
  embeddingCoverage: number;

  /** Nodes by source type */
  bySourceType: Record<string, number>;

  /** Nodes by author role */
  byAuthorRole: Record<string, number>;

  /** Date range */
  dateRange: {
    earliest: Date | null;
    latest: Date | null;
  };

  /** Average word count */
  avgWordCount: number;

  /** Total word count */
  totalWordCount: number;
}

/**
 * Options for embedding all archive content.
 */
export interface EmbedAllOptions {
  /** Batch size for embedding */
  batchSize?: number;

  /** Minimum word count (filter short messages) */
  minWordCount?: number;

  /** Maximum nodes to process (limit for testing) */
  limit?: number;

  /** Source types to include */
  sourceTypes?: string[];

  /** Author roles to include */
  authorRoles?: ('user' | 'assistant' | 'system' | 'tool')[];

  /** Content filter function */
  contentFilter?: (text: string) => boolean;

  /** Progress callback */
  onProgress?: (progress: EmbeddingProgress) => void;

  /** Whether to skip already embedded nodes */
  skipExisting?: boolean;
}

/**
 * Progress update during embedding.
 */
export interface EmbeddingProgress {
  /** Current phase */
  phase: 'loading' | 'filtering' | 'embedding' | 'storing' | 'complete';

  /** Nodes processed */
  processed: number;

  /** Total nodes */
  total: number;

  /** Current batch */
  currentBatch: number;

  /** Total batches */
  totalBatches: number;

  /** Nodes skipped (already embedded or filtered) */
  skipped: number;

  /** Nodes failed */
  failed: number;

  /** Elapsed time (ms) */
  elapsedMs: number;

  /** Estimated remaining time (ms) */
  estimatedRemainingMs: number;

  /** Current node being processed */
  currentNode?: string;

  /** Error messages */
  errors: string[];
}

/**
 * Result from embedding operation.
 */
export interface EmbedResult {
  /** Whether operation succeeded */
  success: boolean;

  /** Nodes embedded */
  embedded: number;

  /** Nodes skipped */
  skipped: number;

  /** Nodes failed */
  failed: number;

  /** Duration (ms) */
  durationMs: number;

  /** Error message (if failed) */
  error?: string;

  /** Detailed errors */
  errors: Array<{ nodeId: string; error: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUSTERING TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for cluster discovery.
 */
export interface ClusterDiscoveryOptions {
  /** Minimum cluster size */
  minClusterSize?: number;

  /** Maximum clusters to return */
  maxClusters?: number;

  /** Minimum similarity threshold for cluster membership */
  minSimilarity?: number;

  /** Content filters (exclude certain patterns) */
  excludePatterns?: string[];

  /** Minimum word count for passages */
  minWordCount?: number;

  /** Source types to include */
  sourceTypes?: string[];

  /** Author roles to include */
  authorRoles?: ('user' | 'assistant')[];

  /** Whether to generate cluster labels using LLM */
  generateLabels?: boolean;

  /** Progress callback */
  onProgress?: (progress: ClusteringProgress) => void;
}

/**
 * Progress update during clustering.
 */
export interface ClusteringProgress {
  /** Current phase */
  phase: 'loading' | 'sampling' | 'clustering' | 'labeling' | 'complete';

  /** Current step */
  step: number;

  /** Total steps */
  totalSteps: number;

  /** Message */
  message: string;
}

/**
 * A discovered cluster of semantically related content.
 */
export interface ContentCluster {
  /** Cluster ID */
  id: string;

  /** Generated label for this cluster */
  label: string;

  /** Cluster description */
  description: string;

  /** Representative passages (top by centrality) */
  passages: ClusterPassage[];

  /** Number of total passages in cluster */
  totalPassages: number;

  /** Cluster coherence score (0-1) */
  coherence: number;

  /** Keywords extracted from cluster */
  keywords: string[];

  /** Source distribution */
  sourceDistribution: Record<string, number>;

  /** Date range of passages */
  dateRange: {
    earliest: Date | null;
    latest: Date | null;
  };

  /** Average word count */
  avgWordCount: number;

  /** Centroid embedding (optional) */
  centroid?: number[];
}

/**
 * A passage within a cluster.
 */
export interface ClusterPassage {
  /** Node ID */
  id: string;

  /** Text content */
  text: string;

  /** Source type */
  sourceType: string;

  /** Author role */
  authorRole?: string;

  /** Word count */
  wordCount: number;

  /** Distance from cluster centroid (0 = center) */
  distanceFromCentroid: number;

  /** Source created date */
  sourceCreatedAt?: Date;

  /** Conversation/thread title */
  title?: string;
}

/**
 * Result from cluster discovery.
 */
export interface ClusterDiscoveryResult {
  /** Discovered clusters */
  clusters: ContentCluster[];

  /** Total passages analyzed */
  totalPassages: number;

  /** Passages assigned to clusters */
  assignedPassages: number;

  /** Noise passages (not assigned) */
  noisePassages: number;

  /** Duration (ms) */
  durationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOK CREATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for creating a book from a cluster.
 */
export interface BookFromClusterOptions {
  /** Book title (auto-generated if not provided) */
  title?: string;

  /** Maximum passages to include */
  maxPassages?: number;

  /** Whether to generate an introduction */
  generateIntro?: boolean;

  /** Narrative arc type */
  arcType?: 'chronological' | 'thematic' | 'dramatic' | 'exploratory';

  /** Target audience */
  audience?: string;

  /** Writing style */
  style?: 'conversational' | 'formal' | 'literary' | 'journalistic';

  /** Include source attribution */
  includeAttribution?: boolean;

  /** Progress callback */
  onProgress?: (progress: BookCreationProgress) => void;
}

/**
 * Progress update during book creation.
 */
export interface BookCreationProgress {
  /** Current phase */
  phase: 'gathering' | 'organizing' | 'generating_arc' | 'writing_intro' | 'assembling' | 'complete';

  /** Current step */
  step: number;

  /** Total steps */
  totalSteps: number;

  /** Message */
  message: string;
}

/**
 * Options for harvest operation.
 */
export interface HarvestOptions {
  /** Theme or query for harvesting */
  query: string;

  /** Maximum passages to harvest */
  limit?: number;

  /** Minimum relevance score */
  minRelevance?: number;

  /** Source diversity target (max from single source) */
  maxFromSingleSource?: number;

  /** Date range filter */
  dateRange?: {
    start?: Date;
    end?: Date;
  };

  /** Exclude node IDs */
  excludeIds?: string[];
}

/**
 * Result from harvest operation.
 */
export interface HarvestResult {
  /** Harvested passages */
  passages: HarvestedPassage[];

  /** Query used */
  query: string;

  /** Total candidates found */
  candidatesFound: number;

  /** Duration (ms) */
  durationMs: number;
}

/**
 * A harvested passage.
 */
export interface HarvestedPassage {
  /** Node ID */
  id: string;

  /** Text content */
  text: string;

  /** Relevance score */
  relevance: number;

  /** Source type */
  sourceType: string;

  /** Author role */
  authorRole?: string;

  /** Conversation/thread title */
  title?: string;

  /** Source created date */
  sourceCreatedAt?: Date;

  /** Word count */
  wordCount: number;
}

/**
 * Options for generating narrative arc.
 */
export interface GenerateArcOptions {
  /** Passages to organize */
  passages: HarvestedPassage[];

  /** Arc type */
  arcType?: 'chronological' | 'thematic' | 'dramatic' | 'exploratory';

  /** Target word count for introduction */
  introWordCount?: number;

  /** Include chapter summaries */
  includeChapterSummaries?: boolean;
}

/**
 * Generated narrative arc.
 */
export interface NarrativeArc {
  /** Arc title */
  title: string;

  /** Arc type used */
  arcType: string;

  /** Introduction text */
  introduction: string;

  /** Organized chapters */
  chapters: ArcChapter[];

  /** Overall themes identified */
  themes: string[];

  /** Suggested transitions between chapters */
  transitions: string[];
}

/**
 * A chapter in the narrative arc.
 */
export interface ArcChapter {
  /** Chapter title */
  title: string;

  /** Chapter summary */
  summary: string;

  /** Passage IDs in this chapter */
  passageIds: string[];

  /** Chapter theme */
  theme: string;

  /** Position in arc */
  position: number;
}

/**
 * A book entity.
 */
export interface Book {
  /** Book ID */
  id: string;

  /** Book title */
  title: string;

  /** Book description */
  description: string;

  /** Narrative arc */
  arc: NarrativeArc;

  /** Chapters with full content */
  chapters: BookChapter[];

  /** Source cluster ID (if created from cluster) */
  sourceClusterId?: string;

  /** Creation date */
  createdAt: Date;

  /** Last updated date */
  updatedAt: Date;

  /** Status */
  status: 'draft' | 'published' | 'archived';

  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * A chapter in a book.
 */
export interface BookChapter {
  /** Chapter ID */
  id: string;

  /** Chapter title */
  title: string;

  /** Chapter content (assembled from passages) */
  content: string;

  /** Source passage IDs */
  passageIds: string[];

  /** Position in book */
  position: number;

  /** Word count */
  wordCount: number;
}
