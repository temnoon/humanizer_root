"""
LLM Provider Factory

Provides the appropriate LLM provider based on deployment mode and configuration.

Vision Alignment:
- LOCAL mode -> Ollama (offline, user owns model)
- WEB_EPHEMERAL mode -> Anthropic (fast, no persistence)
- API_SERVICE mode -> Anthropic (metered, multi-tenant)

Usage:
    from humanizer.core.llm import get_llm_provider, get_llm_function
    from humanizer.config import settings

    # Get provider instance
    provider = get_llm_provider(settings)

    # Get callable function for StatelessTransformer
    llm_fn = get_llm_function(settings)

    # Use in transformer
    transformer = StatelessTransformer(embed_fn=..., llm_fn=llm_fn)
"""

import logging
from typing import Callable, Awaitable

from humanizer.core.llm.base import LLMProvider, ProviderUnavailableError
from humanizer.core.llm.ollama import OllamaProvider
from humanizer.core.llm.anthropic import AnthropicProvider
from humanizer.config import Settings, DeploymentMode

logger = logging.getLogger(__name__)


def get_llm_provider(settings: Settings) -> LLMProvider:
    """
    Get LLM provider based on deployment mode and configuration.

    Args:
        settings: Application settings

    Returns:
        LLMProvider instance (OllamaProvider or AnthropicProvider)

    Raises:
        ProviderUnavailableError: If provider cannot be initialized

    Examples:
        >>> from humanizer.config import Settings
        >>> settings = Settings(deployment_mode=DeploymentMode.LOCAL)
        >>> provider = get_llm_provider(settings)
        >>> isinstance(provider, OllamaProvider)
        True
    """
    mode = settings.deployment_mode

    logger.info(f"Initializing LLM provider for deployment mode: {mode}")

    # LOCAL mode: Use Ollama (offline, free, user owns model)
    if mode == DeploymentMode.LOCAL:
        try:
            provider = OllamaProvider(
                model=settings.ollama_model,
                base_url=settings.ollama_base_url,
                verify_on_init=False,  # Don't verify in __init__ (async issues)
            )
            logger.info(f"Ollama provider ready: {provider.model}")
            return provider

        except ProviderUnavailableError as e:
            logger.error(f"Ollama not available: {e}")
            raise

    # WEB_EPHEMERAL or API_SERVICE: Use Anthropic
    elif mode in (DeploymentMode.WEB_EPHEMERAL, DeploymentMode.API_SERVICE):
        try:
            provider = AnthropicProvider(
                api_key=settings.claude_api_key,
                model=settings.claude_model,
                verify_on_init=False,  # Will fail on first use if invalid
            )
            logger.info(f"Anthropic provider ready: {provider.model}")
            return provider

        except ProviderUnavailableError as e:
            logger.error(f"Anthropic not available: {e}")
            raise

    else:
        raise ValueError(f"Unknown deployment mode: {mode}")


def get_llm_function(settings: Settings) -> Callable[[str, float], Awaitable[str]]:
    """
    Get LLM function for StatelessTransformer.

    This wraps the provider's generate() method to match the expected signature:
    Callable[[str, float], Awaitable[str]]

    Args:
        settings: Application settings

    Returns:
        Async function that takes (prompt, temperature) and returns generated text

    Examples:
        >>> from humanizer.config import Settings
        >>> settings = Settings()
        >>> llm_fn = get_llm_function(settings)
        >>> result = await llm_fn("Hello", 0.7)
    """
    provider = get_llm_provider(settings)

    async def llm_function(prompt: str, temperature: float) -> str:
        """
        Generate text using the configured LLM provider.

        Args:
            prompt: Text prompt
            temperature: Sampling temperature

        Returns:
            Generated text
        """
        return await provider.generate(prompt, temperature)

    # Attach provider metadata to function (for introspection)
    llm_function.provider = provider  # type: ignore
    llm_function.requires_internet = provider.requires_internet  # type: ignore
    llm_function.requires_api_key = provider.requires_api_key  # type: ignore

    return llm_function


# Expose key classes and functions
__all__ = [
    "LLMProvider",
    "OllamaProvider",
    "AnthropicProvider",
    "get_llm_provider",
    "get_llm_function",
    "ProviderUnavailableError",
]
