#!/usr/bin/env python3
"""
Test Claude Provider for AUI

Tests the new ClaudeProvider with tool calling to verify:
1. Tool calling accuracy
2. Prompt caching functionality
3. Cost reduction metrics
"""

import asyncio
import os
from humanizer.services.agent import ClaudeProvider, AVAILABLE_TOOLS


async def test_claude_provider():
    """Test Claude Haiku 4.5 with tool calling."""

    # Get API key from environment
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ ANTHROPIC_API_KEY not set in environment")
        print("Set it with: export ANTHROPIC_API_KEY='your-key-here'")
        return

    print("🚀 Testing Claude Haiku 4.5 Provider")
    print("=" * 60)

    # Create provider
    provider = ClaudeProvider(
        model_name="claude-haiku-4-5-20251001",
        api_key=api_key,
        enable_caching=True,
        max_tokens=4096
    )

    # Test queries
    test_cases = [
        {
            "query": "Find conversations about consciousness",
            "expected_tool": "semantic_search",
            "description": "Should use semantic search"
        },
        {
            "query": "Show me my conversation history",
            "expected_tool": "list_conversations",
            "description": "Should list conversations"
        },
        {
            "query": "Transform this text to be more formal: 'hey what's up'",
            "expected_tool": "transform_text",
            "description": "Should use text transformation"
        }
    ]

    results = {
        "total": len(test_cases),
        "correct_tool": 0,
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "cache_hits": 0,
        "cache_misses": 0
    }

    for i, test in enumerate(test_cases, 1):
        print(f"\n📝 Test {i}/{len(test_cases)}: {test['description']}")
        print(f"Query: \"{test['query']}\"")

        messages = [
            {"role": "user", "content": test["query"]}
        ]

        try:
            response = await provider.chat(messages, AVAILABLE_TOOLS)

            # Check if correct tool was selected
            if response.get("tool_call"):
                tool_name = response["tool_call"]["tool"]
                if tool_name == test["expected_tool"]:
                    print(f"✅ Correct tool: {tool_name}")
                    results["correct_tool"] += 1
                else:
                    print(f"⚠️  Wrong tool: {tool_name} (expected {test['expected_tool']})")

                print(f"   Parameters: {response['tool_call']['parameters']}")
            else:
                print(f"❌ No tool call (expected {test['expected_tool']})")
                print(f"   Response: {response['content'][:100]}")

            # Track usage
            usage = response.get("usage", {})
            results["total_input_tokens"] += usage.get("input_tokens", 0)
            results["total_output_tokens"] += usage.get("output_tokens", 0)

            cache_read = usage.get("cache_read_input_tokens", 0)
            cache_create = usage.get("cache_creation_input_tokens", 0)

            if cache_read > 0:
                results["cache_hits"] += 1
                print(f"   💾 Cache hit: {cache_read} tokens")
            elif cache_create > 0:
                results["cache_misses"] += 1
                print(f"   📝 Cache create: {cache_create} tokens")

            print(f"   Tokens: {usage.get('input_tokens', 0)} in, {usage.get('output_tokens', 0)} out")

        except Exception as e:
            print(f"❌ Error: {str(e)}")

    # Print summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)

    accuracy = (results["correct_tool"] / results["total"]) * 100
    print(f"Tool Selection Accuracy: {results['correct_tool']}/{results['total']} ({accuracy:.1f}%)")
    print(f"Total Input Tokens: {results['total_input_tokens']}")
    print(f"Total Output Tokens: {results['total_output_tokens']}")
    print(f"Cache Hits: {results['cache_hits']}")
    print(f"Cache Misses: {results['cache_misses']}")

    # Estimate cost
    # Haiku 4.5: $1/M input, $5/M output
    # With caching: 90% discount on cached input tokens
    input_cost = (results["total_input_tokens"] / 1_000_000) * 1.0
    output_cost = (results["total_output_tokens"] / 1_000_000) * 5.0
    total_cost = input_cost + output_cost

    print(f"\n💰 Estimated Cost: ${total_cost:.4f}")
    print(f"   (Input: ${input_cost:.4f}, Output: ${output_cost:.4f})")

    if accuracy >= 90:
        print("\n✅ PASS: Tool calling accuracy ≥ 90%")
    elif accuracy >= 70:
        print("\n⚠️  PARTIAL: Tool calling accuracy 70-90%")
    else:
        print("\n❌ FAIL: Tool calling accuracy < 70%")


if __name__ == "__main__":
    asyncio.run(test_claude_provider())
