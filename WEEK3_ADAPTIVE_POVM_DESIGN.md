# Week 3: Adaptive POVM System Design

**Date**: October 22, 2025
**Goal**: Enable archive-specific POVM operators that adapt to target corpus characteristics
**Rationale**: Different archives (ChatGPT, Discourse, academic papers) have different semantic distributions

---

## 🎯 Core Problem

**Current State (Week 2)**:
- Static semantic operators learned from seed corpus (3 examples per axis)
- One-size-fits-all: Same operators for all archives
- Blind to archive characteristics

**Production Requirement**:
- Archives vary: ChatGPT convos ≠ Discourse forums ≠ academic papers
- Need to evaluate: "Do these operators work well on THIS archive?"
- Need to adapt: Learn archive-specific operators when appropriate
- Need to validate: Prove new operators discriminate better

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Adaptive POVM System                          │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │   Archive    │    │   Corpus     │    │  Adaptive    │
  │   Analyzer   │    │   Sampler    │    │  Learner     │
  └──────────────┘    └──────────────┘    └──────────────┘
          │                   │                   │
          │                   │                   │
  Evaluate current     Sample texts        Learn new
  operators on         from archive        operators
  archive              per axis            from corpus
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                              ▼
                      ┌──────────────┐
                      │  Validation  │
                      │  Framework   │
                      └──────────────┘
                              │
                      Compare operators:
                      Static vs Archive-Specific
                              │
                              ▼
                      ┌──────────────┐
                      │Transformation│
                      │   Engine     │
                      └──────────────┘
                      Uses best operators
                      for this archive
```

---

## 📦 Component 1: Archive Analyzer

**Purpose**: Evaluate if current operators are appropriate for target archive

**File**: `humanizer/services/archive_analyzer.py` (~300 lines)

### API

```python
@dataclass
class ArchiveAnalysisResult:
    """Results of archive analysis."""
    archive_name: str
    sample_size: int

    # Per-pack metrics
    pack_metrics: Dict[str, PackMetrics]

    # Overall assessment
    overall_score: float  # 0-1, higher is better
    recommendation: str  # "keep", "retrain_weak", "retrain_all"
    weak_operators: List[str]  # Operators with d < 0.5

    # Detailed report
    report: str  # Human-readable markdown

@dataclass
class PackMetrics:
    """Metrics for a POVM pack on archive."""
    pack_name: str

    # Per-operator metrics
    operator_metrics: Dict[str, OperatorMetrics]

    # Pack-level metrics
    average_discrimination: float  # Mean Cohen's d
    coverage: float  # 0-1, how well axes span the archive
    sum_to_identity_error: float  # Frobenius norm

@dataclass
class OperatorMetrics:
    """Metrics for a single operator on archive."""
    operator_name: str
    cohens_d: float  # Effect size (separation)
    variance: float  # Should be ~0 for semantic operators
    high_scorers: List[str]  # Sample texts that score high
    low_scorers: List[str]  # Sample texts that score low

async def analyze_archive(
    session: AsyncSession,
    archive_name: str,
    operators: Dict[str, SemanticPOVMPack],
    sample_size: int = 200,
    embedding_service: Optional[Any] = None,
) -> ArchiveAnalysisResult:
    """
    Analyze how well operators work on target archive.

    Process:
    1. Sample N texts from archive (stratified by conversation)
    2. Measure each text with all operators
    3. Compute discrimination metrics (Cohen's d)
    4. Compute coverage (semantic space utilization)
    5. Generate report with recommendations

    Args:
        session: Database session
        archive_name: Archive identifier (e.g., "chatgpt")
        operators: Current semantic operators to evaluate
        sample_size: Number of texts to sample
        embedding_service: Optional, creates if not provided

    Returns:
        ArchiveAnalysisResult with metrics and recommendations
    """
