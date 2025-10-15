"""
Agent API - Agentic User Interface endpoints

Endpoints for natural language interaction with the Humanizer system.
Users speak their intentions, agent calls tools, GUI responds.

Architecture:
1. POST /api/agent/chat - Send message, get response with tool calls
2. GET /api/agent/conversations - List agent conversations
3. POST /api/agent/conversations - Create new conversation
4. GET /api/agent/conversations/{id} - Get conversation details
5. DELETE /api/agent/conversations/{id} - Delete conversation
"""

from typing import Optional, List
from uuid import UUID, uuid4
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from pydantic import BaseModel, Field

from humanizer.database import get_session
from humanizer.services.agent import AgentService
from humanizer.models.user import UserPreferences
from humanizer.models.agent import AgentConversation

router = APIRouter(prefix="/api/agent", tags=["agent"])


# ========================================
# Pydantic Models
# ========================================

class ChatMessage(BaseModel):
    """Single message in a conversation."""
    role: str = Field(..., description="Message role: 'user', 'assistant', 'system'")
    content: str = Field(..., description="Message content")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    tool_call: Optional[dict] = Field(None, description="Tool call info if any")
    tool_result: Optional[dict] = Field(None, description="Tool result if any")
    gui_action: Optional[str] = Field(None, description="GUI action to perform")
    gui_data: Optional[dict] = Field(None, description="Data for GUI component")


class ChatRequest(BaseModel):
    """Request to send a message to the agent."""
    message: str = Field(..., description="User message")
    conversation_id: Optional[str] = Field(None, description="Conversation ID (creates new if null)")
    user_id: Optional[str] = Field("00000000-0000-0000-0000-000000000001", description="User ID")


class ChatResponse(BaseModel):
    """Response from agent chat."""
    conversation_id: str
    message: ChatMessage
    messages: List[ChatMessage] = Field(default_factory=list, description="Full conversation history")


class ConversationListItem(BaseModel):
    """Conversation list item."""
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int
    last_message: Optional[str] = None


class ConversationListResponse(BaseModel):
    """List of conversations."""
    conversations: List[ConversationListItem]
    total: int


class ConversationDetail(BaseModel):
    """Full conversation details."""
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: List[ChatMessage]


# ========================================
# Endpoints
# ========================================

