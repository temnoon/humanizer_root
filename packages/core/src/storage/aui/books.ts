/**
 * AUI PostgreSQL Store - Book Methods
 *
 * Book and chapter CRUD operations.
 *
 * @module @humanizer/core/storage/aui/books
 */

import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import type { Book, BookChapter, NarrativeArc } from '../../aui/types.js';
import {
  INSERT_AUI_BOOK,
  GET_AUI_BOOK,
  UPDATE_AUI_BOOK,
  DELETE_AUI_BOOK,
  LIST_AUI_BOOKS,
  INSERT_AUI_CHAPTER,
  GET_AUI_CHAPTERS,
  UPDATE_AUI_CHAPTER,
  DELETE_AUI_CHAPTER,
} from '../schema-aui.js';
import type { DbBookRow, DbChapterRow } from './row-types.js';
import { rowToBook, rowToChapter } from './converters.js';

export interface BookStoreMethods {
  // Book methods
  createBook(book: Omit<Book, 'id'>): Promise<Book>;
  getBook(id: string): Promise<Book | undefined>;
  updateBook(
    id: string,
    update: Partial<{
      title: string;
      description: string;
      arc: NarrativeArc;
      status: Book['status'];
      metadata: Record<string, unknown>;
    }>
  ): Promise<Book | undefined>;
  deleteBook(id: string): Promise<boolean>;
  listBooks(options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Book[]>;

  // Chapter methods
  createChapter(bookId: string, chapter: BookChapter): Promise<BookChapter>;
  getChapters(bookId: string): Promise<BookChapter[]>;
  updateChapter(
    id: string,
    update: Partial<{
      title: string;
      content: string;
      position: number;
      wordCount: number;
      passageIds: string[];
      metadata: Record<string, unknown>;
    }>
  ): Promise<BookChapter | undefined>;
  deleteChapter(id: string): Promise<boolean>;
}

export function createBookMethods(pool: Pool): BookStoreMethods {
  const methods: BookStoreMethods = {
    // ═══════════════════════════════════════════════════════════════════
    // BOOKS
    // ═══════════════════════════════════════════════════════════════════

    async createBook(book: Omit<Book, 'id'>): Promise<Book> {
      const now = new Date();
      const id = randomUUID();

      const result = await pool.query(INSERT_AUI_BOOK, [
        id,
        (book as Book & { userId?: string }).userId ?? null,
        book.title,
        book.description ?? null,
        book.arc ? JSON.stringify(book.arc) : null,
        book.status,
        book.sourceClusterId ?? null,
        JSON.stringify(book.metadata ?? {}),
        now,
        now,
      ]);

      const bookRow = result.rows[0] as DbBookRow;

      // Create chapters
      for (const chapter of book.chapters) {
        await methods.createChapter(id, chapter);
      }

      return rowToBook(bookRow, book.chapters);
    },

    async getBook(id: string): Promise<Book | undefined> {
      const result = await pool.query(GET_AUI_BOOK, [id]);
      if (result.rows.length === 0) return undefined;

      const chapters = await methods.getChapters(id);
      return rowToBook(result.rows[0] as DbBookRow, chapters);
    },

    async updateBook(
      id: string,
      update: Partial<{
        title: string;
        description: string;
        arc: NarrativeArc;
        status: Book['status'];
        metadata: Record<string, unknown>;
      }>
    ): Promise<Book | undefined> {
      const result = await pool.query(UPDATE_AUI_BOOK, [
        id,
        update.title ?? null,
        update.description ?? null,
        update.arc ? JSON.stringify(update.arc) : null,
        update.status ?? null,
        update.metadata ? JSON.stringify(update.metadata) : null,
      ]);

      if (result.rows.length === 0) return undefined;

      const chapters = await methods.getChapters(id);
      return rowToBook(result.rows[0] as DbBookRow, chapters);
    },

    async deleteBook(id: string): Promise<boolean> {
      const result = await pool.query(DELETE_AUI_BOOK, [id]);
      return (result.rowCount ?? 0) > 0;
    },

    async listBooks(options?: {
      userId?: string;
      limit?: number;
      offset?: number;
    }): Promise<Book[]> {
      const result = await pool.query(LIST_AUI_BOOKS, [
        options?.userId ?? null,
        options?.limit ?? 100,
        options?.offset ?? 0,
      ]);

      const books: Book[] = [];
      for (const row of result.rows) {
        const chapters = await methods.getChapters((row as DbBookRow).id);
        books.push(rowToBook(row as DbBookRow, chapters));
      }
      return books;
    },

    // ═══════════════════════════════════════════════════════════════════
    // CHAPTERS
    // ═══════════════════════════════════════════════════════════════════

    async createChapter(bookId: string, chapter: BookChapter): Promise<BookChapter> {
      const now = new Date();
      const id = chapter.id || randomUUID();

      const result = await pool.query(INSERT_AUI_CHAPTER, [
        id,
        bookId,
        chapter.title,
        chapter.content,
        chapter.position,
        chapter.wordCount,
        chapter.passageIds,
        JSON.stringify({}),
        now,
        now,
      ]);

      return rowToChapter(result.rows[0] as DbChapterRow);
    },

    async getChapters(bookId: string): Promise<BookChapter[]> {
      const result = await pool.query(GET_AUI_CHAPTERS, [bookId]);
      return result.rows.map((row) => rowToChapter(row as DbChapterRow));
    },

    async updateChapter(
      id: string,
      update: Partial<{
        title: string;
        content: string;
        position: number;
        wordCount: number;
        passageIds: string[];
        metadata: Record<string, unknown>;
      }>
    ): Promise<BookChapter | undefined> {
      const result = await pool.query(UPDATE_AUI_CHAPTER, [
        id,
        update.title ?? null,
        update.content ?? null,
        update.position ?? null,
        update.wordCount ?? null,
        update.passageIds ?? null,
        update.metadata ? JSON.stringify(update.metadata) : null,
      ]);

      if (result.rows.length === 0) return undefined;
      return rowToChapter(result.rows[0] as DbChapterRow);
    },

    async deleteChapter(id: string): Promise<boolean> {
      const result = await pool.query(DELETE_AUI_CHAPTER, [id]);
      return (result.rowCount ?? 0) > 0;
    },
  };

  return methods;
}
