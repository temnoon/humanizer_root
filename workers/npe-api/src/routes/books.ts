/**
 * Books Routes - Bookmaking Tool CRUD API
 *
 * Phase 1: Core book structure with chapters, sections, and pages
 *
 * Endpoints:
 * - POST   /books              - Create book
 * - GET    /books              - List user's books
 * - GET    /books/:id          - Get book with full structure
 * - PUT    /books/:id          - Update book metadata
 * - DELETE /books/:id          - Delete book
 *
 * Chapters:
 * - POST   /books/:id/chapters           - Create chapter
 * - PUT    /books/:id/chapters/:cid      - Update chapter
 * - DELETE /books/:id/chapters/:cid      - Delete chapter
 * - POST   /books/:id/chapters/reorder   - Reorder chapters
 *
 * Sections:
 * - POST   /books/:id/chapters/:cid/sections  - Create section
 * - PUT    /books/:id/sections/:sid           - Update section
 * - DELETE /books/:id/sections/:sid           - Delete section
 *
 * Pages:
 * - POST   /books/:id/sections/:sid/pages  - Create page
 * - GET    /books/:id/pages/:pid           - Get page with annotations
 * - PUT    /books/:id/pages/:pid           - Update page
 * - DELETE /books/:id/pages/:pid           - Delete page
 *
 * Annotations:
 * - POST   /books/:id/pages/:pid/annotations  - Add annotation
 * - PUT    /books/:id/annotations/:aid        - Update annotation
 * - DELETE /books/:id/annotations/:aid        - Delete annotation
 */

import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';
import type { Env } from '../../shared/types';

const booksRoutes = new Hono<{ Bindings: Env }>();

// All routes require authentication
booksRoutes.use('*', requireAuth());

// Helper to generate UUIDs
function generateId(): string {
  return crypto.randomUUID();
}

// Helper to count words
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ============================================================================
// BOOKS CRUD
// ============================================================================

/**
 * POST /books - Create a new book
 */
