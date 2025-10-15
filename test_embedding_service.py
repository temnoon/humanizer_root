"""Quick test of EmbeddingService"""

import asyncio
from humanizer.services.embedding import EmbeddingService


async def test_embedding():
    """Test embedding service."""
    async with EmbeddingService() as service:
        # Health check
        print("Checking Ollama health...")
        status = await service.health_check()
        print(f"Status: {status}")

        if not status["running"] or not status["model_loaded"]:
            print("❌ Ollama not ready")
            return

        # Test single embedding
        print("\nGenerating test embedding...")
        text = "The mind constructs reality through quantum measurements."
        embedding = await service.embed_text(text)

        print(f"✅ Embedding generated:")
        print(f"  - Shape: {embedding.shape}")
        print(f"  - Dtype: {embedding.dtype}")
        print(f"  - First 5 values: {embedding[:5]}")
        print(f"  - Norm: {(embedding ** 2).sum() ** 0.5:.4f}")

        # Test batch embedding
        print("\nTesting batch embedding...")
        texts = [
            "First message",
            "Second message",
            "Third message",
        ]
        embeddings = await service.embed_batch(texts, show_progress=True)
        print(f"✅ Batch embeddings generated: {len(embeddings)} embeddings")


if __name__ == "__main__":
    asyncio.run(test_embedding())
