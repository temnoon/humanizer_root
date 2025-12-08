# Humanizer Transformation Improvement Plan

**Created**: December 7, 2025
**Status**: In Progress
**Branch**: `architecture-remediation-dec06`
**Priority**: CRITICAL - Quality issues affecting user experience

---

## Problem Summary

The Computer Humanizer transformation has several quality issues:

1. **Tell-words are REMOVED, not REPLACED** - Creates awkward gaps in text
2. **Intensity settings are meaningless** - Only affect tell-word removal rate (negligible)
3. **LLM prompt is too vague** - "Make this sound natural" doesn't guide the model
4. **Burstiness enhancement is primitive** - Placeholder code, not production-ready
5. **GPTZero targeting adds latency without benefit** - Worse results in 3/4 tests
6. **Default model (Llama 70B) underperforms** - GPT-OSS 20B scored better

### Evidence

| Source Type | Original AI | After Transform | Expected |
|-------------|-------------|-----------------|----------|
| Academic | 70% | 40-46% | <30% |
| Blog | 65% | 43-47% | <30% |
| Technical | 48% | 38-44% | <25% |
| Essay | 45% | 40-47% | <25% |

Current transformations only achieve 5-30 point drops. Target: 40+ point drops.

---

## Implementation Plan

### Phase 1: Fix Tell-Word Replacement (CRITICAL)

**File**: `workers/npe-api/src/lib/text-naturalizer.ts`

**Current Problem** (lines 284-289):
```typescript
toRemove.forEach(phrase => {
  const regex = new RegExp(`\\b${escapeRegex(phrase)}[,.]?\\s*`, 'gi');
  result = result.replace(regex, ' ');  // <-- Just removes!
});
```

**Fix**: Use the existing `TELL_WORD_REPLACEMENTS` dictionary:
```typescript
toRemove.forEach(phrase => {
  const replacements = TELL_WORD_REPLACEMENTS[phrase.toLowerCase()];
  if (replacements && replacements.length > 0) {
    // Pick a non-empty replacement
    const validReplacements = replacements.filter(r => r.length > 0);
    if (validReplacements.length > 0) {
      const replacement = validReplacements[Math.floor(Math.random() * validReplacements.length)];
      const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'gi');
      result = result.replace(regex, replacement);
    } else {
      // Only remove if all replacements are empty strings (intentional removal)
      const regex = new RegExp(`\\b${escapeRegex(phrase)}[,.]?\\s*`, 'gi');
      result = result.replace(regex, ' ');
    }
  }
});
```

**Test**: Before/after comparison with text containing "furthermore", "moreover", etc.

---

### Phase 2: Intensity-Aware LLM Prompts

**File**: `workers/npe-api/src/services/computer-humanizer.ts`

**Current Problem** (lines 350-356):
```typescript
const prompt = `Make this text sound natural and conversational...`;
// Same prompt for all intensities!
```

**Fix**: Create intensity-specific prompts:

```typescript
const INTENSITY_PROMPTS: Record<HumanizationIntensity, string> = {
  light: `Gently improve this text to sound more natural. Keep the original structure and most phrasing intact. Only make small adjustments:
