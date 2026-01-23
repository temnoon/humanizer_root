/**
 * Response Normalizer
 *
 * Utilities for extracting structured data from LLM responses.
 */

/**
 * Extract JSON from LLM response
 * Handles markdown code blocks, extra text, etc.
 */
export function extractJson(response: string): string {
  // Try to extract from markdown code blocks
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                    response.match(/```\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }

  // Try to find JSON object
  const objectMatch = response.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  // Try to find JSON array
  const arrayMatch = response.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  // Return as-is
  return response.trim();
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(
  text: string,
  fallback: T
): T {
  try {
    const extracted = extractJson(text);
    return JSON.parse(extracted) as T;
  } catch {
    return fallback;
  }
}

/**
 * Clean response of common LLM artifacts
 */
export function cleanResponse(response: string): string {
  return response
    // Remove "Here's the..." preambles
    .replace(/^(Here's|Here is|I'll|Let me|I will)[^:]*:\s*/i, '')
    // Remove trailing "Let me know..." suffixes
    .replace(/\s*(Let me know|Hope this|Feel free|Is there|Would you)[^.]*\.?\s*$/i, '')
    // Remove excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Normalize a response for JSON extraction
 */
export function normalize(response: string): string {
  return extractJson(cleanResponse(response));
}
