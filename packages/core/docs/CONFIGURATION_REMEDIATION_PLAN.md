# Configuration Remediation Plan

**Created**: 2026-01-24
**Status**: ✅ COMPLETE - All Phases Implemented
**Priority**: Critical - Blocks sustainable feature development
**Estimated Effort**: 50 hours (original 30 + council amendments 20)
**Completed**: 2026-01-24

---

## Completion Summary

| Phase | Description | Status | Files Created |
|-------|-------------|--------|---------------|
| 0 | Pre-requisites | ✅ Complete | config-validator.ts, baseline-capture.ts, rollback.ts |
| 1 | Model Registry | ✅ Complete | model-registry.ts, default-model-registry.ts, embedding-versioning.ts |
| 1.5 | Hardcoded Refs | ✅ Complete | Updated embedding-service, unified-aui-service, admin-service |
| 2 | Config Centralization | ✅ Complete | embedding-config.ts, storage-config.ts, prompt-output-schema.ts |
| 3 | Prompt Centralization | ✅ Complete | prompt-types.ts, prompt-engine.ts, prompt-registry.ts, ai-detection-config.ts |
| 4 | LLM Control Panel | ✅ Complete | llm-control-panel.ts, benchmark-suite.ts, ab-testing.ts |
| 5 | Rho Integration | ✅ Complete | task-embedding-service.ts |

**Total Files Created**: 18 files, ~5,500+ lines

---

## Problem Statement

The Platinum branch has accumulated configuration debt that violates core principles:
1. **70+ hardcoded literals** that should be configuration-managed
2. **20+ inline LLM prompts** bypassing ConfigManager
3. **Model vetting architecture exists but is never enforced**
4. **No centralized LLM control panel** for model testing/vetting

This debt compounds with each feature, making the system increasingly brittle.

---

## Council Review Summary

| Agent | Verdict | Key Amendment |
|-------|---------|---------------|
| Builder | Conditional Approval | Template engine for conditionals; 7 more prompts |
| Curator | Conditional Rejection → Approved | Embedding version management critical |
| Model Master | Conditional Approval | VettedModel interface expansion; fallback chains |
| Math Agent | Conditional Approval | Temporal decay; adaptive thresholds |
| Reviewer | Conditional Approval | Benchmark expansion; regression safeguards |

---

## Guiding Principles

1. **Every literal is a configuration candidate** - Numbers, strings, URLs, model names
2. **Every prompt is versionable** - Admin-editable, A/B testable, model-specific variants
3. **Every model selection goes through vetting** - No direct instantiation
4. **Every LLM call declares its requirements** - Capability tags, context needs
5. **Every embedding tracks its model** - No cross-model comparisons (COUNCIL ADDITION)
6. **Every threshold is adaptive** - Learns from historical success (COUNCIL ADDITION)

---

## Phase 0: Pre-Requisites (COUNCIL ADDITION)

**Goal**: Establish baselines and safeguards before migration.

### 0.1 Config Validation Layer

**File**: `packages/core/src/config/config-validator.ts` (NEW)

```typescript
export interface ConfigValidator {
  // Validate numeric thresholds are in acceptable ranges
  validateThreshold(key: string, value: number, min: number, max: number): void;

  // Validate prompts have required placeholders
  validatePrompt(id: string, template: string, requiredVars: string[]): void;

  // Validate model exists in registry
  validateModelReference(modelId: string): Promise<void>;

  // Run all validations on startup
  validateAll(): Promise<ValidationReport>;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
```

### 0.2 Baseline Metrics Capture

Before any migration, capture current quality metrics:

```typescript
interface BaselineCapture {
  // Reviewer scores on 50+ historical chapters
  humanizationScores: number[];
  avgHumanizationScore: number;

  // Builder output quality
  avgPurityScore: number;
  avgEntropyScore: number;

  // Search quality
  searchPrecisionAt10: number;

  capturedAt: Date;
  commitHash: string;
}
```

### 0.3 Regression Thresholds

```typescript
export const REGRESSION_THRESHOLDS = {
  // Maximum acceptable score drops
  maxHumanizationDrop: 0.03,      // 3%
  maxPurityDrop: 0.05,            // 5%
  maxSearchPrecisionDrop: 0.02,   // 2%

  // Monitoring windows
  monitoringWindowHours: 24,

  // Rollback triggers
  rollbackOnConsecutiveFailures: 3,
};
```

### 0.4 Rollback Procedure

```typescript
interface RollbackProcedure {
  // Snapshot current config before changes
  snapshotConfig(): Promise<ConfigSnapshot>;

  // Restore from snapshot
  restoreConfig(snapshot: ConfigSnapshot): Promise<void>;

  // Automatic rollback on threshold breach
  enableAutoRollback(thresholds: RegressionThresholds): void;
}
```

---

## Phase 1: Model Registry & Vetting Enforcement

**Goal**: No hardcoded model names anywhere in the codebase.

### 1.1 Create ModelRegistry Interface (AMENDED)

**File**: `packages/core/src/models/model-registry.ts` (NEW)

