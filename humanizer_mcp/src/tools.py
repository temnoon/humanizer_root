"""MCP tool definitions for Humanizer API."""

import httpx
from typing import Optional
import json

from src.config import HUMANIZER_API_BASE_URL, REQUEST_TIMEOUT, DEFAULT_USER_ID
from src.database import (
    add_interest_item,
    get_interest_list,
    add_connection,
    get_connections,
    record_usage
)
from src.models import (
    ReadQuantumRequest,
    ReadQuantumResponse,
    SearchRequest,
    SearchChunksResponse,
    SearchImagesResponse,
    ListBooksResponse,
    LibraryStatsResponse,
    TrackInterestRequest,
    TrackInterestResponse,
    GetConnectionsRequest,
    GetConnectionsResponse,
    GetInterestListRequest,
    GetInterestListResponse,
    InterestItemModel,
    ConnectionModel,
    SaveArtifactRequest,
    SaveArtifactResponse,
    SearchArtifactsRequest,
    SearchArtifactsResponse,
    ListArtifactsRequest,
    ListArtifactsResponse,
    GetArtifactRequest,
    GetArtifactResponse,
    ArtifactModel
)


class HumanizerAPIClient:
    """Client for calling Humanizer API."""

    def __init__(self, base_url: str = HUMANIZER_API_BASE_URL):
        self.base_url = base_url
        self.timeout = REQUEST_TIMEOUT

    async def call_agent_tool(self, tool: str, parameters: dict) -> dict:
        """Call Humanizer agent tool via API."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.post(
                f"{self.base_url}/api/agent/chat",
                json={
                    "message": f"Use tool {tool} with parameters: {parameters}",
                    "user_id": DEFAULT_USER_ID
                }
            )
            response.raise_for_status()
            data = response.json()
            # Extract tool result from agent response
            return data.get("result", data)

    async def get_books(self) -> dict:
        """Get list of books."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.get(f"{self.base_url}/api/books/")
            response.raise_for_status()
            return response.json()

    async def search_chunks(self, query: str, limit: int = 10) -> dict:
        """Semantic search for chunks."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.get(
                f"{self.base_url}/api/library/chunks",
                params={"search": query, "limit": limit}
            )
            response.raise_for_status()
            data = response.json()
            # API returns {"results": [...], "count": N}
            # Transform to match SearchChunksResponse model
            if "results" in data:
                return {
                    "chunks": data["results"],
                    "total": data.get("count", len(data["results"])),
                    "limit": limit,
                    "offset": 0
                }
            # If API already returns correct format, pass through
            return data

    async def get_library_stats(self) -> dict:
        """Get library statistics."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.get(f"{self.base_url}/api/library/stats")
            response.raise_for_status()
            return response.json()

    async def search_images(self, query: str, limit: int = 10) -> dict:
        """Search for images/media in archive."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.get(
                f"{self.base_url}/api/library/media",
                params={"search": query, "limit": limit}
            )
            response.raise_for_status()
            data = response.json()
            # API returns {"results": [...], "count": N}
            # Transform to match SearchImagesResponse model
            if "results" in data:
                return {
                    "media": data["results"],
                    "total": data.get("count", len(data["results"])),
                    "offset": 0,
                    "limit": limit
                }
            # If API already returns correct format, pass through
            return data

    async def save_artifact(self, request: SaveArtifactRequest) -> dict:
        """Save an artifact."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.post(
                f"{self.base_url}/api/artifacts/save",
                json=request.model_dump(exclude_none=True)
            )
            response.raise_for_status()
            return response.json()

    async def search_artifacts(self, query: str, artifact_type: Optional[str] = None, limit: int = 20) -> dict:
        """Semantic search over artifacts."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            params = {"query": query, "limit": limit}
            if artifact_type:
                params["artifact_type"] = artifact_type

            response = await client.get(
                f"{self.base_url}/api/artifacts/search",
                params=params
            )
            response.raise_for_status()
            return response.json()

    async def list_artifacts(
        self,
        artifact_type: Optional[str] = None,
        operation: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> dict:
        """List artifacts with filters."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            params = {"limit": limit, "offset": offset}
            if artifact_type:
                params["artifact_type"] = artifact_type
            if operation:
                params["operation"] = operation

            response = await client.get(
                f"{self.base_url}/api/artifacts",
                params=params
            )
            response.raise_for_status()
            return response.json()

    async def get_artifact(self, artifact_id: str) -> dict:
        """Get artifact by ID."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.get(f"{self.base_url}/api/artifacts/{artifact_id}")
            response.raise_for_status()
            return response.json()

    # ============================================================================
    # EMBEDDING EXPLORER ENDPOINTS
    # ============================================================================

    async def semantic_search(self, query: str, k: int = 10, min_similarity: float = 0.0) -> dict:
        """Semantic search across ChatGPT messages."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.post(
                f"{self.base_url}/api/explore/search",
                json={"query": query, "k": k, "min_similarity": min_similarity}
            )
            response.raise_for_status()
            return response.json()

    async def find_neighbors(self, message_uuid: str, k: int = 10, min_similarity: float = 0.0) -> dict:
        """Find messages similar to a specific message."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.post(
                f"{self.base_url}/api/explore/neighbors",
                json={"message_uuid": message_uuid, "k": k, "min_similarity": min_similarity}
            )
            response.raise_for_status()
            return response.json()

    async def compute_semantic_direction(self, positive_query: str, negative_query: str) -> dict:
        """Compute semantic direction between two concepts."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.post(
                f"{self.base_url}/api/explore/direction",
                json={"positive_query": positive_query, "negative_query": negative_query}
            )
            response.raise_for_status()
            return response.json()

    async def analyze_trm_perturbation(
        self,
        text: str,
        positive_query: str = None,
        negative_query: str = None,
        magnitude: float = 0.1,
        povm_pack: str = "tetralemma"
    ) -> dict:
        """Analyze how density matrix changes when text is perturbed."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            payload = {"text": text, "magnitude": magnitude, "povm_pack": povm_pack}
            if positive_query:
                payload["positive_query"] = positive_query
            if negative_query:
                payload["negative_query"] = negative_query

            response = await client.post(
                f"{self.base_url}/api/explore/perturb",
                json=payload
            )
            response.raise_for_status()
            return response.json()

    async def explore_semantic_trajectory(
        self,
        text: str,
        positive_query: str,
        negative_query: str,
        steps: int = 5,
        step_size: float = 0.05
    ) -> dict:
        """Explore semantic trajectory in embedding space."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.post(
                f"{self.base_url}/api/explore/trajectory",
                json={
                    "text": text,
                    "positive_query": positive_query,
                    "negative_query": negative_query,
                    "steps": steps,
                    "step_size": step_size
                }
            )
            response.raise_for_status()
            return response.json()

    async def find_semantic_clusters(self, n_samples: int = 1000, n_clusters: int = 5) -> dict:
        """Find semantic clusters in embedding space."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.post(
                f"{self.base_url}/api/explore/clusters",
                json={"n_samples": n_samples, "n_clusters": n_clusters}
            )
            response.raise_for_status()
            return response.json()

    # ============================================================================
    # CHATGPT CONVERSATION ENDPOINTS
    # ============================================================================

    async def list_conversations(self, page: int = 1, page_size: int = 50, search: str = None) -> dict:
        """List ChatGPT conversations with pagination."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            params = {"page": page, "page_size": page_size}
            if search:
                params["search"] = search

            response = await client.get(
                f"{self.base_url}/api/chatgpt/conversations",
                params=params
            )
            response.raise_for_status()
            return response.json()

    async def get_conversation(self, conversation_uuid: str) -> dict:
        """Get full conversation details."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.get(
                f"{self.base_url}/api/chatgpt/conversation/{conversation_uuid}"
            )
            response.raise_for_status()
            return response.json()

    # ============================================================================
    # TRANSFORMATION ENDPOINTS
    # ============================================================================

    async def transform_text(
        self,
        text: str,
        povm_pack: str = "tone",
        target_stance: dict = None,
        max_iterations: int = 5
    ) -> dict:
        """Transform text using TRM iterative method."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            payload = {
                "text": text,
                "povm_pack": povm_pack,
                "max_iterations": max_iterations
            }
            if target_stance:
                payload["target_stance"] = target_stance

            response = await client.post(
                f"{self.base_url}/transform/trm",
                json=payload
            )
            response.raise_for_status()
            return response.json()


