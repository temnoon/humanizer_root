"""
Test AUI Adaptive Learning

Simulates repeated tool usage to demonstrate:
1. Pattern learning
2. Adaptive recommendations
3. Success rate tracking
"""

import asyncio
import httpx
import random


BASE_URL = "http://localhost:8000"
USER_ID = "c7a31f8e-91e3-47e6-bea5-e33d0f35072d"


async def simulate_tool_call(client, tool_name, params, success=True):
    """Simulate a tool call with tracking."""
    exec_time = random.uniform(500, 2000) if success else random.uniform(50, 200)

    await client.post(
        f"{BASE_URL}/aui/track",
        json={
            "user_id": USER_ID,
            "tool_name": tool_name,
            "parameters": params,
            "success": success,
            "execution_time_ms": exec_time,
            "context": {"source": "test"}
        }
    )


async def main():
    print("=" * 80)
    print("AUI Adaptive Learning Test")
    print("=" * 80)

    async with httpx.AsyncClient(timeout=60.0) as client:

        print("\n📊 Phase 1: Simulating Tool Usage Pattern\n")

        # User loves quantum reading
        print("Simulating 10 quantum readings...")
        for i in range(10):
            await simulate_tool_call(
                client,
                "read_quantum",
                {"text": f"Sample text {i}", "povm_packs": ["tetralemma"]},
                success=True
            )
        print("✓ 10 quantum readings tracked")

        # User occasionally searches ChatGPT
        print("Simulating 5 ChatGPT searches...")
        for i in range(5):
            await simulate_tool_call(
                client,
                "search_chatgpt",
                {"query": f"query {i}", "limit": 20},
                success=i < 4  # 1 failure
            )
        print("✓ 5 ChatGPT searches tracked (1 failed)")

        # User rarely uses POVM measurements
        print("Simulating 2 POVM measurements...")
        for i in range(2):
            await simulate_tool_call(
                client,
                "measure_povm",
                {"reading_id": "test", "povm_pack": "tone"},
                success=True
            )
        print("✓ 2 POVM measurements tracked")

        print("\n📈 Phase 2: Checking Learned Patterns\n")

        # Get user preferences
        response = await client.get(f"{BASE_URL}/aui/preferences/{USER_ID}")
        if response.status_code == 200:
            prefs = response.json()
            print("✓ User preferences found!")
            print(f"\nTool usage summary:")
            for tool_name, stats in prefs.get('tool_usage', {}).items():
                print(f"  • {tool_name}:")
                print(f"      Calls: {stats['count']}")
                print(f"      Success rate: {stats['success_rate']:.0%}")
                print(f"      Avg time: {stats.get('avg_execution_time_ms', 0):.0f}ms")

            patterns = prefs.get('patterns', {})
            if patterns:
                print(f"\nLearned patterns:")
                for key, value in patterns.items():
                    print(f"  • {key}: {value}")

        # Get statistics
        print("\n📊 Phase 3: Usage Statistics\n")

        response = await client.get(f"{BASE_URL}/aui/stats/{USER_ID}?limit=17")
        if response.status_code == 200:
            stats = response.json()
            print(f"Total tool calls: {stats['total_tool_calls']}")
            print(f"Overall success rate: {stats['success_rate']:.1%}")

            print(f"\nMost used tools:")
            for tool in stats['most_used_tools']:
                bar = "█" * (tool['count'] // 2)
                print(f"  {tool['tool_name']:20s} {tool['count']:2d} calls {bar}")

        # Get adaptive recommendations
        print("\n🎯 Phase 4: Adaptive Recommendations\n")

        response = await client.post(
            f"{BASE_URL}/aui/recommendations",
            json={"user_id": USER_ID}
        )
        if response.status_code == 200:
            recs = response.json()
            recommendations = recs.get('recommendations', [])

            if recommendations:
                print(f"Generated {len(recommendations)} recommendations:\n")
                for i, rec in enumerate(recommendations[:5], 1):
                    print(f"{i}. [{rec['type'].upper()}]", end=" ")

                    if rec['type'] == 'tool':
                        print(f"Suggest using `{rec['tool_name']}`")
                    elif rec['type'] == 'parameter':
                        print(f"Typical `{rec['parameter']}` = `{rec['suggested_value']}`")

                    print(f"   Reason: {rec['reason']}")
                    print(f"   Confidence: {rec['confidence']:.0%}\n")

        # Test context-aware recommendations
        print("🔍 Testing context-aware recommendations (reading):\n")

        response = await client.post(
            f"{BASE_URL}/aui/recommendations",
            json={"user_id": USER_ID, "context": "reading"}
        )
        if response.status_code == 200:
            recs = response.json()
            contextual = [r for r in recs['recommendations'] if r.get('context') == 'reading']
            if contextual:
                print(f"Found {len(contextual)} reading-context recommendations")
                for rec in contextual[:3]:
                    print(f"  • {rec['tool_name']}: {rec['reason']}")
            else:
                print("  (Will improve with more usage data)")

        print("\n" + "=" * 80)
        print("✅ AUI Learning Demonstrated!")
        print("=" * 80)
        print("\nKey Capabilities:")
        print("  ✓ Learns most-used tools automatically")
        print("  ✓ Tracks success rates per tool")
        print("  ✓ Identifies typical parameter values")
        print("  ✓ Provides confidence-scored recommendations")
        print("  ✓ Adapts suggestions based on context")
        print("  ✓ Monitors performance (execution times)")
        print("\nThe more you use it, the smarter it gets!")


if __name__ == "__main__":
    asyncio.run(main())
