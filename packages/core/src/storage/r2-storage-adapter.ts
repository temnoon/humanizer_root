/**
 * Cloudflare R2 Storage Adapter
 *
 * Provides upload/download functionality for archive subset exports
 * to Cloudflare R2 storage with Zero Trust access control support.
 *
 * Designed for both:
 * - Direct R2 API access (from Cloudflare Workers)
 * - S3-compatible API access (from Node.js/external environments)
 *
 * @module @humanizer/core/storage/r2-storage-adapter
 */

import { createHash, randomUUID } from 'crypto';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * R2 storage configuration
 */
export interface R2StorageConfig {
  /** Cloudflare account ID */
  accountId: string;
  /** R2 bucket name */
  bucketName: string;
  /** Access key ID (for S3-compatible API) */
  accessKeyId?: string;
  /** Secret access key (for S3-compatible API) */
  secretAccessKey?: string;
  /** Custom endpoint (defaults to R2 endpoint) */
  endpoint?: string;
  /** Public bucket URL (for public access mode) */
  publicUrl?: string;
}

/**
 * Access policy for shared resources
 */
export interface R2AccessPolicy {
  /** Policy ID */
  id: string;
  /** Resource path pattern */
  resourcePattern: string;
  /** Access mode */
  mode: 'private' | 'zero-trust' | 'link-only' | 'public';
  /** Allowed user IDs (for private/zero-trust) */
  allowedUsers?: string[];
  /** Allowed email domains (for zero-trust) */
  allowedDomains?: string[];
  /** Cloudflare Access application ID (for zero-trust) */
  accessApplicationId?: string;
  /** Expiration timestamp (epoch ms) */
  expiresAt?: number;
  /** One-time access token (for link-only) */
  accessToken?: string;
  /** Created timestamp */
  createdAt: number;
  /** Created by user ID */
  createdBy: string;
}

/**
 * Upload options
 */
export interface R2UploadOptions {
  /** Content type (MIME type) */
  contentType?: string;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Access policy to apply */
  accessPolicy?: R2AccessPolicy;
  /** Cache control header */
  cacheControl?: string;
  /** Content disposition (for downloads) */
  contentDisposition?: string;
}

/**
 * Upload result
 */
export interface R2UploadResult {
  /** Object key in R2 */
  key: string;
  /** ETag (content hash) */
  etag: string;
  /** Size in bytes */
  size: number;
  /** Public URL (if applicable) */
  publicUrl?: string;
  /** Signed URL (if generated) */
  signedUrl?: string;
  /** Access policy ID (if applied) */
  policyId?: string;
}

/**
 * Download result
 */
export interface R2DownloadResult {
  /** Object content as buffer */
  content: Buffer;
  /** Content type */
  contentType: string;
  /** Size in bytes */
  size: number;
  /** ETag */
  etag: string;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Last modified timestamp */
  lastModified: number;
}

/**
 * List result
 */
export interface R2ListResult {
  /** Objects in the listing */
  objects: R2ObjectInfo[];
  /** Truncated (more results available) */
  truncated: boolean;
  /** Continuation token for pagination */
  cursor?: string;
}

/**
 * Object info from listing
 */
export interface R2ObjectInfo {
  /** Object key */
  key: string;
  /** Size in bytes */
  size: number;
  /** ETag */
  etag: string;
  /** Last modified timestamp */
  lastModified: number;
  /** Custom metadata */
  metadata?: Record<string, string>;
}

/**
 * Signed URL options
 */
export interface SignedUrlOptions {
  /** Expiration in seconds (default: 3600) */
  expiresIn?: number;
  /** HTTP method (default: GET) */
  method?: 'GET' | 'PUT';
  /** Content type (required for PUT) */
  contentType?: string;
}

// ═══════════════════════════════════════════════════════════════════
// R2 STORAGE ADAPTER (Abstract)
// ═══════════════════════════════════════════════════════════════════

/**
 * Abstract R2 storage adapter interface
 *
 * Implementations:
 * - R2WorkerAdapter: For Cloudflare Workers (direct R2 binding)
 * - R2S3Adapter: For Node.js (S3-compatible API)
 */
export interface R2StorageAdapter {
  /**
   * Upload content to R2
   */
  upload(
    key: string,
    content: Buffer | ReadableStream | string,
    options?: R2UploadOptions
  ): Promise<R2UploadResult>;

  /**
   * Download content from R2
   */
  download(key: string): Promise<R2DownloadResult | null>;

  /**
   * Check if object exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Delete object
   */
  delete(key: string): Promise<boolean>;

