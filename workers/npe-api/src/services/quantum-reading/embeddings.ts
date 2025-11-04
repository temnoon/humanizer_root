/**
 * Embeddings Service for Quantum Reading
 *
 * Integrates with Cloudflare Workers AI for sentence embeddings
 * Model: @cf/baai/bge-base-en-v1.5 (768 dimensions)
 */

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  model: string;
}

/**
 * Generate sentence embedding using Workers AI
 *
 * @param ai - Cloudflare AI binding
 * @param text - Text to embed
 * @returns Embedding vector (768 dimensions)
 */
export async function generateEmbedding(
  ai: any, // Ai binding type from Cloudflare Workers
  text: string
): Promise<EmbeddingResult> {
  const MODEL_NAME = '@cf/baai/bge-base-en-v1.5';

  try {
    const response = await ai.run(MODEL_NAME, {
      text: text.trim()
    });

    // Workers AI returns: { data: [[embedding]], shape: [1, 768] }
    const embedding = response.data[0];

    if (!Array.isArray(embedding)) {
      throw new Error('Invalid embedding format from Workers AI');
    }

    return {
      embedding,
      dimensions: embedding.length,
      model: MODEL_NAME
    };
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate embeddings for multiple sentences in batch
 *
 * @param ai - Cloudflare AI binding
 * @param sentences - Array of sentences
 * @returns Array of embedding results
 */
export async function generateEmbeddingsBatch(
  ai: any,
  sentences: string[]
): Promise<EmbeddingResult[]> {
  // Process in parallel (Workers AI has rate limits, but we'll handle that)
  const results = await Promise.all(
    sentences.map(sentence => generateEmbedding(ai, sentence))
  );

  return results;
}

/**
 * Split text into sentences
 * Simple sentence splitter (could be improved with NLP library)
 *
 * @param text - Full text to split
 * @returns Array of sentences
 */
export function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace and capital letter
  // This is a simple heuristic, not perfect but works for most cases
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences;
}

/**
 * Normalize embedding vector to unit length
 * Already done by Workers AI, but included for completeness
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
  if (norm === 0) return embedding;
  return embedding.map(x => x / norm);
}

/**
 * Compute cosine similarity between two embeddings
 * Useful for measuring semantic distance
 */
export function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have same dimensions');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}
