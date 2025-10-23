"""
Week 7 Hybrid Strategy Evaluation - Comprehensive Test Suite

Compares performance of:
1. Hybrid Rules + GFS (Week 7)
2. Pure GFS (Week 5)
3. Pure Rules (Week 6)

Success criteria:
- Hybrid success rate: 40-50% (target)
- Cost reduction: 30-50% vs pure GFS
- Speed: 5-7s per transformation

Test approach:
- 10 diverse texts
- 3 axes (tetralemma/A, tetralemma/¬A, tone/analytical)
- 30 total transformation attempts per strategy
- Track: success rate, improvement, cost, speed, candidate source
"""

import time
import json
from typing import Dict, List, Tuple
from pathlib import Path

from humanizer.services.transformation_engine import (
    HybridTransformationStrategy,
    LLMGuidedStrategy,
    TransformationContext
)
from humanizer.services.rule_based_transformer import RuleBasedTransformer


# Test texts (diverse examples)
TEST_TEXTS = [
    "I think the main issue here is that we're not clearly defining our goals.",
    "Maybe we should consider a different approach to this problem.",
    "The data shows some interesting patterns that we should explore.",
    "There are several factors we need to take into account here.",
    "This could be a useful way to improve our understanding.",
    "I think we might want to reconsider this approach.",
    "Perhaps there's a middle ground we haven't considered.",
    "I feel like this might be heading in the wrong direction.",
    "The research demonstrates clear empirical evidence.",
    "Maybe we should add more tests to verify this behavior.",
]

# Test axes (focus on those with learned rules)
TEST_AXES = [
    ("tetralemma", "A"),      # Affirmative - remove hedging
    ("tetralemma", "¬A"),     # Negating - add negation
    ("tone", "analytical"),   # Analytical - vague to specific
]


def test_hybrid_strategy():
    """Test Hybrid Rules + GFS strategy (Week 7)."""
    print("=" * 80)
    print("TESTING HYBRID RULES + GFS STRATEGY (Week 7)")
    print("=" * 80)

    strategy = HybridTransformationStrategy(
        num_rule_candidates=8,
        num_llm_candidates=5,
        max_retries=2  # Reduced for testing speed
    )

    results = []
    total_time = 0
    total_cost = 0

    for text in TEST_TEXTS:
        print(f"\n{'─' * 80}")
        print(f'Text: "{text[:60]}..."')

        for pack_name, target_axis in TEST_AXES:
            axis_key = f"{pack_name}/{target_axis}"
            print(f"\n  Testing {axis_key}...")

            # Create context
            context = TransformationContext(
                text=text,
                target_axis=target_axis,
                povm_pack_name=pack_name,
                current_readings={},  # Will be measured in transform()
                target_threshold=0.01,
                max_change_ratio=0.4
            )

            # Transform
            start = time.time()
            result = strategy.transform(context)
            elapsed = time.time() - start

            total_time += elapsed
            total_cost += result.cost_usd

            # Record result
            results.append({
                "text": text,
                "axis": axis_key,
                "success": result.success,
                "improvement": result.target_improvement,
                "text_change": result.text_change_ratio,
                "coherence": result.semantic_coherence,
                "time_ms": result.execution_time_ms,
                "cost_usd": result.cost_usd,
                "source": result.rules_applied[0] if result.rules_applied else "unknown"
            })

            if result.success:
                print(f"    ✅ Success: {result.target_improvement:+.3f} improvement")
                print(f"       Source: {result.rules_applied[0] if result.rules_applied else 'unknown'}")
                print(f"       Text: \"{result.transformed_text[:60]}...\"")
            else:
                print(f"    ❌ Failed: {result.error_message}")

    # Summary
    print(f"\n{'=' * 80}")
    print("HYBRID STRATEGY SUMMARY")
    print(f"{'=' * 80}")

    successes = [r for r in results if r["success"]]
    success_rate = len(successes) / len(results)

    print(f"Total tests: {len(results)}")
    print(f"Successes: {len(successes)}")
    print(f"Success rate: {success_rate:.1%} (target: 40-50%)")

    if successes:
        avg_improvement = sum(r["improvement"] for r in successes) / len(successes)
        avg_text_change = sum(r["text_change"] for r in successes) / len(successes)
        avg_coherence = sum(r["coherence"] for r in successes) / len(successes)

        print(f"Avg improvement: {avg_improvement:+.3f}")
        print(f"Avg text change: {avg_text_change:.1%}")
        print(f"Avg coherence: {avg_coherence:.2f}")

    print(f"Total time: {total_time:.1f}s")
    print(f"Avg time: {total_time/len(results):.1f}s per transformation")
    print(f"Total cost: ${total_cost:.4f}")
    print(f"Avg cost: ${total_cost/len(results):.6f} per transformation")

    # Candidate source analysis
    rule_sources = [r for r in successes if "rule:" in r["source"]]
    llm_sources = [r for r in successes if r["source"] == "llm"]

    print(f"\nCandidate Source Analysis:")
    print(f"  Rule candidates: {len(rule_sources)}/{len(successes)} successes ({len(rule_sources)/len(successes):.1%})")
    print(f"  LLM candidates: {len(llm_sources)}/{len(successes)} successes ({len(llm_sources)/len(successes):.1%})")

    return results


