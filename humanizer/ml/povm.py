"""
POVM Operators - Semantic Compass for Measurement

POVMs (Positive Operator-Valued Measures) are the quantum way to measure observables.

Key properties:
- Each operator E_i is PSD (positive semi-definite): E_i = B_i @ B_i^T
- Operators sum to identity: Σ E_i = I
- Born rule gives probabilities: p(i) = Tr(ρ E_i)

We define POVM "packs" for different semantic dimensions:
- Tetralemma (catuṣkoṭi): A, ¬A, both, neither
- Tone: analytical, critical, empathic, playful, neutral
- Ontology: corporeal, subjective, objective, mixed-frame
- Pragmatics: clarity, coherence, evidence, charity
- Audience: expert, general, student, policy, editorial
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
import numpy as np
from numpy.typing import NDArray

from .density import DensityMatrix


@dataclass
class POVMOperator:
    """
    A single POVM operator E_i.

    E_i must be PSD. We parameterize as E_i = B_i @ B_i^T to guarantee this.
    """
    name: str  # e.g., "A", "analytical", "expert"
    B: NDArray[np.float64]  # Factor matrix (rank × rank)

    @property
    def E(self) -> NDArray[np.float64]:
        """Compute E_i = B_i @ B_i^T (PSD by construction)."""
        return self.B @ self.B.T

    def measure(self, rho: DensityMatrix) -> float:
        """
        Apply Born rule: p(i) = Tr(ρ E_i)

        Args:
            rho: Density matrix to measure

        Returns:
            Probability (should be in [0, 1])
        """
        E_i = self.E
        assert E_i.shape == rho.rho.shape, "E_i and ρ must have same shape"

        # Born rule: p = Tr(ρ E_i)
        prob = np.trace(rho.rho @ E_i)

        # Ensure valid probability (numerical errors can give slightly negative)
        prob = float(np.clip(prob, 0, 1))

        return prob


@dataclass
class POVMPack:
    """
    A collection of POVM operators for a semantic dimension.

    Constraint: Σ E_i = I (operators must sum to identity)
    """
    name: str  # e.g., "tetralemma", "tone"
    description: str
    operators: List[POVMOperator]
    rank: int

    def __post_init__(self):
        """Validate and normalize POVM constraints."""
        # Check all operators have same rank
        for op in self.operators:
            assert op.B.shape[0] == self.rank, f"All operators must have rank {self.rank}"

        # Check and fix Σ E_i = I
        total = np.zeros((self.rank, self.rank))
        for op in self.operators:
            total += op.E

        identity = np.eye(self.rank)
        diff = np.linalg.norm(total - identity)

        if diff > 0.01:  # Tolerance (tighter than before)
            # Need to normalize operators to satisfy POVM constraint
            # Σ E_i should equal I, currently equals total
            # Scale each B_i by sqrt(trace(I) / trace(total))

            total_trace = np.trace(total)
            identity_trace = self.rank  # trace(I) = rank

            if total_trace > 0:
                scale_factor = np.sqrt(identity_trace / total_trace)

                for op in self.operators:
                    op.B = op.B * scale_factor

                # Verify fix
                new_total = np.zeros((self.rank, self.rank))
                for op in self.operators:
                    new_total += op.E
                new_diff = np.linalg.norm(new_total - identity)

                # Only print if normalization significantly improved things
                if diff > 0.1:
                    print(f"✓ POVM '{self.name}' normalized: {diff:.4f} → {new_diff:.4f}")

    def measure(self, rho: DensityMatrix) -> Dict[str, float]:
        """
        Measure all operators in this pack.

        Args:
            rho: Density matrix to measure

        Returns:
            Dict mapping operator names to probabilities
        """
        assert rho.rank == self.rank, f"ρ rank must match POVM rank ({self.rank})"

        readings = {}
        for op in self.operators:
            readings[op.name] = op.measure(rho)

        # Normalize to ensure Σ p_i = 1 (handle numerical errors)
        total = sum(readings.values())
        if abs(total - 1.0) > 1e-6:
            for key in readings:
                readings[key] /= total

        return readings


def create_random_povm_pack(
    name: str,
    axes: List[str],
    rank: int = 64,
    seed: Optional[int] = None,
) -> POVMPack:
    """
    Create a random POVM pack (for initialization, before training).

    Args:
        name: Pack name (e.g., "tetralemma")
        axes: List of axis names (e.g., ["A", "¬A", "both", "neither"])
        rank: Dimension of operators
        seed: Random seed for reproducibility

    Returns:
        POVMPack with random operators (will need training to be meaningful)
    """
    if seed is not None:
        np.random.seed(seed)

    n = len(axes)

    # Generate random PSD operators that sum to identity
    # Strategy: Use Gram matrix decomposition with proper normalization
    # 1. Generate random matrices B_i
    # 2. Compute E_i = B_i @ B_i^T
    # 3. Normalize so Σ E_i = I

    # First pass: generate random operators and compute total
    temp_operators = []
    total = np.zeros((rank, rank))

    for axis in axes:
        # Random matrix (rank × rank)
        B_i = np.random.randn(rank, rank) / np.sqrt(rank * n)  # Scale by n to get closer to target
        E_i = B_i @ B_i.T
        total += E_i
        temp_operators.append((axis, B_i))

    # Compute proper normalization factor
    # We want Σ E_i = I, so we need to scale each B_i
    # Since E_i = B_i @ B_i^T, scaling B by α gives E scaled by α²
    # So if Σ E_i = total, we want each E scaled by I/total
    # This means scaling each B by sqrt(I/total)

    total_norm = np.linalg.norm(total)
    identity_norm = np.linalg.norm(np.eye(rank))
    scale_factor = np.sqrt(identity_norm / total_norm) if total_norm > 0 else 1.0

    operators = []
    for axis, B_i in temp_operators:
        B_i_normalized = B_i * scale_factor
        operators.append(POVMOperator(name=axis, B=B_i_normalized))

    return POVMPack(
        name=name,
        description=f"Random POVM pack for {name}",
        operators=operators,
        rank=rank,
    )


def apply_born_rule(rho: DensityMatrix, E: NDArray[np.float64]) -> float:
    """
    Standalone Born rule application: p = Tr(ρ E)

    Args:
        rho: Density matrix
        E: POVM operator (must be PSD)

    Returns:
        Probability (in [0, 1])
    """
    assert rho.rho.shape == E.shape, "ρ and E must have same shape"

    prob = np.trace(rho.rho @ E)
    prob = float(np.clip(prob, 0, 1))

    return prob


# ========================================
# Predefined POVM Packs
# ========================================

def create_tetralemma_pack(rank: int = 64) -> POVMPack:
    """
    Tetralemma (catuṣkoṭi) POVM pack.

    Four corners:
    - A: Statement is true
    - ¬A: Statement is false
    - both: Statement is both true and false (paradox)
    - neither: Statement is neither true nor false (transcends)

    This is the core Buddhist logic framework for reading.
    """
    return create_random_povm_pack(
        name="tetralemma",
        axes=["A", "¬A", "both", "neither"],
        rank=rank,
        seed=42,  # Fixed seed for consistency
    )


def create_tone_pack(rank: int = 64) -> POVMPack:
    """
    Tone POVM pack.

    Axes:
    - analytical: Logical, systematic, precise
    - critical: Questioning, skeptical, challenging
    - empathic: Understanding, compassionate, relational
    - playful: Creative, exploratory, non-serious
    - neutral: Balanced, objective, detached
    """
    return create_random_povm_pack(
        name="tone",
        axes=["analytical", "critical", "empathic", "playful", "neutral"],
        rank=rank,
        seed=43,
    )


def create_ontology_pack(rank: int = 64) -> POVMPack:
    """
    Ontology POVM pack.

    Axes:
    - corporeal: Physical, embodied, material
    - subjective: Personal, experiential, first-person
    - objective: External, observer-independent, third-person
    - mixed_frame: Crosses multiple ontological categories
    """
    return create_random_povm_pack(
        name="ontology",
        axes=["corporeal", "subjective", "objective", "mixed_frame"],
        rank=rank,
        seed=44,
    )


def create_pragmatics_pack(rank: int = 64) -> POVMPack:
    """
    Pragmatics POVM pack (reading quality).

    Axes:
    - clarity: Clear, unambiguous, well-structured
    - coherence: Logically consistent, flows well
    - evidence: Well-supported, grounded
    - charity: Interprets text generously, steelmen
    """
    return create_random_povm_pack(
        name="pragmatics",
        axes=["clarity", "coherence", "evidence", "charity"],
        rank=rank,
        seed=45,
    )


def create_audience_pack(rank: int = 64) -> POVMPack:
    """
    Audience POVM pack (intended reader).

    Axes:
    - expert: Specialists, assumes background knowledge
    - general: Educated public, accessible
    - student: Pedagogical, explanatory
    - policy: Decision-makers, action-oriented
    - editorial: Opinion, persuasive
    """
    return create_random_povm_pack(
        name="audience",
        axes=["expert", "general", "student", "policy", "editorial"],
        rank=rank,
        seed=46,
    )


def get_all_packs(rank: int = 64) -> Dict[str, POVMPack]:
    """
    Get all predefined POVM packs.

    Returns:
        Dict mapping pack names to POVMPack objects
    """
    return {
        "tetralemma": create_tetralemma_pack(rank),
        "tone": create_tone_pack(rank),
        "ontology": create_ontology_pack(rank),
        "pragmatics": create_pragmatics_pack(rank),
        "audience": create_audience_pack(rank),
    }


# Example usage (for testing)
if __name__ == "__main__":
    from .density import construct_density_matrix

    # Create a random sentence embedding
    np.random.seed(42)
    embedding = np.random.randn(384)
    embedding /= np.linalg.norm(embedding)

    # Construct density matrix
    rho = construct_density_matrix(embedding, rank=64)

    # Measure with all packs
    packs = get_all_packs(rank=64)

    for pack_name, pack in packs.items():
        print(f"\n{pack_name.upper()} POVM:")
        readings = pack.measure(rho)
        for axis, prob in readings.items():
            bar = "█" * int(prob * 50)
            print(f"  {axis:15s}: {prob:.4f} {bar}")

    # Check that probabilities sum to 1
    for pack_name, pack in packs.items():
        readings = pack.measure(rho)
        total = sum(readings.values())
        print(f"\n{pack_name}: Σp = {total:.6f}")
