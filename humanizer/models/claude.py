"""
Claude Archive models - SQLAlchemy models for Claude/Anthropic conversation data

These models track Claude conversation archives:
- ClaudeConversation: Full conversation (name, summary, timestamps)
- ClaudeMessage: Individual messages within conversations
- ClaudeMedia: Media files (images, attachments) referenced in messages
- ClaudeProject: Projects with embedded documentation
- ClaudeProvenance: Tracks which archives contributed to each conversation
"""

from datetime import datetime
from uuid import UUID
from sqlalchemy import Column, String, Text, Integer, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from humanizer.database import Base


class ClaudeConversation(Base):
    """
    A Claude/Anthropic conversation from archive exports.

    Uses UUID from Claude's conversation ID as primary key.
    When multiple archives contain the same conversation, we merge them
    temporally (latest updated_at wins for metadata).

    Attributes:
        uuid: Claude's conversation UUID (primary key)
        name: Conversation title (can be empty string)
        summary: Conversation summary (can be empty string)
        created_at: When conversation was created
        updated_at: When conversation was last updated
        account_uuid: User account UUID from Claude
        project_uuid: Associated project UUID (if conversation belongs to a project)
        source_archive: Primary archive this came from (e.g., "data-2025-10-25")
        custom_metadata: ALL original Claude metadata preserved
        messages: List of ClaudeMessage
        media: List of ClaudeMedia
        provenance: List of ClaudeProvenance (tracks archive contributions)
    """
    __tablename__ = "claude_conversations"

    uuid = Column(PG_UUID(as_uuid=True), primary_key=True)
    name = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    account_uuid = Column(PG_UUID(as_uuid=True), nullable=True)  # User account from Claude
    project_uuid = Column(PG_UUID(as_uuid=True), ForeignKey("claude_projects.uuid"), nullable=True)
    source_archive = Column(String(100), nullable=False)  # e.g., "data-2025-10-25"
    custom_metadata = Column(JSONB, nullable=False)  # Full original JSON

    # Relationships
    messages = relationship("ClaudeMessage", back_populates="conversation", cascade="all, delete-orphan")
    media = relationship("ClaudeMedia", back_populates="conversation", cascade="all, delete-orphan")
    provenance = relationship("ClaudeProvenance", back_populates="conversation", cascade="all, delete-orphan")
    project = relationship("ClaudeProject", back_populates="conversations")

    def __repr__(self) -> str:
        title = self.name[:30] if self.name else "(untitled)"
        return f"<ClaudeConversation uuid={self.uuid} name='{title}...'>"


class ClaudeMessage(Base):
    """
    A single message within a Claude conversation.

    Uses Claude's message UUID as primary key.
    Messages are deduplicated across archives by UUID.

    Attributes:
        uuid: Claude's message UUID (primary key)
        conversation_uuid: Parent conversation UUID
        sender: 'human' or 'assistant'
        text: Extracted text content (for search)
        content_blocks: Original content array structure (JSONB)
        created_at: When message was created
        updated_at: When message was last updated
        custom_metadata: ALL original message metadata
        embedding: Semantic embedding vector (1024-dim from mxbai-embed-large)
        conversation: Parent ClaudeConversation
    """
    __tablename__ = "claude_messages"

    uuid = Column(PG_UUID(as_uuid=True), primary_key=True)
    conversation_uuid = Column(PG_UUID(as_uuid=True), ForeignKey("claude_conversations.uuid"), nullable=False, index=True)
    sender = Column(String(20), nullable=False)  # 'human' or 'assistant'
    text = Column(Text, nullable=True)  # Extracted text for search
    content_blocks = Column(JSONB, nullable=True)  # Original content array
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    custom_metadata = Column(JSONB, nullable=False)  # Full original JSON
    embedding = Column(Vector(1024), nullable=True)  # Semantic embedding (mxbai-embed-large)

    # Relationships
    conversation = relationship("ClaudeConversation", back_populates="messages")

    def __repr__(self) -> str:
        preview = self.text[:50] if self.text else ""
        return f"<ClaudeMessage uuid={self.uuid} sender={self.sender} text='{preview}...'>"


