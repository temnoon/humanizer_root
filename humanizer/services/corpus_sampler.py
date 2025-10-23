"""
Corpus Sampler - Extract representative texts from archive for operator learning

This module samples texts from an archive that exemplify specific semantic axes.
Uses hybrid strategy: measure with existing operators to pre-filter, then optionally
validate with LLM for quality assurance.

Strategies:
- "measure": Use existing operators to rank texts (fast, biased by current operators)
- "search": Semantic search using axis descriptions (less biased, requires descriptions)
- "llm": LLM classification (most accurate, expensive)
- "hybrid": Measure + LLM validation (recommended: balanced cost/accuracy)

Usage:
    from humanizer.services.corpus_sampler import sample_corpus_from_archive

    config = CorpusSampleConfig(
        archive_name="chatgpt",
        target_pack="tone",
        samples_per_axis=30,
        strategy="hybrid"
    )

    result = await sample_corpus_from_archive(
        session=session,
        config=config,
        operators=semantic_packs
    )

    # result.corpus is Dict[axis_name, List[text]]
    # Ready for operator learning
"""

import logging
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Set
from uuid import UUID
import numpy as np
from numpy.typing import NDArray
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import anthropic

from humanizer.models.chatgpt import ChatGPTMessage
from humanizer.core.trm.semantic_operators import SemanticPOVMPack, create_density_matrix_with_operator
from humanizer.services.sentence_embedding import get_sentence_embedding_service
from humanizer.config import settings

logger = logging.getLogger(__name__)


# ============================================================================
# Configuration
# ============================================================================

@dataclass
class CorpusSampleConfig:
    """Configuration for corpus sampling."""
    archive_name: str
    target_pack: str  # e.g., "tone"
    samples_per_axis: int = 30  # Target corpus size per axis

    # Sampling strategy
    strategy: str = "hybrid"  # "measure", "search", "llm", "hybrid"

    # Measure-and-select params
    use_existing_operators: bool = True
    candidate_pool_size: int = 500  # Sample this many texts first
    top_k_candidates: int = 100  # Select top K per axis from pool

    # LLM validation params
    llm_validation: bool = True
    llm_model: str = "claude-sonnet-4"
    validation_batch_size: int = 50  # Validate this many at once
    min_confidence: float = 0.7  # LLM confidence threshold

    # Quality filters
    min_text_length: int = 50
    max_text_length: int = 2000
    diversity_threshold: float = 0.75  # Cosine similarity threshold


@dataclass
class CorpusSample:
    """Result of corpus sampling."""
    archive_name: str
    pack_name: str
    strategy: str

    # Corpus dictionary (axis -> texts)
    corpus: Dict[str, List[str]]

    # Metadata
    total_texts_sampled: int
    llm_validation_used: bool
    sampling_date: datetime

    # Quality metrics
    per_axis_counts: Dict[str, int]
    per_axis_diversity: Dict[str, float] = field(default_factory=dict)

    # Provenance (text -> message_uuid for tracking)
    text_provenance: Dict[str, UUID] = field(default_factory=dict)


# ============================================================================
# LLM Validation
# ============================================================================

VALIDATION_PROMPT_TEMPLATE = """You are evaluating whether a text exemplifies a specific semantic axis.

**Axis**: {axis_name}
**Description**: {axis_description}

**Text**:
\"\"\"
{text}
\"\"\"

Does this text strongly exemplify the "{axis_name}" axis as described?

Respond with valid JSON only (no markdown, no code blocks):
{{
  "exemplifies": true or false,
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}}"""


async def validate_text_with_llm(
    text: str,
    axis_name: str,
    axis_description: str,
    model: str = "claude-sonnet-4"
) -> Dict[str, any]:
    """
    Use LLM to validate if text exemplifies axis.

    Args:
        text: Text to validate
        axis_name: Axis name (e.g., "analytical")
        axis_description: Axis description
        model: LLM model to use

    Returns:
        {
            "exemplifies": bool,
            "confidence": float (0-1),
            "reasoning": str
        }
    """
    # Truncate text if too long (to save tokens)
    if len(text) > 1500:
        text = text[:1500] + "..."

    prompt = VALIDATION_PROMPT_TEMPLATE.format(
        axis_name=axis_name,
        axis_description=axis_description,
        text=text
    )

    try:
        # Call Claude API
        client = anthropic.Anthropic(api_key=settings.claude_api_key)

        message = client.messages.create(
            model="claude-sonnet-4-20250514",  # Latest Sonnet 4
            max_tokens=256,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        # Parse response
        response_text = message.content[0].text.strip()

        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])

        result = json.loads(response_text)

        return {
            "exemplifies": result.get("exemplifies", False),
            "confidence": result.get("confidence", 0.0),
            "reasoning": result.get("reasoning", "")
        }

    except Exception as e:
        logger.error(f"LLM validation error: {e}")
        # Return conservative default
        return {
            "exemplifies": False,
            "confidence": 0.0,
            "reasoning": f"Error: {str(e)}"
        }


