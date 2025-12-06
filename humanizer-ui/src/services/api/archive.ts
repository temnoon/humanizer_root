/**
 * Archive API Service
 * Access to local archive server (Electron only)
 */

import { ApiClient } from './client';

export interface Archive {
  id: string;
  name: string;
  path: string;
  created: string;
  conversationCount: number;
  messageCount: number;
}

export interface Conversation {
  id: string;
  title: string;
  created: string;
  updated: string;
  messageCount: number;
  model?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface ParseJobStatus {
  jobId: string;
  status: 'parsing' | 'complete' | 'error';
  progress: number;
  total: number;
  error?: string;
  result?: {
    conversationCount: number;
    messageCount: number;
    mediaCount: number;
  };
}

export interface FacebookContentItem {
  id: string;
  type: 'post' | 'comment';
  source: 'facebook';
  text: string;
  title?: string;
  created_at: number;
  author_name?: string;
  is_own_content: boolean;
  file_path?: string;
  media_refs?: string; // JSON array
  context?: string;
  metadata?: string;
}

export interface ContentQueryOptions {
  source: 'facebook' | 'openai';
  limit?: number;
  offset?: number;
  type?: 'post' | 'comment' | 'all';
  period?: string; // "2023-Q1" or "2023"
}

export class ArchiveService {
  constructor(private client: ApiClient) {}

  /**
   * List all archives
   */
  async listArchives(): Promise<Archive[]> {
    return this.client.get<Archive[]>('/api/archives');
  }

  /**
   * Get archive by ID
   */
  async getArchive(archiveId: string): Promise<Archive> {
    return this.client.get<Archive>(`/api/archives/${archiveId}`);
  }

  /**
   * List conversations in archive
   */
  async listConversations(
    archiveId: string,
    options?: {
      limit?: number;
      offset?: number;
      search?: string;
    }
  ): Promise<Conversation[]> {
    const params: Record<string, string> = {};
    if (options?.limit) params.limit = String(options.limit);
    if (options?.offset) params.offset = String(options.offset);
    if (options?.search) params.search = options.search;

    return this.client.get<Conversation[]>(
      `/api/archives/${archiveId}/conversations`,
      params
    );
  }

  /**
   * Get conversation by ID
   */
  async getConversation(
    archiveId: string,
    conversationId: string
  ): Promise<Conversation & { messages: Message[] }> {
    return this.client.get(
      `/api/archives/${archiveId}/conversations/${conversationId}`
    );
  }

  /**
   * Upload archive ZIP file
   */
  async uploadArchive(file: File, archiveType?: string): Promise<{ jobId: string }> {
    const formData = new FormData();
    formData.append('archive', file);
    if (archiveType) {
      formData.append('archiveType', archiveType);
    }

    const response = await fetch(`${this.client['baseUrl']}/api/import/archive/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json();
  }

  /**
   * Trigger archive parsing
   */
  async parseArchive(jobId: string): Promise<void> {
    return this.client.post('/api/import/archive/parse', { jobId });
  }

  /**
   * Import archive from folder
   */
  async importFromFolder(folderPath: string): Promise<{ jobId: string }> {
    return this.client.post('/api/import/archive/folder', { folderPath });
  }

  /**
   * Check import job status
   */
  async getImportStatus(jobId: string): Promise<ParseJobStatus> {
    return this.client.get(`/api/import/archive/status/${jobId}`);
  }

  /**
   * Get import preview
   */
  async getImportPreview(jobId: string): Promise<{ preview: any }> {
    return this.client.get(`/api/import/archive/preview/${jobId}`);
  }

  /**
   * Apply parsed archive
   */
  async applyImport(jobId: string, targetArchivePath?: string, generateEmbeddings?: boolean): Promise<{ success: boolean }> {
    return this.client.post(`/api/import/archive/apply/${jobId}`, {
      archivePath: targetArchivePath,
      generateEmbeddings
    });
  }

  /**
   * Import single conversation JSON
   */
  async importConversation(conversation: any, filename: string): Promise<{ success: boolean; message_count: number }> {
    return this.client.post('/api/import/conversation', { conversation, filename });
  }

  /**
   * List Facebook content items (posts, comments)
   */
  async listContentItems(options: ContentQueryOptions): Promise<{
    items: FacebookContentItem[];
    total: number;
    hasMore: boolean;
  }> {
    const params: Record<string, string> = {
      source: options.source,
      limit: String(options.limit || 50),
      offset: String(options.offset || 0),
    };

    if (options.type && options.type !== 'all') {
      params.type = options.type;
    }

    if (options.period) {
      params.period = options.period;
    }

    return this.client.get('/api/content/items', params);
  }

  /**
   * Search Facebook content
   */
  async searchContent(query: string, options: ContentQueryOptions): Promise<FacebookContentItem[]> {
    return this.client.post('/api/content/search', {
      query,
      source: options.source,
      limit: options.limit || 50,
      offset: options.offset || 0,
    });
  }

  /**
   * Get media gallery items
   */
  async getGalleryItems(source: string, limit: number, offset: number): Promise<{
    items: any[];
    total: number;
    hasMore: boolean;
  }> {
    return this.client.get('/api/gallery', {
      source,
      limit: String(limit),
      offset: String(offset),
    });
  }
}
