"""
Stateless Transformation Engine

Pure transformation logic with no database dependencies.
Can run in any environment: local, Cloudflare Worker, Lambda, etc.

Vision Alignment:
- Works offline (desert island test)
- Reveals construction (shows iterations)
- Iterative practice (not one-shot black box)
"""

from typing import List, Optional, Callable, Awaitable
from dataclasses import dataclass
from uuid import uuid4
import numpy as np
from numpy.typing import NDArray

from humanizer.core.trm.density import construct_density_matrix
from humanizer.core.trm.povm import get_all_packs
from humanizer.core.trm.verification import verify_transformation


@dataclass
class TransformOptions:
    """Configuration for transformation"""
    max_iterations: int = 5
    convergence_threshold: float = 0.85
    povm_packs: List[str] = None
    temperature: float = 0.7

    def __post_init__(self):
        if self.povm_packs is None:
            self.povm_packs = ["tetralemma"]


@dataclass
class TransformStep:
    """Single iteration in transformation"""
    iteration: int
    text: str
    embedding: NDArray[np.float64]
    density_matrix: NDArray[np.float64]
    povm_measurements: dict
    convergence_score: float


@dataclass
class TransformResult:
    """Complete transformation result"""
    original_text: str
    final_text: str
    steps: List[TransformStep]
    converged: bool
    total_iterations: int
    target_stance: dict


