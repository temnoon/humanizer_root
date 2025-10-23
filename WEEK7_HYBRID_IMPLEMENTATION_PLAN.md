# Week 7: Hybrid Rules + GFS - Implementation Plan

**Date**: Oct 22, 2025 (Ready for next session)
**Status**: 📋 Planning Complete - Ready to Implement
**Estimated Time**: 4-6 hours
**Target**: 40-50% success rate with cost reduction vs pure GFS

---

## 🎯 Mission

Implement Hybrid Architecture that combines:
- **Rule-based candidate generation** (fast, cheap, pattern-based)
- **LLM semantic diversity** (understanding, creativity)
- **GFS filtering & selection** (programmatic validation, POVM-based choice)

**Expected Outcome**: 40-50% success rate (vs 20-33% pure GFS, 3.3% pure rules)

---

## 📊 Success Criteria

| Metric | Target | Baseline (GFS) | Baseline (Rules) |
|--------|--------|----------------|------------------|
| Success Rate | 40-50% | 20-33% | 3.3% |
| Avg Improvement | >0.015 | +0.006-0.014 | +0.020 (1 sample) |
| Text Change | <40% | 38% | 0-53% |
| Coherence | >0.65 | 0.62-0.90 | 0.70-1.00 |
| Cost Reduction | 30-50% | Baseline | 100% (but fails) |
| Speed | 5-7s | ~10s | <1s |

**Key Success Indicator**: Achieve >35% success rate with >30% cost reduction

---

## 🏗️ Architecture Design

### Phase 1: Rule-Based Candidate Generator

**Component**: `RuleCandidateGenerator` class

**Responsibilities**:
- Load learned rules from `extracted_rules.json`
- Apply high-reliability patterns to generate candidates
- Return 5-10 diverse rule-based transformations per text

**Implementation**:
```python
class RuleCandidateGenerator:
    def __init__(self, rules_path: Path):
        self.rules = load_rules(rules_path)

    def generate_candidates(
        self,
        text: str,
        pack_name: str,
        target_axis: str,
        num_candidates: int = 8
    ) -> List[str]:
        """Generate rule-based transformation candidates."""
        # 1. Get rules for this axis
        # 2. Apply substitutions, removals, additions
        # 3. Return top N most promising candidates
```

**Strategy**:
- **High-reliability first**: Apply patterns with reliability='high' (2+ occurrences)
- **Combine patterns**: Try multiple rule combinations
- **Diversity**: Ensure candidates are different from each other
- **Fast**: No LLM calls, pure pattern matching

### Phase 2: Hybrid Transformation Strategy

**Component**: `HybridTransformationStrategy` class

**Responsibilities**:
- Orchestrate candidate generation from both sources
- Combine rule-based (5-10) + LLM (5) candidates
- Apply GFS filtering and selection
- Return best transformation

**Implementation**:
```python
class HybridTransformationStrategy(TransformationStrategy):
    def __init__(
        self,
        rank: int = 64,
        num_rule_candidates: int = 8,
        num_llm_candidates: int = 5,
        max_retries: int = 3
    ):
        self.rule_generator = RuleCandidateGenerator()
        self.llm_generator = LLMCandidateGenerator()
        self.gfs_selector = GFSSelector()

    def transform(self, context: TransformationContext) -> TransformationResult:
        """
        Hybrid transformation pipeline:
        1. Generate rule-based candidates (8 candidates, ~0.1s)
        2. Generate LLM candidates (5 candidates, ~5s)
        3. Combine and deduplicate (13 candidates total)
        4. Filter programmatically (GFS constraints)
        5. Select best via POVM measurement
        6. Retry if needed
        """
```

### Phase 3: Candidate Diversity & Deduplication

**Challenge**: Rule and LLM candidates may overlap

**Solution**: Diversity scoring
```python
def deduplicate_candidates(candidates: List[str], threshold: float = 0.9) -> List[str]:
    """Remove near-duplicate candidates using word overlap."""
    # Keep candidates with <90% word overlap
```

### Phase 4: GFS Filtering & Selection (Reuse from Week 5)

**Components** (already implemented):
- **Filter**: Length ±20%, overlap >60%, naturalness
- **Select**: POVM measurement, pick best improvement
- **Retry**: 3 attempts with stricter prompts

**Integration**: Use existing `_filter_candidates()` and `_select_best_candidate()`

---

## 📝 Implementation Steps (Detailed)

### Step 1: Design Hybrid Architecture (30 min)

**Tasks**:
- Define `RuleCandidateGenerator` interface
- Define `HybridTransformationStrategy` interface
- Plan candidate merging and deduplication strategy
- Document architecture diagram