# ============================================================================
# Diversity Filtering
# ============================================================================

def compute_pairwise_diversity(embeddings: List[NDArray]) -> float:
    """
    Compute mean pairwise cosine distance.

    Args:
        embeddings: List of embedding vectors

    Returns:
        Mean cosine distance (0-1, higher is more diverse)
    """
    if len(embeddings) < 2:
        return 1.0

    distances = []
    for i in range(len(embeddings)):
        for j in range(i + 1, len(embeddings)):
            # Cosine distance = 1 - cosine similarity
            sim = np.dot(embeddings[i], embeddings[j]) / (
                np.linalg.norm(embeddings[i]) * np.linalg.norm(embeddings[j])
            )
            distance = 1.0 - sim
            distances.append(distance)

    return np.mean(distances) if distances else 1.0


def ensure_diversity(
    texts_with_scores: List[Tuple[str, float, NDArray, UUID]],
    target_count: int,
    threshold: float = 0.75
) -> List[Tuple[str, float, UUID]]:
    """
    Filter similar texts to ensure corpus diversity.

    Greedy algorithm:
    1. Sort by score (descending)
    2. Keep highest-scoring text
    3. For each remaining text:
       - Compute max similarity to kept texts
       - If max_sim < threshold: keep
       - Otherwise: skip (too similar)
    4. Stop when target_count reached or no more texts

    Args:
        texts_with_scores: List of (text, score, embedding, uuid) tuples
        target_count: Target number of texts to keep
        threshold: Similarity threshold (0.75 = fairly distinct)

    Returns:
        List of (text, score, uuid) tuples (diverse subset)
    """
    if len(texts_with_scores) <= target_count:
        # All texts fit, no filtering needed
        return [(text, score, uuid) for text, score, emb, uuid in texts_with_scores]

    # Sort by score (descending)
    sorted_texts = sorted(texts_with_scores, key=lambda x: x[1], reverse=True)

    kept_texts = []
    kept_embeddings = []

    for text, score, emb, uuid in sorted_texts:
        if len(kept_texts) >= target_count:
            break

        if len(kept_embeddings) == 0:
            # Keep first (highest-scoring) text
            kept_texts.append((text, score, uuid))
            kept_embeddings.append(emb)
        else:
            # Check similarity to kept texts
            similarities = [
                np.dot(emb, kept_emb) / (np.linalg.norm(emb) * np.linalg.norm(kept_emb))
                for kept_emb in kept_embeddings
            ]
            max_sim = max(similarities)

            if max_sim < threshold:
                # Sufficiently different, keep it
                kept_texts.append((text, score, uuid))
                kept_embeddings.append(emb)
            else:
                # Too similar, skip
                logger.debug(f"Skipping similar text (max_sim={max_sim:.2f})")

    logger.info(f"Diversity filtering: {len(sorted_texts)} → {len(kept_texts)} texts")

    return kept_texts


# ============================================================================
# Sampling Strategies
# ============================================================================

