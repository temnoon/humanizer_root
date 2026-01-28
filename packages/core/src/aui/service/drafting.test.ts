/**
 * Drafting Loop Service Tests
 *
 * Tests for the iterative drafting service including:
 * - Session management
 * - Multi-source gathering
 * - Draft generation and revision
 * - Export functionality
 *
 * @module @humanizer/core/aui/service/drafting.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createDraftingMethods,
  DEFAULT_NARRATOR_PERSONA,
  type DraftingMethods,
} from './drafting.js';
import type { ServiceDependencies } from './types.js';
import type { ClusteringMethods } from './archive-clustering.js';
import type { BookMethods } from './books.js';
import type { DraftSource, DraftingSession } from '../types/drafting-types.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════════════════

const mockPassages = [
  {
    id: 'passage-1',
    text: 'The first implementation was rough but functional. We could see the patterns emerging.',
    relevance: 0.92,
    sourceType: 'chatgpt-message',
    authorRole: 'user',
    sourceCreatedAt: new Date('2024-01-15'),
    wordCount: 14,
  },
  {
    id: 'passage-2',
    text: 'Debugging at 2am, I finally understood the architecture. Everything connected.',
    relevance: 0.88,
    sourceType: 'chatgpt-message',
    authorRole: 'user',
    sourceCreatedAt: new Date('2024-01-20'),
    wordCount: 12,
  },
  {
    id: 'passage-3',
    text: 'The tests passed. All green. But did we actually solve the problem?',
    relevance: 0.85,
    sourceType: 'chatgpt-message',
    authorRole: 'user',
    sourceCreatedAt: new Date('2024-01-25'),
    wordCount: 13,
  },
];

function createMockDeps(): ServiceDependencies {
  return {
    getStore: () => null,
    getBooksStore: () => null,
    getArchiveStore: () => null,
    getAgenticSearch: () => null,
    getAgenticLoop: () => null,
    getAdminService: () => null,
    getBqlExecutor: () => null,
    getBufferService: () => ({ createFromText: vi.fn(), rewriteForPersona: vi.fn() } as any),
    getBufferManager: () => ({ createBuffer: vi.fn() } as any),
    getSessionManager: () => ({
      create: vi.fn(),
      get: vi.fn(),
      touch: vi.fn(),
    } as any),
    getDefaultEmbeddingModel: () => 'nomic-embed-text:latest',
    getBooks: () => new Map(),
    getHarvestSessions: () => new Map(),
    getSessionCache: () => new Map(),
  };
}

function createMockClusteringMethods(): ClusteringMethods {
  return {
    discoverClusters: vi.fn(),
    listClusters: vi.fn(),
    getCluster: vi.fn().mockResolvedValue({
      id: 'cluster-1',
      label: 'Development Stories',
      passages: mockPassages.map(p => ({
        ...p,
        distanceFromCentroid: 1 - (p.relevance || 0.5),
      })),
    }),
    saveCluster: vi.fn(),
  } as unknown as ClusteringMethods;
}

function createMockBookMethods(): BookMethods {
  return {
    createBookFromCluster: vi.fn(),
    createBookWithPersona: vi.fn(),
    harvest: vi.fn().mockResolvedValue({
      passages: mockPassages,
      query: 'test query',
      candidatesFound: 3,
      durationMs: 50,
    }),
    generateArc: vi.fn(),
    listBooks: vi.fn(),
    getBook: vi.fn(),
  } as unknown as BookMethods;
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('DraftingMethods', () => {
  let draftingMethods: DraftingMethods;
  let mockDeps: ServiceDependencies;
  let mockClusteringMethods: ClusteringMethods;
  let mockBookMethods: BookMethods;

  beforeEach(() => {
    mockDeps = createMockDeps();
    mockClusteringMethods = createMockClusteringMethods();
    mockBookMethods = createMockBookMethods();
    draftingMethods = createDraftingMethods(mockDeps, mockClusteringMethods, mockBookMethods);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Management', () => {
    it('starts a new drafting session', async () => {
      const sources: DraftSource[] = [
        { type: 'aui-archive', query: 'development stories' },
      ];

      const session = await draftingMethods.startDrafting({
        title: 'Test Chapter',
        sources,
      });

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.title).toBe('Test Chapter');
      expect(session.status).toBe('gathering');
      expect(session.sources).toEqual(sources);
      expect(session.versions).toHaveLength(0);
      expect(session.narratorPersona).toBeDefined();
    });

    it('retrieves an existing session', async () => {
      const session = await draftingMethods.startDrafting({
        title: 'Test',
        sources: [{ type: 'direct-text', text: 'Hello' }],
      });

      const retrieved = draftingMethods.getDraftingSession(session.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
    });

    it('returns undefined for non-existent session', () => {
      const session = draftingMethods.getDraftingSession('non-existent');
      expect(session).toBeUndefined();
    });

    it('lists drafting sessions', async () => {
      await draftingMethods.startDrafting({
        title: 'Session 1',
        sources: [{ type: 'direct-text', text: 'A' }],
      });
      await draftingMethods.startDrafting({
        title: 'Session 2',
        sources: [{ type: 'direct-text', text: 'B' }],
      });

      const sessions = draftingMethods.listDraftingSessions();
      expect(sessions.length).toBe(2);
    });

    it('deletes a session', async () => {
      const session = await draftingMethods.startDrafting({
        title: 'To Delete',
        sources: [{ type: 'direct-text', text: 'X' }],
      });

      const deleted = draftingMethods.deleteDraftingSession(session.id);
      expect(deleted).toBe(true);

      const retrieved = draftingMethods.getDraftingSession(session.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Material Gathering', () => {
    it('gathers from direct text source', async () => {
      const session = await draftingMethods.startDrafting({
        title: 'Direct Text Test',
        sources: [
          {
            type: 'direct-text',
            text: 'This is direct text content for testing.',
            label: 'Test Label',
          },
        ],
      });

      const result = await draftingMethods.gatherMaterial(session.id);

      expect(result.passages).toHaveLength(1);
      expect(result.passages[0].text).toBe('This is direct text content for testing.');
      expect(result.passages[0].sourceType).toBe('direct-text');
      expect(result.sourceStats).toHaveLength(1);
      expect(result.sourceStats[0].sourceType).toBe('direct-text');
      expect(result.sourceStats[0].count).toBe(1);
    });

    it('gathers from AUI archive source', async () => {
      const session = await draftingMethods.startDrafting({
        title: 'Archive Test',
        sources: [
          { type: 'aui-archive', query: 'development' },
        ],
      });

      const result = await draftingMethods.gatherMaterial(session.id);

      expect(mockBookMethods.harvest).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'development' })
      );
      expect(result.passages.length).toBeGreaterThan(0);
    });

    it('gathers from AUI cluster source', async () => {
      const session = await draftingMethods.startDrafting({
        title: 'Cluster Test',
        sources: [
          { type: 'aui-cluster', clusterId: 'cluster-1' },
        ],
      });

      const result = await draftingMethods.gatherMaterial(session.id);

      expect(mockClusteringMethods.getCluster).toHaveBeenCalledWith('cluster-1');
      expect(result.passages.length).toBeGreaterThan(0);
    });

    it('updates session status after gathering', async () => {
      const session = await draftingMethods.startDrafting({
        title: 'Status Test',
        sources: [{ type: 'direct-text', text: 'Test' }],
      });

      await draftingMethods.gatherMaterial(session.id);

      const updated = draftingMethods.getDraftingSession(session.id);
      expect(updated?.status).toBe('drafting');
      expect(updated?.gatheredMaterial).toBeDefined();
    });

    it('reports progress during gathering', async () => {
      const session = await draftingMethods.startDrafting({
        title: 'Progress Test',
        sources: [
          { type: 'direct-text', text: 'A' },
          { type: 'direct-text', text: 'B' },
        ],
      });

      const progressUpdates: any[] = [];
      await draftingMethods.gatherMaterial(session.id, (progress) => {
        progressUpdates.push(progress);
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].phase).toBe('gathering');
    });
  });

  describe('Default Narrator Persona', () => {
    it('exports a default narrator persona', () => {
      expect(DEFAULT_NARRATOR_PERSONA).toBeDefined();
      expect(DEFAULT_NARRATOR_PERSONA.name).toBe('Development Chronicle');
      expect(DEFAULT_NARRATOR_PERSONA.systemPrompt).toContain('narrative prose');
      expect(DEFAULT_NARRATOR_PERSONA.avoidPatterns).toContain('delve');
    });

    it('uses default persona when none specified', async () => {
      const session = await draftingMethods.startDrafting({
        title: 'Default Persona Test',
        sources: [{ type: 'direct-text', text: 'Test' }],
      });

      expect(session.narratorPersona).toBeDefined();
      expect(session.narratorPersona?.name).toBe(DEFAULT_NARRATOR_PERSONA.name);
    });

    it('accepts custom narrator persona', async () => {
      const customPersona = {
        name: 'Custom Voice',
        systemPrompt: 'You are a custom narrator.',
        temperature: 0.5,
      };

      const session = await draftingMethods.startDrafting({
        title: 'Custom Persona Test',
        sources: [{ type: 'direct-text', text: 'Test' }],
        narratorPersona: customPersona,
      });

      expect(session.narratorPersona?.name).toBe('Custom Voice');
      expect(session.narratorPersona?.temperature).toBe(0.5);
    });
  });

  describe('Draft Version Management', () => {
    it('retrieves specific draft version', async () => {
      const session = await draftingMethods.startDrafting({
        title: 'Version Test',
        sources: [{ type: 'direct-text', text: 'Content' }],
      });

      // Simulate adding a version
      const updatedSession = draftingMethods.getDraftingSession(session.id)!;
      updatedSession.versions.push({
        version: 1,
        content: 'Test draft content',
        wordCount: 3,
        createdAt: new Date(),
        feedbackApplied: null,
      });
      updatedSession.currentVersion = 1;

      const version = draftingMethods.getDraftVersion(session.id, 1);
      expect(version).toBeDefined();
      expect(version?.content).toBe('Test draft content');
    });

    it('compares draft versions', async () => {
      const session = await draftingMethods.startDrafting({
        title: 'Compare Test',
        sources: [{ type: 'direct-text', text: 'Content' }],
      });

      // Simulate adding versions
      const updatedSession = draftingMethods.getDraftingSession(session.id)!;
      updatedSession.versions.push({
        version: 1,
        content: 'The first draft with some words',
        wordCount: 6,
        createdAt: new Date(),
        feedbackApplied: null,
      });
      updatedSession.versions.push({
        version: 2,
        content: 'The revised draft with different words now',
        wordCount: 7,
        createdAt: new Date(),
        feedbackApplied: {
          providedAt: new Date(),
          text: 'Add more detail',
        },
      });
      updatedSession.currentVersion = 2;

      const diff = draftingMethods.compareDraftVersions(session.id, 1, 2);
      expect(diff).toBeDefined();
      expect(diff?.wordCountDiff).toBe(1);
    });
  });

  describe('Session Filtering', () => {
    it('filters sessions by status', async () => {
      const session1 = await draftingMethods.startDrafting({
        title: 'Session 1',
        sources: [{ type: 'direct-text', text: 'A' }],
      });
      await draftingMethods.startDrafting({
        title: 'Session 2',
        sources: [{ type: 'direct-text', text: 'B' }],
      });

      // Advance session 1 to different status
      await draftingMethods.gatherMaterial(session1.id);

      const gatheringSessions = draftingMethods.listDraftingSessions({ status: 'gathering' });
      const draftingSessions = draftingMethods.listDraftingSessions({ status: 'drafting' });

      expect(gatheringSessions.length).toBe(1);
      expect(draftingSessions.length).toBe(1);
    });

    it('filters sessions by user', async () => {
      await draftingMethods.startDrafting({
        title: 'User A Session',
        userId: 'user-a',
        sources: [{ type: 'direct-text', text: 'A' }],
      });
      await draftingMethods.startDrafting({
        title: 'User B Session',
        userId: 'user-b',
        sources: [{ type: 'direct-text', text: 'B' }],
      });

      const userASessions = draftingMethods.listDraftingSessions({ userId: 'user-a' });
      expect(userASessions.length).toBe(1);
      expect(userASessions[0].title).toBe('User A Session');
    });

    it('limits number of sessions returned', async () => {
      await draftingMethods.startDrafting({
        title: 'Session 1',
        sources: [{ type: 'direct-text', text: 'A' }],
      });
      await draftingMethods.startDrafting({
        title: 'Session 2',
        sources: [{ type: 'direct-text', text: 'B' }],
      });
      await draftingMethods.startDrafting({
        title: 'Session 3',
        sources: [{ type: 'direct-text', text: 'C' }],
      });

      const limited = draftingMethods.listDraftingSessions({ limit: 2 });
      expect(limited.length).toBe(2);
    });
  });
});
