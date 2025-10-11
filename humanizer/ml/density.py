"""
Density Matrix Construction (ρ from eigendecomposition)

This implements ACTUAL quantum formalism for modeling reading states:
- ρ is a positive semi-definite (PSD) matrix
- Tr(ρ) = 1 (normalized trace)
- ρ = Σ λi |ψi⟩⟨ψi| (eigendecomposition)

The interpretation is subjective (reading states), but the math is rigorous.
"""

from dataclasses import dataclass
from typing import Tuple, Optional
import numpy as np
from numpy.typing import NDArray


@dataclass
class DensityMatrix:
    """
    Represents a density matrix ρ with its eigendecomposition.

    Attributes:
        rho: The full density matrix (rank × rank), PSD with Tr(ρ) = 1
        eigenvalues: Eigenvalues λi (sorted descending)
        eigenvectors: Eigenvectors |ψi⟩ as columns
        rank: Dimension of the Hilbert-like space
    """
    rho: NDArray[np.float64]
    eigenvalues: NDArray[np.float64]
    eigenvectors: NDArray[np.float64]
    rank: int

    def __post_init__(self):
        """Validate quantum constraints."""
        # Check PSD (all eigenvalues non-negative)
        assert np.all(self.eigenvalues >= -1e-10), "ρ must be PSD (eigenvalues ≥ 0)"

        # Check normalization
        trace = np.trace(self.rho)
        assert abs(trace - 1.0) < 1e-6, f"Tr(ρ) must equal 1, got {trace}"

        # Check shape
        assert self.rho.shape == (self.rank, self.rank), "ρ must be square"

    @property
    def purity(self) -> float:
        """
        Compute purity Tr(ρ²).

        - Purity = 1 → pure state (no mixing)
        - Purity < 1 → mixed state (uncertainty over interpretations)
        """
        return float(np.trace(self.rho @ self.rho))

    @property
    def entropy(self) -> float:
        """
        Von Neumann entropy S(ρ) = -Tr(ρ log ρ) = -Σ λi log λi

        Measures uncertainty/mixedness of the state.
        """
        # Filter out zero eigenvalues (log(0) undefined)
        nonzero_eigs = self.eigenvalues[self.eigenvalues > 1e-10]
        return float(-np.sum(nonzero_eigs * np.log(nonzero_eigs)))

    def to_dict(self) -> dict:
        """
        Serialize for storage (don't store full ρ, just eigensystem).

        Returns:
            dict: {eigenvalues: list, top_eigenvectors: list, rank: int, purity: float}
        """
        # Store top-k eigenvectors (e.g., top 5)
        k = min(5, self.rank)
        return {
            "eigenvalues": self.eigenvalues.tolist(),
            "top_eigenvectors": self.eigenvectors[:, :k].tolist(),
            "rank": self.rank,
            "purity": self.purity,
            "entropy": self.entropy,
        }


def construct_density_matrix(
    embedding: NDArray[np.float64],
    rank: int = 64,
    shrinkage: float = 0.01,
    projection_matrix: Optional[NDArray[np.float64]] = None,
) -> DensityMatrix:
    """
    Construct density matrix ρ from sentence embedding.

    This implements the pragmatic, fast, auditable approach from the spec:

    Process:
    1. Project embedding (384 dim) → rank-dim subspace
    2. Compute scatter matrix S = v @ v.T (outer product)
    3. Add shrinkage to ensure invertibility: S + α*I
    4. Eigendecompose: S = Q Λ Q^T
    5. Construct ρ = Σ λi |ψi⟩⟨ψi| (keep top eigenvectors)
    6. Normalize: ρ ← ρ / Tr(ρ)

    Args:
        embedding: Sentence embedding (d-dimensional, e.g., 384 from all-MiniLM-L6-v2)
        rank: Target dimension for ρ (default 64, can go up to 128)
        shrinkage: Ridge regularization to ensure PSD (default 0.01)
        projection_matrix: Optional learned projection (d × rank). If None, uses random projection.

    Returns:
        DensityMatrix object with ρ, eigenvalues, eigenvectors

    Examples:
        >>> from sentence_transformers import SentenceTransformer
        >>> model = SentenceTransformer('all-MiniLM-L6-v2')
        >>> embedding = model.encode("The mind constructs reality through language.")
        >>> rho = construct_density_matrix(embedding, rank=64)
        >>> rho.purity  # Close to 1 for pure state
        >>> rho.entropy  # Measures uncertainty
    """
    d = embedding.shape[0]

    # Step 1: Project to rank-dimensional subspace
    if projection_matrix is None:
        # Random projection (Gaussian, normalized)
        # In production, this should be learned or use PCA from corpus
        projection_matrix = np.random.randn(d, rank).astype(np.float64)
        projection_matrix /= np.linalg.norm(projection_matrix, axis=0, keepdims=True)

    assert projection_matrix.shape == (d, rank), f"Projection must be {d}×{rank}"

    # Project: embedding (d,) → v (rank,)
    v = projection_matrix.T @ embedding
    v = v / (np.linalg.norm(v) + 1e-10)  # Normalize

    # Step 2: Compute scatter matrix S = v @ v.T (outer product)
    S = np.outer(v, v)  # (rank, rank)

    # Step 3: Add shrinkage for numerical stability
    S = S + shrinkage * np.eye(rank)

    # Step 4: Eigendecompose
    # S is real symmetric → eigenvalues are real, eigenvectors orthogonal
    eigenvalues, eigenvectors = np.linalg.eigh(S)

    # Sort descending (eigh returns ascending)
    idx = np.argsort(eigenvalues)[::-1]
    eigenvalues = eigenvalues[idx]
    eigenvectors = eigenvectors[:, idx]

    # Ensure non-negative (numerical errors can give tiny negative values)
    eigenvalues = np.maximum(eigenvalues, 0)

    # Step 5: Construct ρ = Σ λi |ψi⟩⟨ψi|
    # This is just S after eigendecomposition, but let's be explicit:
    rho = eigenvectors @ np.diag(eigenvalues) @ eigenvectors.T

    # Step 6: Normalize: ρ ← ρ / Tr(ρ)
    trace = np.trace(rho)
    if trace > 1e-10:
        rho = rho / trace
        eigenvalues = eigenvalues / trace
    else:
        raise ValueError("Trace of ρ is zero - cannot normalize")

    # Ensure real (should already be real, but numerical errors)
    rho = np.real(rho)

    return DensityMatrix(
        rho=rho,
        eigenvalues=eigenvalues,
        eigenvectors=eigenvectors,
        rank=rank,
    )


