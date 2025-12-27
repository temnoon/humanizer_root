/**
 * Harvester Agent
 *
 * The seeker of content. Searches the archive (semantic index) for
 * relevant passages, discovers connections, and brings material to
 * threads and chapters.
 *
 * Concerns:
 * - Semantic search across the bookshelf
 * - Thread-specific harvesting
 * - Discovery of unexpected connections
 * - Source diversity (avoiding over-reliance on single sources)
 * - Temporal relevance (when content was created)
 */

import { AgentBase } from '../runtime/agent-base';
import type { AgentMessage, HouseType } from '../runtime/types';

// ═══════════════════════════════════════════════════════════════════
// HARVESTER TYPES
// ═══════════════════════════════════════════════════════════════════

export interface HarvestResult {
  passageId: string;
  text: string;
  source: string;
  relevanceScore: number;
  semanticDistance: number;
  harvestedFor: string;    // Thread or query that triggered harvest
  conversationId?: string;
  messageId?: string;
  timestamp?: number;
}

export interface HarvestQuery {
  query: string;
  threadId?: string;
  projectId?: string;
  limit?: number;
  minRelevance?: number;
  excludeIds?: string[];
  sourceFilter?: {
    conversationIds?: string[];
    dateRange?: { start?: number; end?: number };
    hasMedia?: boolean;
  };
}

export interface DiscoveryResult {
  theme: string;
  passages: HarvestResult[];
  connectionStrength: number;
  suggestedThread?: string;
}

export interface HarvesterIntention {
  type: 'search' | 'expand' | 'diversify' | 'discover';
  priority: number;
  reason: string;
  query: HarvestQuery;
}

// ═══════════════════════════════════════════════════════════════════
// HARVESTER AGENT
// ═══════════════════════════════════════════════════════════════════

export class HarvesterAgent extends AgentBase {
  readonly id = 'harvester';
  readonly name = 'The Harvester';
  readonly house: HouseType = 'harvester';
  readonly capabilities = [
    'search-archive',
    'harvest-for-thread',
    'discover-connections',
    'expand-thread',
    'find-similar',
    'diversify-sources',
  ];

  // Harvester's operational parameters
  private config = {
    defaultLimit: 20,
    minRelevance: 0.5,
    diversityThreshold: 0.7,  // Max similarity before considering too similar
    discoveryRadius: 0.4,     // How far to look for connections
  };

  // Track what's been harvested to avoid duplication
  private harvestHistory: Map<string, Set<string>> = new Map(); // threadId -> passageIds

  // Pending harvesting intentions
  private pendingIntentions: HarvesterIntention[] = [];

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    this.log('info', 'Harvester awakening - ready to search the archive');

