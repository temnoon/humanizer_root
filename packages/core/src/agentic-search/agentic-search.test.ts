/**
 * Agentic Search Tests
 *
 * Unit tests for the unified agentic search service components:
 * - SessionManager
 * - UnifiedStore
 * - AgenticSearchService
 * - EnrichmentService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { StoredNode } from '../storage/types.js';
import type {
  AgenticSearchResult,
  BookNode,
  ResultProvenance,
  ScoreBreakdown,
} from './types.js';
import type { SemanticAnchor } from '../retrieval/types.js';
import {
  SessionManager,
  resetSessionManager,
} from './session-manager.js';
import {
  UnifiedStore,
  StubBooksStore,
  type BooksStoreInterface,
} from './unified-store.js';
import { EnrichmentService, StubLlmAdapter } from './enrichment-service.js';
import {
  DEFAULT_LIMIT,
  DEFAULT_THRESHOLD,
  DEFAULT_MIN_WORD_COUNT,
  HIERARCHY_LEVEL_MAP,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════

function createMockStoredNode(id: string, overrides: Partial<StoredNode> = {}): StoredNode {
  return {
    id,
    contentHash: `hash-${id}`,
    uri: `content://test/message/${id}`,
    text: `Test content for node ${id}. This is sample text with enough words to pass quality gates.`,
    format: 'text',
    wordCount: 50,
    sourceType: 'chatgpt',
    sourceAdapter: 'openai',
    hierarchyLevel: 0,
    createdAt: Date.now(),
    importedAt: Date.now(),
    ...overrides,
  };
}

function createMockBookNode(id: string, overrides: Partial<BookNode> = {}): BookNode {
  return {
    id,
    contentHash: `hash-${id}`,
    bookId: 'book-1',
    text: `Book content for node ${id}. This is sample text for testing purposes.`,
    format: 'markdown',
    wordCount: 40,
    position: 1,
    hierarchyLevel: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

function createMockSearchResult(
  id: string,
  score: number,
  source: 'archive' | 'books' = 'archive',
  overrides: Partial<AgenticSearchResult> = {}
): AgenticSearchResult {
  const provenance: ResultProvenance = {
    sourceStore: source,
    sourceType: source === 'archive' ? 'chatgpt' : 'book',
    uri: `content://${source}/${id}`,
  };

  const scoreBreakdown: ScoreBreakdown = {
    fusedScore: score,
    finalScore: score,
  };

  return {
    id,
    source,
    text: `Test content for result ${id}`,
    wordCount: 50,
    hierarchyLevel: 0,
    score,
    scoreBreakdown,
    provenance,
    quality: {
      hasMinWords: true,
      hasMinQuality: true,
      isComplete: true,
      passedGate: true,
    },
    ...overrides,
  };
}

function createMockAnchor(id: string, name: string): SemanticAnchor {
  return {
    id,
    name,
    embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
    createdAt: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════════
// SESSION MANAGER TESTS
// ═══════════════════════════════════════════════════════════════════

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    resetSessionManager();
    manager = new SessionManager({ verbose: false });
  });

  describe('Session Lifecycle', () => {
    it('creates a session with unique ID', () => {
      const session = manager.createSession();
      expect(session.id).toBeDefined();
      expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('creates a session with name and notes', () => {
      const session = manager.createSession({
        name: 'Test Session',
        notes: 'Testing notes',
      });
      expect(session.name).toBe('Test Session');
      expect(session.metadata.notes).toBe('Testing notes');
    });

    it('initializes session with empty collections', () => {
      const session = manager.createSession();
      expect(session.results).toEqual([]);
      expect(session.history).toEqual([]);
      expect(session.positiveAnchors).toEqual([]);
      expect(session.negativeAnchors).toEqual([]);
      expect(session.excludedIds.size).toBe(0);
      expect(session.pinnedIds.size).toBe(0);
    });

    it('retrieves a session by ID', () => {
      const created = manager.createSession({ name: 'Find Me' });
      const found = manager.getSession(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe('Find Me');
    });

    it('returns undefined for non-existent session', () => {
      const found = manager.getSession('non-existent-id');
      expect(found).toBeUndefined();
    });

    it('deletes a session', () => {
      const session = manager.createSession();
      const deleted = manager.deleteSession(session.id);
      expect(deleted).toBe(true);
      expect(manager.getSession(session.id)).toBeUndefined();
    });

    it('returns false when deleting non-existent session', () => {
      const deleted = manager.deleteSession('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('lists all active sessions', () => {
      manager.createSession({ name: 'Session 1' });
      manager.createSession({ name: 'Session 2' });
      manager.createSession({ name: 'Session 3' });

      const sessions = manager.listSessions();
      expect(sessions.length).toBe(3);
    });

    it('clears all sessions', () => {
      manager.createSession();
      manager.createSession();
      const count = manager.clearAllSessions();
      expect(count).toBe(2);
      expect(manager.listSessions().length).toBe(0);
    });
  });

  describe('Results Management', () => {
    it('adds results to a session', () => {
      const session = manager.createSession();
      const results = [
        createMockSearchResult('r1', 0.9),
        createMockSearchResult('r2', 0.8),
      ];

      manager.addResults(session.id, results);
      expect(manager.getResults(session.id)).toEqual(results);
    });

    it('clears results from a session', () => {
      const session = manager.createSession();
      manager.addResults(session.id, [createMockSearchResult('r1', 0.9)]);
      manager.clearResults(session.id);
      expect(manager.getResults(session.id)).toEqual([]);
    });

    it('throws when adding results to non-existent session', () => {
      expect(() => {
        manager.addResults('non-existent', []);
      }).toThrow('Session not found');
    });
  });

  describe('History Management', () => {
    it('adds history entries', () => {
      const session = manager.createSession();
      const entry = {
        id: 'h1',
        query: 'test query',
        options: {},
        resultCount: 10,
        timestamp: Date.now(),
      };

      manager.addHistoryEntry(session.id, entry);
      const history = manager.getHistory(session.id);
      expect(history.length).toBe(1);
      expect(history[0].query).toBe('test query');
    });

    it('updates session metadata on history add', () => {
      const session = manager.createSession();
      manager.addHistoryEntry(session.id, {
        id: 'h1',
        query: 'my query',
        options: {},
        resultCount: 5,
        timestamp: Date.now(),
      });

      const updated = manager.getSession(session.id);
      expect(updated?.metadata.searchCount).toBe(1);
      expect(updated?.metadata.lastQuery).toBe('my query');
    });
  });

  describe('Anchor Management', () => {
    it('adds positive anchors', () => {
      const session = manager.createSession();
      const anchor = createMockAnchor('a1', 'Positive Anchor');

      manager.addPositiveAnchor(session.id, anchor);
      const anchors = manager.getAnchors(session.id);
      expect(anchors.positive.length).toBe(1);
      expect(anchors.positive[0].name).toBe('Positive Anchor');
    });

    it('adds negative anchors', () => {
      const session = manager.createSession();
      const anchor = createMockAnchor('a1', 'Negative Anchor');

      manager.addNegativeAnchor(session.id, anchor);
      const anchors = manager.getAnchors(session.id);
      expect(anchors.negative.length).toBe(1);
      expect(anchors.negative[0].name).toBe('Negative Anchor');
    });

    it('prevents duplicate anchors', () => {
      const session = manager.createSession();
      const anchor = createMockAnchor('a1', 'Anchor');

      manager.addPositiveAnchor(session.id, anchor);
      manager.addPositiveAnchor(session.id, anchor);
      expect(manager.getAnchors(session.id).positive.length).toBe(1);
    });

    it('removes anchors', () => {
      const session = manager.createSession();
      const anchor = createMockAnchor('a1', 'Anchor');

      manager.addPositiveAnchor(session.id, anchor);
      const removed = manager.removeAnchor(session.id, anchor.id);
      expect(removed).toBe(true);
      expect(manager.getAnchors(session.id).positive.length).toBe(0);
    });

    it('clears all anchors', () => {
      const session = manager.createSession();
      manager.addPositiveAnchor(session.id, createMockAnchor('a1', 'Pos'));
      manager.addNegativeAnchor(session.id, createMockAnchor('a2', 'Neg'));

      manager.clearAnchors(session.id);
      const anchors = manager.getAnchors(session.id);
      expect(anchors.positive.length).toBe(0);
      expect(anchors.negative.length).toBe(0);
    });
  });

  describe('Exclusion & Pin Management', () => {
    it('excludes results', () => {
      const session = manager.createSession();
      manager.excludeResults(session.id, ['r1', 'r2']);

      expect(manager.isExcluded(session.id, 'r1')).toBe(true);
      expect(manager.isExcluded(session.id, 'r2')).toBe(true);
      expect(manager.isExcluded(session.id, 'r3')).toBe(false);
    });

    it('unexcludes results', () => {
      const session = manager.createSession();
      manager.excludeResults(session.id, ['r1', 'r2']);
      manager.unexcludeResults(session.id, ['r1']);

      expect(manager.isExcluded(session.id, 'r1')).toBe(false);
      expect(manager.isExcluded(session.id, 'r2')).toBe(true);
    });

    it('pins results', () => {
      const session = manager.createSession();
      manager.pinResults(session.id, ['r1']);

      expect(manager.isPinned(session.id, 'r1')).toBe(true);
      expect(manager.isPinned(session.id, 'r2')).toBe(false);
    });

    it('unpins results', () => {
      const session = manager.createSession();
      manager.pinResults(session.id, ['r1', 'r2']);
      manager.unpinResults(session.id, ['r1']);

      expect(manager.isPinned(session.id, 'r1')).toBe(false);
      expect(manager.isPinned(session.id, 'r2')).toBe(true);
    });

    it('pinned results cannot be excluded', () => {
      const session = manager.createSession();
      manager.pinResults(session.id, ['r1']);
      manager.excludeResults(session.id, ['r1']);

      expect(manager.isExcluded(session.id, 'r1')).toBe(false);
      expect(manager.isPinned(session.id, 'r1')).toBe(true);
    });

    it('pinning removes exclusion', () => {
      const session = manager.createSession();
      manager.excludeResults(session.id, ['r1']);
      manager.pinResults(session.id, ['r1']);

      expect(manager.isExcluded(session.id, 'r1')).toBe(false);
      expect(manager.isPinned(session.id, 'r1')).toBe(true);
    });
  });

  describe('Session Metadata', () => {
    it('updates session name', () => {
      const session = manager.createSession({ name: 'Original' });
      manager.setSessionName(session.id, 'Updated');

      const updated = manager.getSession(session.id);
      expect(updated?.name).toBe('Updated');
    });

    it('updates session notes', () => {
      const session = manager.createSession();
      manager.setSessionNotes(session.id, 'New notes');

      const updated = manager.getSession(session.id);
      expect(updated?.metadata.notes).toBe('New notes');
    });
  });

  describe('Statistics', () => {
    it('returns correct stats', () => {
      const session1 = manager.createSession();
      const session2 = manager.createSession();

      manager.addResults(session1.id, [
        createMockSearchResult('r1', 0.9),
        createMockSearchResult('r2', 0.8),
      ]);
      manager.addHistoryEntry(session1.id, {
        id: 'h1',
        query: 'test',
        options: {},
        resultCount: 2,
        timestamp: Date.now(),
      });

      const stats = manager.getStats();
      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(2);
      expect(stats.totalSearches).toBe(1);
      expect(stats.totalResults).toBe(2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// UNIFIED STORE TESTS
// ═══════════════════════════════════════════════════════════════════

describe('UnifiedStore', () => {
  describe('StubBooksStore', () => {
    it('returns not available by default', () => {
      const stub = new StubBooksStore();
      expect(stub.isAvailable()).toBe(false);
    });

    it('returns available when configured', () => {
      const stub = new StubBooksStore({ available: true });
      expect(stub.isAvailable()).toBe(true);
    });

    it('returns empty results for all methods', async () => {
      const stub = new StubBooksStore();

      const embedResults = await stub.searchByEmbedding([0.1, 0.2]);
      expect(embedResults).toEqual([]);

      const keywordResults = await stub.searchByKeyword('test');
      expect(keywordResults).toEqual([]);

      const node = await stub.getNode('id');
      expect(node).toBeUndefined();

      const nodes = await stub.getNodes(['id1', 'id2']);
      expect(nodes).toEqual([]);

      const embedding = await stub.getEmbedding('id');
      expect(embedding).toBeUndefined();

      const embeddings = await stub.getEmbeddings(['id1', 'id2']);
      expect(embeddings.size).toBe(0);
    });
  });

  describe('hasBooksStore', () => {
    it('returns false when books store is not provided', () => {
      const mockArchive = createMockArchiveStore();
      const store = new UnifiedStore(mockArchive as any);
      expect(store.hasBooksStore()).toBe(false);
    });

    it('returns false when books store is not available', () => {
      const mockArchive = createMockArchiveStore();
      const stubBooks = new StubBooksStore({ available: false });
      const store = new UnifiedStore(mockArchive as any, stubBooks);
      expect(store.hasBooksStore()).toBe(false);
    });

    it('returns true when books store is available', () => {
      const mockArchive = createMockArchiveStore();
      const stubBooks = new StubBooksStore({ available: true });
      const store = new UnifiedStore(mockArchive as any, stubBooks);
      expect(store.hasBooksStore()).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// ENRICHMENT SERVICE TESTS
// ═══════════════════════════════════════════════════════════════════

describe('EnrichmentService', () => {
  let enricher: EnrichmentService;
  let mockEmbedFn: (text: string) => Promise<number[]>;

  beforeEach(() => {
    const stubLlm = new StubLlmAdapter();
    mockEmbedFn = async (text: string) => [0.1, 0.2, 0.3];
    enricher = new EnrichmentService(stubLlm, mockEmbedFn);
  });

  describe('StubLlmAdapter', () => {
    it('returns placeholder title', async () => {
      const stub = new StubLlmAdapter();
      const result = await stub.complete('Generate title. Title:');
      expect(result).toBe('Generated Title');
    });

    it('returns placeholder summary', async () => {
      const stub = new StubLlmAdapter();
      const result = await stub.complete('Summarize. Summary:');
      expect(result).toBe('This is a generated summary of the content.');
    });

    it('returns placeholder rating', async () => {
      const stub = new StubLlmAdapter();
      const result = await stub.complete('Rate this. Rating:');
      expect(result).toBe('3');
    });

    it('returns placeholder categories', async () => {
      const stub = new StubLlmAdapter();
      const result = await stub.complete('Categorize. Categories:');
      expect(result).toBe('general, uncategorized');
    });

    it('returns placeholder key terms', async () => {
      const stub = new StubLlmAdapter();
      const result = await stub.complete('Extract terms. Key terms:');
      expect(result).toBe('term1, term2, term3');
    });
  });

  describe('generateTitle', () => {
    it('generates a title', async () => {
      const title = await enricher.generateTitle('Some test content');
      expect(title).toBe('Generated Title');
    });
  });

  describe('generateSummary', () => {
    it('generates a summary', async () => {
      const summary = await enricher.generateSummary('Some longer content here');
      expect(summary).toBe('This is a generated summary of the content.');
    });
  });

  describe('generateRating', () => {
    it('generates a rating', async () => {
      const rating = await enricher.generateRating('Quality content');
      expect(rating).toBe(3);
    });
  });

  describe('suggestCategories', () => {
    it('suggests categories', async () => {
      const categories = await enricher.suggestCategories('Technical content');
      expect(categories).toContain('general');
      expect(categories).toContain('uncategorized');
    });
  });

  describe('extractKeyTerms', () => {
    it('extracts key terms', async () => {
      const terms = await enricher.extractKeyTerms('Content with key terms');
      expect(terms).toContain('term1');
      expect(terms).toContain('term2');
      expect(terms).toContain('term3');
    });
  });

  describe('enrichResult', () => {
    it('enriches a result with all fields', async () => {
      const result = createMockSearchResult('r1', 0.9);
      const enriched = await enricher.enrichResult(result);

      expect(enriched.enrichment).toBeDefined();
      expect(enriched.enrichment?.summary).toBeDefined();
      expect(enriched.enrichment?.rating).toBe(3);
      expect(enriched.enrichment?.categories).toBeDefined();
      expect(enriched.enrichment?.keyTerms).toBeDefined();
      expect(enriched.enrichment?.enrichedAt).toBeDefined();
    });

    it('generates title when result has no title', async () => {
      const result = createMockSearchResult('r1', 0.9);
      const enriched = await enricher.enrichResult(result);

      expect(enriched.title).toBe('Generated Title');
    });
  });

  describe('enrichBatch', () => {
    it('enriches multiple results', async () => {
      const results = [
        createMockSearchResult('r1', 0.9),
        createMockSearchResult('r2', 0.8),
        createMockSearchResult('r3', 0.7),
      ];

      const enriched = await enricher.enrichBatch(results);
      expect(enriched.length).toBe(3);
      enriched.forEach(r => {
        expect(r.enrichment).toBeDefined();
      });
    });
  });

  describe('enrichFields', () => {
    it('enriches only specified fields', async () => {
      const result = createMockSearchResult('r1', 0.9);
      const enriched = await enricher.enrichFields(result, ['summary', 'rating']);

      expect(enriched.enrichment?.summary).toBeDefined();
      expect(enriched.enrichment?.rating).toBe(3);
    });
  });

  describe('Cache', () => {
    it('caches enrichments when enabled', async () => {
      const cachedEnricher = new EnrichmentService(
        new StubLlmAdapter(),
        mockEmbedFn,
        { enableCache: true }
      );

      const result = createMockSearchResult('r1', 0.9);
      await cachedEnricher.enrichResult(result);

      expect(cachedEnricher.getCacheSize()).toBe(1);
    });

    it('clears cache', async () => {
      const cachedEnricher = new EnrichmentService(
        new StubLlmAdapter(),
        mockEmbedFn,
        { enableCache: true }
      );

      const result = createMockSearchResult('r1', 0.9);
      await cachedEnricher.enrichResult(result);
      cachedEnricher.clearCache();

      expect(cachedEnricher.getCacheSize()).toBe(0);
    });

    it('removes specific cache entry', async () => {
      const cachedEnricher = new EnrichmentService(
        new StubLlmAdapter(),
        mockEmbedFn,
        { enableCache: true }
      );

      const result = createMockSearchResult('r1', 0.9);
      await cachedEnricher.enrichResult(result);
      const removed = cachedEnricher.removeCacheEntry('r1');

      expect(removed).toBe(true);
      expect(cachedEnricher.getCacheSize()).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Constants', () => {
  describe('HIERARCHY_LEVEL_MAP', () => {
    it('maps L0 to 0', () => {
      expect(HIERARCHY_LEVEL_MAP.L0).toBe(0);
    });

    it('maps L1 to 1', () => {
      expect(HIERARCHY_LEVEL_MAP.L1).toBe(1);
    });

    it('maps apex to 2', () => {
      expect(HIERARCHY_LEVEL_MAP.apex).toBe(2);
    });

    it('maps all to -1', () => {
      expect(HIERARCHY_LEVEL_MAP.all).toBe(-1);
    });
  });

  describe('Default Values', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_LIMIT).toBe(20);
      expect(DEFAULT_THRESHOLD).toBe(0.3);
      expect(DEFAULT_MIN_WORD_COUNT).toBe(20);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function createMockArchiveStore() {
  return {
    getNode: vi.fn().mockResolvedValue(undefined),
    getEmbedding: vi.fn().mockResolvedValue(undefined),
    searchByEmbedding: vi.fn().mockResolvedValue([]),
    searchByKeyword: vi.fn().mockResolvedValue([]),
    queryNodes: vi.fn().mockResolvedValue({ nodes: [], total: 0, hasMore: false }),
  };
}
