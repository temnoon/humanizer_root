/**
 * Personas Service
 *
 * API wrapper for persona management and Gutenberg integration.
 * Provides browsing, selection, and creation of personas from literary sources.
 */

const NPE_API_BASE = 'https://npe-api.tem-527.workers.dev';

// ==========================================
// Types
// ==========================================

export interface Persona {
  id: number;
  name: string;
  description: string;
  system_prompt?: string;
  source: 'global' | 'personal';
  sourceInfo?: {
    bookTitle?: string;
    author?: string;
    gutenberg_id?: number;
  };
}

export interface PersonaAttributes {
  voice: string;
  perspective: string;
  tone: string;
  register: string;
  rhetoricalMode: string;
}

export interface ExtractedPersona {
  persona_id: number;
  name: string;
  description: string;
  system_prompt: string;
  attributes: PersonaAttributes;
  example_patterns: string[];
  source_info: {
    bookTitle?: string;
    author?: string;
    gutenberg_id?: number;
    sampleLength: number;
  };
  extraction_id: string;
  processing_time_ms: number;
}

export interface GutenbergBook {
  id: number;
  title: string;
  authors: string[];
  languages: string[];
  subjects: string[];
  downloadCount: number;
}

export interface GutenbergSearchResult {
  count: number;
  page: number;
  hasMore: boolean;
  books: GutenbergBook[];
}

export interface GutenbergBookPreview {
  id: number;
  title: string;
  authors: string[];
  languages: string[];
  subjects: string[];
  bookshelves: string[];
  sampleText: string;
  sampleLength: number;
  fullTextLength: number;
}

// ==========================================
// Helpers
// ==========================================

function getHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ==========================================
// Persona API Functions
// ==========================================

/**
 * Get global NPE personas (no auth required)
 */
export async function getGlobalPersonas(): Promise<Persona[]> {
  const response = await fetch(`${NPE_API_BASE}/config/personas`);

  if (!response.ok) {
    throw new Error(`Failed to fetch global personas: ${response.statusText}`);
  }

  const data = await response.json();

  // Transform to common format
  return (data.personas || data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    system_prompt: p.system_prompt,
    source: 'global' as const,
  }));
}

/**
 * Get user's personal personas (auth required)
 */
export async function getPersonalPersonas(token: string): Promise<Persona[]> {
  const response = await fetch(`${NPE_API_BASE}/personal/personas`, {
    headers: getHeaders(token),
  });

  if (!response.ok) {
    if (response.status === 401) {
      return []; // Not logged in, return empty
    }
    throw new Error(`Failed to fetch personal personas: ${response.statusText}`);
  }

  const data = await response.json();

  // Transform to common format
  return (data.personas || data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description || '',
    system_prompt: p.system_prompt,
    source: 'personal' as const,
    sourceInfo: p.custom_metadata ? JSON.parse(p.custom_metadata) : undefined,
  }));
}

/**
 * Get all personas (global + personal combined)
 */
export async function getAllPersonas(token?: string): Promise<{
  global: Persona[];
  personal: Persona[];
}> {
  const [global, personal] = await Promise.all([
    getGlobalPersonas(),
    token ? getPersonalPersonas(token) : Promise.resolve([]),
  ]);

  return { global, personal };
}

// ==========================================
// Gutenberg API Functions
// ==========================================

/**
 * Search Gutenberg books by title or author
 */
export async function searchGutenberg(
  query: string,
  page: number = 1
): Promise<GutenbergSearchResult> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
  });

  const response = await fetch(`${NPE_API_BASE}/gutenberg/search?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Search failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get book preview with sample text
 */
export async function getGutenbergBook(
  bookIdOrUrl: string | number
): Promise<GutenbergBookPreview> {
  const response = await fetch(`${NPE_API_BASE}/gutenberg/book/${bookIdOrUrl}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to fetch book: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Extract persona from Gutenberg book
 */
export async function extractPersonaFromGutenberg(
  bookId: number,
  customName?: string,
  token?: string
): Promise<ExtractedPersona> {
  const response = await fetch(`${NPE_API_BASE}/gutenberg/extract-persona`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({
      bookId,
      customName,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Persona extraction failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Parse Gutenberg ID from URL (utility for validation)
 */
export async function parseGutenbergInput(
  input: string
): Promise<{ valid: boolean; bookId?: number; error?: string }> {
  const params = new URLSearchParams({ input });
  const response = await fetch(`${NPE_API_BASE}/gutenberg/parse?${params}`);
  return response.json();
}

// ==========================================
// Export service object
// ==========================================

export const personasService = {
  getGlobalPersonas,
  getPersonalPersonas,
  getAllPersonas,
  searchGutenberg,
  getGutenbergBook,
  extractPersonaFromGutenberg,
  parseGutenbergInput,
};
