"""
Semantic POVM Operators - Learned from Corpus

This module implements POVM operators learned from corpus examples,
replacing random operators with deterministic semantic operators.

Key advantages:
- Zero measurement variance (same embedding → same reading)
- Semantic discrimination (analytical texts score higher on "analytical" axis)
- Learned from corpus (captures actual semantic properties)

Theory:
- Each operator E_i = B_i @ B_i^T encodes a concept (e.g., "analytical")
- B_i is learned from mean embedding of corpus exemplars
- Projection matrix is fixed (stored, not regenerated)
- Result: Same embedding → same ρ → same POVM reading (deterministic)
"""

from dataclasses import dataclass
from typing import List, Optional, Dict
import numpy as np
from numpy.typing import NDArray
import pickle
from pathlib import Path

from .density import construct_density_matrix, DensityMatrix
from .povm import POVMOperator, POVMPack


# ============================================================================
# Semantic POVM Operator
# ============================================================================

@dataclass
class SemanticPOVMOperator:
    """
    Semantic POVM operator learned from corpus.

    Unlike random operators, semantic operators:
    1. Have fixed projection matrices (no randomness)
    2. Are learned from corpus exemplars
    3. Discriminate semantic properties correctly
    4. Have zero measurement variance

    Attributes:
        name: Operator name (e.g., "analytical")
        B: Factor matrix (rank × rank) such that E = B @ B^T
        projection_matrix: Fixed projection matrix (embedding_dim × rank)
        rank: Density matrix rank
        corpus_size: Number of training examples
        mean_embedding: Mean of corpus embeddings (for reference)
    """
    name: str
    B: NDArray[np.float64]
    projection_matrix: NDArray[np.float64]
    rank: int
    corpus_size: int
    mean_embedding: Optional[NDArray[np.float64]] = None

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
            Probability in [0, 1]
        """
        E_i = self.E
        assert E_i.shape == rho.rho.shape, f"E_i shape {E_i.shape} != ρ shape {rho.rho.shape}"

        # Born rule: p = Tr(ρ E_i)
        prob = np.trace(rho.rho @ E_i)

        # Ensure valid probability
        prob = float(np.clip(prob, 0, 1))

        return prob

    def to_povm_operator(self) -> POVMOperator:
        """
        Convert to standard POVMOperator for compatibility.

        Note: Projection matrix is stored as attribute for use in construct_density_matrix()
        """
        op = POVMOperator(name=self.name, B=self.B)
        op._projection_matrix = self.projection_matrix  # Store for consistent ρ construction
        return op

    @classmethod
    def from_corpus(
        cls,
        name: str,
        corpus_texts: List[str],
        embedding_service,  # SentenceEmbeddingService
        rank: int = 64,
        target_trace: Optional[float] = None,
    ) -> 'SemanticPOVMOperator':
        """
        Learn semantic operator from corpus.

        Process:
        1. Embed all corpus texts
        2. Compute mean embedding (concept center)
        3. Create fixed projection matrix (PCA-based)
        4. Project mean to rank-d subspace
        5. Construct B as rank-1 outer product: E = α * (v ⊗ v^T)

        Args:
            name: Operator name
            corpus_texts: List of exemplar texts
            embedding_service: Sentence embedding service
            rank: Density matrix rank
            target_trace: Target trace for E (default: rank/4)

        Returns:
            Learned semantic operator
        """
        print(f"Learning semantic operator: {name}")
        print(f"  Corpus size: {len(corpus_texts)} texts")

        # Step 1: Embed all corpus texts
        embeddings = []
        for text in corpus_texts:
            emb = embedding_service.embed_text(text)
            embeddings.append(emb)

        embeddings = np.array(embeddings)  # Shape: (n_samples, embedding_dim)
        embedding_dim = embeddings.shape[1]

        print(f"  Embeddings shape: {embeddings.shape}")

        # Step 2: Compute mean embedding (concept center)
        mean_embedding = np.mean(embeddings, axis=0)

        # Step 3: Create fixed projection matrix
        # Use PCA-like projection: project to subspace spanned by concept variations
        centered = embeddings - mean_embedding

        # SVD for dimensionality reduction
        U, S, Vt = np.linalg.svd(centered.T, full_matrices=False)

        # Keep top-k components
        k = min(20, len(S))
        U_k = U[:, :k]
        S_k = S[:k]

        print(f"  PCA: {k} components explain {np.sum(S_k**2) / np.sum(S**2):.2%} variance")

        # Build projection matrix
        projection_matrix = np.zeros((embedding_dim, rank))

        # First direction: normalized mean embedding (concept center)
        projection_matrix[:, 0] = mean_embedding / np.linalg.norm(mean_embedding)

        # Next directions: principal components
        for i in range(1, min(rank, k+1)):
            projection_matrix[:, i] = U_k[:, i-1]

        # Remaining directions: orthogonal random (less critical)
        for i in range(k+1, rank):
            vec = np.random.randn(embedding_dim)
            # Gram-Schmidt orthogonalization
            for j in range(i):
                vec -= np.dot(vec, projection_matrix[:, j]) * projection_matrix[:, j]
            if np.linalg.norm(vec) > 1e-10:
                projection_matrix[:, i] = vec / np.linalg.norm(vec)

        print(f"  Projection matrix: {projection_matrix.shape}")

        # Step 4: Project mean embedding to rank-d subspace
        mean_projected = projection_matrix.T @ mean_embedding
        mean_projected = mean_projected / np.linalg.norm(mean_projected)

        print(f"  Mean projected to rank-{rank} subspace")

        # Step 5: Construct B as rank-1 operator
        # E = α * (v ⊗ v^T) where v is projected mean
        # B = √α * v (as column vector)

        if target_trace is None:
            # Default: Each operator should have trace ≈ rank/n_operators
            # Assuming 4-5 operators per pack
            target_trace = rank / 4.0

        alpha = target_trace  # Since trace(v ⊗ v^T) = ||v||² = 1

        # Create B (rank × rank with single non-zero column)
        B = np.zeros((rank, rank))
        B[:, 0] = np.sqrt(alpha) * mean_projected

        print(f"  Operator constructed (trace target: {target_trace:.2f})")
        print(f"  Actual trace: {np.trace(B @ B.T):.2f}")

        return cls(
            name=name,
            B=B,
            projection_matrix=projection_matrix,
            rank=rank,
            corpus_size=len(corpus_texts),
            mean_embedding=mean_embedding,
        )

    def save(self, filepath: Path):
        """Save operator to disk."""
        with open(filepath, 'wb') as f:
            pickle.dump(self, f)
        print(f"✅ Saved {self.name} operator to {filepath}")

    @classmethod
    def load(cls, filepath: Path) -> 'SemanticPOVMOperator':
        """Load operator from disk."""
        with open(filepath, 'rb') as f:
            op = pickle.load(f)
        print(f"✅ Loaded {op.name} operator from {filepath}")
        return op


# ============================================================================
# Semantic POVM Pack
# ============================================================================

@dataclass
class SemanticPOVMPack:
    """
    Collection of semantic POVM operators.

    Unlike random packs, semantic packs:
    1. Ensure Σ E_i = I (sum to identity)
    2. Use consistent projection matrices
    3. Provide deterministic measurements

    Attributes:
        name: Pack name (e.g., "tone")
        description: Pack description
        operators: List of semantic operators
        rank: Density matrix rank
    """
    name: str
    description: str
    operators: List[SemanticPOVMOperator]
    rank: int

    def __post_init__(self):
        """Validate and normalize POVM constraints."""
        # Check all operators have same rank
        for op in self.operators:
            assert op.rank == self.rank, f"All operators must have rank {self.rank}"

        # Normalize to ensure Σ E_i = I
        self._normalize_operators()

    def _normalize_operators(self):
        """
        Normalize operators so they sum to identity.

        Uses Cholesky normalization:
        - Compute total = Σ E_i
        - Transform: E_i_new = L^{-1} @ E_i @ L^{-T}
        - Where total = L @ L^T (Cholesky decomposition)
        - Result: Σ E_i_new = I
        """
        # Compute current sum
        total = np.zeros((self.rank, self.rank))
        for op in self.operators:
            total += op.E

        # Check if normalization needed
        identity = np.eye(self.rank)
        diff = np.linalg.norm(total - identity)

        if diff < 0.01:
            print(f"  Operators already sum to identity (diff: {diff:.6f})")
            return

        print(f"  Normalizing operators (current diff: {diff:.4f})")

        try:
            # Cholesky decomposition
            regularized_total = total + 1e-6 * identity
            L = np.linalg.cholesky(regularized_total)
            L_inv = np.linalg.inv(L)

            # Transform each operator
            for op in self.operators:
                E_normalized = L_inv @ op.E @ L_inv.T

                # Recompute B from normalized E
                # E = B @ B.T, so B = cholesky(E)
                try:
                    B_new = np.linalg.cholesky(E_normalized + 1e-10 * identity)
                    op.B = B_new
                except np.linalg.LinAlgError:
                    # Fallback: eigendecomposition
                    eigvals, eigvecs = np.linalg.eigh(E_normalized)
                    eigvals = np.maximum(eigvals, 0)  # Ensure PSD
                    B_new = eigvecs @ np.diag(np.sqrt(eigvals))
                    op.B = B_new

            # Verify normalization
            total_new = np.zeros((self.rank, self.rank))
            for op in self.operators:
                total_new += op.E

            diff_new = np.linalg.norm(total_new - identity)
            print(f"  ✅ Normalized (new diff: {diff_new:.6f})")

        except np.linalg.LinAlgError as e:
            print(f"  ⚠️  Warning: Could not normalize operators: {e}")

    def measure(self, rho: DensityMatrix) -> Dict[str, float]:
        """
        Measure all operators on density matrix.

        Args:
            rho: Density matrix

        Returns:
            Dict mapping operator names to probabilities
        """
        readings = {}
        for op in self.operators:
            readings[op.name] = op.measure(rho)

        return readings

    def to_povm_pack(self) -> POVMPack:
        """
        Convert to standard POVMPack for compatibility.

        Projection matrices are stored on each operator.
        """
        povm_operators = [op.to_povm_operator() for op in self.operators]
        return POVMPack(
            name=self.name,
            description=self.description,
            operators=povm_operators,
            rank=self.rank,
        )

    @classmethod
    def from_corpus_dict(
        cls,
        pack_name: str,
        description: str,
        corpus_dict: Dict[str, List[str]],  # axis_name → list of texts
        embedding_service,
        rank: int = 64,
    ) -> 'SemanticPOVMPack':
        """
        Learn pack from corpus dictionary.

        Args:
            pack_name: Pack name (e.g., "tone")
            description: Pack description
            corpus_dict: Dict mapping axis names to corpus texts
            embedding_service: Sentence embedding service
            rank: Density matrix rank

        Returns:
            Learned semantic POVM pack
        """
        print(f"\n{'='*80}")
        print(f"Learning semantic POVM pack: {pack_name}")
        print(f"{'='*80}\n")

        operators = []
        for axis_name, corpus_texts in corpus_dict.items():
            op = SemanticPOVMOperator.from_corpus(
                name=axis_name,
                corpus_texts=corpus_texts,
                embedding_service=embedding_service,
                rank=rank,
            )
            operators.append(op)

        pack = cls(
            name=pack_name,
            description=description,
            operators=operators,
            rank=rank,
        )

        print(f"\n✅ Pack '{pack_name}' learned with {len(operators)} operators")

        return pack

    def save(self, directory: Path):
        """Save pack to directory (one file per operator)."""
        pack_dir = directory / self.name
        pack_dir.mkdir(parents=True, exist_ok=True)

        # Save each operator
        for op in self.operators:
            filepath = pack_dir / f"{op.name}.pkl"
            op.save(filepath)

        # Save pack metadata
        metadata = {
            'name': self.name,
            'description': self.description,
            'rank': self.rank,
            'operators': [op.name for op in self.operators],
        }
        metadata_path = pack_dir / 'pack_metadata.json'
        import json
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"✅ Saved pack '{self.name}' to {pack_dir}")

    @classmethod
    def load(cls, directory: Path, pack_name: str) -> 'SemanticPOVMPack':
        """Load pack from directory."""
        import json

        pack_dir = directory / pack_name

        # Load metadata
        metadata_path = pack_dir / 'pack_metadata.json'
        with open(metadata_path) as f:
            metadata = json.load(f)

        # Load operators
        operators = []
        for op_name in metadata['operators']:
            filepath = pack_dir / f"{op_name}.pkl"
            op = SemanticPOVMOperator.load(filepath)
            operators.append(op)

        pack = cls(
            name=metadata['name'],
            description=metadata['description'],
            operators=operators,
            rank=metadata['rank'],
        )

        print(f"✅ Loaded pack '{pack_name}' with {len(operators)} operators")

        return pack


# ============================================================================
# Helper Functions
# ============================================================================

def create_density_matrix_with_operator(
    embedding: NDArray[np.float64],
    operator: SemanticPOVMOperator,
) -> DensityMatrix:
    """
    Create density matrix using operator's projection matrix.

    This ensures consistent ρ construction (same embedding → same ρ).

    Args:
        embedding: Text embedding
        operator: Semantic operator with fixed projection matrix

    Returns:
        Density matrix
    """
    return construct_density_matrix(
        embedding=embedding,
        rank=operator.rank,
        projection_matrix=operator.projection_matrix,
    )
