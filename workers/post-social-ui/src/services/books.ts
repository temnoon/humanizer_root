/**
 * Books Service - API client for the Bookmaking Tool
 *
 * Phase 1: Core book structure with chapters, sections, pages, and annotations
 */

import { api } from './api';

// ============================================================================
// Types
// ============================================================================

export interface BookSettings {
  theme: 'light' | 'dark' | 'sepia';
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: 'serif' | 'sans' | 'mono';
  showProvenance: boolean;
  showAnnotations: boolean;
  enableCurator: boolean;
}

export interface BookStats {
  wordCount: number;
  pageCount: number;
  chapterCount: number;
  sourceCount: number;
  annotationCount: number;
  curatorConversations: number;
}

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  description?: string;
  coverImage?: string;
  visibility: 'private' | 'unlisted' | 'public';
  settings?: BookSettings;
  createdAt: number;
  updatedAt: number;
  stats: BookStats;
  chapters?: Chapter[];
}

export interface Chapter {
  id: string;
  bookId: string;
  title: string;
  orderIndex: number;
  epigraph?: string;
  summary?: string;
  sections: Section[];
  createdAt?: number;
  updatedAt?: number;
}

export interface Section {
  id: string;
  chapterId: string;
  title?: string;
  orderIndex: number;
  pages: PageSummary[];
  createdAt?: number;
  updatedAt?: number;
}

export interface PageSummary {
  id: string;
  sectionId: string;
  orderIndex: number;
  contentType: 'text' | 'conversation' | 'image' | 'embed';
  wordCount: number;
  source?: PageSource;
  createdAt?: number;
  updatedAt?: number;
}

export interface Page extends PageSummary {
  content: string;
  originalContent?: string;
  annotations: Annotation[];
  transformations: TransformationRecord[];
  curatorThreads: CuratorThread[];
}

export interface PageSource {
  type: 'archive' | 'gutenberg' | 'notes' | 'folder' | 'url' | 'manual' | 'synthesis';
  archiveName?: string;
  conversationId?: string;
  messageId?: string;
  gutenbergId?: number;
  gutenbergTitle?: string;
  gutenbergAuthor?: string;
  gutenbergChapter?: string;
  url?: string;
  finalUrl?: string;
  siteName?: string;
  siteAuthor?: string;
  publishedAt?: number;
  fetchedAt?: number;
  robotsTxtCompliant?: boolean;
  filePath?: string;
  fileName?: string;
  noteId?: string;
  notePath?: string;
  importedAt: number;
  originalWordCount: number;
  attribution?: {
    title: string;
    author?: string;
    source: string;
    url?: string;
    license?: string;
  };
}