    // Subscribe to events that might trigger harvesting
    this.subscribe('project:phase-changed');
    this.subscribe('content:thread-updated');
    this.subscribe('content:passage-curated');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'Harvester retiring');
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'search-archive':
        return this.searchArchive(message.payload as HarvestQuery);

      case 'harvest-for-thread':
        return this.harvestForThread(message.payload as HarvestForThreadRequest);

      case 'discover-connections':
        return this.discoverConnections(message.payload as DiscoverConnectionsRequest);

      case 'expand-thread':
        return this.expandThread(message.payload as ExpandThreadRequest);

      case 'find-similar':
        return this.findSimilar(message.payload as FindSimilarRequest);

      case 'diversify-sources':
        return this.diversifySources(message.payload as DiversifySourcesRequest);

      case 'get-intentions':
        return this.getIntentions();

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // ARCHIVE SEARCH
  // ─────────────────────────────────────────────────────────────────

  private async searchArchive(query: HarvestQuery): Promise<HarvestResult[]> {
    const {
      query: searchQuery,
      limit = this.config.defaultLimit,
      minRelevance = this.config.minRelevance,
      excludeIds = [],
      sourceFilter,
    } = query;

    // Call the embedding/search service via archive API
    const results = await this.callArchiveSearch({
      query: searchQuery,
      limit: limit * 2, // Fetch more to filter
      sourceFilter,
    });

    // Filter and transform results
    const harvested: HarvestResult[] = results
      .filter(r => r.similarity >= minRelevance)
      .filter(r => !excludeIds.includes(r.id))
      .slice(0, limit)
      .map(r => ({
        passageId: r.id,
        text: r.text,
        source: r.conversationId || 'unknown',
        relevanceScore: r.similarity,
        semanticDistance: 1 - r.similarity,
        harvestedFor: query.threadId || searchQuery,
        conversationId: r.conversationId,
        messageId: r.messageId,
        timestamp: r.timestamp,
      }));

    // Track harvested passages
    if (query.threadId) {
      this.trackHarvest(query.threadId, harvested.map(h => h.passageId));
    }

    return harvested;
  }

  // ─────────────────────────────────────────────────────────────────
  // THREAD HARVESTING
  // ─────────────────────────────────────────────────────────────────

  private async harvestForThread(request: HarvestForThreadRequest): Promise<HarvestResult[]> {
    const { threadId, theme, queries, existingPassageIds = [], limit = 20 } = request;

    const allResults: HarvestResult[] = [];
    const seenIds = new Set(existingPassageIds);

    // Search for each query
    for (const query of queries) {
      const results = await this.searchArchive({
        query,
        threadId,
        limit: Math.ceil(limit / queries.length),
        excludeIds: Array.from(seenIds),
      });

      for (const result of results) {
        if (!seenIds.has(result.passageId)) {
          seenIds.add(result.passageId);
          allResults.push(result);
        }
      }
    }

    // Sort by relevance and limit
    allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const finalResults = allResults.slice(0, limit);

    // Propose adding high-quality results to the thread
    const highQuality = finalResults.filter(r => r.relevanceScore >= 0.7);
    if (highQuality.length > 0) {
      await this.proposeAction(
        'add-passages-to-thread',
        `Found ${highQuality.length} relevant passages for "${theme}"`,
        `Add semantically relevant content to expand the thread`,
        { threadId, passages: highQuality, projectId: request.projectId },
        { projectId: request.projectId, requiresApproval: true }
      );
    }

    return finalResults;
  }

  // ─────────────────────────────────────────────────────────────────
  // CONNECTION DISCOVERY
  // ─────────────────────────────────────────────────────────────────

  private async discoverConnections(request: DiscoverConnectionsRequest): Promise<DiscoveryResult[]> {
    const { seedPassages, explorationDepth = 2, projectId } = request;

    const discoveries: DiscoveryResult[] = [];
    const visited = new Set<string>(seedPassages.map(p => p.id));

    // For each seed, find unexpected connections
    for (const seed of seedPassages) {
      // Search with lower relevance threshold to find tangential content
      const related = await this.searchArchive({
        query: seed.text.substring(0, 500),
        minRelevance: this.config.discoveryRadius,
        excludeIds: Array.from(visited),
        limit: 10,
      });

      // Find passages that are related but not too similar
      const discoveries_for_seed = related.filter(
        r => r.relevanceScore < this.config.diversityThreshold &&
             r.relevanceScore >= this.config.discoveryRadius
      );

      if (discoveries_for_seed.length > 0) {
        // Identify the theme of this cluster
        const theme = await this.identifyTheme([seed.text, ...discoveries_for_seed.map(d => d.text)]);

        discoveries.push({
          theme,
          passages: discoveries_for_seed,
          connectionStrength: discoveries_for_seed.reduce((sum, p) => sum + p.relevanceScore, 0) / discoveries_for_seed.length,
          suggestedThread: `${theme} (discovered)`,
        });

        // Mark as visited
        discoveries_for_seed.forEach(p => visited.add(p.passageId));
      }
    }

    // Propose creating threads from strong discoveries
    const strongDiscoveries = discoveries.filter(d => d.connectionStrength >= 0.5 && d.passages.length >= 3);
    for (const discovery of strongDiscoveries) {
      await this.proposeAction(
        'create-discovered-thread',
        `Discovered connection: "${discovery.theme}"`,
        `Found ${discovery.passages.length} semantically related passages that form a coherent theme`,
        { discovery, projectId },
        { projectId, requiresApproval: true }
      );
    }

    return discoveries;
  }

  // ─────────────────────────────────────────────────────────────────
  // THREAD EXPANSION
  // ─────────────────────────────────────────────────────────────────

  private async expandThread(request: ExpandThreadRequest): Promise<HarvestResult[]> {
    const { threadId, existingPassages, theme, direction, limit = 10 } = request;

    let expansionQuery: string;

    switch (direction) {
      case 'deeper':
        // Find more specific, detailed content
        expansionQuery = `detailed analysis of ${theme}`;
        break;
      case 'broader':
        // Find related but wider context
        expansionQuery = `context and implications of ${theme}`;
        break;
      case 'contrasting':
        // Find opposing or alternative viewpoints
        expansionQuery = `alternative perspectives on ${theme}`;
        break;
      default:
        // General expansion
        expansionQuery = theme;
    }

    const results = await this.searchArchive({
      query: expansionQuery,
      threadId,
      limit,
      excludeIds: existingPassages.map(p => p.id),
      minRelevance: 0.4, // Lower threshold for exploration
    });

    // Check diversity - avoid too similar to existing
    const diverseResults = await this.filterForDiversity(results, existingPassages);

    if (diverseResults.length > 0) {
      await this.proposeAction(
        'expand-thread',
        `Found ${diverseResults.length} passages to expand "${theme}"`,
        `Expansion direction: ${direction}. Adding diverse content to enrich the thread.`,
        { threadId, passages: diverseResults, direction, projectId: request.projectId },
        { projectId: request.projectId, requiresApproval: true }
      );
    }

    return diverseResults;
  }

  // ─────────────────────────────────────────────────────────────────
  // SIMILARITY SEARCH
  // ─────────────────────────────────────────────────────────────────

  private async findSimilar(request: FindSimilarRequest): Promise<HarvestResult[]> {
    const { passage, limit = 10, excludeIds = [] } = request;

    const results = await this.searchArchive({
      query: passage.text,
      limit,
      excludeIds: [passage.id, ...excludeIds],
      minRelevance: 0.6,
    });

    return results;
  }

  // ─────────────────────────────────────────────────────────────────
  // SOURCE DIVERSITY
  // ─────────────────────────────────────────────────────────────────

  private async diversifySources(request: DiversifySourcesRequest): Promise<HarvestResult[]> {
    const { threadId, existingPassages, theme, targetSourceCount = 5 } = request;

    // Analyze current source distribution
    const sourceDistribution = new Map<string, number>();
    for (const p of existingPassages) {
      const source = p.source || 'unknown';
      sourceDistribution.set(source, (sourceDistribution.get(source) || 0) + 1);
    }

    // Find the dominant source
    let dominantSource = '';
    let maxCount = 0;
    sourceDistribution.forEach((count, source) => {
      if (count > maxCount) {
        maxCount = count;
        dominantSource = source;
      }
    });

    // If too concentrated, search while excluding dominant source
    if (maxCount > existingPassages.length * 0.5 && sourceDistribution.size < targetSourceCount) {
      const diverseResults = await this.searchArchive({
        query: theme,
        threadId,
        limit: 20,
        excludeIds: existingPassages.map(p => p.id),
        sourceFilter: {
          conversationIds: existingPassages
            .filter(p => p.source !== dominantSource)
            .map(p => p.source)
            .filter((v, i, a): v is string => v !== undefined && a.indexOf(v) === i), // unique, non-undefined
        },
      });

      // Filter to ensure different sources
      const newSources = diverseResults.filter(r => r.source !== dominantSource);

      if (newSources.length > 0) {
        await this.proposeAction(
          'diversify-thread-sources',
          `Found ${newSources.length} passages from different sources`,
          `Adding diverse source material for "${theme}" to reduce over-reliance on a single source`,
          { threadId, passages: newSources, projectId: request.projectId },
          { projectId: request.projectId, requiresApproval: true }
        );
      }

      return newSources;
    }

    return [];
  }

  // ─────────────────────────────────────────────────────────────────
  // INTENTIONS
  // ─────────────────────────────────────────────────────────────────

  private addIntention(intention: HarvesterIntention): void {
    const exists = this.pendingIntentions.some(
      i => i.type === intention.type &&
           i.query.query === intention.query.query
    );
    if (!exists) {
      this.pendingIntentions.push(intention);
      this.pendingIntentions.sort((a, b) => b.priority - a.priority);
    }
  }

  private getIntentions(): HarvesterIntention[] {
    return [...this.pendingIntentions];
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private trackHarvest(threadId: string, passageIds: string[]): void {
    if (!this.harvestHistory.has(threadId)) {
      this.harvestHistory.set(threadId, new Set());
    }
    passageIds.forEach(id => this.harvestHistory.get(threadId)!.add(id));
  }

  private async callArchiveSearch(params: {
    query: string;
    limit: number;
    sourceFilter?: HarvestQuery['sourceFilter'];
  }): Promise<Array<{
    id: string;
    text: string;
    similarity: number;
    conversationId?: string;
    messageId?: string;
    timestamp?: number;
  }>> {
    // This would call the actual archive/embedding service
    // For now, return empty - will be wired to real service
    try {
      // Try to use the archive API via fetch (in Electron renderer or preload)
      // This is a placeholder - actual implementation depends on archive server
      return [];
    } catch (error) {
      this.log('error', `Archive search failed: ${error}`);
      return [];
    }
  }

  private async identifyTheme(texts: string[]): Promise<string> {
    const combined = texts.map(t => t.substring(0, 200)).join('\n---\n');

    try {
      const response = await this.bus.request('model-master', {
        type: 'call-capability',
        payload: {
          capability: 'analysis',
          input: combined,
          params: {
            systemPrompt: 'Identify the common theme in these passages. Respond with just 2-4 words describing the theme.',
          },
        },
      });

      if (response.success && response.data) {
        return (response.data as { output: string }).output.trim();
      }
    } catch {
      // Fallback
    }

    return 'Discovered Theme';
  }

  private async filterForDiversity(
    results: HarvestResult[],
    existing: Array<{ id: string; text: string }>
  ): Promise<HarvestResult[]> {
    const diverse: HarvestResult[] = [];

    for (const result of results) {
      let isTooSimilar = false;

      for (const ex of existing) {
        const similarity = this.quickSimilarity(result.text, ex.text);
        if (similarity > this.config.diversityThreshold) {
          isTooSimilar = true;
          break;
        }
      }

      if (!isTooSimilar) {
        diverse.push(result);
      }
    }

    return diverse;
  }

  private quickSimilarity(text1: string, text2: string): number {
    // Quick Jaccard similarity for filtering
    const words1 = new Set(text1.toLowerCase().split(/\s+/).slice(0, 50));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).slice(0, 50));
    const intersection = new Set(Array.from(words1).filter(w => words2.has(w)));
    const union = new Set(Array.from(words1).concat(Array.from(words2)));
    return intersection.size / union.size;
  }
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface HarvestForThreadRequest {
  threadId: string;
  theme: string;
  queries: string[];
  existingPassageIds?: string[];
  limit?: number;
  projectId?: string;
}

interface DiscoverConnectionsRequest {
  seedPassages: Array<{ id: string; text: string }>;
  explorationDepth?: number;
  projectId?: string;
}

interface ExpandThreadRequest {
  threadId: string;
  existingPassages: Array<{ id: string; text: string; source?: string }>;
  theme: string;
  direction: 'deeper' | 'broader' | 'contrasting' | 'general';
  limit?: number;
  projectId?: string;
}

interface FindSimilarRequest {
  passage: { id: string; text: string };
  limit?: number;
  excludeIds?: string[];
}

interface DiversifySourcesRequest {
  threadId: string;
  existingPassages: Array<{ id: string; text: string; source?: string }>;
  theme: string;
  targetSourceCount?: number;
  projectId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _harvester: HarvesterAgent | null = null;

export function getHarvesterAgent(): HarvesterAgent {
  if (!_harvester) {
    _harvester = new HarvesterAgent();
  }
  return _harvester;
}
