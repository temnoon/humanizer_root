/**
 * Google Drive Storage Adapter
 *
 * Provides cloud storage backend for Google Drive using OAuth2.
 * Used for:
 * - Storing archive subset exports
 * - Syncing content with user's Drive
 * - Backup and restore operations
 *
 * Requires Google OAuth with drive.file or drive scope.
 *
 * Usage:
 * ```typescript
 * import { GoogleDriveAdapter } from '@humanizer/core/storage';
 *
 * const adapter = new GoogleDriveAdapter({
 *   clientId: process.env.GOOGLE_CLIENT_ID!,
 *   clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
 *   redirectUri: 'http://localhost:3000/auth/callback',
 * });
 *
 * // Get auth URL for user consent
 * const authUrl = adapter.getAuthUrl();
 *
 * // Exchange code for tokens
 * await adapter.setAuthCode(code);
 *
 * // Upload a file
 * await adapter.uploadFile('backup.json', jsonContent, {
 *   mimeType: 'application/json',
 *   folder: 'Humanizer Exports',
 * });
 * ```
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface GoogleDriveConfig {
  /** OAuth client ID */
  clientId: string;
  /** OAuth client secret */
  clientSecret: string;
  /** OAuth redirect URI */
  redirectUri: string;
  /** OAuth scopes (defaults to drive.file) */
  scopes?: string[];
}

export interface GoogleDriveTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  scope: string;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  webViewLink?: string;
  webContentLink?: string;
  description?: string;
  starred?: boolean;
  trashed?: boolean;
}

export interface DriveUploadOptions {
  /** MIME type of the content */
  mimeType?: string;
  /** Folder name or ID to upload to */
  folder?: string;
  /** File description */
  description?: string;
  /** Whether to convert to Google format */
  convertToGoogleFormat?: boolean;
}

export interface DriveUploadResult {
  fileId: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
  size: number;
}

export interface DriveListOptions {
  /** Folder ID to list (defaults to root) */
  folderId?: string;
  /** Query filter (Google Drive query syntax) */
  query?: string;
  /** Max results to return */
  pageSize?: number;
  /** Page token for pagination */
  pageToken?: string;
  /** Fields to include in response */
  fields?: string[];
}

export interface DriveListResult {
  files: DriveFileMetadata[];
  nextPageToken?: string;
}

// Internal types for Google API responses
interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GoogleDriveFileResponse {
  id: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
}

interface GoogleDriveListResponse {
  files?: DriveFileMetadata[];
  nextPageToken?: string;
}

interface GoogleDriveAboutResponse {
  storageQuota: {
    limit?: string;
    usage?: string;
    usageInDrive?: string;
    usageInDriveTrash?: string;
  };
}

// Default scopes for humanizer operations
const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/drive.file', // Access to files created by app
  'https://www.googleapis.com/auth/userinfo.email', // User email for identification
];

// Google API endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

// ═══════════════════════════════════════════════════════════════════
// GOOGLE DRIVE ADAPTER CLASS
// ═══════════════════════════════════════════════════════════════════

export class GoogleDriveAdapter {
  private config: GoogleDriveConfig;
  private tokens: GoogleDriveTokens | null = null;
  private folderCache = new Map<string, string>(); // name -> id

  constructor(config: GoogleDriveConfig) {
    this.config = {
      ...config,
      scopes: config.scopes || DEFAULT_SCOPES,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // AUTHENTICATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get OAuth authorization URL for user consent
   */
  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: (this.config.scopes || DEFAULT_SCOPES).join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });

