/**
 * Migrate Pattern Tables
 *
 * Adds the pattern discovery tables to an existing database.
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import {
  createAuiPatternsTable,
  createAuiDiscoveredPatternsTable,
  CREATE_AUI_PATTERN_FEEDBACK_TABLE,
  CREATE_AUI_PATTERN_CONSTRAINTS_TABLE,
  CREATE_AUI_INDEXES,
  CREATE_AUI_PATTERNS_VECTOR_INDEX,
  CREATE_AUI_DISCOVERED_PATTERNS_VECTOR_INDEX,
} from '../src/storage/schema-aui.js';

async function migratePatternTables() {
  console.log('═'.repeat(70));
  console.log(' PATTERN TABLES MIGRATION');
  console.log('═'.repeat(70));

  const store = new PostgresContentStore({
    enableVec: true,
    enableFTS: true,
  });
  await store.initialize();

  const pool = store.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('\n  Creating aui_patterns table...');
    await client.query(createAuiPatternsTable(768));
    console.log('  ✓ aui_patterns created');

    console.log('  Creating aui_pattern_feedback table...');
    await client.query(CREATE_AUI_PATTERN_FEEDBACK_TABLE);
    console.log('  ✓ aui_pattern_feedback created');

    console.log('  Creating aui_pattern_constraints table...');
    await client.query(CREATE_AUI_PATTERN_CONSTRAINTS_TABLE);
    console.log('  ✓ aui_pattern_constraints created');

    console.log('  Creating aui_discovered_patterns table...');
    await client.query(createAuiDiscoveredPatternsTable(768));
    console.log('  ✓ aui_discovered_patterns created');

    console.log('\n  Creating indexes...');
    // Extract pattern-specific indexes from CREATE_AUI_INDEXES
    const patternIndexes = `
      CREATE INDEX IF NOT EXISTS idx_aui_patterns_user ON aui_patterns(user_id);
      CREATE INDEX IF NOT EXISTS idx_aui_patterns_name ON aui_patterns(user_id, name);
      CREATE INDEX IF NOT EXISTS idx_aui_patterns_status ON aui_patterns(status);
      CREATE INDEX IF NOT EXISTS idx_aui_patterns_tags ON aui_patterns USING gin(tags);
      CREATE INDEX IF NOT EXISTS idx_aui_patterns_updated ON aui_patterns(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_aui_patterns_last_used ON aui_patterns(last_used_at DESC NULLS LAST);
      CREATE INDEX IF NOT EXISTS idx_aui_pattern_feedback_pattern ON aui_pattern_feedback(pattern_id);
      CREATE INDEX IF NOT EXISTS idx_aui_pattern_feedback_content ON aui_pattern_feedback(content_id);
      CREATE INDEX IF NOT EXISTS idx_aui_pattern_feedback_judgment ON aui_pattern_feedback(pattern_id, judgment);
      CREATE INDEX IF NOT EXISTS idx_aui_pattern_feedback_created ON aui_pattern_feedback(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_aui_pattern_constraints_pattern ON aui_pattern_constraints(pattern_id);
      CREATE INDEX IF NOT EXISTS idx_aui_pattern_constraints_type ON aui_pattern_constraints(constraint_type);
      CREATE INDEX IF NOT EXISTS idx_aui_pattern_constraints_active ON aui_pattern_constraints(pattern_id, is_active) WHERE is_active = TRUE;
      CREATE INDEX IF NOT EXISTS idx_aui_pattern_constraints_created ON aui_pattern_constraints(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_aui_discovered_patterns_user ON aui_discovered_patterns(user_id);
      CREATE INDEX IF NOT EXISTS idx_aui_discovered_patterns_status ON aui_discovered_patterns(status);
      CREATE INDEX IF NOT EXISTS idx_aui_discovered_patterns_method ON aui_discovered_patterns(discovery_method);
      CREATE INDEX IF NOT EXISTS idx_aui_discovered_patterns_expires ON aui_discovered_patterns(expires_at);
      CREATE INDEX IF NOT EXISTS idx_aui_discovered_patterns_created ON aui_discovered_patterns(created_at DESC);
    `;
    await client.query(patternIndexes);
    console.log('  ✓ Indexes created');

    console.log('\n  Creating vector indexes...');
    try {
      await client.query(CREATE_AUI_PATTERNS_VECTOR_INDEX);
      console.log('  ✓ Pattern centroid HNSW index created');
    } catch (err) {
      console.log('  ⚠ Could not create pattern vector index:', (err as Error).message);
    }

    try {
      await client.query(CREATE_AUI_DISCOVERED_PATTERNS_VECTOR_INDEX);
      console.log('  ✓ Discovered pattern centroid HNSW index created');
    } catch (err) {
      console.log('  ⚠ Could not create discovered pattern vector index:', (err as Error).message);
    }

    await client.query('COMMIT');

    // Verify tables
    const tableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'aui_pattern%'
      ORDER BY table_name
    `);
    console.log('\n  Tables created:');
    for (const row of tableCheck.rows) {
      console.log(`    - ${row.table_name}`);
    }

    console.log('\n' + '═'.repeat(70));
    console.log(' MIGRATION COMPLETE');
    console.log('═'.repeat(70));

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await store.close();
  }
}

migratePatternTables().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
