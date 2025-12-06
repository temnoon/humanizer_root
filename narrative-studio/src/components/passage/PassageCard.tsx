/**
 * Passage Card Component
 *
 * Displays a single passage with actions (transform, analyze, split, etc.)
 * Part of the center pane in the studio layout.
 */

import React, { useState, useCallback } from 'react';
import type { Passage, PassageUIState } from '../../types/passage';

// ============================================================
// STYLES
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: '1px solid var(--color-border, #e2e8f0)',
    borderRadius: 'var(--radius-md, 8px)',
    backgroundColor: 'var(--color-bg-secondary, #ffffff)',
    marginBottom: 'var(--space-md, 16px)',
    overflow: 'hidden',
    transition: 'box-shadow 0.2s ease',
  },
  cardSelected: {
    borderColor: 'var(--color-primary, #0891b2)',
    boxShadow: '0 0 0 2px var(--color-primary-light, rgba(8, 145, 178, 0.2))',
  },
  cardActive: {
    borderColor: 'var(--color-primary, #0891b2)',
    borderWidth: '2px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-sm, 8px) var(--space-md, 16px)',
    backgroundColor: 'var(--color-bg-tertiary, #f8fafc)',
    borderBottom: '1px solid var(--color-border, #e2e8f0)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm, 8px)',
    flex: 1,
    minWidth: 0,
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  title: {
    fontWeight: 500,
    fontSize: '0.95rem',
    color: 'var(--color-text-primary, #1e293b)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sourceTag: {
    fontSize: '0.75rem',
    color: 'var(--color-text-tertiary, #94a3b8)',
    backgroundColor: 'var(--color-bg-primary, #f1f5f9)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm, 4px)',
    whiteSpace: 'nowrap',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-xs, 4px)',
  },
  meta: {
    fontSize: '0.75rem',
    color: 'var(--color-text-tertiary, #94a3b8)',
  },
  expandIcon: {
    fontSize: '1.2rem',
    color: 'var(--color-text-tertiary, #94a3b8)',
    transition: 'transform 0.2s ease',
  },
  content: {
    padding: 'var(--space-md, 16px)',
    maxHeight: '300px',
    overflow: 'auto',
  },
  contentCollapsed: {
    maxHeight: '100px',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  fadeOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: '50px',
    background: 'linear-gradient(transparent, var(--color-bg-secondary, #ffffff))',
    pointerEvents: 'none' as const,
  },
  text: {
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    fontSize: '0.875rem',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: 'var(--color-text-secondary, #475569)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-sm, 8px) var(--space-md, 16px)',
    backgroundColor: 'var(--color-bg-tertiary, #f8fafc)',
    borderTop: '1px solid var(--color-border, #e2e8f0)',
    gap: 'var(--space-sm, 8px)',
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-xs, 4px)',
  },
  actionButton: {
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: 500,
    border: '1px solid var(--color-border, #e2e8f0)',
    borderRadius: 'var(--radius-sm, 4px)',
    backgroundColor: 'var(--color-bg-primary, #ffffff)',
    color: 'var(--color-text-secondary, #475569)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-xs, 4px)',
  },
  actionButtonPrimary: {
    backgroundColor: 'var(--color-primary, #0891b2)',
    borderColor: 'var(--color-primary, #0891b2)',
    color: 'white',
  },
  statusBadge: {
    fontSize: '0.7rem',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm, 4px)',
    textTransform: 'uppercase' as const,
    fontWeight: 600,
  },
  statusOriginal: {
    backgroundColor: 'var(--color-success-light, #dcfce7)',
    color: 'var(--color-success, #16a34a)',
  },
  statusEdited: {
    backgroundColor: 'var(--color-warning-light, #fef3c7)',
    color: 'var(--color-warning, #d97706)',
  },
  statusDerived: {
    backgroundColor: 'var(--color-info-light, #e0f2fe)',
    color: 'var(--color-info, #0284c7)',
  },
};

// ============================================================
// PROPS
// ============================================================

export interface PassageCardProps {
  passage: Passage;
  uiState?: PassageUIState;
  isActive?: boolean;

  // Callbacks
  onSelect?: (id: string) => void;
  onActivate?: (id: string) => void;
  onToggleExpand?: (id: string) => void;
  onTransform?: (id: string) => void;
  onAnalyze?: (id: string) => void;
  onFindSimilar?: (id: string) => void;
  onSplit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
}

