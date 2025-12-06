# Transformation Engine Design

**Date**: December 3, 2025
**Status**: Design Phase
**Priority**: MVP Launch Feature

---

## Problem Statement

LLM outputs vary significantly between models, even within the same family. A prompt that produces clean output from `llama3.2:3b` may produce verbose reasoning from `qwen3:latest`. The current regex-based `stripThinkingPreamble()` cannot handle this variety.

### Observed Failure Modes

| Model | Persona | Failure Pattern |
|-------|---------|-----------------|
| Cloudflare (llama) | Holmes | "An intriguing task, indeed. Let me dissect..." |
| Ollama (qwen3) | Ishmael | Long reasoning block about philosophical approach |
| Various | Any | "First, I need to understand what the user wants..." |

---

## Architecture: Model-Adaptive Transformation Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TRANSFORMATION PIPELINE v2                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    MODEL PROFILE REGISTRY                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │ llama3.2:3b │  │ qwen3:latest│  │ cf-llama    │  ...         │   │
│  │  │ ─────────── │  │ ─────────── │  │ ─────────── │              │   │
│  │  │ tricks: ... │  │ tricks: ... │  │ tricks: ... │              │   │
│  │  │ success: 85%│  │ success: 72%│  │ success: 78%│              │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                            │                                             │
│                            ▼                                             │
│  STAGE 1: PROMPT OPTIMIZATION (using model-specific tricks)             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Input: text + persona/style + model_profile                       │   │
│  │ Apply: Model-specific prompt formatting                           │   │
│  │ Output: Optimized prompt for this specific model                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                            │                                             │
│                            ▼                                             │
│  STAGE 2: MAIN TRANSFORMATION                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Input: Optimized prompt + text                                    │   │
│  │ Execute: LLM call with model-specific parameters                  │   │
│  │ Output: Raw transformed text (may contain thinking)               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                            │                                             │
│                            ▼                                             │
│  STAGE 3: INTELLIGENT FILTERING                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Input: Raw output + original text + model_profile                 │   │
│  │ Execute: LLM extraction call (extracts ONLY transformed content)  │   │
│  │ Output: Clean transformed text                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                            │                                             │
│                            ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    USER FEEDBACK COLLECTION                        │   │
│  │  [👍 Good] [👎 Bad]  [Optional: What went wrong?]                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                            │                                             │
│                            ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    FEEDBACK STORAGE                                │   │
│  │  transformation_id, model, persona, rating, feedback_text         │   │
│  │  → Feeds into: Daily Report + Profile Updates                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Model Profile Registry

Each model gets a profile that stores:

```typescript
interface ModelProfile {
  id: string;                    // e.g., "llama3.2:3b", "qwen3:latest"
  family: string;                // e.g., "llama", "qwen", "cloudflare"

  // Prompt formatting tricks
  tricks: {
    useSystemPrompt: boolean;    // Some models ignore system prompts
    instructionFormat: 'inline' | 'xml' | 'markdown';
    emphasisMethod: 'caps' | 'asterisks' | 'repeated';
    outputDelimiter?: string;    // e.g., "---OUTPUT---" to help extraction
    avoidPhrases?: string[];     // Phrases that trigger reasoning mode
    temperature: number;         // Optimal temperature for this model
    requiresExplicitStop?: boolean;  // Needs explicit "stop reasoning" instruction
  };

  // Known failure patterns (for filtering)
  failurePatterns: {
    thinkingPreambles: string[];   // Common thinking phrases this model uses
    reasoningMarkers: RegExp[];    // Patterns that indicate reasoning
  };

  // Statistics (updated by feedback)
  stats: {
    totalTransformations: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    lastUpdated: string;
    commonFailures: Array<{
      persona: string;
      failureRate: number;
      commonIssue: string;
    }>;
  };
}
```

### Initial Model Profiles (Seed Data)

