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
  /** Quota check function - if provided, called before upload to verify quota */
  quotaCheck?: QuotaCheckFn;
}

/**
 * Storage quota check function type
 *
 * @param userId - User attempting the upload
 * @param sizeBytes - Size of content being uploaded
 * @returns Promise resolving to quota check result
 */
export type QuotaCheckFn = (
  userId: string,
  sizeBytes: number
) => Promise<StorageQuotaResult>;

/**
 * Storage quota check result
 */
export interface StorageQuotaResult {
  /** Whether the upload is allowed */
  allowed: boolean;
  /** Reason for denial (if not allowed) */
  reason?: string;
  /** Current storage usage in bytes */
  usedBytes: number;
  /** Storage quota limit in bytes */
  limitBytes: number;
  /** Percentage of quota used */
  percentUsed: number;
  /** Remaining bytes available */
  remainingBytes: number;
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
    const body = typeof content === 'string' ? Buffer.from(content) : content;
    const size = Buffer.isBuffer(body) ? body.length : 0;

    // Check quota before uploading if quota check function provided
    if (options?.quotaCheck) {
      // Extract userId from key pattern (e.g., "subsets/{userId}/..." or from metadata)
      const userId = options.metadata?.userId ?? extractUserIdFromKey(key);
      if (userId) {
        const quotaResult = await options.quotaCheck(userId, size);
        if (!quotaResult.allowed) {
          throw new StorageQuotaExceededError(
            quotaResult.reason ?? 'Storage quota exceeded',
            quotaResult
          );
        }
      }
    }

