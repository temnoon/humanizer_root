/**
 * Subset Exporter Service
 *
 * Handles exporting archive subsets to various formats and destinations.
 * Integrates with R2 storage adapter for Cloudflare R2 exports.
 *
 * Export flow:
 * 1. Start export job via ArchiveSubsetService
 * 2. Query matching nodes with sensitivity mappings
 * 3. Apply redaction if configured
 * 4. Format output (JSON, Markdown, HTML, etc.)
 * 5. Upload to destination (R2, local, etc.)
 * 6. Update job status and return result
 *
 * @module @humanizer/core/aui/service/subset-exporter
 */

import type { Pool } from 'pg';
import { createWriteStream, promises as fs } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { createGzip } from 'zlib';
import type {
  ArchiveSubset,
  SubsetExportFormat,
  SubsetExportJob,
  CloudDestination,
  SensitivityLevel,
} from '../types/subset-types';
import type { StoredNode } from '../../storage/types';
import type { ArchiveSubsetService } from './archive-subset-service';
import type {
  R2StorageAdapter,
  R2AccessPolicy,
  R2UploadOptions,
} from '../../storage/r2-storage-adapter';
import {
  generateSubsetExportKey,
  generateSharedKey,
  createAccessPolicy,
  generateAccessToken,
  calculateContentHash,
} from '../../storage/r2-storage-adapter';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface ExportOptions {
  /** Compress output (gzip) */
  compress?: boolean;
  /** Include metadata header */
  includeMetadata?: boolean;
  /** Pretty print JSON */
  prettyPrint?: boolean;
  /** Chunk size for streaming exports */
  chunkSize?: number;
  /** Progress callback */
  onProgress?: (exported: number, total: number, stage: string) => void;
}

export interface ExportResult {
  /** Job ID */
  jobId: string;
  /** Subset ID */
  subsetId: string;
  /** Export format */
  format: SubsetExportFormat;
  /** Destination path/URL */
  destination: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Content hash (SHA-256) */
  contentHash: string;
  /** Number of nodes exported */
  nodesExported: number;
  /** Number of nodes redacted */
  nodesRedacted: number;
  /** Access policy (if sharing enabled) */
  accessPolicy?: R2AccessPolicy;
  /** Shareable URL (if applicable) */
  shareableUrl?: string;
  /** Export duration in ms */
  durationMs: number;
}

export interface FormatterOptions {
  subset: ArchiveSubset;
  includeMetadata?: boolean;
  prettyPrint?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// SUBSET EXPORTER SERVICE
// ═══════════════════════════════════════════════════════════════════

export class SubsetExporterService {
  private pool: Pool;
  private subsetService: ArchiveSubsetService;
  private r2Adapter?: R2StorageAdapter;
  private localExportPath: string;
  private publicBaseUrl?: string;

  constructor(options: {
    pool: Pool;
    subsetService: ArchiveSubsetService;
    r2Adapter?: R2StorageAdapter;
    localExportPath?: string;
    publicBaseUrl?: string;
  }) {
    this.pool = options.pool;
    this.subsetService = options.subsetService;
    this.r2Adapter = options.r2Adapter;
    this.localExportPath = options.localExportPath ?? './exports';
    this.publicBaseUrl = options.publicBaseUrl;
  }

  /**
   * Set R2 adapter (for lazy initialization)
   */
  setR2Adapter(adapter: R2StorageAdapter): void {
    this.r2Adapter = adapter;
  }

