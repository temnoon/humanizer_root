/**
 * @humanizer/core
 *
 * Platinum Agent System - Core infrastructure for multi-agent coordination.
 *
 * This package provides:
 * - Runtime types and base classes for agents
 * - Message bus for inter-agent communication
 * - Configuration management (no hardcoded literals!)
 * - Vimalakirti boundary system (ethical guardrails)
 * - Canon (what agents know)
 * - Doctrine (how agents judge)
 * - Instruments (what agents can do)
 * - UCG (unified content graph / content pyramid)
 *
 * Core Principles:
 * 1. Intelligence is in infrastructure, not model size
 * 2. Pre/post processing handles 80%, LLM only synthesizes
 * 3. All literals (prompts, thresholds) are config-managed
 * 4. Proposal-driven semi-autonomy with user approval
 */

// ═══════════════════════════════════════════════════════════════════
// RUNTIME - Agent types and base classes
// ═══════════════════════════════════════════════════════════════════
export * from './runtime/index.js';

// ═══════════════════════════════════════════════════════════════════
// BUS - Message bus for inter-agent communication
// ═══════════════════════════════════════════════════════════════════
export * from './bus/index.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIG - Configuration management (no hardcoded literals!)
// ═══════════════════════════════════════════════════════════════════
export * from './config/index.js';

// ═══════════════════════════════════════════════════════════════════
// VIMALAKIRTI - Ethical boundary system
// ═══════════════════════════════════════════════════════════════════
export * from './vimalakirti/index.js';

// ═══════════════════════════════════════════════════════════════════
// CANON - What agents know
// ═══════════════════════════════════════════════════════════════════
export * from './canon/index.js';

// ═══════════════════════════════════════════════════════════════════
// DOCTRINE - How agents judge
// ═══════════════════════════════════════════════════════════════════
export * from './doctrine/index.js';

// ═══════════════════════════════════════════════════════════════════
// INSTRUMENTS - What agents can do
// ═══════════════════════════════════════════════════════════════════
export * from './instruments/index.js';

// ═══════════════════════════════════════════════════════════════════
// STORAGE - SQLite-backed UCG storage (canonical location)
// ═══════════════════════════════════════════════════════════════════
export * from './storage/index.js';

// ═══════════════════════════════════════════════════════════════════
// UCG - Unified Content Graph / Content Pyramid types
// ═══════════════════════════════════════════════════════════════════
export * from './ucg/index.js';

// ═══════════════════════════════════════════════════════════════════
// STATE - Agent state persistence
// ═══════════════════════════════════════════════════════════════════
export * from './state/index.js';

// ═══════════════════════════════════════════════════════════════════
// TASKS - Task queue and scheduling
// ═══════════════════════════════════════════════════════════════════
export * from './tasks/index.js';

// ═══════════════════════════════════════════════════════════════════
// COUNCIL - Orchestrator and coordination
// ═══════════════════════════════════════════════════════════════════
export * from './council/index.js';

// ═══════════════════════════════════════════════════════════════════
// HOUSES - Specialized Agent Implementations
// ═══════════════════════════════════════════════════════════════════
export * from './houses/index.js';

// ═══════════════════════════════════════════════════════════════════
// HOOKS - Review Hook System
// ═══════════════════════════════════════════════════════════════════
export * from './hooks/index.js';

// ═══════════════════════════════════════════════════════════════════
// ADAPTERS - UCG Import Adapters for content sources
// ═══════════════════════════════════════════════════════════════════
export * from './adapters/index.js';

// ═══════════════════════════════════════════════════════════════════
// CHUNKING - Content chunking for embedding
// ═══════════════════════════════════════════════════════════════════
export * from './chunking/index.js';

// ═══════════════════════════════════════════════════════════════════
// RETRIEVAL - Hybrid search and quality-gated retrieval
// ═══════════════════════════════════════════════════════════════════
export * from './retrieval/index.js';

// ═══════════════════════════════════════════════════════════════════
// PYRAMID - Multi-resolution content for large documents
// ═══════════════════════════════════════════════════════════════════
export * from './pyramid/index.js';

// ═══════════════════════════════════════════════════════════════════
// CLUSTERING - Density-based clustering (HDBSCAN) for document assembly
// ═══════════════════════════════════════════════════════════════════
export * from './clustering/index.js';

