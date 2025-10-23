"""
Semantic Operator Feasibility Study

Purpose: Prototype semantic POVM operator construction and validate approach
- Build "analytical" operator from corpus of analytical texts
- Test if semantic operator detects analytical content better than random
- Measure variance reduction compared to baseline

This proves:
1. Semantic operators CAN be built from corpus
2. Semantic operators reduce measurement variance
3. Semantic operators capture semantic properties (not just math)
"""

import sys
from pathlib import Path
import numpy as np
from statistics import mean, stdev
from typing import List

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from humanizer.services.sentence_embedding import get_sentence_embedding_service
from humanizer.core.trm.density import construct_density_matrix
from humanizer.core.trm.povm import POVMOperator, POVMPack


# ============================================================================
# Corpus: Analytical vs Non-Analytical Texts
# ============================================================================

ANALYTICAL_CORPUS = [
    "The empirical data demonstrates a statistically significant correlation between variables A and B.",
    "Systematic analysis reveals three distinct patterns in the dataset.",
    "The methodology employed rigorous controls to eliminate confounding factors.",
    "Quantitative assessment indicates a 23% increase in efficiency metrics.",
    "The framework provides a structured approach to decomposing complex systems.",
    "Evidence suggests that hypothesis H1 is supported by observations.",
    "The model predicts outcomes with 87% accuracy across test cases.",
    "Comparative analysis shows significant differences between treatment groups.",
    "The algorithm optimizes for minimal computational complexity.",
    "Statistical tests confirm the hypothesis with p < 0.01.",
    "The system architecture follows established design principles.",
    "Experimental results validate the theoretical predictions.",
    "The analysis framework decomposes the problem into tractable subcomponents.",
    "Measurement precision was ensured through calibrated instrumentation.",
    "The logical structure of the argument proceeds deductively from axioms.",
]

NON_ANALYTICAL_CORPUS = [
    "I think this is pretty cool and worth checking out!",
    "The weather today feels really nice.",
    "That sounds like a great idea to me.",
    "I love how this makes me feel.",
    "This reminds me of a fun time I had.",
    "Wow, that's so interesting!",
    "I really enjoy this kind of thing.",
    "It seems like a good approach.",
    "I'm excited to see what happens next.",
    "That would be amazing if it works!",
    "I feel like this could be helpful.",
    "This is one of my favorite topics.",
    "I wonder what will come of this.",
    "That sounds familiar to me.",
    "I appreciate the effort put into this.",
]


# ============================================================================
# Semantic Operator Construction
# ============================================================================

