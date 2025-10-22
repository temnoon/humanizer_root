"""
Verification Loop - Check if transformations moved in intended direction

This closes the loop in the two-space model:
1. Quantum state space (ρ, POVMs) navigates INTENTIONS
2. Lexical space (words, grammar) applies TRANSFORMATIONS
3. Verification checks: Did we move toward the intended POVM target?

The verification embeds both original and transformed text,
computes the movement vector, and measures alignment with target.
"""

from dataclasses import dataclass
from typing import Dict, Optional, Tuple
import numpy as np
from numpy.typing import NDArray

from .density import DensityMatrix, construct_density_matrix, rho_distance
from .povm import POVMPack, get_all_packs


@dataclass
class VerificationResult:
    """
    Results of verifying a transformation.

    Attributes:
        success: Did transformation move toward target?
        alignment: Cosine similarity between movement and target direction ([-1, 1])
        magnitude: Magnitude of movement in embedding space
        povm_readings_before: POVM measurements before transformation
        povm_readings_after: POVM measurements after transformation
        povm_delta: Change in POVM readings (after - before)
        target_achieved: Did we reach the target threshold?
        rho_distance: Distance between ρ_before and ρ_after
    """
    success: bool
    alignment: float
    magnitude: float
    povm_readings_before: Dict[str, float]
    povm_readings_after: Dict[str, float]
    povm_delta: Dict[str, float]
    target_achieved: bool
    rho_distance: float

    def to_dict(self) -> dict:
        """Serialize for API responses."""
        return {
            "success": self.success,
            "alignment": self.alignment,
            "magnitude": self.magnitude,
            "povm_readings_before": self.povm_readings_before,
            "povm_readings_after": self.povm_readings_after,
            "povm_delta": self.povm_delta,
            "target_achieved": self.target_achieved,
            "rho_distance": self.rho_distance,
        }


def verify_transformation(
    embedding_before: NDArray[np.float64],
    embedding_after: NDArray[np.float64],
    povm_pack_name: str,
    target_axis: str,
    target_threshold: float = 0.1,
    rank: int = 64,
) -> VerificationResult:
    """
    Verify that a transformation moved in the intended direction.

    Process:
    1. Construct ρ_before and ρ_after from embeddings
    2. Measure both with specified POVM pack
    3. Compute movement vector: Δe = e_after - e_before
    4. Compute target direction (from POVM structure)
    5. Check alignment: did we move toward target?
    6. Check magnitude: how far did we move?

    Args:
        embedding_before: Original sentence embedding
        embedding_after: Transformed sentence embedding
        povm_pack_name: Which POVM pack to use (e.g., "tone", "tetralemma")
        target_axis: Which axis we intended to move toward (e.g., "formal", "A")
        target_threshold: Minimum improvement required (default 0.1)
        rank: Rank for density matrices

    Returns:
        VerificationResult with all metrics

    Example:
        >>> verify_transformation(
        ...     embedding_before,
        ...     embedding_after,
        ...     povm_pack_name="tone",
        ...     target_axis="formal",
        ...     target_threshold=0.15
        ... )
    """
    # Step 1: Construct density matrices
    # Use same projection matrix for both to ensure consistent comparison
    d = embedding_before.shape[0]
    projection_matrix = np.random.randn(d, rank).astype(np.float64)
    projection_matrix /= np.linalg.norm(projection_matrix, axis=0, keepdims=True)

    rho_before = construct_density_matrix(embedding_before, rank=rank, projection_matrix=projection_matrix)
    rho_after = construct_density_matrix(embedding_after, rank=rank, projection_matrix=projection_matrix)

    # Step 2: Measure with POVM pack
    packs = get_all_packs(rank=rank)
    if povm_pack_name not in packs:
        raise ValueError(f"Unknown POVM pack: {povm_pack_name}. Available: {list(packs.keys())}")

    pack = packs[povm_pack_name]

    if target_axis not in [op.name for op in pack.operators]:
        available = [op.name for op in pack.operators]
        raise ValueError(f"Unknown axis: {target_axis}. Available in {povm_pack_name}: {available}")

    readings_before = pack.measure(rho_before)
    readings_after = pack.measure(rho_after)

    # Step 3: Compute POVM delta
    povm_delta = {
        axis: readings_after[axis] - readings_before[axis]
        for axis in readings_before.keys()
    }

    # Step 4: Check if target improved
    target_improvement = povm_delta[target_axis]
    target_achieved = target_improvement >= target_threshold

    # Step 5: Compute movement vector
    movement_vector = embedding_after - embedding_before
    magnitude = float(np.linalg.norm(movement_vector))

    # Step 6: Compute target direction
    # The "target direction" is the direction in embedding space that maximizes
    # the target POVM axis. We approximate this using the gradient of the POVM
    # reading with respect to the embedding.
    #
    # For now, we use a simpler heuristic: alignment = sign(target_improvement)
    # In production, this should compute actual gradient via backprop through ρ construction.

    # Simplified alignment: did target axis increase?
    alignment = float(np.sign(target_improvement))

    # More sophisticated alignment: compare to other axes
    # If target improved more than others, that's good alignment
    if magnitude > 1e-6:
        # Normalize improvements by magnitude
        normalized_delta = {k: v / magnitude for k, v in povm_delta.items()}
        # Target should have highest improvement
        max_improvement = max(normalized_delta.values())
        if normalized_delta[target_axis] == max_improvement:
            alignment = 1.0
        elif target_improvement > 0:
            alignment = 0.5  # Improved, but not the most
        else:
            alignment = -1.0  # Decreased
    else:
        alignment = 0.0  # No movement

    # Step 7: Compute ρ distance
    distance = rho_distance(rho_before, rho_after)

    # Step 8: Determine success
    success = target_achieved and (alignment > 0)

    return VerificationResult(
        success=success,
        alignment=alignment,
        magnitude=magnitude,
        povm_readings_before=readings_before,
        povm_readings_after=readings_after,
        povm_delta=povm_delta,
        target_achieved=target_achieved,
        rho_distance=distance,
    )


