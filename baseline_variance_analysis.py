"""
Baseline Variance Analysis - POVM Reading Noise Floor

Purpose: Measure the same text multiple times to establish baseline variance
- How much do POVM readings fluctuate with identical input?
- What's the minimum detectable improvement (signal vs noise)?
- Are small improvements (0.01) statistically significant?

This helps answer:
1. Is 0.000 median improvement due to noise or real lack of change?
2. What's the minimum meaningful improvement threshold?
3. Are random operators too noisy to be useful?
"""

import sys
from pathlib import Path
import numpy as np
from statistics import mean, stdev
import time

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from humanizer.services.sentence_embedding import get_sentence_embedding_service
from humanizer.core.trm.density import construct_density_matrix, rho_distance
from humanizer.core.trm.povm import get_all_packs


def measure_text_repeatedly(text: str, n_iterations: int = 10, rank: int = 64):
    """
    Measure the same text multiple times and compute variance.

    Args:
        text: Text to measure
        n_iterations: Number of measurements
        rank: Density matrix rank

    Returns:
        Dict with measurements and statistics
    """
    print(f"\n{'='*80}")
    print(f"BASELINE VARIANCE ANALYSIS")
    print(f"{'='*80}")
    print(f"\nText: {text}")
    print(f"Iterations: {n_iterations}")
    print(f"Rank: {rank}")
    print(f"\n{'='*80}")

    # Get embedding service and POVM packs
    embedding_service = get_sentence_embedding_service()
    packs = get_all_packs(rank=rank)

    # Storage for results
    results = {
        pack_name: {
            op.name: [] for op in pack.operators
        }
        for pack_name, pack in packs.items()
    }

    embeddings = []
    rho_matrices = []

    # Run measurements
    print(f"\nRunning {n_iterations} measurements...")
    for i in range(n_iterations):
        # Embed text
        embedding = embedding_service.embed_text(text)
        embeddings.append(embedding)

        # Construct density matrix
        rho = construct_density_matrix(embedding, rank=rank)
        rho_matrices.append(rho)

        # Measure with all POVM packs
        for pack_name, pack in packs.items():
            readings = pack.measure(rho)
            for axis, prob in readings.items():
                results[pack_name][axis].append(prob)

        print(f"  Iteration {i+1}/{n_iterations} complete", end='\r')

    print(f"\n\nMeasurements complete!")

    return {
        'text': text,
        'n_iterations': n_iterations,
        'rank': rank,
        'embeddings': embeddings,
        'rho_matrices': rho_matrices,
        'povm_results': results,
    }


def analyze_variance(results):
    """
    Analyze variance in POVM readings.

    Args:
        results: Results from measure_text_repeatedly

    Returns:
        Dict with variance statistics
    """
    print(f"\n{'='*80}")
    print(f"VARIANCE ANALYSIS")
    print(f"{'='*80}\n")

    povm_results = results['povm_results']
    stats = {}

    for pack_name, axes in povm_results.items():
        print(f"\n{pack_name.upper()} PACK:")
        print(f"{'-'*80}")

        pack_stats = {}

        for axis, measurements in axes.items():
            mean_val = mean(measurements)
            std_val = stdev(measurements) if len(measurements) > 1 else 0.0
            min_val = min(measurements)
            max_val = max(measurements)
            range_val = max_val - min_val
            cv = (std_val / mean_val) if mean_val > 0 else 0  # Coefficient of variation

            pack_stats[axis] = {
                'mean': mean_val,
                'std': std_val,
                'min': min_val,
                'max': max_val,
                'range': range_val,
                'cv': cv,
                'measurements': measurements,
            }

            # Print statistics
            bar_mean = "█" * int(mean_val * 50)
            bar_std = "░" * int(std_val * 500)  # Scale up std for visibility

            print(f"  {axis:15s}: μ={mean_val:.4f} σ={std_val:.6f} range=[{min_val:.4f}, {max_val:.4f}]")
            print(f"                  {bar_mean} {bar_std}")

        stats[pack_name] = pack_stats

    return stats


def analyze_embedding_stability(results):
    """
    Analyze stability of embeddings themselves.

    Args:
        results: Results from measure_text_repeatedly
    """
    print(f"\n{'='*80}")
    print(f"EMBEDDING STABILITY ANALYSIS")
    print(f"{'='*80}\n")

    embeddings = results['embeddings']

    # Compute pairwise cosine similarities
    n = len(embeddings)
    similarities = []

    for i in range(n):
        for j in range(i+1, n):
            emb_i = embeddings[i]
            emb_j = embeddings[j]

            # Cosine similarity
            sim = np.dot(emb_i, emb_j) / (np.linalg.norm(emb_i) * np.linalg.norm(emb_j))
            similarities.append(sim)

    mean_sim = mean(similarities)
    std_sim = stdev(similarities) if len(similarities) > 1 else 0.0
    min_sim = min(similarities)
    max_sim = max(similarities)

    print(f"Embeddings (n={n}, dimension={len(embeddings[0])}):")
    print(f"  Mean similarity:   {mean_sim:.8f}")
    print(f"  Std similarity:    {std_sim:.8f}")
    print(f"  Range similarity:  [{min_sim:.8f}, {max_sim:.8f}]")

    if mean_sim > 0.9999:
        print(f"\n  ✅ EMBEDDINGS ARE DETERMINISTIC (similarity ≈ 1.0)")
        print(f"     Variance in POVM readings is from random operators, not embeddings")
    else:
        print(f"\n  ⚠️  EMBEDDINGS HAVE VARIATION (similarity < 1.0)")
        print(f"     Variance in POVM readings may be from embedding non-determinism")


