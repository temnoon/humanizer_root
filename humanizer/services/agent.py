"""
Agent Service - LLM-based tool calling and conversation management

This service implements the Agentic User Interface (AUI) where users speak
their intentions and the system responds by calling tools and opening GUI components.

Architecture:
1. User sends natural language message
2. LLM interprets intent and calls appropriate tools
3. Tools execute and return results
4. System generates GUI actions (open tabs, display data)
5. User sees results and learns how to do it manually

Supported LLM Providers:
- Ollama (local, default: mistral:7b)
- Claude (Anthropic API)
"""

import json
import httpx
from typing import List, Dict, Any, Optional, Protocol
from datetime import datetime
from uuid import UUID
from anthropic import Anthropic, AsyncAnthropic
from anthropic.types import MessageParam, ToolParam, TextBlock, ToolUseBlock

# Import all available tools
AVAILABLE_TOOLS = [
    {
        "name": "semantic_search",
        "description": "Search ChatGPT conversations and messages using semantic similarity. Use this when user wants to find, show, or list conversations or messages by meaning, not exact keywords. For example: 'conversations with images', 'discussions about quantum', etc. This will automatically create an interest list in the sidebar with the results.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query text"
                },
                "k": {
                    "type": "integer",
                    "description": "Number of results to return (default: 10)",
                    "default": 10
                }
            },
            "required": ["query"]
        },
        "api_endpoint": "/api/explore/search",
        "http_method": "POST",
        "gui_action": "create_interest_list_from_results"
    },
    {
        "name": "find_neighbors",
        "description": "Find messages similar to a specific message. Use this when user wants to see related content or explore connections.",
        "parameters": {
            "type": "object",
            "properties": {
                "message_uuid": {
                    "type": "string",
                    "description": "UUID of the message to find neighbors for"
                },
                "k": {
                    "type": "integer",
                    "description": "Number of neighbors to return",
                    "default": 10
                }
            },
            "required": ["message_uuid"]
        },
        "api_endpoint": "/api/explore/neighbors",
        "gui_action": "open_neighbors_view"
    },
    {
        "name": "compute_semantic_direction",
        "description": "Compute a semantic direction vector between two concepts. Use this for understanding semantic transformations.",
        "parameters": {
            "type": "object",
            "properties": {
                "positive_query": {
                    "type": "string",
                    "description": "What we want more of (e.g., 'formal')"
                },
                "negative_query": {
                    "type": "string",
                    "description": "What we want less of (e.g., 'casual')"
                }
            },
            "required": ["positive_query", "negative_query"]
        },
        "api_endpoint": "/api/explore/direction",
        "gui_action": None
    },
    {
        "name": "analyze_trm_perturbation",
        "description": "Analyze how density matrix changes when text is perturbed in a semantic direction. Shows TRM measurements.",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "Text to analyze"
                },
                "positive_query": {
                    "type": "string",
                    "description": "Direction to move toward"
                },
                "negative_query": {
                    "type": "string",
                    "description": "Direction to move away from"
                },
                "magnitude": {
                    "type": "number",
                    "description": "Perturbation strength (0.0-1.0)",
                    "default": 0.1
                },
                "povm_pack": {
                    "type": "string",
                    "description": "POVM pack to use",
                    "enum": ["tetralemma", "tone", "ontology", "pragmatics", "audience"],
                    "default": "tetralemma"
                }
            },
            "required": ["text"]
        },
        "api_endpoint": "/api/explore/perturb",
        "gui_action": "open_perturbation_view"
    },
    {
        "name": "explore_semantic_trajectory",
        "description": "Explore how TRM measurements change along a semantic path. Shows trajectory visualization.",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "Starting text"
                },
                "positive_query": {
                    "type": "string",
                    "description": "Direction to explore"
                },
                "negative_query": {
                    "type": "string",
                    "description": "Opposite direction"
                },
                "steps": {
                    "type": "integer",
                    "description": "Number of steps",
                    "default": 5
                },
                "step_size": {
                    "type": "number",
                    "description": "Step size",
                    "default": 0.05
                }
            },
            "required": ["text", "positive_query", "negative_query"]
        },
        "api_endpoint": "/api/explore/trajectory",
        "gui_action": "open_trajectory_view"
    },
    {
        "name": "find_semantic_clusters",
        "description": "Find semantic clusters in embedding space. Discovers conceptual groups in conversations.",
        "parameters": {
            "type": "object",
            "properties": {
                "n_samples": {
                    "type": "integer",
                    "description": "Number of messages to sample",
                    "default": 1000
                },
                "n_clusters": {
                    "type": "integer",
                    "description": "Number of clusters",
                    "default": 5
                }
            },
            "required": []
        },
        "api_endpoint": "/api/explore/clusters",
        "gui_action": "open_cluster_view"
    },
    {
        "name": "list_conversations",
        "description": "List all conversations with pagination and filtering. Use when user wants to browse their conversation history.",
        "parameters": {
            "type": "object",
            "properties": {
                "page": {
                    "type": "integer",
                    "description": "Page number",
                    "default": 1
                },
                "page_size": {
                    "type": "integer",
                    "description": "Results per page",
                    "default": 50
                },
                "search": {
                    "type": "string",
                    "description": "Search query for titles"
                }
            },
            "required": []
        },
        "api_endpoint": "/api/chatgpt/conversations",
        "http_method": "GET",
        "gui_action": "open_conversation_list"
    },
    {
        "name": "get_conversation",
        "description": "Get full conversation details including all messages. Use when user wants to view a specific conversation.",
        "parameters": {
            "type": "object",
            "properties": {
                "conversation_uuid": {
                    "type": "string",
                    "description": "Conversation UUID"
                }
            },
            "required": ["conversation_uuid"]
        },
        "api_endpoint": "/api/chatgpt/conversation",
        "gui_action": "open_conversation_viewer"
    },
    {
        "name": "transform_text",
        "description": "Transform text using TRM iterative method. Use when user wants to change text style/tone.",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "Text to transform"
                },
                "povm_pack": {
                    "type": "string",
                    "description": "POVM pack to use",
                    "default": "tone"
                },
                "target_stance": {
                    "type": "object",
                    "description": "Target semantic coordinates"
                },
                "max_iterations": {
                    "type": "integer",
                    "description": "Max transformation iterations",
                    "default": 5
                }
            },
            "required": ["text"]
        },
        "api_endpoint": "/transform/trm",
        "gui_action": "open_transformation_panel"
    },

    # ================================================================
    # MCP-SPECIFIC TOOLS (Phase 2 - Oct 15, 2025)
    # ================================================================

    {
        "name": "read_quantum",
        "description": "Read text with quantum measurements (POVMs). Returns four-corner probabilities for dialectical axes. Use for deep semantic analysis.",
        "parameters": {
            "type": "object",
            "properties": {
                "text_id": {
                    "type": "string",
                    "description": "ID of text to read (book ID, chunk ID, etc.)"
                },
                "start_sentence": {
                    "type": "integer",
                    "description": "Starting sentence index (default: 0)",
                    "default": 0
                },
                "num_sentences": {
                    "type": "integer",
                    "description": "Number of sentences to read (default: 10)",
                    "default": 10
                },
                "axes": {
                    "type": "string",
                    "description": "Which axes to use: 'universal', 'context', or 'all' (default: 'all')",
                    "enum": ["universal", "context", "all"],
                    "default": "all"
                }
            },
            "required": ["text_id"]
        },
        "execution_type": "mcp",
        "mcp_tool": "read_quantum",
        "gui_action": None
    },
    {
        "name": "search_chunks",
        "description": "Semantic search across all text chunks in library. Finds chunks similar to your query. Use for finding specific passages in books.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum results (default: 10)",
                    "default": 10
                }
            },
            "required": ["query"]
        },
        "execution_type": "mcp",
        "mcp_tool": "search_chunks",
        "gui_action": None
    },
    {
        "name": "list_books",
        "description": "Get list of all books in the library with metadata. Use when user wants to browse available books.",
        "parameters": {
            "type": "object",
            "properties": {}
        },
        "execution_type": "mcp",
        "mcp_tool": "list_books",
        "gui_action": None
    },
    {
        "name": "get_library_stats",
        "description": "Get library statistics (book count, chunk count, coverage, etc.). Use for library overview.",
        "parameters": {
            "type": "object",
            "properties": {}
        },
        "execution_type": "mcp",
        "mcp_tool": "get_library_stats",
        "gui_action": None
    },
    {
        "name": "search_images",
        "description": "Search for images in the ChatGPT archive. Use when user wants to find specific images.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum results (default: 10)",
                    "default": 10
                }
            },
            "required": ["query"]
        },
        "execution_type": "mcp",
        "mcp_tool": "search_images",
        "gui_action": "open_media_gallery"
    },
    {
        "name": "track_interest",
        "description": "Add item to your interest list (breadcrumbs + wishlist). Tracks what you're exploring and how you got there. Use when user marks something interesting.",
        "parameters": {
            "type": "object",
            "properties": {
                "item_type": {
                    "type": "string",
                    "description": "Type of item",
                    "enum": ["narrative", "chunk", "phrase", "concept", "image", "book"]
                },
                "item_id": {
                    "type": "string",
                    "description": "ID of the item"
                },
                "title": {
                    "type": "string",
                    "description": "Human-readable title (optional)"
                },
                "context": {
                    "type": "string",
                    "description": "What were you doing when you marked this? (optional)"
                },
                "connection_from_id": {
                    "type": "integer",
                    "description": "ID of previous interest item (breadcrumb chain, optional)"
                }
            },
            "required": ["item_type", "item_id"]
        },
        "execution_type": "mcp",
        "mcp_tool": "track_interest",
        "gui_action": "update_interest_list"
    },
    {
        "name": "get_connections",
        "description": "Get connection graph showing transformations between entities (functors). Shows how you got from A to B. Use for exploring discovery paths.",
        "parameters": {
            "type": "object",
            "properties": {
                "item_type": {
                    "type": "string",
                    "description": "Filter by item type (optional)"
                },
                "item_id": {
                    "type": "string",
                    "description": "Filter by item ID (optional)"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum connections (default: 50)",
                    "default": 50
                }
            }
        },
        "execution_type": "mcp",
        "mcp_tool": "get_connections",
        "gui_action": "open_connection_graph"
    },
    {
        "name": "get_interest_list",
        "description": "Get your interest list (breadcrumbs + wishlist). See what you've marked as interesting. Use when user wants to review their interests.",
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum items (default: 50)",
                    "default": 50
                }
            }
        },
        "execution_type": "mcp",
        "mcp_tool": "get_interest_list",
        "gui_action": "open_interest_list_panel"
    },
    {
        "name": "save_artifact",
        "description": "Save any semantic output as a persistent artifact. Artifacts can be searched, composed, and iterated on. Use for saving reports, extractions, or transformations.",
        "parameters": {
            "type": "object",
            "properties": {
                "artifact_type": {
                    "type": "string",
                    "description": "Type: report, extraction, cluster_summary, transformation, synthesis, comparison, etc."
                },
                "operation": {
                    "type": "string",
                    "description": "Operation that created this: semantic_search, personify, cluster_analysis, etc."
                },
                "content": {
                    "type": "string",
                    "description": "The actual content (markdown, text, JSON, etc.)"
                },
                "content_format": {
                    "type": "string",
                    "description": "Format: markdown (default), json, html, plaintext",
                    "default": "markdown"
                },
                "source_chunk_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Source chunk UUIDs (if applicable)"
                },
                "source_operation_params": {
                    "type": "object",
                    "description": "Parameters used in the operation"
                },
                "topics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Topics/tags for this artifact"
                },
                "auto_embed": {
                    "type": "boolean",
                    "description": "Auto-generate embedding for semantic search (default: true)",
                    "default": True
                }
            },
            "required": ["artifact_type", "operation", "content"]
        },
        "execution_type": "mcp",
        "mcp_tool": "save_artifact",
        "gui_action": None
    },
    {
        "name": "search_artifacts",
        "description": "Semantic search over all saved artifacts. Find reports, extractions, or transformations by content. Use when user wants to find previous work.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query"
                },
                "artifact_type": {
                    "type": "string",
                    "description": "Filter by type (report, extraction, etc.) - optional"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum results (default: 20)",
                    "default": 20
                }
            },
            "required": ["query"]
        },
        "execution_type": "mcp",
        "mcp_tool": "search_artifacts",
        "gui_action": None
    },
    {
        "name": "list_artifacts",
        "description": "List all artifacts with optional filters. Browse your saved semantic outputs. Use for reviewing all saved work.",
        "parameters": {
            "type": "object",
            "properties": {
                "artifact_type": {
                    "type": "string",
                    "description": "Filter by type (optional)"
                },
                "operation": {
                    "type": "string",
                    "description": "Filter by operation (optional)"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum results (default: 50)",
                    "default": 50
                },
                "offset": {
                    "type": "integer",
                    "description": "Pagination offset (default: 0)",
                    "default": 0
                }
            }
        },
        "execution_type": "mcp",
        "mcp_tool": "list_artifacts",
        "gui_action": None
    },
    {
        "name": "get_artifact",
        "description": "Get full details of a specific artifact by ID. Use when user wants to view a saved artifact.",
        "parameters": {
            "type": "object",
            "properties": {
                "artifact_id": {
                    "type": "string",
                    "description": "Artifact UUID"
                }
            },
            "required": ["artifact_id"]
        },
        "execution_type": "mcp",
        "mcp_tool": "get_artifact",
        "gui_action": None
    }
]


