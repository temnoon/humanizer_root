# Humanizer Improvements Handoff

**Created**: December 8, 2025
**Status**: READY FOR IMPLEMENTATION
**Branch**: `architecture-remediation-dec06`
**Priority**: High - Pre-launch quality improvements

---

## Executive Summary

Full 60-sample test suite revealed key areas for improvement:
- **85% pass rate** (target: 90%)
- **61.7% tell-word elimination** (target: 90%)
- **Em-dash not being detected/removed** (known AI tell)
- **Light intensity underperforms** (66.7% pass vs 100% for aggressive)

This document specifies all improvements to implement.

---

## Test Results Baseline (Dec 8, 2025)

### Before Improvements

| Metric | Value | Target |
|--------|-------|--------|
| Pass Rate | 85.0% | 90% |
| Avg Confidence Drop | 24.7 pts | 30 pts |
| Tell-word Elimination | 61.7% | 90% |
| Verdict Flip Rate | 16.7% | 20% |
| Light Intensity Pass | 66.7% | 80%+ |
| Moderate Intensity Pass | 86.7% | 90%+ |
| Aggressive Intensity Pass | 100% | 90%+ |

### Failed Tests (9 total)
1. Very Short Text (edge-case, error)
2. Company Blog (light, 3 pts drop)
3. Personal Essay (light, 2 pts drop)
4. List Heavy Content (light, 8 pts drop)
5. Grant Proposal (light, 9 pts drop)
6. API Documentation (light, 6 pts drop)
7. Product Description (moderate, 8 pts drop)
8. Study Guide (moderate, 8 pts drop)
9. Instructional Content (moderate, 9 pts drop)

---

## Improvement #1: Em-Dash Detection and Removal

### Problem
Em-dashes (—) and en-dashes (–) are now widely recognized as AI tells. They're making news regularly. Our system doesn't detect or remove them.

### Implementation

#### File: `workers/npe-api/src/services/ai-detection/tell-words.ts`

Add new category to `AI_TELL_WORDS`:

```typescript
{
  category: 'Punctuation Patterns',
  weight: 0.7,
  words: [
    '—',  // em-dash (U+2014)
    '–',  // en-dash (U+2013)
  ]
}
```

#### File: `workers/npe-api/src/lib/text-naturalizer.ts`

Add em-dash replacement function:

```typescript
/**
 * Replace em-dashes and en-dashes with more natural alternatives
 * Em-dashes are a known AI tell - humans typically use commas,
 * parentheses, or separate sentences
 */
export function replaceEmDashes(text: string): string {
  let result = text;

  // Pattern 1: "word — word" → "word, word" or "word. Word"
  // Choose based on context (clause vs new thought)

  // Em-dash between words (with spaces): usually can be comma
  result = result.replace(/\s—\s/g, ', ');
  result = result.replace(/\s–\s/g, ', ');

  // Em-dash without spaces (tight): convert to spaced hyphen or comma
  result = result.replace(/(\w)—(\w)/g, '$1 - $2');
  result = result.replace(/(\w)–(\w)/g, '$1 - $2');

  // Em-dash at sentence boundaries: convert to period
  result = result.replace(/—([A-Z])/g, '. $1');
  result = result.replace(/–([A-Z])/g, '. $1');

  // Clean up any double spaces
  result = result.replace(/\s{2,}/g, ' ');

  return result;
}
```

Call this in `replaceTellWords()` or as separate step in the pipeline.

#### File: `workers/npe-api/src/services/computer-humanizer.ts`

Add to `FORBIDDEN_TELL_WORDS`:

```typescript
const FORBIDDEN_TELL_WORDS = [
  // ... existing words ...
  '—',  // em-dash - NEVER use
  '–',  // en-dash - NEVER use
];
```

Update LLM prompts to explicitly forbid:

```typescript
FORBIDDEN PUNCTUATION:
- NEVER use em-dashes (—) or en-dashes (–)
- Use commas, periods, or parentheses instead
- If you need a pause, use a comma
- If it's a new thought, start a new sentence
```

---

## Improvement #2: Final Tell-Word Sweep (Post-LLM)

### Problem
The LLM often reintroduces tell-words despite being told not to. Current post-processing only catches *reintroduced* words, not ALL remaining tell-words.

### Implementation

#### File: `workers/npe-api/src/services/computer-humanizer.ts`

After the LLM polish pass, add a final sweep:

```typescript
// After LLM polish, before final detection
// ========================================
// FINAL TELL-WORD SWEEP
// ========================================
// Run tell-word replacement one more time to catch any
// that the LLM reintroduced or didn't fully eliminate
const finalSweepStart = Date.now();
let finalText = polished;

// Get current tell-words
const preSweepDetection = await detectAILocal(finalText);
if (preSweepDetection.detectedTellWords.length > 0) {
  console.log(`[Humanizer] Final sweep: ${preSweepDetection.detectedTellWords.length} tell-words remaining`);

  // Run aggressive replacement (100% rate)
  finalText = replaceTellWords(finalText, 'aggressive');

  // Also run em-dash replacement
  finalText = replaceEmDashes(finalText);

  console.log(`[Humanizer] Final sweep complete`);
}

const finalSweepTime = Date.now() - finalSweepStart;
```

This ensures 100% tell-word elimination regardless of what the LLM does.

---

## Improvement #3: Light Intensity Boost

### Problem
Light intensity has only 66.7% pass rate. The changes are too minimal to meaningfully reduce detection.

### Options

**Option A: Boost light to be closer to moderate**
- Increase replacement rate from 30% to 50%
- Increase temperature from 0.5 to 0.6
- Add more structural changes

**Option B: Recommend moderate as default**
- Keep light for users who explicitly want minimal changes
- Default UI selection to "moderate"
- Add warning that "light may not significantly reduce detection"

### Recommended: Option A + UI Guidance

Update `INTENSITY_PROMPTS.light`:

```typescript
light: {
  instructions: `Improve this text to sound more natural while keeping the original structure.

GUIDELINES:
- Add contractions where natural (don't, it's, we're, they'll)
- Soften overly formal phrases
- Replace obvious AI tell-words with natural alternatives
- Keep technical terms and specific facts exactly as written
- Minor sentence restructuring is OK if it improves flow
- Add occasional paragraph breaks where natural pauses occur`,
  wordTolerance: '±8%',  // Increased from ±5%
  temperature: 0.6       // Increased from 0.5
}
```

Update `replaceTellWords` intensity map:

```typescript
const intensityMap = { light: 0.5, moderate: 0.7, aggressive: 0.95 };
// Changed from: { light: 0.3, moderate: 0.6, aggressive: 0.9 }
```

---

## Improvement #4: Frontend Intensity Guidance

### Problem
Users don't understand what intensity levels mean or when to use each.

### Implementation

#### File: `narrative-studio/src/components/tools/ToolPanes.tsx`

Add help icon with tooltip/popover next to intensity selector:

```tsx
// Add import
import { HelpCircle } from 'lucide-react';

// In HumanizerPane, next to intensity dropdown:
<div className="flex items-center gap-2">
  <label>Intensity</label>
  <select value={intensity} onChange={(e) => setIntensity(e.target.value)}>
    <option value="light">Light</option>
    <option value="moderate">Moderate (Recommended)</option>
    <option value="aggressive">Aggressive</option>
  </select>
  <HelpIcon content={INTENSITY_HELP_CONTENT} />
</div>
```

#### Help Content

```typescript
const INTENSITY_HELP_CONTENT = {
  title: "Humanization Intensity",
  description: "Controls how much the text is modified to reduce AI detection.",
  levels: [
    {
      name: "Light",
      description: "Minimal changes. Best for text that's already mostly human-like or when you need to preserve exact wording.",
      changes: [
        "Adds some contractions (don't, it's)",
        "Replaces ~50% of AI tell-words",
        "Minor structural adjustments"
      ],
      useWhen: [
        "Text is only slightly flagged as AI",
        "You need to preserve technical accuracy",
        "Formal tone must be maintained"
      ],
      expectedDrop: "10-20 points"
    },
    {
      name: "Moderate (Recommended)",
      description: "Balanced approach. Good for most content while maintaining meaning.",
      changes: [
        "Consistent use of contractions",
        "Replaces ~70% of AI tell-words",
        "Varies sentence lengths",
        "Adds conversational touches"
      ],
      useWhen: [
        "General-purpose humanization",
        "Blog posts, articles, essays",
        "Professional but accessible content"
      ],
      expectedDrop: "20-35 points"
    },
    {
      name: "Aggressive",
      description: "Maximum humanization. Significantly rewrites text for casual, conversational tone.",
      changes: [
        "Heavy use of contractions",
        "Replaces ~95% of AI tell-words",
        "Major sentence restructuring",
        "Casual, conversational voice",
        "May restructure paragraphs"
      ],
      useWhen: [
        "Text scores very high on AI detection",
        "Casual/informal tone is acceptable",
        "Social media, personal blogs",
        "Content where personality matters"
      ],
      expectedDrop: "30-50 points"
    }
  ],
  tips: [
    "Start with Moderate - it works for most content",
    "If detection is still high, try Aggressive",
    "Light is best when you need minimal changes",
    "Em-dashes (—) are automatically removed at all levels"
  ]
};
```

#### Component: HelpIcon