```

### Discrimination Metric

**Cohen's d** - Measures separation between high/low scorers:

```python
def compute_discrimination(
    readings: List[float],
    threshold_percentile: float = 75.0
) -> float:
    """
    Compute Cohen's d for operator discrimination.

    Split readings at threshold_percentile (e.g., 75th = top quartile).
    High group: readings >= threshold
    Low group: readings < threshold

    Cohen's d = (mean_high - mean_low) / pooled_std

    Interpretation:
    - d > 0.8: Large effect (excellent discrimination)
    - d > 0.5: Medium effect (acceptable)
    - d > 0.2: Small effect (weak)
    - d < 0.2: Negligible (poor discrimination)
    """
```

### Coverage Metric

**Semantic space utilization**:

```python
def compute_coverage(
    readings_per_axis: Dict[str, List[float]]
) -> float:
    """
    Measure how well archive texts span the semantic space.

    Coverage = (# axes with readings > 0.5) / total_axes

    If coverage < 0.5: Archive may not match axes well
    If coverage > 0.8: Good semantic diversity
    """
```

### Report Generation

```python
def generate_report(result: ArchiveAnalysisResult) -> str:
    """
    Generate markdown report.

    Sections:
    1. Executive summary (keep/retrain recommendation)
    2. Pack-level metrics (discrimination, coverage)
    3. Per-operator details (Cohen's d, variance)
    4. Weak operators (d < 0.5)
    5. Sample high-scoring texts per operator
    6. Next steps (if retraining recommended)
    """
```

---

## 📦 Component 2: Corpus Sampler

**Purpose**: Extract representative texts from archive for each axis

**File**: `humanizer/services/corpus_sampler.py` (~400 lines)

### API

```python
@dataclass
class CorpusSampleConfig:
    """Configuration for corpus sampling."""
    archive_name: str
    target_pack: str  # e.g., "tone"
    samples_per_axis: int = 30  # Target corpus size

    # Sampling strategy
    strategy: str = "hybrid"  # "measure", "search", "llm", "hybrid"

    # Measure-and-select params
    use_existing_operators: bool = True
    top_k_candidates: int = 100  # Candidate pool size

    # LLM validation params
    llm_validation: bool = True
    llm_model: str = "claude-sonnet-4"
    validation_sample_size: int = 50  # Validate top N candidates

    # Quality thresholds
    min_text_length: int = 50  # Filter out short texts
    max_text_length: int = 2000  # Filter out very long texts
    diversity_threshold: float = 0.7  # Cosine similarity threshold

@dataclass
class CorpusSample:
    """Result of corpus sampling."""
    archive_name: str
    pack_name: str

    # Corpus dictionary (axis -> texts)
    corpus: Dict[str, List[str]]

    # Metadata
    total_texts_sampled: int
    sampling_strategy: str
    llm_validation_used: bool

    # Quality metrics
    per_axis_counts: Dict[str, int]
    per_axis_diversity: Dict[str, float]  # Mean pairwise distance

    # Sample provenance (text -> message_uuid)
    text_provenance: Dict[str, UUID]

async def sample_corpus_from_archive(
    session: AsyncSession,
    config: CorpusSampleConfig,
    operators: Optional[Dict[str, SemanticPOVMPack]] = None,
    embedding_service: Optional[Any] = None,
) -> CorpusSample:
    """
    Sample representative corpus from archive.

    Strategies:

    1. "measure" - Use existing operators to rank texts
       - Fast, leverages existing operators
       - Biased by current operator semantics

    2. "search" - Semantic search using axis descriptions
       - Less biased, finds diverse examples
       - Requires good axis descriptions

    3. "llm" - LLM classification of archive texts
       - Most accurate alignment
       - Expensive, slow

    4. "hybrid" (recommended) - Measure + LLM validation
       - Balance cost and accuracy
       - Measure to get candidates, LLM to validate

    Args:
        session: Database session
        config: Sampling configuration
        operators: Current operators (for "measure" strategy)
        embedding_service: Optional

    Returns:
        CorpusSample with corpus dict and metadata
    """