def rho_distance(rho1: DensityMatrix, rho2: DensityMatrix) -> float:
    """
    Compute distance between two density matrices.

    Uses trace distance: D(ρ1, ρ2) = 0.5 * Tr(|ρ1 - ρ2|)
    where |A| = sqrt(A^† A) (operator absolute value)

    This measures how distinguishable the two states are.

    Args:
        rho1: First density matrix
        rho2: Second density matrix

    Returns:
        Distance in [0, 1]. 0 = identical, 1 = orthogonal
    """
    assert rho1.rank == rho2.rank, "ρ matrices must have same rank"

    # Compute difference
    diff = rho1.rho - rho2.rho

    # Compute |diff| via eigendecomposition
    eigenvalues = np.linalg.eigvalsh(diff)
    abs_eigenvalues = np.abs(eigenvalues)

    # Trace distance
    distance = 0.5 * np.sum(abs_eigenvalues)

    return float(distance)


def principal_directions(rho1: DensityMatrix, rho2: DensityMatrix, k: int = 3) -> list[dict]:
    """
    Identify principal directions of change between two density matrices.

    Useful for understanding: "What semantic directions changed most?"

    Args:
        rho1: Initial density matrix
        rho2: Final density matrix
        k: Number of top directions to return

    Returns:
        List of dicts: [{magnitude: float, direction: array, explained_variance: float}]
    """
    assert rho1.rank == rho2.rank

    # Compute change matrix
    Delta = rho2.rho - rho1.rho

    # Eigendecompose to find principal directions
    eigenvalues, eigenvectors = np.linalg.eigh(Delta)

    # Sort by magnitude (absolute value)
    idx = np.argsort(np.abs(eigenvalues))[::-1]
    eigenvalues = eigenvalues[idx]
    eigenvectors = eigenvectors[:, idx]

    # Take top-k
    total_change = np.sum(np.abs(eigenvalues))
    directions = []
    for i in range(min(k, len(eigenvalues))):
        directions.append({
            "magnitude": float(eigenvalues[i]),
            "direction": eigenvectors[:, i].tolist(),
            "explained_variance": float(np.abs(eigenvalues[i]) / (total_change + 1e-10)),
        })

    return directions


# Example usage (for testing)
if __name__ == "__main__":
    # Simulate a sentence embedding
    np.random.seed(42)
    embedding = np.random.randn(384).astype(np.float64)
    embedding /= np.linalg.norm(embedding)

    # Construct density matrix
    rho = construct_density_matrix(embedding, rank=64)

    print(f"ρ shape: {rho.rho.shape}")
    print(f"Tr(ρ): {np.trace(rho.rho):.6f}")
    print(f"Purity: {rho.purity:.6f}")
    print(f"Entropy: {rho.entropy:.6f}")
    print(f"Top 5 eigenvalues: {rho.eigenvalues[:5]}")

    # Test distance
    embedding2 = embedding + 0.1 * np.random.randn(384)
    embedding2 /= np.linalg.norm(embedding2)
    rho2 = construct_density_matrix(embedding2, rank=64)

    distance = rho_distance(rho, rho2)
    print(f"\nDistance between ρ1 and ρ2: {distance:.6f}")

    # Test principal directions
    directions = principal_directions(rho, rho2, k=3)
    print(f"\nTop 3 principal directions of change:")
    for i, d in enumerate(directions):
        print(f"  {i+1}. Magnitude: {d['magnitude']:.4f}, Explained: {d['explained_variance']:.2%}")
