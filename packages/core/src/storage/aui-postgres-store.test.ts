/**
 * Unit tests for AUI PostgreSQL Store
 *
 * Tests in-memory behavior and store logic.
 * For integration tests with real DB, run with TEST_WITH_DB=1.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock pg module for unit tests
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
  })),
}));

// Mock pgvector
vi.mock('pgvector', () => ({
  toSql: vi.fn((arr) => `[${arr.join(',')}]`),
  fromSql: vi.fn((str) => str.replace(/[\[\]]/g, '').split(',').map(Number)),
}));

import { AuiPostgresStore, type AuiPostgresStoreOptions } from './aui-postgres-store.js';
import { Pool } from 'pg';

describe('AuiPostgresStore', () => {
  let store: AuiPostgresStore;
  let mockPool: ReturnType<typeof vi.mocked<Pool>>;

  beforeEach(() => {
    mockPool = new Pool() as any;
    store = new AuiPostgresStore(mockPool as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Operations', () => {
    it('creates a session', async () => {
      const mockRow = {
        id: 'test-session-id',
        user_id: 'user-123',
        name: 'Test Session',
        active_buffer_name: null,
        search_session_id: null,
        command_history: [],
        variables: {},
        metadata: { commandCount: 0, searchCount: 0, taskCount: 0 },
        created_at: new Date(),
        updated_at: new Date(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        last_accessed_at: new Date(),
      };

      (mockPool.query as any).mockResolvedValueOnce({ rows: [mockRow] });

      const session = await store.createSession({
        userId: 'user-123',
        name: 'Test Session',
      });

      expect(session.id).toBe('test-session-id');
      expect(session.userId).toBe('user-123');
      expect(session.name).toBe('Test Session');
      expect(session.buffers).toBeInstanceOf(Map);
      expect(session.commandHistory).toEqual([]);
      expect(session.metadata.commandCount).toBe(0);
    });

    it('gets a session by ID', async () => {
      const mockRow = {
        id: 'test-session-id',
        user_id: 'user-123',
        name: 'Test Session',
        active_buffer_name: 'buffer1',
        search_session_id: null,
        command_history: ['cmd1', 'cmd2'],
        variables: { key: 'value' },
        metadata: { commandCount: 2, searchCount: 0, taskCount: 0 },
        created_at: new Date(),
        updated_at: new Date(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        last_accessed_at: new Date(),
      };

      (mockPool.query as any).mockResolvedValueOnce({ rows: [mockRow] });

      const session = await store.getSession('test-session-id');

      expect(session).toBeDefined();
      expect(session?.id).toBe('test-session-id');
      expect(session?.activeBufferName).toBe('buffer1');
      expect(session?.commandHistory).toEqual(['cmd1', 'cmd2']);
      expect(session?.variables.get('key')).toBe('value');
    });

    it('returns undefined for expired session', async () => {
      const mockRow = {
        id: 'test-session-id',
        user_id: 'user-123',
        name: 'Test Session',
        active_buffer_name: null,
        search_session_id: null,
        command_history: [],
        variables: {},
        metadata: { commandCount: 0, searchCount: 0, taskCount: 0 },
        created_at: new Date(),
        updated_at: new Date(),
        expires_at: new Date(Date.now() - 1000), // Already expired
        last_accessed_at: new Date(),
      };

      (mockPool.query as any)
        .mockResolvedValueOnce({ rows: [mockRow] })
        .mockResolvedValueOnce({ rowCount: 1 }); // For delete

      const session = await store.getSession('test-session-id');

      expect(session).toBeUndefined();
    });
  });

  describe('Buffer Operations', () => {
    it('creates a buffer', async () => {
      const mockBufferRow = {
        id: 'buffer-id',
        session_id: 'session-id',
        name: 'test-buffer',
        current_branch: 'main',
        working_content: [{ id: 1, text: 'item1' }],
        is_dirty: false,
        schema: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockBranchRow = {
        id: 'branch-id',
        buffer_id: 'buffer-id',
        name: 'main',
        head_version_id: null,
        parent_branch: null,
        description: null,
        created_at: new Date(),
      };

      (mockPool.query as any)
        .mockResolvedValueOnce({ rows: [mockBufferRow] })
        .mockResolvedValueOnce({ rows: [mockBranchRow] });

      const buffer = await store.createBuffer('session-id', 'test-buffer', [
        { id: 1, text: 'item1' },
      ]);

      expect(buffer.id).toBe('buffer-id');
      expect(buffer.name).toBe('test-buffer');
      expect(buffer.currentBranch).toBe('main');
      expect(buffer.workingContent).toEqual([{ id: 1, text: 'item1' }]);
    });
  });

  describe('Version Operations', () => {
    it('creates a version (commit)', async () => {
      const mockVersionRow = {
        id: 'abc1234',
        buffer_id: 'buffer-id',
        content: [{ id: 1 }],
        message: 'Initial commit',
        parent_id: null,
        tags: [],
        metadata: {},
        created_at: new Date(),
      };

      (mockPool.query as any).mockResolvedValueOnce({ rows: [mockVersionRow] });

      const version = await store.createVersion('buffer-id', {
        id: 'abc1234',
        content: [{ id: 1 }],
        message: 'Initial commit',
      });

      expect(version.id).toBe('abc1234');
      expect(version.message).toBe('Initial commit');
      expect(version.content).toEqual([{ id: 1 }]);
      expect(version.parentId).toBeNull();
    });

    it('gets version history', async () => {
      const mockVersionRows = [
        {
          id: 'version2',
          buffer_id: 'buffer-id',
          content: [{ id: 2 }],
          message: 'Second commit',
          parent_id: 'version1',
          tags: [],
          metadata: {},
          created_at: new Date(),
        },
        {
          id: 'version1',
          buffer_id: 'buffer-id',
          content: [{ id: 1 }],
          message: 'First commit',
          parent_id: null,
          tags: ['v1'],
          metadata: {},
          created_at: new Date(Date.now() - 1000),
        },
      ];

      (mockPool.query as any).mockResolvedValueOnce({ rows: mockVersionRows });

      const history = await store.getVersionHistory('buffer-id', 10);

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('version2');
      expect(history[0].parentId).toBe('version1');
      expect(history[1].id).toBe('version1');
      expect(history[1].tags).toContain('v1');
    });
  });

  describe('Book Operations', () => {
    it('creates a book', async () => {
      const mockBookRow = {
        id: 'book-id',
        user_id: 'user-123',
        title: 'My Book',
        description: 'A test book',
        arc: {
          title: 'My Book',
          arcType: 'thematic',
          introduction: 'Welcome',
          chapters: [],
          themes: [],
          transitions: [],
        },
        status: 'draft',
        source_cluster_id: 'cluster-1',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockPool.query as any).mockResolvedValueOnce({ rows: [mockBookRow] });

      const book = await store.createBook({
        title: 'My Book',
        description: 'A test book',
        arc: {
          title: 'My Book',
          arcType: 'thematic',
          introduction: 'Welcome',
          chapters: [],
          themes: [],
          transitions: [],
        },
        chapters: [],
        sourceClusterId: 'cluster-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft',
        metadata: {},
      });

      expect(book.id).toBe('book-id');
      expect(book.title).toBe('My Book');
      expect(book.status).toBe('draft');
    });
  });

  describe('Cluster Operations', () => {
    it('saves a cluster', async () => {
      const mockClusterRow = {
        id: 'cluster-1',
        user_id: 'user-123',
        label: 'AI Discussion',
        description: 'Cluster about AI',
        passages: [{ id: 'p1', text: 'passage 1' }],
        total_passages: 1,
        coherence: 0.85,
        keywords: ['ai', 'machine learning'],
        source_distribution: { chatgpt: 1 },
        date_range: { earliest: null, latest: null },
        avg_word_count: 50,
        centroid: null,
        discovery_options: null,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      (mockPool.query as any).mockResolvedValueOnce({ rows: [mockClusterRow] });

      const cluster = await store.saveCluster({
        id: 'cluster-1',
        label: 'AI Discussion',
        description: 'Cluster about AI',
        passages: [
          {
            id: 'p1',
            text: 'passage 1',
            sourceType: 'chatgpt',
            wordCount: 50,
            distanceFromCentroid: 0,
          },
        ],
        totalPassages: 1,
        coherence: 0.85,
        keywords: ['ai', 'machine learning'],
        sourceDistribution: { chatgpt: 1 },
        dateRange: { earliest: null, latest: null },
        avgWordCount: 50,
      });

      expect(cluster.id).toBe('cluster-1');
      expect(cluster.label).toBe('AI Discussion');
      expect(cluster.coherence).toBe(0.85);
    });
  });

  describe('Artifact Operations', () => {
    it('creates an artifact', async () => {
      const mockArtifactRow = {
        id: 'artifact-id',
        user_id: 'user-123',
        name: 'my-book.md',
        artifact_type: 'markdown',
        content: '# My Book\n\nContent here',
        content_binary: null,
        mime_type: 'text/markdown',
        size_bytes: 23,
        source_type: 'book',
        source_id: 'book-id',
        metadata: {},
        created_at: new Date(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        download_count: 0,
        last_downloaded_at: null,
      };

      (mockPool.query as any).mockResolvedValueOnce({ rows: [mockArtifactRow] });

      const artifact = await store.createArtifact({
        userId: 'user-123',
        name: 'my-book.md',
        artifactType: 'markdown',
        content: '# My Book\n\nContent here',
        mimeType: 'text/markdown',
        sourceType: 'book',
        sourceId: 'book-id',
      });

      expect(artifact.id).toBe('artifact-id');
      expect(artifact.name).toBe('my-book.md');
      expect(artifact.artifactType).toBe('markdown');
      expect(artifact.content).toBe('# My Book\n\nContent here');
      expect(artifact.downloadCount).toBe(0);
    });

    it('exports an artifact and increments download count', async () => {
      const mockArtifactRow = {
        id: 'artifact-id',
        user_id: 'user-123',
        name: 'my-book.md',
        artifact_type: 'markdown',
        content: '# My Book',
        content_binary: null,
        mime_type: 'text/markdown',
        size_bytes: 10,
        source_type: 'book',
        source_id: 'book-id',
        metadata: {},
        created_at: new Date(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        download_count: 5,
        last_downloaded_at: null,
      };

      (mockPool.query as any)
        .mockResolvedValueOnce({ rows: [mockArtifactRow] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const artifact = await store.exportArtifact('artifact-id');

      expect(artifact).toBeDefined();
      expect(artifact?.downloadCount).toBe(6);
    });
  });

  describe('Cleanup Operations', () => {
    it('cleans up expired sessions', async () => {
      (mockPool.query as any).mockResolvedValueOnce({ rowCount: 3 });

      const count = await store.cleanupExpiredSessions();

      expect(count).toBe(3);
    });

    it('cleans up expired clusters', async () => {
      (mockPool.query as any).mockResolvedValueOnce({ rowCount: 2 });

      const count = await store.cleanupExpiredClusters();

      expect(count).toBe(2);
    });

    it('cleans up expired artifacts', async () => {
      (mockPool.query as any).mockResolvedValueOnce({ rowCount: 5 });

      const count = await store.cleanupExpiredArtifacts();

      expect(count).toBe(5);
    });

    it('runs all cleanup tasks', async () => {
      (mockPool.query as any)
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 2 })
        .mockResolvedValueOnce({ rowCount: 3 });

      const result = await store.runCleanup();

      expect(result).toEqual({
        sessions: 1,
        clusters: 2,
        artifacts: 3,
      });
    });
  });
});
