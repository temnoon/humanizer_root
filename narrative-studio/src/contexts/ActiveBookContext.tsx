/**
 * ActiveBookContext - Manages the "Active Book" paradigm
 *
 * Every session has an active book context. The book isn't a separate mode—
 * it's always present as the organizing lens through which all work flows.
 *
 * Features:
 * - Persistent active book selection (localStorage)
 * - Book structure caching for quick access
 * - Methods for adding content to the active book
 */

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  booksService,
  type Book,
  type Chapter,
  type Section,
  type Page,
  type PageSource,
} from '../services/booksService';

const STORAGE_KEY = 'narrative-studio-active-book';

interface AddToBookOptions {
  content: string;
  contentType?: 'text' | 'conversation' | 'image' | 'embed';
  source: PageSource;
  chapterId?: string;
  sectionId?: string;
  createChapterTitle?: string;
  createSectionTitle?: string;
}

interface ActiveBookContextValue {
  // State
  activeBook: Book | null;
  activeBookId: string | null;
  loading: boolean;
  error: string | null;

  // Books list for selector
  books: Book[];
  booksLoading: boolean;

  // Actions
  setActiveBook: (bookId: string | null) => Promise<void>;
  refreshActiveBook: () => Promise<void>;
  refreshBooks: () => Promise<void>;
  createBook: (title: string, subtitle?: string) => Promise<Book>;

  // Add content to active book
  addToBook: (options: AddToBookOptions) => Promise<Page | null>;

  // Quick chapter/section creation
  createChapter: (title: string) => Promise<Chapter | null>;
  createSection: (chapterId: string, title?: string) => Promise<Section | null>;
}

const ActiveBookContext = createContext<ActiveBookContextValue | undefined>(undefined);

interface ActiveBookProviderProps {
  children: ReactNode;
}

export function ActiveBookProvider({ children }: ActiveBookProviderProps) {
  // Active book state
  const [activeBook, setActiveBookState] = useState<Book | null>(null);
  const [activeBookId, setActiveBookId] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved || null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Books list for selector
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);

  // Load books list on mount
  useEffect(() => {
    refreshBooks();
  }, []);

  // Load active book when ID changes
  useEffect(() => {
    if (activeBookId) {
      loadActiveBook(activeBookId);
    } else {
      setActiveBookState(null);
    }
  }, [activeBookId]);

  // Persist active book ID
  useEffect(() => {
    if (activeBookId) {
      localStorage.setItem(STORAGE_KEY, activeBookId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [activeBookId]);

  const loadActiveBook = async (bookId: string) => {
    setLoading(true);
    setError(null);
    try {
      const book = await booksService.getBook(bookId);
      setActiveBookState(book);
    } catch (err: any) {
      console.error('Failed to load active book:', err);
      setError(err.message || 'Failed to load book');
      // Book might have been deleted - clear selection
      if (err.message?.includes('not found') || err.message?.includes('404')) {
        setActiveBookId(null);
        setActiveBookState(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshBooks = useCallback(async () => {
    setBooksLoading(true);
    try {
      const result = await booksService.listBooks();
      setBooks(result.books || []);
    } catch (err: any) {
      console.error('Failed to load books:', err);
    } finally {
      setBooksLoading(false);
    }
  }, []);

  const refreshActiveBook = useCallback(async () => {
    if (activeBookId) {
      await loadActiveBook(activeBookId);
    }
  }, [activeBookId]);

  const setActiveBook = useCallback(async (bookId: string | null) => {
    setActiveBookId(bookId);
    if (!bookId) {
      setActiveBookState(null);
    }
  }, []);

  const createBook = useCallback(async (title: string, subtitle?: string): Promise<Book> => {
    const book = await booksService.createBook({ title, subtitle });
    // Add to books list
    setBooks(prev => [book, ...prev]);
    // Set as active
    setActiveBookId(book.id);
    setActiveBookState(book);
    return book;
  }, []);

  const createChapter = useCallback(async (title: string): Promise<Chapter | null> => {
    if (!activeBook) {
      console.error('No active book selected');
      return null;
    }

    try {
      const chapter = await booksService.createChapter(activeBook.id, { title });
      // Refresh active book to get updated structure
      await refreshActiveBook();
      return chapter;
    } catch (err: any) {
      console.error('Failed to create chapter:', err);
      setError(err.message || 'Failed to create chapter');
      return null;
    }
  }, [activeBook, refreshActiveBook]);

  const createSection = useCallback(async (chapterId: string, title?: string): Promise<Section | null> => {
    if (!activeBook) {
      console.error('No active book selected');
      return null;
    }

    try {
      const section = await booksService.createSection(activeBook.id, chapterId, { title });
      // Refresh active book to get updated structure
      await refreshActiveBook();
      return section;
    } catch (err: any) {
      console.error('Failed to create section:', err);
      setError(err.message || 'Failed to create section');
      return null;
    }
  }, [activeBook, refreshActiveBook]);

  const addToBook = useCallback(async (options: AddToBookOptions): Promise<Page | null> => {
    if (!activeBook) {
      console.error('No active book selected');
      return null;
    }

    let targetSectionId = options.sectionId;
    let targetChapterId = options.chapterId;

    try {
      // If no section specified, we might need to create chapter and/or section
      if (!targetSectionId) {
        // If no chapter specified, create one
        if (!targetChapterId && options.createChapterTitle) {
          const chapter = await booksService.createChapter(activeBook.id, {
            title: options.createChapterTitle,
          });
          targetChapterId = chapter.id;
        }

        // If we have a chapter but no section, create one
        if (targetChapterId) {
          const section = await booksService.createSection(activeBook.id, targetChapterId, {
            title: options.createSectionTitle,
          });
          targetSectionId = section.id;
        }
      }

      if (!targetSectionId) {
        throw new Error('Could not determine target section for page');
      }

      // Create the page
      const page = await booksService.createPage(activeBook.id, targetSectionId, {
        content: options.content,
        contentType: options.contentType || 'text',
        source: options.source,
      });

      // Refresh active book to get updated structure
      await refreshActiveBook();

      return page;
    } catch (err: any) {
      console.error('Failed to add content to book:', err);
      setError(err.message || 'Failed to add content');
      return null;
    }
  }, [activeBook, refreshActiveBook]);

  const value: ActiveBookContextValue = {
    activeBook,
    activeBookId,
    loading,
    error,
    books,
    booksLoading,
    setActiveBook,
    refreshActiveBook,
    refreshBooks,
    createBook,
    addToBook,
    createChapter,
    createSection,
  };

  return (
    <ActiveBookContext.Provider value={value}>
      {children}
    </ActiveBookContext.Provider>
  );
}

export function useActiveBook() {
  const context = useContext(ActiveBookContext);
  if (context === undefined) {
    throw new Error('useActiveBook must be used within an ActiveBookProvider');
  }
  return context;
}
