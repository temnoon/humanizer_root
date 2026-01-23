/**
 * HDBSCAN Implementation
 *
 * Hierarchical Density-Based Spatial Clustering of Applications with Noise.
 *
 * Algorithm steps:
 * 1. Compute core distances for each point
 * 2. Build mutual reachability graph
 * 3. Construct minimum spanning tree
 * 4. Build cluster hierarchy
 * 5. Condense tree and extract clusters
 *
 * Based on: Campello et al. "Hierarchical Density Estimates for Data Clustering,
 * Visualization, and Outlier Detection" (2015)
 */

import type {
  HDBSCANConfig,
  ClusterPoint,
  MSTEdge,
  HierarchyNode,
  CondensedNode,
  DistanceMetric,
} from './types.js';
import {
  computeDistanceMatrix,
  computeCoreDistances,
  computeMutualReachabilityMatrix,
} from './distance.js';
import { DEFAULT_HDBSCAN_CONFIG } from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// HDBSCAN MAIN CLASS
// ═══════════════════════════════════════════════════════════════════

/**
 * HDBSCAN clustering algorithm
 */
export class HDBSCAN {
  private config: Required<HDBSCANConfig>;

  constructor(config: Partial<HDBSCANConfig> = {}) {
    this.config = {
      ...DEFAULT_HDBSCAN_CONFIG,
      ...config,
      minSamples: config.minSamples ?? config.minClusterSize ?? DEFAULT_HDBSCAN_CONFIG.minClusterSize,
    } as Required<HDBSCANConfig>;
  }

  /**
   * Fit the model and return cluster labels
   *
   * @param points Points to cluster
   * @returns Array of cluster labels (-1 = noise)
   */
  fit(points: ClusterPoint[]): number[] {
    const n = points.length;

    if (n === 0) return [];
    if (n === 1) return this.config.allowSingleCluster ? [0] : [-1];
    if (n < this.config.minClusterSize) {
      return new Array(n).fill(-1);
    }

    const embeddings = points.map((p) => p.embedding);

    // Step 1: Compute distance matrix
    const distanceMatrix = computeDistanceMatrix(embeddings, this.config.metric);

    // Step 2: Compute core distances
    const coreDistances = computeCoreDistances(
      embeddings,
      this.config.minSamples,
      this.config.metric
    );

    // Step 3: Build mutual reachability matrix
    const mrdMatrix = computeMutualReachabilityMatrix(coreDistances, distanceMatrix);

    // Step 4: Build MST
    const mst = this.buildMST(mrdMatrix);

    // Step 5: Build hierarchy
    const hierarchy = this.buildHierarchy(mst, n);

    // Step 6: Condense tree
    const condensedTree = this.condenseTree(hierarchy, n);

    // Step 7: Extract clusters
    const labels = this.extractClusters(condensedTree, n);

    return labels;
  }

  /**
   * Build minimum spanning tree using Prim's algorithm
   */
  private buildMST(distanceMatrix: number[][]): MSTEdge[] {
    const n = distanceMatrix.length;
    const mst: MSTEdge[] = [];
    const inTree = new Array(n).fill(false);
    const minDist = new Array(n).fill(Infinity);
    const minEdge = new Array(n).fill(-1);

    // Start from node 0
    minDist[0] = 0;

    for (let i = 0; i < n; i++) {
      // Find minimum distance node not in tree
      let u = -1;
      for (let j = 0; j < n; j++) {
        if (!inTree[j] && (u === -1 || minDist[j] < minDist[u])) {
          u = j;
        }
      }

      inTree[u] = true;

      // Add edge to MST (except for first node)
      if (minEdge[u] !== -1) {
        mst.push({
          from: minEdge[u],
          to: u,
          weight: minDist[u],
        });
      }

      // Update distances for adjacent nodes
      for (let v = 0; v < n; v++) {
        if (!inTree[v] && distanceMatrix[u][v] < minDist[v]) {
          minDist[v] = distanceMatrix[u][v];
          minEdge[v] = u;
        }
      }
    }

    // Sort by weight for hierarchy building
    mst.sort((a, b) => a.weight - b.weight);

    return mst;
  }

