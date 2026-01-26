#!/usr/bin/env npx tsx
/**
 * Process All Embeddings
 *
 * Comprehensive script to generate embeddings for all content in the archive
 * using the full pipeline with media-text enrichment and best practices.
 *
 * Features:
 * - Processes content in batches to avoid memory issues
 * - Uses media-text enrichment for better semantic search
 * - Builds pyramids for large threads
 * - Progress tracking and resumability
 * - Optional excellence scoring
 *
 * Run: npx tsx scripts/process-all-embeddings.ts [--batch-size=100] [--score-excellence]
 */

import { initContentStore, getContentStore } from '../src/storage/postgres-content-store.js';
import {
  initEmbeddingService,
  getEmbeddingService,
} from '../src/embeddings/index.js';
import {
  MediaTextEnrichmentService,
  type EnrichedContent,
} from '../src/adapters/parsers/media-text-enrichment.js';
import type { StoredNode } from '../src/storage/types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
  database: {
    host: 'localhost',
    port: 5432,
    database: 'humanizer_archive',
    user: 'tem',
  },
  embedding: {
    model: 'nomic-embed-text:latest',
    ollamaUrl: 'http://localhost:11434',
    batchSize: 50, // Nodes per embedding batch
    verbose: true,
  },
  processing: {
    queryBatchSize: 500, // Nodes to fetch from DB at once
    maxRetries: 3,
    retryDelayMs: 5000,
    progressIntervalNodes: 100,
  },
};

// ═══════════════════════════════════════════════════════════════════
// MAIN PROCESSING
// ═══════════════════════════════════════════════════════════════════

