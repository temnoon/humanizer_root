"""
Transformation Engine - POVM-guided text transformations for TRM

This module implements the transformation strategies for the quantum reading system:
- TransformationStrategy: Abstract interface for transformation approaches
- RuleBasedStrategy: Lexical pattern-based transformations
- LLMGuidedStrategy: Local LLM-guided transformations (Phase 2B)
- HybridStrategy: Rules first, LLM fallback (Phase 2B)

Design Principles:
1. Local-first: Prefer rules and local LLMs over APIs
2. Verification-driven: Always check if transformation succeeded
3. Cost-aware: Track $ and latency for each strategy
4. Strategy pattern: Easy to swap/compare methods

Phase 2A (current): RuleBasedStrategy only
Phase 2B (next): Add LLM strategies
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from enum import Enum
import logging
import time
import numpy as np
from numpy.typing import NDArray

# TRM core
from humanizer.core.trm.density import construct_density_matrix, rho_distance
from humanizer.core.trm.povm import get_all_packs, POVMPack
from humanizer.core.trm.verification import verify_transformation

# Embedding service
from humanizer.services.sentence_embedding import get_sentence_embedding_service

logger = logging.getLogger(__name__)


# ============================================================================
# Data Structures
# ============================================================================

class TransformationMethod(str, Enum):
    """Transformation method types."""
    RULE_BASED = "rule_based"
    LLM_GUIDED = "llm_guided"
    HYBRID = "hybrid"


@dataclass
class TransformationContext:
    """
    Context for a transformation request.

    Contains all information needed to transform text toward a target axis.
    """
    text: str
    target_axis: str
    povm_pack_name: str
    current_readings: Dict[str, float]
    target_threshold: float = 0.65  # Target POVM probability
    max_change_ratio: float = 0.3  # Max 30% text change


@dataclass
class TransformationResult:
    """
    Result of a transformation attempt.

    Contains transformed text, metadata, and verification results.
    """
    # Core results
    transformed_text: str
    success: bool

    # POVM measurements
    readings_before: Dict[str, float]
    readings_after: Dict[str, float]

    # Quality metrics
    target_improvement: float  # Change in target axis probability
    rho_distance_moved: float  # How much ρ changed
    text_change_ratio: float  # Fraction of text modified
    semantic_coherence: float  # Subjective quality score (0-1)

    # Metadata
    method: TransformationMethod
    strategy_name: str
    execution_time_ms: float
    cost_usd: float = 0.0  # For LLM-based strategies

    # Diagnostics
    rules_applied: Optional[List[str]] = None  # For rule-based
    prompt_tokens: Optional[int] = None  # For LLM-based
    completion_tokens: Optional[int] = None
    error_message: Optional[str] = None


# ============================================================================
# Abstract Strategy Interface
# ============================================================================

class TransformationStrategy(ABC):
    """
    Abstract base class for transformation strategies.

    All strategies must implement:
    - transform(): Main transformation logic
    - estimate_cost(): Predict $ cost
    - estimate_latency(): Predict execution time
    """

    def __init__(self, rank: int = 64):
        """
        Initialize strategy.

        Args:
            rank: Dimension for density matrices
        """
        self.rank = rank
        self.embedding_service = get_sentence_embedding_service()
        self.povm_packs = get_all_packs(rank=rank)

    @abstractmethod
    def transform(
        self,
        context: TransformationContext
    ) -> TransformationResult:
        """
        Transform text toward target axis.

        Args:
            context: Transformation context with text and target

        Returns:
            TransformationResult with transformed text and metrics
        """
        pass

    @abstractmethod
    def estimate_cost(self, context: TransformationContext) -> float:
        """
        Estimate cost in USD for this transformation.

        Args:
            context: Transformation context

        Returns:
            Estimated cost in USD
        """
        pass

    @abstractmethod
    def estimate_latency(self, context: TransformationContext) -> float:
        """
        Estimate execution time in milliseconds.

        Args:
            context: Transformation context

        Returns:
            Estimated latency in ms
        """
        pass

    def _verify_transformation(
        self,
        text_before: str,
        text_after: str,
        context: TransformationContext
    ) -> Tuple[Dict[str, float], Dict[str, float], float, float]:
        """
        Verify transformation using TRM core.

        Process:
        1. Embed both texts
        2. Construct density matrices
        3. Measure with POVM pack
        4. Compute improvement and ρ distance

        Args:
            text_before: Original text
            text_after: Transformed text
            context: Transformation context

        Returns:
            Tuple of (readings_before, readings_after, improvement, rho_dist)
        """
        # Embed
        emb_before = self.embedding_service.embed_text(text_before)
        emb_after = self.embedding_service.embed_text(text_after)

        # Construct density matrices
        rho_before = construct_density_matrix(emb_before, rank=self.rank)
        rho_after = construct_density_matrix(emb_after, rank=self.rank)

        # Measure
        pack = self.povm_packs[context.povm_pack_name]
        readings_before = pack.measure(rho_before)
        readings_after = pack.measure(rho_after)

        # Compute improvement
        improvement = readings_after[context.target_axis] - readings_before[context.target_axis]

        # Compute ρ distance
        rho_dist = rho_distance(rho_before, rho_after)

        return readings_before, readings_after, improvement, rho_dist

    def _compute_text_change_ratio(self, text_before: str, text_after: str) -> float:
        """
        Compute fraction of text that changed.

        Uses simple word-level diff.

        Args:
            text_before: Original text
            text_after: Transformed text

        Returns:
            Ratio of changed words (0.0 to 1.0)
        """
        words_before = set(text_before.lower().split())
        words_after = set(text_after.lower().split())

        if len(words_before) == 0:
            return 0.0

        changed = len(words_before.symmetric_difference(words_after))
        total = max(len(words_before), len(words_after))

        return changed / total if total > 0 else 0.0


# ============================================================================
# Rule-Based Strategy (Phase 2A)
# ============================================================================

class RuleBasedStrategy(TransformationStrategy):
    """
    Lexical pattern-based transformation strategy.

    Uses predefined rules to modify text:
    - Word substitutions (think → hypothesize)
    - Phrase removal (hedging, filler words)
    - Sentence patterns (add analytical framing)

    Pros:
    - Fast (~10-50ms)
    - Free (no API costs)
    - Deterministic (reproducible)
    - Interpretable (can explain what changed)

    Cons:
    - Limited coverage (only handles known patterns)
    - May produce unnatural text
    - Can't handle complex semantic shifts

    Use when:
    - Quick iterations needed
    - Text matches known patterns
    - Interpretability important
    """

    def __init__(self, rank: int = 64):
        """
        Initialize rule-based strategy.

        Args:
            rank: Dimension for density matrices
        """
        super().__init__(rank=rank)

        # Import rules (from transformation_rules.py)
        from humanizer.services.transformation_rules import (
            get_rules_for_axis,
            apply_word_substitutions,
            apply_phrase_removal,
            apply_sentence_patterns
        )

        self.get_rules = get_rules_for_axis
        self.apply_word_subs = apply_word_substitutions
        self.apply_phrase_removal = apply_phrase_removal
        self.apply_sentence_patterns = apply_sentence_patterns

    def transform(
        self,
        context: TransformationContext
    ) -> TransformationResult:
        """
        Apply lexical rules to transform text toward target axis.

        Process:
        1. Get rules for target axis
        2. Apply word substitutions
        3. Apply phrase removal
        4. Apply sentence patterns
        5. Verify transformation
        6. Return result

        Args:
            context: Transformation context

        Returns:
            TransformationResult with metrics
        """
        start_time = time.time()
        rules_applied = []

        try:
            # Get rules for target axis
            rules = self.get_rules(context.povm_pack_name, context.target_axis)

            if not rules:
                logger.warning(
                    f"No rules found for {context.povm_pack_name}/{context.target_axis}"
                )
                return self._failed_result(
                    context,
                    f"No rules available for {context.target_axis}",
                    start_time
                )

            # Apply transformations in sequence
            text = context.text

            # 1. Word substitutions
            if "word_substitutions" in rules:
                text, applied = self.apply_word_subs(text, rules["word_substitutions"])
                rules_applied.extend(applied)

            # 2. Phrase removal (hedging, filler)
            if "phrase_removal" in rules:
                text, applied = self.apply_phrase_removal(text, rules["phrase_removal"])
                rules_applied.extend(applied)

            # 3. Sentence patterns
            if "sentence_patterns" in rules:
                text, applied = self.apply_sentence_patterns(text, rules["sentence_patterns"])
                rules_applied.extend(applied)

            # Check if text changed
            if text == context.text:
                logger.info("No rules matched - text unchanged")
                return self._failed_result(
                    context,
                    "No rules matched input text",
                    start_time
                )

            # Verify transformation
            readings_before, readings_after, improvement, rho_dist = self._verify_transformation(
                context.text,
                text,
                context
            )

            # Compute metrics
            text_change_ratio = self._compute_text_change_ratio(context.text, text)
            execution_time = (time.time() - start_time) * 1000

            # Assess semantic coherence (heuristic)
            coherence = self._assess_coherence(text, text_change_ratio)

            # Check success criteria
            success = (
                improvement > 0.01 and  # At least 1% improvement
                text_change_ratio <= context.max_change_ratio and  # Not too much change
                coherence > 0.5  # Reasonable quality
            )

            return TransformationResult(
                transformed_text=text,
                success=success,
                readings_before=readings_before,
                readings_after=readings_after,
                target_improvement=improvement,
                rho_distance_moved=rho_dist,
                text_change_ratio=text_change_ratio,
                semantic_coherence=coherence,
                method=TransformationMethod.RULE_BASED,
                strategy_name="RuleBasedStrategy",
                execution_time_ms=execution_time,
                cost_usd=0.0,
                rules_applied=rules_applied,
            )

        except Exception as e:
            logger.error(f"Rule-based transformation failed: {e}", exc_info=True)
            return self._failed_result(
                context,
                str(e),
                start_time
            )

    def estimate_cost(self, context: TransformationContext) -> float:
        """Rules are free."""
        return 0.0

    def estimate_latency(self, context: TransformationContext) -> float:
        """
        Estimate latency (fast, ~10-50ms).

        Depends on text length and number of rules.
        """
        text_length = len(context.text)
        # Rough heuristic: 0.01ms per character + 10ms baseline
        return 10 + (text_length * 0.01)

    def _assess_coherence(self, text: str, change_ratio: float) -> float:
        """
        Heuristic coherence assessment.

        Simple checks:
        - Not too much change (change_ratio < 0.5)
        - Reasonable length (not truncated)
        - No obvious artifacts

        Args:
            text: Transformed text
            change_ratio: Fraction changed

        Returns:
            Coherence score (0-1)
        """
        score = 1.0

        # Penalize excessive changes
        if change_ratio > 0.5:
            score -= 0.3

        # Penalize very short texts (likely truncated)
        if len(text) < 20:
            score -= 0.2

        # Penalize multiple spaces or weird punctuation
        if "  " in text or ".." in text:
            score -= 0.1

        return max(0.0, min(1.0, score))

    def _failed_result(
        self,
        context: TransformationContext,
        error_message: str,
        start_time: float
    ) -> TransformationResult:
        """
        Create failed transformation result.

        Args:
            context: Transformation context
            error_message: Error description
            start_time: Start time for latency calculation

        Returns:
            TransformationResult marked as failed
        """
        execution_time = (time.time() - start_time) * 1000

        return TransformationResult(
            transformed_text=context.text,  # Return unchanged
            success=False,
            readings_before=context.current_readings,
            readings_after=context.current_readings,
            target_improvement=0.0,
            rho_distance_moved=0.0,
            text_change_ratio=0.0,
            semantic_coherence=0.0,
            method=TransformationMethod.RULE_BASED,
            strategy_name="RuleBasedStrategy",
            execution_time_ms=execution_time,
            cost_usd=0.0,
            error_message=error_message,
        )


# ============================================================================
# Placeholder for Phase 2B Strategies
# ============================================================================

class LLMGuidedStrategy(TransformationStrategy):
    """
    LLM-guided transformation strategy (Phase 2B).

    Uses StatelessTransformer with local LLM (Ollama) or cloud LLM (Anthropic)
    depending on deployment mode.

    Benefits:
    - Handles complex semantic shifts that rules can't
    - Works with any POVM pack
    - Adapts to context via chain-of-thought prompts

    Tradeoffs:
    - Slower than rules (1-3s vs 10-50ms)
    - Costs $ for cloud deployments
    - Requires LLM availability
    """

    def __init__(self, rank: int = 64):
        """
        Initialize LLM-guided strategy.

        Args:
            rank: Dimension for density matrices
        """
        super().__init__(rank)

        # Import locally to avoid circular dependencies
        from humanizer.core.trm.transformer import StatelessTransformer, TransformOptions
        from humanizer.core.embeddings import get_embedding_function
        from humanizer.core.llm import get_llm_function, get_llm_provider
        from humanizer.config import settings

        # Initialize StatelessTransformer
        try:
            embed_fn = get_embedding_function()
            llm_fn = get_llm_function(settings)
            self.transformer = StatelessTransformer(
                embed_fn=embed_fn,
                llm_fn=llm_fn,
                rank=rank
            )
            self.llm_provider = get_llm_provider(settings)
            self._available = True
        except Exception as e:
            logger.error(f"Failed to initialize LLMGuidedStrategy: {e}")
            self.transformer = None
            self.llm_provider = None
            self._available = False

    def transform(self, context: TransformationContext) -> TransformationResult:
        """
        Transform text using LLM with POVM guidance.

        Process:
        1. Convert TransformationContext to StatelessTransformer format
        2. Run iterative transformation (2-5 iterations)
        3. Verify result and package as TransformationResult

        Args:
            context: Transformation context

        Returns:
            TransformationResult with transformed text and metrics
        """
        if not self._available:
            return self._failed_result(
                context,
                "LLM provider not available",
                time.time()
            )

        start_time = time.time()

        try:
            import asyncio
            from humanizer.core.trm.transformer import TransformOptions

            # Build target stance
            target_stance = {context.povm_pack_name: context.target_axis}

            # Configure transformation options
            options = TransformOptions(
                max_iterations=3,  # 2-3 iterations typical
                convergence_threshold=context.target_threshold,
                povm_packs=[context.povm_pack_name],
                temperature=0.7
            )

            # Run transformation (async)
            # Use asyncio.run() which properly manages event loop lifecycle
            # This ensures httpx clients are cleaned up correctly
            async def run_transform():
                # Close any existing client and force recreation in this loop
                if self.llm_provider and hasattr(self.llm_provider, '_client') and self.llm_provider._client:
                    await self.llm_provider._client.aclose()
                    self.llm_provider._client = None

                # Run transformation
                result = await self.transformer.transform(
                    text=context.text,
                    target_stance=target_stance,
                    options=options
                )

                # Clean up client before returning
                if self.llm_provider and hasattr(self.llm_provider, '_client') and self.llm_provider._client:
                    await self.llm_provider._client.aclose()
                    self.llm_provider._client = None

                return result

            # asyncio.run() creates fresh loop, runs coroutine, closes loop cleanly
            transform_result = asyncio.run(run_transform())

            execution_time = (time.time() - start_time) * 1000

            # Verify transformation
            readings_before, readings_after, improvement, rho_dist = self._verify_transformation(
                text_before=context.text,
                text_after=transform_result.final_text,
                context=context
            )

            # Compute metrics
            text_change_ratio = self._compute_text_change_ratio(
                context.text,
                transform_result.final_text
            )

            # Assess coherence (use TRM convergence as proxy)
            coherence = transform_result.steps[-1].convergence_score if transform_result.steps else 0.0

            # Estimate cost
            cost = self._estimate_actual_cost(context.text, transform_result.final_text)

            # Success if converged and improved
            success = (
                transform_result.converged or
                improvement > 0.05  # At least 5% improvement
            )

            return TransformationResult(
                transformed_text=transform_result.final_text,
                success=success,
                readings_before=readings_before,
                readings_after=readings_after,
                target_improvement=improvement,
                rho_distance_moved=rho_dist,
                text_change_ratio=text_change_ratio,
                semantic_coherence=coherence,
                method=TransformationMethod.LLM_GUIDED,
                strategy_name="LLMGuidedStrategy",
                execution_time_ms=execution_time,
                cost_usd=cost,
                prompt_tokens=None,  # Could extract from LLM provider if needed
                completion_tokens=None,
            )

        except Exception as e:
            logger.error(f"LLM-guided transformation failed: {e}", exc_info=True)
            return self._failed_result(
                context,
                str(e),
                start_time
            )

    def estimate_cost(self, context: TransformationContext) -> float:
        """
        Estimate cost in USD.

        For local LLMs (Ollama): $0
        For cloud LLMs (Anthropic): Based on token count
        """
        if not self._available or not self.llm_provider:
            return 0.0

        # Use provider's estimate_cost method
        # Assume 3 iterations average
        total_cost = 0.0
        for _ in range(3):
            total_cost += self.llm_provider.estimate_cost(context.text, 0.7)

        return total_cost

    def estimate_latency(self, context: TransformationContext) -> float:
        """
        Estimate execution time in milliseconds.

        Depends on:
        - LLM provider (Ollama vs Anthropic)
        - Text length
        - Number of iterations (assume 3)
        """
        if not self._available or not self.llm_provider:
            return 0.0

        # Use provider's estimate_latency method
        # Assume 3 iterations
        per_iteration_ms = self.llm_provider.estimate_latency(context.text, 0.7)
        total_ms = per_iteration_ms * 3

        # Add overhead for embeddings (fast, ~5ms per)
        total_ms += 5 * 3

        return total_ms

    def _estimate_actual_cost(self, text_before: str, text_after: str) -> float:
        """Estimate actual cost based on text processed."""
        if not self.llm_provider:
            return 0.0

        # Rough estimate: 3 iterations with both before and after text
        return self.llm_provider.estimate_cost(text_before + text_after, 0.7)

    def _failed_result(
        self,
        context: TransformationContext,
        error_message: str,
        start_time: float
    ) -> TransformationResult:
        """Create failed transformation result."""
        execution_time = (time.time() - start_time) * 1000

        return TransformationResult(
            transformed_text=context.text,  # Return unchanged
            success=False,
            readings_before=context.current_readings,
            readings_after=context.current_readings,
            target_improvement=0.0,
            rho_distance_moved=0.0,
            text_change_ratio=0.0,
            semantic_coherence=0.0,
            method=TransformationMethod.LLM_GUIDED,
            strategy_name="LLMGuidedStrategy",
            execution_time_ms=execution_time,
            cost_usd=0.0,
            error_message=error_message,
        )


class HybridStrategy(TransformationStrategy):
    """
    Hybrid transformation strategy (Phase 2B).

    Tries rules first (fast, free), falls back to LLM if:
    - No rules match
    - Rules produce insufficient improvement (< 0.1 improvement)
    - Quality threshold not met

    Benefits:
    - Best of both worlds: speed of rules, power of LLM
    - Cost-effective: only use LLM when needed
    - Handles both simple and complex transformations

    Typical usage:
    - 70-80% of cases: rules succeed (fast, free)
    - 20-30% of cases: LLM needed (slower, may cost $)
    """

    def __init__(self, rank: int = 64):
        """
        Initialize hybrid strategy.

        Args:
            rank: Dimension for density matrices
        """
        super().__init__(rank)

        # Initialize both strategies
        self.rule_strategy = RuleBasedStrategy(rank=rank)
        self.llm_strategy = LLMGuidedStrategy(rank=rank)

        # Thresholds for fallback decision
        self.min_improvement_for_success = 0.1  # Need at least 10% improvement
        self.min_coherence_for_success = 0.6  # Need reasonable quality

    def transform(self, context: TransformationContext) -> TransformationResult:
        """
        Transform text using hybrid approach.

        Process:
        1. Try rule-based transformation first
        2. Check if result is good enough
        3. If not, fall back to LLM-guided transformation
        4. Return best result

        Args:
            context: Transformation context

        Returns:
            TransformationResult (from rules or LLM)
        """
        start_time = time.time()

        # Step 1: Try rules first (fast path)
        logger.info(f"Hybrid: Attempting rule-based transformation for {context.povm_pack_name}={context.target_axis}")
        rule_result = self.rule_strategy.transform(context)

        # Step 2: Check if rules were good enough
        rules_succeeded = (
            rule_result.success and
            rule_result.target_improvement >= self.min_improvement_for_success and
            rule_result.semantic_coherence >= self.min_coherence_for_success
        )

        if rules_succeeded:
            logger.info(
                f"Hybrid: Rules succeeded! "
                f"Improvement={rule_result.target_improvement:.3f}, "
                f"Coherence={rule_result.semantic_coherence:.2f}, "
                f"Time={rule_result.execution_time_ms:.0f}ms"
            )
            # Update method to reflect hybrid decision
            rule_result.method = TransformationMethod.HYBRID
            rule_result.strategy_name = "HybridStrategy (rules)"
            return rule_result

        # Step 3: Rules insufficient, try LLM
        logger.info(
            f"Hybrid: Rules insufficient "
            f"(improvement={rule_result.target_improvement:.3f}, "
            f"coherence={rule_result.semantic_coherence:.2f}). "
            f"Falling back to LLM..."
        )

        llm_result = self.llm_strategy.transform(context)

        # Step 4: Return LLM result (even if failed, it's our best attempt)
        execution_time = (time.time() - start_time) * 1000

        # Update metadata to reflect hybrid approach
        llm_result.method = TransformationMethod.HYBRID
        llm_result.strategy_name = f"HybridStrategy (LLM after rules)"
        llm_result.execution_time_ms = execution_time  # Total time including rule attempt

        logger.info(
            f"Hybrid: LLM {'succeeded' if llm_result.success else 'failed'}. "
            f"Improvement={llm_result.target_improvement:.3f}, "
            f"Coherence={llm_result.semantic_coherence:.2f}, "
            f"TotalTime={execution_time:.0f}ms"
        )

        return llm_result

    def estimate_cost(self, context: TransformationContext) -> float:
        """
        Estimate cost in USD.

        Assumes:
        - 70% chance rules succeed (cost=$0)
        - 30% chance LLM needed (cost from LLM provider)

        Returns:
            Expected cost (probability-weighted)
        """
        rule_cost = self.rule_strategy.estimate_cost(context)  # Always $0
        llm_cost = self.llm_strategy.estimate_cost(context)

        # Probability-weighted expected cost
        # Assume 70% rules succeed, 30% need LLM
        expected_cost = 0.7 * rule_cost + 0.3 * llm_cost

        return expected_cost

    def estimate_latency(self, context: TransformationContext) -> float:
        """
        Estimate execution time in milliseconds.

        Assumes:
        - 70% chance rules succeed (fast path: ~10-50ms)
        - 30% chance LLM needed (slow path: rule_time + llm_time)

        Returns:
            Expected latency (probability-weighted)
        """
        rule_latency = self.rule_strategy.estimate_latency(context)
        llm_latency = self.llm_strategy.estimate_latency(context)

        # Fast path: only rules
        fast_path_latency = rule_latency

        # Slow path: rules + LLM
        slow_path_latency = rule_latency + llm_latency

        # Probability-weighted expected latency
        expected_latency = 0.7 * fast_path_latency + 0.3 * slow_path_latency

        return expected_latency