booksRoutes.post('/', async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();

    const { title, subtitle, description, author, visibility, settings } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return c.json({ error: 'Title is required' }, 400);
    }

    const id = generateId();
    const now = Date.now();

    // Create book
    await c.env.DB.prepare(`
      INSERT INTO books (id, user_id, title, subtitle, author, description, visibility, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      auth.userId,
      title.trim(),
      subtitle?.trim() || null,
      author?.trim() || auth.userId,
      description?.trim() || null,
      visibility || 'private',
      settings ? JSON.stringify(settings) : null,
      now,
      now
    ).run();

    // Initialize stats
    await c.env.DB.prepare(`
      INSERT INTO book_stats (book_id, word_count, page_count, chapter_count, source_count, annotation_count, curator_conversations, updated_at)
      VALUES (?, 0, 0, 0, 0, 0, 0, ?)
    `).bind(id, now).run();

    return c.json({
      id,
      title: title.trim(),
      subtitle: subtitle?.trim() || null,
      author: author?.trim() || auth.userId,
      description: description?.trim() || null,
      visibility: visibility || 'private',
      settings: settings || null,
      createdAt: now,
      updatedAt: now,
      stats: {
        wordCount: 0,
        pageCount: 0,
        chapterCount: 0,
        sourceCount: 0,
        annotationCount: 0,
        curatorConversations: 0,
      },
    }, 201);
  } catch (error) {
    console.error('[Books] Create error:', error);
    return c.json({ error: 'Failed to create book' }, 500);
  }
});

/**
 * GET /books - List user's books
 */
booksRoutes.get('/', async (c) => {
  try {
    const auth = getAuthContext(c);

    const result = await c.env.DB.prepare(`
      SELECT b.*, s.word_count, s.page_count, s.chapter_count, s.source_count, s.annotation_count, s.curator_conversations
      FROM books b
      LEFT JOIN book_stats s ON b.id = s.book_id
      WHERE b.user_id = ?
      ORDER BY b.updated_at DESC
    `).bind(auth.userId).all();

    const books = (result.results || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      author: row.author,
      description: row.description,
      coverImage: row.cover_image,
      visibility: row.visibility,
      settings: row.settings ? JSON.parse(row.settings as string) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      stats: {
        wordCount: row.word_count || 0,
        pageCount: row.page_count || 0,
        chapterCount: row.chapter_count || 0,
        sourceCount: row.source_count || 0,
        annotationCount: row.annotation_count || 0,
        curatorConversations: row.curator_conversations || 0,
      },
    }));

    return c.json({ books }, 200);
  } catch (error) {
    console.error('[Books] List error:', error);
    return c.json({ error: 'Failed to list books' }, 500);
  }
});

/**
 * GET /books/:id - Get book with full structure
 */
booksRoutes.get('/:id', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');

    // Get book
    const bookResult = await c.env.DB.prepare(`
      SELECT b.*, s.word_count, s.page_count, s.chapter_count, s.source_count, s.annotation_count, s.curator_conversations
      FROM books b
      LEFT JOIN book_stats s ON b.id = s.book_id
      WHERE b.id = ? AND (b.user_id = ? OR b.visibility IN ('unlisted', 'public'))
    `).bind(bookId, auth.userId).first();

    if (!bookResult) {
      return c.json({ error: 'Book not found' }, 404);
    }

    // Get chapters
    const chaptersResult = await c.env.DB.prepare(`
      SELECT * FROM book_chapters WHERE book_id = ? ORDER BY order_index
    `).bind(bookId).all();

    // Get sections for all chapters
    const chapterIds = (chaptersResult.results || []).map((ch: Record<string, unknown>) => ch.id);
    let sectionsResult: { results: Record<string, unknown>[] } = { results: [] };
    if (chapterIds.length > 0) {
      const placeholders = chapterIds.map(() => '?').join(',');
      sectionsResult = await c.env.DB.prepare(`
        SELECT * FROM book_sections WHERE chapter_id IN (${placeholders}) ORDER BY order_index
      `).bind(...chapterIds).all();
    }

    // Get pages for all sections
    const sectionIds = (sectionsResult.results || []).map((s: Record<string, unknown>) => s.id);
    let pagesResult: { results: Record<string, unknown>[] } = { results: [] };
    if (sectionIds.length > 0) {
      const placeholders = sectionIds.map(() => '?').join(',');
      pagesResult = await c.env.DB.prepare(`
        SELECT id, section_id, order_index, content_type, word_count, source, created_at, updated_at
        FROM book_pages WHERE section_id IN (${placeholders}) ORDER BY order_index
      `).bind(...sectionIds).all();
    }

    // Build nested structure
    const pages = (pagesResult.results || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      sectionId: p.section_id,
      orderIndex: p.order_index,
      contentType: p.content_type,
      wordCount: p.word_count,
      source: p.source ? JSON.parse(p.source as string) : null,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    const sections = (sectionsResult.results || []).map((s: Record<string, unknown>) => ({
      id: s.id,
      chapterId: s.chapter_id,
      title: s.title,
      orderIndex: s.order_index,
      pages: pages.filter((p: { sectionId: unknown }) => p.sectionId === s.id),
    }));

    const chapters = (chaptersResult.results || []).map((ch: Record<string, unknown>) => ({
      id: ch.id,
      bookId: ch.book_id,
      title: ch.title,
      orderIndex: ch.order_index,
      epigraph: ch.epigraph,
      summary: ch.summary,
      sections: sections.filter((s: { chapterId: unknown }) => s.chapterId === ch.id),
    }));

    return c.json({
      id: bookResult.id,
      title: bookResult.title,
      subtitle: bookResult.subtitle,
      author: bookResult.author,
      description: bookResult.description,
      coverImage: bookResult.cover_image,
      visibility: bookResult.visibility,
      settings: bookResult.settings ? JSON.parse(bookResult.settings as string) : null,
      createdAt: bookResult.created_at,
      updatedAt: bookResult.updated_at,
      stats: {
        wordCount: bookResult.word_count || 0,
        pageCount: bookResult.page_count || 0,
        chapterCount: bookResult.chapter_count || 0,
        sourceCount: bookResult.source_count || 0,
        annotationCount: bookResult.annotation_count || 0,
        curatorConversations: bookResult.curator_conversations || 0,
      },
      chapters,
    }, 200);
  } catch (error) {
    console.error('[Books] Get error:', error);
    return c.json({ error: 'Failed to get book' }, 500);
  }
});

/**
 * PUT /books/:id - Update book metadata
 */
booksRoutes.put('/:id', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const body = await c.req.json();

    // Verify ownership
    const existing = await c.env.DB.prepare(
      'SELECT id FROM books WHERE id = ? AND user_id = ?'
    ).bind(bookId, auth.userId).first();

    if (!existing) {
      return c.json({ error: 'Book not found' }, 404);
    }

    const { title, subtitle, description, author, visibility, coverImage, settings } = body;
    const now = Date.now();

    await c.env.DB.prepare(`
      UPDATE books SET
        title = COALESCE(?, title),
        subtitle = COALESCE(?, subtitle),
        description = COALESCE(?, description),
        author = COALESCE(?, author),
        visibility = COALESCE(?, visibility),
        cover_image = COALESCE(?, cover_image),
        settings = COALESCE(?, settings),
        updated_at = ?
      WHERE id = ?
    `).bind(
      title?.trim() || null,
      subtitle?.trim(),
      description?.trim(),
      author?.trim(),
      visibility,
      coverImage,
      settings ? JSON.stringify(settings) : null,
      now,
      bookId
    ).run();

    return c.json({ success: true, updatedAt: now }, 200);
  } catch (error) {
    console.error('[Books] Update error:', error);
    return c.json({ error: 'Failed to update book' }, 500);
  }
});

/**
 * DELETE /books/:id - Delete book and all contents
 */
booksRoutes.delete('/:id', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');

    // Verify ownership
    const existing = await c.env.DB.prepare(
      'SELECT id FROM books WHERE id = ? AND user_id = ?'
    ).bind(bookId, auth.userId).first();

    if (!existing) {
      return c.json({ error: 'Book not found' }, 404);
    }

    // Cascading delete (tables have ON DELETE CASCADE)
    await c.env.DB.prepare('DELETE FROM books WHERE id = ?').bind(bookId).run();

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('[Books] Delete error:', error);
    return c.json({ error: 'Failed to delete book' }, 500);
  }
});

// ============================================================================
// CHAPTERS CRUD
// ============================================================================

/**
 * POST /books/:id/chapters - Create chapter
 */
booksRoutes.post('/:id/chapters', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const body = await c.req.json();

    // Verify ownership
    const book = await c.env.DB.prepare(
      'SELECT id FROM books WHERE id = ? AND user_id = ?'
    ).bind(bookId, auth.userId).first();

    if (!book) {
      return c.json({ error: 'Book not found' }, 404);
    }

    const { title, epigraph, summary } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return c.json({ error: 'Title is required' }, 400);
    }

    // Get next order index
    const maxOrder = await c.env.DB.prepare(
      'SELECT MAX(order_index) as max_order FROM book_chapters WHERE book_id = ?'
    ).bind(bookId).first() as { max_order: number | null } | null;

    const orderIndex = (maxOrder?.max_order ?? -1) + 1;
    const id = generateId();
    const now = Date.now();

    await c.env.DB.prepare(`
      INSERT INTO book_chapters (id, book_id, title, order_index, epigraph, summary, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, bookId, title.trim(), orderIndex, epigraph || null, summary || null, now, now).run();

    // Update book stats
    await c.env.DB.prepare(`
      UPDATE book_stats SET chapter_count = chapter_count + 1, updated_at = ? WHERE book_id = ?
    `).bind(now, bookId).run();

    // Update book updated_at
    await c.env.DB.prepare('UPDATE books SET updated_at = ? WHERE id = ?').bind(now, bookId).run();

    return c.json({
      id,
      bookId,
      title: title.trim(),
      orderIndex,
      epigraph: epigraph || null,
      summary: summary || null,
      sections: [],
      createdAt: now,
      updatedAt: now,
    }, 201);
  } catch (error) {
    console.error('[Books] Create chapter error:', error);
    return c.json({ error: 'Failed to create chapter' }, 500);
  }
});