```typescript
export interface VettedModel {
  id: string;                    // e.g., 'nomic-embed-text:latest'
  provider: string;              // e.g., 'ollama', 'openai', 'anthropic'
  capabilities: string[];        // e.g., ['embedding', 'text']
  dimensions?: number;           // For embedding models
  contextWindow?: number;        // For completion models
  costPer1kTokens: { input: number; output: number };
  vettingStatus: VettingStatus;
  performanceProfile: PerformanceProfile;

  // COUNCIL ADDITIONS (Model Master):
  maxBatchSize?: number;         // For batch operations (embedding-service uses 10)
  tokenLimit?: number;           // Input token limit (distinct from contextWindow)
  warmupRequired?: boolean;      // Ollama cold-start latency consideration
  providerEndpoint?: string;     // Provider-specific endpoint override
  aliases?: string[];            // e.g., ['claude-sonnet'] → 'claude-sonnet-4-...'
  supportsStreaming?: boolean;   // For completion models

  configOverrides?: Record<string, unknown>;
}

// COUNCIL ADDITION: Expanded vetting status
export type VettingStatus =
  | 'pending'      // Registered but not yet tested
  | 'testing'      // Currently being benchmarked
  | 'approved'     // Passed benchmarks, production-ready
  | 'deprecated'   // Scheduled for removal
  | 'failed'       // Did not pass benchmarks
  | 'suspended';   // Temporarily disabled (API issues, etc.)

export interface PerformanceProfile {
  avgLatencyMs: number;
  qualityScore: number;        // 0-1 from benchmarks
  lastVetted: Date;
  // COUNCIL ADDITION:
  approvedCapabilities?: string[];  // May be approved for some, not all
  benchmarkResults?: BenchmarkResult[];
}

export interface ModelRegistry {
  // Query by capability
  getForCapability(capability: string): Promise<VettedModel[]>;

  // Get specific model
  get(modelId: string): Promise<VettedModel | undefined>;

  // COUNCIL ADDITION: Resolve aliases
  resolveAlias(aliasOrId: string): Promise<string>;

  // Get default for capability
  getDefault(capability: string): Promise<VettedModel>;

  // COUNCIL ADDITION: Get with fallback chain
  getWithFallback(capability: string): Promise<VettedModel>;

  // Get embedding dimensions (calculated from model)
  getEmbeddingDimensions(modelId?: string): Promise<number>;

  // Register new model (for vetting pipeline)
  register(model: VettedModel): Promise<void>;

  // Update vetting status
  updateVettingStatus(modelId: string, status: VettingStatus): Promise<void>;

  // COUNCIL ADDITION: Cost lookup with alias resolution
  getCost(modelIdOrAlias: string): Promise<{ input: number; output: number }>;
  getDefaultCost(): { input: number; output: number };

  // COUNCIL ADDITION: Capability matching for prompts
  findModelsForRequirements(requirements: PromptRequirements): Promise<ScoredModel[]>;
  canModelHandle(modelId: string, requirements: PromptRequirements): Promise<CompatibilityResult>;
}
```

### 1.2 Define Fallback Chains (COUNCIL ADDITION)

```typescript
export interface FallbackChain {
  capability: string;
  chain: Array<{
    modelId: string;
    conditions?: {
      maxLatencyMs?: number;
      maxCostPer1k?: number;
      requiresLocal?: boolean;
    };
  }>;
  ultimateFallback: string;  // If all else fails
  onFailure: 'error' | 'degrade' | 'queue';
}

// Default fallback chains
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
      { modelId: 'claude-haiku' },
      { modelId: 'gpt-4o-mini' },
    ],
    ultimateFallback: 'claude-sonnet',
    onFailure: 'degrade',
  },
];
```

### 1.3 Capability Vocabulary Mapping (COUNCIL ADDITION)

```typescript
// Bridge between prompt requirements and model capabilities
export const CAPABILITY_MAPPINGS: Record<string, string[]> = {
  // Prompt requirement → Model capabilities that satisfy it
  'vision': ['vision', 'multimodal'],
  'thinking': ['reasoning', 'analysis', 'thinking'],
  'long-context': ['long-context', '128k-context', '200k-context'],
  'json-mode': ['json-mode', 'structured-output', 'function-calling'],

  // Model capability → Compatible prompt requirements
  'analysis': ['thinking', 'analysis'],
  'creative': ['creative', 'writing'],
  'embedding': ['embedding'],
  'detection': ['detection', 'classification'],
};
```

### 1.4 Create Default Registry Implementation

**File**: `packages/core/src/models/default-model-registry.ts` (NEW)

```typescript
import { getConfigManager } from '../config/index.js';

const DEFAULT_MODELS: VettedModel[] = [
  {
    id: 'nomic-embed-text:latest',
    provider: 'ollama',
    capabilities: ['embedding'],
    dimensions: 768,
    maxBatchSize: 10,
    tokenLimit: 2048,
    warmupRequired: true,
    costPer1kTokens: { input: 0, output: 0 },
    vettingStatus: 'approved',
    performanceProfile: {
      avgLatencyMs: 50,
      qualityScore: 0.85,
      lastVetted: new Date('2026-01-01'),
      approvedCapabilities: ['embedding'],
    },
  },
  {
    id: 'llama3.2:3b',
    provider: 'ollama',
    capabilities: ['completion', 'analysis', 'creative'],
    contextWindow: 8192,
    warmupRequired: true,
    supportsStreaming: true,
    costPer1kTokens: { input: 0, output: 0 },
    vettingStatus: 'approved',
    performanceProfile: {
      avgLatencyMs: 200,
      qualityScore: 0.75,
      lastVetted: new Date('2026-01-01'),
    },
  },
  // ... other models
];

export class DefaultModelRegistry implements ModelRegistry {
  private models: Map<string, VettedModel> = new Map();
  private aliases: Map<string, string> = new Map();
  private fallbackChains: Map<string, FallbackChain> = new Map();
  private config = getConfigManager();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    const configModels = await this.config.get<VettedModel[]>('models', 'registry');
    const models = configModels ?? DEFAULT_MODELS;
    for (const model of models) {
      this.models.set(model.id, model);
      // Register aliases
      if (model.aliases) {
        for (const alias of model.aliases) {
          this.aliases.set(alias, model.id);
        }
      }
    }

    // Load fallback chains
    for (const chain of DEFAULT_FALLBACK_CHAINS) {
      this.fallbackChains.set(chain.capability, chain);
    }
  }

  async resolveAlias(aliasOrId: string): Promise<string> {
    return this.aliases.get(aliasOrId) ?? aliasOrId;
  }

  async getWithFallback(capability: string): Promise<VettedModel> {
    const chain = this.fallbackChains.get(capability);
    if (!chain) {
      return this.getDefault(capability);
    }

    for (const option of chain.chain) {
      const model = this.models.get(option.modelId);
      if (model && model.vettingStatus === 'approved') {
        // Check conditions
        if (option.conditions?.requiresLocal && model.provider !== 'ollama') {
          continue;
        }
        return model;
      }
    }

    // Use ultimate fallback
    const fallback = this.models.get(chain.ultimateFallback);
    if (!fallback) {
      throw new Error(`No available model for capability: ${capability}`);
    }
    return fallback;
  }

  async getEmbeddingDimensions(modelId?: string): Promise<number> {
    const id = modelId ?? await this.config.get('models', 'defaultEmbedding') ?? 'nomic-embed-text:latest';
    const resolved = await this.resolveAlias(id);
    const model = this.models.get(resolved);
    if (!model?.dimensions) {
      throw new Error(`Model ${id} has no dimensions defined`);
    }
    return model.dimensions;
  }

  // ... other methods
}

// Singleton
let _registry: ModelRegistry | null = null;
export function getModelRegistry(): ModelRegistry {
  if (!_registry) {
    _registry = new DefaultModelRegistry();
  }
  return _registry;
}
```

