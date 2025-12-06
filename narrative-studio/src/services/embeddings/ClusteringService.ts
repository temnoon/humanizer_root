/**
 * ClusteringService - Semantic clustering and anchor discovery
 *
 * Discovers natural clusters in embedding space using HDBSCAN.
 * Computes anchors (centroids) and anti-anchors (distant points).
 */

import { HDBSCAN } from 'hdbscan-ts';
import { v4 as uuidv4 } from 'uuid';
import { EmbeddingDatabase } from './EmbeddingDatabase.js';
import {
  computeCentroid,
  cosineSimilarity,
  findMedoid,
  findFurthest,
} from './EmbeddingGenerator.js';
import type { Cluster, Anchor, AnchorType } from './types.js';

export interface ClusteringOptions {
  /** Minimum cluster size (default: 5) */
  minClusterSize?: number;
  /** Minimum samples for core points (default: 3) */
  minSamples?: number;
  /** Maximum clusters to return (default: 50) */
  maxClusters?: number;
  /** Source table for embeddings */
  sourceTable?: 'messages' | 'paragraphs' | 'sentences';
  /** Maximum sample size for HDBSCAN (default: 8000 to avoid OOM) */
  maxSampleSize?: number;
}

export interface DiscoveredCluster {
  id: string;
  centroid: number[];
  memberIds: string[];
  memberCount: number;
  coherence: number;
  sampleTexts: string[];
}

export interface AnchorResult {
  id: string;
  name: string;
  anchorType: AnchorType;
  embedding: number[];
  sourceIds: string[];
}

const DEFAULT_OPTIONS: ClusteringOptions = {
  minClusterSize: 5,
  minSamples: 3,
  maxClusters: 50,
  sourceTable: 'messages',
  maxSampleSize: 8000, // Limit to avoid OOM with HDBSCAN
};

export class ClusteringService {
  private db: EmbeddingDatabase;

  constructor(db: EmbeddingDatabase) {
    this.db = db;
  }

  /**
   * Discover clusters in the embedding space
   */
  async discoverClusters(options: ClusteringOptions = {}): Promise<DiscoveredCluster[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (!this.db.hasVectorSupport()) {
      throw new Error('Vector operations not available');
    }

    console.log(`Discovering clusters (minSize: ${opts.minClusterSize}, minSamples: ${opts.minSamples}, maxSample: ${opts.maxSampleSize})...`);

    // Get all embeddings from the specified table
    const allMessages = this.db.getAllMessages();
    const embeddingIds: string[] = [];
    const embeddings: number[][] = [];
    const idToMessage = new Map<string, { id: string; content: string; conversationId: string }>();

    for (const msg of allMessages) {
      if (msg.embeddingId) {
        const embedding = this.db.getEmbedding('messages', msg.embeddingId);
        if (embedding) {
          embeddingIds.push(msg.embeddingId);
          embeddings.push(embedding);
          idToMessage.set(msg.embeddingId, {
            id: msg.id,
            content: msg.content,
            conversationId: msg.conversationId,
          });
        }
      }
    }

    if (embeddings.length < opts.minClusterSize! * 2) {
      console.log('Not enough embeddings for clustering');
      return [];
    }

    // Sample if too many embeddings to avoid OOM
    let sampleIndices: number[] | null = null;
    let sampledEmbeddings = embeddings;
    let sampledIds = embeddingIds;

    if (embeddings.length > opts.maxSampleSize!) {
      console.log(`Sampling ${opts.maxSampleSize} from ${embeddings.length} embeddings...`);
      sampleIndices = this.stratifiedSample(embeddings.length, opts.maxSampleSize!);
      sampledEmbeddings = sampleIndices.map(i => embeddings[i]);
      sampledIds = sampleIndices.map(i => embeddingIds[i]);
    }

    console.log(`Clustering ${sampledEmbeddings.length} embeddings...`);

    // Run HDBSCAN on sample
    const hdbscan = new HDBSCAN({
      minClusterSize: opts.minClusterSize!,
      minSamples: opts.minSamples!,
      metric: 'cosine' as 'euclidean', // cosine works at runtime but types only define euclidean
    });

    const labels = hdbscan.fit(sampledEmbeddings);

    // Group by cluster label
    const clusterMap = new Map<number, number[]>();
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      if (label === -1) continue; // Skip noise

      if (!clusterMap.has(label)) {
        clusterMap.set(label, []);
      }
      clusterMap.get(label)!.push(i);
    }

    console.log(`Found ${clusterMap.size} clusters from sampled data`);

    // Build initial cluster objects from sample
    const clusters: DiscoveredCluster[] = [];
    const clusterCentroids: { centroid: number[]; clusterIndex: number }[] = [];

