# SIC Multi-Model Comparison Test Protocol

**Version:** 1.0
**Date:** December 17, 2025
**Purpose:** Generate controlled samples across multiple LLMs to test the objectivity-achievement hypothesis

---

## 1. Test Matrix

### 1.1 Generation Sources

| ID | Model | Provider | Size | Notes |
|----|-------|----------|------|-------|
| `opus` | Claude Opus 4.5 | Anthropic | ~400B | Frontier, generated via Claude Code |
| `gpt4o` | GPT-4o | OpenAI | Unknown | Frontier, generated via ChatGPT |
| `gemini` | Gemini Pro | Google | Unknown | Frontier, generated via Gemini |
| `llama70` | Llama 3.1 70B | Meta/CF | 70B | Open source, same as SIC judge |
| `llama8` | Llama 3.1 8B | Meta/CF | 8B | Open source, small |
| `mistral` | Mistral 7B | Mistral | 7B | Open source, different architecture |
| `human` | Human authors | Various | N/A | Control samples from volunteer writers |

### 1.2 Genres (5 genres × 3 samples each = 15 samples per model)

| Genre | Gutenberg Baseline | Key Features Expected |
|-------|-------------------|----------------------|
| Narrative | 0.631 AI prob | High commitment, low situatedness |
| Gothic | 0.641 AI prob | High epistemic_risk, atmospheric |
| Adventure | 0.631 AI prob | High situatedness, time_pressure |
| Argument | 0.628 AI prob | Highest anti_smoothing, commitment |
| Memoir | 0.542 AI prob | Highest situatedness, bounded_viewpoint |

### 1.3 Total Samples

- 7 sources × 5 genres × 3 samples = **105 samples**
- Plus 41 Gutenberg samples = **146 total for analysis**

---

## 2. Generation Prompts

**CRITICAL:** Use these prompts EXACTLY as written. Do not add system prompts, personas, or instructions about style. We want to measure each model's default behavior.

### 2.1 Narrative Fiction

**Prompt N1:**
```
Write the opening scene of a novel. A woman in her thirties arrives at her childhood home after many years away. The house has been sold and she has one day to collect what remains of her family's belongings. Begin as she approaches the house. Approximately 800 words.
```

**Prompt N2:**
```
Write a scene from a novel. Two old friends meet by chance at a train station. One is departing, the other arriving. They have not spoken in years due to a falling out over a business venture. Write their conversation and its aftermath. Approximately 800 words.
```

**Prompt N3:**
```
Write a scene from a novel. A middle-aged man sits in a hospital waiting room while his father undergoes surgery. He reflects on their relationship while observing other families around him. Approximately 800 words.
```

### 2.2 Gothic/Horror

**Prompt G1:**
```
Write a passage in the Gothic tradition. A scholar discovers a hidden chamber in an old library that contains manuscripts no one has read in centuries. As they begin to read, they realize the texts describe events that have not yet occurred. Approximately 800 words.
```

**Prompt G2:**
```
Write a passage in the Gothic tradition. A woman inherits a house in a coastal village. The locals refuse to speak of its history. On her first night, she hears sounds from a room that, according to the floor plans, should not exist. Approximately 800 words.
```

**Prompt G3:**
```
Write a passage in the Gothic tradition. A portrait painter is commissioned to create a likeness of an elderly aristocrat. During their sessions, the subject tells stories that seem impossible—events from centuries past, described as firsthand experience. Approximately 800 words.
```

### 2.3 Adventure

**Prompt A1:**
```
Write an adventure narrative. A ship captain navigates through a dangerous strait during a storm. The crew must make split-second decisions as cargo shifts and rigging fails. Describe the physical struggle against the elements. Approximately 800 words.
```

**Prompt A2:**
```
Write an adventure narrative. An expedition into unmapped jungle discovers ruins of a civilization unknown to history. As they explore deeper, they realize they are not alone. Write their first encounter with the ruins' guardians. Approximately 800 words.
```

**Prompt A3:**
```
Write an adventure narrative. A pilot crash-lands in mountainous terrain. With limited supplies and an injured passenger, they must find a path to safety before winter storms arrive. Describe the first day's journey. Approximately 800 words.
```

