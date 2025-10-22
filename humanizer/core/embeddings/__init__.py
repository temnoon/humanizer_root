"""
Embedding Service Adapter for TRM Core

Wraps humanizer.services.sentence_embedding to match StatelessTransformer signature.

Vision Alignment:
- Works offline (sentence-transformers runs locally)
- No API keys required
- Lightweight (all-MiniLM-L6-v2 is 90MB)

Usage:
    from humanizer.core.embeddings import get_embedding_function

    embed_fn = get_embedding_function()
    embedding = await embed_fn("Hello world")
    # Returns: np.ndarray of shape (384,)
"""

import asyncio
import logging
from typing import Callable, Awaitable

import numpy as np
from numpy.typing import NDArray

from humanizer.services.sentence_embedding import get_sentence_embedding_service

logger = logging.getLogger(__name__)


def get_embedding_function() -> Callable[[str], Awaitable[NDArray[np.float64]]]:
    """
    Get embedding function for StatelessTransformer.

    Returns an async function matching signature: Callable[[str], Awaitable[NDArray[np.float64]]]

    The sentence-transformers model is CPU-bound, so we run it in a thread pool
    to avoid blocking the async event loop.

    Returns:
        Async function that takes text and returns embedding vector (384 dim)

    Examples:
        >>> embed_fn = get_embedding_function()
        >>> embedding = await embed_fn("The mind constructs reality.")
        >>> embedding.shape
        (384,)
    """
    # Get singleton embedding service
    service = get_sentence_embedding_service()

    async def embedding_function(text: str) -> NDArray[np.float64]:
        """
        Embed text using sentence-transformers.

        Args:
            text: Text to embed

        Returns:
            Embedding vector (384 dimensions, normalized to unit length)

        Raises:
            ValueError: If text is empty
        """
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text")

        # Run in thread pool to avoid blocking event loop
        # sentence-transformers is CPU-bound (inference on CPU)
        loop = asyncio.get_event_loop()
        embedding = await loop.run_in_executor(
            None,  # Use default thread pool executor
            service.embed_text,
            text
        )

        return embedding

    # Attach metadata for introspection
    embedding_function.model_name = service.model_name  # type: ignore
    embedding_function.embedding_dim = service.embedding_dim  # type: ignore
    embedding_function.requires_internet = False  # type: ignore

    logger.debug(
        f"Embedding function created: {service.model_name} ({service.embedding_dim} dim)"
    )

    return embedding_function


# Expose main function
__all__ = ["get_embedding_function"]