- Add a few contractions (don't, it's, we're)
- Soften overly formal phrases
- Keep technical terms and proper nouns unchanged
Word count should stay within 5% of original.`,

  moderate: `Rewrite this text to sound like a knowledgeable person explaining something. Use:
- Varied sentence lengths (mix short punchy sentences with longer ones)
- Contractions throughout (don't, can't, it's, they're)
- Simpler word choices where possible
- Occasional conversational phrases ("Here's the thing", "Think of it this way")
Word count should stay within 10% of original.`,

  aggressive: `Completely rewrite this in a casual, conversational tone - like you're explaining to a friend over coffee. Rules:
- Use short sentences. Then longer ones. Mix it up.
- Start some sentences with "But", "And", "So", or "Now"
- Use contractions everywhere
- Replace jargon with plain language
- Add personality - rhetorical questions, asides, emphasis
- It's okay to restructure paragraphs
Word count can vary by 15%.`
};
```

---

### Phase 3: Improve LLM Prompt Structure

**File**: `workers/npe-api/src/services/computer-humanizer.ts`

**New prompt template**:

```typescript
async function llmPolishPass(
  env: Env,
  text: string,
  modelId: string,
  userId: string,
  intensity: HumanizationIntensity,
  flaggedSentences?: Set<string>
): Promise<string> {
  const wordCount = text.split(/\s+/).length;

  const intensityPrompt = INTENSITY_PROMPTS[intensity];

  const prompt = `You are a skilled editor helping make AI-generated text sound human-written.

TASK: ${intensityPrompt}

CRITICAL RULES:
1. Return ONLY the rewritten text - no explanations, no "Here's the rewritten version"
2. Preserve all facts, names, and technical accuracy
3. Never add information that wasn't in the original
4. Never use these AI tell-words: furthermore, moreover, consequently, it's worth noting, it is important to, in today's [anything], delve, tapestry, landscape, robust, leverage, navigate, realm, holistic, paradigm

ORIGINAL TEXT (${wordCount} words):
${text}

REWRITTEN TEXT:`;

  // ... rest of function
}
```

---

### Phase 4: Fix Burstiness Enhancement

**File**: `workers/npe-api/src/lib/text-naturalizer.ts`

The current `enhanceBurstiness()` function is a placeholder. Options:

**Option A: Remove it entirely** - Let LLM handle burstiness via prompt
**Option B: Make it smarter** - Better sentence splitting logic

**Recommendation**: Option A for now. The LLM prompt (Phase 2-3) should handle sentence variation. The rule-based approach creates awkward splits.

Change `enhanceBurstiness()` to be a no-op for now:
```typescript
export function enhanceBurstiness(text: string, targetScore: number = 60): string {
  // Burstiness is now handled by LLM polish pass with intensity-aware prompts
  // Keeping this function for API compatibility
  return text;
}
```

---

### Phase 5: Change Default Model

**File**: `workers/npe-api/src/services/computer-humanizer.ts`

Change line 139:
```typescript
// OLD
const modelId = options.model || '@cf/meta/llama-3.1-70b-instruct';

// NEW
const modelId = options.model || '@cf/openai/gpt-oss-20b';
```

**Rationale**: GPT-OSS 20B achieved better results in testing:
- Llama 70B: -3 to -5 confidence drop
- GPT-OSS 20B: -6 to -9 confidence drop

Also update frontend default in `CloudAISettings.tsx`:
```typescript
// Line 42
const [selectedModel, setSelectedModel] = useState<string>('@cf/openai/gpt-oss-20b');
// Line 219
return localStorage.getItem(STORAGE_KEY) || '@cf/openai/gpt-oss-20b';
```

And mark GPT-OSS 20B as recommended:
```typescript
{
  id: '@cf/openai/gpt-oss-20b',
  name: 'GPT-OSS 20B',
  provider: 'OpenAI (via Cloudflare)',
  description: 'Best for humanization. Good quality with clean output.',
  recommended: true,  // NEW
  cost: 'Standard',
},
{
  id: '@cf/meta/llama-3.1-70b-instruct',
  name: 'Llama 3.1 70B',
  provider: 'Meta (via Cloudflare)',
  description: 'Fast general-purpose model.',
  recommended: false,  // CHANGED
  cost: 'Included',
},
```

---

### Phase 6: Deprecate GPTZero Targeting (Optional)

Based on testing, GPTZero targeting:
- Adds 1-2 seconds latency
- Performs worse in 3/4 test cases
- Only marginally better for technical content

**Recommendation**: Keep the feature but:
1. Don't promote it in UI
2. Add warning that it may not improve results
3. Consider removing in future version

For now, update the UI tooltip:
```typescript
// ToolPanes.tsx - GPTZero checkbox description
description: "Experimental: Uses GPTZero API to identify AI-flagged sentences. Results may vary."
```

---

### Phase 7: Comprehensive Test Suite

Create a test script that validates against multiple content types:

**File**: `workers/npe-api/tests/humanizer-effectiveness.test.ts`

**Test Categories** (10+ samples each):
1. Academic/Research papers
2. Blog posts / Marketing content
3. Technical documentation
4. News articles
5. Creative writing / Fiction
6. Business emails
7. Social media posts
8. Product descriptions
9. Educational content
10. Legal / Formal documents

**Success Criteria**:
- AI confidence drop ≥ 30 points for 80% of samples
- No tell-words in output
- Burstiness score ≥ 40
- Word count within specified tolerance
- No grammar errors introduced
- Meaning preserved (manual spot-check)

---

## Implementation Order

1. **Phase 1: Fix tell-word replacement** (30 min) - Biggest quality issue
2. **Phase 3: Improve LLM prompt** (30 min) - Core transformation logic
3. **Phase 2: Intensity-aware prompts** (20 min) - Depends on Phase 3
4. **Phase 5: Change default model** (10 min) - Quick win
5. **Phase 4: Fix burstiness** (10 min) - Remove placeholder code
6. **Phase 7: Test suite** (1-2 hours) - Validate all changes
7. **Phase 6: GPTZero deprecation** (10 min) - Optional cleanup

---

## Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `workers/npe-api/src/lib/text-naturalizer.ts` | 1, 4 | Fix replaceTellWords(), simplify enhanceBurstiness() |
| `workers/npe-api/src/services/computer-humanizer.ts` | 2, 3, 5 | Intensity prompts, better LLM prompt, new default model |
| `narrative-studio/src/components/settings/CloudAISettings.tsx` | 5 | Change recommended model |
| `narrative-studio/src/components/tools/ToolPanes.tsx` | 6 | Update GPTZero description |
| `workers/npe-api/tests/humanizer-effectiveness.test.ts` | 7 | New test file |

---

## Rollback Plan

If changes cause regressions:
1. Revert to commit before changes
2. Or toggle `enableLLMPolish: false` to bypass LLM entirely
3. Monitor via transformation history in DB

---

## Success Metrics

**Before** (current state):
- Average AI confidence drop: 5-15 points
- Tell-word artifacts: Common
- User complaints: "Words missing", "Awkward phrasing"

**After** (target):
- Average AI confidence drop: 30-40 points
- Tell-word artifacts: None
- Final AI confidence: <35% for most content

---

## Handoff Notes

If context ends before completion:

1. Read this file: `/Users/tem/humanizer_root/docs/HUMANIZER_IMPROVEMENT_PLAN.md`
2. Check todo progress via ChromaDB tag `humanizer-improvements`
3. Run test script: `/Users/tem/humanizer_root/test-humanizer-v4.sh`
4. Key files are listed above in "Files to Modify" section

**ChromaDB Tags**: `humanizer`, `improvements`, `quality-fix`, `dec-2025`

---

**End of Plan** | Created: Dec 7, 2025 | Branch: architecture-remediation-dec06
