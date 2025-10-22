"""
Sentence Embedding Service - Real embeddings for TRM/quantum reading

Uses sentence-transformers (all-MiniLM-L6-v2) for 384-dimensional embeddings.
This is separate from the Ollama-based EmbeddingService (1024 dim) used for documents.

Model: all-MiniLM-L6-v2
- 384 dimensions (matches TRM expectations)
- Fast inference (~0.5ms per sentence on CPU)
- Good semantic quality for reading/transformation tasks
- No external services required (runs locally)

Usage:
    service = SentenceEmbeddingService()
    embedding = service.embed_text("The mind constructs reality.")
    # Returns: np.ndarray of shape (384,), normalized to unit length
"""

from typing import List, Optional
import numpy as np
from numpy.typing import NDArray
from functools import lru_cache
import hashlib
import logging

logger = logging.getLogger(__name__)


class SentenceEmbeddingService:
    """
    Service for generating sentence embeddings using sentence-transformers.

    Uses all-MiniLM-L6-v2 model (384 dimensions) for TRM/quantum reading.
    Includes LRU caching to avoid recomputation.
    Thread-safe for concurrent async usage.
    """

    _instance: Optional['SentenceEmbeddingService'] = None
    _model = None

    def __new__(cls, model_name: str = "all-MiniLM-L6-v2"):
        """Singleton pattern to avoid loading model multiple times."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize_model(model_name)
        return cls._instance

    def _initialize_model(self, model_name: str):
        """
        Load sentence-transformers model.

        Args:
            model_name: HuggingFace model identifier

        Raises:
            ImportError: If sentence-transformers not installed
        """
        try:
            from sentence_transformers import SentenceTransformer

            logger.info(f"Loading sentence embedding model: {model_name}")
            self._model = SentenceTransformer(model_name)
            self._model_name = model_name
            self._embedding_dim = self._model.get_sentence_embedding_dimension()
            logger.info(f"Model loaded: {model_name} ({self._embedding_dim} dimensions)")

            # Verify dimension matches TRM expectations
            if self._embedding_dim != 384:
                logger.warning(
                    f"Model {model_name} has {self._embedding_dim} dimensions, "
                    f"but TRM expects 384. Density matrix construction may need adjustment."
                )

        except ImportError:
            raise ImportError(
                "sentence-transformers not installed. "
                "Install with: poetry add sentence-transformers"
            )

    @property
    def embedding_dim(self) -> int:
        """Get embedding dimension (should be 384 for all-MiniLM-L6-v2)."""
        return self._embedding_dim

    @property
    def model_name(self) -> str:
        """Get model name."""
        return self._model_name

    def embed_text(
        self,
        text: str,
        normalize: bool = True,
        use_cache: bool = True
    ) -> NDArray[np.float64]:
        """
        Embed a single text string.

        Args:
            text: Text to embed
            normalize: Normalize to unit length (default True, required for TRM)
            use_cache: Use cached embeddings if available (default True)

        Returns:
            Embedding vector of shape (384,), dtype float64

        Examples:
            >>> service = SentenceEmbeddingService()
            >>> emb = service.embed_text("The mind constructs reality.")
            >>> emb.shape
            (384,)
            >>> np.linalg.norm(emb)
            1.0
        """
        if not text or not text.strip():
            # Return zero vector for empty text
            logger.warning("Empty text provided, returning zero vector")
            zero_vec = np.zeros(self._embedding_dim, dtype=np.float64)
            return zero_vec

        if use_cache:
            # Use cached version
            return self._embed_text_cached(text, normalize)
        else:
            # Direct embedding
            return self._embed_text_direct(text, normalize)

    def _embed_text_direct(self, text: str, normalize: bool) -> NDArray[np.float64]:
        """
        Direct embedding without cache.

        Args:
            text: Text to embed
            normalize: Normalize to unit length

        Returns:
            Embedding vector
        """
        # sentence-transformers returns numpy array
        embedding = self._model.encode(text, convert_to_numpy=True)

        # Ensure float64 for numerical stability in TRM
        embedding = embedding.astype(np.float64)

        # Normalize to unit length (critical for density matrix construction)
        if normalize:
            norm = np.linalg.norm(embedding)
            if norm > 1e-10:
                embedding = embedding / norm
            else:
                logger.error(f"Zero embedding for text: {text[:100]}...")
                # Return normalized random vector as fallback
                embedding = np.random.randn(self._embedding_dim).astype(np.float64)
                embedding /= np.linalg.norm(embedding)

        return embedding

    @lru_cache(maxsize=1024)
    def _embed_text_cached(self, text: str, normalize: bool) -> NDArray[np.float64]:
        """
        Cached embedding (uses LRU cache).

        Cache key is (text, normalize). This avoids recomputing embeddings
        for the same text, which is common in iterative TRM reading.

        Args:
            text: Text to embed
            normalize: Normalize to unit length

        Returns:
            Cached embedding vector

        Note:
            LRU cache stores up to 1024 embeddings. For reading sessions
            with many iterations, this significantly reduces compute.
        """
        return self._embed_text_direct(text, normalize)

    def embed_batch(
        self,
        texts: List[str],
        normalize: bool = True,
        batch_size: int = 32,
        show_progress: bool = False
    ) -> NDArray[np.float64]:
        """
        Embed multiple texts in batch (more efficient than one-by-one).

        Args:
            texts: List of texts to embed
            normalize: Normalize each embedding to unit length
            batch_size: Batch size for encoding
            show_progress: Show progress bar

        Returns:
            Array of shape (len(texts), 384)

        Examples:
            >>> service = SentenceEmbeddingService()
            >>> texts = ["First sentence.", "Second sentence."]
            >>> embeddings = service.embed_batch(texts)
            >>> embeddings.shape
            (2, 384)
        """
        # sentence-transformers handles batching internally
        embeddings = self._model.encode(
            texts,
            convert_to_numpy=True,
            batch_size=batch_size,
            show_progress_bar=show_progress
        )

        # Ensure float64
        embeddings = embeddings.astype(np.float64)

        # Normalize each embedding
        if normalize:
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            norms = np.maximum(norms, 1e-10)  # Avoid division by zero
            embeddings = embeddings / norms

        return embeddings

    def clear_cache(self):
        """Clear embedding cache."""
        self._embed_text_cached.cache_clear()
        cache_info = self.cache_info()
        logger.info(f"Embedding cache cleared (was: {cache_info})")

    def cache_info(self):
        """
        Get cache statistics.

        Returns:
            CacheInfo with hits, misses, maxsize, currsize
        """
        return self._embed_text_cached.cache_info()

    def text_hash(self, text: str) -> str:
        """
        Generate stable hash for text (useful for caching/deduplication).

        Args:
            text: Text to hash

        Returns:
            SHA256 hash (hex string)
        """
        return hashlib.sha256(text.encode('utf-8')).hexdigest()


# ============================================================================
# Global singleton instance
# ============================================================================

_global_sentence_embedding_service: Optional[SentenceEmbeddingService] = None


def get_sentence_embedding_service(
    model_name: str = "all-MiniLM-L6-v2"
) -> SentenceEmbeddingService:
    """
    Get or create global sentence embedding service instance.

    This is the recommended way to access the service (avoids reloading model).

    Args:
        model_name: Model to use (default: all-MiniLM-L6-v2)

    Returns:
        SentenceEmbeddingService singleton

    Examples:
        >>> service = get_sentence_embedding_service()
        >>> emb = service.embed_text("Hello world")
    """
    global _global_sentence_embedding_service

    if _global_sentence_embedding_service is None:
        _global_sentence_embedding_service = SentenceEmbeddingService(model_name)

    return _global_sentence_embedding_service


# ============================================================================
# Convenience functions
# ============================================================================

def embed_text(text: str, normalize: bool = True) -> NDArray[np.float64]:
    """
    Convenience function to embed text using global service.

    Args:
        text: Text to embed
        normalize: Normalize to unit length

    Returns:
        Embedding vector (384 dimensions)

    Examples:
        >>> from humanizer.services.sentence_embedding import embed_text
        >>> emb = embed_text("The mind constructs reality.")
    """
    service = get_sentence_embedding_service()
    return service.embed_text(text, normalize=normalize)


def embed_batch(texts: List[str], normalize: bool = True) -> NDArray[np.float64]:
    """
    Convenience function to embed batch using global service.

    Args:
        texts: Texts to embed
        normalize: Normalize each embedding

    Returns:
        Array of embeddings (shape: len(texts) × 384)
    """
    service = get_sentence_embedding_service()
    return service.embed_batch(texts, normalize=normalize)


# ============================================================================
# Example usage (for testing)
# ============================================================================

if __name__ == "__main__":
    import sys

    # Initialize service
    print("Initializing SentenceEmbeddingService...")
    service = SentenceEmbeddingService()

    print(f"Model: {service.model_name}")
    print(f"Embedding dim: {service.embedding_dim}")

    # Single embedding
    text = "The mind constructs reality through language."
    print(f"\nEmbedding text: {text}")
    emb = service.embed_text(text)
    print(f"Embedding shape: {emb.shape}")
    print(f"Norm: {np.linalg.norm(emb):.6f}")
    print(f"First 5 values: {emb[:5]}")
    print(f"Dtype: {emb.dtype}")

    # Test cache
    emb2 = service.embed_text(text)
    assert np.allclose(emb, emb2), "Cache should return same embedding"
    print(f"\nCache info after 2 calls: {service.cache_info()}")

    # Test different text
    emb3 = service.embed_text("Language shapes experience.")
    print(f"Cache info after 3 calls: {service.cache_info()}")

    # Batch embedding
    texts = [
        "The mind constructs reality.",
        "Language shapes experience.",
        "Consciousness is subjective."
    ]
    print(f"\nBatch embedding {len(texts)} texts...")
    embeddings = service.embed_batch(texts)
    print(f"Batch embeddings shape: {embeddings.shape}")

    # Test with TRM core
    print("\n" + "="*60)
    print("Testing integration with TRM core...")
    print("="*60)

    from humanizer.core.trm.density import construct_density_matrix, rho_distance
    from humanizer.core.trm.povm import get_all_packs

    # Construct density matrices
    rho1 = construct_density_matrix(embeddings[0], rank=64)
    rho2 = construct_density_matrix(embeddings[1], rank=64)

    print(f"\nρ1 ('{texts[0][:30]}...'):")
    print(f"  Purity: {rho1.purity:.4f}")
    print(f"  Entropy: {rho1.entropy:.4f}")
    print(f"  Top 3 eigenvalues: {rho1.eigenvalues[:3]}")

    print(f"\nρ2 ('{texts[1][:30]}...'):")
    print(f"  Purity: {rho2.purity:.4f}")
    print(f"  Entropy: {rho2.entropy:.4f}")
    print(f"  Top 3 eigenvalues: {rho2.eigenvalues[:3]}")

    # Measure distance
    distance = rho_distance(rho1, rho2)
    print(f"\nρ distance between texts: {distance:.4f}")

    # Measure with POVM packs
    print("\n" + "="*60)
    print("POVM Measurements")
    print("="*60)

    packs = get_all_packs(rank=64)
    for pack_name in ["tetralemma", "tone"]:
        pack = packs[pack_name]
        readings = pack.measure(rho1)
        print(f"\n{pack_name.upper()}:")
        for axis, prob in readings.items():
            bar = "█" * int(prob * 40)
            print(f"  {axis:12s}: {prob:.4f} {bar}")

    print("\n✓ Integration test complete!")
