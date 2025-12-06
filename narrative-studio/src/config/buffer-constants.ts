/**
 * Buffer Constants
 * Centralized IDs, types, and patterns for session buffers
 */

/**
 * Well-known buffer IDs
 */
export const BUFFER_IDS = {
  ORIGINAL: 'buffer-0',
  FIRST_TRANSFORM: 'buffer-1'
} as const;

/**
 * Buffer types
 */
export const BUFFER_TYPES = {
  ORIGINAL: 'original',
  TRANSFORMATION: 'transformation',
  ANALYSIS: 'analysis',
  EDITED: 'edited'
} as const;

export type BufferType = typeof BUFFER_TYPES[keyof typeof BUFFER_TYPES];

/**
 * Default display names by buffer type
 */
export const BUFFER_DISPLAY_NAMES = {
  [BUFFER_TYPES.ORIGINAL]: 'Original',
  [BUFFER_TYPES.TRANSFORMATION]: 'Transformed',
  [BUFFER_TYPES.ANALYSIS]: 'Analysis',
  [BUFFER_TYPES.EDITED]: 'Edited'
} as const;

/**
 * Check if a buffer ID represents the original buffer
 *
 * @param bufferId - Buffer identifier to check
 * @returns True if this is the original buffer (buffer-0)
 */
export function isOriginalBuffer(bufferId: string): boolean {
  return bufferId === BUFFER_IDS.ORIGINAL;
}

/**
 * Get the source buffer ID with fallback logic
 *
 * Priority order:
 * 1. Provided sourceBufferId
 * 2. Provided fallback
 * 3. Original buffer (buffer-0)
 *
 * @param sourceBufferId - Explicitly provided source buffer ID
 * @param fallback - Fallback buffer ID (e.g., active buffer)
 * @returns Source buffer ID to use
 */
export function getSourceBuffer(
  sourceBufferId?: string | null,
  fallback?: string | null
): string {
  return sourceBufferId || fallback || BUFFER_IDS.ORIGINAL;
}

/**
 * Check if buffer can be closed
 * Original buffer (buffer-0) cannot be closed
 *
 * @param bufferId - Buffer identifier to check
 * @returns True if buffer can be closed
 */
export function canCloseBuffer(bufferId: string): boolean {
  return !isOriginalBuffer(bufferId);
}

/**
 * Get fallback active buffer ID when current buffer is closed
 *
 * @param buffers - Array of buffer IDs
 * @param closedBufferId - ID of buffer being closed
 * @returns Next active buffer ID (last buffer, or original if none)
 */
export function getNextActiveBuffer(
  buffers: Array<{ bufferId: string }>,
  closedBufferId: string
): string {
  const remaining = buffers.filter(b => b.bufferId !== closedBufferId);
  return remaining.length > 0
    ? remaining[remaining.length - 1].bufferId
    : BUFFER_IDS.ORIGINAL;
}

/**
 * Generate a unique buffer ID
 *
 * @returns New buffer ID with timestamp
 */
export function generateBufferId(): string {
  return `buffer-${Date.now()}`;
}

/**
 * Archive reference prefix for buffer sources
 */
export const ARCHIVE_REF_PREFIX = 'archive:' as const;

/**
 * Narrative Studio source identifier
 */
export const NARRATIVE_STUDIO_SOURCE = 'narrative-studio' as const;

/**
 * Format archive reference for buffer source tracking
 *
 * @param archiveName - Archive identifier
 * @param messageId - Message identifier (optional)
 * @returns Formatted archive reference
 */
export function formatArchiveRef(archiveName: string, messageId?: string): string {
  return `${ARCHIVE_REF_PREFIX}${archiveName}:${messageId || 'unknown'}`;
}
