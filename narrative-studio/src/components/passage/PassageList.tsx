/**
 * Passage List Component
 *
 * Displays a list of passages with filtering, sorting, and bulk actions.
 * Main component for the center pane of the studio.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { Passage, PassageUIState } from '../../types/passage';
import { PassageCard } from './PassageCard';

// ============================================================
// STYLES
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--color-bg-primary, #f8fafc)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-sm, 8px) var(--space-md, 16px)',
    backgroundColor: 'var(--color-bg-secondary, #ffffff)',
    borderBottom: '1px solid var(--color-border, #e2e8f0)',
    flexShrink: 0,
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md, 16px)',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm, 8px)',
  },
  searchInput: {
    padding: '8px 12px',
    border: '1px solid var(--color-border, #e2e8f0)',
    borderRadius: 'var(--radius-md, 8px)',
    fontSize: '0.875rem',
    width: '240px',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  },
  select: {
    padding: '8px 12px',
    border: '1px solid var(--color-border, #e2e8f0)',
    borderRadius: 'var(--radius-md, 8px)',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-primary, #ffffff)',
    cursor: 'pointer',
  },
  bulkActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm, 8px)',
    padding: 'var(--space-sm, 8px) var(--space-md, 16px)',
    backgroundColor: 'var(--color-primary-light, rgba(8, 145, 178, 0.1))',
    borderBottom: '1px solid var(--color-primary, #0891b2)',
  },
  bulkButton: {
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: 500,
    border: 'none',
    borderRadius: 'var(--radius-sm, 4px)',
    backgroundColor: 'var(--color-primary, #0891b2)',
    color: 'white',
    cursor: 'pointer',
  },
  bulkButtonSecondary: {
    backgroundColor: 'var(--color-bg-secondary, #ffffff)',
    color: 'var(--color-text-secondary, #475569)',
    border: '1px solid var(--color-border, #e2e8f0)',
  },
  selectionCount: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary, #475569)',
    fontWeight: 500,
  },
  list: {
    flex: 1,
    overflow: 'auto',
    padding: 'var(--space-md, 16px)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: 'var(--space-xl, 32px)',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: 'var(--space-md, 16px)',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--color-text-primary, #1e293b)',
    marginBottom: 'var(--space-sm, 8px)',
  },
  emptyText: {
    fontSize: '0.95rem',
    color: 'var(--color-text-tertiary, #94a3b8)',
    maxWidth: '400px',
  },
  stats: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md, 16px)',
    padding: 'var(--space-sm, 8px) var(--space-md, 16px)',
    backgroundColor: 'var(--color-bg-secondary, #ffffff)',
    borderTop: '1px solid var(--color-border, #e2e8f0)',
    fontSize: '0.8rem',
    color: 'var(--color-text-tertiary, #94a3b8)',
    flexShrink: 0,
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-xs, 4px)',
  },
};

// ============================================================
// TYPES
// ============================================================

export type SortOption = 'date-desc' | 'date-asc' | 'words-desc' | 'words-asc' | 'title-asc' | 'title-desc';
export type FilterOption = 'all' | 'original' | 'edited' | 'derived';

export interface PassageListProps {
  passages: Passage[];
  uiState: Map<string, PassageUIState>;
  activePassageId: string | null;
  selectedPassageIds: string[];

  // Callbacks
  onSelect: (id: string) => void;
  onActivate: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;

  // Single passage actions
  onTransform?: (id: string) => void;
  onAnalyze?: (id: string) => void;
  onFindSimilar?: (id: string) => void;
  onSplit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;

  // Bulk actions
  onBulkTransform?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkMerge?: (ids: string[]) => void;
  onBulkExport?: (ids: string[]) => void;
}

// ============================================================
// COMPONENT
// ============================================================

export function PassageList({
  passages,
  uiState,
  activePassageId,
  selectedPassageIds,
  onSelect,
  onActivate,
  onToggleExpand,
  onSelectAll,
  onClearSelection,
  onTransform,
  onAnalyze,
  onFindSimilar,
  onSplit,
  onDuplicate,
  onDelete,
  onEdit,
  onBulkTransform,
  onBulkDelete,
  onBulkMerge,
  onBulkExport,
}: PassageListProps) {
  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');

  // Filter passages
  const filteredPassages = useMemo(() => {
    let result = [...passages];

    // Apply text filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.content.toLowerCase().includes(query) ||
        p.metadata.title?.toLowerCase().includes(query) ||
        p.metadata.tags?.some(t => t.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (filterBy !== 'all') {
      result = result.filter(p => p.status === filterBy);
    }

    // Apply sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return (b.metadata.date?.getTime() || 0) - (a.metadata.date?.getTime() || 0);
        case 'date-asc':
          return (a.metadata.date?.getTime() || 0) - (b.metadata.date?.getTime() || 0);
        case 'words-desc':
          return b.metadata.wordCount - a.metadata.wordCount;
        case 'words-asc':
          return a.metadata.wordCount - b.metadata.wordCount;
        case 'title-asc':
          return (a.metadata.title || '').localeCompare(b.metadata.title || '');
        case 'title-desc':
          return (b.metadata.title || '').localeCompare(a.metadata.title || '');
        default:
          return 0;
      }
    });

    return result;
  }, [passages, searchQuery, sortBy, filterBy]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalWords = passages.reduce((sum, p) => sum + p.metadata.wordCount, 0);
    const totalReadTime = passages.reduce((sum, p) => sum + p.metadata.estimatedReadTime, 0);
    return {
      total: passages.length,
      filtered: filteredPassages.length,
      selected: selectedPassageIds.length,
      totalWords,
      totalReadTime,
    };
  }, [passages, filteredPassages, selectedPassageIds]);

  // Handle bulk actions
  const handleBulkTransform = useCallback(() => {
    onBulkTransform?.(selectedPassageIds);
  }, [selectedPassageIds, onBulkTransform]);

  const handleBulkDelete = useCallback(() => {
    if (window.confirm(`Delete ${selectedPassageIds.length} selected passages?`)) {
      onBulkDelete?.(selectedPassageIds);
    }
  }, [selectedPassageIds, onBulkDelete]);

  const handleBulkMerge = useCallback(() => {
    onBulkMerge?.(selectedPassageIds);
  }, [selectedPassageIds, onBulkMerge]);

  const handleBulkExport = useCallback(() => {
    onBulkExport?.(selectedPassageIds);
  }, [selectedPassageIds, onBulkExport]);

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <input
            type="text"
            placeholder="Search passages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as FilterOption)}
            style={styles.select}
          >
            <option value="all">All Status</option>
            <option value="original">Original</option>
            <option value="edited">Edited</option>
            <option value="derived">Derived</option>
          </select>
        </div>
        <div style={styles.toolbarRight}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            style={styles.select}
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="words-desc">Most Words</option>
            <option value="words-asc">Fewest Words</option>
            <option value="title-asc">Title A-Z</option>
            <option value="title-desc">Title Z-A</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions (when items selected) */}
      {selectedPassageIds.length > 0 && (
        <div style={styles.bulkActions}>
          <span style={styles.selectionCount}>
            {selectedPassageIds.length} selected
          </span>
          <button style={styles.bulkButton} onClick={handleBulkTransform}>
            Transform All
          </button>
          {selectedPassageIds.length >= 2 && (
            <button style={{ ...styles.bulkButton, ...styles.bulkButtonSecondary }} onClick={handleBulkMerge}>
              Merge
            </button>
          )}
          <button style={{ ...styles.bulkButton, ...styles.bulkButtonSecondary }} onClick={handleBulkExport}>
            Export
          </button>
          <button
            style={{ ...styles.bulkButton, ...styles.bulkButtonSecondary }}
            onClick={handleBulkDelete}
          >
            Delete
          </button>
          <div style={{ flex: 1 }} />
          <button
            style={{ ...styles.bulkButton, ...styles.bulkButtonSecondary }}
            onClick={onSelectAll}
          >
            Select All
          </button>
          <button
            style={{ ...styles.bulkButton, ...styles.bulkButtonSecondary }}
            onClick={onClearSelection}
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* List */}
      <div style={styles.list}>
        {filteredPassages.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📝</div>
            <div style={styles.emptyTitle}>
              {passages.length === 0 ? 'No Passages Yet' : 'No Matching Passages'}
            </div>
            <div style={styles.emptyText}>
              {passages.length === 0
                ? 'Import content from your archives, paste text, or upload files to create passages.'
                : 'Try adjusting your search or filter criteria.'}
            </div>
          </div>
        ) : (
          filteredPassages.map(passage => (
            <PassageCard
              key={passage.id}
              passage={passage}
              uiState={uiState.get(passage.id)}
              isActive={passage.id === activePassageId}
              onSelect={onSelect}
              onActivate={onActivate}
              onToggleExpand={onToggleExpand}
              onTransform={onTransform}
              onAnalyze={onAnalyze}
              onFindSimilar={onFindSimilar}
              onSplit={onSplit}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))
        )}
      </div>

      {/* Stats footer */}
      <div style={styles.stats}>
        <span style={styles.statItem}>
          📊 {stats.filtered} of {stats.total} passages
        </span>
        <span style={styles.statItem}>
          📝 {stats.totalWords.toLocaleString()} words
        </span>
        <span style={styles.statItem}>
          ⏱️ ~{stats.totalReadTime} min read
        </span>
        {stats.selected > 0 && (
          <span style={styles.statItem}>
            ✓ {stats.selected} selected
          </span>
        )}
      </div>
    </div>
  );
}

export default PassageList;