/**
 * PUT /books/:id/chapters/:cid - Update chapter
 */
booksRoutes.put('/:id/chapters/:cid', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const chapterId = c.req.param('cid');
    const body = await c.req.json();

    // Verify ownership
    const chapter = await c.env.DB.prepare(`
      SELECT ch.id FROM book_chapters ch
      JOIN books b ON ch.book_id = b.id
      WHERE ch.id = ? AND b.user_id = ?
    `).bind(chapterId, auth.userId).first();

    if (!chapter) {
      return c.json({ error: 'Chapter not found' }, 404);
    }

    const { title, epigraph, summary } = body;
    const now = Date.now();

    await c.env.DB.prepare(`
      UPDATE book_chapters SET
        title = COALESCE(?, title),
        epigraph = COALESCE(?, epigraph),
        summary = COALESCE(?, summary),
        updated_at = ?
      WHERE id = ?
    `).bind(title?.trim() || null, epigraph, summary, now, chapterId).run();

    await c.env.DB.prepare('UPDATE books SET updated_at = ? WHERE id = ?').bind(now, bookId).run();

    return c.json({ success: true, updatedAt: now }, 200);
  } catch (error) {
    console.error('[Books] Update chapter error:', error);
    return c.json({ error: 'Failed to update chapter' }, 500);
  }
});