    for (const [label, indices] of clusterMap.entries()) {
      if (clusters.length >= opts.maxClusters!) break;

      const clusterEmbeddings = indices.map(i => sampledEmbeddings[i]);
      const memberIds = indices.map(i => sampledIds[i]);

      // Compute centroid
      const centroid = computeCentroid(clusterEmbeddings);

      // Compute coherence (average similarity to centroid)
      const similarities = clusterEmbeddings.map(e => cosineSimilarity(e, centroid));
      const coherence = similarities.reduce((a, b) => a + b, 0) / similarities.length;

      // Get sample texts (closest to centroid)
      const withDistance = indices.map((idx, i) => ({
        idx,
        embeddingId: sampledIds[idx],
        similarity: similarities[i],
      }));
      withDistance.sort((a, b) => b.similarity - a.similarity);

      const sampleTexts = withDistance.slice(0, 5).map(item => {
        const msg = idToMessage.get(item.embeddingId);
        return msg ? msg.content.substring(0, 200) : '';
      }).filter(t => t.length > 0);

      const clusterId = uuidv4();
      const clusterIndex = clusters.length;

      clusters.push({
        id: clusterId,
        centroid,
        memberIds,
        memberCount: memberIds.length,
        coherence,
        sampleTexts,
      });

      clusterCentroids.push({ centroid, clusterIndex });
    }

    // Assign non-sampled points to nearest cluster (if we sampled)
    if (sampleIndices !== null && clusters.length > 0) {
      const sampledSet = new Set(sampleIndices);
      let assigned = 0;

      for (let i = 0; i < embeddings.length; i++) {
        if (sampledSet.has(i)) continue; // Skip sampled points

        const embedding = embeddings[i];
        const embeddingId = embeddingIds[i];

        // Find nearest cluster centroid
        let bestCluster = -1;
        let bestSimilarity = -Infinity;

        for (const { centroid, clusterIndex } of clusterCentroids) {
          const similarity = cosineSimilarity(embedding, centroid);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestCluster = clusterIndex;
          }
        }

        // Only assign if similarity is reasonable (> 0.3)
        if (bestCluster >= 0 && bestSimilarity > 0.3) {
          clusters[bestCluster].memberIds.push(embeddingId);
          clusters[bestCluster].memberCount++;
          assigned++;
        }
      }

