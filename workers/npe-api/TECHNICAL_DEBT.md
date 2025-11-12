# Technical Debt Tracker - Quantum/V2 Implementation

**Last Updated**: November 11, 2025, 3:30 PM
**Total Items**: 14
**Status**: CRITICAL - Cannot launch with fake quantum operations

---

## Executive Summary

This audit reveals **fundamental architectural problems** with the V2 "quantum" implementation. The system uses LLMs to *guess* what quantum measurements should be, rather than computing proper projection operators. This is **measurement theater** - we're faking the science to look sophisticated.

### Severity Breakdown

- **BLOCKING (8 items)**: Fake quantum operations that invalidate the entire V2 approach
- **LIMITING (4 items)**: Missing features that reduce V2 value proposition
- **COSMETIC (2 items)**: Minor issues that don't affect correctness

### Critical Finding

**The density matrix ρ is a side-effect, not the cause**. We:
1. Generate text with LLM
2. Compute ρ from the *result*
3. Display ρ metrics as if they guided the transformation

This is backwards. True quantum-guided transformation would:
1. Start with ρ₀ (initial state)
2. Define POVM operators {Eₖ} mathematically
3. Apply Born rule: p(k) = Tr(Eₖρ)
4. Use measurement outcome k to select transformation path
5. Compute post-measurement ρ' = EₖρEₖ† / p(k)

---

## 1. BLOCKING DEBT - Fake Quantum Operations

### DEBT-001: LLM-Guessed POVM Measurements

**Location**: `/workers/npe-api/src/services/quantum-reading/povm-measurement.ts`
**Type**: Fundamental architectural flaw
**Severity**: BLOCKING
**Blocks**: Core ML, Cloud Archives
**Created**: ~October 2025 (initial V2 implementation)
**Effort**: LARGE (40+ hours, requires quantum physics expertise)

**Description**:
The "POVM measurement" system asks Llama 3.1 8B to guess Tetralemma probabilities:
```typescript
// Lines 76-115
const prompt = createTetralemmPrompt(sentence);
const response = await ai.run(MODEL_NAME, { messages: [...] });
// Parse JSON with probabilities from LLM guess
```

**Why This Is Fake**:
- LLMs don't do quantum measurements - they do semantic analysis
- No projection operators {E_literal, E_metaphorical, E_both, E_neither}
- No Born rule application: p(k) = Tr(Eₖρ)
- Probabilities are literary *interpretation*, not quantum *measurement*

**What Real Implementation Would Look Like**:
```typescript
// Define POVM operators as 32×32 matrices
const E_literal = constructProjector(literalnessSubspace);
const E_metaphorical = constructProjector(metaphoricalSubspace);
const E_both = constructProjector(superpositionSubspace);
const E_neither = I - E_literal - E_metaphorical - E_both;

// Measure via Born rule
const p_literal = trace(matmul(E_literal, rho));
const p_metaphorical = trace(matmul(E_metaphorical, rho));
// ... etc

// Collapse state
const rho_prime = matmul(matmul(E_k, rho), adjoint(E_k)) / p_k;
```

**Fix Difficulty**: Extremely hard - requires defining what "literalness subspace" actually *means* in 768-dimensional embedding space.

**Recommendation**: Either:
1. **Research path**: Define proper POVM operators (PhD-level work)
2. **Honest path**: Rename to "LLM Semantic Analysis" and drop quantum terminology
3. **Hybrid path**: Use embeddings to approximate measurement, but be transparent about limitations

---

### DEBT-002: Density Matrix ρ Not Used for Guidance

**Location**: `/workers/npe-api/src/domain/allegorical-rho-service.ts`
**Type**: Architectural flaw
**Severity**: BLOCKING
**Blocks**: Core ML
**Created**: ~November 2025
**Effort**: LARGE (30+ hours)

**Description**:
The 5-stage allegorical pipeline computes ρ *after* each transformation but doesn't use it to *guide* the transformation:

```typescript
// Line 237: Transform happens FIRST
const outputText = await transformFn(inputText);

// Line 241-242: THEN we compute ρ
const embeddingResult = await generateEmbedding(this.ai, outputText);
const rhoMatrix = constructDensityMatrix(embeddingResult.embedding);
```

**Why This Is Wrong**:
- ρ should influence *which* transformation path to take
- Current implementation: ρ is a **report card** on what already happened
- True quantum: ρ determines **probability distribution** over possible outcomes