### 1.5 Update All Hardcoded Model References

| File | Line | Current | Replacement |
|------|------|---------|-------------|
| `embedding-service.ts` | 44 | `'nomic-embed-text:latest'` | `registry.getDefault('embedding').id` |
| `embedding-service.ts` | 45 | `'llama3.2:3b'` | `registry.getDefault('completion').id` |
| `embedding-service.ts` | 405 | `return 768` | `registry.getEmbeddingDimensions()` |
| `ollama-adapter.ts` | 27 | `'llama3.2:3b'` | `registry.getDefault('completion').id` |
| `ollama-adapter.ts` | 28 | `'nomic-embed-text:latest'` | `registry.getDefault('embedding').id` |
| `unified-aui-service.ts` | 1881 | `'nomic-embed-text'` | `this.embeddingModel.id` |
| `unified-aui-service.ts` | 1911 | `'nomic-embed-text'` | `this.embeddingModel.id` |
| `constants.ts` | 283-302 | `MODEL_COST_RATES` object | `registry.getCost(id)` |

### 1.6 Embedding Version Management (COUNCIL ADDITION - CRITICAL)

**File**: `packages/core/src/models/embedding-versioning.ts` (NEW)

```typescript
/**
 * CRITICAL: Prevents data corruption when switching embedding models.
 *
 * Problem: 768-dim and 1536-dim vectors cannot be compared.
 * Solution: Track model ID with each embedding, prevent cross-model operations.
 */

export interface EmbeddingVersionConfig {
  // Store model ID with each embedding
  trackModelWithEmbedding: boolean;

  // Fail operations that mix embeddings from different models
  preventCrossModelComparison: boolean;

  // Trigger re-embedding job when model changes
  reembedOnModelChange: boolean;

  // During transition, support dual storage
  dualStorageEnabled: boolean;
  transitionPeriodDays: number;
}

export const DEFAULT_EMBEDDING_VERSION_CONFIG: EmbeddingVersionConfig = {
  trackModelWithEmbedding: true,
  preventCrossModelComparison: true,
  reembedOnModelChange: false,  // Manual trigger preferred
  dualStorageEnabled: false,
  transitionPeriodDays: 14,
};

export interface StoredEmbedding {
  vector: number[];
  modelId: string;
  dimensions: number;
  createdAt: Date;
  version: number;
}

export class EmbeddingVersionManager {
  async validateCompatibility(
    embedding1: StoredEmbedding,
    embedding2: StoredEmbedding
  ): void {
    if (embedding1.modelId !== embedding2.modelId) {
      throw new EmbeddingIncompatibilityError(
        `Cannot compare embeddings from different models: ` +
        `${embedding1.modelId} (${embedding1.dimensions}d) vs ` +
        `${embedding2.modelId} (${embedding2.dimensions}d)`
      );
    }
    if (embedding1.dimensions !== embedding2.dimensions) {
      throw new EmbeddingIncompatibilityError(
        `Dimension mismatch: ${embedding1.dimensions} vs ${embedding2.dimensions}`
      );
    }
  }

  async markStaleEmbeddings(oldModelId: string): Promise<number> {
    // Mark all embeddings from old model as needing re-embedding
  }

  async getReembeddingProgress(): Promise<{
    total: number;
    completed: number;
    remaining: number;
  }> {
    // Track re-embedding job progress
  }
}
```

**Schema Migration** (add to schema-postgres.ts):

```sql
-- Track embedding model with each vector
ALTER TABLE content_nodes ADD COLUMN IF NOT EXISTS embedding_model_id TEXT;
ALTER TABLE content_nodes ADD COLUMN IF NOT EXISTS embedding_version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_embedding_version ON content_nodes(embedding_version);
CREATE INDEX IF NOT EXISTS idx_embedding_model ON content_nodes(embedding_model_id);

-- Clusters also need model tracking
ALTER TABLE aui_clusters ADD COLUMN IF NOT EXISTS centroid_model_id TEXT;
```

---

## Phase 2: Configuration Centralization

**Goal**: All magic numbers and strings in config, not code.

### 2.1 Create Configuration Modules

**File**: `packages/core/src/config/embedding-config.ts` (NEW)

```typescript
export const EMBEDDING_CONFIG_KEYS = {
  // Model selection
  DEFAULT_MODEL: 'embedding.defaultModel',
  FALLBACK_MODEL: 'embedding.fallbackModel',

  // Dimensions (derived from model, but overridable)
  DIMENSIONS: 'embedding.dimensions',

  // Service configuration
  OLLAMA_URL: 'embedding.ollamaUrl',
  TIMEOUT_MS: 'embedding.timeoutMs',
  BATCH_SIZE: 'embedding.batchSize',
  MAX_RETRIES: 'embedding.maxRetries',

  // Quality thresholds
  MIN_SIMILARITY: 'embedding.minSimilarity',
  CACHE_TTL_MS: 'embedding.cacheTtlMs',
} as const;

export const EMBEDDING_DEFAULTS: Record<string, unknown> = {
  [EMBEDDING_CONFIG_KEYS.TIMEOUT_MS]: 60000,
  [EMBEDDING_CONFIG_KEYS.BATCH_SIZE]: 10,
  [EMBEDDING_CONFIG_KEYS.MAX_RETRIES]: 3,
  [EMBEDDING_CONFIG_KEYS.MIN_SIMILARITY]: 0.5,
  [EMBEDDING_CONFIG_KEYS.CACHE_TTL_MS]: 3600000,
};
```

**File**: `packages/core/src/config/storage-config.ts` (NEW)

