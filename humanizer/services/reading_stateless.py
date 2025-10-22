"""
Reading Service - Stateless Pattern Demo

Demonstrates how ReadingService can use core + adapters pattern.

This is a DEMO showing the architecture - not yet integrated into main service.
In Phase 1, we'll migrate the existing ReadingService to this pattern.
"""

from typing import Dict, List, Optional
from uuid import UUID
import numpy as np
from numpy.typing import NDArray

# Core transformation logic (stateless, no DB)
from humanizer.core.trm.transformer import StatelessTransformer, TransformOptions, TransformResult
from humanizer.core.trm.density import construct_density_matrix
from humanizer.core.trm.povm import get_all_packs

# Storage adapters (pluggable)
from humanizer.adapters.storage import get_transformation_storage


async def example_stateless_reading(
    text: str,
    target_stance: dict,
    user_id: UUID,
    embed_fn,  # Injected embedding function
    llm_fn,    # Injected LLM function
    save_to_storage: bool = True
) -> TransformResult:
    """
    Example of stateless reading using core + adapters.

    This demonstrates:
    1. Core transformer is stateless (no DB imports)
    2. Functions are injected (embeddings, LLM)
    3. Storage is optional and pluggable
    4. Works in any environment (local, web, API)

    Args:
        text: Text to transform
        target_stance: Target POVM measurements
        user_id: User ID (for storage)
        embed_fn: Async function: text -> embedding
        llm_fn: Async function: (prompt, temp) -> text
        save_to_storage: Whether to persist (False for ephemeral web service)

    Returns:
        TransformResult with all steps visible
    """

    # Create stateless transformer (no DB dependencies)
    transformer = StatelessTransformer(
        embed_fn=embed_fn,
        llm_fn=llm_fn,
        rank=64
    )

    # Transform (pure, works offline)
    options = TransformOptions(
        max_iterations=3,
        convergence_threshold=0.85,
        povm_packs=list(target_stance.keys())
    )

    result = await transformer.transform(
        text=text,
        target_stance=target_stance,
        options=options
    )

    # Optionally save to storage (pluggable backend)
    if save_to_storage:
        storage = get_transformation_storage()

        # Convert steps to dicts for storage
        steps_data = [
            {
                "iteration": step.iteration,
                "text": step.text,
                "convergence_score": step.convergence_score,
                "povm_measurements": step.povm_measurements,
            }
            for step in result.steps
        ]

        await storage.save_transformation(
            user_id=user_id,
            original_text=result.original_text,
            transformed_text=result.final_text,
            steps=steps_data,
            metadata={
                "target_stance": result.target_stance,
                "converged": result.converged,
                "total_iterations": result.total_iterations,
            }
        )

    return result


async def example_measurement_only(
    text: str,
    embed_fn,  # Injected
    povm_packs: List[str] = None
) -> Dict[str, Dict[str, float]]:
    """
    Example: Just measure text (no transformation, no storage).

    Demonstrates minimal use of core - perfect for web service.

    Args:
        text: Text to measure
        embed_fn: Embedding function
        povm_packs: Which POVM packs to use

    Returns:
        POVM measurements
    """
    if povm_packs is None:
        povm_packs = ["tetralemma"]

    # Get embedding
    embedding = await embed_fn(text)

    # Construct density matrix
    rho = construct_density_matrix(embedding, rank=64)

    # Measure with POVMs
    all_packs = get_all_packs(rank=64)
    measurements = {}

    for pack_name in povm_packs:
        if pack_name in all_packs:
            pack = all_packs[pack_name]
            measurements[pack_name] = pack.measure(rho)

    return measurements


# ============================================================================
# Vision Alignment Demonstration
# ============================================================================

def demonstrate_vision_alignment():
    """
    Show how this architecture aligns with vision principles.
    """
    print("="*60)
    print("PHASE 0 ARCHITECTURE - VISION ALIGNMENT")
    print("="*60)

    print("\n✓ 1. WORKS OFFLINE (Desert Island Test)")
    print("   - Core transformer has no database imports")
    print("   - Can run in Cloudflare Worker, Lambda, etc.")
    print("   - Functions are injected (bring your own embeddings)")

    print("\n✓ 2. PRIVACY IS NON-NEGOTIABLE")
    print("   - EphemeralStorage: web service never persists data")
    print("   - User chooses storage backend (postgres, sqlite, ephemeral)")
    print("   - Storage is optional parameter (save_to_storage=False)")

    print("\n✓ 3. REVEALS CONSTRUCTION")
    print("   - TransformResult contains all steps")
    print("   - Each step shows: text, embedding, ρ, POVM readings")
    print("   - Convergence score visible at each iteration")

    print("\n✓ 4. CONSCIOUSNESS WORK, NOT BLACK BOX")
    print("   - Iterative transformation (not one-shot)")
    print("   - User sees how meaning shifts step-by-step")
    print("   - Verification loop built in")

    print("\n✓ 5. PLUGGABLE STORAGE")
    print("   - User controls their data")
    print("   - Same core works with any storage backend")
    print("   - Web service: ephemeral, no persistence")
    print("   - Local app: full storage and search")

    print("\n" + "="*60)
    print("ARCHITECTURE COMPLETE - Ready for Phase 1")
    print("="*60)


if __name__ == "__main__":
    demonstrate_vision_alignment()
