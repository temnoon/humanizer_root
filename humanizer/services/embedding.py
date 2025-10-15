"""
EmbeddingService - Generate semantic embeddings using Ollama

Uses mxbai-embed-large model (1024 dimensions) via Ollama API.
Provides batch processing and caching for efficient embedding generation.
"""

import asyncio
from typing import List, Optional, Dict, Any
import httpx
import numpy as np
from numpy.typing import NDArray


class EmbeddingService:
    """
    Service for generating semantic embeddings via Ollama.

    Uses mxbai-embed-large model which produces 1024-dimensional embeddings.
    Supports batch processing with configurable batch size and rate limiting.

    Attributes:
        base_url: Ollama API base URL (default: http://localhost:11434)
        model: Embedding model name (default: mxbai-embed-large)
        batch_size: Number of texts to embed in one batch (default: 32)
        timeout: Request timeout in seconds (default: 30)
    """

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "mxbai-embed-large",
        batch_size: int = 32,
        timeout: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.batch_size = batch_size
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        """Async context manager entry."""
        self._client = httpx.AsyncClient(timeout=self.timeout)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def embed_text(self, text: str) -> NDArray[np.float32]:
        """
        Generate embedding for a single text.

        Args:
            text: Input text to embed

        Returns:
            1024-dimensional embedding vector

        Raises:
            httpx.HTTPError: If API request fails
            ValueError: If response format is invalid
        """
        if not text or not text.strip():
            # Return zero vector for empty text
            return np.zeros(1024, dtype=np.float32)

        # Ensure client exists
        if not self._client:
            self._client = httpx.AsyncClient(timeout=self.timeout)

        # Call Ollama API
        response = await self._client.post(
            f"{self.base_url}/api/embeddings",
            json={
                "model": self.model,
                "prompt": text,
            },
        )
        response.raise_for_status()

        # Parse response
        data = response.json()
        if "embedding" not in data:
            raise ValueError(f"Invalid response format: {data}")

        embedding = np.array(data["embedding"], dtype=np.float32)

        # Validate dimensions
        if embedding.shape[0] != 1024:
            raise ValueError(
                f"Expected 1024-dimensional embedding, got {embedding.shape[0]}"
            )

        return embedding

    async def embed_batch(
        self,
        texts: List[str],
        show_progress: bool = False,
    ) -> List[NDArray[np.float32]]:
        """
        Generate embeddings for multiple texts.

        Processes texts in batches to avoid overwhelming the API.
        Empty or whitespace-only texts get zero vectors.

        Args:
            texts: List of texts to embed
            show_progress: If True, print progress updates

        Returns:
            List of 1024-dimensional embedding vectors

        Raises:
            httpx.HTTPError: If API request fails
        """
        embeddings: List[NDArray[np.float32]] = []

        # Process in batches
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]

            # Embed each text in batch
            batch_embeddings = await asyncio.gather(
                *[self.embed_text(text) for text in batch]
            )

            embeddings.extend(batch_embeddings)

            if show_progress:
                progress = min(i + self.batch_size, len(texts))
                print(f"Embedded {progress}/{len(texts)} texts...")

        return embeddings

    async def health_check(self) -> Dict[str, Any]:
        """
        Check if Ollama is running and model is available.

        Returns:
            Dict with status information:
                - running: bool - Is Ollama responding?
                - model_loaded: bool - Is mxbai-embed-large available?
                - error: Optional[str] - Error message if any

        Example:
            >>> async with EmbeddingService() as service:
            >>>     status = await service.health_check()
            >>>     if status["running"] and status["model_loaded"]:
            >>>         print("Ready to embed!")
        """
        if not self._client:
            self._client = httpx.AsyncClient(timeout=self.timeout)

        try:
            # Check if Ollama is running
            response = await self._client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()

            models = response.json().get("models", [])
            model_names = [m.get("name", "") for m in models]

            # Check if our model is available
            model_loaded = any(self.model in name for name in model_names)

            return {
                "running": True,
                "model_loaded": model_loaded,
                "available_models": model_names,
                "error": None if model_loaded else f"Model {self.model} not found",
            }

        except httpx.HTTPError as e:
            return {
                "running": False,
                "model_loaded": False,
                "available_models": [],
                "error": str(e),
            }

    async def get_embedding_dimension(self) -> int:
        """
        Get the dimensionality of embeddings from this model.

        Returns:
            Embedding dimension (1024 for mxbai-embed-large)
        """
        # Test with a simple text
        test_embedding = await self.embed_text("test")
        return test_embedding.shape[0]


# Singleton instance for convenience
_default_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """
    Get the default EmbeddingService instance.

    Creates a singleton instance on first call.
    Use this for simple cases where you don't need custom configuration.

    Example:
        >>> service = get_embedding_service()
        >>> async with service:
        >>>     embedding = await service.embed_text("Hello world")
    """
    global _default_service
    if _default_service is None:
        _default_service = EmbeddingService()
    return _default_service