/**
 * DELETE /books/:id/chapters/:cid - Delete chapter
 */
booksRoutes.delete('/:id/chapters/:cid', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const chapterId = c.req.param('cid');

    // Verify ownership
    const chapter = await c.env.DB.prepare(`
      SELECT ch.id FROM book_chapters ch
      JOIN books b ON ch.book_id = b.id
      WHERE ch.id = ? AND b.user_id = ?
    `).bind(chapterId, auth.userId).first();

    if (!chapter) {
      return c.json({ error: 'Chapter not found' }, 404);
    }

    const now = Date.now();

    // Get page count for stats update
    const pageCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM book_pages p
      JOIN book_sections s ON p.section_id = s.id
      WHERE s.chapter_id = ?
    `).bind(chapterId).first() as { count: number } | null;

    // Delete chapter (cascades to sections and pages)
    await c.env.DB.prepare('DELETE FROM book_chapters WHERE id = ?').bind(chapterId).run();

    // Update stats
    await c.env.DB.prepare(`
      UPDATE book_stats SET
        chapter_count = chapter_count - 1,
        page_count = page_count - ?,
        updated_at = ?
      WHERE book_id = ?
    `).bind(pageCount?.count || 0, now, bookId).run();

    await c.env.DB.prepare('UPDATE books SET updated_at = ? WHERE id = ?').bind(now, bookId).run();

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('[Books] Delete chapter error:', error);
    return c.json({ error: 'Failed to delete chapter' }, 500);
  }
});

/**
 * POST /books/:id/chapters/reorder - Reorder chapters
 */
booksRoutes.post('/:id/chapters/reorder', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const body = await c.req.json();

    // Verify ownership
    const book = await c.env.DB.prepare(
      'SELECT id FROM books WHERE id = ? AND user_id = ?'
    ).bind(bookId, auth.userId).first();

    if (!book) {
      return c.json({ error: 'Book not found' }, 404);
    }

    const { chapterIds } = body;

    if (!Array.isArray(chapterIds)) {
      return c.json({ error: 'chapterIds must be an array' }, 400);
    }

    const now = Date.now();

    // Update order indexes
    for (let i = 0; i < chapterIds.length; i++) {
      await c.env.DB.prepare(
        'UPDATE book_chapters SET order_index = ?, updated_at = ? WHERE id = ? AND book_id = ?'
      ).bind(i, now, chapterIds[i], bookId).run();
    }

    await c.env.DB.prepare('UPDATE books SET updated_at = ? WHERE id = ?').bind(now, bookId).run();

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('[Books] Reorder chapters error:', error);
    return c.json({ error: 'Failed to reorder chapters' }, 500);
  }
});

// ============================================================================
// SECTIONS CRUD
// ============================================================================

/**
 * POST /books/:id/chapters/:cid/sections - Create section
 */
booksRoutes.post('/:id/chapters/:cid/sections', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const chapterId = c.req.param('cid');
    const body = await c.req.json();

    // Verify ownership
    const chapter = await c.env.DB.prepare(`
      SELECT ch.id FROM book_chapters ch
      JOIN books b ON ch.book_id = b.id
      WHERE ch.id = ? AND b.user_id = ?
    `).bind(chapterId, auth.userId).first();

    if (!chapter) {
      return c.json({ error: 'Chapter not found' }, 404);
    }

    const { title } = body;

    // Get next order index
    const maxOrder = await c.env.DB.prepare(
      'SELECT MAX(order_index) as max_order FROM book_sections WHERE chapter_id = ?'
    ).bind(chapterId).first() as { max_order: number | null } | null;

    const orderIndex = (maxOrder?.max_order ?? -1) + 1;
    const id = generateId();
    const now = Date.now();

    await c.env.DB.prepare(`
      INSERT INTO book_sections (id, chapter_id, title, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, chapterId, title?.trim() || null, orderIndex, now, now).run();

    await c.env.DB.prepare('UPDATE books SET updated_at = ? WHERE id = ?').bind(now, bookId).run();

    return c.json({
      id,
      chapterId,
      title: title?.trim() || null,
      orderIndex,
      pages: [],
      createdAt: now,
      updatedAt: now,
    }, 201);
  } catch (error) {
    console.error('[Books] Create section error:', error);
    return c.json({ error: 'Failed to create section' }, 500);
  }
});

