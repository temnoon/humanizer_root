# Agent Runtime & Model-Master Development Handoff

**Date:** January 25, 2026
**Status:** Integration Complete - Ready for Testing
**Priority:** High - Blocks persona transformations and LLM-powered features

---

## Update: Integration Complete

As of January 25, 2026, Model-Master has been wired to the existing infrastructure:

1. **Created LLM Provider Layer** (`src/llm-providers/`)
   - `types.ts` - Provider interfaces and types
   - `provider-manager.ts` - Singleton manager with auto-initialization
   - `ollama-provider.ts` - Local Ollama provider
   - `openai-provider.ts` - OpenAI API provider
   - `anthropic-provider.ts` - Anthropic API provider

2. **Updated Model-Master** (`src/houses/model-master.ts`)
   - Deleted `getDefaultModelClasses()` - No more hardcoded model lists
   - Uses `getModelRegistry()` for model selection
   - Uses `getProviderManager()` for actual LLM calls
   - Cost tracking uses registry costs, not hardcoded values
   - Fallback chains work via `registry.getWithFallback()`

3. **Updated CLI** (`src/cli/humanizer-cli.ts`)
   - Calls `initializeProviders()` on startup
   - Calls `initializeAllHouseAgents()` on startup

**Next Steps for Testing:**
```bash
# Start Ollama
ollama serve

# Run CLI
cd packages/core
npx tsx src/cli/humanizer-cli.ts

# Test persona rewriting (should now work end-to-end)
humanizer> persona <persona-id>
```

---

## Executive Summary

The humanizer project has a **comprehensive model vetting system** already designed:
- **ModelRegistry** - Central authority for approved models, fallback chains, capability matching
- **LLMControlPanel** - Benchmarking, vetting status updates, A/B testing
- **PromptRegistry** - Capability requirements that models must match
- **ConfigManager** - Centralized thresholds and preferences

**Model-Master is NOT an independent mechanism.** It is the **enforcement layer** that:
1. Queries ModelRegistry for approved models
2. Enforces budget limits from ConfigManager
3. Routes requests through fallback chains
4. Tracks spending per user
5. Calls the actual LLM providers

The problem: **Model-Master is not yet wired to any of this.** It has hardcoded model classes and returns stub responses.

---

## The Existing Architecture (Already Built)

### ModelRegistry (`src/models/`)

| File | Purpose | Lines |
|------|---------|-------|
| `model-registry.ts` | Type definitions, interfaces | 527 |
| `default-model-registry.ts` | In-memory registry with 11 pre-approved models | 677 |
| `model-id.ts` | Branded type preventing hardcoded strings | - |

**Key Registry Methods:**
```typescript
// Query Operations
getForCapability(capability): Promise<VettedModel[]>  // Only 'approved' models
getDefault(capability): Promise<VettedModel>          // Highest-quality approved
getWithFallback(capability): Promise<VettedModel>     // Uses fallback chains

// Capability Matching
findModelsForRequirements(requirements): Promise<ScoredModel[]>
canModelHandle(modelId, requirements): Promise<CompatibilityResult>

// Cost
getCost(modelId): Promise<{ input: number; output: number }>
```

### Fallback Chains (Already Defined)

```
CAPABILITY → PRIMARY → FALLBACK → ULTIMATE → ON_FAILURE

'embedding'  → nomic (local) → text-embedding-3-small → ada-002 → error
'completion' → llama3.2:3b (local) → haiku → gpt-4o-mini → sonnet-4 → degrade
'analysis'   → llama3.2:3b (local) → sonnet-4 → gpt-4o → opus-4 → error
```

### Vetting Status Lifecycle

```
pending → testing → approved (production use allowed)
                  ↘ failed (cannot be used)
                  ↘ suspended (API issues)
                  ↘ deprecated (scheduled removal)
```

**Only `approved` models are returned by `getForCapability()`.**

### LLMControlPanel (`src/aui/llm-control-panel.ts`)

- `llm_test_model()` - Runs benchmarks against 10 passages
- `llm_update_vetting_status()` - Changes model status
- `llm_benchmark_passages` - Test cases per category
- Scoring: Pass if overall ≥ 0.7 AND 80% passages pass

### PromptRegistry (`src/config/prompt-registry.ts`)

Prompts specify requirements, not models:
```typescript
requirements: {
  capabilities: ['json-mode', 'thinking'],
  minContextWindow: 16000,
  maxCostPer1k: 0.01,
  temperature: 0.3,
}
```

