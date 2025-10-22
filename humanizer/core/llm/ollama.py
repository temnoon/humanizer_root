"""
Ollama LLM Provider - Local LLM client for offline transformations

Uses Ollama API to run local models (Mistral, Llama, Qwen, etc).

Vision Alignment:
- ✅ Works offline (desert island test)
- ✅ No API keys required
- ✅ User owns the model
- ✅ Transparent (shows what model is running)

Requirements:
- Ollama installed: https://ollama.ai/download
- Server running: ollama serve
- Model pulled: ollama pull mistral:7b

Usage:
    provider = OllamaProvider(model="mistral:7b")
    result = await provider.generate("Transform this text...", temperature=0.7)
"""

import asyncio
import logging
import time
from typing import Optional

import httpx

from humanizer.core.llm.base import (
    LLMProvider,
    ProviderUnavailableError,
    GenerationError,
)

logger = logging.getLogger(__name__)


class OllamaProvider:
    """
    Local Ollama LLM provider.

    Implements LLMProvider protocol for StatelessTransformer.

    Attributes:
        requires_internet: False (runs locally)
        requires_api_key: False (no authentication)
        provider_name: "ollama"
    """

    requires_internet = False
    requires_api_key = False
    provider_name = "ollama"

    def __init__(
        self,
        model: str = "mistral:7b",
        base_url: str = "http://localhost:11434",
        timeout: float = 30.0,
        verify_on_init: bool = True,
    ):
        """
        Initialize Ollama provider.

        Args:
            model: Ollama model name (e.g., "mistral:7b", "qwen3:latest")
            base_url: Ollama API base URL
            timeout: Request timeout in seconds
            verify_on_init: Check health on initialization

        Raises:
            ProviderUnavailableError: If verify_on_init=True and Ollama not available
        """
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

        # HTTP client (reuse connection pool)
        self._client: Optional[httpx.AsyncClient] = None

        # Verify availability if requested
        if verify_on_init:
            # Run sync health check
            health = asyncio.run(self.check_health())
            if not health["available"]:
                raise ProviderUnavailableError(
                    f"Ollama not available: {health.get('error', 'Unknown error')}\n\n"
                    f"To fix:\n"
                    f"1. Install Ollama: https://ollama.ai/download\n"
                    f"2. Start server: ollama serve\n"
                    f"3. Pull model: ollama pull {self.model}\n"
                    f"4. Verify: curl {self.base_url}/api/tags\n"
                )

        logger.info(f"Ollama provider initialized: {self.model} at {self.base_url}")

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(self.timeout),
            )
        return self._client

    async def close(self):
        """Close HTTP client and cleanup resources."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate text completion using Ollama.

        Args:
            prompt: Text prompt
            temperature: Sampling temperature (0.0-2.0)

        Returns:
            Generated text

        Raises:
            ProviderUnavailableError: If Ollama is not running
            GenerationError: If generation fails
        """
        if not prompt or not prompt.strip():
            raise ValueError("Prompt cannot be empty")

        client = await self._get_client()

        try:
            start_time = time.time()

            # Ollama generate API
            # https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-completion
            response = await client.post(
                "/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,  # Get full response at once
                    "options": {
                        "temperature": temperature,
                    },
                },
            )

            response.raise_for_status()
            data = response.json()

            elapsed_ms = (time.time() - start_time) * 1000
            generated_text = data.get("response", "")

            logger.info(
                f"Ollama generation complete: {len(generated_text)} chars in {elapsed_ms:.0f}ms"
            )

            return generated_text

        except httpx.ConnectError as e:
            raise ProviderUnavailableError(
                f"Cannot connect to Ollama at {self.base_url}\n"
                f"Make sure Ollama is running: ollama serve\n"
                f"Error: {e}"
            )

        except httpx.TimeoutException as e:
            raise GenerationError(
                f"Ollama request timed out after {self.timeout}s\n"
                f"Try:\n"
                f"- Use a smaller model (mistral:7b or qwen3:latest)\n"
                f"- Increase timeout\n"
                f"- Reduce prompt length\n"
                f"Error: {e}"
            )

        except httpx.HTTPStatusError as e:
            # Model not found (404)
            if e.response.status_code == 404:
                raise ProviderUnavailableError(
                    f"Model '{self.model}' not found in Ollama\n"
                    f"Pull the model: ollama pull {self.model}\n"
                    f"List available models: ollama list"
                )
            else:
                raise GenerationError(f"Ollama API error: {e.response.status_code} {e.response.text}")

        except Exception as e:
            raise GenerationError(f"Unexpected error during Ollama generation: {e}")

    async def check_health(self) -> dict:
        """
        Check if Ollama is available.

        Returns:
            Health status dictionary
        """
        try:
            client = await self._get_client()
            start_time = time.time()

            # Check if server is running
            response = await client.get("/api/tags")
            response.raise_for_status()

            latency_ms = (time.time() - start_time) * 1000
            data = response.json()

            # Check if our model is available
            models = data.get("models", [])
            model_names = [m["name"] for m in models]
            model_available = self.model in model_names

            return {
                "available": model_available,
                "latency_ms": latency_ms,
                "model": self.model,
                "models_available": len(models),
                "error": None if model_available else f"Model '{self.model}' not found. Run: ollama pull {self.model}",
            }

        except httpx.ConnectError:
            return {
                "available": False,
                "latency_ms": 0,
                "model": self.model,
                "error": f"Cannot connect to Ollama at {self.base_url}. Is it running? (ollama serve)",
            }

        except Exception as e:
            return {
                "available": False,
                "latency_ms": 0,
                "model": self.model,
                "error": f"Health check failed: {e}",
            }

    def estimate_cost(self, prompt: str, temperature: float) -> float:
        """
        Estimate cost (free for local Ollama).

        Args:
            prompt: Text prompt
            temperature: Temperature parameter

        Returns:
            0.0 (local models are free)
        """
        return 0.0

    def estimate_latency(self, prompt: str, temperature: float) -> float:
        """
        Estimate latency based on prompt length.

        Args:
            prompt: Text prompt
            temperature: Temperature parameter

        Returns:
            Estimated latency in ms

        Note:
            Rough heuristics for 7B-8B models on CPU:
            - ~100-200ms baseline
            - ~10-20ms per 100 tokens
        """
        # Rough token estimate (1 token ≈ 4 chars)
        estimated_tokens = len(prompt) // 4

        # Baseline + per-token cost
        baseline_ms = 150
        per_100_tokens_ms = 15

        estimated_latency = baseline_ms + (estimated_tokens / 100) * per_100_tokens_ms

        return estimated_latency

    async def close(self):
        """Close HTTP client and cleanup resources."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None
            logger.info("Ollama provider closed")

    def __repr__(self) -> str:
        return f"OllamaProvider(model='{self.model}', base_url='{self.base_url}')"