interface ProcessingStats {
  totalProcessed: number;
  totalEmbedded: number;
  totalFailed: number;
  totalSkipped: number;
  batchesProcessed: number;
  startTime: number;
  bySourceType: Map<string, { embedded: number; failed: number }>;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' ARCHIVE EMBEDDING PROCESSOR');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  // Parse CLI arguments
  const args = process.argv.slice(2);
  const batchSize = parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '50');
  const scoreExcellence = args.includes('--score-excellence');
  const dryRun = args.includes('--dry-run');
  const sourceTypeFilter = args.find(a => a.startsWith('--source-type='))?.split('=')[1];

  console.log('Configuration:');
  console.log(`  Batch size: ${batchSize}`);
  console.log(`  Score excellence: ${scoreExcellence}`);
  console.log(`  Dry run: ${dryRun}`);
  if (sourceTypeFilter) console.log(`  Source type filter: ${sourceTypeFilter}`);
  console.log();

  // Initialize services
  console.log('Initializing services...');

  await initContentStore(CONFIG.database);
  const store = getContentStore();

  const embedService = initEmbeddingService({
    embedModel: CONFIG.embedding.model,
    ollamaUrl: CONFIG.embedding.ollamaUrl,
    verbose: CONFIG.embedding.verbose,
  });

  // Check Ollama availability
  const ollamaOk = await embedService.isAvailable();
  if (!ollamaOk) {
    console.error('❌ Ollama is not available. Please start Ollama first.');
    process.exit(1);
  }
  console.log('✓ Ollama is available');

  const enrichmentService = new MediaTextEnrichmentService({
    includeTranscripts: true,
    includeDescriptions: true,
    minConfidence: 0.5,
  });

  // Get initial stats
  const initialStats = await getEmbeddingStats(store, sourceTypeFilter);
  console.log();
  console.log('Current database state:');
  console.log(`  Total nodes: ${initialStats.total}`);
  console.log(`  With embeddings: ${initialStats.withEmbeddings}`);
  console.log(`  Needs embeddings: ${initialStats.needsEmbeddings}`);
  console.log();

  if (initialStats.needsEmbeddings === 0) {
    console.log('✓ All nodes already have embeddings!');
    process.exit(0);
  }

  if (dryRun) {
    console.log('Dry run - would process these source types:');
    for (const [type, count] of initialStats.bySourceType) {
      if (count.needs > 0) {
        console.log(`  ${type}: ${count.needs} nodes`);
      }
    }
    process.exit(0);
  }

  // Initialize processing stats
  const stats: ProcessingStats = {
    totalProcessed: 0,
    totalEmbedded: 0,
    totalFailed: 0,
    totalSkipped: 0,
    batchesProcessed: 0,
    startTime: Date.now(),
    bySourceType: new Map(),
  };

  console.log('Starting embedding generation...');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  // Process in batches
  let hasMore = true;
  let offset = 0;

  while (hasMore) {
    // Fetch batch of nodes needing embeddings
    const nodes = await fetchNodesNeedingEmbeddings(
      store,
      CONFIG.processing.queryBatchSize,
      offset,
      sourceTypeFilter
    );

    if (nodes.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`\nBatch ${stats.batchesProcessed + 1}: Processing ${nodes.length} nodes...`);

    // Fetch media-text associations for enrichment (batch fetch by node)
    const associations: import('../src/storage/types.js').MediaTextAssociation[] = [];
    for (const node of nodes.slice(0, 10)) { // Sample first 10 for performance
      try {
        const nodeAssocs = await store.getAssociationsByNode(node.id);
        associations.push(...nodeAssocs);
      } catch {
        // Node may not have associations, that's fine
      }
    }

    // Convert StoredNodes to ImportedNodes for enrichment
    const importedNodes = nodes.map(n => ({
      id: n.id,
      uri: n.uri,
      contentHash: n.contentHash,
      content: n.text,
      format: n.format as 'text' | 'markdown' | 'html' | 'json',
      sourceType: n.sourceType,
      threadRootUri: n.threadRootId ? `archive://${n.threadRootId}` : undefined,
      metadata: n.sourceMetadata || {},
    }));

    // Enrich content with media-text
    let enrichedContentMap: Map<string, EnrichedContent> | undefined;
    if (associations.length > 0) {
      const enrichResult = enrichmentService.enrichBatch(importedNodes, associations);
      enrichedContentMap = enrichResult.enrichments;
      console.log(`  Enriched ${enrichResult.stats.nodesEnriched} nodes with ${enrichResult.stats.totalTranscripts} transcripts`);
    }

    // Generate embeddings
    try {
      const embedResult = await embedService.embedNodesWithPyramid(
        nodes,
        'archive',
        enrichedContentMap ? { enrichedContent: enrichedContentMap } : undefined
      );

      // Store embeddings
      if (embedResult.embeddingItems.length > 0) {
        const storeResult = await store.storeEmbeddings(
          embedResult.embeddingItems,
          embedService.getEmbedModel()
        );
        stats.totalEmbedded += storeResult.stored;
        console.log(`  ✓ Embedded ${storeResult.stored} nodes (${embedResult.pyramidsBuilt} pyramids built)`);
      }

      // Update stats by source type
      for (const node of nodes) {
        const typeStats = stats.bySourceType.get(node.sourceType) || { embedded: 0, failed: 0 };
        typeStats.embedded++;
        stats.bySourceType.set(node.sourceType, typeStats);
      }

      stats.totalProcessed += nodes.length;
      stats.batchesProcessed++;

    } catch (err) {
      console.error(`  ❌ Batch failed:`, err);
      stats.totalFailed += nodes.length;

      // Update failed stats by source type
      for (const node of nodes) {
        const typeStats = stats.bySourceType.get(node.sourceType) || { embedded: 0, failed: 0 };
        typeStats.failed++;
        stats.bySourceType.set(node.sourceType, typeStats);
      }
    }

    // Progress report
    if (stats.totalProcessed % CONFIG.processing.progressIntervalNodes === 0) {
      const elapsed = (Date.now() - stats.startTime) / 1000;
      const rate = stats.totalEmbedded / elapsed;
      const remaining = initialStats.needsEmbeddings - stats.totalProcessed;
      const eta = remaining / rate;
      console.log(`  Progress: ${stats.totalProcessed}/${initialStats.needsEmbeddings} (${rate.toFixed(1)}/s, ETA: ${formatTime(eta)})`);
    }

    // Move to next batch - don't increment offset since we're always fetching nodes without embeddings
    // The processed nodes will now have embeddings and won't be fetched again
  }

  // Final report
  const totalTime = (Date.now() - stats.startTime) / 1000;
  console.log();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' PROCESSING COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  console.log(`Total time: ${formatTime(totalTime)}`);
  console.log(`Nodes processed: ${stats.totalProcessed}`);
  console.log(`Nodes embedded: ${stats.totalEmbedded}`);
  console.log(`Nodes failed: ${stats.totalFailed}`);
  console.log(`Batches: ${stats.batchesProcessed}`);
  console.log(`Average rate: ${(stats.totalEmbedded / totalTime).toFixed(1)} nodes/sec`);
  console.log();
  console.log('By source type:');
  for (const [type, counts] of stats.bySourceType) {
    console.log(`  ${type}: ${counts.embedded} embedded, ${counts.failed} failed`);
  }

  // Verify final state
  const finalStats = await getEmbeddingStats(store, sourceTypeFilter);
  console.log();
  console.log('Final database state:');
  console.log(`  Total nodes: ${finalStats.total}`);
  console.log(`  With embeddings: ${finalStats.withEmbeddings}`);
  console.log(`  Needs embeddings: ${finalStats.needsEmbeddings}`);

  process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