class OllamaProvider:
    """LLM provider using Ollama's Python SDK."""

    def __init__(self, model_name: str = "mistral:7b", base_url: str = "http://localhost:11434"):
        self.model_name = model_name
        self.base_url = base_url

    def build_system_prompt(self, tools: List[Dict]) -> str:
        """Build system prompt that teaches LLM to use tools."""
        tools_desc = "\n\n".join([
            f"**{tool['name']}**: {tool['description']}\n"
            f"Parameters: {json.dumps(tool['parameters'], indent=2)}"
            for tool in tools
        ])

        return f"""You are a helpful assistant that can call tools to help users.

When the user asks for something, determine if you need to call a tool.

**Available tools:**

{tools_desc}

**Response format:**

If you need to call a tool, respond with JSON:
{{"tool": "tool_name", "parameters": {{"param1": "value1"}}, "explanation": "Why you're calling this tool"}}

If you don't need a tool, just respond normally.

Always respond in a conversational, helpful tone."""

    async def chat(
        self,
        messages: List[Dict],
        tools: List[Dict]
    ) -> Dict[str, Any]:
        """Send chat request to Ollama and parse response."""
        # Build system prompt with tool definitions
        system_prompt = self.build_system_prompt(tools)

        # Prepend system message
        full_messages = [
            {"role": "system", "content": system_prompt}
        ] + messages

        # Call Ollama API
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model_name,
                    "messages": full_messages,
                    "stream": False
                }
            )
            response.raise_for_status()
            data = response.json()

            # Extract message content
            content = data.get("message", {}).get("content", "")

            # Try to parse as JSON (tool call)
            tool_call = None
            try:
                # Look for JSON in the response
                if "{" in content and "}" in content:
                    start = content.find("{")
                    end = content.rfind("}") + 1
                    json_str = content[start:end]
                    parsed = json.loads(json_str)

                    if "tool" in parsed:
                        tool_call = parsed
            except json.JSONDecodeError:
                pass

            return {
                "content": content,
                "tool_call": tool_call
            }


