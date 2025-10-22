"""
TRM Core - Transformation via Recursive Measurement

This module contains the core TRM components:
- Density matrix construction (ρ from embeddings)
- POVM operators (measurement)
- Verification (convergence checking)
- Stateless transformer (pure transformation logic)
"""

from humanizer.core.trm.density import (
    construct_density_matrix,
    rho_distance,
    principal_directions,
    DensityMatrix,
)
from humanizer.core.trm.povm import (
    get_all_packs,
    create_tetralemma_pack,
    create_tone_pack,
    create_ontology_pack,
    create_pragmatics_pack,
    create_audience_pack,
    POVMPack,
    POVMOperator,
)
from humanizer.core.trm.verification import (
    verify_transformation,
    compute_transformation_trajectory,
    diagnose_transformation_failure,
    VerificationResult,
)
from humanizer.core.trm.transformer import (
    StatelessTransformer,
    TransformOptions,
    TransformStep,
    TransformResult,
)

__all__ = [
    # Density matrix
    "construct_density_matrix",
    "rho_distance",
    "principal_directions",
    "DensityMatrix",
    # POVM
    "get_all_packs",
    "create_tetralemma_pack",
    "create_tone_pack",
    "create_ontology_pack",
    "create_pragmatics_pack",
    "create_audience_pack",
    "POVMPack",
    "POVMOperator",
    # Verification
    "verify_transformation",
    "compute_transformation_trajectory",
    "diagnose_transformation_failure",
    "VerificationResult",
    # Transformer
    "StatelessTransformer",
    "TransformOptions",
    "TransformStep",
    "TransformResult",
]
