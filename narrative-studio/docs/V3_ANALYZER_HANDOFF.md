# V3 AI Analyzer - Development Handoff

**Date**: December 19, 2025
**Status**: Prototype Complete, Calibration Needed
**Location**: `src/services/detection/v3/`

---

## What Was Built

### Core Components

```
src/services/detection/v3/
├── types.ts      # Type definitions, config
├── chekhov.ts    # Entity tracking & fulfillment (NOVEL FEATURE)
├── perplexity.ts # Sentence-level perplexity & burstiness
├── analyzer.ts   # Main orchestrator
└── index.ts      # Exports

scripts/
├── test-v3-analyzer.ts    # Test against AI samples
└── test-v3-gutenberg.ts   # Test against human samples
```

### The Chekhov Ratio (Novel Detection Signal)

**Core Insight**: When humans write, specific details (names, places, times) are introduced with *purpose* - they pay off later. AI introduces specifics for *decoration* - they're abandoned.

```
Chekhov Ratio = Fulfilled Specifics / Total Specifics

Human writing (full works): 0.6-0.8
AI writing (800-word complete): ~0.47
Human excerpts: ~0.34 (PROBLEM - see below)
```

---

## Critical Calibration Issue: Excerpt vs Complete Work

### The Problem

Our 800-word AI samples are **complete works** - the prompt asks for a complete story/essay.
Our Gutenberg samples are **excerpts** - fragments from longer works.

**Result**: Human excerpts score LOWER on Chekhov (34%) than AI complete works (47%) because:
- An entity introduced in chapter 3 may be fulfilled in chapter 7
- We only see chapter 3 → entity appears "orphaned"
- AI's 800-word stories introduce AND resolve entities in same text

### The Solution (Not Yet Implemented)

**Completeness Assessment** - Before applying Chekhov weighting, detect:

1. **Structural completeness markers**:
   - Has beginning/middle/end arc?
   - Resolution/conclusion present?
   - Word count vs typical form (800 words = complete essay, 800 words of novel = excerpt)

2. **Excerpt indicators**:
   - Starts mid-scene (no establishment)
   - Ends without resolution
   - References to unseen events ("as mentioned earlier")
   - Character introduced without backstory (assumes prior knowledge)

3. **Dynamic Chekhov weighting**:
   ```
   if (isCompleteWork) {
     chekhovWeight = 0.40  // Full weight - entity fulfillment matters
   } else if (isLikelyExcerpt) {
     chekhovWeight = 0.15  // Reduced weight - can't judge fulfillment
   } else {
     chekhovWeight = 0.25  // Uncertain - moderate weight
   }
   ```

---

## Test Results Summary

### AI Models (Complete 800-word samples)

| Model | Chekhov | Composite | Notes |
|-------|---------|-----------|-------|
| Qwen QWQ 32B | 30% | 45% | Also has CoT leak |
| Gemini 3 | 33% | 46% | Decorative specificity |
| Opus 4.5 | 40% | 50% | Many orphaned locations |
| GPT-5.2 | 53% | 54% | Better fulfillment |
| Llama 3.3 70B | 66% | 60% | Simpler = fewer promises |

**Pattern**: Frontier models (Opus, Gemini) have LOWER Chekhov because they add more decorative specificity that doesn't pay off.

### Human Samples (Gutenberg Excerpts)

| Genre | Chekhov | Composite | Issue |
|-------|---------|-----------|-------|
| short_story | 25% | 53% | Some complete, some excerpts |
| narrative | 51% | 64% | Mix of complete/excerpt |
| gothic | 75% | 73% | Mostly complete short works |

**Average Human Chekhov: 34%** (misleading due to excerpt problem)

---

## Entity Extraction Refinements Made

1. **Footnote filtering**: Skip `[Footnote`, `[1]`, roman numerals
2. **Markdown cleanup**: Remove headers, normalize whitespace
3. **Stricter person detection**: Dialogue attribution, possessives, subject+verb
4. **NON_NAME_WORDS filter**: 150+ words that shouldn't be names
5. **Geographic feature validation**: Require proper noun before "Glacier", "Mountain" etc.
6. **0-entity handling**: Default to 0.5 (neutral) not 1.0 (perfect)

---

## Files Created/Modified

### New Files
- `src/services/detection/v3/types.ts` (~200 lines)
- `src/services/detection/v3/chekhov.ts` (~550 lines)
- `src/services/detection/v3/perplexity.ts` (~350 lines)
- `src/services/detection/v3/analyzer.ts` (~250 lines)
- `src/services/detection/v3/index.ts` (~50 lines)
- `scripts/test-v3-analyzer.ts` (~200 lines)
- `scripts/test-v3-gutenberg.ts` (~250 lines)

### Modified Files
- `scripts/collect-contemporary-samples.sh` - Added Grok option, fixed pbpaste

---

## ✅ Completeness Classifier (IMPLEMENTED - Dec 19)

### New File: `src/services/detection/v3/completeness.ts`

**Purpose**: Detect whether sample is a COMPLETE work or EXCERPT, then dynamically weight Chekhov ratio.

### Detection Signals

| Signal | Complete Work | Excerpt |
|--------|---------------|---------|
| Markdown title | `# The Title` | Rare in excerpts |
| Opening | Temporal/scene establishment | Mid-scene start |
| Closing | Dialogue, reflection, resolution | Abrupt/unresolved |
| Arc markers | Conflict + climax + transitions | Partial arc |
| Word count | 600-1200 (typical prompt) | Any length |

### Dynamic Weighting

| Classification | Chekhov Weight | Rationale |
|----------------|----------------|-----------|
| COMPLETE | 40% (full) | Entities should be fulfilled in sample |
| UNCERTAIN | 25% | Moderate - can't be sure |
| EXCERPT | 15% | Entities may be fulfilled outside sample |

### Test Results

```
Gutenberg (expect EXCERPT): 6/6 correct (100%)
AI Opus 4.5 (expect COMPLETE): 6/6 correct (100%)
```

### Full V3 Results With Completeness

| Category | Composite | Chekhov Weight | Classification |
|----------|-----------|----------------|----------------|
| Human (Gutenberg) | **64%** | 15-25% | Mostly LIKELY_HUMAN |
| AI (Multi-model) | **46-60%** | 40% | More LIKELY_AI |

---

## Next Steps (Priority Order)

### 1. Better Entity Extraction (MEDIUM)
- Coreference resolution ("she" → "Elena")
- Quoted speech handling
- Multi-paragraph entity tracking

### 4. LLM-Based Perplexity (MEDIUM)
Replace heuristic perplexity with actual token probabilities from Ollama/CF Workers.

### 5. UI Integration (LOW)
Add V3 analysis pane to narrative-studio.

---

## Key Insight to Preserve

> "Human specificity is purposeful - it creates reader expectation that will be fulfilled. AI specificity is decorative - it creates expectation that is abandoned. This broken promise is the 'slop' sensation."

> "The 800-word complete work is ATYPICAL. Most content humans submit will be excerpts. Chekhov ratio must be weighted by completeness assessment."

---

## Testing Commands

```bash
# Test against AI samples
npx tsx scripts/test-v3-analyzer.ts

# Test specific model
npx tsx scripts/test-v3-analyzer.ts opus45 CA1

# Test against human baselines
npx tsx scripts/test-v3-gutenberg.ts
```

---

## Cost Consideration

V3 is designed to reduce GPTZero dependency:
- Current: $67/month (over 300K word budget)
- With V3 local + 10% GPTZero validation: ~$7/month
- Goal: Use V3 for bulk analysis, GPTZero for edge cases only
