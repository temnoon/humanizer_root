/**
 * Query DALL-E and described images from ChatGPT conversations
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';

async function queryDalleImages() {
  const store = new PostgresContentStore({
    enableVec: true,
    enableFTS: true,
  });
  await store.initialize();

  const pool = (store as any).pool;
  if (!pool) {
    console.log('No database pool available');
    await store.close();
    return;
  }

  console.log('=' .repeat(70));
  console.log('DALL-E & DESCRIBED IMAGES IN CHATGPT');
  console.log('=' .repeat(70));

  // Find messages that mention DALL-E, images, or have image-related content
  console.log('\n--- DALL-E / IMAGE DESCRIPTIONS ---\n');

  const result = await pool.query(`
    SELECT
      id, text, source_type, media_refs, created_at
    FROM content_nodes
    WHERE source_type LIKE '%chatgpt%'
      AND (
        text ILIKE '%dall%'
        OR text ILIKE '%here is%image%'
        OR text ILIKE '%generated%image%'
        OR text ILIKE '%illustration%'
        OR text ILIKE '%I''ve created%'
        OR text ILIKE '%I created%'
        OR (media_refs::text LIKE '%dalle%' OR media_refs::text LIKE '%image%')
      )
    ORDER BY created_at DESC
    LIMIT 20
  `);

  console.log(`Found ${result.rows.length} messages with DALL-E/image content:\n`);

  for (const row of result.rows) {
    console.log(`[${row.source_type}] ${row.id.slice(0, 8)}...`);
    const text = (row.text || '').substring(0, 400).replace(/\n/g, ' ');
    console.log(`  ${text}...`);

    if (row.media_refs) {
      const refs = typeof row.media_refs === 'string' ? JSON.parse(row.media_refs) : row.media_refs;
      if (refs && refs.length > 0) {
        console.log(`  Media: ${JSON.stringify(refs).substring(0, 150)}`);
      }
    }
    console.log();
  }

  // Find notebook/journal mentions
  console.log('\n--- NOTEBOOK / JOURNAL PAGES ---\n');

  const notebookResult = await pool.query(`
    SELECT
      id, text, source_type, media_refs
    FROM content_nodes
    WHERE source_type LIKE '%chatgpt%'
      AND (
        text ILIKE '%notebook%'
        OR text ILIKE '%journal%'
        OR text ILIKE '%handwritten%'
        OR text ILIKE '%transcribe%'
        OR text ILIKE '%OCR%'
      )
    ORDER BY created_at DESC
    LIMIT 10
  `);

  console.log(`Found ${notebookResult.rows.length} messages about notebooks/journals:\n`);

  for (const row of notebookResult.rows) {
    console.log(`[${row.source_type}] ${row.id.slice(0, 8)}...`);
    const text = (row.text || '').substring(0, 400).replace(/\n/g, ' ');
    console.log(`  ${text}...`);
    console.log();
  }

  await store.close();
}

queryDalleImages().catch(console.error);
