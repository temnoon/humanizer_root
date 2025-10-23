# Week 5 Session Handoff - START HERE

**Date**: Oct 22, 2025
**Status**: ✅ Analysis Complete → ⏳ Implementation Ready
**Time**: ~4h analysis complete, 6-9h implementation to MVP

---

## 🎯 Quick Summary

**Problem**: LLM prompt engineering failed (3 iterations, 0% success)
**Root Cause**: LLMs rewrite text instead of making minimal shifts (even with explicit constraints)
**Solution**: Generate-Filter-Select (GFS) - Use CODE to enforce constraints, not LLM instructions

---

## 📋 Current State

### What Works ✅
- Week 2/3: POVM operators (d > 2.0, σ = 0.000) - excellent!
- Measurement infrastructure - deterministic, accurate
- Evaluation framework - comprehensive metrics

### What's Broken ❌
- LLM transformations: 0% success (vs 20% Week 4 baseline)
- Text change: 64% (vs 40% target)
- Coherence: 0.16 (vs 0.6 target)

### Example Failure
```
Original: "I think the main issue here is that we're not clearly defining our goals."
LLM output: "Analysis reveals the main issue is that we're not systematically defining our objectives."
Problem: Changed 8 words (not 1-3 as instructed), 64% change (not <40%)
```

---

## 🛠️ Implementation Plan

### Phase 1: Generate-Filter-Select (2-3h) ← **START HERE**

**File**: `humanizer/services/transformation_engine.py`
**Method**: Enhance `LLMGuidedStrategy.transform()`

**Steps**:
1. Generate N candidates (default 5, temperature=0.9)
2. Filter programmatically:
   ```python
   # Length check
   if not (len(original) * 0.8 <= len(candidate) <= len(original) * 1.2):
       reject()

   # Word overlap check
   overlap = len(original_words & candidate_words) / len(original_words)
   if overlap < 0.6:
       reject()
   ```
3. Select best via POVM measurement
4. Retry with stricter prompt if <2 valid candidates

**Expected**: 50-60% success, 0.6+ coherence

### Phase 2: Sentence-by-Sentence (2-3h)

**File**: `humanizer/services/sentence_transformation.py` (NEW)

**Steps**:
1. Split text into sentences
2. Transform each with GFS + context (previous 2 sentences)
3. Verify cross-sentence coherence
4. Reassemble

**Expected**: 40-50% success on medium texts (200-500 chars)

### Phase 3: Testing & Validation (2-3h)

**Tests**:
- Short texts (current): Single GFS
- Medium texts (3-5 sentences): Sentence-by-sentence
- Long texts (paragraphs): Hierarchical

**Success Criteria**:
- Overall: >50% success rate
- Coherence: >0.6 across all lengths
- Text change: <40% average

---

## 🔑 Key Architecture: Generate-Filter-Select

```
┌─────────────────────────────────┐
│ GENERATE (LLM)                  │
│ → N diverse candidates          │
│ → Temperature 0.9               │
└─────────────────────────────────┘
            ↓
┌─────────────────────────────────┐
│ FILTER (CODE - deterministic)   │
│ ✓ Length ±20%                   │
│ ✓ Word overlap >60%             │
│ ✓ No repetition                 │
└─────────────────────────────────┘
            ↓
┌─────────────────────────────────┐
│ SELECT (POVM measurement)       │
│ → Measure all valid candidates  │
│ → Pick best improvement         │
│ → Retry if none valid           │
└─────────────────────────────────┘
```

**Why this works**:
- LLM: Semantic understanding & creativity
- Code: Reliable constraint enforcement
- POVM: Quality measurement & selection

---

## 📊 Expected Results

| Metric | Current | Week 4 Baseline | GFS Target | Final Target (w/Hybrid) |
|--------|---------|-----------------|------------|-------------------------|
| Success Rate | 0% | 20% | **50-60%** | 60-70% |
| Text Change | 64% | 128% | **20-35%** | 20-30% |
| Coherence | 0.16 | 0.21 | **0.6+** | 0.65+ |
| Speed | 5.5s | 5.3s | ~6s (5 candidates) | ~3s (hybrid) |

---

## 📁 Key Files

**Analysis**:
- `WEEK5_LLM_TRANSFORMATION_ANALYSIS.md` - Full analysis (450 lines)

**Code to Modify**:
- `humanizer/services/transformation_engine.py` - Enhance LLMGuidedStrategy
- `humanizer/core/trm/transformer.py` - May need prompt adjustments for diversity

**Code to Create**:
- `humanizer/services/sentence_transformation.py` - Sentence-by-sentence logic

**Tests**:
- Update `test_improved_llm_prompts.py` with GFS tests

---

## 🚦 Next Actions (In Order)

1. **Implement GFS filtering** (1h)
   - Add `_filter_candidates()` method
   - Length, overlap, naturalness checks

2. **Implement GFS generation** (1h)
   - Modify `transform()` to generate N candidates
   - Add retry logic

3. **Implement GFS selection** (30min)
   - POVM measurement of valid candidates
   - Best selection logic

4. **Test on short texts** (30min)
   - Run existing test suite
   - Validate 50%+ success

5. **Implement sentence-by-sentence** (2-3h)
   - Sentence splitter
   - Context-aware transformation
   - Coherence verification

6. **Comprehensive testing** (1-2h)
   - Short/medium/long texts
   - Success criteria validation

---

## 💡 Key Insights for Implementation

1. **Don't trust LLM instructions** - Use code to enforce
2. **Temperature=0.9 for diversity** - Need varied candidates
3. **Reject and retry** - Better than accepting bad transformations
4. **Context matters** - Track previous 2 sentences
5. **Length-adaptive** - Different strategies for different text lengths

---

## ⚠️ Common Pitfalls

1. ❌ Generating only 1-2 candidates → Not enough diversity
2. ❌ Filtering too loosely → Accept bad transformations
3. ❌ No retry logic → Give up too early
4. ❌ Ignoring coherence across sentences → Broken narratives
5. ❌ Same prompt for all lengths → One-size-fits-all fails

---

## 🎯 Success Indicators

You'll know GFS is working when:
- ✅ Multiple candidates generated per transformation
- ✅ Most candidates rejected by filters (good - means constraints work!)
- ✅ Remaining candidates have <40% text change
- ✅ POVM measurements show clear winner among valid candidates
- ✅ Success rate >50% on test suite

---

## 📞 Questions to Consider

- How many candidates optimal? (Start with 5, may need 3-10)
- Should retry limit be 3? (Yes, but adjustable)
- What if NO candidates pass filters? (Retry with temperature=0.3, stricter prompt)
- When to fall back to rules? (After 3 failed retries)

---

**Ready to implement! Start with Phase 1 (GFS) in transformation_engine.py**
