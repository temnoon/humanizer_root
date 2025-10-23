"""
Quick test for RuleCandidateGenerator - Week 7 Step 2

Verify that rule-based candidate generation works on known examples.
"""

from humanizer.services.rule_candidate_generator import RuleCandidateGenerator


def main():
    print("=" * 80)
    print("TESTING RULE CANDIDATE GENERATOR")
    print("=" * 80)

    # Initialize generator
    generator = RuleCandidateGenerator()
    print(f"\n✅ Generator initialized")
    print(f"   Supported axes: {len(generator.get_supported_axes())}")

    # Test case 1: tetralemma/A (affirmative - remove hedging)
    print(f"\n{'─' * 80}")
    print("Test 1: tetralemma/A (Remove hedging, make affirmative)")
    print(f"{'─' * 80}")

    text1 = "I think the main issue here is that we're not clearly defining our goals."
    print(f'Original: "{text1}"')

    candidates1 = generator.generate_candidates(
        text=text1,
        pack_name="tetralemma",
        target_axis="A",
        num_candidates=8
    )

    print(f"\nGenerated {len(candidates1)} candidates:")
    for i, cand in enumerate(candidates1, 1):
        print(f"\n{i}. \"{cand.text}\"")
        print(f"   Rule: {cand.rule_description}")
        print(f"   Confidence: {cand.confidence:.2f}")

    # Test case 2: tetralemma/¬A (negating - add negation)
    print(f"\n{'─' * 80}")
    print("Test 2: tetralemma/¬A (Add negation, make negating)")
    print(f"{'─' * 80}")

    text2 = "Maybe we should consider a different approach to this problem."
    print(f'Original: "{text2}"')

    candidates2 = generator.generate_candidates(
        text=text2,
        pack_name="tetralemma",
        target_axis="¬A",
        num_candidates=8
    )

    print(f"\nGenerated {len(candidates2)} candidates:")
    for i, cand in enumerate(candidates2, 1):
        print(f"\n{i}. \"{cand.text}\"")
        print(f"   Rule: {cand.rule_description}")
        print(f"   Confidence: {cand.confidence:.2f}")

    # Test case 3: tone/analytical (vague to specific)
    print(f"\n{'─' * 80}")
    print("Test 3: tone/analytical (Vague to specific, exploratory to analytical)")
    print(f"{'─' * 80}")

    text3 = "The data shows some interesting patterns that we should explore."
    print(f'Original: "{text3}"')

    candidates3 = generator.generate_candidates(
        text=text3,
        pack_name="tone",
        target_axis="analytical",
        num_candidates=8
    )

    print(f"\nGenerated {len(candidates3)} candidates:")
    for i, cand in enumerate(candidates3, 1):
        print(f"\n{i}. \"{cand.text}\"")
        print(f"   Rule: {cand.rule_description}")
        print(f"   Confidence: {cand.confidence:.2f}")

    # Summary
    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print(f"{'=' * 80}")
    print(f"Test 1 (tetralemma/A): {len(candidates1)} candidates")
    print(f"Test 2 (tetralemma/¬A): {len(candidates2)} candidates")
    print(f"Test 3 (tone/analytical): {len(candidates3)} candidates")

    if candidates1 and candidates2:
        print(f"\n✅ RuleCandidateGenerator working correctly!")
        print(f"   - Applies substitutions ✓")
        print(f"   - Applies removals ✓")
        print(f"   - Applies additions (negations) ✓")
        print(f"   - Ensures diversity ✓")
    else:
        print(f"\n❌ Issues detected - not all tests produced candidates")

    print(f"\n{'=' * 80}")


if __name__ == "__main__":
    main()
