/**
 * Explore Humanizer Development Themes
 *
 * Discovers thematic clusters in the markdown-memory development notes
 * to understand the arc of humanizer development for book creation.
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import { ClusteringService } from '../src/clustering/clustering-service.js';
import type { ClusterPoint } from '../src/clustering/types.js';

interface DevMemory {
  id: string;
  text: string;
  title: string;
  tags: string[];
  sourceCreatedAt: Date;
  embedding: number[];
  memoryType?: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function computeCentroid(embeddings: number[][]): number[] {
  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += emb[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    centroid[i] /= embeddings.length;
  }
  return centroid;
}

function extractKeywords(texts: string[], limit = 10): string[] {
  const allText = texts.join(' ').toLowerCase();
  const words = allText.split(/\s+/).filter(w => w.length > 5);
  const wordFreq = new Map<string, number>();

  const stopwords = new Set([
    'however', 'because', 'through', 'between', 'without', 'something',
    'actually', 'different', 'should', 'would', 'could', 'really',
    'things', 'there', 'these', 'about', 'which', 'other', 'being',
    'their', 'where', 'after', 'before', 'during', 'while', 'under',
    'created', 'complete', 'completed', 'session', 'handoff', 'content',
    'system', 'lines)', 'updated', 'successfully', 'working', 'implemented'
  ]);

  for (const word of words) {
    if (!stopwords.has(word) && !/^\d+$/.test(word)) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }

  return [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

async function exploreThemes() {
  console.log('═'.repeat(70));
  console.log(' HUMANIZER DEVELOPMENT THEME EXPLORATION');
  console.log('═'.repeat(70));
  console.log('\n Analyzing 1,675 development memories (Mar 2025 - Jan 2026)\n');

  const store = new PostgresContentStore({ enableVec: true, enableFTS: true });
  await store.initialize();
  const pool = store.getPool();

  // ─────────────────────────────────────────────────────────────────
  // STEP 1: Get all development memories with embeddings
  // ─────────────────────────────────────────────────────────────────
  console.log('Step 1: Fetching development memories...');

  const result = await pool.query(`
    SELECT
      id,
      text,
      title,
      tags,
      source_created_at,
      embedding::text as emb,
      source_metadata->>'memoryType' as memory_type
    FROM content_nodes
    WHERE source_type = 'markdown-memory'
      AND embedding IS NOT NULL
      AND length(text) > 100
    ORDER BY source_created_at ASC
  `);

  console.log(`  Found ${result.rows.length} memories with embeddings\n`);

  if (result.rows.length < 50) {
    console.log('  Need to generate embeddings first. Run the embedding service.');
    await store.close();
    return;
  }

  // Parse into typed structure
  const memories: DevMemory[] = result.rows.map(row => ({
    id: row.id,
    text: row.text,
    title: row.title || '',
    tags: row.tags || [],
    sourceCreatedAt: new Date(row.source_created_at),
    embedding: JSON.parse(row.emb),
    memoryType: row.memory_type,
  }));

  // ─────────────────────────────────────────────────────────────────
  // STEP 2: Analyze memory types and tags
  // ─────────────────────────────────────────────────────────────────
  console.log('Step 2: Analyzing metadata distribution...');

  const typeFreq = new Map<string, number>();
  const tagFreq = new Map<string, number>();
  const monthFreq = new Map<string, number>();

  for (const m of memories) {
    // Types
    const type = m.memoryType || 'unknown';
    typeFreq.set(type, (typeFreq.get(type) || 0) + 1);

    // Tags
    for (const tag of m.tags) {
      if (typeof tag === 'string') {
        tagFreq.set(tag, (tagFreq.get(tag) || 0) + 1);
      }
    }

    // Months
    const month = m.sourceCreatedAt.toISOString().substring(0, 7);
    monthFreq.set(month, (monthFreq.get(month) || 0) + 1);
  }

  console.log('\n  Memory Types:');
  const sortedTypes = [...typeFreq.entries()].sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sortedTypes.slice(0, 15)) {
    console.log(`    ${type}: ${count}`);
  }

  console.log('\n  Top Tags:');
  const sortedTags = [...tagFreq.entries()].sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sortedTags.slice(0, 20)) {
    console.log(`    ${tag}: ${count}`);
  }

  console.log('\n  Timeline:');
  for (const [month, count] of [...monthFreq.entries()].sort()) {
    const bar = '█'.repeat(Math.ceil(count / 10));
    console.log(`    ${month}: ${bar} (${count})`);
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 3: Run clustering to discover latent themes
  // ─────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log(' STEP 3: CLUSTERING FOR THEMATIC DISCOVERY');
  console.log('═'.repeat(70));

  const clusterService = new ClusteringService();
  const points: ClusterPoint[] = memories.map(m => ({
    id: m.id,
    embedding: m.embedding,
  }));

  const clusterResult = clusterService.cluster(points, {
    minClusterSize: 5,   // Smaller clusters for more granular themes
    minSamples: 3,       // Lower density requirement
  });

  console.log(`\n  Discovered ${clusterResult.clusters.length} thematic clusters`);
  console.log(`  Noise (unclustered): ${clusterResult.noise.length} passages\n`);

  // ─────────────────────────────────────────────────────────────────
  // STEP 4: Analyze each cluster
  // ─────────────────────────────────────────────────────────────────
  const clusterAnalyses: Array<{
    clusterNum: number;
    size: number;
    keywords: string[];
    dateRange: string;
    topMemories: DevMemory[];
    centroid: number[];
    avgTypes: Map<string, number>;
  }> = [];

  for (let i = 0; i < clusterResult.clusters.length; i++) {
    const cluster = clusterResult.clusters[i];

    // Get memories for this cluster
    const clusterMemories = cluster.points
      .map(pt => memories.find(m => m.id === pt.id)!)
      .filter(Boolean);

    if (clusterMemories.length < 5) continue;

    // Compute centroid
    const centroid = computeCentroid(clusterMemories.map(m => m.embedding));

    // Sort by distance to centroid
    const withDistance = clusterMemories.map(m => ({
      ...m,
      distance: 1 - cosineSimilarity(m.embedding, centroid),
    })).sort((a, b) => a.distance - b.distance);

    // Extract keywords
    const keywords = extractKeywords(clusterMemories.map(m => m.text), 10);

    // Date range
    const dates = clusterMemories.map(m => m.sourceCreatedAt).sort((a, b) => a.getTime() - b.getTime());
    const dateRange = `${dates[0].toISOString().split('T')[0]} to ${dates[dates.length - 1].toISOString().split('T')[0]}`;

    // Type distribution in cluster
    const clusterTypes = new Map<string, number>();
    for (const m of clusterMemories) {
      const t = m.memoryType || 'unknown';
      clusterTypes.set(t, (clusterTypes.get(t) || 0) + 1);
    }

    clusterAnalyses.push({
      clusterNum: i + 1,
      size: clusterMemories.length,
      keywords,
      dateRange,
      topMemories: withDistance.slice(0, 5),
      centroid,
      avgTypes: clusterTypes,
    });
  }

  // Sort clusters by size
  clusterAnalyses.sort((a, b) => b.size - a.size);

  // ─────────────────────────────────────────────────────────────────
  // STEP 5: Display cluster analysis
  // ─────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log(' THEMATIC CLUSTERS (sorted by size)');
  console.log('═'.repeat(70));

  for (const analysis of clusterAnalyses) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(` CLUSTER ${analysis.clusterNum}: ${analysis.size} memories`);
    console.log(`${'─'.repeat(70)}`);

    console.log(`\n  Keywords: ${analysis.keywords.join(', ')}`);
    console.log(`  Date range: ${analysis.dateRange}`);

    console.log('\n  Memory types in cluster:');
    const sortedClusterTypes = [...analysis.avgTypes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [type, count] of sortedClusterTypes) {
      console.log(`    ${type}: ${count}`);
    }

    console.log('\n  Representative passages (nearest to centroid):');
    for (let j = 0; j < analysis.topMemories.length; j++) {
      const m = analysis.topMemories[j];
      const preview = m.text.substring(0, 120).replace(/\n/g, ' ');
      console.log(`\n  [${j + 1}] ${m.sourceCreatedAt.toISOString().split('T')[0]}`);
      console.log(`      ${preview}...`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 6: Identify development arc
  // ─────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log(' DEVELOPMENT ARC ANALYSIS');
  console.log('═'.repeat(70));

  // Group memories by quarter
  const quarters = new Map<string, DevMemory[]>();
  for (const m of memories) {
    const date = m.sourceCreatedAt;
    const q = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
    if (!quarters.has(q)) quarters.set(q, []);
    quarters.get(q)!.push(m);
  }

  console.log('\n  Quarterly Focus Areas:');
  for (const [quarter, mems] of [...quarters.entries()].sort()) {
    const keywords = extractKeywords(mems.map(m => m.text), 8);
    console.log(`\n  ${quarter} (${mems.length} memories):`);
    console.log(`    Focus: ${keywords.join(', ')}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 7: Suggest book structure
  // ─────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log(' SUGGESTED BOOK CHAPTERS');
  console.log('═'.repeat(70));

  console.log('\n  Based on clustering and timeline analysis:\n');

  // Map clusters to potential chapters
  for (let i = 0; i < Math.min(12, clusterAnalyses.length); i++) {
    const analysis = clusterAnalyses[i];
    // Generate chapter title from keywords
    const chapterTitle = analysis.keywords.slice(0, 3)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(', ');

    console.log(`  Chapter ${i + 1}: "${chapterTitle}"`);
    console.log(`    ${analysis.size} passages | ${analysis.dateRange}`);
    console.log(`    Key themes: ${analysis.keywords.slice(0, 5).join(', ')}`);
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────
  // OUTPUT: Cluster IDs for book building
  // ─────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log(' PASSAGE IDS FOR BOOK BUILDING');
  console.log('═'.repeat(70));

  for (let i = 0; i < Math.min(10, clusterAnalyses.length); i++) {
    const analysis = clusterAnalyses[i];
    const ids = analysis.topMemories.map(m => m.id).join(', ');
    console.log(`\n  Cluster ${analysis.clusterNum} (top 5):`);
    console.log(`  ${ids}`);
  }

  console.log('\n' + '═'.repeat(70) + '\n');

  await store.close();
}

exploreThemes().catch(console.error);
