"""
Interest Tracking Service

Tracks what the user+AI system finds interesting - the Turing tape of attention.

Philosophy: "Make me smarter by helping me know my actual subjective self."

This service manages:
- Creating new interests (mark something as interesting)
- Updating interests with discoveries (advantages, disadvantages)
- Resolving interests (did it pay off?)
- Analyzing patterns (what types of interests are valuable?)
- Pruning low-value interests (learning what not to attend to)
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID, uuid4

from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.models.interest import Interest, InterestTag


class InterestTrackingService:
    """Service for tracking attention flow and learning what we value."""

    async def mark_interesting(
        self,
        session: AsyncSession,
        user_id: UUID,
        interest_type: str,
        target_uuid: Optional[UUID] = None,
        moment_text: Optional[str] = None,
        salience_score: float = 0.5,
        target_metadata: Optional[Dict] = None,
        context: Optional[Dict] = None,
        predicted_value: Optional[float] = None,
        tags: Optional[List[str]] = None,
    ) -> Interest:
        """
        Mark something as interesting - creates a new moment (Now).

        If there's a current interest, automatically links it as previous.
        This builds the Turing tape: previous → new (current).

        Args:
            session: Database session
            user_id: User ID
            interest_type: Type of interest ('conversation', 'message', 'reading', etc.)
            target_uuid: UUID of the thing we're interested in (optional)
            moment_text: Why is this interesting?
            salience_score: How important does this seem? (0-1, default: 0.5)
            target_metadata: Metadata about the target (for quick access)
            context: What was going on when we got interested?
            predicted_value: How valuable do we think this will be? (0-1)
            tags: Tags for this interest

        Returns:
            The newly created Interest
        """
        # Get current interest (if any)
        current = await self.get_current_interest(session, user_id)

        # Create new interest
        interest = Interest(
            id=uuid4(),
            user_id=user_id,
            interest_type=interest_type,
            target_uuid=target_uuid,
            moment_text=moment_text,
            salience_score=salience_score,
            target_metadata=target_metadata or {},
            context_snapshot=context,
            predicted_value=predicted_value,
            previous_interest_id=current.id if current else None,
            created_at=datetime.utcnow(),
            explored_at=datetime.utcnow(),  # Start exploring immediately
        )

        session.add(interest)

        # Link as next on current
        if current:
            current.next_interest_id = interest.id

        # Add tags
        if tags:
            for tag_text in tags:
                tag = InterestTag(
                    id=uuid4(),
                    user_id=user_id,
                    interest_id=interest.id,
                    tag=tag_text.lower().strip(),
                    created_at=datetime.utcnow()
                )
                session.add(tag)

        await session.commit()

        # Eagerly load tags to avoid lazy-loading issues
        stmt = select(Interest).where(Interest.id == interest.id).options(selectinload(Interest.tags))
        result = await session.execute(stmt)
        interest = result.scalar_one()

        return interest

    async def get_interest(
        self,
        session: AsyncSession,
        interest_id: UUID
    ) -> Optional[Interest]:
        """Get interest by ID."""
        stmt = select(Interest).where(Interest.id == interest_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_current_interest(
        self,
        session: AsyncSession,
        user_id: UUID
    ) -> Optional[Interest]:
        """
        Get the current interest (the "Now" moment).

        Current = most recent interest that:
        - Has no next_interest_id (it's the end of the chain)
        - Is not pruned
        - Is not resolved (or was resolved recently)
        """
        stmt = select(Interest).where(
            Interest.user_id == user_id,
            Interest.next_interest_id.is_(None),
            Interest.pruned == False,
        ).order_by(Interest.created_at.desc())

        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_with_discoveries(
        self,
        session: AsyncSession,
        interest_id: UUID,
        advantages: Optional[List[str]] = None,
        disadvantages: Optional[List[str]] = None,
        realized_value: Optional[float] = None,
        value_notes: Optional[str] = None,
    ) -> Interest:
        """
        Update interest with what we learned.

        Called as we explore - not just at the end.
        Advantages and disadvantages accumulate over time.

        Args:
            session: Database session
            interest_id: Interest to update
            advantages: New advantages to add
            disadvantages: New disadvantages to add
            realized_value: Final value assessment (0-1)
            value_notes: Why was it valuable/not valuable?

        Returns:
            Updated Interest
        """
        interest = await self.get_interest(session, interest_id)
        if not interest:
            raise ValueError(f"Interest {interest_id} not found")

        # Accumulate advantages
        if advantages:
            current_advantages = interest.advantages or []
            interest.advantages = current_advantages + advantages

        # Accumulate disadvantages
        if disadvantages:
            current_disadvantages = interest.disadvantages or []
            interest.disadvantages = current_disadvantages + disadvantages

        # Update value assessment
        if realized_value is not None:
            interest.realized_value = realized_value
            interest.resolved_at = datetime.utcnow()

            # Calculate duration
            if interest.explored_at:
                duration = (interest.resolved_at - interest.explored_at).total_seconds()
                interest.duration_seconds = int(duration)

        if value_notes:
            interest.value_notes = value_notes

        await session.commit()
        await session.refresh(interest)

        return interest

    async def resolve_interest(
        self,
        session: AsyncSession,
        interest_id: UUID,
        realized_value: float,
        value_notes: Optional[str] = None,
        next_interest_id: Optional[UUID] = None,
    ) -> Interest:
        """
        Mark interest as resolved - we've learned its value.

        Args:
            session: Database session
            interest_id: Interest to resolve
            realized_value: Was it worth it? (0-1)
            value_notes: Why was it valuable/not valuable?
            next_interest_id: What are we moving to next? (optional)

        Returns:
            Resolved Interest
        """
        interest = await self.update_with_discoveries(
            session=session,
            interest_id=interest_id,
            realized_value=realized_value,
            value_notes=value_notes,
        )

        if next_interest_id:
            interest.next_interest_id = next_interest_id

        await session.commit()
        await session.refresh(interest)

        return interest

    async def get_trajectory(
        self,
        session: AsyncSession,
        user_id: UUID,
        max_depth: int = 50,
        include_pruned: bool = False,
    ) -> List[Interest]:
        """
        Get the attention trajectory (Turing tape).

        Returns the chain: [past, past, past, Now, predicted_next]

        Args:
            session: Database session
            user_id: User ID
            max_depth: Maximum number of past interests to retrieve
            include_pruned: Include pruned interests?

        Returns:
            List of interests in chronological order
        """
        current = await self.get_current_interest(session, user_id)
        if not current:
            return []

        trajectory = [current]

        # Walk backwards
        prev = current
        depth = 0
        while prev.previous_interest_id and depth < max_depth:
            stmt = select(Interest).where(Interest.id == prev.previous_interest_id)
            result = await session.execute(stmt)
            prev = result.scalar_one_or_none()

            if not prev:
                break

            if not include_pruned and prev.pruned:
                break

            trajectory.insert(0, prev)
            depth += 1

        # Walk forwards (if we've marked next)
        next_interest = current
        while next_interest.next_interest_id:
            stmt = select(Interest).where(Interest.id == next_interest.next_interest_id)
            result = await session.execute(stmt)
            next_interest = result.scalar_one_or_none()

            if not next_interest:
                break

            if not include_pruned and next_interest.pruned:
                break

            trajectory.append(next_interest)

        return trajectory

    async def list_interests(
        self,
        session: AsyncSession,
        user_id: UUID,
        interest_type: Optional[str] = None,
        include_pruned: bool = False,
        min_realized_value: Optional[float] = None,
        tags: Optional[List[str]] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Interest]:
        """
        List interests with filtering.

        Args:
            session: Database session
            user_id: User ID
            interest_type: Filter by type
            include_pruned: Include pruned interests?
            min_realized_value: Minimum realized value
            tags: Filter by tags
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of interests
        """
        stmt = select(Interest).where(Interest.user_id == user_id)

        if interest_type:
            stmt = stmt.where(Interest.interest_type == interest_type)

        if not include_pruned:
            stmt = stmt.where(Interest.pruned == False)

        if min_realized_value is not None:
            stmt = stmt.where(Interest.realized_value >= min_realized_value)

        if tags:
            # Join with InterestTag
            stmt = stmt.join(InterestTag).where(
                InterestTag.tag.in_([t.lower() for t in tags])
            )

        stmt = stmt.order_by(Interest.created_at.desc()).limit(limit).offset(offset)

        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def prune_interest(
        self,
        session: AsyncSession,
        interest_id: UUID,
        prune_reason: str,
    ) -> Interest:
        """
        Prune interest - mark it as not valuable to track.

        This is how we learn what NOT to attend to.

        Args:
            session: Database session
            interest_id: Interest to prune
            prune_reason: Why are we pruning this?

        Returns:
            Pruned Interest
        """
        interest = await self.get_interest(session, interest_id)
        if not interest:
            raise ValueError(f"Interest {interest_id} not found")

        interest.pruned = True
        interest.prune_reason = prune_reason
        interest.pruned_at = datetime.utcnow()

        await session.commit()
        await session.refresh(interest)

        return interest

    async def get_insights(
        self,
        session: AsyncSession,
        user_id: UUID,
    ) -> Dict:
        """
        Get learning insights from interest history.

        Analyzes patterns:
        - Which types of interests have highest realized value?
        - Which lead to dead ends (low value, high cost)?
        - Average time spent on each type
        - Most common trajectories (interest A → interest B)
        - Prune recommendations

        Args:
            session: Database session
            user_id: User ID

        Returns:
            Dictionary of insights
        """
        # Get all non-pruned interests
        stmt = select(Interest).where(
            Interest.user_id == user_id,
            Interest.pruned == False,
        )
        result = await session.execute(stmt)
        interests = list(result.scalars().all())

        if not interests:
            return {
                "total_interests": 0,
                "message": "No interests tracked yet"
            }

        # Group by type
        by_type = {}
        for interest in interests:
            itype = interest.interest_type
            if itype not in by_type:
                by_type[itype] = {
                    "count": 0,
                    "total_value": 0.0,
                    "resolved_count": 0,
                    "total_duration": 0,
                    "avg_value": None,
                    "avg_duration": None,
                }

            stats = by_type[itype]
            stats["count"] += 1

            if interest.realized_value is not None:
                stats["total_value"] += interest.realized_value
                stats["resolved_count"] += 1

            if interest.duration_seconds is not None:
                stats["total_duration"] += interest.duration_seconds

        # Compute averages
        for itype, stats in by_type.items():
            if stats["resolved_count"] > 0:
                stats["avg_value"] = stats["total_value"] / stats["resolved_count"]

            if stats["count"] > 0:
                stats["avg_duration"] = stats["total_duration"] / stats["count"]

        # Overall stats
        resolved_interests = [i for i in interests if i.realized_value is not None]
        total_resolved = len(resolved_interests)
        avg_value = sum(i.realized_value for i in resolved_interests) / total_resolved if total_resolved > 0 else None

        # Find best and worst types
        sorted_by_value = sorted(
            [(t, s["avg_value"]) for t, s in by_type.items() if s["avg_value"] is not None],
            key=lambda x: x[1],
            reverse=True
        )

        best_types = sorted_by_value[:3] if sorted_by_value else []
        worst_types = sorted_by_value[-3:] if sorted_by_value else []

        return {
            "total_interests": len(interests),
            "total_resolved": total_resolved,
            "avg_realized_value": avg_value,
            "by_type": by_type,
            "best_interest_types": [{"type": t, "avg_value": v} for t, v in best_types],
            "worst_interest_types": [{"type": t, "avg_value": v} for t, v in worst_types],
        }

    async def add_tags(
        self,
        session: AsyncSession,
        interest_id: UUID,
        user_id: UUID,
        tags: List[str],
    ) -> List[InterestTag]:
        """
        Add tags to an interest.

        Args:
            session: Database session
            interest_id: Interest to tag
            user_id: User ID
            tags: List of tag strings

        Returns:
            List of created InterestTag objects
        """
        created_tags = []

        for tag_text in tags:
            # Check if tag already exists
            normalized_tag = tag_text.lower().strip()

            stmt = select(InterestTag).where(
                InterestTag.interest_id == interest_id,
                InterestTag.tag == normalized_tag
            )
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                continue

            # Create new tag
            tag = InterestTag(
                id=uuid4(),
                user_id=user_id,
                interest_id=interest_id,
                tag=normalized_tag,
                created_at=datetime.utcnow()
            )
            session.add(tag)
            created_tags.append(tag)

        if created_tags:
            await session.commit()
            for tag in created_tags:
                await session.refresh(tag)

        return created_tags

    async def search_interests(
        self,
        session: AsyncSession,
        user_id: UUID,
        query: str,
        limit: int = 50,
    ) -> List[Interest]:
        """
        Search interests by text (moment_text, value_notes, or target_metadata).

        Args:
            session: Database session
            user_id: User ID
            query: Search query
            limit: Maximum results

        Returns:
            List of matching interests
        """
        stmt = select(Interest).where(
            Interest.user_id == user_id,
            or_(
                Interest.moment_text.ilike(f"%{query}%"),
                Interest.value_notes.ilike(f"%{query}%"),
            )
        ).order_by(Interest.created_at.desc()).limit(limit)

        result = await session.execute(stmt)
        return list(result.scalars().all())
