/**
 * Studio Layout - 3-Panel Narrative Composer
 *
 * Responsive behavior:
 * - Desktop (≥768px): Traditional 3-panel layout with resizable side panels
 * - Mobile (<768px): Center content with bottom sheet overlays
 *
 * Mobile UX uses bottom sheets for a native iOS/Android feel:
 * - Swipe up/down to expand/collapse
 * - Only one sheet fully expanded at a time
 * - Peek view shows title and icon
 */

import { Component, createSignal, createEffect, onMount, onCleanup, Show, JSX } from 'solid-js';
import { BottomSheet, type SheetState } from './BottomSheet';
import { SheetProvider } from '@/contexts/SheetContext';

interface StudioLayoutProps {
  leftPanel?: JSX.Element;
  centerPanel: JSX.Element;
  rightPanel?: JSX.Element;
  leftTitle?: string;
  rightTitle?: string;
  leftIcon?: string;
  rightIcon?: string;
  leftWidth?: number;
  rightWidth?: number;
  minPanelWidth?: number;
}

// Breakpoint for mobile/desktop (matches --bp-md)
const MOBILE_BREAKPOINT = 768;

export const StudioLayout: Component<StudioLayoutProps> = (props) => {
  // Reactive mobile detection
  const [isMobile, setIsMobile] = createSignal(
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );

  // Desktop panel states
  const [leftOpen, setLeftOpen] = createSignal(!isMobile());
  const [rightOpen, setRightOpen] = createSignal(!isMobile());
  const [leftWidth, setLeftWidth] = createSignal(props.leftWidth || 280);
  const [rightWidth, setRightWidth] = createSignal(props.rightWidth || 320);
  const [isDraggingLeft, setIsDraggingLeft] = createSignal(false);
  const [isDraggingRight, setIsDraggingRight] = createSignal(false);

  // Mobile sheet states
  const [leftSheetState, setLeftSheetState] = createSignal<SheetState>('collapsed');
  const [rightSheetState, setRightSheetState] = createSignal<SheetState>('collapsed');

  const minWidth = props.minPanelWidth || 200;
  const maxWidth = 500;

  // Handle window resize
  const handleResize = () => {
    const nowMobile = window.innerWidth < MOBILE_BREAKPOINT;
    const wasMobile = isMobile();

    if (nowMobile !== wasMobile) {
      setIsMobile(nowMobile);

      // Transition states when crossing breakpoint
      if (nowMobile) {
        // Going to mobile - collapse desktop panels, collapse sheets
        setLeftOpen(false);
        setRightOpen(false);
        setLeftSheetState('collapsed');
        setRightSheetState('collapsed');
      } else {
        // Going to desktop - expand panels if they have content
        if (props.leftPanel) setLeftOpen(true);
        if (props.rightPanel) setRightOpen(true);
      }
    }
  };

  // Setup resize listener
  onMount(() => {
    window.addEventListener('resize', handleResize);
    // Initial check
    handleResize();
  });

  onCleanup(() => {
    window.removeEventListener('resize', handleResize);
  });

  // Handle resize drag (desktop only)
  const handleMouseMove = (e: MouseEvent) => {
    if (isDraggingLeft()) {
      const newWidth = Math.min(maxWidth, Math.max(minWidth, e.clientX));
      setLeftWidth(newWidth);
    }
    if (isDraggingRight()) {
      const newWidth = Math.min(maxWidth, Math.max(minWidth, window.innerWidth - e.clientX));
      setRightWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsDraggingLeft(false);
    setIsDraggingRight(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  createEffect(() => {
    if (isDraggingLeft() || isDraggingRight()) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  });

  // Toggle left panel (desktop)
  const toggleLeft = () => {
    setLeftOpen(!leftOpen());
  };

  // Toggle right panel (desktop)
  const toggleRight = () => {
    setRightOpen(!rightOpen());
  };

  // Sheet state change handlers (mobile)
  const handleLeftSheetChange = (state: SheetState) => {
    setLeftSheetState(state);
    // If left is expanding, collapse right
    if (state === 'expanded') {
      setRightSheetState('collapsed');
    }
  };

  const handleRightSheetChange = (state: SheetState) => {
    setRightSheetState(state);
    // If right is expanding, collapse left
    if (state === 'expanded') {
      setLeftSheetState('collapsed');
    }
  };

  return (
    <SheetProvider>
      <div class={`studio-layout ${isMobile() ? 'mobile' : 'desktop'}`}>
        {/* =================================================================
            DESKTOP LAYOUT (≥768px)
            ================================================================= */}
        <Show when={!isMobile()}>
          {/* Left Panel */}
          <Show when={props.leftPanel}>
            <div
              class={`studio-panel left ${leftOpen() ? 'open' : 'collapsed'}`}
              style={{ width: leftOpen() ? `${leftWidth()}px` : '40px' }}
            >
              <div class="panel-header">
                <Show when={leftOpen()}>
                  <span class="panel-title">{props.leftTitle || 'Navigation'}</span>
                </Show>
                <button
                  class="panel-toggle"
                  onClick={toggleLeft}
                  title={leftOpen() ? 'Collapse' : 'Expand'}
                >
                  {leftOpen() ? '◀' : '▶'}
                </button>
              </div>
              <Show when={leftOpen()}>
                <div class="panel-content">
                  {props.leftPanel}
                </div>
              </Show>
            </div>

            {/* Left Resize Handle */}
            <Show when={leftOpen()}>
              <div
                class="resize-handle left"
                onMouseDown={() => setIsDraggingLeft(true)}
              />
            </Show>
          </Show>

          {/* Center Panel - Always visible */}
          <div class="studio-panel center">
            <div class="panel-content">
              {props.centerPanel}
            </div>
          </div>

          {/* Right Resize Handle */}
          <Show when={props.rightPanel && rightOpen()}>
            <div
              class="resize-handle right"
              onMouseDown={() => setIsDraggingRight(true)}
            />
          </Show>

          {/* Right Panel */}
          <Show when={props.rightPanel}>
            <div
              class={`studio-panel right ${rightOpen() ? 'open' : 'collapsed'}`}
              style={{ width: rightOpen() ? `${rightWidth()}px` : '40px' }}
            >
              <div class="panel-header">
                <button
                  class="panel-toggle"
                  onClick={toggleRight}
                  title={rightOpen() ? 'Collapse' : 'Expand'}
                >
                  {rightOpen() ? '▶' : '◀'}
                </button>
                <Show when={rightOpen()}>
                  <span class="panel-title">{props.rightTitle || 'Context'}</span>
                </Show>
              </div>
              <Show when={rightOpen()}>
                <div class="panel-content">
                  {props.rightPanel}
                </div>
              </Show>
            </div>
          </Show>
        </Show>

        {/* =================================================================
            MOBILE LAYOUT (<768px)
            ================================================================= */}
        <Show when={isMobile()}>
          {/* Center Panel - Full width on mobile */}
          <div class="studio-panel center mobile-center">
            <div class="panel-content">
              {props.centerPanel}
            </div>
          </div>

          {/* Bottom Sheets */}
          <Show when={props.leftPanel}>
            <BottomSheet
              id="nav-sheet"
              title={props.leftTitle || 'Navigation'}
              icon={props.leftIcon || '☰'}
              state={() => leftSheetState()}
              onStateChange={handleLeftSheetChange}
              zIndex={101}
            >
              {props.leftPanel}
            </BottomSheet>
          </Show>

          <Show when={props.rightPanel}>
            <BottomSheet
              id="tools-sheet"
              title={props.rightTitle || 'Tools'}
              icon={props.rightIcon || '⚙'}
              state={() => rightSheetState()}
              onStateChange={handleRightSheetChange}
              zIndex={100}
            >
              {props.rightPanel}
            </BottomSheet>
          </Show>

          {/* Sheet backdrop - visible when any sheet is expanded */}
          <div
            class={`sheet-backdrop ${(leftSheetState() === 'expanded' || rightSheetState() === 'expanded') ? 'visible' : ''}`}
            onClick={() => {
              setLeftSheetState('collapsed');
              setRightSheetState('collapsed');
            }}
          />
        </Show>
      </div>
    </SheetProvider>
  );
};