```typescript
export const STORAGE_CONFIG_KEYS = {
  // Database connection
  DB_HOST: 'storage.dbHost',
  DB_PORT: 'storage.dbPort',
  DB_NAME: 'storage.dbName',
  DB_USER: 'storage.dbUser',
  DB_PASSWORD: 'storage.dbPassword',

  // Connection pool
  MAX_CONNECTIONS: 'storage.maxConnections',
  IDLE_TIMEOUT_MS: 'storage.idleTimeoutMs',
  CONNECTION_TIMEOUT_MS: 'storage.connectionTimeoutMs',

  // Vector search
  VECTOR_INDEX_TYPE: 'storage.vectorIndexType',
} as const;

// Defaults read from environment with fallbacks
export function getStorageDefaults(): Record<string, unknown> {
  return {
    [STORAGE_CONFIG_KEYS.DB_HOST]: process.env.DB_HOST ?? 'localhost',
    [STORAGE_CONFIG_KEYS.DB_PORT]: parseInt(process.env.DB_PORT ?? '5432'),
    [STORAGE_CONFIG_KEYS.DB_NAME]: process.env.DB_NAME ?? 'humanizer_archive',
    [STORAGE_CONFIG_KEYS.MAX_CONNECTIONS]: 20,
    [STORAGE_CONFIG_KEYS.IDLE_TIMEOUT_MS]: 30000,
    [STORAGE_CONFIG_KEYS.CONNECTION_TIMEOUT_MS]: 5000,
  };
}
```

### 2.2 Update Schema Files

(Same as original)

### 2.3 Fix Hardcoded Error Messages

(Same as original)

### 2.4 Threshold-Prompt Coupling (COUNCIL ADDITION)

```typescript
/**
 * Link threshold config keys to prompt output interpretations.
 * Ensures threshold changes remain valid when prompts change.
 */
export interface PromptOutputSchema {
  type: 'json';
  schema: Record<string, unknown>;

  // Map output fields to threshold config keys
  thresholdMappings?: Record<string, string>;

  // Expected output ranges
  outputRanges?: Record<string, { min: number; max: number }>;
}

// Example: Curator assessment prompt
const CURATOR_ASSESSMENT_SCHEMA: PromptOutputSchema = {
  type: 'json',
  schema: {
    clarity: 'number',      // 0-1
    depth: 'number',        // 0-1
    originality: 'number',  // 0-1
    relevance: 'number',    // 0-1
    overallQuality: 'number',
    isGem: 'boolean',
  },
  thresholdMappings: {
    'overallQuality': 'curator.qualityThreshold',
    'isGem': 'curator.gemThreshold',
  },
  outputRanges: {
    'clarity': { min: 0, max: 1 },
    'depth': { min: 0, max: 1 },
    'originality': { min: 0, max: 1 },
    'relevance': { min: 0, max: 1 },
    'overallQuality': { min: 0, max: 1 },
  },
};
```

---

## Phase 3: LLM Prompt Centralization

**Goal**: All prompts in ConfigManager, tagged with requirements.

### 3.1 Define Prompt Schema (AMENDED)

**File**: `packages/core/src/config/prompt-types.ts` (NEW)

```typescript
export interface PromptDefinition {
  id: string;
  name: string;
  description: string;
  template: string;

  // LLM requirements
  requirements: {
    capabilities: PromptCapability[];
    minContextWindow?: number;
    preferredModels?: string[];
    temperature?: number;
    maxTokens?: number;
  };

  // COUNCIL ADDITION: Output schema for validation
  outputSchema?: PromptOutputSchema;

  // Versioning
  version: number;
  deprecated?: boolean;
  replacedBy?: string;

  // Testing
  testCases?: PromptTestCase[];

  // COUNCIL ADDITION: Which agents use this prompt
  usedBy?: string[];
}

export type PromptCapability =
  | 'vision'
  | 'thinking'
  | 'long-context'
  | 'json-mode'
  | 'streaming'
  | 'function-calling';
```

### 3.2 Template Engine Enhancement (COUNCIL ADDITION - BUILDER)

The current `compilePrompt()` only supports `{{variable}}` replacement.
Builder requires conditional blocks for dynamic prompt assembly.

**Option A: Add Handlebars Dependency**
```bash
npm install handlebars  # ~28KB minified
```

**Option B: Minimal Conditional Engine**
```typescript
// Support {{#if var}}...{{else}}...{{/if}} and {{variable}}
export function compilePromptWithConditionals(
  template: string,
  variables: Record<string, unknown>
): string {
  // Handle conditionals first
  let result = template.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_, varName, ifBlock, elseBlock = '') => {
      return variables[varName] ? ifBlock : elseBlock;
    }
  );

  // Then handle simple variables
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
      String(value ?? '')
    );
  }

  return result;
}
```

**Recommendation**: Option B (minimal engine) for now, migrate to Handlebars if complexity grows.

### 3.3 Complete Prompt Inventory (COUNCIL ADDITION)

**AGENTIC LOOP PROMPTS** (2):
```typescript
{ id: 'AGENT_LOOP_SYSTEM', ... },
{ id: 'AGENT_LOOP_REASONING', ... },
```

**BUILDER PROMPTS** (9 total - 7 were missing):
```typescript
// Already in plan:
{ id: 'BUILDER_OUTLINE_CREATION', ... },
{ id: 'BUILDER_SECTION_COMPOSITION', ... },

// COUNCIL ADDITION - Missing prompts:
{
  id: 'BUILDER_TRANSITION_GENERATION',
  name: 'Builder Transition Writing',
  description: 'Generate transitions between sections',
  template: `Write a brief transition (1-2 sentences) that bridges from one section to the next in a chapter about "{{theme}}".
The transition should feel natural and maintain flow.

Transitioning to: "{{nextSectionPreview}}"

Output only the transition text.`,
  requirements: { capabilities: [], temperature: 0.7 },
  version: 1,
  usedBy: ['builder'],
},

{
  id: 'BUILDER_STRUCTURE_ANALYSIS',
  name: 'Builder Structure Analysis',
  description: 'Analyze chapter narrative structure',
  template: `Analyze this chapter's structure:
1. Identify the narrative arc (building/peak/resolution/flat)
2. Evaluate pacing (0-1 scale)
3. Find structural issues (weak transitions, abrupt shifts, imbalanced sections)
4. Suggest improvements

Chapter:
{{content}}