```

### Strategy: Hybrid Sampling (Recommended)

```python
async def hybrid_sampling(
    session: AsyncSession,
    config: CorpusSampleConfig,
    operators: SemanticPOVMPack,
    embedding_service: Any,
) -> Dict[str, List[str]]:
    """
    Hybrid: Measure to get candidates, LLM to validate.

    Process:
    1. Sample large batch from archive (e.g., 1000 texts)
    2. Measure all texts with existing operator
    3. Get top K candidates per axis (e.g., top 50)
    4. LLM validates: "Does this text exemplify '{axis}'?"
    5. Keep highest-confidence examples
    6. Ensure diversity (filter similar texts)
    7. Fill to target count (samples_per_axis)

    Benefits:
    - Fast pre-filtering with existing operators
    - LLM catches misalignments
    - Cost-effective (only validate candidates)
    """
```

### LLM Validation Prompt

```python
VALIDATION_PROMPT = """
You are evaluating whether a text exemplifies a specific semantic axis.

Axis: {axis_name}
Description: {axis_description}

Text:
\"\"\"
{text}
\"\"\"

Does this text strongly exemplify the "{axis_name}" axis?

Respond with JSON:
{{
  "exemplifies": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}}
"""

async def validate_with_llm(
    text: str,
    axis_name: str,
    axis_description: str,
    model: str = "claude-sonnet-4"
) -> Dict[str, Any]:
    """Call LLM to validate text-axis alignment."""
```

### Diversity Filtering

```python
def ensure_diversity(
    texts: List[str],
    embeddings: List[NDArray],
    threshold: float = 0.7
) -> List[str]:
    """
    Filter similar texts to ensure corpus diversity.

    Process:
    1. Sort texts by some quality metric (e.g., LLM confidence)
    2. Keep highest quality text
    3. For each remaining text:
       - Compute max cosine similarity to kept texts
       - If max_sim < threshold: keep
       - Otherwise: skip (too similar)
    4. Return diverse subset

    Args:
        texts: Candidate texts
        embeddings: Text embeddings
        threshold: Similarity threshold (0.7 = fairly distinct)

    Returns:
        Diverse subset of texts
    """
```

---

## 📦 Component 3: Adaptive Operator Learner

**Purpose**: Learn archive-specific operators and manage operator storage

**File**: `humanizer/services/adaptive_operators.py` (~350 lines)

### API

```python
@dataclass
class AdaptiveOperatorConfig:
    """Configuration for adaptive operator learning."""
    archive_name: str
    pack_name: str

    # Corpus source
    corpus: Dict[str, List[str]]  # From corpus_sampler

    # Learning params
    rank: int = 64
    target_trace: Optional[float] = None

    # Validation params
    validation_split: float = 0.2  # Hold out for validation
    min_discrimination: float = 0.5  # Cohen's d threshold

@dataclass
class AdaptiveOperatorResult:
    """Result of adaptive operator learning."""
    archive_name: str
    pack_name: str

    # Learned operators
    pack: SemanticPOVMPack

    # Validation metrics (on held-out archive data)
    validation_metrics: PackMetrics

    # Comparison to baseline (if provided)
    baseline_pack: Optional[SemanticPOVMPack]
    improvement: Optional[float]  # % improvement in discrimination

async def learn_adaptive_operators(
    config: AdaptiveOperatorConfig,
    embedding_service: Any,
    baseline_pack: Optional[SemanticPOVMPack] = None,
) -> AdaptiveOperatorResult:
    """
    Learn archive-specific operators from corpus.

    Process:
    1. Split corpus into train/validation (80/20)
    2. Learn operators using train set
    3. Validate on held-out validation set
    4. Compare to baseline (if provided)
    5. Save with archive metadata

    Args:
        config: Learning configuration
        embedding_service: Sentence embedding service
        baseline_pack: Optional baseline (e.g., static seed operators)

    Returns:
        AdaptiveOperatorResult with learned pack and metrics
    """