  /**
   * List objects with prefix
   */
  list(prefix: string, options?: { limit?: number; cursor?: string }): Promise<R2ListResult>;

  /**
   * Generate signed URL for temporary access
   */
  getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string>;

  /**
   * Copy object to new key
   */
  copy(sourceKey: string, destKey: string): Promise<R2UploadResult>;

  /**
   * Get object metadata without downloading
   */
  head(key: string): Promise<R2ObjectInfo | null>;
}

// ═══════════════════════════════════════════════════════════════════
// S3-COMPATIBLE ADAPTER (for Node.js)
// ═══════════════════════════════════════════════════════════════════

/**
 * R2 adapter using S3-compatible API
 *
 * For use in Node.js environments (local development, API server).
 * Requires @aws-sdk/client-s3 peer dependency.
 *
 * Install with: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */
export class R2S3Adapter implements R2StorageAdapter {
  private config: R2StorageConfig;
  private s3Client: unknown = null;
  private s3Module: unknown = null;
  private presignerModule: unknown = null;

  constructor(config: R2StorageConfig) {
    this.config = config;
  }

  /**
   * Initialize S3 client (lazy load to avoid dependency issues)
   */
  private async getClient(): Promise<unknown> {
    if (this.s3Client) return this.s3Client;

    try {
      // Dynamic import to avoid TypeScript errors when SDK not installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const moduleName = '@aws-sdk/client-s3';
      this.s3Module = await (Function('m', 'return import(m)')(moduleName));
      const { S3Client } = this.s3Module as { S3Client: new (config: unknown) => unknown };

      this.s3Client = new S3Client({
        region: 'auto',
        endpoint:
          this.config.endpoint ??
          `https://${this.config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: this.config.accessKeyId ?? '',
          secretAccessKey: this.config.secretAccessKey ?? '',
        },
      });

      return this.s3Client;
    } catch {
      throw new Error(
        'R2S3Adapter requires @aws-sdk/client-s3. Install with: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner'
      );
    }
  }

  /**
   * Get S3 module commands
   */
  private getS3Module(): {
    PutObjectCommand: new (input: unknown) => unknown;
    GetObjectCommand: new (input: unknown) => unknown;
    DeleteObjectCommand: new (input: unknown) => unknown;
    ListObjectsV2Command: new (input: unknown) => unknown;
    CopyObjectCommand: new (input: unknown) => unknown;
    HeadObjectCommand: new (input: unknown) => unknown;
  } {
    if (!this.s3Module) {
      throw new Error('S3 module not loaded. Call getClient() first.');
    }
    return this.s3Module as {
      PutObjectCommand: new (input: unknown) => unknown;
      GetObjectCommand: new (input: unknown) => unknown;
      DeleteObjectCommand: new (input: unknown) => unknown;
      ListObjectsV2Command: new (input: unknown) => unknown;
      CopyObjectCommand: new (input: unknown) => unknown;
      HeadObjectCommand: new (input: unknown) => unknown;
    };
  }

  /**
   * Get presigner module
   */
  private async getPresignerModule(): Promise<{
    getSignedUrl: (client: unknown, command: unknown, options: { expiresIn: number }) => Promise<string>;
  }> {
    if (this.presignerModule) {
      return this.presignerModule as {
        getSignedUrl: (client: unknown, command: unknown, options: { expiresIn: number }) => Promise<string>;
      };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const moduleName = '@aws-sdk/s3-request-presigner';
      this.presignerModule = await (Function('m', 'return import(m)')(moduleName));
      return this.presignerModule as {
        getSignedUrl: (client: unknown, command: unknown, options: { expiresIn: number }) => Promise<string>;
      };
    } catch {
      throw new Error(
        'Presigner requires @aws-sdk/s3-request-presigner. Install with: npm install @aws-sdk/s3-request-presigner'
      );
    }
  }

  async upload(
    key: string,
    content: Buffer | ReadableStream | string,
    options?: R2UploadOptions
  ): Promise<R2UploadResult> {
    const client = await this.getClient() as { send: (cmd: unknown) => Promise<{ ETag?: string }> };
    const { PutObjectCommand } = this.getS3Module();

    const body = typeof content === 'string' ? Buffer.from(content) : content;
    const size = Buffer.isBuffer(body) ? body.length : 0;

    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
      Body: body,
      ContentType: options?.contentType ?? 'application/octet-stream',
      CacheControl: options?.cacheControl,
      ContentDisposition: options?.contentDisposition,
      Metadata: options?.metadata,
    });

    const response = await client.send(command);

    return {
      key,
      etag: response.ETag?.replace(/"/g, '') ?? '',
      size,
      publicUrl: this.config.publicUrl ? `${this.config.publicUrl}/${key}` : undefined,
      policyId: options?.accessPolicy?.id,
    };
  }

  async download(key: string): Promise<R2DownloadResult | null> {
    const client = await this.getClient() as { send: (cmd: unknown) => Promise<{
      Body?: AsyncIterable<Uint8Array>;
      ContentType?: string;
      ContentLength?: number;
      ETag?: string;
      Metadata?: Record<string, string>;
      LastModified?: Date;
    }> };
    const { GetObjectCommand } = this.getS3Module();

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      const response = await client.send(command);

      if (!response.Body) return null;

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks);

      return {
        content,
        contentType: response.ContentType ?? 'application/octet-stream',
        size: response.ContentLength ?? content.length,
        etag: response.ETag?.replace(/"/g, '') ?? '',
        metadata: response.Metadata,
        lastModified: response.LastModified?.getTime() ?? Date.now(),
      };
    } catch (error: unknown) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const info = await this.head(key);
    return info !== null;
  }

  async delete(key: string): Promise<boolean> {
    const client = await this.getClient() as { send: (cmd: unknown) => Promise<unknown> };
    const { DeleteObjectCommand } = this.getS3Module();

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      await client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async list(
    prefix: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<R2ListResult> {
    const client = await this.getClient() as { send: (cmd: unknown) => Promise<{
      Contents?: Array<{ Key?: string; Size?: number; ETag?: string; LastModified?: Date }>;
      IsTruncated?: boolean;
      NextContinuationToken?: string;
    }> };
    const { ListObjectsV2Command } = this.getS3Module();

    const command = new ListObjectsV2Command({
      Bucket: this.config.bucketName,
      Prefix: prefix,
      MaxKeys: options?.limit ?? 1000,
      ContinuationToken: options?.cursor,
    });

    const response = await client.send(command);

    return {
      objects: (response.Contents ?? []).map((obj: { Key?: string; Size?: number; ETag?: string; LastModified?: Date }) => ({
        key: obj.Key ?? '',
        size: obj.Size ?? 0,
        etag: obj.ETag?.replace(/"/g, '') ?? '',
        lastModified: obj.LastModified?.getTime() ?? Date.now(),
      })),
      truncated: response.IsTruncated ?? false,
      cursor: response.NextContinuationToken,
    };
  }

  async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    const client = await this.getClient();
    const { getSignedUrl } = await this.getPresignerModule();
    const { GetObjectCommand, PutObjectCommand } = this.getS3Module();

    const expiresIn = options?.expiresIn ?? 3600;

    const command =
      options?.method === 'PUT'
        ? new PutObjectCommand({
            Bucket: this.config.bucketName,
            Key: key,
            ContentType: options?.contentType,
          })
        : new GetObjectCommand({
            Bucket: this.config.bucketName,
            Key: key,
          });

    return getSignedUrl(client, command, { expiresIn });
  }

  async copy(sourceKey: string, destKey: string): Promise<R2UploadResult> {
    const client = await this.getClient() as { send: (cmd: unknown) => Promise<{
      CopyObjectResult?: { ETag?: string };
    }> };
    const { CopyObjectCommand } = this.getS3Module();

    const command = new CopyObjectCommand({
      Bucket: this.config.bucketName,
      CopySource: `${this.config.bucketName}/${sourceKey}`,
      Key: destKey,
    });

    const response = await client.send(command);

    // Get size from head
    const info = await this.head(destKey);

    return {
      key: destKey,
      etag: response.CopyObjectResult?.ETag?.replace(/"/g, '') ?? '',
      size: info?.size ?? 0,
    };
  }

  async head(key: string): Promise<R2ObjectInfo | null> {
    const client = await this.getClient() as { send: (cmd: unknown) => Promise<{
      ContentLength?: number;
      ETag?: string;
      LastModified?: Date;
      Metadata?: Record<string, string>;
    }> };
    const { HeadObjectCommand } = this.getS3Module();

    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      const response = await client.send(command);

      return {
        key,
        size: response.ContentLength ?? 0,
        etag: response.ETag?.replace(/"/g, '') ?? '',
        lastModified: response.LastModified?.getTime() ?? Date.now(),
        metadata: response.Metadata,
      };
    } catch (error: unknown) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// KEY GENERATION UTILITIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate R2 key for subset export
 *
 * Pattern: subsets/{userId}/{subsetId}/{timestamp}_{format}.{ext}
 */
export function generateSubsetExportKey(
  userId: string,
  subsetId: string,
  format: string,
  timestamp?: number
): string {
  const ts = timestamp ?? Date.now();
  const ext = getFormatExtension(format);
  return `subsets/${userId}/${subsetId}/${ts}_export.${ext}`;
}

/**
 * Generate R2 key for shared subset
 *
 * Pattern: shared/{accessToken}/{filename}
 */
export function generateSharedKey(accessToken: string, filename: string): string {
  return `shared/${accessToken}/${filename}`;
}

/**
 * Generate access token for link-only sharing
 */
export function generateAccessToken(): string {
  const token = randomUUID().replace(/-/g, '');
  return token;
}

/**
 * Get file extension for export format
 */
function getFormatExtension(format: string): string {
  switch (format) {
    case 'json':
      return 'json';
    case 'jsonl':
      return 'jsonl';
    case 'markdown':
      return 'md';
    case 'html':
      return 'html';
    case 'sqlite':
      return 'db';
    case 'archive':
      return 'zip';
    default:
      return 'bin';
  }
}

// ═══════════════════════════════════════════════════════════════════
// ACCESS POLICY UTILITIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a new access policy
 */
export function createAccessPolicy(
  resourcePattern: string,
  mode: R2AccessPolicy['mode'],
  createdBy: string,
  options?: {
    allowedUsers?: string[];
    allowedDomains?: string[];
    accessApplicationId?: string;
    expiresIn?: number; // seconds
  }
): R2AccessPolicy {
  const now = Date.now();

  return {
    id: randomUUID(),
    resourcePattern,
    mode,
    allowedUsers: options?.allowedUsers,
    allowedDomains: options?.allowedDomains,
    accessApplicationId: options?.accessApplicationId,
    expiresAt: options?.expiresIn ? now + options.expiresIn * 1000 : undefined,
    accessToken: mode === 'link-only' ? generateAccessToken() : undefined,
    createdAt: now,
    createdBy,
  };
}

/**
 * Check if access policy is expired
 */
export function isPolicyExpired(policy: R2AccessPolicy): boolean {
  if (!policy.expiresAt) return false;
  return Date.now() > policy.expiresAt;
}

/**
 * Check if user has access via policy
 */
export function checkPolicyAccess(
  policy: R2AccessPolicy,
  userId?: string,
  email?: string
): boolean {
  // Check expiration
  if (isPolicyExpired(policy)) return false;

  switch (policy.mode) {
    case 'public':
      return true;

    case 'link-only':
      // Link-only access is checked via token, not user
      return true;

    case 'private':
      // Must be in allowed users list
      if (!userId || !policy.allowedUsers) return false;
      return policy.allowedUsers.includes(userId);

    case 'zero-trust':
      // Check user ID or email domain
      if (userId && policy.allowedUsers?.includes(userId)) return true;
      if (email && policy.allowedDomains) {
        const domain = email.split('@')[1];
        return policy.allowedDomains.includes(domain);
      }
      return false;

    default:
      return false;
  }
}

/**
 * Generate shareable URL for a policy
 */
export function generateShareableUrl(
  baseUrl: string,
  policy: R2AccessPolicy,
  key: string
): string {
  switch (policy.mode) {
    case 'public':
      return `${baseUrl}/${key}`;

    case 'link-only':
      if (!policy.accessToken) {
        throw new Error('Link-only policy requires access token');
      }
      return `${baseUrl}/shared/${policy.accessToken}/${encodeURIComponent(key)}`;

    case 'zero-trust':
      if (!policy.accessApplicationId) {
        throw new Error('Zero Trust policy requires Access application ID');
      }
      return `${baseUrl}/protected/${policy.accessApplicationId}/${encodeURIComponent(key)}`;

    case 'private':
      // Private resources don't have shareable URLs
      throw new Error('Private resources cannot be shared via URL');

    default:
      throw new Error(`Unknown policy mode: ${policy.mode}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONTENT HASHING
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate content hash for integrity verification
 */
export function calculateContentHash(content: Buffer | string): string {
  const hash = createHash('sha256');
  hash.update(typeof content === 'string' ? content : content);
  return hash.digest('hex');
}

/**
 * Verify content against expected hash
 */
export function verifyContentHash(
  content: Buffer | string,
  expectedHash: string
): boolean {
  const actualHash = calculateContentHash(content);
  return actualHash === expectedHash;
}
