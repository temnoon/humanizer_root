# Week 6: Corpus-Driven Rules - Results & Findings

**Date**: Oct 22, 2025
**Status**: ❌ Initial Approach Unsuccessful - Valuable Insights Gained
**Time**: ~3-4 hours

---

## 🎯 Mission

Implement corpus-driven transformation rules to achieve 50-60% success rate (vs 20-33% with GFS alone).

**Hypothesis**: Rules learned from successful transformations should generalize to new texts.
**Rationale**: Week 2 showed prototype-based learning (3 examples/axis) achieves excellent discrimination (d > 2.0).

---

## 📊 Results Summary

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Success Rate | 50-60% | **3.3%** | ❌ **Failed** |
| vs GFS Baseline | Improvement | **90% worse** | ❌ **Regression** |
| Rules Extracted | N/A | 5 axes, 23 patterns | ✅ Complete |
| Rule Application | N/A | Working correctly | ✅ Functional |

**Key Finding**: Simple rule-based transformations do NOT generalize well to POVM measurements, even when learned from successful examples.

---

## 🏗️ What Was Built

### 1. Transformation Corpus Collection

**Approach**:
- Created collection scripts to gather successful GFS transformations
- Hit API rate limits (50 req/min) with automated collection
- Manually created seed corpus from Week 5 test results

**Files**:
- `collect_successful_transformations.py` (full-scale, hit rate limits)
- `collect_minimal_corpus.py` (smaller version)
- `data/successful_transformations/manual_seed_corpus.json` (12 examples)

**Limitations**:
- Only 12 successful transformations collected
- Rate limiting prevented larger-scale collection
- Corpus focused on 3 axes (tetralemma/A, tetralemma/¬A, tone/analytical)

### 2. Pattern Extraction (350 lines)

**File**: `extract_transformation_patterns.py`

**What It Does**:
- Analyzes word-level diffs from successful transformations
- Groups patterns by pack/axis
- Identifies high-reliability substitutions, removals, additions
- Generates human-readable summary

**Patterns Identified**:

**tetralemma/A** (Affirmative):
- **Remove hedging** (high reliability): "I" (3x), "think" (2x), "could" (2x), "might" (2x)
- Avg improvement: +0.048 to +0.071

**tetralemma/¬A** (Negating):
- **Add negation** (high reliability): "not" (2x, +0.044 avg)
- **Substitute**: "should" → "should not" (2x, +0.044 avg)

**tone/analytical**:
- **Vague to specific**: "some" → "specific", "explore" → "analyze"
- **Technical terms**: "empirical" → "data-driven"

**Output**:
- `data/transformation_rules/extracted_rules.json` (machine-readable)
- `data/transformation_rules/rules_summary.md` (human-readable)

### 3. Rule-Based Transformer (275 lines)

**File**: `humanizer/services/rule_based_transformer.py`

**Architecture**:
- Loads learned rules from JSON
- Applies substitutions, removals, additions
- Validates each transformation with POVM measurements
- Returns best candidate that meets success criteria

**Features**:
- High-reliability rules prioritized
- Case-insensitive matching with word boundaries
- Smart negation insertion (after modals: should, could, etc.)
- Multi-word removal (e.g., "I think" removal)
- Text change validation (max 40%)
- POVM improvement validation (min 1%)

### 4. Evaluation Framework

**File**: `test_rule_based_transformer.py`

**Tests**:
- 10 diverse texts
- 3 axes (tetralemma/A, tetralemma/¬A, tone/analytical)
- 30 total transformation attempts

**Results**:
- Success: 1/30 (3.3%)
- Only success: "Maybe we should" → "Maybe we should not" (+0.020 improvement)
- tetralemma/A: 0% (0/10)
- tetralemma/¬A: 10% (1/10)
- tone/analytical: 0% (0/10)

---

## 🔬 Key Findings

### 1. Simple Rules Don't Generalize to POVM Readings

**Observation**: Word-level substitutions learned from successful examples do NOT consistently improve POVM readings on new texts.

**Why**:
- **Context matters**: "I think" removal works in some contexts but not others
- **Embeddings are non-linear**: Similar text changes produce different embedding shifts
- **POVM measurements are sensitive**: Small embedding changes can move readings in unexpected directions

**Example Failure**:
- Text: "I think the main issue..."
- Rule: Remove "I think" (learned from successful examples)
- Result: Text changed, but POVM reading decreased (improvement < 0.01)

