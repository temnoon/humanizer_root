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
from humanizer.ml.density import construct_density_matrix, rho_distance, DensityMatrix
from humanizer.ml.povm import get_all_packs, POVMPack

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
        # Step 1: Embed text
        # TODO: Use actual sentence-transformers model
        # For now, simulate embedding
        embedding = self._simulate_embedding(request.text)

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

        # Step 2: Run TRM iteration (simulate for now)
        # TODO: Implement actual TRM model
        y_text_new, dy_summary, corner_views = self._simulate_trm_step(
            latest_step.y_text,
            latest_step.rho_eigensystem
        )

        # Step 3: Construct new ρ
        embedding_new = self._simulate_embedding(y_text_new)
        rho_new = construct_density_matrix(embedding_new, rank=self.rank)

        # Compute ρ distance
        embedding_old = self._simulate_embedding(latest_step.y_text)
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
        # (For now, re-embed and construct)
        embedding = self._simulate_embedding(latest_step.y_text)
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
        # (Re-measure with new ρ)
        embedding_new = self._simulate_embedding(applied_text)
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
            # Reconstruct ρ for distance calculation
            emb_prev = self._simulate_embedding(steps[i-1].y_text)
            emb_curr = self._simulate_embedding(steps[i].y_text)
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

    def _simulate_embedding(self, text: str) -> np.ndarray:
        """
        Simulate sentence embedding.

        TODO: Replace with actual sentence-transformers model.

        Args:
            text: Text to embed

        Returns:
            384-dim embedding vector
        """
        # Hash text to seed for consistency
        seed = hash(text) % (2**32)
        np.random.seed(seed)
        embedding = np.random.randn(384).astype(np.float64)
        embedding /= np.linalg.norm(embedding)
        return embedding

    def _simulate_trm_step(
        self,
        y_text: str,
        rho_meta: dict,
    ) -> tuple[str, str, dict]:
        """
        Simulate TRM iteration.

        TODO: Replace with actual TRM model.

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
        summary = f"Refined word {len(words) // 2}"

        # Generate corner views (simple variations)
        corner_views = {
            "A": f"Affirming: {new_text}",
            "¬A": f"Negating: {new_text}",
            "both": f"Paradoxical: {new_text}",
            "neither": f"Transcendent: {new_text}",
        }

        return new_text, summary, corner_views
