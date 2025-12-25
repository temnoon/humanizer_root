/**
 * SelectionToolbar Component
 *
 * Floating toolbar that appears when text is selected.
 * Provides quick access to transform actions.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSelection } from './SelectionContext';
import type { TransformAction, TransformMenuGroup } from './types';

interface SelectionToolbarProps {
  /** Position offset from selection rect */
  offset?: { x: number; y: number };

  /** Show transform menu on click */
  showMenu?: boolean;

  /** Additional className */
  className?: string;
}

// Default action groups
const DEFAULT_GROUPS: TransformMenuGroup[] = [
  {
    id: 'transform',
    label: 'Transform',
    actions: [],
  },
  {
    id: 'style',
    label: 'Style',
    actions: [],
  },
  {
    id: 'generate',
    label: 'Generate',
    actions: [],
  },
  {
    id: 'analyze',
    label: 'Analyze',
    actions: [],
  },
];

export function SelectionToolbar({
  offset = { x: 0, y: -10 },
  showMenu = true,
  className = '',
}: SelectionToolbarProps) {
  const { selection, mode, actions, executeAction, clearSelection } = useSelection();
  const [menuOpen, setMenuOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Update position when selection changes
  useEffect(() => {
    if (selection?.rect && mode === 'selected') {
      const rect = selection.rect;
      const toolbarWidth = toolbarRef.current?.offsetWidth || 200;

      // Position above the selection, centered
      let left = rect.left + rect.width / 2 - toolbarWidth / 2 + offset.x;
      let top = rect.top + window.scrollY + offset.y - 50; // 50px above

      // Keep within viewport
      left = Math.max(10, Math.min(left, window.innerWidth - toolbarWidth - 10));
      top = Math.max(10, top);

      setPosition({ top, left });
    }
  }, [selection, mode, offset]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  const handleActionClick = useCallback(
    async (actionId: string) => {
      await executeAction(actionId);
      setMenuOpen(false);
    },
    [executeAction]
  );

  const handleMenuToggle = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  // Group actions by their group
  const groupedActions = actions.reduce((acc, action) => {
    const group = action.group || 'transform';
    if (!acc[group]) acc[group] = [];
    acc[group].push(action);
    return acc;
  }, {} as Record<string, TransformAction[]>);

  // Don't render if no selection
  if (!selection || mode !== 'selected') {
    return null;
  }

  const toolbarClasses = [
    'selection-toolbar',
    'selection-toolbar--visible',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={toolbarRef}
      className={toolbarClasses}
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      role="toolbar"
      aria-label="Selection actions"
    >
      {/* Quick action buttons */}
      <button
        className="selection-action"
        onClick={() => handleActionClick('analyze')}
        title="Analyze selection"
      >
        <svg className="selection-action__icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm1 12H7V7h2v5zm0-6H7V4h2v2z" />
        </svg>
      </button>

      <button
        className="selection-action"
        onClick={() => handleActionClick('transform-persona')}
        title="Apply persona"
      >
        <svg className="selection-action__icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      </button>

      <button
        className="selection-action"
        onClick={() => handleActionClick('transform-style')}
        title="Apply style"
      >
        <svg className="selection-action__icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2h12v2H2V2zm0 4h8v2H2V6zm0 4h10v2H2v-2zm0 4h6v2H2v-2z" />
        </svg>
      </button>

      <div className="selection-toolbar__divider" />

      {showMenu && (
        <button
          className="selection-action"
          onClick={handleMenuToggle}
          title="More actions"
          aria-expanded={menuOpen}
        >
          <svg className="selection-action__icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2a2 2 0 110 4 2 2 0 010-4zm0 5a2 2 0 110 4 2 2 0 010-4zm0 5a2 2 0 110 4 2 2 0 010-4z" />
          </svg>
        </button>
      )}

      {/* Transform menu dropdown */}
      {menuOpen && (
        <div
          className="transform-menu transform-menu--visible"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 'var(--space-small)',
          }}
        >
          {DEFAULT_GROUPS.map((group) => {
            const groupActions = groupedActions[group.id] || [];
            if (groupActions.length === 0) return null;

            return (
              <div key={group.id} className="transform-menu__group">
                <div className="transform-menu__label">{group.label}</div>
                {groupActions.map((action) => (
                  <button
                    key={action.id}
                    className="transform-menu__item"
                    onClick={() => handleActionClick(action.id)}
                  >
                    <span className="transform-menu__item-label">{action.label}</span>
                    {action.shortcut && (
                      <span className="transform-menu__item-shortcut">{action.shortcut}</span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SelectionToolbar;