# MCP Tool functions (now with Pydantic validation)

async def read_quantum(request: ReadQuantumRequest) -> ReadQuantumResponse:
    """
    Read text with quantum measurements (POVMs).
    """
    client = HumanizerAPIClient()

    try:
        result = await client.call_agent_tool(
            "read_quantum",
            request.model_dump()
        )

        # Record connection: text → quantum reading → results
        if result.get("results"):
            add_connection(
                user_id=DEFAULT_USER_ID,
                source_type="text",
                source_id=request.text_id,
                target_type="quantum_reading",
                target_id=f"reading_{request.text_id}_{request.start_sentence}",
                transformation="read_quantum",
                metadata={
                    "axes": request.axes.value,
                    "num_sentences": request.num_sentences
                }
            )

        # Record usage
        record_usage(DEFAULT_USER_ID, "read_quantum", success=True)

        # Return validated response
        return ReadQuantumResponse(**result)

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "read_quantum",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def search_chunks_tool(request: SearchRequest) -> SearchChunksResponse:
    """Semantic search across all chunks."""
    client = HumanizerAPIClient()

    try:
        result = await client.search_chunks(request.query, request.limit)
        record_usage(DEFAULT_USER_ID, "search_chunks", success=True)
        return SearchChunksResponse(**result)

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "search_chunks",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def list_books_tool() -> ListBooksResponse:
    """Get list of all books in library."""
    client = HumanizerAPIClient()

    try:
        result = await client.get_books()
        # API returns array of books, wrap in expected format
        if isinstance(result, list):
            result = {"books": result, "count": len(result)}
        record_usage(DEFAULT_USER_ID, "list_books", success=True)
        return ListBooksResponse(**result)

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "list_books",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def get_library_stats_tool() -> LibraryStatsResponse:
    """Get library statistics."""
    client = HumanizerAPIClient()

    try:
        result = await client.get_library_stats()
        record_usage(DEFAULT_USER_ID, "get_library_stats", success=True)
        return LibraryStatsResponse(**result)

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "get_library_stats",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def search_images_tool(request: SearchRequest) -> SearchImagesResponse:
    """Search for images in archive."""
    client = HumanizerAPIClient()

    try:
        result = await client.search_images(request.query, request.limit)
        record_usage(DEFAULT_USER_ID, "search_images", success=True)
        return SearchImagesResponse(**result)

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "search_images",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def track_interest_tool(request: TrackInterestRequest) -> TrackInterestResponse:
    """Add item to interest list (breadcrumbs + wishlist)."""
    try:
        item_dict = add_interest_item(
            user_id=DEFAULT_USER_ID,
            item_type=request.item_type.value,
            item_id=request.item_id,
            title=request.title,
            context=request.context,
            connection_from_id=request.connection_from_id,
            metadata=request.metadata
        )

        record_usage(DEFAULT_USER_ID, "track_interest", success=True)

        return TrackInterestResponse(
            success=True,
            item=InterestItemModel(**item_dict)
        )

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "track_interest",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def get_connections_tool(request: GetConnectionsRequest) -> GetConnectionsResponse:
    """Get connection graph (transformations between entities)."""
    try:
        connections_data = get_connections(
            user_id=DEFAULT_USER_ID,
            item_type=request.item_type,
            item_id=request.item_id,
            limit=request.limit
        )

        record_usage(DEFAULT_USER_ID, "get_connections", success=True)

        return GetConnectionsResponse(
            connections=[ConnectionModel(**c) for c in connections_data],
            count=len(connections_data)
        )

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "get_connections",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def get_interest_list_tool(
    request: GetInterestListRequest
) -> GetInterestListResponse:
    """Get your interest list (breadcrumbs + wishlist)."""
    try:
        items_data = get_interest_list(user_id=DEFAULT_USER_ID, limit=request.limit)

        record_usage(DEFAULT_USER_ID, "get_interest_list", success=True)

        return GetInterestListResponse(
            items=[InterestItemModel(**item) for item in items_data],
            count=len(items_data)
        )

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "get_interest_list",
            success=False,
            metadata={"error": str(e)}
        )
        raise


