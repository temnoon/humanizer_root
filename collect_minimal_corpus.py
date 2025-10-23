"""
Minimal Corpus Collection - Week 6 Step 1 (Simplified)

Use the working GFS test infrastructure, run it multiple times with different texts,
and save successful transformations.
"""

import json
from pathlib import Path
from datetime import datetime
import difflib

from humanizer.services.transformation_engine import (
    LLMGuidedStrategy,
    TransformationContext
)
from humanizer.services.sentence_embedding import get_sentence_embedding_service
from humanizer.core.trm.density import construct_density_matrix
from humanizer.services.operator_learning import load_all_operators


# Test texts (from various sources, diverse)
TEST_TEXTS = [
    # From test_gfs_implementation.py
    "I think the main issue here is that we're not clearly defining our goals.",
    "Maybe we should consider a different approach to this problem.",
    "The data shows some interesting patterns that we should explore.",
    "There are several factors we need to take into account here.",
    "This could be a useful way to improve our understanding.",

    # Additional varied texts
    "The algorithm performs well on benchmark datasets.",
    "We need to test this hypothesis more rigorously.",
    "This is absolutely the best solution we've found.",
    "I'm not sure if this approach will work at all.",
    "Let's examine both the benefits and drawbacks carefully.",
    "The results are neither good nor bad, just unexpected.",
    "Everyone should understand these basic concepts.",
    "Technically speaking, the implementation uses recursion.",
    "I feel like this might be heading in the wrong direction.",
    "The research demonstrates clear empirical evidence.",
    "This is a complex problem with no easy answers.",
    "We must act now to prevent further issues.",
    "Perhaps there's a middle ground we haven't considered.",
    "The metrics indicate significant improvement over baseline.",
    "I wonder if we're missing something fundamental here.",
]

# Subset of axes to test (most successful from Week 5)
PACK_AXES = {
    "tetralemma": ["A", "¬A"],  # Most successful
    "tone": ["analytical", "empathic"],  # Clear transformations
    "pragmatics": ["clarity", "evidence"],  # Objective improvements
}


def analyze_word_diff(original: str, transformed: str) -> dict:
    """Analyze word-level differences."""
    original_words = original.split()
    transformed_words = transformed.split()

    matcher = difflib.SequenceMatcher(None, original_words, transformed_words)

    words_removed = []
    words_added = []
    words_changed = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'delete':
            words_removed.extend(original_words[i1:i2])
        elif tag == 'insert':
            words_added.extend(transformed_words[j1:j2])
        elif tag == 'replace':
            orig_chunk = " ".join(original_words[i1:i2])
            new_chunk = " ".join(transformed_words[j1:j2])
            words_changed.append((orig_chunk, new_chunk))

    return {
        "words_removed": words_removed,
        "words_added": words_added,
        "words_changed": words_changed,
        "num_words_original": len(original_words),
        "num_words_transformed": len(transformed_words),
    }


def get_initial_readings(text: str, pack_name: str):
    """Get initial POVM readings for text."""
    embedding_service = get_sentence_embedding_service()
    embedding = embedding_service.embed_text(text)
    rho = construct_density_matrix(embedding, rank=64)

    semantic_packs = load_all_operators()
    pack = semantic_packs[pack_name].to_povm_pack()
    readings = pack.measure(rho)

    return readings


def main():
    print("=" * 80)
    print("MINIMAL CORPUS COLLECTION (Week 6)")
    print("=" * 80)

    # Initialize strategy
    strategy = LLMGuidedStrategy(rank=64, num_candidates=10, max_retries=3)

    if not strategy._available:
        print("❌ LLM provider not available")
        return

    print(f"\n✅ Strategy initialized")
    print(f"   - Texts: {len(TEST_TEXTS)}")
    print(f"   - Axes to test: {sum(len(axes) for axes in PACK_AXES.values())}")
    print(f"   - Total transformations: {len(TEST_TEXTS) * sum(len(axes) for axes in PACK_AXES.values())}")

    # Collect successful transformations
    successful = []
    total_attempts = 0

    for text_idx, text in enumerate(TEST_TEXTS, 1):
        print(f"\n{'─' * 80}")
        print(f"Text {text_idx}/{len(TEST_TEXTS)}")
        print(f'"{text}"')

        for pack_name, axes in PACK_AXES.items():
            # Get initial readings for this pack
            initial_readings = get_initial_readings(text, pack_name)

            for target_axis in axes:
                total_attempts += 1

                try:
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

                    # Check if successful
                    if result.success:
                        # Analyze word diff
                        word_diff = analyze_word_diff(text, result.transformed_text)

                        # Create record
                        record = {
                            "original_text": text,
                            "transformed_text": result.transformed_text,
                            "pack": pack_name,
                            "axis": target_axis,
                            "improvement": float(result.target_improvement),
                            "text_change_ratio": float(result.text_change_ratio),
                            "coherence": float(result.semantic_coherence),
                            "reading_before": float(result.readings_before.get(target_axis, 0.0)),
                            "reading_after": float(result.readings_after.get(target_axis, 0.0)),
                            "word_diff": word_diff,
                            "timestamp": datetime.now().isoformat()
                        }

                        successful.append(record)
                        print(f"  ✅ {pack_name}/{target_axis}: improvement={result.target_improvement:+.3f}, change={result.text_change_ratio:.0%}")
                    else:
                        print(f"  ❌ {pack_name}/{target_axis}: failed")

                except Exception as e:
                    print(f"  ❌ {pack_name}/{target_axis}: ERROR - {e}")
                    continue

    # Summary
    print(f"\n{'=' * 80}")
    print("COLLECTION COMPLETE")
    print(f"{'=' * 80}")
    print(f"Total attempts: {total_attempts}")
    print(f"Successful: {len(successful)}")
    print(f"Success rate: {len(successful)/total_attempts:.1%}")

    # Calculate success by pack/axis
    pack_axis_counts = {}
    for record in successful:
        key = f"{record['pack']}/{record['axis']}"
        pack_axis_counts[key] = pack_axis_counts.get(key, 0) + 1

    print(f"\nSuccess counts by pack/axis:")
    for key, count in sorted(pack_axis_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {key}: {count}")

    # Save results
    output_dir = Path("data/successful_transformations")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"minimal_corpus_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    with open(output_file, 'w') as f:
        json.dump({
            "metadata": {
                "total_attempts": total_attempts,
                "total_successful": len(successful),
                "success_rate": len(successful)/total_attempts if total_attempts > 0 else 0,
                "num_texts": len(TEST_TEXTS),
                "pack_axes": PACK_AXES,
                "pack_axis_counts": pack_axis_counts,
                "timestamp": datetime.now().isoformat()
            },
            "transformations": successful
        }, f, indent=2)

    print(f"\n💾 Results saved to: {output_file}")
    print(f"✅ Collection complete!")


if __name__ == "__main__":
    main()