/**
 * PUT /books/:id/sections/:sid - Update section
 */
booksRoutes.put('/:id/sections/:sid', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const sectionId = c.req.param('sid');
    const body = await c.req.json();

    // Verify ownership
    const section = await c.env.DB.prepare(`
      SELECT s.id FROM book_sections s
      JOIN book_chapters ch ON s.chapter_id = ch.id
      JOIN books b ON ch.book_id = b.id
      WHERE s.id = ? AND b.user_id = ?
    `).bind(sectionId, auth.userId).first();

    if (!section) {
      return c.json({ error: 'Section not found' }, 404);
    }

    const { title } = body;
    const now = Date.now();

    await c.env.DB.prepare(`
      UPDATE book_sections SET title = ?, updated_at = ? WHERE id = ?
    `).bind(title?.trim() || null, now, sectionId).run();

    await c.env.DB.prepare('UPDATE books SET updated_at = ? WHERE id = ?').bind(now, bookId).run();

    return c.json({ success: true, updatedAt: now }, 200);
  } catch (error) {
    console.error('[Books] Update section error:', error);
    return c.json({ error: 'Failed to update section' }, 500);
  }
});

/**
 * DELETE /books/:id/sections/:sid - Delete section
 */
booksRoutes.delete('/:id/sections/:sid', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const sectionId = c.req.param('sid');

    // Verify ownership
    const section = await c.env.DB.prepare(`
      SELECT s.id FROM book_sections s
      JOIN book_chapters ch ON s.chapter_id = ch.id
      JOIN books b ON ch.book_id = b.id
      WHERE s.id = ? AND b.user_id = ?
    `).bind(sectionId, auth.userId).first();

    if (!section) {
      return c.json({ error: 'Section not found' }, 404);
    }

    const now = Date.now();

    // Get page count
    const pageCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM book_pages WHERE section_id = ?'
    ).bind(sectionId).first() as { count: number } | null;

    // Delete section
    await c.env.DB.prepare('DELETE FROM book_sections WHERE id = ?').bind(sectionId).run();

    // Update stats
    await c.env.DB.prepare(`
      UPDATE book_stats SET page_count = page_count - ?, updated_at = ? WHERE book_id = ?
    `).bind(pageCount?.count || 0, now, bookId).run();

    await c.env.DB.prepare('UPDATE books SET updated_at = ? WHERE id = ?').bind(now, bookId).run();

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('[Books] Delete section error:', error);
    return c.json({ error: 'Failed to delete section' }, 500);
  }
});

// ============================================================================
// PAGES CRUD
// ============================================================================

/**
 * POST /books/:id/sections/:sid/pages - Create page
 */