def test_pure_gfs_strategy():
    """Test Pure GFS strategy (Week 5 baseline)."""
    print("\n" + "=" * 80)
    print("TESTING PURE GFS STRATEGY (Week 5 Baseline)")
    print("=" * 80)

    strategy = LLMGuidedStrategy(
        num_candidates=10,  # Week 5 default
        max_retries=2
    )

    results = []
    total_time = 0
    total_cost = 0

    for text in TEST_TEXTS[:5]:  # Test on fewer texts to save cost/time
        print(f"\n{'─' * 80}")
        print(f'Text: "{text[:60]}..."')

        for pack_name, target_axis in TEST_AXES[:2]:  # Only 2 axes
            axis_key = f"{pack_name}/{target_axis}"
            print(f"\n  Testing {axis_key}...")

            context = TransformationContext(
                text=text,
                target_axis=target_axis,
                povm_pack_name=pack_name,
                current_readings={},
                target_threshold=0.01,
                max_change_ratio=0.4
            )

            start = time.time()
            result = strategy.transform(context)
            elapsed = time.time() - start

            total_time += elapsed
            total_cost += result.cost_usd

            results.append({
                "text": text,
                "axis": axis_key,
                "success": result.success,
                "improvement": result.target_improvement,
                "time_ms": result.execution_time_ms,
                "cost_usd": result.cost_usd
            })

            if result.success:
                print(f"    ✅ Success: {result.target_improvement:+.3f}")
            else:
                print(f"    ❌ Failed")

    # Summary
    print(f"\n{'=' * 80}")
    print("PURE GFS SUMMARY")
    print(f"{'=' * 80}")

    successes = [r for r in results if r["success"]]
    success_rate = len(successes) / len(results) if results else 0

    print(f"Total tests: {len(results)}")
    print(f"Successes: {len(successes)}")
    print(f"Success rate: {success_rate:.1%}")
    print(f"Total cost: ${total_cost:.4f}")
    print(f"Avg cost: ${total_cost/len(results):.6f} per transformation")

    return results


def test_pure_rules_strategy():
    """Test Pure Rules strategy (Week 6 baseline)."""
    print("\n" + "=" * 80)
    print("TESTING PURE RULES STRATEGY (Week 6 Baseline)")
    print("=" * 80)

    transformer = RuleBasedTransformer()

    results = []

    for text in TEST_TEXTS:
        print(f"\n{'─' * 80}")
        print(f'Text: "{text[:60]}..."')

        for pack_name, target_axis in TEST_AXES:
            axis_key = f"{pack_name}/{target_axis}"

            result = transformer.transform(
                text,
                pack_name,
                target_axis,
                min_improvement=0.01,
                max_text_change=0.4
            )

            results.append({
                "text": text,
                "axis": axis_key,
                "success": result.success,
                "improvement": result.improvement if result.success else 0.0
            })

            if result.success:
                print(f"  ✅ {axis_key}: {result.improvement:+.3f}")
            else:
                print(f"  ❌ {axis_key}: No valid transformation")

    # Summary
    print(f"\n{'=' * 80}")
    print("PURE RULES SUMMARY")
    print(f"{'=' * 80}")

    successes = [r for r in results if r["success"]]
    success_rate = len(successes) / len(results)

    print(f"Total tests: {len(results)}")
    print(f"Successes: {len(successes)}")
    print(f"Success rate: {success_rate:.1%}")
    print(f"Cost: $0.00 (no LLM calls)")

    return results