async def sample_with_existing_operators(
    session: AsyncSession,
    config: CorpusSampleConfig,
    pack: SemanticPOVMPack,
    embedding_service,
) -> Dict[str, List[Tuple[str, float, NDArray, UUID]]]:
    """
    Sample corpus using existing operators to rank texts.

    Strategy:
    1. Sample large pool from archive
    2. Measure all texts with all operators in pack
    3. For each axis: select top K high-scorers
    4. Return candidates (before diversity filtering)

    Args:
        session: Database session
        config: Sampling configuration
        pack: POVM pack to use for measurement
        embedding_service: Sentence embedding service

    Returns:
        Dict[axis_name, List[(text, score, embedding, uuid)]]
    """
    logger.info(f"Sampling with existing operators: {config.target_pack}")

    # Sample pool from archive
    sample_stmt = (
        select(ChatGPTMessage.uuid, ChatGPTMessage.content_text)
        .where(ChatGPTMessage.content_text != None)
        .where(func.length(ChatGPTMessage.content_text) >= config.min_text_length)
        .where(func.length(ChatGPTMessage.content_text) <= config.max_text_length)
        .order_by(func.random())
        .limit(config.candidate_pool_size)
    )

    result = await session.execute(sample_stmt)
    pool = result.all()

    logger.info(f"Sampled pool: {len(pool)} texts")

    # Measure all texts with all operators
    axis_scores = {op.name: [] for op in pack.operators}

    for uuid, text in pool:
        # Embed once
        emb = embedding_service.embed_text(text)

        # Measure with each operator
        for op in pack.operators:
            rho = create_density_matrix_with_operator(emb, op)
            score = op.measure(rho)
            axis_scores[op.name].append((text, score, emb, uuid))

    # For each axis, select top K candidates
    candidates = {}
    for axis_name, scored_texts in axis_scores.items():
        # Sort by score (descending)
        sorted_texts = sorted(scored_texts, key=lambda x: x[1], reverse=True)
        top_k = sorted_texts[:config.top_k_candidates]
        candidates[axis_name] = top_k

        logger.info(
            f"  {axis_name}: top_k={len(top_k)}, "
            f"score_range=[{top_k[-1][1]:.3f}, {top_k[0][1]:.3f}]"
        )

    return candidates


async def hybrid_sampling(
    session: AsyncSession,
    config: CorpusSampleConfig,
    pack: SemanticPOVMPack,
    axis_descriptions: Dict[str, str],
    embedding_service,
) -> CorpusSample:
    """
    Hybrid sampling: Measure with operators, then validate with LLM.

    Process:
    1. Use existing operators to get top K candidates per axis
    2. (Optional) LLM validation on top N candidates
    3. Diversity filtering to target count
    4. Return corpus

    Args:
        session: Database session
        config: Sampling configuration
        pack: POVM pack
        axis_descriptions: Dict[axis_name, description] for LLM validation
        embedding_service: Sentence embedding service

    Returns:
        CorpusSample with corpus and metadata
    """
    logger.info(f"Hybrid sampling: {config.target_pack} ({config.samples_per_axis} per axis)")

    # Step 1: Measure with existing operators
    candidates = await sample_with_existing_operators(
        session, config, pack, embedding_service
    )

    # Step 2: Optional LLM validation
    validated_candidates = {}

    if config.llm_validation and axis_descriptions:
        logger.info("LLM validation enabled")

        for axis_name, axis_candidates in candidates.items():
            # Validate top N candidates
            to_validate = axis_candidates[:config.validation_batch_size]

            validated = []
            for text, score, emb, uuid in to_validate:
                axis_desc = axis_descriptions.get(axis_name, f"Texts that are {axis_name}")

                validation = await validate_text_with_llm(
                    text=text,
                    axis_name=axis_name,
                    axis_description=axis_desc,
                    model=config.llm_model
                )

                if validation["exemplifies"] and validation["confidence"] >= config.min_confidence:
                    # Use LLM confidence as new score
                    new_score = validation["confidence"]
                    validated.append((text, new_score, emb, uuid))
                    logger.debug(
                        f"  {axis_name}: PASS (confidence={validation['confidence']:.2f})"
                    )
                else:
                    logger.debug(
                        f"  {axis_name}: FAIL (confidence={validation['confidence']:.2f})"
                    )

            if len(validated) > 0:
                validated_candidates[axis_name] = validated
                logger.info(
                    f"  {axis_name}: {len(to_validate)} candidates → {len(validated)} validated"
                )
            else:
                # No validated candidates, fall back to top candidates
                logger.warning(
                    f"  {axis_name}: No LLM-validated candidates, using top {config.samples_per_axis}"
                )
                validated_candidates[axis_name] = axis_candidates[:config.samples_per_axis]

    else:
        # No LLM validation, use all candidates
        validated_candidates = candidates

    # Step 3: Diversity filtering
    corpus = {}
    per_axis_counts = {}
    per_axis_diversity = {}
    text_provenance = {}

    for axis_name, axis_candidates in validated_candidates.items():
        # Apply diversity filtering
        diverse_texts = ensure_diversity(
            texts_with_scores=axis_candidates,
            target_count=config.samples_per_axis,
            threshold=config.diversity_threshold
        )

        # Extract texts and provenance
        texts = []
        embeddings = []
        for text, score, uuid in diverse_texts:
            texts.append(text)
            text_provenance[text] = uuid

            # Get embedding for diversity metric
            emb = embedding_service.embed_text(text)
            embeddings.append(emb)

        corpus[axis_name] = texts
        per_axis_counts[axis_name] = len(texts)

        # Compute diversity
        diversity = compute_pairwise_diversity(embeddings)
        per_axis_diversity[axis_name] = diversity

        logger.info(
            f"  {axis_name}: {len(texts)} texts, diversity={diversity:.2f}"
        )

    total_texts = sum(per_axis_counts.values())

    result = CorpusSample(
        archive_name=config.archive_name,
        pack_name=config.target_pack,
        strategy=config.strategy,
        corpus=corpus,
        total_texts_sampled=total_texts,
        llm_validation_used=config.llm_validation,
        sampling_date=datetime.now(),
        per_axis_counts=per_axis_counts,
        per_axis_diversity=per_axis_diversity,
        text_provenance=text_provenance
    )

    logger.info(
        f"Corpus sampling complete: {total_texts} texts across {len(corpus)} axes"
    )

    return result


