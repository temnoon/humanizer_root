/**
 * BottomSheet Component
 *
 * Mobile-first bottom sheet for panel content on smaller screens.
 * Supports three states: collapsed (peek), partial (40vh), expanded (full).
 * Includes gesture support for drag-to-open/close.
 *
 * @module @humanizer/studio/components/ui/BottomSheet
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type BottomSheetState = 'collapsed' | 'partial' | 'expanded';

export interface BottomSheetProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Callback when sheet state changes */
  onStateChange?: (state: BottomSheetState) => void;
  /** Callback when sheet is closed */
  onClose?: () => void;
  /** Initial state when opened */
  initialState?: BottomSheetState;
  /** Title shown in the handle area */
  title?: string;
  /** Sheet content */
  children: React.ReactNode;
  /** Height when collapsed (peek) */
  peekHeight?: number;
  /** Height when partial (as vh percentage) */
  partialHeight?: number;
  /** Whether to show backdrop */
  showBackdrop?: boolean;
  /** Custom class name */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_PEEK_HEIGHT = 60;
const DEFAULT_PARTIAL_HEIGHT = 40; // 40vh
const DRAG_THRESHOLD = 50; // pixels to trigger state change
const VELOCITY_THRESHOLD = 0.5; // pixels per ms

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function BottomSheet({
  isOpen,
  onStateChange,
  onClose,
  initialState = 'collapsed',
  title,
  children,
  peekHeight = DEFAULT_PEEK_HEIGHT,
  partialHeight = DEFAULT_PARTIAL_HEIGHT,
  showBackdrop = true,
  className = '',
}: BottomSheetProps): React.ReactElement | null {
  const [state, setState] = useState<BottomSheetState>(initialState);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ y: number; time: number } | null>(null);
  const lastYRef = useRef(0);

  // Calculate height based on state
  const getHeight = useCallback(
    (sheetState: BottomSheetState): string => {
      switch (sheetState) {
        case 'collapsed':
          return `${peekHeight}px`;
        case 'partial':
          return `${partialHeight}vh`;
        case 'expanded':
          return 'calc(100vh - 60px)'; // Leave space for header
        default:
          return `${peekHeight}px`;
      }
    },
    [peekHeight, partialHeight]
  );

  // Update state and notify parent
  const updateState = useCallback(
    (newState: BottomSheetState) => {
      setState(newState);
      onStateChange?.(newState);
    },
    [onStateChange]
  );

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragStartRef.current = { y: touch.clientY, time: Date.now() };
    lastYRef.current = touch.clientY;
    setIsDragging(true);
  }, []);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragStartRef.current) return;

    const touch = e.touches[0];
    const deltaY = lastYRef.current - touch.clientY;
    lastYRef.current = touch.clientY;

    setDragOffset((prev) => prev + deltaY);
  }, []);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!dragStartRef.current) return;

    const deltaY = dragStartRef.current.y - lastYRef.current;
    const deltaTime = Date.now() - dragStartRef.current.time;
    const velocity = Math.abs(deltaY) / deltaTime;

    // Determine new state based on drag direction and velocity
    const isQuickSwipe = velocity > VELOCITY_THRESHOLD;
    const draggedUp = deltaY > 0;

    let newState = state;

    if (isQuickSwipe || Math.abs(deltaY) > DRAG_THRESHOLD) {
      if (draggedUp) {
        // Swiped up - expand
        if (state === 'collapsed') {
          newState = 'partial';
        } else if (state === 'partial') {
          newState = 'expanded';
        }
      } else {
        // Swiped down - collapse
        if (state === 'expanded') {
          newState = 'partial';
        } else if (state === 'partial') {
          newState = 'collapsed';
        } else if (state === 'collapsed') {
          onClose?.();
        }
      }
    }

    updateState(newState);
    setIsDragging(false);
    setDragOffset(0);
    dragStartRef.current = null;
  }, [state, updateState, onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(() => {
    if (state === 'expanded') {
      updateState('partial');
    } else {
      updateState('collapsed');
      onClose?.();
    }
  }, [state, updateState, onClose]);

  // Handle handle click (toggle state)
  const handleHandleClick = useCallback(() => {
    if (state === 'collapsed') {
      updateState('partial');
    } else if (state === 'partial') {
      updateState('expanded');
    } else {
      updateState('partial');
    }
  }, [state, updateState]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setState(initialState);
      setDragOffset(0);
    }
  }, [isOpen, initialState]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (state === 'expanded') {
          updateState('partial');
        } else {
          updateState('collapsed');
          onClose?.();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, state, updateState, onClose]);

  if (!isOpen) return null;

  const currentHeight = getHeight(state);
  const transform = isDragging ? `translateY(${-dragOffset}px)` : 'translateY(0)';

  return (
    <>
      {/* Backdrop */}
      {showBackdrop && state !== 'collapsed' && (
        <div
          className="bottom-sheet__backdrop"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`bottom-sheet bottom-sheet--${state} ${isDragging ? 'bottom-sheet--dragging' : ''} ${className}`}
        style={{
          height: currentHeight,
          transform,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Bottom sheet'}
      >
        {/* Handle */}
        <div
          className="bottom-sheet__handle"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleHandleClick}
          role="button"
          tabIndex={0}
          aria-label={state === 'expanded' ? 'Collapse sheet' : 'Expand sheet'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleHandleClick();
            }
          }}
        >
          <div className="bottom-sheet__handle-bar" />
          {title && <div className="bottom-sheet__title">{title}</div>}
        </div>

        {/* Content */}
        <div className="bottom-sheet__content">{children}</div>
      </div>
    </>
  );
}

export default BottomSheet;
