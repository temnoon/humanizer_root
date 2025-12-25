/**
 * Archive Parsers
 *
 * Reclaim your words from wherever they've been scattered
 */

export { parseChatGPT, isChatGPTArchive } from './chatgpt.js';
export { parseFacebook, isFacebookArchive } from './facebook.js';

import { parseChatGPT, isChatGPTArchive } from './chatgpt.js';
import { parseFacebook, isFacebookArchive } from './facebook.js';
import type { ParsedArchive } from '../types/index.js';
import type { ArchiveType } from '@humanizer/core';

/**
 * Auto-detect archive type and parse
 */
export async function parseArchive(path: string): Promise<ParsedArchive> {
  const type = detectArchiveType(path);

  switch (type) {
    case 'chatgpt':
      return parseChatGPT(path);
    case 'facebook':
      return parseFacebook(path);
    default:
      throw new Error(`Unknown archive type at ${path}`);
  }
}

/**
 * Detect what type of archive a path contains
 */
export function detectArchiveType(path: string): ArchiveType {
  if (isChatGPTArchive(path)) return 'chatgpt';
  if (isFacebookArchive(path)) return 'facebook';
  return 'unknown';
}
