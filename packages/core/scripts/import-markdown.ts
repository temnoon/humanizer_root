#!/usr/bin/env npx tsx
/**
 * Import Markdown Files to UCG
 *
 * Uses the MarkdownAdapter and ImportService to properly import
 * markdown files (including ChromaDB memory exports) into the
 * humanizer_archive database.
 *
 * Usage:
 *   npx tsx scripts/import-markdown.ts /path/to/markdown/directory
 *
 * Environment variables:
 *   POSTGRES_HOST     - PostgreSQL host (default: localhost)
 *   POSTGRES_PORT     - PostgreSQL port (default: 5432)
 *   POSTGRES_DB       - Database name (default: humanizer_archive)
 *   POSTGRES_USER     - Database user (default: postgres)
 *   POSTGRES_PASSWORD - Database password (optional)
 */

import { markdownAdapter } from '../src/adapters/providers/markdown-adapter.js';
import { ImportService, getUCGStorage, ContentStoreAdapter } from '../src/adapters/storage.js';
import { initContentStore, getContentStore, closeContentStore } from '../src/storage/postgres-content-store.js';
import type { ImportProgress } from '../src/adapters/types.js';

// Configuration
const SOURCE_PATH = process.argv[2] || '/Users/tem/archive/mcp-memory/exported-memories';

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║             Markdown Import to UCG                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const config = {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    database: process.env.POSTGRES_DB ?? 'humanizer_archive',
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD,
  };

  console.log(`Source: ${SOURCE_PATH}`);
  console.log(`Database: ${config.database}@${config.host}:${config.port}`);
  console.log();

  // Step 1: Detect format
  console.log('Step 1: Detecting format...');
  const detection = await markdownAdapter.detect({ type: 'directory', path: SOURCE_PATH });

  if (!detection.canHandle) {
    console.error(`Error: Cannot handle source - ${detection.reason}`);
    process.exit(1);
  }

  console.log(`  Format: ${detection.format}`);
  console.log(`  Confidence: ${(detection.confidence * 100).toFixed(0)}%`);
  console.log(`  Reason: ${detection.reason}`);
  console.log();

  // Step 2: Validate
  console.log('Step 2: Validating...');
  const validation = await markdownAdapter.validate({ type: 'directory', path: SOURCE_PATH });

  if (!validation.valid) {
    console.error('Validation errors:');
    for (const err of validation.errors) {
      console.error(`  - ${err.code}: ${err.message}`);
    }
    process.exit(1);
  }

  if (validation.warnings.length > 0) {
    console.log('  Warnings:');
    for (const warn of validation.warnings) {
      console.log(`    - ${warn.code}: ${warn.message}`);
    }
  } else {
    console.log('  Validation passed');
  }
  console.log();

  // Step 3: Get metadata
  console.log('Step 3: Getting source metadata...');
  const metadata = await markdownAdapter.getSourceMetadata({ type: 'directory', path: SOURCE_PATH });

  console.log(`  Estimated items: ${metadata.estimatedCount}`);
  console.log(`  Content types: ${metadata.contentTypes.join(', ')}`);
  if (metadata.dateRange?.earliest) {
    console.log(`  Date range: ${metadata.dateRange.earliest.toISOString().split('T')[0]} to ${metadata.dateRange.latest?.toISOString().split('T')[0] || 'now'}`);
  }
  console.log();

  // Step 4: Initialize database connection
  console.log('Step 4: Connecting to database...');
  try {
    await initContentStore({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      maxConnections: 10,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
      embeddingDimension: 768,
      enableFTS: true,
      enableVec: true,
    });
    console.log('  Connected successfully');
  } catch (error) {
    console.error('  Failed to connect:', error);
    process.exit(1);
  }
  console.log();

  // Step 5: Run import
  console.log('Step 5: Running import...');
  console.log();

  let lastProgress: ImportProgress | null = null;

  const onProgress = (progress: ImportProgress): void => {
    if (progress.processed % 50 === 0 || progress.phase !== lastProgress?.phase) {
      const percent = progress.percent ? ` (${progress.percent}%)` : '';
      console.log(`  [${progress.phase}] Processed: ${progress.processed}${percent}`);
    }
    lastProgress = progress;
  };

  const storage = new ContentStoreAdapter(getContentStore());
  const importService = new ImportService(storage, onProgress);

  const startTime = Date.now();

  try {
    const job = await importService.runImport(markdownAdapter, SOURCE_PATH);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log();
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                        Import Complete');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log();
    console.log(`  Job ID: ${job.id}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Duration: ${duration}s`);
    console.log();
    console.log(`  Nodes imported: ${job.nodesImported}`);
    console.log(`  Nodes skipped (duplicates): ${job.nodesSkipped}`);
    console.log(`  Nodes failed: ${job.nodesFailed}`);
    console.log(`  Links created: ${job.linksCreated}`);

    if (job.error) {
      console.log();
      console.log(`  Error: ${job.error}`);
    }

    if (job.stats) {
      console.log();
      console.log('  Content breakdown:');
      for (const [type, count] of Object.entries(job.stats.byContentType || {})) {
        console.log(`    - ${type}: ${count}`);
      }
    }
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await closeContentStore();
  }

  console.log();
  console.log('Done.');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
