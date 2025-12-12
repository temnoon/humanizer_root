/**
 * Gutenberg Routes - Search and fetch Project Gutenberg books
 *
 * Endpoints:
 * - GET /gutenberg/search?q=...&page=1 - Search books
 * - GET /gutenberg/book/:id - Get book metadata + sample text
 * - POST /gutenberg/extract-persona - Extract persona from book
 */

import { Hono } from 'hono';
import { optionalLocalAuth, getAuthContext } from '../middleware/auth';
import {
  searchBooks,
  getBookPreview,
  parseGutenbergInput,
  formatAuthor,
  fetchBookText,
  type GutenbergBook,
} from '../services/gutenberg';
import { preprocessGutenbergText } from '../services/gutenberg-preprocessor';
import { PersonaExtractionService } from '../services/persona-extraction';
import type { Env } from '../../shared/types';

const gutenbergRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /gutenberg/search - Search Gutenberg books
 *
 * Query params:
 * - q: Search query (title or author)
 * - page: Page number (default 1)
 * - languages: Comma-separated language codes (default 'en')
 */
gutenbergRoutes.get('/search', async (c) => {
  try {
    const query = c.req.query('q');
    const page = parseInt(c.req.query('page') || '1', 10);
    const languages = (c.req.query('languages') || 'en').split(',');

    if (!query || query.trim().length < 2) {
      return c.json({ error: 'Search query must be at least 2 characters' }, 400);
    }

    const results = await searchBooks(query.trim(), page, languages);

    // Format response for frontend
    const books = results.results.map((book: GutenbergBook) => ({
      id: book.id,
      title: book.title,
      authors: book.authors.map(formatAuthor),
      languages: book.languages,
      subjects: book.subjects.slice(0, 5), // Limit subjects
      downloadCount: book.download_count,
    }));

    return c.json({
      count: results.count,
      page,
      hasMore: results.next !== null,
      books,
    }, 200);
  } catch (error) {
    console.error('[Gutenberg] Search error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Search failed',
    }, 500);
  }
});

/**
 * GET /gutenberg/book/:id - Get book with sample text
 *
 * Also accepts Gutenberg URL as :id parameter
 */
gutenbergRoutes.get('/book/:id', async (c) => {
  try {
    const idParam = c.req.param('id');
    const bookId = parseGutenbergInput(idParam);

    if (!bookId) {
      return c.json({ error: 'Invalid book ID or URL' }, 400);
    }

    const preview = await getBookPreview(bookId);

    return c.json({
      id: preview.book.id,
      title: preview.book.title,
      authors: preview.book.authors.map(formatAuthor),
      languages: preview.book.languages,
      subjects: preview.book.subjects,
      bookshelves: preview.book.bookshelves,
      sampleText: preview.sampleText,
      sampleLength: preview.sampleText.length,
      fullTextLength: preview.fullTextLength,
    }, 200);
  } catch (error) {
    console.error('[Gutenberg] Get book error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: error.message }, 404);
    }

    return c.json({
      error: error instanceof Error ? error.message : 'Failed to fetch book',
    }, 500);
  }
});

/**
 * GET /gutenberg/book/:id/structure - Get book with full structure
 *
 * Returns preprocessed book with chapters/sections for selection
 */
gutenbergRoutes.get('/book/:id/structure', async (c) => {
  try {
    const idParam = c.req.param('id');
    const bookId = parseGutenbergInput(idParam);

    if (!bookId) {
      return c.json({ error: 'Invalid book ID or URL' }, 400);
    }

    console.log(`[Gutenberg] Fetching structure for book ${bookId}`);

    // Fetch full text
    const rawText = await fetchBookText(parseInt(bookId, 10));

    // Preprocess: strip headers, detect structure, normalize text
    const processed = preprocessGutenbergText(rawText, bookId);

    // Also get metadata from gutendex for authors etc.
    const preview = await getBookPreview(bookId);

    return c.json({
      id: parseInt(bookId, 10),
      title: preview.book.title,
      authors: preview.book.authors.map(formatAuthor),
      metadata: processed.metadata,
      structure: processed.structure.map((unit, idx) => ({
        index: idx,
        type: unit.type,
        number: unit.number,
        title: unit.title,
        wordCount: unit.wordCount,
        preview: unit.preview,
        // Full content is available via separate call to reduce payload
      })),
      stats: processed.stats,
    }, 200);
  } catch (error) {
    console.error('[Gutenberg] Get structure error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to process book',
    }, 500);
  }
});

