/**
 * Query books and images with descriptions from the archive
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';

async function queryBooksAndImages() {
  const store = new PostgresContentStore({
    enableVec: true,
    enableFTS: true,
  });
  await store.initialize();

  console.log('=' .repeat(70));
  console.log('BOOKS & IMAGES IN ARCHIVE');
  console.log('=' .repeat(70));

  // Check if pool is available
  const pool = (store as any).pool;
  if (!pool) {
    console.log('No database pool available');
    await store.close();
    return;
  }

  // 1. Check for books
  console.log('\n--- BOOKS ---\n');
  try {
    const booksResult = await pool.query(`
      SELECT id, title, description, status, arc, created_at
      FROM aui_books
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (booksResult.rows.length === 0) {
      console.log('No books found in aui_books table');
    } else {
      console.log(`Found ${booksResult.rows.length} books:\n`);
      for (const book of booksResult.rows) {
        console.log(`[${book.status}] ${book.title}`);
        if (book.description) {
          console.log(`  Description: ${book.description.substring(0, 100)}...`);
        }
        console.log(`  Arc: ${book.arc || 'none'}`);
        console.log(`  Created: ${book.created_at}`);
        console.log();
      }
    }
  } catch (err: any) {
    if (err.code === '42P01') {
      console.log('aui_books table does not exist');
    } else {
      console.log('Error querying books:', err.message);
    }
  }

  // 2. Check for media text associations (OCR, descriptions)
  console.log('\n--- MEDIA TEXT ASSOCIATIONS ---\n');
  try {
    const statsResult = await pool.query(`
      SELECT
        association_type,
        extraction_method,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence
      FROM media_text_associations
      GROUP BY association_type, extraction_method
      ORDER BY count DESC
    `);

    if (statsResult.rows.length === 0) {
      console.log('No media text associations found');
    } else {
      console.log('Media Text Statistics:\n');
      for (const row of statsResult.rows) {
        console.log(`  ${row.association_type} (${row.extraction_method || 'generic'}): ${row.count} items, avg confidence: ${parseFloat(row.avg_confidence || 0).toFixed(2)}`);
      }
    }
  } catch (err: any) {
    if (err.code === '42P01') {
      console.log('media_text_associations table does not exist');
    } else {
      console.log('Error querying media stats:', err.message);
    }
  }

  // 3. Sample OCR transcriptions
  console.log('\n--- SAMPLE OCR TRANSCRIPTIONS ---\n');
  try {
    const ocrResult = await pool.query(`
      SELECT
        id, media_id, extracted_text, confidence, extraction_method, gizmo_id
      FROM media_text_associations
      WHERE association_type = 'ocr'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (ocrResult.rows.length === 0) {
      console.log('No OCR transcriptions found');
    } else {
      console.log(`Found ${ocrResult.rows.length} OCR transcriptions:\n`);
      for (const row of ocrResult.rows) {
        console.log(`[${row.extraction_method || 'generic'}] Confidence: ${parseFloat(row.confidence || 0).toFixed(2)}`);
        console.log(`  Media: ${row.media_id}`);
        const preview = (row.extracted_text || '').substring(0, 300).replace(/\n/g, ' ');
        console.log(`  Text: ${preview}...`);
        console.log();
      }
    }
  } catch (err: any) {
    console.log('Error querying OCR:', err.message);
  }

  // 4. Sample image descriptions
  console.log('\n--- SAMPLE IMAGE DESCRIPTIONS ---\n');
  try {
    const descResult = await pool.query(`
      SELECT
        id, media_id, extracted_text, confidence, gizmo_id
      FROM media_text_associations
      WHERE association_type = 'description'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (descResult.rows.length === 0) {
      console.log('No image descriptions found');
    } else {
      console.log(`Found ${descResult.rows.length} image descriptions:\n`);
      for (const row of descResult.rows) {
        console.log(`  Media: ${row.media_id}`);
        const preview = (row.extracted_text || '').substring(0, 300).replace(/\n/g, ' ');
        console.log(`  Description: ${preview}...`);
        console.log();
      }
    }
  } catch (err: any) {
    console.log('Error querying descriptions:', err.message);
  }

  // 5. Count nodes with media references
  console.log('\n--- NODES WITH MEDIA REFERENCES ---\n');
  try {
    const mediaNodesResult = await pool.query(`
      SELECT
        source_type,
        COUNT(*) as total,
        COUNT(CASE WHEN media_refs IS NOT NULL AND media_refs != '[]' THEN 1 END) as with_media
      FROM content_nodes
      GROUP BY source_type
      HAVING COUNT(CASE WHEN media_refs IS NOT NULL AND media_refs != '[]' THEN 1 END) > 0
      ORDER BY with_media DESC
    `);

    if (mediaNodesResult.rows.length === 0) {
      console.log('No nodes with media references found');
    } else {
      console.log('Nodes with media references by source:\n');
      for (const row of mediaNodesResult.rows) {
        console.log(`  ${row.source_type}: ${row.with_media} nodes with media (of ${row.total} total)`);
      }
    }
  } catch (err: any) {
    console.log('Error querying media nodes:', err.message);
  }

  // 6. Sample nodes with images (DALL-E generations, etc.)
  console.log('\n--- SAMPLE NODES WITH IMAGES ---\n');
  try {
    const imageNodesResult = await pool.query(`
      SELECT
        id, source_type, text, media_refs
      FROM content_nodes
      WHERE media_refs IS NOT NULL
        AND media_refs != '[]'
        AND (media_refs::text LIKE '%dalle%' OR media_refs::text LIKE '%image%' OR media_refs::text LIKE '%file-%')
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (imageNodesResult.rows.length === 0) {
      console.log('No nodes with image references found');
    } else {
      console.log(`Found ${imageNodesResult.rows.length} nodes with images:\n`);
      for (const row of imageNodesResult.rows) {
        console.log(`[${row.source_type}] ${row.id.slice(0, 8)}...`);
        const preview = (row.text || '').substring(0, 200).replace(/\n/g, ' ');
        console.log(`  Text: ${preview}...`);
        const mediaRefs = typeof row.media_refs === 'string' ? JSON.parse(row.media_refs) : row.media_refs;
        console.log(`  Media refs: ${JSON.stringify(mediaRefs).substring(0, 200)}`);
        console.log();
      }
    }
  } catch (err: any) {
    console.log('Error querying image nodes:', err.message);
  }

  await store.close();
}

queryBooksAndImages().catch(console.error);
