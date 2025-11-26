/**
 * Gutenberg Browser Component
 *
 * Hierarchical browser for Project Gutenberg's ~70,000 public domain books.
 * Designed for the archive panel (left pane) with efficient lazy-loading.
 *
 * Structure:
 * - Category Tree (Philosophy, Literature, Science, etc.)
 * - Subcategories (expandable)
 * - Book list (paginated, on-demand)
 * - Book Preview (chapters/passages with import)
 */

import { Component, createSignal, createResource, Show, For } from 'solid-js';
import {
  gutenbergService,
  GUTENBERG_CATEGORIES,
  type GutenbergCategory,
  type GutenbergBook,
  type GutenbergResponse
} from '@/services/gutenberg';
import { BookPreview } from './BookPreview';

interface BookSource {
  bookTitle: string;
  author: string;
  chapter?: string;
}

interface GutenbergBrowserProps {
  onSelectBook?: (book: GutenbergBook) => void;
  onImport?: (content: string, title: string, source: BookSource) => void;
}

export const GutenbergBrowser: Component<GutenbergBrowserProps> = (props) => {
  const [expandedCategories, setExpandedCategories] = createSignal<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = createSignal<GutenbergCategory | null>(null);
  const [selectedBook, setSelectedBook] = createSignal<GutenbergBook | null>(null);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchMode, setSearchMode] = createSignal(false);
  const [currentPage, setCurrentPage] = createSignal(1);
  
  // Load books for selected category
  const [books, { refetch }] = createResource(
    () => ({ cat: selectedCategory(), page: currentPage(), search: searchQuery(), isSearch: searchMode() }),
    async ({ cat, page, search, isSearch }) => {
      if (isSearch && search.trim()) {
        return await gutenbergService.search(search.trim(), page);
      }
      if (!cat?.topic && !cat?.bookshelf) return null;
      const topic = cat.topic || cat.bookshelf || '';
      return await gutenbergService.searchByTopic(topic, page);
    }
  );
  
  // Toggle category expansion
  const toggleCategory = (catId: string) => {
    const expanded = new Set(expandedCategories());
    if (expanded.has(catId)) {
      expanded.delete(catId);
    } else {
      expanded.add(catId);
    }
    setExpandedCategories(expanded);
  };
  
  // Select a leaf category to load books
  const selectLeafCategory = (cat: GutenbergCategory) => {
    setSearchMode(false);
    setSearchQuery('');
    setSelectedCategory(cat);
    setCurrentPage(1);
  };
  
  // Handle search
  const handleSearch = (e: Event) => {
    e.preventDefault();
    if (searchQuery().trim()) {
      setSearchMode(true);
      setSelectedCategory(null);
      setCurrentPage(1);
      refetch();
    }
  };
  
  // Clear and go back to categories
  const goBack = () => {
    setSelectedCategory(null);
    setSearchMode(false);
    setSearchQuery('');
    setCurrentPage(1);
  };
  
  // Handle book selection - opens BookPreview
  const handleBookSelect = (book: GutenbergBook) => {
    setSelectedBook(book);
    props.onSelectBook?.(book);
  };

  // Close book preview
  const closeBookPreview = () => {
    setSelectedBook(null);
  };

  // Handle import from BookPreview
  const handleImport = (content: string, title: string, source: BookSource) => {
    props.onImport?.(content, title, source);
  };

  return (
    <Show
      when={selectedBook()}
      fallback={
        <div class="gutenberg-browser">
      {/* Search Bar */}
      <div class="gutenberg-search">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search Gutenberg..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="gutenberg-search-input"
          />
          <button type="submit" class="gutenberg-search-btn">🔍</button>
        </form>
      </div>

      {/* Breadcrumb / Back */}
      <Show when={selectedCategory() || searchMode()}>
        <div class="gutenberg-breadcrumb">
          <button class="back-btn" onClick={goBack}>
            ← Categories
          </button>
          <span class="current-selection">
            {searchMode() ? `Search: "${searchQuery()}"` : selectedCategory()?.name}
          </span>
        </div>
      </Show>

      {/* Category Tree or Book List */}
      <div class="gutenberg-content">
        <Show
          when={!selectedCategory() && !searchMode()}
          fallback={<BookList books={books} onSelect={handleBookSelect} currentPage={currentPage} setCurrentPage={setCurrentPage} />}
        >
          <CategoryTree
            categories={GUTENBERG_CATEGORIES}
            expandedCategories={expandedCategories()}
            onToggle={toggleCategory}
            onSelectLeaf={selectLeafCategory}
          />
        </Show>
      </div>

      {/* Footer with stats */}
      <div class="gutenberg-footer">
        <span class="gutenberg-stats">📚 70,000+ Public Domain Books</span>
      </div>
    </div>
      }
    >
      <BookPreview
        book={selectedBook()!}
        onClose={closeBookPreview}
        onImport={handleImport}
      />
    </Show>
  );
};

