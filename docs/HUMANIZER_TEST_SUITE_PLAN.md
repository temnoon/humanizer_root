# Humanizer Expanded Test Suite Plan

**Created**: December 8, 2025
**Status**: PLANNED - Ready for next session
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
/tmp/run_tests.py  # Current 8-sample test
/Users/tem/humanizer_root/test-samples/test-comprehensive.sh  # Shell version
```

---

## Implementation Steps

### Phase 1: Sample Collection
1. Create `/Users/tem/humanizer_root/test-samples/samples/` directory
2. Add 50+ text files organized by category
3. Each file: 50-200 words of AI-generated content

### Phase 2: Test Runner
1. Extend `/tmp/run_tests.py` to load from files
2. Add JSON output for results
3. Add category-based reporting
4. Add statistical analysis (mean, median, std dev)

### Phase 3: CI Integration (Future)
1. Create GitHub Action workflow
2. Run on PR to main
3. Fail if pass rate < 80%

---

## Sample Sources

Generate test samples using:
- ChatGPT with specific prompts
- Claude with academic prompts
- Existing AI-generated content in codebase
- Online AI text generators

Each sample should:
- Be 50-200 words
- Contain 2+ tell-words
- Score 60%+ on AI detection initially

---

## Handoff Notes

To continue this work:

1. Read this file
2. Create sample files in `test-samples/samples/`
3. Extend the Python test runner
4. Run tests and analyze results
5. Adjust humanizer if pass rate < 80%

**ChromaDB Tags**: `humanizer`, `test-suite`, `quality`, `dec-2025`

---

**End of Plan** | Created: Dec 8, 2025 | Branch: architecture-remediation-dec06