**Deliverables**:
- Architecture diagram (text-based)
- Interface definitions (Python classes with docstrings)

### Step 2: Implement RuleCandidateGenerator (1.5-2h)

**File**: `humanizer/services/rule_candidate_generator.py` (~200 lines)

**Tasks**:
1. Load rules from `data/transformation_rules/extracted_rules.json`
2. Implement pattern application logic:
   - `_apply_substitutions()` - Replace word/phrase patterns
   - `_apply_removals()` - Remove high-reliability hedging words
   - `_apply_additions()` - Insert negations, qualifiers
3. Implement candidate diversity logic:
   - Try different rule combinations
   - Ensure candidates differ by >10% word overlap
4. Implement candidate ranking:
   - Prioritize high-reliability patterns
   - Score by number of patterns applied
   - Return top N candidates

**Test**:
```python
# Test on known examples from manual corpus
generator = RuleCandidateGenerator()
candidates = generator.generate_candidates(
    text="I think the main issue here is...",
    pack_name="tetralemma",
    target_axis="A",
    num_candidates=8
)
# Should return variants like:
# - "The main issue here is..." (remove "I think")
# - "I believe the main issue here is..." (substitute "think")
# etc.
```

### Step 3: Implement HybridTransformationStrategy (2-2.5h)

**File**: `humanizer/services/transformation_engine.py` (add ~250 lines)

**Tasks**:
1. Create `HybridTransformationStrategy` class
2. Integrate `RuleCandidateGenerator`
3. Reuse `LLMGuidedStrategy` for LLM candidate generation
4. Implement candidate merging:
   - Collect rule candidates (8)
   - Collect LLM candidates (5)
   - Deduplicate (keep ~10-12 unique)
5. Reuse GFS filtering and selection logic
6. Add retry logic with adjusted parameters
7. Add cost tracking (rule vs LLM candidate counts)

**Integration Points**:
- Use existing `_build_gfs_prompt()` for LLM generation
- Use existing `_filter_candidates()` for validation
- Use existing `_select_best_candidate()` for POVM selection

### Step 4: Implement Candidate Diversity Scoring (30 min)

**File**: Add to `rule_candidate_generator.py` or create `candidate_utils.py`

**Tasks**:
1. Implement `calculate_word_overlap()` - Measure similarity
2. Implement `deduplicate_candidates()` - Remove near-duplicates
3. Test with overlapping candidates

**Example**:
```python
candidates = [
    "The main issue here is...",  # Original
    "The main issue is...",       # Very similar (90% overlap) - REMOVE
    "The primary issue here is..."  # Different enough (70% overlap) - KEEP
]
unique = deduplicate_candidates(candidates, threshold=0.85)
```

### Step 5: Integration Testing (1h)

**File**: `test_hybrid_transformation.py` (~200 lines)

**Tasks**:
1. Create test suite with 10 diverse texts
2. Test on 3 axes (tetralemma/A, tetralemma/¬A, tone/analytical)
3. Run 30 transformation attempts (10 texts × 3 axes)
4. Measure metrics:
   - Success rate
   - Avg improvement
   - Text change
   - Coherence
   - Cost (LLM calls)
   - Speed (execution time)

**Test Structure**:
```python
def test_hybrid_vs_gfs():
    """Compare Hybrid to pure GFS baseline."""
    hybrid = HybridTransformationStrategy(num_rule_candidates=8, num_llm_candidates=5)
    gfs = LLMGuidedStrategy(num_candidates=10)

    # Run both on same test set
    # Compare: success rate, cost, speed
```

### Step 6: Performance Evaluation & Analysis (1-1.5h)

**File**: `evaluate_hybrid_performance.py` (~150 lines)

**Tasks**:
1. Run comprehensive evaluation (30+ transformations)
2. Compare to baselines:
   - Pure GFS (Week 5): 20-33% success
   - Pure Rules (Week 6): 3.3% success
3. Analyze candidate sources:
   - How many successful transformations came from rule candidates?
   - How many from LLM candidates?
   - Which source is more reliable?
4. Cost analysis:
   - Hybrid: ~5 LLM calls (vs 10 for pure GFS)
   - Expected: 50% cost reduction
5. Generate performance report

**Metrics to Track**:
```python
results = {
    "success_rate": 0.42,  # 42% (target: 40-50%)
    "avg_improvement": +0.018,
    "cost_reduction": 0.52,  # 52% fewer LLM calls
    "rule_candidate_success": 0.35,  # 35% of successes from rules
    "llm_candidate_success": 0.65,   # 65% of successes from LLM
}
```