# ============================================================================
# Main API
# ============================================================================

async def sample_corpus_from_archive(
    session: AsyncSession,
    config: CorpusSampleConfig,
    operators: Optional[Dict[str, SemanticPOVMPack]] = None,
    axis_descriptions: Optional[Dict[str, str]] = None,
    embedding_service = None,
) -> CorpusSample:
    """
    Sample representative corpus from archive.

    Args:
        session: Database session
        config: Sampling configuration
        operators: Current operators (for "measure" or "hybrid" strategies)
        axis_descriptions: Axis descriptions (for LLM validation)
        embedding_service: Optional

    Returns:
        CorpusSample with corpus dict and metadata
    """
    if embedding_service is None:
        embedding_service = get_sentence_embedding_service()

    # Get target pack
    if config.strategy in ["measure", "hybrid"]:
        if not operators or config.target_pack not in operators:
            raise ValueError(
                f"Operators required for strategy '{config.strategy}' "
                f"(pack '{config.target_pack}' not found)"
            )
        pack = operators[config.target_pack]
    else:
        # Other strategies not yet implemented
        raise NotImplementedError(f"Strategy '{config.strategy}' not yet implemented")

    # Execute sampling
    if config.strategy == "hybrid":
        return await hybrid_sampling(
            session=session,
            config=config,
            pack=pack,
            axis_descriptions=axis_descriptions or {},
            embedding_service=embedding_service
        )
    elif config.strategy == "measure":
        # Measure-only (no LLM validation)
        config.llm_validation = False
        return await hybrid_sampling(
            session=session,
            config=config,
            pack=pack,
            axis_descriptions={},
            embedding_service=embedding_service
        )
    else:
        raise NotImplementedError(f"Strategy '{config.strategy}' not implemented")


# ============================================================================
# Utility: Save Corpus to Disk
# ============================================================================

def save_corpus_to_disk(
    corpus_sample: CorpusSample,
    output_dir: str,
) -> None:
    """
    Save corpus to disk in same format as seed corpus.

    Creates files: {output_dir}/{pack_name}/{axis_name}.json

    Args:
        corpus_sample: Corpus sample result
        output_dir: Output directory (e.g., "data/povm_corpus/chatgpt_archive")
    """
    from pathlib import Path

    pack_dir = Path(output_dir) / corpus_sample.pack_name
    pack_dir.mkdir(parents=True, exist_ok=True)

    for axis_name, texts in corpus_sample.corpus.items():
        # Create examples list
        examples = [
            {
                "text": text,
                "source": f"archive:{corpus_sample.archive_name}",
                "quality_score": 1.0,  # Placeholder
                "message_uuid": str(corpus_sample.text_provenance.get(text, ""))
            }
            for text in texts
        ]

        # Create corpus file
        corpus_data = {
            "pack": corpus_sample.pack_name,
            "axis": axis_name,
            "description": f"Texts exemplifying '{axis_name}' from {corpus_sample.archive_name}",
            "examples": examples,
            "count": len(examples),
            "sampling_date": corpus_sample.sampling_date.isoformat(),
            "strategy": corpus_sample.strategy,
            "diversity": corpus_sample.per_axis_diversity.get(axis_name, 0.0)
        }

        # Save to file
        filepath = pack_dir / f"{axis_name}.json"
        with open(filepath, "w") as f:
            json.dump(corpus_data, f, indent=2)

        logger.info(f"Saved corpus: {filepath} ({len(examples)} examples)")

    logger.info(f"Corpus saved to: {pack_dir}")
