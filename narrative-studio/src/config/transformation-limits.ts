/**
 * Transformation Character Limits
 *
 * These limits match the backend validation in:
 * workers/npe-api/src/routes/transformations.ts
 *
 * Tier-based limits allow higher tiers to process larger texts.
 * When chunking is enabled, texts exceeding limits are processed in segments.
 */

export type TransformationType =
  | 'computer-humanizer'
  | 'persona'
  | 'style'
  | 'namespace'
  | 'round-trip'
  | 'ai-detection';

export type UserTier = 'free' | 'member' | 'pro' | 'premium' | 'admin';

/**
 * Character limits per transformation type and user tier
 * Structure: { [transformationType]: { [tier]: charLimit } }
 *
 * IMPORTANT: These must match backend limits in:
 * workers/npe-api/src/routes/transformations.ts
 *
 * Current backend limits (as of Dec 2025):
 * - Persona: 10,000 chars
 * - Style: 10,000 chars
 * - Round-trip: 5,000 chars
 * - Namespace: 10,000 chars
 * - Computer-humanizer: 10,000 chars (same as persona)
 * - AI detection: 50,000 chars (GPTZero)
 *
 * For higher tiers, chunking is enabled to process larger texts.
 */
export const TRANSFORMATION_CHAR_LIMITS: Record<TransformationType, Record<UserTier, number>> = {
  'computer-humanizer': {
    // Backend limit: 10,000 per request
    // Chunking allows larger texts for paid tiers
    free: 10000,
    member: 10000,  // Same as backend, chunking available
    pro: 10000,     // Same as backend, chunking available
    premium: 10000, // Same as backend, chunking available
    admin: 10000,   // Same as backend, chunking available
  },
  persona: {
    // Backend limit: 10,000 per request
    free: 10000,
    member: 10000,
    pro: 10000,
    premium: 10000,
    admin: 10000,
  },
  style: {
    // Backend limit: 10,000 per request (matches persona)
    free: 10000,
    member: 10000,
    pro: 10000,
    premium: 10000,
    admin: 10000,
  },
  namespace: {
    // Backend limit: 10,000 per request
    free: 10000,
    member: 10000,
    pro: 10000,
    premium: 10000,
    admin: 10000,
  },
  'round-trip': {
    // Backend limit: 5,000 per request
    free: 5000,
    member: 5000,
    pro: 5000,
    premium: 5000,
    admin: 5000,
  },
  'ai-detection': {
    // Backend limit: 50,000 (GPTZero)
    free: 50000,
    member: 50000,
    pro: 50000,
    premium: 50000,
    admin: 50000,
  },
};

/**
 * Minimum chunk size for chunked transformations (in characters)
 * Must be at least this size to ensure coherent output
 * ~1000 words ≈ 5000-6000 characters
 */
export const MIN_CHUNK_SIZE = 4000;

/**
 * Minimum word count for any transformation
 * Backend requires at least 20 words
 */
export const MIN_WORD_COUNT = 20;

/**
 * Overlap between chunks to maintain context (in characters)
 * This is the number of characters that will be shared between adjacent chunks
 * to maintain coherence at boundaries. ~50 words ≈ 300 chars.
 */
export const CHUNK_OVERLAP = 300;

/**
 * Get the character limit for a given transformation type and user tier
 */
export function getCharLimit(
  transformationType: TransformationType,
  userTier: UserTier = 'free'
): number {
  const tierLimits = TRANSFORMATION_CHAR_LIMITS[transformationType];
  if (!tierLimits) {
    console.warn(`Unknown transformation type: ${transformationType}, using 5000 char limit`);
    return 5000;
  }
  return tierLimits[userTier] || tierLimits.free;
}

/**
 * Check if text exceeds the limit for a transformation type and tier
 */
export function exceedsLimit(
  text: string,
  transformationType: TransformationType,
  userTier: UserTier = 'free'
): boolean {
  return text.length > getCharLimit(transformationType, userTier);
}

/**
 * Validate text length and return an error message if exceeded
 * Returns null if within limits
 */