// ═══════════════════════════════════════════════════════════════════
// INTEGRATION - Agent-to-infrastructure wiring
// ═══════════════════════════════════════════════════════════════════
export * from './integration/index.js';

// ═══════════════════════════════════════════════════════════════════
// EMBEDDINGS - 3-level embedding service (L0, L1, Apex)
// ═══════════════════════════════════════════════════════════════════
export * from './embeddings/index.js';

// ═══════════════════════════════════════════════════════════════════
// MODELS - Model Registry & Vetting (Phase 1)
// ═══════════════════════════════════════════════════════════════════
export * from './models/index.js';

// ═══════════════════════════════════════════════════════════════════
// BUFFER - API-First Content Buffer System with Provenance
// ═══════════════════════════════════════════════════════════════════
export * from './buffer/index.js';

// ═══════════════════════════════════════════════════════════════════
// AUI - Agentic User Interface (Phases 1-5)
// Note: Explicit exports to avoid conflicts with runtime, instruments, etc.
// ═══════════════════════════════════════════════════════════════════
export {
  // Phase 4: Benchmark Suite
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
  DEFAULT_BENCHMARK_SUITE,
  DEFAULT_BENCHMARK_PASSAGES,
  DEFAULT_EXPECTED_BEHAVIORS,
  DEFAULT_BENCHMARK_METRICS,
  DEFAULT_BENCHMARK_WEIGHTS,
  BENCHMARK_PASSAGES,
  EXPECTED_BEHAVIORS,
  BENCHMARK_METRICS,
  BENCHMARK_WEIGHTS,
  BenchmarkRunner,

  // Phase 4: A/B Testing
  type ABTestStatus,
  type ABTestWinner,
  type ABTestConfig,
  type ABTestSample,
  type ABTestStatistics,
  type ABTestResult,
  type ABTestManagerOptions,
  ABTestManager,
  getABTestManager,
  resetABTestManager,

  // Phase 4: LLM Control Panel
  type LLMControlPanelOptions,
  type ModelSummary,
  type ModelTestRequest,
  type VettingDecision,
  type ModelHealthCheck,
  type MCPResult,
  type LLMControlPanelHandlers,
  LLMControlPanel,
  getLLMControlPanel,
  setLLMControlPanel,
  resetLLMControlPanel,

  // Phase 5: Task Embedding Service (Rho Integration)
  type TaskEmbeddingRecord,
  type SimilarTaskResult,
  type AgentSuggestion,
  type TaskOutcome,
  type TemporalDecayConfig,
  type AdaptiveThresholdConfig,
  type TaskEmbeddingServiceOptions,
  // Note: Embedder type conflicts with pyramid - use TaskEmbeddingService.Embedder or import from aui directly
  TaskEmbeddingService,
  getTaskEmbeddingService,
  setTaskEmbeddingService,
  resetTaskEmbeddingService,

  // AUI Core (buffer, admin, unified service)
  BufferManager,
  initBufferManager,
  getBufferManager,
  resetBufferManager,
  type BufferManagerOptions,
  AgenticLoop,
  createToolExecutor,
  initAgenticLoop,
  getAgenticLoop,
  resetAgenticLoop,
  type AgentLlmAdapter,
  type AgenticLoopOptions,
  AdminService,
  initAdminService,
  getAdminService,
  resetAdminService,
  UnifiedAuiService,
  createUnifiedAuiService,
  initUnifiedAui,
  initUnifiedAuiWithStorage,
  getUnifiedAui,
  resetUnifiedAui,
  type CreateUnifiedAuiOptions,
  type InitUnifiedAuiWithStorageOptions,
  AuiPostgresStore,
  initAuiStore,
  getAuiStore,
  resetAuiStore,
  type AuiPostgresStoreOptions,
  type AuiArtifact,
  type CreateArtifactOptions,

  // Usage Service (User Accounting)
  type UsageEntry,
  type QuotaCheckResult,
  type UserUsageSummary,
  type UsageReport as PersistentUsageReport,
  type UsageServiceOptions,
  type TierInfo,
  UsageService,
  initUsageService,
  getUsageService,
  resetUsageService,

  // API Key Service
  type ApiKeyScope,
  type ApiKeyInfo,
  type ApiKeyRecord,
  type CreateKeyResult,
  type ValidateKeyResult,
  type ApiKeyServiceOptions,
  ApiKeyService,
  initApiKeyService,
  getApiKeyService,
  resetApiKeyService,
} from './aui/index.js';
