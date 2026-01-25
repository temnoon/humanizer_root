/**
 * AUI Book Creation Handlers
 *
 * MCP handlers for book creation, harvesting, and arc generation.
 *
 * @module @humanizer/core/mcp/handlers/aui/books
 */

import type { MCPResult } from '../../types.js';
import { jsonResult, errorResult, getService } from './helpers.js';

export async function handleBookCreateFromCluster(args: {
  clusterId: string;
  title?: string;
  maxPassages?: number;
  generateIntro?: boolean;
  arcType?: 'chronological' | 'thematic' | 'dramatic' | 'exploratory';
  audience?: string;
  style?: 'conversational' | 'formal' | 'literary' | 'journalistic';
}): Promise<MCPResult> {
  try {
    const service = getService();
    const book = await service.createBookFromCluster(args.clusterId, {
      title: args.title,
      maxPassages: args.maxPassages,
      generateIntro: args.generateIntro ?? true,
      arcType: args.arcType,
      audience: args.audience,
      style: args.style,
    });
    return jsonResult({
      id: book.id,
      title: book.title,
      description: book.description,
      chapterCount: book.chapters.length,
      totalWordCount: book.metadata.totalWordCount,
      status: book.status,
      createdAt: book.createdAt.toISOString(),
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBookHarvest(args: {
  query: string;
  limit?: number;
  minRelevance?: number;
  maxFromSingleSource?: number;
  dateStart?: string;
  dateEnd?: string;
  excludeIds?: string[];
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.harvest({
      query: args.query,
      limit: args.limit,
      minRelevance: args.minRelevance,
      maxFromSingleSource: args.maxFromSingleSource,
      dateRange: (args.dateStart || args.dateEnd) ? {
        start: args.dateStart ? new Date(args.dateStart) : undefined,
        end: args.dateEnd ? new Date(args.dateEnd) : undefined,
      } : undefined,
      excludeIds: args.excludeIds,
    });
    return jsonResult({
      passages: result.passages.map(p => ({
        id: p.id,
        text: p.text.substring(0, 200) + (p.text.length > 200 ? '...' : ''),
        relevance: p.relevance,
        sourceType: p.sourceType,
        wordCount: p.wordCount,
      })),
      query: result.query,
      candidatesFound: result.candidatesFound,
      durationMs: result.durationMs,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBookGenerateArc(args: {
  passageIds: string[];
  arcType?: 'chronological' | 'thematic' | 'dramatic' | 'exploratory';
  introWordCount?: number;
  includeChapterSummaries?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();

    // Fetch passages by ID
    const harvestResult = await service.harvest({
      query: args.passageIds.join(' '),
      limit: args.passageIds.length * 2,
    });

    // Filter to only requested IDs
    const passages = harvestResult.passages.filter(p => args.passageIds.includes(p.id));

    const arc = await service.generateArc({
      passages,
      arcType: args.arcType,
      introWordCount: args.introWordCount,
      includeChapterSummaries: args.includeChapterSummaries,
    });

    return jsonResult({
      title: arc.title,
      arcType: arc.arcType,
      introduction: arc.introduction,
      chapters: arc.chapters.map(ch => ({
        title: ch.title,
        summary: ch.summary,
        passageCount: ch.passageIds.length,
        position: ch.position,
      })),
      themes: arc.themes,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBookList(): Promise<MCPResult> {
  try {
    const service = getService();
    const books = await service.listBooks();
    return jsonResult({
      books: books.map(b => ({
        id: b.id,
        title: b.title,
        chapterCount: b.chapters.length,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
      })),
      count: books.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBookGet(args: {
  bookId: string;
  includeContent?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const book = await service.getBook(args.bookId);
    if (!book) {
      return errorResult(`Book "${args.bookId}" not found`);
    }

    const result: Record<string, unknown> = {
      id: book.id,
      title: book.title,
      description: book.description,
      arc: {
        title: book.arc.title,
        introduction: book.arc.introduction,
        themes: book.arc.themes,
      },
      chapters: book.chapters.map(ch => ({
        id: ch.id,
        title: ch.title,
        wordCount: ch.wordCount,
        position: ch.position,
        ...(args.includeContent ? { content: ch.content } : {}),
      })),
      status: book.status,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
      metadata: book.metadata,
    };

    return jsonResult(result);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Create a book with explicit persona consistency.
 */
export async function handleBookCreateWithPersona(args: {
  userId: string;
  clusterId?: string;
  query?: string;
  personaId?: string;
  styleId?: string;
  title?: string;
  arcType?: 'chronological' | 'thematic' | 'dramatic' | 'exploratory';
  maxPassages?: number;
}): Promise<MCPResult> {
  try {
    if (!args.userId) {
      return errorResult('userId is required');
    }
    if (!args.clusterId && !args.query) {
      return errorResult('Either clusterId or query is required');
    }

    const service = getService();

    const book = await service.createBookWithPersona({
      userId: args.userId,
      clusterId: args.clusterId,
      query: args.query,
      personaId: args.personaId,
      styleId: args.styleId,
      title: args.title,
      arcType: args.arcType,
      maxPassages: args.maxPassages,
    });

    return jsonResult({
      message: `Book "${book.title}" created with persona-consistent chapters.`,
      book: {
        id: book.id,
        title: book.title,
        description: book.description,
        chapterCount: book.chapters.length,
        totalWordCount: book.metadata?.totalWordCount,
        personaId: book.metadata?.personaId,
        personaName: book.metadata?.personaName,
        styleId: book.metadata?.styleId,
        styleName: book.metadata?.styleName,
        status: book.status,
        createdAt: book.createdAt,
      },
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}
