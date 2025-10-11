"""
Tools API - Analyze, Extract, Compare endpoints

Provides endpoints for the tools in the right-side toolbar:
- POST /analyze - POVM measurements and density matrix properties
- POST /extract - Semantic search and information extraction
- POST /compare - Text comparison with POVM readings
"""

import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional

from humanizer.services.transformation import TransformationService


router = APIRouter(prefix="/api", tags=["tools"])

# Initialize transformation service (reuse for embeddings and POVMs)
transformation_service = TransformationService()


# ============================================================================
# Request/Response Models
# ============================================================================

class AnalyzeRequest(BaseModel):
    """Request for text analysis."""
    text: str = Field(..., description="Text to analyze")
    povm_packs: List[str] = Field(
        default=["tetralemma", "tone"],
        description="POVM packs to measure",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "The mind constructs reality through language.",
                "povm_packs": ["tetralemma", "tone"],
            }
        }
    }


class AnalyzeResponse(BaseModel):
    """Response from analysis."""
    readings: Dict[str, Dict[str, float]] = Field(..., description="POVM readings per pack")
    density_matrix: Dict = Field(..., description="Density matrix properties")
    processing_time: int = Field(..., description="Processing time in ms")


class ExtractRequest(BaseModel):
    """Request for information extraction."""
    text: str = Field(..., description="Text to extract from")
    mode: str = Field(..., description="Extraction mode (semantic/entities/summary/keywords)")
    top_k: Optional[int] = Field(default=5, description="Number of results for semantic search")

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "Quantum mechanics describes reality at the smallest scales.",
                "mode": "semantic",
                "top_k": 5,
            }
        }
    }


class ExtractResponse(BaseModel):
    """Response from extraction."""
    mode: str
    semantic_matches: Optional[List[Dict]] = None
    entities: Optional[List[Dict]] = None
    summary: Optional[str] = None
    keywords: Optional[List[str]] = None
    processing_time: int


class CompareRequest(BaseModel):
    """Request for text comparison."""
    text_a: str = Field(..., description="First text")
    text_b: str = Field(..., description="Second text")
    povm_pack: str = Field(default="tone", description="POVM pack for comparison")

    model_config = {
        "json_schema_extra": {
            "example": {
                "text_a": "The cat sat on the mat.",
                "text_b": "A feline rested upon the floor covering.",
                "povm_pack": "tone",
            }
        }
    }