ModelRegistry matches prompts to compatible models.

---

## What Model-Master Should Do

Model-Master is the **single gate** for all AI calls. It must:

### 1. Query ModelRegistry (Not Hardcoded Classes)

```typescript
// ❌ CURRENT (broken - independent hardcoded list)
const modelClasses = this.getDefaultModelClasses();
const routing = modelClasses[capability];

// ✅ CORRECT (use registry)
const registry = getModelRegistry();
const models = await registry.getForCapability(capability);
const model = models[0]; // Already sorted by quality score
```

### 2. Respect Fallback Chains

```typescript
// ❌ CURRENT (no fallback)
const model = modelClasses[capability].models[0];

// ✅ CORRECT (graceful degradation)
const model = await registry.getWithFallback(capability);
// Tries: primary → fallback chain → ultimate fallback
```

### 3. Enforce Budget from ConfigManager

```typescript
// Load thresholds from config
const warningThreshold = await this.config.getOrDefault(
  'thresholds',
  MODEL_MASTER_CONFIG.BUDGET_WARNING_THRESHOLD,
  0.8
);

// Check before calling
if (userSpend / userLimit > warningThreshold) {
  this.emitWarning('budget-warning', { userId, percentUsed });
}
if (userSpend >= userLimit) {
  throw new Error('Budget exceeded');
}
```

### 4. Match Prompt Requirements

```typescript
// When a prompt has specific requirements
const prompt = getPrompt('PERSONA_REWRITE');
const compatibleModels = await registry.findModelsForRequirements(prompt.requirements);
// Returns models ranked by compatibility score
```

### 5. Track Spending with Actual Costs

```typescript
// Get real costs from registry
const costs = await registry.getCost(model.id);
const totalCost = (inputTokens * costs.input + outputTokens * costs.output) / 1000;

// Persist to database (not in-memory)
await this.store.trackUserSpend(userId, totalCost);
```

---

## Current Model-Master Problems

**File:** `src/houses/model-master.ts`

### Problem 1: Hardcoded Model Classes (Lines 436-491)

```typescript
private getDefaultModelClasses(): Record<string, ModelClass> {
  return {
    'analysis': {
      models: [
        { modelId: 'claude-3-sonnet', provider: 'anthropic', priority: 1 },
        // ... hardcoded list
      ]
    }
  };
}
```

**Should be:** Query from ModelRegistry

### Problem 2: Stub Response (Lines ~180)

```typescript
const response: AIResponse = {
  output: `[Simulated response for capability: ${capability}]`,  // FAKE
  cost: 0.001,  // HARDCODED
};
```

**Should be:** Call actual LLM provider

### Problem 3: In-Memory Budget (Line 146)

```typescript
private userSpending: Map<string, number> = new Map();
```

**Should be:** Persist to database via AuiPostgresStore

### Problem 4: No Provider Integration

Model-Master has no way to actually call Ollama/OpenAI/Anthropic. It needs a provider layer.

---

## Development Tasks

### Task 1: Wire Model-Master to ModelRegistry

Update `handleCallCapability()`:

```typescript
private async handleCallCapability(message: AgentMessage): Promise<AgentMessage> {
  const { capability, input, params } = message.payload;
  const registry = getModelRegistry();

  // Use registry, not hardcoded classes
  const model = await registry.getWithFallback(capability as ModelCapability);

  if (!model) {
    throw new Error(`No approved model for capability: ${capability}`);
  }

  // Check vetting status (defensive - getWithFallback already filters)
  if (model.vettingStatus !== 'approved') {
    throw new Error(`Model ${model.id} not approved for production use`);
  }

  // Get cost from registry
  const costs = await registry.getCost(model.id);

  // ... call provider and track spending
}
```

### Task 2: Create LLM Provider Layer

**Location:** `src/llm-providers/`

```
src/llm-providers/
├── index.ts                 # Re-exports
├── types.ts                 # LlmProvider interface
├── provider-manager.ts      # Singleton, availability checking
├── ollama-provider.ts       # Local Ollama
├── openai-provider.ts       # OpenAI API
└── anthropic-provider.ts    # Anthropic API
```

**Provider Interface:**
```typescript
export interface LlmProvider {
  readonly name: string;

  isAvailable(): Promise<boolean>;

  chat(request: ChatRequest): Promise<ChatResponse>;
  embed(text: string): Promise<number[]>;
}
```

**Key:** Providers just execute. Model-Master decides WHICH model via registry.

