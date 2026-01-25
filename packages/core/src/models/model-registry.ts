/**
 * Model Registry Types and Interfaces
 *
 * Centralizes all model configuration to eliminate hardcoded model names.
 * Part of Phase 1: Model Registry & Vetting Enforcement.
 *
 * Core Principles:
 * 1. No model names hardcoded in code - use registry lookups
 * 2. All models must be vetted before production use
 * 3. Fallback chains ensure graceful degradation
 * 4. Capability-based selection enables prompt portability
 *
 * @module models/model-registry
 */

// ═══════════════════════════════════════════════════════════════════
// VETTING STATUS
// ═══════════════════════════════════════════════════════════════════

/**
 * Status of model vetting process
 */
export type VettingStatus =
  | 'pending'      // Registered but not yet tested
  | 'testing'      // Currently being benchmarked
  | 'approved'     // Passed benchmarks, production-ready
  | 'deprecated'   // Scheduled for removal
  | 'failed'       // Did not pass benchmarks
  | 'suspended';   // Temporarily disabled (API issues, etc.)

// ═══════════════════════════════════════════════════════════════════
// PERFORMANCE PROFILE
// ═══════════════════════════════════════════════════════════════════

/**
 * Benchmark result from vetting
 */
export interface BenchmarkResult {
  /** Name of the benchmark */
  name: string;

  /** Score achieved (0-1) */
  score: number;

  /** When the benchmark was run */
  runAt: Date;

  /** Latency during benchmark */
  avgLatencyMs: number;

  /** Additional metrics */
  metrics?: Record<string, number>;
}

/**
 * Performance characteristics from vetting
 */
export interface PerformanceProfile {
  /** Average latency in milliseconds */
  avgLatencyMs: number;

  /** Quality score from benchmarks (0-1) */
  qualityScore: number;

  /** When last vetted */
  lastVetted: Date;

  /** Capabilities that passed vetting (may be subset of model capabilities) */
  approvedCapabilities?: string[];

  /** Detailed benchmark results */
  benchmarkResults?: BenchmarkResult[];
}

// ═══════════════════════════════════════════════════════════════════
// VETTED MODEL
// ═══════════════════════════════════════════════════════════════════

/**
 * A model that has been registered and potentially vetted
 */
export interface VettedModel {
  /** Unique model identifier (e.g., 'nomic-embed-text:latest') */
  id: string;

  /** Provider name (e.g., 'ollama', 'openai', 'anthropic') */
  provider: ModelProvider;

  /** Capabilities this model provides */
  capabilities: ModelCapability[];

  /** Embedding dimensions (for embedding models) */
  dimensions?: number;

  /** Context window size in tokens (for completion models) */
  contextWindow?: number;

  /** Cost per 1000 tokens */
  costPer1kTokens: { input: number; output: number };

  /** Current vetting status */
  vettingStatus: VettingStatus;

  /** Performance data from vetting */
  performanceProfile: PerformanceProfile;

  // ─────────────────────────────────────────────────────────────────
  // Extended properties (Council additions)
  // ─────────────────────────────────────────────────────────────────

  /** Maximum items per batch for batch operations */
  maxBatchSize?: number;

  /** Input token limit (distinct from contextWindow for output) */
  tokenLimit?: number;

  /** Whether model has cold-start latency (e.g., Ollama) */
  warmupRequired?: boolean;

  /** Provider-specific endpoint override */
  providerEndpoint?: string;

  /** Alias names that resolve to this model */
  aliases?: string[];

  /** Whether model supports streaming responses */
  supportsStreaming?: boolean;

  /** Whether model supports vision/multimodal input */
  supportsVision?: boolean;

  /** Whether model supports JSON mode / structured output */
  supportsJsonMode?: boolean;

  /** Provider-specific configuration overrides */
  configOverrides?: Record<string, unknown>;

  /** Human-readable description */
  description?: string;

  // ─────────────────────────────────────────────────────────────────
  // Privacy & Compliance (CRITICAL for user trust)
  // ─────────────────────────────────────────────────────────────────

  /** Privacy level - where user data is processed */
  privacyLevel: PrivacyLevel;

  /** Extended privacy information for user awareness */
  privacyInfo?: PrivacyInfo;
}

// ═══════════════════════════════════════════════════════════════════
// MODEL CAPABILITIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Standard model capabilities
 */
export type ModelCapability =
  | 'embedding'         // Text embeddings
  | 'completion'        // Text completion/generation
  | 'chat'              // Conversational
  | 'analysis'          // Deep analysis/reasoning
  | 'creative'          // Creative writing
  | 'code'              // Code generation/analysis
  | 'vision'            // Image understanding
  | 'thinking'          // Extended reasoning
  | 'function-calling'  // Tool use
  | 'json-mode'         // Structured output
  | 'long-context';     // Extended context window (>32k)

/**
 * Model provider identifiers
 */
export type ModelProvider =
  | 'ollama'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'voyage'
  | 'cohere'
  | 'local'
  | 'custom';

