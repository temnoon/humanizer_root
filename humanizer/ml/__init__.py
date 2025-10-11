"""
TRM Core - Quantum-inspired machine learning for consciousness work

This module implements actual quantum formalism:
- Density matrices (ρ) via eigendecomposition
- POVM operators (PSD, E_i = B_i @ B_i^T)
- Born rule probabilities
- Verification loop for transformations
"""

from .density import construct_density_matrix, DensityMatrix
from .povm import POVMPack, apply_born_rule
from .verification import verify_transformation, VerificationResult

__all__ = [
    "construct_density_matrix",
    "DensityMatrix",
    "POVMPack",
    "apply_born_rule",
    "verify_transformation",
    "VerificationResult",
]