export interface Annotation {
  id: string;
  pageId?: string;
  type: 'highlight' | 'note' | 'question' | 'link' | 'definition';
  startOffset: number;
  endOffset: number;
  selectedText: string;
  content: string;
  curatorResponse?: string;
  linkedPageId?: string;
  linkedUrl?: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TransformationRecord {
  id: string;
  toolId: string;
  toolName: string;
  parameters?: Record<string, unknown>;
  analysisResult?: Record<string, unknown>;
  appliedAt: number;
}

export interface CuratorThread {
  id: string;
  messages: CuratorMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface CuratorMessage {
  id: string;
  role: 'user' | 'curator';
  content: string;
  timestamp: number;
  suggestions?: string[];
  relatedPages?: string[];
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * List all books for the current user
 */
export async function listBooks(token: string): Promise<{ books: Book[] }> {
  return api.get('/books', token);
}

/**
 * Get a book with full structure (chapters, sections, page summaries)
 */
export async function getBook(token: string, bookId: string): Promise<Book> {
  return api.get(`/books/${bookId}`, token);
}

/**
 * Create a new book
 */
export async function createBook(
  token: string,
  params: {
    title: string;
    subtitle?: string;
    author?: string;
    description?: string;
    visibility?: 'private' | 'unlisted' | 'public';
    settings?: BookSettings;
  }
): Promise<Book> {
  return api.post('/books', params, token);
}

/**
 * Update book metadata
 */
export async function updateBook(
  token: string,
  bookId: string,
  params: Partial<{
    title: string;
    subtitle: string;
    author: string;
    description: string;
    visibility: 'private' | 'unlisted' | 'public';
    coverImage: string;
    settings: BookSettings;
  }>
): Promise<{ success: boolean; updatedAt: number }> {
  return api.put(`/books/${bookId}`, params, token);
}

/**
 * Delete a book
 */
export async function deleteBook(
  token: string,
  bookId: string
): Promise<{ success: boolean }> {
  return api.delete(`/books/${bookId}`, token);
}

// ============================================================================
// Chapters
// ============================================================================

/**
 * Create a chapter
 */
export async function createChapter(
  token: string,
  bookId: string,
  params: {
    title: string;
    epigraph?: string;
    summary?: string;
  }
): Promise<Chapter> {
  return api.post(`/books/${bookId}/chapters`, params, token);
}

/**
 * Update a chapter
 */
export async function updateChapter(
  token: string,
  bookId: string,
  chapterId: string,
  params: Partial<{
    title: string;
    epigraph: string;
    summary: string;
  }>
): Promise<{ success: boolean; updatedAt: number }> {
  return api.put(`/books/${bookId}/chapters/${chapterId}`, params, token);
}

/**
 * Delete a chapter
 */
export async function deleteChapter(
  token: string,
  bookId: string,
  chapterId: string
): Promise<{ success: boolean }> {
  return api.delete(`/books/${bookId}/chapters/${chapterId}`, token);
}

/**
 * Reorder chapters
 */
export async function reorderChapters(
  token: string,
  bookId: string,
  chapterIds: string[]
): Promise<{ success: boolean }> {
  return api.post(`/books/${bookId}/chapters/reorder`, { chapterIds }, token);
}

// ============================================================================
// Sections
// ============================================================================

/**
 * Create a section
 */
export async function createSection(
  token: string,
  bookId: string,
  chapterId: string,
  params: { title?: string }
): Promise<Section> {
  return api.post(`/books/${bookId}/chapters/${chapterId}/sections`, params, token);
}

/**
 * Update a section
 */
export async function updateSection(
  token: string,
  bookId: string,
  sectionId: string,
  params: { title?: string }
): Promise<{ success: boolean; updatedAt: number }> {
  return api.put(`/books/${bookId}/sections/${sectionId}`, params, token);
}

/**
 * Delete a section
 */
export async function deleteSection(
  token: string,
  bookId: string,
  sectionId: string
): Promise<{ success: boolean }> {
  return api.delete(`/books/${bookId}/sections/${sectionId}`, token);
}

// ============================================================================
// Pages
// ============================================================================

/**
 * Create a page
 */
export async function createPage(
  token: string,
  bookId: string,
  sectionId: string,
  params: {
    content: string;
    contentType?: 'text' | 'conversation' | 'image' | 'embed';
    source: PageSource;
  }
): Promise<Page> {
  return api.post(`/books/${bookId}/sections/${sectionId}/pages`, params, token);
}

/**
 * Get a page with annotations and transformations
 */
export async function getPage(
  token: string,
  bookId: string,
  pageId: string
): Promise<Page> {
  return api.get(`/books/${bookId}/pages/${pageId}`, token);
}

/**
 * Update a page
 */
export async function updatePage(
  token: string,
  bookId: string,
  pageId: string,
  params: { content: string }
): Promise<{ success: boolean; updatedAt: number }> {
  return api.put(`/books/${bookId}/pages/${pageId}`, params, token);
}

/**
 * Delete a page
 */
export async function deletePage(
  token: string,
  bookId: string,
  pageId: string
): Promise<{ success: boolean }> {
  return api.delete(`/books/${bookId}/pages/${pageId}`, token);
}

// ============================================================================
// Annotations
// ============================================================================

/**
 * Add an annotation
 */
export async function addAnnotation(
  token: string,
  bookId: string,
  pageId: string,
  params: {
    type: 'highlight' | 'note' | 'question' | 'link' | 'definition';
    startOffset: number;
    endOffset: number;
    selectedText: string;
    content: string;
    linkedPageId?: string;
    linkedUrl?: string;
    color?: string;
  }
): Promise<Annotation> {
  return api.post(`/books/${bookId}/pages/${pageId}/annotations`, params, token);
}

/**
 * Update an annotation
 */
export async function updateAnnotation(
  token: string,
  bookId: string,
  annotationId: string,
  params: Partial<{
    content: string;
    color: string;
    curatorResponse: string;
  }>
): Promise<{ success: boolean; updatedAt: number }> {
  return api.put(`/books/${bookId}/annotations/${annotationId}`, params, token);
}

/**
 * Delete an annotation
 */
export async function deleteAnnotation(
  token: string,
  bookId: string,
  annotationId: string
): Promise<{ success: boolean }> {
  return api.delete(`/books/${bookId}/annotations/${annotationId}`, token);
}

// ============================================================================
// Export for convenient namespace import
// ============================================================================

export const booksService = {
  listBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  createChapter,
  updateChapter,
  deleteChapter,
  reorderChapters,
  createSection,
  updateSection,
  deleteSection,
  createPage,
  getPage,
  updatePage,
  deletePage,
  addAnnotation,
  updateAnnotation,
  deleteAnnotation,
};