/**
 * Privacy level for data handling
 *
 * Users MUST be informed where their archive content is being sent.
 * This is a critical trust and compliance requirement.
 */
export type PrivacyLevel =
  | 'local'           // Data stays on user's machine (Ollama, local models)
  | 'cloud-trusted'   // Processed by our infrastructure (Cloudflare Workers AI)
  | 'third-party';    // Sent to external API (OpenAI, Anthropic, Google, etc.)

/**
 * Privacy metadata for user awareness
 */
export interface PrivacyInfo {
  /** Privacy classification */
  level: PrivacyLevel;

  /** User-facing warning message */
  warning?: string;

  /** Data retention policy (if known) */
  dataRetention?: string;

  /** Whether provider may train on data */
  mayTrainOnData?: boolean;

  /** Link to provider's privacy policy */
  privacyPolicyUrl?: string;
}

// ═══════════════════════════════════════════════════════════════════
// FALLBACK CHAINS
// ═══════════════════════════════════════════════════════════════════

/**
 * Conditions for selecting a model in fallback chain
 */
export interface FallbackConditions {
  /** Maximum acceptable latency */
  maxLatencyMs?: number;

  /** Maximum cost per 1k tokens */
  maxCostPer1k?: number;

  /** Must be a local model (privacy requirement) */
  requiresLocal?: boolean;

  /** Must support streaming */
  requiresStreaming?: boolean;

  /** Must support JSON mode */
  requiresJsonMode?: boolean;
}

/**
 * A chain of models to try for a capability
 */
export interface FallbackChain {
  /** Capability this chain handles */
  capability: ModelCapability;

  /** Ordered list of models to try */
  chain: Array<{
    modelId: string;
    conditions?: FallbackConditions;
  }>;

  /** Final fallback if all chain models fail */
  ultimateFallback: string;

  /** What to do if even ultimate fallback fails */
  onFailure: 'error' | 'degrade' | 'queue';
}

/**
 * Default fallback chains for common capabilities
 */
export const DEFAULT_FALLBACK_CHAINS: FallbackChain[] = [
  {
    capability: 'embedding',
    chain: [
      { modelId: 'nomic-embed-text:latest', conditions: { requiresLocal: true } },
      { modelId: 'text-embedding-3-small' },
      { modelId: 'voyage-2' },
    ],
    ultimateFallback: 'text-embedding-ada-002',
    onFailure: 'error',
  },
  {
    capability: 'completion',
    chain: [
      { modelId: 'llama3.2:3b', conditions: { requiresLocal: true } },
      { modelId: 'claude-3-haiku-20240307' },
      { modelId: 'gpt-4o-mini' },
    ],
    ultimateFallback: 'claude-sonnet-4-20250514',
    onFailure: 'degrade',
  },
  {
    capability: 'analysis',
    chain: [
      { modelId: 'llama3.2:3b', conditions: { requiresLocal: true } },
      { modelId: 'claude-sonnet-4-20250514' },
      { modelId: 'gpt-4o' },
    ],
    ultimateFallback: 'claude-opus-4-20250514',
    onFailure: 'error',
  },
  {
    capability: 'vision',
    chain: [
      { modelId: 'gpt-4o' },
      { modelId: 'claude-sonnet-4-20250514' },
    ],
    ultimateFallback: 'claude-opus-4-20250514',
    onFailure: 'error',
  },
];

// ═══════════════════════════════════════════════════════════════════
// CAPABILITY MAPPINGS
// ═══════════════════════════════════════════════════════════════════

/**
 * Bidirectional mapping between prompt requirements and model capabilities.
 * Used to match prompts with compatible models.
 */
export const CAPABILITY_MAPPINGS: Record<string, ModelCapability[]> = {
  // Prompt requirement → Model capabilities that satisfy it
  'vision': ['vision'],
  'multimodal': ['vision'],
  'thinking': ['thinking', 'analysis'],
  'reasoning': ['thinking', 'analysis'],
  'long-context': ['long-context'],
  'json-mode': ['json-mode', 'function-calling'],
  'structured-output': ['json-mode', 'function-calling'],
  'creative-writing': ['creative', 'completion'],
  'code-generation': ['code', 'completion'],
  'embedding-generation': ['embedding'],
  'chat': ['chat', 'completion'],
};

/**
 * Reverse mapping: capability → requirements it satisfies
 */
export const CAPABILITY_SATISFIES: Record<ModelCapability, string[]> = {
  'embedding': ['embedding-generation'],
  'completion': ['creative-writing', 'code-generation', 'chat'],
  'chat': ['chat'],
  'analysis': ['thinking', 'reasoning'],
  'creative': ['creative-writing'],
  'code': ['code-generation'],
  'vision': ['vision', 'multimodal'],
  'thinking': ['thinking', 'reasoning'],
  'function-calling': ['json-mode', 'structured-output'],
  'json-mode': ['json-mode', 'structured-output'],
  'long-context': ['long-context'],
};

// ═══════════════════════════════════════════════════════════════════
// PROMPT REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Requirements a prompt has for model selection
 */