  /**
   * Export a subset to the configured destination
   */
  async exportSubset(
    job: SubsetExportJob,
    contentStoreQuery: (nodeIds: string[]) => Promise<StoredNode[]>,
    options?: ExportOptions
  ): Promise<ExportResult> {
    const startTime = Date.now();

    // Get subset definition
    const subset = await this.subsetService.getSubset(job.subsetId, job.userId);
    if (!subset) {
      throw new Error(`Subset not found: ${job.subsetId}`);
    }

    // Update job status to exporting
    await this.subsetService.updateExportProgress(job.id, {
      status: 'exporting',
    });

    try {
      // Get node mappings
      const mappings = await this.getNodeMappings(job.subsetId);
      const nodeIds = mappings
        .filter((m) => m.user_override !== 'exclude')
        .map((m) => m.node_id);

      // Fetch nodes in batches
      const chunkSize = options?.chunkSize ?? 100;
      const nodes: StoredNode[] = [];
      let redactedCount = 0;

      for (let i = 0; i < nodeIds.length; i += chunkSize) {
        const batchIds = nodeIds.slice(i, i + chunkSize);
        const batchNodes = await contentStoreQuery(batchIds);

        // Apply redaction if needed
        for (const node of batchNodes) {
          const mapping = mappings.find((m) => m.node_id === node.id);
          if (mapping?.redacted && mapping.sensitivity_markers) {
            const markers = JSON.parse(mapping.sensitivity_markers);
            node.text = this.subsetService.redactText(node.text, markers);
            redactedCount++;
          }
          nodes.push(node);
        }

        options?.onProgress?.(nodes.length, nodeIds.length, 'fetching');
      }

      // Format output
      options?.onProgress?.(nodes.length, nodeIds.length, 'formatting');
      const content = await this.formatExport(nodes, job.format, {
        subset,
        includeMetadata: options?.includeMetadata ?? true,
        prettyPrint: options?.prettyPrint ?? false,
      });

      // Compress if requested
      const finalContent = options?.compress
        ? await this.compressContent(content)
        : content;

      const contentHash = calculateContentHash(finalContent);
      const sizeBytes = Buffer.byteLength(finalContent);

      // Upload to destination
      options?.onProgress?.(nodes.length, nodeIds.length, 'uploading');
      const { destination, accessPolicy, shareableUrl } = await this.uploadToDestination(
        job,
        subset,
        finalContent,
        options?.compress ? `${job.format}.gz` : job.format
      );

      // Update job as completed
      await this.subsetService.updateExportProgress(job.id, {
        status: 'completed',
        exportedNodes: nodes.length,
        redactedNodes: redactedCount,
        outputPath: destination,
        outputSizeBytes: sizeBytes,
      });

      const durationMs = Date.now() - startTime;

      return {
        jobId: job.id,
        subsetId: job.subsetId,
        format: job.format,
        destination,
        sizeBytes,
        contentHash,
        nodesExported: nodes.length,
        nodesRedacted: redactedCount,
        accessPolicy,
        shareableUrl,
        durationMs,
      };
    } catch (error) {
      // Update job as failed
      await this.subsetService.updateExportProgress(job.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get node mappings for a subset
   */
  private async getNodeMappings(
    subsetId: string
  ): Promise<Array<{
    node_id: string;
    sensitivity_level: SensitivityLevel;
    redacted: boolean;
    sensitivity_markers: string | null;
    user_override: string | null;
  }>> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT node_id, sensitivity_level, redacted, sensitivity_markers::text, user_override
         FROM aui_subset_node_mappings
         WHERE subset_id = $1
         ORDER BY position ASC`,
        [subsetId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Format export content based on format type
   */
  private async formatExport(
    nodes: StoredNode[],
    format: SubsetExportFormat,
    options: FormatterOptions
  ): Promise<Buffer> {
    switch (format) {
      case 'json':
        return this.formatJson(nodes, options);
      case 'jsonl':
        return this.formatJsonl(nodes, options);
      case 'markdown':
        return this.formatMarkdown(nodes, options);
      case 'html':
        return this.formatHtml(nodes, options);
      default:
        return this.formatJson(nodes, options);
    }
  }

  /**
   * Format as JSON
   */
  private formatJson(nodes: StoredNode[], options: FormatterOptions): Buffer {
    const output: any = {
      metadata: options.includeMetadata
        ? {
            subsetId: options.subset.id,
            subsetName: options.subset.name,
            description: options.subset.description,
            exportedAt: new Date().toISOString(),
            nodeCount: nodes.length,
            criteria: options.subset.criteria,
          }
        : undefined,
      nodes: nodes.map((n) => this.nodeToExportFormat(n)),
    };

    const json = options.prettyPrint
      ? JSON.stringify(output, null, 2)
      : JSON.stringify(output);

    return Buffer.from(json, 'utf-8');
  }

  /**
   * Format as JSON Lines (one JSON object per line)
   */
  private formatJsonl(nodes: StoredNode[], options: FormatterOptions): Buffer {
    const lines: string[] = [];

    if (options.includeMetadata) {
      lines.push(
        JSON.stringify({
          _type: 'metadata',
          subsetId: options.subset.id,
          subsetName: options.subset.name,
          exportedAt: new Date().toISOString(),
          nodeCount: nodes.length,
        })
      );
    }

    for (const node of nodes) {
      lines.push(JSON.stringify(this.nodeToExportFormat(node)));
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  /**
   * Format as Markdown
   */
  private formatMarkdown(nodes: StoredNode[], options: FormatterOptions): Buffer {
    const lines: string[] = [];

    // Header
    lines.push(`# ${options.subset.name}`);
    lines.push('');
    if (options.subset.description) {
      lines.push(options.subset.description);
      lines.push('');
    }

    if (options.includeMetadata) {
      lines.push('---');
      lines.push(`**Exported:** ${new Date().toISOString()}`);
      lines.push(`**Nodes:** ${nodes.length}`);
      lines.push('---');
      lines.push('');
    }

    // Group by thread if available
    const byThread = new Map<string, StoredNode[]>();
    for (const node of nodes) {
      const threadId = node.threadRootId ?? 'standalone';
      if (!byThread.has(threadId)) {
        byThread.set(threadId, []);
      }
      byThread.get(threadId)!.push(node);
    }

    // Output by thread
    for (const [threadId, threadNodes] of byThread) {
      if (threadId !== 'standalone' && threadNodes[0]?.title) {
        lines.push(`## ${threadNodes[0].title}`);
        lines.push('');
      }

      for (const node of threadNodes) {
        // Author label
        const author = node.authorRole === 'assistant' ? '**Assistant:**' : '**User:**';
        lines.push(author);
        lines.push('');
        lines.push(node.text);
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  /**
   * Format as HTML
   */
  private formatHtml(nodes: StoredNode[], options: FormatterOptions): Buffer {
    const escapeHtml = (text: string) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const lines: string[] = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      `<title>${escapeHtml(options.subset.name)}</title>`,
      '<style>',
      'body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }',
      '.message { margin: 20px 0; padding: 15px; border-radius: 8px; }',
      '.user { background: #e8f4f8; }',
      '.assistant { background: #f5f5f5; }',
      '.author { font-weight: bold; margin-bottom: 10px; }',
      '.metadata { color: #666; font-size: 0.9em; margin-top: 10px; }',
      'hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }',
      '</style>',
      '</head>',
      '<body>',
      `<h1>${escapeHtml(options.subset.name)}</h1>`,
    ];

    if (options.subset.description) {
      lines.push(`<p>${escapeHtml(options.subset.description)}</p>`);
    }

    if (options.includeMetadata) {
      lines.push('<div class="metadata">');
      lines.push(`<p>Exported: ${new Date().toISOString()}</p>`);
      lines.push(`<p>Nodes: ${nodes.length}</p>`);
      lines.push('</div>');
      lines.push('<hr>');
    }

    for (const node of nodes) {
      const roleClass = node.authorRole === 'assistant' ? 'assistant' : 'user';
      const roleLabel = node.authorRole === 'assistant' ? 'Assistant' : 'User';

      lines.push(`<div class="message ${roleClass}">`);
      lines.push(`<div class="author">${roleLabel}</div>`);
      lines.push(`<div class="content">${escapeHtml(node.text).replace(/\n/g, '<br>')}</div>`);
      if (node.sourceCreatedAt) {
        lines.push(
          `<div class="metadata">${new Date(node.sourceCreatedAt).toLocaleString()}</div>`
        );
      }
      lines.push('</div>');
    }

    lines.push('</body>');
    lines.push('</html>');

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  /**
   * Convert node to export format (strip internal fields)
   */
  private nodeToExportFormat(node: StoredNode): Record<string, unknown> {
    return {
      id: node.id,
      text: node.text,
      format: node.format,
      wordCount: node.wordCount,
      sourceType: node.sourceType,
      author: node.author,
      authorRole: node.authorRole,
      title: node.title,
      tags: node.tags,
      sourceCreatedAt: node.sourceCreatedAt,
      threadRootId: node.threadRootId,
      parentNodeId: node.parentNodeId,
      position: node.position,
      mediaRefs: node.mediaRefs,
    };
  }

  /**
   * Compress content with gzip
   */
  private async compressContent(content: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const gzip = createGzip();

      gzip.on('data', (chunk) => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);

      gzip.write(content);
      gzip.end();
    });
  }

  /**
   * Upload content to configured destination
   */
  private async uploadToDestination(
    job: SubsetExportJob,
    subset: ArchiveSubset,
    content: Buffer,
    format: string
  ): Promise<{
    destination: string;
    accessPolicy?: R2AccessPolicy;
    shareableUrl?: string;
  }> {
    const destination = job.destination;

    switch (destination.provider) {
      case 'cloudflare-r2':
        return this.uploadToR2(job, subset, content, format);

      case 'local':
        return this.uploadToLocal(job, subset, content, format);

      default:
        throw new Error(`Unsupported destination provider: ${destination.provider}`);
    }
  }

  /**
   * Upload to Cloudflare R2
   */
  private async uploadToR2(
    job: SubsetExportJob,
    subset: ArchiveSubset,
    content: Buffer,
    format: string
  ): Promise<{
    destination: string;
    accessPolicy?: R2AccessPolicy;
    shareableUrl?: string;
  }> {
    if (!this.r2Adapter) {
      throw new Error('R2 adapter not configured');
    }

    const userId = job.userId ?? 'anonymous';
    const key = generateSubsetExportKey(userId, job.subsetId, format);

    // Create access policy based on sharing mode
    let accessPolicy: R2AccessPolicy | undefined;
    let shareableUrl: string | undefined;

    if (subset.sharingMode && subset.sharingMode !== 'private') {
      accessPolicy = createAccessPolicy(key, subset.sharingMode, userId, {
        expiresIn: 7 * 24 * 60 * 60, // 7 days default
      });

      if (this.publicBaseUrl) {
        if (subset.sharingMode === 'link-only' && accessPolicy.accessToken) {
          shareableUrl = `${this.publicBaseUrl}/shared/${accessPolicy.accessToken}/${encodeURIComponent(key)}`;
        } else if (subset.sharingMode === 'public') {
          shareableUrl = `${this.publicBaseUrl}/${key}`;
        }
      }
    }

    // Get MIME type
    const contentType = this.getContentType(format);

    // Upload
    const uploadOptions: R2UploadOptions = {
      contentType,
      metadata: {
        subsetId: job.subsetId,
        subsetName: subset.name,
        exportedAt: new Date().toISOString(),
        sharingMode: subset.sharingMode ?? 'private',
      },
      accessPolicy,
      contentDisposition: `attachment; filename="${subset.name}.${format}"`,
    };

    await this.r2Adapter.upload(key, content, uploadOptions);

    // Store access policy if created
    if (accessPolicy) {
      await this.storeAccessPolicy(accessPolicy);
    }

    return {
      destination: `r2://${key}`,
      accessPolicy,
      shareableUrl,
    };
  }

  /**
   * Upload to local filesystem
   */
  private async uploadToLocal(
    job: SubsetExportJob,
    subset: ArchiveSubset,
    content: Buffer,
    format: string
  ): Promise<{
    destination: string;
  }> {
    const userId = job.userId ?? 'anonymous';
    const dirPath = join(this.localExportPath, userId, job.subsetId);
    const filename = `${Date.now()}_export.${format}`;
    const filePath = join(dirPath, filename);

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    // Write file
    await fs.writeFile(filePath, content);

    return {
      destination: filePath,
    };
  }

  /**
   * Store access policy in database
   */
  private async storeAccessPolicy(policy: R2AccessPolicy): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO aui_access_policies (
          id, resource_pattern, mode, allowed_users, allowed_domains,
          access_application_id, expires_at, access_token, created_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          mode = EXCLUDED.mode,
          allowed_users = EXCLUDED.allowed_users,
          allowed_domains = EXCLUDED.allowed_domains,
          expires_at = EXCLUDED.expires_at`,
        [
          policy.id,
          policy.resourcePattern,
          policy.mode,
          policy.allowedUsers ? JSON.stringify(policy.allowedUsers) : null,
          policy.allowedDomains ? JSON.stringify(policy.allowedDomains) : null,
          policy.accessApplicationId,
          policy.expiresAt ? new Date(policy.expiresAt) : null,
          policy.accessToken,
          new Date(policy.createdAt),
          policy.createdBy,
        ]
      );
    } catch (error: any) {
      // Table might not exist yet - log warning but don't fail
      if (error.code !== '42P01') {
        // 42P01 = undefined_table
        console.warn('Failed to store access policy:', error.message);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Get MIME type for format
   */
  private getContentType(format: string): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'jsonl':
        return 'application/x-ndjson';
      case 'markdown':
      case 'md':
        return 'text/markdown';
      case 'html':
        return 'text/html';
      case 'sqlite':
      case 'db':
        return 'application/x-sqlite3';
      case 'zip':
        return 'application/zip';
      case 'json.gz':
      case 'jsonl.gz':
        return 'application/gzip';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Get download URL for an exported subset
   */
  async getDownloadUrl(
    jobId: string,
    userId: string
  ): Promise<{ url: string; expiresAt: number } | null> {
    const job = await this.subsetService.getExportJob(jobId, userId);
    if (!job || job.status !== 'completed' || !job.outputPath) {
      return null;
    }

    // Parse destination
    if (job.outputPath.startsWith('r2://')) {
      if (!this.r2Adapter) {
        throw new Error('R2 adapter not configured');
      }

      const key = job.outputPath.replace('r2://', '');
      const expiresIn = 3600; // 1 hour
      const url = await this.r2Adapter.getSignedUrl(key, { expiresIn });

      return {
        url,
        expiresAt: Date.now() + expiresIn * 1000,
      };
    }

    // Local file - return file path
    return {
      url: `file://${job.outputPath}`,
      expiresAt: Date.now() + 86400000, // 24 hours (local files don't expire)
    };
  }

  /**
   * Delete an exported subset
   */
  async deleteExport(jobId: string, userId: string): Promise<boolean> {
    const job = await this.subsetService.getExportJob(jobId, userId);
    if (!job || !job.outputPath) {
      return false;
    }

    if (job.outputPath.startsWith('r2://')) {
      if (!this.r2Adapter) {
        return false;
      }

      const key = job.outputPath.replace('r2://', '');
      return this.r2Adapter.delete(key);
    }

    // Local file
    try {
      await fs.unlink(job.outputPath);
      return true;
    } catch {
      return false;
    }
  }
}