Respond with JSON: { narrativeArc, pacingScore, issues: [], suggestions: [] }`,
  requirements: { capabilities: ['json-mode'], temperature: 0.3 },
  version: 1,
  usedBy: ['builder'],
},

{
  id: 'BUILDER_DRAFT_REVISION',
  name: 'Builder Draft Revision',
  description: 'Revise chapter with specific focus areas',
  template: `Revise this chapter draft. Focus on: {{focusAreas}}

Draft:
{{content}}

Apply targeted improvements while preserving voice and meaning.`,
  requirements: { capabilities: [], temperature: 0.6 },
  version: 1,
  usedBy: ['builder'],
},

{
  id: 'BUILDER_IMPROVEMENT_SUGGESTIONS',
  name: 'Builder Improvement Suggestions',
  description: 'Suggest specific chapter improvements',
  template: `Analyze this chapter and suggest specific improvements.
Focus on actionable changes, not general advice.

Chapter:
{{content}}

Respond with JSON: { suggestions: [{ location, issue, suggestedFix }] }`,
  requirements: { capabilities: ['json-mode'], temperature: 0.4 },
  version: 1,
  usedBy: ['builder'],
},

{
  id: 'BUILDER_STYLE_ANALYSIS',
  name: 'Builder Style Analysis',
  description: 'Analyze text style against persona',
  template: `Analyze this text's style compared to the persona "{{personaName}}".

Persona traits: {{voiceTraits}}
Persona tone: {{toneMarkers}}

Text:
{{content}}

Evaluate: voice consistency, formality match, pattern usage.
Respond with JSON: { voiceMatch: 0-1, issues: [], suggestions: [] }`,
  requirements: { capabilities: ['json-mode'], temperature: 0.3 },
  version: 1,
  usedBy: ['builder'],
},

{
  id: 'BUILDER_ISSUE_FIX',
  name: 'Builder Issue Fix Application',
  description: 'Fix specific issue in text',
  template: `You need to fix an issue in this text.

Issue: {{issueDescription}}
Location: {{location}}
Suggested fix: {{suggestedFix}}

Text:
{{content}}

