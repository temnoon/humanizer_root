"""
Personifier Service - Transform AI text to conversational register

Supports two methods:
1. TRM Iterative: Use learned target stance from 396 training pairs
2. LLM Only: Direct transformation with pattern-based prompting

The TRM method measures the "conversational stance" from training data,
then uses iterative refinement to reach that target.
"""

import json
import re
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import numpy as np
from pydantic import BaseModel

from humanizer.services.transformation import TransformationService
from humanizer.models.transformation import Transformation, TransformationType, SourceType
from sqlalchemy.ext.asyncio import AsyncSession


class AIPatterns(BaseModel):
    """Detected AI writing patterns."""
    hedging: int = 0
    formal_transitions: int = 0
    passive_voice: int = 0
    list_markers: int = 0
    numbered_lists: int = 0
    bullet_points: int = 0

    @property
    def total_score(self) -> float:
        return (
            self.hedging * 1.5 +
            self.formal_transitions * 1.0 +
            self.passive_voice * 1.2 +
            self.list_markers * 0.8 +
            self.numbered_lists * 1.0 +
            self.bullet_points * 0.5
        )

    @property
    def confidence(self) -> float:
        """Confidence that text is AI-written (0-100)."""
        return min(100, self.total_score * 10)


class PersonifierService:
    """Transform AI writing to conversational register using TRM or LLM."""

    def __init__(
        self,
        data_dir: str = "humanizer/data",
        embedding_model: str = "all-MiniLM-L6-v2",
        rank: int = 64,
    ):
        """
        Initialize Personifier service.

        Args:
            data_dir: Directory containing training data
            embedding_model: SentenceTransformer model name
            rank: Dimension for density matrices
        """
        self.data_dir = Path(data_dir)
        self.rank = rank

        # Initialize transformation service for TRM method
        self.transformation_service = TransformationService(
            embedding_model=embedding_model,
            rank=rank,
        )

        # Load training pairs
        self.training_pairs = self._load_training_pairs()

        # Compute target stance from training data (lazy loaded)
        self._target_stance_cache: Optional[Dict[str, Dict[str, float]]] = None

    def _load_training_pairs(self) -> List[Dict]:
        """Load 396 curated training pairs."""
        pairs_file = self.data_dir / "curated_style_pairs.jsonl"

        if not pairs_file.exists():
            raise FileNotFoundError(
                f"Training data not found: {pairs_file}\n"
                f"Please copy from humanizer-agent: cp ~/humanizer-agent/backend/data/curated_style_pairs.jsonl {self.data_dir}/"
            )

        pairs = []
        with open(pairs_file, "r") as f:
            for line in f:
                pairs.append(json.loads(line))

        return pairs

    def _compute_target_stance(self, povm_pack: str = "tone") -> Dict[str, float]:
        """
        Compute target stance from conversational training examples.

        Embeds all "casual" texts, measures with POVM, averages the readings.
        This gives us the "conversational stance" to aim for.

        Args:
            povm_pack: POVM pack to use for measurement

        Returns:
            Target stance dict {axis: probability}
        """
        # Cache by POVM pack
        if self._target_stance_cache is None:
            self._target_stance_cache = {}

        if povm_pack in self._target_stance_cache:
            return self._target_stance_cache[povm_pack]

        # Get POVM pack
        if povm_pack not in self.transformation_service.povm_packs:
            raise ValueError(f"Unknown POVM pack: {povm_pack}")

        pack = self.transformation_service.povm_packs[povm_pack]

        # Sample casual examples (use subset for speed)
        casual_texts = [pair["casual"] for pair in self.training_pairs[:100]]

        # Measure each one
        all_readings = []
        for text in casual_texts:
            embedding = self.transformation_service.embed_text(text)
            from humanizer.ml.density import construct_density_matrix
            rho = construct_density_matrix(embedding, rank=self.rank)
            readings = pack.measure(rho)
            all_readings.append(readings)

        # Average the readings
        axes = list(all_readings[0].keys())
        target_stance = {
            axis: float(np.mean([r[axis] for r in all_readings]))
            for axis in axes
        }

        # Cache it
        self._target_stance_cache[povm_pack] = target_stance

        return target_stance

    async def personify_trm(
        self,
        text: str,
        povm_pack: str = "tone",
        max_iterations: int = 5,
        convergence_threshold: float = 0.05,
    ) -> Dict:
        """
        Transform text using TRM iterative method.

        Uses target stance computed from 396 training pairs.

        Args:
            text: AI-written text to transform
            povm_pack: POVM pack to use
            max_iterations: Max iterations
            convergence_threshold: Convergence threshold

        Returns:
            dict with:
                - method: "trm"
                - original_text: Original text
                - transformed_text: Transformed text
                - ai_patterns: Detected AI patterns
                - target_stance: Target stance used
                - iterations: Number of iterations
                - convergence_score: Final drift
                - processing_time: Time in ms
                - steps: Intermediate steps
        """
        start_time = time.time()

        # Detect AI patterns
        patterns = self._detect_patterns(text)

        # Get target stance from training data
        target_stance = self._compute_target_stance(povm_pack)

        # Use transformation service
        result = await self.transformation_service.transform_trm(
            text=text,
            povm_pack_name=povm_pack,
            target_stance=target_stance,
            max_iterations=max_iterations,
            convergence_threshold=convergence_threshold,
        )

        processing_time = int((time.time() - start_time) * 1000)

        return {
            "method": "trm",
            "original_text": text,
            "transformed_text": result["transformed_text"],
            "ai_patterns": patterns.dict(),
            "ai_confidence": patterns.confidence,
            "target_stance": target_stance,
            "iterations": result["iterations"],
            "convergence_score": result["convergence_score"],
            "processing_time": processing_time,
            "embedding_drift": result["embedding_drift"],
            "steps": result["steps"],
        }

    async def personify_llm(
        self,
        text: str,
        strength: float = 1.0,
        use_examples: bool = True,
        n_examples: int = 3,
    ) -> Dict:
        """
        Transform text using LLM only (no iterative refinement).

        Uses pattern detection and example-based prompting.

        Args:
            text: AI-written text to transform
            strength: Transformation strength (0.5-2.0)
            use_examples: Whether to include training examples in prompt
            n_examples: Number of examples to include

        Returns:
            dict with:
                - method: "llm"
                - original_text: Original text
                - transformed_text: Transformed text
                - ai_patterns: Detected patterns
                - examples_used: Training examples used
                - processing_time: Time in ms
        """
        start_time = time.time()

        # Detect AI patterns
        patterns = self._detect_patterns(text)

        # Select examples if requested
        examples = []
        if use_examples:
            examples = self._select_examples(text, n=n_examples)

        # Build prompt
        prompt = self._build_personify_prompt(
            text=text,
            patterns=patterns,
            examples=examples,
            strength=strength,
        )

        # Call LLM
        transformed_text = await self.transformation_service._call_llm_for_transformation(
            original_text=text,
            prompt=prompt,
            iteration=0,
        )

        processing_time = int((time.time() - start_time) * 1000)

        return {
            "method": "llm",
            "original_text": text,
            "transformed_text": transformed_text,
            "ai_patterns": patterns.dict(),
            "ai_confidence": patterns.confidence,
            "examples_used": examples,
            "strength": strength,
            "processing_time": processing_time,
        }

    async def compare_methods(
        self,
        text: str,
        povm_pack: str = "tone",
        max_iterations: int = 5,
        llm_strength: float = 1.0,
    ) -> Dict:
        """
        Run both TRM and LLM methods and compare results.

        Args:
            text: Text to transform
            povm_pack: POVM pack for TRM method
            max_iterations: Max iterations for TRM
            llm_strength: Strength for LLM method

        Returns:
            dict with:
                - trm_result: TRM transformation result
                - llm_result: LLM transformation result
                - comparison: Comparison metrics
        """
        # Run both methods
        trm_result = await self.personify_trm(
            text=text,
            povm_pack=povm_pack,
            max_iterations=max_iterations,
        )

        llm_result = await self.personify_llm(
            text=text,
            strength=llm_strength,
            use_examples=True,
        )

        # Compute comparison metrics
        trm_text = trm_result["transformed_text"]
        llm_text = llm_result["transformed_text"]

        # Word count reduction
        original_words = len(text.split())
        trm_words = len(trm_text.split())
        llm_words = len(llm_text.split())

        trm_reduction = (original_words - trm_words) / original_words if original_words > 0 else 0
        llm_reduction = (original_words - llm_words) / original_words if original_words > 0 else 0

        # Measure final stances
        pack = self.transformation_service.povm_packs[povm_pack]

        trm_embedding = self.transformation_service.embed_text(trm_text)
        from humanizer.ml.density import construct_density_matrix
        trm_rho = construct_density_matrix(trm_embedding, rank=self.rank)
        trm_readings = pack.measure(trm_rho)

        llm_embedding = self.transformation_service.embed_text(llm_text)
        llm_rho = construct_density_matrix(llm_embedding, rank=self.rank)
        llm_readings = pack.measure(llm_rho)

        # Target stance
        target_stance = self._compute_target_stance(povm_pack)

        # Compute alignment with target
        trm_alignment = self.transformation_service._compute_alignment(
            trm_readings, target_stance
        )
        llm_alignment = self.transformation_service._compute_alignment(
            llm_readings, target_stance
        )

        return {
            "trm_result": {
                **trm_result,
                "final_readings": trm_readings,
                "word_count": trm_words,
                "word_reduction": trm_reduction,
                "alignment_with_target": trm_alignment,
            },
            "llm_result": {
                **llm_result,
                "final_readings": llm_readings,
                "word_count": llm_words,
                "word_reduction": llm_reduction,
                "alignment_with_target": llm_alignment,
            },
            "comparison": {
                "trm_alignment": trm_alignment,
                "llm_alignment": llm_alignment,
                "trm_better": trm_alignment > llm_alignment,
                "alignment_improvement": trm_alignment - llm_alignment,
                "trm_reduction": trm_reduction,
                "llm_reduction": llm_reduction,
                "trm_iterations": trm_result["iterations"],
                "trm_time": trm_result["processing_time"],
                "llm_time": llm_result["processing_time"],
            },
        }

    def _detect_patterns(self, text: str) -> AIPatterns:
        """Detect AI writing patterns using regex."""
        patterns = AIPatterns()

        # Hedging phrases
        hedging_phrases = [
            r"it'?s worth noting",
            r"you might want to",
            r"it should be noted",
            r"it is important to note",
            r"consider the following",
            r"it may be beneficial",
            r"it could be argued",
        ]
        for phrase in hedging_phrases:
            patterns.hedging += len(re.findall(phrase, text, re.IGNORECASE))

        # Formal transitions
        formal_transitions = [
            r"\bfurthermore\b",
            r"\bmoreover\b",
            r"\badditionally\b",
            r"\bin addition\b",
            r"\bconsequently\b",
        ]
        for transition in formal_transitions:
            patterns.formal_transitions += len(re.findall(transition, text, re.IGNORECASE))

        # Passive voice markers
        passive_markers = [
            r"can be done",
            r"should be noted",
            r"has been shown",
            r"is recommended",
            r"are described",
            r"can be seen",
        ]
        for marker in passive_markers:
            patterns.passive_voice += len(re.findall(marker, text, re.IGNORECASE))

        # List markers
        patterns.list_markers = len(
            re.findall(r"here are|following are|as follows", text, re.IGNORECASE)
        )

        # Numbered lists
        patterns.numbered_lists = len(re.findall(r"^\d+\.", text, re.MULTILINE))

        # Bullet points
        patterns.bullet_points = len(re.findall(r"^[•\-\*]", text, re.MULTILINE))

        return patterns

    def _select_examples(self, text: str, n: int = 3) -> List[Dict]:
        """
        Select most relevant training examples for this text.

        For now, randomly sample. Could use embedding similarity.
        """
        import random

        # Sample random examples
        samples = random.sample(self.training_pairs, min(n, len(self.training_pairs)))

        return [
            {
                "formal": ex["formal"],
                "casual": ex["casual"],
                "category": ex["category"],
            }
            for ex in samples
        ]

    def _build_personify_prompt(
        self,
        text: str,
        patterns: AIPatterns,
        examples: List[Dict],
        strength: float,
    ) -> str:
        """Build prompt for LLM personification."""

        examples_text = ""
        if examples:
            examples_text = "\n\nEXAMPLES (formal → casual):\n"
            for i, ex in enumerate(examples, 1):
                examples_text += f"{i}. \"{ex['formal']}\" → \"{ex['casual']}\"\n"

        intensity = "moderate"
        if strength > 1.5:
            intensity = "aggressive"
        elif strength < 0.8:
            intensity = "light"

        prompt = f"""You are transforming AI-generated text to sound more natural and conversational. Remove the telltale signs of AI writing while keeping the full meaning.

CRITICAL RULES:
1. Return ONLY the transformed text - NO labels, annotations, or explanations
2. Transform the COMPLETE text - do NOT omit information, but simplify naturally
3. Do NOT add hedging like "it's worth noting" or "however, one should consider"
4. Do NOT add qualifications or uncertainty - be MORE direct and confident
5. SIMPLIFY vocabulary and sentence structure - make it easier to read, not more elaborate
6. Shorter, simpler, more direct is BETTER - aim for clarity over sophistication

AI PATTERNS TO REMOVE:
- Hedging: {patterns.hedging} instances found
- Formal transitions: {patterns.formal_transitions} instances found
- Passive voice: {patterns.passive_voice} instances found

TRANSFORMATION INTENSITY: {intensity}

{examples_text}

HOW TO TRANSFORM:
✗ WRONG: Add hedging, qualifications, elaborate phrasing, ornate language
✓ RIGHT: Remove hedging, be direct, use simple words, active voice

SIMPLIFICATION EXAMPLES (what we want):
- "Transcendental phenomenology elucidates" → "Phenomenology shows"
- "It constitutes a fundamental paradigm shift" → "It's a big change"
- "The methodology facilitates comprehension" → "This helps us understand"
- "One must consider the implications" → "Think about what this means"
- "It's worth noting that X" → "X" (just state it directly)
- "Furthermore, it could be argued" → "Also," (conversational)
- "This can be seen as" → "This is" (confident)

ANTI-PATTERNS (what to AVOID):
✗ "transformative" → ✓ "big" or "important"
✗ "paradigmatic" → ✓ "typical" or "example"
✗ "elucidate" → ✓ "show" or "explain"
✗ "facilitate" → ✓ "help" or "make easier"
✗ "constitute" → ✓ "is" or "makes up"
✗ "endeavor" → ✓ "try" or "attempt"

RULES:
1. Transform EVERY section (no skipping)
2. REMOVE all hedging phrases
3. Replace formal transitions with casual ones
4. Convert passive to active voice
5. SIMPLIFY vocabulary - use everyday words, not fancy synonyms
6. Shorten sentences where natural
7. Be direct and confident (opposite of AI hedging!)
8. Natural reduction in length is GOOD (we're removing fluff)
9. Keep all structure (headings, lists, sections)
10. Return clean text only

ORIGINAL TEXT:
{text}

CONVERSATIONAL VERSION (simpler, shorter, more direct):"""

        return prompt

    async def save_personification(
        self,
        db: AsyncSession,
        user_id,
        source_text: str,
        result_text: str,
        method: str,
        parameters: Dict,
        metrics: Dict,
        user_prompt: Optional[str] = None,
        source_message_uuid: Optional[str] = None,
    ) -> Transformation:
        """
        Save a personification result to the database.

        Args:
            db: Database session
            user_id: User ID (UUID)
            source_text: Original AI text
            result_text: Personified text
            method: Method used ('trm' or 'llm')
            parameters: Personification parameters
            metrics: Transformation metrics
            user_prompt: Optional user description
            source_message_uuid: Optional UUID of source message

        Returns:
            Created Transformation record
        """
        # Determine transformation type
        transformation_type = (
            TransformationType.PERSONIFY_TRM
            if method == "trm"
            else TransformationType.PERSONIFY_LLM
        )

        transformation = Transformation(
            user_id=user_id,
            source_type=(
                "chatgpt_message"
                if source_message_uuid
                else "custom"
            ),
            source_uuid=source_message_uuid,
            source_text=source_text,
            transformation_type="personify_trm" if method == "trm" else "personify_llm",
            user_prompt=user_prompt or "Transform AI text to conversational register",
            parameters=parameters,
            result_text=result_text,
            metrics=metrics,
        )

        db.add(transformation)
        await db.commit()
        await db.refresh(transformation)

        return transformation


# Singleton instance
_personifier_service: Optional[PersonifierService] = None


def get_personifier_service() -> PersonifierService:
    """Get singleton PersonifierService instance."""
    global _personifier_service
    if _personifier_service is None:
        _personifier_service = PersonifierService()
    return _personifier_service