# ============================================================================
# ARTIFACT TOOLS
# ============================================================================

async def save_artifact_tool(request: SaveArtifactRequest) -> SaveArtifactResponse:
    """Save any content as a persistent artifact."""
    client = HumanizerAPIClient()

    try:
        result = await client.save_artifact(request)

        # Record connection if this artifact has sources
        if result.get("source_chunk_ids") or result.get("source_artifact_ids"):
            add_connection(
                user_id=DEFAULT_USER_ID,
                source_type="operation",
                source_id=request.operation,
                target_type="artifact",
                target_id=result["id"],
                transformation=request.operation,
                metadata={
                    "artifact_type": request.artifact_type,
                    "operation_params": request.source_operation_params or {}
                }
            )

        record_usage(DEFAULT_USER_ID, "save_artifact", success=True)

        return SaveArtifactResponse(
            success=True,
            artifact=ArtifactModel(**result)
        )

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "save_artifact",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def search_artifacts_tool(request: SearchArtifactsRequest) -> SearchArtifactsResponse:
    """Semantic search over all artifacts."""
    client = HumanizerAPIClient()

    try:
        result = await client.search_artifacts(
            query=request.query,
            artifact_type=request.artifact_type,
            limit=request.limit
        )

        record_usage(DEFAULT_USER_ID, "search_artifacts", success=True)

        return SearchArtifactsResponse(**result)

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "search_artifacts",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def list_artifacts_tool(request: ListArtifactsRequest) -> ListArtifactsResponse:
    """List artifacts with filters."""
    client = HumanizerAPIClient()

    try:
        result = await client.list_artifacts(
            artifact_type=request.artifact_type,
            operation=request.operation,
            limit=request.limit,
            offset=request.offset
        )

        record_usage(DEFAULT_USER_ID, "list_artifacts", success=True)

        # Parse artifacts
        artifacts = [ArtifactModel(**a) for a in result["artifacts"]]

        return ListArtifactsResponse(
            artifacts=artifacts,
            total=result["total"],
            limit=result["limit"],
            offset=result["offset"]
        )

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "list_artifacts",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def get_artifact_tool(request: GetArtifactRequest) -> GetArtifactResponse:
    """Get full artifact details."""
    client = HumanizerAPIClient()

    try:
        result = await client.get_artifact(request.artifact_id)

        record_usage(DEFAULT_USER_ID, "get_artifact", success=True)

        return GetArtifactResponse(artifact=ArtifactModel(**result))

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "get_artifact",
            success=False,
            metadata={"error": str(e)}
        )
        raise