```

### Operator Storage Structure

```
data/semantic_operators/
├── default/                  # Static seed corpus (Week 2)
│   ├── tone/
│   │   ├── analytical.pkl
│   │   ├── empathic.pkl
│   │   └── ...
│   ├── tetralemma/
│   └── ...
├── chatgpt_archive/          # Archive-specific (NEW)
│   ├── tone/
│   ├── tetralemma/
│   ├── metadata.json         # Archive metadata
│   └── analysis.json         # Performance metrics
├── discourse_forum_xyz/      # Another archive
│   └── ...
└── README.md                 # Storage schema docs
```

### Metadata Schema

```python
@dataclass
class OperatorSetMetadata:
    """Metadata for an operator set."""
    name: str  # "chatgpt_archive", "discourse_forum_xyz"
    description: str

    # Source
    archive_type: str  # "chatgpt", "discourse", "custom"
    archive_identifier: str  # e.g., conversation UUIDs, forum ID

    # Corpus stats
    corpus_size_per_axis: Dict[str, int]
    total_corpus_size: int
    sampling_strategy: str

    # Learning details
    learning_date: datetime
    rank: int

    # Performance metrics (on archive)
    discrimination_scores: Dict[str, float]  # axis -> Cohen's d
    average_discrimination: float

    # Comparison to baseline
    baseline_name: Optional[str]
    improvement_over_baseline: Optional[float]
```

### Operator Loading Logic

```python
async def load_operators_for_archive(
    archive_name: str,
    fallback_chain: List[str] = ["archive", "default", "random"]
) -> Dict[str, POVMPack]:
    """
    Load operators with fallback chain.

    Tries in order:
    1. Archive-specific operators (if they exist)
    2. Default seed corpus operators
    3. Random operators (last resort)

    Args:
        archive_name: Target archive (e.g., "chatgpt_archive")
        fallback_chain: Loading priority order

    Returns:
        Dictionary of POVM packs
    """
```

---

## 📦 Component 4: Validation Framework

**Purpose**: Systematic validation and comparison of operators

**File**: `humanizer/services/operator_validation.py` (~300 lines)

### API

```python
@dataclass
class ValidationConfig:
    """Configuration for operator validation."""
    archive_name: str
    validation_sample_size: int = 200

    # Tests to run
    test_discrimination: bool = True
    test_variance: bool = True
    test_sum_to_identity: bool = True
    test_coverage: bool = True

@dataclass
class ValidationResult:
    """Results of operator validation."""
    pack_name: str

    # Test results
    discrimination_result: DiscriminationTestResult
    variance_result: VarianceTestResult
    sum_to_identity_result: SumToIdentityTestResult
    coverage_result: CoverageTestResult

    # Overall assessment
    all_tests_passed: bool
    issues: List[str]

    # Report
    report: str  # Markdown

async def validate_operators(
    session: AsyncSession,
    operators: Dict[str, SemanticPOVMPack],
    config: ValidationConfig,
) -> Dict[str, ValidationResult]:
    """
    Run full validation suite on operators.

    Tests:
    1. Discrimination: Cohen's d > threshold on archive
    2. Variance: σ < 0.001 (determinism)
    3. Sum-to-identity: ||Σ E_i - I|| < tolerance
    4. Coverage: Archive spans semantic space

    Args:
        session: Database session
        operators: Operators to validate
        config: Validation configuration

    Returns:
        Validation results per pack
    """
```

### Comparison Tools

```python
@dataclass
class OperatorComparison:
    """Comparison between two operator sets."""
    baseline_name: str
    candidate_name: str

    # Per-pack comparison
    pack_comparisons: Dict[str, PackComparison]

    # Overall winner
    winner: str  # "baseline", "candidate", or "tie"
    improvement_pct: float

    # Recommendation
    recommendation: str  # "use_candidate", "keep_baseline", "unclear"