booksRoutes.post('/:id/sections/:sid/pages', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const sectionId = c.req.param('sid');
    const body = await c.req.json();

    // Verify ownership
    const section = await c.env.DB.prepare(`
      SELECT s.id FROM book_sections s
      JOIN book_chapters ch ON s.chapter_id = ch.id
      JOIN books b ON ch.book_id = b.id
      WHERE s.id = ? AND b.user_id = ?
    `).bind(sectionId, auth.userId).first();

    if (!section) {
      return c.json({ error: 'Section not found' }, 404);
    }

    const { content, contentType, source } = body;

    if (!content || typeof content !== 'string') {
      return c.json({ error: 'Content is required' }, 400);
    }

    if (!source || typeof source !== 'object') {
      return c.json({ error: 'Source is required' }, 400);
    }

    // Get next order index
    const maxOrder = await c.env.DB.prepare(
      'SELECT MAX(order_index) as max_order FROM book_pages WHERE section_id = ?'
    ).bind(sectionId).first() as { max_order: number | null } | null;

    const orderIndex = (maxOrder?.max_order ?? -1) + 1;
    const id = generateId();
    const now = Date.now();
    const wordCount = countWords(content);

    await c.env.DB.prepare(`
      INSERT INTO book_pages (id, section_id, order_index, content, content_type, source, word_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      sectionId,
      orderIndex,
      content,
      contentType || 'text',
      JSON.stringify(source),
      wordCount,
      now,
      now
    ).run();

    // Update stats
    await c.env.DB.prepare(`
      UPDATE book_stats SET
        page_count = page_count + 1,
        word_count = word_count + ?,
        source_count = source_count + 1,
        updated_at = ?
      WHERE book_id = ?
    `).bind(wordCount, now, bookId).run();

    await c.env.DB.prepare('UPDATE books SET updated_at = ? WHERE id = ?').bind(now, bookId).run();

    return c.json({
      id,
      sectionId,
      orderIndex,
      content,
      contentType: contentType || 'text',
      source,
      wordCount,
      annotations: [],
      createdAt: now,
      updatedAt: now,
    }, 201);
  } catch (error) {
    console.error('[Books] Create page error:', error);
    return c.json({ error: 'Failed to create page' }, 500);
  }
});

/**
 * GET /books/:id/pages/:pid - Get page with annotations
 */
booksRoutes.get('/:id/pages/:pid', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const pageId = c.req.param('pid');

    // Get page with ownership check
    const page = await c.env.DB.prepare(`
      SELECT p.* FROM book_pages p
      JOIN book_sections s ON p.section_id = s.id
      JOIN book_chapters ch ON s.chapter_id = ch.id
      JOIN books b ON ch.book_id = b.id
      WHERE p.id = ? AND (b.user_id = ? OR b.visibility IN ('unlisted', 'public'))
    `).bind(pageId, auth.userId).first();

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Get annotations
    const annotations = await c.env.DB.prepare(`
      SELECT * FROM book_annotations WHERE page_id = ? ORDER BY start_offset
    `).bind(pageId).all();

    // Get transformations
    const transformations = await c.env.DB.prepare(`
      SELECT * FROM book_page_transformations WHERE page_id = ? ORDER BY applied_at DESC
    `).bind(pageId).all();

    // Get curator threads
    const curatorThreads = await c.env.DB.prepare(`
      SELECT * FROM book_curator_threads WHERE page_id = ? ORDER BY created_at DESC
    `).bind(pageId).all();

    return c.json({
      id: page.id,
      sectionId: page.section_id,
      orderIndex: page.order_index,
      content: page.content,
      contentType: page.content_type,
      originalContent: page.original_content,
      source: page.source ? JSON.parse(page.source as string) : null,
      wordCount: page.word_count,
      annotations: (annotations.results || []).map((a: Record<string, unknown>) => ({
        id: a.id,
        type: a.type,
        startOffset: a.start_offset,
        endOffset: a.end_offset,
        selectedText: a.selected_text,
        content: a.content,
        curatorResponse: a.curator_response,
        linkedPageId: a.linked_page_id,
        linkedUrl: a.linked_url,
        color: a.color,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      })),
      transformations: (transformations.results || []).map((t: Record<string, unknown>) => ({
        id: t.id,
        toolId: t.tool_id,
        toolName: t.tool_name,
        parameters: t.parameters ? JSON.parse(t.parameters as string) : null,
        analysisResult: t.analysis_result ? JSON.parse(t.analysis_result as string) : null,
        appliedAt: t.applied_at,
      })),
      curatorThreads: (curatorThreads.results || []).map((th: Record<string, unknown>) => ({
        id: th.id,
        messages: th.messages ? JSON.parse(th.messages as string) : [],
        createdAt: th.created_at,
        updatedAt: th.updated_at,
      })),
      createdAt: page.created_at,
      updatedAt: page.updated_at,
    }, 200);
  } catch (error) {
    console.error('[Books] Get page error:', error);
    return c.json({ error: 'Failed to get page' }, 500);
  }
});

/**
 * PUT /books/:id/pages/:pid - Update page
 */
booksRoutes.put('/:id/pages/:pid', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const pageId = c.req.param('pid');
    const body = await c.req.json();

    // Get page with ownership check
    const page = await c.env.DB.prepare(`
      SELECT p.* FROM book_pages p
      JOIN book_sections s ON p.section_id = s.id
      JOIN book_chapters ch ON s.chapter_id = ch.id
      JOIN books b ON ch.book_id = b.id
      WHERE p.id = ? AND b.user_id = ?
    `).bind(pageId, auth.userId).first();

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    const { content } = body;
    const now = Date.now();

    if (content !== undefined) {
      const oldWordCount = page.word_count as number;
      const newWordCount = countWords(content);
      const wordDiff = newWordCount - oldWordCount;

      await c.env.DB.prepare(`
        UPDATE book_pages SET content = ?, word_count = ?, updated_at = ? WHERE id = ?
      `).bind(content, newWordCount, now, pageId).run();

      // Update word count stats
      await c.env.DB.prepare(`
        UPDATE book_stats SET word_count = word_count + ?, updated_at = ? WHERE book_id = ?
      `).bind(wordDiff, now, bookId).run();
    }

    await c.env.DB.prepare('UPDATE books SET updated_at = ? WHERE id = ?').bind(now, bookId).run();

    return c.json({ success: true, updatedAt: now }, 200);
  } catch (error) {
    console.error('[Books] Update page error:', error);
    return c.json({ error: 'Failed to update page' }, 500);
  }
});

/**
 * DELETE /books/:id/pages/:pid - Delete page
 */
booksRoutes.delete('/:id/pages/:pid', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const pageId = c.req.param('pid');

    // Get page with ownership check
    const page = await c.env.DB.prepare(`
      SELECT p.* FROM book_pages p
      JOIN book_sections s ON p.section_id = s.id
      JOIN book_chapters ch ON s.chapter_id = ch.id
      JOIN books b ON ch.book_id = b.id
      WHERE p.id = ? AND b.user_id = ?
    `).bind(pageId, auth.userId).first();

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    const now = Date.now();
    const wordCount = page.word_count as number;

    // Delete page
    await c.env.DB.prepare('DELETE FROM book_pages WHERE id = ?').bind(pageId).run();

    // Update stats
    await c.env.DB.prepare(`
      UPDATE book_stats SET
        page_count = page_count - 1,
        word_count = word_count - ?,
        source_count = source_count - 1,
        updated_at = ?
      WHERE book_id = ?
    `).bind(wordCount, now, bookId).run();

    await c.env.DB.prepare('UPDATE books SET updated_at = ? WHERE id = ?').bind(now, bookId).run();

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('[Books] Delete page error:', error);
    return c.json({ error: 'Failed to delete page' }, 500);
  }
});

// ============================================================================
// ANNOTATIONS CRUD
// ============================================================================

/**
 * POST /books/:id/pages/:pid/annotations - Add annotation
 */
booksRoutes.post('/:id/pages/:pid/annotations', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const pageId = c.req.param('pid');
    const body = await c.req.json();

    // Verify ownership
    const page = await c.env.DB.prepare(`
      SELECT p.id FROM book_pages p
      JOIN book_sections s ON p.section_id = s.id
      JOIN book_chapters ch ON s.chapter_id = ch.id
      JOIN books b ON ch.book_id = b.id
      WHERE p.id = ? AND b.user_id = ?
    `).bind(pageId, auth.userId).first();

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    const { type, startOffset, endOffset, selectedText, content, linkedPageId, linkedUrl, color } = body;

    if (!type || !['highlight', 'note', 'question', 'link', 'definition'].includes(type)) {
      return c.json({ error: 'Valid type is required' }, 400);
    }

    if (typeof startOffset !== 'number' || typeof endOffset !== 'number') {
      return c.json({ error: 'Start and end offsets are required' }, 400);
    }

    if (!selectedText || typeof selectedText !== 'string') {
      return c.json({ error: 'Selected text is required' }, 400);
    }

    if (!content || typeof content !== 'string') {
      return c.json({ error: 'Content is required' }, 400);
    }

    const id = generateId();
    const now = Date.now();

    await c.env.DB.prepare(`
      INSERT INTO book_annotations (id, page_id, type, start_offset, end_offset, selected_text, content, linked_page_id, linked_url, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, pageId, type, startOffset, endOffset, selectedText, content, linkedPageId || null, linkedUrl || null, color || null, now, now).run();

    // Update stats
    await c.env.DB.prepare(`
      UPDATE book_stats SET annotation_count = annotation_count + 1, updated_at = ? WHERE book_id = ?
    `).bind(now, bookId).run();

    await c.env.DB.prepare('UPDATE books SET updated_at = ? WHERE id = ?').bind(now, bookId).run();

    return c.json({
      id,
      pageId,
      type,
      startOffset,
      endOffset,
      selectedText,
      content,
      linkedPageId: linkedPageId || null,
      linkedUrl: linkedUrl || null,
      color: color || null,
      createdAt: now,
      updatedAt: now,
    }, 201);
  } catch (error) {
    console.error('[Books] Create annotation error:', error);
    return c.json({ error: 'Failed to create annotation' }, 500);
  }
});

