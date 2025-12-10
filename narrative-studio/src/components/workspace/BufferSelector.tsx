/**
 * BufferSelector - Dropdown for selecting a buffer from the workspace tree
 *
 * Shows buffer tree in a dropdown with indentation for hierarchy.
 * Used in MainWorkspace pane headers to switch active/compare buffers.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import type { BufferNode, Buffer } from '../../types/workspace';
import './BufferSelector.css';

// Transform type icons (same as BufferTreeView)
const TRANSFORM_ICONS: Record<string, string> = {
  humanizer: '🤖',
  persona: '👤',
  style: '🎨',
  'round-trip': '🔄',
  'ai-analysis': '🔬',
  'manual-edit': '✏️',
  original: '📄',
};

interface BufferSelectorProps {
  /** Current selected buffer */
  selectedBuffer: Buffer | null;
  /** Buffer tree for dropdown options */
  bufferTree: BufferNode | null;
  /** Callback when a buffer is selected */
  onSelect: (bufferId: string) => void;
  /** Label for the selector (e.g., "Compare" or "Active") */
  label?: string;
  /** Optional: ID to exclude from options (e.g., active buffer when selecting compare) */
  excludeId?: string;
  /** Allow clearing selection */
  allowClear?: boolean;
  /** Placeholder when nothing selected */
  placeholder?: string;
}

interface FlattenedBuffer {
  id: string;
  displayName: string;
  depth: number;
  transform?: { type: string };
  isActive: boolean;
  isCompare: boolean;
  aiScore?: number;
}

export function BufferSelector({
  selectedBuffer,
  bufferTree,
  onSelect,
  label,
  excludeId,
  allowClear = false,
  placeholder = 'Select buffer...',
}: BufferSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Flatten tree for dropdown
  const flattenedOptions = useMemo((): FlattenedBuffer[] => {
    if (!bufferTree) return [];

    const result: FlattenedBuffer[] = [];
    const flatten = (node: BufferNode) => {
      result.push({
        id: node.id,
        displayName: node.displayName || 'Buffer',
        depth: node.depth,
        transform: node.transform,
        isActive: node.isActive,
        isCompare: node.isCompare,
        aiScore: node.analysis?.aiScore,
      });
      node.children.forEach(flatten);
    };
    flatten(bufferTree);
    return result;
  }, [bufferTree]);

  // Filter out excluded buffer
  const filteredOptions = useMemo(() => {
    if (!excludeId) return flattenedOptions;
    return flattenedOptions.filter(b => b.id !== excludeId);
  }, [flattenedOptions, excludeId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Get icon for buffer
  const getIcon = (transform?: { type: string }): string => {
    if (!transform) return TRANSFORM_ICONS.original;
    return TRANSFORM_ICONS[transform.type] || '📄';
  };

  // Get AI score badge class
  const getScoreClass = (score: number | undefined): string => {
    if (score === undefined) return '';
    if (score <= 30) return 'buffer-selector__score--good';
    if (score <= 60) return 'buffer-selector__score--warning';
    return 'buffer-selector__score--high';
  };

  const handleSelect = (bufferId: string) => {
    onSelect(bufferId);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(''); // Empty string signals clear
    setIsOpen(false);
  };

  return (
    <div className="buffer-selector" ref={dropdownRef}>
      {label && <span className="buffer-selector__label">{label}</span>}

      <button
        className={`buffer-selector__trigger ${isOpen ? 'buffer-selector__trigger--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        {selectedBuffer ? (
          <>
            <span className="buffer-selector__icon">
              {getIcon(selectedBuffer.transform)}
            </span>
            <span className="buffer-selector__name">
              {selectedBuffer.displayName || 'Buffer'}
            </span>
            {selectedBuffer.analysis?.aiScore !== undefined && (
              <span className={`buffer-selector__score ${getScoreClass(selectedBuffer.analysis.aiScore)}`}>
                {Math.round(selectedBuffer.analysis.aiScore)}%
              </span>
            )}
          </>
        ) : (
          <span className="buffer-selector__placeholder">{placeholder}</span>
        )}
        <span className="buffer-selector__chevron">{isOpen ? '▲' : '▼'}</span>
      </button>

      {allowClear && selectedBuffer && (
        <span
          className="buffer-selector__clear"
          onClick={handleClear}
          title="Clear selection"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
        >
          ✕
        </span>
      )}

      {isOpen && (
        <div className="buffer-selector__dropdown">
          {filteredOptions.length === 0 ? (
            <div className="buffer-selector__empty">No buffers available</div>
          ) : (
            filteredOptions.map((buffer) => (
              <button
                key={buffer.id}
                className={`buffer-selector__option ${
                  selectedBuffer?.id === buffer.id ? 'buffer-selector__option--selected' : ''
                } ${buffer.isActive ? 'buffer-selector__option--active' : ''} ${
                  buffer.isCompare ? 'buffer-selector__option--compare' : ''
                }`}
                style={{ paddingLeft: `calc(var(--space-sm) + ${buffer.depth * 12}px)` }}
                onClick={() => handleSelect(buffer.id)}
                type="button"
              >
                <span className="buffer-selector__option-icon">
                  {getIcon(buffer.transform)}
                </span>
                <span className="buffer-selector__option-name">
                  {buffer.displayName}
                </span>
                {buffer.aiScore !== undefined && (
                  <span className={`buffer-selector__score ${getScoreClass(buffer.aiScore)}`}>
                    {Math.round(buffer.aiScore)}%
                  </span>
                )}
                {buffer.isActive && (
                  <span className="buffer-selector__badge buffer-selector__badge--active">A</span>
                )}
                {buffer.isCompare && (
                  <span className="buffer-selector__badge buffer-selector__badge--compare">C</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default BufferSelector;
