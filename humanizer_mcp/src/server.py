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
    get_artifact_tool
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
    GetArtifactRequest
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
                        "default": true
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

        else:
            return [TextContent(
                type="text",
                text=f"Unknown tool: {name}"
            )]

        # Convert Pydantic model to JSON
        return [TextContent(
            type="text",
            text=result.model_dump_json(indent=2)
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
