// Voice Discovery Service - Analyzes writing samples to discover personas and styles
// Uses clustering, embeddings, and linguistic analysis
import type { Env } from '../../shared/types';

/**
 * Simple K-means clustering implementation for Workers environment
 * Returns cluster assignments for each data point
 */
function kMeansClustering(
  embeddings: number[][],
  k: number,
  maxIterations: number = 50
): number[] {
  const numPoints = embeddings.length;
  const dimensions = embeddings[0].length;

  // Initialize centroids randomly by selecting k random points
  const centroids: number[][] = [];
  const usedIndices = new Set<number>();
  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * numPoints);
    if (!usedIndices.has(idx)) {
      centroids.push([...embeddings[idx]]);
      usedIndices.add(idx);
    }
  }

  let assignments = new Array(numPoints).fill(0);

  // Iterate until convergence or max iterations
  for (let iter = 0; iter < maxIterations; iter++) {
    const oldAssignments = [...assignments];

    // Assign each point to nearest centroid
    for (let i = 0; i < numPoints; i++) {
      let minDist = Infinity;
      let bestCluster = 0;

      for (let j = 0; j < k; j++) {
        const dist = euclideanDistance(embeddings[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = j;
        }
      }

      assignments[i] = bestCluster;
    }

    // Update centroids
    for (let j = 0; j < k; j++) {
      const clusterPoints = embeddings.filter((_, idx) => assignments[idx] === j);
      if (clusterPoints.length > 0) {
        for (let d = 0; d < dimensions; d++) {
          centroids[j][d] = clusterPoints.reduce((sum, point) => sum + point[d], 0) / clusterPoints.length;
        }
      }
    }

    // Check for convergence
    if (JSON.stringify(assignments) === JSON.stringify(oldAssignments)) {
      break;
    }
  }

  return assignments;
}

/**
 * Calculate Euclidean distance between two vectors
 */
function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, val, idx) => sum + Math.pow(val - b[idx], 2), 0));
}

/**
 * Calculate silhouette score to determine optimal k
 * Returns average silhouette coefficient (higher is better, range -1 to 1)
 */
function calculateSilhouetteScore(embeddings: number[][], assignments: number[], k: number): number {
  const numPoints = embeddings.length;
  let totalScore = 0;

  for (let i = 0; i < numPoints; i++) {
    const ownCluster = assignments[i];

    // Calculate average distance to points in same cluster (a)
    const sameClusterPoints = embeddings.filter((_, idx) => assignments[idx] === ownCluster && idx !== i);
    const a = sameClusterPoints.length > 0
      ? sameClusterPoints.reduce((sum, point) => sum + euclideanDistance(embeddings[i], point), 0) / sameClusterPoints.length
      : 0;

    // Calculate average distance to points in nearest other cluster (b)
    let minAvgDist = Infinity;
    for (let j = 0; j < k; j++) {
      if (j === ownCluster) continue;

      const otherClusterPoints = embeddings.filter((_, idx) => assignments[idx] === j);
      if (otherClusterPoints.length > 0) {
        const avgDist = otherClusterPoints.reduce((sum, point) => sum + euclideanDistance(embeddings[i], point), 0) / otherClusterPoints.length;
        minAvgDist = Math.min(minAvgDist, avgDist);
      }
    }
    const b = minAvgDist;

    // Silhouette coefficient for this point
    const s = a === 0 && b === 0 ? 0 : (b - a) / Math.max(a, b);
    totalScore += s;
  }

  return totalScore / numPoints;
}

/**
 * Chunk text into approximately equal-sized segments
 */
function chunkText(text: string, targetWords: number = 500): string[] {
  const words = text.trim().split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += targetWords) {
    chunks.push(words.slice(i, i + targetWords).join(' '));
  }

  return chunks;
}

/**
 * Extract linguistic features from text
 */
interface LinguisticFeatures {
  avgSentenceLength: number;
  vocabDiversity: number; // Type-token ratio
  formalityScore: number;
  complexityScore: number;
  toneMarkers: string[];
}

function extractLinguisticFeatures(text: string): LinguisticFeatures {
  // Split into sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);

  // Average sentence length
  const avgSentenceLength = sentences.length > 0
    ? words.length / sentences.length
    : 0;

  // Vocabulary diversity (type-token ratio)
  const uniqueWords = new Set(words);
  const vocabDiversity = words.length > 0
    ? uniqueWords.size / words.length
    : 0;

  // Formality score (based on word length and latinate words)
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
  const formalityScore = Math.min(1.0, avgWordLength / 8); // Normalize to 0-1

  // Complexity score (based on sentence length and subordinate clauses)
  const complexityScore = Math.min(1.0, avgSentenceLength / 30); // Normalize to 0-1

  // Tone markers (common words that indicate tone - simplified version)
  const toneMarkers: string[] = [];
  const toneWords = {
    academic: ['therefore', 'however', 'furthermore', 'moreover', 'consequently'],
    casual: ['like', 'just', 'really', 'pretty', 'kind of'],
    formal: ['thus', 'hence', 'whereby', 'hitherto', 'notwithstanding']
  };

  for (const [tone, markers] of Object.entries(toneWords)) {
    for (const marker of markers) {
      if (text.toLowerCase().includes(marker)) {
        toneMarkers.push(tone);
        break;
      }
    }
  }

  return {
    avgSentenceLength,
    vocabDiversity,
    formalityScore,
    complexityScore,
    toneMarkers
  };
}

/**
 * Find optimal number of clusters using silhouette score
 */