      console.log(`Assigned ${assigned} additional points to clusters`);
    }

    // Sort by member count descending (larger clusters first)
    clusters.sort((a, b) => b.memberCount - a.memberCount);

    return clusters;
  }

  /**
   * Random sampling helper
   */
  private stratifiedSample(total: number, sampleSize: number): number[] {
    const indices: number[] = [];
    const step = total / sampleSize;

    // Systematic sampling with random start
    const start = Math.random() * step;
    for (let i = 0; i < sampleSize && indices.length < total; i++) {
      const idx = Math.floor(start + i * step);
      if (idx < total) {
        indices.push(idx);
      }
    }

    // Shuffle to remove ordering bias
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    return indices;
  }

  /**
   * Save discovered clusters to database
   */
  async saveClusters(clusters: DiscoveredCluster[]): Promise<void> {
    // Clear existing clusters
    this.db.clearClusters();

    for (const cluster of clusters) {
      // Insert cluster record
      const clusterId = this.db.insertCluster({
        name: null,  // Will be labeled later
        description: null,
        centroidEmbeddingId: null,
        memberCount: cluster.memberCount,
        coherenceScore: cluster.coherence,
      });

      // Insert centroid embedding
      const centroidEmbeddingId = uuidv4();
      this.db.insertClusterEmbedding(centroidEmbeddingId, clusterId, cluster.centroid);

      // Update cluster with centroid ID
      // (Would need a method for this, using raw update for now)

      // Insert member relationships
      for (const memberId of cluster.memberIds) {
        const embedding = this.db.getEmbedding('messages', memberId);
        if (embedding) {
          const distance = 1 - cosineSimilarity(embedding, cluster.centroid);
          this.db.addClusterMember(clusterId, memberId, distance);
        }
      }
    }

    console.log(`Saved ${clusters.length} clusters to database`);
  }

  /**
   * Compute an anchor point from a set of embedding IDs
   */
  computeAnchor(
    name: string,
    embeddingIds: string[],
    method: 'centroid' | 'medoid' = 'centroid'
  ): AnchorResult {
    const embeddings: number[][] = [];

    for (const id of embeddingIds) {
      const embedding = this.db.getEmbedding('messages', id);
      if (embedding) {
        embeddings.push(embedding);
      }
    }

    if (embeddings.length === 0) {
      throw new Error('No valid embeddings found for anchor computation');
    }

    let anchorEmbedding: number[];

    if (method === 'centroid') {
      anchorEmbedding = computeCentroid(embeddings);
    } else {
      const medoid = findMedoid(embeddings);
      anchorEmbedding = medoid.embedding;
    }

    const id = uuidv4();

    return {
      id,
      name,
      anchorType: 'anchor',
      embedding: anchorEmbedding,
      sourceIds: embeddingIds,
    };
  }

  /**
   * Compute an anti-anchor (point far from target embeddings)
   */
  computeAntiAnchor(
    name: string,
    targetEmbeddingIds: string[],
    k: number = 100
  ): AnchorResult {
    // First compute the centroid of targets
    const targetEmbeddings: number[][] = [];
    for (const id of targetEmbeddingIds) {
      const embedding = this.db.getEmbedding('messages', id);
      if (embedding) {
        targetEmbeddings.push(embedding);
      }
    }

    if (targetEmbeddings.length === 0) {
      throw new Error('No valid target embeddings found');
    }

    const targetCentroid = computeCentroid(targetEmbeddings);

    // Get all message embeddings
    const allMessages = this.db.getAllMessages();
    const allEmbeddings: { id: string; embedding: number[] }[] = [];

    for (const msg of allMessages) {
      if (msg.embeddingId && !targetEmbeddingIds.includes(msg.embeddingId)) {
        const embedding = this.db.getEmbedding('messages', msg.embeddingId);
        if (embedding) {
          allEmbeddings.push({ id: msg.embeddingId, embedding });
        }
      }
    }

    // Find k most distant embeddings
    const furthest = findFurthest(
      allEmbeddings.map(e => e.embedding),
      targetCentroid,
      k
    );

    const distantIds = furthest.map(f => allEmbeddings[f.index].id);
    const distantEmbeddings = furthest.map(f => allEmbeddings[f.index].embedding);

    // Anti-anchor is centroid of distant points
    const antiAnchorEmbedding = computeCentroid(distantEmbeddings);

    const id = uuidv4();

    return {
      id,
      name,
      anchorType: 'anti_anchor',
      embedding: antiAnchorEmbedding,
      sourceIds: distantIds,
    };
  }

  /**
   * Save an anchor to database
   */
  saveAnchor(anchor: AnchorResult): string {
    // Save to regular anchors table
    const anchorId = this.db.insertAnchor({
      name: anchor.name,
      description: null,
      anchorType: anchor.anchorType,
      embedding: anchor.embedding,
      sourceEmbeddingIds: anchor.sourceIds,
    });

    // Also save to vector table for similarity search
    this.db.insertAnchorEmbedding(anchorId, anchor.anchorType, anchor.name, anchor.embedding);

    return anchorId;
  }

  /**
   * Find content between multiple anchors (interpolation in embedding space)
   */
  findBetweenAnchors(
    anchorIds: string[],
    weights?: number[],
    limit: number = 20
  ): Array<{ id: string; content: string; similarity: number }> {
    // Get anchor embeddings
    const anchors = anchorIds.map(id => this.db.getAnchor(id)).filter(a => a !== null);

    if (anchors.length === 0) {
      throw new Error('No valid anchors found');
    }

    // Default to equal weights
    const w = weights || anchors.map(() => 1 / anchors.length);

    // Compute weighted centroid of anchors
    const dim = anchors[0]!.embedding.length;
    const interpolated = new Array(dim).fill(0);

    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i]!;
      for (let d = 0; d < dim; d++) {
        interpolated[d] += anchor.embedding[d] * w[i];
      }
    }

    // Normalize
    const norm = Math.sqrt(interpolated.reduce((sum, x) => sum + x * x, 0));
    if (norm > 0) {
      for (let d = 0; d < dim; d++) {
        interpolated[d] /= norm;
      }
    }

    // Search for messages near this point
    const results = this.db.searchMessages(interpolated, limit);

    return results.map(r => ({
      id: r.id,
      content: r.content,
      similarity: r.similarity,
    }));
  }

  /**
   * Get cluster summary statistics
   */
  getClusterStats(): {
    totalClusters: number;
    totalAnchors: number;
    avgClusterSize: number;
    avgCoherence: number;
  } {
    const clusters = this.db.getAllClusters();
    const anchors = this.db.getAllAnchors();

    const totalClusters = clusters.length;
    const totalAnchors = anchors.length;

    const avgClusterSize = totalClusters > 0
      ? clusters.reduce((sum, c) => sum + c.memberCount, 0) / totalClusters
      : 0;

    const avgCoherence = totalClusters > 0
      ? clusters.reduce((sum, c) => sum + c.coherenceScore, 0) / totalClusters
      : 0;

    return {
      totalClusters,
      totalAnchors,
      avgClusterSize,
      avgCoherence,
    };
  }
}
