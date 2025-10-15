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
from typing import List, Dict, Any, Optional
from datetime import datetime
from uuid import UUID

# Import all available tools
AVAILABLE_TOOLS = [
    {
        "name": "semantic_search",
        "description": "Search ChatGPT conversations and messages using semantic similarity. Use this when user wants to find conversations or messages by meaning, not exact keywords.",
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
        "gui_action": "open_search_results"
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


class AgentService:
    """Core agent service for tool calling and conversation management."""

    def __init__(
        self,
        api_base_url: str = "http://localhost:8000",
        llm_provider: Optional[OllamaProvider] = None
    ):
        self.api_base_url = api_base_url
        self.llm_provider = llm_provider or OllamaProvider()
        self.tools = AVAILABLE_TOOLS

    async def call_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool by calling the appropriate API endpoint."""
        # Find tool definition
        tool = next((t for t in self.tools if t["name"] == tool_name), None)
        if not tool:
            raise ValueError(f"Unknown tool: {tool_name}")

        endpoint = tool["api_endpoint"]
        full_url = f"{self.api_base_url}{endpoint}"

        # Call API
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Determine HTTP method from endpoint
            # Most endpoints use POST for data operations
            if "/conversations" in endpoint and "GET" in str(tool):
                # GET for listing conversations
                response = await client.get(full_url, params=parameters)
            else:
                # POST is default for most operations
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
                    "gui_data": tool_result
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

    def _summarize_tool_result(self, tool_name: str, result: Dict[str, Any]) -> str:
        """Generate human-readable summary of tool result."""
        if tool_name == "semantic_search":
            total = result.get("total_results", 0)
            return f"Found {total} relevant messages. Opening search results view..."

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