def build_semantic_operator(
    corpus: List[str],
    operator_name: str,
    rank: int = 64,
) -> POVMOperator:
    """
    Build semantic POVM operator from corpus.

    Process:
    1. Embed all corpus texts
    2. Compute mean embedding (concept center)
    3. Compute covariance matrix (low-rank)
    4. Construct operator from Gaussian-like distribution
    5. Ensure PSD property: E = B @ B.T

    Args:
        corpus: List of exemplar texts for this concept
        operator_name: Name of the operator (e.g., "analytical")
        rank: Density matrix rank

    Returns:
        Semantic POVMOperator
    """
    print(f"\n{'='*80}")
    print(f"BUILDING SEMANTIC OPERATOR: {operator_name}")
    print(f"{'='*80}\n")

    embedding_service = get_sentence_embedding_service()

    # Step 1: Embed all corpus texts
    print(f"Embedding {len(corpus)} corpus texts...")
    embeddings = []
    for text in corpus:
        emb = embedding_service.embed_text(text)
        embeddings.append(emb)

    embeddings = np.array(embeddings)  # Shape: (n_samples, embedding_dim)
    embedding_dim = embeddings.shape[1]
    print(f"  Corpus embeddings shape: {embeddings.shape}")

    # Step 2: Compute mean embedding (concept center)
    mean_embedding = np.mean(embeddings, axis=0)
    print(f"  Mean embedding computed (dim: {len(mean_embedding)})")

    # Step 3: Compute covariance matrix
    # Center embeddings
    centered = embeddings - mean_embedding
    # Covariance: (d × d) - too large, use low-rank approximation
    # Instead, compute SVD of centered embeddings
    U, S, Vt = np.linalg.svd(centered.T, full_matrices=False)  # Transpose: (d × n)

    # Keep top-k components for low-rank covariance
    k = min(20, len(S))  # Low-rank approximation
    U_k = U[:, :k]
    S_k = S[:k]

    print(f"  Low-rank covariance: {k} components explain {np.sum(S_k**2) / np.sum(S**2):.2%} variance")

    # Step 4: Create projection matrix from concept
    # Use PCA-like projection: project to subspace spanned by concept
    # This is semantically meaningful: projects onto dimensions of variation in analytical texts

    # Simple approach: Use mean embedding as primary direction
    # Add low-rank covariance for spread
    projection_matrix = np.zeros((embedding_dim, rank))

    # Fill with mean-centered directions
    for i in range(min(rank, len(mean_embedding))):
        if i == 0:
            # First direction: concept center
            projection_matrix[:, i] = mean_embedding / np.linalg.norm(mean_embedding)
        elif i <= k:
            # Next directions: principal components of corpus
            projection_matrix[:, i] = U_k[:, i-1]
        else:
            # Remaining directions: orthogonal random (less important)
            vec = np.random.randn(embedding_dim)
            # Gram-Schmidt orthogonalization
            for j in range(i):
                vec -= np.dot(vec, projection_matrix[:, j]) * projection_matrix[:, j]
            if np.linalg.norm(vec) > 1e-10:
                projection_matrix[:, i] = vec / np.linalg.norm(vec)

    print(f"  Projection matrix created: {projection_matrix.shape}")

    # Step 5: Construct operator B factor matrix
    # PROTOTYPE-BASED APPROACH: Create operator from mean embedding
    # Theory: E should measure "proximity to concept center" in projected space
    #
    # Strategy:
    # 1. Project mean embedding to rank-d subspace
    # 2. Create E as outer product: E = v @ v.T (rank-1 operator)
    # 3. Decompose to get B such that E = B @ B.T
    #
    # This makes E respond maximally to embeddings similar to the mean

    # Project mean embedding to rank-d subspace
    mean_projected = projection_matrix.T @ mean_embedding  # Shape: (rank,)
    mean_projected = mean_projected / np.linalg.norm(mean_projected)  # Normalize

    print(f"  Mean embedding projected to rank-{rank} subspace")

    # Create rank-1 operator from projected mean
    # E = α * (v @ v.T) where v is the projected mean, α is scaling factor
    # We want E to be a valid POVM element, so scale appropriately

    # For now, use simple rank-1 construction
    # B = √α * v as a column vector, so B @ B.T = α * (v @ v.T)

    # Choose α such that E has reasonable magnitude
    # Since operators sum to identity, and we have ~4 operators per pack,
    # each should have trace ≈ rank/4
    target_trace = rank / 4.0
    alpha = target_trace  # Since trace(v @ v.T) = ||v||² = 1 (normalized)

    # Create B as rank × 1 matrix (single column)
    # Then pad to rank × rank for compatibility
    B = np.zeros((rank, rank))
    B[:, 0] = np.sqrt(alpha) * mean_projected

    print(f"  Rank-1 operator constructed (target trace: {target_trace:.2f})")

    print(f"  Factor matrix B created: {B.shape}")
    print(f"  Operator ready!")

    # Create POVMOperator
    operator = POVMOperator(name=operator_name, B=B)

    # Store projection matrix for consistent ρ construction
    operator._projection_matrix = projection_matrix  # Store for later use

    return operator


# ============================================================================
# Testing and Validation
# ============================================================================