export function validateTextLength(
  text: string,
  transformationType: TransformationType,
  userTier: UserTier = 'free'
): { error: string; limit: number; current: number; canChunk: boolean } | null {
  const limit = getCharLimit(transformationType, userTier);
  const current = text.length;

  if (current <= limit) {
    return null;
  }

  // Check if chunking is available for this user tier
  const canChunk = userTier !== 'free';

  const tierUpgrade = canChunk
    ? ''
    : ' Upgrade to Pro for chunked processing of larger texts.';

  return {
    error: `Text too long (${current.toLocaleString()} chars). Limit: ${limit.toLocaleString()} chars for ${userTier} tier.${tierUpgrade}`,
    limit,
    current,
    canChunk,
  };
}

/**
 * Format a user-friendly message about character limits
 */
export function formatLimitMessage(
  transformationType: TransformationType,
  userTier: UserTier = 'free'
): string {
  const limit = getCharLimit(transformationType, userTier);
  return `Max ${limit.toLocaleString()} characters for ${userTier} tier`;
}

/**
 * Calculate optimal chunk size for a given text and limit
 */
export function calculateChunkSize(textLength: number, limit: number): number {
  // Aim for chunks that are 80% of the limit to leave room for processing
  const optimalSize = Math.floor(limit * 0.8);

  // But not smaller than minimum
  return Math.max(optimalSize, MIN_CHUNK_SIZE);
}

/**
 * Count words in a text string
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Validate that text has minimum word count
 * Returns error message if below minimum, null if valid
 */
export function validateMinWordCount(text: string): string | null {
  const wordCount = countWords(text);
  if (wordCount < MIN_WORD_COUNT) {
    return `Text must be at least ${MIN_WORD_COUNT} words (currently ${wordCount} words)`;
  }
  return null;
}

/**
 * Split text into chunks for processing
 * Tries to split at paragraph or sentence boundaries
 * Ensures each chunk has at least MIN_WORD_COUNT words
 *
 * FIXED: Now validates word count DURING chunk creation and extends chunks
 * as needed to meet minimum word requirement before adding them.
 */
export function splitIntoChunks(
  text: string,
  chunkSize: number,
  overlap: number = CHUNK_OVERLAP
): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + chunkSize, text.length);

    // If not at the end, try to find a good break point
    if (endIndex < text.length) {
      // First try to break at paragraph
      const paragraphBreak = text.lastIndexOf('\n\n', endIndex);
      if (paragraphBreak > startIndex + MIN_CHUNK_SIZE) {
        endIndex = paragraphBreak + 2; // Include the newlines
      } else {
        // Try to break at sentence
        const sentenceBreak = text.lastIndexOf('. ', endIndex);
        if (sentenceBreak > startIndex + MIN_CHUNK_SIZE) {
          endIndex = sentenceBreak + 2; // Include ". "
        } else {
          // Try to break at any newline
          const lineBreak = text.lastIndexOf('\n', endIndex);
          if (lineBreak > startIndex + MIN_CHUNK_SIZE) {
            endIndex = lineBreak + 1;
          }
          // Otherwise just break at chunkSize
        }
      }
    }

    let chunk = text.slice(startIndex, endIndex);

    // CRITICAL FIX: Extend chunk if it doesn't meet minimum word count
    // Keep extending until we have enough words or reach end of text
    while (countWords(chunk) < MIN_WORD_COUNT && endIndex < text.length) {
      // Try to extend to next sentence boundary
      const nextSentence = text.indexOf('. ', endIndex);
      if (nextSentence > 0 && nextSentence < endIndex + 500) {
        endIndex = nextSentence + 2;
      } else {
        // Try next paragraph
        const nextParagraph = text.indexOf('\n\n', endIndex);
        if (nextParagraph > 0 && nextParagraph < endIndex + 500) {
          endIndex = nextParagraph + 2;
        } else {
          // Just extend by a fixed amount
          endIndex = Math.min(endIndex + 200, text.length);
        }
      }
      chunk = text.slice(startIndex, endIndex);
    }

    chunks.push(chunk);

    // Advance to next chunk position
    // Move forward by (chunk length - overlap) to create proper overlap
    // But ensure we always advance by at least MIN_CHUNK_SIZE to prevent tiny increments
    const chunkLength = endIndex - startIndex;
    const advancement = Math.max(chunkLength - overlap, MIN_CHUNK_SIZE);
    startIndex = startIndex + advancement;

    // Prevent infinite loop - if we're near the end, break
    if (startIndex >= text.length - overlap) {
      break;
    }
  }

  // Post-process: merge any remaining short chunks
  // This handles edge cases the extension loop might miss
  return mergeShortChunks(chunks);
}