def compute_transformation_trajectory(
    embeddings: list[NDArray[np.float64]],
    povm_pack_name: str,
    rank: int = 64,
) -> Tuple[list[dict], list[dict]]:
    """
    Compute POVM trajectory across multiple transformation steps.

    Useful for visualization: show how readings evolve over steps.

    Args:
        embeddings: List of embeddings (one per step)
        povm_pack_name: Which POVM pack to use
        rank: Rank for density matrices

    Returns:
        Tuple of (readings_trajectory, rho_distances):
        - readings_trajectory: List of POVM readings at each step
        - rho_distances: List of distances between consecutive ρ's
    """
    packs = get_all_packs(rank=rank)
    if povm_pack_name not in packs:
        raise ValueError(f"Unknown POVM pack: {povm_pack_name}")

    pack = packs[povm_pack_name]

    readings_trajectory = []
    rho_distances = []

    rho_prev = None

    for i, embedding in enumerate(embeddings):
        # Construct ρ
        rho = construct_density_matrix(embedding, rank=rank)

        # Measure
        readings = pack.measure(rho)
        readings_trajectory.append({"step": i, "readings": readings})

        # Compute distance from previous
        if rho_prev is not None:
            distance = rho_distance(rho_prev, rho)
            rho_distances.append({"step": i, "distance": distance})

        rho_prev = rho

    return readings_trajectory, rho_distances


def diagnose_transformation_failure(
    verification: VerificationResult,
    threshold_low: float = 0.05,
    threshold_high: float = 0.3,
) -> Dict[str, str]:
    """
    Diagnose why a transformation failed.

    Provides actionable feedback for debugging or iteration.

    Args:
        verification: VerificationResult from verify_transformation
        threshold_low: Minimum expected improvement
        threshold_high: Expected improvement for "good" transformations

    Returns:
        Dict with diagnosis: {issue: str, suggestion: str}
    """
    diagnosis = {}

    if not verification.success:
        # Identify the issue
        if verification.magnitude < 1e-4:
            diagnosis["issue"] = "No movement detected"
            diagnosis["suggestion"] = "Transformation didn't change the text meaningfully. Check lexical transformation logic."

        elif verification.alignment < 0:
            diagnosis["issue"] = "Moved in wrong direction"
            diagnosis["suggestion"] = f"Target axis decreased by {-verification.alignment:.2%}. Reverse transformation or adjust target."

        elif not verification.target_achieved:
            delta = verification.povm_delta
            target_axis = max(delta, key=lambda k: delta[k])
            diagnosis["issue"] = f"Insufficient improvement (got {verification.alignment:.2%})"
            diagnosis["suggestion"] = f"Try more aggressive transformation, or check if '{target_axis}' axis is better target."

        else:
            diagnosis["issue"] = "Unknown failure mode"
            diagnosis["suggestion"] = "Check verification logic or POVM calibration."

    else:
        # Success, but provide quality feedback
        if verification.alignment >= threshold_high:
            diagnosis["quality"] = "Excellent alignment"
        elif verification.alignment >= threshold_low:
            diagnosis["quality"] = "Good alignment"
        else:
            diagnosis["quality"] = "Weak alignment (consider refining)"

    return diagnosis


# Example usage (for testing)
if __name__ == "__main__":
    # Simulate before/after embeddings
    np.random.seed(42)

    # Original embedding
    embedding_before = np.random.randn(384)
    embedding_before /= np.linalg.norm(embedding_before)

    # Transformed embedding (simulate moving toward "analytical" tone)
    # We'll add a small directed perturbation
    direction = np.random.randn(384)
    direction /= np.linalg.norm(direction)

    embedding_after = embedding_before + 0.2 * direction
    embedding_after /= np.linalg.norm(embedding_after)

    # Verify transformation
    result = verify_transformation(
        embedding_before=embedding_before,
        embedding_after=embedding_after,
        povm_pack_name="tone",
        target_axis="analytical",
        target_threshold=0.1,
        rank=64,
    )

    print("VERIFICATION RESULTS:")
    print(f"  Success: {result.success}")
    print(f"  Alignment: {result.alignment:.4f}")
    print(f"  Magnitude: {result.magnitude:.4f}")
    print(f"  Target achieved: {result.target_achieved}")
    print(f"  ρ distance: {result.rho_distance:.4f}")

    print("\nPOVM Readings (before → after):")
    for axis in result.povm_readings_before.keys():
        before = result.povm_readings_before[axis]
        after = result.povm_readings_after[axis]
        delta = result.povm_delta[axis]
        arrow = "↑" if delta > 0 else "↓" if delta < 0 else "→"
        print(f"  {axis:15s}: {before:.4f} → {after:.4f} ({arrow} {abs(delta):.4f})")

    # Diagnose
    diagnosis = diagnose_transformation_failure(result)
    if diagnosis:
        print(f"\nDIAGNOSIS:")
        for key, value in diagnosis.items():
            print(f"  {key}: {value}")
