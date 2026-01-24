/**
 * Integration tests for BooksPostgresStore
 *
 * Run with: TEST_WITH_DB=1 npx vitest run src/storage/books-postgres-store.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';

// Skip if not running with database
const runWithDb = process.env.TEST_WITH_DB === '1';

describe.skipIf(!runWithDb)('BooksPostgresStore Integration', () => {
  let pool: Pool;
  let testBookId: string;

  beforeAll(async () => {
    pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_books',
      user: 'tem',
      max: 5,
    });

    // Generate a test book ID
    testBookId = crypto.randomUUID();
  });

  afterAll(async () => {
    // Clean up test data
    if (pool) {
      try {
        await pool.query('DELETE FROM book_nodes WHERE book_id = $1', [testBookId]);
        await pool.query('DELETE FROM books WHERE id = $1', [testBookId]);
      } catch (e) {
        // Ignore cleanup errors
      }
      await pool.end();
    }
  });

  it('initializes books schema', async () => {
    const { initBooksStore, closeBooksStore } = await import('./books-postgres-store.js');

    const store = await initBooksStore({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_books',
      user: 'tem',
      maxConnections: 5,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
      embeddingDimension: 768,
    });

    expect(store.isAvailable()).toBe(true);

    // Verify schema
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('books', 'chapters', 'book_nodes', 'book_links')
      ORDER BY table_name
    `);

    const tableNames = tablesResult.rows.map(r => r.table_name);
    console.log('\nBooks database tables:', tableNames);

    expect(tableNames).toContain('books');
    expect(tableNames).toContain('chapters');
    expect(tableNames).toContain('book_nodes');

    await closeBooksStore();
  });

  it('creates a book entry for testing', async () => {
    // First create a book entry in the books table
    const result = await pool.query(`
      INSERT INTO books (id, slug, title, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [testBookId, `test-book-${Date.now()}`, 'Integration Test Book', 'A book for testing']);

    expect(result.rows[0].id).toBe(testBookId);
    console.log('\nCreated test book:', result.rows[0].id);
  });

  it('creates and retrieves book nodes', async () => {
    const { initBooksStore, closeBooksStore, getBooksStore } = await import('./books-postgres-store.js');

    await initBooksStore({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_books',
      user: 'tem',
      maxConnections: 5,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
      embeddingDimension: 768,
    });

    const store = getBooksStore()!;
    expect(store.isAvailable()).toBe(true);

    // Create a node
    const node = await store.createNode({
      bookId: testBookId,
      text: 'This is a test chapter about consciousness and the nature of mind.',
      format: 'markdown',
      position: 0,
      hierarchyLevel: 0,
      sourceType: 'synthesized',
      metadata: { testRun: true },
    });

    expect(node.id).toBeDefined();
    expect(node.bookId).toBe(testBookId);
    expect(node.text).toContain('consciousness');
    expect(node.hierarchyLevel).toBe(0);

    console.log('\nCreated book node:', node.id);

    // Retrieve the node
    const retrieved = await store.getNode(node.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(node.id);
    expect(retrieved?.text).toBe(node.text);

    // Get all nodes for the book
    const bookNodes = await store.getBookNodes(testBookId);
    expect(bookNodes.length).toBeGreaterThan(0);
    expect(bookNodes[0].bookId).toBe(testBookId);

    await closeBooksStore();
  });

  it('creates and searches by embedding', async () => {
    const { initBooksStore, closeBooksStore, getBooksStore } = await import('./books-postgres-store.js');

    await initBooksStore({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_books',
      user: 'tem',
      maxConnections: 5,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
      embeddingDimension: 768,
    });

    const store = getBooksStore()!;

    // Create a node with embedding
    const node = await store.createNode({
      bookId: testBookId,
      text: 'The philosophy of mind explores consciousness, perception, and mental states.',
      format: 'markdown',
      position: 1,
      hierarchyLevel: 0,
    });

    // Create a mock 768-dim embedding (normally would come from embedding model)
    const mockEmbedding = new Array(768).fill(0).map((_, i) => Math.sin(i * 0.1));

    // Update with embedding
    await store.updateNodeEmbedding(
      node.id,
      mockEmbedding,
      'test-model',
      node.contentHash
    );

    console.log('\nUpdated node with embedding:', node.id);

    // Verify embedding was stored
    const embedding = await store.getEmbedding(node.id);
    expect(embedding).toBeDefined();
    expect(embedding?.length).toBe(768);

    // Search by embedding (should find our node)
    const results = await store.searchByEmbedding(mockEmbedding, {
      limit: 10,
      threshold: 0.5,
      bookId: testBookId,
    });

    console.log('\nEmbedding search results:', results.length);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].node.id).toBe(node.id);
    expect(results[0].score).toBeGreaterThan(0.9); // Should be very similar to itself

    await closeBooksStore();
  });

  it('searches by keyword (full-text)', async () => {
    const { initBooksStore, closeBooksStore, getBooksStore } = await import('./books-postgres-store.js');

    await initBooksStore({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_books',
      user: 'tem',
      maxConnections: 5,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
      embeddingDimension: 768,
    });

    const store = getBooksStore()!;

    // Search by keyword
    const results = await store.searchByKeyword('consciousness', {
      limit: 10,
      bookId: testBookId,
    });

    console.log('\nKeyword search results:', results.length);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].node.text).toContain('consciousness');

    await closeBooksStore();
  });

  it('gets nodes without embeddings', async () => {
    const { initBooksStore, closeBooksStore, getBooksStore } = await import('./books-postgres-store.js');

    await initBooksStore({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_books',
      user: 'tem',
      maxConnections: 5,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
      embeddingDimension: 768,
    });

    const store = getBooksStore()!;

    // Create a node without embedding
    const node = await store.createNode({
      bookId: testBookId,
      text: 'This node has no embedding yet.',
      format: 'text',
      position: 2,
      hierarchyLevel: 0,
    });

    // Get nodes without embeddings
    const nodesWithoutEmbeddings = await store.getNodesWithoutEmbeddings(testBookId);

    console.log('\nNodes without embeddings:', nodesWithoutEmbeddings.length);

    expect(nodesWithoutEmbeddings.length).toBeGreaterThan(0);
    expect(nodesWithoutEmbeddings.some(n => n.id === node.id)).toBe(true);

    await closeBooksStore();
  });

  it('counts nodes by hierarchy level', async () => {
    const { initBooksStore, closeBooksStore, getBooksStore } = await import('./books-postgres-store.js');

    await initBooksStore({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_books',
      user: 'tem',
      maxConnections: 5,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
      embeddingDimension: 768,
    });

    const store = getBooksStore()!;

    // Create apex node
    await store.createNode({
      bookId: testBookId,
      text: 'This is the book summary (apex level).',
      format: 'markdown',
      position: 0,
      hierarchyLevel: 2, // Apex
    });

    // Count by level
    const counts = await store.countNodesByLevel(testBookId);

    console.log('\nNode counts by level:', counts);

    expect(counts[0]).toBeGreaterThan(0); // L0 nodes
    expect(counts[2]).toBeGreaterThan(0); // Apex nodes

    await closeBooksStore();
  });
});

describe.skipIf(!runWithDb)('Unified Search Integration', () => {
  let testBookId: string;

  beforeAll(async () => {
    testBookId = crypto.randomUUID();
  });

  afterAll(async () => {
    // Cleanup handled by other tests
  });

  it('searches across archive and books via UnifiedStore', async () => {
    const { initContentStore, closeContentStore, getContentStore } = await import('./postgres-content-store.js');
    const { initBooksStore, closeBooksStore, getBooksStore } = await import('./books-postgres-store.js');
    const { UnifiedStore } = await import('../agentic-search/unified-store.js');

    // Initialize archive store
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

    // Initialize books store
    await initBooksStore({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_books',
      user: 'tem',
      maxConnections: 5,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
      embeddingDimension: 768,
    });

    const archiveStore = getContentStore();
    const booksStore = getBooksStore()!;

    // Create UnifiedStore with both
    const unifiedStore = new UnifiedStore(archiveStore, booksStore);

    expect(unifiedStore.hasBooksStore()).toBe(true);

    console.log('\nUnifiedStore created with archive + books');

    // Get archive store for reference
    expect(unifiedStore.getArchiveStore()).toBe(archiveStore);
    expect(unifiedStore.getBooksStore()).toBe(booksStore);

    await closeContentStore();
    await closeBooksStore();
  });
});
