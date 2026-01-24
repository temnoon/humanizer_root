/**
 * E2E Test: Bookmaking Pipeline via AUI Tools
 *
 * Tests the full flow: discover clusters → create book from philosophy cluster
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initContentStore } from '../../storage/postgres-content-store.js';
import { initUnifiedAui } from '../../aui/index.js';
import {
  handleClusterDiscover,
  handleClusterList,
  handleClusterGet,
  handleBookCreateFromCluster,
  handleBookList,
  handleBookGet,
} from './unified-aui.js';

// Skip if no database connection
const hasDatabase = process.env.PGHOST || process.env.TEST_WITH_DB;

describe.skipIf(!hasDatabase)('Bookmaking E2E Pipeline', () => {
  beforeAll(async () => {
    // Initialize content store and AUI service
    await initContentStore({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_archive',
      user: 'tem',
    });
    await initUnifiedAui();
  }, 30000);

  it('discovers clusters from embedded archive', async () => {
    const result = await handleClusterDiscover({
      sampleSize: 1000,
      minClusterSize: 5,
      maxClusters: 10,
      minSimilarity: 0.7,
      minWordCount: 10,
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text!);

    console.log('\n=== CLUSTER DISCOVERY ===');
    console.log('Total passages sampled:', data.totalPassages);
    console.log('Assigned to clusters:', data.assignedPassages);
    console.log('Clusters found:', data.clusters.length);

    expect(data.clusters.length).toBeGreaterThan(0);

    // Log cluster summaries
    for (const c of data.clusters) {
      console.log(`\n  ${c.id}: ${c.label} (${c.totalPassages} passages, coherence: ${c.coherence.toFixed(3)})`);
      console.log(`    Keywords: ${c.keywords.slice(0, 5).join(', ')}`);
    }
  }, 60000);

  it('lists discovered clusters', async () => {
    const result = await handleClusterList();

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text!);

    console.log('\n=== CLUSTER LIST ===');
    console.log('Count:', data.count);
    expect(data.clusters.length).toBeGreaterThan(0);
  }, 60000);

  it('gets cluster details', async () => {
    // First list clusters to get an ID
    const listResult = await handleClusterList();
    const listData = JSON.parse(listResult.content[0].text!);
    const clusterId = listData.clusters[0]?.id;

    expect(clusterId).toBeDefined();

    const result = await handleClusterGet({ clusterId, passageLimit: 10 });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text!);

    console.log('\n=== CLUSTER DETAILS ===');
    console.log('ID:', data.id);
    console.log('Label:', data.label);
    console.log('Total passages:', data.totalPassages);
    console.log('Sample passage:', data.passages[0]?.text?.substring(0, 100) + '...');
  }, 60000);

  it('creates book from philosophy cluster', async () => {
    // Find a philosophy-related cluster
    const listResult = await handleClusterList();
    const listData = JSON.parse(listResult.content[0].text!);

    // Look for clusters with philosophy keywords
    const philosophyKeywords = ['consciousness', 'understanding', 'world', 'think', 'phenomenology', 'quantum', 'cognitive'];
    const philosophyCluster = listData.clusters.find((c: any) =>
      c.keywords.some((k: string) => philosophyKeywords.includes(k.toLowerCase()))
    );

    if (!philosophyCluster) {
      console.log('No philosophy cluster found, using first cluster');
    }

    const clusterId = philosophyCluster?.id || listData.clusters[0]?.id;
    console.log('\n=== CREATING BOOK FROM CLUSTER ===');
    console.log('Cluster:', clusterId);

    const result = await handleBookCreateFromCluster({
      clusterId,
      title: 'Reflections on Consciousness',
      arcType: 'thematic',
      maxPassages: 30,
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text!);

    console.log('Book created:', data.id);
    console.log('Title:', data.title);
    console.log('Chapters:', data.chapterCount);
    console.log('Total words:', data.totalWordCount);

    expect(data.id).toBeDefined();
    expect(data.chapterCount).toBeGreaterThan(0);
  }, 120000);

  it('lists created books', async () => {
    const result = await handleBookList();

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text!);

    console.log('\n=== BOOK LIST ===');
    console.log('Count:', data.count);

    for (const b of data.books) {
      console.log(`  ${b.id}: ${b.title} (${b.chapterCount} chapters)`);
    }

    expect(data.books.length).toBeGreaterThan(0);
  }, 30000);

  it('gets full book content', async () => {
    const listResult = await handleBookList();
    const listData = JSON.parse(listResult.content[0].text!);
    const bookId = listData.books[0]?.id;

    expect(bookId).toBeDefined();

    const result = await handleBookGet({ bookId });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text!);

    console.log('\n=== BOOK CONTENT ===');
    console.log('Title:', data.title);
    console.log('Arc title:', data.arc?.title);
    console.log('Introduction:', data.arc?.introduction?.substring(0, 200) + '...');
    console.log('Themes:', data.arc?.themes?.join(', '));
    console.log('\nChapters:');
    for (const ch of data.chapters) {
      console.log(`  ${ch.title} (${ch.wordCount} words)`);
    }

    expect(data.chapters.length).toBeGreaterThan(0);
    expect(data.arc).toBeDefined();
  }, 30000);
});