@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(
    request: ChatRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Send message to agent and get response with potential tool calls.

    The agent will:
    1. Interpret user intent
    2. Call appropriate tools if needed
    3. Return response with GUI actions
    4. Update conversation history in database

    Example:
        POST /api/agent/chat
        {
            "message": "Find conversations about quantum mechanics",
            "conversation_id": null
        }

        Response:
        {
            "conversation_id": "abc-123",
            "message": {
                "role": "assistant",
                "content": "Found 23 conversations about quantum mechanics...",
                "tool_call": {"tool": "semantic_search", "parameters": {...}},
                "gui_action": "open_search_results",
                "gui_data": {...}
            },
            "messages": [...]
        }
    """
    try:
        # Get or create conversation
        if request.conversation_id:
            # Load existing conversation
            stmt = select(AgentConversation).where(
                AgentConversation.id == UUID(request.conversation_id)
            )
            result = await session.execute(stmt)
            conversation = result.scalar_one_or_none()

            if not conversation:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Conversation {request.conversation_id} not found"
                )
        else:
            # Create new conversation
            title = request.message[:50] + "..." if len(request.message) > 50 else request.message
            conversation = AgentConversation(
                user_id=UUID(request.user_id),
                title=title,
                model_name="mistral:7b",
                messages=[],
                custom_metadata={}
            )
            session.add(conversation)
            await session.flush()  # Get ID without committing

        # Build conversation history for LLM
        history = conversation.get_conversation_history()

        # Process message with agent
        agent = AgentService()
        result = await agent.process_message(request.message, history)

        # Add user message
        conversation.add_message(
            role="user",
            content=request.message
        )

        # Add assistant message with tool call info
        conversation.add_message(
            role="assistant",
            content=result["response"],
            tool_call=result.get("tool_call"),
            tool_result=result.get("tool_result"),
            gui_action=result.get("gui_action"),
            gui_data=result.get("gui_data")
        )

        # Commit to database
        await session.commit()
        await session.refresh(conversation)

        # Build response
        messages = conversation.messages or []
        assistant_message = ChatMessage(**messages[-1]) if messages else None

        return ChatResponse(
            conversation_id=str(conversation.id),
            message=assistant_message,
            messages=[ChatMessage(**msg) for msg in messages]
        )

    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent chat failed: {str(e)}"
        )


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    limit: int = 50,
    offset: int = 0,
    user_id: str = "00000000-0000-0000-0000-000000000001",
    session: AsyncSession = Depends(get_session),
):
    """
    List all agent conversations for a user.

    Returns conversations sorted by most recent first.
    """
    try:
        # Count total conversations
        count_stmt = select(func.count()).select_from(AgentConversation).where(
            AgentConversation.user_id == UUID(user_id)
        )
        count_result = await session.execute(count_stmt)
        total = count_result.scalar()

        # Get conversations sorted by updated_at
        stmt = (
            select(AgentConversation)
            .where(AgentConversation.user_id == UUID(user_id))
            .order_by(AgentConversation.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.execute(stmt)
        conversations = result.scalars().all()

        # Build list items
        items = []
        for conv in conversations:
            messages = conv.messages or []
            last_message = None
            if messages:
                last_msg_content = messages[-1].get("content", "")
                last_message = last_msg_content[:100]

            items.append(
                ConversationListItem(
                    id=str(conv.id),
                    title=conv.title,
                    created_at=conv.created_at.isoformat(),
                    updated_at=conv.updated_at.isoformat(),
                    message_count=len(messages),
                    last_message=last_message
                )
            )

        return ConversationListResponse(
            conversations=items,
            total=total
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list conversations: {str(e)}"
        )


@router.post("/conversations", response_model=ConversationDetail)
async def create_conversation(
    title: Optional[str] = None,
    user_id: str = "00000000-0000-0000-0000-000000000001",
    session: AsyncSession = Depends(get_session),
):
    """
    Create a new agent conversation.

    Example:
        POST /api/agent/conversations
        {"title": "My Research Session"}
    """
    try:
        conversation = AgentConversation(
            user_id=UUID(user_id),
            title=title or "New Conversation",
            model_name="mistral:7b",
            messages=[],
            custom_metadata={}
        )

        session.add(conversation)
        await session.commit()
        await session.refresh(conversation)

        return ConversationDetail(
            id=str(conversation.id),
            title=conversation.title,
            created_at=conversation.created_at.isoformat(),
            updated_at=conversation.updated_at.isoformat(),
            messages=[]
        )

    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create conversation: {str(e)}"
        )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Get full conversation details including all messages.

    Args:
        conversation_id: Conversation UUID

    Returns:
        Full conversation with message history
    """
    try:
        stmt = select(AgentConversation).where(
            AgentConversation.id == UUID(conversation_id)
        )
        result = await session.execute(stmt)
        conversation = result.scalar_one_or_none()

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation {conversation_id} not found"
            )

        messages = conversation.messages or []

        return ConversationDetail(
            id=str(conversation.id),
            title=conversation.title,
            created_at=conversation.created_at.isoformat(),
            updated_at=conversation.updated_at.isoformat(),
            messages=[ChatMessage(**msg) for msg in messages]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get conversation: {str(e)}"
        )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Delete an agent conversation.

    Args:
        conversation_id: Conversation UUID

    Returns:
        Success confirmation
    """
    try:
        stmt = delete(AgentConversation).where(
            AgentConversation.id == UUID(conversation_id)
        )
        result = await session.execute(stmt)
        await session.commit()

        if result.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation {conversation_id} not found"
            )

        return {"success": True, "message": f"Conversation {conversation_id} deleted"}

    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete conversation: {str(e)}"
        )