// ============================================================
// COMPONENT
// ============================================================

export function PassageCard({
  passage,
  uiState,
  isActive = false,
  onSelect,
  onActivate,
  onToggleExpand,
  onTransform,
  onAnalyze,
  onFindSimilar,
  onSplit,
  onDuplicate,
  onDelete,
  onEdit,
}: PassageCardProps) {
  const [hovering, setHovering] = useState(false);

  const isSelected = uiState?.isSelected ?? false;
  const isExpanded = uiState?.isExpanded ?? false;

  // Format metadata
  const wordCount = passage.metadata.wordCount;
  const readTime = passage.metadata.estimatedReadTime;
  const sourceType = passage.source.type;
  const platform = passage.source.platform;

  // Format date
  const dateStr = passage.metadata.date
    ? new Date(passage.metadata.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  // Get status badge style
  const statusStyle = {
    ...styles.statusBadge,
    ...(passage.status === 'original' ? styles.statusOriginal :
        passage.status === 'edited' ? styles.statusEdited :
        styles.statusDerived),
  };

  // Handle header click
  const handleHeaderClick = useCallback((e: React.MouseEvent) => {
    // Don't trigger if clicking checkbox
    if ((e.target as HTMLElement).tagName === 'INPUT') return;

    if (onActivate) {
      onActivate(passage.id);
    }
    if (onToggleExpand) {
      onToggleExpand(passage.id);
    }
  }, [passage.id, onActivate, onToggleExpand]);

  // Handle checkbox change
  const handleSelectChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(passage.id);
    }
  }, [passage.id, onSelect]);

  // Truncate content for preview
  const previewContent = isExpanded
    ? passage.content
    : passage.content.substring(0, 500);

  return (
    <div
      style={{
        ...styles.card,
        ...(isSelected ? styles.cardSelected : {}),
        ...(isActive ? styles.cardActive : {}),
        ...(hovering ? { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } : {}),
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Header */}
      <div style={styles.header} onClick={handleHeaderClick}>
        <div style={styles.headerLeft}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleSelectChange}
            style={styles.checkbox}
            onClick={(e) => e.stopPropagation()}
          />
          <span style={styles.title}>
            {passage.metadata.title || 'Untitled Passage'}
          </span>
          <span style={styles.sourceTag}>
            {platform || sourceType}
          </span>
          <span style={statusStyle}>
            {passage.status}
          </span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.meta}>
            {wordCount} words · {readTime} min
            {dateStr && ` · ${dateStr}`}
          </span>
          <span
            style={{
              ...styles.expandIcon,
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={isExpanded ? styles.content : styles.contentCollapsed}>
        <div style={styles.text}>
          {previewContent}
          {!isExpanded && passage.content.length > 500 && '...'}
        </div>
        {!isExpanded && passage.content.length > 300 && (
          <div style={styles.fadeOverlay} />
        )}
      </div>

      {/* Actions (show when expanded or active) */}
      {(isExpanded || isActive) && (
        <div style={styles.actions}>
          <div style={styles.actionGroup}>
            <button
              style={{ ...styles.actionButton, ...styles.actionButtonPrimary }}
              onClick={() => onTransform?.(passage.id)}
              title="Transform this passage"
            >
              Transform
            </button>
            <button
              style={styles.actionButton}
              onClick={() => onAnalyze?.(passage.id)}
              title="Analyze this passage"
            >
              Analyze
            </button>
            <button
              style={styles.actionButton}
              onClick={() => onFindSimilar?.(passage.id)}
              title="Find similar passages"
            >
              Find Similar
            </button>
          </div>
          <div style={styles.actionGroup}>
            <button
              style={styles.actionButton}
              onClick={() => onEdit?.(passage.id)}
              title="Edit passage"
            >
              Edit
            </button>
            <button
              style={styles.actionButton}
              onClick={() => onSplit?.(passage.id)}
              title="Split into multiple passages"
            >
              Split
            </button>
            <button
              style={styles.actionButton}
              onClick={() => onDuplicate?.(passage.id)}
              title="Duplicate passage"
            >
              Duplicate
            </button>
            <button
              style={{ ...styles.actionButton, color: 'var(--color-error, #dc2626)' }}
              onClick={() => onDelete?.(passage.id)}
              title="Delete passage"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PassageCard;
