"""
Test GFS with increased number of candidates (10 vs 5)

Week 5 Phase 1 - Option A: Improve candidate generation
"""

from humanizer.services.transformation_engine import (
    LLMGuidedStrategy,
    TransformationContext,
)
from humanizer.services.sentence_embedding import get_sentence_embedding_service
from humanizer.core.trm.density import construct_density_matrix
from humanizer.services.operator_learning import load_all_operators

# Test texts
TEST_TEXTS = [
    "I think the main issue here is that we're not clearly defining our goals.",
    "Maybe we should consider a different approach to this problem.",
    "The data shows some interesting patterns that we should explore.",
]

TEST_TARGETS = [
    ("tetralemma", "A"),  # Affirming
    ("tone", "analytical"),
    ("tone", "critical"),
]


def get_initial_readings(text: str, pack_name: str):
    """Get initial POVM readings for text."""
    embedding_service = get_sentence_embedding_service()
    embedding = embedding_service.embed_text(text)
    rho = construct_density_matrix(embedding, rank=64)
    semantic_packs_dict = load_all_operators()
    pack = semantic_packs_dict[pack_name].to_povm_pack()
    readings = pack.measure(rho)
    return readings


def run_test(num_candidates: int):
    """Run test with specified number of candidates."""
    print(f"\n{'=' * 80}")
    print(f"TESTING WITH {num_candidates} CANDIDATES")
    print(f"{'=' * 80}")

    strategy = LLMGuidedStrategy(
        rank=64,
        num_candidates=num_candidates,
        max_retries=2  # Reduce retries to save time
    )

    results = []
    total_success = 0
    total_improvement = 0.0

    for i, (text, (pack_name, target_axis)) in enumerate(zip(TEST_TEXTS, TEST_TARGETS), 1):
        print(f"\nTest {i}/{len(TEST_TEXTS)}: {pack_name} → {target_axis}")
        print(f"Text: \"{text[:60]}...\"")

        initial_readings = get_initial_readings(text, pack_name)

        context = TransformationContext(
            text=text,
            target_axis=target_axis,
            povm_pack_name=pack_name,
            current_readings=initial_readings,
            target_threshold=0.65,
            max_change_ratio=0.4
        )

        result = strategy.transform(context)

        print(f"  {'✅' if result.success else '❌'} Improvement: {result.target_improvement:+.3f}, "
              f"Change: {result.text_change_ratio:.1%}, "
              f"Time: {result.execution_time_ms:.0f}ms")

        results.append(result)
        if result.success:
            total_success += 1
        total_improvement += result.target_improvement

    # Summary
    success_rate = total_success / len(results)
    avg_improvement = total_improvement / len(results)

    print(f"\n{'─' * 80}")
    print(f"RESULTS ({num_candidates} candidates):")
    print(f"  Success rate: {success_rate:.1%}")
    print(f"  Avg improvement: {avg_improvement:+.3f}")

    return success_rate, avg_improvement


if __name__ == "__main__":
    print("=" * 80)
    print("TESTING: IMPACT OF CANDIDATE COUNT ON SUCCESS RATE")
    print("=" * 80)

    # Test with 5 candidates (baseline)
    success_5, improvement_5 = run_test(5)

    # Test with 10 candidates
    success_10, improvement_10 = run_test(10)

    # Compare
    print(f"\n{'=' * 80}")
    print("COMPARISON")
    print(f"{'=' * 80}")
    print(f"5 candidates:  {success_5:.1%} success, {improvement_5:+.3f} avg improvement")
    print(f"10 candidates: {success_10:.1%} success, {improvement_10:+.3f} avg improvement")

    if success_5 > 0:
        pct_change = (success_10 - success_5) / success_5 * 100
        print(f"\nImprovement: {pct_change:+.1f}% success rate change")
    else:
        print(f"\nImprovement: {success_10:.1%} success (up from 0%)")

    if success_10 >= 0.5:
        print("\n🎉 SUCCESS! Achieved >50% success rate with 10 candidates!")
    elif success_10 > success_5:
        print(f"\n✅ Better! Success rate improved from {success_5:.1%} to {success_10:.1%}")
    else:
        print(f"\n❌ No improvement. Need different approach.")
