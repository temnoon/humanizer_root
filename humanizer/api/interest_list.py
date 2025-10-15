"""
Interest List API routes

Endpoints for managing user-created lists of things to explore.

Philosophy: "Make me smarter by helping me know my actual subjective self."

Lists are playlists for attention - user-controlled, reorderable, branchable.

Endpoints:
- POST /interest-lists - Create a new list
- GET /interest-lists - List all lists for user
- GET /interest-lists/{list_id} - Get specific list
- PATCH /interest-lists/{list_id} - Update list
- DELETE /interest-lists/{list_id} - Delete list
- POST /interest-lists/{list_id}/items - Add item to list
- PATCH /interest-lists/{list_id}/items/{item_id} - Update item
- DELETE /interest-lists/{list_id}/items/{item_id} - Remove item
- POST /interest-lists/{list_id}/reorder - Reorder items
- POST /interest-lists/{list_id}/navigate - Navigate through list
- POST /interest-lists/{list_id}/branch - Branch list
- GET /interest-lists/{list_id}/branches - Get branches
"""

from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.database import get_session
from humanizer.services.interest_list import InterestListService
from humanizer.models.schemas import (
    InterestListResponse,
    InterestListItemResponse,
    CreateInterestListRequest,
    UpdateInterestListRequest,
    AddItemToListRequest,
    UpdateListItemRequest,
    ReorderListItemsRequest,
    NavigateListRequest,
    BranchListRequest,
    InterestListBranchResponse,
    PaginatedInterestListsResponse,
)

router = APIRouter(prefix="/api/interest-lists", tags=["interest-lists"])


# Helper to get user ID (for now, use a default user)
# In production, this would come from authentication
def get_user_id() -> UUID:
    """Get current user ID. For now, returns a default user."""
    # In production, get from auth token
    # For now, use a consistent default
    return UUID("00000000-0000-0000-0000-000000000001")


def to_list_response(interest_list) -> InterestListResponse:
    """
    Convert InterestList ORM model to response schema.

    Avoids lazy-loading issues by manually constructing response.
    """
    # Get items if loaded, otherwise empty list
    items = []
    if hasattr(interest_list, '__dict__') and 'items' in interest_list.__dict__:
        items = [
            InterestListItemResponse(
                id=item.id,
                list_id=item.list_id,
                user_id=item.user_id,
                position=item.position,
                item_type=item.item_type,
                item_uuid=item.item_uuid,
                item_metadata=item.item_metadata,
                notes=item.notes,
                status=item.status,
                completed_at=item.completed_at,
                added_at=item.added_at,
                custom_metadata=item.custom_metadata,
            )
            for item in interest_list.items
        ]

    # Calculate progress
    progress_pct = 0.0
    if len(items) > 0:
        progress_pct = (interest_list.current_position / len(items)) * 100.0

    return InterestListResponse(
        id=interest_list.id,
        user_id=interest_list.user_id,
        name=interest_list.name,
        description=interest_list.description,
        list_type=interest_list.list_type,
        status=interest_list.status,
        custom_metadata=interest_list.custom_metadata,
        current_position=interest_list.current_position,
        created_at=interest_list.created_at,
        updated_at=interest_list.updated_at,
        completed_at=interest_list.completed_at,
        is_public=interest_list.is_public,
        parent_list_id=interest_list.parent_list_id,
        branched_at_position=interest_list.branched_at_position,
        items=items,
        progress_pct=progress_pct,
    )


# ============================================================================
# List CRUD Operations
# ============================================================================

@router.post("", response_model=InterestListResponse, status_code=status.HTTP_201_CREATED)
async def create_list(
    request: CreateInterestListRequest,
    session: AsyncSession = Depends(get_session),
    user_id: UUID = Depends(get_user_id),
):
    """
    Create a new interest list.

    Args:
        request: List details
        session: Database session
        user_id: Current user

    Returns:
        The newly created InterestList
    """
    service = InterestListService()

    try:
        interest_list = await service.create_list(
            session=session,
            user_id=user_id,
            name=request.name,
            description=request.description,
            list_type=request.list_type,
            is_public=request.is_public,
            custom_metadata=request.custom_metadata,
        )

        return to_list_response(interest_list)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create interest list: {str(e)}"
        )


