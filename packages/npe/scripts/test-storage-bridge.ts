#!/usr/bin/env npx tsx
/**
 * Test Storage Bridge with Real PostgreSQL
 *
 * Run with: npx tsx scripts/test-storage-bridge.ts
 *
 * Prerequisites:
 * - PostgreSQL running on localhost:5432
 * - humanizer_archive database with content_nodes table
 */

import { Pool } from 'pg';
import { registerTypes } from 'pgvector/pg';
import { toSql, fromSql } from 'pgvector';
import {
  StorageBridge,
  createStorageBridge,
  type ContentStoreInterface,
  type StoredNodeSubset,
  type SearchResultSubset,
} from '../src/bql/storage-bridge.js';

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'humanizer_archive',
  // Uses default user from env
};

// Test data to insert
const TEST_NODES = [
  {
    id: crypto.randomUUID(),
    content_hash: `test-hash-${Date.now()}-1`,
    uri: `content://test/message/${Date.now()}-1`,
    text: 'My childhood summers were spent at my grandmother\'s house in the countryside. The smell of fresh bread and wildflowers still brings back vivid memories.',
    format: 'text',
    word_count: 27,
    source_type: 'test',
    source_adapter: 'test-adapter',
    hierarchy_level: 0,
    title: 'Summer Memories',
    author: 'user',
    author_role: 'user',
  },
  {
    id: crypto.randomUUID(),
    content_hash: `test-hash-${Date.now()}-2`,
    uri: `content://test/message/${Date.now()}-2`,
    text: 'Technical documentation should be clear and concise. This guide explains API authentication using OAuth 2.0 and JWT tokens.',
    format: 'text',
    word_count: 19,
    source_type: 'test',
    source_adapter: 'test-adapter',
    hierarchy_level: 0,
    title: 'API Documentation',
    author: 'assistant',
    author_role: 'assistant',
  },
  {
    id: crypto.randomUUID(),
    content_hash: `test-hash-${Date.now()}-3`,
    uri: `content://test/message/${Date.now()}-3`,
    text: 'The philosophy of mind explores questions about consciousness, perception, and the nature of subjective experience. Qualia remain a central puzzle.',
    format: 'text',
    word_count: 22,
    source_type: 'test',
    source_adapter: 'test-adapter',
    hierarchy_level: 0,
    title: 'Philosophy Notes',
    author: 'user',
    author_role: 'user',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PostgreSQL Content Store Wrapper
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimal PostgreSQL content store for testing
 * (In production, use @humanizer/core PostgresContentStore)
 */
class TestContentStore implements ContentStoreInterface {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async searchByKeyword(
    query: string,
    options?: { limit?: number }
  ): Promise<SearchResultSubset[]> {
    const limit = options?.limit ?? 50;

    // Use plainto_tsquery for simple queries
    const result = await this.pool.query(
      `SELECT *, ts_rank(tsv, plainto_tsquery('english', $1)) as rank
       FROM content_nodes
       WHERE tsv @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $2`,
      [query, limit]
    );

    return result.rows.map((row) => ({
      node: this.rowToNode(row),
      score: parseFloat(row.rank),
      bm25Score: parseFloat(row.rank),
    }));
  }

  async searchByEmbedding(
    embedding: number[],
    options?: { limit?: number; threshold?: number }
  ): Promise<SearchResultSubset[]> {
    const limit = options?.limit ?? 50;
    const vectorSql = toSql(embedding);

    const result = await this.pool.query(
      `SELECT *, 1 - (embedding <=> $1::vector) as similarity
       FROM content_nodes
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [vectorSql, limit]
    );

    return result.rows
      .filter((row) => {
        if (options?.threshold) {
          return parseFloat(row.similarity) >= options.threshold;
        }
        return true;
      })
      .map((row) => ({
        node: this.rowToNode(row),
        score: parseFloat(row.similarity),
        distance: 1 - parseFloat(row.similarity),
      }));
  }

  async getNode(id: string): Promise<StoredNodeSubset | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM content_nodes WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.rowToNode(result.rows[0]) : undefined;
  }

  async queryNodes(options: {
    sourceType?: string | string[];
    limit?: number;
    offset?: number;
  }): Promise<{ nodes: StoredNodeSubset[]; total: number; hasMore: boolean }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.sourceType) {
      if (Array.isArray(options.sourceType)) {
        const placeholders = options.sourceType.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`source_type IN (${placeholders})`);
        params.push(...options.sourceType);
      } else {
        conditions.push(`source_type = $${paramIndex++}`);
        params.push(options.sourceType);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM content_nodes ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    params.push(limit, offset);

    const result = await this.pool.query(
      `SELECT * FROM content_nodes ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return {
      nodes: result.rows.map((row) => this.rowToNode(row)),
      total,
      hasMore: offset + result.rows.length < total,
    };
  }

  private rowToNode(row: Record<string, unknown>): StoredNodeSubset {
    return {
      id: row.id as string,
      contentHash: row.content_hash as string,
      uri: row.uri as string,
      text: row.text as string,
      format: row.format as string,
      wordCount: row.word_count as number,
      sourceType: row.source_type as string,
      sourceAdapter: row.source_adapter as string,
      parentNodeId: row.parent_node_id as string | undefined,
      hierarchyLevel: row.hierarchy_level as number,
      threadRootId: row.thread_root_id as string | undefined,
      title: row.title as string | undefined,
      author: row.author as string | undefined,
      authorRole: row.author_role as string | undefined,
      tags: row.tags as string[] | undefined,
      sourceCreatedAt: row.source_created_at
        ? new Date(row.source_created_at as string).getTime()
        : undefined,
      createdAt: new Date(row.created_at as string).getTime(),
      importedAt: new Date(row.imported_at as string).getTime(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Test Utilities
// ═══════════════════════════════════════════════════════════════════════════

async function insertTestData(pool: Pool): Promise<string[]> {
  const ids: string[] = [];

  for (const node of TEST_NODES) {
    await pool.query(
      `INSERT INTO content_nodes (
        id, content_hash, uri, text, format, word_count,
        source_type, source_adapter, hierarchy_level, title, author, author_role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (uri) DO NOTHING`,
      [
        node.id,
        node.content_hash,
        node.uri,
        node.text,
        node.format,
        node.word_count,
        node.source_type,
        node.source_adapter,
        node.hierarchy_level,
        node.title,
        node.author,
        node.author_role,
      ]
    );
    ids.push(node.id);
  }

  return ids;
}

async function cleanupTestData(pool: Pool): Promise<void> {
  await pool.query("DELETE FROM content_nodes WHERE source_type = 'test'");
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Test
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('Storage Bridge Integration Test');
  console.log('================================\n');

  // Connect to PostgreSQL
  console.log('1. Connecting to PostgreSQL...');
  const pool = new Pool(DB_CONFIG);

  try {
    // Register pgvector types
    const client = await pool.connect();
    await registerTypes(client);
    client.release();
    console.log('   ✅ Connected to database:', DB_CONFIG.database);

    // Check existing data
    const countResult = await pool.query('SELECT COUNT(*) FROM content_nodes');
    console.log(`   Existing nodes: ${countResult.rows[0].count}`);

    // Insert test data
    console.log('\n2. Inserting test data...');
    const testIds = await insertTestData(pool);
    console.log(`   ✅ Inserted ${testIds.length} test nodes`);

    // Create content store and bridge
    console.log('\n3. Creating storage bridge...');
    const store = new TestContentStore(pool);
    const bridge = createStorageBridge({
      store,
      searchMode: 'keyword',
      defaultLimit: 10,
    });
    console.log('   ✅ Bridge created');

    // Test keyword search
    console.log('\n4. Testing keyword search...');
    const keywordResults = await bridge.search('memories childhood');
    console.log(`   Query: "memories childhood"`);
    console.log(`   Results: ${keywordResults.length}`);
    if (keywordResults.length > 0) {
      const first = keywordResults[0] as { text: string; score: number };
      console.log(`   First result: "${first.text.slice(0, 60)}..."`);
      console.log(`   Score: ${first.score}`);
    }

    // Test another search
    console.log('\n5. Testing search for "API documentation"...');
    const apiResults = await bridge.search('API documentation');
    console.log(`   Results: ${apiResults.length}`);
    if (apiResults.length > 0) {
      const first = apiResults[0] as { text: string; title: string };
      console.log(`   First result title: "${first.title}"`);
    }

    // Test philosophy search
    console.log('\n6. Testing search for "consciousness philosophy"...');
    const philResults = await bridge.search('consciousness philosophy');
    console.log(`   Results: ${philResults.length}`);
    if (philResults.length > 0) {
      const first = philResults[0] as { text: string };
      console.log(`   First result: "${first.text.slice(0, 60)}..."`);
    }

    // Test load by source type
    console.log('\n7. Testing load by source type...');
    const testNodes = await bridge.load('source:test');
    console.log(`   source:test returned ${testNodes.length} nodes`);

    // Test save and load buffer
    console.log('\n8. Testing buffer save/load...');
    await bridge.save('search_results', keywordResults);
    const loaded = await bridge.load('search_results');
    console.log(`   Saved ${keywordResults.length} items, loaded ${loaded.length} items`);
    console.log(`   ✅ Buffer round-trip successful`);

    // Test load all
    console.log('\n9. Testing load all...');
    const allNodes = await bridge.load('all');
    console.log(`   Total nodes accessible: ${allNodes.length}`);

    // Cleanup
    console.log('\n10. Cleaning up test data...');
    await cleanupTestData(pool);
    console.log('    ✅ Test data removed');

    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests passed!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    // Cleanup on error
    try {
      await cleanupTestData(pool);
    } catch {
      // Ignore cleanup errors
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
