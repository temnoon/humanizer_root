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

# Semantic operators (Week 2 - replaces random operators)
from humanizer.services.operator_learning import load_all_operators

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

    def __init__(
        self,
        rank: int = 64,
        archive_name: Optional[str] = None,
        operator_preference: str = "auto"
    ):
        """
        Initialize strategy.

        Args:
            rank: Dimension for density matrices
            archive_name: Optional archive name for adaptive operators (e.g., "chatgpt_archive")
            operator_preference: Which operators to use:
                - "auto": Try archive-specific → default → random (recommended)
                - "archive": Archive-specific only (fails if not found)
                - "default": Static seed corpus operators only
                - "random": Random operators (not recommended)
        """
        self.rank = rank
        self.archive_name = archive_name
        self.operator_preference = operator_preference
        self.embedding_service = get_sentence_embedding_service()

        # Week 3: Support archive-specific operators with fallback chain
        self.povm_packs = self._load_operators()

    def _load_operators(self) -> Dict[str, any]:
        """
        Load operators with fallback chain based on preference.

        Fallback chain by preference:
        - "auto": archive → default → random
        - "archive": archive only (fails if not found)
        - "default": default only
        - "random": random only

        Returns:
            Dict[pack_name, POVMPack]
        """
        from pathlib import Path

        if self.operator_preference == "auto":
            # Try archive-specific first
            if self.archive_name:
                archive_dir = Path("data/semantic_operators") / self.archive_name
                if archive_dir.exists():
                    try:
                        semantic_packs_dict = load_all_operators(load_dir=archive_dir)
                        operators = {
                            name: pack.to_povm_pack()
                            for name, pack in semantic_packs_dict.items()
                        }
                        logger.info(f"✅ Loaded archive-specific operators: {self.archive_name} ({len(operators)} packs)")
                        return operators
                    except Exception as e:
                        logger.warning(f"Failed to load archive operators from {archive_dir}: {e}")

            # Try default (Week 2 seed corpus)
            try:
                semantic_packs_dict = load_all_operators()
                operators = {
                    name: pack.to_povm_pack()
                    for name, pack in semantic_packs_dict.items()
                }
                logger.info(f"✅ Loaded default semantic operators ({len(operators)} packs)")
                return operators
            except FileNotFoundError:
                logger.warning("No semantic operators found, falling back to random")
                return get_all_packs(rank=self.rank)

        elif self.operator_preference == "archive":
            # Archive-specific only
            if not self.archive_name:
                raise ValueError("archive_name required for preference='archive'")

            archive_dir = Path("data/semantic_operators") / self.archive_name
            semantic_packs_dict = load_all_operators(load_dir=archive_dir)
            operators = {
                name: pack.to_povm_pack()
                for name, pack in semantic_packs_dict.items()
            }
            logger.info(f"✅ Loaded archive-specific operators: {self.archive_name}")
            return operators

        elif self.operator_preference == "default":
            # Default only
            semantic_packs_dict = load_all_operators()
            operators = {
                name: pack.to_povm_pack()
                for name, pack in semantic_packs_dict.items()
            }
            logger.info(f"✅ Loaded default semantic operators")
            return operators

        elif self.operator_preference == "random":
            # Random (not recommended, but available)
            logger.warning("⚠️  Using random operators (not recommended)")
            return get_all_packs(rank=self.rank)

        else:
            raise ValueError(f"Unknown operator_preference: {self.operator_preference}")

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

    def __init__(
        self,
        rank: int = 64,
        archive_name: Optional[str] = None,
        operator_preference: str = "auto"
    ):
        """
        Initialize rule-based strategy.

        Args:
            rank: Dimension for density matrices
            archive_name: Optional archive for adaptive operators
            operator_preference: "auto", "archive", "default", or "random"
        """
        super().__init__(
            rank=rank,
            archive_name=archive_name,
            operator_preference=operator_preference
        )

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
    LLM-guided transformation strategy with Generate-Filter-Select (GFS).

    Week 5 architecture: Programmatic constraint enforcement
    - GENERATE: N diverse candidates (temperature=0.9)
    - FILTER: Code enforces hard constraints
    - SELECT: POVM measurements choose best

    Benefits:
    - Handles complex semantic shifts that rules can't
    - Programmatic constraints (reliable, not LLM-dependent)
    - Works with any POVM pack

    Tradeoffs:
    - Slower than rules (N × LLM latency)
    - Costs $ for cloud deployments
    - Requires LLM availability
    """

    def __init__(
        self,
        rank: int = 64,
        num_candidates: int = 10,  # Week 5: 10 gives ~33% success vs 0% with 5
        max_retries: int = 3
    ):
        """
        Initialize LLM-guided strategy with GFS.

        Args:
            rank: Dimension for density matrices
            num_candidates: Number of candidates to generate (default: 5)
            max_retries: Max retry attempts if no valid candidates (default: 3)
        """
        super().__init__(rank)
        self.num_candidates = num_candidates
        self.max_retries = max_retries

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

    def _build_gfs_prompt(
        self,
        context: TransformationContext,
        attempt: int,
        candidate_num: int
    ) -> str:
        """
        Build prompt for GFS candidate generation.

        Week 5 design: Simple, focused prompt for diversity + corpus examples.

        Args:
            context: Transformation context
            attempt: Retry attempt number (0-indexed)
            candidate_num: Candidate number within this attempt

        Returns:
            Prompt string for LLM
        """
        # Calculate length constraints
        original_length = len(context.text)
        min_length = int(original_length * 0.8)
        max_length = int(original_length * 1.2)

        # Get axis description (what does this axis mean?)
        axis_description = self._get_axis_description(
            context.povm_pack_name,
            context.target_axis
        )

        axis_guidance = f"\n\nWHAT '{context.target_axis}' MEANS:\n{axis_description}\n"

        # Stricter instructions on retry
        if attempt == 0:
            emphasis = "Make MINIMAL changes - change only 1-3 words."
        else:
            emphasis = "CRITICAL: Change ONLY 1-3 words maximum. Keep everything else identical."

        prompt = f"""Transform this text toward "{context.target_axis}" using MINIMAL changes.