def test_operator_discrimination(
    operator: POVMOperator,
    positive_corpus: List[str],
    negative_corpus: List[str],
    n_iterations: int = 5,
) -> dict:
    """
    Test if semantic operator discriminates between positive and negative examples.

    Args:
        operator: Semantic operator to test
        positive_corpus: Texts that SHOULD score high (e.g., analytical texts)
        negative_corpus: Texts that SHOULD score low (e.g., informal texts)
        n_iterations: Measurements per text to compute variance

    Returns:
        Dict with discrimination metrics
    """
    print(f"\n{'='*80}")
    print(f"TESTING OPERATOR DISCRIMINATION")
    print(f"{'='*80}\n")

    embedding_service = get_sentence_embedding_service()
    rank = operator.B.shape[0]

    # Use semantic operator's projection matrix if available
    projection_matrix = getattr(operator, '_projection_matrix', None)

    positive_scores = []
    negative_scores = []
    positive_variances = []
    negative_variances = []

    # Test positive examples
    print(f"Testing {len(positive_corpus)} positive examples...")
    for text in positive_corpus:
        scores = []
        for _ in range(n_iterations):
            emb = embedding_service.embed_text(text)
            rho = construct_density_matrix(emb, rank=rank, projection_matrix=projection_matrix)
            score = operator.measure(rho)
            scores.append(score)

        mean_score = mean(scores)
        var_score = stdev(scores) if len(scores) > 1 else 0.0

        positive_scores.append(mean_score)
        positive_variances.append(var_score)

    # Test negative examples
    print(f"Testing {len(negative_corpus)} negative examples...")
    for text in negative_corpus:
        scores = []
        for _ in range(n_iterations):
            emb = embedding_service.embed_text(text)
            rho = construct_density_matrix(emb, rank=rank, projection_matrix=projection_matrix)
            score = operator.measure(rho)
            scores.append(score)

        mean_score = mean(scores)
        var_score = stdev(scores) if len(scores) > 1 else 0.0

        negative_scores.append(mean_score)
        negative_variances.append(var_score)

    # Compute statistics
    pos_mean = mean(positive_scores)
    pos_std = stdev(positive_scores) if len(positive_scores) > 1 else 0.0
    pos_var_mean = mean(positive_variances)

    neg_mean = mean(negative_scores)
    neg_std = stdev(negative_scores) if len(negative_scores) > 1 else 0.0
    neg_var_mean = mean(negative_variances)

    separation = pos_mean - neg_mean
    pooled_std = np.sqrt((pos_std**2 + neg_std**2) / 2)
    effect_size = separation / pooled_std if pooled_std > 0 else 0  # Cohen's d

    # Print results
    print(f"\nRESULTS:")
    print(f"{'='*80}")
    print(f"\nPositive Examples (should score HIGH):")
    print(f"  Mean score:     {pos_mean:.4f}")
    print(f"  Std across:     {pos_std:.4f}")
    print(f"  Avg variance:   {pos_var_mean:.6f}")

    print(f"\nNegative Examples (should score LOW):")
    print(f"  Mean score:     {neg_mean:.4f}")
    print(f"  Std across:     {neg_std:.4f}")
    print(f"  Avg variance:   {neg_var_mean:.6f}")

    print(f"\nDiscrimination:")
    print(f"  Separation:     {separation:.4f}")
    print(f"  Effect size:    {effect_size:.2f} (Cohen's d)")

    if effect_size > 0.8:
        print(f"  Assessment:     ✅ STRONG discrimination (d > 0.8)")
    elif effect_size > 0.5:
        print(f"  Assessment:     ✓  MODERATE discrimination (d > 0.5)")
    elif effect_size > 0.2:
        print(f"  Assessment:     ~  WEAK discrimination (d > 0.2)")
    else:
        print(f"  Assessment:     ❌ NO discrimination (d < 0.2)")

    return {
        'positive_mean': pos_mean,
        'positive_std': pos_std,
        'positive_var_mean': pos_var_mean,
        'negative_mean': neg_mean,
        'negative_std': neg_std,
        'negative_var_mean': neg_var_mean,
        'separation': separation,
        'effect_size': effect_size,
    }


def compare_to_random_operator(
    semantic_operator: POVMOperator,
    test_corpus: List[str],
    n_random_trials: int = 5,
) -> dict:
    """
    Compare semantic operator variance to random operators.

    Args:
        semantic_operator: Semantic operator to test
        test_corpus: Texts to measure
        n_random_trials: Number of random operators to compare against

    Returns:
        Dict with variance comparison
    """
    print(f"\n{'='*80}")
    print(f"COMPARING TO RANDOM OPERATORS")
    print(f"{'='*80}\n")

    embedding_service = get_sentence_embedding_service()
    rank = semantic_operator.B.shape[0]

    # Test semantic operator
    print(f"Testing semantic operator...")
    semantic_variances = []

    for text in test_corpus[:5]:  # Use subset for speed
        scores = []
        projection_matrix = getattr(semantic_operator, '_projection_matrix', None)

        for _ in range(10):
            emb = embedding_service.embed_text(text)
            rho = construct_density_matrix(emb, rank=rank, projection_matrix=projection_matrix)
            score = semantic_operator.measure(rho)
            scores.append(score)

        var = stdev(scores) if len(scores) > 1 else 0.0
        semantic_variances.append(var)

    semantic_avg_var = mean(semantic_variances)

    # Test random operators
    print(f"Testing {n_random_trials} random operators...")
    random_variances_all = []

    for trial in range(n_random_trials):
        # Create random operator
        B_random = np.random.randn(rank, rank) / np.sqrt(rank)
        random_op = POVMOperator(name=f"random_{trial}", B=B_random)

        trial_variances = []
        for text in test_corpus[:5]:
            scores = []
            for _ in range(10):
                emb = embedding_service.embed_text(text)
                rho = construct_density_matrix(emb, rank=rank, projection_matrix=None)  # Random projection
                score = random_op.measure(rho)
                scores.append(score)

            var = stdev(scores) if len(scores) > 1 else 0.0
            trial_variances.append(var)

        random_variances_all.append(mean(trial_variances))

    random_avg_var = mean(random_variances_all)
    random_std_var = stdev(random_variances_all) if len(random_variances_all) > 1 else 0.0

    # Compare
    variance_reduction = (random_avg_var - semantic_avg_var) / random_avg_var if random_avg_var > 0 else 0.0
    improvement_factor = random_avg_var / semantic_avg_var if semantic_avg_var > 0 else float('inf')

    print(f"\nRESULTS:")
    print(f"{'='*80}")
    print(f"\nSemantic Operator:")
    print(f"  Avg variance:   {semantic_avg_var:.6f}")

    print(f"\nRandom Operators (n={n_random_trials}):")
    print(f"  Avg variance:   {random_avg_var:.6f} ± {random_std_var:.6f}")

    print(f"\nComparison:")
    print(f"  Variance reduction: {variance_reduction:.1%}")
    print(f"  Improvement factor: {improvement_factor:.2f}x")

    if variance_reduction > 0.50:
        print(f"  Assessment:     ✅ MAJOR improvement (>50% reduction)")
    elif variance_reduction > 0.25:
        print(f"  Assessment:     ✓  MODERATE improvement (>25% reduction)")
    elif variance_reduction > 0.10:
        print(f"  Assessment:     ~  MINOR improvement (>10% reduction)")
    else:
        print(f"  Assessment:     ❌ NO improvement (<10% reduction)")

    return {
        'semantic_variance': semantic_avg_var,
        'random_variance': random_avg_var,
        'variance_reduction': variance_reduction,
        'improvement_factor': improvement_factor,
    }


