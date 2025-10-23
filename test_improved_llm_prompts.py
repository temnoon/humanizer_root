#!/usr/bin/env python3
"""
Test improved LLM prompts (Week 5 Priority 1)

Tests the enhanced LLM prompt system with:
- Length constraints (±20%)
- Few-shot examples
- Self-critique checklist
- Specific quality criteria

Expected improvements:
- Success rate: 20% → >50%
- Coherence: 0.21 → >0.6
- Text expansion: 128% → <40%
"""

import asyncio
import time
import json
from pathlib import Path
from typing import List, Dict
import numpy as np

from humanizer.services.transformation_engine import (
    LLMGuidedStrategy,
    TransformationContext,
    TransformationMethod
)
from humanizer.services.sentence_embedding import get_sentence_embedding_service


# Test texts (sample from ChatGPT archive)
TEST_TEXTS = [
    "I think the main issue here is that we're not clearly defining our goals.",
    "The data shows a correlation between these two variables.",
    "Maybe we should consider looking at this from a different angle?",
    "This approach definitely seems like the best option available to us.",
    "It's worth noting that several factors could influence the outcome here.",
    "The results indicate a significant pattern in user behavior.",
    "I believe we can improve this by focusing on core features first.",
    "Research suggests that incremental changes work better than big rewrites.",
    "Perhaps the most important thing to consider is the user experience.",
    "The evidence strongly supports this particular interpretation.",
    "We might want to test this hypothesis before committing resources.",
    "Analysis reveals three distinct patterns emerging from the dataset.",
    "I'm not entirely sure, but this could be related to the caching issue.",
    "The performance metrics demonstrate clear improvements over baseline.",
    "It seems like we're making progress toward solving the core problem.",
    "These findings challenge conventional assumptions about the process.",
    "I'd argue that simplicity should be our primary design principle.",
    "The comparative study shows measurable differences across conditions.",
    "Maybe there's a simpler way to achieve the same result here?",
    "This framework provides a systematic approach to problem-solving.",
]

# Test configurations (pack, axis pairs)
TEST_AXES = [
    ("tone", "analytical"),
    ("tone", "critical"),
    ("tone", "empathic"),
    ("tetralemma", "A"),
    ("tetralemma", "not_A"),
]


async def test_single_transformation(
    strategy: LLMGuidedStrategy,
    text: str,
    pack_name: str,
    target_axis: str
) -> Dict:
    """
    Test a single transformation and collect metrics.

    Args:
        strategy: LLMGuidedStrategy instance
        text: Text to transform
        pack_name: POVM pack name
        target_axis: Target axis

    Returns:
        Dict with results and metrics
    """
    # Get initial reading
    embedding_service = get_sentence_embedding_service()
    initial_emb = embedding_service.embed_text(text)

    from humanizer.core.trm.density import construct_density_matrix
    rho = construct_density_matrix(initial_emb, rank=64)

    pack = strategy.povm_packs[pack_name]
    initial_readings = pack.measure(rho)

    # Build context
    context = TransformationContext(
        text=text,
        target_axis=target_axis,
        povm_pack_name=pack_name,
        current_readings=initial_readings,
        target_threshold=0.65,
        max_change_ratio=0.4  # 40% max change
    )

    # Transform
    start_time = time.time()
    try:
        result = strategy.transform(context)
        elapsed_ms = (time.time() - start_time) * 1000

        return {
            "success": True,
            "original_text": text,
            "transformed_text": result.transformed_text,
            "pack": pack_name,
            "axis": target_axis,
            "improvement": result.target_improvement,
            "text_change_ratio": result.text_change_ratio,
            "coherence": result.semantic_coherence,
            "rho_distance": result.rho_distance_moved,
            "transformation_success": result.success,
            "execution_time_ms": elapsed_ms,
            "original_length": len(text),
            "transformed_length": len(result.transformed_text),
            "length_change_pct": (len(result.transformed_text) / len(text) - 1) * 100,
            "error": None
        }

    except Exception as e:
        return {
            "success": False,
            "original_text": text,
            "transformed_text": None,
            "pack": pack_name,
            "axis": target_axis,
            "error": str(e),
            "execution_time_ms": (time.time() - start_time) * 1000
        }