# ============================================================================
# EMBEDDING EXPLORER TOOLS
# ============================================================================

async def semantic_search_tool(request: SearchRequest) -> dict:
    """Semantic search across ChatGPT messages."""
    client = HumanizerAPIClient()

    try:
        # Use SearchRequest (query + limit) and map to API
        result = await client.semantic_search(
            query=request.query,
            k=request.limit,
            min_similarity=0.0
        )
        record_usage(DEFAULT_USER_ID, "semantic_search", success=True)
        return result

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "semantic_search",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def find_neighbors_tool(message_uuid: str, k: int = 10) -> dict:
    """Find messages similar to a specific message."""
    client = HumanizerAPIClient()

    try:
        result = await client.find_neighbors(message_uuid=message_uuid, k=k)
        record_usage(DEFAULT_USER_ID, "find_neighbors", success=True)
        return result

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "find_neighbors",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def compute_direction_tool(positive_query: str, negative_query: str) -> dict:
    """Compute semantic direction between concepts."""
    client = HumanizerAPIClient()

    try:
        result = await client.compute_semantic_direction(
            positive_query=positive_query,
            negative_query=negative_query
        )
        record_usage(DEFAULT_USER_ID, "compute_direction", success=True)
        return result

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "compute_direction",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def analyze_perturbation_tool(
    text: str,
    positive_query: str = None,
    negative_query: str = None,
    magnitude: float = 0.1,
    povm_pack: str = "tetralemma"
) -> dict:
    """Analyze TRM perturbation of text."""
    client = HumanizerAPIClient()

    try:
        result = await client.analyze_trm_perturbation(
            text=text,
            positive_query=positive_query,
            negative_query=negative_query,
            magnitude=magnitude,
            povm_pack=povm_pack
        )
        record_usage(DEFAULT_USER_ID, "analyze_perturbation", success=True)
        return result

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "analyze_perturbation",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def explore_trajectory_tool(
    text: str,
    positive_query: str,
    negative_query: str,
    steps: int = 5,
    step_size: float = 0.05
) -> dict:
    """Explore semantic trajectory."""
    client = HumanizerAPIClient()

    try:
        result = await client.explore_semantic_trajectory(
            text=text,
            positive_query=positive_query,
            negative_query=negative_query,
            steps=steps,
            step_size=step_size
        )
        record_usage(DEFAULT_USER_ID, "explore_trajectory", success=True)
        return result

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "explore_trajectory",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def find_clusters_tool(n_samples: int = 1000, n_clusters: int = 5) -> dict:
    """Find semantic clusters."""
    client = HumanizerAPIClient()

    try:
        result = await client.find_semantic_clusters(
            n_samples=n_samples,
            n_clusters=n_clusters
        )
        record_usage(DEFAULT_USER_ID, "find_clusters", success=True)
        return result

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "find_clusters",
            success=False,
            metadata={"error": str(e)}
        )
        raise


