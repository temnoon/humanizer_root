# Week 7: Hybrid Rules + GFS - Architecture Design

**Date**: Oct 22, 2025
**Status**: Design Phase Complete ✅
**Time**: 30 minutes

---

## 🎯 Design Goals

1. **Combine strengths**: Rules (speed/cost) + LLM (semantic understanding) + GFS (selection)
2. **Reuse infrastructure**: Week 6 rules + Week 5 GFS components
3. **Target performance**: 40-50% success rate, 30-50% cost reduction vs pure GFS
4. **Minimize new code**: Focus on integration, not rebuilding

---

## 📐 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     HybridTransformationStrategy                    │
│                                                                     │
│  Input: text, pack_name, target_axis                               │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 1. GENERATE CANDIDATES (Parallel)                             │ │
│  │                                                                │ │
│  │  ┌──────────────────────┐      ┌──────────────────────┐      │ │
│  │  │ RuleCandidateGen     │      │ LLMCandidateGen      │      │ │
│  │  │                      │      │                      │      │ │
│  │  │ - Load rules for axis│      │ - Build GFS prompt   │      │ │
│  │  │ - Apply substitutions│      │ - Call Anthropic API │      │ │
│  │  │ - Apply removals     │      │ - Parse N candidates │      │ │
│  │  │ - Apply additions    │      │ - Temperature = 0.9  │      │ │
│  │  │ - Ensure diversity   │      │                      │      │ │
│  │  │                      │      │                      │      │ │
│  │  │ Output: 8 candidates │      │ Output: 5 candidates │      │ │
│  │  │ Time: ~0.1s          │      │ Time: ~5s            │      │ │
│  │  │ Cost: $0             │      │ Cost: $$             │      │ │
│  │  └──────────────────────┘      └──────────────────────┘      │ │
│  │            │                              │                   │ │
│  │            └──────────────┬───────────────┘                   │ │
│  │                           ▼                                   │ │
│  │                   [13 raw candidates]                         │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                               │                                     │
│  ┌────────────────────────────▼──────────────────────────────────┐ │
│  │ 2. DEDUPLICATE (Word Overlap Filtering)                       │ │
│  │                                                                │ │
│  │  - Calculate pairwise word overlap                            │ │
│  │  - Remove near-duplicates (>85% overlap)                      │ │
│  │  - Preserve diversity                                          │ │
│  │                                                                │ │
│  │  Output: ~10-12 unique candidates                             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                               │                                     │
│  ┌────────────────────────────▼──────────────────────────────────┐ │
│  │ 3. FILTER (Programmatic Constraints - Week 5 GFS)             │ │
│  │                                                                │ │
│  │  - Length check: ±20% of original                             │ │
│  │  - Overlap check: >60% word overlap                           │ │
│  │  - Naturalness check: No artifacts, proper grammar            │ │
│  │  - POVM sanity: Not identical reading                         │ │
│  │                                                                │ │
│  │  Output: 5-8 valid candidates                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                               │                                     │
│  ┌────────────────────────────▼──────────────────────────────────┐ │
│  │ 4. SELECT (POVM-Based - Week 5 GFS)                           │ │
│  │                                                                │ │
│  │  - Measure each candidate: embed → ρ → POVM reading           │ │
│  │  - Calculate improvement: reading_after - reading_before      │ │
│  │  - Pick best candidate (highest improvement)                  │ │
│  │  - Verify: improvement >= min_threshold (0.01)                │ │
│  │                                                                │ │
│  │  Output: Best transformation or None                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                               │                                     │
│  ┌────────────────────────────▼──────────────────────────────────┐ │
│  │ 5. RETRY (If Needed, Max 3 Attempts)                          │ │
│  │                                                                │ │
│  │  - Adjust parameters: stricter constraints, more LLM cands    │ │
│  │  - Repeat steps 1-4                                            │ │
│  │  - Track retry count, abort if max reached                    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Output: TransformationResult (success, transformed_text, metrics) │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Component 1: RuleCandidateGenerator

### Interface