ORIGINAL TEXT:
"{context.text}"
{axis_guidance}
RULES (STRICT):
1. Change ONLY 1-3 words
2. Keep length within {min_length}-{max_length} characters
3. Preserve >60% of original words
4. Keep sentence structure
5. Sound natural

{emphasis}

EXAMPLE OF MINIMAL CHANGE:
❌ BAD: "I think X" → "Comprehensive analysis reveals X" (too many changes)
✅ GOOD: "I think X" → "Analysis suggests X" (2 words changed)

NOW TRANSFORM (return ONLY the transformed text, no quotes or explanations):"""

        return prompt

    def _get_axis_description(self, pack_name: str, target_axis: str) -> str:
        """
        Get human-readable description of what an axis means.

        Helps LLM understand the semantic shift needed.

        Args:
            pack_name: POVM pack name
            target_axis: Target axis

        Returns:
            Description string
        """
        # Axis descriptions for guidance
        descriptions = {
            "tetralemma": {
                "A": "Make the statement more AFFIRMATIVE - remove hedging (\"I think\", \"maybe\"), use definite language",
                "¬A": "Make the statement more NEGATIVE/CRITICAL - question or negate the claim, express doubt",
                "both": "Add BOTH affirmative AND negative perspectives - acknowledge complexity or paradox",
                "neither": "Make the statement more TRANSCENDENT - go beyond yes/no, express mystery or unknowability"
            },
            "tone": {
                "analytical": "Make the tone more ANALYTICAL - use precise terms, remove casual language",
                "critical": "Make the tone more CRITICAL - question assumptions, point out problems",
                "empathic": "Make the tone more EMPATHIC - add warmth, understanding, human connection",
                "playful": "Make the tone more PLAYFUL - add lightness, humor, or creative language",
                "neutral": "Make the tone more NEUTRAL - remove emotional language, be more factual"
            },
            "pragmatics": {
                "clarity": "Make it more CLEAR - use simple, direct language",
                "coherence": "Make it more COHERENT - improve logical flow",
                "evidence": "Add more EVIDENCE - include concrete details or data",
                "charity": "Make it more CHARITABLE - interpret others' positions generously"
            },
            "ontology": {
                "corporeal": "Make it more PHYSICAL/BODILY - reference physical experiences",
                "subjective": "Make it more SUBJECTIVE - emphasize personal experience or perspective",
                "objective": "Make it more OBJECTIVE - remove personal perspective, be neutral",
                "mixed_frame": "Mix SUBJECTIVE and OBJECTIVE - combine personal and impersonal"
            },
            "audience": {
                "expert": "Write for EXPERTS - use technical language",
                "general": "Write for GENERAL AUDIENCE - use accessible language",
                "student": "Write for STUDENTS - be pedagogical, explanatory",
                "policy": "Write for POLICY MAKERS - focus on implications, recommendations",
                "editorial": "Write for EDITORIAL/OPINION - take a stance, be persuasive"
            }
        }

        pack_desc = descriptions.get(pack_name, {})
        return pack_desc.get(target_axis, f"Transform toward '{target_axis}' style")

    def _load_corpus_examples(
        self,
        pack_name: str,
        target_axis: str,
        num_examples: int = 2
    ) -> List[str]:
        """
        Load few-shot examples from corpus for the target axis.

        Args:
            pack_name: POVM pack name (e.g., "tone", "tetralemma")
            target_axis: Target axis (e.g., "analytical", "A")
            num_examples: Number of examples to load (default: 2)

        Returns:
            List of example texts
        """
        from pathlib import Path
        import json
        import random

        corpus_path = Path("data/povm_corpus") / pack_name / f"{target_axis}.json"

        try:
            if corpus_path.exists():
                with open(corpus_path) as f:
                    data = json.load(f)
                    examples = data.get("examples", [])
                    if examples:
                        # Randomly sample up to num_examples
                        sample_size = min(num_examples, len(examples))
                        sampled = random.sample(examples, sample_size)
                        return [ex["text"] for ex in sampled]
        except Exception as e:
            logger.debug(f"Could not load corpus examples from {corpus_path}: {e}")

        return []

    def _assess_coherence(self, text: str, change_ratio: float) -> float:
        """
        Heuristic coherence assessment for GFS results.

        Simple checks:
        - Not too much change (penalize > 40%)
        - Reasonable length (not truncated)
        - No obvious artifacts (repetition, weird punctuation)

        Args:
            text: Transformed text
            change_ratio: Fraction changed (0-1)

        Returns:
            Coherence score (0-1)
        """
        score = 1.0

        # Penalize excessive changes
        if change_ratio > 0.4:
            score -= 0.3
        elif change_ratio > 0.3:
            score -= 0.2

        # Penalize very short texts (likely truncated)
        if len(text) < 20:
            score -= 0.3

        # Penalize multiple spaces or weird punctuation
        if "  " in text:
            score -= 0.1
        if ".." in text or "??" in text or "!!" in text:
            score -= 0.1

        # Penalize word repetition
        words = text.split()
        if len(words) > 2:
            has_repetition = any(
                words[i] == words[i+1]
                for i in range(len(words) - 1)
            )
            if has_repetition:
                score -= 0.1

        return max(0.0, min(1.0, score))

    def _filter_candidates(
        self,
        original_text: str,
        candidates: List[str],
        context: TransformationContext
    ) -> List[str]:
        """
        Filter candidates by hard constraints (Week 5 GFS - FILTER step).

        Programmatic enforcement:
        - Length within ±20% of original
        - Word overlap >60% (>60% words identical)
        - Naturalness (no excessive repetition)

        Args:
            original_text: Original text
            candidates: List of candidate transformations
            context: Transformation context

        Returns:
            List of valid candidates (may be empty)
        """
        valid = []
        original_length = len(original_text)
        min_length = int(original_length * 0.8)
        max_length = int(original_length * 1.2)

        # Get original words for overlap check
        original_words = set(original_text.lower().split())

        for candidate in candidates:
            # Skip if identical to original
            if candidate == original_text:
                continue

            # Check 1: Length constraint (±20%)
            if not (min_length <= len(candidate) <= max_length):
                logger.debug(f"Rejected (length): {len(candidate)} not in [{min_length}, {max_length}]")
                continue

            # Check 2: Word overlap (>60% identical)
            candidate_words = set(candidate.lower().split())
            if len(original_words) > 0:
                overlap = len(original_words & candidate_words) / len(original_words)
                if overlap < 0.6:
                    logger.debug(f"Rejected (overlap): {overlap:.2%} < 60%")
                    continue

            # Check 3: Naturalness (no excessive repetition)
            words = candidate.split()
            if len(words) > 1:
                # Check for word repetition (same word appears 3+ times consecutively)
                has_repetition = any(
                    words[i] == words[i+1] == words[i+2]
                    for i in range(len(words) - 2)
                )
                if has_repetition:
                    logger.debug(f"Rejected (repetition): excessive word repetition")
                    continue

            # Passed all checks
            valid.append(candidate)
            logger.debug(f"Accepted: {len(candidate)} chars, {overlap:.2%} overlap")

        logger.info(f"Filtered {len(candidates)} candidates → {len(valid)} valid")
        return valid

    def _select_best_candidate(
        self,
        original_text: str,
        candidates: List[str],
        context: TransformationContext
    ) -> Optional[str]:
        """
        Select best candidate using POVM measurements (Week 5 GFS - SELECT step).

        Measures POVM improvement for each valid candidate, selects best.

        Args:
            original_text: Original text
            candidates: List of valid candidates
            context: Transformation context

        Returns:
            Best candidate text, or None if no candidates
        """
        if not candidates:
            return None

        best_candidate = None
        best_improvement = -float('inf')

        for candidate in candidates:
            # Measure POVM improvement
            try:
                _, _, improvement, _ = self._verify_transformation(
                    original_text,
                    candidate,
                    context
                )

                logger.debug(f"Candidate improvement: {improvement:+.3f}")

                if improvement > best_improvement:
                    best_improvement = improvement
                    best_candidate = candidate

            except Exception as e:
                logger.warning(f"Failed to measure candidate: {e}")
                continue

        logger.info(f"Selected best: improvement={best_improvement:+.3f}")
        return best_candidate

    def transform(self, context: TransformationContext) -> TransformationResult:
        """
        Transform text using GFS architecture (Week 5).

        Process:
        1. GENERATE: Create N diverse candidates (temperature=0.9)
        2. FILTER: Apply programmatic constraints (code, not LLM)
        3. SELECT: Pick best via POVM measurement
        4. RETRY: If no valid candidates, retry with stricter prompt

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

            # GFS retry loop
            for attempt in range(self.max_retries):
                logger.info(f"GFS attempt {attempt + 1}/{self.max_retries}")

                # GENERATE: Create N candidates
                async def generate_candidates():
                    candidates = []
                    for i in range(self.num_candidates):
                        prompt = self._build_gfs_prompt(
                            context=context,
                            attempt=attempt,
                            candidate_num=i
                        )

                        # Generate with high temperature for diversity
                        temperature = 0.9 if attempt == 0 else 0.7  # Stricter on retry
                        candidate_text = await self.transformer.llm(prompt, temperature)

                        # Parse response (LLM may add meta-commentary)
                        cleaned = self.transformer._parse_llm_response(candidate_text)
                        candidates.append(cleaned)

                        logger.debug(f"Generated candidate {i+1}: {len(cleaned)} chars")

                    return candidates

                # Run generation
                try:
                    loop = asyncio.get_running_loop()
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        candidates = executor.submit(
                            lambda: asyncio.run(generate_candidates())
                        ).result()
                except RuntimeError:
                    candidates = asyncio.run(generate_candidates())

                # FILTER: Apply programmatic constraints
                valid_candidates = self._filter_candidates(
                    original_text=context.text,
                    candidates=candidates,
                    context=context
                )

                # SELECT: Pick best via POVM measurement
                if valid_candidates:
                    best_text = self._select_best_candidate(
                        original_text=context.text,
                        candidates=valid_candidates,
                        context=context
                    )

                    if best_text:
                        # Success! Package result
                        execution_time = (time.time() - start_time) * 1000

                        # Verify transformation
                        readings_before, readings_after, improvement, rho_dist = self._verify_transformation(
                            text_before=context.text,
                            text_after=best_text,
                            context=context
                        )

                        # Compute metrics
                        text_change_ratio = self._compute_text_change_ratio(
                            context.text,
                            best_text
                        )

                        # Assess coherence (heuristic based on text change)
                        coherence = self._assess_coherence(best_text, text_change_ratio)

                        # Estimate cost
                        cost = self._estimate_actual_cost(context.text, best_text)

                        # Success criteria
                        success = (
                            improvement > 0.01 and  # At least 1% improvement
                            text_change_ratio <= context.max_change_ratio and  # Not too much change
                            coherence > 0.5  # Reasonable quality
                        )

                        logger.info(
                            f"GFS succeeded on attempt {attempt + 1}: "
                            f"improvement={improvement:+.3f}, "
                            f"change={text_change_ratio:.2%}, "
                            f"coherence={coherence:.2f}"
                        )

                        return TransformationResult(
                            transformed_text=best_text,
                            success=success,
                            readings_before=readings_before,
                            readings_after=readings_after,
                            target_improvement=improvement,
                            rho_distance_moved=rho_dist,
                            text_change_ratio=text_change_ratio,
                            semantic_coherence=coherence,
                            method=TransformationMethod.LLM_GUIDED,
                            strategy_name="LLMGuidedStrategy (GFS)",
                            execution_time_ms=execution_time,
                            cost_usd=cost,
                            prompt_tokens=None,
                            completion_tokens=None,
                        )

                # No valid candidates - retry with stricter prompt
                logger.info(
                    f"Attempt {attempt + 1}: {len(valid_candidates)}/{self.num_candidates} valid candidates. "
                    f"Retrying with stricter constraints..."
                )

            # All retries failed
            execution_time = (time.time() - start_time) * 1000
            logger.warning(f"GFS failed after {self.max_retries} attempts")

            return self._failed_result(
                context,
                f"No valid candidates after {self.max_retries} attempts",
                start_time
            )

        except Exception as e:
            logger.error(f"GFS transformation failed: {e}", exc_info=True)
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
        self.llm_strategy = LLMGuidedStrategy(rank=rank)  # Now uses GFS (Week 5)

        # Thresholds for fallback decision (Week 5: adjusted to reasonable levels)
        self.min_improvement_for_success = 0.02  # Need at least 2% improvement (was 10% - too strict!)
        self.min_coherence_for_success = 0.5  # Need reasonable quality

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


