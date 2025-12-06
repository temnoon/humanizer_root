/**
 * ThisBookView - Browse pages from the active book as source content
 *
 * Shows all pages from the active book in a flat, searchable list.
 * Allows selecting pages to load into the main workspace for transformation.
 */

import { useState, useMemo } from 'react';
import { useActiveBook } from '../../contexts/ActiveBookContext';
import { booksService, type Page } from '../../services/booksService';
import { Icons } from '../layout/Icons';

interface ThisBookViewProps {
  onSelectPage: (content: string, metadata: Record<string, unknown>) => void;
}

interface FlatPage {
  id: string;
  chapterTitle: string;
  chapterIndex: number;
  sectionTitle: string;
  sectionIndex: number;
  pageIndex: number;
  wordCount: number;
  preview?: string;
}

export function ThisBookView({ onSelectPage }: ThisBookViewProps) {
  const { activeBook, loading: bookLoading } = useActiveBook();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);

  // Flatten book structure into page list
  const flatPages = useMemo((): FlatPage[] => {
    if (!activeBook?.chapters) return [];

    const pages: FlatPage[] = [];
    activeBook.chapters.forEach((chapter, chapterIdx) => {
      chapter.sections?.forEach((section, sectionIdx) => {
        section.pages?.forEach((page, pageIdx) => {
          pages.push({
            id: page.id,
            chapterTitle: chapter.title || `Chapter ${chapterIdx + 1}`,
            chapterIndex: chapterIdx,
            sectionTitle: section.title || `Section ${sectionIdx + 1}`,
            sectionIndex: sectionIdx,
            pageIndex: pageIdx,
            wordCount: page.wordCount,
            preview: page.preview,
          });
        });
      });
    });
    return pages;
  }, [activeBook]);

  // Filter pages by search query
  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return flatPages;

    const query = searchQuery.toLowerCase();
    return flatPages.filter(page =>
      page.chapterTitle.toLowerCase().includes(query) ||
      page.sectionTitle.toLowerCase().includes(query) ||
      page.preview?.toLowerCase().includes(query)
    );
  }, [flatPages, searchQuery]);

  const handleSelectPage = async (page: FlatPage) => {
    if (!activeBook) return;

    setSelectedPageId(page.id);
    setLoadingPage(true);

    try {
      const fullPage = await booksService.getPage(activeBook.id, page.id);

      onSelectPage(fullPage.content, {
        source: 'book',
        bookId: activeBook.id,
        bookTitle: activeBook.title,
        pageId: fullPage.id,
        chapterTitle: page.chapterTitle,
        sectionTitle: page.sectionTitle,
        wordCount: fullPage.wordCount,
      });
    } catch (err) {
      console.error('Failed to load page:', err);
    } finally {
      setLoadingPage(false);
    }
  };

  // No active book state
  if (!activeBook) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 'var(--space-xl)',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>📚</div>
        <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600 }}>
          No Book Selected
        </h3>
        <p style={{ margin: 'var(--space-sm) 0 0', fontSize: '0.875rem', maxWidth: '240px' }}>
          Select a book from the top bar to browse its pages here
        </p>
      </div>
    );
  }

  // Loading state
  if (bookLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-tertiary)',
        }}
      >
        <div className="animate-spin" style={{ color: 'var(--accent-primary)' }}>
          <Icons.Archive />
        </div>
      </div>
    );
  }

  // Empty book state
  if (flatPages.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 'var(--space-xl)',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>📖</div>
        <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600 }}>
          {activeBook.title}
        </h3>
        <p style={{ margin: 'var(--space-sm) 0 0', fontSize: '0.875rem', maxWidth: '240px' }}>
          This book has no pages yet. Add content using the "Add to Book" section in the Tools panel.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-md)',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
          <span style={{ fontSize: '1.25rem' }}>📖</span>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
            {activeBook.title}
          </h3>
        </div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          {flatPages.length} pages · {activeBook.stats?.wordCount?.toLocaleString() || 0} words
        </p>
      </div>

      {/* Search */}
      <div style={{ padding: 'var(--space-sm) var(--space-md)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
            }}
          >
            <Icons.Search />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <Icons.Close />
            </button>
          )}
        </div>
      </div>

      {/* Page list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-sm) var(--space-md)',
        }}
      >
        {filteredPages.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-xl)',
              color: 'var(--text-tertiary)',
            }}
          >
            <p style={{ margin: 0 }}>No pages match your search</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            {filteredPages.map((page) => {
              const isSelected = selectedPageId === page.id;
              const isLoading = isSelected && loadingPage;

              return (
                <button
                  key={page.id}
                  onClick={() => handleSelectPage(page)}
                  disabled={loadingPage}
                  style={{
                    width: '100%',
                    padding: 'var(--space-sm)',
                    backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                    border: '1px solid transparent',
                    borderRadius: '6px',
                    cursor: loadingPage ? 'wait' : 'pointer',
                    textAlign: 'left',
                    color: isSelected ? 'white' : 'var(--text-primary)',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                  }}
                >
                  {/* Page location */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-xs)',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem' }}>📄</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)',
                      }}
                    >
                      {page.chapterTitle} › {page.sectionTitle}
                    </span>
                    {isLoading && (
                      <span
                        className="animate-spin"
                        style={{ marginLeft: 'auto', fontSize: '0.75rem' }}
                      >
                        ⏳
                      </span>
                    )}
                  </div>

                  {/* Page title/preview */}
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: '0.875rem',
                      marginBottom: '4px',
                      lineHeight: 1.4,
                    }}
                  >
                    Page {page.pageIndex + 1}
                    {page.wordCount > 0 && (
                      <span
                        style={{
                          marginLeft: 'var(--space-sm)',
                          fontWeight: 400,
                          fontSize: '0.75rem',
                          color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)',
                        }}
                      >
                        {page.wordCount} words
                      </span>
                    )}
                  </div>

                  {/* Preview snippet */}
                  {page.preview && (
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: isSelected ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)',
                        lineHeight: 1.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {page.preview}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