class ClaudeMedia(Base):
    """
    Media file referenced in Claude messages.

    Tracks both:
    - Attachments: Text files with extracted_content
    - Files: Images and other binary files

    Links file references to actual file paths in archive directories.

    Attributes:
        id: Auto-increment primary key (since Claude doesn't provide unique file IDs)
        conversation_uuid: Conversation this media belongs to
        message_uuid: Specific message that referenced this media
        file_name: File name (e.g., "image.jpg", "paste.txt")
        file_path: Actual file path (e.g., "/tmp/UUID/image.jpg")
        file_type: File type (e.g., "txt", "image", "pdf")
        file_size: File size in bytes
        extracted_content: For text attachments, the extracted text content
        source_archive: Which archive has this file (e.g., "data-2025-10-25")
        mime_type: MIME type (e.g., "image/png", "text/plain")
        file_metadata: Original file metadata from Claude
        conversation: Parent ClaudeConversation
    """
    __tablename__ = "claude_media"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_uuid = Column(PG_UUID(as_uuid=True), ForeignKey("claude_conversations.uuid"), nullable=False, index=True)
    message_uuid = Column(PG_UUID(as_uuid=True), ForeignKey("claude_messages.uuid"), nullable=True, index=True)
    file_name = Column(String(500), nullable=False)
    file_path = Column(Text, nullable=True)  # Actual path on disk
    file_type = Column(String(50), nullable=True)  # txt, image, pdf, etc
    file_size = Column(Integer, nullable=True)  # Bytes
    extracted_content = Column(Text, nullable=True)  # For text attachments
    source_archive = Column(String(100), nullable=True)  # Which archive has the file
    mime_type = Column(String(100), nullable=True)
    file_metadata = Column(JSONB, nullable=True)  # Original metadata

    # Relationships
    conversation = relationship("ClaudeConversation", back_populates="media")
    # Note: No back_populates for message since ClaudeMessage doesn't need media relationship

    def __repr__(self) -> str:
        return f"<ClaudeMedia id={self.id} file_name={self.file_name} archive={self.source_archive}>"


class ClaudeProject(Base):
    """
    Claude Project - organizational container for conversations and documents.

    Projects are a Claude-specific feature that group related conversations
    and include embedded documentation.

    Attributes:
        uuid: Claude's project UUID (primary key)
        name: Project name
        description: Project description
        is_private: Whether project is private
        is_starter_project: Whether this is a Claude starter project
        prompt_template: Custom prompt template for the project
        created_at: When project was created
        updated_at: When project was last updated
        creator_uuid: UUID of user who created the project
        docs: Array of project documents (JSONB)
        custom_metadata: ALL original project metadata
        conversations: List of ClaudeConversation that belong to this project
    """
    __tablename__ = "claude_projects"

    uuid = Column(PG_UUID(as_uuid=True), primary_key=True)
    name = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    is_private = Column(Boolean, nullable=False, default=True)
    is_starter_project = Column(Boolean, nullable=False, default=False)
    prompt_template = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    creator_uuid = Column(PG_UUID(as_uuid=True), nullable=True)
    docs = Column(JSONB, nullable=True)  # Array of document objects
    custom_metadata = Column(JSONB, nullable=False)  # Full original JSON

    # Relationships
    conversations = relationship("ClaudeConversation", back_populates="project")

    def __repr__(self) -> str:
        return f"<ClaudeProject uuid={self.uuid} name='{self.name}'>"


class ClaudeProvenance(Base):
    """
    Provenance tracking for Claude conversations.

    Tracks which archives contributed to each conversation.
    When multiple archives contain the same conversation UUID,
    we record which archives we merged.

    Attributes:
        conversation_uuid: Conversation UUID (part of composite primary key)
        archive_name: Archive name (e.g., "data-2025-10-25") (part of composite primary key)
        archive_date: When this archive was created/exported
        message_count: How many messages from this archive
        conversation: Parent ClaudeConversation
    """
    __tablename__ = "claude_provenance"

    conversation_uuid = Column(PG_UUID(as_uuid=True), ForeignKey("claude_conversations.uuid"), primary_key=True)
    archive_name = Column(String(100), primary_key=True)  # e.g., "data-2025-10-25"
    archive_date = Column(DateTime, nullable=True)
    message_count = Column(Integer, nullable=False, default=0)

    # Relationships
    conversation = relationship("ClaudeConversation", back_populates="provenance")

    def __repr__(self) -> str:
        return f"<ClaudeProvenance conv={self.conversation_uuid} archive={self.archive_name} msgs={self.message_count}>"
