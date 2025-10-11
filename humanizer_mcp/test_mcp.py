#!/usr/bin/env python3
"""Test MCP server manually (without Claude Code)."""

import asyncio
import sys
sys.path.insert(0, 'src')

from tools import (
    list_books_tool,
    get_library_stats_tool,
    track_interest_tool,
    get_interest_list_tool
)
from models import TrackInterestRequest, ItemType


async def main():
    print("Testing Humanizer MCP Server")
    print("=" * 50)
    print()

    # Test 1: List books
    print("1. Testing list_books...")
    try:
        books = await list_books_tool()
        print(f"✓ Found {books.count} books")
        if books.books:
            print(f"  First book: {books.books[0].title}")
    except Exception as e:
        print(f"✗ Error: {e}")
        print("  (Make sure Humanizer backend is running on localhost:8000)")
    print()

    # Test 2: Get library stats
    print("2. Testing get_library_stats...")
    try:
        stats = await get_library_stats_tool()
        print(f"✓ Total books: {stats.total_books}")
        print(f"  Total chunks: {stats.total_chunks}")
        print(f"  Total embeddings: {stats.total_embeddings}")
    except Exception as e:
        print(f"✗ Error: {e}")
    print()

    # Test 3: Track interest (local database)
    print("3. Testing track_interest (local database)...")
    try:
        request = TrackInterestRequest(
            item_type=ItemType.CHUNK,
            item_id="test_chunk_123",
            title="Test Interest Item",
            context="Testing MCP server"
        )
        result = await track_interest_tool(request)
        print(f"✓ Tracked interest: {result.item.title}")
        print(f"  Item ID in database: {result.item.id}")
    except Exception as e:
        print(f"✗ Error: {e}")
    print()

    # Test 4: Get interest list
    print("4. Testing get_interest_list...")
    try:
        from models import GetInterestListRequest
        request = GetInterestListRequest(limit=10)
        interests = await get_interest_list_tool(request)
        print(f"✓ Interest list contains {interests.count} items")
        for item in interests.items[:3]:
            print(f"  - {item.title or item.item_id} ({item.marked_at})")
    except Exception as e:
        print(f"✗ Error: {e}")
    print()

    print("=" * 50)
    print("MCP server tests complete!")
    print()
    print("To use with Claude Code:")
    print("1. Add to ~/.config/claude-code/mcp.json")
    print("2. Restart Claude Code")
    print("3. Tools will appear automatically")


if __name__ == "__main__":
    asyncio.run(main())