async def run_test_suite():
    """Run comprehensive test suite on improved LLM prompts."""
    print("=" * 80)
    print("WEEK 5 PRIORITY 1: Testing Improved LLM Prompts")
    print("=" * 80)
    print()

    # Initialize strategy
    print("Initializing LLMGuidedStrategy with improved prompts...")
    strategy = LLMGuidedStrategy(rank=64)

    if not strategy._available:
        print("❌ ERROR: LLM provider not available")
        print("   Check .env for CLAUDE_API_KEY or Ollama setup")
        return

    print(f"✅ LLM provider: {strategy.llm_provider.__class__.__name__}")
    print()

    # Run tests
    results = []
    total_tests = len(TEST_TEXTS[:5]) * len(TEST_AXES)  # Test first 5 texts with all axes
    completed = 0

    print(f"Running {total_tests} transformations...")
    print(f"(5 texts × {len(TEST_AXES)} axes)")
    print()

    for text_idx, text in enumerate(TEST_TEXTS[:5], 1):
        for pack_name, target_axis in TEST_AXES:
            print(f"[{completed + 1}/{total_tests}] {pack_name}/{target_axis}")
            print(f"  Text: {text[:60]}...")

            result = await test_single_transformation(
                strategy, text, pack_name, target_axis
            )
            results.append(result)
            completed += 1

            if result["success"]:
                print(f"  ✓ Improvement: {result['improvement']:+.3f}")
                print(f"  ✓ Coherence: {result['coherence']:.2f}")
                print(f"  ✓ Length change: {result['length_change_pct']:+.1f}%")
            else:
                print(f"  ✗ Error: {result['error']}")

            print()

    # Calculate aggregate metrics
    successful = [r for r in results if r["success"]]
    transformations_succeeded = [r for r in successful if r["transformation_success"]]

    print("=" * 80)
    print("RESULTS SUMMARY")
    print("=" * 80)
    print()

    if not successful:
        print("❌ No successful transformations - cannot compute metrics")
        return

    # Success rate
    success_rate = len(transformations_succeeded) / len(results) * 100
    print(f"Success Rate: {success_rate:.1f}% ({len(transformations_succeeded)}/{len(results)})")

    # POVM improvement
    avg_improvement = np.mean([r["improvement"] for r in successful])
    print(f"Avg POVM Improvement: {avg_improvement:+.3f}")

    # Text change
    avg_text_change = np.mean([r["text_change_ratio"] for r in successful]) * 100
    avg_length_change = np.mean([r["length_change_pct"] for r in successful])
    print(f"Avg Text Change: {avg_text_change:.1f}%")
    print(f"Avg Length Change: {avg_length_change:+.1f}%")

    # Coherence
    avg_coherence = np.mean([r["coherence"] for r in successful])
    print(f"Avg Coherence: {avg_coherence:.2f}")

    # Speed
    avg_time = np.mean([r["execution_time_ms"] for r in successful])
    print(f"Avg Execution Time: {avg_time:.0f}ms")

    print()
    print("=" * 80)
    print("COMPARISON TO WEEK 4 BASELINE")
    print("=" * 80)
    print()

    # Week 4 baseline metrics
    baseline = {
        "success_rate": 20.0,
        "improvement": 0.022,
        "length_change": 128.0,
        "coherence": 0.21,
        "time_ms": 5340
    }

    # Calculate improvements
    success_delta = success_rate - baseline["success_rate"]
    improvement_delta = avg_improvement - baseline["improvement"]
    length_delta = avg_length_change - baseline["length_change"]
    coherence_delta = avg_coherence - baseline["coherence"]
    time_delta = avg_time - baseline["time_ms"]

    print(f"Success Rate:    {baseline['success_rate']:.1f}% → {success_rate:.1f}% ({success_delta:+.1f}%)")
    print(f"POVM Improve:    {baseline['improvement']:+.3f} → {avg_improvement:+.3f} ({improvement_delta:+.3f})")
    print(f"Length Change:   {baseline['length_change']:+.1f}% → {avg_length_change:+.1f}% ({length_delta:+.1f}%)")
    print(f"Coherence:       {baseline['coherence']:.2f} → {avg_coherence:.2f} ({coherence_delta:+.2f})")
    print(f"Execution Time:  {baseline['time_ms']:.0f}ms → {avg_time:.0f}ms ({time_delta:+.0f}ms)")

    print()
    print("=" * 80)
    print("TARGET METRICS (Week 5 Goals)")
    print("=" * 80)
    print()

    targets = {
        "success_rate": 50.0,
        "coherence": 0.6,
        "length_change": 40.0
    }

    # Check if targets met
    targets_met = 0
    total_targets = 3

    print(f"Success Rate Target: >50%")
    if success_rate >= targets["success_rate"]:
        print(f"  ✅ ACHIEVED: {success_rate:.1f}%")
        targets_met += 1
    else:
        print(f"  ❌ NOT MET: {success_rate:.1f}% (need {targets['success_rate'] - success_rate:.1f}% more)")

    print(f"\nCoherence Target: >0.6")
    if avg_coherence >= targets["coherence"]:
        print(f"  ✅ ACHIEVED: {avg_coherence:.2f}")
        targets_met += 1
    else:
        print(f"  ❌ NOT MET: {avg_coherence:.2f} (need {targets['coherence'] - avg_coherence:+.2f} more)")

    print(f"\nLength Change Target: <40%")
    if abs(avg_length_change) <= targets["length_change"]:
        print(f"  ✅ ACHIEVED: {avg_length_change:+.1f}%")
        targets_met += 1
    else:
        print(f"  ❌ NOT MET: {avg_length_change:+.1f}% (exceed by {abs(avg_length_change) - targets['length_change']:.1f}%)")

    print()
    print(f"Overall: {targets_met}/{total_targets} targets met")

    # Save detailed results
    output_file = Path("test_results_improved_prompts.json")
    with open(output_file, "w") as f:
        json.dump({
            "summary": {
                "total_tests": len(results),
                "successful": len(successful),
                "transformations_succeeded": len(transformations_succeeded),
                "success_rate": success_rate,
                "avg_improvement": float(avg_improvement),
                "avg_text_change": float(avg_text_change),
                "avg_length_change": float(avg_length_change),
                "avg_coherence": float(avg_coherence),
                "avg_time_ms": float(avg_time),
            },
            "targets": {
                "success_rate_met": success_rate >= targets["success_rate"],
                "coherence_met": avg_coherence >= targets["coherence"],
                "length_change_met": abs(avg_length_change) <= targets["length_change"],
                "total_met": targets_met,
            },
            "results": results
        }, f, indent=2)

    print()
    print(f"Detailed results saved to: {output_file}")
    print()


if __name__ == "__main__":
    asyncio.run(run_test_suite())
