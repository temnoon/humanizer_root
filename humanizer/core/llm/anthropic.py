"""
Anthropic LLM Provider - Cloud Claude client for web service

Uses Anthropic API for transformations when local LLM not available.

Vision Alignment:
- ⚠️ Requires internet (for web/API deployments only)
- ⚠️ Requires API key
- ✅ Fast and high-quality transformations
- ✅ Transparent cost tracking

Use when:
- Deployment mode: WEB_EPHEMERAL or API_SERVICE
- User doesn't have local resources
- Need highest quality transformations

Don't use when:
- Deployment mode: LOCAL (prefer Ollama)
- User wants offline capability
- Privacy is critical

Usage:
    provider = AnthropicProvider(
        api_key="sk-...",
        model="claude-haiku-4-5-20251001"
    )
    result = await provider.generate("Transform this text...", temperature=0.7)
"""

import logging
import time
from typing import Optional

from humanizer.core.llm.base import (
    LLMProvider,
    ProviderUnavailableError,
    GenerationError,
)

logger = logging.getLogger(__name__)


class AnthropicProvider:
    """
    Anthropic Claude LLM provider.

    Implements LLMProvider protocol for StatelessTransformer.

    Attributes:
        requires_internet: True (API-based)
        requires_api_key: True (requires Anthropic API key)
        provider_name: "anthropic"
    """

    requires_internet = True
    requires_api_key = True
    provider_name = "anthropic"

    def __init__(
        self,
        api_key: str,
        model: str = "claude-haiku-4-5-20251001",
        max_tokens: int = 2048,
        verify_on_init: bool = False,
    ):
        """
        Initialize Anthropic provider.

        Args:
            api_key: Anthropic API key
            model: Claude model name
            max_tokens: Maximum tokens for completion
            verify_on_init: Check API key validity on init

        Raises:
            ProviderUnavailableError: If API key is missing or invalid
        """
        if not api_key:
            raise ProviderUnavailableError(
                "Anthropic API key is required\n"
                "Get your API key at: https://console.anthropic.com/\n"
                "Set environment variable: CLAUDE_API_KEY=sk-..."
            )

        self.api_key = api_key
        self.model = model
        self.max_tokens = max_tokens

        # Lazy-load Anthropic client
        self._client: Optional[any] = None

        # Cost tracking (per 1M tokens, as of Oct 2025)
        # https://www.anthropic.com/pricing
        self._cost_per_1m_input = {
            "claude-haiku-4-5-20251001": 0.25,  # $0.25/1M input
            "claude-sonnet-4-5-20251001": 3.00,
            "claude-opus-4-5-20251001": 15.00,
        }
        self._cost_per_1m_output = {
            "claude-haiku-4-5-20251001": 1.25,  # $1.25/1M output
            "claude-sonnet-4-5-20251001": 15.00,
            "claude-opus-4-5-20251001": 75.00,
        }

        if verify_on_init:
            # Would need async context for health check
            # For now, skip - will fail on first generate() if invalid
            logger.warning("verify_on_init not implemented for AnthropicProvider")

        logger.info(f"Anthropic provider initialized: {self.model}")

    def _get_client(self):
        """Get or create Anthropic client."""
        if self._client is None:
            try:
                from anthropic import AsyncAnthropic
                self._client = AsyncAnthropic(api_key=self.api_key)
            except ImportError:
                raise ImportError(
                    "anthropic package not installed\n"
                    "Install with: poetry add anthropic"
                )
        return self._client

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate text completion using Claude.

        Args:
            prompt: Text prompt
            temperature: Sampling temperature (0.0-1.0)

        Returns:
            Generated text

        Raises:
            ProviderUnavailableError: If API key is invalid
            GenerationError: If generation fails
        """
        if not prompt or not prompt.strip():
            raise ValueError("Prompt cannot be empty")

        client = self._get_client()

        try:
            start_time = time.time()

            # Call Anthropic API
            response = await client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=temperature,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
            )

            elapsed_ms = (time.time() - start_time) * 1000

            # Extract text from response
            generated_text = response.content[0].text

            # Log usage
            logger.info(
                f"Anthropic generation complete: "
                f"{len(generated_text)} chars, "
                f"{response.usage.input_tokens} in + {response.usage.output_tokens} out tokens, "
                f"{elapsed_ms:.0f}ms"
            )

            return generated_text

        except Exception as e:
            # Check for common errors
            error_str = str(e)

            if "authentication" in error_str.lower() or "api_key" in error_str.lower():
                raise ProviderUnavailableError(
                    f"Anthropic API authentication failed\n"
                    f"Check your API key: https://console.anthropic.com/\n"
                    f"Error: {e}"
                )

            elif "rate_limit" in error_str.lower():
                raise GenerationError(
                    f"Anthropic rate limit exceeded\n"
                    f"Wait a moment and try again\n"
                    f"Error: {e}"
                )

            else:
                raise GenerationError(f"Anthropic API error: {e}")

    async def check_health(self) -> dict:
        """
        Check if Anthropic API is available.

        Returns:
            Health status dictionary
        """
        try:
            client = self._get_client()
            start_time = time.time()

            # Simple test message
            response = await client.messages.create(
                model=self.model,
                max_tokens=10,
                messages=[{"role": "user", "content": "ping"}],
            )

            latency_ms = (time.time() - start_time) * 1000

            return {
                "available": True,
                "latency_ms": latency_ms,
                "model": self.model,
                "error": None,
            }

        except Exception as e:
            return {
                "available": False,
                "latency_ms": 0,
                "model": self.model,
                "error": str(e),
            }

    def estimate_cost(self, prompt: str, temperature: float) -> float:
        """
        Estimate cost in USD for this generation.

        Args:
            prompt: Text prompt
            temperature: Temperature parameter

        Returns:
            Estimated cost in USD

        Note:
            Uses rough token estimates:
            - Input: prompt length / 4
            - Output: max_tokens / 2 (assume partial usage)
        """
        # Rough token estimates (1 token ≈ 4 chars)
        input_tokens = len(prompt) / 4
        output_tokens = self.max_tokens / 2  # Assume 50% usage

        # Get pricing for model
        input_cost_per_1m = self._cost_per_1m_input.get(self.model, 1.0)
        output_cost_per_1m = self._cost_per_1m_output.get(self.model, 5.0)

        # Calculate cost
        input_cost = (input_tokens / 1_000_000) * input_cost_per_1m
        output_cost = (output_tokens / 1_000_000) * output_cost_per_1m

        return input_cost + output_cost

    def estimate_latency(self, prompt: str, temperature: float) -> float:
        """
        Estimate latency for Claude API.

        Args:
            prompt: Text prompt
            temperature: Temperature parameter

        Returns:
            Estimated latency in ms

        Note:
            Claude is typically fast:
            - ~100-300ms baseline (API latency)
            - ~5-10ms per 100 output tokens
        """
        baseline_ms = 200
        output_tokens = self.max_tokens / 2  # Assume 50% usage
        per_100_tokens_ms = 7

        estimated_latency = baseline_ms + (output_tokens / 100) * per_100_tokens_ms

        return estimated_latency

    def __repr__(self) -> str:
        return f"AnthropicProvider(model='{self.model}')"