```python
from typing import List, Dict, Optional
from pathlib import Path
from dataclasses import dataclass

@dataclass
class RuleCandidate:
    """A single candidate generated by rule application."""
    text: str
    rule_description: str
    patterns_applied: List[str]  # e.g., ["remove:I", "remove:think"]
    confidence: float  # Based on rule reliability (high=1.0, medium=0.5)


class RuleCandidateGenerator:
    """
    Generates transformation candidates using learned patterns.

    Strategy:
    - Apply high-reliability patterns first
    - Combine multiple patterns for diversity
    - Ensure candidates differ by >10% word overlap
    - Fast: No LLM calls, pure pattern matching
    """

    def __init__(
        self,
        rules_path: Path = None,
        min_reliability: str = "medium"  # "high" or "medium"
    ):
        """
        Initialize with learned rules.

        Args:
            rules_path: Path to extracted_rules.json
            min_reliability: Minimum rule reliability ("high" or "medium")
        """
        if rules_path is None:
            rules_path = Path("data/transformation_rules/extracted_rules.json")

        self.rules = self._load_rules(rules_path)
        self.min_reliability = min_reliability

    def generate_candidates(
        self,
        text: str,
        pack_name: str,
        target_axis: str,
        num_candidates: int = 8
    ) -> List[RuleCandidate]:
        """
        Generate rule-based transformation candidates.

        Args:
            text: Original text to transform
            pack_name: POVM pack name (e.g., "tetralemma")
            target_axis: Target axis (e.g., "A", "¬A")
            num_candidates: Target number of candidates (default 8)

        Returns:
            List of RuleCandidate objects, sorted by confidence

        Strategy:
        1. Get rules for this pack/axis
        2. Apply single-pattern transformations (substitutions, removals, additions)
        3. Apply multi-pattern combinations (e.g., remove "I" + remove "think")
        4. Ensure diversity (>10% word overlap difference)
        5. Return top N candidates by confidence
        """
        pass  # Implementation in Step 2

    def _apply_substitution(self, text: str, from_phrase: str, to_phrase: str) -> str:
        """Apply word/phrase substitution (case-insensitive, word boundaries)."""
        pass

    def _apply_removal(self, text: str, word: str) -> str:
        """Remove word from text (case-insensitive, preserve spacing)."""
        pass

    def _apply_addition(self, text: str, word: str, position: str = "auto") -> str:
        """
        Add word to text intelligently.

        Args:
            position: "auto" (smart insertion), "before_verb", "after_modal", etc.
        """
        pass

    def _calculate_diversity(self, candidates: List[str]) -> List[str]:
        """
        Filter candidates to ensure diversity (>10% word overlap difference).

        Returns:
            Filtered list with diverse candidates only
        """
        pass

    def _load_rules(self, rules_path: Path) -> Dict:
        """Load rules from JSON file."""
        pass
```

### Key Design Decisions

1. **Confidence scoring**: High-reliability rules (2+ occurrences) = 1.0, medium (1 occurrence) = 0.5
2. **Pattern combinations**: Try both single patterns and combinations (e.g., remove "I" alone vs remove "I" + "think")
3. **Diversity enforcement**: Candidates must differ by >10% word overlap
4. **Fast execution**: Target <0.1s for 8 candidates (no LLM, pure pattern matching)

---

## 🔧 Component 2: HybridTransformationStrategy

### Interface