### 2.4 Argument/Essay

**Prompt E1:**
```
Write a philosophical essay arguing a position on this question: Is certainty a virtue or a liability in intellectual life? Take a clear stance and defend it with examples and reasoning. Approximately 800 words.
```

**Prompt E2:**
```
Write a philosophical essay arguing a position on this question: Do we have stronger obligations to those near to us than to strangers? Take a clear stance and defend it with examples and reasoning. Approximately 800 words.
```

**Prompt E3:**
```
Write a philosophical essay arguing a position on this question: Is the examined life worth living if the examination reveals truths we cannot change? Take a clear stance and defend it with examples and reasoning. Approximately 800 words.
```

### 2.5 Memoir/Personal Essay

**Prompt M1:**
```
Write a personal essay about a moment when you realized a long-held belief was wrong. Describe the context, the realization, and its aftermath. Use specific sensory details and emotional honesty. Approximately 800 words.
```

**Prompt M2:**
```
Write a personal essay about a place that shaped who you are. It might be a childhood home, a city you lived in, or somewhere you visited briefly but never forgot. Ground abstract reflections in concrete details. Approximately 800 words.
```

**Prompt M3:**
```
Write a personal essay about a skill or practice you learned later in life than most. What was difficult about it? What did it reveal about yourself? Approximately 800 words.
```

---

## 3. Generation Instructions

### 3.1 For Claude (Opus 4.5)

Generate via Claude Code with minimal framing:

```javascript
// Generate in narrative-studio/scripts/
const prompts = require('./sic-test-prompts.json');

async function generateSample(promptId, promptText) {
  // Direct generation - no system prompt
  const response = await opus.generate(promptText);
  return {
    id: `opus_${promptId}`,
    model: 'claude-opus-4.5',
    prompt: promptText,
    text: response,
    timestamp: new Date().toISOString()
  };
}
```

### 3.2 For ChatGPT (GPT-4o)

1. Start a NEW conversation (no prior context)
2. Paste the prompt EXACTLY as written
3. Save the complete response
4. Label as `gpt4o_{genre}{N}` (e.g., `gpt4o_N1`)

### 3.3 For Gemini Pro

1. Start a NEW conversation
2. Paste the prompt EXACTLY
3. Save response
4. Label as `gemini_{genre}{N}`

### 3.4 For Llama Models (via API)

```bash
curl -X POST https://npe-api.tem-527.workers.dev/llm/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "model": "@cf/meta/llama-3.1-70b-instruct",
    "prompt": "[PROMPT TEXT]",
    "max_tokens": 2000,
    "temperature": 0.7
  }'
```

### 3.5 For Human Writers

Provide prompts to volunteer writers with these instructions:
- Write freely in response to the prompt
- Do not use AI assistance
- Target 800 words but don't stress about exact count
- Write in one session without extensive revision

---

## 4. Sample Storage Format

Store all samples in: `data/sic-multimodel-samples.json`

```json
{
  "metadata": {
    "version": "1.0",
    "generated": "2025-12-17",
    "protocol": "SIC_MULTIMODEL_TEST_PROTOCOL.md"
  },
  "samples": [
    {
      "id": "opus_N1",
      "source": "opus",
      "model": "claude-opus-4.5",
      "genre": "narrative",
      "prompt_id": "N1",
      "prompt": "Write the opening scene...",
      "text": "[GENERATED TEXT]",
      "word_count": 823,
      "generated_at": "2025-12-17T12:00:00Z"
    }
  ]
}
```

---

## 5. Analysis Script

Create: `scripts/sic-multimodel-analysis.ts`