/**
 * GET /gutenberg/book/:id/section/:index - Get specific section content
 */
gutenbergRoutes.get('/book/:id/section/:index', async (c) => {
  try {
    const idParam = c.req.param('id');
    const indexParam = c.req.param('index');
    const bookId = parseGutenbergInput(idParam);
    const sectionIndex = parseInt(indexParam, 10);

    if (!bookId) {
      return c.json({ error: 'Invalid book ID or URL' }, 400);
    }

    if (isNaN(sectionIndex) || sectionIndex < 0) {
      return c.json({ error: 'Invalid section index' }, 400);
    }

    // Fetch and preprocess
    const rawText = await fetchBookText(parseInt(bookId, 10));
    const processed = preprocessGutenbergText(rawText, bookId);

    if (sectionIndex >= processed.structure.length) {
      return c.json({ error: 'Section index out of range' }, 404);
    }

    const section = processed.structure[sectionIndex];

    return c.json({
      index: sectionIndex,
      type: section.type,
      number: section.number,
      title: section.title,
      content: section.content,
      wordCount: section.wordCount,
    }, 200);
  } catch (error) {
    console.error('[Gutenberg] Get section error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to fetch section',
    }, 500);
  }
});

/**
 * POST /gutenberg/extract-persona - Extract persona from Gutenberg book
 *
 * Body:
 * - bookId: Gutenberg book ID (or URL)
 * - customName: Optional custom name for the persona
 * - sampleText: Optional pre-fetched sample text (skips fetch)
 *
 * Requires authentication
 */
gutenbergRoutes.post('/extract-persona', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();
    const { bookId, customName, sampleText } = body;

    if (!bookId) {
      return c.json({ error: 'Missing required field: bookId' }, 400);
    }

    // Parse book ID
    const parsedId = parseGutenbergInput(String(bookId));
    if (!parsedId) {
      return c.json({ error: 'Invalid book ID or URL' }, 400);
    }

    // Get book preview (or use provided sample text)
    let bookData: {
      title: string;
      authors: string[];
      text: string;
    };

    if (sampleText && typeof sampleText === 'string' && sampleText.length >= 200) {
      // Use provided sample text - still need metadata
      const preview = await getBookPreview(parsedId);
      bookData = {
        title: preview.book.title,
        authors: preview.book.authors.map(formatAuthor),
        text: sampleText,
      };
    } else {
      // Fetch book preview
      const preview = await getBookPreview(parsedId);
      bookData = {
        title: preview.book.title,
        authors: preview.book.authors.map(formatAuthor),
        text: preview.sampleText,
      };
    }

    // Validate sample text length
    if (bookData.text.length < 200) {
      return c.json({ error: 'Sample text too short (minimum 200 characters)' }, 400);
    }

    // Extract persona using existing service
    const extractionService = new PersonaExtractionService(c.env, auth.userId);
    const result = await extractionService.extractPersona(bookData.text, {
      bookTitle: bookData.title,
      author: bookData.authors[0],
      customName: customName || undefined,
    });

    return c.json({
      persona_id: result.id,
      name: result.name,
      description: result.description,
      system_prompt: result.systemPrompt,
      attributes: result.attributes,
      example_patterns: result.examplePatterns,
      source_info: {
        ...result.sourceInfo,
        gutenberg_id: parsedId,
      },
      extraction_id: result.extractionId,
      processing_time_ms: result.processingTimeMs,
    }, 200);
  } catch (error) {
    console.error('[Gutenberg] Extract persona error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Persona extraction failed',
    }, 500);
  }
});

/**
 * GET /gutenberg/parse - Parse Gutenberg ID from URL
 *
 * Utility endpoint to validate user input
 */
gutenbergRoutes.get('/parse', (c) => {
  const input = c.req.query('input');

  if (!input) {
    return c.json({ error: 'Missing input parameter' }, 400);
  }

  const bookId = parseGutenbergInput(input);

  if (!bookId) {
    return c.json({ valid: false, error: 'Could not parse Gutenberg ID' }, 200);
  }

  return c.json({ valid: true, bookId }, 200);
});

export default gutenbergRoutes;