```typescript
const MODEL_PROFILES: Record<string, ModelProfile> = {
  'llama3.2:3b': {
    id: 'llama3.2:3b',
    family: 'llama',
    tricks: {
      useSystemPrompt: true,
      instructionFormat: 'inline',
      emphasisMethod: 'caps',
      temperature: 0.7,
      requiresExplicitStop: true,
    },
    failurePatterns: {
      thinkingPreambles: ['Let me', 'I\'ll', 'First,'],
      reasoningMarkers: [/^(?:okay|alright|sure)/i],
    },
    stats: { totalTransformations: 0, successCount: 0, failureCount: 0, successRate: 0, lastUpdated: '', commonFailures: [] },
  },

  'qwen3:latest': {
    id: 'qwen3:latest',
    family: 'qwen',
    tricks: {
      useSystemPrompt: true,
      instructionFormat: 'markdown',
      emphasisMethod: 'asterisks',
      temperature: 0.6,  // Lower temp for qwen
      requiresExplicitStop: true,
      outputDelimiter: '---TRANSFORMED---',  // Help extraction
    },
    failurePatterns: {
      thinkingPreambles: ['First, I need to', 'To accomplish this', 'The user wants'],
      reasoningMarkers: [/^(?:first,? i|to accomplish|the user)/i],
    },
    stats: { totalTransformations: 0, successCount: 0, failureCount: 0, successRate: 0, lastUpdated: '', commonFailures: [] },
  },

  'cloudflare-llama': {
    id: 'cloudflare-llama',
    family: 'cloudflare',
    tricks: {
      useSystemPrompt: true,
      instructionFormat: 'inline',
      emphasisMethod: 'caps',
      temperature: 0.7,
      requiresExplicitStop: true,
    },
    failurePatterns: {
      thinkingPreambles: ['An intriguing', 'A fascinating', 'Let me dissect'],
      reasoningMarkers: [/^(?:an? )?(?:intriguing|fascinating|interesting)/i],
    },
    stats: { totalTransformations: 0, successCount: 0, failureCount: 0, successRate: 0, lastUpdated: '', commonFailures: [] },
  },
};
```

---

## Stage 3: Intelligent LLM Filter

The filter prompt must be model-aware:

```typescript
async function llmFilterOutput(
  rawOutput: string,
  originalText: string,
  modelProfile: ModelProfile
): Promise<string> {
  // Build model-specific filter prompt
  const filterPrompt = buildFilterPrompt(rawOutput, originalText, modelProfile);

  // Use a reliable model for filtering (could be different from transformation model)
  const cleanedOutput = await runFilterLLM(filterPrompt);

  return cleanedOutput;
}

function buildFilterPrompt(raw: string, original: string, profile: ModelProfile): string {
  // Add model-specific hints about what to look for
  const knownPatterns = profile.failurePatterns.thinkingPreambles.join('", "');

  return `You are a text extraction tool. Extract ONLY the transformed content.

CONTEXT: This output came from ${profile.id} (${profile.family} family).
This model commonly adds preambles like: "${knownPatterns}"

TASK: Remove ALL of the following:
- Meta-commentary ("Let me...", "I need to...", "The user wants...")
- Reasoning about the transformation approach
- Explanations of the persona/style
- Headers like "Here's the rewritten text:"

KEEP ONLY: The actual rewritten/transformed version of the original text.

Original text for reference:
---
${original}
---

LLM response to filter:
---
${raw}
---

Output ONLY the transformed content (nothing else):`;
}
```

---

## User Feedback System

### UI Component

After each transformation, show:

```
┌─────────────────────────────────────────────────┐
│ How was this transformation?                     │
│                                                  │
│  [👍 Good]    [👎 Needs Work]                   │
│                                                  │
│  [Optional: Tell us what went wrong...]         │
│  ┌─────────────────────────────────────────┐   │
│  │                                          │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  [Submit Feedback]                               │
└─────────────────────────────────────────────────┘
```

### Feedback Data Structure

