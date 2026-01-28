/**
 * Book Tool Handlers
 *
 * Tool handlers for book creation and management.
 * Provides harvesting, arc generation, and book operations.
 *
 * @module @humanizer/core/aui/tools/book-tools
 */

import type { ToolResult } from '../types.js';
import type { ToolRegistration, ToolHandler } from '../tool-registry.js';
import type { BookMethods, ArtifactMethods } from '../service/books.js';
import { BOOK_TOOLS } from '../tool-definitions.js';

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create book tool handlers
 */
export function createBookToolHandlers(
  books: BookMethods,
  artifacts?: ArtifactMethods
): ToolRegistration[] {
  const handlers: Record<string, ToolHandler> = {
    // ─────────────────────────────────────────────────────────────────────────
    // HARVESTING
    // ─────────────────────────────────────────────────────────────────────────

    book_harvest: async (args) => {
      const result = await books.harvest({
        query: args.query as string,
        limit: args.limit as number | undefined,
        minRelevance: args.minRelevance as number | undefined,
        dateRange: args.dateRange as { start?: Date; end?: Date } | undefined,
        excludeIds: args.excludeIds as string[] | undefined,
        maxFromSingleSource: args.maxFromSingleSource as number | undefined,
      });

      return {
        success: true,
        data: {
          query: result.query,
          passageCount: result.passages.length,
          candidatesFound: result.candidatesFound,
          durationMs: result.durationMs,
          passages: result.passages.slice(0, 10).map(p => ({
            id: p.id,
            text: p.text.substring(0, 200) + (p.text.length > 200 ? '...' : ''),
            relevance: p.relevance,
            sourceType: p.sourceType,
            wordCount: p.wordCount,
          })),
        },
      };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // BOOK CREATION
    // ─────────────────────────────────────────────────────────────────────────

    book_create: async (args) => {
      if (!args.clusterId) {
        return {
          success: false,
          error: 'clusterId is required for book_create. Use book_create_with_persona for query-based creation.',
        };
      }

      const book = await books.createBookFromCluster(args.clusterId as string, {
        title: args.title as string | undefined,
        personaId: args.personaId as string | undefined,
        styleId: args.styleId as string | undefined,
        arcType: args.arcType as 'chronological' | 'thematic' | 'dramatic' | 'exploratory' | undefined,
        maxPassages: args.maxPassages as number | undefined,
        userId: args.userId as string | undefined,
      });

      return {
        success: true,
        data: {
          bookId: book.id,
          title: book.title,
          chapterCount: book.chapters.length,
          totalWordCount: book.metadata?.totalWordCount,
          arcType: book.arc?.arcType,
          status: book.status,
        },
      };
    },

    book_create_with_persona: async (args) => {
      const book = await books.createBookWithPersona({
        userId: args.userId as string,
        title: args.title as string | undefined,
        clusterId: args.clusterId as string | undefined,
        query: args.query as string | undefined,
        personaId: args.personaId as string | undefined,
        styleId: args.styleId as string | undefined,
        arcType: args.arcType as 'chronological' | 'thematic' | 'dramatic' | 'exploratory' | undefined,
        maxPassages: args.maxPassages as number | undefined,
      });

      return {
        success: true,
        data: {
          bookId: book.id,
          title: book.title,
          chapterCount: book.chapters.length,
          totalWordCount: book.metadata?.totalWordCount,
          arcType: book.arc?.arcType,
          personaName: book.metadata?.personaName,
          styleName: book.metadata?.styleName,
          status: book.status,
        },
      };
    },

    book_generate_arc: async (args) => {
      // Generate arc requires passages - use harvest first to get them
      const harvestResult = await books.harvest({
        query: 'general',
        limit: 50,
      });

      const passageIds = args.passageIds as string[] | undefined;
      const passages = passageIds
        ? harvestResult.passages.filter(p => passageIds.includes(p.id))
        : harvestResult.passages;

      const arc = await books.generateArc({
        passages,
        arcType: args.arcType as 'chronological' | 'thematic' | 'dramatic' | 'exploratory' | undefined,
        introWordCount: args.introWordCount as number | undefined,
      });

      return {
        success: true,
        data: {
          title: arc.title,
          arcType: arc.arcType,
          introduction: arc.introduction,
          chapterCount: arc.chapters.length,
          themes: arc.themes,
          chapters: arc.chapters.map(c => ({
            title: c.title,
            summary: c.summary?.substring(0, 100),
            passageCount: c.passageIds.length,
            theme: c.theme,
          })),
        },
      };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // BOOK QUERIES
    // ─────────────────────────────────────────────────────────────────────────

    book_list: async (args) => {
      const bookList = await books.listBooks({
        userId: args.userId as string | undefined,
        limit: args.limit as number | undefined,
      });

      return {
        success: true,
        data: bookList.map(b => ({
          id: b.id,
          title: b.title,
          chapterCount: b.chapters.length,
          status: b.status,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
          totalWordCount: b.metadata?.totalWordCount,
        })),
      };
    },

    book_get: async (args) => {
      const book = await books.getBook(args.bookId as string);

      if (!book) {
        return { success: false, error: `Book "${args.bookId}" not found` };
      }

      return {
        success: true,
        data: {
          id: book.id,
          title: book.title,
          description: book.description,
          status: book.status,
          arc: book.arc ? {
            title: book.arc.title,
            arcType: book.arc.arcType,
            introduction: book.arc.introduction,
            themes: book.arc.themes,
          } : undefined,
          chapters: book.chapters.map(c => ({
            id: c.id,
            title: c.title,
            position: c.position,
            wordCount: c.wordCount,
            contentPreview: c.content.substring(0, 200) + (c.content.length > 200 ? '...' : ''),
          })),
          metadata: book.metadata,
          createdAt: book.createdAt,
          updatedAt: book.updatedAt,
        },
      };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CHAPTER OPERATIONS
    // ─────────────────────────────────────────────────────────────────────────

    book_add_chapter: async (args) => {
      const book = await books.getBook(args.bookId as string);
      if (!book) {
        return { success: false, error: `Book "${args.bookId}" not found` };
      }

      const position = (args.position as number) ?? book.chapters.length;
      const newChapter = {
        id: `chapter-${Date.now()}`,
        title: args.title as string,
        content: args.content as string,
        position,
        wordCount: (args.content as string).split(/\s+/).filter(Boolean).length,
        passageIds: [],
      };

      book.chapters.push(newChapter);
      book.updatedAt = new Date();

      return {
        success: true,
        data: {
          chapterId: newChapter.id,
          title: newChapter.title,
          position: newChapter.position,
          wordCount: newChapter.wordCount,
        },
      };
    },

    book_update_chapter: async (args) => {
      const book = await books.getBook(args.bookId as string);
      if (!book) {
        return { success: false, error: `Book "${args.bookId}" not found` };
      }

      const chapter = book.chapters.find(c => c.id === args.chapterId);
      if (!chapter) {
        return { success: false, error: `Chapter "${args.chapterId}" not found` };
      }

      if (args.title) {
        chapter.title = args.title as string;
      }
      if (args.content) {
        chapter.content = args.content as string;
        chapter.wordCount = (args.content as string).split(/\s+/).filter(Boolean).length;
      }
      book.updatedAt = new Date();

      return {
        success: true,
        data: {
          chapterId: chapter.id,
          title: chapter.title,
          wordCount: chapter.wordCount,
        },
      };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // EXPORT
    // ─────────────────────────────────────────────────────────────────────────

    book_export: async (args) => {
      if (!artifacts) {
        return { success: false, error: 'Artifact methods not configured' };
      }

      const artifact = await artifacts.exportBook(
        args.bookId as string,
        args.format as 'markdown' | 'html' | 'json' | undefined
      );

      if (!artifact) {
        return { success: false, error: `Failed to export book "${args.bookId}"` };
      }

      return {
        success: true,
        data: {
          artifactId: artifact.id,
          name: artifact.name,
          format: artifact.artifactType,
          mimeType: artifact.mimeType,
          sizeBytes: artifact.sizeBytes,
          createdAt: artifact.createdAt,
        },
      };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // DESTRUCTIVE
    // ─────────────────────────────────────────────────────────────────────────

    book_delete: async (args) => {
      // Book deletion would require store integration
      // For now, return a stub
      return {
        success: false,
        error: 'Book deletion requires store integration',
        data: { bookId: args.bookId },
      };
    },

    chapter_delete: async (args) => {
      const book = await books.getBook(args.bookId as string);
      if (!book) {
        return { success: false, error: `Book "${args.bookId}" not found` };
      }

      const chapterIndex = book.chapters.findIndex(c => c.id === args.chapterId);
      if (chapterIndex === -1) {
        return { success: false, error: `Chapter "${args.chapterId}" not found` };
      }

      book.chapters.splice(chapterIndex, 1);
      book.updatedAt = new Date();

      return {
        success: true,
        data: {
          deleted: args.chapterId,
          remainingChapters: book.chapters.length,
        },
      };
    },
  };

  // Build registrations from definitions
  return BOOK_TOOLS.map(def => ({
    definition: def,
    handler: handlers[def.name],
    category: 'books' as const,
  })).filter(reg => reg.handler !== undefined);
}
