# Week 5: LLM Transformation Analysis & Solution Design

**Date**: Oct 22, 2025
**Status**: Analysis Complete → Implementation Phase
**Time**: ~4h analysis, 8-12h implementation remaining

---

## 🎯 Original Goal (Priority 1)

Fix LLM prompts to achieve:
- Success rate: 20% → >50%
- Coherence: 0.21 → >0.6
- Text expansion: 128% → <40%

---

## 🔬 What We Tried (Iterations 1-3)

### Iteration 1: Enhanced Prompts
**Added**:
- Length constraints (±20%)
- Few-shot examples from corpus
- Step-by-step reasoning
- Self-critique checklist

**Result**: 0% success rate (worse than 20% baseline!)
- Using Ollama (local LLM, poor instruction-following)
- Still complete rewrites (171% text change)

### Iteration 2: Switch to Claude + Minimal Change Emphasis
**Added**:
- "MINIMAL changes only!" in prompt
- Forbidden section (what NOT to do)
- Hard constraint: >60% words identical
- Examples showing good vs bad transformations

**Result**: Still failing
- 71% text change (vs 40% target)
- Still rewriting instead of shifting

### Iteration 3: Explicit Word Count Limits
**Added**:
- "NOW TRANSFORM THIS TEXT BY CHANGING ONLY 1-3 WORDS"
- Arrow prompt (text → )
- Concrete examples with word counts

**Result**: 64% text change
- LLMs fundamentally want to "improve" text
- Even explicit instructions ignored

### Example Transformation Failures

```
Original: "I think the main issue here is that we're not clearly defining our goals." (73 chars)

Attempt 1 (Ollama):
"Undefined objectives and misaligned priorities correlate with measurable performance gaps."
→ 171% change, 0% success

Attempt 2 (Claude, minimal instructions):
"The core issue here is that we're not systematically defining our goals with precision."
→ 71% change, 0% success

Attempt 3 (Claude, "change only 1-3 words"):
"Analysis reveals the main issue is that we're not systematically defining our objectives."
→ 64% change, 0% success (changed: "I think" → "Analysis reveals", "clearly" → "systematically", "goals" → "objectives")
```

---

## 💡 Critical Insights

### 1. **LLMs Are Trained to Rewrite, Not Shift**
- Optimization target: "quality" and "helpfulness"
- Conflicts with: "minimal semantic shift"
- More explicit constraints → LLM tries harder to "improve" → more changes

### 2. **Length Matters for Control**
**Current tests**: All single short sentences (50-100 chars)
**Real use cases**:
- Short (1 sentence, <100 chars): Current tests
- Medium (paragraph, 200-500 chars): 3-5 sentences
- Long (multi-paragraph, 1000+ chars): Full narratives
- Very long (article, 5000+ chars): Sections, arguments

**Problem multiplies with length**:
- 15-word sentence → LLM changes 8 words (too many)
- 150-word paragraph → LLM rewrites 100+ words (disaster)

### 3. **Sentence-by-Sentence is Key**
**Why it helps**:
- Concrete constraints ("change 2 words in 15" vs "change 5 in 150")
- Granular verification (reject bad sentences without losing whole text)
- Context preservation per sentence
- Iterative refinement possible

**Challenges**:
- Cross-sentence coherence
- Computational cost (N sentences × latency)
- Context loss

---

## 🎯 Solution: Programmatic Control Over LLM Outputs

**Key Insight**: Don't trust LLM to follow instructions. Use **code** to enforce constraints.

### Architecture: Generate-Filter-Select (GFS)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. GENERATE (LLM Creativity)                                │
│    → Generate N candidates with diversity (temperature=0.9) │
│    → Each attempt is independent                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. FILTER (Programmatic Constraints)                        │
│    Hard constraints enforced by CODE, not LLM:              │
│    ✓ Length: ±20% of original (simple: len() check)         │
│    ✓ Overlap: >60% words identical (set intersection)       │
│    ✓ Naturalness: no repetition, grammatical                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. SELECT (POVM Measurement)                                │
│    → Measure all valid candidates                           │
│    → Select candidate with best POVM improvement            │
│    → If none valid: retry with stricter prompt              │
└─────────────────────────────────────────────────────────────┘
```

**Separation of Concerns**:
- **LLM**: Semantic understanding, creative generation
- **Code**: Constraint enforcement (deterministic, reliable)
- **POVM**: Quality measurement, selection

### Length-Adaptive Strategy

```python
def transform_adaptive(text: str, target: str):
    length = len(text)

    if length < 150:
        # Short: single GFS transformation
        return generate_filter_select(text, target, num_candidates=5)

    elif length < 600:
        # Medium: sentence-by-sentence
        sentences = split_sentences(text)
        return [
            generate_filter_select(s, target, num_candidates=3)
            for s in sentences
        ]

    else:
        # Long: hierarchical (paragraph → sentence)
        paragraphs = split_paragraphs(text)
        return [
            transform_adaptive(para, target)  # Recursive
            for para in paragraphs
        ]