```typescript
interface TransformationFeedback {
  id: string;                      // UUID
  timestamp: string;               // ISO timestamp

  // Transformation details
  transformationId: string;
  transformationType: 'persona' | 'style' | 'humanizer' | 'round-trip';
  personaOrStyle?: string;         // e.g., "holmes_analytical"

  // Model info
  modelId: string;                 // e.g., "qwen3:latest"
  provider: 'local' | 'cloudflare';

  // Content (for analysis)
  originalText: string;            // First 500 chars
  rawOutput: string;               // What LLM produced (first 1000 chars)
  filteredOutput: string;          // What user saw (first 1000 chars)

  // User feedback
  rating: 'good' | 'bad';
  feedbackText?: string;           // Optional user explanation

  // Metadata
  filteringApplied: boolean;       // Did Stage 3 filter run?
  processingTimeMs: number;
}
```

### Storage

**Local (Electron)**: SQLite table `transformation_feedback`
**Cloud**: CloudFlare D1 table OR send to analytics endpoint

```sql
CREATE TABLE transformation_feedback (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  transformation_id TEXT NOT NULL,
  transformation_type TEXT NOT NULL,
  persona_or_style TEXT,
  model_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  original_text TEXT,
  raw_output TEXT,
  filtered_output TEXT,
  rating TEXT NOT NULL,
  feedback_text TEXT,
  filtering_applied INTEGER,
  processing_time_ms INTEGER
);

CREATE INDEX idx_feedback_model ON transformation_feedback(model_id);
CREATE INDEX idx_feedback_rating ON transformation_feedback(rating);
CREATE INDEX idx_feedback_timestamp ON transformation_feedback(timestamp);
```

---

## Daily Review System

### Automated Report Generation

Run daily (or on-demand) to generate insights:

```typescript
interface DailyReport {
  date: string;
  period: { start: string; end: string };

  summary: {
    totalTransformations: number;
    successRate: number;  // % rated "good"
    mostProblematic: string;  // Model + persona with worst rate
  };

  byModel: Array<{
    modelId: string;
    totalCount: number;
    successRate: number;
    trend: 'improving' | 'declining' | 'stable';
    topIssues: string[];
  }>;

  byPersonaStyle: Array<{
    name: string;
    successRate: number;
    problematicModels: string[];
  }>;

  actionItems: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    reason: string;
  }>;
}
```

### Report Delivery

- **Email**: Daily digest to admin (dreegle@gmail.com)
- **Dashboard**: View in Studio under Admin panel
- **Alerts**: Immediate notification if success rate drops below threshold

---

## Implementation Phases

### Phase 1: Core Pipeline (MVP)
- [ ] Create `ModelProfileRegistry` with seed profiles
- [ ] Implement `llmFilterOutput()` Stage 3 filter
- [ ] Integrate into persona/style transforms
- [ ] Add basic feedback UI (thumbs up/down)

### Phase 2: Feedback Collection
- [ ] Create feedback storage (SQLite for local, D1 for cloud)
- [ ] Wire up feedback submission from UI
- [ ] Store transformation details with feedback

### Phase 3: Reporting & Iteration
- [ ] Build daily report generator
- [ ] Add admin dashboard view
- [ ] Implement profile auto-update based on feedback
- [ ] Set up email notifications

---

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `src/services/modelProfileRegistry.ts` | Model profiles and tricks |
| `src/services/transformationPipeline.ts` | 3-stage pipeline orchestrator |
| `src/services/feedbackService.ts` | Feedback collection and storage |
| `src/components/tools/FeedbackWidget.tsx` | UI for rating transformations |
| `src/services/reportService.ts` | Daily report generation |

---

## Open Questions

1. **Filter model selection**: Should Stage 3 use the same model as Stage 2, or a dedicated "filter model"?
   - Same model: Simpler, but may have same issues
   - Different model: More reliable, but adds complexity

2. **Profile updates**: How aggressive should auto-updates be?
   - Conservative: Only update after N feedbacks
   - Aggressive: Update after each feedback

3. **Failure handling**: What if Stage 3 filter also fails?
   - Fallback to regex-based stripping
   - Return raw output with warning
   - Retry with different model

---

**End of Design Document**
