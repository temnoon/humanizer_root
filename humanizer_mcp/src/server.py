#!/usr/bin/env python3
"""Humanizer MCP Server - Expose Humanizer API to MCP agents."""

from mcp.server import Server
from mcp.types import Tool, TextContent
import asyncio
import json

from src.tools import (
    read_quantum,
    search_chunks_tool,
    list_books_tool,
    get_library_stats_tool,
    search_images_tool,
    track_interest_tool,
    get_connections_tool,
    get_interest_list_tool,
    save_artifact_tool,
    search_artifacts_tool,
    list_artifacts_tool,
    get_artifact_tool,
    # Embedding explorer tools
    semantic_search_tool,
    find_neighbors_tool,
    compute_direction_tool,
    analyze_perturbation_tool,
    explore_trajectory_tool,
    find_clusters_tool,
    # ChatGPT conversation tools
    list_conversations_tool,
    get_conversation_tool,
    # Transformation tools
    transform_text_tool
)
from src.models import (
    ReadQuantumRequest,
    SearchRequest,
    TrackInterestRequest,
    GetConnectionsRequest,
    GetInterestListRequest,
    SaveArtifactRequest,
    SearchArtifactsRequest,
    ListArtifactsRequest,
    GetArtifactRequest,
    # Embedding explorer models
    SemanticSearchRequest,
    FindNeighborsRequest,
    ComputeDirectionRequest,
    PerturbationRequest,
    TrajectoryRequest,
    ClustersRequest,
    # ChatGPT conversation models
    ListConversationsRequest,
    GetConversationRequest,
    # Transformation models
    TransformTextRequest
)