    if (state) {
      params.set('state', state);
    }

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async setAuthCode(code: string): Promise<GoogleDriveTokens> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange auth code: ${error}`);
    }

    const data = (await response.json()) as GoogleTokenResponse;
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: data.token_type,
      scope: data.scope,
    };

    return this.tokens;
  }

  /**
   * Set tokens directly (for restoring from storage)
   */
  setTokens(tokens: GoogleDriveTokens): void {
    this.tokens = tokens;
  }

  /**
   * Get current tokens
   */
  getTokens(): GoogleDriveTokens | null {
    return this.tokens;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.tokens !== null && this.tokens.accessToken !== '';
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = (await response.json()) as GoogleTokenResponse;
    this.tokens = {
      ...this.tokens,
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: data.token_type,
      scope: data.scope || this.tokens.scope,
    };
  }

  /**
   * Get a valid access token, refreshing if needed
   */
  private async getAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('Not authenticated');
    }

    // Refresh if token expires within 5 minutes
    if (this.tokens.expiresAt < Date.now() + 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }

    return this.tokens.accessToken;
  }

  // ─────────────────────────────────────────────────────────────────
  // FILE OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(
    name: string,
    content: Buffer | string | ReadableStream,
    options: DriveUploadOptions = {}
  ): Promise<DriveUploadResult> {
    const accessToken = await this.getAccessToken();

    // Get or create folder if specified
    let folderId: string | undefined;
    if (options.folder) {
      folderId = await this.getOrCreateFolder(options.folder);
    }

    // Prepare metadata
    const metadata: Record<string, unknown> = {
      name,
      mimeType: options.mimeType || 'application/octet-stream',
    };

    if (folderId) {
      metadata.parents = [folderId];
    }

    if (options.description) {
      metadata.description = options.description;
    }

    // Convert content to Buffer
    let contentBuffer: Buffer;
    if (typeof content === 'string') {
      contentBuffer = Buffer.from(content, 'utf-8');
    } else if (Buffer.isBuffer(content)) {
      contentBuffer = content;
    } else {
      // ReadableStream - collect chunks
      const chunks: Uint8Array[] = [];
      const stream = content as ReadableStream<Uint8Array>;
      const reader = stream.getReader();
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) {
          chunks.push(result.value);
        }
      }
      contentBuffer = Buffer.concat(chunks);
    }

    // Use multipart upload
    const boundary = '-------humanizer-upload-boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart =
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata);

    const contentPart =
      `Content-Type: ${options.mimeType || 'application/octet-stream'}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      contentBuffer.toString('base64');

    const multipartBody =
      delimiter + metadataPart + delimiter + contentPart + closeDelimiter;

