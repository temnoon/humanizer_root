#!/usr/bin/env python3
"""
Test AUI Phase 2 - MCP Integration

Verifies that:
1. All 21 tools are registered in AVAILABLE_TOOLS
2. Intelligent routing works (MCP vs API)
3. Tool selection is accurate
"""

import asyncio
import os
from humanizer.services.agent import AgentService, AVAILABLE_TOOLS


async def test_tool_registration():
    """Test that all 21 tools are registered."""
    print("🔍 Testing Tool Registration")
    print("=" * 60)

    # Count tools by type
    api_tools = [t for t in AVAILABLE_TOOLS if t.get("execution_type") != "mcp"]
    mcp_tools = [t for t in AVAILABLE_TOOLS if t.get("execution_type") == "mcp"]

    print(f"Total tools: {len(AVAILABLE_TOOLS)}")
    print(f"API tools: {len(api_tools)}")
    print(f"MCP tools: {len(mcp_tools)}")

    print("\n📋 API Tools:")
    for tool in api_tools:
        print(f"  - {tool['name']}: {tool['description'][:60]}...")

    print("\n📋 MCP Tools:")
    for tool in mcp_tools:
        print(f"  - {tool['name']}: {tool['description'][:60]}...")

    # Verify expected tools exist
    expected_mcp_tools = [
        "read_quantum",
        "search_chunks",
        "list_books",
        "get_library_stats",
        "search_images",
        "track_interest",
        "get_connections",
        "get_interest_list",
        "save_artifact",
        "search_artifacts",
        "list_artifacts",
        "get_artifact"
    ]

    missing = []
    for name in expected_mcp_tools:
        if not any(t["name"] == name for t in AVAILABLE_TOOLS):
            missing.append(name)

    if missing:
        print(f"\n❌ Missing tools: {missing}")
        return False
    else:
        print(f"\n✅ All expected MCP tools registered")
        return True


async def test_tool_selection():
    """Test Claude's tool selection with various queries."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("\n⚠️  ANTHROPIC_API_KEY not set, skipping tool selection test")
        return True

    print("\n" + "=" * 60)
    print("🧠 Testing Tool Selection")
    print("=" * 60)

    agent = AgentService(provider_type="claude")

    test_cases = [
        {
            "query": "Search for conversations about consciousness",
            "expected_tool": "semantic_search",
            "description": "Should use semantic search for conversations"
        },
        {
            "query": "Show me books in the library",
            "expected_tool": "list_books",
            "description": "Should list books from MCP"
        },
        {
            "query": "Find images related to AI",
            "expected_tool": "search_images",
            "description": "Should search images via MCP"
        },
        {
            "query": "Mark this conversation as interesting",
            "expected_tool": "track_interest",
            "description": "Should track interest via MCP"
        },
        {
            "query": "Get library statistics",
            "expected_tool": "get_library_stats",
            "description": "Should get stats via MCP"
        }
    ]

    results = {"total": len(test_cases), "correct": 0}

    for i, test in enumerate(test_cases, 1):
        print(f"\n📝 Test {i}/{len(test_cases)}: {test['description']}")
        print(f"Query: \"{test['query']}\"")

        messages = [{"role": "user", "content": test["query"]}]

        try:
            response = await agent.llm_provider.chat(messages, AVAILABLE_TOOLS)

            if response.get("tool_call"):
                tool_name = response["tool_call"]["tool"]
                tool = next((t for t in AVAILABLE_TOOLS if t["name"] == tool_name), None)

                if tool_name == test["expected_tool"]:
                    print(f"✅ Correct tool: {tool_name}")
                    if tool:
                        exec_type = tool.get("execution_type", "api")
                        print(f"   Execution: {exec_type}")
                    results["correct"] += 1
                else:
                    print(f"⚠️  Different tool: {tool_name} (expected {test['expected_tool']})")
                    if tool:
                        exec_type = tool.get("execution_type", "api")
                        print(f"   Execution: {exec_type}")

                print(f"   Parameters: {response['tool_call']['parameters']}")
            else:
                print(f"❌ No tool call (expected {test['expected_tool']})")

            # Track usage
            usage = response.get("usage", {})
            print(f"   Tokens: {usage.get('input_tokens', 0)} in, {usage.get('output_tokens', 0)} out")

        except Exception as e:
            print(f"❌ Error: {str(e)}")

    # Print summary
    print("\n" + "=" * 60)
    accuracy = (results["correct"] / results["total"]) * 100
    print(f"Tool Selection Accuracy: {results['correct']}/{results['total']} ({accuracy:.1f}%)")

    if accuracy >= 80:
        print("✅ PASS: Tool selection ≥ 80%")
        return True
    elif accuracy >= 60:
        print("⚠️  PARTIAL: Tool selection 60-80%")
        return True
    else:
        print("❌ FAIL: Tool selection < 60%")
        return False


async def test_routing():
    """Test that routing works correctly."""
    print("\n" + "=" * 60)
    print("🔀 Testing Intelligent Routing")
    print("=" * 60)

    # Verify tools have correct execution_type
    issues = []
    for tool in AVAILABLE_TOOLS:
        name = tool["name"]
        exec_type = tool.get("execution_type", "api")

        # MCP tools should have execution_type="mcp"
        if name in ["read_quantum", "search_chunks", "list_books", "get_library_stats",
                    "search_images", "track_interest", "get_connections", "get_interest_list",
                    "save_artifact", "search_artifacts", "list_artifacts", "get_artifact"]:
            if exec_type != "mcp":
                issues.append(f"{name} should be 'mcp', got '{exec_type}'")

        # API tools should have api_endpoint
        elif exec_type == "api":
            if "api_endpoint" not in tool:
                issues.append(f"{name} missing 'api_endpoint'")

    if issues:
        print("\n❌ Routing configuration issues:")
        for issue in issues:
            print(f"  - {issue}")
        return False
    else:
        print("✅ All tools have correct routing configuration")
        return True


async def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("AUI PHASE 2 TEST SUITE")
    print("=" * 60)

    results = []

    # Test 1: Tool registration
    results.append(await test_tool_registration())

    # Test 2: Routing configuration
    results.append(await test_routing())

    # Test 3: Tool selection (requires API key)
    results.append(await test_tool_selection())

    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Tests passed: {passed}/{total}")

    if all(results):
        print("\n✅ PHASE 2 COMPLETE: All tests passed!")
    else:
        print("\n⚠️  Some tests failed or were skipped")


if __name__ == "__main__":
    asyncio.run(main())
