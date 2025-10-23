"""
Test GFS (Generate-Filter-Select) implementation

Week 5 Phase 1: Validate programmatic constraint enforcement
"""

import asyncio
from humanizer.services.transformation_engine import (
    LLMGuidedStrategy,
    TransformationContext,
    TransformationMethod
)
from humanizer.services.sentence_embedding import get_sentence_embedding_service

# Test texts from ChatGPT archive
TEST_TEXTS = [
    "I think the main issue here is that we're not clearly defining our goals.",
    "Maybe we should consider a different approach to this problem.",
    "The data shows some interesting patterns that we should explore.",
    "There are several factors we need to take into account here.",
    "This could be a useful way to improve our understanding.",
]

# Target axes for each pack (use correct operator names)
TEST_TARGETS = [
    ("tetralemma", "A"),  # Affirming
    ("tone", "analytical"),
    ("tetralemma", "¬A"),  # Negating (unicode character)
    ("tone", "critical"),
    ("tetralemma", "both"),
]


def get_initial_readings(text: str, pack_name: str):
    """Get initial POVM readings for text."""
    from humanizer.core.trm.density import construct_density_matrix
    from humanizer.services.operator_learning import load_all_operators

    # Get embedding
    embedding_service = get_sentence_embedding_service()
    embedding = embedding_service.embed_text(text)

    # Construct density matrix
    rho = construct_density_matrix(embedding, rank=64)

    # Load operators
    semantic_packs_dict = load_all_operators()
    pack = semantic_packs_dict[pack_name].to_povm_pack()

    # Measure
    readings = pack.measure(rho)

    return readings


def main():
    """Test GFS implementation."""
    print("=" * 80)
    print("TESTING GFS IMPLEMENTATION (Week 5 Phase 1)")
    print("=" * 80)

    # Initialize strategy with GFS parameters
    strategy = LLMGuidedStrategy(
        rank=64,
        num_candidates=5,  # Generate 5 candidates
        max_retries=3  # Allow 3 retry attempts
    )

    if not strategy._available:
        print("❌ LLM provider not available - check .env DEPLOYMENT_MODE=api")
        return

    print(f"\n✅ Strategy initialized with GFS:")
    print(f"   - num_candidates: {strategy.num_candidates}")
    print(f"   - max_retries: {strategy.max_retries}")
    print(f"   - LLM provider: {type(strategy.llm_provider).__name__}")

    # Run tests
    results = []
    total_success = 0
    total_improvement = 0.0
    total_text_change = 0.0
    total_coherence = 0.0

    for i, (text, (pack_name, target_axis)) in enumerate(zip(TEST_TEXTS, TEST_TARGETS), 1):
        print(f"\n{'=' * 80}")
        print(f"TEST {i}/{len(TEST_TEXTS)}")
        print(f"{'=' * 80}")
        print(f"Text: \"{text}\"")
        print(f"Target: {pack_name} → {target_axis}")

        # Get initial readings
        initial_readings = get_initial_readings(text, pack_name)
        print(f"Initial reading: {target_axis} = {initial_readings.get(target_axis, 0.0):.3f}")

        # Create context
        context = TransformationContext(
            text=text,
            target_axis=target_axis,
            povm_pack_name=pack_name,
            current_readings=initial_readings,
            target_threshold=0.65,
            max_change_ratio=0.4
        )

        # Transform
        result = strategy.transform(context)

        # Display results
        print(f"\n{'─' * 80}")
        print(f"RESULT:")
        print(f"  Success: {'✅' if result.success else '❌'}")
        print(f"  Transformed: \"{result.transformed_text}\"")
        print(f"  Improvement: {result.target_improvement:+.3f}")
        print(f"  Text change: {result.text_change_ratio:.2%}")
        print(f"  Coherence: {result.semantic_coherence:.2f}")
        print(f"  Time: {result.execution_time_ms:.0f}ms")
        print(f"  Before: {target_axis} = {result.readings_before.get(target_axis, 0.0):.3f}")
        print(f"  After:  {target_axis} = {result.readings_after.get(target_axis, 0.0):.3f}")

        # Store results
        results.append(result)
        if result.success:
            total_success += 1
        total_improvement += result.target_improvement
        total_text_change += result.text_change_ratio
        total_coherence += result.semantic_coherence

    # Summary
    num_tests = len(results)
    avg_improvement = total_improvement / num_tests
    avg_text_change = total_text_change / num_tests
    avg_coherence = total_coherence / num_tests
    success_rate = total_success / num_tests

    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print(f"{'=' * 80}")
    print(f"Tests run: {num_tests}")
    print(f"Success rate: {success_rate:.1%} (target: >50%)")
    print(f"Avg improvement: {avg_improvement:+.3f} (target: >0.01)")
    print(f"Avg text change: {avg_text_change:.2%} (target: <40%)")
    print(f"Avg coherence: {avg_coherence:.2f} (target: >0.6)")

    # Check against targets
    print(f"\n{'─' * 80}")
    print("TARGETS:")
    target_checks = [
        ("Success rate", success_rate >= 0.5, f"{success_rate:.1%} >= 50%"),
        ("Avg improvement", avg_improvement >= 0.01, f"{avg_improvement:+.3f} >= +0.01"),
        ("Avg text change", avg_text_change <= 0.4, f"{avg_text_change:.2%} <= 40%"),
        ("Avg coherence", avg_coherence >= 0.6, f"{avg_coherence:.2f} >= 0.6"),
    ]

    all_passed = True
    for name, passed, message in target_checks:
        status = "✅" if passed else "❌"
        print(f"  {status} {name}: {message}")
        if not passed:
            all_passed = False

    if all_passed:
        print(f"\n🎉 ALL TARGETS MET! GFS implementation working!")
    else:
        print(f"\n⚠️  Some targets not met - see details above")

    print(f"\n{'=' * 80}")


if __name__ == "__main__":
    main()
