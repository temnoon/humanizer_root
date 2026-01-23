/**
 * Bookmaking Handlers
 *
 * MCP tool handlers for the complete bookmaking workflow.
 * Connects to core services: search, clustering, harvester, builder.
 *
 * Note: These handlers require Ollama for embeddings. Handlers check
 * availability and return helpful errors if services are unavailable.
 *
 * Storage:
 * - Connects to PostgresContentStore for archive search
 * - Falls back to metadata-only responses if store not initialized
 */

import type { MCPResult, HandlerContext } from '../types.js';
import { getContentStore } from '../../storage/index.js';
import type { SearchResult } from '../../storage/types.js';
import { ClusteringService } from '../../clustering/clustering-service.js';
import type { ClusterPoint } from '../../clustering/types.js';
import {
  createAnchor,
  createAnchorSet,
  refineByAnchors,
  findBetweenAnchors,
  computeCentroid,
} from '../../retrieval/anchor-refinement.js';
import type { SemanticAnchor } from '../../retrieval/types.js';

// Track storage connection status
let storageConnected = false;

/**
 * Try to get the content store, returning null if not initialized
 */
function tryGetContentStore() {
  try {
    const store = getContentStore();
    storageConnected = true;
    return store;
  } catch {
    storageConnected = false;
    return null;
  }
}

/**
 * Check if storage is connected
 */
export function isStorageConnected(): boolean {
  return storageConnected;
}

// ═══════════════════════════════════════════════════════════════════
// LAZY-LOADED NPE ADAPTER
// ═══════════════════════════════════════════════════════════════════

let OllamaAdapter: typeof import('@humanizer/npe').OllamaAdapter | null = null;
let adapter: InstanceType<typeof import('@humanizer/npe').OllamaAdapter> | null = null;

async function ensureNpeLoaded(): Promise<void> {
  if (!OllamaAdapter) {
    const npe = await import('@humanizer/npe');
    OllamaAdapter = npe.OllamaAdapter;
  }
}

async function getEmbedder(): Promise<(text: string) => Promise<number[]>> {
  await ensureNpeLoaded();

  if (!adapter) {
    adapter = new OllamaAdapter!();
    const isAvailable = await adapter.isAvailable();
    if (!isAvailable) {
      throw new Error('Ollama is not available. Please ensure Ollama is running on localhost:11434');
    }
  }

  return async (text: string) => {
    const result = await adapter!.embed(text);
    return result.embedding;
  };
}

// ═══════════════════════════════════════════════════════════════════
// RESULT HELPERS
// ═══════════════════════════════════════════════════════════════════

function jsonResult(data: unknown): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface SearchArchiveInput {
  query: string;
  limit?: number;
  minRelevance?: number;
  denseWeight?: number;
  sparseWeight?: number;
  sourceFilter?: {
    conversationIds?: string[];
    dateRange?: { start?: number; end?: number };
  };
}

