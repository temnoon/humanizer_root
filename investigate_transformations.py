"""
Manual Transformation Inspection Script

Purpose: Investigate what's actually happening during transformations
- Run transformations manually
- Print before/after text
- Show POVM readings
- Display quality metrics
- Human assessment

This helps answer:
1. Is the LLM actually changing text?
2. Are POVM readings meaningful?
3. Is coherence metric calibrated correctly?
4. What does "good" transformation look like?
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from humanizer.services.transformation_engine import (
    RuleBasedStrategy,
    LLMGuidedStrategy,
    TransformationContext,
)
from humanizer.services.test_corpus import TONE_TESTS
from humanizer.core.trm.povm import get_all_packs


def print_separator(char="=", length=80):
    """Print a visual separator"""
    print(char * length)


def print_transformation_report(
    test_id: str,
    strategy_name: str,
    context: TransformationContext,
    result,
):
    """
    Print detailed transformation report for human inspection.

    Args:
        test_id: Test case identifier
        strategy_name: Name of strategy used
        context: Transformation context
        result: TransformationResult
    """
    print_separator("=")
    print(f"TEST: {test_id}")
    print(f"STRATEGY: {strategy_name}")
    print(f"TARGET: {context.povm_pack_name} = {context.target_axis}")
    print_separator("-")

    # Original text
    print("\n📄 ORIGINAL TEXT:")
    print(f"   {context.text}")

    # Transformed text
    print("\n📝 TRANSFORMED TEXT:")
    print(f"   {result.transformed_text}")

    # Quick diff
    print("\n🔍 QUICK DIFF:")
    original_words = set(context.text.lower().split())
    transformed_words = set(result.transformed_text.lower().split())
    added = transformed_words - original_words
    removed = original_words - transformed_words

    if added:
        print(f"   + Added: {', '.join(list(added)[:10])}")
    else:
        print(f"   + Added: (none)")

    if removed:
        print(f"   - Removed: {', '.join(list(removed)[:10])}")
    else:
        print(f"   - Removed: (none)")

    # POVM readings
    print("\n📊 POVM READINGS:")
    print(f"   BEFORE:")
    for axis, prob in result.readings_before.items():
        marker = "🎯" if axis == context.target_axis else "  "
        print(f"      {marker} {axis:15s}: {prob:.4f}")

    print(f"\n   AFTER:")
    for axis, prob in result.readings_after.items():
        before_prob = result.readings_before[axis]
        change = prob - before_prob
        marker = "🎯" if axis == context.target_axis else "  "
        change_str = f"({change:+.4f})" if abs(change) > 0.001 else "(no change)"
        print(f"      {marker} {axis:15s}: {prob:.4f} {change_str}")

    # Metrics
    print("\n📈 METRICS:")
    print(f"   Target Improvement:  {result.target_improvement:+.4f}")
    print(f"   Rho Distance:        {result.rho_distance_moved:.4f}")
    print(f"   Text Change Ratio:   {result.text_change_ratio:.2%}")
    print(f"   Semantic Coherence:  {result.semantic_coherence:.4f}")
    print(f"   Execution Time:      {result.execution_time_ms:.0f}ms")
    print(f"   Cost:                ${result.cost_usd:.6f}")

    # Success assessment
    print("\n✅ SUCCESS ASSESSMENT:")
    print(f"   Success:             {'✅ YES' if result.success else '❌ NO'}")

    if result.error_message:
        print(f"   Error:               {result.error_message}")

    if result.rules_applied:
        print(f"   Rules Applied:       {len(result.rules_applied)}")
        for rule in result.rules_applied[:5]:
            print(f"      - {rule}")

    # Human assessment prompt
    print("\n🤔 HUMAN ASSESSMENT:")
    print("   Quality (1-5):       ?  (manually rate)")
    print("   Target achieved:     ?  (did it become more analytical/critical/etc?)")
    print("   Natural language:    ?  (does it read naturally?)")
    print("   Preserves meaning:   ?  (same core meaning?)")

    print_separator("=")
    print()


async def inspect_rule_based_transformations():
    """Inspect rule-based transformations"""
    print("\n\n")
    print_separator("*")
    print("RULE-BASED STRATEGY INSPECTION")
    print_separator("*")
    print()

    strategy = RuleBasedStrategy(rank=64)
    packs = get_all_packs(rank=64)

    # Test first 3 tone tests (known to have rules)
    for test_case in TONE_TESTS[:3]:
        pack = packs[test_case.povm_pack]
        initial_readings = {}

        # We don't have the actual readings here, so we'll get them from the result
        context = TransformationContext(
            text=test_case.text,
            target_axis=test_case.target_axis,
            povm_pack_name=test_case.povm_pack,
            current_readings={},  # Will be computed
            target_threshold=0.30,
            max_change_ratio=0.3,
        )

        try:
            result = strategy.transform(context)
            print_transformation_report(
                test_id=test_case.id,
                strategy_name="RuleBasedStrategy",
                context=context,
                result=result,
            )

        except Exception as e:
            print(f"\n❌ ERROR in {test_case.id}: {e}")
            import traceback
            traceback.print_exc()


async def inspect_llm_guided_transformations():
    """Inspect LLM-guided transformations"""
    print("\n\n")
    print_separator("*")
    print("LLM-GUIDED STRATEGY INSPECTION")
    print_separator("*")
    print()

    try:
        strategy = LLMGuidedStrategy(rank=64)

        if not strategy._available:
            print("⚠️  LLM strategy not available (Ollama not running?)")
            print("   To enable: ollama serve")
            return

        packs = get_all_packs(rank=64)

        # Test first 2 tone tests with LLM
        for test_case in TONE_TESTS[:2]:
            context = TransformationContext(
                text=test_case.text,
                target_axis=test_case.target_axis,
                povm_pack_name=test_case.povm_pack,
                current_readings={},
                target_threshold=0.30,
                max_change_ratio=0.3,
            )

            print(f"\n🤖 Running LLM transformation for {test_case.id}...")
            print("   (This may take 1-3 seconds)")

            try:
                result = strategy.transform(context)
                print_transformation_report(
                    test_id=test_case.id,
                    strategy_name="LLMGuidedStrategy",
                    context=context,
                    result=result,
                )

            except Exception as e:
                print(f"\n❌ ERROR in {test_case.id}: {e}")
                import traceback
                traceback.print_exc()

    except Exception as e:
        print(f"\n❌ ERROR initializing LLM strategy: {e}")
        import traceback
        traceback.print_exc()


async def main():
    """Main investigation workflow"""
    print("\n")
    print("=" * 80)
    print(" MANUAL TRANSFORMATION INSPECTION ".center(80, "="))
    print("=" * 80)
    print()
    print("This script will run transformations and display detailed results")
    print("for human inspection.")
    print()
    print("Investigation questions:")
    print("  1. Is the LLM actually changing text?")
    print("  2. Are POVM readings meaningful?")
    print("  3. Is coherence metric calibrated correctly?")
    print("  4. What does a 'good' transformation look like?")
    print()

    # Part 1: Rule-based transformations
    await inspect_rule_based_transformations()

    # Part 2: LLM-guided transformations
    print("\n\n")
    print("=" * 80)
    print("Now testing LLM-guided transformations...")
    print("=" * 80)

    await inspect_llm_guided_transformations()

    # Summary
    print("\n\n")
    print("=" * 80)
    print(" INVESTIGATION COMPLETE ".center(80, "="))
    print("=" * 80)
    print()
    print("Key observations to document:")
    print("  1. Did transformations actually change the text?")
    print("  2. Did POVM readings shift in expected direction?")
    print("  3. Was coherence score reasonable (0.5-0.8 for good)?")
    print("  4. Did target improvement correlate with quality?")
    print("  5. Were there patterns in what worked vs failed?")
    print()
    print("Next step: Document findings and adjust metrics/thresholds")
    print()


if __name__ == "__main__":
    asyncio.run(main())