@dataclass
class PackComparison:
    """Comparison for a single pack."""
    pack_name: str

    # Metrics comparison (higher is better)
    baseline_discrimination: float
    candidate_discrimination: float
    discrimination_improvement: float  # %

    baseline_coverage: float
    candidate_coverage: float
    coverage_improvement: float  # %

    # Winner for this pack
    winner: str

async def compare_operators(
    session: AsyncSession,
    baseline: Dict[str, SemanticPOVMPack],
    candidate: Dict[str, SemanticPOVMPack],
    archive_name: str,
    sample_size: int = 200,
) -> OperatorComparison:
    """
    Compare two operator sets on target archive.

    Process:
    1. Sample texts from archive
    2. Measure with both operator sets
    3. Compute metrics for each
    4. Compare per pack and overall
    5. Generate recommendation

    Args:
        session: Database session
        baseline: Baseline operators (e.g., default)
        candidate: Candidate operators (e.g., archive-specific)
        archive_name: Target archive
        sample_size: Validation sample size

    Returns:
        OperatorComparison with detailed metrics
    """
```

---

## 📦 Component 5: User Workflow

**Purpose**: CLI and API for end-to-end workflow

### CLI Commands

```bash
# Analyze archive with current operators
poetry run python -m humanizer.cli.operators analyze \
    --archive chatgpt_archive \
    --sample-size 200 \
    --report analysis_report.md

# Sample corpus from archive
poetry run python -m humanizer.cli.operators sample \
    --archive chatgpt_archive \
    --pack tone \
    --samples-per-axis 30 \
    --strategy hybrid \
    --output data/povm_corpus/chatgpt_archive/

# Learn archive-specific operators
poetry run python -m humanizer.cli.operators learn \
    --archive chatgpt_archive \
    --corpus data/povm_corpus/chatgpt_archive/ \
    --validate \
    --compare-to default

# Compare operator sets
poetry run python -m humanizer.cli.operators compare \
    --baseline default \
    --candidate chatgpt_archive \
    --archive chatgpt_archive \
    --report comparison_report.md

# Use archive-specific operators in transformations
poetry run python -m humanizer.cli.transform \
    --text "Your text here" \
    --target analytical \
    --operators chatgpt_archive  # Or "default", "auto"
```

### REST API Endpoints

```python
# POST /api/operators/analyze
# Analyze archive with current operators
{
  "archive_name": "chatgpt_archive",
  "sample_size": 200
}
→ ArchiveAnalysisResult

# POST /api/operators/sample
# Sample corpus from archive
{
  "archive_name": "chatgpt_archive",
  "pack_name": "tone",
  "samples_per_axis": 30,
  "strategy": "hybrid"
}
→ CorpusSample

# POST /api/operators/learn
# Learn archive-specific operators
{
  "archive_name": "chatgpt_archive",
  "corpus": {...},
  "validate": true,
  "compare_to": "default"
}
→ AdaptiveOperatorResult

# GET /api/operators/compare
# Compare operator sets
{
  "baseline": "default",
  "candidate": "chatgpt_archive",
  "archive_name": "chatgpt_archive"
}
→ OperatorComparison

# GET /api/operators/list
# List available operator sets
→ {
    "sets": [
      {
        "name": "default",
        "type": "static",
        "metadata": {...}
      },
      {
        "name": "chatgpt_archive",
        "type": "archive-specific",
        "metadata": {...}
      }
    ]
  }
```

---

## 🔄 Automatic vs Guided Workflow

### Automatic Mode

**Trigger**: User loads archive or starts transformation

```python
async def auto_adapt_operators(
    session: AsyncSession,
    archive_name: str,
    config: AutoAdaptConfig,
) -> AdaptiveOperatorResult:
    """
    Automatically adapt operators to archive.

    Process:
    1. Check if archive-specific operators exist
       - If yes: Load and return
       - If no: Continue

    2. Analyze with current (default) operators
       - If discrimination good (>0.7): Use default
       - If discrimination weak (<0.5): Auto-adapt

    3. Sample corpus (hybrid strategy)
    4. Learn archive-specific operators
    5. Validate and save
    6. Return new operators
    """
