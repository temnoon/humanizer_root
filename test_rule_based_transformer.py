"""
Test Rule-Based Transformer - Week 6 Step 4

Evaluate corpus-driven rules against GFS baseline.
Target: 50-60% success rate with rules alone.
"""

from humanizer.services.rule_based_transformer import RuleBasedTransformer

# Test texts (same as used in GFS tests)
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
    ("tetralemma", "A"),  # Affirmative - high reliability rules
    ("tetralemma", "¬A"),  # Negating - high reliability rules
    ("tone", "analytical"),  # Analytical - medium reliability
]


def main():
    print("=" * 80)
    print("RULE-BASED TRANSFORMER EVALUATION (Week 6)")
    print("=" * 80)

    # Initialize transformer
    transformer = RuleBasedTransformer()

    print(f"\n✅ Transformer initialized")
    print(f"   Supported axes: {len(transformer.get_supported_axes())}")
    print(f"   - {', '.join(transformer.get_supported_axes())}")

    # Test each text
    total_tests = 0
    total_success = 0
    total_improvement = 0.0

    results_by_axis = {}

    for text in TEST_TEXTS:
        print(f"\n{'─' * 80}")
        print(f'Text: "{text}"')

        for pack_name, target_axis in TEST_AXES:
            total_tests += 1
            axis_key = f"{pack_name}/{target_axis}"

            try:
                result = transformer.transform(
                    text,
                    pack_name,
                    target_axis,
                    min_improvement=0.01,
                    max_text_change=0.4
                )

                if result.success:
                    total_success += 1
                    total_improvement += result.improvement

                    print(f"  ✅ {axis_key}")
                    print(f"     Rule: {result.rule_applied}")
                    print(f"     Transformed: \"{result.transformed_text}\"")
                    print(f"     Improvement: {result.improvement:+.3f}")
                    print(f"     Text change: {result.text_change_ratio:.1%}")
                else:
                    print(f"  ❌ {axis_key}: No successful rule application")

                # Track by axis
                if axis_key not in results_by_axis:
                    results_by_axis[axis_key] = {'success': 0, 'total': 0}
                results_by_axis[axis_key]['total'] += 1
                if result.success:
                    results_by_axis[axis_key]['success'] += 1

            except Exception as e:
                print(f"  ❌ {axis_key}: ERROR - {e}")

    # Summary
    print(f"\n{'=' * 80}")
    print("EVALUATION SUMMARY")
    print(f"{'=' * 80}")
    print(f"Total tests: {total_tests}")
    print(f"Successful: {total_success}")
    print(f"Success rate: {total_success/total_tests:.1%} (target: 50-60%)")

    if total_success > 0:
        print(f"Avg improvement: {total_improvement/total_success:+.3f}")

    print(f"\nSuccess rate by axis:")
    for axis_key in sorted(results_by_axis.keys()):
        stats = results_by_axis[axis_key]
        rate = stats['success'] / stats['total'] if stats['total'] > 0 else 0
        print(f"  {axis_key}: {rate:.1%} ({stats['success']}/{stats['total']})")

    # Compare to Week 5 GFS baseline
    print(f"\n{'─' * 80}")
    print("COMPARISON TO WEEK 5 GFS BASELINE")
    print(f"{'─' * 80}")
    print(f"GFS (Week 5):          20-33% success rate")
    print(f"Rules (Week 6):        {total_success/total_tests:.1%} success rate")

    if total_success/total_tests >= 0.50:
        print(f"\n🎉 TARGET MET! Rules achieve 50%+ success rate!")
    elif total_success/total_tests > 0.33:
        print(f"\n✅ IMPROVEMENT! Rules outperform GFS baseline!")
    else:
        print(f"\n⚠️  Rules comparable to or below GFS baseline")

    print(f"\n{'=' * 80}")


if __name__ == "__main__":
    main()