### Task 3: Persist Budget to Database

Add to AuiPostgresStore:

```typescript
// Schema addition
CREATE TABLE user_spending (
  user_id TEXT PRIMARY KEY,
  total_spend NUMERIC NOT NULL DEFAULT 0,
  monthly_spend NUMERIC NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);

// Methods
async trackUserSpend(userId: string, amount: number): Promise<void>;
async getUserSpend(userId: string): Promise<UserSpend>;
async resetMonthlySpend(): Promise<void>;  // Cron job
```

### Task 4: CLI Runtime Initialization

Update CLI to initialize agent runtime:

```typescript
// In main()
import { initializeProviders } from '../llm-providers/index.js';
import { initializeAllHouseAgents } from '../houses/index.js';

// Initialize providers (reads from env)
await initializeProviders({
  ollamaUrl: process.env.OLLAMA_URL,
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize agents (model-master, builder, etc.)
await initializeAllHouseAgents();
```

### Task 5: Remove Hardcoded Model Classes

Delete `getDefaultModelClasses()` from model-master.ts. All model selection should go through ModelRegistry.

---

## Control Flow After Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│  Builder Agent                                                       │
│  bus.request('model-master', { capability: 'humanizer', input })    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Model-Master (Enforcement Layer)                                    │
│                                                                      │
│  1. registry.getWithFallback('humanizer')  ← Query ModelRegistry    │
│  2. Check vettingStatus === 'approved'      ← Already enforced      │
│  3. Check user budget (from DB)             ← Enforce limits        │
│  4. providerManager.get(model.provider)     ← Get provider          │
│  5. provider.chat(request)                  ← Execute call          │
│  6. store.trackUserSpend(cost)              ← Persist spending      │
│  7. Return response                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                      ┌─────────────┴─────────────┐
                      ▼                           ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│  ModelRegistry               │   │  ProviderManager            │
│  - Approved models only      │   │  - OllamaProvider           │
│  - Fallback chains           │   │  - OpenAIProvider           │
│  - Capability matching       │   │  - AnthropicProvider        │
│  - Cost data                 │   │                             │
└─────────────────────────────┘   └─────────────────────────────┘
```

---

## Agents That Depend on Model-Master

All house agents call model-master. Once fixed, they all work:

| Agent | Capabilities Used | Feature Enabled |
|-------|-------------------|-----------------|
| Builder | humanizer, creative | Persona transformation |
| Curator | embedding, analysis | Content quality scoring |
| Harvester | analysis | Passage discovery |
| Reviewer | detection | AI detection |

---

## Testing After Integration

```typescript
describe('Model-Master Integration', () => {
  beforeAll(async () => {
    await initializeProviders({ ollamaUrl: 'http://localhost:11434' });
    await initializeAllHouseAgents();
  });

  it('uses registry for model selection', async () => {
    const bus = getMessageBus();
    const response = await bus.request('model-master', {
      type: 'call-capability',
      payload: { capability: 'creative', input: 'Hello' },
    });

    expect(response.success).toBe(true);
    expect(response.data.output).not.toContain('[Simulated');
    expect(response.data.modelUsed).toBeDefined();
  });

  it('respects fallback chains', async () => {
    // Test with Ollama unavailable
    // Should fall back to cloud provider
  });

  it('enforces budget limits', async () => {
    // Test rejection when over budget
  });
});
```

---

## Success Criteria

1. **No stub responses** - All `[Simulated response...]` eliminated
2. **Registry-driven selection** - `getDefaultModelClasses()` deleted
3. **Fallback chains work** - If Ollama down, falls back to cloud
4. **Budget persisted** - Spending survives restart
5. **CLI works end-to-end**:
   ```
   humanizer> persona 9497f2d0-6d9a-4488-82c8-c0665574aae7
   Rewriting with persona...
   Persona rewriting complete
   ```

---

## Key Principle

**Model-Master is NOT a parallel system.** It is the enforcement layer for the existing model vetting architecture:

- ModelRegistry = **Source of truth** for approved models
- LLMControlPanel = **Vetting workflow** for approving models
- PromptRegistry = **Capability requirements** for prompts
- ConfigManager = **Thresholds and preferences**
- Model-Master = **Enforcement gate** that ties it all together

---

## ChromaDB Tags

```
tags: "handoff,2026-01-25,agent-runtime,model-master,model-registry,integration,v2"
type: "development-handoff"
```

**SUPERSEDES:** Any agent-runtime or model-master memories before this date, including v1 of this handoff.
