"""
Unified Conversation Rendering Service

Renders conversations from any source (ChatGPT, Claude) to markdown format.
Delegates to source-specific renderers when available.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from humanizer.models.chatgpt import ChatGPTConversation, ChatGPTMessage
from humanizer.models.claude import ClaudeConversation, ClaudeMessage
from humanizer.models.schemas import ChatGPTRenderRequest, ChatGPTRenderResponse


# Import existing ChatGPT render service
from humanizer.services.chatgpt_render import (
    render_conversation_markdown as render_chatgpt_conversation,
)


class RenderConfig:
    """Rendering configuration for Claude conversations."""

    ROLE_INDICATORS = {
        "human": "👤",
        "assistant": "🤖",
        "system": "⚙️",
    }

    INCLUDE_TIMESTAMPS = True
    TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M"
    USE_EMOJI_INDICATORS = True
    MESSAGE_SEPARATOR = "\n\n"


def format_timestamp(dt: Optional[datetime], config: RenderConfig = RenderConfig()) -> str:
    """Format timestamp for display."""
    if not dt or not config.INCLUDE_TIMESTAMPS:
        return ""
    return dt.strftime(config.TIMESTAMP_FORMAT)


def get_role_indicator(role: str, config: RenderConfig = RenderConfig()) -> str:
    """Get role indicator (emoji or text label)."""
    if config.USE_EMOJI_INDICATORS:
        return config.ROLE_INDICATORS.get(role, "❓")
    return role.capitalize()


async def render_unified_conversation(
    session: AsyncSession,
    conversation_id: UUID,
    request: Optional[ChatGPTRenderRequest] = None,
) -> ChatGPTRenderResponse:
    """
    Render conversation from any source to markdown.

    Detects source and delegates to appropriate renderer.

    Args:
        session: Database session
        conversation_id: Conversation UUID
        request: Optional render configuration (for ChatGPT conversations)

    Returns:
        ChatGPTRenderResponse with markdown content

    Raises:
        ValueError: If conversation not found
    """

    # Try ChatGPT first
    chatgpt_stmt = select(ChatGPTConversation).where(
        ChatGPTConversation.uuid == conversation_id
    )

    result = await session.execute(chatgpt_stmt)
    chatgpt_conv = result.scalar_one_or_none()

    if chatgpt_conv:
        # Use existing ChatGPT render service
        if request is None:
            request = ChatGPTRenderRequest()
        return await render_chatgpt_conversation(session, conversation_id, request)

    # Try Claude
    claude_stmt = select(ClaudeConversation).where(
        ClaudeConversation.uuid == conversation_id
    ).options(
        selectinload(ClaudeConversation.messages),
        selectinload(ClaudeConversation.media)
    )

    result = await session.execute(claude_stmt)
    claude_conv = result.scalar_one_or_none()

    if claude_conv:
        return await _render_claude_conversation(claude_conv, request)

    raise ValueError(f"Conversation {conversation_id} not found in any source")


async def _render_claude_conversation(
    conversation: ClaudeConversation,
    request: Optional[ChatGPTRenderRequest] = None,
) -> ChatGPTRenderResponse:
    """
    Render Claude conversation to markdown.

    Args:
        conversation: ClaudeConversation with loaded messages
        request: Optional render configuration

    Returns:
        ChatGPTRenderResponse with markdown content
    """

    config = RenderConfig()
    markdown_lines = []
    media_refs = []

    # Add conversation header
    title = conversation.name or "(Untitled)"
    markdown_lines.append(f"# {title}")
    markdown_lines.append("")

    if conversation.summary:
        markdown_lines.append(f"**Summary:** {conversation.summary}")
        markdown_lines.append("")

    # Sort messages by created_at
    messages = sorted(
        conversation.messages,
        key=lambda m: m.created_at or datetime.min
    )

    # Note: Pagination not implemented for Claude conversations yet
    # The ChatGPTRenderRequest schema uses 'pagination' and 'messages_per_page'
    # not 'messages_offset' and 'messages_limit'

    # Render messages
    for msg in messages:
        # Skip empty messages
        if not msg.text or not msg.text.strip():
            continue

        # Role indicator
        role = msg.sender  # 'human' or 'assistant'
        indicator = get_role_indicator(role, config)
        label = "User" if role == "human" else "Assistant"

        # Timestamp
        timestamp = format_timestamp(msg.created_at, config)
        timestamp_str = f" [{timestamp}]" if timestamp else ""

        # Message header
        markdown_lines.append(f"{indicator} **{label}**{timestamp_str}")
        markdown_lines.append("")

        # Message content
        markdown_lines.append(msg.text)

        # Check for media (Claude media is different from ChatGPT)
        if conversation.media:
            # Find media attached to this message
            # Note: Claude media model doesn't have message_uuid, so we can't link them
            # For now, we'll just list all media at the end
            pass

        markdown_lines.append(config.MESSAGE_SEPARATOR)

    # Add media section if present
    if conversation.media:
        markdown_lines.append("\n---\n")
        markdown_lines.append("## Attachments")
        markdown_lines.append("")

        for media in conversation.media:
            markdown_lines.append(f"- **{media.file_name}**")
            if media.extracted_content:
                markdown_lines.append(f"  {media.extracted_content[:200]}...")
            markdown_lines.append("")

            media_refs.append({
                "id": media.id,
                "file_name": media.file_name,
                "extracted_content": media.extracted_content,
            })

    # Join all lines
    markdown = "\n".join(markdown_lines)

    return ChatGPTRenderResponse(
        conversation_uuid=conversation.uuid,
        title=conversation.name or "(Untitled)",
        total_messages=len(conversation.messages),
        total_pages=1,  # Pagination not implemented for Claude yet
        current_page=1,
        markdown=markdown,
        media_refs=media_refs,
    )
