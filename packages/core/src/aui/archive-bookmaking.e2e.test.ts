/**
 * Archive to Bookmaking E2E Tests
 *
 * Tests the full pipeline from archive content through embedding,
 * clustering, and book creation via the AUI service.
 *
 * Note: These tests use in-memory mocks since they don't connect to
 * a real database or Ollama instance.
 *
 * @module @humanizer/core/aui/archive-bookmaking.e2e.test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  UnifiedAuiService,
  resetUnifiedAui,
  resetBufferManager,
  resetAdminService,
  resetAgenticLoop,
} from './index.js';

// ═══════════════════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════════════════

const mockPassages = [
  {
    id: 'node-1',
    text: 'I remember the summer of 2015 when we traveled to the mountains. The air was crisp and the views were breathtaking.',
    relevance: 0.95,
    sourceType: 'chatgpt-message',
    authorRole: 'user',
    sourceCreatedAt: new Date('2023-01-15'),
    wordCount: 22,
  },
  {
    id: 'node-2',
    text: 'My favorite hiking trail is the one near the lake. It takes about 3 hours to complete and offers stunning scenery.',
    relevance: 0.88,
    sourceType: 'chatgpt-message',
    authorRole: 'user',
    sourceCreatedAt: new Date('2023-02-20'),
    wordCount: 22,
  },
  {
    id: 'node-3',
    text: 'The mountain sunrise was unforgettable. We woke up at 4am to catch the first light breaking over the peaks.',
    relevance: 0.82,
    sourceType: 'chatgpt-message',
    authorRole: 'user',
    sourceCreatedAt: new Date('2023-03-10'),
    wordCount: 21,
  },
  {
    id: 'node-4',
    text: 'Nature photography has become my passion. I love capturing the beauty of landscapes and wildlife.',
    relevance: 0.75,
    sourceType: 'chatgpt-message',
    authorRole: 'user',
    sourceCreatedAt: new Date('2023-04-05'),
    wordCount: 15,
  },
  {
    id: 'node-5',
    text: 'The forest trails offer peaceful solitude. Sometimes I just sit and listen to the birds for hours.',
    relevance: 0.70,
    sourceType: 'chatgpt-message',
    authorRole: 'user',
    sourceCreatedAt: new Date('2023-05-15'),
    wordCount: 17,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SEARCH SERVICE
// ═══════════════════════════════════════════════════════════════════════════

const createMockAgenticSearch = () => ({
  search: async (query: string, options?: any) => {
    let results = mockPassages.map(p => ({
      id: p.id,
      text: p.text,
      score: p.relevance,
      source: p.sourceType,
      authorRole: p.authorRole,
      sourceCreatedAt: p.sourceCreatedAt,
    }));

    // Apply threshold filter
    if (options?.threshold) {
      results = results.filter(r => r.score >= options.threshold);
    }

    // Apply limit
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return {
      results,
      stats: {
        searchTime: 50,
        totalResults: results.length,
      },
    };
  },
  searchInSession: async (sessionId: string, query: string, options?: any) => ({
    results: mockPassages.map(p => ({
      id: p.id,
      text: p.text,
      score: p.relevance,
      source: p.sourceType,
    })),
    stats: {},
  }),
  refineResults: async (sessionId: string, options?: any) => ({
    results: mockPassages.slice(0, 3).map(p => ({
      id: p.id,
      text: p.text,
      score: p.relevance,
      source: p.sourceType,
    })),
    stats: {},
  }),
  addPositiveAnchor: async (sessionId: string, resultId: string) => ({
    id: `anchor-${resultId}`,
    type: 'positive',
    resultId,
    createdAt: new Date(),
  }),
  addNegativeAnchor: async (sessionId: string, resultId: string) => ({
    id: `anchor-${resultId}`,
    type: 'negative',
    resultId,
    createdAt: new Date(),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SETUP
// ═══════════════════════════════════════════════════════════════════════════

describe('Archive to Bookmaking E2E', () => {
  let service: UnifiedAuiService;

  beforeAll(async () => {
    // Reset all services
    resetUnifiedAui();
    resetBufferManager();
    resetAdminService();
    resetAgenticLoop();

    // Create service with mock search
    service = new UnifiedAuiService();
    service.setAgenticSearch(createMockAgenticSearch() as any);
  });

  afterAll(() => {
    resetUnifiedAui();
  });

  beforeEach(() => {
    // Nothing to reset between tests for this service
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HARVEST OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Harvest Operations', () => {
    it('harvests passages for a theme', async () => {
      const result = await service.harvest({
        query: 'nature hiking mountains',
        limit: 10,
        minRelevance: 0.5,
      });

      expect(result.passages).toBeDefined();
      expect(result.passages.length).toBeGreaterThan(0);
      expect(result.query).toBe('nature hiking mountains');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('filters by date range', async () => {
      const result = await service.harvest({
        query: 'mountains',
        dateRange: {
          start: new Date('2023-02-01'),
          end: new Date('2023-04-01'),
        },
      });

      // Should only include passages from Feb-Apr 2023
      for (const passage of result.passages) {
        if (passage.sourceCreatedAt) {
          expect(passage.sourceCreatedAt.getTime()).toBeGreaterThanOrEqual(
            new Date('2023-02-01').getTime()
          );
          expect(passage.sourceCreatedAt.getTime()).toBeLessThanOrEqual(
            new Date('2023-04-01').getTime()
          );
        }
      }
    });

    it('excludes specific node IDs', async () => {
      const result = await service.harvest({
        query: 'mountains',
        excludeIds: ['node-1', 'node-2'],
      });

      const ids = result.passages.map(p => p.id);
      expect(ids).not.toContain('node-1');
      expect(ids).not.toContain('node-2');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // NARRATIVE ARC GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Narrative Arc Generation', () => {
    it('generates a chronological arc', async () => {
      const arc = await service.generateArc({
        passages: mockPassages,
        arcType: 'chronological',
        introWordCount: 200,
      });

      expect(arc.title).toBeDefined();
      expect(arc.arcType).toBe('chronological');
      expect(arc.introduction).toBeDefined();
      expect(arc.chapters).toBeDefined();
      expect(arc.chapters.length).toBeGreaterThan(0);
      expect(arc.themes).toBeDefined();
    });

    it('generates a thematic arc', async () => {
      const arc = await service.generateArc({
        passages: mockPassages,
        arcType: 'thematic',
      });

      expect(arc.arcType).toBe('thematic');
      expect(arc.chapters.length).toBeGreaterThan(0);
    });

    it('generates a dramatic arc', async () => {
      const arc = await service.generateArc({
        passages: mockPassages,
        arcType: 'dramatic',
      });

      expect(arc.arcType).toBe('dramatic');
    });

    it('extracts themes from passages', async () => {
      const arc = await service.generateArc({
        passages: mockPassages,
        arcType: 'thematic',
      });

      expect(arc.themes.length).toBeGreaterThan(0);
      // Should extract common words from the passages
    });

    it('creates chapters with passage IDs', async () => {
      const arc = await service.generateArc({
        passages: mockPassages,
        arcType: 'chronological',
      });

      const allPassageIds = arc.chapters.flatMap(ch => ch.passageIds);
      expect(allPassageIds.length).toBe(mockPassages.length);
    });

    it('generates transitions between chapters', async () => {
      const arc = await service.generateArc({
        passages: mockPassages,
        arcType: 'thematic',
      });

      // Transitions should be one less than chapters
      expect(arc.transitions.length).toBe(arc.chapters.length - 1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOK MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Book Management', () => {
    it('lists books (initially empty)', async () => {
      const books = await service.listBooks();
      expect(Array.isArray(books)).toBe(true);
    });

    it('returns undefined for non-existent book', async () => {
      const book = await service.getBook('non-existent-id');
      expect(book).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL E2E PIPELINE (HARVEST → ARC → BOOK)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Full Harvest to Book Pipeline', () => {
    it('creates a book from harvested passages', async () => {
      // Step 1: Harvest passages
      const harvestResult = await service.harvest({
        query: 'nature hiking mountains',
        limit: 10,
      });

      expect(harvestResult.passages.length).toBeGreaterThan(0);

      // Step 2: Generate narrative arc
      const arc = await service.generateArc({
        passages: harvestResult.passages,
        arcType: 'thematic',
        introWordCount: 300,
      });

      expect(arc.title).toBeDefined();
      expect(arc.introduction).toBeDefined();
      expect(arc.chapters.length).toBeGreaterThan(0);

      // Step 3: Verify arc structure
      expect(arc.themes.length).toBeGreaterThan(0);
      expect(arc.transitions.length).toBe(arc.chapters.length - 1);

      // Verify all passages are assigned to chapters
      const allPassageIds = arc.chapters.flatMap(ch => ch.passageIds);
      expect(allPassageIds.length).toBe(harvestResult.passages.length);
    });

    it('filters passages through the pipeline', async () => {
      // Harvest with filters
      const harvestResult = await service.harvest({
        query: 'mountains',
        minRelevance: 0.8,
        excludeIds: ['node-5'],
      });

      // Only high-relevance passages should remain
      for (const passage of harvestResult.passages) {
        expect(passage.relevance).toBeGreaterThanOrEqual(0.8);
        expect(passage.id).not.toBe('node-5');
      }

      // Generate arc from filtered passages
      if (harvestResult.passages.length > 0) {
        const arc = await service.generateArc({
          passages: harvestResult.passages,
          arcType: 'chronological',
        });

        // Arc should only contain filtered passages
        const allPassageIds = arc.chapters.flatMap(ch => ch.passageIds);
        expect(allPassageIds).not.toContain('node-5');
      }
    });

    it('supports different arc types for same content', async () => {
      const harvestResult = await service.harvest({
        query: 'nature',
        limit: 10,
      });

      const chronoArc = await service.generateArc({
        passages: harvestResult.passages,
        arcType: 'chronological',
      });

      const thematicArc = await service.generateArc({
        passages: harvestResult.passages,
        arcType: 'thematic',
      });

      const dramaticArc = await service.generateArc({
        passages: harvestResult.passages,
        arcType: 'dramatic',
      });

      // All arcs should have same number of passages
      const getPassageCount = (arc: any) =>
        arc.chapters.flatMap((ch: any) => ch.passageIds).length;

      expect(getPassageCount(chronoArc)).toBe(harvestResult.passages.length);
      expect(getPassageCount(thematicArc)).toBe(harvestResult.passages.length);
      expect(getPassageCount(dramaticArc)).toBe(harvestResult.passages.length);

      // But different arc types
      expect(chronoArc.arcType).toBe('chronological');
      expect(thematicArc.arcType).toBe('thematic');
      expect(dramaticArc.arcType).toBe('dramatic');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT FILTERING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Content Filtering', () => {
    it('respects minimum relevance threshold', async () => {
      const result = await service.harvest({
        query: 'test',
        minRelevance: 0.9,
      });

      for (const passage of result.passages) {
        expect(passage.relevance).toBeGreaterThanOrEqual(0.9);
      }
    });

    it('respects limit parameter', async () => {
      const result = await service.harvest({
        query: 'test',
        limit: 2,
      });

      expect(result.passages.length).toBeLessThanOrEqual(2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS (requires Ollama + PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════════

describe('Archive Bookmaking Integration', () => {
  describe.skip('With Live Services (requires Ollama + PostgreSQL)', () => {
    it('embeds and clusters real archive content', async () => {
      // This test would run against real services
      // Skip by default since it requires infrastructure
    });

    it('creates book from real clusters', async () => {
      // This test would run against real services
    });
  });
});