export async function handleSearchArchive(args: SearchArchiveInput): Promise<MCPResult> {
  try {
    if (!args.query || args.query.length < 2) {
      return errorResult('Query must be at least 2 characters');
    }

    const embedder = await getEmbedder();
    const embedding = await embedder(args.query);

    const store = tryGetContentStore();
    if (store) {
      // Use real search via PostgresContentStore
      const limit = args.limit ?? 20;
      const threshold = args.minRelevance ?? 0.5;

      const results = await store.searchByEmbedding(embedding, {
        limit,
        threshold,
      });

      return jsonResult({
        query: args.query,
        resultCount: results.length,
        results: results.map((r: SearchResult) => ({
          id: r.node.id,
          text: r.node.text.substring(0, 300) + (r.node.text.length > 300 ? '...' : ''),
          title: r.node.title,
          score: r.score,
          distance: r.distance,
          author: r.node.author,
          sourceType: r.node.sourceType,
          createdAt: r.node.sourceCreatedAt
            ? new Date(r.node.sourceCreatedAt).toISOString()
            : undefined,
        })),
        storageConnected: true,
      });
    }

    // Fallback: Return metadata-only structure
    return jsonResult({
      query: args.query,
      embedding: {
        dimensions: embedding.length,
        preview: embedding.slice(0, 5).map(n => n.toFixed(4)),
      },
      message: 'Search ready. Use initContentStore() to connect to archive for results.',
      storageConnected: false,
      parameters: {
        limit: args.limit ?? 20,
        minRelevance: args.minRelevance ?? 0.5,
        denseWeight: args.denseWeight ?? 0.6,
        sparseWeight: args.sparseWeight ?? 0.4,
      },
    });
  } catch (err) {
    return errorResult(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface FindSimilarInput {
  text: string;
  limit?: number;
  excludeIds?: string[];
}

export async function handleFindSimilar(args: FindSimilarInput): Promise<MCPResult> {
  try {
    if (!args.text || args.text.length < 10) {
      return errorResult('Text must be at least 10 characters');
    }

    const embedder = await getEmbedder();
    const embedding = await embedder(args.text);
    const limit = args.limit ?? 10;

    const store = tryGetContentStore();
    if (store) {
      // Use real search via PostgresContentStore
      const results = await store.searchByEmbedding(embedding, {
        limit: limit + (args.excludeIds?.length ?? 0), // Get extra to account for exclusions
        threshold: 0.3, // Lower threshold for similarity search
      });

      // Filter out excluded IDs
      const excludeSet = new Set(args.excludeIds ?? []);
      const filteredResults = results
        .filter((r: SearchResult) => !excludeSet.has(r.node.id))
        .slice(0, limit);

      return jsonResult({
        query: args.text.substring(0, 100) + (args.text.length > 100 ? '...' : ''),
        resultCount: filteredResults.length,
        results: filteredResults.map((r: SearchResult) => ({
          id: r.node.id,
          text: r.node.text.substring(0, 300) + (r.node.text.length > 300 ? '...' : ''),
          title: r.node.title,
          similarity: r.score,
          distance: r.distance,
          author: r.node.author,
          sourceType: r.node.sourceType,
        })),
        storageConnected: true,
      });
    }

    // Fallback: Return metadata-only structure
    return jsonResult({
      query: args.text.substring(0, 100) + '...',
      embedding: {
        dimensions: embedding.length,
        preview: embedding.slice(0, 5).map(n => n.toFixed(4)),
      },
      message: 'Similarity search ready. Use initContentStore() to connect to archive.',
      storageConnected: false,
      parameters: {
        limit,
        excludeIds: args.excludeIds ?? [],
      },
    });
  } catch (err) {
    return errorResult(`Find similar failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CLUSTERING HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface ClusterContentInput {
  contentIds?: string[];
  query?: string;
  minClusterSize?: number;
  maxClusters?: number;
  computeCentroids?: boolean;
}

export async function handleClusterContent(
  args: ClusterContentInput,
  context?: HandlerContext
): Promise<MCPResult> {
  try {
    if (!args.contentIds && !args.query) {
      return errorResult('Provide either contentIds or query');
    }

    const embedder = await getEmbedder();
    const store = tryGetContentStore();

    const service = new ClusteringService({
      hdbscan: {
        minClusterSize: args.minClusterSize ?? 3,
        metric: 'cosine',
      },
      maxClusters: args.maxClusters ?? 10,
      computeCentroids: args.computeCentroids ?? true,
    });

    // If query provided and store connected, search and cluster
    if (args.query && store) {
      // Progress: Step 1 - Search
      await context?.sendProgress(1, 4);

      const queryEmbedding = await embedder(args.query);

      // Search for content to cluster
      const searchResults = await store.searchByEmbedding(queryEmbedding, {
        limit: 100, // Get a good sample for clustering
        threshold: 0.3,
      });

      if (searchResults.length < 3) {
        return jsonResult({
          message: 'Not enough results to cluster (need at least 3)',
          resultCount: searchResults.length,
          storageConnected: true,
        });
      }

      // Progress: Step 2 - Generate embeddings
      await context?.sendProgress(2, 4);

      // Get embeddings for all results with progress reporting
      const points: ClusterPoint[] = [];
      for (let i = 0; i < searchResults.length; i++) {
        const r = searchResults[i] as SearchResult;
        points.push({
          id: r.node.id,
          embedding: await embedder(r.node.text),
          metadata: {
            text: r.node.text.substring(0, 200),
            title: r.node.title,
            author: r.node.author,
          },
        });
        // Sub-progress within step 2: report every 10 items
        if (i > 0 && i % 10 === 0 && context?.progressToken) {
          await context.sendProgress(2 + (i / searchResults.length) * 0.8, 4);
        }
      }

      // Progress: Step 3 - Clustering
      await context?.sendProgress(3, 4);

      // Run clustering
      const clusterResult = service.cluster(points);

      // Progress: Step 4 - Done
      await context?.sendProgress(4, 4);

      return jsonResult({
        query: args.query,
        resultCount: searchResults.length,
        clusters: clusterResult.clusters.map((c, i) => ({
          clusterId: i,
          size: c.points.length,
          centroid: args.computeCentroids !== false ? c.centroid?.slice(0, 3) : undefined,
          samples: c.points.slice(0, 3).map(p => ({
            id: p.id,
            preview: (p.metadata as { text?: string })?.text?.substring(0, 100) + '...',
          })),
        })),
        noise: {
          count: clusterResult.noise.length,
          sampleIds: clusterResult.noise.slice(0, 5).map(p => p.id),
        },
        storageConnected: true,
      });
    }

    // Fallback: Return metadata-only structure
    if (args.query) {
      const queryEmbedding = await embedder(args.query);
      return jsonResult({
        message: 'Clustering ready. Use initContentStore() to connect to archive.',
        query: args.query,
        queryEmbedding: {
          dimensions: queryEmbedding.length,
        },
        storageConnected: false,
        config: {
          minClusterSize: args.minClusterSize ?? 3,
          maxClusters: args.maxClusters ?? 10,
          computeCentroids: args.computeCentroids ?? true,
        },
      });
    }

    return jsonResult({
      message: 'Clustering service ready. Use initContentStore() to connect to archive.',
      contentIds: args.contentIds,
      storageConnected: false,
      config: {
        minClusterSize: args.minClusterSize ?? 3,
        maxClusters: args.maxClusters ?? 10,
      },
    });
  } catch (err) {
    return errorResult(`Clustering failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// ANCHOR HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface CreateAnchorInput {
  name: string;
  text: string;
  type?: 'positive' | 'negative';
}

export async function handleCreateAnchor(args: CreateAnchorInput): Promise<MCPResult> {
  try {
    if (!args.name || !args.text) {
      return errorResult('Name and text are required');
    }

    if (args.text.length < 10) {
      return errorResult('Text must be at least 10 characters');
    }

    const embedder = await getEmbedder();
    const embedding = await embedder(args.text);

    const anchor = createAnchor(
      `anchor-${Date.now()}`,
      args.name,
      embedding
    );

    return jsonResult({
      anchor: {
        id: anchor.id,
        name: anchor.name,
        type: args.type ?? 'positive',
        dimensions: embedding.length,
        createdAt: new Date(anchor.createdAt).toISOString(),
        textPreview: args.text.substring(0, 100) + (args.text.length > 100 ? '...' : ''),
      },
      message: 'Anchor created. Use with refine_by_anchors or find_between_anchors.',
    });
  } catch (err) {
    return errorResult(`Create anchor failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface RefineByAnchorsInput {
  query: string;
  positiveAnchors?: Array<{ name: string; text: string }>;
  negativeAnchors?: Array<{ name: string; text: string }>;
  limit?: number;
}

export async function handleRefineByAnchors(args: RefineByAnchorsInput): Promise<MCPResult> {
  try {
    if (!args.query) {
      return errorResult('Query is required');
    }

    const embedder = await getEmbedder();

    // Create query embedding
    const queryEmbedding = await embedder(args.query);

    // Create anchor embeddings
    const positiveAnchors: SemanticAnchor[] = [];
    for (const anchor of args.positiveAnchors ?? []) {
      const embedding = await embedder(anchor.text);
      positiveAnchors.push(createAnchor(`pos-${Date.now()}`, anchor.name, embedding));
    }

    const negativeAnchors: SemanticAnchor[] = [];
    for (const anchor of args.negativeAnchors ?? []) {
      const embedding = await embedder(anchor.text);
      negativeAnchors.push(createAnchor(`neg-${Date.now()}`, anchor.name, embedding));
    }

    const anchorSet = createAnchorSet(positiveAnchors, negativeAnchors);

    return jsonResult({
      query: args.query,
      queryEmbedding: {
        dimensions: queryEmbedding.length,
      },
      anchors: {
        positive: positiveAnchors.map(a => ({ id: a.id, name: a.name })),
        negative: negativeAnchors.map(a => ({ id: a.id, name: a.name })),
      },
      message: 'Anchors prepared. Connect to search results to apply refinement.',
      note: 'Use search_archive first, then apply refineByAnchors to filter/boost results',
    });
  } catch (err) {
    return errorResult(`Refine by anchors failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface FindBetweenAnchorsInput {
  anchor1: { name: string; text: string };
  anchor2: { name: string; text: string };
  balanceThreshold?: number;
  limit?: number;
}

export async function handleFindBetweenAnchors(args: FindBetweenAnchorsInput): Promise<MCPResult> {
  try {
    if (!args.anchor1?.text || !args.anchor2?.text) {
      return errorResult('Both anchors with text are required');
    }

    const embedder = await getEmbedder();

    const embedding1 = await embedder(args.anchor1.text);
    const embedding2 = await embedder(args.anchor2.text);

    const anchor1 = createAnchor('anchor1', args.anchor1.name, embedding1);
    const anchor2 = createAnchor('anchor2', args.anchor2.name, embedding2);

    // Compute similarity between anchors
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));

    return jsonResult({
      anchor1: { name: args.anchor1.name, preview: args.anchor1.text.substring(0, 50) },
      anchor2: { name: args.anchor2.name, preview: args.anchor2.text.substring(0, 50) },
      anchorSimilarity: similarity.toFixed(4),
      balanceThreshold: args.balanceThreshold ?? 0.2,
      message: 'Anchors prepared. Connect to search results to find content between them.',
      interpretation: similarity > 0.7
        ? 'Anchors are similar - results will be close to both'
        : similarity > 0.3
          ? 'Anchors are moderately different - good for finding bridges'
          : 'Anchors are very different - few results may qualify',
    });
  } catch (err) {
    return errorResult(`Find between anchors failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HARVEST HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface HarvestForThreadInput {
  theme: string;
  queries: string[];
  existingPassageIds?: string[];
  limit?: number;
}

export async function handleHarvestForThread(
  args: HarvestForThreadInput,
  context?: HandlerContext
): Promise<MCPResult> {
  try {
    if (!args.theme || !args.queries || args.queries.length === 0) {
      return errorResult('Theme and at least one query are required');
    }

    const embedder = await getEmbedder();
    const store = tryGetContentStore();
    const limit = args.limit ?? 20;
    const excludeSet = new Set(args.existingPassageIds ?? []);
    const totalQueries = args.queries.length;

    if (store) {
      // Execute real harvest via PostgresContentStore
      const allResults: Array<SearchResult & { querySource: string }> = [];

      for (let i = 0; i < args.queries.length; i++) {
        const query = args.queries[i];

        // Report progress per query
        await context?.sendProgress(i, totalQueries + 1); // +1 for dedup step

        const embedding = await embedder(query);
        const results = await store.searchByEmbedding(embedding, {
          limit: limit * 2, // Get extra to account for deduplication
          threshold: 0.4,
        });

        results.forEach((r: SearchResult) => {
          allResults.push({ ...r, querySource: query });
        });
      }

      // Progress: Deduplication step
      await context?.sendProgress(totalQueries, totalQueries + 1);

      // Deduplicate by node ID, keeping highest score
      const dedupedMap = new Map<string, SearchResult & { querySource: string }>();
      for (const r of allResults) {
        const existing = dedupedMap.get(r.node.id);
        if (!existing || r.score > existing.score) {
          dedupedMap.set(r.node.id, r);
        }
      }

      // Filter exclusions and sort by score
      const dedupedResults = Array.from(dedupedMap.values())
        .filter(r => !excludeSet.has(r.node.id))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Progress: Complete
      await context?.sendProgress(totalQueries + 1, totalQueries + 1);

      return jsonResult({
        theme: args.theme,
        queryCount: args.queries.length,
        resultCount: dedupedResults.length,
        results: dedupedResults.map(r => ({
          id: r.node.id,
          text: r.node.text.substring(0, 400) + (r.node.text.length > 400 ? '...' : ''),
          title: r.node.title,
          score: r.score,
          matchedQuery: r.querySource,
          author: r.node.author,
          sourceType: r.node.sourceType,
        })),
        storageConnected: true,
      });
    }

    // Fallback: Return metadata-only structure
    const queryEmbeddings = await Promise.all(
      args.queries.map(async q => ({
        query: q,
        embedding: await embedder(q),
      }))
    );

    return jsonResult({
      theme: args.theme,
      queries: queryEmbeddings.map(qe => ({
        text: qe.query,
        embeddingDimensions: qe.embedding.length,
      })),
      parameters: {
        limit,
        excludeCount: excludeSet.size,
      },
      message: 'Harvest ready. Use initContentStore() to connect to archive.',
      storageConnected: false,
      workflow: [
        '1. Search for each query',
        '2. Deduplicate results',
        '3. Filter by minimum relevance',
        '4. Exclude existing passage IDs',
        '5. Return top results sorted by relevance',
      ],
    });
  } catch (err) {
    return errorResult(`Harvest failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface DiscoverConnectionsInput {
  seedTexts: string[];
  explorationDepth?: number;
}

export async function handleDiscoverConnections(args: DiscoverConnectionsInput): Promise<MCPResult> {
  try {
    if (!args.seedTexts || args.seedTexts.length === 0) {
      return errorResult('At least one seed text is required');
    }

    const embedder = await getEmbedder();
    const store = tryGetContentStore();

    const seedEmbeddings = await Promise.all(
      args.seedTexts.map(async (text, i) => ({
        index: i,
        preview: text.substring(0, 100),
        embedding: await embedder(text),
      }))
    );

    // Compute pairwise similarity between seeds
    const pairwiseSimilarities: Array<{ i: number; j: number; similarity: number }> = [];
    for (let i = 0; i < seedEmbeddings.length; i++) {
      for (let j = i + 1; j < seedEmbeddings.length; j++) {
        let dot = 0, norm1 = 0, norm2 = 0;
        const e1 = seedEmbeddings[i].embedding;
        const e2 = seedEmbeddings[j].embedding;
        for (let k = 0; k < e1.length; k++) {
          dot += e1[k] * e2[k];
          norm1 += e1[k] * e1[k];
          norm2 += e2[k] * e2[k];
        }
        pairwiseSimilarities.push({
          i, j,
          similarity: dot / (Math.sqrt(norm1) * Math.sqrt(norm2)),
        });
      }
    }

    if (store) {
      // Execute real discovery via PostgresContentStore
      const discoveries: Array<{
        seedIndex: number;
        connections: Array<{
          id: string;
          text: string;
          similarity: number;
          title?: string;
        }>;
      }> = [];

      for (const seed of seedEmbeddings) {
        // Search with lower threshold to find tangential connections
        const results = await store.searchByEmbedding(seed.embedding, {
          limit: 20,
          threshold: 0.3,
        });

        // Filter to "tangential" range (related but not too similar)
        const tangential = results
          .filter((r: SearchResult) => r.score >= 0.3 && r.score <= 0.7)
          .slice(0, 5);

        discoveries.push({
          seedIndex: seed.index,
          connections: tangential.map((r: SearchResult) => ({
            id: r.node.id,
            text: r.node.text.substring(0, 200) + '...',
            similarity: r.score,
            title: r.node.title,
          })),
        });
      }

      return jsonResult({
        seedCount: args.seedTexts.length,
        seeds: seedEmbeddings.map(s => ({
          index: s.index,
          preview: s.preview + '...',
        })),
        pairwiseSimilarities: pairwiseSimilarities.map(p => ({
          seeds: [p.i, p.j],
          similarity: p.similarity.toFixed(4),
        })),
        discoveries,
        explorationDepth: args.explorationDepth ?? 1,
        storageConnected: true,
      });
    }

    // Fallback: Return metadata-only structure
    return jsonResult({
      seedCount: args.seedTexts.length,
      seeds: seedEmbeddings.map(s => ({
        index: s.index,
        preview: s.preview + '...',
      })),
      pairwiseSimilarities: pairwiseSimilarities.map(p => ({
        seeds: [p.i, p.j],
        similarity: p.similarity.toFixed(4),
      })),
      explorationDepth: args.explorationDepth ?? 1,
      message: 'Discovery ready. Use initContentStore() to connect to archive.',
      storageConnected: false,
      algorithm: [
        '1. Search semantically near each seed',
        '2. Find content that is related but not too similar',
        '3. Group discoveries by theme',
        '4. Return unexpected connections',
      ],
    });
  } catch (err) {
    return errorResult(`Discover connections failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface ExpandThreadInput {
  theme: string;
  existingTexts: string[];
  direction: 'deeper' | 'broader' | 'contrasting';
  limit?: number;
}

export async function handleExpandThread(args: ExpandThreadInput): Promise<MCPResult> {
  try {
    if (!args.theme || !args.existingTexts || args.existingTexts.length === 0) {
      return errorResult('Theme and existing texts are required');
    }

    const embedder = await getEmbedder();
    const store = tryGetContentStore();
    const limit = args.limit ?? 10;

    // Create expansion query based on direction
    let expansionQuery: string;
    switch (args.direction) {
      case 'deeper':
        expansionQuery = `detailed analysis of ${args.theme}`;
        break;
      case 'broader':
        expansionQuery = `context and implications of ${args.theme}`;
        break;
      case 'contrasting':
        expansionQuery = `alternative perspectives on ${args.theme}`;
        break;
    }

    const expansionEmbedding = await embedder(expansionQuery);

    // Compute centroid of existing texts
    const existingEmbeddings = await Promise.all(
      args.existingTexts.map(t => embedder(t))
    );
    const centroid = computeCentroid(existingEmbeddings);

    if (store) {
      // Search using expansion query embedding
      const results = await store.searchByEmbedding(expansionEmbedding, {
        limit: limit * 3, // Get extra for filtering
        threshold: 0.3,
      });

      // Filter based on direction strategy
      let filteredResults: SearchResult[];
      if (args.direction === 'deeper') {
        // Find content closer to centroid (more similar to existing)
        filteredResults = results
          .filter((r: SearchResult) => r.score >= 0.5)
          .slice(0, limit);
      } else if (args.direction === 'broader') {
        // Find content in middle range (related but not too similar)
        filteredResults = results
          .filter((r: SearchResult) => r.score >= 0.3 && r.score <= 0.7)
          .slice(0, limit);
      } else {
        // Contrasting: find content that's less similar
        filteredResults = results
          .filter((r: SearchResult) => r.score >= 0.2 && r.score <= 0.5)
          .slice(0, limit);
      }

      return jsonResult({
        theme: args.theme,
        direction: args.direction,
        expansionQuery,
        existingCount: args.existingTexts.length,
        resultCount: filteredResults.length,
        results: filteredResults.map((r: SearchResult) => ({
          id: r.node.id,
          text: r.node.text.substring(0, 300) + (r.node.text.length > 300 ? '...' : ''),
          title: r.node.title,
          score: r.score,
          author: r.node.author,
          sourceType: r.node.sourceType,
        })),
        strategy: args.direction === 'deeper'
          ? 'Found more specific, detailed content'
          : args.direction === 'broader'
            ? 'Found related but wider context'
            : 'Found opposing or alternative viewpoints',
        storageConnected: true,
      });
    }

    // Fallback: Return metadata-only structure
    return jsonResult({
      theme: args.theme,
      direction: args.direction,
      expansionQuery,
      existingCount: args.existingTexts.length,
      centroidComputed: true,
      message: 'Expansion ready. Use initContentStore() to connect to archive.',
      storageConnected: false,
      strategy: args.direction === 'deeper'
        ? 'Find more specific, detailed content'
        : args.direction === 'broader'
          ? 'Find related but wider context'
          : 'Find opposing or alternative viewpoints',
    });
  } catch (err) {
    return errorResult(`Expand thread failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSITION HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface CreateOutlineInput {
  theme: string;
  passages: Array<{
    id?: string;
    text: string;
    role?: 'anchor' | 'supporting' | 'contrast' | 'evidence';
  }>;
  targetLength?: number;
}

export async function handleCreateOutline(args: CreateOutlineInput): Promise<MCPResult> {
  try {
    if (!args.theme || !args.passages || args.passages.length === 0) {
      return errorResult('Theme and passages are required');
    }

    // Analyze passages and create a basic outline structure
    const passagesWithRoles = args.passages.map((p, i) => ({
      id: p.id ?? `passage-${i}`,
      preview: p.text.substring(0, 100) + '...',
      role: p.role ?? 'supporting',
      wordCount: p.text.split(/\s+/).length,
    }));

    const totalWords = passagesWithRoles.reduce((sum, p) => sum + p.wordCount, 0);
    const targetLength = args.targetLength ?? 2000;

    // Create outline structure
    const outline = {
      theme: args.theme,
      suggestedTitle: args.theme,
      estimatedLength: targetLength,
      sections: [
        {
          type: 'opening',
          purpose: 'Introduce the theme and hook the reader',
          passageIds: passagesWithRoles.filter(p => p.role === 'anchor').slice(0, 1).map(p => p.id),
        },
        {
          type: 'body',
          purpose: 'Develop the main argument with supporting evidence',
          passageIds: passagesWithRoles.filter(p => ['supporting', 'evidence'].includes(p.role)).map(p => p.id),
        },
        ...(passagesWithRoles.some(p => p.role === 'contrast') ? [{
          type: 'transition',
          purpose: 'Address counterpoints or alternative perspectives',
          passageIds: passagesWithRoles.filter(p => p.role === 'contrast').map(p => p.id),
        }] : []),
        {
          type: 'conclusion',
          purpose: 'Synthesize insights and provide closure',
          passageIds: [],
        },
      ],
    };

    return jsonResult({
      outline,
      passages: passagesWithRoles,
      stats: {
        passageCount: args.passages.length,
        totalSourceWords: totalWords,
        targetLength,
        expansionRatio: (targetLength / totalWords).toFixed(2),
      },
      message: 'Outline created. Use compose_chapter to generate full draft.',
    });
  } catch (err) {
    return errorResult(`Create outline failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface ComposeChapterInput {
  title: string;
  theme: string;
  passages: Array<{
    id?: string;
    text: string;
    role?: 'anchor' | 'supporting' | 'contrast' | 'evidence';
  }>;
  targetLength?: number;
  styleGuidelines?: string;
  persona?: string;
}

export async function handleComposeChapter(args: ComposeChapterInput): Promise<MCPResult> {
  try {
    if (!args.title || !args.theme || !args.passages || args.passages.length === 0) {
      return errorResult('Title, theme, and passages are required');
    }

    await ensureNpeLoaded();

    // Create outline first
    const outlineResult = await handleCreateOutline({
      theme: args.theme,
      passages: args.passages,
      targetLength: args.targetLength,
    });

    const outlineData = JSON.parse(outlineResult.content[0].text!);

    // In production, this would call BuilderAgent.composeChapter()
    // For now, return the composition plan
    return jsonResult({
      title: args.title,
      theme: args.theme,
      outline: outlineData.outline,
      compositionPlan: {
        passageCount: args.passages.length,
        targetLength: args.targetLength ?? 2000,
        styleGuidelines: args.styleGuidelines ?? 'natural, flowing prose',
        persona: args.persona ?? null,
      },
      message: 'Composition plan ready. Connect to BuilderAgent for full chapter generation.',
      note: 'Full composition requires LLM integration via BuilderAgent.composeChapter()',
    });
  } catch (err) {
    return errorResult(`Compose chapter failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface AnalyzeStructureInput {
  content: string;
}

export async function handleAnalyzeStructure(args: AnalyzeStructureInput): Promise<MCPResult> {
  try {
    if (!args.content || args.content.length < 100) {
      return errorResult('Content must be at least 100 characters');
    }

    const wordCount = args.content.split(/\s+/).length;
    const paragraphs = args.content.split(/\n\s*\n/).filter(p => p.trim());
    const sentences = args.content.split(/[.!?]+/).filter(s => s.trim());

    // Basic structural analysis
    const avgWordsPerParagraph = wordCount / paragraphs.length;
    const avgWordsPerSentence = wordCount / sentences.length;

    // Estimate pacing (varied paragraph lengths = better pacing)
    const paragraphLengths = paragraphs.map(p => p.split(/\s+/).length);
    const avgLength = paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length;
    const variance = paragraphLengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / paragraphLengths.length;
    const stdDev = Math.sqrt(variance);
    const pacingScore = Math.min(1, stdDev / (avgLength * 0.5));

    // Detect narrative arc (simplified)
    const hasOpening = paragraphs.length > 0 && paragraphs[0].length > 50;
    const hasConclusion = paragraphs.length > 1 && paragraphs[paragraphs.length - 1].length > 50;
    const narrativeArc = hasOpening && hasConclusion ? 'resolution' : hasOpening ? 'building' : 'flat';

    return jsonResult({
      structure: {
        wordCount,
        paragraphCount: paragraphs.length,
        sentenceCount: sentences.length,
        avgWordsPerParagraph: avgWordsPerParagraph.toFixed(1),
        avgWordsPerSentence: avgWordsPerSentence.toFixed(1),
      },
      analysis: {
        narrativeArc,
        pacingScore: pacingScore.toFixed(2),
        issues: [
          ...(avgWordsPerSentence > 30 ? ['Long sentences may reduce readability'] : []),
          ...(avgWordsPerParagraph > 200 ? ['Consider breaking up long paragraphs'] : []),
          ...(pacingScore < 0.3 ? ['Paragraph lengths are very uniform - vary pacing'] : []),
          ...(!hasConclusion ? ['Chapter may need a stronger conclusion'] : []),
        ],
        suggestions: [
          ...(narrativeArc === 'flat' ? ['Add a clear opening hook and concluding insight'] : []),
          ...(pacingScore < 0.5 ? ['Vary paragraph lengths for better rhythm'] : []),
        ],
      },
    });
  } catch (err) {
    return errorResult(`Analyze structure failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface SuggestImprovementsInput {
  content: string;
}

export async function handleSuggestImprovements(args: SuggestImprovementsInput): Promise<MCPResult> {
  try {
    if (!args.content || args.content.length < 100) {
      return errorResult('Content must be at least 100 characters');
    }

    // Get structure analysis first
    const structureResult = await handleAnalyzeStructure(args);
    const structureData = JSON.parse(structureResult.content[0].text!);

    // Generate improvement suggestions based on analysis
    const suggestions: Array<{
      type: string;
      location: string;
      issue: string;
      fix: string;
    }> = [];

    if (structureData.analysis.issues.length > 0) {
      structureData.analysis.issues.forEach((issue: string, i: number) => {
        suggestions.push({
          type: 'structure',
          location: 'throughout',
          issue,
          fix: structureData.analysis.suggestions[i] || 'Review and revise as needed',
        });
      });
    }

    // Check for common issues
    const content = args.content;
    if (content.includes('very ') || content.includes('really ')) {
      suggestions.push({
        type: 'clarity',
        location: 'various',
        issue: 'Weak intensifiers detected (very, really)',
        fix: 'Replace with more specific, vivid words',
      });
    }

    if ((content.match(/\bit\b/gi) || []).length > 10) {
      suggestions.push({
        type: 'clarity',
        location: 'various',
        issue: 'Frequent use of "it" may cause ambiguity',
        fix: 'Replace some instances with specific nouns',
      });
    }

    return jsonResult({
      suggestions,
      structureAnalysis: structureData.analysis,
      message: suggestions.length === 0
        ? 'No major issues detected. Content looks good.'
        : `Found ${suggestions.length} areas for improvement.`,
    });
  } catch (err) {
    return errorResult(`Suggest improvements failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXTRACTION HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface ExtractTermsInput {
  text: string;
  types?: Array<'keywords' | 'entities' | 'themes' | 'phrases'>;
  limit?: number;
}

export async function handleExtractTerms(args: ExtractTermsInput): Promise<MCPResult> {
  try {
    if (!args.text || args.text.length < 50) {
      return errorResult('Text must be at least 50 characters');
    }

    const types = args.types ?? ['keywords', 'themes'];
    const limit = args.limit ?? 10;

    // Basic keyword extraction (word frequency)
    const words = args.text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);

    const wordFreq = new Map<string, number>();
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    // Remove common words
    const stopWords = new Set(['that', 'this', 'with', 'from', 'have', 'been', 'were', 'they', 'their', 'what', 'when', 'where', 'which', 'would', 'could', 'should', 'about', 'into', 'more', 'some', 'them', 'then', 'than', 'very', 'just', 'also', 'only']);
    stopWords.forEach(sw => wordFreq.delete(sw));

    const keywords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ term: word, frequency: count }));

    // Extract phrases (bigrams)
    const phrases: Array<{ term: string; frequency: number }> = [];
    if (types.includes('phrases')) {
      const bigramFreq = new Map<string, number>();
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        bigramFreq.set(bigram, (bigramFreq.get(bigram) || 0) + 1);
      }
      phrases.push(
        ...Array.from(bigramFreq.entries())
          .filter(([_, count]) => count > 1)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([phrase, count]) => ({ term: phrase, frequency: count }))
      );
    }

    const result: Record<string, unknown> = {};
    if (types.includes('keywords')) result.keywords = keywords;
    if (types.includes('phrases')) result.phrases = phrases;
    if (types.includes('themes')) {
      result.themes = keywords.slice(0, 5).map(k => k.term);
      result.themesNote = 'Basic frequency-based themes. Use LLM for deeper analysis.';
    }
    if (types.includes('entities')) {
      result.entities = [];
      result.entitiesNote = 'Entity extraction requires NER model. Use LLM for named entities.';
    }

    return jsonResult({
      ...result,
      stats: {
        textLength: args.text.length,
        wordCount: words.length,
        uniqueWords: wordFreq.size,
      },
    });
  } catch (err) {
    return errorResult(`Extract terms failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface ComputeCentroidInput {
  texts: string[];
  name: string;
}

export async function handleComputeCentroid(args: ComputeCentroidInput): Promise<MCPResult> {
  try {
    if (!args.texts || args.texts.length < 2) {
      return errorResult('At least 2 texts are required');
    }

    if (!args.name) {
      return errorResult('Name is required');
    }

    const embedder = await getEmbedder();

    const embeddings = await Promise.all(
      args.texts.map(t => embedder(t))
    );

    const centroid = computeCentroid(embeddings);
    const anchor = createAnchor(`centroid-${Date.now()}`, args.name, centroid);

    return jsonResult({
      anchor: {
        id: anchor.id,
        name: anchor.name,
        type: 'synthetic',
        dimensions: centroid.length,
        sourceCount: args.texts.length,
        createdAt: new Date(anchor.createdAt).toISOString(),
      },
      sources: args.texts.map((t, i) => ({
        index: i,
        preview: t.substring(0, 50) + '...',
      })),
      message: 'Centroid anchor created. Represents the semantic "center" of the input texts.',
    });
  } catch (err) {
    return errorResult(`Compute centroid failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER REGISTRY
// ═══════════════════════════════════════════════════════════════════

export const BOOKMAKING_HANDLERS: Record<string, (args: unknown) => Promise<MCPResult>> = {
  // Search
  search_archive: handleSearchArchive as (args: unknown) => Promise<MCPResult>,
  find_similar: handleFindSimilar as (args: unknown) => Promise<MCPResult>,

  // Clustering
  cluster_content: handleClusterContent as (args: unknown) => Promise<MCPResult>,

  // Anchors
  create_anchor: handleCreateAnchor as (args: unknown) => Promise<MCPResult>,
  refine_by_anchors: handleRefineByAnchors as (args: unknown) => Promise<MCPResult>,
  find_between_anchors: handleFindBetweenAnchors as (args: unknown) => Promise<MCPResult>,

  // Harvest
  harvest_for_thread: handleHarvestForThread as (args: unknown) => Promise<MCPResult>,
  discover_connections: handleDiscoverConnections as (args: unknown) => Promise<MCPResult>,
  expand_thread: handleExpandThread as (args: unknown) => Promise<MCPResult>,

  // Composition
  create_outline: handleCreateOutline as (args: unknown) => Promise<MCPResult>,
  compose_chapter: handleComposeChapter as (args: unknown) => Promise<MCPResult>,
  analyze_structure: handleAnalyzeStructure as (args: unknown) => Promise<MCPResult>,
  suggest_improvements: handleSuggestImprovements as (args: unknown) => Promise<MCPResult>,

  // Extraction
  extract_terms: handleExtractTerms as (args: unknown) => Promise<MCPResult>,
  compute_centroid: handleComputeCentroid as (args: unknown) => Promise<MCPResult>,
};