  /**
   * Build cluster hierarchy from MST using Union-Find
   */
  private buildHierarchy(mst: MSTEdge[], n: number): HierarchyNode[] {
    const hierarchy: HierarchyNode[] = [];

    // Union-Find structure
    const parent = Array.from({ length: n * 2 - 1 }, (_, i) => i);
    const size = new Array(n * 2 - 1).fill(1);
    let nextNodeId = n;

    const find = (x: number): number => {
      if (parent[x] !== x) {
        parent[x] = find(parent[x]);
      }
      return parent[x];
    };

    const union = (x: number, y: number, weight: number): number => {
      const rootX = find(x);
      const rootY = find(y);

      if (rootX === rootY) return rootX;

      // Create new internal node
      const newNode: HierarchyNode = {
        id: nextNodeId,
        left: rootX,
        right: rootY,
        distance: weight,
        size: size[rootX] + size[rootY],
        lambda: weight > 0 ? 1 / weight : Infinity,
        children: [rootX, rootY],
      };

      hierarchy.push(newNode);

      parent[rootX] = nextNodeId;
      parent[rootY] = nextNodeId;
      size[nextNodeId] = newNode.size;
      nextNodeId++;

      return nextNodeId - 1;
    };

    // Process MST edges in order
    for (const edge of mst) {
      union(edge.from, edge.to, edge.weight);
    }

    // Set parent references
    for (const node of hierarchy) {
      const leftNode = hierarchy.find((h) => h.id === node.left);
      const rightNode = hierarchy.find((h) => h.id === node.right);
      if (leftNode) leftNode.parent = node.id;
      if (rightNode) rightNode.parent = node.id;
    }

    return hierarchy;
  }

  /**
   * Condense the cluster tree
   *
   * Removes points that fall out of clusters and creates
   * a simplified tree structure.
   */
  private condenseTree(hierarchy: HierarchyNode[], n: number): CondensedNode[] {
    const condensed: CondensedNode[] = [];
    const minClusterSize = this.config.minClusterSize;

    // Map from old node ID to condensed cluster ID
    const nodeToCluster = new Map<number, number>();
    let nextClusterId = 0;

    // Process hierarchy from root to leaves
    const sortedHierarchy = [...hierarchy].sort((a, b) => b.lambda - a.lambda);

    // Initialize leaf nodes
    for (let i = 0; i < n; i++) {
      nodeToCluster.set(i, -1); // Not assigned yet
    }

    // Root gets first cluster ID
    if (sortedHierarchy.length > 0) {
      const root = sortedHierarchy[0];
      nodeToCluster.set(root.id, nextClusterId++);
    }

    // Process each merge
    for (const node of sortedHierarchy) {
      const clusterId = nodeToCluster.get(node.id) ?? 0;
      const leftSize = this.getSubtreeSize(node.left, hierarchy, n);
      const rightSize = this.getSubtreeSize(node.right, hierarchy, n);

      // Check if children survive as clusters
      const leftSurvives = leftSize >= minClusterSize;
      const rightSurvives = rightSize >= minClusterSize;

      if (leftSurvives && rightSurvives) {
        // Both survive: create two new clusters
        nodeToCluster.set(node.left, nextClusterId++);
        nodeToCluster.set(node.right, nextClusterId++);

        condensed.push({
          clusterId,
          parent: clusterId,
          child: nodeToCluster.get(node.left)!,
          lambdaVal: node.lambda,
          childSize: leftSize,
        });

        condensed.push({
          clusterId,
          parent: clusterId,
          child: nodeToCluster.get(node.right)!,
          lambdaVal: node.lambda,
          childSize: rightSize,
        });
      } else if (leftSurvives) {
        // Only left survives
        nodeToCluster.set(node.left, clusterId);
        this.addFallingPoints(node.right, clusterId, node.lambda, condensed, hierarchy, n);
      } else if (rightSurvives) {
        // Only right survives
        nodeToCluster.set(node.right, clusterId);
        this.addFallingPoints(node.left, clusterId, node.lambda, condensed, hierarchy, n);
      } else {
        // Neither survives: points fall out
        this.addFallingPoints(node.left, clusterId, node.lambda, condensed, hierarchy, n);
        this.addFallingPoints(node.right, clusterId, node.lambda, condensed, hierarchy, n);
      }
    }

    return condensed;
  }

  /**
   * Get size of subtree rooted at node
   */
  private getSubtreeSize(
    nodeId: number,
    hierarchy: HierarchyNode[],
    n: number
  ): number {
    if (nodeId < n) return 1; // Leaf node
    const node = hierarchy.find((h) => h.id === nodeId);
    return node?.size ?? 1;
  }

  /**
   * Add falling points to condensed tree
   */
  private addFallingPoints(
    nodeId: number,
    clusterId: number,
    lambda: number,
    condensed: CondensedNode[],
    hierarchy: HierarchyNode[],
    n: number
  ): void {
    if (nodeId < n) {
      // Leaf point
      condensed.push({
        clusterId,
        parent: clusterId,
        child: nodeId,
        lambdaVal: lambda,
        childSize: 1,
      });
    } else {
      // Internal node: recurse
      const node = hierarchy.find((h) => h.id === nodeId);
      if (node) {
        this.addFallingPoints(node.left, clusterId, lambda, condensed, hierarchy, n);
        this.addFallingPoints(node.right, clusterId, lambda, condensed, hierarchy, n);
      }
    }
  }

