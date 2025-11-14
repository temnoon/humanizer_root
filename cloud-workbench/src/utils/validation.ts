/**
 * Validation utilities for transformation pre-checks
 */

/**
 * Validate that Canvas has content before attempting transformation
 * @param text - Content from Canvas
 * @param minLength - Minimum character count (default: 10)
 * @returns Error message if invalid, null if valid
 */
export function validateCanvasContent(text: string | null, minLength: number = 10): string | null {
  if (!text || text.trim().length === 0) {
    return 'No content in Canvas. Please load text before transforming.';
  }

  if (text.trim().length < minLength) {
    return `Content too short (${text.trim().length} characters). Need at least ${minLength} characters for meaningful transformation.`;
  }

  return null; // Valid
}

/**
 * Validate content length against maximum
 * @param text - Content from Canvas
 * @param maxLength - Maximum character count
 * @returns Error message if invalid, null if valid
 */
export function validateContentLength(text: string, maxLength: number): string | null {
  if (text.length > maxLength) {
    return `Content too long (${text.length} characters). Maximum is ${maxLength} characters.`;
  }

  return null;
}

/**
 * Combined validation for transformation requests
 * @param text - Content from Canvas
 * @param options - Validation options
 * @returns Error message if invalid, null if valid
 */
export function validateTransformation(
  text: string | null,
  options: { minLength?: number; maxLength?: number } = {}
): string | null {
  const { minLength = 10, maxLength } = options;

  // Check for content
  const contentError = validateCanvasContent(text, minLength);
  if (contentError) return contentError;

  // Check max length if specified
  if (maxLength) {
    const lengthError = validateContentLength(text!, maxLength);
    if (lengthError) return lengthError;
  }

  return null; // Valid
}