/**
 * Merge chunks that have fewer than MIN_WORD_COUNT words with adjacent chunks
 *
 * FIXED: Now does multiple passes to ensure NO chunk is below minimum word count
 */
function mergeShortChunks(chunks: string[]): string[] {
  if (chunks.length <= 1) {
    return chunks;
  }

  let result: string[] = [];
  let accumulator = '';

  // First pass: forward merge
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const combined = accumulator + (accumulator ? '\n\n' : '') + chunk;
    const wordCount = countWords(combined);

    if (wordCount >= MIN_WORD_COUNT) {
      // This chunk (possibly combined with accumulator) is big enough
      result.push(combined);
      accumulator = '';
    } else if (i === chunks.length - 1) {
      // Last chunk and still too short - merge with previous if possible
      if (result.length > 0) {
        const lastResult = result.pop()!;
        result.push(lastResult + '\n\n' + combined);
      } else {
        // No previous chunk to merge with, just add it
        // (This means the entire text is < MIN_WORD_COUNT, which shouldn't happen
        // as we validate before chunking, but handle gracefully)
        result.push(combined);
      }
      accumulator = '';
    } else {
      // Chunk is too short, accumulate and try to merge with next
      accumulator = combined;
    }
  }

  // Handle any remaining accumulator
  if (accumulator) {
    if (result.length > 0) {
      const lastResult = result.pop()!;
      result.push(lastResult + '\n\n' + accumulator);
    } else {
      result.push(accumulator);
    }
  }

  // CRITICAL FIX: Second pass - verify ALL chunks meet minimum and merge any that don't
  // This catches edge cases the forward pass misses
  let hasShortChunks = result.some(chunk => countWords(chunk) < MIN_WORD_COUNT);
  let iterations = 0;
  const maxIterations = 10; // Safety limit

  while (hasShortChunks && result.length > 1 && iterations < maxIterations) {
    iterations++;
    const newResult: string[] = [];

    for (let i = 0; i < result.length; i++) {
      const chunk = result[i];
      const wordCount = countWords(chunk);

      if (wordCount < MIN_WORD_COUNT) {
        // Merge with previous chunk if possible, otherwise next
        if (newResult.length > 0) {
          const lastChunk = newResult.pop()!;
          newResult.push(lastChunk + '\n\n' + chunk);
        } else if (i < result.length - 1) {
          // Merge with next chunk
          const nextChunk = result[i + 1];
          newResult.push(chunk + '\n\n' + nextChunk);
          i++; // Skip the next chunk since we already merged it
        } else {
          // No chunk to merge with, just add it (shouldn't happen)
          newResult.push(chunk);
        }
      } else {
        newResult.push(chunk);
      }
    }

    result = newResult;
    hasShortChunks = result.some(chunk => countWords(chunk) < MIN_WORD_COUNT);
  }

  // Log warning if we still have short chunks (shouldn't happen unless text is very sparse)
  if (hasShortChunks) {
    const shortChunks = result.filter(chunk => countWords(chunk) < MIN_WORD_COUNT);
    console.warn(
      `[splitIntoChunks] ${shortChunks.length} chunk(s) still below ${MIN_WORD_COUNT} words after merging. ` +
      `This may indicate very sparse text content.`
    );
  }

  return result;
}
