# Week 5 Phase 1: GFS Implementation Results

**Date**: Oct 22, 2025
**Status**: ✅ GFS Architecture Complete | ⚠️ Partial Success on Metrics
**Time**: ~3h (within 2-3h estimate)

---

## 🎯 Goal

Implement Generate-Filter-Select (GFS) architecture to improve LLM-guided transformations through programmatic constraint enforcement.

---

## 📊 Results

### Metrics Achieved

| Metric | Result | Target | Status |
|--------|--------|--------|--------|
| Success Rate | 20% | >50% | ❌ Below target |
| Avg Improvement | +0.006 | >0.01 | ⚠️ Close (positive!) |
| Avg Text Change | 37.95% | <40% | ✅ Met |
| Avg Coherence | 0.62 | >0.6 | ✅ Met |

### Comparison to Week 4 Baseline

| Metric | Week 4 LLM | Week 5 GFS | Change |
|--------|------------|------------|--------|
| Success Rate | 20% | 20% | = (same) |
| Avg Improvement | +0.022 | +0.006 | ↓ -0.016 |
| Avg Text Change | 128% | 38% | ✅ -90% |
| Avg Coherence | 0.21 | 0.62 | ✅ +0.41 |

**Key Win**: Text change reduced from 128% to 38% - **GFS programmatic constraints WORK!**

---

## ✅ What Was Built

### 1. GFS Architecture Implementation

**File**: `humanizer/services/transformation_engine.py`

**Components**:

1. **GENERATE** (lines 797-816):
   - Generate N candidates (default: 5) with temperature=0.9
   - Async generation loop
   - LLM called N times for diversity

2. **FILTER** (lines 800-806):
   - Programmatic constraint enforcement
   - Length check: ±20% of original
   - Word overlap: >60% identical
   - Naturalness: no excessive repetition
   - Code-based, NOT LLM-dependent

3. **SELECT** (lines 767-812):
   - POVM measurement of each valid candidate
   - Select candidate with best improvement
   - Returns None if no valid candidates

4. **RETRY** (lines 843-852):
   - Max 3 retry attempts
   - Stricter temperature on retry (0.7 vs 0.9)
   - Falls back if all retries fail

### 2. Prompt Engineering

**Axis Descriptions** (lines 710-760):
- Human-readable explanations of what each POVM axis means
- Examples:
  - `A` (tetralemma): "Remove hedging, use definite language"
  - `analytical` (tone): "Use precise terms, remove casual language"
  - `critical` (tone): "Question assumptions, point out problems"

**Improved Prompts** (lines 650-708):
- Clear axis guidance
- Explicit constraints (1-3 words, length ±20%)
- Good vs bad examples
- Emphasis on minimal change

### 3. Test Suite

**File**: `test_gfs_implementation.py` (155 lines)
- Tests 5 texts across 5 axes
- Validates all metrics (success, improvement, change, coherence)
- Comprehensive summary and target checking

---

## 🔍 Key Findings

### 1. Programmatic Constraints Work Perfectly

**Evidence**:
- Text change: 128% → 38% (70% reduction)
- Coherence: 0.21 → 0.62 (3x improvement)
- Filter correctly rejects candidates that violate constraints

**Example** (from debug output):
```
Generated 3 candidates
- Candidate 1: 93.33% overlap ✓ (accepted)
- Candidate 2: 86.67% overlap ✓ (accepted)
- Candidate 3: 80.00% overlap ✓ (accepted)
Filtered 3 → 3 valid candidates
```

### 2. LLM Struggles to Generate Good Candidates

**Problem**: Even with axis descriptions, the LLM often:
- Generates candidates that meet constraints but don't improve POVM readings
- Struggles with complex semantic shifts (e.g., "both" in tetralemma)
- Exhausts retries with NO valid candidates (Test 5: 15 seconds, 0% change)

**Example Failures**:
```
Test 2 (analytical):
- Original: "Maybe we should consider a different approach to this problem."
- Transformed: "Perhaps we should examine an alternative approach to this problem."
- Improvement: -0.007 (moved AWAY from analytical)

Test 5 (both):
- Original: "This could be a useful way to improve our understanding."
- Transformed: IDENTICAL (all candidates rejected)
- Time: 15 seconds (3 retries × 5 candidates = 15 candidates rejected)
```

### 3. Axis Descriptions Help, But Not Enough

**Tested Approaches**:
1. ❌ Simple corpus examples ("The sky is blue") - Too simple, unhelpful
2. ✅ Axis descriptions ("Remove hedging, use definite language") - Better, but still 20% success

**Why it's not enough**:
- LLM needs to understand HOW to minimally transform text, not just WHAT the target looks like
- Descriptions help with direction, but not with constraint satisfaction

### 4. Success Rate Bottleneck

**Root cause**: Most transformations move in WRONG direction (negative improvement)