/**
 * PUT /books/:id/annotations/:aid - Update annotation
 */
booksRoutes.put('/:id/annotations/:aid', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const annotationId = c.req.param('aid');
    const body = await c.req.json();

    // Verify ownership
    const annotation = await c.env.DB.prepare(`
      SELECT a.id FROM book_annotations a
      JOIN book_pages p ON a.page_id = p.id
      JOIN book_sections s ON p.section_id = s.id
      JOIN book_chapters ch ON s.chapter_id = ch.id
      JOIN books b ON ch.book_id = b.id
      WHERE a.id = ? AND b.user_id = ?
    `).bind(annotationId, auth.userId).first();

    if (!annotation) {
      return c.json({ error: 'Annotation not found' }, 404);
    }

    const { content, color, curatorResponse } = body;
    const now = Date.now();

    await c.env.DB.prepare(`
      UPDATE book_annotations SET
        content = COALESCE(?, content),
        color = COALESCE(?, color),
        curator_response = COALESCE(?, curator_response),
        updated_at = ?
      WHERE id = ?
    `).bind(content, color, curatorResponse, now, annotationId).run();

    await c.env.DB.prepare('UPDATE books SET updated_at = ? WHERE id = ?').bind(now, bookId).run();

    return c.json({ success: true, updatedAt: now }, 200);
  } catch (error) {
    console.error('[Books] Update annotation error:', error);
    return c.json({ error: 'Failed to update annotation' }, 500);
  }
});