export interface PromptRequirements {
  /** Minimum capabilities needed */
  capabilities: ModelCapability[];

  /** Minimum context window needed */
  minContextWindow?: number;

  /** Requires local model (privacy) */
  requiresLocal?: boolean;

  /** Maximum acceptable cost per 1k tokens */
  maxCostPer1k?: number;

  /** Maximum acceptable latency */
  maxLatencyMs?: number;

  /** Preferred providers (in order) */
  preferredProviders?: ModelProvider[];
}

/**
 * Result of checking model compatibility with requirements
 */
export interface CompatibilityResult {
  /** Is the model compatible? */
  compatible: boolean;

  /** Reasons for incompatibility */
  missingCapabilities: ModelCapability[];

  /** Warnings (compatible but not ideal) */
  warnings: string[];

  /** Compatibility score (0-1) */
  score: number;
}

/**
 * Model with compatibility score for ranking
 */
export interface ScoredModel {
  model: VettedModel;
  score: number;
  matchedCapabilities: ModelCapability[];
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════
// MODEL REGISTRY INTERFACE
// ═══════════════════════════════════════════════════════════════════

/**
 * Registry for managing vetted models
 *
 * All model lookups should go through this registry.
 * Never hardcode model names in application code.
 */
export interface ModelRegistry {
  // ─────────────────────────────────────────────────────────────────
  // Query Operations
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get all models with a specific capability
   */
  getForCapability(capability: ModelCapability): Promise<VettedModel[]>;

  /**
   * Get a specific model by ID
   */
  get(modelId: string): Promise<VettedModel | undefined>;

  /**
   * Resolve an alias to its canonical model ID
   */
  resolveAlias(aliasOrId: string): Promise<string>;

  /**
   * Get the default model for a capability
   */
  getDefault(capability: ModelCapability): Promise<VettedModel>;

  /**
   * Get the default model synchronously (from cache).
   * Returns undefined if not initialized or no model found.
   * Prefer async getDefault() when possible.
   */
  getDefaultSync?(capability: ModelCapability): VettedModel | undefined;

  /**
   * Get a model using fallback chain if primary unavailable
   */
  getWithFallback(capability: ModelCapability): Promise<VettedModel>;

  /**
   * Get embedding dimensions for a model (or default embedding model)
   */
  getEmbeddingDimensions(modelId?: string): Promise<number>;

  /**
   * Check if a model exists and is approved
   */
  hasModel(modelId: string): Promise<boolean>;

  /**
   * List all registered models
   */
  listModels(): Promise<string[]>;

  /**
   * List all registered models with full details
   */
  listAllModels(): Promise<VettedModel[]>;

  // ─────────────────────────────────────────────────────────────────
  // Cost Operations
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get cost for a model (with alias resolution)
   */
  getCost(modelIdOrAlias: string): Promise<{ input: number; output: number }>;

  /**
   * Get cost for a model synchronously (from cache).
   * Returns default cost if model not found or registry not initialized.
   * Prefer async getCost() when possible.
   */
  getCostSync?(modelIdOrAlias: string): { input: number; output: number };

  /**
   * Get default cost (for unknown models)
   */
  getDefaultCost(): { input: number; output: number };

  // ─────────────────────────────────────────────────────────────────
  // Capability Matching
  // ─────────────────────────────────────────────────────────────────

  /**
   * Find models that match prompt requirements, ranked by score
   */
  findModelsForRequirements(requirements: PromptRequirements): Promise<ScoredModel[]>;

  /**
   * Check if a specific model can handle requirements
   */
  canModelHandle(modelId: string, requirements: PromptRequirements): Promise<CompatibilityResult>;

  // ─────────────────────────────────────────────────────────────────
  // Registration Operations
  // ─────────────────────────────────────────────────────────────────

  /**
   * Register a new model
   */
  register(model: VettedModel): Promise<void>;

  /**
   * Update a model's vetting status
   */
  updateVettingStatus(modelId: string, status: VettingStatus): Promise<void>;

  /**
   * Update a model's performance profile
   */
  updatePerformanceProfile(modelId: string, profile: Partial<PerformanceProfile>): Promise<void>;

  // ─────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────

  /**
   * Initialize the registry (load from config/database)
   */
  initialize(): Promise<void>;

  /**
   * Refresh models from source
   */
  refresh(): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════

/**
 * Error thrown when a model is not found
 */
export class ModelNotFoundError extends Error {
  constructor(
    public readonly modelId: string,
    public readonly capability?: ModelCapability
  ) {
    super(
      capability
        ? `No model found for capability "${capability}"`
        : `Model not found: ${modelId}`
    );
    this.name = 'ModelNotFoundError';
  }
}

/**
 * Error thrown when model vetting fails
 */
export class ModelVettingError extends Error {
  constructor(
    public readonly modelId: string,
    public readonly reason: string
  ) {
    super(`Model vetting failed for ${modelId}: ${reason}`);
    this.name = 'ModelVettingError';
  }
}