// Category Tree Component
const CategoryTree: Component<{
  categories: GutenbergCategory[];
  expandedCategories: Set<string>;
  onToggle: (id: string) => void;
  onSelectLeaf: (cat: GutenbergCategory) => void;
}> = (props) => {
  return (
    <div class="category-tree">
      <For each={props.categories}>
        {(cat) => (
          <CategoryNode
            category={cat}
            expanded={props.expandedCategories.has(cat.id)}
            onToggle={props.onToggle}
            onSelectLeaf={props.onSelectLeaf}
          />
        )}
      </For>
    </div>
  );
};

// Individual Category Node
const CategoryNode: Component<{
  category: GutenbergCategory;
  expanded: boolean;
  onToggle: (id: string) => void;
  onSelectLeaf: (cat: GutenbergCategory) => void;
}> = (props) => {
  const hasChildren = () => props.category.children && props.category.children.length > 0;
  const isLeaf = () => !hasChildren() && (props.category.topic || props.category.bookshelf);
  
  const handleClick = () => {
    if (hasChildren()) {
      props.onToggle(props.category.id);
    } else if (isLeaf()) {
      props.onSelectLeaf(props.category);
    }
  };
  
  return (
    <div class="category-node">
      <div 
        class={`category-header ${isLeaf() ? 'leaf' : ''}`}
        onClick={handleClick}
      >
        <Show when={hasChildren()}>
          <span class="expand-icon">{props.expanded ? '▼' : '▶'}</span>
        </Show>
        <Show when={!hasChildren()}>
          <span class="leaf-indent"></span>
        </Show>
        <span class="category-icon">{props.category.icon}</span>
        <span class="category-name">{props.category.name}</span>
        <Show when={isLeaf()}>
          <span class="leaf-arrow">→</span>
        </Show>
      </div>
      
      <Show when={props.expanded && hasChildren()}>
        <div class="category-children">
          <For each={props.category.children}>
            {(child) => (
              <CategoryNode
                category={child}
                expanded={false}
                onToggle={props.onToggle}
                onSelectLeaf={props.onSelectLeaf}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

// Book List Component
const BookList: Component<{
  books: () => GutenbergResponse | null | undefined;
  onSelect: (book: GutenbergBook) => void;
  currentPage: () => number;
  setCurrentPage: (page: number) => void;
}> = (props) => {
  const response = () => props.books();
  const loading = () => props.books.loading;
  
  return (
    <div class="book-list">
      <Show when={loading()}>
        <div class="book-loading">Loading books...</div>
      </Show>
      
      <Show when={!loading() && response()}>
        <div class="book-count">
          {response()!.count.toLocaleString()} books found
        </div>
        
        <div class="book-items">
          <For each={response()!.results}>
            {(book) => (
              <BookItem book={book} onSelect={props.onSelect} />
            )}
          </For>
        </div>
        
        {/* Pagination */}
        <div class="book-pagination">
          <button
            class="page-btn"
            disabled={!response()!.previous}
            onClick={() => props.setCurrentPage(props.currentPage() - 1)}
          >
            ← Prev
          </button>
          <span class="page-info">Page {props.currentPage()}</span>
          <button
            class="page-btn"
            disabled={!response()!.next}
            onClick={() => props.setCurrentPage(props.currentPage() + 1)}
          >
            Next →
          </button>
        </div>
      </Show>
      
      <Show when={!loading() && !response()}>
        <div class="book-empty">Select a category to browse books</div>
      </Show>
    </div>
  );
};

// Individual Book Item
const BookItem: Component<{
  book: GutenbergBook;
  onSelect: (book: GutenbergBook) => void;
}> = (props) => {
  const authors = () => props.book.authors.map(a => a.name).join(', ') || 'Unknown';
  const textUrl = () => gutenbergService.getTextUrl(props.book);
  
  return (
    <div class="book-item" onClick={() => props.onSelect(props.book)}>
      <div class="book-title">{props.book.title}</div>
      <div class="book-author">{authors()}</div>
      <div class="book-meta">
        <span class="download-count">↓ {props.book.download_count.toLocaleString()}</span>
        <span class="book-lang">{props.book.languages.join(', ')}</span>
      </div>
      <Show when={textUrl()}>
        <a 
          class="book-link"
          href={textUrl()!}
          target="_blank"
          rel="noopener"
          onClick={(e) => e.stopPropagation()}
        >
          Read →
        </a>
      </Show>
    </div>
  );
};
