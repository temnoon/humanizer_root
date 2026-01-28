/**
 * Markdown Adapter
 *
 * Parses markdown files with structured frontmatter-style headers.
 * Designed for importing ChromaDB memory exports and general markdown collections.
 *
 * Expected format:
 * ```markdown
 * # Title
 *
 * **Date**: 2025-10-04 16:18:37
 * **Hash**: `abc123...`
 * **Type**: session-handoff
 * **Tags**: handoff, architecture, v1
 * **Metadata**: `{"key": "value"}`
 *
 * ---
 *
 * Content body here...
 * ```
 *
 * Directory structure:
 * - Supports flat directories of .md files
 * - Supports YYYY-MM subdirectories (e.g., 2025-10/, 2025-11/)
 * - INDEX.md and other special files are skipped
 *
 * Output content types:
 * - markdown-document (for standalone files)
 * - markdown-memory (for ChromaDB memory exports)
 */

import { join, basename, dirname } from 'path';
import { randomUUID } from 'crypto';
import { BaseAdapter } from '../base-adapter.js';
import type {
  AdapterSource,
  DetectionResult,
  ValidationResult,
  ParseOptions,
  ImportedNode,
  SourceMetadata,
  ContentLink,
} from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES FOR MARKDOWN EXPORT FORMAT
// ═══════════════════════════════════════════════════════════════════

interface ParsedMarkdown {
  title: string;
  date?: Date;
  hash?: string;
  type?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  content: string;
  filepath: string;
  monthKey?: string;
}

// ═══════════════════════════════════════════════════════════════════
// MARKDOWN ADAPTER
// ═══════════════════════════════════════════════════════════════════

export class MarkdownAdapter extends BaseAdapter {
  readonly id = 'markdown';
  readonly name = 'Markdown / ChromaDB Memory';
  readonly description = 'Import markdown files with structured headers (ChromaDB memory exports, documentation, notes)';
  readonly version = '1.0.0';
  readonly contentTypes = ['markdown-document', 'markdown-memory', 'markdown-collection'];
  readonly supportedExtensions = ['.md', '.markdown'];

  // Files to skip
  private skipFiles = new Set([
    'INDEX.md',
    'INDEX_BY_TAG.md',
    'MERGED_CHRONOLOGICAL.md',
    'README.md',
    'CHANGELOG.md',
    'LICENSE.md',
  ]);

  // ─────────────────────────────────────────────────────────────────
  // DETECTION
  // ─────────────────────────────────────────────────────────────────

  async detect(source: AdapterSource): Promise<DetectionResult> {
    try {
      const path = source.path;

      // Check if it's a directory
      if (!(await this.isDirectory(path))) {
        // Single file
        if (path.endsWith('.md') || path.endsWith('.markdown')) {
          const content = await this.readFile(path);
          const hasStructuredHeader = this.hasMarkdownHeader(content);

          return {
            canHandle: true,
            confidence: hasStructuredHeader ? 0.9 : 0.7,
            format: hasStructuredHeader ? 'chromadb-memory-export' : 'markdown',
            reason: hasStructuredHeader
              ? 'Markdown file with structured header (Date, Hash, Tags)'
              : 'Plain markdown file',
          };
        }
        return {
          canHandle: false,
          confidence: 0,
          reason: 'Not a markdown file',
        };
      }

      // Directory - look for markdown files
      const entries = await this.readDir(path);

      // Check for ChromaDB memory export structure (month directories)
      const monthDirs = entries.filter((e) => /^\d{4}-\d{2}$/.test(e));
      if (monthDirs.length > 0) {
        // Sample a file from first month directory
        const sampleDir = join(path, monthDirs[0]);
        const sampleFiles = await this.readDir(sampleDir);
        const mdFile = sampleFiles.find((f) => f.endsWith('.md'));

        if (mdFile) {
          const content = await this.readFile(join(sampleDir, mdFile));
          if (this.hasMarkdownHeader(content)) {
            return {
              canHandle: true,
              confidence: 0.95,
              format: 'chromadb-memory-export',
              reason: `Found ChromaDB memory export structure with ${monthDirs.length} month directories`,
              metadata: { monthDirectories: monthDirs.length },
            };
          }
        }
      }

      // Check for flat markdown files
      const mdFiles = entries.filter((e) => e.endsWith('.md') || e.endsWith('.markdown'));
      if (mdFiles.length > 0) {
        const sampleFile = mdFiles.find((f) => !this.skipFiles.has(f)) || mdFiles[0];
        const content = await this.readFile(join(path, sampleFile));
        const hasHeader = this.hasMarkdownHeader(content);

        return {
          canHandle: true,
          confidence: hasHeader ? 0.85 : 0.6,
          format: hasHeader ? 'structured-markdown' : 'markdown-collection',
          reason: `Found ${mdFiles.length} markdown files`,
          metadata: { fileCount: mdFiles.length },
        };
      }

      return {
        canHandle: false,
        confidence: 0,
        reason: 'No markdown files found',
      };
    } catch (error) {
      return {
        canHandle: false,
        confidence: 0,
        reason: `Detection error: ${error}`,
      };
    }
  }