@router.get("", response_model=PaginatedInterestListsResponse)
async def list_lists(
    list_type: Optional[str] = Query(None, description="Filter by list type"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    include_archived: bool = Query(False, description="Include archived lists?"),
    limit: int = Query(50, ge=1, le=200, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    session: AsyncSession = Depends(get_session),
    user_id: UUID = Depends(get_user_id),
):
    """
    List interest lists for the current user.

    Args:
        list_type: Filter by type
        status_filter: Filter by status
        include_archived: Include archived lists?
        limit: Maximum results
        offset: Pagination offset
        session: Database session
        user_id: Current user

    Returns:
        Paginated list of InterestLists
    """
    service = InterestListService()

    lists = await service.list_lists(
        session=session,
        user_id=user_id,
        list_type=list_type,
        status=status_filter,
        include_archived=include_archived,
        limit=limit,
        offset=offset,
    )

    # Convert to response models
    list_responses = [to_list_response(lst) for lst in lists]

    return PaginatedInterestListsResponse(
        lists=list_responses,
        total=len(lists),
        page=offset // limit + 1,
        page_size=limit
    )


@router.get("/{list_id}", response_model=InterestListResponse)
async def get_list(
    list_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get a specific interest list by ID.

    Args:
        list_id: List ID
        session: Database session

    Returns:
        InterestList details
    """
    service = InterestListService()

    interest_list = await service.get_list(session, list_id)

    if not interest_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interest list {list_id} not found"
        )

    return to_list_response(interest_list)


@router.patch("/{list_id}", response_model=InterestListResponse)
async def update_list(
    list_id: UUID,
    request: UpdateInterestListRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Update an interest list.

    Args:
        list_id: List ID
        request: Update details
        session: Database session

    Returns:
        Updated InterestList
    """
    service = InterestListService()

    try:
        interest_list = await service.update_list(
            session=session,
            list_id=list_id,
            name=request.name,
            description=request.description,
            status=request.status,
            is_public=request.is_public,
            custom_metadata=request.custom_metadata,
        )

        return to_list_response(interest_list)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update interest list: {str(e)}"
        )


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_list(
    list_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Delete an interest list (cascades to items and branches).

    Args:
        list_id: List ID
        session: Database session

    Returns:
        204 No Content on success
    """
    service = InterestListService()

    deleted = await service.delete_list(session, list_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interest list {list_id} not found"
        )


# ============================================================================
# Item Management
# ============================================================================

@router.post("/{list_id}/items", response_model=InterestListItemResponse, status_code=status.HTTP_201_CREATED)
async def add_item(
    list_id: UUID,
    request: AddItemToListRequest,
    session: AsyncSession = Depends(get_session),
    user_id: UUID = Depends(get_user_id),
):
    """
    Add an item to an interest list.

    Args:
        list_id: List ID
        request: Item details
        session: Database session
        user_id: Current user

    Returns:
        The newly created InterestListItem
    """
    service = InterestListService()

    try:
        item = await service.add_item(
            session=session,
            list_id=list_id,
            user_id=user_id,
            item_type=request.item_type,
            item_uuid=request.item_uuid,
            item_metadata=request.item_metadata,
            notes=request.notes,
            position=request.position,
            custom_metadata=request.custom_metadata,
        )

        return InterestListItemResponse.model_validate(item)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add item to list: {str(e)}"
        )


@router.patch("/{list_id}/items/{item_id}", response_model=InterestListItemResponse)
async def update_item(
    list_id: UUID,
    item_id: UUID,
    request: UpdateListItemRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Update an item in an interest list.

    Args:
        list_id: List ID (for path consistency)
        item_id: Item ID
        request: Update details
        session: Database session

    Returns:
        Updated InterestListItem
    """
    service = InterestListService()

    try:
        item = await service.update_item(
            session=session,
            item_id=item_id,
            notes=request.notes,
            status=request.status,
            custom_metadata=request.custom_metadata,
        )

        return InterestListItemResponse.model_validate(item)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update item: {str(e)}"
        )


@router.delete("/{list_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_item(
    list_id: UUID,
    item_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Remove an item from an interest list.

    Args:
        list_id: List ID (for path consistency)
        item_id: Item ID
        session: Database session

    Returns:
        204 No Content on success
    """
    service = InterestListService()

    deleted = await service.remove_item(session, item_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item {item_id} not found"
        )


@router.post("/{list_id}/reorder", response_model=InterestListResponse)
async def reorder_items(
    list_id: UUID,
    request: ReorderListItemsRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Reorder items in a list.

    Args:
        list_id: List ID
        request: New item positions
        session: Database session

    Returns:
        Updated InterestList
    """
    service = InterestListService()

    try:
        # Convert string keys to UUIDs
        item_positions = {UUID(k): v for k, v in request.item_positions.items()}

        interest_list = await service.reorder_items(
            session=session,
            list_id=list_id,
            item_positions=item_positions,
        )

        return to_list_response(interest_list)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reorder items: {str(e)}"
        )


# ============================================================================
# Navigation
# ============================================================================

@router.post("/{list_id}/navigate", response_model=InterestListResponse)
async def navigate(
    list_id: UUID,
    request: NavigateListRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Navigate through a list (forward, back, or jump to position).

    Args:
        list_id: List ID
        request: Navigation details
        session: Database session

    Returns:
        Updated InterestList with new current_position
    """
    service = InterestListService()

    try:
        interest_list = await service.navigate(
            session=session,
            list_id=list_id,
            direction=request.direction,
            jump_to_position=request.jump_to_position,
        )

        return to_list_response(interest_list)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to navigate: {str(e)}"
        )


# ============================================================================
# Branching
# ============================================================================

@router.post("/{list_id}/branch", response_model=InterestListResponse, status_code=status.HTTP_201_CREATED)
async def branch_list(
    list_id: UUID,
    request: BranchListRequest,
    session: AsyncSession = Depends(get_session),
    user_id: UUID = Depends(get_user_id),
):
    """
    Branch a list from a specific position.

    Creates a copy of the list, optionally with items,
    and records the branch relationship.

    Args:
        list_id: Source list ID
        request: Branch details
        session: Database session
        user_id: Current user

    Returns:
        The newly created branched InterestList
    """
    service = InterestListService()

    try:
        branch = await service.branch_list(
            session=session,
            source_list_id=list_id,
            user_id=user_id,
            branch_name=request.branch_name,
            branch_position=request.branch_position,
            branch_reason=request.branch_reason,
            include_items=request.include_items,
        )

        response = InterestListResponse.model_validate(branch)
        response.progress_pct = branch.progress_pct
        return response

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to branch list: {str(e)}"
        )


@router.get("/{list_id}/branches", response_model=list[InterestListBranchResponse])
async def get_branches(
    list_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get all branches from a list.

    Args:
        list_id: Source list ID
        session: Database session

    Returns:
        List of InterestListBranch objects
    """
    service = InterestListService()

    branches = await service.get_branches(session, list_id)

    return [InterestListBranchResponse.model_validate(b) for b in branches]
