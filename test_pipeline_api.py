"""Test pipeline API endpoints"""

import asyncio
import httpx


async def test_pipeline():
    """Test the pipeline API."""
    base_url = "http://localhost:8000"

    async with httpx.AsyncClient(timeout=120.0) as client:
        # Check embedding stats
        print("📊 Checking embedding statistics...")
        resp = await client.get(f"{base_url}/api/pipeline/stats/embeddings")
        stats = resp.json()
        print(f"  Total messages: {stats['total_messages']}")
        print(f"  With embeddings: {stats['messages_with_embeddings']}")
        print(f"  Coverage: {stats['coverage_percent']}%\n")

        # Check Ollama health
        print("🏥 Checking Ollama health...")
        resp = await client.post(f"{base_url}/api/pipeline/health")
        health = resp.json()
        print(f"  Running: {health['running']}")
        print(f"  Model loaded: {health['model_loaded']}\n")

        if not health['running'] or not health['model_loaded']:
            print("❌ Ollama not ready, aborting")
            return

        # Create a small test job (10 messages)
        print("🚀 Creating embedding job for 10 messages...")
        resp = await client.post(
            f"{base_url}/api/pipeline/jobs/embed",
            json={"limit": 10}
        )
        job = resp.json()
        job_id = job['id']
        print(f"  Job ID: {job_id}")
        print(f"  Status: {job['status']}")
        print(f"  Total items: {job['total_items']}\n")

        # Poll for completion
        print("⏳ Waiting for job to complete...")
        for i in range(30):  # Max 30 seconds
            await asyncio.sleep(1)

            resp = await client.get(f"{base_url}/api/pipeline/jobs/{job_id}")
            job = resp.json()

            print(f"  Progress: {job['progress_percent']:.1f}% "
                  f"({job['processed_items']}/{job['total_items']}) "
                  f"- Status: {job['status']}")

            if job['status'] in ['completed', 'failed', 'cancelled']:
                break

        # Final status
        print(f"\n✅ Job {job['status']}!")
        if job['result_summary']:
            print(f"  Summary: {job['result_summary']}")

        # Check updated stats
        print("\n📊 Updated embedding statistics...")
        resp = await client.get(f"{base_url}/api/pipeline/stats/embeddings")
        stats = resp.json()
        print(f"  Total messages: {stats['total_messages']}")
        print(f"  With embeddings: {stats['messages_with_embeddings']}")
        print(f"  Coverage: {stats['coverage_percent']}%")


if __name__ == "__main__":
    asyncio.run(test_pipeline())