class StatelessTransformer:
    """
    Core transformation engine with zero external dependencies.

    All functions are injected (embeddings, LLM) so this can run anywhere.
    """

    def __init__(
        self,
        embed_fn: Callable[[str], Awaitable[NDArray[np.float64]]],
        llm_fn: Callable[[str, float], Awaitable[str]],
        rank: int = 64,
    ):
        """
        Initialize with injected dependencies.

        Args:
            embed_fn: Async function that takes text, returns embedding vector
            llm_fn: Async function that takes prompt + temperature, returns text
            rank: Dimension for density matrices (default 64)
        """
        self.embed = embed_fn
        self.llm = llm_fn
        self.rank = rank

    async def transform(
        self,
        text: str,
        target_stance: dict,
        options: Optional[TransformOptions] = None,
    ) -> TransformResult:
        """
        Transform text toward target stance using TRM.

        Process:
        1. Embed original text
        2. Construct density matrix (ρ)
        3. Measure with POVMs
        4. Generate transformation via LLM
        5. Verify convergence
        6. Iterate if needed

        Vision: Shows construction, iterative practice

        Args:
            text: Original text to transform
            target_stance: Target POVM measurements (e.g., {"tetralemma": "not_a"})
            options: Transformation configuration

        Returns:
            TransformResult with all iterations visible
        """
        if options is None:
            options = TransformOptions()

        steps: List[TransformStep] = []
        current_text = text
        converged = False

        # Get POVM packs
        all_packs = get_all_packs(rank=self.rank)

        # Initial embedding and measurement
        initial_embedding = await self.embed(text)
        initial_rho = construct_density_matrix(initial_embedding, rank=self.rank)
        initial_measurements = {}

        for pack_name in options.povm_packs:
            if pack_name in all_packs:
                pack = all_packs[pack_name]
                initial_measurements[pack_name] = pack.measure(initial_rho)

        steps.append(TransformStep(
            iteration=0,
            text=text,
            embedding=initial_embedding,
            density_matrix=initial_rho.rho,
            povm_measurements=initial_measurements,
            convergence_score=0.0
        ))

        # Iterative transformation
        for iteration in range(1, options.max_iterations + 1):
            # Build transformation prompt
            prompt = self._build_prompt(
                current_text=current_text,
                target_stance=target_stance,
                current_measurements=steps[-1].povm_measurements,
                iteration=iteration
            )

            # Transform via LLM
            llm_response = await self.llm(prompt, options.temperature)

            # Parse response to extract transformed text (LLM may include meta-commentary)
            transformed_text = self._parse_llm_response(llm_response)

            # Measure new state
            new_embedding = await self.embed(transformed_text)
            new_rho = construct_density_matrix(new_embedding, rank=self.rank)
            new_measurements = {}

            for pack_name in options.povm_packs:
                if pack_name in all_packs:
                    pack = all_packs[pack_name]
                    new_measurements[pack_name] = pack.measure(new_rho)

            # Verify convergence
            convergence_score = self._compute_convergence(
                target_stance=target_stance,
                current_measurements=new_measurements
            )

            steps.append(TransformStep(
                iteration=iteration,
                text=transformed_text,
                embedding=new_embedding,
                density_matrix=new_rho.rho,
                povm_measurements=new_measurements,
                convergence_score=convergence_score
            ))

            # Check convergence
            if convergence_score >= options.convergence_threshold:
                converged = True
                break

            current_text = transformed_text

        return TransformResult(
            original_text=text,
            final_text=steps[-1].text,
            steps=steps,
            converged=converged,
            total_iterations=len(steps) - 1,
            target_stance=target_stance
        )

    def _build_prompt(
        self,
        current_text: str,
        target_stance: dict,
        current_measurements: dict,
        iteration: int
    ) -> str:
        """
        Build LLM prompt for transformation with chain-of-thought reasoning.

        Vision alignment:
        - Shows construction (reveals process, not just result)
        - Tetralemma framing (explicit stance shift)
        - Makes user feel smart (transparent reasoning)
        """
        # Extract target from stance
        target_desc = self._describe_target(target_stance)
        current_desc = self._describe_measurements(current_measurements)
        focus = self._get_transformation_focus(target_stance)

        # Build tetralemma framing explanation
        tetralemma_frame = self._build_tetralemma_frame(
            current_measurements, target_stance
        )

        # Iteration-specific guidance
        if iteration == 1:
            iteration_guidance = "This is the first transformation. Be measured and precise."
        elif iteration == 2:
            iteration_guidance = "Second iteration: strengthen the shift while maintaining naturalness."
        else:
            iteration_guidance = f"Iteration {iteration}: refine and polish. Be more concise and clear."

        prompt = f"""You are transforming text using quantum reading principles.

CURRENT: {current_text}
Current stance: {current_desc}

TARGET: {target_desc}
Focus on: {focus}

{tetralemma_frame}

INSTRUCTIONS:
Transform the text to shift toward the target stance while preserving core meaning.
Think through these steps:
1. What words/phrases signal the current stance?
2. What replacements fit the target stance?
3. Which structural patterns need to change?
4. How to preserve meaning while shifting framing?

{iteration_guidance}

Provide only the transformed text (no explanations or meta-commentary):"""

        return prompt

    def _build_tetralemma_frame(
        self,
        current_measurements: dict,
        target_stance: dict
    ) -> str:
        """
        Build tetralemma framing explanation for the transformation.

        Reveals the perspective shift in tetralemma terms when applicable.
        """
        # Check if we're working with tetralemma pack
        if "tetralemma" in target_stance:
            target_axis = target_stance["tetralemma"]
            current_axis = max(
                current_measurements.get("tetralemma", {}),
                key=current_measurements.get("tetralemma", {}).get,
                default="unknown"
            )

            tetralemma_map = {
                "A": "affirming the proposition (A)",
                "not_A": "negating the proposition (¬A)",
                "both": "holding both affirmation and negation simultaneously",
                "neither": "transcending both affirmation and negation"
            }

            current_explanation = tetralemma_map.get(current_axis, current_axis)
            target_explanation = tetralemma_map.get(target_axis, target_axis)

            return f"""TETRALEMMA SHIFT:
From: {current_explanation}
To: {target_explanation}

This transformation shifts your perspective through the tetralemma—revealing how
the same meaning can be framed through different logical stances."""

        # For non-tetralemma packs, provide a general framing
        else:
            pack_name = list(target_stance.keys())[0]
            target_axis = target_stance[pack_name]
            current_axis = max(
                current_measurements.get(pack_name, {}),
                key=current_measurements.get(pack_name, {}).get,
                default="unknown"
            )

            return f"""PERSPECTIVE SHIFT ({pack_name}):
From: {current_axis}
To: {target_axis}

This transformation reveals how meaning shifts when viewed through different {pack_name} lenses."""

    def _parse_llm_response(self, response: str) -> str:
        """
        Parse LLM response to extract the transformed text.

        The prompt asks for only the transformed text, but some LLMs may add
        explanations or meta-commentary. This method cleans that up.

        Args:
            response: Raw LLM response

        Returns:
            Cleaned transformed text
        """
        text = response.strip()

        # Remove common meta-commentary patterns
        meta_patterns = [
            "Here is the transformed text:",
            "Here's the transformation:",
            "Transformed text:",
            "The transformed text is:",
            "The revised text",
        ]

        for pattern in meta_patterns:
            if text.lower().startswith(pattern.lower()):
                # Remove the pattern and any following punctuation/whitespace
                text = text[len(pattern):].lstrip(":").strip()
                break

        # Clean up quotes (LLM often wraps output in quotes)
        text = text.strip('"\'')

        # Remove trailing explanations (after blank line)
        if "\n\n" in text:
            parts = text.split("\n\n")
            # Take the first substantial part
            text = parts[0].strip()

        # Remove single-line explanations or notes
        lines = text.split("\n")
        cleaned_lines = []
        for line in lines:
            lower_line = line.lower().strip()
            # Skip lines that are meta-commentary
            if any(marker in lower_line for marker in [
                "note:", "explanation:", "reasoning:", "iteration:",
                "guidance:", "analysis:", "this is", "i have"
            ]):
                break  # Stop at first meta-commentary line
            cleaned_lines.append(line)

        if cleaned_lines:
            text = "\n".join(cleaned_lines).strip()

        return text

    def _describe_target(self, target_stance: dict) -> str:
        """Convert target stance dict to human description"""
        descriptions = []
        for pack, target in target_stance.items():
            descriptions.append(f"{pack}={target}")
        return ", ".join(descriptions)

    def _describe_measurements(self, measurements: dict) -> str:
        """Describe current POVM measurements"""
        descriptions = []
        for pack, values in measurements.items():
            max_key = max(values, key=values.get)
            descriptions.append(f"{pack}={max_key}")
        return ", ".join(descriptions)

    def _get_transformation_focus(self, target_stance: dict) -> str:
        """Get focus area for transformation"""
        if "tetralemma" in target_stance:
            return "perspective and logical stance"
        elif "tone" in target_stance:
            return "emotional tone and style"
        elif "ontology" in target_stance:
            return "ontological framing"
        else:
            return "semantic positioning"

    def _compute_convergence(
        self,
        target_stance: dict,
        current_measurements: dict
    ) -> float:
        """
        Compute convergence score: how close are we to target?

        Returns score in [0, 1] where 1 = perfect match
        """
        scores = []

        for pack_name, target_axis in target_stance.items():
            if pack_name in current_measurements:
                measurements = current_measurements[pack_name]
                if target_axis in measurements:
                    # Score is the probability of the target axis
                    scores.append(measurements[target_axis])

        if not scores:
            return 0.0

        # Average score across all target axes
        return float(np.mean(scores))
