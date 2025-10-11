"""
Test ChatGPT archive ingestion

This script tests the ChatGPT ingestion endpoints.
"""

import asyncio
import time
import httpx


async def main():
    base_url = "http://localhost:8000"

    async with httpx.AsyncClient(timeout=300.0) as client:
        print("=" * 80)
        print("ChatGPT Archive Ingestion Test")
        print("=" * 80)

        # Test 1: Health check
        print("\n1. Testing health endpoint...")
        response = await client.get(f"{base_url}/health")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")

        # Test 2: Ingest archives
        print("\n2. Testing archive ingestion...")
        print("   Looking for archives in: /Users/tem/rho/var/media")
        print("   Pattern: chat[2-8]")

        ingest_request = {
            "home_dir": "/Users/tem/rho/var/media",
            "archive_pattern": "chat[2-8]",
            "force_reimport": False
        }

        start_time = time.time()
        response = await client.post(
            f"{base_url}/chatgpt/ingest",
            json=ingest_request
        )
        elapsed = time.time() - start_time

        print(f"   Status: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"\n   ✅ Ingestion successful!")
            print(f"   Archives found: {result['archives_found']}")
            print(f"   Conversations processed: {result['conversations_processed']}")
            print(f"   Messages imported: {result['messages_imported']}")
            print(f"   Media files found: {result['media_files_found']}")
            print(f"   Media files matched: {result['media_files_matched']}")
            print(f"   Processing time: {result['processing_time_seconds']:.2f}s (measured: {elapsed:.2f}s)")

            if result['errors']:
                print(f"\n   ⚠️  Errors encountered:")
                for error in result['errors']:
                    print(f"      - {error}")
        else:
            print(f"   ❌ Ingestion failed")
            print(f"   Response: {response.text}")

        # Test 3: Get stats
        print("\n3. Testing stats endpoint...")
        response = await client.get(f"{base_url}/chatgpt/stats")
        print(f"   Status: {response.status_code}")

        if response.status_code == 200:
            stats = response.json()
            print(f"\n   Statistics:")
            print(f"   Total conversations: {stats['total_conversations']}")
            print(f"   Total messages: {stats['total_messages']}")
            print(f"   Total media: {stats['total_media']}")
            print(f"   Archives ingested: {', '.join(stats['archives_ingested'])}")

            if stats['date_range']:
                print(f"   Date range: {stats['date_range']['earliest']} to {stats['date_range']['latest']}")

            if stats['top_conversations']:
                print(f"\n   Top conversations:")
                for i, conv in enumerate(stats['top_conversations'][:5], 1):
                    print(f"      {i}. {conv['title'][:60]}... ({conv['message_count']} messages)")
        else:
            print(f"   Response: {response.text}")

        # Test 4: Search messages
        print("\n4. Testing message search...")
        search_request = {
            "query": "quantum",
            "limit": 5
        }

        response = await client.post(
            f"{base_url}/chatgpt/search",
            json=search_request
        )
        print(f"   Status: {response.status_code}")

        if response.status_code == 200:
            search_result = response.json()
            print(f"\n   Found {search_result['count']} messages matching 'quantum'")

            if search_result['results']:
                print(f"\n   Sample results:")
                for i, msg in enumerate(search_result['results'][:3], 1):
                    content_preview = msg['content_text'][:100] if msg['content_text'] else "(no text)"
                    print(f"      {i}. [{msg['author_role']}] {content_preview}...")
        else:
            print(f"   Response: {response.text}")

        print("\n" + "=" * 80)
        print("✅ All tests completed!")
        print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