def compare_strategies(hybrid_results, gfs_results, rules_results):
    """Compare all three strategies."""
    print("\n" + "=" * 80)
    print("STRATEGY COMPARISON")
    print("=" * 80)

    # Success rates
    hybrid_success = len([r for r in hybrid_results if r["success"]]) / len(hybrid_results)
    gfs_success = len([r for r in gfs_results if r["success"]]) / len(gfs_results) if gfs_results else 0
    rules_success = len([r for r in rules_results if r["success"]]) / len(rules_results)

    # Costs
    hybrid_cost = sum(r["cost_usd"] for r in hybrid_results) / len(hybrid_results)
    gfs_cost = sum(r["cost_usd"] for r in gfs_results) / len(gfs_results) if gfs_results else 0

    print("\nSuccess Rates:")
    print(f"  Hybrid (Week 7):    {hybrid_success:.1%} {'✅ TARGET MET' if hybrid_success >= 0.40 else '⚠️  Below target'}")
    print(f"  Pure GFS (Week 5):  {gfs_success:.1%}")
    print(f"  Pure Rules (Week 6): {rules_success:.1%}")

    print("\nCost per Transformation:")
    print(f"  Hybrid:  ${hybrid_cost:.6f}")
    print(f"  Pure GFS: ${gfs_cost:.6f}")
    if gfs_cost > 0:
        cost_reduction = (gfs_cost - hybrid_cost) / gfs_cost
        print(f"  Cost reduction: {cost_reduction:.1%} {'✅' if cost_reduction >= 0.30 else '⚠️'}")

    print("\nKey Findings:")
    if hybrid_success > gfs_success:
        print(f"  ✅ Hybrid outperforms pure GFS by {(hybrid_success - gfs_success):.1%}")
    if hybrid_success > rules_success:
        print(f"  ✅ Hybrid outperforms pure rules by {(hybrid_success - rules_success):.1%}")

    # Overall assessment
    print(f"\n{'=' * 80}")
    if hybrid_success >= 0.40 and (gfs_cost > 0 and (gfs_cost - hybrid_cost) / gfs_cost >= 0.30):
        print("🎉 SUCCESS! Hybrid strategy meets both targets:")
        print("   • Success rate ≥ 40%")
        print("   • Cost reduction ≥ 30%")
    elif hybrid_success >= 0.40:
        print("⚠️  PARTIAL SUCCESS: High success rate but cost reduction below target")
    elif gfs_cost > 0 and (gfs_cost - hybrid_cost) / gfs_cost >= 0.30:
        print("⚠️  PARTIAL SUCCESS: Good cost reduction but success rate below target")
    else:
        print("❌ TARGETS NOT MET: Needs optimization")

    return {
        "hybrid_success_rate": hybrid_success,
        "gfs_success_rate": gfs_success,
        "rules_success_rate": rules_success,
        "cost_reduction": (gfs_cost - hybrid_cost) / gfs_cost if gfs_cost > 0 else 0
    }


def main():
    """Run complete evaluation."""
    print("=" * 80)
    print("WEEK 7: HYBRID RULES + GFS - COMPREHENSIVE EVALUATION")
    print("=" * 80)
    print("\nThis will test 3 strategies:")
    print("1. Hybrid Rules + GFS (Week 7) - 30 transformations")
    print("2. Pure GFS (Week 5) - 10 transformations (reduced for cost)")
    print("3. Pure Rules (Week 6) - 30 transformations (free)")
    print("\nEstimated time: 5-10 minutes")
    print("Estimated cost: ~$0.01-0.02")
    print("=" * 80)

    input("\nPress Enter to start evaluation...")

    # Test all strategies
    print("\n\n")
    hybrid_results = test_hybrid_strategy()

    print("\n\n")
    gfs_results = test_pure_gfs_strategy()

    print("\n\n")
    rules_results = test_pure_rules_strategy()

    # Compare
    comparison = compare_strategies(hybrid_results, gfs_results, rules_results)

    # Save results
    output = {
        "hybrid_results": hybrid_results,
        "gfs_results": gfs_results,
        "rules_results": rules_results,
        "comparison": comparison
    }

    output_path = Path("week7_evaluation_results.json")
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n✅ Results saved to {output_path}")
    print(f"\n{'=' * 80}")


if __name__ == "__main__":
    main()