def analyze_rho_stability(results):
    """
    Analyze stability of density matrices.

    Args:
        results: Results from measure_text_repeatedly
    """
    print(f"\n{'='*80}")
    print(f"DENSITY MATRIX STABILITY ANALYSIS")
    print(f"{'='*80}\n")

    rho_matrices = results['rho_matrices']

    # Compute pairwise trace distances
    n = len(rho_matrices)
    distances = []

    for i in range(n):
        for j in range(i+1, n):
            dist = rho_distance(rho_matrices[i], rho_matrices[j])
            distances.append(dist)

    mean_dist = mean(distances)
    std_dist = stdev(distances) if len(distances) > 1 else 0.0
    min_dist = min(distances)
    max_dist = max(distances)

    print(f"Density Matrices (n={n}, rank={results['rank']}):")
    print(f"  Mean trace distance:  {mean_dist:.8f}")
    print(f"  Std trace distance:   {std_dist:.8f}")
    print(f"  Range trace distance: [{min_dist:.8f}, {max_dist:.8f}]")

    if mean_dist < 0.0001:
        print(f"\n  ✅ DENSITY MATRICES ARE STABLE (distance ≈ 0)")
        print(f"     Variance in POVM readings is from operator measurement, not ρ")
    else:
        print(f"\n  ⚠️  DENSITY MATRICES VARY (distance > 0)")
        print(f"     Variance in POVM readings may be from ρ construction")


def compute_minimum_detectable_improvement(stats):
    """
    Compute minimum detectable improvement (2-sigma rule).

    Args:
        stats: Statistics from analyze_variance

    Returns:
        Dict with MDI per pack/axis
    """
    print(f"\n{'='*80}")
    print(f"MINIMUM DETECTABLE IMPROVEMENT (2σ)")
    print(f"{'='*80}\n")

    print(f"For an improvement to be statistically significant (95% confidence),")
    print(f"it must exceed 2 standard deviations (2σ) from baseline.\n")

    mdi_summary = {}

    for pack_name, axes in stats.items():
        print(f"\n{pack_name.upper()} PACK:")
        print(f"{'-'*80}")

        pack_mdi = {}

        for axis, axis_stats in axes.items():
            std = axis_stats['std']
            mdi = 2 * std  # 2-sigma rule

            pack_mdi[axis] = mdi

            # Compare to observed improvements
            observed_improvements = [0.0096, 0.0325, 0.0383, 0.0444]  # From investigation
            obs_mean = mean(observed_improvements)

            significance = "SIGNIFICANT ✅" if obs_mean > mdi else "NOT SIGNIFICANT ❌"

            print(f"  {axis:15s}: MDI = {mdi:.6f}  (observed avg: {obs_mean:.4f}) → {significance}")

        mdi_summary[pack_name] = pack_mdi

    return mdi_summary


def main():
    """Run baseline variance analysis"""

    # Test cases
    test_texts = [
        "I think this is pretty cool and worth checking out.",
        "The weather today feels nice.",
        "The proposal suggests some interesting ideas that might work.",
    ]

    all_results = []
    all_stats = []

    for text in test_texts:
        # Measure text 10 times
        results = measure_text_repeatedly(text, n_iterations=10, rank=64)

        # Analyze variance
        stats = analyze_variance(results)

        # Analyze embedding stability
        analyze_embedding_stability(results)

        # Analyze density matrix stability
        analyze_rho_stability(results)

        # Store results
        all_results.append(results)
        all_stats.append(stats)

        print(f"\n{'='*80}\n")

    # Compute minimum detectable improvement
    print(f"\n{'='*80}")
    print(f"AGGREGATE ANALYSIS ACROSS ALL TEXTS")
    print(f"{'='*80}")

    # Average stats across all texts
    aggregate_stats = {}
    for pack_name in all_stats[0].keys():
        aggregate_stats[pack_name] = {}
        for axis in all_stats[0][pack_name].keys():
            # Collect stds across all texts
            stds = [stats[pack_name][axis]['std'] for stats in all_stats]
            mean_std = mean(stds)

            aggregate_stats[pack_name][axis] = {
                'std': mean_std,
                'mean': mean([stats[pack_name][axis]['mean'] for stats in all_stats]),
            }

    # Compute MDI with aggregate stats
    mdi_summary = compute_minimum_detectable_improvement(aggregate_stats)

    # Summary
    print(f"\n{'='*80}")
    print(f"SUMMARY")
    print(f"{'='*80}\n")

    print(f"Baseline variance analysis complete!\n")
    print(f"Key findings:")
    print(f"  1. Measured {len(test_texts)} texts, 10 iterations each")
    print(f"  2. Computed variance for all 5 POVM packs")
    print(f"  3. Established minimum detectable improvement (MDI)")
    print(f"  4. Analyzed embedding and ρ stability\n")

    # Compute average MDI
    all_mdis = [mdi for pack in mdi_summary.values() for mdi in pack.values()]
    avg_mdi = mean(all_mdis)

    print(f"Average MDI across all axes: {avg_mdi:.6f}")
    print(f"Observed improvements: 0.0096 to 0.0444 (avg: 0.0287)")

    if avg_mdi < 0.01:
        print(f"\n✅ GOOD NEWS: Observed improvements ({0.0287:.4f}) exceed MDI ({avg_mdi:.6f})")
        print(f"   Small improvements like +0.01 ARE statistically significant!")
    else:
        print(f"\n❌ PROBLEM: MDI ({avg_mdi:.6f}) is comparable to improvements ({0.0287:.4f})")
        print(f"   Random operators may be too noisy to detect semantic shifts")

    print(f"\nNext step: Use these baseline values to interpret evaluation results")
    print(f"\n{'='*80}\n")

    return all_results, all_stats, mdi_summary


if __name__ == "__main__":
    main()