Apply the fix naturally. Output only the corrected text.`,
  requirements: { capabilities: [], temperature: 0.5 },
  version: 1,
  usedBy: ['builder'],
},

{
  id: 'BUILDER_FOCUSED_REVISION',
  name: 'Builder Focused Revision',
  description: 'Revision based on Reviewer feedback',
  template: `Revise this chapter text. Focus specifically on:
{{#each focusAreas}}
- {{this}}
{{/each}}

Issues to address:
{{#each issues}}
- {{this.type}}: {{this.description}} at {{this.location}}
{{/each}}

Text:
{{content}}`,
  requirements: { capabilities: [], temperature: 0.6 },
  version: 1,
  usedBy: ['builder'],
},
```

**CURATOR PROMPTS** (4 - all missing from original plan):
```typescript
{
  id: 'CURATOR_PASSAGE_ASSESSMENT',
  name: 'Curator Passage Quality Assessment',
  description: 'Evaluate passage on clarity, depth, originality, relevance',
  template: `You are a literary curator assessing passage quality.

Evaluate this passage on four dimensions (0-1 each):
- Clarity: How clear and understandable?
- Depth: How insightful or profound?
- Originality: How unique or fresh?
- Relevance: How relevant to theme "{{theme}}"?

Passage:
{{passage}}

Respond with JSON: { clarity, depth, originality, relevance, overallQuality, isGem: boolean, reasoning }`,
  requirements: { capabilities: ['json-mode'], temperature: 0.3 },
  outputSchema: CURATOR_ASSESSMENT_SCHEMA,
  version: 1,
  usedBy: ['curator'],
},

{
  id: 'CURATOR_THREAD_COHERENCE',
  name: 'Curator Thread Coherence Analysis',
  description: 'Assess passage flow, gaps, redundancy, ordering',
  template: `You are analyzing thread coherence for a book chapter.

Evaluate these passages for:
- Flow: Do they connect logically?
- Gaps: Are there missing links?
- Redundancy: Is content repeated?
- Ordering: Is the sequence optimal?

Passages:
{{passages}}

Respond with JSON: { flowScore: 0-1, gaps: [], redundancies: [], suggestedOrder: [] }`,
  requirements: { capabilities: ['json-mode'], temperature: 0.3 },
  version: 1,
  usedBy: ['curator'],
},

{
  id: 'CURATOR_CLUSTER_SUGGESTION',
  name: 'Curator Cluster Identification',
  description: 'Identify thematic clusters in passages',
  template: `Identify {{numClusters}} thematic clusters in these passages.

For each cluster:
- Name: Brief descriptive label
- Theme: Core concept
- Passages: Which passage IDs belong

Passages:
{{passages}}

Respond with JSON: { clusters: [{ name, theme, passageIds }] }`,
  requirements: { capabilities: ['json-mode'], minContextWindow: 8192 },
  version: 1,
  usedBy: ['curator'],
},

{
  id: 'CURATOR_CARD_ASSIGNMENT',
  name: 'Curator Card-to-Chapter Assignment',
  description: 'Match content cards to chapter sections',
  template: `You are a literary curator helping organize content into chapters.

Match each card to the most appropriate chapter section.

Cards:
{{cards}}

Chapter structure:
{{chapterStructure}}

Respond with JSON: { assignments: [{ cardId, sectionId, confidence }] }`,
  requirements: { capabilities: ['json-mode'], temperature: 0.3 },
  version: 1,
  usedBy: ['curator'],
},
```

**REVIEWER PROMPTS** (3 - all missing from original plan):
```typescript
{
  id: 'REVIEWER_STYLE_CHECK',
  name: 'Reviewer Style Consistency Check',
  description: 'Evaluate text style against persona',
  template: `Analyze this text's style{{#if persona}} compared to the persona "{{persona}}"{{/if}}.

Evaluate:
- Voice consistency with persona traits
- Formality level appropriateness
- Pattern usage (contractions, rhetorical questions)
- AI tell presence

Text:
{{content}}

Respond with JSON: { styleScore: 0-1, voiceMatch: 0-1, formalityMatch: 0-1, aiTellsDetected: [], issues: [] }`,
  requirements: { capabilities: ['json-mode'], temperature: 0.3 },
  version: 1,
  usedBy: ['reviewer'],
},

{
  id: 'REVIEWER_STRUCTURE_CHECK',
  name: 'Reviewer Structure Analysis',
  description: 'Analyze chapter structural quality',
  template: `Analyze this chapter's structure:
- Opening: Does it hook the reader?
- Body: Is it well-organized with clear sections?
- Transitions: Are section bridges smooth?
- Conclusion: Does it provide satisfying closure?

Chapter:
{{content}}

Respond with JSON: { structureScore: 0-1, openingQuality: 0-1, transitionQuality: 0-1, conclusionQuality: 0-1, issues: [] }`,
  requirements: { capabilities: ['json-mode'], temperature: 0.3 },
  version: 1,
  usedBy: ['reviewer'],
},

{
  id: 'REVIEWER_FACT_EXTRACTION',
  name: 'Reviewer Fact Claim Extraction',
  description: 'Extract verifiable factual claims',
  template: `Extract verifiable factual claims from this text.

For each claim:
- claim: The factual statement
- location: Where in text
- verifiable: Can it be fact-checked?

Text:
{{content}}

Respond with JSON: { claims: [{ claim, location, verifiable }] }`,
  requirements: { capabilities: ['json-mode'], temperature: 0 },
  version: 1,
  usedBy: ['reviewer'],
},
```

### 3.4 AI Detection Patterns Config (COUNCIL ADDITION - REVIEWER)

Move `DEFAULT_AI_TELLS` from hardcoded array to config:

**File**: `packages/core/src/config/ai-detection-config.ts` (NEW)

```typescript
export const AI_DETECTION_CONFIG_KEYS = {
  TELLS_PATTERNS: 'aiDetection.patterns',
  DETECTION_THRESHOLD: 'aiDetection.threshold',
  SEVERITY_WEIGHTS: 'aiDetection.severityWeights',
} as const;

export interface AITellPattern {
  regex: string;
  name: string;
  severity: 'low' | 'medium' | 'high';
  category: 'vocabulary' | 'phrasing' | 'structure';
}

export const DEFAULT_AI_TELLS: AITellPattern[] = [
  { regex: '\\bdelve\\b', name: 'Overused "delve"', severity: 'high', category: 'vocabulary' },
  { regex: '\\bdelve into\\b', name: 'Overused "delve into"', severity: 'high', category: 'vocabulary' },
  { regex: '\\btapestry\\b', name: 'Cliché "tapestry"', severity: 'medium', category: 'vocabulary' },
  { regex: '\\brich tapestry\\b', name: 'Cliché "rich tapestry"', severity: 'high', category: 'phrasing' },
  { regex: '\\bleverage\\b', name: 'Corporate "leverage"', severity: 'medium', category: 'vocabulary' },
  { regex: '\\butilize\\b', name: 'Pretentious "utilize"', severity: 'low', category: 'vocabulary' },
  { regex: 'it is (important|worth) (to )?not', name: 'Hedging phrase', severity: 'medium', category: 'phrasing' },
  { regex: '\\bin conclusion\\b', name: 'Formulaic "in conclusion"', severity: 'low', category: 'structure' },
  { regex: '\\bmoreover,', name: 'Academic "moreover"', severity: 'low', category: 'vocabulary' },
];
```

### 3.5 Update Agents to Use ConfigManager

(Same as original, but now includes all agents)

---

## Phase 4: LLM Control Panel

**Goal**: Single interface for model testing, vetting, and configuration.

### 4.1 Create Control Panel Service

(Same as original)

### 4.2 Create MCP Handlers for Control Panel

(Same as original, plus A/B testing handlers)

### 4.3 Expanded Benchmark Suite (COUNCIL ADDITION)

**Minimum 10 passages covering all quality dimensions:**

```typescript
export const DEFAULT_BENCHMARK_SUITE: BenchmarkSuite = {
  id: 'humanizer-core-v1',
  name: 'Humanizer Core Benchmarks',
  passages: [
    // Philosophical (2)
    {
      id: 'philosophical-1',
      text: `The nature of consciousness remains one of philosophy's most profound mysteries.
When we delve into the subjective experience of awareness, we find ourselves confronting
questions that have puzzled thinkers for millennia.`,
      category: 'philosophical',
      expectedTraits: ['removes-delve', 'maintains-depth', 'natural-flow'],
    },
    {
      id: 'philosophical-2',
      text: `It is important to note that phenomenological inquiry reveals a rich tapestry
of lived experience. The essence of being cannot be reduced to mere objective description.`,
      category: 'philosophical',
      expectedTraits: ['removes-it-is-important', 'removes-tapestry', 'preserves-phenomenology'],
    },

    // Technical (2)
    {
      id: 'technical-1',
      text: `The implementation leverages a novel approach to vector embeddings,
utilizing transformer architectures to capture semantic relationships.
It is important to note that this methodology represents a significant advancement.`,
      category: 'technical',
      expectedTraits: ['removes-leverage', 'removes-it-is-important', 'preserves-meaning'],
    },
    {
      id: 'technical-2',
      text: `Moreover, the system utilizes advanced algorithms to delve into the data,
uncovering patterns that were previously hidden from view.`,
      category: 'technical',
      expectedTraits: ['removes-moreover', 'removes-utilize', 'removes-delve', 'maintains-technical-accuracy'],
    },

    // Creative/Narrative (2)
    {
      id: 'creative-1',
      text: `The morning light filtered through the curtains, casting long shadows
across the room. She had always loved this time of day, when the world
seemed to hold its breath before the rush began.`,
      category: 'creative',
      expectedTraits: ['maintains-voice', 'preserves-imagery', 'natural-flow'],
    },
    {
      id: 'creative-2',
      text: `His journey was, in essence, a tapestry woven from countless moments of
doubt and discovery. Moreover, each step forward revealed new horizons.`,
      category: 'creative',
      expectedTraits: ['removes-tapestry', 'removes-moreover', 'removes-in-essence', 'maintains-narrative'],
    },

    // Conversational (2)
    {
      id: 'conversational-1',
      text: `So basically, what I'm trying to say is that we need to leverage
our existing resources more effectively. It's like, you know, we've got
all these tools but we're not utilizing them properly.`,
      category: 'conversational',
      expectedTraits: ['removes-leverage', 'removes-utilize', 'maintains-casual-tone'],
    },
    {
      id: 'conversational-2',
      text: `That's a really good point! I think we should delve into that more.
It's important to note that this approach has worked before.`,
      category: 'conversational',
      expectedTraits: ['removes-delve', 'removes-it-is-important', 'preserves-enthusiasm'],
    },

    // Citation-heavy (2)
    {
      id: 'citation-1',
      text: `As Smith (2024) argues, the fundamental nature of consciousness
cannot be adequately captured by reductionist frameworks. This aligns
with Johnson's earlier work on phenomenal experience (Johnson, 2019).`,
      category: 'academic',
      expectedTraits: ['preserves-citations', 'maintains-attribution', 'natural-flow'],
    },
    {
      id: 'citation-2',
      text: `The research demonstrates (Williams et al., 2023) that leveraging
neural networks can delve into complex pattern recognition. Moreover,
it is worth noting that these findings replicate earlier studies.`,
      category: 'academic',
      expectedTraits: ['preserves-citations', 'removes-leverage', 'removes-delve', 'removes-moreover'],
    },
  ],

  // Pattern-based expected behaviors
  expectedBehaviors: [
    { pattern: /\bdelve\b/i, shouldMatch: false, description: 'No "delve"' },
    { pattern: /\bleverage\b/i, shouldMatch: false, description: 'No "leverage"' },
    { pattern: /it is (important|worth) (to )?not/i, shouldMatch: false, description: 'No hedging phrases' },
    { pattern: /\btapestry\b/i, shouldMatch: false, description: 'No "tapestry"' },
    { pattern: /\butilize\b/i, shouldMatch: false, description: 'No "utilize"' },
    { pattern: /\bmoreover,/i, shouldMatch: false, description: 'No "moreover"' },
    { pattern: /in essence/i, shouldMatch: false, description: 'No "in essence"' },
    { pattern: /\(\w+,?\s*\d{4}\)/g, shouldMatch: true, description: 'Preserves citations' },
  ],

  // COUNCIL ADDITION: Quantitative metrics
  metrics: {
    semanticDriftThreshold: 0.15,  // Max cosine distance input→output
    maxPerplexity: 50.0,           // Fluency gate
    minDiversity: 0.3,             // Self-BLEU floor
    styleFeatures: ['sentence_length', 'vocabulary_complexity', 'formality'],
    aiDetectorThreshold: 0.3,      // Max AI probability
  },

  weights: {
    patternCompliance: 0.3,
    semanticPreservation: 0.4,
    fluency: 0.2,
    style: 0.1,
  },
};
```

### 4.4 A/B Testing Implementation (COUNCIL ADDITION)

```typescript
export interface ABTestConfig {
  testId: string;
  name: string;
  promptId: string;
  variants: {
    control: string;    // Current prompt template
    treatment: string;  // New prompt template
  };
  trafficSplit: number;  // 0-1, portion getting treatment
  metrics: string[];     // e.g., ['humanizationScore', 'styleScore']
  minSampleSize: number; // Per variant before declaring winner
  startDate: Date;
  endDate?: Date;
  status: 'draft' | 'running' | 'paused' | 'completed';
}

export interface ABTestResult {
  testId: string;
  controlSamples: number;
  treatmentSamples: number;
  controlMetrics: Record<string, number>;
  treatmentMetrics: Record<string, number>;
  winner: 'control' | 'treatment' | 'inconclusive';
  confidence: number;  // Statistical confidence
  recommendation: string;
}

export async function handleStartABTest(args: {
  promptId: string;
  treatmentTemplate: string;
  trafficSplit?: number;
  minSampleSize?: number;
}): Promise<MCPResult> {
  // Create and start A/B test
}

export async function handleGetABTestResults(args: {
  testId: string;
}): Promise<MCPResult> {
  // Return current results with statistical analysis
}
```

---

## Phase 5: Rho Integration (Future)

**Goal**: Latent space calculations inform agent decisions.

### 5.1 Extend Agent Message Types

(Same as original)

### 5.2 Create Task Embedding Service (AMENDED)

**File**: `packages/core/src/aui/task-embedding-service.ts` (NEW)

```typescript
export class TaskEmbeddingService {
  private history: Map<string, TaskEmbeddingRecord[]> = new Map();

  async embedTask(request: string): Promise<number[]> {
    const embedder = await getEmbedder();
    return embedder.embed(request);
  }

  async findSimilarTasks(
    embedding: number[],
    agentId?: string,
    limit = 5
  ): Promise<Array<{ taskId: string; similarity: number; agentUsed: string; age: number }>> {
    // Query historical task embeddings
    // Return top matches with rho scores
  }

  // COUNCIL ADDITION: Adaptive threshold
  async suggestAgentByRho(
    taskEmbedding: number[],
    options?: {
      baseThreshold?: number;
      adaptFromHistory?: boolean;
    }
  ): Promise<{ agentId: string; confidence: number } | null> {
    const threshold = await this.getAdaptiveThreshold(options);
    const similar = await this.findSimilarTasks(taskEmbedding);

    if (similar.length === 0) return null;

    // COUNCIL ADDITION: Apply temporal decay
    const decayedSimilarity = this.applyTemporalDecay(
      similar[0].similarity,
      similar[0].age
    );

    if (decayedSimilarity < threshold) {
      return null;
    }

    return {
      agentId: similar[0].agentUsed,
      confidence: decayedSimilarity,
    };
  }

  // COUNCIL ADDITION: Temporal decay
  private applyTemporalDecay(similarity: number, ageMs: number): number {
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const halfLifeDays = 30;  // Configurable
    const minimumWeight = 0.1;

    const lambda = Math.LN2 / halfLifeDays;
    const decay = Math.max(minimumWeight, Math.exp(-lambda * ageDays));

    return similarity * decay;
  }

  // COUNCIL ADDITION: Adaptive threshold
  private async getAdaptiveThreshold(options?: {
    baseThreshold?: number;
    adaptFromHistory?: boolean;
  }): Promise<number> {
    const base = options?.baseThreshold ?? 0.7;

    if (!options?.adaptFromHistory) {
      return base;
    }

    // Adjust based on recent success rate
    const recentTasks = await this.getRecentTaskOutcomes(100);
    const successRate = recentTasks.filter(t => t.success).length / recentTasks.length;

    // If success rate is high, we can be more permissive
    // If low, be more conservative
    const adjustment = (successRate - 0.85) * 0.1;  // ±0.1 adjustment

    return Math.max(0.5, Math.min(0.9, base + adjustment));
  }

  async recordTaskCompletion(
    taskId: string,
    embedding: number[],
    agentUsed: string,
    success: boolean
  ): Promise<void> {
    // Store for future routing decisions
  }
}
```

### 5.3 Quantitative Benchmark Metrics (COUNCIL ADDITION)

```typescript
export interface QuantitativeBenchmarkMetrics {
  // Semantic drift: cosine distance between input and output embeddings
  semanticDrift: {
    threshold: number;  // e.g., 0.15
    compute: (inputEmbed: number[], outputEmbed: number[]) => number;
  };

  // Perplexity: language model fluency score
  perplexity: {
    maxAcceptable: number;  // e.g., 50.0
    compute: (text: string, model: string) => Promise<number>;
  };

  // Self-BLEU: diversity across multiple outputs
  selfBleu: {
    minDiversity: number;  // e.g., 0.3
    sampleSize: number;
  };

  // Style consistency: variance in style features
  styleConsistency: {
    features: string[];
    maxVariance: number;
  };

  // AI detector score
  aiDetectorScore: {
    maxAiProbability: number;  // e.g., 0.3
  };
}
```

---

## Implementation Order (AMENDED)

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|--------------|
| **0.1-0.4 Pre-requisites** | CRITICAL | 4 hrs | None |
| 1.1-1.3 Model Registry + Fallbacks | CRITICAL | 5 hrs | None |
| **1.6 Embedding Versioning** | CRITICAL | 4 hrs | 1.1-1.3 |
| 1.4-1.5 Update consumers | CRITICAL | 3 hrs | 1.1-1.3, 1.6 |
| 2.1-2.3 Config modules | HIGH | 3 hrs | None |
| **2.4 Threshold-Prompt Coupling** | HIGH | 2 hrs | 2.1-2.3 |
| **3.2 Template Engine** | HIGH | 2 hrs | None |
| 3.1, 3.3-3.5 Prompt migration | MEDIUM | 6 hrs | 3.2 |
| 4.1-4.2 Control panel | MEDIUM | 4 hrs | 1.*, 3.* |
| **4.3-4.4 Benchmarks + A/B** | MEDIUM | 4 hrs | 4.1-4.2 |
| 5.1-5.3 Rho integration | LOW | 8 hrs | 1.*, 4.* |

**Total Estimated Effort**: 50 hours across 6 phases

---

## Verification Criteria (AMENDED)

### Phase 0 Complete When:
- [ ] ConfigValidator passes on startup
- [ ] Baseline metrics captured for 50+ chapters
- [ ] Regression thresholds documented and enforced
- [ ] Rollback procedure tested

### Phase 1 Complete When:
- [ ] `grep -r "nomic-embed-text" src/` returns 0 results outside registry
- [ ] `grep -r "'768'" src/` returns 0 results outside registry
- [ ] `grep -r "llama3.2" src/` returns 0 results outside registry
- [ ] All tests pass with different embedding model configured
- [ ] **Embedding versioning schema migration applied**
- [ ] **Cross-model comparison throws error**

### Phase 2 Complete When:
- [ ] `grep -r "localhost:11434" src/` only in env var fallbacks
- [ ] `grep -r "humanizer_archive" src/` only in env var fallbacks
- [ ] Database can be configured via environment variables
- [ ] **Threshold-prompt coupling validated**

### Phase 3 Complete When:
- [ ] `grep -r "You are" src/houses/` returns 0 (all in config)
- [ ] `grep -r "systemPrompt:" src/aui/` returns only config lookups
- [ ] All prompts have `requirements` defined
- [ ] **Template engine supports {{#if}} conditionals**
- [ ] **All 18 prompts migrated (2 loop + 9 builder + 4 curator + 3 reviewer)**
- [ ] **DEFAULT_AI_TELLS in config**

### Phase 4 Complete When:
- [ ] `llm_list_models` MCP tool works
- [ ] `llm_test_model` runs benchmark suite
- [ ] Benchmark results stored and comparable
- [ ] **10+ benchmark passages covering all dimensions**
- [ ] **A/B testing framework operational**
- [ ] **Quantitative metrics (semantic drift, perplexity) computed**

### Phase 5 Complete When:
- [ ] Agent messages include task embeddings
- [ ] Router considers rho in decisions
- [ ] Historical task embeddings persisted
- [ ] **Temporal decay applied to historical embeddings**
- [ ] **Adaptive thresholds converge within 50 tasks**
- [ ] **Threshold produces >= 85% routing accuracy**

---

## Risk Mitigation (AMENDED)

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Phase 0 baseline + rollback procedure |
| Performance regression | Expanded benchmark suite (10+ passages) |
| Configuration complexity | Sensible defaults; only override when needed |
| Migration disruption | Feature flags for gradual rollout |
| **Embedding model change corrupts data** | **Phase 1.6 versioning prevents cross-model ops** |
| **Prompt changes degrade quality** | **A/B testing + regression thresholds** |
| **Threshold tuning too conservative/permissive** | **Adaptive thresholds from historical success** |

---

## Success Metrics (AMENDED)

1. **Configuration Coverage**: 100% of literals in config
2. **Prompt Centralization**: 100% of prompts (18 total) in ConfigManager
3. **Model Vetting**: 0 unvetted model instantiations
4. **Test Coverage**: Benchmark suite covers all 5 quality dimensions
5. **Developer Experience**: New models addable without code changes
6. **Embedding Safety**: 0 cross-model comparison errors in production
7. **Quality Stability**: Humanization score within 3% of baseline
8. **Routing Accuracy**: >= 85% success rate for rho-based agent selection

---

## Appendix: Council Review References

Full council review stored in ChromaDB with tags:
- `codeguard-review,2026-01-24,executive-summary`
- `codeguard-review,builder-agent,plan-review`
- `codeguard-review,curator-agent,plan-review`
- `codeguard-review,model-master,plan-review`
- `codeguard-review,math-agent,plan-review`
- `codeguard-review,reviewer-agent,plan-review`

Retrieve with:
```
mcp__chromadb-memory__search_by_tag(["codeguard-review", "2026-01-24"])
```
