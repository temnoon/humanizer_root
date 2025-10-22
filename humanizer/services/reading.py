"""
Reading Service - Orchestrates quantum reading sessions

This service coordinates:
- TRM core (density matrices, POVMs, verification)
- Database persistence (ReadingSession, ReadingStep)
- Embedding models (sentence-transformers)

Business logic for the reading API endpoints.
"""

from typing import Dict, List, Optional
from uuid import UUID
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# TRM core
from humanizer.core.trm.density import construct_density_matrix, rho_distance, DensityMatrix
from humanizer.core.trm.povm import get_all_packs, POVMPack
from humanizer.core.trm.transformer import StatelessTransformer, TransformOptions

# Embedding service (for backward compatibility)
from humanizer.services.sentence_embedding import get_sentence_embedding_service

# Config
from humanizer.config import settings

# Database models
from humanizer.models.reading import ReadingSession, ReadingStep, ReadingProvenance
from humanizer.models.schemas import (
    ReadingStartRequest,
    ReadingStartResponse,
    ReadingStepRequest,
    ReadingStepResponse,
    ReadingMeasureRequest,
    ReadingMeasureResponse,
    ReadingApplyRequest,
    ReadingApplyResponse,
    ReadingTraceResponse,
)


class ReadingService:
    """
    Service for quantum reading sessions.

    Handles the full lifecycle:
    1. Start: Construct initial ρ, measure with POVMs
    2. Step: Iterate TRM, refine understanding
    3. Measure: Apply additional POVM packs
    4. Apply: Accept corner view transformations
    5. Trace: Return full trajectory
    """

    def __init__(self, rank: int = 64):
        """
        Initialize reading service.

        Args:
            rank: Dimension for density matrices (default 64)
        """
        self.rank = rank
        self.povm_packs = get_all_packs(rank=rank)
        self.embedding_service = get_sentence_embedding_service()

        # Initialize StatelessTransformer with injected functions (Phase 2)
        # Import locally to avoid circular imports
        try:
            from humanizer.core.embeddings import get_embedding_function
            from humanizer.core.llm import get_llm_function

            embed_fn = get_embedding_function()
            llm_fn = get_llm_function(settings)
            self.transformer = StatelessTransformer(
                embed_fn=embed_fn,
                llm_fn=llm_fn,
                rank=rank
            )
            self._transformer_available = True
        except Exception as e:
            # Fallback if transformer unavailable (e.g., Ollama not running)
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"StatelessTransformer not available: {e}")
            logger.warning("Will use stub transformation instead")
            self.transformer = None
            self._transformer_available = False

    async def start(
        self,
        session: AsyncSession,
        request: ReadingStartRequest,
        user_id: UUID,
    ) -> ReadingStartResponse:
        """
        Start a new reading session.

        Process:
        1. Embed text (for now, simulate embedding)
        2. Construct ρ
        3. Measure with specified POVM packs
        4. Save to database
        5. Return initial state

        Args:
            session: Database session
            request: Start request with text and config
            user_id: User ID

        Returns:
            ReadingStartResponse with initial state
        """
        # Step 1: Embed text (using real sentence-transformers)
        embedding = self.embedding_service.embed_text(request.text)

        # Step 2: Construct ρ
        rho = construct_density_matrix(embedding, rank=request.trm_rank or self.rank)

        # Step 3: Measure with POVMs
        povm_readings = {}
        for pack_name in request.povm_packs or ["tetralemma"]:
            if pack_name in self.povm_packs:
                pack = self.povm_packs[pack_name]
                readings = pack.measure(rho)
                povm_readings[pack_name] = readings

        # Extract stance (tetralemma)
        stance = povm_readings.get("tetralemma", None)

        # Initial halt probability (low at start)
        halt_p = 0.1

        # Step 4: Save to database
        db_session = ReadingSession(
            user_id=user_id,
            original_text=request.text,
            status="active",
            config={
                "povm_packs": request.povm_packs,
                "trm_rank": request.trm_rank or self.rank,
            },
        )
        session.add(db_session)
        await session.flush()  # Get ID

        # Save initial step
        db_step = ReadingStep(
            session_id=db_session.id,
            step_number=0,
            y_text=request.text,  # Initial text unchanged
            z_state=None,  # No latent state yet (TRM not run)
            rho_eigensystem=rho.to_dict(),
            halt_p=halt_p,
            povm_readings=povm_readings,
            stance=stance,
        )
        session.add(db_step)
        await session.commit()

        # Step 5: Return response
        return ReadingStartResponse(
            reading_id=db_session.id,
            step=0,
            y_text=request.text,
            rho_meta=rho.to_dict(),
            povm_readings=povm_readings,
            stance=stance,
            halt_p=halt_p,
        )

    async def step(
        self,
        session: AsyncSession,
        request: ReadingStepRequest,
    ) -> ReadingStepResponse:
        """
        Execute one TRM iteration step.

        Process:
        1. Load current reading state
        2. Run TRM iteration (for now, simulate)
        3. Construct new ρ
        4. Re-measure POVMs
        5. Generate corner views (optional)
        6. Compute halt probability
        7. Save new step
        8. Return response

        Args:
            session: Database session
            request: Step request with reading_id

        Returns:
            ReadingStepResponse with new state

        Raises:
            ValueError: If reading not found or already completed
        """
        # Step 1: Load reading session
        stmt = select(ReadingSession).where(ReadingSession.id == request.reading_id)
        result = await session.execute(stmt)
        db_session = result.scalar_one_or_none()

        if db_session is None:
            raise ValueError(f"Reading {request.reading_id} not found")

        if db_session.status != "active":
            raise ValueError(f"Reading {request.reading_id} is {db_session.status}, cannot step")

        # Get latest step
        stmt = (
            select(ReadingStep)
            .where(ReadingStep.session_id == request.reading_id)
            .order_by(ReadingStep.step_number.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        latest_step = result.scalar_one()

        # Step 2: Run TRM iteration (using StatelessTransformer - Phase 2)
        y_text_new, dy_summary, corner_views = await self._execute_trm_step(
            latest_step.y_text,
            latest_step.rho_eigensystem
        )

        # Step 3: Construct new ρ (using real embeddings)
        embedding_new = self.embedding_service.embed_text(y_text_new)
        rho_new = construct_density_matrix(embedding_new, rank=self.rank)

        # Compute ρ distance
        embedding_old = self.embedding_service.embed_text(latest_step.y_text)
        rho_old = construct_density_matrix(embedding_old, rank=self.rank)
        rho_delta = rho_distance(rho_old, rho_new)

        # Step 4: Re-measure POVMs
        povm_packs = db_session.config.get("povm_packs", ["tetralemma"])
        povm_readings = {}
        for pack_name in povm_packs:
            if pack_name in self.povm_packs:
                pack = self.povm_packs[pack_name]
                readings = pack.measure(rho_new)
                povm_readings[pack_name] = readings

        stance = povm_readings.get("tetralemma", None)

        # Step 6: Compute halt probability
        # Increases as ρ stops changing
        halt_p = min(0.1 + (latest_step.step_number + 1) * 0.1 + rho_delta * 0.5, 0.95)

        # Step 7: Save new step
        new_step_number = latest_step.step_number + 1
        db_step = ReadingStep(
            session_id=db_session.id,
            step_number=new_step_number,
            y_text=y_text_new,
            z_state=None,  # TODO: Store actual TRM latent state
            rho_eigensystem=rho_new.to_dict(),
            halt_p=halt_p,
            povm_readings=povm_readings,
            stance=stance,
            corner_views=corner_views,
        )
        session.add(db_step)

        # Update session status if halting
        if halt_p > 0.8:
            db_session.status = "completed"

        await session.commit()

        # Step 8: Return response
        return ReadingStepResponse(
            reading_id=db_session.id,
            step=new_step_number,
            y_text=y_text_new,
            dy_summary=dy_summary,
            rho_delta=float(rho_delta),
            povm_readings=povm_readings,
            corner_views=corner_views,
            halt_p=halt_p,
        )

    async def measure(
        self,
        session: AsyncSession,
        request: ReadingMeasureRequest,
    ) -> ReadingMeasureResponse:
        """
        Measure current state with additional POVM pack.

        Args:
            session: Database session
            request: Measure request with reading_id and povm_pack

        Returns:
            ReadingMeasureResponse with readings
        """
        # Load latest step
        stmt = (
            select(ReadingStep)
            .where(ReadingStep.session_id == request.reading_id)
            .order_by(ReadingStep.step_number.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        latest_step = result.scalar_one_or_none()

        if latest_step is None:
            raise ValueError(f"Reading {request.reading_id} not found")

        # Reconstruct ρ from stored eigensystem
        # (Re-embed and construct with real embeddings)
        embedding = self.embedding_service.embed_text(latest_step.y_text)
        rho = construct_density_matrix(embedding, rank=self.rank)

        # Measure with requested pack
        if request.povm_pack not in self.povm_packs:
            available = list(self.povm_packs.keys())
            raise ValueError(f"Unknown POVM pack: {request.povm_pack}. Available: {available}")

        pack = self.povm_packs[request.povm_pack]
        readings = pack.measure(rho)

        return ReadingMeasureResponse(
            reading_id=request.reading_id,
            step=latest_step.step_number,
            povm_pack=request.povm_pack,
            readings=readings,
        )

    async def apply(
        self,
        session: AsyncSession,
        request: ReadingApplyRequest,
    ) -> ReadingApplyResponse:
        """
        Apply a corner view transformation.

        Process:
        1. Load latest step
        2. Get corner view text
        3. Create new step with applied text
        4. Record provenance

        Args:
            session: Database session
            request: Apply request with reading_id and corner

        Returns:
            ReadingApplyResponse with updated text
        """
        # Load session and latest step
        stmt = select(ReadingSession).where(ReadingSession.id == request.reading_id)
        result = await session.execute(stmt)
        db_session = result.scalar_one_or_none()

        if db_session is None:
            raise ValueError(f"Reading {request.reading_id} not found")

        stmt = (
            select(ReadingStep)
            .where(ReadingStep.session_id == request.reading_id)
            .order_by(ReadingStep.step_number.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        latest_step = result.scalar_one()

        # Get corner view
        if latest_step.corner_views is None:
            raise ValueError("No corner views available for this step")

        if request.corner not in latest_step.corner_views:
            available = list(latest_step.corner_views.keys())
            raise ValueError(f"Corner '{request.corner}' not found. Available: {available}")

        applied_text = latest_step.corner_views[request.corner]

        # Create new step with applied text
        # (Re-measure with new ρ using real embeddings)
        embedding_new = self.embedding_service.embed_text(applied_text)
        rho_new = construct_density_matrix(embedding_new, rank=self.rank)

        povm_packs = db_session.config.get("povm_packs", ["tetralemma"])
        povm_readings = {}
        for pack_name in povm_packs:
            if pack_name in self.povm_packs:
                pack = self.povm_packs[pack_name]
                readings = pack.measure(rho_new)
                povm_readings[pack_name] = readings

        new_step_number = latest_step.step_number + 1
        db_step = ReadingStep(
            session_id=db_session.id,
            step_number=new_step_number,
            y_text=applied_text,
            z_state=None,
            rho_eigensystem=rho_new.to_dict(),
            halt_p=latest_step.halt_p,  # Inherit halt probability
            povm_readings=povm_readings,
            stance=povm_readings.get("tetralemma"),
        )
        session.add(db_step)

        # Record provenance
        provenance = ReadingProvenance(
            session_id=db_session.id,
            step_number=new_step_number,
            action="apply_corner",
            patch={"corner": request.corner, "from_step": latest_step.step_number},
        )
        session.add(provenance)

        await session.commit()

        return ReadingApplyResponse(
            reading_id=db_session.id,
            step=new_step_number,
            y_text=applied_text,
            provenance={
                "action": "apply_corner",
                "corner": request.corner,
                "applied_at": provenance.applied_at.isoformat(),
            },
        )

    async def trace(
        self,
        session: AsyncSession,
        reading_id: UUID,
    ) -> ReadingTraceResponse:
        """
        Get full reading trajectory.

        Returns all steps with metrics.

        Args:
            session: Database session
            reading_id: Reading session ID

        Returns:
            ReadingTraceResponse with full trajectory
        """
        # Load session
        stmt = select(ReadingSession).where(ReadingSession.id == reading_id)
        result = await session.execute(stmt)
        db_session = result.scalar_one_or_none()

        if db_session is None:
            raise ValueError(f"Reading {reading_id} not found")

        # Load all steps
        stmt = (
            select(ReadingStep)
            .where(ReadingStep.session_id == reading_id)
            .order_by(ReadingStep.step_number)
        )
        result = await session.execute(stmt)
        steps = result.scalars().all()

        # Format steps
        steps_data = [
            {
                "step": step.step_number,
                "y_text": step.y_text,
                "povm_readings": step.povm_readings,
                "stance": step.stance,
                "halt_p": step.halt_p,
                "rho_meta": step.rho_eigensystem,
            }
            for step in steps
        ]

        # Compute metrics
        rho_distances = []
        halt_curve = [step.halt_p for step in steps]

        for i in range(1, len(steps)):
            # Reconstruct ρ for distance calculation (using real embeddings)
            emb_prev = self.embedding_service.embed_text(steps[i-1].y_text)
            emb_curr = self.embedding_service.embed_text(steps[i].y_text)
            rho_prev = construct_density_matrix(emb_prev, rank=self.rank)
            rho_curr = construct_density_matrix(emb_curr, rank=self.rank)
            dist = rho_distance(rho_prev, rho_curr)
            rho_distances.append(float(dist))

        return ReadingTraceResponse(
            reading_id=db_session.id,
            original_text=db_session.original_text,
            steps=steps_data,
            metrics={
                "rho_distances": rho_distances,
                "halt_curve": halt_curve,
            },
        )

    # ========================================
    # Helper methods
    # ========================================

    async def _execute_trm_step(
        self,
        y_text: str,
        rho_meta: dict,
    ) -> tuple[str, str, dict]:
        """
        Execute TRM iteration using StatelessTransformer (Phase 2).

        This replaces the previous _simulate_trm_step stub with real
        recursive TRM iteration guided by POVM measurements.

        Process:
        1. Determine target stance from current POVM measurements
        2. Use StatelessTransformer to transform text toward target
        3. Extract final transformed text and iteration details
        4. Generate corner views (tetralemma perspectives)

        Args:
            y_text: Current text
            rho_meta: Density matrix metadata

        Returns:
            Tuple of (new_text, summary, corner_views)
        """
        # Use real transformer if available
        if self._transformer_available and self.transformer is not None:
            import logging
            logger = logging.getLogger(__name__)

            try:
                # Determine target stance (for now, use "analytical" tone as default)
                # TODO: Make this configurable or infer from context
                target_stance = {
                    "tone": "analytical"  # Could also try: empathic, critical, playful
                }

                # Configure transformation
                options = TransformOptions(
                    max_iterations=3,  # Keep it fast for now
                    convergence_threshold=0.65,
                    povm_packs=["tone"],  # Focus on tone for Phase 2A
                    temperature=0.7
                )

                # Execute transformation
                result = await self.transformer.transform(
                    text=y_text,
                    target_stance=target_stance,
                    options=options
                )

                # Extract transformed text
                new_text = result.final_text

                # Create summary
                if result.converged:
                    summary = f"Converged to {target_stance} in {result.total_iterations} iterations"
                else:
                    summary = f"Partial transformation ({result.total_iterations} iterations, no convergence)"

                # Generate corner views (tetralemma perspectives)
                # For Phase 2A, create simple variations
                corner_views = {
                    "A": f"Affirming perspective: {new_text}",
                    "¬A": f"Negating perspective: {new_text}",
                    "both": f"Paradoxical view: {new_text}",
                    "neither": f"Transcendent view: {new_text}",
                }

                logger.info(
                    f"TRM transformation: {result.total_iterations} iterations, "
                    f"converged={result.converged}, target={target_stance}"
                )

                return new_text, summary, corner_views

            except Exception as e:
                # Fallback to stub if transformation fails
                logger.error(f"TRM transformation failed: {e}", exc_info=True)
                logger.warning("Falling back to stub transformation")
                return self._stub_trm_step(y_text, rho_meta)

        else:
            # Transformer not available, use stub
            return self._stub_trm_step(y_text, rho_meta)

    def _stub_trm_step(
        self,
        y_text: str,
        rho_meta: dict,
    ) -> tuple[str, str, dict]:
        """
        Stub transformation (fallback when StatelessTransformer unavailable).

        Args:
            y_text: Current text
            rho_meta: Density matrix metadata

        Returns:
            Tuple of (new_text, summary, corner_views)
        """
        # Simple simulation: slight variation
        words = y_text.split()
        if len(words) > 3:
            # Replace one word
            words[len(words) // 2] = words[len(words) // 2].upper()

        new_text = " ".join(words)
        summary = f"Stub: Modified word {len(words) // 2}"

        # Generate corner views (simple variations)
        corner_views = {
            "A": f"Affirming: {new_text}",
            "¬A": f"Negating: {new_text}",
            "both": f"Paradoxical: {new_text}",
            "neither": f"Transcendent: {new_text}",
        }

        return new_text, summary, corner_views
