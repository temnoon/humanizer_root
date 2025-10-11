#!/usr/bin/env python3
"""
Humanizer MCP Server v2 - API-First

Refactored to call HTTP API instead of direct database access.
All tools wrapped with AUI tracking for adaptive learning.
"""

from mcp.server import Server
from mcp.types import Tool, TextContent
import asyncio
import json

from src.api_client import HumanizerAPIClient


# Create MCP server
app = Server("humanizer")

# Create API client (singleton)
api_client = None


async def get_api_client() -> HumanizerAPIClient:
    """Get or create API client."""
    global api_client
    if api_client is None:
        api_client = HumanizerAPIClient()
    return api_client


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available Humanizer tools."""
    return [
        Tool(
            name="read_quantum",
            description="Read text with quantum measurements (TRM + POVMs). Returns tetralemma probabilities and stance.",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "Text to read (any length)"
                    },
                    "povm_packs": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "POVM packs to use (default: ['tetralemma'])",
                        "default": ["tetralemma"]
                    }
                },
                "required": ["text"]
            }
        ),

        Tool(
            name="search_chatgpt",
            description="Search your ChatGPT conversation archives. Finds messages by text query.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum results (default: 20)",
                        "default": 20
                    },
                    "author_role": {
                        "type": "string",
                        "description": "Filter by role: user, assistant, system",
                        "enum": ["user", "assistant", "system"]
                    }
                },
                "required": ["query"]
            }
        ),

        Tool(
            name="get_chatgpt_stats",
            description="Get statistics about your ChatGPT archives (total conversations, messages, date range).",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),

        Tool(
            name="get_recommendations",
            description="Get adaptive recommendations based on your usage patterns. Learn what works best for you.",
            inputSchema={
                "type": "object",
                "properties": {
                    "context": {
                        "type": "string",
                        "description": "Current context (e.g., 'reading', 'searching')",
                        "enum": ["reading", "searching", "analyzing"]
                    }
                }
            }
        ),

        Tool(
            name="get_my_stats",
            description="Get your tool usage statistics (most used tools, success rates, recent activity).",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Number of recent events (default: 10)",
                        "default": 10
                    }
                }
            }
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Execute Humanizer tool via HTTP API."""

    client = await get_api_client()

    try:
        # Route to appropriate API method
        if name == "read_quantum":
            text = arguments.get("text")
            povm_packs = arguments.get("povm_packs", ["tetralemma"])

            result = await client.start_reading(
                text=text,
                povm_packs=povm_packs
            )

            # Format response
            output = f"""# Quantum Reading

**Text:** {text[:100]}{'...' if len(text) > 100 else ''}

**Density Matrix:**
- Purity: {result.get('rho_meta', {}).get('purity', 'N/A')}
- Entropy: {result.get('rho_meta', {}).get('entropy', 'N/A')}

**POVM Measurements:**
"""
            for pack_name, readings in result.get('povm_readings', {}).items():
                output += f"\n**{pack_name.title()}:**\n"
                for axis, prob in readings.items():
                    bar = "█" * int(prob * 30)
                    output += f"  {axis:12s}: {prob:.3f} {bar}\n"

            if result.get('stance'):
                output += f"\n**Stance:** {result['stance']}\n"

            output += f"\n**Halt Probability:** {result.get('halt_p', 0):.3f}\n"
            output += f"**Reading ID:** `{result.get('reading_id')}`\n"

            return [TextContent(type="text", text=output)]

        elif name == "search_chatgpt":
            query = arguments["query"]
            limit = arguments.get("limit", 20)
            author_role = arguments.get("author_role")

            result = await client.search_chatgpt(
                query=query,
                limit=limit,
                author_role=author_role
            )

            # Format response
            output = f"""# ChatGPT Search Results

**Query:** "{query}"
**Found:** {result['count']} messages

"""
            for i, msg in enumerate(result.get('results', []), 1):
                content_preview = (msg.get('content_text') or '')[:200]
                output += f"""**{i}. [{msg['author_role'].upper()}]**
{content_preview}{'...' if len(msg.get('content_text', '')) > 200 else ''}

*Conversation:* `{msg['conversation_uuid']}`
*Message:* `{msg['uuid']}`
*Date:* {msg.get('created_at', 'Unknown')}

---

"""

            return [TextContent(type="text", text=output)]

        elif name == "get_chatgpt_stats":
            result = await client.get_chatgpt_stats()

            # Format response
            output = f"""# ChatGPT Archive Statistics

**Total Conversations:** {result['total_conversations']:,}
**Total Messages:** {result['total_messages']:,}
**Total Media:** {result['total_media']:,}

**Archives Ingested:** {', '.join(result['archives_ingested'])}

"""
            if result.get('date_range'):
                output += f"""**Date Range:**
- Earliest: {result['date_range']['earliest']}
- Latest: {result['date_range']['latest']}

"""

            if result.get('top_conversations'):
                output += "**Top Conversations:**\n"
                for i, conv in enumerate(result['top_conversations'][:5], 1):
                    output += f"{i}. {conv['title']} ({conv['message_count']} messages)\n"

            return [TextContent(type="text", text=output)]

        elif name == "get_recommendations":
            context = arguments.get("context")

            result = await client.get_recommendations(context=context)

            # Format response
            output = f"""# Adaptive Recommendations

"""
            if context:
                output += f"**Context:** {context}\n\n"

            based_on = result.get('based_on', {})
            output += f"""**Based On:**
- Tool calls: {based_on.get('tool_usage_events', 0)}
- Success rate: {based_on.get('success_rate', 0):.1%}
- Days active: {based_on.get('days_active', 0)}
- Unique tools: {based_on.get('unique_tools_used', 0)}

"""

            recommendations = result.get('recommendations', [])
            if recommendations:
                output += "**Recommendations:**\n\n"
                for i, rec in enumerate(recommendations, 1):
                    rec_type = rec['type']
                    confidence = rec.get('confidence', 0)
                    conf_bar = "●" * int(confidence * 10)

                    output += f"**{i}. "

                    if rec_type == "tool":
                        output += f"Use `{rec['tool_name']}`**\n"
                    elif rec_type == "parameter":
                        output += f"Parameter `{rec['parameter']}` = `{rec['suggested_value']}`**\n"
                    elif rec_type == "contextual_tool":
                        output += f"Contextual: `{rec['tool_name']}`**\n"

                    output += f"   *{rec['reason']}*\n"
                    output += f"   Confidence: {confidence:.0%} {conf_bar}\n\n"
            else:
                output += "*Not enough data yet for recommendations. Keep using tools!*\n"

            return [TextContent(type="text", text=output)]

        elif name == "get_my_stats":
            limit = arguments.get("limit", 10)

            result = await client.get_tool_usage_stats(limit=limit)

            # Format response
            output = f"""# Your Tool Usage Statistics

**Total Tool Calls:** {result['total_tool_calls']:,}
**Overall Success Rate:** {result['success_rate']:.1%}

"""

            most_used = result.get('most_used_tools', [])
            if most_used:
                output += "**Most Used Tools:**\n"
                for i, tool in enumerate(most_used, 1):
                    output += f"{i}. `{tool['tool_name']}` - {tool['count']} calls ({tool['success_rate']:.0%} success)\n"

            output += "\n**Recent Activity:**\n"
            for event in result.get('recent_activity', [])[:5]:
                status = "✓" if event['success'] else "✗"
                output += f"- {status} `{event['tool_name']}` ({event.get('execution_time_ms', 0):.0f}ms)\n"

            return [TextContent(type="text", text=output)]

        else:
            return [TextContent(
                type="text",
                text=f"Unknown tool: {name}"
            )]

    except Exception as e:
        error_text = f"Error executing {name}: {str(e)}"
        return [TextContent(type="text", text=error_text)]


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