### 2. GFS Superior Due to Candidate Generation + Selection

**Why GFS Works Better (20-33% vs 3.3%)**:
- Generates 10 diverse candidates with temperature=0.9
- **LLM understanding** of semantic shift (even if imperfect)
- POVM-based **selection** finds candidate that actually improves readings
- Combination of generation diversity + measurement-based selection

**Why Rules Fail**:
- Deterministic application (no diversity)
- No semantic understanding (just pattern matching)
- Single candidate per rule (no selection opportunity)

### 3. Week 2 Generalization ≠ Transformation Generalization

**Week 2 Operators**: d̄ = 2.235 (excellent) with 3 examples/axis
- **Task**: Discriminate between different semantic classes
- **Success**: Prototype-based learning works for classification

**Week 6 Rules**: 3.3% success with 12 examples
- **Task**: Generate transformations that improve readings
- **Failure**: Prototype-based learning does NOT work for generation

**Key Difference**: Classification (measure what IS) vs Generation (create what SHOULD BE)

### 4. Corpus Size Insufficient

**12 examples total**:
- tetralemma/A: 6 examples
- tetralemma/¬A: 3 examples
- tone/analytical: 2 examples

**Problems**:
- Patterns overfit to specific texts
- No coverage for diverse contexts
- Single examples (medium reliability) don't generalize

**Need**: 50-100 examples per axis minimum for robust patterns

---

## 💡 Insights for Future Work

### 1. Rules Alone Are Not Viable

**Conclusion**: Simple pattern-based rules cannot replace LLM-guided transformation.

**Evidence**:
- 3.3% success vs 20-33% for GFS
- Rules work in corpus examples but don't generalize
- POVM measurements too sensitive for deterministic rules

**Implication**: Need hybrid approach, not pure rules.

### 2. Hybrid Architecture Is the Path Forward

**Promising Approach** (not yet implemented):

**Rules as Candidate Generators** + **GFS Selection**:
1. Generate candidates via learned rules (fast, cheap, diverse)
2. Generate additional candidates via LLM (semantic understanding)
3. Filter programmatically (length, overlap, naturalness)
4. Select best via POVM measurement

**Expected Benefits**:
- Rules provide high-quality candidates (based on proven patterns)
- LLM adds semantic diversity
- GFS selection ensures POVM improvement
- Cost reduction (fewer LLM calls needed)

**Expected Performance**: 40-50% success (better than GFS alone)

### 3. Larger Corpus Required

**Current**: 12 examples (insufficient)
**Needed**: 50-100 examples per axis

**Challenges**:
- API rate limits (50 req/min)
- Cost of running GFS at scale
- Time to collect corpus (~2-4 hours for 100 examples)

**Solutions**:
- Rate-limited collection script (add delays)
- Batch processing with checkpoints
- Use existing test results from Week 5

### 4. Context-Aware Rules Needed

**Current Rules**: Word-level substitutions
**Problem**: Context-agnostic (remove "I think" everywhere)

**Better Approach**: Context-aware patterns
- **Sentence-initial** "I think" → remove (affirmative)
- **Mid-sentence** "I think" → keep (hedge is intentional)
- **With modal** "Maybe we should" → "We should" (affirmative)
- **With negation** "Maybe we should" → "We should not" (negating)

**Implementation**: Regex patterns with context lookahead/lookbehind

---

## 📈 Comparison to Week 5

| Aspect | Week 5 GFS | Week 6 Rules | Status |
|--------|------------|--------------|--------|
| Success Rate | 20-33% | 3.3% | ❌ **90% worse** |
| Avg Improvement | +0.006-0.014 | +0.020 | ⚠️ Higher (but only 1 success) |
| Text Change | 38% | 0% (for 1 success) | ✅ Better preservation |
| Cost | $$ (10 LLM calls/transform) | $ (no LLM) | ✅ Cheaper |
| Speed | Slow (~10s/transform) | Fast (<1s/transform) | ✅ Much faster |

**Net Assessment**: Rules are **faster and cheaper** but **90% less successful**. Not viable alone.

---

## 🚀 Recommended Next Steps

### Immediate (Week 7 - 4-6h)

**Option 1: Hybrid Rules + GFS** ← Recommended
- Implement rules as candidate generators
- Combine with LLM candidates
- Use GFS selection
- **Expected**: 40-50% success, cost reduction vs pure GFS