```tsx
// components/ui/HelpIcon.tsx
import { HelpCircle } from 'lucide-react';
import { useState } from 'react';

interface HelpIconProps {
  content: {
    title: string;
    description: string;
    levels?: Array<{
      name: string;
      description: string;
      changes: string[];
      useWhen: string[];
      expectedDrop: string;
    }>;
    tips?: string[];
  };
}

export function HelpIcon({ content }: HelpIconProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Help"
      >
        <HelpCircle size={16} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-96 p-4 bg-white border border-gray-200 rounded-lg shadow-lg
                        top-full left-0 mt-2 text-sm">
          <h3 className="font-semibold text-lg mb-2">{content.title}</h3>
          <p className="text-gray-600 mb-4">{content.description}</p>

          {content.levels?.map((level) => (
            <div key={level.name} className="mb-4 pb-4 border-b border-gray-100 last:border-0">
              <h4 className="font-medium text-base">{level.name}</h4>
              <p className="text-gray-600 text-xs mb-2">{level.description}</p>
              <div className="text-xs">
                <strong>Expected improvement:</strong> {level.expectedDrop}
              </div>
            </div>
          ))}

          {content.tips && (
            <div className="mt-4 p-3 bg-blue-50 rounded text-xs">
              <strong>Tips:</strong>
              <ul className="list-disc list-inside mt-1">
                {content.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Improvement #5: Handle Edge Cases

### Very Short Text
The test showed `-1%` confidence for "Very Short Text" - this indicates an error in detection for very short content.

Add minimum length handling:

```typescript
// In detectAILocal()
if (wordCount < 30) {
  return {
    confidence: 50,  // Neutral - can't reliably detect
    verdict: 'uncertain',
    signals: { /* baseline values */ },
    detectedTellWords: [],
    note: 'Text too short for reliable detection'
  };
}
```

### List-Heavy Content
Lists often get flagged. Add list-aware processing:

```typescript
// Detect if content is primarily lists
const listLineRatio = (text.match(/^[\s]*[-*•]\s/gm) || []).length /
                      text.split('\n').length;

if (listLineRatio > 0.5) {
  // Apply lighter processing to preserve list structure
  // Focus on replacing tell-words within list items
}
```

---

## Test Suite for Verification

After implementing all improvements, run:

```bash
cd /Users/tem/humanizer_root/test-samples
python3 run_comprehensive_tests.py --output post_improvements_test.json
```

### Expected Improvements

| Metric | Before | Target After |
|--------|--------|--------------|
| Pass Rate | 85.0% | 92%+ |
| Avg Confidence Drop | 24.7 pts | 28+ pts |
| Tell-word Elimination | 61.7% | 95%+ |
| Light Intensity Pass | 66.7% | 85%+ |
| Verdict Flip Rate | 16.7% | 25%+ |

---

## New Test Suite (60 Different Samples)

After verification, create a NEW set of 60 samples to ensure improvements generalize:

### New Categories to Add
1. **Social Media** (10 samples)
   - Twitter/X threads
   - Instagram captions
   - Reddit posts
   - LinkedIn articles
   - Facebook posts

2. **Professional Communications** (10 samples)
   - Cover letters
   - Recommendation letters
   - Meeting summaries
   - Project updates
   - Stakeholder reports

3. **Consumer Content** (10 samples)
   - Amazon reviews
   - Yelp reviews
   - App store reviews
   - Comparison articles
   - Buying guides

### Samples to Replace
Remove from existing suite and add variety:
- Replace some academic samples with more diverse scientific fields
- Add more informal/casual content
- Add more list-heavy and structured content
- Add more very short and very long samples

---

## Files to Modify

| File | Changes |
|------|---------|
| `workers/npe-api/src/services/ai-detection/tell-words.ts` | Add em-dash detection |
| `workers/npe-api/src/lib/text-naturalizer.ts` | Add `replaceEmDashes()`, update intensity rates |
| `workers/npe-api/src/services/computer-humanizer.ts` | Add final sweep, update prompts, forbid em-dashes |
| `narrative-studio/src/components/tools/ToolPanes.tsx` | Add help icon, update intensity labels |
| `narrative-studio/src/components/ui/HelpIcon.tsx` | Create new component |
| `test-samples/samples.json` | Add new samples for v2 test suite |

---

## Implementation Order

1. **Backend Changes** (em-dash, final sweep, intensity boost)
2. **Run test suite** - verify improvements
3. **Frontend Changes** (help icon, tooltips)
4. **Create new test suite** (60 different samples)
5. **Run new test suite** - verify generalization
6. **Commit and push**

---

## ChromaDB Tags

`humanizer`, `improvements`, `em-dash`, `tell-words`, `intensity`, `test-suite`, `dec-2025`

---

**End of Handoff** | Created: Dec 8, 2025 | Branch: architecture-remediation-dec06