```

---

## 🛠️ Implementation Plan

### Phase 1: Generate-Filter-Select for Single Sentences (2-3h)

**File**: `humanizer/services/transformation_engine.py`
**Class**: `LLMGuidedStrategy` (enhance existing)

**Components**:
1. **Generator**:
   - Generate N candidates (default: 5)
   - Use temperature=0.9 for diversity
   - Each candidate independent

2. **Filter** (programmatic):
   ```python
   def meets_constraints(original: str, candidate: str) -> bool:
       # Length check (±20%)
       if not (len(original) * 0.8 <= len(candidate) <= len(original) * 1.2):
           return False

       # Word overlap (>60% identical)
       original_words = set(original.lower().split())
       candidate_words = set(candidate.lower().split())
       overlap = len(original_words & candidate_words) / len(original_words)
       if overlap < 0.6:
           return False

       # Naturalness (no repetition)
       if has_repetition(candidate):
           return False

       return True
   ```

3. **Selector** (POVM-based):
   ```python
   def select_best(candidates: List[str], target: str) -> str:
       best = None
       best_improvement = -float('inf')

       for candidate in candidates:
           improvement = measure_povm_improvement(candidate, target)
           if improvement > best_improvement:
               best = candidate
               best_improvement = improvement

       return best
   ```

4. **Retry Logic**:
   - If <2 valid candidates: retry with stricter prompt
   - Max 3 retry attempts
   - If still failing: fall back to rules

**Expected Results**:
- Success rate: 40-60% (vs current 0%)
- Text change: 20-35% (vs current 64%)
- Coherence: 0.5-0.7 (vs current 0.16)

### Phase 2: Sentence-by-Sentence Transformation (2-3h)

**File**: `humanizer/services/sentence_transformation.py` (new)

**Components**:
1. **Sentence Splitter**:
   - Use NLTK or spaCy
   - Preserve punctuation
   - Handle edge cases (abbreviations, quotes)

2. **Context-Aware Transformation**:
   ```python
   async def transform_with_context(
       sentence: str,
       target: str,
       previous_sentences: List[str]
   ) -> str:
       # Build context from previous 2 sentences
       context = "\n".join(previous_sentences[-2:])

       # Generate with context
       candidates = await generate_candidates(
           sentence=sentence,
           target=target,
           context=context,
           num_candidates=3
       )

       # Filter and select
       valid = [c for c in candidates if meets_constraints(sentence, c)]
       return select_best(valid, target) if valid else sentence
   ```

3. **Coherence Verification**:
   - Check transition words maintained
   - Verify pronouns still make sense
   - Measure cross-sentence coherence

**Expected Results**:
- Works for medium-length texts (200-500 chars)
- Maintains narrative flow
- 2-3x slower than single transformation (acceptable)

### Phase 3: Integration & Testing (2-3h)

**Files**:
- Update `transformation_engine.py` with GFS
- Create `sentence_transformation.py`
- Update tests

**Test Suite**:
1. **Short texts** (current tests): Single GFS
2. **Medium texts** (3-5 sentences): Sentence-by-sentence
3. **Long texts** (paragraphs): Hierarchical

**Success Criteria**:
- Success rate >50% on short texts
- Success rate >40% on medium texts
- Coherence >0.6 across all lengths
- Text change <40% average

---

## 📊 Alternative Approaches Considered

### Edit-Based Transformation
**Idea**: Ask LLM for edit instructions, apply programmatically
**Pros**: Explicit control, explainable
**Cons**: LLMs bad at generating structured edits, parsing fragile
**Decision**: Not pursued (GFS more robust)

### Template-Based
**Idea**: Parse structure, transform only specific slots
**Pros**: Minimal changes guaranteed
**Cons**: Requires NLP parsing, limited to known patterns
**Decision**: Future enhancement (corpus-driven rules use this)

### Constrained Decoding
**Idea**: Use beam search with constraints during generation
**Pros**: Theoretical optimum
**Cons**: Requires access to model internals (not available for Claude API)
**Decision**: Not feasible with current architecture

---

## 🎯 Updated Week 5 Priorities

### Revised Priority Order

**Priority 1A: Generate-Filter-Select** (2-3h) ← **IMPLEMENT NOW**
- Addresses root cause: programmatic constraint enforcement
- Works for short texts (current tests)
- Foundation for longer texts

**Priority 1B: Sentence-by-Sentence** (2-3h) ← **IMPLEMENT NEXT**
- Critical for real use cases (medium/long narratives)
- Builds on GFS foundation
- Enables hierarchical transformation

**Priority 2: Hybrid Redesign** (1-2h)
- Use GFS for LLM component
- Amplification mode: rules + LLM refinement
- Expected: 60-70% success

**Priority 3: Corpus-Driven Rules** (4-6h)
- Mine patterns from successful GFS transformations
- Learn which word replacements work
- Reduce LLM dependency

---

## 📈 Expected Outcomes

### Immediate (GFS + Sentence-by-Sentence)
- Short texts: 50-60% success, 0.6+ coherence
- Medium texts: 40-50% success, 0.6+ coherence
- Long texts: 35-45% success, 0.55+ coherence

### Combined (GFS + Sentence + Hybrid)
- Overall: 60-70% success
- All lengths: 0.65+ coherence
- Production-ready transformation engine

### Time to MVP
- Phase 1 (GFS): 2-3h
- Phase 2 (Sentence): 2-3h
- Phase 3 (Testing): 2-3h
- **Total**: 6-9h to production-ready system

---

## 🔑 Key Decisions

1. **Don't trust LLM to follow instructions** → Use code for constraints
2. **Length matters** → Different strategies for different lengths
3. **Sentence-by-sentence is critical** → Real use cases need this
4. **Generate-Filter-Select architecture** → Separates concerns cleanly
5. **POVM measurement for selection** → Quality metric, not just constraints

---

## 📝 Next Steps

1. ✅ Document analysis and decisions (this file)
2. ⏳ Store in memory (ChromaDB)
3. ⏳ Update CLAUDE.md with findings
4. ⏳ Create Week 5 handoff
5. ⏳ Implement Phase 1 (GFS)
6. ⏳ Implement Phase 2 (Sentence-by-Sentence)
7. ⏳ Test and validate

---

**End of Analysis Document**
