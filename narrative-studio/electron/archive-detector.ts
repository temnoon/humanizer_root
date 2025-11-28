import { existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Archive detection result
 */
export interface ArchiveDetectionResult {
  type: 'zip' | 'openai-export' | 'humanizer-archive' | 'unknown';
  needsExtraction: boolean;
  needsImport: boolean;
  path: string;
  estimatedSize?: number;
  conversationCount?: number;
}

/**
 * Detect the type of archive from a path
 */
export async function detectArchiveType(archivePath: string): Promise<ArchiveDetectionResult> {
  if (!existsSync(archivePath)) {
    return {
      type: 'unknown',
      needsExtraction: false,
      needsImport: false,
      path: archivePath
    };
  }

  const stats = statSync(archivePath);

  // Check if it's a ZIP file
  if (stats.isFile() && archivePath.toLowerCase().endsWith('.zip')) {
    const fileSize = stats.size;
    return {
      type: 'zip',
      needsExtraction: true,
      needsImport: true,
      path: archivePath,
      estimatedSize: fileSize
    };
  }

  // Check if it's a directory
  if (stats.isDirectory()) {
    // Check for Humanizer archive markers
    const hasEmbeddingsDb = existsSync(path.join(archivePath, '.embeddings.db'));
    const hasArchiveConfig = existsSync(path.join(archivePath, 'archive-config.json'));

    if (hasEmbeddingsDb || hasArchiveConfig) {
      // Count conversations in an existing archive
      const conversationCount = countConversations(archivePath);
      return {
        type: 'humanizer-archive',
        needsExtraction: false,
        needsImport: false,
        path: archivePath,
        conversationCount
      };
    }

    // Check for OpenAI export markers
    const hasConversationsJson = existsSync(path.join(archivePath, 'conversations.json'));
    const hasDatedFolders = checkForDatedFolders(archivePath);

    if (hasConversationsJson || hasDatedFolders) {
      const conversationCount = await countOpenAIConversations(archivePath);
      return {
        type: 'openai-export',
        needsExtraction: false,
        needsImport: true,
        path: archivePath,
        conversationCount
      };
    }
  }

  return {
    type: 'unknown',
    needsExtraction: false,
    needsImport: false,
    path: archivePath
  };
}

/**
 * Check if directory contains dated folders (YYYY-MM-DD pattern)
 */
function checkForDatedFolders(dirPath: string): boolean {
  try {
    const entries = readdirSync(dirPath);
    const datePattern = /^\d{4}-\d{2}-\d{2}/;
    return entries.some(entry => datePattern.test(entry));
  } catch {
    return false;
  }
}

/**
 * Count conversations in a Humanizer archive
 */
function countConversations(archivePath: string): number {
  try {
    const entries = readdirSync(archivePath);
    // Count directories that look like conversation folders
    return entries.filter(entry => {
      const fullPath = path.join(archivePath, entry);
      return statSync(fullPath).isDirectory() && !entry.startsWith('.');
    }).length;
  } catch {
    return 0;
  }
}

/**
 * Count conversations in an OpenAI export
 */
async function countOpenAIConversations(dirPath: string): Promise<number> {
  const conversationsPath = path.join(dirPath, 'conversations.json');

  if (existsSync(conversationsPath)) {
    try {
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(conversationsPath, 'utf-8');
      const data = JSON.parse(content);
      return Array.isArray(data) ? data.length : 0;
    } catch {
      return 0;
    }
  }

  // Count dated folders
  try {
    const entries = readdirSync(dirPath);
    const datePattern = /^\d{4}-\d{2}-\d{2}/;
    return entries.filter(entry => datePattern.test(entry)).length;
  } catch {
    return 0;
  }
}

/**
 * Validate that a path is a valid archive location
 */
export function isValidArchiveLocation(archivePath: string): { valid: boolean; reason?: string } {
  if (!existsSync(archivePath)) {
    return { valid: false, reason: 'Path does not exist' };
  }

  const stats = statSync(archivePath);
  if (!stats.isDirectory()) {
    return { valid: false, reason: 'Path is not a directory' };
  }

  // Check if writable
  try {
    const testPath = path.join(archivePath, '.write-test');
    const { writeFileSync, unlinkSync } = require('fs');
    writeFileSync(testPath, '');
    unlinkSync(testPath);
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Directory is not writable' };
  }
}