### Step 7: Parameter Optimization (30-60 min, if time allows)

**Tasks**:
1. Test different candidate ratios:
   - 10 rules + 3 LLM
   - 8 rules + 5 LLM (baseline)
   - 5 rules + 8 LLM
2. Measure success rate vs cost for each
3. Find optimal balance

**Expected Finding**: 8 rules + 5 LLM is near-optimal (cost/performance tradeoff)

### Step 8: Documentation & Handoff (30-45 min)

**Tasks**:
1. Create `WEEK7_HYBRID_RESULTS.md` with:
   - What was built
   - Performance metrics
   - Comparison to baselines
   - Key findings
   - Next steps (if success rate <40%, what to improve)
2. Update `CLAUDE.md` with Week 7 status
3. Store in ChromaDB via memory agent

---

## 🎯 Expected Outcomes

### Optimistic Scenario (45% success)
- Rule candidates contribute 40% of successes
- LLM candidates contribute 60% of successes
- Combined: 45% success rate
- Cost reduction: 50%
- Validation: Hybrid > pure GFS

### Realistic Scenario (40% success)
- Rule candidates contribute 30% of successes
- LLM candidates contribute 70% of successes
- Combined: 40% success rate
- Cost reduction: 40%
- Validation: Hybrid ≥ pure GFS, significant cost savings

### Pessimistic Scenario (30% success)
- Rule candidates contribute 20% of successes
- LLM candidates contribute 80% of successes
- Combined: 30% success rate (comparable to GFS)
- Cost reduction: 30%
- Finding: Rules provide marginal benefit, but cost savings valuable

**Threshold for Success**: >35% success rate with >25% cost reduction

---

## 🔧 Key Implementation Considerations

### 1. Reuse Week 6 Infrastructure
- `RuleBasedTransformer` → `RuleCandidateGenerator`
- Change from "apply rules + validate" to "generate candidates from rules"
- Rules as generators, not validators

### 2. Reuse Week 5 GFS Components
- `_filter_candidates()` - Already implemented
- `_select_best_candidate()` - Already implemented
- `_build_gfs_prompt()` - For LLM generation

### 3. Minimize New Code
- RuleCandidateGenerator: ~200 lines
- HybridTransformationStrategy: ~250 lines
- Test/evaluation: ~350 lines
- **Total new code**: ~800 lines (vs ~1,500 in Week 6)

### 4. Focus on Integration
- Week 6 built tools (pattern extraction, rule application)
- Week 5 built GFS (filtering, selection)
- Week 7 **integrates** both

---

## 📁 Files to Create/Modify

### Create (4 new files, ~800 lines)
1. `humanizer/services/rule_candidate_generator.py` (~200 lines)
2. `test_hybrid_transformation.py` (~200 lines)
3. `evaluate_hybrid_performance.py` (~150 lines)
4. `WEEK7_HYBRID_RESULTS.md` (documentation)

### Modify (1 file, ~250 lines added)
1. `humanizer/services/transformation_engine.py` - Add `HybridTransformationStrategy`

**Total**: ~1,050 lines of new code + documentation

---

## 🚀 Quick Start (Next Session)

**When starting Week 7**:

1. **Read handoff** (auto-briefing from memory agent)
2. **Review plan** (this document)
3. **Start with Step 1** (Architecture design - 30 min)
4. **Implement systematically** (Steps 2-8)
5. **Target completion**: 4-6 hours

**First Task**: Design `RuleCandidateGenerator` interface and plan rule application strategy

---

## 💡 Key Success Factors

1. **Leverage existing code**: Week 5 GFS + Week 6 rules
2. **Focus on integration**: Don't rebuild, combine
3. **Test early**: Validate hybrid approach with small test set first
4. **Measure cost**: Track LLM calls for ROI analysis
5. **Document findings**: Whether success or failure, capture insights

---

## 📈 If Success Rate < 40%

**Fallback strategies** (Week 8):

1. **Increase LLM candidates**: 8 rules + 7 LLM (test if more LLM helps)
2. **Improve rule quality**: Larger corpus (50-100 examples), context-aware rules
3. **Two-stage generation**: LLM generates, then minimizes
4. **Ensemble approach**: Multiple LLM prompts, diverse strategies

**Threshold to abandon hybrid**: If success rate < 30% with >60% cost increase

---

**Status**: Week 7 plan complete and ready for implementation.

**Estimated time**: 4-6 hours

**Expected outcome**: 40-50% success rate with 30-50% cost reduction

---

**End of Week 7 Implementation Plan**