class LLMProvider(Protocol):
    """Protocol for LLM providers."""

    async def chat(
        self,
        messages: List[Dict],
        tools: List[Dict]
    ) -> Dict[str, Any]:
        """Send chat request and get response with potential tool calls."""
        ...


class ClaudeProvider:
    """LLM provider using Anthropic's Claude API with native tool calling."""

    def __init__(
        self,
        model_name: str = "claude-haiku-4-5-20251001",
        api_key: str = "",
        enable_caching: bool = True,
        max_tokens: int = 4096
    ):
        self.model_name = model_name
        self.enable_caching = enable_caching
        self.max_tokens = max_tokens
        self.client = AsyncAnthropic(api_key=api_key)

    def _convert_tool_to_anthropic_format(self, tool: Dict) -> ToolParam:
        """Convert our tool format to Anthropic's tool format."""
        return {
            "name": tool["name"],
            "description": tool["description"],
            "input_schema": tool["parameters"]
        }

    def _convert_messages_to_anthropic_format(self, messages: List[Dict]) -> tuple[str, List[MessageParam]]:
        """
        Convert messages to Anthropic format.

        Returns:
            Tuple of (system_prompt, anthropic_messages)
        """
        system_prompt = ""
        anthropic_messages = []

        for msg in messages:
            if msg["role"] == "system":
                # Anthropic uses separate system parameter
                system_prompt = msg["content"]
            else:
                anthropic_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })

        return system_prompt, anthropic_messages

    async def chat(
        self,
        messages: List[Dict],
        tools: List[Dict]
    ) -> Dict[str, Any]:
        """
        Send chat request to Claude and parse response with tool calls.

        Uses native Anthropic tool calling API for reliable tool use.
        Implements prompt caching for cost reduction.
        """
        # Convert tools to Anthropic format
        anthropic_tools = [
            self._convert_tool_to_anthropic_format(tool)
            for tool in tools
        ]

        # Convert messages
        system_prompt, anthropic_messages = self._convert_messages_to_anthropic_format(messages)

        # Add system prompt for AUI behavior
        if not system_prompt:
            system_prompt = """You are an intelligent assistant for the Humanizer application.
Your job is to help users accomplish tasks by calling tools and explaining your actions.

When users ask to do something:
1. Determine which tool(s) to use
2. Call the tool with appropriate parameters
3. Explain what you're doing and why

Be conversational, helpful, and concise. Always prefer using tools over just describing what to do."""

        # Prepare request kwargs
        request_kwargs = {
            "model": self.model_name,
            "max_tokens": self.max_tokens,
            "messages": anthropic_messages,
            "tools": anthropic_tools
        }

        # Add system prompt if caching enabled (for cost reduction)
        if self.enable_caching and system_prompt:
            request_kwargs["system"] = [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"}  # Cache system prompt
                }
            ]
        elif system_prompt:
            request_kwargs["system"] = system_prompt

        # Call Claude API
        response = await self.client.messages.create(**request_kwargs)

        # Extract response content and tool calls
        content = ""
        tool_calls = []

        for block in response.content:
            if isinstance(block, TextBlock):
                content += block.text
            elif isinstance(block, ToolUseBlock):
                tool_calls.append({
                    "tool": block.name,
                    "parameters": block.input,
                    "tool_use_id": block.id
                })

        # Return in format expected by AgentService
        if tool_calls:
            # For now, return first tool call (we'll handle multi-tool later)
            return {
                "content": content or f"I'm calling {tool_calls[0]['tool']}...",
                "tool_call": tool_calls[0],
                "all_tool_calls": tool_calls,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                    "cache_creation_input_tokens": getattr(response.usage, "cache_creation_input_tokens", 0),
                    "cache_read_input_tokens": getattr(response.usage, "cache_read_input_tokens", 0)
                }
            }
        else:
            return {
                "content": content,
                "tool_call": None,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                    "cache_creation_input_tokens": getattr(response.usage, "cache_creation_input_tokens", 0),
                    "cache_read_input_tokens": getattr(response.usage, "cache_read_input_tokens", 0)
                }
            }