```python
from typing import Optional, List, Tuple
from dataclasses import dataclass
from humanizer.core.trm.transformer import TransformationContext, TransformationResult


@dataclass
class HybridMetrics:
    """Metrics for hybrid transformation."""
    num_rule_candidates: int
    num_llm_candidates: int
    num_after_dedup: int
    num_after_filter: int
    best_candidate_source: str  # "rule" or "llm"
    total_time: float
    llm_cost: float  # Estimated cost in dollars


class HybridTransformationStrategy:
    """
    Hybrid transformation strategy combining rules and LLM.

    Architecture:
    1. Generate rule-based candidates (8 candidates, ~0.1s, $0)
    2. Generate LLM candidates (5 candidates, ~5s, $$)
    3. Deduplicate (remove >85% overlap)
    4. Filter programmatically (GFS constraints from Week 5)
    5. Select best via POVM measurement
    6. Retry if needed (max 3 attempts)
    """

    def __init__(
        self,
        rank: int = 64,
        num_rule_candidates: int = 8,
        num_llm_candidates: int = 5,
        dedup_threshold: float = 0.85,  # Word overlap threshold
        max_retries: int = 3,
        min_improvement: float = 0.01,
        max_text_change: float = 0.4
    ):
        """
        Initialize hybrid strategy.

        Args:
            rank: Rank for density matrices
            num_rule_candidates: Number of rule-based candidates to generate
            num_llm_candidates: Number of LLM candidates to generate
            dedup_threshold: Word overlap threshold for deduplication (0.85 = 85%)
            max_retries: Maximum retry attempts
            min_improvement: Minimum POVM improvement required
            max_text_change: Maximum text change allowed
        """
        self.rank = rank
        self.num_rule_candidates = num_rule_candidates
        self.num_llm_candidates = num_llm_candidates
        self.dedup_threshold = dedup_threshold
        self.max_retries = max_retries
        self.min_improvement = min_improvement
        self.max_text_change = max_text_change

        # Initialize components
        self.rule_generator = RuleCandidateGenerator()
        self.embedding_service = get_sentence_embedding_service()
        self.semantic_packs = load_all_operators()
        self.llm_client = anthropic.Anthropic()

    def transform(
        self,
        context: TransformationContext
    ) -> Tuple[TransformationResult, HybridMetrics]:
        """
        Transform text using hybrid approach.

        Args:
            context: Transformation context (text, pack, axis, etc.)

        Returns:
            (TransformationResult, HybridMetrics)

        Pipeline:
        1. Generate rule candidates (fast)
        2. Generate LLM candidates (slow but semantic)
        3. Deduplicate combined candidates
        4. Filter programmatically (Week 5 GFS)
        5. Select best via POVM
        6. Retry if needed
        """
        pass  # Implementation in Step 3

    def _generate_rule_candidates(
        self,
        text: str,
        pack_name: str,
        target_axis: str
    ) -> List[Tuple[str, str]]:
        """
        Generate rule-based candidates.

        Returns:
            List of (candidate_text, source_description) tuples
        """
        pass

    def _generate_llm_candidates(
        self,
        text: str,
        pack_name: str,
        target_axis: str,
        reading_before: float,
        attempt: int = 1
    ) -> List[Tuple[str, str]]:
        """
        Generate LLM candidates using GFS prompt (Week 5).

        Returns:
            List of (candidate_text, source_description) tuples
        """
        pass

    def _deduplicate_candidates(
        self,
        candidates: List[Tuple[str, str]],
        threshold: float = 0.85
    ) -> List[Tuple[str, str]]:
        """
        Remove near-duplicate candidates based on word overlap.

        Args:
            candidates: List of (text, source) tuples
            threshold: Overlap threshold (0.85 = 85% word overlap)

        Returns:
            Filtered list with unique candidates
        """
        pass

    def _filter_candidates(
        self,
        candidates: List[str],
        original_text: str,
        reading_before: float,
        pack_name: str,
        target_axis: str
    ) -> List[str]:
        """
        Filter candidates programmatically (Week 5 GFS logic).

        Constraints:
        - Length: ±20% of original
        - Overlap: >60% word overlap
        - Naturalness: No artifacts
        - POVM: Not identical reading

        Returns:
            Valid candidates only
        """
        pass

    def _select_best_candidate(
        self,
        candidates: List[str],
        original_text: str,
        pack_name: str,
        target_axis: str,
        reading_before: float
    ) -> Optional[Tuple[str, float, str]]:
        """
        Select best candidate via POVM measurement (Week 5 GFS logic).

        Returns:
            (best_text, improvement, source) or None if no valid candidate
        """
        pass

    def _calculate_word_overlap(self, text1: str, text2: str) -> float:
        """Calculate word overlap ratio (0-1)."""
        pass

    def _measure_povm(self, text: str, pack_name: str, target_axis: str) -> float:
        """Measure POVM reading for specific axis."""
        pass
```

### Key Design Decisions

1. **Parallel candidate generation**: Could generate rule and LLM candidates in parallel (future optimization)
2. **Deduplication before filtering**: Reduces POVM measurements (expensive)
3. **Track candidate source**: Know if success came from rule or LLM (for analysis)
4. **Reuse Week 5 GFS**: `_filter_candidates()` and `_select_best_candidate()` logic
5. **Configurable ratios**: Easy to tune num_rule_candidates vs num_llm_candidates

---

## 🔄 Component 3: Candidate Deduplication

### Strategy

**Problem**: Rule and LLM candidates may overlap (e.g., both remove "I think")

**Solution**: Word overlap-based deduplication