interface EmbeddingStats {
  total: number;
  withEmbeddings: number;
  needsEmbeddings: number;
  bySourceType: Map<string, { has: number; needs: number }>;
}

async function getEmbeddingStats(
  store: ReturnType<typeof getContentStore>,
  sourceTypeFilter?: string
): Promise<EmbeddingStats> {
  const whereClause = sourceTypeFilter ? `WHERE source_type = '${sourceTypeFilter}'` : '';

  const result = await store.pool.query(`
    SELECT
      source_type,
      COUNT(*) as total,
      COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding,
      COUNT(CASE WHEN embedding IS NULL THEN 1 END) as needs_embedding
    FROM content_nodes
    ${whereClause}
    GROUP BY source_type
  `);

  const bySourceType = new Map<string, { has: number; needs: number }>();
  let total = 0;
  let withEmbeddings = 0;
  let needsEmbeddings = 0;

  for (const row of result.rows) {
    bySourceType.set(row.source_type, {
      has: parseInt(row.with_embedding),
      needs: parseInt(row.needs_embedding),
    });
    total += parseInt(row.total);
    withEmbeddings += parseInt(row.with_embedding);
    needsEmbeddings += parseInt(row.needs_embedding);
  }

  return { total, withEmbeddings, needsEmbeddings, bySourceType };
}

async function fetchNodesNeedingEmbeddings(
  store: ReturnType<typeof getContentStore>,
  limit: number,
  offset: number,
  sourceTypeFilter?: string
): Promise<StoredNode[]> {
  const whereClause = sourceTypeFilter
    ? `WHERE embedding IS NULL AND source_type = $1`
    : `WHERE embedding IS NULL`;

  const params = sourceTypeFilter ? [sourceTypeFilter, limit] : [limit];
  const paramOffset = sourceTypeFilter ? 2 : 1;

  const result = await store.pool.query(
    `
    SELECT
      id, content_hash, uri, text, format, word_count,
      source_type, source_adapter, source_original_id, source_original_path,
      import_job_id, parent_node_id, position, chunk_index,
      chunk_start_offset, chunk_end_offset, hierarchy_level, thread_root_id,
      embedding_model, embedding_at, embedding_text_hash,
      title, author, author_role, tags, media_refs, source_metadata,
      paragraph_hashes, line_hashes, first_seen_at,
      has_pasted_content, paste_segments, paste_confidence, paste_reasons,
      source_created_at, source_updated_at, created_at, imported_at
    FROM content_nodes
    ${whereClause}
    ORDER BY created_at ASC
    LIMIT $${paramOffset}
    `,
    params
  );

  return result.rows.map(row => ({
    id: row.id,
    contentHash: row.content_hash,
    uri: row.uri,
    text: row.text,
    format: row.format,
    wordCount: row.word_count,
    sourceType: row.source_type,
    sourceAdapter: row.source_adapter,
    sourceOriginalId: row.source_original_id,
    sourceOriginalPath: row.source_original_path,
    importJobId: row.import_job_id,
    parentNodeId: row.parent_node_id,
    position: row.position,
    chunkIndex: row.chunk_index,
    chunkStartOffset: row.chunk_start_offset,
    chunkEndOffset: row.chunk_end_offset,
    hierarchyLevel: row.hierarchy_level ?? 0,
    threadRootId: row.thread_root_id,
    embeddingModel: row.embedding_model,
    embeddingAt: row.embedding_at,
    embeddingTextHash: row.embedding_text_hash,
    title: row.title,
    author: row.author,
    authorRole: row.author_role,
    tags: row.tags,
    mediaRefs: row.media_refs,
    sourceMetadata: row.source_metadata,
    paragraphHashes: row.paragraph_hashes,
    lineHashes: row.line_hashes,
    firstSeenAt: row.first_seen_at,
    hasPastedContent: row.has_pasted_content,
    pasteSegments: row.paste_segments,
    pasteConfidence: row.paste_confidence,
    pasteReasons: row.paste_reasons,
    sourceCreatedAt: row.source_created_at,
    sourceUpdatedAt: row.source_updated_at,
    createdAt: row.created_at instanceof Date ? row.created_at.getTime() : row.created_at,
    importedAt: row.imported_at instanceof Date ? row.imported_at.getTime() : row.imported_at,
  }));
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
