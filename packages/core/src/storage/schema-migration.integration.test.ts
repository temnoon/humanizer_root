/**
 * Integration test for AUI schema migration
 *
 * Run with: TEST_WITH_DB=1 npx vitest run src/storage/schema-migration.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';

// Skip if not running with database
const runWithDb = process.env.TEST_WITH_DB === '1';

describe.skipIf(!runWithDb)('AUI Schema Migration', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_archive',
      user: 'tem',
      max: 5,
    });
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('runs v3 migration and creates AUI tables', async () => {
    // Dynamic import to trigger migration
    const { initContentStore, closeContentStore } = await import('./postgres-content-store.js');

    const store = await initContentStore({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_archive',
      user: 'tem',
      maxConnections: 5,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
      embeddingDimension: 768,
      enableFTS: true,
      enableVec: true,
    });

    // Verify schema version
    const versionResult = await pool.query(
      "SELECT value FROM schema_meta WHERE key = 'schema_version'"
    );
    expect(versionResult.rows[0]?.value).toBe('3');

    // Verify AUI tables exist
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'aui_%'
      ORDER BY table_name
    `);

    const tableNames = tablesResult.rows.map(r => r.table_name);

    expect(tableNames).toContain('aui_sessions');
    expect(tableNames).toContain('aui_buffers');
    expect(tableNames).toContain('aui_buffer_branches');
    expect(tableNames).toContain('aui_buffer_versions');
    expect(tableNames).toContain('aui_tasks');
    expect(tableNames).toContain('aui_books');
    expect(tableNames).toContain('aui_book_chapters');
    expect(tableNames).toContain('aui_clusters');
    expect(tableNames).toContain('aui_artifacts');

    console.log('\nAUI tables created:', tableNames);

    // Verify indexes
    const indexResult = await pool.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE tablename LIKE 'aui_%'
      ORDER BY tablename, indexname
    `);

    console.log('\nAUI indexes:', indexResult.rows.length);

    expect(indexResult.rows.length).toBeGreaterThan(20);

    await closeContentStore();
  });

  it('creates and retrieves a session via AuiPostgresStore', async () => {
    const { initContentStore, closeContentStore, getContentStore } = await import('./postgres-content-store.js');
    const { AuiPostgresStore } = await import('./aui-postgres-store.js');

    await initContentStore({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_archive',
      user: 'tem',
      maxConnections: 5,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
      embeddingDimension: 768,
      enableFTS: true,
      enableVec: true,
    });

    const store = new AuiPostgresStore(getContentStore().getPool());

    // Create a session
    const session = await store.createSession({
      userId: 'test-user-integration',
      name: 'Integration Test Session',
    });

    expect(session.id).toBeDefined();
    expect(session.userId).toBe('test-user-integration');
    expect(session.name).toBe('Integration Test Session');

    console.log('\nCreated session:', session.id);

    // Retrieve the session
    const retrieved = await store.getSession(session.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(session.id);

    // Clean up
    await store.deleteSession(session.id);
    const deleted = await store.getSession(session.id);
    expect(deleted).toBeUndefined();

    await closeContentStore();
  });

  it('creates a book with chapters', async () => {
    const { initContentStore, closeContentStore, getContentStore } = await import('./postgres-content-store.js');
    const { AuiPostgresStore } = await import('./aui-postgres-store.js');

    await initContentStore({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_archive',
      user: 'tem',
      maxConnections: 5,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
      embeddingDimension: 768,
      enableFTS: true,
      enableVec: true,
    });

    const store = new AuiPostgresStore(getContentStore().getPool());

    // Create a book with chapters
    const book = await store.createBook({
      title: 'Integration Test Book',
      description: 'A book for testing',
      arc: {
        title: 'Test Arc',
        arcType: 'thematic',
        introduction: 'This is a test book.',
        chapters: [],
        themes: ['testing', 'integration'],
        transitions: [],
      },
      chapters: [
        {
          id: crypto.randomUUID(),
          title: 'Chapter One',
          content: 'Content of chapter one.',
          passageIds: ['p1', 'p2'],
          position: 0,
          wordCount: 5,
        },
        {
          id: crypto.randomUUID(),
          title: 'Chapter Two',
          content: 'Content of chapter two.',
          passageIds: ['p3'],
          position: 1,
          wordCount: 5,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'draft',
      metadata: { testRun: true },
    });

    expect(book.id).toBeDefined();
    expect(book.title).toBe('Integration Test Book');

    console.log('\nCreated book:', book.id);

    // Retrieve the book
    const retrieved = await store.getBook(book.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.chapters).toHaveLength(2);
    expect(retrieved?.chapters[0].title).toBe('Chapter One');
    expect(retrieved?.chapters[1].title).toBe('Chapter Two');

    // Clean up
    await store.deleteBook(book.id);

    await closeContentStore();
  });

  it('creates and exports an artifact', async () => {
    const { initContentStore, closeContentStore, getContentStore } = await import('./postgres-content-store.js');
    const { AuiPostgresStore } = await import('./aui-postgres-store.js');

    await initContentStore({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_archive',
      user: 'tem',
      maxConnections: 5,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
      embeddingDimension: 768,
      enableFTS: true,
      enableVec: true,
    });

    const store = new AuiPostgresStore(getContentStore().getPool());

    // Create an artifact
    const artifact = await store.createArtifact({
      userId: 'test-user',
      name: 'test-export.md',
      artifactType: 'markdown',
      content: '# Test Export\n\nThis is a test.',
      mimeType: 'text/markdown',
      sourceType: 'test',
      sourceId: 'test-123',
    });

    expect(artifact.id).toBeDefined();
    expect(artifact.name).toBe('test-export.md');
    expect(artifact.downloadCount).toBe(0);

    console.log('\nCreated artifact:', artifact.id);

    // Export (download) the artifact
    const exported = await store.exportArtifact(artifact.id);
    expect(exported).toBeDefined();
    expect(exported?.downloadCount).toBe(1);
    expect(exported?.content).toBe('# Test Export\n\nThis is a test.');

    // Clean up
    await store.deleteArtifact(artifact.id);

    await closeContentStore();
  });
});