```python
def deduplicate_candidates(
    candidates: List[Tuple[str, str]],  # (text, source)
    threshold: float = 0.85
) -> List[Tuple[str, str]]:
    """
    Remove near-duplicate candidates using word overlap.

    Algorithm:
    1. Calculate pairwise word overlap for all candidates
    2. If overlap > threshold (85%), keep only first occurrence
    3. Preserve candidate source metadata

    Example:
    - Candidate A: "The main issue here is..." (rule: remove "I think")
    - Candidate B: "The main issue is..." (LLM generation)
    - Overlap: 90% → Remove Candidate B (keep A, it came first)

    Returns:
        Unique candidates with <threshold overlap
    """
    unique_candidates = []

    for candidate, source in candidates:
        is_duplicate = False

        for existing, _ in unique_candidates:
            overlap = calculate_word_overlap(candidate, existing)
            if overlap > threshold:
                is_duplicate = True
                break

        if not is_duplicate:
            unique_candidates.append((candidate, source))

    return unique_candidates


def calculate_word_overlap(text1: str, text2: str) -> float:
    """
    Calculate word overlap ratio (0-1).

    Formula: overlap = |words1 ∩ words2| / max(|words1|, |words2|)

    Example:
    - text1: "The main issue here is clear"  (6 words)
    - text2: "The main issue is clear"        (5 words)
    - Intersection: 5 words
    - Overlap: 5 / 6 = 0.833 (83.3%)
    """
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())

    if not words1 or not words2:
        return 0.0

    intersection = len(words1 & words2)
    max_length = max(len(words1), len(words2))

    return intersection / max_length
```

### Key Design Decisions

1. **Threshold = 85%**: Balance between removing duplicates and preserving diversity
2. **Order matters**: Keep first occurrence (rules come first, so rule candidates prioritized)
3. **Simple algorithm**: O(n²) but n is small (~13 candidates)
4. **Preserve source**: Track whether candidate came from rule or LLM (for analysis)

---

## 🔗 Integration with Week 5 GFS

### Reusable Components from Week 5

From `humanizer/services/transformation_engine.py` (LLMGuidedStrategy):

**1. GFS Prompt Building** (Reuse directly):
```python
def _build_gfs_prompt(
    text: str,
    pack_name: str,
    target_axis: str,
    reading_before: float,
    num_candidates: int,
    attempt: int = 1
) -> str:
    """
    Build GFS prompt for LLM candidate generation.

    Already implemented in Week 5 - reuse as-is.
    """
    pass  # Use existing implementation
```

**2. Programmatic Filtering** (Reuse directly):
```python
def _filter_candidates(
    candidates: List[str],
    original_text: str,
    reading_before: float,
    pack_name: str,
    target_axis: str
) -> List[str]:
    """
    Filter candidates programmatically.

    Constraints:
    - Length: ±20% of original
    - Overlap: >60% word overlap
    - Naturalness: No [TRANSFORM], artifacts
    - POVM: Not identical reading

    Already implemented in Week 5 - reuse as-is.
    """
    pass  # Use existing implementation
```

**3. POVM-Based Selection** (Reuse directly):
```python
def _select_best_candidate(
    candidates: List[str],
    original_text: str,
    pack_name: str,
    target_axis: str,
    reading_before: float
) -> Optional[Tuple[str, float]]:
    """
    Select best candidate via POVM measurement.

    Returns:
        (best_text, improvement) or None

    Already implemented in Week 5 - reuse as-is.
    """
    pass  # Use existing implementation
```

### What's New in Hybrid

Only these components are NEW:
1. **RuleCandidateGenerator** - Generate candidates from learned patterns
2. **Candidate merging** - Combine rule + LLM candidates
3. **Deduplication** - Remove near-duplicates before filtering
4. **Source tracking** - Know which candidate source produced success

Everything else (prompt building, filtering, selection, retry) is **reused from Week 5**.

---

## 📊 Expected Data Flow

### Example Transformation

**Input**:
- Text: "I think the main issue here is that we're not defining goals."
- Pack: "tetralemma"
- Axis: "A" (affirmative)
- Reading before: 0.42

**Step 1: Generate Rule Candidates** (~0.1s):
1. "The main issue here is that we're not defining goals." (remove "I think")
2. "I believe the main issue here is that we're not defining goals." (substitute "think" → "believe")
3. "The issue here is that we're not defining goals." (remove "I think the")
4. "The main issue is that we're not defining goals." (remove "I think", "here")
5. "I assert the main issue here is that we're not defining goals." (substitute "think" → "assert")
6. "The primary issue here is that we're not defining goals." (remove "I think", add "primary")
7. "The main issue concerns our failure to define goals." (complex: remove hedge + rephrase)
8. "The issue is that we're not defining goals." (aggressive removal)

**Step 2: Generate LLM Candidates** (~5s):
1. "The main issue is our failure to clearly define goals."
2. "We are not defining our goals, which is the primary issue."
3. "The central problem is the lack of goal definition."
4. "Our main issue: we don't define goals clearly."
5. "The key problem is inadequate goal definition."

**Step 3: Deduplicate** (13 → 11 candidates):
- Remove: Rule #4 and LLM #2 are too similar to Rule #1
- Keep: 11 unique candidates

