"""Test pipeline with 100 messages"""

import asyncio
import httpx
import time


async def test_100_messages():
    """Test embedding 100 messages."""
    base_url = "http://localhost:8000"

    async with httpx.AsyncClient(timeout=300.0) as client:
        # Create job
        print("🚀 Creating embedding job for 100 messages...")
        start_time = time.time()

        resp = await client.post(
            f"{base_url}/api/pipeline/jobs/embed",
            json={"limit": 100}
        )
        job = resp.json()
        job_id = job['id']
        print(f"  Job ID: {job_id}")
        print(f"  Total items: {job['total_items']}\n")

        # Poll for completion
        print("⏳ Waiting for job to complete...")
        last_progress = 0

        while True:
            await asyncio.sleep(0.5)

            resp = await client.get(f"{base_url}/api/pipeline/jobs/{job_id}")
            job = resp.json()

            if job['progress_percent'] != last_progress:
                elapsed = time.time() - start_time
                print(f"  {elapsed:.1f}s - Progress: {job['progress_percent']:.1f}% "
                      f"({job['processed_items']}/{job['total_items']}) "
                      f"- {job['successful_items']} successful")
                last_progress = job['progress_percent']

            if job['status'] in ['completed', 'failed', 'cancelled']:
                break

        # Final stats
        elapsed = time.time() - start_time
        print(f"\n✅ Job {job['status']} in {elapsed:.1f} seconds!")
        print(f"  Successful: {job['successful_items']}")
        print(f"  Failed: {job['failed_items']}")
        print(f"  Average: {elapsed / job['total_items']:.2f}s per message")

        # Coverage
        resp = await client.get(f"{base_url}/api/pipeline/stats/embeddings")
        stats = resp.json()
        print(f"\n📊 Coverage: {stats['messages_with_embeddings']}/{stats['total_messages']} "
              f"({stats['coverage_percent']:.2f}%)")


if __name__ == "__main__":
    asyncio.run(test_100_messages())
