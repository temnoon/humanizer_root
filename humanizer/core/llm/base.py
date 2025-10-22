"""
LLM Provider Base Protocol

Defines the interface for LLM providers used in TRM transformations.

Vision Alignment:
- Works offline (local LLM support)
- Deployment mode aware (local/web/api)
- Transparent requirements (declares internet/API key needs)
"""

from typing import Protocol, runtime_checkable
from abc import abstractmethod


@runtime_checkable
class LLMProvider(Protocol):
    """
    Protocol for LLM providers used in transformation engine.

    All providers must implement this interface to work with StatelessTransformer.

    Signature matches: Callable[[str, float], Awaitable[str]]
    """

    # Provider metadata
    requires_internet: bool
    requires_api_key: bool
    provider_name: str

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate text completion from prompt.

        This is the core method called by StatelessTransformer.

        Args:
            prompt: Text prompt for generation
            temperature: Sampling temperature (0.0 = deterministic, 1.0 = creative)

        Returns:
            Generated text completion

        Raises:
            ConnectionError: If provider is unavailable
            ValueError: If prompt is invalid
            RuntimeError: If generation fails
        """
        ...

    @abstractmethod
    async def check_health(self) -> dict:
        """
        Check if provider is available and working.

        Returns:
            Dictionary with health status:
            {
                "available": bool,
                "latency_ms": float,
                "model": str,
                "error": Optional[str]
            }
        """
        ...

    @abstractmethod
    def estimate_cost(self, prompt: str, temperature: float) -> float:
        """
        Estimate cost in USD for this generation.

        Args:
            prompt: Text prompt
            temperature: Temperature parameter

        Returns:
            Estimated cost in USD (0.0 for local models)
        """
        ...

    @abstractmethod
    def estimate_latency(self, prompt: str, temperature: float) -> float:
        """
        Estimate latency in milliseconds.

        Args:
            prompt: Text prompt
            temperature: Temperature parameter

        Returns:
            Estimated latency in ms
        """
        ...


class LLMProviderError(Exception):
    """Base exception for LLM provider errors."""
    pass


class ProviderUnavailableError(LLMProviderError):
    """Raised when LLM provider is not available (server down, API key missing, etc)."""
    pass


class GenerationError(LLMProviderError):
    """Raised when text generation fails."""
    pass