**What Real Implementation Would Look Like**:
```typescript
// BEFORE transformation: Measure ρ to decide path
const rho_before = await narrativeRepo.getRho(narrativeId);
const measurement = await povmService.measureNarrative(narrativeId, 'narrative_structure');

// Use measurement outcome to select transformation strategy
if (measurement.probabilities.literal > 0.7) {
  // High literalness detected → apply metaphor-introducing transformation
  outputText = await this.deconstructLiteral(inputText);
} else if (measurement.probabilities.metaphorical > 0.7) {
  // High metaphoricality → ground in concrete examples
  outputText = await this.deconstructMetaphorical(inputText);
} else {
  // Mixed state → standard deconstruction
  outputText = await this.deconstructStandard(inputText);
}

// AFTER transformation: Compute new ρ
const rho_after = ...;
```

**Fix Difficulty**: Hard - requires designing transformation paths based on ρ properties.

**Recommendation**: Either implement ρ-guided branching OR remove ρ from transformation pipeline (keep it only for analysis).

---

### DEBT-003: POVM "Measurement" is Content Analysis Masquerading as Physics

**Location**: `/workers/npe-api/src/services/povm-verification/content-povm.ts`, `persona-povm.ts`, `namespace-povm.ts`, `style-povm.ts`
**Type**: Terminology fraud
**Severity**: BLOCKING
**Blocks**: Core ML, academic credibility
**Created**: ~November 2025 (verification system)
**Effort**: SMALL (2 hours to rename) OR LARGE (40+ hours to make legitimate)

**Description**:
The "POVM verification" system asks LLMs to analyze content dimensions:
- Plot structure (list events)
- Semantic entailment (list implications)
- Ethical stance (rate moral position)
- Persona (analyze perspective/tone)
- Namespace (identify domain)
- Style (classify formality/structure)

These are **content analysis tasks**, not quantum measurements. There are no operators, no Born rule, no state collapse.

**Why This Matters**:
Using quantum terminology for standard NLP tasks is intellectually dishonest and will get us called out by:
- Academic reviewers
- Physics-literate users
- Anyone with a quantum mechanics background

**Fix Options**:
1. **Easy fix** (2 hours): Rename to "Semantic Analysis" or "Content Verification"
2. **Hard fix** (40+ hours): Design actual POVM operators for each dimension

**Recommendation**: Take the easy fix. Call it what it is: "LLM-based content analysis with constraint checking."

---

### DEBT-004: Simplified Density Matrix Uses Diagonal Approximation

**Location**: `/workers/npe-api/src/services/quantum-reading/density-matrix-simple.ts`
**Type**: Physics oversimplification
**Severity**: BLOCKING (for academic rigor)
**Blocks**: Core ML
**Created**: ~October 2025
**Effort**: MEDIUM (15-20 hours)

**Description**:
The density matrix is constructed as a **diagonal matrix** from embedding vector probabilities:

```typescript
// Line 38-67: constructDensityMatrix()
// 1. Project 768d embedding to 32d
// 2. Normalize: |ψ⟩ = embedding / ||embedding||
// 3. Use squared values as diagonal: ρᵢᵢ = |ψᵢ|²
// 4. Return diagonal matrix (all off-diagonal elements = 0)
```

**Why This Is Wrong**:
- Real density matrices have **off-diagonal coherences**
- Diagonal ρ = classical probability distribution (no quantum features)
- Purity Tr(ρ²) is just Shannon entropy of diagonal
- Missing: superposition, entanglement, quantum interference

**What We're Losing**:
- Coherence between basis states
- Ability to detect superposition
- True quantum vs classical distinction

**What Real Implementation Would Need**:
```typescript
// Construct FULL 32×32 complex matrix
const rho = zeros(32, 32);
for (let i = 0; i < 32; i++) {
  for (let j = 0; j < 32; j++) {
    rho[i][j] = psi[i] * conj(psi[j]);  // Outer product |ψ⟩⟨ψ|
  }
}
```

**Complication**: Workers don't handle complex numbers well, and we'd need proper matrix libraries.

**Recommendation**: Either:
1. Implement full ρ with complex coherences (hard)
2. Admit we're using "classical probability distribution inspired by quantum density matrices" (honest)

---

### DEBT-005: No Actual Projection Operators Defined