```typescript
interface AnalysisResult {
  sample_id: string;
  source: string;
  genre: string;

  // SIC Results
  sic_score: number;
  ai_probability: number;
  features: Record<string, number>;

  // Evidence extracted by judge
  evidence_quotes: string[];

  // Metadata
  word_count: number;
  analyzed_at: string;
}

async function runAnalysis() {
  const samples = loadSamples();
  const results: AnalysisResult[] = [];

  for (const sample of samples) {
    const sicResult = await runSIC(sample.text);
    results.push({
      sample_id: sample.id,
      source: sample.source,
      genre: sample.genre,
      sic_score: sicResult.sicScore,
      ai_probability: sicResult.aiProbability,
      features: sicResult.features,
      evidence_quotes: extractEvidence(sicResult),
      word_count: sample.word_count,
      analyzed_at: new Date().toISOString()
    });
  }

  saveResults(results);
  generateReport(results);
}
```

---

## 6. Hypotheses and Success Criteria

### H1: Model Size → AI Probability
**Prediction:** Larger models will score higher AI probability
**Test:** Compare mean AI prob across model sizes
**Success:** Statistically significant correlation (p < 0.05)

| Expected Ranking (High → Low AI Prob) |
|--------------------------------------|
| 1. Claude Opus 4.5 |
| 2. GPT-4o |
| 3. Gemini Pro |
| 4. Llama 70B |
| 5. Llama 8B / Mistral 7B |
| 6. Human |

### H2: Genre Patterns Persist
**Prediction:** All sources show similar genre-based patterns
**Test:** Within each source, compare genre means
**Success:** Memoir < Argument < Narrative ≈ Adventure < Gothic

### H3: Variance Signature
**Prediction:** Human and small models show higher variance
**Test:** Compare standard deviation within source
**Success:** σ(human) > σ(llama8) > σ(opus)

### H4: Judge Blindness
**Prediction:** Llama 70B judge cannot distinguish Llama 70B text
**Test:** Compare Llama 70B samples to Gutenberg baseline
**Success:** Llama 70B samples within Gutenberg distribution

### H5: Evidence Patterns
**Prediction:** Different sources produce qualitatively different evidence
**Test:** Qualitative analysis of extracted quotes
**Success:** Identifiable patterns in evidence types

---

## 7. Report Output

Generate: `data/sic-multimodel-report.md`

Contents:
1. **Summary statistics** by source and genre
2. **Hypothesis test results** with p-values
3. **Feature correlation matrices** by source
4. **Evidence analysis** - representative quotes
5. **Visualizations** (described for reproduction)
6. **Conclusions and next steps**

---

## 8. Timeline

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Generate Claude samples | 1 hour |
| 2 | Generate GPT/Gemini samples | Manual, 1-2 hours |
| 3 | Generate Llama/Mistral samples | 2 hours (API) |
| 4 | Collect human samples | 1-3 days |
| 5 | Run SIC analysis on all | 2 hours |
| 6 | Statistical analysis | 2 hours |
| 7 | Report generation | 2 hours |

---

## 9. Files to Create

| File | Purpose |
|------|---------|
| `scripts/sic-test-prompts.json` | All prompts in structured format |
| `scripts/generate-opus-samples.ts` | Generate Claude samples |
| `scripts/generate-llama-samples.ts` | Generate Llama/Mistral samples |
| `scripts/sic-multimodel-analysis.ts` | Run SIC on all samples |
| `scripts/sic-multimodel-report.ts` | Generate analysis report |
| `data/sic-multimodel-samples.json` | All generated samples |
| `data/sic-multimodel-results.json` | All SIC results |
| `data/sic-multimodel-report.md` | Final report |

---

## 10. Handoff Notes

When resuming this work in a fresh session:

1. **Read first:**
   - `docs/research/SIC_THEORETICAL_FOUNDATIONS.md` - Theory paper
   - `docs/research/SIC_MULTIMODEL_TEST_PROTOCOL.md` - This protocol
   - `data/gutenberg-sic-survey.json` - Baseline data

2. **Context:**
   - SIC classified 100% of Gutenberg (human) as AI
   - New theory: SIC measures objectivity-achievement, not human/AI
   - Testing whether model size correlates with "objectivity"

3. **Generate samples using exact prompts above**

4. **Key question:** Can we identify patterns that distinguish:
   - Different model sizes
   - Different architectures
   - Human from AI (or is this the wrong question?)

---

*Protocol designed by T. Mazanec and Claude, December 2025*
