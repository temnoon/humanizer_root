// ============================================================
// PARSER UTILITY FUNCTIONS
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import AdmZip from 'adm-zip';
import { format } from 'date-fns';

/**
 * Recursively extract ZIP file, handling nested ZIPs
 * Uses native tools for large files (>100MB) for better memory efficiency
 * On macOS, uses `ditto` (same as Archive Utility) for best compatibility
 */
export async function extractZip(zipPath: string, outputDir: string): Promise<void> {
  const stats = fs.statSync(zipPath);
  const fileSizeMB = stats.size / (1024 * 1024);
  const fileSizeGB = stats.size / (1024 * 1024 * 1024);

  // For large files (>100MB), use native tools for better memory efficiency
  if (fileSizeMB > 100) {
    console.log(`Large archive detected (${fileSizeMB.toFixed(0)}MB), using native extraction...`);

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Detect platform
    const isMacOS = process.platform === 'darwin';

    try {
      if (isMacOS) {
        // On macOS, use ditto (same as Archive Utility) - handles edge cases better
        console.log('Using ditto (macOS Archive Utility method)...');
        await execAsync(`ditto -x -k "${zipPath}" "${outputDir}"`);
      } else {
        // On Linux/Windows, use unzip
        await execAsync(`unzip -q -o "${zipPath}" -d "${outputDir}"`);
      }
    } catch (err: any) {
      // ditto failed, try unzip as fallback
      if (isMacOS) {
        console.warn('ditto failed, trying unzip...', err.message);
        try {
          // unzip with -qq (very quiet) to suppress warnings that aren't actual errors
          const { stdout, stderr } = await execAsync(
            `unzip -o "${zipPath}" -d "${outputDir}" 2>&1 || true`
          );

          // Check if extraction actually worked by looking for files
          const files = fs.readdirSync(outputDir);
          if (files.length === 0) {
            throw new Error('Extraction produced no files');
          }
          console.log(`Extraction completed with warnings, ${files.length} top-level items extracted`);
        } catch (unzipErr: any) {
          // Both failed, throw helpful error
          throw new Error(
            `ZIP extraction failed (${fileSizeGB.toFixed(1)}GB file). ` +
            `Try extracting manually with Archive Utility first. ` +
            `Error: ${err.message}`
          );
        }
      } else {
        // For files >2GB on non-macOS, adm-zip will fail
        if (fileSizeGB > 2) {
          throw new Error(
            `ZIP extraction failed for large file (${fileSizeGB.toFixed(1)}GB). ` +
            `The ZIP may be corrupted or have an invalid structure. ` +
            `Error: ${err.message}`
          );
        }

        // For smaller files, try fallback to adm-zip
        console.warn('Native unzip failed, falling back to adm-zip:', err.message);
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(outputDir, true);
      }
    }
  } else {
    // For smaller files (<100MB), use adm-zip (faster for small files)
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(outputDir, true);
  }

  // Check for nested ZIPs and extract them recursively
  const findNestedZips = (dir: string): string[] => {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findNestedZips(fullPath));
      } else if (entry.name.toLowerCase().endsWith('.zip')) {
        results.push(fullPath);
      }
    }
    return results;
  };

  const nestedZips = findNestedZips(outputDir);
  for (const nestedZipPath of nestedZips) {
    const nestedOutputDir = path.dirname(nestedZipPath);
    try {
      await extractZip(nestedZipPath, nestedOutputDir);
      // Remove the nested ZIP after extraction
      fs.unlinkSync(nestedZipPath);
    } catch (err) {
      console.warn(`Failed to extract nested ZIP: ${nestedZipPath}`, err);
    }
  }
}

/**
 * Recursively find all files matching a pattern
 */
export function findFiles(
  dir: string,
  pattern: RegExp | string,
  results: string[] = []
): string[] {
  if (!fs.existsSync(dir)) {
    return results;
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findFiles(filePath, pattern, results);
    } else {
      const matches =
        pattern instanceof RegExp
          ? pattern.test(file)
          : file.includes(pattern);

      if (matches) {
        results.push(filePath);
      }
    }
  }

  return results;
}

/**
 * Calculate SHA-256 hash of file content
 */
export function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Calculate hash of buffer/string
 */
export function hashContent(content: Buffer | string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Sanitize string for use as filename/folder name
 */
export function sanitizeFilename(name: string, maxLength: number = 100): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Replace invalid chars
    .replace(/\s+/g, '_') // Replace whitespace with underscores
    .replace(/_{2,}/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, '') // Trim leading/trailing underscores
    .slice(0, maxLength) // Limit length
    .toLowerCase(); // Lowercase for consistency
}

/**
 * Format timestamp as YYYY-MM-DD
 */
export function formatDate(timestamp: number): string {
  return format(new Date(timestamp * 1000), 'yyyy-MM-dd');
}

/**
 * Generate unique folder name: YYYY-MM-DD_title_index
 */
export function generateFolderName(
  title: string,
  timestamp: number,
  index: number
): string {
  const date = formatDate(timestamp);
  const safeTitle = sanitizeFilename(title, 50);
  const paddedIndex = String(index).padStart(5, '0');
  return `${date}_${safeTitle}_${paddedIndex}`;
}

/**
 * Parse ISO 8601 timestamp to Unix timestamp
 */
export function parseISOTimestamp(isoString: string): number {
  return Math.floor(new Date(isoString).getTime() / 1000);
}

/**
 * Get file size in bytes
 */
export function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Get file extension (lowercase, with dot)
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Check if path is a media file
 */
export function isMediaFile(filePath: string): boolean {
  const mediaExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff',
    '.pdf', '.svg',
    '.mp3', '.wav', '.m4a', '.ogg', '.flac',
    '.mp4', '.mov', '.avi', '.mkv', '.webm'
  ]);

  return mediaExtensions.has(getFileExtension(filePath));
}

/**
 * Ensure directory exists, create if not
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Copy file with optional rename
 */
export function copyFile(src: string, dest: string): void {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Extract file ID from various URL formats
 * - file-service://file-ABC123
 * - sediment://file_abc123
 * - file://filename.ext
 */
export function extractFileId(url: string): string | null {
  // file-service://file-ABC123
  const fileServiceMatch = url.match(/file-service:\/\/file-([A-Za-z0-9]+)/);
  if (fileServiceMatch) {
    return `file-${fileServiceMatch[1]}`;
  }

  // sediment://file_abc123
  const sedimentMatch = url.match(/sediment:\/\/file_([a-f0-9]+)/);
  if (sedimentMatch) {
    return `file_${sedimentMatch[1]}`;
  }

  // file://filename.ext
  const fileMatch = url.match(/file:\/\/(.+)/);
  if (fileMatch) {
    return path.basename(fileMatch[1]);
  }

  return null;
}

/**
 * Read JSON file with error handling
 */
export function readJSON<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    console.error(`Failed to read JSON: ${filePath}`, err);
    return null;
  }
}

/**
 * Write JSON file with pretty formatting
 */
export function writeJSON(filePath: string, data: any): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Check if directory exists and is not empty
 */
export function isDirectoryNonEmpty(dirPath: string): boolean {
  if (!fs.existsSync(dirPath)) {
    return false;
  }

  const files = fs.readdirSync(dirPath);
  return files.length > 0;
}