  /**
   * Check if content has structured markdown header
   */
  private hasMarkdownHeader(content: string): boolean {
    // Look for our specific header patterns
    return (
      content.includes('**Date**:') &&
      (content.includes('**Hash**:') || content.includes('**Type**:') || content.includes('**Tags**:'))
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────────

  async validate(source: AdapterSource): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    const detection = await this.detect(source);
    if (!detection.canHandle) {
      errors.push({
        code: 'INVALID_FORMAT',
        message: 'Not a valid markdown source',
        details: { reason: detection.reason },
      });
      return { valid: false, errors, warnings };
    }

    // Count files
    const isDir = await this.isDirectory(source.path);
    if (isDir) {
      const mdFiles = await this.findFiles(source.path, ['.md', '.markdown'], true);
      const validFiles = mdFiles.filter((f) => !this.skipFiles.has(basename(f)));

      if (validFiles.length === 0) {
        warnings.push({
          code: 'NO_CONTENT',
          message: 'No content markdown files found (only index/readme files)',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SOURCE METADATA
  // ─────────────────────────────────────────────────────────────────

  async getSourceMetadata(source: AdapterSource): Promise<SourceMetadata> {
    const detection = await this.detect(source);

    let estimatedCount = 0;
    let earliestDate: Date | undefined;
    let latestDate: Date | undefined;
    const contentTypes = new Set<string>();
    const allTags = new Set<string>();

    const isDir = await this.isDirectory(source.path);

    if (isDir) {
      const mdFiles = await this.findFiles(source.path, ['.md', '.markdown'], true);
      const validFiles = mdFiles.filter((f) => !this.skipFiles.has(basename(f)));

      // Sample up to 100 files for metadata
      const sampleFiles = validFiles.slice(0, 100);

      for (const filepath of sampleFiles) {
        try {
          const content = await this.readFile(filepath);
          const parsed = this.parseMarkdownFile(content, filepath);

          estimatedCount++;
          contentTypes.add(parsed.type ? 'markdown-memory' : 'markdown-document');

          for (const tag of parsed.tags) {
            allTags.add(tag);
          }

          if (parsed.date) {
            if (!earliestDate || parsed.date < earliestDate) earliestDate = parsed.date;
            if (!latestDate || parsed.date > latestDate) latestDate = parsed.date;
          }
        } catch (error) {
          this.log('warn', `Failed to parse ${filepath}`, error);
        }
      }

      // Estimate total based on sample
      const ratio = validFiles.length / Math.max(sampleFiles.length, 1);
      estimatedCount = Math.round(estimatedCount * ratio);
    } else {
      estimatedCount = 1;
      contentTypes.add('markdown-document');
    }

    return {
      format: detection.format || 'markdown',
      formatVersion: '1.0',
      estimatedCount,
      dateRange: {
        earliest: earliestDate,
        latest: latestDate,
      },
      contentTypes: Array.from(contentTypes),
      metadata: {
        totalTags: allTags.size,
        sampleTags: Array.from(allTags).slice(0, 20),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PARSING
  // ─────────────────────────────────────────────────────────────────

  protected async *parseSource(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const isDir = await this.isDirectory(source.path);

    if (isDir) {
      yield* this.parseDirectory(source.path);
    } else {
      const content = await this.readFile(source.path);
      const parsed = this.parseMarkdownFile(content, source.path);
      yield this.markdownToNode(parsed);
    }
  }

  private async *parseDirectory(dirPath: string): AsyncGenerator<ImportedNode, void, undefined> {
    const mdFiles = await this.findFiles(dirPath, ['.md', '.markdown'], true);
    const validFiles = mdFiles.filter((f) => !this.skipFiles.has(basename(f)));

    // Sort by filename (which includes date for ChromaDB exports)
    validFiles.sort();

    this.updateProgress({ total: validFiles.length });

    for (const filepath of validFiles) {
      try {
        const content = await this.readFile(filepath);
        const parsed = this.parseMarkdownFile(content, filepath);

        // Yield the document node
        yield this.markdownToNode(parsed);
      } catch (error) {
        this.log('warn', `Failed to parse ${filepath}`, error);
      }
    }
  }

  /**
   * Parse markdown file content with structured headers
   */
  private parseMarkdownFile(content: string, filepath: string): ParsedMarkdown {
    const lines = content.split('\n');

    let title = basename(filepath, '.md');
    let date: Date | undefined;
    let hash: string | undefined;
    let type: string | undefined;
    let tags: string[] = [];
    let metadata: Record<string, unknown> = {};
    let contentStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('# ')) {
        title = line.slice(2).trim();
      } else if (line.startsWith('**Date**:')) {
        const dateStr = line.replace('**Date**:', '').trim();
        date = this.parseTimestamp(dateStr);
      } else if (line.startsWith('**Hash**:')) {
        hash = line.replace('**Hash**:', '').replace(/`/g, '').trim();
      } else if (line.startsWith('**Type**:')) {
        type = line.replace('**Type**:', '').trim();
      } else if (line.startsWith('**Tags**:')) {
        const tagsStr = line.replace('**Tags**:', '').trim();
        tags = tagsStr
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      } else if (line.startsWith('**Metadata**:')) {
        try {
          const metaStr = line.replace('**Metadata**:', '').replace(/`/g, '').trim();
          metadata = JSON.parse(metaStr);
        } catch {
          // Ignore parse errors
        }
      } else if (line === '---') {
        contentStartLine = i + 1;
        // Skip blank line after separator
        if (lines[contentStartLine]?.trim() === '') {
          contentStartLine++;
        }
        break;
      }
    }

    // Extract content after the separator
    const bodyContent = lines.slice(contentStartLine).join('\n').trim();

    // Determine month key from directory structure
    const dirName = basename(dirname(filepath));
    const monthKey = /^\d{4}-\d{2}$/.test(dirName) ? dirName : undefined;

    return {
      title,
      date,
      hash,
      type,
      tags,
      metadata,
      content: bodyContent,
      filepath,
      monthKey,
    };
  }

  /**
   * Convert parsed markdown to ImportedNode
   */
  private markdownToNode(parsed: ParsedMarkdown): ImportedNode {
    const id = randomUUID();
    const isMemory = !!parsed.type && !!parsed.hash;
    const contentHash = parsed.hash || this.hashContent(parsed.content);

    const sourceType = isMemory ? 'markdown-memory' : 'markdown-document';
    const nodeUri = this.generateUri(isMemory ? 'memory' : 'document', id);

    // Note: Links are not created here to avoid ordering issues.
    // Collection relationships are captured in metadata.

    return {
      id,
      uri: nodeUri,
      contentHash,
      content: parsed.content,
      format: 'markdown',
      sourceType,
      sourceCreatedAt: parsed.date,
      author: {
        role: 'assistant', // ChromaDB memories are from AI assistant sessions
        name: 'claude-code',
      },
      metadata: {
        title: parsed.title,
        memoryType: parsed.type,
        tags: parsed.tags,
        originalHash: parsed.hash,
        monthKey: parsed.monthKey,
        filepath: parsed.filepath,
        ...parsed.metadata,
      },
    };
  }

  /**
   * Create a collection node for a month of memories
   */
  private monthCollectionToNode(monthKey: string, memories: ParsedMarkdown[]): ImportedNode {
    const id = randomUUID();

    // Sort by date
    memories.sort((a, b) => {
      const aTime = a.date?.getTime() || 0;
      const bTime = b.date?.getTime() || 0;
      return aTime - bTime;
    });

    const earliestDate = memories[0]?.date;
    const latestDate = memories[memories.length - 1]?.date;

    // Collect all tags
    const allTags = new Set<string>();
    for (const mem of memories) {
      for (const tag of mem.tags) {
        allTags.add(tag);
      }
    }

    // Create summary content
    const summary = `# ${monthKey} Memory Collection

**Memories**: ${memories.length}
**Date Range**: ${earliestDate?.toISOString().split('T')[0] || 'unknown'} to ${latestDate?.toISOString().split('T')[0] || 'unknown'}
**Tags**: ${Array.from(allTags).slice(0, 20).join(', ')}${allTags.size > 20 ? '...' : ''}

## Contents

${memories
  .slice(0, 50)
  .map((m) => `- ${m.date?.toISOString().split('T')[0] || '?'}: ${m.title}`)
  .join('\n')}
${memories.length > 50 ? `\n... and ${memories.length - 50} more` : ''}`;

    return {
      id,
      uri: this.generateUri('collection', monthKey),
      contentHash: this.hashContent(summary),
      content: summary,
      format: 'markdown',
      sourceType: 'markdown-collection',
      sourceCreatedAt: earliestDate,
      sourceUpdatedAt: latestDate,
      metadata: {
        monthKey,
        memoryCount: memories.length,
        tags: Array.from(allTags),
        dateRange: {
          earliest: earliestDate?.toISOString(),
          latest: latestDate?.toISOString(),
        },
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const markdownAdapter = new MarkdownAdapter();
