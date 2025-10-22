"""
POVM API routes - Measurement operators

Endpoints:
- POST /povm/measure - Measure embedding with POVM pack
- GET /povm/list - List available POVM packs
"""

from fastapi import APIRouter, HTTPException, status
import numpy as np

from humanizer.core.trm.povm import get_all_packs
from humanizer.core.trm.density import construct_density_matrix
from humanizer.models.schemas import (
    POVMMeasureRequest,
    POVMMeasureResponse,
    POVMListResponse,
)

router = APIRouter(prefix="/povm", tags=["povm"])


@router.post("/measure", response_model=POVMMeasureResponse)
async def measure_povm(request: POVMMeasureRequest):
    """
    Measure an embedding with a POVM pack.

    Process:
    1. Construct ρ from embedding
    2. Apply POVM measurements
    3. Return Born rule probabilities

    Args:
        request: POVMMeasureRequest with embedding and povm_pack name

    Returns:
        POVMMeasureResponse with readings
    """
    try:
        # Convert embedding to numpy array
        embedding = np.array(request.embedding, dtype=np.float64)

        # Validate embedding dimension
        if len(embedding) != 384:
            raise ValueError(f"Embedding must be 384-dim, got {len(embedding)}")

        # Normalize
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

        # Construct ρ
        rho = construct_density_matrix(embedding, rank=64)

        # Get POVM pack
        packs = get_all_packs(rank=64)
        if request.povm_pack not in packs:
            available = list(packs.keys())
            raise ValueError(
                f"Unknown POVM pack: {request.povm_pack}. Available: {available}"
            )

        pack = packs[request.povm_pack]

        # Measure
        readings = pack.measure(rho)

        return POVMMeasureResponse(
            povm_pack=request.povm_pack,
            readings=readings,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to measure POVM: {str(e)}"
        )


@router.get("/list", response_model=POVMListResponse)
async def list_povm_packs():
    """
    List all available POVM packs.

    Returns information about each pack including axes.

    Returns:
        POVMListResponse with pack information
    """
    try:
        packs = get_all_packs(rank=64)

        packs_info = []
        for name, pack in packs.items():
            axes = [op.name for op in pack.operators]
            packs_info.append({
                "name": name,
                "description": pack.description,
                "axes": axes,
                "rank": pack.rank,
            })

        return POVMListResponse(packs=packs_info)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list POVM packs: {str(e)}"
        )
