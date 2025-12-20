/**
 * ArchiveSearchBar - Search and filter UI for archive panel
 *
 * Extracted from ArchivePanel.tsx for reusability.
 */

import { Icons } from '../layout/Icons';
import type { FilterCategory, ActiveFilters } from '../../hooks/useArchiveState';

interface CategorizedTags {
  date: string[];
  size: string[];
  media: string[];
}

interface ArchiveSearchBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  placeholder?: string;

  // Recent searches
  recentSearches: string[];
  showRecentSearches: boolean;
  onShowRecentSearches: (show: boolean) => void;
  onSelectRecentSearch: (search: string) => void;

  // Filters
  activeFilters: ActiveFilters;
  hasActiveFilters: boolean;
  showingCategory: FilterCategory | null;
  onShowCategory: (category: FilterCategory | null) => void;
  onSelectFilter: (category: FilterCategory, tag: string) => void;
  onRemoveFilter: (category: FilterCategory) => void;
  categorizedTags: CategorizedTags;

  // Sort
  sortDirection: 'ascending' | 'descending';
  onToggleSortDirection: () => void;

  // Stats
  totalCount: number;
  filteredCount: number;
}

export function ArchiveSearchBar({
  searchQuery,
  onSearchChange,
  onClearSearch,
  placeholder = 'Search...',
  recentSearches,
  showRecentSearches,
  onShowRecentSearches,
  onSelectRecentSearch,
  activeFilters,
  hasActiveFilters,
  showingCategory,
  onShowCategory,
  onSelectFilter,
  onRemoveFilter,
  categorizedTags,
  sortDirection,
  onToggleSortDirection,
  totalCount,
  filteredCount,
}: ArchiveSearchBarProps) {
  return (
    <>
      {/* Search input */}
      <div className="relative mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => onShowRecentSearches(true)}
          onBlur={() => setTimeout(() => onShowRecentSearches(false), 200)}
          placeholder={placeholder}
          className="ui-text w-full"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            paddingLeft: '2.75rem',
            paddingRight: searchQuery ? '2.75rem' : '1rem',
          }}
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none u-text-tertiary">
          <Icons.Search />
        </div>
        {searchQuery && (
          <button
            onClick={onClearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:opacity-70 transition-opacity u-text-tertiary"
            title="Clear search"
            aria-label="Clear search"
          >
            <Icons.Close />
          </button>
        )}

        {/* Recent searches dropdown */}
        {showRecentSearches && recentSearches.length > 0 && (
          <div
            className="absolute top-full left-0 right-0 mt-1 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
            }}
          >
            {recentSearches.map((search, idx) => (
              <button
                key={idx}
                onClick={() => onSelectRecentSearch(search)}
                className="w-full text-left px-4 py-2 text-small hover:opacity-70"
                style={{
                  color: 'var(--text-primary)',
                  backgroundColor: idx === 0 ? 'var(--bg-tertiary)' : 'transparent',
                }}
              >
                <span style={{ display: 'inline-block', marginRight: '8px', color: 'var(--text-tertiary)' }}>
                  <Icons.Search />
                </span>
                {search}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter chips */}
      <div className="mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
          {/* "All" button when no filters active */}
          {!hasActiveFilters && (
            <button
              className="tag"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--text-inverse)',
                border: '1px solid var(--accent-primary)',
                fontWeight: 600,
              }}
            >
              All
            </button>
          )}

          {/* Active filter chips */}
          {Object.entries(activeFilters).map(([category, tag]) => (
            <button
              key={category}
              onClick={() => onRemoveFilter(category as FilterCategory)}
              className="tag"
              style={{
                backgroundImage: 'var(--accent-primary-gradient)',
                backgroundColor: 'transparent',
                color: 'var(--text-inverse)',
                border: '1px solid transparent',
                fontWeight: 600,
              }}
            >
              {tag} ✕
            </button>
          ))}

          {/* Category buttons */}
          {!activeFilters.date && categorizedTags.date.length > 0 && (
            <button
              onClick={() => onShowCategory(showingCategory === 'date' ? null : 'date')}
              className="tag"
              style={{
                backgroundColor: showingCategory === 'date' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: showingCategory === 'date' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                border: `1px solid ${showingCategory === 'date' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                fontWeight: 600,
              }}
            >
              Date {showingCategory === 'date' ? '▼' : '+'}
            </button>
          )}

          {!activeFilters.size && categorizedTags.size.length > 0 && (
            <button
              onClick={() => onShowCategory(showingCategory === 'size' ? null : 'size')}
              className="tag"
              style={{
                backgroundColor: showingCategory === 'size' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: showingCategory === 'size' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                border: `1px solid ${showingCategory === 'size' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                fontWeight: 600,
              }}
            >
              Size {showingCategory === 'size' ? '▼' : '+'}
            </button>
          )}

          {!activeFilters.media && categorizedTags.media.length > 0 && (
            <button
              onClick={() => onShowCategory(showingCategory === 'media' ? null : 'media')}
              className="tag"
              style={{
                backgroundColor: showingCategory === 'media' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: showingCategory === 'media' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                border: `1px solid ${showingCategory === 'media' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                fontWeight: 600,
              }}
            >
              Media {showingCategory === 'media' ? '▼' : '+'}
            </button>
          )}

          {/* Divider + Sort toggle */}
          <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
          <button
            onClick={onToggleSortDirection}
            className="tag"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              fontWeight: 600,
            }}
            title={sortDirection === 'descending' ? 'Newest first' : 'Oldest first'}
          >
            {sortDirection === 'descending' ? '↓ Descending' : '↑ Ascending'}
          </button>

          {/* Category options */}
          {showingCategory && (
            <>
              <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
              {categorizedTags[showingCategory].map((tag) => (
                <button
                  key={tag}
                  onClick={() => onSelectFilter(showingCategory, tag)}
                  className="tag"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {tag}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="text-small u-text-secondary">
        {searchQuery || hasActiveFilters
          ? `${filteredCount} of ${totalCount}`
          : `${totalCount} conversations`}
      </div>
    </>
  );
}
