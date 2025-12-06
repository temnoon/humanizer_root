// Embeddings Service
// Generate embeddings and manage Vectorize index
// All model configurations from ai-models.ts

import {
  ACTIVE_CONFIG,
  EMBEDDING_MODELS,
} from '../config/ai-models';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
  processingTimeMs: number;
}

export interface VectorMetadata {
  postId: string;
  userId: string;
  summary?: string;
  tags?: string[];
  visibility: string;
  createdAt: number;
  version?: number;
}

/**
 * Generate embedding vector for text content
 */
export async function generateEmbedding(
  ai: Ai,
  text: string,
  options: { isQuery?: boolean } = {}
): Promise<EmbeddingResult> {
  const startTime = Date.now();
  
  const config = EMBEDDING_MODELS[ACTIVE_CONFIG.embedding.modelId];
  
  // Apply prefix based on whether this is a query or document
  const prefix = options.isQuery 
    ? ACTIVE_CONFIG.embedding.queryPrefix 
    : ACTIVE_CONFIG.embedding.documentPrefix;
  const prefixedText = prefix + text;
  
  try {
    const result = await ai.run(config.model as Parameters<Ai['run']>[0], {
      text: [prefixedText],
    }) as { data: number[][] };
    
    return {
      embedding: result.data[0],
      model: config.model,
      dimensions: config.dimensions,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[EMBEDDINGS] Generation error:', error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateBatchEmbeddings(
  ai: Ai,
  texts: string[],
  options: { isQuery?: boolean } = {}
): Promise<EmbeddingResult[]> {
  const startTime = Date.now();
  
  const config = EMBEDDING_MODELS[ACTIVE_CONFIG.embedding.modelId];
  
  // Apply prefix to all texts
  const prefix = options.isQuery 
    ? ACTIVE_CONFIG.embedding.queryPrefix 
    : ACTIVE_CONFIG.embedding.documentPrefix;
  const prefixedTexts = texts.map(t => prefix + t);
  
  try {
    const result = await ai.run(config.model as Parameters<Ai['run']>[0], {
      text: prefixedTexts,
    }) as { data: number[][] };
    
    const processingTime = Date.now() - startTime;
    
    return result.data.map(embedding => ({
      embedding,
      model: config.model,
      dimensions: config.dimensions,
      processingTimeMs: processingTime / texts.length, // Average time per embedding
    }));
  } catch (error) {
    console.error('[EMBEDDINGS] Batch generation error:', error);
    throw error;
  }
}

/**
 * Index a post in Vectorize
 */
export async function indexPost(
  vectorize: VectorizeIndex,
  postId: string,
  embedding: number[],
  metadata: VectorMetadata
): Promise<void> {
  try {
    await vectorize.upsert([{
      id: postId,
      values: embedding,
      metadata: metadata as unknown as Record<string, VectorizeVectorMetadata>,
    }]);
  } catch (error) {
    console.error('[EMBEDDINGS] Index error:', error);
    throw error;
  }
}

/**
 * Remove a post from the Vectorize index
 */
export async function removeFromIndex(
  vectorize: VectorizeIndex,
  postId: string
): Promise<void> {
  try {
    await vectorize.deleteByIds([postId]);
  } catch (error) {
    console.error('[EMBEDDINGS] Remove error:', error);
    throw error;
  }
}

/**
 * Search for similar posts using semantic search
 */
export async function searchSimilarPosts(
  ai: Ai,
  vectorize: VectorizeIndex,
  query: string,
  options: {
    topK?: number;
    filter?: {
      visibility?: string;
      userId?: string;
      tags?: string[];
    };
  } = {}
): Promise<{
  matches: Array<{
    postId: string;
    score: number;
    metadata: VectorMetadata;
  }>;
  queryEmbedding: EmbeddingResult;
}> {
  const topK = options.topK ?? 10;
  
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(ai, query, { isQuery: true });
  
  // Build filter if provided
  const filter: Record<string, unknown> = {};
  if (options.filter?.visibility) {
    filter.visibility = options.filter.visibility;
  }
  if (options.filter?.userId) {
    filter.userId = options.filter.userId;
  }
  // Note: Tag filtering may need special handling depending on how tags are stored
  
  try {
    const results = await vectorize.query(queryEmbedding.embedding, {
      topK,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      returnMetadata: 'all',
    });
    
    return {
      matches: results.matches.map(match => ({
        postId: match.id,
        score: match.score,
        metadata: match.metadata as unknown as VectorMetadata,
      })),
      queryEmbedding,
    };
  } catch (error) {
    console.error('[EMBEDDINGS] Search error:', error);
    throw error;
  }
}

/**
 * Find posts with similar content (for duplicate detection or recommendations)
 */
export async function findSimilarContent(
  ai: Ai,
  vectorize: VectorizeIndex,
  content: string,
  options: {
    excludePostId?: string;
    threshold?: number;
    topK?: number;
  } = {}
): Promise<Array<{
  postId: string;
  score: number;
  metadata: VectorMetadata;
}>> {
  const threshold = options.threshold ?? 0.8;
  const topK = options.topK ?? 5;
  
  const { matches } = await searchSimilarPosts(ai, vectorize, content, { topK: topK + 1 });
  
  return matches
    .filter(m => {
      // Exclude the source post if specified
      if (options.excludePostId && m.postId === options.excludePostId) return false;
      // Apply similarity threshold
      return m.score >= threshold;
    })
    .slice(0, topK);
}

/**
 * Get the current embedding configuration info
 */
export function getEmbeddingConfig() {
  const config = EMBEDDING_MODELS[ACTIVE_CONFIG.embedding.modelId];
  return {
    modelId: config.id,
    modelName: config.name,
    dimensions: config.dimensions,
    provider: config.provider,
    queryPrefix: ACTIVE_CONFIG.embedding.queryPrefix,
    documentPrefix: ACTIVE_CONFIG.embedding.documentPrefix,
  };
}
