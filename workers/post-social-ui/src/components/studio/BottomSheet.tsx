/**
 * BottomSheet Component
 *
 * A mobile-first bottom sheet pattern for studio panels.
 * Replaces slide-in overlays with a native iOS/Android feel.
 *
 * States:
 * - collapsed: Shows peek height (60px) with handle and title
 * - partial: 40vh - shows enough content to browse
 * - expanded: Full height - complete panel access
 *
 * Features:
 * - Touch gesture support (swipe up/down)
 * - Keyboard accessible (Escape to collapse, Tab navigation)
 * - Spring physics animations
 * - Respects safe areas (iOS notch)
 * - Coordinates with other sheets (only one expanded at a time)
 */

import { Component, JSX, createSignal, createEffect, onMount, onCleanup, Show, Accessor } from 'solid-js';

export type SheetState = 'collapsed' | 'partial' | 'expanded';

export interface BottomSheetProps {
  /** Content to render inside the sheet */
  children: JSX.Element;
  /** Title shown in the sheet header */
  title: string;
  /** Icon shown when collapsed */
  icon?: string;
  /** Initial state of the sheet */
  initialState?: SheetState;
  /** Controlled state (optional) */
  state?: Accessor<SheetState>;
  /** Callback when state changes */
  onStateChange?: (state: SheetState) => void;
  /** Whether to show the sheet at all */
  show?: boolean;
  /** Z-index for stacking (default: 100) */
  zIndex?: number;
  /** ID for accessibility and sheet coordination */
  id: string;
}

// Spring physics configuration
const SPRING_CONFIG = {
  stiffness: 300,
  damping: 30,
  mass: 1,
};

// Velocity threshold for flick gestures (pixels/ms)
const FLICK_THRESHOLD = 0.5;

// Minimum drag distance to consider a gesture (pixels)
const MIN_DRAG_DISTANCE = 10;