```

**Configuration**:
```python
@dataclass
class AutoAdaptConfig:
    """Auto-adaptation configuration."""
    enabled: bool = True

    # Thresholds
    min_discrimination: float = 0.5  # Re-train if below
    target_discrimination: float = 0.7  # Stop if above

    # Sampling
    samples_per_axis: int = 30
    max_llm_calls: int = 500  # Cost control

    # Caching
    cache_analysis: bool = True
    cache_ttl_hours: int = 24
```

### Guided Mode

**User-initiated workflow**:

1. **Analyze**: User requests analysis
   ```python
   result = await analyze_archive(session, "chatgpt_archive")
   # Shows: discrimination scores, weak operators, recommendation
   ```

2. **Review**: User reviews recommendations
   - "Keep current operators" → Done
   - "Re-train weak operators" → Continue with specific axes
   - "Re-train all" → Continue with all axes

3. **Sample**: User approves sampling
   ```python
   corpus = await sample_corpus_from_archive(
       session,
       config=config  # User-specified sample size, strategy
   )
   # User can review/edit sample texts
   ```

4. **Learn**: User triggers learning
   ```python
   result = await learn_adaptive_operators(config, corpus)
   # Shows: validation metrics, comparison to baseline
   ```

5. **Compare**: User reviews comparison
   ```python
   comparison = await compare_operators(
       baseline="default",
       candidate="chatgpt_archive"
   )
   # Decision: use new or keep old
   ```

6. **Deploy**: User selects operators for transformations
   ```python
   # transformation_engine.py loads user-selected operators
   operators = load_operators_for_archive(
       archive_name="chatgpt_archive",
       user_preference="archive-specific"  # or "default"
   )
   ```

---

## 🔧 Integration with Transformation Engine

### Modified Loading Logic

**File**: `humanizer/services/transformation_engine.py`

```python
class TransformationStrategy(ABC):
    """Base class for transformation strategies."""

    def __init__(
        self,
        rank: int = 64,
        archive_name: Optional[str] = None,  # NEW
        operator_preference: str = "auto"    # NEW: "auto", "archive", "default", "random"
    ):
        """
        Initialize transformation strategy.

        Args:
            rank: Dimension for density matrices
            archive_name: Target archive for adaptive operators
            operator_preference: Which operators to use:
                - "auto": Try archive-specific → default → random
                - "archive": Archive-specific only (fail if not found)
                - "default": Static seed corpus operators
                - "random": Random operators (not recommended)
        """
        self.rank = rank
        self.archive_name = archive_name
        self.embedding_service = get_sentence_embedding_service()

        # Load operators with preference chain
        self.povm_packs = self._load_operators(
            archive_name=archive_name,
            preference=operator_preference
        )

    def _load_operators(
        self,
        archive_name: Optional[str],
        preference: str
    ) -> Dict[str, POVMPack]:
        """
        Load operators with fallback chain.

        Fallback chain by preference:
        - "auto": archive → default → random
        - "archive": archive only
        - "default": default only
        - "random": random only
        """
        if preference == "auto":
            # Try archive-specific first
            if archive_name:
                try:
                    operators = load_operators_for_archive(archive_name)
                    logger.info(f"Loaded archive-specific operators: {archive_name}")
                    return operators
                except FileNotFoundError:
                    logger.info(f"No archive-specific operators for {archive_name}, trying default")

            # Try default (Week 2 seed corpus)
            try:
                semantic_packs_dict = load_all_operators()
                operators = {
                    name: pack.to_povm_pack()
                    for name, pack in semantic_packs_dict.items()
                }
                logger.info(f"Loaded default semantic operators")
                return operators
            except FileNotFoundError:
                logger.warning("No semantic operators found, falling back to random")
                return get_all_packs(rank=self.rank)

        elif preference == "archive":
            # Archive-specific only
            if not archive_name:
                raise ValueError("archive_name required for preference='archive'")
            operators = load_operators_for_archive(archive_name)
            logger.info(f"Loaded archive-specific operators: {archive_name}")
            return operators

        elif preference == "default":
            # Default only
            semantic_packs_dict = load_all_operators()
            operators = {
                name: pack.to_povm_pack()
                for name, pack in semantic_packs_dict.items()
            }
            logger.info(f"Loaded default semantic operators")
            return operators

        elif preference == "random":
            # Random (not recommended, but available)
            logger.warning("Using random operators (not recommended)")
            return get_all_packs(rank=self.rank)

        else:
            raise ValueError(f"Unknown preference: {preference}")