    const client = await this.getClient() as { send: (cmd: unknown) => Promise<{ ETag?: string }> };
    const { PutObjectCommand } = this.getS3Module();

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
 *
 * @param policy - The access policy to check against
 * @param options - Access check options
 * @param options.userId - User ID for private/zero-trust access
 * @param options.email - Email for zero-trust domain checking
 * @param options.accessToken - Token for link-only access validation
 */
export function checkPolicyAccess(
  policy: R2AccessPolicy,
  options?: {
    userId?: string;
    email?: string;
    accessToken?: string;
  }
): boolean {
  // Check expiration
  if (isPolicyExpired(policy)) return false;

  const { userId, email, accessToken } = options ?? {};

  switch (policy.mode) {
    case 'public':
      return true;

    case 'link-only':
      // SECURITY: Must validate the access token
      if (!accessToken || !policy.accessToken) return false;
      // Use constant-time comparison to prevent timing attacks
      if (accessToken.length !== policy.accessToken.length) return false;
      let mismatch = 0;
      for (let i = 0; i < accessToken.length; i++) {
        mismatch |= accessToken.charCodeAt(i) ^ policy.accessToken.charCodeAt(i);
      }
      return mismatch === 0;

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

// ═══════════════════════════════════════════════════════════════════
// ACCESS POLICY ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Policy enforcement result
 */
export interface PolicyEnforcementResult {
  allowed: boolean;
  reason?: string;
  policy?: R2AccessPolicy;
}

/**
 * Policy lookup function type
 */
export type PolicyLookupFn = (resourceKey: string) => Promise<R2AccessPolicy | null>;

/**
 * Enforce access policy for a resource
 *
 * This function should be called in download/access routes to validate
 * that the requester has permission to access the resource.
 *
 * @param resourceKey - The R2 object key being accessed
 * @param lookupPolicy - Function to lookup policy from database
 * @param accessOptions - The access credentials (userId, email, accessToken)
 * @returns PolicyEnforcementResult with allowed status and reason
 *
 * @example
 * ```typescript
 * // In your download route handler:
 * const result = await enforceAccessPolicy(
 *   objectKey,
 *   async (key) => {
 *     const row = await db.query(
 *       'SELECT * FROM aui_access_policies WHERE resource_pattern = $1',
 *       [key]
 *     );
 *     return row ? rowToPolicy(row) : null;
 *   },
 *   { userId: req.userId, accessToken: req.query.token }
 * );
 *
 * if (!result.allowed) {
 *   return res.status(403).json({ error: result.reason });
 * }
 * ```
 */
export async function enforceAccessPolicy(
  resourceKey: string,
  lookupPolicy: PolicyLookupFn,
  accessOptions?: {
    userId?: string;
    email?: string;
    accessToken?: string;
  }
): Promise<PolicyEnforcementResult> {
  // Look up policy for this resource
  const policy = await lookupPolicy(resourceKey);

  // No policy = private by default (deny access)
  if (!policy) {
    return {
      allowed: false,
      reason: 'No access policy found for resource',
    };
  }

  // Check expiration
  if (isPolicyExpired(policy)) {
    return {
      allowed: false,
      reason: 'Access policy has expired',
      policy,
    };
  }

  // Check access based on policy mode
  const hasAccess = checkPolicyAccess(policy, accessOptions);

  if (!hasAccess) {
    let reason: string;
    switch (policy.mode) {
      case 'link-only':
        reason = 'Invalid or missing access token';
        break;
      case 'private':
        reason = 'User not in allowed users list';
        break;
      case 'zero-trust':
        reason = 'User ID or email domain not authorized';
        break;
      default:
        reason = 'Access denied';
    }
    return {
      allowed: false,
      reason,
      policy,
    };
  }

  return {
    allowed: true,
    policy,
  };
}

/**
 * Match a resource key against a policy pattern
 *
 * Supports glob-style patterns:
 * - `*` matches any characters except `/`
 * - `**` matches any characters including `/`
 *
 * @example
 * ```typescript
 * matchesPattern('subsets/user123/subset456/export.json', 'subsets/user123/*') // true
 * matchesPattern('subsets/user123/subset456/export.json', 'subsets/**') // true
 * ```
 */
export function matchesResourcePattern(resourceKey: string, pattern: string): boolean {
  // Exact match
  if (resourceKey === pattern) return true;

  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
    .replace(/\*\*/g, '<<<GLOBSTAR>>>') // Temporarily replace **
    .replace(/\*/g, '[^/]*') // * matches anything except /
    .replace(/<<<GLOBSTAR>>>/g, '.*'); // ** matches anything

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(resourceKey);
}

/**
 * Find matching policy for a resource from a list of policies
 *
 * Returns the most specific matching policy (longest pattern match).
 */
export function findMatchingPolicy(
  resourceKey: string,
  policies: R2AccessPolicy[]
): R2AccessPolicy | null {
  let bestMatch: R2AccessPolicy | null = null;
  let bestMatchLength = -1;

  for (const policy of policies) {
    if (matchesResourcePattern(resourceKey, policy.resourcePattern)) {
      // Prefer more specific patterns (longer = more specific)
      if (policy.resourcePattern.length > bestMatchLength) {
        bestMatch = policy;
        bestMatchLength = policy.resourcePattern.length;
      }
    }
  }

  return bestMatch;
}

// ═══════════════════════════════════════════════════════════════════
// STORAGE QUOTA
// ═══════════════════════════════════════════════════════════════════

/**
 * Error thrown when storage quota is exceeded
 */
export class StorageQuotaExceededError extends Error {
  public readonly quotaResult: StorageQuotaResult;

  constructor(message: string, quotaResult: StorageQuotaResult) {
    super(message);
    this.name = 'StorageQuotaExceededError';
    this.quotaResult = quotaResult;
  }
}

/**
 * Extract userId from R2 key patterns
 *
 * Supports patterns:
 * - subsets/{userId}/{subsetId}/...
 * - users/{userId}/...
 * - shared/{token}/... (returns undefined)
 */
export function extractUserIdFromKey(key: string): string | undefined {
  // Pattern: subsets/{userId}/...
  const subsetsMatch = key.match(/^subsets\/([^/]+)\//);
  if (subsetsMatch) {
    return subsetsMatch[1];
  }

  // Pattern: users/{userId}/...
  const usersMatch = key.match(/^users\/([^/]+)\//);
  if (usersMatch) {
    return usersMatch[1];
  }

  // Shared keys don't have a userId
  if (key.startsWith('shared/')) {
    return undefined;
  }

  return undefined;
}

/**
 * Storage quota limits by tier (in bytes)
 */
export const STORAGE_QUOTA_LIMITS: Record<string, number> = {
  free: 0, // No cloud storage for free tier
  member: 100 * 1024 * 1024, // 100 MB
  pro: 1024 * 1024 * 1024, // 1 GB
  premium: 10 * 1024 * 1024 * 1024, // 10 GB
  admin: -1, // Unlimited
};

/**
 * Create a quota check function for a given tier and current usage
 *
 * @param userTier - User's subscription tier
 * @param currentUsageBytes - Current storage usage in bytes
 * @returns QuotaCheckFn that can be passed to upload options
 *
 * @example
 * ```typescript
 * const quotaCheck = createQuotaCheck('pro', await getUserStorageUsage(userId));
 * await adapter.upload(key, content, { quotaCheck });
 * ```
 */
export function createQuotaCheck(
  userTier: string,
  currentUsageBytes: number
): QuotaCheckFn {
  return async (userId: string, sizeBytes: number): Promise<StorageQuotaResult> => {
    const limitBytes = STORAGE_QUOTA_LIMITS[userTier] ?? STORAGE_QUOTA_LIMITS.free;

    // Unlimited storage
    if (limitBytes === -1) {
      return {
        allowed: true,
        usedBytes: currentUsageBytes,
        limitBytes: -1,
        percentUsed: 0,
        remainingBytes: -1,
      };
    }

    // No cloud storage allowed
    if (limitBytes === 0) {
      return {
        allowed: false,
        reason: `Cloud storage is not available for ${userTier} tier. Upgrade to Member for 100MB or Pro for 1GB.`,
        usedBytes: currentUsageBytes,
        limitBytes: 0,
        percentUsed: 100,
        remainingBytes: 0,
      };
    }

    const projectedUsage = currentUsageBytes + sizeBytes;
    const remainingBytes = Math.max(0, limitBytes - currentUsageBytes);
    const percentUsed = (currentUsageBytes / limitBytes) * 100;

    if (projectedUsage > limitBytes) {
      return {
        allowed: false,
        reason: `Storage quota exceeded. ` +
          `Current: ${formatBytes(currentUsageBytes)}, ` +
          `Limit: ${formatBytes(limitBytes)}, ` +
          `Requested: ${formatBytes(sizeBytes)}. ` +
          `Upgrade your plan for more storage.`,
        usedBytes: currentUsageBytes,
        limitBytes,
        percentUsed,
        remainingBytes,
      };
    }

    return {
      allowed: true,
      usedBytes: currentUsageBytes,
      limitBytes,
      percentUsed,
      remainingBytes,
    };
  };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes === -1) return 'Unlimited';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
