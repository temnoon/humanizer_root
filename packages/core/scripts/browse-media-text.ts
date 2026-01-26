/**
 * Browse Media-Text Associations
 *
 * Interactive viewer for images with their OCR transcripts, descriptions, and captions.
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';

async function browseMediaText() {
  const store = new PostgresContentStore({
    enableVec: true,
    enableFTS: true,
  });
  await store.initialize();

  const pool = store.getPool();

  console.log('═'.repeat(70));
  console.log(' MEDIA-TEXT BROWSER');
  console.log('═'.repeat(70));

  // ─────────────────────────────────────────────────────────────────
  // DALL-E Generated Images with Descriptions
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ DALL-E GENERATED IMAGES WITH DESCRIPTIONS                           │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const dalleResult = await pool.query(`
    SELECT
      mta.media_id,
      mta.extracted_text,
      mta.extraction_method,
      mta.confidence,
      mta.source_created_at,
      cn.text as full_message
    FROM media_text_associations mta
    LEFT JOIN content_nodes cn ON mta.message_id = cn.id::text
    WHERE mta.extraction_method IN ('user-caption-heuristic', 'description-heuristic')
      AND mta.media_id LIKE '%file-service%'
      AND mta.extracted_text NOT LIKE '{%'
    ORDER BY mta.source_created_at DESC NULLS LAST
    LIMIT 10
  `);

  for (const row of dalleResult.rows) {
    const mediaId = row.media_id.replace('file-service://file-', 'file-');
    const date = row.source_created_at ? new Date(parseInt(row.source_created_at)).toLocaleDateString() : 'Unknown';

    console.log(`📸 ${mediaId}`);
    console.log(`   Date: ${date} | Method: ${row.extraction_method} | Confidence: ${(row.confidence * 100).toFixed(0)}%`);

    const text = (row.extracted_text || '').substring(0, 500).replace(/\n/g, '\n   ');
    console.log(`   "${text}${row.extracted_text?.length > 500 ? '...' : ''}"`);
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────
  // Voice Mode Screenshots with Transcripts
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ VOICE MODE SCREENSHOTS WITH TRANSCRIPTS                             │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const voiceResult = await pool.query(`
    SELECT
      mta.media_id,
      mta.extracted_text,
      mta.confidence,
      mta.source_created_at
    FROM media_text_associations mta
    WHERE mta.extraction_method = 'voice-mode-transcript'
    ORDER BY mta.source_created_at DESC NULLS LAST
    LIMIT 10
  `);

  for (const row of voiceResult.rows) {
    const mediaId = row.media_id.replace('sediment://file_', 'sediment-');
    const date = row.source_created_at ? new Date(parseInt(row.source_created_at)).toLocaleDateString() : 'Unknown';

    console.log(`🎙️ ${mediaId}`);
    console.log(`   Date: ${date}`);

    const text = (row.extracted_text || '').substring(0, 400).replace(/\n/g, '\n   ');
    console.log(`   "${text}${row.extracted_text?.length > 400 ? '...' : ''}"`);
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────
  // OCR Transcriptions (Notebook Pages, etc.)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ OCR TRANSCRIPTIONS                                                  │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const ocrResult = await pool.query(`
    SELECT
      mta.media_id,
      mta.extracted_text,
      mta.confidence,
      mta.gizmo_id,
      mta.source_created_at
    FROM media_text_associations mta
    WHERE mta.association_type = 'ocr'
    ORDER BY mta.source_created_at DESC NULLS LAST
    LIMIT 10
  `);

  if (ocrResult.rows.length === 0) {
    console.log('  No OCR transcriptions found.\n');
    console.log('  Note: OCR is typically performed by specific Custom GPTs like:');
    console.log('  - Journal Recognizer OCR (g-T7bW2qVzx)');
    console.log('  - Image Echo & Bounce (g-FmQp1Tm1G)');
  } else {
    for (const row of ocrResult.rows) {
      const mediaId = row.media_id.replace('file-service://file-', 'file-').replace('sediment://file_', 'sediment-');
      const date = row.source_created_at ? new Date(parseInt(row.source_created_at)).toLocaleDateString() : 'Unknown';

      console.log(`📝 ${mediaId}`);
      console.log(`   Date: ${date} | Confidence: ${(row.confidence * 100).toFixed(0)}%`);
      if (row.gizmo_id) {
        console.log(`   Custom GPT: ${row.gizmo_id}`);
      }

      // Clean up code block markers for display
      let text = (row.extracted_text || '').substring(0, 600);
      text = text.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
      text = text.replace(/\n/g, '\n   ');
      console.log(`   "${text}${row.extracted_text?.length > 600 ? '...' : ''}"`);
      console.log();
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Summary Statistics
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ SUMMARY                                                             │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const statsResult = await pool.query(`
    SELECT
      extraction_method,
      COUNT(*) as count,
      AVG(confidence) as avg_confidence,
      COUNT(DISTINCT media_id) as unique_media
    FROM media_text_associations
    GROUP BY extraction_method
    ORDER BY count DESC
  `);

  console.log('  Method                        | Count | Avg Conf | Unique Media');
  console.log('  ' + '-'.repeat(60));

  for (const row of statsResult.rows) {
    const method = (row.extraction_method || 'unknown').padEnd(28);
    const count = String(row.count).padStart(5);
    const conf = ((parseFloat(row.avg_confidence) || 0) * 100).toFixed(0).padStart(6) + '%';
    const unique = String(row.unique_media).padStart(12);
    console.log(`  ${method} | ${count} | ${conf} | ${unique}`);
  }

  console.log();
  await store.close();
}

browseMediaText().catch(console.error);