```

---

## 📊 Success Metrics

### Archive Analysis
- ✅ Can evaluate 200 texts in < 30 seconds
- ✅ Cohen's d computed accurately (validated against manual calculation)
- ✅ Reports actionable (clear "keep"/"retrain" recommendation)

### Corpus Sampling
- ✅ Hybrid strategy samples 30 texts/axis in < 5 minutes
- ✅ LLM validation accuracy > 80% (vs manual labeling)
- ✅ Diversity threshold ensures distinct examples

### Operator Learning
- ✅ Archive-specific operators have d > 0.7 (vs d > 0.5 for default)
- ✅ At least 30% improvement over default on target archive
- ✅ Validation on held-out archive data confirms discrimination

### Integration
- ✅ Transformation engine loads operators seamlessly
- ✅ Fallback chain works (archive → default → random)
- ✅ No performance degradation vs Week 2 static operators

---

## 📅 Implementation Timeline

### Phase 1: Archive Analyzer (3-4 hours)
**Files**:
- `humanizer/services/archive_analyzer.py` (~300 lines)
- `tests/test_archive_analyzer.py` (~200 lines)

**Deliverables**:
- ArchiveAnalysisResult dataclass
- `analyze_archive()` function
- Discrimination, coverage metrics
- Markdown report generation
- CLI command: `operators analyze`

### Phase 2: Corpus Sampler (2-3 hours)
**Files**:
- `humanizer/services/corpus_sampler.py` (~400 lines)
- `tests/test_corpus_sampler.py` (~200 lines)

**Deliverables**:
- CorpusSample dataclass
- Hybrid sampling strategy
- LLM validation integration
- Diversity filtering
- CLI command: `operators sample`

### Phase 3: Adaptive Learner (2-3 hours)
**Files**:
- `humanizer/services/adaptive_operators.py` (~350 lines)
- Modify `humanizer/services/transformation_engine.py` (~50 lines)
- `tests/test_adaptive_operators.py` (~200 lines)

**Deliverables**:
- AdaptiveOperatorResult dataclass
- `learn_adaptive_operators()` function
- Operator storage structure
- Metadata schema
- CLI command: `operators learn`

### Phase 4: Validation Framework (2-3 hours)
**Files**:
- `humanizer/services/operator_validation.py` (~300 lines)
- `tests/test_operator_validation.py` (~150 lines)

**Deliverables**:
- ValidationResult dataclass
- `validate_operators()` function
- `compare_operators()` function
- Comparison reports
- CLI command: `operators compare`

### Phase 5: CLI & Integration (2-3 hours)
**Files**:
- `humanizer/cli/operators.py` (~250 lines)
- REST API endpoints in `humanizer/api/operators.py` (~300 lines)
- Update docs: `WEEK3_COMPLETE_HANDOFF.md`

**Deliverables**:
- Complete CLI interface
- REST API endpoints
- Auto-adapt workflow
- Documentation

**Total**: ~11-16 hours (within 8-18 hour target range)

---

## 🎯 Next Steps

1. **Implement Phase 1**: Archive analyzer (Start immediately)
2. **Test on ChatGPT archive**: Validate approach with real data
3. **Iterate**: Refine metrics and thresholds based on results
4. **Complete Phases 2-5**: Build full adaptive system

---

**End of Design Document**
