"""
Test sentence-by-sentence transformation on medium-length texts

Week 5 Phase 2 validation
"""

from humanizer.services.sentence_transformation import SentenceBySentenceTransformer
from humanizer.services.sentence_embedding import get_sentence_embedding_service
from humanizer.core.trm.density import construct_density_matrix
from humanizer.services.operator_learning import load_all_operators


# Medium-length test texts (200-500 chars, 3-5 sentences)
TEST_TEXTS = [
    # Test 1: Hedged analytical text (263 chars, 3 sentences)
    "I think we need to look at this more carefully. Maybe there's a pattern we're missing. "
    "It seems like the data suggests some interesting trends that we should probably explore further.",

    # Test 2: Casual explanatory text (251 chars, 4 sentences)
    "So basically what happened is this. We tried the first approach. It didn't work out. "
    "Now we're thinking about trying something different to see if that helps.",

    # Test 3: Neutral narrative (298 chars, 3 sentences)
    "The team gathered to discuss the project status. Several issues were raised during the meeting. "
    "After careful consideration, they decided to revise the timeline and adjust their approach accordingly.",
]

TEST_TARGETS = [
    ("tone", "analytical"),  # Test 1: Remove hedging, make analytical
    ("tetralemma", "A"),  # Test 2: Make affirmative (remove "basically", "thinking about")
    ("tone", "critical"),  # Test 3: Make more critical
]


def get_initial_readings(text: str, pack_name: str):
    """Get initial POVM readings."""
    embedding_service = get_sentence_embedding_service()
    embedding = embedding_service.embed_text(text)
    rho = construct_density_matrix(embedding, rank=64)
    semantic_packs_dict = load_all_operators()
    pack = semantic_packs_dict[pack_name].to_povm_pack()
    readings = pack.measure(rho)
    return readings


def main():
    """Test sentence-by-sentence transformation."""
    print("=" * 80)
    print("TESTING SENTENCE-BY-SENTENCE TRANSFORMATION (Week 5 Phase 2)")
    print("=" * 80)

    transformer = SentenceBySentenceTransformer(rank=64)

    results = []
    total_success = 0

    for i, (text, (pack_name, target_axis)) in enumerate(zip(TEST_TEXTS, TEST_TARGETS), 1):
        print(f"\n{'=' * 80}")
        print(f"TEST {i}/{len(TEST_TEXTS)}")
        print(f"{'=' * 80}")
        print(f"Target: {pack_name} → {target_axis}")
        print(f"Length: {len(text)} chars")

        # Show sentences
        sentences = transformer.split_sentences(text)
        print(f"Sentences ({len(sentences)}):")
        for j, sent in enumerate(sentences, 1):
            print(f"  {j}. \"{sent}\"")

        # Get initial readings
        initial_readings = get_initial_readings(text, pack_name)
        print(f"\nInitial {target_axis} reading: {initial_readings.get(target_axis, 0.0):.3f}")

        # Transform
        print(f"\nTransforming...")
        result = transformer.transform(
            text=text,
            target_axis=target_axis,
            povm_pack_name=pack_name,
            current_readings=initial_readings,
            target_threshold=0.65,
            max_change_ratio=0.4
        )

        # Display results
        print(f"\n{'─' * 80}")
        print(f"RESULT:")
        print(f"  Success: {'✅' if result.success else '❌'}")
        print(f"  Overall improvement: {result.overall_improvement:+.3f}")
        print(f"  Overall coherence: {result.overall_coherence:.2f}")
        print(f"  Time: {result.execution_time_ms:.0f}ms")

        # Show transformed sentences
        print(f"\nTransformed sentences ({len(result.sentence_results)}):")
        for j, (sent_result, orig_sent) in enumerate(zip(result.sentence_results, sentences), 1):
            status = "✅" if sent_result.success else "❌"
            print(f"  {j}. {status} {sent_result.transformed_text}")
            print(f"     (improvement: {sent_result.target_improvement:+.3f}, "
                  f"change: {sent_result.text_change_ratio:.1%})")

        print(f"\nFinal text:")
        print(f'  "{result.final_text}"')

        results.append(result)
        if result.success:
            total_success += 1

    # Summary
    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print(f"{'=' * 80}")

    num_tests = len(results)
    success_rate = total_success / num_tests
    avg_improvement = sum(r.overall_improvement for r in results) / num_tests
    avg_coherence = sum(r.overall_coherence for r in results) / num_tests

    print(f"Tests run: {num_tests}")
    print(f"Success rate: {success_rate:.1%} (target: >40% for medium texts)")
    print(f"Avg improvement: {avg_improvement:+.3f} (target: >0.01)")
    print(f"Avg coherence: {avg_coherence:.2f} (target: >0.6)")

    # Sentence-level stats
    total_sentences = sum(len(r.sentence_results) for r in results)
    successful_sentences = sum(
        sum(1 for sr in r.sentence_results if sr.success)
        for r in results
    )
    sentence_success_rate = successful_sentences / total_sentences

    print(f"\nSentence-level stats:")
    print(f"  Total sentences: {total_sentences}")
    print(f"  Successful: {successful_sentences}")
    print(f"  Sentence success rate: {sentence_success_rate:.1%}")

    # Check targets
    print(f"\n{'─' * 80}")
    print("TARGETS:")
    checks = [
        ("Document success rate", success_rate >= 0.4, f"{success_rate:.1%} >= 40%"),
        ("Avg improvement", avg_improvement >= 0.01, f"{avg_improvement:+.3f} >= +0.01"),
        ("Avg coherence", avg_coherence >= 0.6, f"{avg_coherence:.2f} >= 0.6"),
        ("Sentence success rate", sentence_success_rate >= 0.3, f"{sentence_success_rate:.1%} >= 30%"),
    ]

    all_passed = True
    for name, passed, message in checks:
        status = "✅" if passed else "❌"
        print(f"  {status} {name}: {message}")
        if not passed:
            all_passed = False

    if all_passed:
        print(f"\n🎉 ALL TARGETS MET! Sentence-by-sentence working!")
    else:
        print(f"\n⚠️  Some targets not met")

    print(f"\n{'=' * 80}")


if __name__ == "__main__":
    main()
