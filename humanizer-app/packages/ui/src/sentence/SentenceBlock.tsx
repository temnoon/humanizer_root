/**
 * SentenceBlock Component
 *
 * Renders a sentence with hover/click interaction for metrics display.
 * Supports inline editing and selection.
 */

import { useState, useCallback, useRef, type ReactNode } from 'react';
import type { SentenceMetrics, SentenceAnalysisConfig } from './types';
import { MetricsBadge } from './MetricsBadge';

interface SentenceBlockProps {
  /** The sentence text */
  text: string;

  /** Sentence index */
  index: number;

  /** Pre-computed metrics (optional) */
  metrics?: SentenceMetrics;

  /** Display configuration */
  config?: Partial<SentenceAnalysisConfig>;

  /** Called when sentence is clicked */
  onClick?: (index: number, metrics?: SentenceMetrics) => void;

  /** Called when sentence is hovered */
  onHover?: (index: number, metrics?: SentenceMetrics) => void;

  /** Called when hover ends */
  onHoverEnd?: () => void;

  /** Called when sentence is edited */
  onEdit?: (index: number, newText: string) => void;

  /** Whether this sentence is selected */
  isSelected?: boolean;

  /** Additional className */
  className?: string;

  /** Children to render after text */
  children?: ReactNode;
}

export function SentenceBlock({
  text,
  index,
  metrics,
  config = {},
  onClick,
  onHover,
  onHoverEnd,
  onEdit,
  isSelected = false,
  className = '',
  children,
}: SentenceBlockProps) {
  const {
    editable = false,
    showOnHover = true,
    showOnClick = true,
  } = config;

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const [isHovered, setIsHovered] = useState(false);
  const editRef = useRef<HTMLSpanElement>(null);

  const handleClick = useCallback(() => {
    if (showOnClick && onClick) {
      onClick(index, metrics);
    }
  }, [index, metrics, onClick, showOnClick]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (showOnHover && onHover) {
      onHover(index, metrics);
    }
  }, [index, metrics, onHover, showOnHover]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (onHoverEnd) {
      onHoverEnd();
    }
  }, [onHoverEnd]);

  const handleDoubleClick = useCallback(() => {
    if (editable) {
      setIsEditing(true);
      setEditText(text);
      // Focus the editable span after render
      setTimeout(() => {
        if (editRef.current) {
          editRef.current.focus();
          // Select all text
          const range = document.createRange();
          range.selectNodeContents(editRef.current);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }, 0);
    }
  }, [editable, text]);

  const handleBlur = useCallback(() => {
    if (isEditing) {
      setIsEditing(false);
      const newText = editRef.current?.textContent || text;
      if (newText !== text && onEdit) {
        onEdit(index, newText);
      }
    }
  }, [isEditing, text, index, onEdit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleBlur();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setEditText(text);
      }
    },
    [handleBlur, text]
  );

  const blockClasses = [
    'sentence-block',
    isSelected && 'sentence-block--selected',
    editable && 'sentence-block--editable',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={blockClasses}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
      data-sentence-index={index}
      role={editable ? 'textbox' : undefined}
      aria-selected={isSelected}
    >
      {/* Inline metric indicator (shown on hover) */}
      {metrics && isHovered && (
        <span className="sentence-block__indicator">
          <MetricsBadge type="sic" value={metrics.sicScore} level={metrics.sicLevel} />
        </span>
      )}

      {/* Sentence text */}
      {isEditing ? (
        <span
          ref={editRef}
          className="sentence-block__text inline-editor"
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        >
          {editText}
        </span>
      ) : (
        <span className="sentence-block__text">{text}</span>
      )}

      {children}
    </span>
  );
}

/**
 * Renders a block of text with sentence-level analysis
 */
interface SentenceRendererProps {
  /** Full text content */
  text: string;

  /** Array of sentence metrics */
  sentences: SentenceMetrics[];

  /** Configuration */
  config?: Partial<SentenceAnalysisConfig>;

  /** Called when a sentence is selected */
  onSelectSentence?: (index: number, metrics: SentenceMetrics) => void;

  /** Called when a sentence is edited */
  onEditSentence?: (index: number, newText: string) => void;

  /** Currently selected sentence index */
  selectedIndex?: number;

  /** Additional className */
  className?: string;
}

export function SentenceRenderer({
  text,
  sentences,
  config = {},
  onSelectSentence,
  onEditSentence,
  selectedIndex,
  className = '',
}: SentenceRendererProps) {
  const handleClick = useCallback(
    (index: number, metrics?: SentenceMetrics) => {
      if (onSelectSentence && metrics) {
        onSelectSentence(index, metrics);
      }
    },
    [onSelectSentence]
  );

  return (
    <div className={`sentence-renderer ${className}`}>
      {sentences.map((sentence, i) => (
        <SentenceBlock
          key={`sentence-${i}`}
          text={sentence.text}
          index={i}
          metrics={sentence}
          config={config}
          onClick={handleClick}
          onEdit={onEditSentence}
          isSelected={selectedIndex === i}
        />
      ))}
    </div>
  );
}

export default SentenceBlock;
