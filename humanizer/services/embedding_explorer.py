"""
Embedding Space Explorer - Navigate and analyze embedding space with TRM integration

Provides tools to:
1. Find similar messages (k-NN search)
2. Explore neighborhoods in embedding space
3. Discover semantic directions
4. Compute TRM perturbations (how ρ changes with embedding changes)
5. Visualize embedding trajectories
"""

import asyncio
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID
import numpy as np
from numpy.typing import NDArray
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.models.chatgpt import ChatGPTMessage
from humanizer.services.embedding import EmbeddingService
from humanizer.core.trm.density import construct_density_matrix
from humanizer.core.trm.povm import get_all_packs, apply_born_rule


class EmbeddingExplorer:
    """
    Explore embedding space with TRM perturbation theory.

    Key Concepts:
    - **Semantic Neighborhood**: Messages close in embedding space
    - **Semantic Direction**: Vector in embedding space with meaning
    - **TRM Perturbation**: How density matrix ρ changes when embedding shifts
    - **Trajectory**: Path through embedding space with evolving semantics
    """

    def __init__(self, embedding_service: Optional[EmbeddingService] = None):
        self.embedding_service = embedding_service or EmbeddingService()

    async def find_neighbors(
        self,
        session: AsyncSession,
        query_embedding: NDArray[np.float32],
        k: int = 10,
        exclude_uuid: Optional[UUID] = None,
        min_similarity: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Find k nearest neighbors in embedding space.

        Args:
            session: Database session
            query_embedding: Query vector (1024-dim)
            k: Number of neighbors to return
            exclude_uuid: Exclude this message UUID (for "find similar except self")
            min_similarity: Minimum cosine similarity threshold

        Returns:
            List of neighbors with metadata:
                - uuid: Message UUID
                - content_text: Message content
                - similarity: Cosine similarity (0-1)
                - distance: Cosine distance
        """
        # Build query with optional exclusion
        stmt = select(
            ChatGPTMessage.uuid,
            ChatGPTMessage.content_text,
            ChatGPTMessage.author_role,
            ChatGPTMessage.conversation_uuid,
            ChatGPTMessage.embedding.cosine_distance(query_embedding).label('distance')
        ).where(
            ChatGPTMessage.embedding.isnot(None)
        )

        if exclude_uuid:
            stmt = stmt.where(ChatGPTMessage.uuid != exclude_uuid)

        stmt = stmt.order_by(
            ChatGPTMessage.embedding.cosine_distance(query_embedding)
        ).limit(k)

        result = await session.execute(stmt)
        rows = result.all()

        # Format results
        neighbors = []
        for row in rows:
            similarity = 1.0 - row.distance

            if similarity >= min_similarity:
                neighbors.append({
                    'uuid': str(row.uuid),
                    'content_text': row.content_text,
                    'author_role': row.author_role,
                    'conversation_uuid': str(row.conversation_uuid),
                    'similarity': float(similarity),
                    'distance': float(row.distance),
                })

        return neighbors

    async def compute_semantic_direction(
        self,
        session: AsyncSession,
        positive_query: str,
        negative_query: str,
    ) -> NDArray[np.float32]:
        """
        Compute a semantic direction vector in embedding space.

        Direction = embed(positive_query) - embed(negative_query)

        Examples:
            - "technical" - "casual" = direction toward technical language
            - "detailed" - "concise" = direction toward verbosity
            - "formal" - "informal" = direction toward formality

        Args:
            session: Database session
            positive_query: What we want more of
            negative_query: What we want less of

        Returns:
            Direction vector (1024-dim, normalized)
        """
        async with self.embedding_service as service:
            pos_embedding = await service.embed_text(positive_query)
            neg_embedding = await service.embed_text(negative_query)

            # Compute direction
            direction = pos_embedding - neg_embedding

            # Normalize
            norm = np.linalg.norm(direction)
            if norm > 0:
                direction = direction / norm

            return direction

    async def perturb_embedding(
        self,
        base_embedding: NDArray[np.float32],
        direction: NDArray[np.float32],
        magnitude: float = 0.1,
    ) -> NDArray[np.float32]:
        """
        Perturb embedding in a semantic direction.

        new_embedding = base + magnitude * direction

        Args:
            base_embedding: Starting point (1024-dim)
            direction: Direction to move (1024-dim, normalized)
            magnitude: How far to move (default: 0.1)

        Returns:
            Perturbed embedding (1024-dim)
        """
        perturbed = base_embedding + magnitude * direction

        # Normalize to maintain same scale
        norm = np.linalg.norm(perturbed)
        if norm > 0:
            perturbed = perturbed / norm * np.linalg.norm(base_embedding)

        return perturbed

    async def compute_trm_perturbation(
        self,
        text: str,
        direction: NDArray[np.float32],
        magnitude: float = 0.1,
        povm_pack: str = "tetralemma",
        trm_rank: int = 64,
    ) -> Dict[str, Any]:
        """
        Compute TRM perturbation when embedding changes.

        This is the key insight:
        1. Get embedding for text → construct ρ₀
        2. Perturb embedding in direction → get ρ₁
        3. Measure both with POVM → see how probabilities change
        4. Compute Δρ = ρ₁ - ρ₀ (matrix perturbation)

        Args:
            text: Original text
            direction: Semantic direction vector
            magnitude: Perturbation magnitude
            povm_pack: POVM pack for measurements
            trm_rank: Rank for density matrices

        Returns:
            Dict with:
                - original_reading: POVM measurements of ρ₀
                - perturbed_reading: POVM measurements of ρ₁
                - delta_probabilities: Change in POVM probabilities
                - rho_distance: Frobenius distance ||ρ₁ - ρ₀||_F
                - prediction: Which semantic axis changed most
        """
        async with self.embedding_service as service:
            # Get original embedding and construct ρ₀
            original_embedding = await service.embed_text(text)
            rho_0 = construct_density_matrix(original_embedding, rank=trm_rank)

            # Perturb embedding and construct ρ₁
            perturbed_embedding = await self.perturb_embedding(
                original_embedding, direction, magnitude
            )
            rho_1 = construct_density_matrix(perturbed_embedding, rank=trm_rank)

            # Get POVM pack
            all_packs = get_all_packs(rank=trm_rank)
            povm_pack_obj = all_packs.get(povm_pack)
            if not povm_pack_obj:
                raise ValueError(f"Unknown POVM pack: {povm_pack}")

            # Measure both using Born rule
            readings_0 = {
                op.name: apply_born_rule(rho_0, op.E)
                for op in povm_pack_obj.operators
            }
            readings_1 = {
                op.name: apply_born_rule(rho_1, op.E)
                for op in povm_pack_obj.operators
            }

            # Compute probability changes
            delta_probs = {
                axis: readings_1[axis] - readings_0[axis]
                for axis in readings_0.keys()
            }

            # Compute matrix distance
            delta_rho = rho_1.rho - rho_0.rho
            rho_distance = float(np.linalg.norm(delta_rho, ord='fro'))

            # Find which axis changed most
            max_change_axis = max(delta_probs.items(), key=lambda x: abs(x[1]))

            return {
                'original_reading': {k: float(v) for k, v in readings_0.items()},
                'perturbed_reading': {k: float(v) for k, v in readings_1.items()},
                'delta_probabilities': {k: float(v) for k, v in delta_probs.items()},
                'rho_distance': rho_distance,
                'max_change': {
                    'axis': max_change_axis[0],
                    'delta': float(max_change_axis[1]),
                },
                'embedding_shift': float(np.linalg.norm(perturbed_embedding - original_embedding)),
            }

    async def explore_trajectory(
        self,
        text: str,
        direction: NDArray[np.float32],
        steps: int = 5,
        step_size: float = 0.05,
        povm_pack: str = "tetralemma",
        trm_rank: int = 64,
    ) -> List[Dict[str, Any]]:
        """
        Explore a trajectory in embedding space.

        Moves along direction in steps, measuring how TRM changes.
        Useful for understanding how semantics evolve along a path.

        Args:
            text: Starting text
            direction: Direction to explore
            steps: Number of steps
            step_size: Distance per step
            povm_pack: POVM pack for measurements
            trm_rank: Rank for density matrices

        Returns:
            List of trajectory points with:
                - step: Step number (0 = original)
                - magnitude: Distance from origin
                - reading: POVM measurements
                - rho_distance: Distance from original ρ
        """
        async with self.embedding_service as service:
            # Get original embedding
            original_embedding = await service.embed_text(text)
            rho_0 = construct_density_matrix(original_embedding, rank=trm_rank)

            # Get POVM pack
            all_packs = get_all_packs(rank=trm_rank)
            povm_pack_obj = all_packs.get(povm_pack)
            if not povm_pack_obj:
                raise ValueError(f"Unknown POVM pack: {povm_pack}")

            # Measure original using Born rule
            readings_0 = {
                op.name: apply_born_rule(rho_0, op.E)
                for op in povm_pack_obj.operators
            }

            trajectory = [
                {
                    'step': 0,
                    'magnitude': 0.0,
                    'reading': {k: float(v) for k, v in readings_0.items()},
                    'rho_distance': 0.0,
                }
            ]

            # Explore trajectory
            for i in range(1, steps + 1):
                magnitude = i * step_size

                # Perturb embedding
                perturbed = await self.perturb_embedding(
                    original_embedding, direction, magnitude
                )

                # Construct ρ and measure using Born rule
                rho = construct_density_matrix(perturbed, rank=trm_rank)
                readings = {
                    op.name: apply_born_rule(rho, op.E)
                    for op in povm_pack_obj.operators
                }

                # Compute distance from original
                delta_rho = rho.rho - rho_0.rho
                rho_distance = float(np.linalg.norm(delta_rho, ord='fro'))

                trajectory.append({
                    'step': i,
                    'magnitude': float(magnitude),
                    'reading': {k: float(v) for k, v in readings.items()},
                    'rho_distance': rho_distance,
                })

            return trajectory

    async def find_semantic_clusters(
        self,
        session: AsyncSession,
        n_samples: int = 1000,
        n_clusters: int = 5,
    ) -> Dict[str, Any]:
        """
        Find semantic clusters in embedding space.

        Uses k-means clustering on a sample of messages.

        Args:
            session: Database session
            n_samples: Number of messages to sample
            n_clusters: Number of clusters to find

        Returns:
            Dict with:
                - clusters: List of cluster info
                - centroids: Cluster centroids (n_clusters x 1024)
        """
        from sklearn.cluster import KMeans

        # Sample random messages with embeddings
        stmt = select(
            ChatGPTMessage.uuid,
            ChatGPTMessage.content_text,
            ChatGPTMessage.embedding
        ).where(
            ChatGPTMessage.embedding.isnot(None)
        ).order_by(
            text('RANDOM()')
        ).limit(n_samples)

        result = await session.execute(stmt)
        rows = result.all()

        # Extract embeddings
        embeddings = np.array([row.embedding for row in rows])
        uuids = [str(row.uuid) for row in rows]
        texts = [row.content_text for row in rows]

        # Cluster
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        labels = kmeans.fit_predict(embeddings)

        # Build cluster info
        clusters = []
        for i in range(n_clusters):
            mask = labels == i
            cluster_texts = [texts[j] for j in range(len(texts)) if mask[j]]
            cluster_uuids = [uuids[j] for j in range(len(uuids)) if mask[j]]

            # Sample representative texts
            sample_size = min(5, len(cluster_texts))
            samples = np.random.choice(cluster_texts, sample_size, replace=False).tolist()

            clusters.append({
                'cluster_id': i,
                'size': int(np.sum(mask)),
                'centroid': kmeans.cluster_centers_[i].tolist(),
                'sample_texts': samples,
                'sample_uuids': cluster_uuids[:sample_size],
            })

        return {
            'n_clusters': n_clusters,
            'n_samples': n_samples,
            'clusters': clusters,
            'centroids': kmeans.cluster_centers_.tolist(),
        }