# Create MCP server
app = Server("humanizer")


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available Humanizer tools."""
    return [
        Tool(
            name="read_quantum",
            description="Read text with quantum measurements (POVMs). Returns four-corner probabilities for dialectical axes.",
            inputSchema={
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
            }
        ),

        Tool(
            name="search_chunks",
            description="Semantic search across all text chunks. Finds chunks similar to your query.",
            inputSchema={
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
            }
        ),

        Tool(
            name="list_books",
            description="Get list of all books in the library with metadata.",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),

        Tool(
            name="get_library_stats",
            description="Get library statistics (book count, chunk count, coverage, etc.).",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),

        Tool(
            name="search_images",
            description="Search for images in the archive.",
            inputSchema={
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
            }
        ),

        Tool(
            name="track_interest",
            description="Add item to your interest list (breadcrumbs + wishlist). Tracks what you're exploring and how you got there.",
            inputSchema={
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
            }
        ),

        Tool(
            name="get_connections",
            description="Get connection graph showing transformations between entities (functors). How did you get from A to B?",
            inputSchema={
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
            }
        ),

        Tool(
            name="get_interest_list",
            description="Get your interest list (breadcrumbs + wishlist). See what you've marked as interesting.",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Maximum items (default: 50)",
                        "default": 50
                    }
                }
            }
        ),

        # Artifact tools
        Tool(
            name="save_artifact",
            description="Save any semantic output as a persistent artifact. Artifacts can be searched, composed, and iterated on.",
            inputSchema={
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
            }
        ),

        Tool(
            name="search_artifacts",
            description="Semantic search over all saved artifacts. Find reports, extractions, or transformations by content.",
            inputSchema={
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
            }
        ),

        Tool(
            name="list_artifacts",
            description="List all artifacts with optional filters. Browse your saved semantic outputs.",
            inputSchema={
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
            }
        ),

        Tool(
            name="get_artifact",
            description="Get full details of a specific artifact by ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "artifact_id": {
                        "type": "string",
                        "description": "Artifact UUID"
                    }
                },
                "required": ["artifact_id"]
            }
        ),

        # ================================================================
        # EMBEDDING EXPLORER TOOLS
        # ================================================================

        Tool(
            name="semantic_search",
            description="Search ChatGPT conversations and messages using semantic similarity. Find content by meaning, not just keywords.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query text"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Number of results (default: 10, max: 100)",
                        "default": 10
                    }
                },
                "required": ["query"]
            }
        ),

        Tool(
            name="find_neighbors",
            description="Find messages similar to a specific message. Explore connections in semantic space.",
            inputSchema={
                "type": "object",
                "properties": {
                    "message_uuid": {
                        "type": "string",
                        "description": "UUID of the message to find neighbors for"
                    },
                    "k": {
                        "type": "integer",
                        "description": "Number of neighbors (default: 10)",
                        "default": 10
                    }
                },
                "required": ["message_uuid"]
            }
        ),

        Tool(
            name="compute_direction",
            description="Compute semantic direction vector between two concepts (e.g., 'formal' vs 'casual'). Used for semantic navigation.",
            inputSchema={
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
            }
        ),

        Tool(
            name="analyze_perturbation",
            description="Analyze how TRM density matrix changes when text is perturbed in a semantic direction. Shows which POVM axes change most.",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "Text to analyze"
                    },
                    "positive_query": {
                        "type": "string",
                        "description": "Direction to move toward (optional)"
                    },
                    "negative_query": {
                        "type": "string",
                        "description": "Direction to move away from (optional)"
                    },
                    "magnitude": {
                        "type": "number",
                        "description": "Perturbation strength (0.0-1.0, default: 0.1)",
                        "default": 0.1
                    },
                    "povm_pack": {
                        "type": "string",
                        "description": "POVM pack to use (default: tetralemma)",
                        "enum": ["tetralemma", "tone", "ontology", "pragmatics", "audience"],
                        "default": "tetralemma"
                    }
                },
                "required": ["text"]
            }
        ),

        Tool(
            name="explore_trajectory",
            description="Explore semantic trajectory - how TRM measurements change along a semantic path. Visualize semantic transformations.",
            inputSchema={
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
                        "description": "Number of steps (default: 5)",
                        "default": 5
                    },
                    "step_size": {
                        "type": "number",
                        "description": "Step size (default: 0.05)",
                        "default": 0.05
                    }
                },
                "required": ["text", "positive_query", "negative_query"]
            }
        ),

        Tool(
            name="find_clusters",
            description="Find semantic clusters in embedding space. Discover conceptual groupings in your conversations.",
            inputSchema={
                "type": "object",
                "properties": {
                    "n_samples": {
                        "type": "integer",
                        "description": "Number of messages to sample (default: 1000)",
                        "default": 1000
                    },
                    "n_clusters": {
                        "type": "integer",
                        "description": "Number of clusters (default: 5)",
                        "default": 5
                    }
                }
            }
        ),

        # ================================================================
        # CHATGPT CONVERSATION TOOLS
        # ================================================================

        Tool(
            name="list_conversations",
            description="List all ChatGPT conversations with pagination and optional search. Browse conversation history.",
            inputSchema={
                "type": "object",
                "properties": {
                    "page": {
                        "type": "integer",
                        "description": "Page number (default: 1)",
                        "default": 1
                    },
                    "page_size": {
                        "type": "integer",
                        "description": "Results per page (default: 50)",
                        "default": 50
                    },
                    "search": {
                        "type": "string",
                        "description": "Search query for conversation titles (optional)"
                    }
                }
            }
        ),

        Tool(
            name="get_conversation",
            description="Get full conversation details including all messages. View complete conversation history.",
            inputSchema={
                "type": "object",
                "properties": {
                    "conversation_uuid": {
                        "type": "string",
                        "description": "Conversation UUID"
                    }
                },
                "required": ["conversation_uuid"]
            }
        ),

        # ================================================================
        # TRANSFORMATION TOOLS
        # ================================================================

        Tool(
            name="transform_text",
            description="Transform text using TRM iterative method. Change style, tone, or semantic properties with closed-loop feedback.",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "Text to transform"
                    },
                    "povm_pack": {
                        "type": "string",
                        "description": "POVM pack to use (default: tone)",
                        "enum": ["tetralemma", "tone", "ontology", "pragmatics", "audience"],
                        "default": "tone"
                    },
                    "target_stance": {
                        "type": "object",
                        "description": "Target semantic coordinates (optional)"
                    },
                    "max_iterations": {
                        "type": "integer",
                        "description": "Max transformation iterations (default: 5)",
                        "default": 5
                    }
                },
                "required": ["text"]
            }
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Execute Humanizer tool with Pydantic validation."""

    try:
        # Route to appropriate tool with validated request
        if name == "read_quantum":
            request = ReadQuantumRequest(**arguments)
            result = await read_quantum(request)

        elif name == "search_chunks":
            request = SearchRequest(**arguments)
            result = await search_chunks_tool(request)

        elif name == "list_books":
            result = await list_books_tool()

        elif name == "get_library_stats":
            result = await get_library_stats_tool()

        elif name == "search_images":
            request = SearchRequest(**arguments)
            result = await search_images_tool(request)

        elif name == "track_interest":
            request = TrackInterestRequest(**arguments)
            result = await track_interest_tool(request)

        elif name == "get_connections":
            request = GetConnectionsRequest(**arguments)
            result = await get_connections_tool(request)

        elif name == "get_interest_list":
            request = GetInterestListRequest(**arguments)
            result = await get_interest_list_tool(request)

        # Artifact tools
        elif name == "save_artifact":
            request = SaveArtifactRequest(**arguments)
            result = await save_artifact_tool(request)

        elif name == "search_artifacts":
            request = SearchArtifactsRequest(**arguments)
            result = await search_artifacts_tool(request)

        elif name == "list_artifacts":
            request = ListArtifactsRequest(**arguments)
            result = await list_artifacts_tool(request)

        elif name == "get_artifact":
            request = GetArtifactRequest(**arguments)
            result = await get_artifact_tool(request)

        # Embedding explorer tools
        elif name == "semantic_search":
            request = SearchRequest(**arguments)
            result = await semantic_search_tool(request)

        elif name == "find_neighbors":
            message_uuid = arguments.get("message_uuid")
            k = arguments.get("k", 10)
            result = await find_neighbors_tool(message_uuid, k)

        elif name == "compute_direction":
            positive_query = arguments.get("positive_query")
            negative_query = arguments.get("negative_query")
            result = await compute_direction_tool(positive_query, negative_query)

        elif name == "analyze_perturbation":
            text = arguments.get("text")
            positive_query = arguments.get("positive_query")
            negative_query = arguments.get("negative_query")
            magnitude = arguments.get("magnitude", 0.1)
            povm_pack = arguments.get("povm_pack", "tetralemma")
            result = await analyze_perturbation_tool(
                text, positive_query, negative_query, magnitude, povm_pack
            )

        elif name == "explore_trajectory":
            text = arguments.get("text")
            positive_query = arguments.get("positive_query")
            negative_query = arguments.get("negative_query")
            steps = arguments.get("steps", 5)
            step_size = arguments.get("step_size", 0.05)
            result = await explore_trajectory_tool(
                text, positive_query, negative_query, steps, step_size
            )

        elif name == "find_clusters":
            n_samples = arguments.get("n_samples", 1000)
            n_clusters = arguments.get("n_clusters", 5)
            result = await find_clusters_tool(n_samples, n_clusters)

        # ChatGPT conversation tools
        elif name == "list_conversations":
            page = arguments.get("page", 1)
            page_size = arguments.get("page_size", 50)
            search = arguments.get("search")
            result = await list_conversations_tool(page, page_size, search)

        elif name == "get_conversation":
            conversation_uuid = arguments.get("conversation_uuid")
            result = await get_conversation_tool(conversation_uuid)

        # Transformation tools
        elif name == "transform_text":
            text = arguments.get("text")
            povm_pack = arguments.get("povm_pack", "tone")
            target_stance = arguments.get("target_stance")
            max_iterations = arguments.get("max_iterations", 5)
            result = await transform_text_tool(
                text, povm_pack, target_stance, max_iterations
            )

        else:
            return [TextContent(
                type="text",
                text=f"Unknown tool: {name}"
            )]

        # Convert result to JSON (handles both Pydantic models and dicts)
        if hasattr(result, 'model_dump_json'):
            # Pydantic model
            result_json = result.model_dump_json(indent=2)
        else:
            # Plain dict
            result_json = json.dumps(result, indent=2, default=str)

        return [TextContent(
            type="text",
            text=result_json
        )]

    except Exception as e:
        return [TextContent(
            type="text",
            text=f"Error executing {name}: {str(e)}"
        )]


async def main():
    """Run MCP server."""
    from mcp.server.stdio import stdio_server

    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())
