"""
Interest List Service

Manages user-created lists of things to explore - the mutable planning counterpart
to the immutable Interest activity log.

Operations:
- CRUD for lists
- Item management (add, remove, reorder)
- Navigation (forward, back, jump)
- Branching (create alternative paths)

Philosophy: "Make me smarter by helping me know my actual subjective self."

Lists are playlists for attention - user-controlled, reorderable, branchable.
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID, uuid4

from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.models.interest_list import InterestList, InterestListItem, InterestListBranch


class InterestListService:
    """Service for managing user-created interest lists."""

    # ========================================================================
    # List CRUD Operations
    # ========================================================================

    async def create_list(
        self,
        session: AsyncSession,
        user_id: UUID,
        name: str,
        description: Optional[str] = None,
        list_type: str = "custom",
        is_public: bool = False,
        custom_metadata: Optional[Dict] = None,
    ) -> InterestList:
        """
        Create a new interest list.

        Args:
            session: Database session
            user_id: User ID
            name: List name
            description: What is this list for?
            list_type: Category ('reading', 'research', 'media', 'transformation', 'custom')
            is_public: Can others see this list?
            custom_metadata: Additional metadata

        Returns:
            The newly created InterestList
        """
        interest_list = InterestList(
            id=uuid4(),
            user_id=user_id,
            name=name,
            description=description,
            list_type=list_type,
            status='active',
            custom_metadata=custom_metadata or {},
            current_position=0,
            is_public=is_public,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        session.add(interest_list)
        await session.commit()
        await session.refresh(interest_list)

        return interest_list

    async def get_list(
        self,
        session: AsyncSession,
        list_id: UUID,
        include_items: bool = True,
    ) -> Optional[InterestList]:
        """
        Get an interest list by ID.

        Args:
            session: Database session
            list_id: List ID
            include_items: Load items relationship?

        Returns:
            InterestList or None if not found
        """
        stmt = select(InterestList).where(InterestList.id == list_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_lists(
        self,
        session: AsyncSession,
        user_id: UUID,
        list_type: Optional[str] = None,
        status: Optional[str] = None,
        include_archived: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> List[InterestList]:
        """
        List interest lists for a user.

        Args:
            session: Database session
            user_id: User ID
            list_type: Filter by type
            status: Filter by status
            include_archived: Include archived lists?
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of InterestLists
        """
        stmt = select(InterestList).where(InterestList.user_id == user_id)

        if list_type:
            stmt = stmt.where(InterestList.list_type == list_type)

        if status:
            stmt = stmt.where(InterestList.status == status)

        if not include_archived:
            stmt = stmt.where(InterestList.status != 'archived')

        stmt = stmt.order_by(InterestList.updated_at.desc()).limit(limit).offset(offset)

        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def update_list(
        self,
        session: AsyncSession,
        list_id: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[str] = None,
        is_public: Optional[bool] = None,
        custom_metadata: Optional[Dict] = None,
    ) -> InterestList:
        """
        Update an interest list.

        Args:
            session: Database session
            list_id: List ID
            name: New name
            description: New description
            status: New status
            is_public: New public setting
            custom_metadata: New metadata

        Returns:
            Updated InterestList

        Raises:
            ValueError: If list not found
        """
        interest_list = await self.get_list(session, list_id)
        if not interest_list:
            raise ValueError(f"Interest list {list_id} not found")

        if name is not None:
            interest_list.name = name
        if description is not None:
            interest_list.description = description
        if status is not None:
            interest_list.status = status
            if status == 'completed':
                interest_list.completed_at = datetime.utcnow()
        if is_public is not None:
            interest_list.is_public = is_public
        if custom_metadata is not None:
            interest_list.custom_metadata = custom_metadata

        interest_list.updated_at = datetime.utcnow()

        await session.commit()
        await session.refresh(interest_list)

        return interest_list

    async def delete_list(
        self,
        session: AsyncSession,
        list_id: UUID,
    ) -> bool:
        """
        Delete an interest list (cascades to items and branches).

        Args:
            session: Database session
            list_id: List ID

        Returns:
            True if deleted, False if not found
        """
        interest_list = await self.get_list(session, list_id)
        if not interest_list:
            return False

        await session.delete(interest_list)
        await session.commit()

        return True

    # ========================================================================
    # Item Management
    # ========================================================================

    async def add_item(
        self,
        session: AsyncSession,
        list_id: UUID,
        user_id: UUID,
        item_type: str,
        item_uuid: Optional[UUID] = None,
        item_metadata: Optional[Dict] = None,
        notes: Optional[str] = None,
        position: Optional[int] = None,
        custom_metadata: Optional[Dict] = None,
    ) -> InterestListItem:
        """
        Add an item to an interest list.

        Args:
            session: Database session
            list_id: List ID
            user_id: User ID
            item_type: Type of object
            item_uuid: UUID of the object
            item_metadata: Cached metadata for display
            notes: User notes
            position: Position in list (default: end)
            custom_metadata: Additional metadata

        Returns:
            The newly created InterestListItem

        Raises:
            ValueError: If list not found
        """
        interest_list = await self.get_list(session, list_id)
        if not interest_list:
            raise ValueError(f"Interest list {list_id} not found")

        # Determine position
        if position is None:
            # Add to end - count existing items
            count_stmt = select(func.count()).where(InterestListItem.list_id == list_id)
            item_count = await session.scalar(count_stmt) or 0
            position = item_count
        else:
            # Shift existing items down
            update_stmt = (
                select(InterestListItem)
                .where(
                    and_(
                        InterestListItem.list_id == list_id,
                        InterestListItem.position >= position
                    )
                )
            )
            result = await session.execute(update_stmt)
            items_to_shift = result.scalars().all()
            for item in items_to_shift:
                item.position += 1

        list_item = InterestListItem(
            id=uuid4(),
            list_id=list_id,
            user_id=user_id,
            position=position,
            item_type=item_type,
            item_uuid=item_uuid,
            item_metadata=item_metadata or {},
            notes=notes,
            status='pending',
            added_at=datetime.utcnow(),
            custom_metadata=custom_metadata or {},
        )

        session.add(list_item)
        interest_list.updated_at = datetime.utcnow()

        await session.commit()
        await session.refresh(list_item)

        return list_item

    async def get_item(
        self,
        session: AsyncSession,
        item_id: UUID,
    ) -> Optional[InterestListItem]:
        """Get an interest list item by ID."""
        stmt = select(InterestListItem).where(InterestListItem.id == item_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_item(
        self,
        session: AsyncSession,
        item_id: UUID,
        notes: Optional[str] = None,
        status: Optional[str] = None,
        custom_metadata: Optional[Dict] = None,
    ) -> InterestListItem:
        """
        Update an interest list item.

        Args:
            session: Database session
            item_id: Item ID
            notes: New notes
            status: New status
            custom_metadata: New metadata

        Returns:
            Updated InterestListItem

        Raises:
            ValueError: If item not found
        """
        item = await self.get_item(session, item_id)
        if not item:
            raise ValueError(f"Interest list item {item_id} not found")

        if notes is not None:
            item.notes = notes
        if status is not None:
            item.status = status
            if status == 'completed':
                item.completed_at = datetime.utcnow()
        if custom_metadata is not None:
            item.custom_metadata = custom_metadata

        await session.commit()
        await session.refresh(item)

        return item

    async def remove_item(
        self,
        session: AsyncSession,
        item_id: UUID,
    ) -> bool:
        """
        Remove an item from an interest list.

        Args:
            session: Database session
            item_id: Item ID

        Returns:
            True if removed, False if not found
        """
        item = await self.get_item(session, item_id)
        if not item:
            return False

        # Get list to shift positions
        interest_list = await self.get_list(session, item.list_id)
        if interest_list:
            # Shift items up after removed item
            for list_item in interest_list.items:
                if list_item.position > item.position:
                    list_item.position -= 1

            interest_list.updated_at = datetime.utcnow()

        await session.delete(item)
        await session.commit()

        return True

    async def reorder_items(
        self,
        session: AsyncSession,
        list_id: UUID,
        item_positions: Dict[UUID, int],
    ) -> InterestList:
        """
        Reorder items in a list.

        Args:
            session: Database session
            list_id: List ID
            item_positions: Map of item_id to new position

        Returns:
            Updated InterestList

        Raises:
            ValueError: If list not found or invalid positions
        """
        interest_list = await self.get_list(session, list_id)
        if not interest_list:
            raise ValueError(f"Interest list {list_id} not found")

        # Validate positions
        positions = list(item_positions.values())
        if len(set(positions)) != len(positions):
            raise ValueError("Duplicate positions in reorder")

        if min(positions) < 0 or max(positions) >= len(interest_list.items):
            raise ValueError("Invalid position in reorder")

        # Update positions
        for item in interest_list.items:
            if item.id in item_positions:
                item.position = item_positions[item.id]

        interest_list.updated_at = datetime.utcnow()

        await session.commit()
        await session.refresh(interest_list)

        return interest_list

    # ========================================================================
    # Navigation
    # ========================================================================

    async def navigate(
        self,
        session: AsyncSession,
        list_id: UUID,
        direction: str,
        jump_to_position: Optional[int] = None,
    ) -> InterestList:
        """
        Navigate through a list.

        Args:
            session: Database session
            list_id: List ID
            direction: 'forward', 'back', or 'jump'
            jump_to_position: Position to jump to (if direction='jump')

        Returns:
            Updated InterestList

        Raises:
            ValueError: If list not found or invalid direction/position
        """
        interest_list = await self.get_list(session, list_id)
        if not interest_list:
            raise ValueError(f"Interest list {list_id} not found")

        # Get item count
        count_stmt = select(func.count()).where(InterestListItem.list_id == list_id)
        item_count = await session.scalar(count_stmt) or 0

        current_pos = interest_list.current_position
        new_pos = current_pos

        if direction == 'forward':
            new_pos = min(current_pos + 1, item_count - 1) if item_count > 0 else 0
        elif direction == 'back':
            new_pos = max(current_pos - 1, 0)
        elif direction == 'jump':
            if jump_to_position is None:
                raise ValueError("jump_to_position required for direction='jump'")
            if jump_to_position < 0 or jump_to_position >= item_count:
                raise ValueError(f"Invalid jump position: {jump_to_position}")
            new_pos = jump_to_position
        else:
            raise ValueError(f"Invalid direction: {direction}")

        interest_list.current_position = new_pos
        interest_list.updated_at = datetime.utcnow()

        await session.commit()
        await session.refresh(interest_list)

        return interest_list

    # ========================================================================
    # Branching
    # ========================================================================

    async def branch_list(
        self,
        session: AsyncSession,
        source_list_id: UUID,
        user_id: UUID,
        branch_name: str,
        branch_position: Optional[int] = None,
        branch_reason: Optional[str] = None,
        include_items: bool = True,
    ) -> InterestList:
        """
        Branch a list from a specific position.

        Creates a copy of the list, optionally with items,
        and records the branch relationship.

        Args:
            session: Database session
            source_list_id: Source list ID
            user_id: User ID
            branch_name: Name for the new branch
            branch_position: Position to branch from (default: current)
            branch_reason: Why are we branching?
            include_items: Copy items from source list?

        Returns:
            The newly created branched InterestList

        Raises:
            ValueError: If source list not found
        """
        source_list = await self.get_list(session, source_list_id)
        if not source_list:
            raise ValueError(f"Source list {source_list_id} not found")

        # Determine branch position
        if branch_position is None:
            branch_position = source_list.current_position

        # Create new list
        branch_list = InterestList(
            id=uuid4(),
            user_id=user_id,
            name=branch_name,
            description=f"Branched from: {source_list.name}",
            list_type=source_list.list_type,
            status='active',
            custom_metadata=source_list.custom_metadata.copy(),
            current_position=branch_position,
            is_public=source_list.is_public,
            parent_list_id=source_list_id,
            branched_at_position=branch_position,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        session.add(branch_list)

        # Copy items if requested
        if include_items:
            for source_item in source_list.items:
                new_item = InterestListItem(
                    id=uuid4(),
                    list_id=branch_list.id,
                    user_id=user_id,
                    position=source_item.position,
                    item_type=source_item.item_type,
                    item_uuid=source_item.item_uuid,
                    item_metadata=source_item.item_metadata.copy(),
                    notes=source_item.notes,
                    status='pending',  # Reset status
                    added_at=datetime.utcnow(),
                    custom_metadata=source_item.custom_metadata.copy(),
                )
                session.add(new_item)

        # Record branch relationship
        branch_record = InterestListBranch(
            id=uuid4(),
            user_id=user_id,
            source_list_id=source_list_id,
            branch_list_id=branch_list.id,
            branch_position=branch_position,
            branch_reason=branch_reason,
            created_at=datetime.utcnow(),
            custom_metadata={},
        )
        session.add(branch_record)

        await session.commit()
        await session.refresh(branch_list)

        return branch_list

    async def get_branches(
        self,
        session: AsyncSession,
        list_id: UUID,
    ) -> List[InterestListBranch]:
        """
        Get all branches from a list.

        Args:
            session: Database session
            list_id: Source list ID

        Returns:
            List of InterestListBranch objects
        """
        stmt = select(InterestListBranch).where(
            InterestListBranch.source_list_id == list_id
        ).order_by(InterestListBranch.created_at.desc())

        result = await session.execute(stmt)
        return list(result.scalars().all())
