"""
Show concrete examples of transformations to understand failures.

This script runs transformations and displays the actual before/after text
along with metrics to understand what's going wrong.
"""

import logging
from humanizer.services.sentence_embedding import get_sentence_embedding_service
from humanizer.services.transformation_engine import (
    RuleBasedStrategy,
    LLMGuidedStrategy,
    TransformationContext
)
from humanizer.core.trm.density import construct_density_matrix
from humanizer.core.trm.povm import get_all_packs

logging.basicConfig(level=logging.WARNING)

# Test texts
TEST_TEXTS = [
    "I think the data shows that we might get some interesting results from this approach.",
    "The mind constructs reality through layers of interpretation and meaning-making.",
    "You know, like, people really just want to feel understood and supported.",
]

def show_transformation(strategy, strategy_name, text, pack_name, axis):
    """Show a single transformation with detailed output."""
    print(f"\n{'='*80}")
    print(f"STRATEGY: {strategy_name}")
    print(f"TARGET: {pack_name}/{axis}")
    print(f"{'='*80}")

    # Get initial readings
    embedding_service = get_sentence_embedding_service()
    povm_packs = get_all_packs(rank=64)

    emb = embedding_service.embed_text(text)
    rho = construct_density_matrix(emb, rank=64)
    pack = povm_packs[pack_name]
    current_readings = pack.measure(rho)

    print(f"\n📝 BEFORE:")
    print(f"Text: {text}")
    print(f"Length: {len(text)} chars, {len(text.split())} words")
    print(f"\nPOVM Readings:")
    for axis_name, reading in sorted(current_readings.items(), key=lambda x: x[1], reverse=True):
        marker = "🎯" if axis_name == axis else "  "
        print(f"{marker} {axis_name}: {reading:.3f}")

    # Build context
    context = TransformationContext(
        text=text,
        target_axis=axis,
        povm_pack_name=pack_name,
        current_readings=current_readings,
        target_threshold=0.65,
        max_change_ratio=0.3
    )

    # Transform
    print(f"\n🔄 TRANSFORMING...")
    try:
        result = strategy.transform(context)

        print(f"\n📝 AFTER:")
        print(f"Text: {result.transformed_text}")
        print(f"Length: {len(result.transformed_text)} chars, {len(result.transformed_text.split())} words")

        print(f"\n📊 METRICS:")
        print(f"Success: {'✅' if result.success else '❌'}")
        print(f"POVM Improvement: {result.target_improvement:+.3f} (need >0.01)")
        print(f"Text Change: {result.text_change_ratio:.1%} (max 30%)")
        print(f"Coherence: {result.semantic_coherence:.2f} (need >0.5)")
        print(f"Time: {result.execution_time_ms:.0f}ms")

        print(f"\nPOVM Readings After:")
        for axis_name, reading in sorted(result.readings_after.items(), key=lambda x: x[1], reverse=True):
            before = result.readings_before[axis_name]
            delta = reading - before
            marker = "🎯" if axis_name == axis else "  "
            arrow = "📈" if delta > 0 else "📉" if delta < 0 else "→"
            print(f"{marker} {axis_name}: {reading:.3f} ({arrow} {delta:+.3f})")

        if hasattr(result, 'rules_applied') and result.rules_applied:
            print(f"\n🔧 Rules Applied: {', '.join(result.rules_applied[:5])}")
            if len(result.rules_applied) > 5:
                print(f"   ... and {len(result.rules_applied) - 5} more")

        if result.error_message:
            print(f"\n❌ Error: {result.error_message}")

        # Analyze the change
        print(f"\n🔍 ANALYSIS:")
        words_before = set(text.lower().split())
        words_after = set(result.transformed_text.lower().split())
        added = words_after - words_before
        removed = words_before - words_after

        if added:
            print(f"Words Added: {', '.join(list(added)[:10])}")
        if removed:
            print(f"Words Removed: {', '.join(list(removed)[:10])}")

        # Show why it failed
        if not result.success:
            print(f"\n💡 WHY IT FAILED:")
            if result.target_improvement <= 0.01:
                print(f"  • POVM improvement too small ({result.target_improvement:+.3f} vs 0.01 threshold)")
            if result.text_change_ratio > 0.3:
                print(f"  • Too much text change ({result.text_change_ratio:.1%} vs 30% max)")
            if result.semantic_coherence < 0.5:
                print(f"  • Low coherence ({result.semantic_coherence:.2f} vs 0.5 min)")

    except Exception as e:
        print(f"\n❌ EXCEPTION: {e}")
        import traceback
        traceback.print_exc()


def main():
    print("=" * 80)
    print("TRANSFORMATION EXAMPLES - Understanding Failures")
    print("=" * 80)

    # Initialize strategies
    print("\n🔧 Initializing strategies...")
    rule_strategy = RuleBasedStrategy(rank=64, operator_preference="default")

    # Test 1: Rule-based on analytical
    show_transformation(
        rule_strategy,
        "RuleBasedStrategy",
        TEST_TEXTS[0],
        "tone",
        "analytical"
    )

    # Test 2: Rule-based on empathic
    show_transformation(
        rule_strategy,
        "RuleBasedStrategy",
        TEST_TEXTS[2],
        "tone",
        "empathic"
    )

    # Test 3: Rule-based on ontology/subjective
    show_transformation(
        rule_strategy,
        "RuleBasedStrategy",
        TEST_TEXTS[1],
        "ontology",
        "subjective"
    )

    print("\n" + "=" * 80)
    print("END OF EXAMPLES")
    print("=" * 80)


if __name__ == "__main__":
    main()
