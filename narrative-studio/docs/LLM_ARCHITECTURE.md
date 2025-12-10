# LLM Architecture Documentation

**Last Updated**: Dec 9, 2025
**Status**: Critical subsystem - read fully before modifying

---

## Overview

The LLM system handles all AI transformations (persona, style, humanizer, round-trip) across local (Ollama) and cloud (Cloudflare Workers AI) backends.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (narrative-studio)                   │
├─────────────────────────────────────────────────────────────────┤
│  localStorage: 'narrative-studio-provider' = 'local'|'cloudflare'│
│                           ↓                                      │
│  transformationService.ts → routes to Ollama OR API              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (npe-api worker)                      │
├─────────────────────────────────────────────────────────────────┤
│  1. llm-models.ts     → Selects model per use-case + provider    │
│  2. llm-providers/    → Creates provider instance                │
│  3. model-vetting/    → Validates model, filters output          │
│  4. *-transformation.ts → Executes transformation                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `narrative-studio/src/services/transformationService.ts` | Frontend routing (Ollama direct vs API) |
| `workers/npe-api/src/config/llm-models.ts` | Model selection per use-case |
| `workers/npe-api/src/services/llm-providers/index.ts` | Provider factory |
| `workers/npe-api/src/services/llm-providers/ollama.ts` | Ollama provider |
| `workers/npe-api/src/services/llm-providers/cloudflare.ts` | Cloudflare AI provider |
| `workers/npe-api/src/services/model-vetting/profiles.ts` | Vetted model registry |
| `workers/npe-api/src/services/model-vetting/output-filter.ts` | Output filtering |

---

## Provider Selection Flow

### 1. Frontend (transformationService.ts)

```typescript
// User preference stored in localStorage
const provider = localStorage.getItem('narrative-studio-provider'); // 'local' | 'cloudflare'

// If 'local' AND Ollama is running → call Ollama directly (port 11434)
// Otherwise → call npe-api (port 8787 local, or cloud URL)
```

### 2. Backend Model Selection (llm-models.ts)

```typescript
// Each use-case has cloud and local model assignments
const MODEL_ASSIGNMENTS = {
  persona: {
    cloud: '@cf/meta/llama-3.1-70b-instruct',
    local: 'ollama/qwen3:latest',
  },
  style: { ... },
  'round-trip': { ... },
  // etc.
};
```

### 3. Provider Factory (llm-providers/index.ts)

```typescript
// Determines provider from model ID prefix
// 'ollama/qwen3:latest' → OllamaProvider
// '@cf/meta/llama-3.1-70b-instruct' → CloudflareProvider
```

---

## Model Vetting System

**CRITICAL**: All models MUST be vetted before use. Unvetted models throw `UnvettedModelError`.

### Why Vetting Exists

Different models produce different output patterns:
- Qwen: Uses `<think>` XML tags for reasoning
- Llama: Uses conversational preambles ("Here is...", "Sure, I'll...")
- GPT-OSS: Returns structured JSON with reasoning/output blocks

Without model-specific filtering, raw LLM output leaks into user content.

### Vetting Profiles (profiles.ts)

```typescript
MODEL_VETTING_PROFILES = {
  'qwen3:latest': {
    strategy: 'xml-tags',        // Strip <think>...</think>
    patterns: { thinkingTags: ['<think>', '</think>'] },
    vetted: true,
  },
  '@cf/meta/llama-3.1-70b-instruct': {
    strategy: 'heuristic',       // Strip preambles/closings
    patterns: { preamblePhrases: ['Here is', 'Sure,'] },
    vetted: true,
  },
};
```

### Adding a New Model

1. Run test prompts against the model
2. Identify output patterns (thinking tags? preambles?)
3. Add profile to `MODEL_VETTING_PROFILES`
4. Set `vetted: true` after manual verification
5. Document in this file

---

## Output Filtering Strategies

| Strategy | Used By | What It Strips |
|----------|---------|----------------|
| `xml-tags` | Qwen, DeepSeek | `<think>`, `<reasoning>` blocks |
| `heuristic` | Llama, Mistral | "Here is...", "Let me know..." |
| `structured` | GPT-OSS | Extracts `output_text` from JSON |
| `none` | Clean models | Nothing |

---

## Common Pitfalls

### 1. Model ID Prefix Confusion
- Config uses: `ollama/qwen3:latest` (with prefix)
- Ollama API uses: `qwen3:latest` (without prefix)
- Vetting lookup normalizes the prefix automatically

### 2. Cloud vs Local Mismatch
- Ensure `llm-models.ts` has BOTH cloud and local assignments
- Test with provider switch in UI Settings

### 3. Unvetted Model Error
- Error: "Model X is not vetted"
- Solution: Add profile to `profiles.ts`, NOT bypass vetting

### 4. Reasoning Leak
- Symptom: Output contains "Let me think..." or `<think>` blocks
- Cause: Wrong strategy or missing patterns
- Solution: Update vetting profile patterns

---

## Debugging

```bash
# Test local transformation
curl -X POST http://localhost:8787/transformations/persona \
  -H "Content-Type: application/json" \
  -d '{"text": "...", "persona": "victor_obsessed"}'

# Check which model is used (look at response.model_used)
```

---

## ChromaDB Tags

Query for operational knowledge:
- `llm-architecture`
- `model-vetting`
- `transformation-pipeline`