class CompareResponse(BaseModel):
    """Response from comparison."""
    text_a: str
    text_b: str
    similarity: Dict
    povm_comparison: Dict
    diff_stats: Dict
    processing_time: int


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_text(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Analyze text with POVM measurements.

    Returns:
    - POVM readings for each requested pack
    - Density matrix properties (purity, entropy, rank)
    - Processing time
    """
    start_time = time.time()

    try:
        # Embed text
        embedding = transformation_service.embed_text(request.text)

        # Construct density matrix
        from humanizer.ml.density import construct_density_matrix
        rho = construct_density_matrix(embedding, rank=transformation_service.rank)

        # Measure with each POVM pack
        readings = {}
        for pack_name in request.povm_packs:
            if pack_name not in transformation_service.povm_packs:
                continue

            pack = transformation_service.povm_packs[pack_name]
            pack_readings = pack.measure(rho)
            readings[pack_name] = pack_readings

        # Density matrix properties
        density_matrix = {
            "purity": rho.purity,
            "entropy": rho.entropy,
            "rank": rho.rank,
        }

        processing_time = int((time.time() - start_time) * 1000)

        return AnalyzeResponse(
            readings=readings,
            density_matrix=density_matrix,
            processing_time=processing_time,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/extract", response_model=ExtractResponse)
async def extract_information(request: ExtractRequest) -> ExtractResponse:
    """
    Extract information from text.

    Modes:
    - semantic: Find similar content in corpus
    - entities: Extract named entities
    - summary: Generate summary
    - keywords: Extract keywords
    """
    start_time = time.time()

    try:
        result = {
            "mode": request.mode,
            "processing_time": 0,
        }

        if request.mode == "semantic":
            # Semantic search (placeholder - would need vector DB)
            embedding = transformation_service.embed_text(request.text)

            # Placeholder: Return dummy similar content
            result["semantic_matches"] = [
                {
                    "text": "Quantum mechanics provides a detailed explanation...",
                    "similarity": 0.85,
                    "source": {
                        "type": "conversation",
                        "id": "12345",
                        "title": "Physics Discussion",
                    },
                },
                {
                    "text": "The quantum realm operates at minuscule scales...",
                    "similarity": 0.72,
                    "source": {
                        "type": "message",
                        "id": "67890",
                    },
                },
            ][:request.top_k]

        elif request.mode == "entities":
            # Entity extraction (placeholder - would use NER model)
            result["entities"] = [
                {"text": "Quantum mechanics", "type": "CONCEPT", "confidence": 0.95},
                {"text": "reality", "type": "CONCEPT", "confidence": 0.80},
            ]

        elif request.mode == "summary":
            # Summarization (placeholder - would use LLM)
            import httpx

            # Use Ollama for summarization
            prompt = f"Summarize the following text concisely in 1-2 sentences:\n\n{request.text}\n\nSummary:"

            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    response = await client.post(
                        "http://localhost:11434/api/generate",
                        json={
                            "model": "mistral:7b",
                            "prompt": prompt,
                            "stream": False,
                            "options": {"temperature": 0.5, "num_predict": 100},
                        },
                    )

                    if response.status_code == 200:
                        result["summary"] = response.json().get("response", "").strip()
                    else:
                        result["summary"] = "Summary generation failed."
            except Exception:
                result["summary"] = request.text[:200] + "..."  # Fallback truncation

        elif request.mode == "keywords":
            # Keyword extraction (placeholder - would use TF-IDF or similar)
            words = request.text.lower().split()
            # Simple frequency-based keywords
            from collections import Counter
            word_freq = Counter(w for w in words if len(w) > 4)
            result["keywords"] = [word for word, _ in word_freq.most_common(5)]

        processing_time = int((time.time() - start_time) * 1000)
        result["processing_time"] = processing_time

        return ExtractResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.post("/compare", response_model=CompareResponse)
async def compare_texts(request: CompareRequest) -> CompareResponse:
    """
    Compare two texts.

    Returns:
    - Embedding similarity (cosine, distance)
    - POVM reading comparison
    - Word-level diff statistics
    """
    start_time = time.time()

    try:
        # Embed both texts
        embedding_a = transformation_service.embed_text(request.text_a)
        embedding_b = transformation_service.embed_text(request.text_b)

        # Compute similarity
        import numpy as np

        cosine_sim = float(np.dot(embedding_a, embedding_b) / (
            np.linalg.norm(embedding_a) * np.linalg.norm(embedding_b)
        ))

        embedding_dist = float(np.linalg.norm(embedding_a - embedding_b))

        # Construct density matrices
        from humanizer.ml.density import construct_density_matrix
        rho_a = construct_density_matrix(embedding_a, rank=transformation_service.rank)
        rho_b = construct_density_matrix(embedding_b, rank=transformation_service.rank)

        # Measure with POVM pack
        pack = transformation_service.povm_packs[request.povm_pack]
        readings_a = pack.measure(rho_a)
        readings_b = pack.measure(rho_b)

        # Compute differences
        difference = {
            axis: readings_b[axis] - readings_a[axis]
            for axis in readings_a.keys()
        }

        # Word-level diff (simple)
        words_a = set(request.text_a.lower().split())
        words_b = set(request.text_b.lower().split())

        diff_stats = {
            "words_added": len(words_b - words_a),
            "words_removed": len(words_a - words_b),
            "words_changed": len(words_a.symmetric_difference(words_b)),
        }

        processing_time = int((time.time() - start_time) * 1000)

        return CompareResponse(
            text_a=request.text_a,
            text_b=request.text_b,
            similarity={
                "cosine": cosine_sim,
                "embedding_distance": embedding_dist,
            },
            povm_comparison={
                request.povm_pack: {
                    "text_a": readings_a,
                    "text_b": readings_b,
                    "difference": difference,
                }
            },
            diff_stats=diff_stats,
            processing_time=processing_time,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")


@router.get("/tools/health")
async def health_check() -> Dict[str, str]:
    """Health check for tools service."""
    return {
        "status": "healthy",
        "service": "tools",
        "tools": "analyze, extract, compare",
    }
