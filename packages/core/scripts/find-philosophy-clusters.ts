/**
 * Find Philosophy/Science Clusters
 *
 * Discovers 3 latent space clusters in philosophy and science content,
 * then harvests the best passages from the center anchor.
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import { EmbeddingService } from '../src/embeddings/embedding-service.js';
import { ClusteringService } from '../src/clustering/clustering-service.js';
import type { ClusterPoint } from '../src/clustering/types.js';

interface PassageWithEmbed {
  id: string;
  text: string;
  score: string | null;
  embedding: number[];
  authorRole?: string;
  sourceType?: string;
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

async function findPhilosophyClusters() {
  console.log('═'.repeat(70));
  console.log(' PHILOSOPHY & SCIENCE CLUSTER DISCOVERY');
  console.log('═'.repeat(70));

  const store = new PostgresContentStore({ enableVec: true, enableFTS: true });
  await store.initialize();
  const pool = store.getPool();

  // Search for philosophy/science content with embeddings
  console.log('\n  Searching for philosophy/science passages...');

  const result = await pool.query(`
    SELECT id, text, embedding::text as emb,
           source_metadata->>'excellenceScore' as score,
           author_role, source_type
    FROM content_nodes
    WHERE embedding IS NOT NULL
      AND (
        text ILIKE '%philosophy%' OR text ILIKE '%consciousness%'
        OR text ILIKE '%quantum%' OR text ILIKE '%science%'
        OR text ILIKE '%phenomenology%' OR text ILIKE '%cognitive%'
        OR text ILIKE '%metaphysics%' OR text ILIKE '%epistemology%'
        OR text ILIKE '%reality%' OR text ILIKE '%perception%'
        OR text ILIKE '%mind%' OR text ILIKE '%awareness%'
      )
      AND length(text) > 100
    ORDER BY (source_metadata->>'excellenceScore')::int DESC NULLS LAST
    LIMIT 500
  `);

  console.log(`  Found ${result.rows.length} philosophy/science passages\n`);

  if (result.rows.length < 30) {
    console.log('  Not enough passages for meaningful clustering');
    await store.close();
    return;
  }

  // Parse embeddings
  const passages: PassageWithEmbed[] = result.rows.map(row => ({
    id: row.id,
    text: row.text,
    score: row.score,
    embedding: JSON.parse(row.emb),
    authorRole: row.author_role,
    sourceType: row.source_type,
  }));

  // Run clustering
  console.log('  Running HDBSCAN clustering...');
  const clusterService = new ClusteringService();
  const points: ClusterPoint[] = passages.map(p => ({
    id: p.id,
    embedding: p.embedding,
  }));

  const clusterResult = clusterService.cluster(points, {
    minClusterSize: 8,
    minSamples: 4,
  });

  console.log(`  Found ${clusterResult.clusters.length} clusters\n`);

  if (clusterResult.clusters.length === 0) {
    console.log('  No clusters found. Try adjusting parameters.');
    await store.close();
    return;
  }

  // Show top 3 clusters
  const topClusters = clusterResult.clusters.slice(0, 3);

  for (let i = 0; i < topClusters.length; i++) {
    const cluster = topClusters[i];

    console.log('═'.repeat(70));
    console.log(` CLUSTER ${i + 1}: ${cluster.points.length} passages`);
    console.log('═'.repeat(70));

    // Get passages for this cluster
    const clusterPassages = cluster.points.map(pt =>
      passages.find(p => p.id === pt.id)!
    ).filter(Boolean);

    // Compute centroid
    const centroid = computeCentroid(clusterPassages.map(p => p.embedding));

    // Sort by distance to centroid (closest first)
    const withDistance = clusterPassages.map(p => ({
      ...p,
      distanceToCentroid: 1 - cosineSimilarity(p.embedding, centroid),
    })).sort((a, b) => a.distanceToCentroid - b.distanceToCentroid);

    // Extract keywords from cluster
    const allText = clusterPassages.map(p => p.text).join(' ').toLowerCase();
    const words = allText.split(/\s+/).filter(w => w.length > 6);
    const wordFreq = new Map<string, number>();
    const stopwords = new Set(['however', 'because', 'through', 'between', 'without', 'something', 'actually', 'different']);
    for (const word of words) {
      if (!stopwords.has(word)) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    }
    const keywords = [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([w]) => w);

    console.log(`\n  Keywords: ${keywords.join(', ')}`);
    console.log(`  Centroid distance range: ${withDistance[0].distanceToCentroid.toFixed(4)} - ${withDistance[withDistance.length - 1].distanceToCentroid.toFixed(4)}`);

    // Show top 5 passages nearest to centroid (the "best" center content)
    console.log('\n  Top passages (nearest to center anchor):');
    for (let j = 0; j < Math.min(5, withDistance.length); j++) {
      const p = withDistance[j];
      const preview = p.text.substring(0, 120).replace(/\n/g, ' ');
      console.log(`\n  [${j + 1}] Score: ${p.score || 'N/A'} | Distance: ${p.distanceToCentroid.toFixed(4)}`);
      console.log(`      ${preview}...`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // LARGE HARVEST: Focus on best passages from center anchor
  // ─────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log(' LARGE HARVEST: CENTER ANCHOR SELECTION');
  console.log('═'.repeat(70));

  // Collect all cluster passages
  const allClusterPassages: PassageWithEmbed[] = [];
  for (const cluster of topClusters) {
    const clusterPassages = cluster.points.map(pt =>
      passages.find(p => p.id === pt.id)!
    ).filter(Boolean);
    allClusterPassages.push(...clusterPassages);
  }

  // Compute global centroid across all 3 clusters
  const globalCentroid = computeCentroid(allClusterPassages.map(p => p.embedding));

  // Sort all passages by distance to global centroid
  const harvestCandidates = allClusterPassages.map(p => ({
    ...p,
    distanceToGlobalCenter: 1 - cosineSimilarity(p.embedding, globalCentroid),
  })).sort((a, b) => a.distanceToGlobalCenter - b.distanceToGlobalCenter);

  // Select top 30 from center
  const harvest = harvestCandidates.slice(0, 30);

  console.log(`\n  Total passages in 3 clusters: ${allClusterPassages.length}`);
  console.log(`  Harvested (center anchor): ${harvest.length}`);
  console.log(`  Distance range: ${harvest[0].distanceToGlobalCenter.toFixed(4)} - ${harvest[harvest.length - 1].distanceToGlobalCenter.toFixed(4)}`);

  console.log('\n  HARVESTED PASSAGES (best from center anchor):');
  console.log('  ' + '─'.repeat(66));

  for (let i = 0; i < harvest.length; i++) {
    const p = harvest[i];
    const preview = p.text.substring(0, 100).replace(/\n/g, ' ');
    const score = p.score ? `[${p.score}]` : '[--]';
    console.log(`\n  ${String(i + 1).padStart(2)}. ${score} ${preview}...`);
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log(' HARVEST SUMMARY');
  console.log('═'.repeat(70));

  const scoredCount = harvest.filter(p => p.score).length;
  const avgScore = harvest
    .filter(p => p.score)
    .reduce((sum, p) => sum + parseInt(p.score!, 10), 0) / (scoredCount || 1);

  console.log(`\n  Passages harvested: ${harvest.length}`);
  console.log(`  Scored passages: ${scoredCount}`);
  console.log(`  Average excellence score: ${avgScore.toFixed(1)}`);
  console.log(`  User-authored: ${harvest.filter(p => p.authorRole === 'user').length}`);
  console.log(`  Assistant-authored: ${harvest.filter(p => p.authorRole === 'assistant').length}`);

  // Output IDs for further processing
  console.log('\n  Passage IDs for book building:');
  console.log(`  ${harvest.map(p => p.id).join(', ')}`);

  console.log('\n' + '═'.repeat(70) + '\n');

  await store.close();
}

findPhilosophyClusters().catch(console.error);
