/**
 * Chunked Transformation Service
 *
 * Handles transformations of large texts by splitting them into chunks,
 * processing each chunk, and reassembling the results.
 *
 * Only available for Pro/Premium/Admin tiers.
 */

import type { TransformConfig, TransformResult, TransformationType } from '../types';
import { runTransform } from './transformationService';
import {
  getCharLimit,
  splitIntoChunks,
  calculateChunkSize,
  CHUNK_OVERLAP,
  type UserTier,
} from '../config/transformation-limits';

export interface ChunkedTransformOptions {
  /** User tier for determining chunk size limits */
  userTier: UserTier;
  /** Callback for progress updates */
  onProgress?: (current: number, total: number) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface ChunkedTransformResult extends TransformResult {
  /** Whether chunking was used */
  chunked: boolean;
  /** Number of chunks processed */
  chunkCount: number;
  /** Per-chunk results for debugging */
  chunkResults?: TransformResult[];
}

/**
 * Check if chunked transformation is available for the user tier
 */
export function canUseChunkedTransform(userTier: UserTier): boolean {
  return userTier !== 'free';
}

/**
 * Check if text needs chunking for a given transformation type and tier
 */
export function needsChunking(
  text: string,
  transformationType: TransformationType,
  userTier: UserTier
): boolean {
  const limit = getCharLimit(transformationType as any, userTier);
  return text.length > limit;
}

/**
 * Run a transformation with automatic chunking if needed
 */
export async function runChunkedTransform(
  config: TransformConfig,
  text: string,
  options: ChunkedTransformOptions
): Promise<ChunkedTransformResult> {
  const { userTier, onProgress, signal } = options;

  // Check if chunking is available
  if (!canUseChunkedTransform(userTier)) {
    throw new Error('Chunked transformations require Pro tier or higher. Please upgrade or use shorter text.');
  }

  // Get the limit for this transformation type
  const limit = getCharLimit(config.type as any, userTier);

  // If text is within limit, run normally
  if (text.length <= limit) {
    const result = await runTransform(config, text);
    return {
      ...result,
      chunked: false,
      chunkCount: 1,
    };
  }

  // Calculate optimal chunk size (80% of limit to leave room)
  const chunkSize = calculateChunkSize(text.length, limit);

  // Split text into chunks
  const chunks = splitIntoChunks(text, chunkSize, CHUNK_OVERLAP);

  console.log(`[ChunkedTransform] Processing ${chunks.length} chunks for ${config.type}`);

  const chunkResults: TransformResult[] = [];
  const transformedChunks: string[] = [];

  // Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Transformation cancelled');
    }

    // Report progress
    onProgress?.(i + 1, chunks.length);

    try {
      const chunkResult = await runTransform(config, chunks[i]);
      chunkResults.push(chunkResult);
      transformedChunks.push(chunkResult.transformed);

      console.log(`[ChunkedTransform] Chunk ${i + 1}/${chunks.length} complete`);
    } catch (error) {
      console.error(`[ChunkedTransform] Chunk ${i + 1} failed:`, error);
      throw new Error(`Chunk ${i + 1}/${chunks.length} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Reassemble the transformed text
  // We need to handle the overlap - take unique portions of each chunk
  const assembled = reassembleChunks(transformedChunks, chunks);

  // Aggregate metadata from all chunks
  const aggregatedMetadata = aggregateMetadata(chunkResults);

  return {
    transformation_id: crypto.randomUUID(),
    original: text,
    transformed: assembled,
    metadata: {
      ...aggregatedMetadata,
      chunked: true,
      chunkCount: chunks.length,
    },
    chunked: true,
    chunkCount: chunks.length,
    chunkResults,
  };
}

/**
 * Reassemble transformed chunks into a single text
 *
 * This is tricky because:
 * 1. Chunks overlap in the original text
 * 2. Transformations may change length/structure
 * 3. We need to avoid duplicate content
 *
 * Strategy: For simplicity, we just concatenate chunks with a marker
 * and let the LLM handle natural transitions. The overlap helps
 * maintain context but we don't try to dedupe the overlap in output.
 */
function reassembleChunks(transformedChunks: string[], originalChunks: string[]): string {
  if (transformedChunks.length === 1) {
    return transformedChunks[0];
  }

  // Simple approach: join with paragraph break
  // The overlap in input provides context but output chunks are independent
  return transformedChunks.join('\n\n');
}

/**
 * Aggregate metadata from multiple chunk results
 */
function aggregateMetadata(results: TransformResult[]): Record<string, any> {
  if (results.length === 0) return {};

  const metadata: Record<string, any> = {};

  // For numeric metrics, we can average them
  const numericKeys = [
    'aiConfidenceBefore',
    'aiConfidenceAfter',
    'burstinessBefore',
    'burstinessAfter',
    'tellWordsRemoved',
    'processingTime',
  ];

  for (const key of numericKeys) {
    const values = results
      .map((r) => r.metadata?.[key])
      .filter((v): v is number => typeof v === 'number');

    if (values.length > 0) {
      metadata[key] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }

  // For arrays (like tellWordsFound), concatenate unique values
  const arrayKeys = ['tellWordsFound'];
  for (const key of arrayKeys) {
    const allValues = results.flatMap((r) => r.metadata?.[key] || []);
    metadata[key] = [...new Set(allValues)];
  }

  // Sum processing times if available
  const processingTimes = results
    .map((r) => r.metadata?.processingTime)
    .filter((v): v is number => typeof v === 'number');

  if (processingTimes.length > 0) {
    metadata.totalProcessingTime = processingTimes.reduce((a, b) => a + b, 0);
  }

  // Use the model from the first result
  metadata.modelUsed = results[0]?.metadata?.modelUsed;

  return metadata;
}