class AgentService:
    """Core agent service for tool calling and conversation management."""

    def __init__(
        self,
        api_base_url: str = "http://localhost:8000",
        llm_provider: Optional[LLMProvider] = None,
        provider_type: str = "claude"
    ):
        self.api_base_url = api_base_url

        # Initialize LLM provider based on configuration
        if llm_provider:
            self.llm_provider = llm_provider
        elif provider_type == "claude":
            # Import settings here to avoid circular dependency
            from humanizer.config import settings
            self.llm_provider = ClaudeProvider(
                model_name=settings.claude_model,
                api_key=settings.claude_api_key,
                enable_caching=settings.claude_enable_caching,
                max_tokens=settings.aui_max_tokens
            )
        else:  # ollama
            from humanizer.config import settings
            self.llm_provider = OllamaProvider(
                model_name=settings.ollama_model,
                base_url=settings.ollama_base_url
            )

        self.tools = AVAILABLE_TOOLS

        # Initialize MCP client for MCP-specific tools (Phase 2)
        from humanizer.services.mcp_client import MCPClient
        self.mcp_client = MCPClient(api_base_url=api_base_url)

    async def call_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a tool by calling the appropriate endpoint.

        Intelligent routing:
        - MCP tools: Route to MCP server (read_quantum, search_chunks, artifacts, etc.)
        - API tools: Call REST API directly (semantic_search, list_conversations, etc.)

        Args:
            tool_name: Name of tool to execute
            parameters: Tool parameters

        Returns:
            Tool execution result
        """
        # Find tool definition
        tool = next((t for t in self.tools if t["name"] == tool_name), None)
        if not tool:
            raise ValueError(f"Unknown tool: {tool_name}")

        # Intelligent routing: MCP vs API
        execution_type = tool.get("execution_type", "api")

        if execution_type == "mcp":
            # Route to MCP server
            return await self.mcp_client.call_tool(tool_name, parameters)
        else:
            # Route to REST API
            endpoint = tool["api_endpoint"]
            full_url = f"{self.api_base_url}{endpoint}"

            # Call API
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Determine HTTP method from tool definition
                http_method = tool.get("http_method", "POST").upper()

                if http_method == "GET":
                    response = await client.get(full_url, params=parameters)
                elif http_method == "PUT":
                    response = await client.put(full_url, json=parameters)
                elif http_method == "DELETE":
                    response = await client.delete(full_url, params=parameters)
                else:  # POST is default
                    response = await client.post(full_url, json=parameters)

                response.raise_for_status()
                return response.json()

    async def process_message(
        self,
        message: str,
        conversation_history: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Process user message, potentially calling tools.

        Returns:
            - response: Agent's text response
            - tool_call: Tool that was called (if any)
            - tool_result: Result from tool (if any)
            - gui_action: GUI action to perform (if any)
        """
        # Append user message to history
        messages = conversation_history + [
            {"role": "user", "content": message}
        ]

        # Get LLM response
        llm_response = await self.llm_provider.chat(messages, self.tools)

        # Check if LLM wants to call a tool
        tool_call = llm_response.get("tool_call")

        if tool_call:
            # Execute tool
            tool_name = tool_call["tool"]
            parameters = tool_call.get("parameters", {})
            explanation = tool_call.get("explanation", "")

            try:
                tool_result = await self.call_tool(tool_name, parameters)

                # Find GUI action
                tool_def = next((t for t in self.tools if t["name"] == tool_name), None)
                gui_action = tool_def.get("gui_action") if tool_def else None

                # Transform tool result into GUI data if needed
                gui_data = self._transform_tool_result_to_gui_data(tool_name, tool_result, parameters)

                # Build response
                result_summary = self._summarize_tool_result(tool_name, tool_result)

                return {
                    "response": f"{explanation}\n\n{result_summary}",
                    "tool_call": {
                        "tool": tool_name,
                        "parameters": parameters
                    },
                    "tool_result": tool_result,
                    "gui_action": gui_action,
                    "gui_data": gui_data
                }
            except Exception as e:
                return {
                    "response": f"I tried to use {tool_name}, but encountered an error: {str(e)}",
                    "tool_call": tool_call,
                    "tool_result": None,
                    "gui_action": None
                }
        else:
            # No tool call, just return LLM response
            return {
                "response": llm_response["content"],
                "tool_call": None,
                "tool_result": None,
                "gui_action": None
            }

    def _transform_tool_result_to_gui_data(self, tool_name: str, result: Dict[str, Any], parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Transform tool result into GUI action data format."""
        if tool_name == "semantic_search":
            # Extract conversation UUIDs from search results
            results = result.get("results", [])
            conversation_ids = []
            seen = set()

            for r in results:
                conv_id = r.get("conversation_uuid")
                if conv_id and conv_id not in seen:
                    conversation_ids.append(conv_id)
                    seen.add(conv_id)

            # Generate list name from query
            query = parameters.get("query", "search results")
            list_name = f"Search: {query[:50]}"

            return {
                "list_name": list_name,
                "list_description": f"Conversations matching: {query}",
                "conversation_ids": conversation_ids,
                "results": results  # Keep original results too
            }

        # For other tools, return result as-is
        return result

    def _summarize_tool_result(self, tool_name: str, result: Dict[str, Any]) -> str:
        """Generate human-readable summary of tool result."""
        if tool_name == "semantic_search":
            total = result.get("total_results", 0)
            return f"Found {total} relevant conversations. Creating interest list..."

        elif tool_name == "find_neighbors":
            count = len(result.get("results", []))
            return f"Found {count} similar messages. Opening neighbors view..."

        elif tool_name == "find_semantic_clusters":
            clusters = result.get("n_clusters", 0)
            samples = result.get("n_samples", 0)
            return f"Discovered {clusters} semantic clusters from {samples} messages. Opening cluster view..."

        elif tool_name == "list_conversations":
            total = result.get("total", 0)
            return f"Found {total} conversations. Opening conversation list..."

        elif tool_name == "analyze_trm_perturbation":
            max_change = result.get("max_change", {})
            axis = max_change.get("axis", "?")
            delta = max_change.get("delta", 0)
            return f"TRM analysis complete. Largest change: {axis} axis ({delta:.3f}). Opening perturbation view..."

        else:
            return "Tool executed successfully. Opening results..."
