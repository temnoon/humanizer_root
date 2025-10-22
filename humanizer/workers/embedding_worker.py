"""
Embedding Worker - Background process for generating embeddings

Polls the embedding queue and processes pending chunks.

Usage:
    python -m humanizer.workers.embedding_worker

Or with Poetry:
    poetry run python -m humanizer.workers.embedding_worker

Graceful shutdown with Ctrl+C.
"""

import asyncio
import signal
import sys
from datetime import datetime

from humanizer.database.connection import async_session_maker
from humanizer.services.embedding_queue import EmbeddingJobQueue


class EmbeddingWorker:
    """
    Background worker for processing embedding jobs.

    Polls the queue every N seconds and processes batches of chunks.
    """

    def __init__(
        self,
        poll_interval: int = 5,
        batch_size: int = 50,
    ):
        """
        Initialize worker.

        Args:
            poll_interval: Seconds between polls
            batch_size: Chunks to process per batch
        """
        self.poll_interval = poll_interval
        self.batch_size = batch_size
        self.queue = EmbeddingJobQueue()
        self.running = False

    async def start(self):
        """
        Start the worker loop.

        Polls queue and processes batches until stopped.
        """
        self.running = True
        print(f"🚀 Embedding worker started (batch_size={self.batch_size}, poll_interval={self.poll_interval}s)")

        while self.running:
            try:
                # Process a batch
                async with async_session_maker() as session:
                    processed = await self.queue.process_batch(session, self.batch_size)

                    if processed > 0:
                        print(f"✅ Processed {processed} chunks at {datetime.now().isoformat()}")

                    # Get stats
                    stats = await self.queue.get_queue_stats(session)
                    if stats['pending'] > 0 or stats['processing'] > 0:
                        print(f"📊 Queue stats: {stats}")

                # Sleep before next poll
                await asyncio.sleep(self.poll_interval)

            except KeyboardInterrupt:
                print("\n⚠️  Received interrupt signal, shutting down gracefully...")
                self.running = False
                break

            except Exception as e:
                print(f"❌ Error processing batch: {str(e)}")
                # Continue running despite errors
                await asyncio.sleep(self.poll_interval)

        print("👋 Embedding worker stopped")

    def stop(self):
        """Stop the worker."""
        self.running = False


async def main():
    """Main entry point for worker."""
    worker = EmbeddingWorker(
        poll_interval=5,  # Poll every 5 seconds
        batch_size=50,    # Process 50 chunks per batch
    )

    # Setup signal handlers for graceful shutdown
    def signal_handler(sig, frame):
        print("\n⚠️  Received signal, stopping worker...")
        worker.stop()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        await worker.start()
    except KeyboardInterrupt:
        worker.stop()


if __name__ == "__main__":
    print("Starting Humanizer Embedding Worker...")
    asyncio.run(main())
