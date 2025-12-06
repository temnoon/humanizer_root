/**
 * Book Editor Page - The Bookmaking Tool Interface
 *
 * Phase 1: Core book structure editor with chapters, sections, and pages
 *
 * Structure:
 * - Left: Book Structure (chapters, sections, pages tree)
 * - Center: Page Content (reader/editor)
 * - Right: Context (curator, annotations, tools)
 */

import { Component, createSignal, createEffect, Show, For, onMount } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { authStore } from '@/stores/auth';
import { confirm } from '@/components/ui/ConfirmDialog';
import { StudioLayout } from '@/components/studio/StudioLayout';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import {
  booksService,
  type Book,
  type Chapter,
  type Section,
  type Page,
  type PageSource,
} from '@/services/books';
import '@/styles/book-editor.css';

type EditorMode = 'view' | 'edit';

export const BookEditorPage: Component = () => {
  const navigate = useNavigate();
  const params = useParams<{ bookId?: string }>();

  // Redirect if not authenticated
  if (!authStore.isAuthenticated()) {
    navigate('/login');
    return null;
  }

  // State
  const [book, setBook] = createSignal<Book | null>(null);
  const [books, setBooks] = createSignal<Book[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Selected items
  const [selectedChapterId, setSelectedChapterId] = createSignal<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = createSignal<string | null>(null);
  const [selectedPageId, setSelectedPageId] = createSignal<string | null>(null);
  const [currentPage, setCurrentPage] = createSignal<Page | null>(null);

  // Editor mode
  const [editorMode, setEditorMode] = createSignal<EditorMode>('view');
  const [pageContent, setPageContent] = createSignal('');

  // Dialog states
  const [showNewBookDialog, setShowNewBookDialog] = createSignal(false);
  const [showNewChapterDialog, setShowNewChapterDialog] = createSignal(false);
  const [showNewSectionDialog, setShowNewSectionDialog] = createSignal(false);
  const [showNewPageDialog, setShowNewPageDialog] = createSignal(false);

  // New item form states
  const [newBookTitle, setNewBookTitle] = createSignal('');
  const [newChapterTitle, setNewChapterTitle] = createSignal('');
  const [newSectionTitle, setNewSectionTitle] = createSignal('');
  const [newPageContent, setNewPageContent] = createSignal('');

  // Load books list on mount
  onMount(async () => {
    const token = authStore.token();
    if (!token) return;

    try {
      const result = await booksService.listBooks(token);
      setBooks(result.books);

      // If we have a bookId param, load that book
      if (params.bookId) {
        await loadBook(params.bookId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load books');
    } finally {
      setLoading(false);
    }
  });

  // Load a specific book
  const loadBook = async (bookId: string) => {
    const token = authStore.token();
    if (!token) return;

    try {
      setLoading(true);
      const bookData = await booksService.getBook(token, bookId);
      setBook(bookData);

      // Auto-select first chapter/section/page if available
      if (bookData.chapters && bookData.chapters.length > 0) {
        const firstChapter = bookData.chapters[0];
        setSelectedChapterId(firstChapter.id);

        if (firstChapter.sections && firstChapter.sections.length > 0) {
          const firstSection = firstChapter.sections[0];
          setSelectedSectionId(firstSection.id);

          if (firstSection.pages && firstSection.pages.length > 0) {
            await loadPage(bookData.id, firstSection.pages[0].id);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load book');
    } finally {
      setLoading(false);
    }
  };

  // Load a specific page
  const loadPage = async (bookId: string, pageId: string) => {
    const token = authStore.token();
    if (!token) return;

    try {
      const pageData = await booksService.getPage(token, bookId, pageId);
      setCurrentPage(pageData);
      setSelectedPageId(pageId);
      setPageContent(pageData.content);
    } catch (err) {
      console.error('Failed to load page:', err);
    }
  };

  // Create a new book
  const handleCreateBook = async () => {
    const token = authStore.token();
    if (!token || !newBookTitle()) return;

    try {
      const newBook = await booksService.createBook(token, {
        title: newBookTitle(),
      });
      setBooks([newBook, ...books()]);
      setBook(newBook);
      setShowNewBookDialog(false);
      setNewBookTitle('');
      navigate(`/books/${newBook.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create book');
    }
  };

  // Create a new chapter
  const handleCreateChapter = async () => {
    const token = authStore.token();
    const currentBook = book();
    if (!token || !currentBook || !newChapterTitle()) return;

    try {
      const newChapter = await booksService.createChapter(token, currentBook.id, {
        title: newChapterTitle(),
      });

      // Update local state
      setBook({
        ...currentBook,
        chapters: [...(currentBook.chapters || []), newChapter],
      });

      setShowNewChapterDialog(false);
      setNewChapterTitle('');
      setSelectedChapterId(newChapter.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create chapter');
    }
  };

  // Create a new section
  const handleCreateSection = async () => {
    const token = authStore.token();
    const currentBook = book();
    const chapterId = selectedChapterId();
    if (!token || !currentBook || !chapterId) return;

    try {
      const newSection = await booksService.createSection(
        token,
        currentBook.id,
        chapterId,
        { title: newSectionTitle() || undefined }
      );

      // Update local state
      const updatedChapters = (currentBook.chapters || []).map((ch) =>
        ch.id === chapterId
          ? { ...ch, sections: [...(ch.sections || []), newSection] }
          : ch
      );

      setBook({ ...currentBook, chapters: updatedChapters });
      setShowNewSectionDialog(false);
      setNewSectionTitle('');
      setSelectedSectionId(newSection.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create section');
    }
  };

  // Create a new page
  const handleCreatePage = async () => {
    const token = authStore.token();
    const currentBook = book();
    const sectionId = selectedSectionId();
    if (!token || !currentBook || !sectionId || !newPageContent()) return;

    try {
      const source: PageSource = {
        type: 'manual',
        importedAt: Date.now(),
        originalWordCount: newPageContent().split(/\s+/).length,
      };

      const newPage = await booksService.createPage(
        token,
        currentBook.id,
        sectionId,
        {
          content: newPageContent(),
          contentType: 'text',
          source,
        }
      );

      // Update local state - find and update the section
      const updatedChapters = (currentBook.chapters || []).map((ch) => ({
        ...ch,
        sections: (ch.sections || []).map((s) =>
          s.id === sectionId
            ? { ...s, pages: [...(s.pages || []), newPage] }
            : s
        ),
      }));

      setBook({ ...currentBook, chapters: updatedChapters });
      setShowNewPageDialog(false);
      setNewPageContent('');
      await loadPage(currentBook.id, newPage.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create page');
    }
  };

  // Save page edits
  const handleSavePage = async () => {
    const token = authStore.token();
    const currentBook = book();
    const pageId = selectedPageId();
    if (!token || !currentBook || !pageId) return;

    try {
      await booksService.updatePage(token, currentBook.id, pageId, {
        content: pageContent(),
      });
      setEditorMode('view');

      // Update local current page
      const page = currentPage();
      if (page) {
        setCurrentPage({ ...page, content: pageContent() });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save page');
    }
  };

  // Delete current book
  const handleDeleteBook = async () => {
    const token = authStore.token();
    const currentBook = book();
    if (!token || !currentBook) return;

    const confirmed = await confirm({
      title: 'Delete Book',
      message: `Delete "${currentBook.title}"? This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true
    });
    if (!confirmed) return;

    try {
      await booksService.deleteBook(token, currentBook.id);
      setBooks(books().filter((b) => b.id !== currentBook.id));
      setBook(null);
      setSelectedChapterId(null);
      setSelectedSectionId(null);
      setSelectedPageId(null);
      setCurrentPage(null);
      navigate('/books');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete book');
    }
  };

  // Handle logout
  const handleLogout = () => {
    authStore.logout();
    navigate('/login');
  };

  // Helper to get selected chapter
  const selectedChapter = () => {
    const currentBook = book();
    const chapterId = selectedChapterId();
    if (!currentBook || !chapterId) return null;
    return currentBook.chapters?.find((ch) => ch.id === chapterId) || null;
  };

  // Helper to get selected section
  const selectedSection = () => {
    const chapter = selectedChapter();
    const sectionId = selectedSectionId();
    if (!chapter || !sectionId) return null;
    return chapter.sections?.find((s) => s.id === sectionId) || null;
  };

  return (
    <div class="book-editor-shell">
      {/* Header */}
      <header class="book-editor-header">
        <div class="header-left">
          <a href="/studio" class="back-link">← Studio</a>
          <h1 class="book-editor-logo">
            <span class="icon">📚</span>
            Bookmaking
          </h1>
        </div>
        <div class="header-center">
          <Show when={book()}>
            <span class="current-book-title">{book()!.title}</span>
          </Show>
        </div>
        <div class="header-right">
          <ThemeToggle />
          <span class="user-name">{authStore.user()?.email}</span>
          <button class="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <Show when={!loading()} fallback={<div class="loading-state">Loading...</div>}>
        <Show when={!error()} fallback={<div class="error-state">{error()}</div>}>
          <StudioLayout
            leftPanel={
              <div class="book-structure-panel">
                {/* Book Selector */}
                <div class="panel-section">
                  <div class="panel-section-header">
                    <h3>Books</h3>
                    <button
                      class="icon-btn"
                      onClick={() => setShowNewBookDialog(true)}
                      title="New Book"
                    >
                      +
                    </button>
                  </div>
                  <div class="book-list">
                    <For each={books()}>
                      {(b) => (
                        <button
                          class={`book-item ${book()?.id === b.id ? 'active' : ''}`}
                          onClick={() => loadBook(b.id)}
                        >
                          <span class="book-icon">📖</span>
                          <span class="book-title">{b.title}</span>
                          <span class="book-stats">{b.stats.pageCount} pages</span>
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                {/* Chapter Structure (when book selected) */}
                <Show when={book()}>
                  <div class="panel-section">
                    <div class="panel-section-header">
                      <h3>Chapters</h3>
                      <button
                        class="icon-btn"
                        onClick={() => setShowNewChapterDialog(true)}
                        title="New Chapter"
                      >
                        +
                      </button>
                    </div>
                    <div class="chapter-tree">
                      <For each={book()!.chapters || []}>
                        {(chapter) => (
                          <div class="chapter-node">
                            <button
                              class={`chapter-header ${selectedChapterId() === chapter.id ? 'active' : ''}`}
                              onClick={() => setSelectedChapterId(chapter.id)}
                            >
                              <span class="expand-icon">▼</span>
                              <span class="chapter-title">{chapter.title}</span>
                            </button>

                            <Show when={selectedChapterId() === chapter.id}>
                              <div class="chapter-children">
                                <For each={chapter.sections || []}>
                                  {(section) => (
                                    <div class="section-node">
                                      <button
                                        class={`section-header ${selectedSectionId() === section.id ? 'active' : ''}`}
                                        onClick={() => setSelectedSectionId(section.id)}
                                      >
                                        <span class="section-title">
                                          {section.title || 'Untitled Section'}
                                        </span>
                                      </button>

                                      <Show when={selectedSectionId() === section.id}>
                                        <div class="section-children">
                                          <For each={section.pages || []}>
                                            {(page, idx) => (
                                              <button
                                                class={`page-item ${selectedPageId() === page.id ? 'active' : ''}`}
                                                onClick={() => loadPage(book()!.id, page.id)}
                                              >
                                                <span class="page-icon">📄</span>
                                                <span class="page-label">Page {idx() + 1}</span>
                                                <span class="page-words">{page.wordCount}w</span>
                                              </button>
                                            )}
                                          </For>
                                          <button
                                            class="add-page-btn"
                                            onClick={() => setShowNewPageDialog(true)}
                                          >
                                            + Add Page
                                          </button>
                                        </div>
                                      </Show>
                                    </div>
                                  )}
                                </For>
                                <button
                                  class="add-section-btn"
                                  onClick={() => setShowNewSectionDialog(true)}
                                >
                                  + Add Section
                                </button>
                              </div>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            }
            centerPanel={
              <div class="book-content-panel">
                <Show
                  when={currentPage()}
                  fallback={
                    <div class="empty-content">
                      <Show
                        when={book()}
                        fallback={
                          <div class="welcome-message">
                            <h2>Welcome to Bookmaking</h2>
                            <p>Select a book from the left panel or create a new one to get started.</p>
                            <button
                              class="primary-btn"
                              onClick={() => setShowNewBookDialog(true)}
                            >
                              Create New Book
                            </button>
                          </div>
                        }
                      >
                        <div class="select-page-message">
                          <h3>Select a Page</h3>
                          <p>Choose a page from the structure panel to view or edit its content.</p>
                        </div>
                      </Show>
                    </div>
                  }
                >
                  <div class="page-viewer">
                    {/* Page Header */}
                    <div class="page-header">
                      <div class="page-breadcrumb">
                        {selectedChapter()?.title} / {selectedSection()?.title || 'Section'} / Page
                      </div>
                      <div class="page-actions">
                        <Show
                          when={editorMode() === 'view'}
                          fallback={
                            <>
                              <button class="secondary-btn" onClick={() => setEditorMode('view')}>
                                Cancel
                              </button>
                              <button class="primary-btn" onClick={handleSavePage}>
                                Save
                              </button>
                            </>
                          }
                        >
                          <button class="secondary-btn" onClick={() => setEditorMode('edit')}>
                            Edit
                          </button>
                        </Show>
                      </div>
                    </div>

                    {/* Page Content */}
                    <div class="page-content">
                      <Show
                        when={editorMode() === 'edit'}
                        fallback={
                          <div class="content-view">
                            <div innerHTML={currentPage()!.content} />
                          </div>
                        }
                      >
                        <textarea
                          class="content-editor"
                          value={pageContent()}
                          onInput={(e) => setPageContent(e.currentTarget.value)}
                          placeholder="Enter page content..."
                        />
                      </Show>
                    </div>

                    {/* Page Source Attribution */}
                    <Show when={currentPage()?.source?.attribution}>
                      <div class="page-attribution">
                        Source: {currentPage()!.source!.attribution!.title}
                        {currentPage()!.source!.attribution!.author &&
                          ` by ${currentPage()!.source!.attribution!.author}`}
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
            }
            rightPanel={
              <div class="book-context-panel">
                <Show when={book()}>
                  {/* Book Info */}
                  <div class="panel-section">
                    <h3>Book Info</h3>
                    <div class="book-info">
                      <p><strong>Title:</strong> {book()!.title}</p>
                      <p><strong>Author:</strong> {book()!.author}</p>
                      <p><strong>Words:</strong> {book()!.stats.wordCount.toLocaleString()}</p>
                      <p><strong>Pages:</strong> {book()!.stats.pageCount}</p>
                      <p><strong>Chapters:</strong> {book()!.stats.chapterCount}</p>
                    </div>
                    <button class="danger-btn small" onClick={handleDeleteBook}>
                      Delete Book
                    </button>
                  </div>

                  {/* Annotations (when page selected) */}
                  <Show when={currentPage()}>
                    <div class="panel-section">
                      <h3>Annotations</h3>
                      <Show
                        when={currentPage()!.annotations.length > 0}
                        fallback={
                          <p class="empty-text">No annotations yet. Select text to add one.</p>
                        }
                      >
                        <div class="annotation-list">
                          <For each={currentPage()!.annotations}>
                            {(annotation) => (
                              <div class={`annotation-item ${annotation.type}`}>
                                <div class="annotation-type">{annotation.type}</div>
                                <div class="annotation-text">"{annotation.selectedText}"</div>
                                <div class="annotation-content">{annotation.content}</div>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </Show>
              </div>
            }
            leftTitle="Structure"
            rightTitle="Context"
            leftWidth={280}
            rightWidth={300}
          />
        </Show>
      </Show>

      {/* New Book Dialog */}
      <Show when={showNewBookDialog()}>
        <div class="modal-overlay" onClick={() => setShowNewBookDialog(false)}>
          <div class="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Book</h2>
            <input
              type="text"
              class="modal-input"
              placeholder="Book title..."
              value={newBookTitle()}
              onInput={(e) => setNewBookTitle(e.currentTarget.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateBook()}
            />
            <div class="modal-actions">
              <button class="secondary-btn" onClick={() => setShowNewBookDialog(false)}>
                Cancel
              </button>
              <button class="primary-btn" onClick={handleCreateBook} disabled={!newBookTitle()}>
                Create
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* New Chapter Dialog */}
      <Show when={showNewChapterDialog()}>
        <div class="modal-overlay" onClick={() => setShowNewChapterDialog(false)}>
          <div class="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Chapter</h2>
            <input
              type="text"
              class="modal-input"
              placeholder="Chapter title..."
              value={newChapterTitle()}
              onInput={(e) => setNewChapterTitle(e.currentTarget.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateChapter()}
            />
            <div class="modal-actions">
              <button class="secondary-btn" onClick={() => setShowNewChapterDialog(false)}>
                Cancel
              </button>
              <button class="primary-btn" onClick={handleCreateChapter} disabled={!newChapterTitle()}>
                Create
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* New Section Dialog */}
      <Show when={showNewSectionDialog()}>
        <div class="modal-overlay" onClick={() => setShowNewSectionDialog(false)}>
          <div class="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Section</h2>
            <input
              type="text"
              class="modal-input"
              placeholder="Section title (optional)..."
              value={newSectionTitle()}
              onInput={(e) => setNewSectionTitle(e.currentTarget.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateSection()}
            />
            <div class="modal-actions">
              <button class="secondary-btn" onClick={() => setShowNewSectionDialog(false)}>
                Cancel
              </button>
              <button class="primary-btn" onClick={handleCreateSection}>
                Create
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* New Page Dialog */}
      <Show when={showNewPageDialog()}>
        <div class="modal-overlay" onClick={() => setShowNewPageDialog(false)}>
          <div class="modal-dialog large" onClick={(e) => e.stopPropagation()}>
            <h2>Add New Page</h2>
            <textarea
              class="modal-textarea"
              placeholder="Enter page content..."
              value={newPageContent()}
              onInput={(e) => setNewPageContent(e.currentTarget.value)}
            />
            <div class="modal-actions">
              <button class="secondary-btn" onClick={() => setShowNewPageDialog(false)}>
                Cancel
              </button>
              <button class="primary-btn" onClick={handleCreatePage} disabled={!newPageContent()}>
                Add Page
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default BookEditorPage;