function findOptimalK(embeddings: number[][], minK: number, maxK: number): number {
  let bestK = minK;
  let bestScore = -1;

  for (let k = minK; k <= maxK; k++) {
    const assignments = kMeansClustering(embeddings, k);
    const score = calculateSilhouetteScore(embeddings, assignments, k);

    if (score > bestScore) {
      bestScore = score;
      bestK = k;
    }
  }

  return bestK;
}

/**
 * Main voice discovery function
 * Analyzes writing samples to discover personas and styles
 */
export async function discoverVoices(
  env: Env,
  userId: number,
  minClusters: number = 3,
  maxClusters: number = 7
): Promise<{
  personasDiscovered: number;
  stylesDiscovered: number;
  totalWordsAnalyzed: number;
}> {
  // 1. Retrieve all user's writing samples
  const samplesResult = await env.DB.prepare(
    'SELECT id, content, word_count FROM writing_samples WHERE user_id = ? ORDER BY created_at ASC'
  ).bind(userId).all();

  if (samplesResult.results.length === 0) {
    throw new Error('No writing samples found for analysis');
  }

  const samples = samplesResult.results as Array<{ id: number; content: string; word_count: number }>;
  const totalWordsAnalyzed = samples.reduce((sum, s) => sum + s.word_count, 0);

  // Minimum word count check (5,000 words as per spec)
  if (totalWordsAnalyzed < 5000) {
    throw new Error(`Insufficient content for voice discovery. Need at least 5,000 words, have ${totalWordsAnalyzed}`);
  }

  // 2. Chunk samples into ~500-word segments
  const chunks: Array<{ text: string; sampleId: number }> = [];
  for (const sample of samples) {
    const sampleChunks = chunkText(sample.content, 500);
    sampleChunks.forEach(chunk => {
      chunks.push({ text: chunk, sampleId: sample.id });
    });
  }

  // 3. Generate embeddings for each chunk
  const embeddings: number[][] = [];
  for (const chunk of chunks) {
    const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: chunk.text
    });

    // Workers AI returns { data: number[][] } for embeddings
    const embedding = (response as any).data[0];
    embeddings.push(embedding);
  }

  // 4. Find optimal k using silhouette score
  const optimalK = findOptimalK(embeddings, minClusters, Math.min(maxClusters, chunks.length));

  // 5. Perform final clustering with optimal k
  const assignments = kMeansClustering(embeddings, optimalK);

  // 6. For each cluster, extract features and create persona + style
  const personasCreated: number[] = [];
  const stylesCreated: number[] = [];

  for (let clusterId = 0; clusterId < optimalK; clusterId++) {
    // Get all chunks in this cluster
    const clusterChunks = chunks.filter((_, idx) => assignments[idx] === clusterId);

    if (clusterChunks.length === 0) continue;

    // Combine cluster chunks for analysis
    const combinedText = clusterChunks.map(c => c.text).join('\n\n');

    // Extract linguistic features
    const features = extractLinguisticFeatures(combinedText);

    // Select 3 representative examples (evenly spaced through cluster)
    const exampleIndices = [
      0,
      Math.floor(clusterChunks.length / 2),
      clusterChunks.length - 1
    ];
    const examples = exampleIndices
      .filter(idx => idx < clusterChunks.length)
      .map(idx => clusterChunks[idx].text.substring(0, 300) + '...'); // First 300 chars

    // Generate persona description using LLM
    const personaPrompt = `Analyze these writing samples and describe the voice/persona in 1-2 sentences. Focus on perspective, tone, and personality:

${examples[0]}

${examples[1] || ''}

Persona description:`;

    const personaResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: personaPrompt }],
      max_tokens: 100
    });

    const personaDescription = (personaResponse as any).response || `Voice ${clusterId + 1}`;

    // Calculate representative embedding (centroid of cluster)
    const clusterEmbeddings = embeddings.filter((_, idx) => assignments[idx] === clusterId);
    const embeddingDim = clusterEmbeddings[0].length;
    const representativeEmbedding = new Array(embeddingDim).fill(0);
    for (const emb of clusterEmbeddings) {
      for (let i = 0; i < embeddingDim; i++) {
        representativeEmbedding[i] += emb[i];
      }
    }
    for (let i = 0; i < embeddingDim; i++) {
      representativeEmbedding[i] /= clusterEmbeddings.length;
    }

    // Create persona
    const personaResult = await env.DB.prepare(`
      INSERT INTO personal_personas
      (user_id, name, description, auto_discovered, embedding_signature, example_texts)
      VALUES (?, ?, ?, 1, ?, ?)
    `).bind(
      userId,
      `Voice ${clusterId + 1}`,
      personaDescription.trim(),
      JSON.stringify(representativeEmbedding),
      JSON.stringify(examples)
    ).run();

    personasCreated.push(personaResult.meta.last_row_id as number);

    // Generate style description
    const styleDescription = `Formality: ${(features.formalityScore * 100).toFixed(0)}%, Complexity: ${(features.complexityScore * 100).toFixed(0)}%`;

    // Create style
    const styleResult = await env.DB.prepare(`
      INSERT INTO personal_styles
      (user_id, name, description, auto_discovered, formality_score, complexity_score,
       avg_sentence_length, vocab_diversity, tone_markers, example_texts)
      VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      `Style ${clusterId + 1}`,
      styleDescription,
      features.formalityScore,
      features.complexityScore,
      features.avgSentenceLength,
      features.vocabDiversity,
      JSON.stringify(features.toneMarkers),
      JSON.stringify(examples)
    ).run();

    stylesCreated.push(styleResult.meta.last_row_id as number);
  }

  return {
    personasDiscovered: personasCreated.length,
    stylesDiscovered: stylesCreated.length,
    totalWordsAnalyzed
  };
}
