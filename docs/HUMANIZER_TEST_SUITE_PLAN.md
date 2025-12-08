# Humanizer Expanded Test Suite Plan

**Created**: December 8, 2025
**Updated**: December 8, 2025
**Status**: IMPLEMENTED - Test suite running
**Branch**: `architecture-remediation-dec06`

---

## Goal

Create a comprehensive test suite with 50+ diverse content samples to validate the humanizer works "for many thousands of different types of content."

---

## Test Categories (8 samples each = 80 total)

### 1. Academic/Scientific (10 samples)
- Research paper abstracts
- Scientific methodology descriptions
- Literature reviews
- Medical/clinical content
- Peer review responses
- Grant proposals
- Academic blog posts
- Conference paper introductions
- Thesis chapter excerpts
- Research findings summaries

### 2. Technical/Engineering (10 samples)
- Software documentation
- API descriptions
- Architecture overviews
- Code reviews/PRs
- Technical tutorials
- DevOps runbooks
- Database schemas explanations
- Security advisories
- Performance analysis
- System design documents

### 3. Business/Corporate (10 samples)
- Marketing copy
- Sales proposals
- Financial reports
- Management memos
- Strategy documents
- Press releases
- Investor updates
- Product announcements
- Company blog posts
- Case studies

### 4. Creative/Narrative (10 samples)
- Short story openings
- Blog post introductions
- Product descriptions
- Travel writing
- Food/recipe descriptions
- Review content
- Opinion pieces
- Personal essays
- LinkedIn posts
- Newsletter intros

### 5. Educational (10 samples)
- Textbook excerpts
- Course descriptions
- Tutorial guides
- Explainer content
- How-to articles
- FAQ answers
- Learning objectives
- Study guides
- Educational blog posts
- Instructional content

### 6. Edge Cases (10 samples)
- Very short text (20-30 words)
- Long text (500+ words)
- Highly technical jargon
- Informal/conversational
- Formal legal-style
- List-heavy content
- Question-heavy content
- Code-adjacent explanations
- Multi-language references
- Emoji/special character content

---

## Test Metrics

For each sample, record:

| Metric | Description |
|--------|-------------|
| `original_confidence` | AI detection score before |
| `final_confidence` | AI detection score after |
| `confidence_drop` | Improvement in points |
| `original_tellwords` | Tell-words detected before |
| `final_tellwords` | Tell-words detected after |
| `original_verdict` | ai/uncertain/human before |
| `final_verdict` | ai/uncertain/human after |
| `burstiness_change` | Change in sentence variation |
| `duration_ms` | Processing time |

---

## Success Criteria

| Metric | Target | Minimum Acceptable |
|--------|--------|-------------------|
| Pass Rate | 90% | 80% |
| Avg Confidence Drop | 30+ pts | 25 pts |
| Tell-word Elimination | 100% | 90% |
| Verdict Flips (AI→Human) | 30%+ | 20% |
| Max Duration | <30s | <60s |

A test "passes" if:
- Confidence drop > 10 points, OR
- Final verdict is "human"

---

## Test Script Location

```bash
/Users/tem/humanizer_root/test-samples/samples.json         # 60 test samples
/Users/tem/humanizer_root/test-samples/run_comprehensive_tests.py  # Python test runner
/Users/tem/humanizer_root/test-samples/test-comprehensive.sh  # Shell version (legacy)
```

---

## Implementation Status

### Phase 1: Sample Collection - COMPLETE
- Created `samples.json` with 60 diverse test samples
- 6 categories x 10 samples each
- Each sample 50-200 words with multiple tell-words

### Phase 2: Test Runner - COMPLETE
- Created `run_comprehensive_tests.py` with:
  - JSON output with full metrics
  - Category and intensity breakdowns
  - Statistical analysis (mean, median, std dev)
  - Success criteria evaluation
  - Parallel execution support

### Phase 3: CI Integration (Future)
1. Create GitHub Action workflow
2. Run on PR to main
3. Fail if pass rate < 80%

---

## Test Results (30-Sample Run - Dec 8, 2025)

### Overall Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Pass Rate | 93.3% | 90% | TARGET MET |
| Avg Confidence Drop | 28.3 pts | 30 pts | CLOSE |
| Median Confidence Drop | 27.0 pts | - | - |
| Tell-word Elimination | 63.3% | 90% | NEEDS WORK |
| Verdict Flip Rate | 23.3% | 20% | MET |
| Max Duration | 73.8s | 60s | EXCEEDS |
| Avg Duration | 22.5s | 30s | GOOD |

### By Category

| Category | Pass Rate | Avg Drop | Avg Time |
|----------|-----------|----------|----------|
| academic | 90% | 28.0 pts | 26s |
| technical | 90% | 28.4 pts | 18s |
| business | 100% | 28.5 pts | 23s |

### By Intensity

| Intensity | Pass Rate | Avg Drop |
|-----------|-----------|----------|
| light | 71.4% | 19.9 pts |
| moderate | 100% | 28.8 pts |
| aggressive | 100% | 35.7 pts |

### Key Findings

1. **Light intensity underperforms** - Only 71.4% pass rate vs 100% for moderate/aggressive
2. **Tell-word elimination needs improvement** - LLM sometimes reintroduces tell-words
3. **Aggressive mode works best** - Highest confidence drops (35.7 pts avg)
4. **Duration varies widely** - Some tests take 70s+ (Cloudflare timeouts)

---

## Next Steps

1. Investigate light intensity failures
2. Improve tell-word post-processing safety net
3. Add more edge cases (very short, very long text)
4. Consider CI integration once stable

---

## Usage

```bash
# Run all 60 tests
python3 run_comprehensive_tests.py

# Run specific category
python3 run_comprehensive_tests.py --category academic

# Run limited set
python3 run_comprehensive_tests.py --limit 10

# Parallel execution (experimental)
python3 run_comprehensive_tests.py --parallel 3
```

**ChromaDB Tags**: `humanizer`, `test-suite`, `quality`, `dec-2025`

---

**End of Plan** | Updated: Dec 8, 2025 | Branch: architecture-remediation-dec06