### Medium-term (Weeks 8-9 - 6-8h)

**Option 2: Context-Aware Rules**
- Add regex patterns with context matching
- Test sentence-initial vs mid-sentence patterns
- **Expected**: 20-30% success (rules alone)

**Option 3: Larger Corpus Collection**
- Implement rate-limited collection script
- Collect 50-100 examples per axis
- Re-extract patterns
- **Expected**: 15-25% success (rules alone)

### Long-term (Weeks 10+ - 10-15h)

**Option 4: Fine-Tuned LLM**
- Train on successful transformations
- Learn minimal change + POVM improvement objective
- **Expected**: 60-80% success

**Option 5: Reinforcement Learning**
- Use POVM improvement as reward signal
- Train policy to generate transformations
- **Expected**: 70-90% success (if feasible)

---

## 📁 Files Created/Modified

### Created (6 files, ~1,500 lines)
1. `collect_successful_transformations.py` (340 lines) - Full-scale collection script
2. `collect_minimal_corpus.py` (260 lines) - Minimal version
3. `data/successful_transformations/manual_seed_corpus.json` (140 lines) - 12 examples
4. `extract_transformation_patterns.py` (230 lines) - Pattern extraction
5. `humanizer/services/rule_based_transformer.py` (275 lines) - Rule-based transformer
6. `test_rule_based_transformer.py` (135 lines) - Evaluation script

### Generated (3 files)
7. `data/transformation_rules/extracted_rules.json` - Machine-readable rules
8. `data/transformation_rules/rules_summary.md` - Human-readable summary
9. `WEEK6_CORPUS_DRIVEN_RESULTS.md` (this file) - Complete findings

**Total**: ~1,500 lines of code + documentation

---

## ✅ Success Criteria - Final Assessment

| Criterion | Target | Actual | Status |
|-----------|--------|--------|--------|
| Corpus collection | Working script | ✅ 2 versions (hit rate limits) | **PARTIAL** |
| Pattern extraction | Identify patterns | ✅ 23 patterns across 5 axes | **COMPLETE** |
| Rule-based transformer | Implementation | ✅ Functional transformer | **COMPLETE** |
| Success rate | 50-60% | ❌ 3.3% | **FAILED** |
| vs GFS improvement | Better than 20-33% | ❌ 90% worse | **FAILED** |

**Overall**: **Infrastructure Complete, Performance Insufficient**

---

## 🎓 Lessons Learned

### 1. Classification ≠ Generation

Week 2's success with prototype-based learning (3 examples → d̄ = 2.235) does NOT transfer to transformation generation. Discriminating classes is fundamentally different from generating text that improves measurements.

### 2. POVM Measurements Are Non-Linear

Small text changes produce unpredictable embedding shifts. Word-level rules can't capture this complexity. Need semantic understanding (LLM) or extensive training data (fine-tuned model).

### 3. GFS Selection Is Critical

GFS works because it generates DIVERSE candidates and SELECTS the best. Rules lack diversity (deterministic). Hybrid approach (rules generate candidates, GFS selects) is the path forward.

### 4. Validate Early

Week 6 hypothesis was reasonable (prototype learning worked in Week 2). But testing revealed it doesn't generalize to generation tasks. Early validation prevented wasted effort on scaling inadequate approach.

---

## 🔜 Immediate Next Actions

**For next session** (recommended priority order):

1. **Implement Hybrid Rules + GFS** (4-6h)
   - Use rules as candidate generators (5-10 candidates)
   - Add LLM candidates (5 candidates)
   - Apply GFS filtering and selection
   - **Target**: 40-50% success

2. **Document Week 6 Findings** (1h)
   - Update CLAUDE.md with Week 6 status
   - Add hybrid approach to roadmap
   - Store findings in memory

3. **Expand Corpus** (2-3h, if time allows)
   - Implement rate-limited collection script
   - Collect 30-50 more examples
   - Re-extract patterns with larger corpus

---

**Status**: Week 6 infrastructure complete, but pure rule-based approach not viable. Hybrid Rules + GFS is recommended path forward.

**Time**: 3-4h actual vs 4-6h estimated ✅

**Recommendation**: Move to Hybrid Rules + GFS (Week 7) to combine benefits of both approaches.

---

**End of Week 6 Results**
