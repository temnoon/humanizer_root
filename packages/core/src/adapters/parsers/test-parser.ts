#!/usr/bin/env npx tsx
/**
 * Quick parser test script
 * Usage: npx tsx packages/core/src/adapters/parsers/test-parser.ts [archive-path]
 */

import { ConversationParser } from './ConversationParser.js';

async function main() {
  const archivePath = process.argv[2] ||
    '/Users/tem/Downloads/6b7599313a6595307d609a23768eb938ed661a5f5397cf984d22a749f4af0f9f-2025-10-07-15-10-06-1d1cb876d53e4247b13adb52bc7d2f27.zip';

  console.log(`Testing parser on: ${archivePath}`);
  console.log('');

  const parser = new ConversationParser(true); // verbose mode

  try {
    const startTime = Date.now();
    const result = await parser.parseArchive(archivePath);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n========================================');
    console.log('PARSE RESULTS');
    console.log('========================================');
    console.log(`Format: ${result.format}`);
    console.log(`Conversations: ${result.stats.totalConversations}`);
    console.log(`Messages: ${result.stats.totalMessages}`);
    console.log(`Media files: ${result.stats.totalMediaFiles}`);
    console.log(`Parse errors: ${result.stats.parseErrors}`);
    console.log(`Elapsed: ${elapsed}s`);
    console.log(`Extracted to: ${result.extractedPath}`);

    // Show sample conversation titles
    console.log('\nSample conversations:');
    result.conversations.slice(0, 5).forEach((conv, i) => {
      const mediaCount = conv._media_files?.length || 0;
      console.log(`  ${i + 1}. "${conv.title.slice(0, 50)}..." [${mediaCount} media]`);
    });

    // Show match stats
    const matchStats = parser.getMatchStats();
    console.log('\nMedia matching breakdown:');
    console.log(`  By file hash: ${matchStats.byFileHash}`);
    console.log(`  By file ID: ${matchStats.byFileId}`);
    console.log(`  By filename+size: ${matchStats.byFilenameSize}`);
    console.log(`  By conversation dir: ${matchStats.byConversationDir}`);
    console.log(`  By size+metadata: ${matchStats.bySizeMetadata}`);
    console.log(`  By size only: ${matchStats.bySizeOnly}`);
    console.log(`  By filename only: ${matchStats.byFilenameOnly}`);
    console.log(`  Unmatched: ${matchStats.unmatchedReferences}`);

  } catch (error) {
    console.error('Parse failed:', error);
    process.exit(1);
  }
}

main();
