# Transformation Quality Metrics

**Created**: Dec 12, 2025
**Purpose**: Evaluate style and persona transformation quality

---

## Core Principle: Style vs Persona Separation

| Dimension | Style Transformation | Persona Transformation |
|-----------|---------------------|----------------------|
| **Changes** | HOW text is written | WHO is perceiving |
| **Preserves** | Content, viewpoint, narrator identity | Content, writing mechanics |

---

## Style Transformation Metrics

### 1. Content Preservation (40 points)

| Criterion | Points | Test |
|-----------|--------|------|
| All events present | 10 | Diff original vs output for key events |
| Factual accuracy | 10 | Names, dates, locations unchanged |
| Causal relationships | 10 | Cause/effect chains preserved |
| Dialogue meaning | 10 | Semantic equivalence of dialogue |

### 2. Style Application (30 points)

| Criterion | Points | Test |
|-----------|--------|------|
| Register match | 10 | Vocabulary formality matches target |
| Sentence pattern | 10 | Length/complexity matches target |
| Rhetorical devices | 10 | Target devices present (parallelism, questions, etc.) |

### 3. Prohibition Compliance (30 points)

| Criterion | Points | Violation Examples |
|-----------|--------|-------------------|
| No platform artifacts | 10 | "EDIT:", "Thanks for reading" |
| No narrator shift | 10 | 3rd person → 1st person memoir |
| No new facts | 10 | Added characters, locations, worldbuilding |

**Pass threshold**: 75/100

---

## Persona Transformation Metrics

### 1. Content Preservation (40 points)

| Criterion | Points | Test |
|-----------|--------|------|
| All events present | 10 | Key events preserved |
| Factual accuracy | 10 | Names, dates, locations unchanged |
| Genre identity | 10 | Narrative stays narrative, essay stays essay |
| Writing mechanics | 10 | Sentence patterns similar to original |

### 2. Persona Application (35 points)

| Criterion | Points | Test |
|-----------|--------|------|
| Epistemic shift | 10 | How narrator "knows" changed appropriately |
| Attention shift | 10 | What narrator notices/emphasizes shifted |
| Value framing | 10 | Implicit approvals/skepticisms reflect persona |
| Reader relationship | 5 | Appropriate stance (instructing/witnessing/etc.) |

### 3. Prohibition Compliance (25 points)

| Criterion | Points | Violation Examples |
|-----------|--------|-------------------|
| No style changes | 10 | Sentence length dramatically different |
| No narrator biography | 10 | "As a scientist, I...", "In my years..." |
| No moral sermons | 5 | Explicit lessons, tidy moral conclusions |

**Pass threshold**: 75/100

---

## Automated Tests (Implementation Guide)

### Content Preservation Test
```typescript
function testContentPreservation(original: string, transformed: string): number {
  // 1. Extract named entities (spaCy or compromise.js)
  // 2. Compare entity sets (should be identical)
  // 3. Extract key verbs/actions
  // 4. Compare action sequences
  // Return: percentage match (0-100)
}
```

### Style Mechanics Test
```typescript
function testStyleMechanics(original: string, transformed: string): {
  sentenceLengthDelta: number;  // Should be small for persona, can vary for style
  vocabularyRegisterShift: number;  // Should be small for persona
  figurativeDensityDelta: number;  // Should be small for persona
} {
  // 1. Compute avg sentence length for both
  // 2. Compute vocabulary complexity score
  // 3. Count figurative language markers
}
```

### Artifact Detection Test
```typescript
function detectArtifacts(text: string): string[] {
  const patterns = [
    /\bEDIT:?\s/i,
    /\bTL;?DR:?\s/i,
    /\bThanks for (reading|the gold)/i,
    /^(As a \w+,?\s*I\s)/m,
    /^(In my (years|experience))/m,
  ];
  return patterns.filter(p => p.test(text)).map(p => p.source);
}
```

---

## Manual Evaluation Rubric

For human evaluation, use this quick checklist:

### Style Transformation
- [ ] Same story, different voice?
- [ ] Target register achieved?
- [ ] No Reddit/blog framing added?
- [ ] No narrator identity change?

### Persona Transformation
- [ ] Same events and facts?
- [ ] Different perspective on what matters?
- [ ] Writing mechanics preserved?
- [ ] No "As a X, I..." framing?

---

## Test Corpus

Use these for benchmarking:

| Text | Source | Good For Testing |
|------|--------|------------------|
| Darwin excerpt | Origin of Species | Scientific → other registers |
| Austen excerpt | Pride and Prejudice | Social observation personas |
| Thoreau excerpt | Walden | Contemplative → other personas |
| Technical docs | Any API docs | Formal → informal style |
| Reddit post | r/AITA, r/tifu | Casual → formal style |

---

## Test Results (Dec 12, 2025)

### Extraction Quality Tests

Tested dual extraction prompts on Gutenberg texts via Ollama qwen3:14b.

| Author | Text | Style Extraction | Persona Extraction |
|--------|------|------------------|-------------------|
| Darwin | Origin of Species | A (4/4) | A (4/4) |
| Austen | Pride and Prejudice | A (4/4) | A (4/4) |
| Thoreau | Walden | A (4/4) | A (4/4) |

**Criteria tested**:
- Style: focusesMechanics, avoidsPersona, hasStyleProfile, hasTransformationPrompt
- Persona: focusesLayers, avoidsStyle, hasFiveLayers, hasTransformationPrompt

### Transformation Quality Comparison

Tested OLD conflated profile vs NEW separated style/persona prompts on casual text.

| Profile Type | Score | Grade | Notes |
|--------------|-------|-------|-------|
| OLD Darwin (conflated) | 75/100 | B | Mixed style+persona, long run-on sentences |
| NEW Darwin Style | 70/100 | C | Overdid mechanics, purple prose |
| NEW Darwin Persona | 90/100 | A | Clean epistemic shift, preserved structure |

**Key Finding**: Persona transformations score highest because they change HOW the narrator PERCEIVES without fighting natural prose flow. Style transformations tend to overdo mechanics and produce overwrought text.

### Recommendations

1. **Prefer persona transformations** for voice changes - they produce more natural results
2. **Use style transformations sparingly** - only when specific mechanical changes are needed
3. **Never conflate** - the old approach of mixing style+persona produces medium-quality results
4. **5-layer persona stack works** - epistemic/attention/values/reader contract is the right model

---

## Future: Embedding-Based Metrics

For automated scoring at scale:

1. **Semantic similarity**: Original vs transformed should be high (>0.85)
2. **Style embedding distance**: Should shift toward target style
3. **Persona vector projection**: Attention/epistemic markers should shift

Requires: Fine-tuned embedding model for style/persona dimensions.
