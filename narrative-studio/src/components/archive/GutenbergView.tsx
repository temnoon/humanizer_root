/**
 * GutenbergView - Project Gutenberg Book Browser
 *
 * Provides access to public domain literature for experimentation
 * with transformations, persona creation, and style exploration.
 *
 * Features:
 * - Curated collection of featured books
 * - Search Gutenberg catalog via gutendex.com API
 * - Preview book structure with chapters/sections
 * - Load individual chapters or full text into workspace
 * - Unified vertical step flow for all screen sizes (sidebar-friendly)
 */

import { useState, useEffect, useCallback } from 'react';
import { STORAGE_PATHS } from '../../config/storage-paths';

// Mobile breakpoint - matches CSS
const MOBILE_BREAKPOINT = 768;

interface GutenbergBook {
  id: number;
  title: string;
  authors: string[];
  subjects: string[];
  languages: string[];
  downloadCount: number;
}

interface StructureUnit {
  index: number;
  type: 'part' | 'chapter' | 'section' | 'preface' | 'epilogue' | 'prologue';
  number?: number;
  title?: string;
  wordCount: number;
  preview: string;
}

interface BookStructure {
  id: number;
  title: string;
  authors: string[];
  structure: StructureUnit[];
  stats: {
    totalWords: number;
    structuralUnits: number;
  };
}

interface GutenbergViewProps {
  onSelectText?: (text: string, title: string) => void;
  onClose?: () => void; // Callback to close/minimize the sidebar
}