/**
 * DELETE /books/:id/annotations/:aid - Delete annotation
 */
booksRoutes.delete('/:id/annotations/:aid', async (c) => {
  try {
    const auth = getAuthContext(c);
    const bookId = c.req.param('id');
    const annotationId = c.req.param('aid');

    // Verify ownership
    const annotation = await c.env.DB.prepare(`
      SELECT a.id FROM book_annotations a
      JOIN book_pages p ON a.page_id = p.id
      JOIN book_sections s ON p.section_id = s.id
      JOIN book_chapters ch ON s.chapter_id = ch.id
      JOIN books b ON ch.book_id = b.id
      WHERE a.id = ? AND b.user_id = ?
    `).bind(annotationId, auth.userId).first();

    if (!annotation) {
      return c.json({ error: 'Annotation not found' }, 404);
    }

    const now = Date.now();

    await c.env.DB.prepare('DELETE FROM book_annotations WHERE id = ?').bind(annotationId).run();

    // Update stats
    await c.env.DB.prepare(`
      UPDATE book_stats SET annotation_count = annotation_count - 1, updated_at = ? WHERE book_id = ?
    `).bind(now, bookId).run();

    await c.env.DB.prepare('UPDATE books SET updated_at = ? WHERE id = ?').bind(now, bookId).run();

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('[Books] Delete annotation error:', error);
    return c.json({ error: 'Failed to delete annotation' }, 500);
  }
});

export default booksRoutes;
