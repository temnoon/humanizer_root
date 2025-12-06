/**
 * Test Facebook import with database indexing and embeddings
 */

import { FacebookFullParser } from './FacebookFullParser.js';
import { DatabaseImporter } from './DatabaseImporter.js';
import path from 'path';

const exportDir = '/Users/tem/Downloads/facebook-temnoon-2025-11-18-5XY1dvj4';
const targetDir = '/tmp/facebook-db-test';
const archivePath = '/Users/tem/openai-export-parser/output_v13_final';  // Use existing archive

console.log('🎯 Facebook Import with Database Test\n');
console.log('═══════════════════════════════════════════════════════\n');

const parser = new FacebookFullParser();

console.log('Running full import with database indexing...\n');

const result = await parser.importExport({
  exportDir,
  targetDir,
  archivePath,  // Index into existing archive database
  settings: {
    periodType: 'quarters',
    periodLength: 90,
    yearStartType: 'birthday',
    birthday: '04-21',
    useQuarterNames: true,
    includeDateRanges: true,
  },
  preserveSource: true,
  generateEmbeddings: true,  // Generate embeddings!
  onProgress: (progress) => {
    console.log(`📊 ${progress.stage}: ${progress.message}`);
  },
});

console.log('\n═══════════════════════════════════════════════════════\n');
console.log('✅ Import Complete!\n');
console.log(`Archive ID: ${result.archive_id}`);
console.log(`Location: ${path.join(targetDir, result.archive_id)}`);
console.log(`\nContent Imported:`);
console.log(`  Posts: ${result.posts_imported.toLocaleString()}`);
console.log(`  Comments: ${result.comments_imported.toLocaleString()}`);
console.log(`  Reactions: ${result.reactions_imported.toLocaleString()}`);
console.log(`  Total: ${result.total_items.toLocaleString()}`);
console.log(`\nOrganization:`);
console.log(`  Periods: ${result.periods.length}`);
console.log(`  Date Range: ${result.periods[0]?.period_folder} to ${result.periods[result.periods.length - 1]?.period_folder}`);

// Test database queries
console.log('\n═══════════════════════════════════════════════════════\n');
console.log('Testing Database Queries:\n');

const importer = new DatabaseImporter(archivePath);
const stats = importer.getStats();

console.log(`Database contains:`);
console.log(`  Posts: ${stats.posts.toLocaleString()}`);
console.log(`  Comments: ${stats.comments.toLocaleString()}`);
console.log(`  Reactions: ${stats.reactions.toLocaleString()}`);
console.log(`  Total: ${stats.total.toLocaleString()}`);

// Test semantic search
console.log('\n═══════════════════════════════════════════════════════\n');
console.log('Testing Semantic Search:\n');

const db = importer.getDatabase();

// Search for posts about COSM
console.log('Query: "COSM chapel art gallery"');
const searchResults = db.searchContentItems(
  // We need to generate an embedding for this query
  // For now, just show that the search API exists
  [],  // Empty for now - would need EmbeddingGenerator
  10,
  'post',
  'facebook'
);

console.log(`Found ${searchResults.length} results (embeddings needed for actual search)\n`);

// Get some sample posts
const posts = db.getContentItemsByType('post').slice(0, 5);
console.log('Sample Posts:');
posts.forEach((post, i) => {
  const date = new Date(post.created_at * 1000);
  console.log(`\n${i + 1}. ${post.title}`);
  console.log(`   Date: ${date.toDateString()}`);
  console.log(`   Text: ${post.text?.substring(0, 100)}...`);
});

// Get some sample comments
const comments = db.getContentItemsByType('comment').slice(0, 5);
console.log('\n\nSample Comments:');
comments.forEach((comment, i) => {
  const date = new Date(comment.created_at * 1000);
  const context = JSON.parse(comment.context || '{}');
  console.log(`\n${i + 1}. ${date.toDateString()} - ${context.contextType}`);
  console.log(`   ${comment.text?.substring(0, 100)}...`);
});

importer.close();

console.log('\n═══════════════════════════════════════════════════════');
console.log('✅ Database test complete!');
console.log('═══════════════════════════════════════════════════════\n');