# ============================================================================
# Week 7: Hybrid Rules + GFS Strategy
# ============================================================================

@dataclass
class HybridMetrics:
    """Metrics for hybrid transformation (Week 7)."""
    num_rule_candidates: int
    num_llm_candidates: int
    num_after_dedup: int
    num_after_filter: int
    best_candidate_source: str  # "rule" or "llm"
    total_time_ms: float
    llm_cost_usd: float


class HybridTransformationStrategy(TransformationStrategy):
    """
    Hybrid transformation strategy combining rules and LLM (Week 7).

    Architecture:
    1. Generate rule-based candidates (8 candidates, ~0.1s, $0)
    2. Generate LLM candidates (5 candidates, ~5s, $$)
    3. Deduplicate combined candidates (>85% word overlap)
    4. Filter programmatically (GFS constraints from Week 5)
    5. Select best via POVM measurement
    6. Retry if needed (max 3 attempts)

    Benefits:
    - Cost reduction: 5 LLM calls vs 10 (50% reduction)
    - Higher success rate: More candidates (13 total before dedup)
    - Rule candidates encode proven patterns from Week 6
    - LLM adds semantic diversity for complex cases

    Expected: 40-50% success rate with 30-50% cost reduction vs pure GFS
    """

    def __init__(
        self,
        rank: int = 64,
        num_rule_candidates: int = 8,
        num_llm_candidates: int = 5,
        dedup_threshold: float = 0.85,  # 85% word overlap = duplicate
        max_retries: int = 3
    ):
        """
        Initialize hybrid strategy.

        Args:
            rank: Dimension for density matrices
            num_rule_candidates: Number of rule-based candidates to generate
            num_llm_candidates: Number of LLM candidates to generate
            dedup_threshold: Word overlap threshold for deduplication (0.85 = 85%)
            max_retries: Maximum retry attempts
        """
        super().__init__(rank)
        self.num_rule_candidates = num_rule_candidates
        self.num_llm_candidates = num_llm_candidates
        self.dedup_threshold = dedup_threshold
        self.max_retries = max_retries

        # Import locally to avoid circular dependencies
        from humanizer.services.rule_candidate_generator import RuleCandidateGenerator
        from humanizer.core.trm.transformer import StatelessTransformer
        from humanizer.core.embeddings import get_embedding_function
        from humanizer.core.llm import get_llm_function, get_llm_provider
        from humanizer.config import settings

        # Initialize rule generator
        self.rule_generator = RuleCandidateGenerator()

        # Initialize LLM components (reuse from LLMGuidedStrategy)
        try:
            embed_fn = get_embedding_function()
            llm_fn = get_llm_function(settings)
            self.transformer = StatelessTransformer(
                embed_fn=embed_fn,
                llm_fn=llm_fn,
                rank=rank
            )
            self.llm_provider = get_llm_provider(settings)
            self._llm_available = True
        except Exception as e:
            logger.error(f"Failed to initialize LLM components: {e}")
            self.transformer = None
            self.llm_provider = None
            self._llm_available = False

        logger.info(f"✅ Initialized HybridTransformationStrategy (rules={num_rule_candidates}, llm={num_llm_candidates})")

    def _build_gfs_prompt(
        self,
        context: TransformationContext,
        attempt: int,
        candidate_num: int
    ) -> str:
        """
        Build prompt for LLM candidate generation (reuse from Week 5).

        Args:
            context: Transformation context
            attempt: Retry attempt number (0-indexed)
            candidate_num: Candidate number within this attempt

        Returns:
            Prompt string for LLM
        """
        # Reuse prompt building logic from LLMGuidedStrategy
        original_length = len(context.text)
        min_length = int(original_length * 0.8)
        max_length = int(original_length * 1.2)

        axis_description = self._get_axis_description(
            context.povm_pack_name,
            context.target_axis
        )

        if attempt == 0:
            emphasis = "Make MINIMAL changes - change only 1-3 words."
        else:
            emphasis = "CRITICAL: Change ONLY 1-3 words maximum. Keep everything else identical."

        prompt = f"""Transform this text toward "{context.target_axis}" using MINIMAL changes.

ORIGINAL TEXT:
"{context.text}"

WHAT '{context.target_axis}' MEANS:
{axis_description}

RULES (STRICT):
1. Change ONLY 1-3 words
2. Keep length within {min_length}-{max_length} characters
3. Preserve >60% of original words
4. Keep sentence structure
5. Sound natural

{emphasis}

EXAMPLE OF MINIMAL CHANGE:
❌ BAD: "I think X" → "Comprehensive analysis reveals X" (too many changes)
✅ GOOD: "I think X" → "Analysis suggests X" (2 words changed)

NOW TRANSFORM (return ONLY the transformed text, no quotes or explanations):"""

        return prompt

    def _get_axis_description(self, pack_name: str, target_axis: str) -> str:
        """Get human-readable description of what an axis means (reuse from Week 5)."""
        descriptions = {
            "tetralemma": {
                "A": "Make the statement more AFFIRMATIVE - remove hedging (\"I think\", \"maybe\"), use definite language",
                "¬A": "Make the statement more NEGATIVE/CRITICAL - question or negate the claim, express doubt",
                "both": "Add BOTH affirmative AND negative perspectives - acknowledge complexity or paradox",
                "neither": "Make the statement more TRANSCENDENT - go beyond yes/no, express mystery or unknowability"
            },
            "tone": {
                "analytical": "Make the tone more ANALYTICAL - use precise terms, remove casual language",
                "critical": "Make the tone more CRITICAL - question assumptions, point out problems",
                "empathic": "Make the tone more EMPATHIC - add warmth, understanding, human connection",
                "playful": "Make the tone more PLAYFUL - add lightness, humor, or creative language",
                "neutral": "Make the tone more NEUTRAL - remove emotional language, be more factual"
            },
            "pragmatics": {
                "clarity": "Make it more CLEAR - use simple, direct language",
                "coherence": "Make it more COHERENT - improve logical flow",
                "evidence": "Add more EVIDENCE - include concrete details or data",
                "charity": "Make it more CHARITABLE - interpret others' positions generously"
            }
        }

        pack_desc = descriptions.get(pack_name, {})
        return pack_desc.get(target_axis, f"Transform toward '{target_axis}' style")

    def _deduplicate_candidates(
        self,
        candidates: List[Tuple[str, str]],  # (text, source)
        threshold: float = 0.85
    ) -> List[Tuple[str, str]]:
        """
        Remove near-duplicate candidates based on word overlap (Week 7 - NEW).

        Args:
            candidates: List of (candidate_text, source) tuples
            threshold: Overlap threshold (0.85 = 85% word overlap)

        Returns:
            Unique candidates with <threshold overlap
        """
        unique_candidates = []

        for candidate_text, source in candidates:
            is_duplicate = False

            for existing_text, _ in unique_candidates:
                overlap = self._calculate_word_overlap(candidate_text, existing_text)
                if overlap > threshold:
                    is_duplicate = True
                    logger.debug(f"Duplicate removed ({overlap:.2%} overlap): '{candidate_text[:50]}...'")
                    break

            if not is_duplicate:
                unique_candidates.append((candidate_text, source))

        logger.info(f"Deduplication: {len(candidates)} → {len(unique_candidates)} candidates")
        return unique_candidates

    def _calculate_word_overlap(self, text1: str, text2: str) -> float:
        """
        Calculate word overlap ratio (0-1).

        Formula: overlap = |words1 ∩ words2| / max(|words1|, |words2|)
        """
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())

        if not words1 or not words2:
            return 0.0

        intersection = len(words1 & words2)
        max_length = max(len(words1), len(words2))

        return intersection / max_length

    def _filter_candidates(
        self,
        original_text: str,
        candidates: List[str],
        context: TransformationContext
    ) -> List[str]:
        """
        Filter candidates by hard constraints (Week 5 GFS - REUSED).

        Programmatic enforcement:
        - Length within ±20% of original
        - Word overlap >60% (>60% words identical)
        - Naturalness (no excessive repetition)

        Returns:
            List of valid candidates (may be empty)
        """
        valid = []
        original_length = len(original_text)
        min_length = int(original_length * 0.8)
        max_length = int(original_length * 1.2)

        original_words = set(original_text.lower().split())

        for candidate in candidates:
            if candidate == original_text:
                continue

            # Check 1: Length constraint (±20%)
            if not (min_length <= len(candidate) <= max_length):
                continue

            # Check 2: Word overlap (>60% identical)
            candidate_words = set(candidate.lower().split())
            if len(original_words) > 0:
                overlap = len(original_words & candidate_words) / len(original_words)
                if overlap < 0.6:
                    continue

            # Check 3: Naturalness (no excessive repetition)
            words = candidate.split()
            if len(words) > 2:
                has_repetition = any(
                    i + 2 < len(words) and words[i] == words[i+1] == words[i+2]
                    for i in range(len(words) - 2)
                )
                if has_repetition:
                    continue

            valid.append(candidate)

        logger.info(f"Filtered {len(candidates)} candidates → {len(valid)} valid")
        return valid

    def _select_best_candidate(
        self,
        original_text: str,
        candidates_with_source: List[Tuple[str, str]],  # (text, source)
        context: TransformationContext
    ) -> Optional[Tuple[str, float, str]]:  # (text, improvement, source)
        """
        Select best candidate using POVM measurements (Week 5 GFS - MODIFIED).

        Returns:
            Tuple of (best_text, improvement, source) or None if no candidates
        """
        if not candidates_with_source:
            return None

        best_candidate = None
        best_improvement = -float('inf')
        best_source = None

        for candidate_text, source in candidates_with_source:
            try:
                _, _, improvement, _ = self._verify_transformation(
                    original_text,
                    candidate_text,
                    context
                )

                logger.debug(f"Candidate ({source}): improvement={improvement:+.3f}")

                if improvement > best_improvement:
                    best_improvement = improvement
                    best_candidate = candidate_text
                    best_source = source

            except Exception as e:
                logger.warning(f"Failed to measure candidate: {e}")
                continue

        if best_candidate:
            logger.info(f"Selected best: improvement={best_improvement:+.3f}, source={best_source}")
            return (best_candidate, best_improvement, best_source)

        return None

    def transform(self, context: TransformationContext) -> TransformationResult:
        """
        Transform text using Hybrid Rules + GFS architecture (Week 7).

        Process:
        1. GENERATE (Parallel): Rule candidates (8) + LLM candidates (5) = 13 total
        2. DEDUPLICATE: Remove >85% overlap duplicates → ~10-12 unique
        3. FILTER: Apply programmatic constraints (Week 5 GFS) → ~5-8 valid
        4. SELECT: Pick best via POVM measurement → 1 result
        5. RETRY: If no valid candidates, retry with adjusted parameters

        Returns:
            TransformationResult with transformed text and metrics
        """
        start_time = time.time()

        # Check LLM availability
        if not self._llm_available:
            return self._failed_result(
                context,
                "LLM provider not available for hybrid strategy",
                start_time
            )

        try:
            import asyncio

            # Hybrid retry loop
            for attempt in range(self.max_retries):
                logger.info(f"Hybrid attempt {attempt + 1}/{self.max_retries}")

                # STEP 1: GENERATE RULE CANDIDATES (fast, free)
                logger.info(f"Generating {self.num_rule_candidates} rule-based candidates...")
                rule_candidates = self.rule_generator.generate_candidates(
                    text=context.text,
                    pack_name=context.povm_pack_name,
                    target_axis=context.target_axis,
                    num_candidates=self.num_rule_candidates
                )

                rule_candidates_with_source = [
                    (cand.text, f"rule:{cand.rule_description}")
                    for cand in rule_candidates
                ]

                logger.info(f"✅ Generated {len(rule_candidates_with_source)} rule candidates")

                # STEP 2: GENERATE LLM CANDIDATES (slow, costs $)
                num_llm = self.num_llm_candidates if attempt == 0 else self.num_llm_candidates + 2  # More LLM on retry

                logger.info(f"Generating {num_llm} LLM candidates...")

                async def generate_llm_candidates():
                    candidates = []
                    for i in range(num_llm):
                        prompt = self._build_gfs_prompt(
                            context=context,
                            attempt=attempt,
                            candidate_num=i
                        )

                        temperature = 0.9 if attempt == 0 else 0.7
                        candidate_text = await self.transformer.llm(prompt, temperature)
                        cleaned = self.transformer._parse_llm_response(candidate_text)
                        candidates.append(cleaned)

                    return candidates

                try:
                    loop = asyncio.get_running_loop()
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        llm_candidates = executor.submit(
                            lambda: asyncio.run(generate_llm_candidates())
                        ).result()
                except RuntimeError:
                    llm_candidates = asyncio.run(generate_llm_candidates())

                llm_candidates_with_source = [
                    (cand, "llm")
                    for cand in llm_candidates
                ]

                logger.info(f"✅ Generated {len(llm_candidates_with_source)} LLM candidates")

                # STEP 3: COMBINE & DEDUPLICATE
                all_candidates = rule_candidates_with_source + llm_candidates_with_source
                logger.info(f"Combined candidates: {len(all_candidates)} total")

                unique_candidates = self._deduplicate_candidates(
                    all_candidates,
                    threshold=self.dedup_threshold
                )

                # STEP 4: FILTER (programmatic constraints)
                # Extract just the text for filtering
                candidate_texts = [text for text, source in unique_candidates]
                valid_texts = self._filter_candidates(
                    original_text=context.text,
                    candidates=candidate_texts,
                    context=context
                )

                # Reconstruct (text, source) pairs for valid candidates
                valid_candidates_with_source = [
                    (text, source)
                    for text, source in unique_candidates
                    if text in valid_texts
                ]

                # STEP 5: SELECT (POVM measurement)
                if valid_candidates_with_source:
                    selection_result = self._select_best_candidate(
                        original_text=context.text,
                        candidates_with_source=valid_candidates_with_source,
                        context=context
                    )

                    if selection_result:
                        best_text, best_improvement, best_source = selection_result

                        # Check if improvement meets threshold
                        if best_improvement >= 0.01:  # Minimum improvement
                            # Success!
                            execution_time_ms = (time.time() - start_time) * 1000

                            # Calculate text change ratio
                            orig_words = set(context.text.lower().split())
                            trans_words = set(best_text.lower().split())
                            text_change = 1.0 - (len(orig_words & trans_words) / len(orig_words) if orig_words else 0.0)

                            # Verify transformation
                            readings_before, readings_after, improvement, rho_dist = self._verify_transformation(
                                context.text,
                                best_text,
                                context
                            )

                            # Estimate cost (only LLM calls cost money)
                            llm_cost = self._estimate_llm_cost(num_llm)

                            return TransformationResult(
                                transformed_text=best_text,
                                success=True,
                                readings_before=readings_before,
                                readings_after=readings_after,
                                target_improvement=improvement,
                                rho_distance_moved=rho_dist,
                                text_change_ratio=text_change,
                                semantic_coherence=0.8,  # Heuristic
                                method=TransformationMethod.HYBRID,
                                strategy_name="HybridRulesGFS",
                                execution_time_ms=execution_time_ms,
                                cost_usd=llm_cost,
                                rules_applied=[f"Best candidate source: {best_source}"]
                            )

                # No valid candidates or improvement too small - retry
                logger.warning(f"Attempt {attempt + 1} failed - no valid transformations found")

            # All retries exhausted
            execution_time_ms = (time.time() - start_time) * 1000
            return self._failed_result(
                context,
                f"No valid transformations found after {self.max_retries} attempts",
                start_time
            )

        except Exception as e:
            logger.error(f"Hybrid transformation failed: {e}", exc_info=True)
            return self._failed_result(context, str(e), start_time)

    def _estimate_llm_cost(self, num_llm_calls: int) -> float:
        """
        Estimate LLM cost for hybrid transformation.

        Args:
            num_llm_calls: Number of LLM API calls made

        Returns:
            Estimated cost in USD
        """
        # Rough estimate: $0.001 per call (depends on provider/model)
        # Claude Haiku: ~$0.00025/1K input tokens, ~$0.00125/1K output tokens
        # Typical call: 200 input + 50 output = ~$0.0001/call
        cost_per_call = 0.0001
        return num_llm_calls * cost_per_call

    def _failed_result(
        self,
        context: TransformationContext,
        error_message: str,
        start_time: float
    ) -> TransformationResult:
        """Create failed transformation result."""
        execution_time_ms = (time.time() - start_time) * 1000

        return TransformationResult(
            transformed_text=context.text,
            success=False,
            readings_before=context.current_readings,
            readings_after=context.current_readings,
            target_improvement=0.0,
            rho_distance_moved=0.0,
            text_change_ratio=0.0,
            semantic_coherence=0.0,
            method=TransformationMethod.HYBRID,
            strategy_name="HybridRulesGFS",
            execution_time_ms=execution_time_ms,
            cost_usd=0.0,
            error_message=error_message
        )

    def estimate_cost(self, context: TransformationContext) -> float:
        """
        Estimate cost in USD for hybrid transformation.

        Cost = LLM calls only (rules are free)
        Default: 5 LLM calls × $0.0001 = $0.0005
        """
        return self._estimate_llm_cost(self.num_llm_candidates)

    def estimate_latency(self, context: TransformationContext) -> float:
        """
        Estimate execution time in milliseconds.

        Hybrid:
        - Rule generation: ~100ms (parallel with LLM, negligible)
        - LLM generation: ~5000ms for 5 candidates
        - Dedup + Filter + Select: ~200ms
        Total: ~5300ms
        """
        rule_time = 100  # Fast, parallel with LLM
        llm_time = 1000 * self.num_llm_candidates  # ~1s per candidate
        processing_time = 200  # Dedup, filter, select

        return rule_time + llm_time + processing_time
