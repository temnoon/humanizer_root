/**
 * Project Gutenberg API Service
 * Search and download public domain books
 */

import { ApiClient } from './client';

export interface GutenbergBook {
  id: number;
  title: string;
  authors: string[];
  subjects: string[];
  languages: string[];
  downloads: number;
  formats: {
    [mimeType: string]: string;
  };
}

export interface GutenbergSearchResult {
  count: number;
  results: GutenbergBook[];
}

/**
 * Gutenberg API Service
 * Uses the npe-api as a proxy to avoid CORS issues
 */
export class GutenbergService {
  constructor(private client: ApiClient) {}

  /**
   * Search for books
   */
  async search(query: string, options?: {
    page?: number;
    limit?: number;
  }): Promise<GutenbergSearchResult> {
    const params: Record<string, string> = { q: query };
    if (options?.page) params.page = String(options.page);
    if (options?.limit) params.limit = String(options.limit);

    return this.client.get<GutenbergSearchResult>('/api/gutenberg/search', params);
  }

  /**
   * Get book metadata
   */
  async getBook(bookId: number): Promise<GutenbergBook> {
    return this.client.get<GutenbergBook>(`/api/gutenberg/books/${bookId}`);
  }

  /**
   * Get book content (plain text)
   */
  async getBookText(bookId: number): Promise<string> {
    const response = await fetch(
      `https://www.gutenberg.org/files/${bookId}/${bookId}-0.txt`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch book ${bookId}`);
    }
    return response.text();
  }

  /**
   * Get book content (HTML)
   */
  async getBookHtml(bookId: number): Promise<string> {
    const response = await fetch(
      `https://www.gutenberg.org/files/${bookId}/${bookId}-h/${bookId}-h.htm`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch book ${bookId}`);
    }
    return response.text();
  }
}
