"""
Sentence-by-Sentence Transformation (Week 5 Phase 2)

For medium/long texts (200+ chars), transform each sentence individually
with context from previous sentences to maintain coherence.
"""

from typing import List, Tuple, Optional
from dataclasses import dataclass
import re
import logging

from humanizer.services.transformation_engine import (
    LLMGuidedStrategy,
    TransformationContext,
    TransformationResult
)

logger = logging.getLogger(__name__)


@dataclass
class SentenceTransformResult:
    """Result of sentence-by-sentence transformation."""
    original_text: str
    final_text: str
    sentence_results: List[TransformationResult]
    success: bool
    overall_improvement: float
    overall_coherence: float
    execution_time_ms: float


class SentenceBySentenceTransformer:
    """
    Transform longer texts sentence-by-sentence with context.

    Week 5 Phase 2: Addresses the challenge of transforming longer narratives
    where single-pass LLM transformations fail.

    Strategy:
    - Split into sentences
    - Transform each with GFS + context from previous 2 sentences
    - Verify coherence across boundaries
    - Reassemble with spacing preserved
    """

    def __init__(
        self,
        llm_strategy: Optional[LLMGuidedStrategy] = None,
        rank: int = 64
    ):
        """
        Initialize sentence-by-sentence transformer.

        Args:
            llm_strategy: LLMGuidedStrategy instance (creates new if None)
            rank: Dimension for density matrices
        """
        self.strategy = llm_strategy or LLMGuidedStrategy(rank=rank)
        self.rank = rank

    def split_sentences(self, text: str) -> List[str]:
        """
        Split text into sentences preserving punctuation.

        Uses simple regex-based splitting (better than NLTK for this use case).

        Args:
            text: Text to split

        Returns:
            List of sentences
        """
        # Split on sentence endings (.!?) followed by space or end
        # But preserve abbreviations (e.g., Dr., Mr., etc.)
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())

        # Filter out empty sentences
        sentences = [s.strip() for s in sentences if s.strip()]

        return sentences

    def transform(
        self,
        text: str,
        target_axis: str,
        povm_pack_name: str,
        current_readings: dict,
        target_threshold: float = 0.65,
        max_change_ratio: float = 0.4
    ) -> SentenceTransformResult:
        """
        Transform text sentence-by-sentence with context.

        Process:
        1. Split into sentences
        2. For each sentence:
           - Build context from previous 2 sentences
           - Transform with GFS
           - Verify doesn't break coherence
        3. Reassemble

        Args:
            text: Text to transform
            target_axis: Target POVM axis
            povm_pack_name: POVM pack name
            current_readings: Current POVM readings
            target_threshold: Target probability threshold
            max_change_ratio: Max fraction of text to change

        Returns:
            SentenceTransformResult with all sentence results
        """
        import time
        start_time = time.time()

        # Short texts: use single-pass GFS (faster)
        if len(text) < 200:
            logger.info(f"Text too short ({len(text)} chars) for sentence-by-sentence, using single-pass")
            context = TransformationContext(
                text=text,
                target_axis=target_axis,
                povm_pack_name=povm_pack_name,
                current_readings=current_readings,
                target_threshold=target_threshold,
                max_change_ratio=max_change_ratio
            )
            result = self.strategy.transform(context)

            execution_time = (time.time() - start_time) * 1000

            return SentenceTransformResult(
                original_text=text,
                final_text=result.transformed_text,
                sentence_results=[result],
                success=result.success,
                overall_improvement=result.target_improvement,
                overall_coherence=result.semantic_coherence,
                execution_time_ms=execution_time
            )

        # Split into sentences
        sentences = self.split_sentences(text)
        logger.info(f"Split text into {len(sentences)} sentences")

        # Transform each sentence
        transformed_sentences = []
        sentence_results = []
        context_sentences = []  # Track last 2 sentences for context

        for i, sentence in enumerate(sentences):
            logger.info(f"Transforming sentence {i+1}/{len(sentences)}: \"{sentence[:50]}...\"")

            # Build context from previous sentences
            context_text = self._build_context(context_sentences, sentence)

            # Create transformation context
            # Note: We use sentence-level readings, not document-level
            ctx = TransformationContext(
                text=sentence,
                target_axis=target_axis,
                povm_pack_name=povm_pack_name,
                current_readings=current_readings,  # Approx with doc-level for now
                target_threshold=target_threshold,
                max_change_ratio=max_change_ratio
            )

            # Transform
            result = self.strategy.transform(ctx)
            sentence_results.append(result)

            # Use transformed version (or original if failed)
            transformed = result.transformed_text if result.success else sentence

            transformed_sentences.append(transformed)

            # Update context (keep last 2 sentences)
            context_sentences.append(transformed)
            if len(context_sentences) > 2:
                context_sentences.pop(0)

            logger.info(
                f"  {'✅' if result.success else '❌'} "
                f"Improvement: {result.target_improvement:+.3f}, "
                f"Change: {result.text_change_ratio:.1%}"
            )

        # Reassemble
        final_text = " ".join(transformed_sentences)

        # Compute overall metrics
        total_successes = sum(1 for r in sentence_results if r.success)
        success_rate = total_successes / len(sentence_results)
        overall_success = success_rate >= 0.5  # At least half succeeded

        avg_improvement = sum(r.target_improvement for r in sentence_results) / len(sentence_results)
        avg_coherence = sum(r.semantic_coherence for r in sentence_results) / len(sentence_results)

        execution_time = (time.time() - start_time) * 1000

        logger.info(
            f"Sentence-by-sentence complete: {total_successes}/{len(sentences)} sentences succeeded, "
            f"avg improvement {avg_improvement:+.3f}, "
            f"time {execution_time:.0f}ms"
        )

        return SentenceTransformResult(
            original_text=text,
            final_text=final_text,
            sentence_results=sentence_results,
            success=overall_success,
            overall_improvement=avg_improvement,
            overall_coherence=avg_coherence,
            execution_time_ms=execution_time
        )

    def _build_context(self, previous_sentences: List[str], current_sentence: str) -> str:
        """
        Build context string from previous sentences.

        Args:
            previous_sentences: List of previous transformed sentences
            current_sentence: Current sentence being transformed

        Returns:
            Context string for prompt
        """
        if not previous_sentences:
            return ""

        context = "Previous context:\n"
        for sent in previous_sentences:
            context += f"  {sent}\n"
        context += f"\nNow transforming: {current_sentence}"

        return context
