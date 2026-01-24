/**
 * Base Content Adapter
 *
 * Abstract base class providing common functionality for all content adapters.
 * Handles configuration, hashing, encoding, and progress reporting.
 *
 * Subclasses implement:
 * - detect(): Format detection logic
 * - validate(): Validation logic
 * - parseSource(): The actual parsing implementation
 * - getSourceMetadata(): Metadata extraction
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { getConfigManager } from '../config/index.js';
import type { ConfigManager } from '../config/types.js';
import type {
  ContentAdapter,
  AdapterSource,
  DetectionResult,
  ValidationResult,
  ParseOptions,
  ParseStats,
  ImportedNode,
  ImportProgress,
  SourceMetadata,
  ADAPTER_CONFIG,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════
// BASE ADAPTER CLASS
// ═══════════════════════════════════════════════════════════════════

/**
 * Abstract base class for content adapters
 */
export abstract class BaseAdapter implements ContentAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly version: string;
  abstract readonly contentTypes: string[];
  abstract readonly supportedExtensions: string[];

  protected configManager: ConfigManager;

  // Progress tracking
  protected currentProgress: ImportProgress = {
    phase: 'detecting',
    processed: 0,
    errors: 0,
    warnings: 0,
    elapsedMs: 0,
  };
  protected progressCallback?: (progress: ImportProgress) => void;
  protected startTime: number = 0;

  constructor() {
    this.configManager = getConfigManager();
  }

  // ─────────────────────────────────────────────────────────────────
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ─────────────────────────────────────────────────────────────────

  /**
   * Detect if this adapter can handle the source
   */
  abstract detect(source: AdapterSource): Promise<DetectionResult>;

  /**
   * Validate the source
   */
  abstract validate(source: AdapterSource): Promise<ValidationResult>;

  /**
   * Get metadata about the source
   */
  abstract getSourceMetadata(source: AdapterSource): Promise<SourceMetadata>;

  /**
   * Parse the source - implemented by subclass
   */
  protected abstract parseSource(
    source: AdapterSource,
    options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined>;

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Parse the source and yield content nodes
   *
   * This wraps the subclass implementation with progress tracking
   * and stats collection.
   */
  async *parse(
    source: AdapterSource,
    options: ParseOptions = {}
  ): AsyncGenerator<ImportedNode, ParseStats, undefined> {
    this.startTime = Date.now();
    this.progressCallback = options.onProgress;

    const stats: ParseStats = {
      totalParsed: 0,
      byContentType: {},
      skipped: 0,
      errors: 0,
      warnings: 0,
      mediaCount: 0,
      linkCount: 0,
      durationMs: 0,
    };

    let earliestDate: Date | undefined;
    let latestDate: Date | undefined;

    try {
      this.updateProgress({ phase: 'parsing', processed: 0 });

      let count = 0;
      const limit = options.limit;
      const offset = options.offset ?? 0;

      for await (const node of this.parseSource(source, options)) {
        count++;

        // Handle offset
        if (count <= offset) {
          stats.skipped++;
          continue;
        }

        // Handle limit
        if (limit && stats.totalParsed >= limit) {
          break;
        }

        // Apply filters
        if (options.contentTypes && !options.contentTypes.includes(node.sourceType)) {
          stats.skipped++;
          continue;
        }

        if (options.dateRange) {
          const nodeDate = node.sourceCreatedAt;
          if (nodeDate) {
            if (options.dateRange.start && nodeDate < options.dateRange.start) {
              stats.skipped++;
              continue;
            }
            if (options.dateRange.end && nodeDate > options.dateRange.end) {
              stats.skipped++;
              continue;
            }
          }
        }

        // Update stats
        stats.totalParsed++;
        stats.byContentType[node.sourceType] = (stats.byContentType[node.sourceType] || 0) + 1;

        if (node.media) {
          stats.mediaCount += node.media.length;
        }
        if (node.links) {
          stats.linkCount += node.links.length;
        }

        // Track date range
        if (node.sourceCreatedAt) {
          if (!earliestDate || node.sourceCreatedAt < earliestDate) {
            earliestDate = node.sourceCreatedAt;
          }
          if (!latestDate || node.sourceCreatedAt > latestDate) {
            latestDate = node.sourceCreatedAt;
          }
        }

        // Update progress
        this.updateProgress({
          processed: stats.totalParsed,
          currentItem: node.uri,
        });

        yield node;
      }

      stats.dateRange = {
        earliest: earliestDate,
        latest: latestDate,
      };
      stats.durationMs = Date.now() - this.startTime;

      this.updateProgress({ phase: 'complete' });

      return stats;
    } catch (error) {
      stats.errors++;
      this.updateProgress({
        phase: 'error',
        errors: stats.errors,
      });
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // UTILITY METHODS - Available to subclasses
  // ─────────────────────────────────────────────────────────────────

  /**
   * Hash content for deduplication
   */
  protected hashContent(content: string): string {
    return createHash('sha256')
      .update(content.normalize('NFC'))
      .digest('hex');
  }

  /**
   * Generate a URI for a content node
   */
  protected generateUri(type: string, id: string): string {
    return `content://${this.id}/${type}/${id}`;
  }

  /**
   * Check if a file exists
   */
  protected async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch (error) {
      console.debug('[BaseAdapter] File does not exist:', error);
      return false;
    }
  }

  /**
   * Read a file with encoding detection
   */
  protected async readFile(path: string, encoding?: BufferEncoding): Promise<string> {
    const defaultEncoding = await this.configManager.getOrDefault<BufferEncoding>(
      'limits',
      'adapters.defaultEncoding',
      'utf-8'
    );
    return fs.readFile(path, { encoding: encoding ?? defaultEncoding });
  }

  /**
   * Read a JSON file
   */
  protected async readJson<T>(path: string): Promise<T> {
    const content = await this.readFile(path);
    return JSON.parse(content) as T;
  }

  /**
   * Read a directory
   */
  protected async readDir(path: string): Promise<string[]> {
    return fs.readdir(path);
  }

  /**
   * Check if path is a directory
   */
  protected async isDirectory(path: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path);
      return stat.isDirectory();
    } catch (error) {
      console.debug('[BaseAdapter] Path is not a directory:', error);
      return false;
    }
  }

  /**
   * Get all files matching extensions recursively
   */
  protected async findFiles(
    dir: string,
    extensions: string[],
    recursive: boolean = true
  ): Promise<string[]> {
    const files: string[] = [];

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory() && recursive) {
        const subFiles = await this.findFiles(fullPath, extensions, recursive);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (extensions.includes(ext) || extensions.includes('*')) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Parse a timestamp from various formats
   */
  protected parseTimestamp(value: unknown): Date | undefined {
    if (!value) return undefined;

    // Already a Date
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? undefined : value;
    }

    // Epoch milliseconds (> year 2001)
    if (typeof value === 'number' && value > 1e12) {
      return new Date(value);
    }

    // Epoch seconds
    if (typeof value === 'number' && value > 1e9 && value < 1e12) {
      return new Date(value * 1000);
    }

    // String - try to parse
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    }

    return undefined;
  }

  /**
   * Fix common encoding issues (Facebook/Instagram style)
   */
  protected fixEncoding(text: string): string {
    // Fix Facebook's \u00XX\u00YY UTF-8 encoding issue
    try {
      // Convert \u00XX sequences to actual bytes, then decode as UTF-8
      const bytes = text.replace(/\\u00([0-9a-fA-F]{2})/g, (_, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
      });

      // Check if it's valid UTF-8 that was double-encoded
      const decoded = decodeURIComponent(escape(bytes));
      return decoded;
    } catch (error) {
      console.debug('[BaseAdapter] Unicode decode fallback:', error);
      // If that fails, just return the original
      return text;
    }
  }

  /**
   * Strip JavaScript wrapper from Twitter/other exports
   *
   * Handles patterns like: window.YTD.tweet.part0 = [...]
   */
  protected stripJsWrapper(content: string): string {
    // Find the start of JSON (array or object)
    const arrayStart = content.indexOf('[');
    const objectStart = content.indexOf('{');

    let start = -1;
    if (arrayStart >= 0 && objectStart >= 0) {
      start = Math.min(arrayStart, objectStart);
    } else {
      start = Math.max(arrayStart, objectStart);
    }

    if (start >= 0) {
      return content.slice(start);
    }

    return content;
  }

  /**
   * Update progress and notify callback
   */
  protected updateProgress(update: Partial<ImportProgress>): void {
    const elapsed = Date.now() - this.startTime;

    this.currentProgress = {
      ...this.currentProgress,
      ...update,
      elapsedMs: elapsed,
    };

    // Calculate estimated remaining time
    if (this.currentProgress.total && this.currentProgress.processed > 0) {
      const rate = this.currentProgress.processed / elapsed;
      const remaining = this.currentProgress.total - this.currentProgress.processed;
      this.currentProgress.estimatedRemainingMs = remaining / rate;
      this.currentProgress.percent = Math.round(
        (this.currentProgress.processed / this.currentProgress.total) * 100
      );
    }

    if (this.progressCallback) {
      this.progressCallback(this.currentProgress);
    }
  }

  /**
   * Log a message (can be overridden for custom logging)
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    const prefix = `[${this.id}]`;
    switch (level) {
      case 'debug':
        console.debug(prefix, message, data ?? '');
        break;
      case 'info':
        console.info(prefix, message, data ?? '');
        break;
      case 'warn':
        console.warn(prefix, message, data ?? '');
        this.currentProgress.warnings++;
        break;
      case 'error':
        console.error(prefix, message, data ?? '');
        this.currentProgress.errors++;
        break;
    }
  }
}
