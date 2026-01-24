/**
 * Unified AUI Module
 *
 * Main exports for the Agentic User Interface system:
 * - Versioned buffers with git-like operations
 * - ReAct agentic loop
 * - Admin layer (config, prompts, costs, tiers)
 * - Unified session management
 *
 * @module @humanizer/core/aui
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type {
  // Buffer types
  BufferVersion,
  BufferBranch,
  VersionedBuffer,
  BufferDiff,
  DiffModification,
  DiffStats,
  MergeResult,
  MergeConflict,
  MergeStrategy,
  ConflictResolution,
  SerializedBuffer,
  ContentSchema,

  // Agent types
  AgentStep,
  AgentStepType,
  AgentTask,
  AgentTaskStatus,
  AgentPlanStep,
  AgentLoopOptions,
  ToolCall,
  ToolResult,
  ToolDefinition,
  ToolParameter,
  ToolExample,
  TaskContext,
  ReasoningResult,

  // Admin types
  UserTier,
  TierLimits,
  UserUsage,
  ModelUsage,
  OperationUsage,
  LlmCostEntry,
  CostReportOptions,
  CostReport,
  ModelCost,
  PeriodCost,
  LimitCheckResult,
  ExceededLimit,
  LimitWarning,
  UsageReportOptions,
  UsageReport,
  UsageBreakdown,
  AdminServiceOptions,

  // Session types
  UnifiedAuiSession,
  SessionMetadata,

  // Service types
  UnifiedAuiServiceOptions,
  ProcessOptions,
  AuiResponse,
  BqlOptions,
  BqlResult,
  BqlStats,

  // MCP types
  McpToolDefinition,
  McpPropertySchema,
  McpResult,

  // Config types (re-exported)
  ConfigEntryWithMeta,

  // Archive & embedding types
  ArchiveStats,
  EmbedAllOptions,
  EmbedResult,
  EmbeddingProgress,

  // Clustering types
  ClusterDiscoveryOptions,
  ClusterDiscoveryResult,
  ContentCluster,
  ClusterPassage,
  ClusteringProgress,

  // Book creation types
  BookFromClusterOptions,
  BookCreationProgress,
  HarvestOptions,
  HarvestResult,
  HarvestedPassage,
  GenerateArcOptions,
  NarrativeArc,
  ArcChapter,
  Book,
  BookChapter,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export {
  AUI_CONFIG_KEYS,
  AUI_DEFAULTS,
  TOOL_NAMES,
  DEFAULT_TIERS,
  MODEL_COST_RATES,
  OPERATION_TYPES,
  DEFAULT_BRANCH_NAME,
  VERSION_ID_LENGTH,
  MAX_BUFFER_ITEMS,
  DESTRUCTIVE_TOOLS,
  MAX_TOOL_RESULT_SIZE,
  MAX_HISTORY_IN_CONTEXT,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER MANAGER
// ═══════════════════════════════════════════════════════════════════════════

export {
  BufferManager,
  initBufferManager,
  getBufferManager,
  resetBufferManager,
  type BufferManagerOptions,
} from './buffer-manager.js';

// ═══════════════════════════════════════════════════════════════════════════
// AGENTIC LOOP
// ═══════════════════════════════════════════════════════════════════════════

export {
  AgenticLoop,
  createToolExecutor,
  initAgenticLoop,
  getAgenticLoop,
  resetAgenticLoop,
  type AgentLlmAdapter,
  type ToolExecutor,
  type AgenticLoopOptions,
} from './agentic-loop.js';

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export {
  AdminService,
  initAdminService,
  getAdminService,
  resetAdminService,
} from './admin-service.js';

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED AUI SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export {
  UnifiedAuiService,
  createUnifiedAuiService,
  initUnifiedAui,
  initUnifiedAuiWithStorage,
  getUnifiedAui,
  resetUnifiedAui,
  type CreateUnifiedAuiOptions,
  type InitUnifiedAuiWithStorageOptions,
} from './unified-aui-service.js';

// ═══════════════════════════════════════════════════════════════════════════
// AUI POSTGRES STORE
// ═══════════════════════════════════════════════════════════════════════════

export {
  AuiPostgresStore,
  initAuiStore,
  getAuiStore,
  resetAuiStore,
  type AuiPostgresStoreOptions,
  type AuiArtifact,
  type CreateArtifactOptions,
} from '../storage/aui-postgres-store.js';
