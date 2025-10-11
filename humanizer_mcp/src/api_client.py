"""
Humanizer API Client

HTTP client for calling Humanizer API endpoints.
Handles all API communication and AUI tracking.
"""

import time
from typing import Dict, Any, Optional
from uuid import UUID
import httpx

from src.config import (
    HUMANIZER_API_BASE_URL,
    DEFAULT_USER_ID,
    REQUEST_TIMEOUT,
)


class HumanizerAPIClient:
    """
    HTTP client for Humanizer API.

    Wraps all API calls and provides AUI tracking.
    """

    def __init__(self, base_url: str = HUMANIZER_API_BASE_URL, user_id: Optional[UUID] = None):
        self.base_url = base_url.rstrip("/")
        self.user_id = user_id or DEFAULT_USER_ID
        self.client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()

    async def _track_usage(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        success: bool,
        execution_time_ms: float,
        error_message: Optional[str] = None,
        context: Optional[Dict] = None
    ):
        """
        Track tool usage via AUI API.

        Args:
            tool_name: Tool name
            parameters: Tool parameters
            success: Whether tool succeeded
            execution_time_ms: Execution time
            error_message: Error message if failed
            context: Additional context
        """
        try:
            payload = {
                "user_id": str(self.user_id),
                "tool_name": tool_name,
                "parameters": parameters,
                "success": success,
                "execution_time_ms": execution_time_ms,
                "error_message": error_message,
                "context": context or {"source": "mcp"}
            }

            await self.client.post(
                f"{self.base_url}/aui/track",
                json=payload
            )
        except Exception as e:
            # Don't fail the tool call if tracking fails
            print(f"Warning: Failed to track usage: {e}")

    async def call_with_tracking(
        self,
        tool_name: str,
        endpoint: str,
        method: str = "POST",
        parameters: Optional[Dict] = None,
        context: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Call API endpoint with automatic AUI tracking.

        Args:
            tool_name: Tool name for tracking
            endpoint: API endpoint path (e.g., "/reading/start")
            method: HTTP method
            parameters: Request parameters
            context: Additional tracking context

        Returns:
            API response as dict

        Raises:
            Exception: If API call fails
        """
        start_time = time.time()
        success = False
        error_message = None
        result = None

        try:
            url = f"{self.base_url}{endpoint}"

            if method.upper() == "GET":
                response = await self.client.get(url, params=parameters)
            elif method.upper() == "POST":
                response = await self.client.post(url, json=parameters)
            elif method.upper() == "PUT":
                response = await self.client.put(url, json=parameters)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            response.raise_for_status()
            result = response.json()
            success = True
            return result

        except Exception as e:
            error_message = str(e)
            raise

        finally:
            execution_time_ms = (time.time() - start_time) * 1000

            # Track usage (async, don't wait)
            try:
                await self._track_usage(
                    tool_name=tool_name,
                    parameters=parameters or {},
                    success=success,
                    execution_time_ms=execution_time_ms,
                    error_message=error_message,
                    context=context
                )
            except:
                pass  # Silently ignore tracking errors

    # ========================================
    # Reading API
    # ========================================

    async def start_reading(
        self,
        text: str,
        povm_packs: Optional[list] = None,
        trm_rank: int = 64
    ) -> Dict:
        """Start a reading session."""
        return await self.call_with_tracking(
            tool_name="read_quantum",
            endpoint="/reading/start",
            method="POST",
            parameters={
                "text": text,
                "povm_packs": povm_packs or ["tetralemma"],
                "trm_rank": trm_rank
            }
        )

    async def step_reading(self, reading_id: str, max_steps: int = 1) -> Dict:
        """Execute TRM step."""
        return await self.call_with_tracking(
            tool_name="step_quantum",
            endpoint="/reading/step",
            method="POST",
            parameters={
                "reading_id": reading_id,
                "max_steps": max_steps
            }
        )

    async def measure_reading(self, reading_id: str, povm_pack: str) -> Dict:
        """Measure with additional POVM."""
        return await self.call_with_tracking(
            tool_name="measure_povm",
            endpoint="/reading/measure",
            method="POST",
            parameters={
                "reading_id": reading_id,
                "povm_pack": povm_pack
            }
        )

    async def get_reading_trace(self, reading_id: str) -> Dict:
        """Get full reading trajectory."""
        return await self.call_with_tracking(
            tool_name="get_reading_trace",
            endpoint=f"/reading/{reading_id}/trace",
            method="GET"
        )

    # ========================================
    # POVM API
    # ========================================

    async def list_povm_packs(self) -> Dict:
        """List available POVM packs."""
        return await self.call_with_tracking(
            tool_name="list_povm_packs",
            endpoint="/povm/list",
            method="GET"
        )

    # ========================================
    # ChatGPT API
    # ========================================

    async def search_chatgpt(
        self,
        query: str,
        limit: int = 20,
        conversation_uuid: Optional[str] = None,
        author_role: Optional[str] = None
    ) -> Dict:
        """Search ChatGPT messages."""
        return await self.call_with_tracking(
            tool_name="search_chatgpt",
            endpoint="/chatgpt/search",
            method="POST",
            parameters={
                "query": query,
                "limit": limit,
                "conversation_uuid": conversation_uuid,
                "author_role": author_role
            }
        )

    async def get_chatgpt_conversation(self, conversation_uuid: str) -> Dict:
        """Get conversation details."""
        return await self.call_with_tracking(
            tool_name="get_chatgpt_conversation",
            endpoint=f"/chatgpt/conversation/{conversation_uuid}",
            method="GET"
        )

    async def get_chatgpt_stats(self) -> Dict:
        """Get ChatGPT archive statistics."""
        return await self.call_with_tracking(
            tool_name="get_chatgpt_stats",
            endpoint="/chatgpt/stats",
            method="GET"
        )

    # ========================================
    # AUI API
    # ========================================

    async def get_recommendations(self, context: Optional[str] = None) -> Dict:
        """Get adaptive recommendations."""
        return await self.call_with_tracking(
            tool_name="get_recommendations",
            endpoint="/aui/recommendations",
            method="POST",
            parameters={
                "user_id": str(self.user_id),
                "context": context
            }
        )

    async def get_user_preferences(self) -> Dict:
        """Get user preferences and patterns."""
        return await self.call_with_tracking(
            tool_name="get_user_preferences",
            endpoint=f"/aui/preferences/{self.user_id}",
            method="GET"
        )

    async def get_tool_usage_stats(self, limit: int = 10) -> Dict:
        """Get tool usage statistics."""
        return await self.call_with_tracking(
            tool_name="get_tool_usage_stats",
            endpoint=f"/aui/stats/{self.user_id}",
            method="GET",
            parameters={"limit": limit}
        )
