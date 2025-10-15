"""
Transformation Service - TRM Iterative Embedding Approximation

This implements transformation using iterative refinement guided by
embedding space measurements:

1. Measure current state (ρ, POVM readings)
2. Generate candidate transformation via LLM
3. Measure new state
4. Check convergence toward target stance
5. Repeat until converged or max iterations

This is the CORE of the TRM transformation method.
"""

import time
from typing import Dict, List, Optional, Tuple
from uuid import UUID
import numpy as np
from sentence_transformers import SentenceTransformer
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.ml.density import construct_density_matrix, rho_distance, DensityMatrix
from humanizer.ml.povm import get_all_packs, POVMPack
from humanizer.ml.verification import verify_transformation
from humanizer.models.transformation import Transformation, TransformationType, SourceType


class TransformationService:
    """Service for text transformation using TRM iterative method."""

    def __init__(self, embedding_model: str = "all-MiniLM-L6-v2", rank: int = 64):
        """
        Initialize transformation service.

        Args:
            embedding_model: SentenceTransformer model name
            rank: Dimension for density matrices
        """
        self.embedding_model = SentenceTransformer(embedding_model)
        self.rank = rank
        self.povm_packs = get_all_packs(rank=rank)

    def embed_text(self, text: str) -> np.ndarray:
        """Embed text using SentenceTransformer."""
        return self.embedding_model.encode(text, convert_to_numpy=True)

    async def transform_trm(
        self,
        text: str,
        povm_pack_name: str,
        target_stance: Dict[str, float],
        max_iterations: int = 5,
        convergence_threshold: float = 0.05,
    ) -> Dict:
        """
        Transform text using TRM iterative embedding approximation.

        Process:
        1. Embed original text → ρ₀
        2. Measure with POVM → get current stance
        3. Generate transformation prompt targeting desired stance
        4. Get LLM transformation → new text
        5. Embed new text → ρ₁
        6. Measure distance |ρ₁ - ρ_target|
        7. If not converged, repeat with ρ₁ as starting point

        Args:
            text: Original text to transform
            povm_pack_name: POVM pack to use (e.g., "tetralemma")
            target_stance: Target probabilities {axis: prob}
            max_iterations: Maximum iterations
            convergence_threshold: Stop when drift < threshold

        Returns:
            dict with:
                - text: Final transformed text
                - iterations: Number of iterations performed
                - convergence_score: Final drift from target
                - processing_time: Time in milliseconds
                - embedding_drift: List of drift values per iteration
                - steps: List of intermediate states
        """
        start_time = time.time()

        # Get POVM pack
        if povm_pack_name not in self.povm_packs:
            raise ValueError(f"Unknown POVM pack: {povm_pack_name}")

        povm_pack = self.povm_packs[povm_pack_name]

        # Store for use in _generate_transformation_prompt
        self._current_povm_pack_name = povm_pack_name

        # Track iteration states
        steps = []
        embedding_drift = []
        current_text = text

        # Initial embedding and measurement
        current_embedding = self.embed_text(current_text)
        current_rho = construct_density_matrix(current_embedding, rank=self.rank)
        current_readings = povm_pack.measure(current_rho)

        # Construct target ρ from target stance
        # (This is a simplified approximation - in practice would need to solve for it)
        target_rho = self._estimate_target_rho(povm_pack, target_stance)

        for iteration in range(max_iterations):
            # Compute drift from target
            drift = rho_distance(current_rho, target_rho)
            embedding_drift.append(drift)

            # Store step
            steps.append({
                "iteration": iteration,
                "text": current_text,
                "readings": current_readings,
                "drift": drift,
                "purity": current_rho.purity,
            })

            # Check convergence
            if drift < convergence_threshold:
                break

            # Generate transformation prompt
            prompt = self._generate_transformation_prompt(
                current_text,
                current_readings,
                target_stance,
                povm_pack.description,
            )

            # Get transformation (placeholder - would call actual LLM)
            transformed_text = await self._call_llm_for_transformation(
                current_text,
                prompt,
                iteration,
            )

            # Measure new state
            new_embedding = self.embed_text(transformed_text)
            new_rho = construct_density_matrix(new_embedding, rank=self.rank)
            new_readings = povm_pack.measure(new_rho)

            # Update for next iteration
            current_text = transformed_text
            current_embedding = new_embedding
            current_rho = new_rho
            current_readings = new_readings

        # Final measurement
        final_drift = rho_distance(current_rho, target_rho)
        processing_time = int((time.time() - start_time) * 1000)

        return {
            "method": "trm",
            "transformed_text": current_text,
            "iterations": len(steps),
            "convergence_score": final_drift,
            "processing_time": processing_time,
            "embedding_drift": embedding_drift,
            "steps": steps,
        }

    async def transform_llm_only(
        self,
        text: str,
        target_stance: Dict[str, float],
    ) -> Dict:
        """
        Transform text using LLM only (baseline comparison).

        Single-pass transformation without iterative refinement.

        Args:
            text: Original text to transform
            target_stance: Target probabilities (for prompt construction)

        Returns:
            dict with:
                - text: Transformed text
                - processing_time: Time in milliseconds
        """
        start_time = time.time()

        # Simple prompt based on target stance
        stance_desc = ", ".join([f"{k}: {v:.1f}" for k, v in target_stance.items()])
        prompt = f"Transform the following text to have this stance distribution: {stance_desc}\n\nText: {text}"

        # Get transformation (placeholder - would call actual LLM)
        transformed_text = await self._call_llm_for_transformation(text, prompt, 0)

        processing_time = int((time.time() - start_time) * 1000)

        return {
            "method": "llm",
            "transformed_text": transformed_text,
            "processing_time": processing_time,
        }

    def _estimate_target_rho(
        self,
        povm_pack: POVMPack,
        target_stance: Dict[str, float],
    ) -> DensityMatrix:
        """
        Estimate a density matrix that would yield the target stance.

        This is a simplified approach using weighted combination of POVM operators.
        More sophisticated: solve optimization problem.

        Args:
            povm_pack: POVM pack being used
            target_stance: Desired probabilities

        Returns:
            Estimated target density matrix
        """
        # Weighted sum of POVM operators (not perfect but reasonable approximation)
        target_matrix = np.zeros((self.rank, self.rank))

        for op in povm_pack.operators:
            if op.name in target_stance:
                weight = target_stance[op.name]
                target_matrix += weight * op.E

        # Normalize to make valid ρ
        trace = np.trace(target_matrix)
        if trace > 1e-10:
            target_matrix = target_matrix / trace
        else:
            target_matrix = np.eye(self.rank) / self.rank

        # Eigendecompose to get proper DensityMatrix object
        eigenvalues, eigenvectors = np.linalg.eigh(target_matrix)
        idx = np.argsort(eigenvalues)[::-1]
        eigenvalues = np.maximum(eigenvalues[idx], 0)

        # Ensure normalized
        eigenvalues = eigenvalues / np.sum(eigenvalues) if np.sum(eigenvalues) > 0 else eigenvalues

        return DensityMatrix(
            rho=target_matrix,
            eigenvalues=eigenvalues,
            eigenvectors=eigenvectors[:, idx],
            rank=self.rank,
        )

    def _get_axis_meaning(self, povm_pack_name: str, axis: str) -> str:
        """
        Get linguistic meaning of a POVM axis.

        Args:
            povm_pack_name: Name of POVM pack
            axis: Axis name

        Returns:
            Concrete linguistic instruction
        """
        AXIS_MEANINGS = {
            "tetralemma": {
                "A": "Be definite - remove hedging ('could be argued', 'might'). Keep strong verbs if present ('marks', 'is'). Use direct statements. Keep words like 'shift', 'is a' if already present",
                "¬A": "Be critical - use direct negations: 'isn't', 'not really', 'doesn't'. Add 'question whether' to challenge claims. Be skeptical and doubtful",
                "both": "Embrace paradox - MUST use words 'both...and', 'paradox'. Show contradictions existing together",
                "neither": "Be more transcendent - avoid binaries, use abstract language, philosophical framing",
            },
            "tone": {
                "analytical": "Be analytical - use words like 'systematic', 'investigate', 'structures', 'analyze'. Logical and precise",
                "critical": "Be more critical - question assumptions, point out problems, skeptical stance",
                "empathic": "Be empathic - use 'we', 'you', 'understand'. Make it personal and relational",
                "playful": "Be playful - use phrases 'like', 'imagine', 'think of it as'. Use metaphors and analogies to make it fun",
                "neutral": "Be more neutral - third-person, balanced, objective presentation",
            },
            "ontology": {
                "corporeal": "Focus on the physical - use sensory language, bodily descriptions, material details",
                "subjective": "Be more subjective - use first-person, personal experiences, 'I feel/think'",
                "objective": "Be more objective - use third-person, measurable facts, observer-independent language",
                "mixed_frame": "Use multiple perspectives - switch viewpoints, acknowledge different frames",
            },
            "pragmatics": {
                "clarity": "Be clear - remove ALL hedging ('could', 'might', 'possibly'). Use simple direct statements: 'X is a method' not 'X could be a method'. Short, simple, clear",
                "coherence": "Improve flow - smooth transitions, logical connections, consistent reasoning",
                "evidence": "Add evidence - use words 'studies', 'research', 'evidence'. Cite sources, use data, provide examples",
                "charity": "Be more charitable - 'to be fair...', steelman arguments, acknowledge strengths",
            },
            "audience": {
                "expert": "Write for experts - use technical philosophy terms: 'noetic', 'noematic', 'eidetic', 'transcendental'. Dense, assumes knowledge",
                "general": "Write for general readers - replace jargon: 'elucidates'→'helps us understand', 'eidetic'→'essential', use 'how', 'what', 'why'",
                "student": "Write for students - step-by-step, clear definitions, pedagogical approach",
                "policy": "Write for policymakers - action-oriented, implications, concrete recommendations",
                "editorial": "Write as editorial - strong voice, persuasive arguments, call to action",
            },
        }

        meanings = AXIS_MEANINGS.get(povm_pack_name, {})
        return meanings.get(axis, f"Adjust {axis} stance")

    def _generate_transformation_prompt(
        self,
        text: str,
        current_readings: Dict[str, float],
        target_stance: Dict[str, float],
        povm_description: str,
    ) -> str:
        """
        Generate prompt for LLM transformation.

        Instructs LLM to move text toward target stance with concrete linguistic guidance.

        Args:
            text: Current text
            current_readings: Current POVM readings
            target_stance: Target probabilities
            povm_description: Description of POVM pack

        Returns:
            Prompt string
        """
        # Compute deltas
        deltas = {
            axis: target_stance.get(axis, 0) - current_readings.get(axis, 0)
            for axis in target_stance.keys()
        }

        # Build contextualized directives
        directives = []
        for axis, delta in sorted(deltas.items(), key=lambda x: abs(x[1]), reverse=True):
            if abs(delta) > 0.05:  # Significant change needed
                # Get povm_pack_name from current context
                povm_pack_name = self._current_povm_pack_name if hasattr(self, '_current_povm_pack_name') else 'tetralemma'
                meaning = self._get_axis_meaning(povm_pack_name, axis)
                direction = "MORE" if delta > 0 else "LESS"
                directives.append(f"• {direction} {axis}: {meaning} (shift: {delta:+.2f})")

        directive_text = "\n".join(directives) if directives else "Maintain current balance"

        prompt = f"""You are a precise text transformation specialist. Your ONLY job is to follow the directives below EXACTLY.

=== DIRECTIVES (FOLLOW THESE PRECISELY) ===
{directive_text}

=== CRITICAL RULES ===
1. Return ONLY the transformed text - NO annotations, labels, or meta-commentary
2. Do NOT include stance values like "(A: 0.70)" in your output
3. Transform EVERY section - do NOT omit information
4. USE THE EXACT WORDS suggested in the directives above (e.g., if it says "use 'helps us understand'", use those exact words)
5. Follow the directives EXACTLY - they tell you what linguistic changes to make
6. Do NOT make the text unnecessarily ornate or elaborate
7. When simplifying: use SIMPLE everyday words (not fancy synonyms like 'reveals' or 'elucidate')
8. When adding expertise: use PRECISE technical terminology (not verbose descriptions)

=== WHAT TO AVOID (COMMON MISTAKES) ===
✗ Using fancy words when simple ones work: "elucidate" → use "show" or "explain"
✗ Adding unnecessary adjectives: "transformative metamorphosis" → use "change" or "shift"
✗ Being overly verbose: "dissecting and elucidating the complex mechanisms" → use "analyzing how"
✗ Wrong tone: "Yo ho ho! Strap in!" is not playful, it's juvenile

=== EXAMPLE TRANSFORMATIONS ===
General audience (simplify):
  "Transcendental phenomenology elucidates the eidetic structures"
  → "Phenomenology helps us understand the essential patterns"

Expert audience (add precision):
  "Phenomenology helps us understand consciousness"
  → "Phenomenological reduction brackets the natural attitude to investigate noetic-noematic correlations"

Analytical tone (systematic, precise):
  "Husserl wanted to study how we think"
  → "Husserl systematically investigated the structures of consciousness"

Clarity (remove fluff):
  "One might consider that, given various considerations, X could be Y"
  → "X is Y" or "X seems to be Y"

=== TEXT TO TRANSFORM ===
{text}

=== TRANSFORMED TEXT ===
(Follow the directives above EXACTLY. No annotations, just the rewritten text):"""

        return prompt

    async def _call_llm_for_transformation(
        self,
        original_text: str,
        prompt: str,
        iteration: int,
        max_output_tokens: int = 4096,
    ) -> str:
        """
        Call LLM for text transformation using Ollama.

        Uses local Ollama model (mistral:7b or llama3.2) to transform text
        based on the generated prompt.

        Args:
            original_text: Original text
            prompt: Transformation prompt
            iteration: Current iteration number
            max_output_tokens: Maximum output tokens (tier-based)

        Returns:
            Transformed text
        """
        import httpx

        # Use Ollama API
        ollama_url = "http://localhost:11434/api/generate"

        # Choose model (prefer mistral:7b, fall back to llama3.2)
        model = "mistral:7b"  # Fast and good for transformations

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    ollama_url,
                    json={
                        "model": model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.7,
                            "num_predict": max_output_tokens,
                        },
                    },
                )

                if response.status_code == 200:
                    result = response.json()
                    transformed_text = result.get("response", "").strip()

                    # If empty, return original
                    if not transformed_text:
                        return original_text

                    return transformed_text
                else:
                    # Fallback on error
                    print(f"Ollama error: {response.status_code}")
                    return original_text

        except Exception as e:
            # Fallback on exception
            print(f"LLM call failed: {e}")
            return original_text

    async def compare_methods(
        self,
        text: str,
        povm_pack_name: str,
        target_stance: Dict[str, float],
        max_iterations: int = 5,
    ) -> Dict:
        """
        Run both TRM and LLM-only methods for comparison.

        Args:
            text: Text to transform
            povm_pack_name: POVM pack name
            target_stance: Target stance
            max_iterations: Max iterations for TRM

        Returns:
            dict with:
                - trm_result: TRM transformation result
                - llm_result: LLM-only result
                - comparison: Metrics comparing the two
        """
        # Run both methods
        trm_result = await self.transform_trm(
            text,
            povm_pack_name,
            target_stance,
            max_iterations,
        )

        llm_result = await self.transform_llm_only(text, target_stance)

        # Measure both results
        povm_pack = self.povm_packs[povm_pack_name]

        trm_embedding = self.embed_text(trm_result["text"])
        trm_rho = construct_density_matrix(trm_embedding, rank=self.rank)
        trm_readings = povm_pack.measure(trm_rho)

        llm_embedding = self.embed_text(llm_result["text"])
        llm_rho = construct_density_matrix(llm_embedding, rank=self.rank)
        llm_readings = povm_pack.measure(llm_rho)

        # Compute alignment with target
        trm_alignment = self._compute_alignment(trm_readings, target_stance)
        llm_alignment = self._compute_alignment(llm_readings, target_stance)

        return {
            "trm_result": {
                **trm_result,
                "final_readings": trm_readings,
                "alignment_with_target": trm_alignment,
            },
            "llm_result": {
                **llm_result,
                "final_readings": llm_readings,
                "alignment_with_target": llm_alignment,
            },
            "comparison": {
                "trm_alignment": trm_alignment,
                "llm_alignment": llm_alignment,
                "trm_better": trm_alignment > llm_alignment,
                "improvement": trm_alignment - llm_alignment,
            },
        }

    def _compute_alignment(
        self,
        readings: Dict[str, float],
        target: Dict[str, float],
    ) -> float:
        """
        Compute alignment between readings and target stance.

        Uses cosine similarity of probability vectors.

        Args:
            readings: Measured probabilities
            target: Target probabilities

        Returns:
            Alignment score in [-1, 1], higher is better
        """
        # Ensure same keys
        all_keys = set(readings.keys()) | set(target.keys())

        readings_vec = np.array([readings.get(k, 0) for k in sorted(all_keys)])
        target_vec = np.array([target.get(k, 0) for k in sorted(all_keys)])

        # Cosine similarity
        norm_r = np.linalg.norm(readings_vec)
        norm_t = np.linalg.norm(target_vec)

        if norm_r < 1e-10 or norm_t < 1e-10:
            return 0.0

        similarity = np.dot(readings_vec, target_vec) / (norm_r * norm_t)

        return float(similarity)

    async def save_transformation(
        self,
        db: AsyncSession,
        user_id: UUID,
        source_text: str,
        result_text: str,
        transformation_type: TransformationType,
        parameters: Dict,
        metrics: Dict,
        user_prompt: Optional[str] = None,
        source_message_uuid: Optional[UUID] = None,
    ) -> Transformation:
        """
        Save a transformation to the database.

        Args:
            db: Database session
            user_id: User ID
            source_text: Original text
            result_text: Transformed text
            transformation_type: Type of transformation
            parameters: Transformation parameters
            metrics: Transformation metrics
            user_prompt: Optional user description of transformation intent
            source_message_uuid: Optional UUID of source ChatGPT message

        Returns:
            Created Transformation record
        """
        transformation = Transformation(
            user_id=user_id,
            source_type='chatgpt_message' if source_message_uuid else 'custom',
            source_uuid=source_message_uuid,
            source_text=source_text,
            transformation_type=transformation_type.value,
            user_prompt=user_prompt,
            parameters=parameters,
            result_text=result_text,
            metrics=metrics,
        )

        db.add(transformation)
        await db.commit()
        await db.refresh(transformation)

        return transformation
