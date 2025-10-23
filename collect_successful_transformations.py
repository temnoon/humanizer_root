"""
Collect Successful GFS Transformations - Week 6 Step 1

This script collects successful transformations from GFS to build corpus for
pattern mining and rule learning.

Strategy:
1. Sample diverse texts from ChatGPT archive
2. Run GFS transformations on multiple pack/axis combinations
3. Collect successful transformations with word-level diffs
4. Save to JSON for pattern mining

Success criteria (from Week 5):
- improvement > 0.01 (1% POVM increase)
- text_change <= 0.4 (40% max change)
- coherence > 0.5 (50% quality)
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import List, Dict, Tuple, Set
from datetime import datetime
import difflib

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.database.connection import async_session_maker
from humanizer.models.chatgpt import ChatGPTMessage
from humanizer.services.transformation_engine import (
    LLMGuidedStrategy,
    TransformationContext,
    TransformationResult
)
from humanizer.services.sentence_embedding import get_sentence_embedding_service
from humanizer.core.trm.density import construct_density_matrix
from humanizer.services.operator_learning import load_all_operators

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# Configuration
# ============================================================================

# POVM packs and axes to test
PACK_AXES = {
    "tetralemma": ["A", "¬A", "both", "neither"],
    "tone": ["analytical", "critical", "empathic", "playful", "neutral"],
    "pragmatics": ["clarity", "coherence", "evidence", "charity"],
    "ontology": ["corporeal", "subjective", "objective", "mixed_frame"],
    "audience": ["expert", "general", "student", "policy", "editorial"]
}

# Sampling config
NUM_TEXTS_TO_SAMPLE = 20  # Start with 20 texts for initial corpus (can expand later)
MIN_TEXT_LENGTH = 50
MAX_TEXT_LENGTH = 500  # Focus on shorter texts (easier to analyze patterns)

# GFS config
NUM_CANDIDATES = 10  # Week 5 sweet spot
MAX_RETRIES = 3

# Output
OUTPUT_DIR = Path("data/successful_transformations")
OUTPUT_FILE = OUTPUT_DIR / f"corpus_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"


# ============================================================================
# Sampling
# ============================================================================

async def sample_diverse_texts(
    session: AsyncSession,
    num_texts: int = 100,
    min_length: int = 50,
    max_length: int = 500
) -> List[str]:
    """
    Sample diverse texts from ChatGPT archive.

    Strategy: Random sampling from user messages with length constraints.

    Args:
        session: Database session
        num_texts: Number of texts to sample
        min_length: Minimum text length (chars)
        max_length: Maximum text length (chars)

    Returns:
        List of sampled texts
    """
    logger.info(f"Sampling {num_texts} texts from ChatGPT archive...")

    # Query: random sample of user messages with length constraints
    stmt = (
        select(ChatGPTMessage.content_text)
        .where(ChatGPTMessage.author_role == "user")
        .where(func.length(ChatGPTMessage.content_text) >= min_length)
        .where(func.length(ChatGPTMessage.content_text) <= max_length)
        .order_by(func.random())
        .limit(num_texts)
    )

    result = await session.execute(stmt)
    texts = [row[0] for row in result.all() if row[0]]

    logger.info(f"Sampled {len(texts)} texts")
    return texts


# ============================================================================
# Word-Level Diff Analysis
# ============================================================================

def analyze_word_diff(original: str, transformed: str) -> Dict:
    """
    Analyze word-level differences between original and transformed text.

    Args:
        original: Original text
        transformed: Transformed text

    Returns:
        Dict with:
        - words_removed: List of words removed
        - words_added: List of words added
        - words_changed: List of (original, new) pairs
        - num_words_original: Total words in original
        - num_words_transformed: Total words in transformed
    """
    original_words = original.split()
    transformed_words = transformed.split()

    # Use difflib to get word-level diff
    matcher = difflib.SequenceMatcher(None, original_words, transformed_words)

    words_removed = []
    words_added = []
    words_changed = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'delete':
            words_removed.extend(original_words[i1:i2])
        elif tag == 'insert':
            words_added.extend(transformed_words[j1:j2])
        elif tag == 'replace':
            # This is a word substitution
            orig_chunk = " ".join(original_words[i1:i2])
            new_chunk = " ".join(transformed_words[j1:j2])
            words_changed.append((orig_chunk, new_chunk))

    return {
        "words_removed": words_removed,
        "words_added": words_added,
        "words_changed": words_changed,
        "num_words_original": len(original_words),
        "num_words_transformed": len(transformed_words),
        "word_overlap": len([w for w in original_words if w in transformed_words]) / len(original_words) if original_words else 0
    }


# ============================================================================
# Transformation Collection
# ============================================================================

async def collect_transformations_for_text(
    text: str,
    strategy: LLMGuidedStrategy,
    pack_axes: Dict[str, List[str]]
) -> List[Dict]:
    """
    Collect successful transformations for a single text across multiple axes.

    Args:
        text: Text to transform
        strategy: GFS strategy
        pack_axes: Dict of pack -> list of axes to test

    Returns:
        List of successful transformation records
    """
    successful = []
    embedding_service = get_sentence_embedding_service()
    semantic_packs = load_all_operators()

    for pack_name, axes in pack_axes.items():
        # Get initial readings for this pack
        embedding = embedding_service.embed_text(text)
        rho = construct_density_matrix(embedding, rank=64)
        pack = semantic_packs[pack_name].to_povm_pack()
        initial_readings = pack.measure(rho)

        for target_axis in axes:
            try:
                # Create context
                context = TransformationContext(
                    text=text,
                    target_axis=target_axis,
                    povm_pack_name=pack_name,
                    current_readings=initial_readings,
                    target_threshold=0.65,
                    max_change_ratio=0.4
                )

                # Transform
                result = strategy.transform(context)

                # Check if successful
                if result.success:
                    # Analyze word diff
                    word_diff = analyze_word_diff(text, result.transformed_text)

                    # Create record
                    record = {
                        "original_text": text,
                        "transformed_text": result.transformed_text,
                        "pack": pack_name,
                        "axis": target_axis,
                        "improvement": float(result.target_improvement),
                        "text_change_ratio": float(result.text_change_ratio),
                        "coherence": float(result.semantic_coherence),
                        "reading_before": float(result.readings_before.get(target_axis, 0.0)),
                        "reading_after": float(result.readings_after.get(target_axis, 0.0)),
                        "word_diff": word_diff,
                        "execution_time_ms": result.execution_time_ms,
                        "timestamp": datetime.now().isoformat()
                    }

                    successful.append(record)
                    logger.info(f"✅ Success: {pack_name}/{target_axis} - improvement={result.target_improvement:+.3f}")

            except Exception as e:
                logger.debug(f"Failed {pack_name}/{target_axis}: {e}")
                continue

    return successful


async def main():
    """Main collection loop."""
    logger.info("=" * 80)
    logger.info("COLLECTING SUCCESSFUL GFS TRANSFORMATIONS (Week 6)")
    logger.info("=" * 80)

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Initialize strategy
    logger.info(f"\nInitializing GFS strategy...")
    logger.info(f"  - num_candidates: {NUM_CANDIDATES}")
    logger.info(f"  - max_retries: {MAX_RETRIES}")

    strategy = LLMGuidedStrategy(
        rank=64,
        num_candidates=NUM_CANDIDATES,
        max_retries=MAX_RETRIES
    )

    if not strategy._available:
        logger.error("❌ LLM provider not available - check .env DEPLOYMENT_MODE=api")
        return

    logger.info("✅ Strategy initialized")

    # Sample texts
    async with async_session_maker() as session:
        texts = await sample_diverse_texts(
            session,
            num_texts=NUM_TEXTS_TO_SAMPLE,
            min_length=MIN_TEXT_LENGTH,
            max_length=MAX_TEXT_LENGTH
        )

    if not texts:
        logger.error("❌ No texts sampled")
        return

    logger.info(f"\n✅ Sampled {len(texts)} texts")
    logger.info(f"Starting transformation collection...")
    logger.info(f"  - Testing {sum(len(axes) for axes in PACK_AXES.values())} pack/axis combinations per text")
    logger.info(f"  - Total attempts: {len(texts) * sum(len(axes) for axes in PACK_AXES.values())}")

    # Collect transformations
    all_successful = []
    texts_processed = 0

    for i, text in enumerate(texts, 1):
        logger.info(f"\n{'─' * 80}")
        logger.info(f"Processing text {i}/{len(texts)}")
        logger.info(f"Text preview: \"{text[:80]}...\"")

        successful = await collect_transformations_for_text(text, strategy, PACK_AXES)
        all_successful.extend(successful)
        texts_processed += 1

        logger.info(f"Collected {len(successful)} successful transformations from this text")
        logger.info(f"Total successful so far: {len(all_successful)}")

        # Save periodically (every 10 texts)
        if i % 10 == 0:
            logger.info(f"\n💾 Saving checkpoint at {i} texts...")
            with open(OUTPUT_FILE, 'w') as f:
                json.dump({
                    "metadata": {
                        "total_texts_processed": texts_processed,
                        "total_successful": len(all_successful),
                        "num_candidates": NUM_CANDIDATES,
                        "max_retries": MAX_RETRIES,
                        "pack_axes": PACK_AXES,
                        "timestamp": datetime.now().isoformat()
                    },
                    "transformations": all_successful
                }, f, indent=2)

    # Final save
    logger.info(f"\n{'=' * 80}")
    logger.info("COLLECTION COMPLETE")
    logger.info(f"{'=' * 80}")
    logger.info(f"Total texts processed: {texts_processed}")
    logger.info(f"Total successful transformations: {len(all_successful)}")
    logger.info(f"Success rate per text: {len(all_successful) / texts_processed:.1f}")

    # Calculate success rate per pack/axis
    pack_axis_counts = {}
    for record in all_successful:
        key = f"{record['pack']}/{record['axis']}"
        pack_axis_counts[key] = pack_axis_counts.get(key, 0) + 1

    logger.info(f"\nSuccess counts by pack/axis:")
    for key, count in sorted(pack_axis_counts.items(), key=lambda x: x[1], reverse=True):
        logger.info(f"  {key}: {count}")

    # Save final results
    with open(OUTPUT_FILE, 'w') as f:
        json.dump({
            "metadata": {
                "total_texts_processed": texts_processed,
                "total_successful": len(all_successful),
                "num_candidates": NUM_CANDIDATES,
                "max_retries": MAX_RETRIES,
                "pack_axes": PACK_AXES,
                "pack_axis_counts": pack_axis_counts,
                "timestamp": datetime.now().isoformat()
            },
            "transformations": all_successful
        }, f, indent=2)

    logger.info(f"\n💾 Results saved to: {OUTPUT_FILE}")
    logger.info(f"\n✅ Collection complete!")


if __name__ == "__main__":
    asyncio.run(main())