**Location**: Entire `/workers/npe-api/src/services/quantum-reading/` directory
**Type**: Missing core quantum mechanics
**Severity**: BLOCKING
**Blocks**: Core ML
**Created**: Initial V2 architecture
**Effort**: LARGE (60+ hours, PhD-level)

**Description**:
A true POVM requires defining projection operators {Eₖ} that satisfy:
- Eₖ ≥ 0 (positive semi-definite)
- ΣEₖ = I (completeness)
- Born rule: p(k) = Tr(Eₖρ)

We have **zero** of these defined. No matrices, no projectors, no measurement operators.

**What's Missing**:
```typescript
// Need to define for each POVM axis:
interface POVMOperators {
  E_literal: Matrix32x32;      // Projects onto "literal" subspace
  E_metaphorical: Matrix32x32;
  E_both: Matrix32x32;
  E_neither: Matrix32x32;
}

// Need to verify completeness
function verifyPOVMCompleteness(ops: POVMOperators): boolean {
  const sum = add(add(add(ops.E_literal, ops.E_metaphorical), ops.E_both), ops.E_neither);
  return isIdentity(sum, tolerance=0.01);
}

// Need to apply Born rule
function measurePOVM(rho: DensityMatrix, ops: POVMOperators): Probabilities {
  return {
    literal: trace(matmul(ops.E_literal, rho)),
    metaphorical: trace(matmul(ops.E_metaphorical, rho)),
    both: trace(matmul(ops.E_both, rho)),
    neither: trace(matmul(ops.E_neither, rho))
  };
}
```

**The Hard Problem**:
How do we map embedding space structure to projection operators? What *is* the "literal subspace" of a 768-dimensional embedding?

**Possible Approaches**:
1. Train classifiers on labeled data, use decision boundaries as subspace definitions
2. Cluster embeddings, define projectors onto cluster centroids
3. Use PCA/ICA to find principal components, interpret as "meaning axes"

**Recommendation**: This is a research problem. Either solve it properly OR abandon quantum terminology.

---

### DEBT-006: Round-Trip and Maieutic Have No ρ Tracking

**Location**: `/workers/npe-api/src/services/round_trip.ts`, `/workers/npe-api/src/services/maieutic.ts`
**Type**: Incomplete V2 coverage
**Severity**: BLOCKING (for V2 completeness)
**Blocks**: Cloud Archives
**Created**: Initial implementation (pre-V2)
**Effort**: MEDIUM (10-15 hours)

**Description**:
V2 API provides ρ-tracked allegorical transformation, but Round-Trip and Maieutic transformations still use V1 approach (no quantum state tracking).

