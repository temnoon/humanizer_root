"""
Agent Conversation Models - Store agent chat history with tool calls

This module tracks agent conversations for the Agentic User Interface (AUI):
- Full message history with tool calls and results
- GUI actions triggered by agent
- Conversation metadata and timestamps
"""

from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from humanizer.database.connection import Base


class AgentConversation(Base):
    """
    Agent conversation with full message history.

    Stores natural language interactions where users express intent
    and the agent responds by calling tools and triggering GUI actions.

    Example conversation:
    User: "Find conversations about quantum mechanics"
    Agent: [calls semantic_search tool] → "Found 23 conversations..."
          [triggers GUI action: open_search_results]
    """

    __tablename__ = "agent_conversations"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # User reference
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_preferences.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Conversation metadata
    title = Column(
        String(500),
        nullable=False,
        comment="Conversation title (usually first user message)"
    )

    model_name = Column(
        String(100),
        nullable=False,
        default="mistral:7b",
        index=True,
        comment="LLM model used for this conversation"
    )

    # Message history
    messages = Column(
        JSONB,
        nullable=False,
        default=[],
        comment="Array of message objects with tool calls and GUI actions"
    )
    # Example structure:
    # [
    #   {
    #     "role": "user",
    #     "content": "Find conversations about quantum mechanics",
    #     "timestamp": "2025-10-12T14:30:00Z"
    #   },
    #   {
    #     "role": "assistant",
    #     "content": "Found 23 conversations about quantum mechanics...",
    #     "timestamp": "2025-10-12T14:30:05Z",
    #     "tool_call": {
    #       "tool": "semantic_search",
    #       "parameters": {"query": "quantum mechanics", "k": 10}
    #     },
    #     "tool_result": {...},
    #     "gui_action": "open_search_results",
    #     "gui_data": {...}
    #   }
    # ]

    # Additional metadata
    custom_metadata = Column(
        JSONB,
        nullable=False,
        default={},
        comment="Additional conversation metadata"
    )
    # Example: {"tags": ["research", "physics"], "starred": true}

    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        index=True
    )

    def to_dict(self, include_messages: bool = True) -> Dict[str, Any]:
        """
        Convert conversation to dictionary.

        Args:
            include_messages: Include full message history

        Returns:
            Dictionary representation
        """
        result = {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "title": self.title,
            "model_name": self.model_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "custom_metadata": self.custom_metadata or {},
        }

        if include_messages:
            result["messages"] = self.messages or []
        else:
            # Just include message count and last message
            messages = self.messages or []
            result["message_count"] = len(messages)
            if messages:
                result["last_message"] = messages[-1].get("content", "")[:100]

        return result

    def add_message(
        self,
        role: str,
        content: str,
        tool_call: Optional[Dict] = None,
        tool_result: Optional[Dict] = None,
        gui_action: Optional[str] = None,
        gui_data: Optional[Dict] = None
    ) -> None:
        """
        Add a message to the conversation.

        Args:
            role: Message role (user/assistant/system)
            content: Message content
            tool_call: Tool call information (optional)
            tool_result: Tool execution result (optional)
            gui_action: GUI action to trigger (optional)
            gui_data: Data for GUI component (optional)
        """
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        }

        if tool_call:
            message["tool_call"] = tool_call
        if tool_result:
            message["tool_result"] = tool_result
        if gui_action:
            message["gui_action"] = gui_action
        if gui_data:
            message["gui_data"] = gui_data

        # Ensure messages is a list
        if self.messages is None:
            self.messages = []

        # Append message (SQLAlchemy will handle JSONB update)
        messages = list(self.messages)  # Make a copy
        messages.append(message)
        self.messages = messages

    def get_conversation_history(self) -> List[Dict[str, str]]:
        """
        Get conversation history in LLM format (role + content only).

        Returns:
            List of {"role": "...", "content": "..."} dicts
        """
        return [
            {"role": msg["role"], "content": msg["content"]}
            for msg in (self.messages or [])
        ]

    def __repr__(self) -> str:
        message_count = len(self.messages) if self.messages else 0
        return f"<AgentConversation(id={self.id}, title='{self.title[:30]}...', messages={message_count})>"