**Distribution**:
- 1/5 tests: Positive improvement >0.01 (SUCCESS)
- 2/5 tests: Small negative improvement (<0.01)
- 1/5 tests: Large negative improvement (>0.03)
- 1/5 tests: No transformation (all candidates rejected)

---

## 🚧 Limitations & Issues

### 1. Week 4 Baseline Not Improved

**Issue**: Success rate still 20% (same as Week 4 LLM-only)
**Root Cause**: GFS filters OUT bad candidates (good!), but LLM doesn't generate ENOUGH good ones
**Implication**: Need better candidate generation, not just better filtering

### 2. Some Axes Harder Than Others

**Easiest** (positive improvements):
- `A` (tetralemma): +0.016 improvement, 14% change ✓

**Hardest** (negative or zero):
- `both` (tetralemma): 0.000 improvement, 0% change (all rejected)
- `critical` (tone): -0.002 improvement

**Why**: Some semantic shifts are harder to express in 1-3 word changes

### 3. Retry Logic Not Helping

**Observation**: Retries generate more candidates, but they're also rejected
**Example**: Test 5 exhausted 15 candidates (3 retries × 5) with 0 valid

**Implication**: Need smarter retry strategy (e.g., different prompts, not just lower temperature)

---

## 📈 Next Steps (Per Week 5 Plan)

### Option A: Continue Week 5 Plan

**Phase 2: Sentence-by-Sentence** (2-3h)
- Might help with longer texts
- Won't fix fundamental candidate generation issue
- **Recommendation**: Skip for now, focus on improving success rate first

**Phase 3: Comprehensive Testing** (2-3h)
- Validate on more texts
- Identify which axes/text types work best
- **Recommendation**: Do AFTER improving success rate

### Option B: Improve Candidate Generation

**Approaches to try**:
1. **More candidates** (5 → 10): Brute force, increases success probability
2. **Better prompts**: Show transformation EXAMPLES (before → after), not just target style
3. **Two-stage generation**: Generate freely, then ask LLM to self-filter
4. **Corpus mining**: Learn which word substitutions work, provide as examples

**Time estimate**: 1-2h per approach

### Option C: Hybrid Redesign (Week 5 Priority 2)

**Idea**: Amplification mode - rules + LLM refinement
- Rules make initial transformation
- LLM refines with GFS
- **Recommendation**: Do AFTER fixing LLM-only success rate

---

## 💡 Key Insights

1. **Programmatic constraints are essential** - Reduced text change 70%, improved coherence 3x
2. **Prompt engineering has limits** - Even with axis descriptions, LLM still struggles
3. **Filtering works, generation doesn't** - Need to improve GENERATE step, not FILTER
4. **Some axes are intrinsically harder** - "both" (tetralemma) may be too complex for 1-3 word changes
5. **Success is binary** - Either +0.01 improvement (success) or negative/zero (fail), not much middle ground

---

## 🎯 Recommendations

### Immediate (1-2h)

**Try**: Increase num_candidates to 10-15
- **Rationale**: If 1/5 candidates is good on average, 10-15 candidates → 2-3 good ones
- **Cost**: 2-3x more API calls, but still acceptable for testing
- **Expected**: 40-50% success rate (from 20%)

### Short-term (2-4h)

**Try**: Transformation examples in prompt
- **Approach**: Show before→after pairs from successful transformations
- **Example**: "I think X" → "X is the case" (removed hedging, +0.05 analytical)
- **Expected**: 50-60% success rate

### Medium-term (4-6h)

**Implement**: Corpus-driven rules (Week 5 Priority 3)
- Mine patterns from successful GFS transformations
- Learn which word replacements work for each axis
- Use as fallback or primary strategy

---

## 📁 Files Created/Modified

**Created**:
- `test_gfs_implementation.py` (~155 lines) - Test suite

**Modified**:
- `humanizer/services/transformation_engine.py`:
  - `LLMGuidedStrategy.__init__()` - Added GFS parameters (lines 609-625)
  - `_filter_candidates()` - Programmatic filtering (lines 800-806)
  - `_select_best_candidate()` - POVM-based selection (lines 767-812)
  - `transform()` - GFS main loop (lines 814-970)
  - `_build_gfs_prompt()` - Prompt generation (lines 650-708)
  - `_get_axis_description()` - Axis explanations (lines 710-760)
  - `_assess_coherence()` - Coherence heuristic (lines 756-798)

**Total Changes**: ~400 lines added/modified

---

## ✅ Success Criteria Met

1. ✅ GFS architecture implemented and functional
2. ✅ Programmatic constraints reduce text change to <40%
3. ✅ Coherence improved to >0.6
4. ⚠️ Success rate 20% (target: >50%) - **NOT MET**
5. ⚠️ Improvement +0.006 (target: >0.01) - **NOT MET**

**Overall**: **Partial success** - Architecture works, but needs more tuning to hit success targets.

---

**End of Phase 1 Report**
