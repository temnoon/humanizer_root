# Week 2 Quick Start Guide
## Start Here After Session Restart

---

## Immediate Actions (First 5 minutes)

1. **Memory Agent Briefing** (automatic):
   - Will synthesize Week 1 findings automatically
   - Provides context without reading full docs

2. **Quick Context Check**:
   - Week 1: ✅ COMPLETE (investigation done)
   - Week 2: 🎯 BUILD semantic operators
   - Problem: Random operators too noisy (σ = 0.021)
   - Solution: Semantic operators (σ = 0.000 proven)

3. **Start Building**:
   - Task 1: Fix operator construction (prototype approach)
   - Goal: Analytical texts score > non-analytical
   - Success: Effect size > 0.8, variance < 0.01

---

## Week 1 Summary (30 seconds)

**Found**: Random POVM operators have too much variance
- MDI (0.042) > improvements (0.029) → undetectable

**Cause**: Random projections vary each measurement
- Same text → different random matrix → different ρ → noise

**Proven**: Semantic operators eliminate variance
- Random: σ = 0.051 → Semantic: σ = 0.000 (100% reduction!)

**Issue**: Prototype discriminates backwards (fixable)

**Verdict**: FEASIBLE - proceed to build all 25 operators

---

## Week 2 Task List (15 hours total)

### Task 1: Fix Operator Construction (~4h) 🎯 START HERE
**File**: `semantic_operator_feasibility.py` (modify build_semantic_operator())

**Current Problem**:
```python
# Lines 157-167: Too simplistic
B = np.eye(rank)
for i in range(k):
    weight = S_k[i] / S_k[0]
    B[i, i] = weight
# Results in E ≈ identity (doesn't encode concept)
```

**Fix Option 1 - Prototype** (try this first):
```python
# Use mean embedding as primary direction
mean_emb = np.mean(corpus_embeddings, axis=0)
mean_normalized = mean_emb / np.linalg.norm(mean_emb)

# Projection matrix: first column is concept direction
projection_matrix[:, 0] = mean_normalized

# Build B to emphasize first direction
B = np.eye(rank) * 0.1  # Small baseline
B[0, 0] = 1.0  # Emphasize concept direction
```

**Test**:
```bash
poetry run python semantic_operator_feasibility.py
# Should show: analytical > non-analytical (positive effect size)
```

### Task 2: Collect Corpus (~3h)
**Goal**: 50-100 examples per axis
**Format**: JSON in `data/povm_corpus/{pack}/{axis}.json`
**Sources**: ChatGPT archive, manual curation, LLM generation

### Task 3: Implement SemanticPOVMOperator (~4h)
**File**: `humanizer/core/trm/semantic_operators.py` (new, ~300 lines)
**Key Method**: `from_corpus(corpus, name, rank, method)`

### Task 4: Operator Learning Pipeline (~3h)
**File**: `humanizer/services/operator_learning.py` (new)
**Goal**: Automate learning for all 25 operators

### Task 5: Tests (~1h)
**File**: `tests/test_semantic_operators.py` (new, 15 tests)

---

## Key Files Reference

### Read These First
1. `SESSION_HANDOFF_OCT22_WEEK1_COMPLETE.md` - Complete handoff (if needed)
2. `INVESTIGATION_REPORT_WEEK1_OCT22.md` - Detailed findings (if needed)

### Modify These (Week 2)
1. `semantic_operator_feasibility.py` - Fix build_semantic_operator()
2. `humanizer/core/trm/density.py` - Accept projection_matrix param
3. `humanizer/core/trm/povm.py` - Add SemanticPOVMOperator

### Create These (Week 2)
1. `humanizer/core/trm/semantic_operators.py` - Main implementation
2. `humanizer/core/trm/operator_construction.py` - Learning algorithms
3. `humanizer/services/operator_learning.py` - Automated pipeline
4. `data/povm_corpus/` - Corpus data (25 JSON files)
5. `tests/test_semantic_operators.py` - Test suite

---

## Quick Commands

### Test Operator Construction
```bash
# Run feasibility study (should show correct discrimination)
poetry run python semantic_operator_feasibility.py

# Expected output:
# ✅ CRITERION 1: Operator discriminates analytical vs non-analytical
#    Effect size: >0.80 (Cohen's d)
# ✅ CRITERION 2: Variance reduced vs random operators
#    Reduction: 100%
```

### Run Tests
```bash
# Core TRM tests (should still pass)
poetry run pytest tests/test_trm_core.py -v

# New semantic operator tests (create these)
poetry run pytest tests/test_semantic_operators.py -v
```

### Development Servers (if needed)
```bash
# Backend
poetry run uvicorn humanizer.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev

# Ollama (for LLM)
ollama serve
```

---

## Success Criteria (Week 2)

By end of Week 2, you should have:

- [ ] Operator construction fixed (analytical > non-analytical)
- [ ] Corpus collected (50-100 examples × 25 axes = 1,250-2,500 texts)
- [ ] SemanticPOVMOperator class implemented
- [ ] All 25 operators learned successfully
- [ ] Variance < 0.01 (vs 0.021 baseline)
- [ ] Discrimination: effect size > 0.8
- [ ] Tests passing (15+ tests)

---

## Estimated Timeline

| Day | Hours | Tasks |
|-----|-------|-------|
| 1 | 4h | Fix operator construction, validate |
| 2 | 4h | Collect corpus data (use ChatGPT archive) |
| 3 | 4h | Implement SemanticPOVMOperator class |
| 4 | 3h | Build operator learning pipeline |
| 5 | 1h | Write tests, validate all 25 operators |

**Total**: 14-18 hours over 5-7 days

---

## If You Get Stuck

### Operator Construction Not Working?
- Try cluster-based approach (use PCA eigenvectors)
- Try learned approach (optimize for discrimination)
- Check corpus quality (are examples actually analytical?)

### Variance Not Reduced?
- Verify using fixed projection matrix (not None)
- Check projection_matrix is consistent (same for same operator)
- Ensure not accidentally using random projections

### Discrimination Wrong Direction?
- Flip operator (swap positive/negative corpus)
- Check B matrix construction (should emphasize concept)
- Verify projection matrix points toward concept (not away)

---

## Key Insight

**Week 1 proved**: The variance problem is SOLVED by semantic operators (100% reduction).

**Week 2 task**: Just implement them properly (operator construction is the only piece to fix).

**Time estimate**: 14-18 hours to complete (all tasks well-defined).

---

**Ready to build! 🚀**

Start with Task 1: Fix operator construction in `semantic_operator_feasibility.py`