  /**
   * Extract clusters from condensed tree
   *
   * Uses the excess of mass algorithm to select optimal clusters.
   */
  private extractClusters(condensed: CondensedNode[], n: number): number[] {
    const labels = new Array(n).fill(-1);

    if (condensed.length === 0) return labels;

    // Build cluster info
    const clusterIds = new Set(condensed.map((c) => c.clusterId));
    const clusterStability = new Map<number, number>();
    const clusterPoints = new Map<number, number[]>();

    // Initialize
    for (const cid of clusterIds) {
      clusterStability.set(cid, 0);
      clusterPoints.set(cid, []);
    }

    // Compute stability and collect points
    for (const node of condensed) {
      if (node.child < n) {
        // This is a leaf point
        clusterPoints.get(node.clusterId)?.push(node.child);
      }

      // Add to stability
      const stability = clusterStability.get(node.clusterId) ?? 0;
      clusterStability.set(
        node.clusterId,
        stability + node.childSize * node.lambdaVal
      );
    }

    // Select clusters using stability
    const selectedClusters = this.selectClusters(clusterStability, condensed);

    // Assign labels
    let clusterLabel = 0;
    for (const cid of selectedClusters) {
      const points = clusterPoints.get(cid) ?? [];
      for (const pointIdx of points) {
        labels[pointIdx] = clusterLabel;
      }
      clusterLabel++;
    }

    // Handle cluster selection epsilon
    if (this.config.clusterSelectionEpsilon && this.config.clusterSelectionEpsilon > 0) {
      // Merge small clusters into noise
      // (Simplified: just mark single-element clusters as noise)
      const clusterSizes = new Map<number, number>();
      for (const label of labels) {
        if (label >= 0) {
          clusterSizes.set(label, (clusterSizes.get(label) ?? 0) + 1);
        }
      }

      for (let i = 0; i < n; i++) {
        const label = labels[i];
        if (label >= 0 && (clusterSizes.get(label) ?? 0) < this.config.minClusterSize) {
          labels[i] = -1;
        }
      }
    }

    return labels;
  }

  /**
   * Select clusters using excess of mass
   */
  private selectClusters(
    stability: Map<number, number>,
    condensed: CondensedNode[]
  ): Set<number> {
    const selected = new Set<number>();

    // Find root clusters (those that are parents but not children)
    const parents = new Set(condensed.map((c) => c.parent));
    const children = new Set(condensed.filter((c) => c.childSize > 1).map((c) => c.child));

    const roots = [...parents].filter((p) => !children.has(p));

    // For each subtree, decide whether to use parent or children
    const processCluster = (cid: number): number => {
      const childClusters = condensed
        .filter((c) => c.parent === cid && c.childSize > 1)
        .map((c) => c.child);

      if (childClusters.length === 0) {
        // Leaf cluster
        selected.add(cid);
        return stability.get(cid) ?? 0;
      }

      // Compute children's combined stability
      let childrenStability = 0;
      for (const child of childClusters) {
        childrenStability += processCluster(child);
      }

      const selfStability = stability.get(cid) ?? 0;

      if (selfStability > childrenStability) {
        // Use this cluster instead of children
        for (const child of childClusters) {
          selected.delete(child);
        }
        selected.add(cid);
        return selfStability;
      }

      return childrenStability;
    };

    for (const root of roots) {
      processCluster(root);
    }

    return selected;
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Run HDBSCAN clustering with default config
 *
 * @param points Points to cluster
 * @param config Optional configuration overrides
 * @returns Cluster labels (-1 = noise)
 */
export function hdbscan(
  points: ClusterPoint[],
  config?: Partial<HDBSCANConfig>
): number[] {
  const clusterer = new HDBSCAN(config);
  return clusterer.fit(points);
}

/**
 * Quick cluster by embeddings only
 *
 * @param embeddings Array of embedding vectors
 * @param minClusterSize Minimum cluster size
 * @param metric Distance metric
 * @returns Cluster labels
 */
export function clusterEmbeddings(
  embeddings: number[][],
  minClusterSize = 3,
  metric: DistanceMetric = 'cosine'
): number[] {
  const points: ClusterPoint[] = embeddings.map((embedding, idx) => ({
    id: String(idx),
    embedding,
  }));

  return hdbscan(points, { minClusterSize, metric });
}