# ============================================================================
# Main Feasibility Study
# ============================================================================

def main():
    """Run semantic operator feasibility study"""

    print(f"\n{'='*80}")
    print(f" SEMANTIC OPERATOR FEASIBILITY STUDY ".center(80, '='))
    print(f"{'='*80}\n")

    print(f"Goal: Prove semantic operators can be built and work better than random\n")

    # Step 1: Build semantic "analytical" operator
    analytical_operator = build_semantic_operator(
        corpus=ANALYTICAL_CORPUS,
        operator_name="analytical",
        rank=64,
    )

    # Step 2: Test discrimination
    discrimination_results = test_operator_discrimination(
        operator=analytical_operator,
        positive_corpus=ANALYTICAL_CORPUS[:10],  # Use subset for testing
        negative_corpus=NON_ANALYTICAL_CORPUS[:10],
        n_iterations=5,
    )

    # Step 3: Compare to random operators
    comparison_results = compare_to_random_operator(
        semantic_operator=analytical_operator,
        test_corpus=ANALYTICAL_CORPUS,
        n_random_trials=5,
    )

    # Summary
    print(f"\n{'='*80}")
    print(f" FEASIBILITY STUDY SUMMARY ".center(80, '='))
    print(f"{'='*80}\n")

    print(f"✅ Semantic operator successfully constructed from corpus")
    print(f"   ({len(ANALYTICAL_CORPUS)} analytical texts)")
    print(f"\n")

    # Check if feasibility criteria met
    criteria_met = []

    # Criterion 1: Discrimination
    if discrimination_results['effect_size'] > 0.5:
        print(f"✅ CRITERION 1: Operator discriminates analytical vs non-analytical")
        print(f"   Effect size: {discrimination_results['effect_size']:.2f} (Cohen's d)")
        print(f"   Separation: {discrimination_results['separation']:.4f}")
        criteria_met.append(True)
    else:
        print(f"❌ CRITERION 1: Weak discrimination")
        print(f"   Effect size: {discrimination_results['effect_size']:.2f}")
        criteria_met.append(False)

    print(f"\n")

    # Criterion 2: Variance reduction
    if comparison_results['variance_reduction'] > 0.25:
        print(f"✅ CRITERION 2: Variance reduced vs random operators")
        print(f"   Reduction: {comparison_results['variance_reduction']:.1%}")
        print(f"   Improvement: {comparison_results['improvement_factor']:.2f}x")
        criteria_met.append(True)
    else:
        print(f"❌ CRITERION 2: Insufficient variance reduction")
        print(f"   Reduction: {comparison_results['variance_reduction']:.1%}")
        criteria_met.append(False)

    print(f"\n")

    # Final verdict
    if all(criteria_met):
        print(f"{'='*80}")
        print(f"🎉 FEASIBILITY CONFIRMED ".center(80))
        print(f"{'='*80}")
        print(f"\nSemantic operators:")
        print(f"  ✅ CAN be built from corpus")
        print(f"  ✅ DO discriminate semantic properties")
        print(f"  ✅ DO reduce measurement variance")
        print(f"\n👉 Proceed with Week 2: Full semantic operator implementation")
    else:
        print(f"{'='*80}")
        print(f"⚠️  FEASIBILITY UNCERTAIN ".center(80))
        print(f"{'='*80}")
        print(f"\nSome criteria not met. May need adjustments to approach.")

    print(f"\n{'='*80}\n")

    return analytical_operator, discrimination_results, comparison_results


if __name__ == "__main__":
    main()