# ============================================================================
# CHATGPT CONVERSATION TOOLS
# ============================================================================

async def list_conversations_tool(
    page: int = 1,
    page_size: int = 50,
    search: str = None
) -> dict:
    """List ChatGPT conversations."""
    client = HumanizerAPIClient()

    try:
        result = await client.list_conversations(
            page=page,
            page_size=page_size,
            search=search
        )
        record_usage(DEFAULT_USER_ID, "list_conversations", success=True)
        return result

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "list_conversations",
            success=False,
            metadata={"error": str(e)}
        )
        raise


async def get_conversation_tool(conversation_uuid: str) -> dict:
    """Get conversation details."""
    client = HumanizerAPIClient()

    try:
        result = await client.get_conversation(conversation_uuid=conversation_uuid)
        record_usage(DEFAULT_USER_ID, "get_conversation", success=True)
        return result

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "get_conversation",
            success=False,
            metadata={"error": str(e)}
        )
        raise


# ============================================================================
# TRANSFORMATION TOOLS
# ============================================================================

async def transform_text_tool(
    text: str,
    povm_pack: str = "tone",
    target_stance: dict = None,
    max_iterations: int = 5
) -> dict:
    """Transform text using TRM."""
    client = HumanizerAPIClient()

    try:
        result = await client.transform_text(
            text=text,
            povm_pack=povm_pack,
            target_stance=target_stance,
            max_iterations=max_iterations
        )
        record_usage(DEFAULT_USER_ID, "transform_text", success=True)
        return result

    except Exception as e:
        record_usage(
            DEFAULT_USER_ID,
            "transform_text",
            success=False,
            metadata={"error": str(e)}
        )
        raise
