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

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK SUITE (Phase 4)
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Types
  type BenchmarkPassage,
  type PassageCategory,
  type ExpectedBehavior,
  type BenchmarkMetrics,
  type BenchmarkWeights,
  type BenchmarkSuite,
  type PassageBenchmarkResult,
  type BenchmarkSuiteResult,
  type BenchmarkRunnerOptions,
  type ModelInvoker,
  type EmbeddingGenerator,

  // Default suite
  DEFAULT_BENCHMARK_SUITE,
  DEFAULT_BENCHMARK_PASSAGES,
  DEFAULT_EXPECTED_BEHAVIORS,
  DEFAULT_BENCHMARK_METRICS,
  DEFAULT_BENCHMARK_WEIGHTS,

  // Aliases
  BENCHMARK_PASSAGES,
  EXPECTED_BEHAVIORS,
  BENCHMARK_METRICS,
  BENCHMARK_WEIGHTS,

  // Runner
  BenchmarkRunner,
} from './benchmark-suite.js';

// ═══════════════════════════════════════════════════════════════════════════
// A/B TESTING (Phase 4)
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Types
  type ABTestStatus,
  type ABTestWinner,
  type ABTestConfig,
  type ABTestSample,
  type ABTestStatistics,
  type ABTestResult,
  type ABTestManagerOptions,

  // Manager
  ABTestManager,
  getABTestManager,
  resetABTestManager,
} from './ab-testing.js';

// ═══════════════════════════════════════════════════════════════════════════
// LLM CONTROL PANEL (Phase 4)
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Types
  type LLMControlPanelOptions,
  type ModelSummary,
  type ModelTestRequest,
  type VettingDecision,
  type ModelHealthCheck,
  type MCPResult,
  type LLMControlPanelHandlers,

  // Service
  LLMControlPanel,
  getLLMControlPanel,
  setLLMControlPanel,
  resetLLMControlPanel,
} from './llm-control-panel.js';

// ═══════════════════════════════════════════════════════════════════════════
// TASK EMBEDDING SERVICE (Phase 5 - Rho Integration)
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Types
  type TaskEmbeddingRecord,
  type SimilarTaskResult,
  type AgentSuggestion,
  type TaskOutcome,
  type TemporalDecayConfig,
  type AdaptiveThresholdConfig,
  type TaskEmbeddingServiceOptions,
  type Embedder,

  // Service
  TaskEmbeddingService,
  getTaskEmbeddingService,
  setTaskEmbeddingService,
  resetTaskEmbeddingService,
} from './task-embedding-service.js';
