"""
ChatGPT Archive models - SQLAlchemy models for ChatGPT conversation data

These models track ChatGPT conversation archives:
- ChatGPTConversation: Full conversation (title, timestamps, source)
- ChatGPTMessage: Individual messages within conversations
- ChatGPTMedia: Media files (images, attachments) referenced in messages
- ChatGPTProvenance: Tracks which archives contributed to each conversation
"""

from datetime import datetime
from uuid import UUID
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship

from humanizer.database import Base


class ChatGPTConversation(Base):
    """
    A ChatGPT conversation from archive exports.

    Uses UUID from ChatGPT's conversation ID as primary key.
    When multiple archives contain the same conversation, we merge them
    temporally (latest update_time wins for metadata).

    Attributes:
        uuid: ChatGPT's conversation UUID (primary key)
        title: Conversation title
        created_at: When conversation was created (from create_time)
        updated_at: When conversation was last updated (from update_time)
        source_archive: Primary archive this came from (e.g., "chat5")
        custom_metadata: ALL original ChatGPT metadata preserved
        messages: List of ChatGPTMessage
        media: List of ChatGPTMedia
        provenance: List of ChatGPTProvenance (tracks archive contributions)
    """
    __tablename__ = "chatgpt_conversations"

    uuid = Column(PG_UUID(as_uuid=True), primary_key=True)
    title = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    source_archive = Column(String(100), nullable=False)  # e.g., "chat5"
    custom_metadata = Column(JSONB, nullable=False)  # Full original JSON

    # Relationships
    messages = relationship("ChatGPTMessage", back_populates="conversation", cascade="all, delete-orphan")
    media = relationship("ChatGPTMedia", back_populates="conversation", cascade="all, delete-orphan")
    provenance = relationship("ChatGPTProvenance", back_populates="conversation", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<ChatGPTConversation uuid={self.uuid} title='{self.title[:30]}...'>"


class ChatGPTMessage(Base):
    """
    A single message within a ChatGPT conversation.

    Uses ChatGPT's message UUID as primary key.
    Messages are deduplicated across archives by UUID.

    Attributes:
        uuid: ChatGPT's message UUID (primary key)
        conversation_uuid: Parent conversation UUID
        created_at: When message was created (from create_time)
        author_role: 'user', 'assistant', 'system', 'tool'
        content_text: Extracted text content (for search)
        content_parts: Original content.parts structure (JSONB)
        custom_metadata: ALL original message metadata
        conversation: Parent ChatGPTConversation
    """
    __tablename__ = "chatgpt_messages"

    uuid = Column(PG_UUID(as_uuid=True), primary_key=True)
    conversation_uuid = Column(PG_UUID(as_uuid=True), ForeignKey("chatgpt_conversations.uuid"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=True)
    author_role = Column(String(20), nullable=False)  # user, assistant, system, tool
    content_text = Column(Text, nullable=True)  # Extracted text for search
    content_parts = Column(JSONB, nullable=True)  # Original parts structure
    custom_metadata = Column(JSONB, nullable=False)  # Full original JSON

    # Relationships
    conversation = relationship("ChatGPTConversation", back_populates="messages")

    def __repr__(self) -> str:
        preview = self.content_text[:50] if self.content_text else ""
        return f"<ChatGPTMessage uuid={self.uuid} role={self.author_role} content='{preview}...'>"


class ChatGPTMedia(Base):
    """
    Media file referenced in ChatGPT messages.

    Tracks image attachments and other files.
    Links file_id (from markdown/JSON) to actual file path in archive.

    Attributes:
        file_id: ChatGPT's file ID (e.g., "file-abc123.png") - primary key
        conversation_uuid: Conversation this media belongs to
        message_uuid: Specific message that referenced this media
        file_path: Actual file path (e.g., "/Users/tem/chat5/files/file-abc123.png")
        source_archive: Which archive has this file (e.g., "chat5")
        mime_type: MIME type (e.g., "image/png")
        file_metadata: Original file metadata from ChatGPT
        conversation: Parent ChatGPTConversation
        message: Parent ChatGPTMessage
    """
    __tablename__ = "chatgpt_media"

    file_id = Column(String(200), primary_key=True)  # e.g., "file-abc123.png"
    conversation_uuid = Column(PG_UUID(as_uuid=True), ForeignKey("chatgpt_conversations.uuid"), nullable=False, index=True)
    message_uuid = Column(PG_UUID(as_uuid=True), ForeignKey("chatgpt_messages.uuid"), nullable=True, index=True)
    file_path = Column(Text, nullable=True)  # Actual path on disk
    source_archive = Column(String(100), nullable=True)  # Which archive has the file
    mime_type = Column(String(100), nullable=True)
    file_metadata = Column(JSONB, nullable=True)  # Original metadata

    # Relationships
    conversation = relationship("ChatGPTConversation", back_populates="media")
    # Note: No back_populates for message since ChatGPTMessage doesn't need media relationship

    def __repr__(self) -> str:
        return f"<ChatGPTMedia file_id={self.file_id} archive={self.source_archive}>"


class ChatGPTProvenance(Base):
    """
    Provenance tracking for ChatGPT conversations.

    Tracks which archives contributed to each conversation.
    When multiple archives contain the same conversation UUID,
    we record which archives we merged.

    Attributes:
        conversation_uuid: Conversation UUID (part of composite primary key)
        archive_name: Archive name (e.g., "chat5") (part of composite primary key)
        archive_date: When this archive was created/exported
        message_count: How many messages from this archive
        conversation: Parent ChatGPTConversation
    """
    __tablename__ = "chatgpt_provenance"

    conversation_uuid = Column(PG_UUID(as_uuid=True), ForeignKey("chatgpt_conversations.uuid"), primary_key=True)
    archive_name = Column(String(100), primary_key=True)  # e.g., "chat5"
    archive_date = Column(DateTime, nullable=True)
    message_count = Column(Integer, nullable=False, default=0)

    # Relationships
    conversation = relationship("ChatGPTConversation", back_populates="provenance")

    def __repr__(self) -> str:
        return f"<ChatGPTProvenance conv={self.conversation_uuid} archive={self.archive_name} msgs={self.message_count}>"
