"""Start full corpus embedding job"""

import asyncio
import httpx
import time


async def start_full_embedding():
    """Start embedding all remaining messages."""
    base_url = "http://localhost:8000"

    async with httpx.AsyncClient(timeout=7200.0) as client:
        # Get current stats
        print("📊 Checking current embedding coverage...")
        resp = await client.get(f"{base_url}/api/pipeline/stats/embeddings")
        stats = resp.json()
        print(f"  Total messages: {stats['total_messages']:,}")
        print(f"  Already embedded: {stats['messages_with_embeddings']:,}")
        print(f"  Remaining: {stats['messages_without_embeddings']:,}")
        print(f"  Coverage: {stats['coverage_percent']:.2f}%\n")

        # Estimate time
        remaining = stats['messages_without_embeddings']
        estimated_minutes = (remaining * 0.11) / 60
        print(f"⏱️  Estimated time: ~{estimated_minutes:.1f} minutes\n")

        # Create job for ALL remaining messages
        print("🚀 Starting full corpus embedding job...")
        start_time = time.time()

        resp = await client.post(
            f"{base_url}/api/pipeline/jobs/embed",
            json={}  # No limit = all messages
        )
        job = resp.json()
        job_id = job['id']

        print(f"  Job ID: {job_id}")
        print(f"  Total items: {job['total_items']:,}\n")

        # Monitor progress
        print("⏳ Monitoring progress (updates every 5 seconds)...")
        print("=" * 80)

        last_processed = 0
        while True:
            await asyncio.sleep(5)

            resp = await client.get(f"{base_url}/api/pipeline/jobs/{job_id}")
            job = resp.json()

            elapsed = time.time() - start_time
            items_per_sec = job['processed_items'] / elapsed if elapsed > 0 else 0
            eta_seconds = (job['total_items'] - job['processed_items']) / items_per_sec if items_per_sec > 0 else 0
            eta_minutes = eta_seconds / 60

            # Progress bar
            bar_width = 50
            filled = int(bar_width * job['progress_percent'] / 100)
            bar = '█' * filled + '░' * (bar_width - filled)

            print(f"\r[{bar}] {job['progress_percent']:.1f}% | "
                  f"{job['processed_items']:,}/{job['total_items']:,} | "
                  f"{items_per_sec:.1f} msg/s | "
                  f"ETA: {eta_minutes:.1f}m | "
                  f"✓ {job['successful_items']:,} / ✗ {job['failed_items']:,}",
                  end='', flush=True)

            if job['status'] in ['completed', 'failed', 'cancelled']:
                print()  # New line after progress bar
                break

        # Final stats
        elapsed_minutes = (time.time() - start_time) / 60
        print("=" * 80)
        print(f"\n✅ Job {job['status']}!")
        print(f"  Duration: {elapsed_minutes:.1f} minutes")
        print(f"  Successful: {job['successful_items']:,}")
        print(f"  Failed: {job['failed_items']:,}")
        print(f"  Average: {job['total_items'] / (time.time() - start_time):.1f} messages/second")

        # Final coverage
        resp = await client.get(f"{base_url}/api/pipeline/stats/embeddings")
        stats = resp.json()
        print(f"\n📊 Final coverage: {stats['messages_with_embeddings']:,}/{stats['total_messages']:,} ({stats['coverage_percent']:.2f}%)")


if __name__ == "__main__":
    print("=" * 80)
    print("FULL CORPUS EMBEDDING JOB")
    print("=" * 80)
    print()
    asyncio.run(start_full_embedding())