**Why This Matters**:
- Inconsistent API (some endpoints track ρ, some don't)
- Missing quantum analysis for 2 out of 3 core transformations
- Users expect V2 features across all transformations

**What's Missing**:
- Round-Trip: Should track ρ evolution through forward/backward translation
- Maieutic: Should track ρ collapse through dialogue turns

**Fix**:
Apply the same ρ-tracking pattern from allegorical-rho-service to:
1. Create `round-trip-rho-service.ts`
2. Create `maieutic-rho-service.ts`
3. Add V2 routes: `/v2/round-trip`, `/v2/maieutic`

**Recommendation**: Complete this OR declare V2 is allegorical-only and market accordingly.

---

### DEBT-007: Embedding Drift ≠ Quantum State Distance

**Location**: `/workers/npe-api/src/services/povm-verification/content-povm.ts` (lines 432-456)
**Type**: Terminology confusion
**Severity**: BLOCKING (for correctness)
**Blocks**: Core ML
**Created**: Verification system implementation
**Effort**: SMALL (2 hours to fix terminology) OR LARGE (20+ hours for real trace distance)

**Description**:
The "drift" calculation compares embeddings with cosine similarity, calls it "quantum state distance":

```typescript
// Line 432-451: computeTextDriftEmbedding()
const similarity = cosineSimilarity(embedding1, embedding2);
return 1 - similarity;  // Called "drift"
```

**Why This Is Wrong**:
Real quantum state distance uses **trace distance**:
```
D(ρ₁, ρ₂) = (1/2) Tr|ρ₁ - ρ₂|
```

Where |A| means "take absolute value of eigenvalues of A".

**What We're Actually Computing**:
Cosine similarity of embedding vectors = semantic similarity. This is fine! Just don't call it "quantum distance."

**Fix**:
```typescript
// Option 1: Honest naming
async function computeSemanticSimilarity(text1, text2, ai) { ... }

// Option 2: Real trace distance (requires full ρ matrices)
function traceDistance(rho1: DensityMatrix, rho2: DensityMatrix): number {
  const diff = subtract(rho1.matrix, rho2.matrix);
  const eigenvals = computeEigenvalues(diff);
  return 0.5 * sum(eigenvals.map(Math.abs));
}
```

**Recommendation**: Rename to "semantic drift" and be honest about what we're measuring.

---

### DEBT-008: No Verification That POVM Results Obey Quantum Constraints

**Location**: `/workers/npe-api/src/services/quantum-reading/povm-measurement.ts`
**Type**: Missing validation
**Severity**: BLOCKING
**Blocks**: Core ML
**Created**: Initial POVM implementation
**Effort**: SMALL (3-4 hours)

**Description**:
The POVM validation only checks:
- Probabilities sum to 1.0
- All probabilities in [0, 1]

Missing checks:
- Do the operators {Eₖ} satisfy Eₖ ≥ 0?
- Do they satisfy ΣEₖ = I?
- Is post-measurement ρ' still valid (trace=1, positive)?

**Why This Matters**:
Without validation, we could produce "measurements" that violate quantum mechanics.

**Fix**:
```typescript
function validateQuantumMeasurement(
  operators: POVMOperators,
  rho_before: DensityMatrix,
  rho_after: DensityMatrix,
  measurement: Probabilities
): ValidationResult {
  const errors = [];

  // Check operator positivity
  for (const [name, E] of Object.entries(operators)) {
    if (!isPositiveSemiDefinite(E)) {
      errors.push(`Operator ${name} is not positive semi-definite`);
    }
  }

  // Check completeness
  if (!isIdentity(sumOperators(operators), 0.01)) {
    errors.push('POVM operators do not sum to identity');
  }

  // Check Born rule
  const computed_probs = computeBornRule(rho_before, operators);
  if (!probsMatch(computed_probs, measurement, 0.01)) {
    errors.push('Measurement probabilities do not match Born rule');
  }

  // Check post-measurement state
  if (Math.abs(trace(rho_after.matrix) - 1.0) > 0.01) {
    errors.push('Post-measurement ρ has trace ≠ 1');
  }

  return { valid: errors.length === 0, errors };
}
```

**Recommendation**: Add validation AND expect it to fail (revealing that we don't actually have quantum operations).

---

## 2. LIMITING DEBT - Missing V2 Features

### DEBT-009: No User-Facing ρ Inspector UI

**Location**: Missing from `/workers/npe-api/cloud-workbench/`
**Type**: Missing feature
**Severity**: LIMITING
**Blocks**: User adoption
**Created**: N/A (never built)
**Effort**: MEDIUM (8-10 hours)

**Description**:
We have backend routes `/v2/rho/inspect` and `/v2/rho/distance` but no UI for users to:
- Visualize eigenvalue spectrum
- Interpret purity/entropy
- Compare ρ states visually
- Understand what ρ means for their text

**Impact**:
Users see "purity: 0.42" and have no idea if that's good, bad, or meaningless.

**What's Needed**:
- Eigenvalue bar chart (like in ρ Inspector panel)
- Purity gauge with interpretation
- Entropy visualization
- State classification explanation
- Interactive comparison tool

**Recommendation**: Build this AFTER deciding if ρ is actually useful (see DEBT-002).

---

### DEBT-010: No Session/Workflow Persistence for V2

**Location**: Missing from narrative sessions architecture
**Type**: Missing feature
**Severity**: LIMITING
**Blocks**: Cloud Archives
**Created**: N/A
**Effort**: MEDIUM (12-15 hours)

**Description**:
V2 allegorical transformations create narratives and ρ states but don't persist them as reusable sessions. Users can't:
- Save a transformation as a named session
- Fork from intermediate stages
- Build transformation pipelines
- Share ρ evolution visualizations

**Fix**:
Extend the narrative sessions architecture (from MVP_FUNCTIONAL_SPEC.md) to include:
- V2 transformation type
- Link stages to ρ versions
- Capture POVM measurements
- Store verification reports

**Recommendation**: Wait until V2 legitimacy is resolved before building this.

---

### DEBT-011: No Explanation of What ρ Means

**Location**: All V2 API responses
**Type**: Documentation gap
**Severity**: LIMITING
**Blocks**: User understanding
**Created**: N/A
**Effort**: SMALL (4-6 hours)

**Description**:
V2 API returns ρ metrics like:
```json
{
  "purity": 0.42,
  "entropy": 1.85,
  "eigenvalues": [0.15, 0.12, 0.09, ...]
}
```

But nowhere explains:
- What purity means for text
- Why entropy matters
- How to interpret eigenvalues
- What these numbers should guide users to do

**Fix**:
Add `interpretation` field to all ρ responses:
```json
{
  "purity": 0.42,
  "entropy": 1.85,
  "interpretation": {
    "purity_meaning": "Mixed state - narrative has competing interpretations",
    "entropy_meaning": "Moderate complexity - multiple semantic layers",
    "action": "This text supports diverse readings. Transformation may increase clarity (higher purity) or preserve ambiguity.",
    "learn_more_url": "/docs/quantum-reading"
  }
}
```

**Recommendation**: Add this as part of making V2 user-facing.

---

### DEBT-012: Verification System Only Works on Allegorical

**Location**: `/workers/npe-api/src/services/povm-verification/`
**Type**: Incomplete feature
**Severity**: LIMITING
**Blocks**: General transformation quality
**Created**: Verification system implementation
**Effort**: MEDIUM (10-12 hours)

**Description**:
The constraint verification system only applies to V2 allegorical transforms. Round-Trip and Maieutic have no verification.

**Impact**:
- Inconsistent quality guarantees
- Allegorical gets constraint checking, others don't
- Users expect verification everywhere

**Fix**:
Apply verification to:
- Round-Trip: Verify semantic drift stays within acceptable range
- Maieutic: Verify dialogue coherence and insight extraction

**Recommendation**: Generalize verification system OR label it as "allegorical-only feature."

---

## 3. COSMETIC DEBT - Minor Issues

### DEBT-013: Auth Disabled on /v2/rho Routes

**Location**: `/workers/npe-api/src/routes/v2/rho.ts` (line 19-21)
**Type**: Security bypass
**Severity**: COSMETIC (but comment is wrong)
**Blocks**: N/A
**Created**: Local development
**Effort**: SMALL (5 minutes)

**Description**:
```typescript
// TODO: Re-enable auth for production deployment
// For local dev, auth is disabled to allow Workbench access
// rhoRoutes.use('/*', requireAuth());
```

**Issue**: Comment says "for local dev" but this code is deployed to production.

**Fix**:
```typescript
// Use optionalLocalAuth() for Workbench compatibility
rhoRoutes.use('/*', optionalLocalAuth());
```

**Recommendation**: Fix before next deployment.

---

### DEBT-014: Inconsistent Error Handling in POVM Measurement

**Location**: `/workers/npe-api/src/services/quantum-reading/povm-measurement.ts`
**Type**: UX inconsistency
**Severity**: COSMETIC
**Blocks**: N/A
**Created**: Initial POVM implementation
**Effort**: SMALL (1-2 hours)

**Description**:
POVM measurement fails loudly (throws errors) instead of returning graceful fallbacks. This is actually GOOD design (fail loudly rather than mock data), but inconsistent with other services.

**Issue**:
- Round-Trip: Returns fallback translations on error
- Maieutic: Returns fallback questions on error
- POVM: Throws errors immediately

**Recommendation**: Keep this behavior (fail loudly), but make it consistent across all services.

---

## 4. Summary and Recommendations

### The Fundamental Problem

V2 is built on **quantum-inspired terminology** without **quantum operations**. We're:
- Calling content analysis "POVM measurement"
- Calling embedding similarity "quantum state distance"
- Displaying ρ metrics without using them for guidance
- Marketing physics without doing physics

### Three Paths Forward

#### Path 1: Honest Rebranding (RECOMMENDED - 8 hours)
**Effort**: 8 hours
**Impact**: High credibility, moderate functionality

1. Rename "POVM measurement" → "Semantic Analysis"
2. Rename "Quantum State Distance" → "Embedding Similarity"
3. Rename "Density Matrix ρ" → "Text State Representation"
4. Document honestly: "Quantum-inspired approach using embeddings"
5. Focus on what works: Multi-dimensional content analysis

**Why This Works**:
- We're still doing something useful (content analysis)
- No false claims about physics
- Faster to market (no new research needed)
- Academic credibility maintained

---

#### Path 2: Make It Real (NOT RECOMMENDED - 200+ hours)
**Effort**: 200+ hours (3-6 months, PhD-level work)
**Impact**: Revolutionary if successful, high risk

1. Define projection operators for each POVM axis
2. Implement full 32×32 complex density matrices
3. Use ρ to actually guide transformations
4. Validate all quantum constraints
5. Publish academic paper on "Quantum NLP"

**Why This Is Hard**:
- Requires solving open research problems
- No clear mapping from embeddings to quantum operators
- May discover it's fundamentally impossible
- Cloudflare Workers can't handle complex math

**Recommendation**: Only pursue if you have quantum physics expertise on team.

---

#### Path 3: Hybrid Approach (VIABLE - 40 hours)
**Effort**: 40 hours
**Impact**: Moderate credibility, high functionality

1. Keep ρ as "embedding-based state representation"
2. Use ρ properties to guide transformation paths (fix DEBT-002)
3. Call POVM "multi-axis semantic measurement"
4. Add footnotes: "Inspired by quantum mechanics, not literal implementation"
5. Focus on practical value: "Math-backed transformation quality"

**Why This Works**:
- Acknowledges inspiration without false claims
- Makes ρ actually useful (guidance, not just display)
- Marketable: "Novel embedding-based approach"
- Achievable in reasonable timeframe

---

### Immediate Action Items (Phase 1 - 16 hours)

1. **Terminology Audit** (2 hours)
   - Find all uses of "quantum", "POVM", "measurement", "density matrix"
   - Decide: Keep with disclaimers OR rename completely

2. **Make ρ Useful** (8 hours)
   - Implement ρ-guided branching in allegorical transformation
   - Use purity/entropy to select transformation strategies
   - Prove that ρ adds value beyond display metrics

3. **Documentation** (4 hours)
   - Add "What is ρ?" explainer to all V2 responses
   - Write `/docs/quantum-reading` with honest explanation
   - Create visualization guidelines for ρ Inspector

4. **Fix Critical Bugs** (2 hours)
   - Re-enable auth on /v2/rho routes (DEBT-013)
   - Add validation to POVM measurements (DEBT-008)
   - Standardize error handling (DEBT-014)

### Phase 2 - Complete V2 Coverage (25 hours)

5. **Extend to All Transformations** (15 hours)
   - Add ρ tracking to Round-Trip (DEBT-006)
   - Add ρ tracking to Maieutic (DEBT-006)
   - Generalize verification system (DEBT-012)

6. **Build User-Facing Tools** (10 hours)
   - ρ Inspector panel (DEBT-009)
   - Session persistence (DEBT-010)
   - Comparison tools

### Phase 3 - Research Track (Optional, 200+ hours)

7. **Make It Legitimate** (if desired)
   - Hire quantum computing expert
   - Define proper POVM operators
   - Implement full ρ with coherences
   - Validate against quantum mechanics axioms

---

## 5. Success Criteria

**Before Launch**:
- [ ] Zero false claims about quantum mechanics in user-facing docs
- [ ] ρ used for guidance, not just display
- [ ] All "quantum" terminology either backed by math OR removed
- [ ] Verification system honest about what it checks
- [ ] Users can understand what ρ means for their text

**V2 Value Proposition**:
- [ ] Demonstrably better transformations than V1
- [ ] Math-backed quality guarantees
- [ ] Multi-dimensional content analysis
- [ ] Novel embedding-based state tracking

---

## 6. Contacts and Resources

**Technical Debt Champion**: TBD
**Quantum Physics Consultant**: NEEDED (if pursuing Path 2)
**Academic Review**: NEEDED before publishing papers

**Related Documents**:
- `/workers/npe-api/docs/MVP_FUNCTIONAL_SPEC.md` - Narrative sessions architecture
- `/workers/npe-api/docs/V1_V2_COMPARISON_AND_STRATEGY.md` - V1 vs V2 decision rationale
- `/workers/npe-api/docs/attributes_in_allegorical_transformation.md` - POVM verification design

**External References**:
- Nielsen & Chuang, "Quantum Computation and Quantum Information" (Chapter 2: Density Operators)
- Wikipedia: Positive Operator-Valued Measure
- arXiv: Papers on "Quantum Cognition" (closest related field)

---

**END OF TECHNICAL DEBT AUDIT**
