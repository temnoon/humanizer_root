/**
 * Books Service - API client for the Bookmaking Tool
 * Connects to npe-api backend at /books endpoints
 */

// Use the same API base as the main app
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://npe-api.tem-527.workers.dev';

// Token storage keys for cross-app compatibility
const TOKEN_KEYS = [
  'narrative-studio-auth-token',
  'post-social:token',
];

function getToken(): string | null {
  for (const key of TOKEN_KEYS) {
    const token = localStorage.getItem(key);
    if (token) return token;
  }
  return null;
}

async function authenticatedFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}

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
// Books API
// ============================================================================

export async function listBooks(): Promise<{ books: Book[] }> {
  return authenticatedFetch('/books');
}

export async function getBook(bookId: string): Promise<Book> {
  return authenticatedFetch(`/books/${bookId}`);
}

export async function createBook(params: {
  title: string;
  subtitle?: string;
  author?: string;
  description?: string;
  visibility?: 'private' | 'unlisted' | 'public';
  settings?: BookSettings;
}): Promise<Book> {
  return authenticatedFetch('/books', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateBook(
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
  return authenticatedFetch(`/books/${bookId}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export async function deleteBook(bookId: string): Promise<{ success: boolean }> {
  return authenticatedFetch(`/books/${bookId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Chapters API
// ============================================================================

export async function createChapter(
  bookId: string,
  params: { title: string; epigraph?: string; summary?: string }
): Promise<Chapter> {
  return authenticatedFetch(`/books/${bookId}/chapters`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateChapter(
  bookId: string,
  chapterId: string,
  params: Partial<{ title: string; epigraph: string; summary: string }>
): Promise<{ success: boolean; updatedAt: number }> {
  return authenticatedFetch(`/books/${bookId}/chapters/${chapterId}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export async function deleteChapter(
  bookId: string,
  chapterId: string
): Promise<{ success: boolean }> {
  return authenticatedFetch(`/books/${bookId}/chapters/${chapterId}`, {
    method: 'DELETE',
  });
}

export async function reorderChapters(
  bookId: string,
  chapterIds: string[]
): Promise<{ success: boolean }> {
  return authenticatedFetch(`/books/${bookId}/chapters/reorder`, {
    method: 'POST',
    body: JSON.stringify({ chapterIds }),
  });
}

export async function reorderSections(
  bookId: string,
  chapterId: string,
  sectionIds: string[]
): Promise<{ success: boolean }> {
  return authenticatedFetch(`/books/${bookId}/chapters/${chapterId}/sections/reorder`, {
    method: 'POST',
    body: JSON.stringify({ sectionIds }),
  });
}

export async function reorderPages(
  bookId: string,
  sectionId: string,
  pageIds: string[]
): Promise<{ success: boolean }> {
  return authenticatedFetch(`/books/${bookId}/sections/${sectionId}/pages/reorder`, {
    method: 'POST',
    body: JSON.stringify({ pageIds }),
  });
}

export async function movePage(
  bookId: string,
  pageId: string,
  targetSectionId: string,
  targetIndex?: number
): Promise<{ success: boolean }> {
  return authenticatedFetch(`/books/${bookId}/pages/${pageId}/move`, {
    method: 'POST',
    body: JSON.stringify({ targetSectionId, targetIndex }),
  });
}

export async function moveSection(
  bookId: string,
  sectionId: string,
  targetChapterId: string,
  targetIndex?: number
): Promise<{ success: boolean }> {
  return authenticatedFetch(`/books/${bookId}/sections/${sectionId}/move`, {
    method: 'POST',
    body: JSON.stringify({ targetChapterId, targetIndex }),
  });
}

// ============================================================================
// Sections API
// ============================================================================

export async function createSection(
  bookId: string,
  chapterId: string,
  params: { title?: string }
): Promise<Section> {
  return authenticatedFetch(`/books/${bookId}/chapters/${chapterId}/sections`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateSection(
  bookId: string,
  sectionId: string,
  params: { title?: string }
): Promise<{ success: boolean; updatedAt: number }> {
  return authenticatedFetch(`/books/${bookId}/sections/${sectionId}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export async function deleteSection(
  bookId: string,
  sectionId: string
): Promise<{ success: boolean }> {
  return authenticatedFetch(`/books/${bookId}/sections/${sectionId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Pages API
// ============================================================================

export async function createPage(
  bookId: string,
  sectionId: string,
  params: {
    content: string;
    contentType?: 'text' | 'conversation' | 'image' | 'embed';
    source: PageSource;
  }
): Promise<Page> {
  return authenticatedFetch(`/books/${bookId}/sections/${sectionId}/pages`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getPage(bookId: string, pageId: string): Promise<Page> {
  return authenticatedFetch(`/books/${bookId}/pages/${pageId}`);
}

export async function updatePage(
  bookId: string,
  pageId: string,
  params: { content: string }
): Promise<{ success: boolean; updatedAt: number }> {
  return authenticatedFetch(`/books/${bookId}/pages/${pageId}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export async function deletePage(
  bookId: string,
  pageId: string
): Promise<{ success: boolean }> {
  return authenticatedFetch(`/books/${bookId}/pages/${pageId}`, {
    method: 'DELETE',
  });
}

export async function splitPage(
  bookId: string,
  pageId: string,
  splitPosition: number
): Promise<{ firstPage: Page; secondPage: Page }> {
  return authenticatedFetch(`/books/${bookId}/pages/${pageId}/split`, {
    method: 'POST',
    body: JSON.stringify({ splitPosition }),
  });
}

export async function mergePages(
  bookId: string,
  firstPageId: string,
  secondPageId: string
): Promise<Page> {
  return authenticatedFetch(`/books/${bookId}/pages/merge`, {
    method: 'POST',
    body: JSON.stringify({ firstPageId, secondPageId }),
  });
}

// ============================================================================
// Annotations API
// ============================================================================

export async function addAnnotation(
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
  return authenticatedFetch(`/books/${bookId}/pages/${pageId}/annotations`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateAnnotation(
  bookId: string,
  annotationId: string,
  params: Partial<{
    content: string;
    color: string;
    curatorResponse: string;
  }>
): Promise<{ success: boolean; updatedAt: number }> {
  return authenticatedFetch(`/books/${bookId}/annotations/${annotationId}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export async function deleteAnnotation(
  bookId: string,
  annotationId: string
): Promise<{ success: boolean }> {
  return authenticatedFetch(`/books/${bookId}/annotations/${annotationId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Export service object
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
  reorderSections,
  reorderPages,
  movePage,
  moveSection,
  createSection,
  updateSection,
  deleteSection,
  createPage,
  getPage,
  updatePage,
  deletePage,
  splitPage,
  mergePages,
  addAnnotation,
  updateAnnotation,
  deleteAnnotation,
};