export const BottomSheet: Component<BottomSheetProps> = (props) => {
  // Internal state management
  const [internalState, setInternalState] = createSignal<SheetState>(props.initialState || 'collapsed');

  // Use controlled state if provided, otherwise internal
  const currentState = () => props.state?.() ?? internalState();

  // Touch tracking
  const [isDragging, setIsDragging] = createSignal(false);
  const [dragOffset, setDragOffset] = createSignal(0);
  const [startY, setStartY] = createSignal(0);
  const [startTime, setStartTime] = createSignal(0);
  const [currentY, setCurrentY] = createSignal(0);

  // Animation
  const [isAnimating, setIsAnimating] = createSignal(false);

  // Refs
  let sheetRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;

  // Calculate heights based on CSS variables
  const getHeights = () => {
    if (typeof window === 'undefined') {
      return { peek: 60, partial: 300, full: 600 };
    }

    const styles = getComputedStyle(document.documentElement);
    const headerHeight = parseInt(styles.getPropertyValue('--header-height') || '64', 10);
    const viewportHeight = window.innerHeight;

    return {
      peek: 60, // --sheet-peek-height
      partial: Math.round(viewportHeight * 0.4), // 40vh
      full: viewportHeight - headerHeight, // Full minus header
    };
  };

  // Get current height based on state
  const getHeightForState = (state: SheetState): number => {
    const heights = getHeights();
    switch (state) {
      case 'collapsed': return heights.peek;
      case 'partial': return heights.partial;
      case 'expanded': return heights.full;
    }
  };

  // Calculate display height (with drag offset during gesture)
  const displayHeight = () => {
    const baseHeight = getHeightForState(currentState());
    if (isDragging()) {
      // Clamp the drag so we don't go below peek or above full
      const heights = getHeights();
      return Math.max(heights.peek, Math.min(heights.full, baseHeight - dragOffset()));
    }
    return baseHeight;
  };

  // Determine state from height
  const getStateFromHeight = (height: number): SheetState => {
    const heights = getHeights();
    const partialThreshold = (heights.peek + heights.partial) / 2;
    const fullThreshold = (heights.partial + heights.full) / 2;

    if (height < partialThreshold) return 'collapsed';
    if (height < fullThreshold) return 'partial';
    return 'expanded';
  };

  // Set state (notify parent if controlled)
  const setState = (newState: SheetState) => {
    if (props.onStateChange) {
      props.onStateChange(newState);
    } else {
      setInternalState(newState);
    }
  };

  // Handle touch start
  const handleTouchStart = (e: TouchEvent) => {
    // Only track gestures on the handle area or when scrolled to top
    const target = e.target as HTMLElement;
    const isHandle = target.closest('.sheet-handle-area');
    const isScrolledToTop = contentRef && contentRef.scrollTop <= 0;

    if (!isHandle && !isScrolledToTop) return;

    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
    setStartTime(Date.now());
    setDragOffset(0);
  };

  // Handle touch move
  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging()) return;

    const y = e.touches[0].clientY;
    setCurrentY(y);

    const delta = y - startY();

    // Only start tracking if we've moved enough
    if (Math.abs(delta) < MIN_DRAG_DISTANCE) return;

    // Prevent scroll while dragging
    e.preventDefault();

    setDragOffset(delta);
  };

  // Handle touch end
  const handleTouchEnd = () => {
    if (!isDragging()) return;

    const delta = currentY() - startY();
    const duration = Date.now() - startTime();
    const velocity = delta / duration;

    setIsDragging(false);

    // Determine new state based on velocity or position
    let newState: SheetState;

    if (Math.abs(velocity) > FLICK_THRESHOLD) {
      // Flick gesture - use velocity direction
      if (velocity > 0) {
        // Swiping down - collapse
        newState = currentState() === 'expanded' ? 'partial' : 'collapsed';
      } else {
        // Swiping up - expand
        newState = currentState() === 'collapsed' ? 'partial' : 'expanded';
      }
    } else {
      // Position-based - snap to nearest state
      const currentHeight = displayHeight();
      newState = getStateFromHeight(currentHeight);
    }

    // Animate to new state
    setIsAnimating(true);
    setState(newState);
    setDragOffset(0);

    // Clear animation flag after transition
    setTimeout(() => setIsAnimating(false), 300);
  };

  // Handle click on collapsed sheet
  const handlePeekClick = () => {
    if (currentState() === 'collapsed') {
      setIsAnimating(true);
      setState('partial');
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && currentState() !== 'collapsed') {
      setIsAnimating(true);
      setState('collapsed');
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  // Handle expand button click
  const handleExpandClick = (e: MouseEvent) => {
    e.stopPropagation();
    setIsAnimating(true);
    if (currentState() === 'expanded') {
      setState('partial');
    } else {
      setState('expanded');
    }
    setTimeout(() => setIsAnimating(false), 300);
  };

  // Handle collapse button click
  const handleCollapseClick = (e: MouseEvent) => {
    e.stopPropagation();
    setIsAnimating(true);
    setState('collapsed');
    setTimeout(() => setIsAnimating(false), 300);
  };

  // Setup event listeners
  onMount(() => {
    if (sheetRef) {
      sheetRef.addEventListener('touchstart', handleTouchStart, { passive: true });
      sheetRef.addEventListener('touchmove', handleTouchMove, { passive: false });
      sheetRef.addEventListener('touchend', handleTouchEnd);
    }

    document.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    if (sheetRef) {
      sheetRef.removeEventListener('touchstart', handleTouchStart);
      sheetRef.removeEventListener('touchmove', handleTouchMove);
      sheetRef.removeEventListener('touchend', handleTouchEnd);
    }

    document.removeEventListener('keydown', handleKeyDown);
  });

  // Don't render if show is explicitly false
  if (props.show === false) return null;

  return (
    <div
      ref={sheetRef}
      id={props.id}
      class={`bottom-sheet ${currentState()} ${isDragging() ? 'dragging' : ''} ${isAnimating() ? 'animating' : ''}`}
      style={{
        '--sheet-height': `${displayHeight()}px`,
        '--sheet-z-index': props.zIndex || 100,
      }}
      role="dialog"
      aria-modal="false"
      aria-label={props.title}
      tabIndex={0}
    >
      {/* Handle area - always draggable */}
      <div
        class="sheet-handle-area"
        onClick={handlePeekClick}
      >
        <div class="sheet-handle" />

        {/* Collapsed view */}
        <Show when={currentState() === 'collapsed'}>
          <div class="sheet-peek">
            <Show when={props.icon}>
              <span class="sheet-icon">{props.icon}</span>
            </Show>
            <span class="sheet-title">{props.title}</span>
          </div>
        </Show>

        {/* Expanded header */}
        <Show when={currentState() !== 'collapsed'}>
          <div class="sheet-header">
            <span class="sheet-title">{props.title}</span>
            <div class="sheet-controls">
              <button
                class="sheet-btn expand"
                onClick={handleExpandClick}
                title={currentState() === 'expanded' ? 'Shrink' : 'Expand'}
                aria-label={currentState() === 'expanded' ? 'Shrink sheet' : 'Expand sheet'}
              >
                {currentState() === 'expanded' ? '⌄' : '⌃'}
              </button>
              <button
                class="sheet-btn collapse"
                onClick={handleCollapseClick}
                title="Collapse"
                aria-label="Collapse sheet"
              >
                ✕
              </button>
            </div>
          </div>
        </Show>
      </div>

      {/* Content area - scrollable */}
      <Show when={currentState() !== 'collapsed'}>
        <div ref={contentRef} class="sheet-content">
          {props.children}
        </div>
      </Show>
    </div>
  );
};

/**
 * Hook for external sheet state control
 */
export function useBottomSheet(initialState: SheetState = 'collapsed') {
  const [state, setState] = createSignal<SheetState>(initialState);

  const expand = () => setState('expanded');
  const partial = () => setState('partial');
  const collapse = () => setState('collapsed');
  const toggle = () => {
    setState(s => s === 'collapsed' ? 'partial' : 'collapsed');
  };

  return {
    state,
    setState,
    expand,
    partial,
    collapse,
    toggle,
  };
}

export default BottomSheet;