export function GutenbergView({ onSelectText, onClose }: GutenbergViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GutenbergBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<GutenbergBook | null>(null);
  const [bookStructure, setBookStructure] = useState<BookStructure | null>(null);
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [sectionContent, setSectionContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSection, setLoadingSection] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Featured books for quick access
  const featuredBooks: GutenbergBook[] = [
    { id: 1342, title: 'Pride and Prejudice', authors: ['Jane Austen'], subjects: ['Fiction'], languages: ['en'], downloadCount: 50000 },
    { id: 84, title: 'Frankenstein', authors: ['Mary Shelley'], subjects: ['Fiction', 'Gothic'], languages: ['en'], downloadCount: 40000 },
    { id: 1661, title: 'Sherlock Holmes', authors: ['Arthur Conan Doyle'], subjects: ['Fiction', 'Mystery'], languages: ['en'], downloadCount: 35000 },
    { id: 11, title: "Alice's Adventures in Wonderland", authors: ['Lewis Carroll'], subjects: ['Fiction', 'Fantasy'], languages: ['en'], downloadCount: 30000 },
    { id: 2701, title: 'Moby Dick', authors: ['Herman Melville'], subjects: ['Fiction', 'Adventure'], languages: ['en'], downloadCount: 25000 },
    { id: 1232, title: 'The Prince', authors: ['Niccolò Machiavelli'], subjects: ['Political Science'], languages: ['en'], downloadCount: 20000 },
    { id: 174, title: 'Picture of Dorian Gray', authors: ['Oscar Wilde'], subjects: ['Fiction'], languages: ['en'], downloadCount: 18000 },
    { id: 345, title: 'Dracula', authors: ['Bram Stoker'], subjects: ['Fiction', 'Horror'], languages: ['en'], downloadCount: 16000 },
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    // Reset selection when searching
    setSelectedBook(null);
    setBookStructure(null);
    setSelectedSection(null);
    setSectionContent(null);
    try {
      const response = await fetch(
        `${STORAGE_PATHS.npeApiUrl}/gutenberg/search?q=${encodeURIComponent(searchQuery)}&languages=en`
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setSearchResults(data.books || []);
    } catch (err) {
      setError('Failed to search Gutenberg. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadBookStructure = async (book: GutenbergBook) => {
    setSelectedBook(book);
    setBookStructure(null);
    setSelectedSection(null);
    setSectionContent(null);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${STORAGE_PATHS.npeApiUrl}/gutenberg/book/${book.id}/structure`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setBookStructure(data);
    } catch (err) {
      setError('Could not load book structure. Try another book.');
    } finally {
      setLoading(false);
    }
  };

  const loadSectionContent = async (sectionIndex: number) => {
    if (!selectedBook) return;
    setSelectedSection(sectionIndex);
    setSectionContent(null);
    setLoadingSection(true);
    try {
      const response = await fetch(`${STORAGE_PATHS.npeApiUrl}/gutenberg/book/${selectedBook.id}/section/${sectionIndex}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setSectionContent(data.content);
    } catch (err) {
      setError('Could not load section content.');
    } finally {
      setLoadingSection(false);
    }
  };

  const handleUseSection = useCallback(() => {
    if (sectionContent && selectedBook && bookStructure && selectedSection !== null && onSelectText) {
      const section = bookStructure.structure[selectedSection];
      const title = section.title
        ? `${selectedBook.title} - ${section.title}`
        : `${selectedBook.title} - ${section.type} ${section.number || selectedSection + 1}`;

      // Load the content
      onSelectText(sectionContent, title);

      // Only close sidebar on mobile - desktop users can see both panes
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      if (isMobile && onClose) {
        onClose();
      }
    }
  }, [sectionContent, selectedBook, bookStructure, selectedSection, onSelectText, onClose]);

  const handleBackToBooks = () => {
    setSelectedBook(null);
    setBookStructure(null);
    setSelectedSection(null);
    setSectionContent(null);
  };

  const handleBackToChapters = () => {
    setSelectedSection(null);
    setSectionContent(null);
  };

  const formatSectionLabel = (unit: StructureUnit): string => {
    if (unit.title) {
      if (unit.number) {
        return `${unit.type.charAt(0).toUpperCase() + unit.type.slice(1)} ${unit.number}: ${unit.title}`;
      }
      return unit.title;
    }
    if (unit.number) {
      return `${unit.type.charAt(0).toUpperCase() + unit.type.slice(1)} ${unit.number}`;
    }
    return unit.type.charAt(0).toUpperCase() + unit.type.slice(1);
  };

  const displayBooks = searchResults.length > 0 ? searchResults : featuredBooks;

  // Determine current step: 'books' | 'chapters' | 'preview'
  const currentStep = !selectedBook ? 'books' : !sectionContent ? 'chapters' : 'preview';

  return (
    <div className="gutenberg-view">
      {/* Search Section - always visible at top */}
      <div className="gutenberg-view__search">
        <div className="gutenberg-view__search-row">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search Gutenberg..."
            className="gutenberg-view__search-input"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="gutenberg-view__search-btn"
          >
            {loading ? '...' : 'Search'}
          </button>
        </div>
      </div>

      {error && (
        <div className="gutenberg-view__error">
          {error}
        </div>
      )}

      {/* Step-based content area - fills remaining space */}
      <div className="gutenberg-view__content">

        {/* STEP 1: Books List */}
        {currentStep === 'books' && (
          <div className="gutenberg-view__step">
            <div className="gutenberg-view__step-header">
              <span className="gutenberg-view__step-title">
                {searchResults.length > 0 ? `${searchResults.length} Results` : 'Featured Books'}
              </span>
            </div>
            <div className="gutenberg-view__list">
              {displayBooks.map((book) => (
                <div
                  key={book.id}
                  onClick={() => loadBookStructure(book)}
                  className="gutenberg-view__list-item"
                >
                  <div className="gutenberg-view__list-item-title">{book.title}</div>
                  <div className="gutenberg-view__list-item-meta">
                    {book.authors[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Chapters List */}
        {currentStep === 'chapters' && selectedBook && (
          <div className="gutenberg-view__step">
            <div className="gutenberg-view__step-header gutenberg-view__step-header--nav">
              <button
                className="gutenberg-view__back-btn"
                onClick={handleBackToBooks}
              >
                ←
              </button>
              <div className="gutenberg-view__step-info">
                <span className="gutenberg-view__step-title">{selectedBook.title}</span>
                <span className="gutenberg-view__step-subtitle">{selectedBook.authors[0]}</span>
              </div>
            </div>

            {loading && !bookStructure && (
              <div className="gutenberg-view__loading">Loading chapters...</div>
            )}

            {bookStructure && (
              <div className="gutenberg-view__list">
                {bookStructure.structure.map((unit) => (
                  <div
                    key={unit.index}
                    onClick={() => loadSectionContent(unit.index)}
                    className={`gutenberg-view__list-item ${selectedSection === unit.index ? 'gutenberg-view__list-item--selected' : ''}`}
                  >
                    <div className="gutenberg-view__list-item-title">
                      {formatSectionLabel(unit)}
                    </div>
                    <div className="gutenberg-view__list-item-meta">
                      {unit.wordCount.toLocaleString()} words
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Preview */}
        {currentStep === 'preview' && selectedBook && bookStructure && selectedSection !== null && (
          <div className="gutenberg-view__step">
            <div className="gutenberg-view__step-header gutenberg-view__step-header--nav">
              <button
                className="gutenberg-view__back-btn"
                onClick={handleBackToChapters}
              >
                ←
              </button>
              <div className="gutenberg-view__step-info">
                <span className="gutenberg-view__step-title">
                  {formatSectionLabel(bookStructure.structure[selectedSection])}
                </span>
                <span className="gutenberg-view__step-subtitle">{selectedBook.title}</span>
              </div>
            </div>

            {loadingSection && (
              <div className="gutenberg-view__loading">Loading content...</div>
            )}

            {sectionContent && !loadingSection && (
              <>
                <div className="gutenberg-view__preview-text">
                  {sectionContent.slice(0, 3000)}{sectionContent.length > 3000 ? '\n\n[Preview truncated...]' : ''}
                </div>
                <div className="gutenberg-view__action-footer">
                  <button
                    onClick={handleUseSection}
                    className="gutenberg-view__use-btn"
                  >
                    Use This Chapter
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