**Step 4: Filter** (11 → 7 candidates):
- Remove: Rule #7 (too different, 45% text change)
- Remove: Rule #8 (too short, -25% length)
- Remove: LLM #3 (60% overlap, borderline)
- Remove: LLM #4 (has colon, naturalness issue)
- Keep: 7 valid candidates

**Step 5: Select Best**:
- Measure POVM for each candidate
- Candidate readings: [0.48, 0.51, 0.46, 0.49, 0.50, 0.47, 0.52]
- Best: LLM #5 "The key problem is inadequate goal definition." (+0.10 improvement)
- Source: "llm"

**Output**:
- Success: True
- Transformed: "The key problem is inadequate goal definition."
- Improvement: +0.10
- Source: "llm"
- Metrics: 8 rule + 5 LLM → 11 dedup → 7 filter → 1 selected

---

## 📈 Success Metrics

### Target Performance

| Metric | Target | Pure GFS (Week 5) | Expected Hybrid |
|--------|--------|-------------------|-----------------|
| Success Rate | 40-50% | 20-33% | **40-50%** ✅ |
| Avg Improvement | >0.015 | +0.006-0.014 | **+0.015-0.020** ✅ |
| Cost Reduction | 30-50% | Baseline ($10/transform) | **$5-7/transform** ✅ |
| Speed | 5-7s | ~10s | **5-7s** ✅ |
| Text Change | <40% | 38% | **<40%** ✅ |

### Why Hybrid Should Win

**1. More Candidates**: 13 initial (8 rule + 5 LLM) vs 10 (pure GFS)
- More chances to find good transformation
- Diversity from both sources

**2. High-Quality Rule Candidates**: Based on proven patterns
- tetralemma/A: Remove "I think" (3x success in corpus)
- tetralemma/¬A: Add "not" (2x success in corpus)
- Rules encode successful transformations

**3. LLM Semantic Understanding**: Still present
- Handles complex cases rules can't
- Provides semantic diversity

**4. GFS Selection**: Proven to work
- POVM measurement finds what actually improves
- Programmatic filtering prevents garbage

**5. Cost Reduction**: 5 LLM candidates vs 10
- 50% fewer API calls
- Rule candidates are free

---

## 🔄 Retry Strategy

### When to Retry

Retry if:
1. No candidates pass filter (all violate constraints)
2. Best candidate improvement < min_threshold (0.01)
3. Best candidate reading actually decreases

### Retry Adjustments (Attempt-Based)

**Attempt 1** (baseline):
- num_rule_candidates: 8
- num_llm_candidates: 5
- max_text_change: 0.4

**Attempt 2** (looser constraints):
- num_rule_candidates: 8
- num_llm_candidates: 7 (more LLM diversity)
- max_text_change: 0.45 (slightly looser)

**Attempt 3** (aggressive LLM):
- num_rule_candidates: 5 (fewer rules)
- num_llm_candidates: 10 (pure LLM focus)
- max_text_change: 0.5 (accept more change)

**Max retries**: 3 attempts total

---

## 📁 File Structure

### New Files (Step 2-3)

```
humanizer/services/
├── rule_candidate_generator.py  (~200 lines, Step 2)
│   ├── RuleCandidateGenerator class
│   ├── RuleCandidate dataclass
│   └── Pattern application methods
│
└── transformation_engine.py  (modify, +~250 lines, Step 3)
    ├── HybridTransformationStrategy class (NEW)
    ├── HybridMetrics dataclass (NEW)
    └── Reuse: _filter_candidates, _select_best_candidate (Week 5)
```

### Reused Infrastructure

**From Week 6**:
- `data/transformation_rules/extracted_rules.json` (23 patterns)
- Pattern application logic (substitutions, removals, additions)

**From Week 5**:
- `_build_gfs_prompt()` - LLM prompt construction
- `_filter_candidates()` - Programmatic filtering
- `_select_best_candidate()` - POVM-based selection
- Retry logic and thresholds

---

## ✅ Design Phase Complete

### Deliverables

1. ✅ **RuleCandidateGenerator interface** - Defined with 8 methods
2. ✅ **HybridTransformationStrategy interface** - Defined with 10 methods
3. ✅ **Deduplication strategy** - Word overlap-based (85% threshold)
4. ✅ **Architecture diagram** - Complete data flow
5. ✅ **Integration plan** - Reuse Week 5 GFS components
6. ✅ **Success metrics** - 40-50% target with cost reduction

### Next Steps

**Step 2**: Implement RuleCandidateGenerator (1.5-2h)
- File: `humanizer/services/rule_candidate_generator.py`
- ~200 lines of code
- Test on known examples from manual corpus

---

**End of Architecture Design**
