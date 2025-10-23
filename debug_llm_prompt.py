#!/usr/bin/env python3
"""
Debug LLM prompt system - check what's being generated
"""

import asyncio
from humanizer.services.transformation_engine import (
    LLMGuidedStrategy,
    TransformationContext
)
from humanizer.services.sentence_embedding import get_sentence_embedding_service
from humanizer.core.trm.density import construct_density_matrix


async def debug_single_transform():
    """Debug a single transformation to see what's happening."""

    # Test text
    text = "I think the main issue here is that we're not clearly defining our goals."
    pack_name = "tone"
    target_axis = "analytical"

    print("=" * 80)
    print("DEBUG: Single LLM Transformation")
    print("=" * 80)
    print()
    print(f"Original text: {text}")
    print(f"Target: {pack_name}/{target_axis}")
    print()

    # Initialize strategy
    strategy = LLMGuidedStrategy(rank=64)

    if not strategy._available:
        print("❌ LLM not available")
        return

    print(f"✅ LLM provider: {strategy.llm_provider.__class__.__name__}")
    print()

    # Get initial measurement
    embedding_service = get_sentence_embedding_service()
    initial_emb = embedding_service.embed_text(text)
    rho = construct_density_matrix(initial_emb, rank=64)
    pack = strategy.povm_packs[pack_name]
    initial_readings = pack.measure(rho)

    print(f"Initial POVM readings:")
    for axis, prob in initial_readings.items():
        marker = " ← current" if axis == max(initial_readings, key=initial_readings.get) else ""
        print(f"  {axis}: {prob:.3f}{marker}")
    print()

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
    print("Transforming...")
    result = strategy.transform(context)

    print()
    print("=" * 80)
    print("RESULT")
    print("=" * 80)
    print()
    print(f"Success: {result.success}")
    print(f"Transformed text: {result.transformed_text}")
    print()
    print(f"POVM improvement: {result.target_improvement:+.3f}")
    print(f"Text change ratio: {result.text_change_ratio:.1%}")
    print(f"Coherence: {result.semantic_coherence:.2f}")
    print(f"Length: {len(text)} → {len(result.transformed_text)} ({len(result.transformed_text) - len(text):+d})")
    print()
    print(f"Final POVM readings:")
    for axis, prob in result.readings_after.items():
        marker = " ← highest" if axis == max(result.readings_after, key=result.readings_after.get) else ""
        print(f"  {axis}: {prob:.3f}{marker}")
    print()

    if result.error_message:
        print(f"Error: {result.error_message}")


if __name__ == "__main__":
    asyncio.run(debug_single_transform())