    const response = await fetch(
      `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,webViewLink,webContentLink,size`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload file: ${error}`);
    }

    const result = (await response.json()) as GoogleDriveFileResponse;
    return {
      fileId: result.id,
      name: result.name,
      webViewLink: result.webViewLink,
      webContentLink: result.webContentLink,
      size: parseInt(result.size || '0', 10),
    };
  }

  /**
   * Download a file from Google Drive
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to download file: ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(
    fileId: string,
    fields?: string[]
  ): Promise<DriveFileMetadata> {
    const accessToken = await this.getAccessToken();

    const fieldsParam = (
      fields || [
        'id',
        'name',
        'mimeType',
        'size',
        'createdTime',
        'modifiedTime',
        'parents',
        'webViewLink',
        'webContentLink',
        'description',
        'starred',
        'trashed',
      ]
    ).join(',');

    const response = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}?fields=${fieldsParam}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get file metadata: ${error}`);
    }

    return (await response.json()) as DriveFileMetadata;
  }

  /**
   * List files in Drive
   */
  async listFiles(options: DriveListOptions = {}): Promise<DriveListResult> {
    const accessToken = await this.getAccessToken();

    const params = new URLSearchParams();

    // Build query
    const queryParts: string[] = [];
    if (options.folderId) {
      queryParts.push(`'${options.folderId}' in parents`);
    }
    if (options.query) {
      queryParts.push(options.query);
    }
    // Exclude trashed files by default
    queryParts.push('trashed = false');

    params.set('q', queryParts.join(' and '));

    if (options.pageSize) {
      params.set('pageSize', options.pageSize.toString());
    }
    if (options.pageToken) {
      params.set('pageToken', options.pageToken);
    }

    const fieldsParam = (
      options.fields || [
        'id',
        'name',
        'mimeType',
        'size',
        'createdTime',
        'modifiedTime',
        'parents',
        'webViewLink',
      ]
    ).join(',');
    params.set('fields', `nextPageToken,files(${fieldsParam})`);

    const response = await fetch(`${DRIVE_API_BASE}/files?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list files: ${error}`);
    }

    const result = (await response.json()) as GoogleDriveListResponse;
    return {
      files: result.files || [],
      nextPageToken: result.nextPageToken,
    };
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  /**
   * Update file content
   */
  async updateFile(
    fileId: string,
    content: Buffer | string,
    mimeType?: string
  ): Promise<DriveUploadResult> {
    const accessToken = await this.getAccessToken();

    const contentBuffer =
      typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

    const response = await fetch(
      `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media&fields=id,name,webViewLink,webContentLink,size`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': mimeType || 'application/octet-stream',
        },
        body: contentBuffer,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update file: ${error}`);
    }

    const result = (await response.json()) as GoogleDriveFileResponse;
    return {
      fileId: result.id,
      name: result.name,
      webViewLink: result.webViewLink,
      webContentLink: result.webContentLink,
      size: parseInt(result.size || '0', 10),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // FOLDER OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a folder
   */
  async createFolder(name: string, parentId?: string): Promise<string> {
    const accessToken = await this.getAccessToken();

    const metadata: Record<string, unknown> = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentId) {
      metadata.parents = [parentId];
    }

    const response = await fetch(`${DRIVE_API_BASE}/files?fields=id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create folder: ${error}`);
    }

    const result = (await response.json()) as { id: string };
    this.folderCache.set(name, result.id);
    return result.id;
  }

  /**
   * Find a folder by name
   */
  async findFolder(name: string): Promise<string | null> {
    // Check cache first
    if (this.folderCache.has(name)) {
      return this.folderCache.get(name)!;
    }

    const accessToken = await this.getAccessToken();

    const query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    const response = await fetch(
      `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to find folder: ${error}`);
    }

    const result = (await response.json()) as { files?: Array<{ id: string }> };
    if (result.files && result.files.length > 0) {
      const folderId = result.files[0].id;
      this.folderCache.set(name, folderId);
      return folderId;
    }

    return null;
  }

  /**
   * Get or create a folder
   */
  async getOrCreateFolder(name: string): Promise<string> {
    const existing = await this.findFolder(name);
    if (existing) {
      return existing;
    }
    return this.createFolder(name);
  }

  // ─────────────────────────────────────────────────────────────────
  // HUMANIZER-SPECIFIC OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Upload a subset export to Google Drive
   */
  async uploadSubsetExport(
    subsetId: string,
    content: Buffer | string,
    format: 'json' | 'jsonl' | 'markdown' | 'html'
  ): Promise<DriveUploadResult> {
    const mimeTypes: Record<string, string> = {
      json: 'application/json',
      jsonl: 'application/x-ndjson',
      markdown: 'text/markdown',
      html: 'text/html',
    };

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `humanizer-export-${subsetId}-${timestamp}.${format}`;

    return this.uploadFile(filename, content, {
      mimeType: mimeTypes[format],
      folder: 'Humanizer Exports',
      description: `Humanizer archive subset export (${subsetId})`,
    });
  }

  /**
   * List all Humanizer exports in Drive
   */
  async listExports(): Promise<DriveListResult> {
    const folderId = await this.findFolder('Humanizer Exports');
    if (!folderId) {
      return { files: [] };
    }

    return this.listFiles({
      folderId,
      query: "name contains 'humanizer-export'",
    });
  }

  /**
   * Get storage quota information
   */
  async getStorageQuota(): Promise<{
    limit: number;
    usage: number;
    usageInDrive: number;
    usageInDriveTrash: number;
  }> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `${DRIVE_API_BASE}/about?fields=storageQuota`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get storage quota: ${error}`);
    }

    const result = (await response.json()) as GoogleDriveAboutResponse;
    const quota = result.storageQuota;

    return {
      limit: parseInt(quota.limit || '0', 10),
      usage: parseInt(quota.usage || '0', 10),
      usageInDrive: parseInt(quota.usageInDrive || '0', 10),
      usageInDriveTrash: parseInt(quota.usageInDriveTrash || '0', 10),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION KEYS
// ═══════════════════════════════════════════════════════════════════

export const GOOGLE_DRIVE_CONFIG_KEYS = {
  CLIENT_ID: 'google.drive.clientId',
  CLIENT_SECRET: 'google.drive.clientSecret',
  REDIRECT_URI: 'google.drive.redirectUri',
  SCOPES: 'google.drive.scopes',
  DEFAULT_FOLDER: 'google.drive.defaultFolder',
} as const;

export const GOOGLE_DRIVE_DEFAULTS = {
  [GOOGLE_DRIVE_CONFIG_KEYS.DEFAULT_FOLDER]: 'Humanizer Exports',
  [GOOGLE_DRIVE_CONFIG_KEYS.SCOPES]: DEFAULT_SCOPES,
} as const;
